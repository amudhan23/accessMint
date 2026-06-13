import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Coins,
  Layers3,
  ListPlus,
  Store,
  WalletCards,
} from "lucide-react";
import ExplorePage from "./pages/ExplorePage";
import ProviderPage from "./pages/ProviderPage";
import UserPage from "./pages/UserPage";
import MarketplacePage from "./pages/MarketplacePage";
import ActivityLog from "./components/ActivityLog";

const tabs = [
  { id: "explore", label: "Explore", icon: Layers3 },
  { id: "user", label: "My APIs", icon: WalletCards },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "provider", label: "List API", icon: ListPlus },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("explore");
  const [plans, setPlans] = useState([]);
  const [userTokens, setUserTokens] = useState({});
  const [apiKeys, setApiKeys] = useState({});
  const [listings, setListings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [currentUser, setCurrentUser] = useState("Alice");

  useEffect(() => {
    fetch("/api/plans")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(console.error);
  }, []);

  const addActivity = (entry) => {
    setActivity((prev) => [
      { ...entry, id: Date.now(), time: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };

  const switchUser = async (userId) => {
    const res = await fetch("/api/switch-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    setCurrentUser(data.name);
    setUserTokens({});
    setApiKeys({});
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 shadow-lg shadow-emerald-950">
                <Coins className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">AccessMint</h1>
                <p className="text-xs text-gray-500">Tokenized API Access on Hedera</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-2xl border border-gray-800 bg-gray-900 p-1">
                {["Alice", "Bob"].map((name) => (
                  <button
                    key={name}
                    onClick={() => switchUser(name.toLowerCase())}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      currentUser === name
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-950"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                Testnet
              </span>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-gray-800 text-emerald-300 shadow-inner"
                    : "text-gray-500 hover:bg-gray-800/60 hover:text-gray-200"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          {activeTab === "explore" && (
            <ExplorePage
              plans={plans}
              userTokens={userTokens}
              setUserTokens={setUserTokens}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              addActivity={addActivity}
            />
          )}
          {activeTab === "user" && (
            <UserPage
              plans={plans}
              userTokens={userTokens}
              setUserTokens={setUserTokens}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
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
              addActivity={addActivity}
            />
          )}
          {activeTab === "provider" && (
            <ProviderPage plans={plans} setPlans={setPlans} addActivity={addActivity} />
          )}
        </section>

        <aside className="min-w-0">
          <ActivityLog activity={activity} />
        </aside>
      </main>

      <footer className="border-t border-gray-900 px-4 py-6 text-center text-sm text-gray-600">
        <span className="inline-flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Powered by Hedera Token Service and Consensus Service
        </span>
      </footer>
    </div>
  );
}
