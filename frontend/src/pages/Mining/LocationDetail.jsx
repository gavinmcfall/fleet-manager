import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { useMining } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import QualityChart from './QualityChart'
import { humanizeLocationName, SYSTEM_COLORS, LOCATION_TYPE_COLORS, friendlyElementName, cleanDepositName, extractDepositTier, ROCK_TIER_INFO } from './miningUtils'

export default function LocationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useMining()

  const location = useMemo(() => {
    if (!data?.locations) return null
    return data.locations.find(l => String(l.id) === id)
  }, [data, id])

  // Get deposits for this location — filter out plant/salvage entries
  const deposits = useMemo(() => {
    if (!location || !data?.deposits) return []
    return data.deposits
      .filter(d => d.mining_location_id === location.id)
      .filter(d => {
        const guid = d.composition_guid || ''
        return !guid.startsWith('plant_') && !guid.startsWith('salvage_') && guid !== ''
      })
  }, [location, data])

  // Group deposits by group_name
  const depositGroups = useMemo(() => {
    const groups = new Map()
    for (const dep of deposits) {
      if (!groups.has(dep.group_name)) {
        groups.set(dep.group_name, { probability: dep.group_probability, deposits: [] })
      }
      groups.get(dep.group_name).deposits.push(dep)
    }
    return [...groups.entries()].sort((a, b) => b[1].probability - a[1].probability)
  }, [deposits])

  // Find quality distribution for this location's system
  const qualityDist = useMemo(() => {
    if (!location || !data?.quality_distributions) return null
    // Match by system name in the distribution name
    return data.quality_distributions.find(q =>
      q.name.toLowerCase().includes(location.system.toLowerCase())
    ) || data.quality_distributions[0] || null
  }, [location, data])

  // Find clustering preset used by deposits here
  const clusteringPreset = useMemo(() => {
    if (!data?.clustering_presets || deposits.length === 0) return null
    const firstGuid = deposits[0].clustering_preset_guid
    if (!firstGuid) return null
    return data.clustering_presets.find(p => p.uuid === firstGuid)
  }, [deposits, data])

  // Compute recommended lasers based on resistance range at this location
  const laserRecommendations = useMemo(() => {
    if (!data?.lasers || !data?.elements || deposits.length === 0) return []

    // Find all elements at this location and their resistance values
    const resistances = new Set()
    for (const dep of deposits) {
      if (!dep.composition_json) continue
      try {
        const els = JSON.parse(dep.composition_json)
        for (const el of els) {
          const element = data.elements.find(e =>
            e.class_name?.toLowerCase() === el.element?.toLowerCase()
          )
          if (element?.resistance != null) resistances.add(element.resistance)
        }
      } catch { /* skip */ }
    }
    const maxResistance = Math.max(...resistances, 0)

    return data.lasers.filter(l => l.beam_dps > maxResistance * 0.8)
      .sort((a, b) => a.size - b.size || b.beam_dps - a.beam_dps)
      .slice(0, 5)
  }, [data, deposits])

  if (loading) return <LoadingState fullScreen message="Loading mining data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!location) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-300 mb-2">Location Not Found</h2>
        <button onClick={() => navigate('/mining?tab=locations')} className="text-sm text-sc-accent hover:text-sc-accent/80 transition-colors">
          &larr; Back to Mining
        </button>
      </div>
    )
  }

  const sys = SYSTEM_COLORS[location.system] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  const locType = LOCATION_TYPE_COLORS[location.location_type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/mining?tab=locations')}
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
          <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${sys.bg} ${sys.text} border ${sys.border}`}>
            {location.system}
          </span>
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${locType.bg} ${locType.text} border ${locType.border}`}>
            {location.location_type}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white tracking-wide mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
          {humanizeLocationName(location.name)}
        </h1>
        <p className="text-sm text-gray-500">{deposits.length} deposits</p>
      </div>

      {/* Quality Distribution */}
      {qualityDist && (
        <div className="mb-8">
          <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4">Quality Distribution</h2>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
            <QualityChart quality={qualityDist} />
            <div className="mt-3 flex gap-4 text-xs text-gray-500 font-mono">
              <span>Mean: {qualityDist.mean?.toFixed(0)}</span>
              <span>Std Dev: {qualityDist.stddev?.toFixed(0)}</span>
              <span>Range: {qualityDist.min_quality}–{qualityDist.max_quality}</span>
            </div>
          </div>
        </div>
      )}

      {/* Deposits */}
      <div className="mb-8">
        <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4">
          Deposits ({deposits.length})
        </h2>
        {depositGroups.map(([groupName, group]) => (
          <div key={groupName} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-300">{groupName}</span>
              <span className="text-[10px] text-gray-600 font-mono">
                {(group.probability * 100).toFixed(0)}% group chance
              </span>
            </div>
            <div className="border border-white/[0.06] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2">Resource</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2">Tier</th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-gray-500 font-medium px-4 py-2">Chance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalWeight = group.deposits.reduce((sum, d) => sum + (d.relative_probability || 0), 0)
                    return group.deposits.map((dep, i) => {
                      const name = dep.composition_name || cleanDepositName(dep.composition_guid)
                      const tier = extractDepositTier(dep.composition_guid)
                      const tierInfo = tier ? (ROCK_TIER_INFO[tier] || null) : null
                      const normalizedPct = totalWeight > 0 ? (dep.relative_probability / totalWeight * 100) : 0

                      return (
                        <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                          <td className="px-4 py-2 text-xs text-gray-300">{name}</td>
                          <td className="px-4 py-2">
                            {tierInfo ? (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierInfo.bg} ${tierInfo.color} ${tierInfo.border} border`}>
                                {tier}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-400 text-right font-mono">
                            {normalizedPct.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Clustering info */}
      {clusteringPreset && (
        <div className="mb-8">
          <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4">Clustering</h2>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-300">{clusteringPreset.name}</span>
              <span className="text-xs text-gray-500 font-mono">
                {(clusteringPreset.probability_of_clustering * 100).toFixed(0)}% clustering chance
              </span>
            </div>
            {clusteringPreset.params?.length > 0 && (
              <div className="space-y-1">
                {clusteringPreset.params.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 text-xs text-gray-400 font-mono">
                    <span>Size: {p.min_size}–{p.max_size}</span>
                    <span>Proximity: {p.min_proximity?.toFixed(0)}–{p.max_proximity?.toFixed(0)}m</span>
                    <span className="text-gray-600">{(p.relative_probability * 100).toFixed(0)}% chance</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment recommendations */}
      {laserRecommendations.length > 0 && (
        <div>
          <h2 className="text-sm font-display uppercase tracking-wider text-gray-400 mb-4">
            Recommended Lasers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {laserRecommendations.map(laser => (
              <button
                key={laser.id}
                onClick={() => navigate(`/mining/laser/${laser.id}`)}
                className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 text-left hover:border-sc-accent/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 font-medium">{laser.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">S{laser.size}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono mt-1 block">
                  {laser.beam_dps?.toFixed(1)} DPS · {laser.module_slots} slots
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
