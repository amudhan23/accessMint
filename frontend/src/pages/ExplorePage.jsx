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

export default function ExplorePage({
  plans,
  userTokens,
  setUserTokens,
  apiKeys,
  setApiKeys,
  walletAccountId,
  walletAuthToken,
  addActivity,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("low");
  const [amounts, setAmounts] = useState({});
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

  const visiblePlans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ensName = ensSearchName;
    const ensAddress =
      ensLookup.name === ensSearchName ? ensLookup.result?.address?.toLowerCase() || "" : "";
    return [...plans]
      .filter((plan) => {
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
  }, [ensLookup, ensSearchName, plans, query, sort]);

  const ensLookupStatus =
    ensSearchName && ensLookup.name === ensSearchName ? ensLookup.status : "loading";
  const ensLookupResult = ensLookup.name === ensSearchName ? ensLookup.result : null;
  const ensLookupError = ensLookup.name === ensSearchName ? ensLookup.error : "";

  const buyTokens = async (plan) => {
    if (!walletAuthToken) {
      setError("Connect and sign with your wallet before buying API access.");
      return;
    }
    const amount = Math.max(1, Number(amounts[plan.tokenId] ?? 5));
    if (!Number.isFinite(amount)) return;
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
    } catch (err) {
      console.error(err);
      setError(err.message || "Purchase failed");
    }

    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Explore
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            API Marketplace
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Discover and purchase tokenized API access.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
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
            className="h-11 w-full rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-3 text-sm text-white outline-none transition focus:border-emerald-500"
            placeholder="Search APIs, providers, symbols..."
          />
        </label>
        <label className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-gray-800 bg-gray-950 pl-10 pr-8 text-sm text-white outline-none transition focus:border-emerald-500"
          >
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </label>
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
            const amountValue = amounts[plan.tokenId] ?? "5";
            const numericAmount = Number(amountValue);
            const amount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0;
            const owned = userTokens[plan.tokenId] || 0;
            const cost = amount * plan.pricePerTokenHbar;

            return (
              <article
                key={plan.tokenId}
                className="group rounded-2xl border border-gray-800 bg-gray-900/80 p-4 shadow-xl shadow-black/10 transition hover:border-emerald-500/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <Icon className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-400">
                          {plan.description || `${plan.symbol} access plan`}
                        </p>
                      </div>
                      {owned > 0 && (
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">
                          Own {owned}
                        </span>
                      )}
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

                <div className="mt-5 grid gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3 sm:grid-cols-[0.8fr_0.8fr_1.45fr]">
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
                  <div className="min-w-0">
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={amountValue}
                        onChange={(event) =>
                          setAmounts((prev) => ({
                            ...prev,
                            [plan.tokenId]: event.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                        className="h-10 w-16 rounded-lg border border-gray-800 bg-gray-900 px-3 text-center text-sm font-semibold text-white outline-none transition focus:border-emerald-500"
                        aria-label={`Amount of ${plan.symbol} tokens to buy`}
                      />
                      <button
                        onClick={() => buyTokens(plan)}
                        disabled={!walletAuthToken || loading === plan.tokenId || amount < 1}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === plan.tokenId && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!walletAuthToken
                          ? "Sign In"
                          : loading === plan.tokenId
                            ? "Buying..."
                            : `Buy ${cost.toFixed(2)} HBAR`}
                      </button>
                    </div>
                    {apiKeys[plan.tokenId] && (
                      <p className="mt-2 truncate text-xs text-emerald-300">
                        API key ready in My APIs
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
