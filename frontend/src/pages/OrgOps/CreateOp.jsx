import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'

const OP_TYPES = [
  { key: 'mining', label: 'Mining Run' },
  { key: 'cargo', label: 'Cargo Haul' },
  { key: 'bounty', label: 'Bounty Hunting' },
  { key: 'salvage', label: 'Salvage Op' },
  { key: 'escort', label: 'Escort Mission' },
  { key: 'exploration', label: 'Exploration' },
  { key: 'trade', label: 'Trade Run' },
  { key: 'other', label: 'Other' },
]

export default function CreateOp({ slug, onClose }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [opType, setOpType] = useState('mining')
  const [description, setDescription] = useState('')
  // F290: visibility toggle — default 'org' so members in the same org see
  // the op automatically. 'private' for leader-only, 'public' for Discord-
  // sharable. Backend auto-generates a join code when is_public=true.
  const [visibility, setVisibility] = useState('org')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const resp = await fetch(`/api/orgs/${slug}/ops`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          op_type: opType,
          description: description.trim() || null,
          is_public: visibility === 'public' ? 1 : 0,
          visibility,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to create op')
      navigate(`/orgs/${slug}/ops/${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel p-6 max-w-lg space-y-4">
      <h2 className="text-sm font-display uppercase tracking-widest text-gray-400">Create Operation</h2>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Op Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Friday Night Mining"
            className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
            maxLength={200}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {OP_TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setOpType(key)}
                className={`px-2.5 py-2 rounded text-xs font-display uppercase tracking-wide border transition-colors ${
                  opType === key
                    ? 'text-sc-accent border-sc-accent/30 bg-sc-accent/10'
                    : 'text-gray-400 border-sc-border hover:text-gray-300 hover:border-sc-border bg-white/[0.02]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the plan? Where are we headed?"
            className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50 h-24 resize-none"
            maxLength={2000}
          />
        </div>

        {/* F290: visibility toggle — previously defaulted to private silently. */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Who can see this op?
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: 'org', label: 'Org', hint: 'Visible to org members' },
              { key: 'private', label: 'Private', hint: 'Only you + invited members' },
              { key: 'public', label: 'Public', hint: 'Anyone with a join link' },
            ].map(({ key, label, hint }) => (
              <button
                key={key}
                type="button"
                onClick={() => setVisibility(key)}
                title={hint}
                className={`px-2.5 py-2 rounded text-xs font-display uppercase tracking-wide border transition-colors ${
                  visibility === key
                    ? 'text-sc-accent border-sc-accent/30 bg-sc-accent/10'
                    : 'text-gray-400 border-sc-border hover:text-gray-300 hover:border-sc-border bg-white/[0.02]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {visibility === 'org' && 'Members of this org will see the op in their list.'}
            {visibility === 'private' && 'Only you + anyone you explicitly invite can see the op.'}
            {visibility === 'public' && 'A 24h join code will be generated. Anyone with the link can view + join.'}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? 'Creating...' : 'Create Op'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
