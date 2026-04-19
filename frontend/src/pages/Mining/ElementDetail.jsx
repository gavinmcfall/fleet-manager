import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Gem, MapPin } from 'lucide-react'
import { useMining } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import QualityChart from './QualityChart'
import {
  cleanElementName, CATEGORY_STYLES, ELEMENT_STAT_LABELS, SYSTEM_COLORS,
  instabilityColor, instabilityBg, instabilityBarColor,
  humanizeLocationName, friendlyElementName, friendlyRockType, friendlyCompositionName,
} from './miningUtils'

export default function ElementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useMining()

  const element = useMemo(() => {
    if (!data?.elements) return null
    return data.elements.find(e => String(e.id) === id)
  }, [data, id])

  // Find all locations where this element appears via compositions → deposits → locations
  const locationData = useMemo(() => {
    if (!element || !data) return []
    const className = element.class_name?.toLowerCase()
    if (!className) return []

    // Find compositions containing this element
    const compIds = new Set()
    const compMap = new Map()
    for (const comp of (data.compositions || [])) {
      if (!comp.composition_json) continue
      try {
        const els = JSON.parse(comp.composition_json)
        const match = els.find(e => e.element?.toLowerCase() === className)
        if (match) {
          compIds.add(comp.uuid)
          compMap.set(comp.uuid, { ...comp, elementPct: match.maxPct || match.minPct || 0 })
        }
      } catch { /* skip */ }
    }

    // Find deposits referencing those compositions
    const locationMap = new Map()
    for (const dep of (data.deposits || [])) {
      if (!compIds.has(dep.composition_guid)) continue
      const loc = (data.locations || []).find(l => l.id === dep.mining_location_id)
      if (!loc) continue
      const comp = compMap.get(dep.composition_guid)
      const effectiveProb = (dep.group_probability || 1) * (dep.relative_probability || 1) * (comp?.elementPct || 0)
      const key = `${loc.id}-${dep.composition_guid}`
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          location: loc,
          composition: comp,
          probability: effectiveProb,
          deposit: dep,
        })
      }
    }

    return [...locationMap.values()].sort((a, b) => b.probability - a.probability)
  }, [element, data])

  // Find compositions containing this element
  const compositions = useMemo(() => {
    if (!element || !data) return []
    const className = element.class_name?.toLowerCase()
    if (!className) return []

    return (data.compositions || []).filter(comp => {
      if (!comp.composition_json) return false
      try {
        const els = JSON.parse(comp.composition_json)
        return els.some(e => e.element?.toLowerCase() === className)
      } catch { return false }
    })
  }, [element, data])

  if (loading) return <LoadingState fullScreen message="Loading mining data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!element) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Gem className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-300 mb-2">Element Not Found</h2>
        <button onClick={() => navigate('/mining?tab=ores')} className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">
          &larr; Back to Mining
        </button>
      </div>
    )
  }

  const cat = CATEGORY_STYLES[element.category] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  const instability = element.instability ?? null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/mining?tab=ores')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sc-accent transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Mining Guide
      </button>

      {/* Header */}
      <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 mb-8">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sc-accent/20 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sc-accent/20 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sc-accent/20 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sc-accent/20 rounded-br-2xl" />

        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${cat.bg} ${cat.text} border ${cat.border}`}>
            {element.category || 'element'}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white tracking-wide mb-4" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
          {cleanElementName(element.name)}
        </h1>

        {/* Instability bar */}
        <div className="max-w-xs space-y-1 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-gray-500">Instability</span>
            <span className={`font-mono font-semibold ${instabilityColor(instability)}`}>
              {instability != null ? instability.toFixed(0) : '--'}
            </span>
          </div>
          {instability != null && (
            <div className={`h-2 w-full rounded-full overflow-hidden ${instabilityBg(instability)}`}>
              <div className={`h-full rounded-full ${instabilityBarColor(instability)}`} style={{ width: `${Math.min(instability / 10, 100).toFixed(0)}%` }} />
            </div>
          )}
        </div>

        {/* All stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(ELEMENT_STAT_LABELS).map(([key, label]) => {
            if (key === 'instability') return null
            const val = element[key]
            if (val == null) return null
            return (
              <div key={key} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-mono text-gray-200">{val.toFixed(3)}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Where to find */}
      {locationData.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Where to Find ({locationData.length} locations)
          </h2>
          <div className="border border-white/[0.06] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Location</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">System</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Rock Type</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2.5">Effective Prob</th>
                </tr>
              </thead>
              <tbody>
                {locationData.map((entry, i) => {
                  const sys = SYSTEM_COLORS[entry.location.system] || {}
                  return (
                    <tr
                      key={i}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => navigate(`/mining/location/${entry.location.id}`)}
                    >
                      <td className="px-4 py-2 text-xs text-gray-300">{humanizeLocationName(entry.location.name)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${sys.bg || ''} ${sys.text || 'text-gray-400'} border ${sys.border || 'border-gray-600'}`}>
                          {entry.location.system}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{friendlyRockType(entry.composition?.rock_type)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400 text-right font-mono">
                        {(entry.probability * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Found in rocks */}
      {compositions.length > 0 && (
        <div>
          <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4">
            Found in Rocks ({compositions.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {compositions.map(comp => {
              let elPct = null
              try {
                const els = JSON.parse(comp.composition_json)
                const match = els.find(e => e.element?.toLowerCase() === element.class_name?.toLowerCase())
                if (match && typeof match.minPct === 'number' && typeof match.maxPct === 'number') {
                  elPct = { min: match.minPct, max: match.maxPct }
                }
              } catch { /* skip */ }

              return (
                <div key={comp.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium">{friendlyCompositionName(comp.name)}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {friendlyRockType(comp.rock_type)}
                    </span>
                  </div>
                  {elPct && (
                    <div className="mt-1 text-xs text-gray-500 font-mono">
                      {elPct.min.toFixed(1)}% – {elPct.max.toFixed(1)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
