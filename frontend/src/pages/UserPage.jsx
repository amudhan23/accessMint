import { useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Flame,
  KeyRound,
  Loader2,
  PackageOpen,
  Tag,
  WalletCards,
  X,
} from "lucide-react";
import { ENSIdentity } from "../components/ENSIntegration";

function ApiKeyPanel({ credential }) {
  const [copied, setCopied] = useState(false);
  const key = credential?.apiKey || credential?.key;

  if (!credential || !key) return null;

  const copyKey = async () => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex min-w-0 items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-emerald-300" />
          <code className="truncate font-mono text-sm text-white">{key}</code>
        </div>
        <button
          onClick={copyKey}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm font-medium text-gray-200 transition hover:border-emerald-500"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Clipboard className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {credential.endpoint && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs leading-6 text-gray-400">
          <p>
            <span className="text-emerald-300">POST</span> {credential.endpoint}
          </p>
          <p>Authorization: Bearer {key}</p>
          <p>Content-Type: application/json</p>
        </div>
      )}
    </div>
  );
}

export default function UserPage({
  plans,
  userTokens,
  setUserTokens,
  apiKeys,
  setApiKeys,
  walletAccountId,
  walletAuthToken,
  setListings,
  addActivity,
}) {
  const [loading, setLoading] = useState(null);
  const [queryByToken, setQueryByToken] = useState({});
  const [responseByToken, setResponseByToken] = useState({});
  const [sellPlan, setSellPlan] = useState(null);
  const [sellAmount, setSellAmount] = useState(1);
  const [sellPrice, setSellPrice] = useState(0.07);
  const [error, setError] = useState("");

  const purchasedPlans = useMemo(
    () => plans.filter((plan) => (userTokens[plan.tokenId] || 0) > 0),
    [plans, userTokens],
  );

  const ensureApiKey = async (plan) => {
    if (!walletAuthToken) throw new Error("Connect and sign with your wallet first");
    if (apiKeys[plan.tokenId]) return apiKeys[plan.tokenId];

    const keyRes = await fetch("/api/generate-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${walletAuthToken}`,
      },
      body: JSON.stringify({ tokenId: plan.tokenId }),
    });
    const keyData = await keyRes.json();
    if (!keyRes.ok) {
      throw new Error(keyData.message || keyData.error || "API key generation failed");
    }
    setApiKeys((prev) => ({ ...prev, [plan.tokenId]: keyData }));
    if (keyData.walletState) {
      setUserTokens(keyData.walletState.userTokens || {});
      setApiKeys(keyData.walletState.apiKeys || {});
    }
    return keyData;
  };

  const redeemToken = async (plan) => {
    const query = queryByToken[plan.tokenId]?.trim();
    const balance = userTokens[plan.tokenId] || 0;
    if (!walletAuthToken || !query || balance <= 0) return;

    setLoading(`redeem-${plan.tokenId}`);
    setError("");
    try {
      await ensureApiKey(plan);
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${walletAuthToken}`,
        },
        body: JSON.stringify({ tokenId: plan.tokenId, query }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "API call failed");
      }
      setResponseByToken((prev) => ({ ...prev, [plan.tokenId]: data.apiResponse }));
      if (data.walletState) {
        setUserTokens(data.walletState.userTokens || {});
        setApiKeys(data.walletState.apiKeys || {});
      }
      addActivity({
        type: "redeem",
        message: `Used 1 ${plan.symbol} token for ${plan.name}`,
        tokenId: plan.tokenId,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "API call failed");
    }
    setLoading(null);
  };

  const openSellModal = (plan) => {
    setSellPlan(plan);
    setSellAmount(Math.min(2, userTokens[plan.tokenId] || 1));
    setSellPrice(Number((plan.pricePerTokenHbar * 0.7).toFixed(2)));
  };

  const listForSale = async () => {
    if (!sellPlan) return;
    const balance = userTokens[sellPlan.tokenId] || 0;
    if (!walletAuthToken || sellAmount < 1 || balance < sellAmount) return;

    setLoading("list");
    setError("");
    try {
      const res = await fetch("/api/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${walletAuthToken}`,
        },
        body: JSON.stringify({
          tokenId: sellPlan.tokenId,
          symbol: sellPlan.symbol,
          amount: sellAmount,
          pricePerTokenHbar: sellPrice,
          retailPrice: sellPlan.pricePerTokenHbar,
          ensName: sellPlan.ensName,
        }),
      });
      const listing = await res.json();
      if (!res.ok) {
        throw new Error(listing.message || listing.error || "Listing failed");
      }
      setListings((prev) => [...prev, listing]);
      if (listing.walletState) {
        setUserTokens(listing.walletState.userTokens || {});
        setApiKeys(listing.walletState.apiKeys || {});
      }
      const discount = ((1 - sellPrice / sellPlan.pricePerTokenHbar) * 100).toFixed(0);
      addActivity({
        type: "list",
        message: `Listed ${sellAmount} ${sellPlan.symbol} tokens at ${sellPrice} HBAR (${discount}% off)`,
        tokenId: sellPlan.tokenId,
      });
      setSellPlan(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Listing failed");
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
          Portfolio
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">My APIs</h2>
        <p className="mt-1 text-sm text-gray-400">Manage your purchased API access.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {purchasedPlans.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-10 text-center">
          <PackageOpen className="mx-auto h-12 w-12 text-gray-700" />
          <h3 className="mt-4 text-lg font-semibold text-white">No API tokens yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            {walletAccountId
              ? "You have not purchased any API access yet. Browse the Explore tab to get started."
              : "Connect your wallet to load purchased API access."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {purchasedPlans.map((plan) => {
            const balance = userTokens[plan.tokenId] || 0;
            const response = responseByToken[plan.tokenId];
            const query = queryByToken[plan.tokenId] || "";

            return (
              <article
                key={plan.tokenId}
                className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 shadow-xl shadow-black/10"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                      <WalletCards className="h-6 w-6 text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Provider: <ENSIdentity ensName={plan.ensName || "provider.eth"} />
                      </p>
                      <p className="mt-1 font-mono text-xs text-gray-500">{plan.tokenId}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-right">
                    <p className="text-2xl font-semibold text-white">{balance}</p>
                    <p className="text-xs text-blue-300">{plan.symbol} tokens</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <ApiKeyPanel credential={apiKeys[plan.tokenId]} />

                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-400" />
                        <h4 className="font-semibold text-white">Try it</h4>
                      </div>
                      <span className="text-xs text-gray-500">{balance} calls remaining</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        value={query}
                        onChange={(event) =>
                          setQueryByToken((prev) => ({
                            ...prev,
                            [plan.tokenId]: event.target.value,
                          }))
                        }
                        className="h-11 rounded-xl border border-gray-800 bg-gray-900 px-4 text-sm text-white outline-none transition focus:border-orange-500"
                        placeholder="Enter query"
                      />
                      <button
                        onClick={() => redeemToken(plan)}
                        disabled={!walletAuthToken || loading === `redeem-${plan.tokenId}` || balance <= 0 || !query.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === `redeem-${plan.tokenId}` && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading === `redeem-${plan.tokenId}` ? "Calling API..." : "Burn 1 Token"}
                      </button>
                    </div>

                    {response && (
                      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="font-medium text-emerald-300">{response.service || plan.name}</span>
                          <span>{response.timestamp}</span>
                        </div>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-gray-950 p-4 text-sm leading-6 text-gray-300">
                          {JSON.stringify(response.data ?? response, null, 2)}
                        </pre>
                        {response.verified_on && (
                          <a
                            href={response.verified_on}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                          >
                            Verify on Hashscan <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openSellModal(plan)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 text-sm font-semibold text-purple-200 transition hover:border-purple-400/50"
                  >
                    <Tag className="h-4 w-4" />
                    Sell Tokens
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {sellPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950 p-5 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Sell {sellPlan.symbol} Tokens
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  You have {userTokens[sellPlan.tokenId] || 0} {sellPlan.symbol} tokens.
                </p>
              </div>
              <button
                onClick={() => setSellPlan(null)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm text-gray-400">Amount to sell</span>
                <input
                  type="number"
                  min="1"
                  max={userTokens[sellPlan.tokenId] || 0}
                  value={sellAmount}
                  onChange={(event) => setSellAmount(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-gray-800 bg-gray-900 px-4 text-sm text-white outline-none transition focus:border-purple-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-gray-400">Price per token (HBAR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellPrice}
                  onChange={(event) => setSellPrice(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-gray-800 bg-gray-900 px-4 text-sm text-white outline-none transition focus:border-purple-500"
                />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm leading-7 text-gray-400">
              <p>Retail price: {sellPlan.pricePerTokenHbar.toFixed(2)} HBAR</p>
              <p>
                Your price:{" "}
                <span className="text-purple-200">{Number(sellPrice || 0).toFixed(2)} HBAR</span>{" "}
                ({((1 - sellPrice / sellPlan.pricePerTokenHbar) * 100).toFixed(0)}% discount)
              </p>
              <p className="font-semibold text-white">
                Total: {(Number(sellAmount || 0) * Number(sellPrice || 0)).toFixed(2)} HBAR
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setSellPlan(null)}
                className="h-11 rounded-xl border border-gray-800 px-4 text-sm font-semibold text-gray-300 transition hover:bg-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={listForSale}
                disabled={!walletAuthToken || loading === "list"}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === "list" && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading === "list" ? "Listing..." : "List on Marketplace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
