import { Coins, ExternalLink, Flame, ShoppingCart, Tag, Zap } from "lucide-react";

const iconMap = {
  create: { icon: Zap, color: "text-emerald-300", bg: "bg-emerald-500/10" },
  buy: { icon: Coins, color: "text-blue-300", bg: "bg-blue-500/10" },
  redeem: { icon: Flame, color: "text-orange-300", bg: "bg-orange-500/10" },
  list: { icon: Tag, color: "text-purple-300", bg: "bg-purple-500/10" },
  marketplace_buy: {
    icon: ShoppingCart,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
};

export default function ActivityLog({ activity }) {
  return (
    <div className="sticky top-28 rounded-2xl border border-gray-800 bg-gray-900/80 p-4 shadow-xl shadow-black/10">
      <h3 className="mb-3 text-base font-semibold text-white">Activity Feed</h3>

      {activity.length === 0 ? (
        <div className="py-7 text-center">
          <p className="text-sm text-gray-600">No activity yet</p>
          <p className="mt-1 text-xs text-gray-700">Transactions will appear here</p>
        </div>
      ) : (
        <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
          {activity.map((entry) => {
            const style = iconMap[entry.type] || iconMap.create;
            const Icon = style.icon;

            return (
              <div
                key={entry.id}
                className="flex gap-3 rounded-xl bg-gray-800/30 p-3 transition hover:bg-gray-800/50"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
                >
                  <Icon className={`h-4 w-4 ${style.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-gray-200">{entry.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-600">{entry.time}</span>
                    {entry.tokenId && (
                      <a
                        href={`https://hashscan.io/testnet/token/${entry.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-emerald-300"
                      >
                        Hashscan <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          All transactions verified on Hedera Consensus Service
        </div>
      </div>
    </div>
  );
}
