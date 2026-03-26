import React, { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FlaskConical, Search, SlidersHorizontal, ChevronRight, Clock, Layers, Crosshair, Zap, Target } from 'lucide-react'
import { useCrafting } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import QualitySim from './QualitySim'
import { TYPE_LABELS, SUBTYPE_LABELS, TYPE_COLORS, TYPE_ORDER, formatTime, resourceColor } from './craftingUtils'

// Step indicators
function StepIndicator({ step, currentStep, label }) {
  const isActive = currentStep === step
  const isDone = currentStep > step
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        isActive ? 'bg-sc-accent text-sc-darker shadow-[0_0_12px_rgba(34,211,238,0.4)]'
        : isDone ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30'
        : 'bg-white/[0.04] text-gray-600 border border-white/[0.06]'
      }`}>
        {isDone ? '✓' : step}
      </div>
      <span className={`text-xs font-display uppercase tracking-wider ${
        isActive ? 'text-sc-accent' : isDone ? 'text-gray-400' : 'text-gray-600'
      }`}>{label}</span>
    </div>
  )
}

// Blueprint selection card (compact)
function BlueprintOption({ bp, onSelect }) {
  const typeColor = TYPE_COLORS[bp.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  const resources = [...new Set((bp.slots || []).map(s => s.resource_name))]

  return (
    <button
      onClick={() => onSelect(bp)}
      className="w-full text-left bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-sc-accent/30 rounded-lg p-3 transition-all duration-200 group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${typeColor.bg} ${typeColor.text} border ${typeColor.border}`}>
              {TYPE_LABELS[bp.type] || bp.type}
            </span>
            <span className="text-[10px] text-gray-600">
              {SUBTYPE_LABELS[bp.sub_type] || bp.sub_type}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">
            {bp.base_stats?.item_name || bp.name}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(bp.craft_time_seconds)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {bp.slots?.length || 0} slots
            </span>
            {bp.base_stats?.dps && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3 text-sc-accent" />
                {bp.base_stats.dps} DPS
              </span>
            )}
          </div>
          {resources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {resources.map(r => (
                <span key={r} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/[0.04] border border-white/[0.06]"
                  style={{ color: resourceColor(r) }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-sc-accent transition-colors mt-1 shrink-0" />
      </div>
    </button>
  )
}

export default function QualitySimPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useCrafting()

  const selectedType = searchParams.get('type') || null
  const selectedId = searchParams.get('bp') || null
  const searchQuery = searchParams.get('q') || ''

  const setParam = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  // Derived state
  const blueprints = data?.blueprints || []

  const selectedBlueprint = useMemo(() => {
    if (!selectedId) return null
    return blueprints.find(b => String(b.id) === selectedId) || null
  }, [blueprints, selectedId])

  // Current step
  const currentStep = selectedBlueprint ? 3 : selectedType ? 2 : 1

  // Available types
  const types = useMemo(() => {
    const counts = {}
    for (const bp of blueprints) {
      counts[bp.type] = (counts[bp.type] || 0) + 1
    }
    return TYPE_ORDER.filter(t => counts[t]).map(t => ({
      key: t,
      label: TYPE_LABELS[t] || t,
      count: counts[t],
      color: TYPE_COLORS[t] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
    }))
  }, [blueprints])

  // Filtered blueprints
  const filtered = useMemo(() => {
    let result = blueprints
    if (selectedType) result = result.filter(b => b.type === selectedType)
    if (searchQuery) {
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(bp => {
        const name = (bp.base_stats?.item_name || bp.name || '').toLowerCase()
        const subType = (bp.sub_type || '').toLowerCase()
        return tokens.every(t => name.includes(t) || subType.includes(t))
      })
    }
    // Only show blueprints that have slots with modifiers (simulatable)
    result = result.filter(bp => bp.slots?.some(s => s.modifiers?.length > 0))
    return result
  }, [blueprints, selectedType, searchQuery])

  // Subtypes within current type filter
  const subtypes = useMemo(() => {
    if (!selectedType) return []
    const counts = {}
    for (const bp of filtered) {
      const st = bp.sub_type || 'other'
      counts[st] = (counts[st] || 0) + 1
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({ key, label: SUBTYPE_LABELS[key] || key, count }))
  }, [filtered, selectedType])

  if (loading) return <LoadingState fullScreen message="Loading crafting data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quality Simulator"
        subtitle="Preview how material quality affects crafted item stats"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-6 px-1">
        <StepIndicator step={1} currentStep={currentStep} label="Type" />
        <div className="h-px w-8 bg-white/[0.08]" />
        <StepIndicator step={2} currentStep={currentStep} label="Blueprint" />
        <div className="h-px w-8 bg-white/[0.08]" />
        <StepIndicator step={3} currentStep={currentStep} label="Simulate" />
      </div>

      {/* Step 1: Type selection */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {types.map(t => (
            <button
              key={t.key}
              onClick={() => setParam('type', t.key)}
              className={`relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-sc-accent/30 rounded-xl p-5 transition-all duration-200 text-left group cursor-pointer overflow-hidden`}
            >
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/15 rounded-tl-xl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/15 rounded-br-xl" />
              <div className="flex items-center gap-3 mb-2">
                <FlaskConical className={`w-5 h-5 ${t.color.text}`} />
                <span className="text-lg font-bold text-white group-hover:text-sc-accent transition-colors">
                  {t.label}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {t.count} simulatable blueprint{t.count !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Blueprint search & selection */}
      {currentStep === 2 && (
        <div>
          {/* Breadcrumb / back */}
          <button
            onClick={() => { setParam('type', null); setParam('q', null) }}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-sc-accent transition-colors mb-4"
          >
            &larr; Change type
          </button>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={`Search ${TYPE_LABELS[selectedType] || ''} blueprints...`}
              value={searchQuery}
              onChange={e => setParam('q', e.target.value || null)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sc-accent/40 focus:ring-1 focus:ring-sc-accent/20 transition-all"
            />
          </div>

          {/* Subtype pills */}
          {subtypes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {subtypes.map(st => (
                <button
                  key={st.key}
                  onClick={() => setParam('q', searchQuery === st.key ? null : st.key)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    searchQuery === st.key
                      ? 'bg-sc-accent/15 text-sc-accent border border-sc-accent/30'
                      : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'
                  }`}
                >
                  {st.label} ({st.count})
                </button>
              ))}
            </div>
          )}

          {/* Blueprint list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.slice(0, 50).map(bp => (
              <BlueprintOption key={bp.id} bp={bp} onSelect={() => setParam('bp', String(bp.id))} />
            ))}
          </div>
          {filtered.length > 50 && (
            <p className="text-xs text-gray-600 text-center mt-3">
              Showing 50 of {filtered.length} — refine your search
            </p>
          )}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 text-gray-600" />
              <p className="text-sm">No simulatable blueprints found.</p>
              <p className="text-xs text-gray-600 mt-1">Only blueprints with quality modifiers can be simulated.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: The sim */}
      {currentStep === 3 && selectedBlueprint && (
        <div>
          {/* Breadcrumb / back */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => { setParam('type', null); setParam('bp', null); setParam('q', null) }}
              className="text-xs text-gray-500 hover:text-sc-accent transition-colors"
            >
              Types
            </button>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <button
              onClick={() => setParam('bp', null)}
              className="text-xs text-gray-500 hover:text-sc-accent transition-colors"
            >
              {TYPE_LABELS[selectedBlueprint.type] || selectedBlueprint.type}
            </button>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <span className="text-xs text-gray-300">{selectedBlueprint.base_stats?.item_name || selectedBlueprint.name}</span>
          </div>

          {/* Blueprint header (compact) */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const tc = TYPE_COLORS[selectedBlueprint.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${tc.bg} ${tc.text} border ${tc.border}`}>
                        {TYPE_LABELS[selectedBlueprint.type] || selectedBlueprint.type}
                      </span>
                    )
                  })()}
                  <span className="text-[10px] text-gray-600">
                    {SUBTYPE_LABELS[selectedBlueprint.sub_type] || selectedBlueprint.sub_type}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  {selectedBlueprint.base_stats?.item_name || selectedBlueprint.name}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(selectedBlueprint.craft_time_seconds)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {selectedBlueprint.slots?.length || 0} slots
                  </span>
                  {selectedBlueprint.base_stats?.dps && (
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-sc-accent" /> {selectedBlueprint.base_stats.dps} DPS
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/crafting/${selectedBlueprint.id}`)}
                className="text-[10px] text-gray-500 hover:text-sc-accent transition-colors whitespace-nowrap"
              >
                Full details &rarr;
              </button>
            </div>
          </div>

          {/* Quality Sim */}
          <QualitySim blueprint={selectedBlueprint} />
        </div>
      )}
    </div>
  )
}
