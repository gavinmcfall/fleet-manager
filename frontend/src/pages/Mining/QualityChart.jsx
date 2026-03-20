import React from 'react'
import { QUALITY_BANDS, qualityBandProbabilities } from './miningUtils'

const BAND_COLORS = [
  { bg: 'bg-red-500/30', bar: 'bg-red-500', text: 'text-red-400' },
  { bg: 'bg-amber-500/30', bar: 'bg-amber-500', text: 'text-amber-400' },
  { bg: 'bg-yellow-500/30', bar: 'bg-yellow-500', text: 'text-yellow-400' },
  { bg: 'bg-emerald-500/30', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  { bg: 'bg-sc-accent/30', bar: 'bg-sc-accent', text: 'text-sc-accent' },
]

export default function QualityChart({ quality, compact = false }) {
  if (!quality) return <span className="text-xs text-gray-600 italic">No quality data</span>

  const bands = qualityBandProbabilities(quality)
  if (!bands) return <span className="text-xs text-gray-600 italic">No quality data</span>

  const maxProb = Math.max(...bands.map(b => b.probability))

  if (compact) {
    // Compact: single horizontal bar with colored segments
    return (
      <div className="flex gap-0.5 h-4 rounded overflow-hidden">
        {bands.map((b, i) => {
          const c = BAND_COLORS[i]
          const pct = (b.probability * 100).toFixed(0)
          return (
            <div
              key={i}
              className={`${c.bar} transition-all duration-300 relative group`}
              style={{ width: `${Math.max(b.probability * 100, 2)}%` }}
              title={`Q${QUALITY_BANDS[i].label}: ${pct}%`}
            >
              {b.probability > 0.08 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white/80">
                  {pct}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Full: vertical bars with labels
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 h-20">
        {bands.map((b, i) => {
          const c = BAND_COLORS[i]
          const height = maxProb > 0 ? (b.probability / maxProb) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className={`text-[10px] font-mono ${c.text}`}>
                {b.probability > 0 ? `${(b.probability * 100).toFixed(0)}%` : '—'}
              </span>
              <div
                className={`w-full rounded-t ${c.bar} transition-all duration-500`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        {QUALITY_BANDS.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-gray-600 font-mono">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 font-mono">
        <span>Low Quality</span>
        <span>High Quality</span>
      </div>
    </div>
  )
}
