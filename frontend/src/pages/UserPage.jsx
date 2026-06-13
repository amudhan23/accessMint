import { useState } from "react";
import { Coins, Flame, Tag, ArrowRight, Wallet } from "lucide-react";

export default function UserPage({
  plans,
  userTokens,
  setUserTokens,
  listings,
  setListings,
  addActivity,
}) {
  const [buyAmount, setBuyAmount] = useState(100);
  const [sellAmount, setSellAmount] = useState(40);
  const [sellPrice, setSellPrice] = useState(0.07);
  const [loading, setLoading] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const activePlan = selectedPlan || plans[0];

  const buyTokens = async () => {
    if (!activePlan) return;
    setLoading("buy");
    try {
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: activePlan.tokenId,
          amount: buyAmount,
          pricePerTokenHbar: activePlan.pricePerTokenHbar,
        }),
      });
      const data = await res.json();
      setUserTokens((prev) => ({
        ...prev,
        [activePlan.tokenId]: (prev[activePlan.tokenId] || 0) + buyAmount,
      }));
      addActivity({
        type: "buy",
        message: `Bought ${buyAmount} ${activePlan.symbol} tokens for ${data.totalCost} HBAR`,
        tokenId: activePlan.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  };

  const redeemToken = async () => {
    if (!activePlan) return;
    const balance = userTokens[activePlan.tokenId] || 0;
    if (balance <= 0) return;
    setLoading("redeem");
    try {
      await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: activePlan.tokenId }),
      });
      setUserTokens((prev) => ({
        ...prev,
        [activePlan.tokenId]: prev[activePlan.tokenId] - 1,
      }));
      addActivity({
        type: "redeem",
        message: `Redeemed 1 ${activePlan.symbol} token — API access granted`,
        tokenId: activePlan.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  };

  const listForSale = async () => {
    if (!activePlan) return;
    const balance = userTokens[activePlan.tokenId] || 0;
    if (balance < sellAmount) return;
    setLoading("list");
    try {
      const res = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: activePlan.tokenId,
          symbol: activePlan.symbol,
          amount: sellAmount,
          pricePerTokenHbar: sellPrice,
          retailPrice: activePlan.pricePerTokenHbar,
          ensName: activePlan.ensName,
        }),
      });
      const listing = await res.json();
      setListings((prev) => [...prev, listing]);
      setUserTokens((prev) => ({
        ...prev,
        [activePlan.tokenId]: prev[activePlan.tokenId] - sellAmount,
      }));
      const discount = (
        (1 - sellPrice / activePlan.pricePerTokenHbar) *
        100
      ).toFixed(0);
      addActivity({
        type: "list",
        message: `Listed ${sellAmount} ${activePlan.symbol} tokens at ${sellPrice} HBAR (${discount}% off)`,
        tokenId: activePlan.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  };

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">My Dashboard</h2>
          <p className="text-gray-500">
            Buy, use, and resell API access tokens
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <Coins className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No access plans available yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Switch to the Provider tab to create one
          </p>
        </div>
      </div>
    );
  }

  const balance = activePlan ? userTokens[activePlan.tokenId] || 0 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">My Dashboard</h2>
        <p className="text-gray-500">Buy, use, and resell API access tokens</p>
      </div>

      {/* Token Balance Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">Your Balance</p>
            <p className="text-4xl font-bold mt-1">
              {balance}{" "}
              <span className="text-lg text-gray-500">
                {activePlan?.symbol}
              </span>
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-mint-500/10 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-mint-400" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Plan</p>
            <p className="font-medium text-sm mt-0.5">{activePlan?.name}</p>
          </div>
          <div className="flex-1 bg-gray-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Token ID</p>
            <p className="font-mono text-sm mt-0.5 text-mint-400">
              {activePlan?.tokenId}
            </p>
          </div>
          <div className="flex-1 bg-gray-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Retail Price</p>
            <p className="font-medium text-sm mt-0.5">
              {activePlan?.pricePerTokenHbar} HBAR
            </p>
          </div>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Buy Tokens */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">Buy Tokens</h3>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>
          <p className="text-xs text-gray-500">
            Cost:{" "}
            <span className="text-white">
              {(buyAmount * (activePlan?.pricePerTokenHbar || 0)).toFixed(2)}{" "}
              HBAR
            </span>
          </p>
          <button
            onClick={buyTokens}
            disabled={loading === "buy"}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading === "buy" ? "Buying..." : "Buy Tokens"}
          </button>
        </div>

        {/* Redeem Token */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold">Use Token</h3>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">{balance}</p>
            <p className="text-xs text-gray-500 mt-1">tokens remaining</p>
          </div>
          <p className="text-xs text-gray-500">
            Burns 1 token and grants 1 API call
          </p>
          <button
            onClick={redeemToken}
            disabled={loading === "redeem" || balance <= 0}
            className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50"
          >
            {loading === "redeem" ? "Redeeming..." : "Use 1 Token → API Call"}
          </button>
        </div>

        {/* List for Sale */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold">Resell Tokens</h3>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Amount to sell
            </label>
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Price per token (HBAR)
            </label>
            <input
              type="number"
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
            />
          </div>
          {activePlan && sellPrice < activePlan.pricePerTokenHbar && (
            <p className="text-xs text-mint-400">
              {((1 - sellPrice / activePlan.pricePerTokenHbar) * 100).toFixed(
                0,
              )}
              % discount vs retail
            </p>
          )}
          <button
            onClick={listForSale}
            disabled={loading === "list" || balance < sellAmount}
            className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading === "list" ? "Listing..." : "List on Marketplace"}
          </button>
        </div>
      </div>
    </div>
  );
}
