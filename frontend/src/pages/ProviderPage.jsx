import { useState } from "react";
import {
  BarChart3,
  Coins,
  DollarSign,
  Hash,
  Link2,
  ListPlus,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import { ENSInput, ENSIdentity } from "../components/ENSIntegration";

export default function ProviderPage({ plans, setPlans, addActivity }) {
  const [name, setName] = useState("AI Summarizer API");
  const [symbol, setSymbol] = useState("AISUM");
  const [supply, setSupply] = useState(10);
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
        message: `Created "${name}" with ${supply} tokens at ${price} HBAR each`,
        tokenId: plan.tokenId,
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Providers
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">List Your API</h2>
        <p className="mt-1 text-sm text-gray-400">
          Mint access tokens and start earning.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <ListPlus className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Create Access Plan</h3>
            <p className="text-sm text-gray-500">HTS token supply, price, and API metadata.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm text-gray-400">API Name</span>
            <div className="relative">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
                placeholder="Crypto Price Intelligence"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-gray-400">Token Symbol</span>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
                placeholder="CRYPTO"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-gray-400">Supply</span>
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="number"
                min="1"
                value={supply}
                onChange={(event) => setSupply(Number(event.target.value))}
                className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-gray-400">Price per call (HBAR)</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-gray-400">Your ENS Name</span>
            <ENSInput value={ensName} onChange={setEnsName} placeholder="cryptointel.eth" />
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm text-gray-400">API Endpoint URL</span>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                value={apiEndpoint}
                onChange={(event) => setApiEndpoint(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
                placeholder="https://api.example.com/v1/data?q={query}"
              />
            </div>
            <p className="text-xs text-gray-500">Use {"{query}"} as the placeholder.</p>
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm text-gray-400">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              placeholder="Real-time crypto prices, market cap, and 24h movement."
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400 sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Minted supply</p>
            <p className="mt-1 text-lg font-semibold text-white">{Number(supply || 0)} tokens</p>
          </div>
          <div>
            <p className="text-gray-500">Full sale revenue</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">
              {(Number(supply || 0) * Number(price || 0)).toFixed(2)} HBAR
            </p>
          </div>
        </div>

        <button
          onClick={createPlan}
          disabled={loading}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating on Hedera..." : "Create Access Plan"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold text-white">Your Listed APIs</h3>
          <span className="text-sm text-gray-500">{plans.length} total</span>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-8 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-gray-700" />
            <p className="mt-3 text-sm text-gray-500">Created plans will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {plans.map((plan) => (
              <article
                key={plan.tokenId}
                className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <Package className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{plan.name}</h4>
                    <p className="text-sm text-gray-500">
                      {plan.symbol} <span className="font-mono">{plan.tokenId}</span>
                    </p>
                    {plan.ensName && (
                      <p className="mt-1 text-xs text-gray-500">
                        Provider: <ENSIdentity ensName={plan.ensName} />
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-semibold text-emerald-300">{plan.totalSupply} tokens</p>
                  <p className="text-gray-500">{plan.pricePerTokenHbar} HBAR each</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
