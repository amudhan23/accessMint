import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  BadgePercent,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Loader2,
  Search,
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
  plans = [],
  onExploreToken,
}) {
  const [loading, setLoading] = useState(null);
  const [newApiKey, setNewApiKey] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [listingView, setListingView] = useState("active");
  const [sort, setSort] = useState("discount");

  const activeListings = useMemo(() => listings.filter((listing) => listing.active), [listings]);
  const soldListings = useMemo(() => listings.filter((listing) => !listing.active), [listings]);
  const planByToken = useMemo(
    () => new Map(plans.map((plan) => [String(plan.tokenId), plan])),
    [plans],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleListings = useMemo(() => {
    const matches = (listing) => {
      if (!normalizedQuery) return true;
      const plan = planByToken.get(String(listing.tokenId));
      return [
        listing.symbol,
        listing.tokenId,
        listing.ensName,
        listing.seller,
        plan?.name,
        plan?.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    };

    const discountFor = (listing) =>
      (1 - Number(listing.pricePerTokenHbar || 0) / Number(listing.retailPrice || 1)) * 100;

    const sortItems = (items) =>
      [...items].sort((a, b) => {
        if (sort === "price") return Number(a.pricePerTokenHbar || 0) - Number(b.pricePerTokenHbar || 0);
        if (sort === "amount") return Number(b.amount || 0) - Number(a.amount || 0);
        if (sort === "newest") {
          return String(b.createdAt || b.id || "").localeCompare(String(a.createdAt || a.id || ""));
        }
        return discountFor(b) - discountFor(a);
      });

    return {
      active: sortItems(activeListings.filter(matches)),
      sold: sortItems(soldListings.filter(matches)),
    };
  }, [activeListings, normalizedQuery, planByToken, soldListings, sort]);
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

      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-3 shadow-2xl shadow-black/20 lg:grid-cols-[1fr_210px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search listings, providers, symbols..."
            className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-purple-500"
          />
        </label>
        <label className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-8 text-sm text-white outline-none transition focus:border-purple-500"
          >
            <option value="discount">Best discount</option>
            <option value="price">Lowest price</option>
            <option value="amount">Largest lot</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {[
            { id: "active", label: "Active", count: activeListings.length },
            { id: "sold", label: "Sold", count: soldListings.length },
            { id: "all", label: "All", count: listings.length },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setListingView(option.id)}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                listingView === option.id
                  ? "border-white bg-white text-gray-950"
                  : "border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700 hover:text-white"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  listingView === option.id ? "bg-gray-950/10" : "bg-gray-800 text-gray-500"
                }`}
              >
                {option.count}
              </span>
            </button>
          ))}
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

      {listingView !== "sold" && (
        <WorldIDVerify>
        {visibleListings.active.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-10 text-center">
            <Store className="mx-auto h-12 w-12 text-gray-700" />
            <h3 className="mt-4 text-lg font-semibold text-white">
              {normalizedQuery ? "No matching listings" : "No active listings"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              {normalizedQuery
                ? "Try a different API name, token symbol, seller, or provider."
                : "Purchased tokens can be listed for resale from My APIs."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleListings.active.map((listing) => {
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
                        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#57068c,#7c3aed)] px-4 text-sm font-semibold text-white shadow-lg shadow-violet-700/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
      )}

      {listingView !== "active" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
            Recently Sold
          </h3>
          {visibleListings.sold.length === 0 ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/50 p-4 text-sm text-gray-500">
              {normalizedQuery ? "No sold listings match this search." : "No sold listings yet."}
            </div>
          ) : (
            visibleListings.sold.map((listing) => {
              const providerExists = planByToken.has(String(listing.tokenId));
              return (
                <div
                  key={listing.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-800/70 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-300">
                      {listing.amount} {listing.symbol}
                    </p>
                    <p className="font-mono text-xs text-gray-600">{listing.tokenId}</p>
                  </div>
                  {providerExists ? (
                    <button
                      type="button"
                      onClick={() => onExploreToken?.(listing.tokenId)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 text-xs font-semibold text-gray-300 transition hover:border-blue-400/40 hover:text-blue-200"
                    >
                      <Info className="h-3.5 w-3.5" />
                      View API
                    </button>
                  ) : (
                    <span className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-xs font-semibold text-gray-500">
                      Provider removed
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
