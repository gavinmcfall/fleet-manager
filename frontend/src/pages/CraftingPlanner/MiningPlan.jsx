import React, { useMemo } from 'react'
import { MapPin, Wrench, AlertTriangle, Zap, Shield } from 'lucide-react'
import EquipmentCard from './EquipmentCard'
import {
  scoreLocationForResource, getTopEquipment, parseComposition,
  cleanElementName, friendlyElementName,
} from './plannerHelpers'

function DifficultyBadge({ label, value, icon: Icon, thresholds, format }) {
  if (value == null) return null
  const color = value >= thresholds[1] ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : value >= thresholds[0] ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  const display = format === 'pct' ? `${(value * 100).toFixed(0)}%` : String(Math.round(value))
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}: {display}
    </span>
  )
}

function CompositionMiniBar({ composition }) {
  const elements = parseComposition(composition?.composition_json)
  if (elements.length === 0) return null

  const total = elements.reduce((s, el) => s + ((el.maxPct ?? 0) + (el.minPct ?? 0)) / 2, 0)
  if (total === 0) return null

  const COLORS = [
    'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
    'bg-red-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-500',
  ]

  return (
    <div className="space-y-1">
      <div className="h-1.5 flex rounded-full overflow-hidden bg-gray-700">
        {elements.map((el, i) => {
          const avgPct = ((el.maxPct ?? 0) + (el.minPct ?? 0)) / 2
          const widthPct = (avgPct / total) * 100
          if (widthPct < 1) return null
          return (
            <div
              key={el.element || i}
              className={`h-full ${COLORS[i % COLORS.length]}`}
              style={{ width: `${widthPct}%` }}
              title={`${friendlyElementName(el.element)}: ${(avgPct * 100).toFixed(1)}%`}
            />
          )
        })}
      </div>
    </div>
  )
}

function LocationRow({ location, score, compositions, isSelected, onSelect, resourceElementMap, resourceName }) {
  const elementClassName = resourceElementMap?.[resourceName]

  // Find the resource concentration in this location's deposits
  const concentration = useMemo(() => {
    for (const deposit of (location.deposits || [])) {
      const comp = compositions.find(c => c.id === deposit.rock_composition_id)
      if (!comp) continue
      const elements = parseComposition(comp.composition_json)
      const match = elements.find(el =>
        el.element && el.element.toLowerCase() === elementClassName?.toLowerCase()
      )
      if (match) {
        return {
          avgPct: ((match.minPct ?? 0) + (match.maxPct ?? 0)) / 2,
          probability: (deposit.group_probability ?? 1) * (deposit.relative_probability ?? 1),
          compositionName: comp.name,
        }
      }
    }
    return null
  }, [location, compositions, elementClassName])

  return (
    <button
      onClick={() => onSelect(location.id)}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/40 hover:border-gray-600/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-gray-500'}`} />
          <span className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-100' : 'text-gray-200'}`}>
            {location.name}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-500 shrink-0">{location.system}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500 ml-5.5">
        <span className="capitalize">{location.location_type}</span>
        {concentration && (
          <>
            <span className="text-gray-700">&middot;</span>
            <span className="text-cyan-400">{concentration.avgPct.toFixed(1)}% avg</span>
            <span className="text-gray-700">&middot;</span>
            <span>{(concentration.probability * 100).toFixed(0)}% chance</span>
          </>
        )}
      </div>
    </button>
  )
}

export default function MiningPlan({
  resourceName,
  locations,
  compositions,
  elements,
  equipment,
  resourceElementMap,
  selectedLocationId,
  onSelectLocation,
}) {
  // Find the element for this resource
  const elementClassName = resourceElementMap?.[resourceName]
  const element = useMemo(() => {
    if (!elementClassName) return null
    return elements.find(e =>
      (e.class_name || '').toLowerCase() === elementClassName.toLowerCase()
    ) || null
  }, [elements, elementClassName])

  // Score and sort locations
  const rankedLocations = useMemo(() => {
    return locations
      .map(loc => ({
        ...loc,
        score: scoreLocationForResource(loc, resourceName, resourceElementMap, compositions),
      }))
      .filter(loc => loc.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [locations, resourceName, resourceElementMap, compositions])

  // Score equipment
  const scoredEquipment = useMemo(() => {
    return getTopEquipment(equipment, element)
  }, [equipment, element])

  if (!elementClassName) {
    return (
      <div className="space-y-4">
        <StageHeader />
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No mineable source found for <span className="text-cyan-300">{resourceName}</span>.</p>
          <p className="text-xs mt-1">This resource may not have a mining source in the current version.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StageHeader />

      {/* Element difficulty header */}
      {element && (
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-sm font-medium text-gray-300">
            {cleanElementName(element.name)}
          </span>
          <DifficultyBadge label="Instability" value={element.instability} icon={Zap} thresholds={[300, 600]} />
          <DifficultyBadge label="Resistance" value={element.resistance} icon={Shield} thresholds={[0.3, 0.6]} format="pct" />
          {element.explosion_multiplier > 0 && (
            <DifficultyBadge label="Explosion" value={element.explosion_multiplier} icon={AlertTriangle} thresholds={[50, 200]} />
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Where to Mine */}
        <div className="space-y-2">
          <h4 className="text-xs font-display uppercase tracking-wider text-gray-500 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            Where to Mine
            <span className="font-mono text-gray-600">({rankedLocations.length})</span>
          </h4>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {rankedLocations.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No locations contain this resource.</p>
            ) : (
              rankedLocations.map(loc => (
                <LocationRow
                  key={loc.id}
                  location={loc}
                  score={loc.score}
                  compositions={compositions}
                  isSelected={selectedLocationId === loc.id}
                  onSelect={onSelectLocation}
                  resourceElementMap={resourceElementMap}
                  resourceName={resourceName}
                />
              ))
            )}
          </div>
        </div>

        {/* What to Bring */}
        <div className="space-y-2">
          <h4 className="text-xs font-display uppercase tracking-wider text-gray-500 flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" />
            What to Bring
          </h4>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {/* Top lasers */}
            {scoredEquipment.lasers.length > 0 && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-gray-600 mb-1.5">Lasers</p>
                <div className="space-y-1.5">
                  {scoredEquipment.lasers.slice(0, 3).map(item => (
                    <EquipmentCard key={item.id} item={item} isTop={item === scoredEquipment.lasers[0]} />
                  ))}
                </div>
              </div>
            )}

            {/* Top modules */}
            {scoredEquipment.modules.length > 0 && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-gray-600 mb-1.5">Modules</p>
                <div className="space-y-1.5">
                  {scoredEquipment.modules.slice(0, 5).map(item => (
                    <EquipmentCard key={item.id} item={item} isTop={item === scoredEquipment.modules[0]} />
                  ))}
                </div>
              </div>
            )}

            {/* Top gadgets */}
            {scoredEquipment.gadgets.length > 0 && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-wider text-gray-600 mb-1.5">Gadgets</p>
                <div className="space-y-1.5">
                  {scoredEquipment.gadgets.slice(0, 2).map(item => (
                    <EquipmentCard key={item.id} item={item} isTop={item === scoredEquipment.gadgets[0]} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StageHeader() {
  return (
    <>
      <div className="flex justify-center">
        <div className="w-px h-6 bg-gradient-to-b from-cyan-500/40 to-cyan-500/10" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-sm font-bold shrink-0">3</div>
        <div>
          <h3 className="font-display font-bold text-white tracking-wide text-sm uppercase">Mining Plan</h3>
          <p className="text-xs font-mono text-gray-500">Best locations and equipment for this resource</p>
        </div>
      </div>
    </>
  )
}
