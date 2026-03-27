import { rarityStyle, effectiveCategory } from '../../lib/lootDisplay'
import { getStatConfig } from './CategoryStatConfig'

// Stats to compare per category — ordered by importance
const COMPARE_STATS = {
  weapon: [
    { key: 'dps', label: 'DPS', higher: true },
    { key: 'damage_type', label: 'Damage Type' },
    { key: 'rounds_per_minute', label: 'RPM', higher: true },
    { key: 'effective_range', label: 'Range', suffix: 'm', higher: true },
    { key: 'ammo_capacity', label: 'Ammo', higher: true },
  ],
  armour: [
    { key: 'resist_physical', label: 'Physical Resist', lower: true, format: 'resist' },
    { key: 'resist_energy', label: 'Energy Resist', lower: true, format: 'resist' },
    { key: 'resist_distortion', label: 'Distortion Resist', lower: true, format: 'resist' },
  ],
  helmet: [
    { key: 'resist_physical', label: 'Physical Resist', lower: true, format: 'resist' },
    { key: 'resist_energy', label: 'Energy Resist', lower: true, format: 'resist' },
    { key: 'resist_distortion', label: 'Distortion Resist', lower: true, format: 'resist' },
    { key: 'atmosphere_capacity', label: 'EVA Support', higher: true },
  ],
  ship_component: [
    { key: 'comp_size', label: 'Size' },
    { key: 'comp_grade', label: 'Grade' },
    { key: 'power_output', label: 'Power Output', higher: true },
    { key: 'cooling_rate', label: 'Cooling Rate', higher: true },
    { key: 'shield_hp', label: 'Shield HP', higher: true },
    { key: 'shield_regen', label: 'Shield Regen', higher: true, suffix: '/s' },
    { key: 'quantum_speed', label: 'QT Speed', higher: true, suffix: ' m/s' },
    { key: 'quantum_range', label: 'QT Range', higher: true },
    { key: 'dps', label: 'DPS', higher: true },
  ],
  ship_weapon: [
    { key: 'dps', label: 'DPS', higher: true },
    { key: 'damage_type', label: 'Damage Type' },
    { key: 'comp_size', label: 'Size' },
    { key: 'comp_grade', label: 'Grade' },
  ],
  missile: [
    { key: 'missile_damage', label: 'Damage', higher: true },
    { key: 'tracking_signal', label: 'Tracking' },
    { key: 'lock_time', label: 'Lock Time', suffix: 's', lower: true },
    { key: 'missile_speed', label: 'Speed', suffix: ' m/s', higher: true },
  ],
  consumable: [
    { key: 'heal_amount', label: 'Heal Amount', higher: true },
  ],
  attachment: [
    { key: 'zoom_scale', label: 'Zoom', higher: true, suffix: 'x' },
    { key: 'damage_multiplier', label: 'Damage Mod', format: 'multiplier' },
    { key: 'sound_radius_multiplier', label: 'Sound Mod', format: 'multiplier', lower: true },
  ],
  _default: [],
}

function formatValue(val, stat) {
  if (val == null) return '—'
  if (stat.format === 'resist') {
    return Math.round((1 - val) * 100) + '%'
  }
  if (stat.format === 'multiplier') {
    const n = parseFloat(val)
    if (isNaN(n) || n === 1) return '—'
    return (n < 1 ? '' : '+') + Math.round((n - 1) * 100) + '%'
  }
  const n = typeof val === 'number' ? val : parseFloat(val)
  if (!isNaN(n)) {
    const formatted = n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n % 1 === 0 ? String(n) : n.toFixed(1)
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
  const validNums = nums.filter(n => n !== null)
  if (validNums.length < 2) return null

  if (stat.higher) {
    const max = Math.max(...validNums)
    if (validNums.filter(n => n === max).length === validNums.length) return null // tie
    return nums.indexOf(max)
  }
  if (stat.lower) {
    const min = Math.min(...validNums)
    if (validNums.filter(n => n === min).length === validNums.length) return null
    return nums.indexOf(min)
  }
  return null
}

export default function CompareTable({ items, category }) {
  if (!items || items.length < 2) return null

  const stats = COMPARE_STATS[category] || COMPARE_STATS._default
  // Filter to stats where at least one item has a value
  const activeStats = stats.filter(s => items.some(i => i[s.key] != null))

  return (
    <div className="space-y-3">
      {/* Item headers */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `8rem repeat(${items.length}, 1fr)` }}>
        <div />
        {items.map(item => {
          const rs = item.rarity ? rarityStyle(item.rarity) : null
          return (
            <div key={item.uuid} className="panel p-3 text-center">
              <p className="text-xs font-medium text-white truncate">{item.name}</p>
              {item.manufacturer_name && (
                <p className="text-[9px] font-mono text-gray-500 mt-0.5 truncate">{item.manufacturer_name}</p>
              )}
              {item.rarity && rs && (
                <span className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded border mt-1 ${rs.badge}`}>
                  {item.rarity}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Stat rows */}
      {activeStats.length === 0 ? (
        <p className="text-xs font-mono text-gray-600 text-center py-4">No comparable stats for this category</p>
      ) : (
        <div className="border border-sc-border rounded overflow-hidden divide-y divide-sc-border/50">
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
                      winner === idx ? 'text-emerald-400 font-semibold' : val == null ? 'text-gray-700' : 'text-gray-300'
                    }`}
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
