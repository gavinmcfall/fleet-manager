import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Trash2, Edit3, Check, X, Plus, Minus, SlidersHorizontal } from 'lucide-react'
import { useUserBlueprints, updateUserBlueprint, deleteUserBlueprint } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import { TYPE_LABELS, TYPE_COLORS, SUBTYPE_LABELS, formatTime } from './craftingUtils'

function BlueprintRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(item.nickname || '')
  const [quantity, setQuantity] = useState(item.crafted_quantity || 0)
  const [saving, setSaving] = useState(false)

  const typeColor = TYPE_COLORS[item.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }

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
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${typeColor.bg} ${typeColor.text} border ${typeColor.border}`}>
              {TYPE_LABELS[item.type] || item.type}
            </span>
            <span className="text-[10px] text-gray-600">
              {SUBTYPE_LABELS[item.sub_type] || item.sub_type}
            </span>
          </div>

          <Link
            to={`/crafting/${item.crafting_blueprint_id}`}
            className="text-sm font-medium text-gray-200 hover:text-sc-accent transition-colors"
          >
            {item.blueprint_name}
          </Link>

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
          {/* Quantity stepper */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjustQuantity(-1)}
              disabled={quantity <= 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-sm font-mono text-sc-accent">{quantity}</span>
            <button
              onClick={() => adjustQuantity(1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Link
              to={`/crafting/sim?type=${item.type}&bp=${item.crafting_blueprint_id}`}
              className="p-1.5 rounded text-gray-500 hover:text-sc-accent hover:bg-white/[0.04] transition-all"
              title="Open in Quality Sim"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Link>
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

export default function SavedBlueprints() {
  const { data, loading, error, refetch } = useUserBlueprints()

  if (loading) return <LoadingState fullScreen message="Loading saved blueprints..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const items = data?.items || []
  const totalCrafted = items.reduce((sum, i) => sum + (i.crafted_quantity || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Blueprints"
        subtitle={items.length > 0 ? `${items.length} saved, ${totalCrafted} crafted` : 'Save blueprints from the Quality Sim'}
      />

      {items.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-10 h-10 mx-auto mb-4 text-gray-600" />
          <p className="text-sm text-gray-400 mb-2">No saved blueprints yet</p>
          <p className="text-xs text-gray-600 mb-4">
            Use the Quality Sim to test blueprint configurations, then save them here.
          </p>
          <Link
            to="/crafting/sim"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sc-accent/10 text-sc-accent border border-sc-accent/20 text-sm hover:bg-sc-accent/20 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Open Quality Sim
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <BlueprintRow
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
