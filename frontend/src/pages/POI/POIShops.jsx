import React from 'react'
import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'

const SHOP_TYPE_STYLES = {
  admin:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  weapons:  'bg-red-500/10 text-red-400 border-red-500/30',
  armor:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  clothing: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  food:     'bg-green-500/10 text-green-400 border-green-500/30',
  ship:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  general:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
  default:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

function formatAuec(n) {
  if (n == null) return '—'
  return `${Math.round(n).toLocaleString()} aUEC`
}

/**
 * Shops at this POI, with real UEX-populated inventory counts + price range.
 * Each row links to the shop detail page. Shops with zero UEX data are shown
 * with a muted "no pricing data yet" label rather than hidden — the player
 * still wants to know the shop exists.
 */
export default function POIShops({ envelope }) {
  if (envelope.partial && envelope.count === 0) {
    return (
      <section>
        <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">Shops here</h2>
        <p className="text-xs text-gray-500">{envelope.note || 'Temporarily unavailable.'}</p>
      </section>
    )
  }
  if (envelope.count === 0) {
    return (
      <section>
        <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">Shops here</h2>
        <p className="text-xs text-gray-500">No player-visible shops here.</p>
      </section>
    )
  }

  const totalItems = envelope.data.reduce((sum, s) => sum + (s.item_count || 0), 0)
  const shopsWithData = envelope.data.filter(s => s.has_uex_data).length

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-display uppercase tracking-widest text-gray-400">
          Shops here ({envelope.count})
        </h2>
        {totalItems > 0 && (
          <span className="text-xs text-gray-500 font-mono">
            {totalItems.toLocaleString()} items for sale · {shopsWithData} with live pricing
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {envelope.data.map(shop => {
          const style = SHOP_TYPE_STYLES[shop.shop_type] || SHOP_TYPE_STYLES.default
          return (
            <Link
              key={shop.id}
              to={`/poi/shop/${encodeURIComponent(shop.slug || shop.name)}`}
              className="flex items-center gap-3 px-3 py-2.5 border border-sc-border rounded-lg hover:border-sc-accent/40 hover:bg-white/5 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 truncate">{shop.name}</div>
                {shop.has_uex_data ? (
                  <div className="text-[10px] text-gray-500 font-mono">
                    {shop.item_count} items
                    {shop.min_price != null && shop.max_price != null && shop.min_price !== shop.max_price && (
                      <> · {formatAuec(shop.min_price)} – {formatAuec(shop.max_price)}</>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 font-mono italic">no pricing data yet</div>
                )}
              </div>
              {shop.shop_type && (
                <span className={`text-[10px] font-display uppercase px-1.5 py-0.5 rounded border shrink-0 ${style}`}>
                  {shop.shop_type}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
