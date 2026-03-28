import { COMPARE_STATS } from './componentsConfig'
import { fmtPct, fmtDec1, fmtInt } from '../Loadout/loadoutHelpers'

function formatValue(val, stat) {
  if (val == null) return '\u2014'
  if (stat.format === 'pct') return fmtPct(val)
  const n = typeof val === 'number' ? val : parseFloat(val)
  if (!isNaN(n)) {
    const formatted = n >= 1000 ? fmtInt(n) : n % 1 === 0 ? String(n) : fmtDec1(n)
    return formatted + (stat.suffix || '')
  }
  return String(val)
}

function getWinner(values, stat) {
  const nums = values.map(v => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : parseFloat(v)
    return isNaN(n) ? null : n
  })
  const valid = nums.filter(n => n !== null)
  if (valid.length < 2) return null
  if (stat.higher) {
    const max = Math.max(...valid)
    if (valid.every(n => n === max)) return null
    return nums.indexOf(max)
  }
  if (stat.lower) {
    const min = Math.min(...valid)
    if (valid.every(n => n === min)) return null
    return nums.indexOf(min)
  }
  return null
}

export default function CompareTable({ items, apiType }) {
  if (!items || items.length < 2) return null

  const stats = COMPARE_STATS[apiType] || []
  const activeStats = stats.filter(s => items.some(i => i[s.key] != null))

  return (
    <div className="space-y-3">
      {/* Item headers */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `8rem repeat(${items.length}, 1fr)` }}>
        <div />
        {items.map(item => (
          <div key={item.id} className="bg-white/[0.03] border border-white/[0.06] rounded p-3 text-center">
            <p className="text-xs font-medium text-white truncate">{item.name}</p>
            {item.manufacturer_name && (
              <p className="text-[9px] font-mono text-gray-500 mt-0.5 truncate">{item.manufacturer_name}</p>
            )}
            {item.size != null && (
              <span className="inline-block text-[9px] font-mono text-gray-400 bg-white/[0.06] px-1.5 py-0.5 rounded mt-1">
                S{item.size}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Stat rows */}
      {activeStats.length === 0 ? (
        <p className="text-xs font-mono text-gray-600 text-center py-4">No comparable stats</p>
      ) : (
        <div className="border border-white/[0.06] rounded overflow-hidden divide-y divide-white/[0.04]">
          {activeStats.map(stat => {
            const values = items.map(i => i[stat.key])
            const winner = getWinner(values, stat)
            return (
              <div
                key={stat.key}
                className="grid items-center gap-3 px-3 py-2"
                style={{ gridTemplateColumns: `8rem repeat(${items.length}, 1fr)` }}
              >
                <span className="text-[10px] font-mono text-gray-500 truncate">{stat.label}</span>
                {values.map((val, idx) => (
                  <span
                    key={idx}
                    className={`text-xs font-mono text-center ${
                      winner === idx
                        ? 'text-sc-accent font-semibold'
                        : val == null ? 'text-gray-700' : 'text-gray-300'
                    }`}
                    style={winner === idx ? { textShadow: '0 0 8px rgba(34, 211, 238, 0.4)' } : undefined}
                  >
                    {formatValue(val, stat)}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
