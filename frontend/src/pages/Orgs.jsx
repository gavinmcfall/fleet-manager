import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, ExternalLink, Users, ChevronRight, X, AlertCircle, Loader2 } from 'lucide-react'
import { useUserOrgs } from '../hooks/useAPI'
import { authClient } from '../lib/auth-client'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const RSI_BASE = 'https://robertsspaceindustries.com'

const ROLE_BADGE = {
  owner: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  admin: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  member: 'text-gray-400 bg-white/5 border-sc-border',
}

function CreateOrgDialog({ open, onClose, onCreated }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    setError('')
    try {
      const result = await authClient.organization.create({ name: name.trim(), slug: slug.trim() })
      if (result.error) {
        setError(result.error.message || 'Failed to create organisation')
        return
      }
      onCreated?.()
      navigate(`/orgs/${slug.trim()}`)
    } catch (err) {
      setError(err.message || 'Failed to create organisation')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative w-full max-w-md panel p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold tracking-wide text-white uppercase text-sm">Create Organisation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="My Organisation"
              autoFocus
              required
              className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">URL Slug</label>
            <div className="flex items-center">
              <span className="text-xs text-gray-500 font-mono bg-sc-darker border border-sc-border border-r-0 rounded-l px-3 py-2 select-none">/orgs/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
                placeholder="my-org"
                required
                pattern="[a-z0-9][a-z0-9-]*"
                title="Lowercase letters, numbers, and hyphens only"
                className="flex-1 bg-sc-darker border border-sc-border rounded-r px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={creating || !name.trim() || !slug.trim()} className="btn-primary text-xs flex items-center gap-1.5 flex-1 justify-center">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? 'Creating...' : 'Create Organisation'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-xs px-4">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Orgs() {
  const { data, loading, error, refetch } = useUserOrgs()
  const [showCreate, setShowCreate] = useState(false)

  const orgs = data?.orgs ?? []

  if (loading) return <LoadingState message="Loading organisations..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="MY ORGANISATIONS"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Org
          </button>
        }
      />

      <CreateOrgDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
      />

      {orgs.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center gap-4 text-center">
          <Building2 className="w-12 h-12 text-gray-600" />
          <div>
            <p className="text-gray-400 font-display tracking-wide">No organisations yet</p>
            <p className="text-xs text-gray-500 mt-1">Create one or wait for an invitation</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            Create Organisation
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              to={`/orgs/${org.slug}`}
              className="panel p-4 flex items-center gap-4 hover:border-sc-accent/40 transition-colors group"
            >
              {org.logo ? (
                <img src={org.logo} alt={org.name} className="w-10 h-10 rounded border border-sc-border object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded border border-sc-border bg-sc-darker flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display tracking-wide text-white group-hover:text-sc-accent transition-colors">{org.name}</span>
                  <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border font-display ${ROLE_BADGE[org.role] || ROLE_BADGE.member}`}>
                    {org.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {org.memberCount ?? '?'} members
                  </span>
                  {org.rsiSid && (
                    <a
                      href={`${RSI_BASE}/en/orgs/${org.rsiSid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-sc-accent flex items-center gap-1 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      RSI
                    </a>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-sc-accent transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
