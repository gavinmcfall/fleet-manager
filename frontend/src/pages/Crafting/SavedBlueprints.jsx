import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Trash2, Edit3, Check, X, Plus, Minus, SlidersHorizontal, Box, Star, Bookmark } from 'lucide-react'
import {
  useUserBlueprints,
  updateUserBlueprint,
  deleteUserBlueprint,
  setBlueprintState,
  updateBlueprintBuild,
  deleteBlueprintBuild,
} from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import { TYPE_LABELS, TYPE_COLORS, SUBTYPE_LABELS, formatTime } from './craftingUtils'

function prettyNameFromTag(tag) {
  if (!tag) return 'Unknown blueprint'
  return tag
    .replace(/^BP_CRAFT_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

function BlueprintRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(item.nickname || '')
  const [quantity, setQuantity] = useState(item.crafted_quantity || 0)
  const [saving, setSaving] = useState(false)

  const typeColor = TYPE_COLORS[item.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }
  // Friendly product name from the joined fps_weapons / fps_armour
  // table (e.g. "Novia Crossbow") wins over the auto-derived BP name
  // (e.g. "Utfl Crossbow Ballistic 01"), with a final tag-pretty
  // fallback for blueprints whose item record is missing.
  const displayName = item.item_name || item.blueprint_name || prettyNameFromTag(item.tag)
  const isPtuOnly = item.is_ptu_only
  const detailHref = item.crafting_blueprint_id
    ? `/crafting/${item.crafting_blueprint_id}?tab=quality`
    : null

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserBlueprint(item.id, {
        nickname: nickname || null,
        craftedQuantity: quantity,
      })
      setEditing(false)
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove this saved blueprint?')) return
    await deleteUserBlueprint(item.id)
    onDelete()
  }

  const handleToggleOwned = async () => {
    await setBlueprintState({ blueprintUuid: item.blueprint_uuid, owned: !item.is_owned })
    onUpdate()
  }

  const handleToggleWishlist = async () => {
    await setBlueprintState({ blueprintUuid: item.blueprint_uuid, wishlist: !item.is_wishlist })
    onUpdate()
  }

  const adjustQuantity = async (delta) => {
    const newQty = Math.max(0, quantity + delta)
    setQuantity(newQty)
    await updateUserBlueprint(item.id, { craftedQuantity: newQty })
    onUpdate()
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 hover:border-white/[0.1] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${typeColor.bg} ${typeColor.text} border ${typeColor.border}`}>
              {TYPE_LABELS[item.type] || item.type || 'Unknown'}
            </span>
            {item.sub_type && (
              <span className="text-[10px] text-gray-600">
                {SUBTYPE_LABELS[item.sub_type] || item.sub_type}
              </span>
            )}
            {item.is_owned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[rgba(52,211,153,0.08)] text-[rgb(52,211,153)] border border-[rgba(52,211,153,0.45)]">
                <Check className="w-2.5 h-2.5" /> Owned
              </span>
            )}
            {item.is_wishlist && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[rgba(245,166,35,0.06)] text-sc-warn border border-sc-warn/40">
                <Star className="w-2.5 h-2.5" fill="currentColor" /> Wishlist
              </span>
            )}
            {item.has_quality_config && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[var(--hover-bg)] text-sc-accent border border-sc-accent/40">
                <SlidersHorizontal className="w-2.5 h-2.5" /> Saved Sim
              </span>
            )}
            {isPtuOnly && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                PTU
              </span>
            )}
          </div>

          {detailHref ? (
            <Link
              to={detailHref}
              className="block text-sm font-medium text-gray-200 hover:text-sc-accent transition-colors"
              title="Open Quality Sim"
            >
              {displayName}
            </Link>
          ) : (
            <span
              className="text-sm font-medium text-gray-300"
              title="Detail page unavailable for PTU-only blueprints"
            >
              {displayName}
            </span>
          )}
          {item.item_name && item.blueprint_name && item.item_name !== item.blueprint_name && (
            <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
              BP: {item.blueprint_name}
            </p>
          )}

          {editing ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Nickname..."
                className="flex-1 max-w-48 text-xs bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sc-accent/40"
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                autoFocus
              />
              <button onClick={handleSave} disabled={saving} className="text-sc-accent hover:text-sc-accent/80 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            item.nickname && (
              <p className="text-xs text-gray-500 mt-0.5">"{item.nickname}"</p>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Crafted-quantity stepper. Labelled explicitly because a bare
              "0" was getting mistaken for an ownership status indicator —
              this is a tracker for "how many have you actually crafted",
              independent of the OWNED flag. */}
          <div className="flex items-center gap-1.5" title="Crafted count — track how many you've actually built">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Crafted</span>
            <button
              onClick={() => adjustQuantity(-1)}
              disabled={quantity <= 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className={`w-7 text-center text-sm font-mono ${quantity > 0 ? 'text-sc-accent' : 'text-gray-600'}`}>{quantity}</span>
            <button
              onClick={() => adjustQuantity(1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleOwned}
              className={`p-1.5 rounded transition-all ${
                item.is_owned
                  ? 'text-[rgb(52,211,153)] bg-[rgba(52,211,153,0.08)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
              title={item.is_owned ? 'Mark as not owned' : 'Mark as owned'}
            >
              {item.is_owned ? <Check className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleToggleWishlist}
              className={`p-1.5 rounded transition-all ${
                item.is_wishlist
                  ? 'text-sc-warn bg-[rgba(245,166,35,0.06)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
              title={item.is_wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Star className="w-3.5 h-3.5" fill={item.is_wishlist ? 'currentColor' : 'none'} />
            </button>
            {item.crafting_blueprint_id && (
              <Link
                to={`/crafting/sim?type=${item.type}&bp=${item.crafting_blueprint_id}`}
                className="p-1.5 rounded text-gray-500 hover:text-sc-accent hover:bg-white/[0.04] transition-all"
                title="Open in Quality Sim"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all"
              title="Edit nickname"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders a parent blueprint row plus zero-or-more nested build rows.
 * The parent row is the ownership/wishlist marker. Each build is a
 * named saved configuration of that blueprint.
 */
function BlueprintGroup({ item, onUpdate, onDelete }) {
  const builds = item.builds || []
  return (
    <div className="space-y-1">
      <BlueprintRow item={item} onUpdate={onUpdate} onDelete={onDelete} />
      {builds.length > 0 && (
        <div className="ml-6 border-l border-white/[0.06] pl-3 space-y-1">
          {builds.map(build => (
            <BuildRow
              key={build.id}
              item={item}
              build={build}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One saved build (named Quality Sim configuration) under a blueprint.
 * Compact row with: name, build count tracker, open-in-sim, edit, delete.
 */
function BuildRow({ item, build, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(build.name)
  const [crafted, setCrafted] = useState(build.crafted_quantity || 0)
  const buildHref = item.crafting_blueprint_id
    ? `/crafting/${item.crafting_blueprint_id}?tab=quality&build=${build.id}`
    : null

  const handleSaveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === build.name) {
      setEditing(false)
      return
    }
    try {
      await updateBlueprintBuild(build.id, { name: trimmed })
      setEditing(false)
      onUpdate()
    } catch (e) {
      // Surface a tooltip-style error inline
      console.error('Failed to rename build', e)
      setName(build.name)
      setEditing(false)
    }
  }

  const handleAdjustCrafted = async (delta) => {
    const next = Math.max(0, crafted + delta)
    setCrafted(next)
    try {
      await updateBlueprintBuild(build.id, { craftedQuantity: next })
      onUpdate()
    } catch (e) {
      console.error('Failed to update crafted count', e)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete the build "${build.name}"?`)) return
    try {
      await deleteBlueprintBuild(build.id)
      onUpdate()
    } catch (e) {
      console.error('Failed to delete build', e)
    }
  }

  return (
    <div className="bg-white/[0.015] border border-white/[0.04] rounded p-2.5 hover:border-white/[0.08] transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Bookmark className="w-3 h-3 text-sc-accent flex-shrink-0" />
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') { setName(build.name); setEditing(false) }
              }}
              className="flex-1 max-w-64 text-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-gray-200 focus:outline-none focus:border-sc-accent/40"
              autoFocus
              maxLength={100}
            />
          ) : (
            buildHref ? (
              <Link
                to={buildHref}
                className="text-xs font-medium text-gray-200 hover:text-sc-accent truncate"
                title="Open this build in the Quality Sim"
              >
                {build.name}
              </Link>
            ) : (
              <span className="text-xs font-medium text-gray-300 truncate">{build.name}</span>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Crafted count for this build">
            <span className="text-[9px] uppercase tracking-wider text-gray-600">Crafted</span>
            <button
              onClick={() => handleAdjustCrafted(-1)}
              disabled={crafted <= 0}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className={`w-6 text-center text-xs font-mono ${crafted > 0 ? 'text-sc-accent' : 'text-gray-600'}`}>{crafted}</span>
            <button
              onClick={() => handleAdjustCrafted(1)}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {buildHref && (
              <Link
                to={buildHref}
                className="p-1 rounded text-gray-500 hover:text-sc-accent hover:bg-white/[0.04] transition-all"
                title="Open in Quality Sim"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </Link>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all"
              title="Rename build"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Delete build"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SavedBlueprints() {
  const { data, loading, error, refetch } = useUserBlueprints()
  const [filter, setFilter] = useState('all') // 'all' | 'owned' | 'wishlist' | 'sim'

  const items = data?.items || []
  // Total build count across all BPs — surfaced in the subtitle so users
  // see "1 owned · 1 wishlist · 2 builds" instead of just BP-level totals.
  const totalBuilds = useMemo(
    () => items.reduce((sum, i) => sum + (i.build_count ?? (i.builds?.length ?? 0)), 0),
    [items],
  )
  const counts = useMemo(() => ({
    all: items.length,
    owned: items.filter(i => i.is_owned).length,
    wishlist: items.filter(i => i.is_wishlist).length,
    sim: items.filter(i => i.has_quality_config || (i.build_count ?? 0) > 0).length,
  }), [items])

  const filtered = useMemo(() => {
    if (filter === 'owned') return items.filter(i => i.is_owned)
    if (filter === 'wishlist') return items.filter(i => i.is_wishlist)
    if (filter === 'sim') return items.filter(i => i.has_quality_config || (i.build_count ?? 0) > 0)
    return items
  }, [items, filter])

  if (loading) return <LoadingState fullScreen message="Loading saved blueprints..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const totalCrafted = items.reduce((sum, i) => sum + (i.crafted_quantity || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Blueprints"
        subtitle={items.length > 0
          ? `${counts.owned} owned · ${counts.wishlist} wishlist · ${totalBuilds} build${totalBuilds === 1 ? '' : 's'} · ${totalCrafted} crafted`
          : 'Mark blueprints as owned or add them to your wishlist'}
      />

      {items.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] uppercase tracking-[0.05em]">
          <SavedFilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All <span className="opacity-60">· {counts.all}</span>
          </SavedFilterChip>
          <SavedFilterChip active={filter === 'owned'} tint="success" onClick={() => setFilter('owned')} disabled={counts.owned === 0}>
            Owned <span className="opacity-60">· {counts.owned}</span>
          </SavedFilterChip>
          <SavedFilterChip active={filter === 'wishlist'} tint="warn" onClick={() => setFilter('wishlist')} disabled={counts.wishlist === 0}>
            Wishlist <span className="opacity-60">· {counts.wishlist}</span>
          </SavedFilterChip>
          <SavedFilterChip active={filter === 'sim'} tint="accent" onClick={() => setFilter('sim')} disabled={counts.sim === 0}>
            Saved Sim <span className="opacity-60">· {counts.sim}</span>
          </SavedFilterChip>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-10 h-10 mx-auto mb-4 text-gray-600" />
          <p className="text-sm text-gray-400 mb-2">No saved blueprints yet</p>
          <p className="text-xs text-gray-600 mb-4">
            Browse blueprints and click Owned or Wishlist to start tracking.
          </p>
          <Link
            to="/crafting"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sc-accent/10 text-sc-accent border border-sc-accent/20 text-sm hover:bg-sc-accent/20 transition-colors"
          >
            <Box className="w-4 h-4" />
            Browse Blueprints
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          No blueprints match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <BlueprintGroup
              key={item.id}
              item={item}
              onUpdate={refetch}
              onDelete={refetch}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SavedFilterChip({ active, onClick, disabled = false, tint = 'accent', children }) {
  const tintMap = {
    accent: 'bg-[var(--hover-bg)] border-sc-accent/40 text-sc-accent',
    success: 'bg-[rgba(52,211,153,0.08)] border-[rgba(52,211,153,0.45)] text-[rgb(52,211,153)]',
    warn: 'bg-[rgba(245,166,35,0.06)] border-sc-warn/40 text-sc-warn',
  }
  const idleCls = 'bg-white/[0.02] border-white/[0.08] text-gray-400 hover:bg-white/[0.05] hover:text-white'
  const disabledCls = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 rounded-full border transition-colors duration-150 ${active ? tintMap[tint] : idleCls} ${disabledCls}`}
    >
      {children}
    </button>
  )
}
