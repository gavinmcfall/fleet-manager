import React from 'react'
import { Crosshair, Info } from 'lucide-react'

/**
 * Missions that send the player to this POI. Distinguishes "definite"
 * (matched via `location_ref`) from "likely" (fallback match on `locality`
 * when no `location_ref` exists on the row — less reliable).
 */
export default function POIMissions({ envelope }) {
  if (envelope.partial && envelope.count === 0) {
    return (
      <section>
        <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">Missions here</h2>
        <p className="text-xs text-gray-500">{envelope.note || 'Temporarily unavailable.'}</p>
      </section>
    )
  }
  if (envelope.count === 0) return null

  return (
    <section>
      <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">
        Missions here ({envelope.count})
      </h2>
      <div className="border border-sc-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-display uppercase tracking-wide text-gray-500 border-b border-sc-border">
              <th className="text-left px-3 py-2">Mission</th>
              <th className="text-left px-3 py-2 w-32">Giver</th>
              <th className="text-left px-3 py-2 w-24">Type</th>
              <th className="text-right px-3 py-2 w-32">Reward</th>
            </tr>
          </thead>
          <tbody>
            {envelope.data.map(m => (
              <tr key={m.id} className="border-b border-sc-border/50 last:border-0 hover:bg-white/3">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-gray-200">
                    <Crosshair className="w-3 h-3 text-gray-500" />
                    {m.title}
                    {m.likely && (
                      <span
                        className="text-[9px] text-amber-400/70 font-mono flex items-center gap-0.5"
                        title="Matched via locality fallback — location_ref wasn't set on the mission. May be less precise."
                      >
                        <Info className="w-2.5 h-2.5" />
                        likely
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-gray-400 font-mono text-[11px] truncate">{m.giver_name || '—'}</td>
                <td className="px-3 py-1.5 text-gray-400 font-mono text-[11px]">{m.category || '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {m.is_dynamic_reward === 1 ? (
                    <span className="text-sc-accent2 italic text-[11px]">Dynamic</span>
                  ) : m.reward_amount ? (
                    <span className="text-sc-warn">{Math.round(m.reward_amount).toLocaleString()} aUEC</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
