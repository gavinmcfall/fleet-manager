const SHORT_LABELS = {
  resist_physical: 'Phys',
  resist_energy: 'Enrgy',
  resist_distortion: 'Dist',
  resist_thermal: 'Therm',
  resist_biochemical: 'Bio',
  resist_stun: 'Stun',
}

export default function ResistanceBar({ statKey, value }) {
  if (value == null) return null
  const pct = Math.round((1 - value) * 100)
  const clampedPct = Math.max(0, Math.min(100, pct))
  const color = clampedPct >= 70 ? 'bg-emerald-500' : clampedPct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const label = SHORT_LABELS[statKey] || statKey

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] font-mono text-gray-500 w-8 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <span className="text-[8px] font-mono text-gray-400 w-6 text-right">{clampedPct}%</span>
    </div>
  )
}
