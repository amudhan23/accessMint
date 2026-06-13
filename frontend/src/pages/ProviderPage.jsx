import { useState } from "react";
import { Zap, Plus, Package, DollarSign, Hash } from "lucide-react";
import { ENSInput } from "../components/ENSIntegration";

export default function ProviderPage({ plans, setPlans, addActivity }) {
  const [name, setName] = useState("AI Summarizer API");
  const [symbol, setSymbol] = useState("AISUM");
  const [supply, setSupply] = useState(1000);
  const [price, setPrice] = useState(0.1);
  const [loading, setLoading] = useState(false);
  const [ensName, setEnsName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [description, setDescription] = useState("");

  const createPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          totalSupply: supply,
          pricePerTokenHbar: price,
          ensName,
          apiEndpoint,
          description,
        }),
      });
      const plan = await res.json();
      setPlans((prev) => [...prev, plan]);
      addActivity({
        type: "create",
        message: `Created "${name}" — ${supply} tokens at ${price} HBAR each`,
        tokenId: plan.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Provider Dashboard</h2>
        <p className="text-gray-500">
          Create access plans and mint tokens for your API
        </p>
      </div>

      {/* Create Plan Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="w-5 h-5 text-mint-400" />
          <h3 className="font-semibold text-lg">Create Access Plan</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1.5">
              Plan Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint-500 transition"
              placeholder="e.g. AI Summarizer API"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Token Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint-500 transition"
              placeholder="e.g. AISUM"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Total Supply
            </label>
            <input
              type="number"
              value={supply}
              onChange={(e) => setSupply(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint-500 transition"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1.5">
              Price per Token (HBAR)
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint-500 transition"
            />
          </div>
        </div>

        {/* adding ens section */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">
            Provider ENS Name (optional)
          </label>
          <ENSInput
            value={ensName}
            onChange={setEnsName}
            placeholder="yourname.eth"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">
            API Endpoint URL
          </label>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://api.example.com/v1/data?q={query}"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-mint-500 transition text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {"{query}"} as placeholder for user input
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your API do?"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-mint-500 transition text-sm"
          />
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 text-sm text-gray-400">
          <p>
            This will mint{" "}
            <span className="text-white font-medium">{supply}</span> access
            tokens on Hedera using HTS.
          </p>
          <p>
            Total revenue at full sale:{" "}
            <span className="text-mint-400 font-medium">
              {(supply * price).toFixed(2)} HBAR
            </span>
          </p>
        </div>

        <button
          onClick={createPlan}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-mint-500 to-mint-600 text-white font-semibold hover:from-mint-600 hover:to-mint-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating on Hedera..." : "Create Access Plan"}
        </button>
      </div>

      {/* Existing Plans */}
      {plans.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Your Plans</h3>
          {plans.map((plan, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-mint-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-mint-400" />
                </div>
                <div>
                  <h4 className="font-medium">{plan.name}</h4>
                  <p className="text-sm text-gray-500">
                    {plan.symbol} · Token ID: {plan.tokenId}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-mint-400">
                  {plan.totalSupply} tokens
                </p>
                <p className="text-sm text-gray-500">
                  {plan.pricePerTokenHbar} HBAR each
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
