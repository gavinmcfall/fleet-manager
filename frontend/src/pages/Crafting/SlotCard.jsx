import React, { useState, useMemo } from 'react'
import { Gem, ChevronDown, MapPin, Filter } from 'lucide-react'
import {
  resourceColor, resourceBgColor, resourceBorderColor,
  formatQuantity, quantityUnits,
  humanizeLocationName, qualityBandProbabilities, QUALITY_BANDS, ROCK_TIER_INFO,
} from './craftingUtils'

function QuantityBadge({ quantity }) {
  const units = quantityUnits(quantity)
  return (
    <span className="relative group/qty">
      <span className="text-xs text-gray-400 font-mono cursor-help border-b border-dashed border-gray-700">
        {formatQuantity(quantity)}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/qty:flex flex-col items-end gap-0.5 px-3 py-2 rounded-lg bg-gray-900/95 border border-white/[0.08] shadow-xl shadow-black/40 backdrop-blur-sm z-10 whitespace-nowrap">
        {units.map(({ value, unit }) => (
          <span key={unit} className="flex items-center gap-2 text-xs">
            <span className="text-gray-200 font-mono font-medium">{value}</span>
            <span className="text-gray-500">{unit}</span>
          </span>
        ))}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/95 border-b border-r border-white/[0.08] rotate-45" />
      </span>
    </span>
  )
}

// Color a probability cell — higher = greener
function probCell(p) {
  if (p <= 0) return 'text-gray-700'
  if (p < 0.05) return 'text-gray-600'
  if (p < 0.15) return 'text-gray-400'
  if (p < 0.30) return 'text-emerald-500/70'
  if (p < 0.50) return 'text-emerald-400'
  return 'text-emerald-300 font-medium'
}

function QualityBandRow({ bands }) {
  if (!bands) return <span className="text-xs text-gray-600 italic">No quality data</span>
  return (
    <div className="flex gap-1">
      {bands.map((b, i) => (
        <div key={i} className="flex-1 text-center">
          <span className={`text-xs font-mono ${probCell(b.probability)}`}>
            {b.probability > 0 ? `${(b.probability * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

const TIER_OPTIONS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const SYSTEM_OPTIONS = ['Stanton', 'Pyro', 'Nyx']

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer ${
        active
          ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30'
          : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function ResourceLocations({ locations }) {
  const [open, setOpen] = useState(false)
  const [systemFilter, setSystemFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [qualityBandFilter, setQualityBandFilter] = useState(-1) // -1 = no filter, 0-4 = band index

  // Filter locations
  const filteredLocations = useMemo(() => {
    let locs = locations
    if (systemFilter) locs = locs.filter(l => l.system === systemFilter)
    if (tierFilter) locs = locs.filter(l => l.rock_tier === tierFilter)
    if (qualityBandFilter >= 0) {
      locs = locs.filter(l => {
        const bands = qualityBandProbabilities(l.quality)
        if (!bands) return false
        return bands[qualityBandFilter].probability > 0.05
      })
    }
    return locs
  }, [locations, systemFilter, tierFilter, qualityBandFilter])

  // Group by system, sort by tier rarity
  const grouped = useMemo(() => {
    const bySystem = {}
    for (const loc of filteredLocations) {
      if (!bySystem[loc.system]) bySystem[loc.system] = []
      bySystem[loc.system].push(loc)
    }
    const tierOrder = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 }
    for (const sys of Object.keys(bySystem)) {
      bySystem[sys].sort((a, b) => {
        const td = (tierOrder[a.rock_tier] ?? 5) - (tierOrder[b.rock_tier] ?? 5)
        if (td !== 0) return td
        return a.location.localeCompare(b.location)
      })
    }
    return Object.entries(bySystem).sort(([a], [b]) => {
      if (a === 'Stanton') return -1
      if (b === 'Stanton') return 1
      return a.localeCompare(b)
    })
  }, [filteredLocations])

  const totalLocations = locations.length
  const hasFilters = systemFilter || tierFilter || qualityBandFilter >= 0

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
      >
        <MapPin className="w-3 h-3" />
        <span>{totalLocations} mining {totalLocations === 1 ? 'location' : 'locations'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-3 animate-fade-in">
          {/* Filters */}
          <div className="space-y-2 px-2">
            {/* System filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3 h-3 text-gray-600" />
              <FilterPill label="All Systems" active={!systemFilter} onClick={() => setSystemFilter('')} />
              {SYSTEM_OPTIONS.map(sys => (
                <FilterPill key={sys} label={sys} active={systemFilter === sys} onClick={() => setSystemFilter(systemFilter === sys ? '' : sys)} />
              ))}
            </div>
            {/* Tier filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-3" />
              <FilterPill label="All Tiers" active={!tierFilter} onClick={() => setTierFilter('')} />
              {TIER_OPTIONS.map(tier => (
                <FilterPill key={tier} label={tier} active={tierFilter === tier} onClick={() => setTierFilter(tierFilter === tier ? '' : tier)} />
              ))}
            </div>
            {/* Quality band filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-3" />
              <FilterPill label="Any Quality" active={qualityBandFilter < 0} onClick={() => setQualityBandFilter(-1)} />
              {QUALITY_BANDS.map((b, i) => (
                <FilterPill key={i} label={`Q${b.label}`} active={qualityBandFilter === i} onClick={() => setQualityBandFilter(qualityBandFilter === i ? -1 : i)} />
              ))}
            </div>
            {hasFilters && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-gray-500">{filteredLocations.length} of {totalLocations} locations</span>
                <button onClick={() => { setSystemFilter(''); setTierFilter(''); setQualityBandFilter(-1) }} className="text-sc-accent hover:text-sc-accent/80 transition-colors cursor-pointer">
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Quality band header */}
          <div className="flex items-end gap-2 pl-2">
            <div className="w-40 shrink-0" />
            <div className="w-20 shrink-0" />
            <div className="flex-1 flex gap-1">
              {QUALITY_BANDS.map((b, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[10px] text-gray-600 font-mono">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-600">No locations match filters.</div>
          ) : (
            grouped.map(([system, locs]) => (
              <div key={system}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-1 px-2">
                  {system}
                </div>
                <div className="space-y-0.5">
                  {locs.map((loc, i) => {
                    const tier = ROCK_TIER_INFO[loc.rock_tier] || ROCK_TIER_INFO.Common
                    const bands = qualityBandProbabilities(loc.quality)
                    return (
                      <div key={`${loc.location}-${loc.rock_tier}-${i}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.02]">
                        <div className="w-40 shrink-0 truncate text-xs text-gray-300" title={loc.location}>
                          {humanizeLocationName(loc.location)}
                        </div>
                        <div className="w-20 shrink-0">
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${tier.bg} ${tier.color} ${tier.border} border`}>
                            {tier.label}
                          </span>
                        </div>
                        <div className="flex-1">
                          <QualityBandRow bands={bands} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function SlotCard({ slot, index = 0, resourceLocations }) {
  const locations = resourceLocations?.[slot.resource_name]

  return (
    <div
      className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.05] rounded-lg p-4 animate-stagger-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-200">{slot.name}</h4>
          {slot.min_quality > 0 && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              min Q{slot.min_quality}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: resourceBgColor(slot.resource_name),
              borderColor: resourceBorderColor(slot.resource_name),
              color: resourceColor(slot.resource_name),
            }}
          >
            <Gem className="w-3 h-3" />
            {slot.resource_name}
          </span>
          <QuantityBadge quantity={slot.quantity} />
        </div>
      </div>
      {locations && locations.length > 0 && (
        <ResourceLocations locations={locations} />
      )}
    </div>
  )
}
