function truncateAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}

export function ENSIdentity({ address, ensName, size = "sm" }) {
  const displayName = ensName || truncateAddress(address);
  const avatarSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  if (!ensName) {
    return <span className="font-mono text-sm text-gray-400">{displayName}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${avatarSize} rounded-full border border-blue-400/30 bg-blue-500/20`}
        aria-hidden="true"
      />
      <span className="font-medium text-blue-400">{displayName}</span>
    </span>
  );
}

export function ENSInput({ value, onChange, placeholder }) {
  const isValid = value && value.endsWith(".eth") && value.length > 4;

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || "name.eth"}
        className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white transition focus:border-blue-500 focus:outline-none"
      />
      {isValid && <p className="text-xs text-emerald-300">ENS name: {value}</p>}
    </div>
  );
}
