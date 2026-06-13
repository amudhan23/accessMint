import { Coins, Flame, Tag, ShoppingCart, Zap, ExternalLink } from 'lucide-react'

const iconMap = {
  create: { icon: Zap, color: 'text-mint-400', bg: 'bg-mint-500/10' },
  buy: { icon: Coins, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  redeem: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  list: { icon: Tag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  marketplace_buy: { icon: ShoppingCart, color: 'text-mint-400', bg: 'bg-mint-500/10' },
}

export default function ActivityLog({ activity }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sticky top-28">
      <h3 className="font-semibold text-lg mb-4">Activity Feed</h3>

      {activity.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 text-sm">No activity yet</p>
          <p className="text-gray-700 text-xs mt-1">Transactions will appear here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {activity.map(entry => {
            const style = iconMap[entry.type] || iconMap.create
            const Icon = style.icon

            return (
              <div key={entry.id} className="flex gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition">
                <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${style.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">{entry.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-600">{entry.time}</span>
                    {entry.tokenId && (
                      <a
                        href={`https://hashscan.io/testnet/token/${entry.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-mint-400 transition"
                      >
                        Hashscan <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hedera Badge */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-mint-500" />
          All transactions verified on Hedera Consensus Service
        </div>
      </div>
    </div>
  )
}
