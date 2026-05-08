import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { useCrafting, useUserBlueprints, setBlueprintState } from '../../../hooks/useAPI'
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
 * Crafting v2 — Owned + Wishlist tracking added.
 *
 * State sources:
 *   - useCrafting() → all blueprints + slots + base stats
 *   - useUserBlueprints() → which blueprints the current user marks owned/wished
 *
 * Owned/wishlist edits go through setBlueprintState (PUT /api/blueprints/state).
 * We optimistically update local sets so the card responds instantly, then
 * refetch to settle on server truth (covers the case where the server
 * deletes a row when both flags drop to false).
 */
export default function CraftingV2() {
  const { data, loading, error, refetch } = useCrafting()
  const userBp = useUserBlueprints()
  const navigate = useNavigate()

  const [view, setView] = useState(readStoredView)
  const [activeType, setActiveType] = useState(readStoredType)
  const compare = useCompareTray()

  useEffect(() => { localStorage.setItem(VIEW_STORAGE_KEY, view) }, [view])
  useEffect(() => { localStorage.setItem(TYPE_STORAGE_KEY, activeType) }, [activeType])

  // Build sets of owned/wishlist UUIDs for O(1) card lookup. Local
  // optimistic overlays apply on top of server truth.
  const [ownedOverlay, setOwnedOverlay] = useState({})    // uuid → bool
  const [wishlistOverlay, setWishlistOverlay] = useState({})

  const ownedSet = useMemo(() => {
    const s = new Set()
    for (const item of userBp.data?.items || []) {
      if (item.is_owned && item.blueprint_uuid) s.add(item.blueprint_uuid)
    }
    for (const [uuid, val] of Object.entries(ownedOverlay)) {
      if (val) s.add(uuid); else s.delete(uuid)
    }
    return s
  }, [userBp.data, ownedOverlay])

  const wishlistSet = useMemo(() => {
    const s = new Set()
    for (const item of userBp.data?.items || []) {
      if (item.is_wishlist && item.blueprint_uuid) s.add(item.blueprint_uuid)
    }
    for (const [uuid, val] of Object.entries(wishlistOverlay)) {
      if (val) s.add(uuid); else s.delete(uuid)
    }
    return s
  }, [userBp.data, wishlistOverlay])

  const blueprints = useMemo(() => {
    if (!data?.blueprints) return []
    return data.blueprints.filter(bp => bp.type === activeType)
  }, [data, activeType])

  const handleQualitySim = (bp) => navigate(`/crafting/${bp.id}?tab=quality`)

  const toggleState = useCallback(async (bp, field) => {
    const uuid = bp.uuid
    if (!uuid) return
    const currentlyOn =
      field === 'owned' ? ownedSet.has(uuid) : wishlistSet.has(uuid)
    const next = !currentlyOn

    // Optimistic update
    if (field === 'owned') {
      setOwnedOverlay(prev => ({ ...prev, [uuid]: next }))
    } else {
      setWishlistOverlay(prev => ({ ...prev, [uuid]: next }))
    }

    try {
      await setBlueprintState({ blueprintUuid: uuid, [field]: next })
      // Refetch to clear overlay and pick up server truth.
      await userBp.refetch?.()
      if (field === 'owned') {
        setOwnedOverlay(prev => { const n = { ...prev }; delete n[uuid]; return n })
      } else {
        setWishlistOverlay(prev => { const n = { ...prev }; delete n[uuid]; return n })
      }
    } catch (e) {
      // Revert on failure
      if (field === 'owned') {
        setOwnedOverlay(prev => ({ ...prev, [uuid]: currentlyOn }))
      } else {
        setWishlistOverlay(prev => ({ ...prev, [uuid]: currentlyOn }))
      }
      console.error('Failed to update blueprint state', e)
    }
  }, [ownedSet, wishlistSet, userBp])

  const handleToggleOwned = useCallback((bp) => toggleState(bp, 'owned'), [toggleState])
  const handleToggleWishlist = useCallback((bp) => toggleState(bp, 'wishlist'), [toggleState])

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
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {blueprints.map(bp => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              isInCompare={compare.isInTray(bp)}
              isOwned={!!bp.uuid && ownedSet.has(bp.uuid)}
              isWishlist={!!bp.uuid && wishlistSet.has(bp.uuid)}
              onToggleOwned={handleToggleOwned}
              onToggleWishlist={handleToggleWishlist}
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
          ownedSet={ownedSet}
          wishlistSet={wishlistSet}
          onToggleOwned={handleToggleOwned}
          onToggleWishlist={handleToggleWishlist}
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
