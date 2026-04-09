import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { useCrafting } from '../../../hooks/useAPI'
import LoadingState from '../../../components/LoadingState'
import ErrorState from '../../../components/ErrorState'
import ViewToggle from '../../../components/ViewToggle'
import TypeSwitcher from './TypeSwitcher'
import BlueprintCard from './BlueprintCard'
import BlueprintListView from './BlueprintListView'
import CompareTray from './CompareTray'
import useCompareTray from './useCompareTray'

const VIEW_STORAGE_KEY = 'blueprintView'
const TYPE_STORAGE_KEY = 'blueprintType'

function readStoredView() {
  const v = typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_STORAGE_KEY)
  return v === 'list' ? 'list' : 'grid'
}

function readStoredType() {
  const t = typeof localStorage !== 'undefined' && localStorage.getItem(TYPE_STORAGE_KEY)
  return ['weapons', 'armour', 'ammo'].includes(t) ? t : 'weapons'
}

/**
 * Crafting v2 — design language foundation.
 *
 * Wires:
 *   - useCrafting() data hook (unchanged from v1)
 *   - TypeSwitcher (required — one type always active)
 *   - ViewToggle (grid / list)
 *   - BlueprintCard (grid) or BlueprintListView (list)
 *   - CompareTray (bottom-anchored drawer)
 *
 * View mode and active type both persist to localStorage so navigation
 * back to the page restores the user's last state.
 */
export default function CraftingV2() {
  const { data, loading, error, refetch } = useCrafting()
  const navigate = useNavigate()

  const [view, setView] = useState(readStoredView)
  const [activeType, setActiveType] = useState(readStoredType)
  const compare = useCompareTray()

  useEffect(() => { localStorage.setItem(VIEW_STORAGE_KEY, view) }, [view])
  useEffect(() => { localStorage.setItem(TYPE_STORAGE_KEY, activeType) }, [activeType])

  // Filter blueprints by the active type
  const blueprints = useMemo(() => {
    if (!data?.blueprints) return []
    return data.blueprints.filter(bp => bp.type === activeType)
  }, [data, activeType])

  const handleQualitySim = (bp) => navigate(`/crafting/${bp.id}?tab=quality`)
  const handleFavorite = () => {
    // Deferred by design (spec §12 out-of-scope): persisting favorites
    // requires new backend user-settings fields, which are explicitly
    // not part of this sub-project. Intentionally a no-op here so the
    // button still gets a click handler and doesn't throw.
  }

  if (loading) return <LoadingState fullScreen message="Loading crafting blueprints..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Hero */}
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[rgba(34,211,238,0.6)] mb-2">
          Star Citizen · Crafting Blueprints · v2
        </p>
        <h1
          className="text-[30px] font-bold text-white tracking-wide"
          style={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.2)' }}
        >
          Blueprints
        </h1>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <TypeSwitcher activeType={activeType} onChange={setActiveType} />
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Grid or list */}
      {blueprints.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-[var(--text-subtle)]" />
          <p className="text-[var(--text-muted)]">No blueprints for this type.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {blueprints.map(bp => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              isInCompare={compare.isInTray(bp)}
              onFavorite={handleFavorite}
              onQualitySim={handleQualitySim}
              onCompare={compare.toggle}
            />
          ))}
        </div>
      ) : (
        <BlueprintListView
          blueprints={blueprints}
          activeType={activeType}
          compareItems={compare.items}
          onFavorite={handleFavorite}
          onQualitySim={handleQualitySim}
          onCompare={compare.toggle}
        />
      )}

      <CompareTray
        items={compare.items}
        onRemove={compare.remove}
        onClear={compare.clear}
      />
    </div>
  )
}
