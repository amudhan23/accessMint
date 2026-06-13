import { useState } from "react";
import { Store, ShoppingCart, TrendingDown, Clock } from "lucide-react";
import WorldIDVerify from "../components/WorldIDVerify";
import { ENSIdentity } from "../components/ENSIntegration";

export default function MarketplacePage({
  listings,
  setListings,
  userTokens,
  setUserTokens,
  addActivity,
}) {
  const [loading, setLoading] = useState(null);

  const buyListing = async (listing) => {
    setLoading(listing.id);
    try {
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();

      // Update listing status
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, active: false } : l)),
      );

      // Update user balance
      setUserTokens((prev) => ({
        ...prev,
        [listing.tokenId]: (prev[listing.tokenId] || 0) + listing.amount,
      }));

      const savings = (
        (listing.retailPrice - listing.pricePerTokenHbar) *
        listing.amount
      ).toFixed(2);
      addActivity({
        type: "marketplace_buy",
        message: `Bought ${listing.amount} ${listing.symbol} tokens from marketplace — saved ${savings} HBAR`,
        tokenId: listing.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  };

  const activeListings = listings.filter((l) => l.active);
  const soldListings = listings.filter((l) => !l.active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Marketplace</h2>
        <p className="text-gray-500">
          Buy discounted access tokens from other users
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{activeListings.length}</p>
          <p className="text-xs text-gray-500 mt-1">Active Listings</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{soldListings.length}</p>
          <p className="text-xs text-gray-500 mt-1">Tokens Sold</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-mint-400">
            {activeListings.length > 0
              ? Math.max(
                  ...activeListings.map(
                    (l) => (1 - l.pricePerTokenHbar / l.retailPrice) * 100,
                  ),
                ).toFixed(0) + "%"
              : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Best Discount</p>
        </div>
      </div>

      {/* Active Listings */}
      <WorldIDVerify>
        {activeListings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <Store className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No listings yet</p>
            <p className="text-gray-600 text-sm mt-1">
              Go to Dashboard and list some tokens for resale
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeListings.map((listing) => {
              const discount = (
                (1 - listing.pricePerTokenHbar / listing.retailPrice) *
                100
              ).toFixed(0);
              const totalCost = (
                listing.amount * listing.pricePerTokenHbar
              ).toFixed(2);
              const savings = (
                (listing.retailPrice - listing.pricePerTokenHbar) *
                listing.amount
              ).toFixed(2);

              return (
                <div
                  key={listing.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mt-0.5">
                        <ShoppingCart className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">
                          {listing.amount} {listing.symbol} Tokens
                        </h4>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Token ID: {listing.tokenId}
                        </p>
                        {listing.ensName && (
                          <p className="text-sm mt-0.5">
                            Provider: <ENSIdentity ensName={listing.ensName} />
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5">
                            <TrendingDown className="w-4 h-4 text-mint-400" />
                            <span className="text-sm text-mint-400 font-medium">
                              {discount}% off retail
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-500">
                              {listing.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 line-through">
                          {(listing.amount * listing.retailPrice).toFixed(2)}{" "}
                          HBAR
                        </p>
                        <p className="text-xl font-bold text-mint-400">
                          {totalCost} HBAR
                        </p>
                        <p className="text-xs text-gray-500">
                          Save {savings} HBAR
                        </p>
                      </div>
                      <button
                        onClick={() => buyListing(listing)}
                        disabled={loading === listing.id}
                        className="px-6 py-2.5 rounded-xl bg-mint-600 text-white text-sm font-medium hover:bg-mint-700 transition disabled:opacity-50"
                      >
                        {loading === listing.id ? "Buying..." : "Buy Now"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WorldIDVerify>

      {/* Sold Listings */}
      {soldListings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Recently Sold
          </h3>
          {soldListings.map((listing) => (
            <div
              key={listing.id}
              className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 opacity-60"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {listing.amount} {listing.symbol}
                  </span>
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">
                    SOLD
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {(listing.amount * listing.pricePerTokenHbar).toFixed(2)} HBAR
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
