import { useMemo, useState } from "react";
import {
  BadgePercent,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  ShoppingCart,
  Store,
  TrendingDown,
} from "lucide-react";
import WorldIDVerify from "../components/WorldIDVerify";
import { ENSIdentity } from "../components/ENSIntegration";

export default function MarketplacePage({
  listings,
  setListings,
  setUserTokens,
  setApiKeys,
  walletAuthToken,
  addActivity,
}) {
  const [loading, setLoading] = useState(null);
  const [newApiKey, setNewApiKey] = useState(null);
  const [error, setError] = useState("");

  const activeListings = useMemo(() => listings.filter((listing) => listing.active), [listings]);
  const soldListings = useMemo(() => listings.filter((listing) => !listing.active), [listings]);
  const totalSold = soldListings.reduce((sum, listing) => sum + Number(listing.amount || 0), 0);
  const bestDiscount =
    activeListings.length > 0
      ? Math.max(
          ...activeListings.map(
            (listing) => (1 - listing.pricePerTokenHbar / listing.retailPrice) * 100,
          ),
        ).toFixed(0)
      : null;

  const buyListing = async (listing) => {
    if (!walletAuthToken) return;
    setLoading(listing.id);
    setError("");
    try {
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${walletAuthToken}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          tokenId: listing.tokenId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Marketplace purchase failed");
      }

      if (data.apiKeyInfo) {
        setNewApiKey(data.apiKeyInfo);
        setApiKeys((prev) => ({ ...prev, [listing.tokenId]: data.apiKeyInfo }));
      }

      if (Array.isArray(data.listings)) {
        setListings(data.listings);
      } else {
        setListings((prev) =>
          prev.map((item) => (item.id === listing.id ? { ...item, active: false } : item)),
        );
      }
      if (data.walletState) {
        setUserTokens(data.walletState.userTokens || {});
        setApiKeys(data.walletState.apiKeys || {});
      }

      const savings = (
        (listing.retailPrice - listing.pricePerTokenHbar) *
        listing.amount
      ).toFixed(2);
      addActivity({
        type: "marketplace_buy",
        message: `Bought ${listing.amount} ${listing.symbol} tokens from marketplace and saved ${savings} HBAR`,
        tokenId: listing.tokenId,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Marketplace purchase failed");
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-400">
          Resale
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Secondary Market
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Buy discounted API tokens from other users.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
          <Store className="h-5 w-5 text-purple-300" />
          <p className="mt-3 text-2xl font-semibold text-white">{activeListings.length}</p>
          <p className="text-xs text-gray-500">Active Listings</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <p className="mt-3 text-2xl font-semibold text-white">{totalSold}</p>
          <p className="text-xs text-gray-500">Total Sold</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
          <BadgePercent className="h-5 w-5 text-orange-300" />
          <p className="mt-3 text-2xl font-semibold text-emerald-300">
            {bestDiscount ? `${bestDiscount}%` : "-"}
          </p>
          <p className="text-xs text-gray-500">Best Discount</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {newApiKey && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
            <KeyRound className="h-4 w-4" />
            API key from marketplace purchase
          </div>
          <code className="mt-3 block break-all rounded-xl border border-gray-800 bg-gray-950 p-3 font-mono text-sm text-white">
            {newApiKey.key || newApiKey.apiKey}
          </code>
          {newApiKey.endpoint && (
            <p className="mt-3 font-mono text-xs text-gray-400">POST {newApiKey.endpoint}</p>
          )}
        </div>
      )}

      <WorldIDVerify>
        {activeListings.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-10 text-center">
            <Store className="mx-auto h-12 w-12 text-gray-700" />
            <h3 className="mt-4 text-lg font-semibold text-white">No active listings</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Purchased tokens can be listed for resale from My APIs.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeListings.map((listing) => {
              const discount = (
                (1 - listing.pricePerTokenHbar / listing.retailPrice) *
                100
              ).toFixed(0);
              const retailTotal = (listing.amount * listing.retailPrice).toFixed(2);
              const totalCost = (listing.amount * listing.pricePerTokenHbar).toFixed(2);
              const savings = (
                (listing.retailPrice - listing.pricePerTokenHbar) *
                listing.amount
              ).toFixed(2);

              return (
                <article
                  key={listing.id}
                  className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 shadow-xl shadow-black/10 transition hover:border-gray-700"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
                        <ShoppingCart className="h-6 w-6 text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {listing.amount} {listing.symbol} Tokens
                        </h3>
                        <p className="mt-1 font-mono text-xs text-gray-500">
                          Token ID: {listing.tokenId}
                        </p>
                        <p className="mt-2 text-sm text-gray-400">
                          Provider: <ENSIdentity ensName={listing.ensName || "provider.eth"} />
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Seller: {listing.seller || "AccessMint user"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                            <TrendingDown className="h-3.5 w-3.5" />
                            {discount}% off
                          </span>
                          {listing.createdAt && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-xs text-gray-500">
                              <Clock className="h-3.5 w-3.5" />
                              {listing.createdAt}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[180px] rounded-2xl border border-gray-800 bg-gray-950 p-4 sm:text-right">
                      <p className="text-sm text-gray-500">
                        Retail <span className="line-through">{retailTotal} HBAR</span>
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-300">
                        {totalCost} HBAR
                      </p>
                      <p className="text-xs text-gray-500">Save {savings} HBAR</p>
                      <button
                        onClick={() => buyListing(listing)}
                        disabled={!walletAuthToken || loading === listing.id}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === listing.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!walletAuthToken
                          ? "Sign In"
                          : loading === listing.id
                            ? "Buying..."
                            : "Buy Now"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </WorldIDVerify>

      {soldListings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
            Recently Sold
          </h3>
          {soldListings.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center justify-between rounded-xl border border-gray-800/70 bg-gray-900/50 p-4"
            >
              <div>
                <p className="text-sm font-medium text-gray-300">
                  {listing.amount} {listing.symbol}
                </p>
                <p className="font-mono text-xs text-gray-600">{listing.tokenId}</p>
              </div>
              <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-400">
                SOLD
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
