import React from 'react'
import { Star } from 'lucide-react'

export default function ReputationBadge({ reputation, compact = false }) {
  if (!reputation || reputation.length === 0) return null

  const totalRatings = reputation.reduce((s, r) => s + r.rating_count, 0)
  if (totalRatings === 0) return null

  const avgScore = reputation.reduce((s, r) => s + r.median_score * r.rating_count, 0) / totalRatings

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
        <span className="text-amber-400 font-mono">{avgScore.toFixed(1)}</span>
        <span className="text-gray-600">({totalRatings})</span>
      </span>
    )
  }

  return (
    <div className="space-y-1.5">
      {reputation.map((r) => (
        <div key={r.category} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider w-24 shrink-0 font-display">{r.label}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-3 h-3 ${
                  n <= Math.round(r.median_score)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-700'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-600 font-mono">({r.rating_count})</span>
        </div>
      ))}
    </div>
  )
}
