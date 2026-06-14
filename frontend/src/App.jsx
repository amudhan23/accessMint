import { useEffect, useState } from "react";
import {
  Activity,
  Coins,
  Layers3,
  ListPlus,
  Moon,
  Sun,
  Store,
  WalletCards,
} from "lucide-react";
import ExplorePage from "./pages/ExplorePage";
import ProviderPage from "./pages/ProviderPage";
import UserPage from "./pages/UserPage";
import MarketplacePage from "./pages/MarketplacePage";
import ActivityLog from "./components/ActivityLog";
import { WalletButton } from "./components/WalletConnect";
import { useWallet } from "./components/walletContext";

const tabs = [
  { id: "explore", label: "Explore", icon: Layers3 },
  { id: "user", label: "My APIs", icon: WalletCards },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "provider", label: "List API", icon: ListPlus },
];

export default function App() {
  const { accountId, authToken, isConnected } = useWallet();
  const [activeTab, setActiveTab] = useState("explore");
  const [plans, setPlans] = useState([]);
  const [userTokens, setUserTokens] = useState({});
  const [apiKeys, setApiKeys] = useState({});
  const [listings, setListings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem("accessmint-theme") || "dark");
  const [highlightTokenId, setHighlightTokenId] = useState("");

  useEffect(() => {
    fetch("/api/plans")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/listings")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setListings(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isConnected || !accountId || !authToken) {
      return;
    }

    fetch("/api/wallet-state", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((response) => response.json())
      .then((data) => {
        setUserTokens(data.userTokens || {});
        setApiKeys(data.apiKeys || {});
        if (Array.isArray(data.listings)) setListings(data.listings);
      })
      .catch(console.error);
  }, [accountId, authToken, isConnected]);

  useEffect(() => {
    if (isConnected && accountId) return;
    const reset = window.setTimeout(() => {
      setUserTokens({});
      setApiKeys({});
    }, 0);
    return () => window.clearTimeout(reset);
  }, [accountId, isConnected]);

  const addActivity = (entry) => {
    setActivity((prev) => [
      { ...entry, id: Date.now(), time: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };

  const isLight = theme === "light";

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("accessmint-theme", next);
      return next;
    });
  };

  const openExploreToken = (tokenId) => {
    setHighlightTokenId(String(tokenId || ""));
    setActiveTab("explore");
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors ${
        isLight
          ? "bg-[#f7f0ff] text-gray-950"
          : "bg-[#07040f] text-white"
      }`}
      data-theme={theme}
    >
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-2xl ${
          isLight
            ? "border-violet-200/70 bg-[#fff8ff]/75"
            : "border-violet-500/10 bg-[#07040f]/75"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 shadow-lg shadow-violet-950/40">
                <Coins className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  AccessMint
                </h1>
                <p className={`text-xs ${isLight ? "text-gray-500" : "text-gray-500"}`}>
                  Tokenized API Access on Hedera
                </p>
              </div>
            </div>

            <nav
              className={`flex gap-1 overflow-x-auto rounded-2xl border p-1 ${
                isLight
                  ? "border-violet-200/70 bg-white/50"
                  : "border-violet-500/10 bg-white/[0.035]"
              }`}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? isLight
                        ? "bg-[linear-gradient(135deg,#57068c,#7c3aed)] text-white shadow-lg shadow-violet-700/25"
                        : "bg-[linear-gradient(135deg,#57068c,#7c3aed)] text-white shadow-lg shadow-violet-700/25"
                      : isLight
                        ? "text-slate-500 hover:bg-white/70 hover:text-violet-950"
                        : "text-gray-500 hover:bg-white/5 hover:text-violet-100"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex justify-start gap-2 lg:justify-end">
              <button
                onClick={toggleTheme}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  isLight
                    ? "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/10"
                }`}
                title={isLight ? "Switch to dark mode" : "Switch to light mode"}
              >
                {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          {activeTab === "explore" && (
            <ExplorePage
              plans={plans}
              setPlans={setPlans}
              userTokens={userTokens}
              setUserTokens={setUserTokens}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              walletAccountId={accountId?.toString()}
              walletAuthToken={authToken}
              addActivity={addActivity}
              highlightTokenId={highlightTokenId}
              onHighlightHandled={() => setHighlightTokenId("")}
            />
          )}
          {activeTab === "user" && (
            <UserPage
              plans={plans}
              userTokens={userTokens}
              setUserTokens={setUserTokens}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              walletAccountId={accountId?.toString()}
              walletAuthToken={authToken}
              setListings={setListings}
              addActivity={addActivity}
            />
          )}
          {activeTab === "marketplace" && (
            <MarketplacePage
              listings={listings}
              setListings={setListings}
              setUserTokens={setUserTokens}
              setApiKeys={setApiKeys}
              walletAuthToken={authToken}
              addActivity={addActivity}
              plans={plans}
              onExploreToken={openExploreToken}
            />
          )}
          {activeTab === "provider" && (
            <ProviderPage
              plans={plans}
              setPlans={setPlans}
              addActivity={addActivity}
            />
          )}
        </section>

        <aside className="min-w-0">
          <ActivityLog activity={activity} />
        </aside>
      </main>

      <footer
        className={`mt-24 border-t px-4 py-10 text-center text-sm ${
          isLight ? "border-gray-200 text-gray-500" : "border-white/10 text-gray-600"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Powered by Hedera Token Service and Consensus Service
        </span>
      </footer>
    </div>
  );
}
