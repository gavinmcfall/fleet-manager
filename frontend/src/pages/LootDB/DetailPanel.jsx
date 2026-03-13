import { X, ShoppingCart, Package, Swords, Skull, FileText, Plus, Bookmark, BookmarkPlus } from 'lucide-react'
import { useLootItem } from '../../hooks/useAPI'
import useGameVersion from '../../hooks/useGameVersion'
import { rarityStyle, CATEGORY_BADGE_STYLES, CATEGORY_LABELS, RESISTANCE_KEYS, effectiveCategory } from '../../lib/lootDisplay'
import LoadingState from '../../components/LoadingState'
import LocationSection from './LocationSection'

// ── Detail panel helpers ──────────────────────────────────────────────────────

/**
 * Fix UTF-8 mojibake stored in D1 (e.g. "Â°C" → "°C", "Âµ" → "µ").
 * Caused by double-encoding: UTF-8 bytes stored as Latin-1 characters.
 */
function decodeMojibake(str) {
  if (!str || typeof str !== 'string') return str
  try {
    const encoded = str.replace(/[\x80-\xFF]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
    return decodeURIComponent(encoded)
  } catch { return str }
}

/**
 * Format a fire_modes array into readable text.
 * e.g. ["Burst", "Single"] + burst_count=3 → "3-Round Burst, Single"
 */
function formatFireModes(modes, burstCount) {
  if (!Array.isArray(modes) || modes.length === 0) return null
  return modes
    .map(m => (m === 'Burst' && burstCount) ? `${burstCount}-Round Burst` : m)
    .join(', ')
}

/** Human-readable labels for stat columns. null = hidden. */
const STAT_LABELS = {
  // FPS weapons
  item_port_count:       'Attachment Slots',
  ammo_capacity:         'Ammo Capacity',
  rounds_per_minute:     'Rounds / Min',
  fire_modes:            'Fire Modes',
  burst_count:           null,           // merged into fire_modes display
  damage:                'Damage',
  damage_type:           'Damage Type',
  projectile_speed:      'Projectile Speed',
  effective_range:       'Effective Range',
  dps:                   'DPS',
  zoom_factor:           'Zoom',
  // Helmet / armour damage resistances (multiplier: lower = more resistant)
  resist_physical:       'Physical Resist',
  resist_energy:         'Energy Resist',
  resist_distortion:     'Distortion Resist',
  resist_thermal:        'Thermal Resist',
  resist_biochemical:    'Biochemical Resist',
  resist_stun:           'Stun Resist',
  // Helmet / armour misc
  atmosphere_capacity:   'EVA Support',
  ir_emission:           'IR Emission',
  em_emission:           'EM Emission',
  // Attachments
  zoom_scale:            'Zoom',
  second_zoom_scale:     'Alt Zoom',
  damage_multiplier:     'Damage Modifier',
  sound_radius_multiplier:'Sound Radius',
  // Utilities / consumables
  heal_amount:           'Heal Amount',
  effect_duration:       'Duration',
  consumable_type:       'Consumable Type',
  blast_radius:          'Blast Radius',
  fuse_time:             'Fuse Time',
  device_type:           'Device Type',
  // Clothing
  storage_capacity:      'Storage Capacity',
  temperature_range_min: 'Min Temperature',
  temperature_range_max: 'Max Temperature',
  // Vehicle components
  power_output:          'Power Output',
  overpower_performance: 'Overpower Perf.',
  overclock_performance: 'Overclock Perf.',
  thermal_output:        'Thermal Output',
  cooling_rate:          'Cooling Rate',
  max_temperature:       'Max Temperature',
  overheat_temperature:  'Overheat Temp',
  shield_hp:             'Shield HP',
  shield_regen:          'Shield Regen',
  regen_delay:           'Regen Delay',
  downed_regen_delay:    'Downed Regen Delay',
  quantum_speed:         'QT Speed',
  quantum_range:         'QT Range',
  fuel_rate:             'Fuel Rate',
  spool_time:            'Spool Time',
  cooldown_time:         'Cooldown',
  stage1_accel:          'Stage 1 Accel',
  stage2_accel:          'Stage 2 Accel',
  ammo_container_size:   'Ammo Pool',
  damage_per_shot:       'Damage/Shot',
  heat_per_shot:         'Heat/Shot',
  power_draw:            'Power Draw',
  rotation_speed:        'Rotation Speed',
  gimbal_type:           'Gimbal Type',
  thrust_force:          'Thrust Force',
  fuel_burn_rate:        'Fuel Burn Rate',
  radar_range:           'Radar Range',
  radar_angle:           'Radar Angle',
  qed_range:             'QED Range',
  qed_strength:          'QED Strength',
  // Ship missiles
  missile_type:          'Missile Type',
  lock_time:             'Lock Time',
  tracking_signal:       'Tracking Signal',
  speed:                 'Speed',
  lock_range:            'Lock Range',
  ammo_count:            'Ammo Count',
}

/** Display order for stat columns. Unknown fields sort alphabetically after. */
const STAT_ORDER = [
  'item_port_count', 'ammo_capacity', 'rounds_per_minute', 'fire_modes', 'damage', 'damage_type',
  'damage_per_shot', 'dps', 'projectile_speed', 'effective_range', 'heat_per_shot', 'power_draw',
  'zoom_factor', 'zoom_scale', 'second_zoom_scale', 'damage_multiplier', 'sound_radius_multiplier',
  'resist_physical', 'resist_energy', 'resist_distortion',
  'resist_thermal', 'resist_biochemical', 'resist_stun',
  'atmosphere_capacity', 'ir_emission', 'em_emission',
  'storage_capacity', 'temperature_range_min', 'temperature_range_max',
  'heal_amount', 'effect_duration', 'consumable_type', 'blast_radius', 'fuse_time', 'device_type',
  'power_output', 'overpower_performance', 'overclock_performance', 'thermal_output',
  'cooling_rate', 'max_temperature', 'overheat_temperature',
  'shield_hp', 'shield_regen', 'regen_delay', 'downed_regen_delay',
  'quantum_speed', 'quantum_range', 'fuel_rate', 'spool_time', 'cooldown_time', 'stage1_accel', 'stage2_accel',
  'ammo_container_size', 'rotation_speed', 'gimbal_type',
  'thrust_force', 'fuel_burn_rate', 'radar_range', 'radar_angle', 'qed_range', 'qed_strength',
  'missile_type', 'lock_time', 'tracking_signal', 'speed', 'lock_range', 'ammo_count',
]

/** Known stat keys that are hidden from generic display (metadata or merged into other stats) */
const STAT_HIDDEN = new Set([
  'name', 'type', 'sub_type', 'slot', 'size', 'grade', 'description', 'id',
  'burst_count',  // merged into fire_modes display
])

/** Keys where the stored value is a multiplier (1.0 = base); display as % of base. */
const MULTIPLIER_STATS = new Set(['damage_multiplier', 'sound_radius_multiplier'])
/** Keys where the stored value is a damage resistance multiplier (lower = more resistant). */
const RESISTANCE_STATS = new Set(['resist_physical', 'resist_energy', 'resist_distortion', 'resist_thermal', 'resist_biochemical', 'resist_stun'])
/** Stats that should always display for certain categories — show "N/A" when null so users know it's not missing data. */
const ALWAYS_SHOW_STATS = {
  armour:  ['ir_emission', 'em_emission'],
  helmet:  ['ir_emission', 'em_emission'],
}

export default function DetailPanel({ uuid, manufacturerName, collectionQty, onSetCollectionQty, wishlisted, onToggleWishlist, isAuthed, onClose }) {
  const { activeCode } = useGameVersion()
  const { data: item, loading } = useLootItem(uuid, activeCode)

  if (!uuid) return null

  const parsedJson = (key) => {
    if (!item?.[key] || item[key] === 'null' || item[key] === '[]') return []
    try { return JSON.parse(item[key]) } catch { return [] }
  }

  const rs = item?.rarity ? rarityStyle(item.rarity) : null
  const eCat = item ? effectiveCategory(item) : ''
  const catStyle = item ? CATEGORY_BADGE_STYLES[eCat] || CATEGORY_BADGE_STYLES.unknown : ''
  const catLabel = item ? CATEGORY_LABELS[eCat] || eCat : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-[28rem] bg-sc-darker border-l border-sc-border z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sc-border shrink-0">
          <span className="text-xs font-display uppercase tracking-wider text-gray-400">Item Detail</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingState message="Loading item..." />
          </div>
        )}

        {item && !loading && (
          <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-5">
            {/* Name + badges */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white leading-tight">{item.name}</h2>
              {manufacturerName && (
                <p className="text-[10px] font-mono text-gray-500">{manufacturerName}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[10px] font-display uppercase tracking-wide px-1.5 py-0.5 rounded ${catStyle}`}>
                  {catLabel}
                </span>
                {item.rarity && rs && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${rs.badge}`}>
                    {item.rarity}
                  </span>
                )}
                {item.sub_type && item.sub_type !== 'UNDEFINED' && (
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-800/60 px-1.5 py-0.5 rounded">
                    {item.sub_type}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {isAuthed && (
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleWishlist(uuid, wishlisted)}
                  className={`flex-1 py-2 rounded text-xs font-display uppercase tracking-wide border transition-all duration-150 flex items-center justify-center gap-2 ${
                    wishlisted
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'border-sc-border text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }`}
                >
                  {wishlisted ? <Bookmark className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  {wishlisted ? 'On Wishlist' : 'Add to Wishlist'}
                </button>
                <div className="flex-1 border border-sc-border rounded flex items-center justify-center gap-2 py-2">
                  {collectionQty === 0 ? (
                    <button
                      onClick={() => onSetCollectionQty(uuid, 1)}
                      className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wide text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Mark Collected
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onSetCollectionQty(uuid, collectionQty - 1)}
                        className="w-5 h-5 flex items-center justify-center rounded text-sc-accent hover:bg-sc-accent/20 transition-colors text-base leading-none"
                        title={collectionQty === 1 ? 'Remove from collection' : 'Decrease'}
                      >−</button>
                      <span className="text-sm font-mono text-sc-accent min-w-[20px] text-center">{collectionQty}</span>
                      <button
                        onClick={() => onSetCollectionQty(uuid, collectionQty + 1)}
                        className="w-5 h-5 flex items-center justify-center rounded text-sc-accent hover:bg-sc-accent/20 transition-colors"
                        title="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-display uppercase tracking-wide text-sc-accent/70">Collected</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Item stats from linked table */}
            {item.item_details && (() => {
              const det = item.item_details
              const hasDescription = !!det.description
              const hasType = det.type && det.type !== item.type
              const hasSubType = !!det.sub_type && det.sub_type !== 'UNDEFINED' && det.sub_type !== det.type
              const hasSlot = !!det.slot
              const hasSize = det.size != null
              const hasGrade = det.grade != null
              // Build stats from direct columns on det (no more JSON parsing)
              // Include "always show" stats for this category even when null (displayed as N/A)
              const alwaysShow = new Set(ALWAYS_SHOW_STATS[eCat] || [])
              const detWithDefaults = { ...det }
              for (const key of alwaysShow) {
                if (!(key in detWithDefaults)) detWithDefaults[key] = null
              }
              const statsEntries = Object.entries(detWithDefaults)
                .filter(([k, v]) => !STAT_HIDDEN.has(k) && (v != null || alwaysShow.has(k)) && STAT_LABELS[k] !== null && STAT_LABELS[k] !== undefined)
                .sort(([a], [b]) => {
                  const ai = STAT_ORDER.indexOf(a)
                  const bi = STAT_ORDER.indexOf(b)
                  if (ai === -1 && bi === -1) return a.localeCompare(b)
                  if (ai === -1) return 1
                  if (bi === -1) return -1
                  return ai - bi
                })
                .map(([k, v]) => {
                  const label = STAT_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  let display
                  if (v == null) {
                    display = 'N/A'
                  } else if (k === 'fire_modes') {
                    display = formatFireModes(typeof v === 'string' ? v.split(',').map(s => s.trim()) : v, det.burst_count)
                  } else if (Array.isArray(v)) {
                    display = v.join(', ')
                  } else if (RESISTANCE_STATS.has(k) && typeof v === 'number') {
                    display = `${Math.round((1 - v) * 100)}% reduction`
                  } else if (MULTIPLIER_STATS.has(k) && typeof v === 'number') {
                    display = `${Math.round(v * 100)}% of base`
                  } else if ((k === 'zoom_scale' || k === 'second_zoom_scale' || k === 'zoom_factor') && typeof v === 'number') {
                    display = `${v}x`
                  } else if (k === 'atmosphere_capacity' && typeof v === 'number') {
                    display = v > 0 ? 'Yes' : 'No'
                  } else if (k === 'blast_radius' && typeof v === 'number') {
                    display = `${v}m`
                  } else {
                    display = String(v)
                  }
                  return { k, label, display }
                })
                .filter(({ display }) => display)

              const effects = Array.isArray(det.effects) ? det.effects : []
              const hasEffects = effects.length > 0
              const hasStats = statsEntries.length > 0
              if (!hasDescription && !hasType && !hasSubType && !hasSlot && !hasSize && !hasGrade && !hasStats && !hasEffects) return null

              return (
                <div>
                  <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-2">Item Details</p>
                  <div className="space-y-1 text-xs font-mono">
                    {hasType && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">Type</span>
                        <span className="text-gray-300">{det.type}</span>
                      </div>
                    )}
                    {hasSubType && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">Sub Type</span>
                        <span className="text-gray-300">{det.sub_type}</span>
                      </div>
                    )}
                    {hasSlot && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">Slot</span>
                        <span className="text-gray-300">{det.slot}</span>
                      </div>
                    )}
                    {hasSize && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">Size</span>
                        <span className="text-gray-300">S{det.size}</span>
                      </div>
                    )}
                    {hasGrade && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">Grade</span>
                        <span className="text-gray-300">{det.grade}</span>
                      </div>
                    )}
                    {/* stat fields before description so RPM/fire modes group with structural info */}
                    {statsEntries.map(({ k, label, display }) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">{label}</span>
                        <span className="text-gray-300">{display}</span>
                      </div>
                    ))}
                    {hasEffects && effects.map((eff) => (
                      <div key={eff.effect_key} className="flex gap-2">
                        <span className="text-gray-500 w-32 shrink-0">
                          {eff.effect_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="text-gray-300">
                          {eff.magnitude != null ? eff.magnitude : ''}
                          {eff.magnitude != null && eff.duration_seconds != null ? ' · ' : ''}
                          {eff.duration_seconds != null ? `${eff.duration_seconds}s` : ''}
                          {eff.magnitude == null && eff.duration_seconds == null ? 'Active' : ''}
                        </span>
                      </div>
                    ))}
                    {hasDescription && (
                      <p className="text-gray-400 text-[11px] leading-relaxed whitespace-pre-wrap pt-1">
                        {decodeMojibake(det.description.replace(/\\n/g, '\n'))}
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Where to find — parse JSON directly (has_* flags not present in detail response) */}
            {(() => {
              const locationSections = [
                { label: 'Shops',      icon: ShoppingCart, type: 'shops',      data: parsedJson('shops_json') },
                { label: 'Containers', icon: Package,      type: 'containers', data: parsedJson('containers_json') },
                { label: 'NPCs',       icon: Swords,       type: 'npcs',       data: parsedJson('npcs_json') },
                { label: 'Corpses',    icon: Skull,        type: 'corpses',    data: parsedJson('corpses_json') },
                { label: 'Contracts',  icon: FileText,     type: 'contracts',  data: parsedJson('contracts_json') },
              ]
              const hasAny = locationSections.some(s => s.data.length > 0)
              return hasAny ? (
                <div>
                  <p className="text-[10px] font-display uppercase tracking-wider text-gray-500 mb-3">Where to Find</p>
                  <div className="space-y-4">
                    {locationSections.map(({ label, icon, data, type }) => (
                      <LocationSection key={label} label={label} icon={icon} data={data} type={type} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-mono">No location data available.</p>
              )
            })()}
          </div>
        )}
      </div>
    </>
  )
}
