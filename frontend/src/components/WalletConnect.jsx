import { useCallback, useEffect, useState } from "react";
import {
  DAppConnector,
  HederaSessionEvent,
  HederaJsonRpcMethod,
} from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { WalletContext, useWallet } from "./walletContext";

const WALLET_CONNECT_PROJECT_ID = "04458c4b5373b3bfe7f13418f0271717";
const APP_METADATA = {
  name: "AccessMint",
  description: "Tokenized API Access Marketplace",
  url: "http://localhost:5173",
  icons: ["https://accessmint.xyz/icon.png"],
};
const WALLET_AUTH_STORAGE_KEY = "accessmint.walletAuth";
const WALLET_SIGN_TIMEOUT_MS = 20_000;
const REQUIRE_WALLET_SIGNATURE =
  import.meta.env.VITE_REQUIRE_WALLET_SIGNATURE === "true";

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function getStoredAuth(account) {
  try {
    const raw = window.localStorage.getItem(WALLET_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored.accountId !== account.toString()) return null;
    if (stored.expiresAt <= Date.now()) return null;
    return stored;
  } catch {
    return null;
  }
}

function clearStoredAuth() {
  window.localStorage.removeItem(WALLET_AUTH_STORAGE_KEY);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export function WalletProvider({ children }) {
  const [connector, setConnector] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const validateStoredAuth = useCallback(async (stored) => {
    const response = await fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${stored.sessionToken}` },
    });
    if (!response.ok) return false;
    setAuthToken(stored.sessionToken);
    return true;
  }, []);

  const authenticateWallet = useCallback(async (signer, account) => {
    const stored = getStoredAuth(account);
    if (stored && (await validateStoredAuth(stored))) {
      setAuthError("");
      return stored.sessionToken;
    }

    clearStoredAuth();
    setAuthToken("");
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const accountString = account.toString();
      if (!REQUIRE_WALLET_SIGNATURE) {
        const sessionRes = await fetch("/api/auth/walletconnect-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: accountString }),
        });
        const sessionData = await sessionRes.json();
        if (!sessionRes.ok) {
          throw new Error(sessionData.message || sessionData.error || "Wallet session auth failed");
        }

        const storedAuth = {
          accountId: accountString,
          sessionToken: sessionData.sessionToken,
          expiresAt: sessionData.expiresAt,
        };
        window.localStorage.setItem(WALLET_AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
        setAuthToken(sessionData.sessionToken);
        setAuthError("");
        return sessionData.sessionToken;
      }

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountString }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) {
        throw new Error(nonceData.message || nonceData.error || "Wallet auth challenge failed");
      }

      const messageBytes = new TextEncoder().encode(nonceData.message);
      const [walletSignature] = await withTimeout(
        signer.sign([messageBytes]),
        WALLET_SIGN_TIMEOUT_MS,
        "Wallet signature timed out. Open your wallet approval window or reconnect and try again.",
      );
      const signature = bytesToBase64(walletSignature.signature);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountString,
          nonce: nonceData.nonce,
          signature,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || verifyData.error || "Wallet signature verification failed");
      }

      const storedAuth = {
        accountId: accountString,
        sessionToken: verifyData.sessionToken,
        expiresAt: verifyData.expiresAt,
      };
      window.localStorage.setItem(WALLET_AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
      setAuthToken(verifyData.sessionToken);
      setAuthError("");
      return verifyData.sessionToken;
    } catch (err) {
      setAuthError(err.message || "Wallet authentication failed");
      setAuthToken("");
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [validateStoredAuth]);

  // Initialize DAppConnector on mount
  useEffect(() => {
    const init = async () => {
      try {
        const dAppConnector = new DAppConnector(
          APP_METADATA,
          LedgerId.TESTNET,
          WALLET_CONNECT_PROJECT_ID,
          Object.values(HederaJsonRpcMethod),
          [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        );
        await dAppConnector.init({ logger: "error" });
        setConnector(dAppConnector);

        // Check for existing session
        const existingSessions =
          dAppConnector.walletConnectClient?.session?.getAll();
        if (existingSessions && existingSessions.length > 0) {
          const signers = dAppConnector.signers;
          if (signers && signers.length > 0) {
            const signer = signers[0];
            const account = signer.getAccountId();
            setAccountId(account);
            const stored = getStoredAuth(account);
            if (stored && (await validateStoredAuth(stored))) {
              console.log("Restored authenticated wallet session:", account.toString());
            } else {
              clearStoredAuth();
              setAuthError("Authorize your wallet to continue.");
              console.log("Restored wallet session:", account.toString());
            }
          }
        }

        setIsInitialized(true);
      } catch (err) {
        console.error("Failed to initialize WalletConnect:", err);
        setAuthError(err.message || "Wallet authentication failed");
        setIsInitialized(true);
        setIsAuthenticating(false);
      }
    };
    init();
  }, [validateStoredAuth]);

  const connect = async () => {
    if (!connector) return;
    setIsConnecting(true);
    try {
      await connector.openModal();
      const signers = connector.signers;
      if (signers && signers.length > 0) {
        const signer = signers[0];
        const account = signer.getAccountId();
        setAccountId(account);
        console.log("Connected wallet:", account.toString());
        await authenticateWallet(signer, account);
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setAuthError(err.message || "Wallet connection failed");
      setAuthToken("");
    }
    setIsConnecting(false);
    setIsAuthenticating(false);
  };

  const authenticateConnectedWallet = async () => {
    if (!connector) return;
    const signer = connector.signers?.[0];
    if (!signer) {
      setAuthError("Reconnect your wallet, then try again.");
      return;
    }

    const account = signer.getAccountId();
    setAccountId(account);
    try {
      await authenticateWallet(signer, account);
    } catch (err) {
      console.error("Failed to authenticate wallet:", err);
    }
  };

  const disconnect = async () => {
    if (!connector) return;
    try {
      await connector.disconnectAll();
      setAccountId(null);
      setAuthToken("");
      setAuthError("");
      clearStoredAuth();
      console.log("Wallet disconnected");
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  // Get the signer for transaction signing
  const getSigner = () => {
    if (!connector || !accountId) return null;
    const signers = connector.signers;
    return signers?.[0] || null;
  };

  // Sign and execute a transaction
  const signTransaction = async (transaction) => {
    const signer = getSigner();
    if (!signer) throw new Error("No wallet connected");

    const signedTx = await transaction.freezeWithSigner(signer);
    const executedTx = await signedTx.executeWithSigner(signer);
    return executedTx;
  };

  const value = {
    accountId,
    authToken,
    authError,
    isConnecting,
    isAuthenticating,
    isInitialized,
    connect,
    authenticateConnectedWallet,
    disconnect,
    getSigner,
    signTransaction,
    isConnected: !!accountId,
    isAuthenticated: !!accountId && !!authToken,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// Wallet connect/disconnect button for the header
export function WalletButton() {
  const {
    accountId,
    authError,
    isConnecting,
    isAuthenticating,
    isInitialized,
    connect,
    authenticateConnectedWallet,
    disconnect,
    isConnected,
    isAuthenticated,
  } = useWallet();

  if (!isInitialized) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-500 text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Initializing...
      </button>
    );
  }

  if (isConnected) {
    const truncated = `${accountId.toString()}`;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={!isAuthenticated && !isAuthenticating ? authenticateConnectedWallet : undefined}
          disabled={isAuthenticating}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 disabled:cursor-wait"
          title={authError || "Wallet authenticated"}
        >
          {isAuthenticating ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
          ) : (
            <Wallet className="h-4 w-4 text-emerald-300" />
          )}
          <span className="font-mono text-sm text-emerald-300">{truncated}</span>
          {!isAuthenticated && (
            <span className="text-xs text-amber-200">
              {authError ? "Authorize" : "Authorizing..."}
            </span>
          )}
        </button>
        <button
          onClick={disconnect}
          className="rounded-lg bg-gray-800 p-2 text-gray-400 transition hover:text-red-400"
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </>
      )}
    </button>
  );
}
