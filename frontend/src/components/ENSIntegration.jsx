import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

// Create a public Ethereum client for ENS resolution
// ENS lives on Ethereum mainnet
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

// Hook: resolve an ENS name to an address
export function useENSResolve(ensName) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (
      !ensName ||
      !ensName.includes(".") ||
      ensName.endsWith(".") ||
      ensName.startsWith(".")
    )
      return;

    setLoading(true);
    publicClient
      .getEnsAddress({ name: normalize(ensName) })
      .then((addr) => {
        setAddress(addr);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [ensName]);

  return { address, loading, error };
}

// Hook: resolve an address to an ENS name (reverse lookup)
export function useENSName(address) {
  const [name, setName] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !address.startsWith("0x")) return;

    setLoading(true);
    publicClient
      .getEnsName({ address })
      .then((ensName) => {
        setName(ensName);
        if (ensName) {
          // Also try to get avatar
          publicClient
            .getEnsAvatar({ name: normalize(ensName) })
            .then(setAvatar)
            .catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [address]);

  return { name, avatar, loading };
}

// Hook: get ENS text records (used for provider metadata)
export function useENSText(ensName, key) {
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !ensName ||
      !ensName.includes(".") ||
      ensName.endsWith(".") ||
      ensName.startsWith(".")
    )
      return;

    setLoading(true);
    publicClient
      .getEnsText({ name: normalize(ensName), key })
      .then((text) => {
        setValue(text);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ensName, key]);

  return { value, loading };
}

// Component: Display an ENS name with avatar, or fallback to address
export function ENSIdentity({ address, ensName, size = "sm" }) {
  const resolved = useENSName(address);
  const displayName = ensName || resolved.name;

  if (!displayName) {
    // No ENS name — show truncated address
    const truncated = address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "Unknown";

    return <span className="text-gray-400 font-mono text-sm">{truncated}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {resolved.avatar && (
        <img
          src={resolved.avatar}
          alt={displayName}
          className={`rounded-full ${size === "sm" ? "w-4 h-4" : "w-6 h-6"}`}
        />
      )}
      <span className="text-blue-400 font-medium">{displayName}</span>
    </span>
  );
}

// Component: ENS name input with live resolution
export function ENSInput({ value, onChange, placeholder }) {
  const isValid = value && value.endsWith(".eth") && value.length > 4;

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "name.eth"}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition text-sm"
      />
      {isValid && <p className="text-xs text-mint-400">✓ ENS name: {value}</p>}
    </div>
  );
}

export default { ENSIdentity, ENSInput, useENSResolve, useENSName, useENSText };
