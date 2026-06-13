import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export function normalizeENSName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized.endsWith(".eth") && normalized.length > 4 ? normalized : "";
}

export async function resolveENSName(name) {
  const ensName = normalizeENSName(name);
  if (!ensName) return null;

  const [address, avatar] = await Promise.all([
    ensClient.getEnsAddress({ name: ensName }),
    ensClient.getEnsAvatar({ name: ensName }).catch(() => null),
  ]);

  return {
    name: ensName,
    address,
    avatar,
    profileUrl: `https://app.ens.domains/${ensName}`,
  };
}
