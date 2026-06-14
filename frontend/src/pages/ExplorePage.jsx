import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  BarChart3,
  CloudSun,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  ENSIdentity,
  ENSProfileLink,
} from "../components/ENSIntegration";
import {
  normalizeENSName,
  resolveENSName,
} from "../components/ensResolver";

function planIcon(plan) {
  const label = `${plan.name || ""} ${plan.description || ""}`.toLowerCase();
  if (label.includes("weather")) return CloudSun;
  if (label.includes("ai") || label.includes("summar")) return Sparkles;
  return BarChart3;
}

function getSupply(plan) {
  return plan.availableSupply ?? plan.remainingSupply ?? plan.supply ?? plan.totalSupply ?? 0;
}

function formatPurchaseError(message) {
  const text = message || "Purchase failed";
  if (text.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
    return "Demo payer is low on testnet HBAR. Restart the backend to enable auto top-up, then retry the purchase.";
  }
  return text;
}

export default function ExplorePage({
  plans,
  setPlans,
  userTokens,
  setUserTokens,
  apiKeys,
  setApiKeys,
  walletAccountId,
  walletAuthToken,
  addActivity,
  highlightTokenId,
  onHighlightHandled,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("low");
  const [filter, setFilter] = useState("all");
  const [amounts, setAmounts] = useState({});
  const [buyPlan, setBuyPlan] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [ensLookup, setEnsLookup] = useState({
    name: "",
    status: "loading",
    result: null,
    error: "",
  });
  const ensSearchName = normalizeENSName(query);

  useEffect(() => {
    if (!ensSearchName) return undefined;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setEnsLookup({ name: ensSearchName, status: "loading", result: null, error: "" });
      resolveENSName(ensSearchName)
        .then((result) => {
          if (cancelled) return;
          setEnsLookup({
            name: ensSearchName,
            status: "resolved",
            result,
            error: "",
          });
        })
        .catch((err) => {
          if (cancelled) return;
          setEnsLookup({
            name: ensSearchName,
            status: "error",
            result: null,
            error: err.message || "ENS lookup failed",
          });
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ensSearchName]);

  useEffect(() => {
    if (!highlightTokenId) return undefined;

    const target = document.getElementById(`api-${highlightTokenId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = window.setTimeout(() => {
      onHighlightHandled?.();
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [highlightTokenId, onHighlightHandled]);

  const visiblePlans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ensName = ensSearchName;
    const ensAddress =
      ensLookup.name === ensSearchName ? ensLookup.result?.address?.toLowerCase() || "" : "";
    return [...plans]
      .filter((plan) => {
        const owned = Number(userTokens[plan.tokenId] || 0);
        if (filter === "owned" && owned <= 0) return false;
        if (filter === "available" && owned > 0) return false;

        if (!normalized) return true;
        const providerEns = String(plan.ensName || "").toLowerCase();
        const providerAddress = String(plan.providerAddress || plan.address || "").toLowerCase();
        const matchesEnsLookup =
          ensName &&
          (providerEns === ensName ||
            providerEns.includes(ensName) ||
            (ensAddress && providerAddress === ensAddress));
        if (matchesEnsLookup) return true;

        return [plan.name, plan.description, plan.symbol, plan.ensName, plan.tokenId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        if (sort === "high") return b.pricePerTokenHbar - a.pricePerTokenHbar;
        if (sort === "newest") return String(b.tokenId).localeCompare(String(a.tokenId));
        return a.pricePerTokenHbar - b.pricePerTokenHbar;
      });
  }, [ensLookup, ensSearchName, filter, plans, query, sort, userTokens]);

  const ensLookupStatus =
    ensSearchName && ensLookup.name === ensSearchName ? ensLookup.status : "loading";
  const ensLookupResult = ensLookup.name === ensSearchName ? ensLookup.result : null;
  const ensLookupError = ensLookup.name === ensSearchName ? ensLookup.error : "";
  const selectedAmount = buyPlan ? Number(amounts[buyPlan.tokenId] ?? 5) || 0 : 0;
  const selectedSupply = buyPlan ? Number(getSupply(buyPlan)) || 0 : 0;
  const selectedTotal = buyPlan ? selectedAmount * Number(buyPlan.pricePerTokenHbar || 0) : 0;
  const selectedTooHigh = buyPlan && selectedAmount > selectedSupply;

  useEffect(() => {
    if (!buyPlan) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setBuyPlan(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buyPlan]);

  const reducePlanSupply = (tokenId, amount, updatedPlan) => {
    if (!setPlans) return;

    setPlans((previous) =>
      previous.map((plan) => {
        if (String(plan.tokenId) !== String(tokenId)) return plan;
        if (updatedPlan) return { ...plan, ...updatedPlan };

        const nextSupply = Math.max(0, Number(getSupply(plan)) - Number(amount));
        return {
          ...plan,
          remainingSupply: nextSupply,
        };
      }),
    );
  };

  const buyTokens = async (plan) => {
    if (!walletAuthToken) {
      setError("Connect and sign with your wallet before buying API access.");
      return;
    }
    const amount = Math.max(1, Number(amounts[plan.tokenId] ?? 5));
    if (!Number.isFinite(amount)) return;
    if (amount > Number(getSupply(plan))) {
      setError(`Only ${getSupply(plan)} ${plan.symbol} calls are available.`);
      return;
    }
    setError("");
    setLoading(plan.tokenId);

    try {
      const buyRes = await fetch("/api/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${walletAuthToken}`,
        },
        body: JSON.stringify({
          tokenId: plan.tokenId,
          amount,
          pricePerTokenHbar: plan.pricePerTokenHbar,
        }),
      });
      const buyData = await buyRes.json();
      if (!buyRes.ok) {
        throw new Error(buyData.message || buyData.error || "Token purchase failed");
      }

      if (buyData.walletState) {
        setUserTokens(buyData.walletState.userTokens || {});
        setApiKeys(buyData.walletState.apiKeys || {});
      }
      reducePlanSupply(plan.tokenId, amount, buyData.plan);

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
      if (keyData.walletState) {
        setUserTokens(keyData.walletState.userTokens || {});
        setApiKeys(keyData.walletState.apiKeys || {});
      } else {
        setApiKeys((prev) => ({ ...prev, [plan.tokenId]: keyData }));
      }

      addActivity({
        type: "buy",
        message: `Bought ${amount} ${plan.symbol} tokens for ${(amount * plan.pricePerTokenHbar).toFixed(2)} HBAR`,
        tokenId: plan.tokenId,
      });
      setBuyPlan(null);
    } catch (err) {
      console.error(err);
      setError(formatPurchaseError(err.message));
    }

    setLoading(null);
  };

  const filterOptions = [
    { id: "all", label: "All APIs", count: plans.length },
    {
      id: "owned",
      label: "Owned",
      count: plans.filter((plan) => Number(userTokens[plan.tokenId] || 0) > 0).length,
    },
    {
      id: "available",
      label: "Available",
      count: plans.filter((plan) => Number(userTokens[plan.tokenId] || 0) === 0).length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
            Explore
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            API Marketplace
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Discover and purchase tokenized API access.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200">
          <ShieldCheck className="h-4 w-4" />
          {walletAccountId ? "Hedera HTS access tokens" : "Connect wallet to buy"}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-3 shadow-2xl shadow-black/20 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-3 text-sm text-white outline-none transition focus:border-violet-500"
            placeholder="Search APIs, providers, symbols..."
          />
        </label>
        <label className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-8 text-sm text-white outline-none transition focus:border-violet-500"
          >
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setFilter(option.id)}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
              filter === option.id
                ? "border-violet-400/60 bg-[linear-gradient(135deg,#57068c,#7c3aed)] text-white shadow-lg shadow-violet-700/25"
                : "border-gray-800 bg-gray-900/60 text-gray-400 hover:border-violet-400/40 hover:text-white"
            }`}
          >
            {option.id === "owned" && <WalletCards className="h-4 w-4" />}
            {option.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                filter === option.id ? "bg-gray-950/10" : "bg-gray-800 text-gray-500"
              }`}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {ensSearchName && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <span className="font-semibold">ENS lookup</span>
          {ensLookupStatus === "loading" && (
            <span className="inline-flex items-center gap-2 text-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Resolving {ensSearchName}
            </span>
          )}
          {ensLookupStatus === "resolved" && (
            <>
              <ENSProfileLink ensName={ensSearchName} />
              {ensLookupResult?.address ? (
                <span className="font-mono text-xs text-blue-200">
                  {ensLookupResult.address}
                </span>
              ) : (
                <span className="text-blue-200">No address record found</span>
              )}
            </>
          )}
          {ensLookupStatus === "error" && (
            <span className="text-red-200">{ensLookupError}</span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {visiblePlans.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-10 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-gray-700" />
          <p className="mt-4 text-sm text-gray-400">No API plans found.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visiblePlans.map((plan) => {
            const Icon = planIcon(plan);
            const owned = userTokens[plan.tokenId] || 0;
            const hasApiKey = Boolean(apiKeys[plan.tokenId]);

            return (
              <article
                key={plan.tokenId}
                id={`api-${plan.tokenId}`}
                className={`group flex min-h-[258px] scroll-mt-28 flex-col rounded-3xl border bg-gray-900/80 p-5 shadow-xl shadow-black/10 transition ${
                  highlightTokenId === plan.tokenId
                    ? "border-violet-300 ring-2 ring-violet-300/40 shadow-violet-950/30"
                    : "border-gray-800 hover:border-violet-500/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-h-[76px] flex-col justify-between gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-white">{plan.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-400">
                            {plan.description || `${plan.symbol} access plan`}
                          </p>
                        </div>
                        {owned <= 0 && hasApiKey && (
                          <span className="shrink-0 rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">
                            Saved key
                          </span>
                        )}
                      </div>
                      <div className="flex min-h-7 flex-wrap items-center gap-2">
                        {owned > 0 && (
                          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">
                            Own {owned}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-1.5 text-sm text-gray-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-gray-500">Provider</span>
                        {plan.ensName ? (
                          <>
                            <ENSProfileLink ensName={plan.ensName} />
                            <a
                              href={`https://app.ens.domains/${plan.ensName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-blue-200"
                            >
                              profile <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        ) : (
                          <ENSIdentity address={plan.providerAddress} />
                        )}
                      </div>
                      <p>
                        Token: <span className="font-medium text-white">{plan.symbol}</span>{" "}
                        <span className="font-mono text-gray-500">{plan.tokenId}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto grid gap-4 rounded-2xl border border-gray-800 bg-gray-950 p-4 sm:grid-cols-[0.8fr_0.8fr_auto]">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="mt-1 text-lg font-semibold leading-none text-white">
                      {plan.pricePerTokenHbar} <span className="text-sm text-gray-500">HBAR</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">per call</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Available</p>
                    <p className="mt-1 text-lg font-semibold leading-none text-white">{getSupply(plan)}</p>
                    <p className="mt-1 text-xs text-gray-500">tokens</p>
                  </div>
                  <div className="min-w-0 sm:min-w-32">
                    <button
                      onClick={() => setBuyPlan(plan)}
                      disabled={!walletAuthToken}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#5f1bb7,#7c3aed)] px-4 text-sm font-semibold text-white shadow-lg shadow-violet-700/25 transition hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {walletAuthToken ? "Buy" : "Sign In"}
                    </button>
                    {hasApiKey && owned > 0 && (
                      <p className="mt-2 truncate text-xs text-emerald-300">
                        {owned} active calls in My APIs
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {buyPlan && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setBuyPlan(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-gray-800 bg-gray-950 shadow-2xl shadow-black"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-800 bg-[linear-gradient(135deg,rgba(95,27,183,0.20),rgba(124,58,237,0.08))] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Purchase access
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{buyPlan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{buyPlan.description}</p>
                </div>
                <button
                  onClick={() => setBuyPlan(null)}
                  className="rounded-full border border-gray-800 px-3 py-1.5 text-sm font-semibold text-gray-400 transition hover:border-violet-400/40 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                  <p className="text-xs text-gray-500">You own</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {userTokens[buyPlan.tokenId] || 0}
                  </p>
                  <p className="text-xs text-gray-500">{buyPlan.symbol} calls</p>
                </div>
                <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {buyPlan.pricePerTokenHbar}
                  </p>
                  <p className="text-xs text-gray-500">HBAR per call</p>
                </div>
                <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                  <p className="text-xs text-gray-500">Available</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{getSupply(buyPlan)}</p>
                  <p className="text-xs text-gray-500">provider supply</p>
                </div>
              </div>

              <div className="rounded-3xl border border-violet-500/25 bg-violet-500/10 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-violet-100">Calls to buy</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose prepaid API calls. Inventory updates after purchase.
                    </p>
                  </div>
                  <div className="flex items-center rounded-2xl border border-gray-800 bg-gray-950 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAmounts((prev) => ({
                          ...prev,
                          [buyPlan.tokenId]: String(Math.max(1, selectedAmount - 1)),
                        }))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold text-gray-400 transition hover:bg-violet-500/10 hover:text-violet-100"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amounts[buyPlan.tokenId] ?? "5"}
                      onChange={(event) =>
                        setAmounts((prev) => ({
                          ...prev,
                          [buyPlan.tokenId]: event.target.value.replace(/[^\d]/g, ""),
                        }))
                      }
                      className="h-10 w-20 bg-transparent text-center text-xl font-semibold text-white outline-none"
                      aria-label={`Amount of ${buyPlan.symbol} tokens to buy`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAmounts((prev) => ({
                          ...prev,
                          [buyPlan.tokenId]: String(Math.min(selectedSupply, selectedAmount + 1)),
                        }))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold text-gray-400 transition hover:bg-violet-500/10 hover:text-violet-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[1, 5, 10, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setAmounts((prev) => ({
                          ...prev,
                          [buyPlan.tokenId]: String(preset),
                        }))
                      }
                      disabled={preset > selectedSupply}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedAmount === preset
                          ? "border-violet-300/70 bg-violet-500/25 text-white"
                          : "border-gray-800 bg-gray-950 text-violet-200 hover:border-violet-400/60"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {selectedTooHigh && (
                  <p className="mt-3 text-xs font-medium text-red-200">
                    Only {selectedSupply} {buyPlan.symbol} calls are available.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-3xl border border-gray-800 bg-gray-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Estimated total</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {selectedTotal.toFixed(2)}{" "}
                    <span className="text-sm text-gray-500">HBAR</span>
                  </p>
                </div>
                <button
                  onClick={() => buyTokens(buyPlan)}
                  disabled={
                    loading === buyPlan.tokenId ||
                    !selectedAmount ||
                    selectedTooHigh
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#5f1bb7,#7c3aed)] px-6 text-sm font-semibold text-white shadow-lg shadow-violet-700/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading === buyPlan.tokenId && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading === buyPlan.tokenId ? "Buying..." : "Confirm buy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
