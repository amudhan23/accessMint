import { useState } from "react";
import {
  Coins,
  Store,
  Flame,
  BarChart3,
  ArrowRightLeft,
  Zap,
} from "lucide-react";
import ProviderPage from "./pages/ProviderPage";
import UserPage from "./pages/UserPage";
import MarketplacePage from "./pages/MarketplacePage";
import ActivityLog from "./components/ActivityLog";
import { useEffect } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("user");
  const [plans, setPlans] = useState([]);
  const [userTokens, setUserTokens] = useState({});
  const [listings, setListings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [currentUser, setCurrentUser] = useState("Alice");

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
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
  };

  const tabs = [
    {
      id: "provider",
      label: "Provider",
      icon: Zap,
      desc: "Create access plans",
    },
    { id: "user", label: "Dashboard", icon: Coins, desc: "Buy & use tokens" },
    {
      id: "marketplace",
      label: "Marketplace",
      icon: Store,
      desc: "Resell tokens",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint-400 to-mint-600 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">AccessMint</h1>
                <p className="text-xs text-gray-500">
                  Tokenized API Access on Hedera
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
                <button
                  onClick={() => switchUser("alice")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    currentUser === "Alice"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  👩 Alice
                </button>
                <button
                  onClick={() => switchUser("bob")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    currentUser === "Bob"
                      ? "bg-orange-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  👨 Bob
                </button>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-500/10 text-mint-400 border border-mint-500/20 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" />
                Hedera Testnet
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative
                  ${
                    activeTab === tab.id
                      ? "text-mint-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-mint-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Page Content */}
          <div className="lg:col-span-2">
            {activeTab === "provider" && (
              <ProviderPage
                plans={plans}
                setPlans={setPlans}
                addActivity={addActivity}
              />
            )}
            {activeTab === "user" && (
              <UserPage
                plans={plans}
                userTokens={userTokens}
                setUserTokens={setUserTokens}
                listings={listings}
                setListings={setListings}
                addActivity={addActivity}
              />
            )}
            {activeTab === "marketplace" && (
              <MarketplacePage
                listings={listings}
                setListings={setListings}
                userTokens={userTokens}
                setUserTokens={setUserTokens}
                addActivity={addActivity}
              />
            )}
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <ActivityLog activity={activity} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          Built at ETHGlobal NYC 2026 · Powered by Hedera Token Service &
          Consensus Service
        </div>
      </footer>
    </div>
  );
}
