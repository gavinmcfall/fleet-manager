import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Trash2, Clock
} from 'lucide-react'
import { useOrgProfile, updateOrgSettings, syncOrgFromRsi, deleteOrg } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const FIELDS = [
  { key: 'description', label: 'Description', placeholder: 'A brief description of your org', maxLength: 500, multiline: true },
  { key: 'homepage', label: 'Website', placeholder: 'https://myorg.example.com', type: 'url' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite-code', type: 'url' },
  { key: 'twitch', label: 'Twitch', placeholder: 'https://twitch.tv/channel', type: 'url' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel', type: 'url' },
]

// ── Sync from RSI Panel ───────────────────────────────────────────────

function SyncPanel({ slug, lastSyncedAt, onSynced }) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const canSync = !lastSyncedAt || (new Date() - new Date(lastSyncedAt + 'Z')) > 60 * 60 * 1000

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSuccess(false)
    try {
      await syncOrgFromRsi(slug)
      setSuccess(true)
      onSynced?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-sc-accent" />
        <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wider">Sync from RSI</h3>
      </div>
      <p className="text-xs text-gray-400">
        Refresh the org's name, logo, banner, focus, and about sections from RSI. 1-hour cooldown.
      </p>

      {lastSyncedAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          Last synced: {new Date(lastSyncedAt + 'Z').toLocaleString()}
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={syncing || !canSync}
        className="btn-primary text-xs inline-flex items-center gap-1.5"
      >
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {syncing ? 'Syncing...' : canSync ? 'Sync Now' : 'Cooldown active'}
      </button>

      {success && <span className="text-xs text-green-400 ml-3">Synced successfully</span>}
      {error && <span className="text-xs text-red-400 ml-3">{error}</span>}
    </div>
  )
}

// ── Delete Org Panel ──────────────────────────────────────────────────

function DeletePanel({ slug, orgName }) {
  const navigate = useNavigate()
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    if (confirmName !== orgName) return
    setDeleting(true)
    setError(null)
    try {
      await deleteOrg(slug)
      navigate('/orgs')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="panel p-5 space-y-4 border-sc-danger/30">
      <div className="flex items-center gap-2">
        <Trash2 className="w-5 h-5 text-sc-danger" />
        <h3 className="font-display font-semibold text-sc-danger text-sm uppercase tracking-wider">Danger Zone</h3>
      </div>
      <p className="text-xs text-gray-400">
        Permanently delete this organisation and all its data. This cannot be undone.
      </p>

      <div>
        <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">
          Type <strong className="text-gray-300">{orgName}</strong> to confirm
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          placeholder={orgName}
          className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-danger focus:outline-none"
        />
      </div>

      <button
        onClick={handleDelete}
        disabled={confirmName !== orgName || deleting}
        className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-sc-danger/50 text-sc-danger hover:bg-sc-danger/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        {deleting ? 'Deleting...' : 'Delete Organisation'}
      </button>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

// ── Main OrgSettings Page ─────────────────────────────────────────────

export default function OrgSettings() {
  const { slug } = useParams()
  const { data: org, loading, error, refetch } = useOrgProfile(slug)

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (org) {
      const initial = {}
      for (const { key } of FIELDS) {
        initial[key] = org[key] ?? ''
      }
      setForm(initial)
    }
  }, [org])

  if (loading) return <LoadingState message="Loading org settings..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!org) return null

  if (org.callerRole !== 'owner' && org.callerRole !== 'admin') {
    return (
      <div className="text-center py-16 text-gray-500 space-y-3">
        <p className="text-sm">You need to be an org owner or admin to access settings.</p>
        <Link to={`/orgs/${slug}`} className="btn-primary text-xs inline-flex">Back to Org</Link>
      </div>
    )
  }

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    setSaveError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    try {
      const payload = {}
      for (const { key } of FIELDS) {
        const val = form[key]?.trim() || null
        payload[key] = val
      }
      await updateOrgSettings(slug, payload)
      setSaved(true)
      refetch()
    } catch (err) {
      setSaveError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      <PageHeader title="Org Settings" subtitle={org.name} />

      <Link
        to={`/orgs/${slug}`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to profile
      </Link>

      {/* RSI info (read-only) */}
      {org.rsiSid && (
        <div className="panel p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white">RSI Verified as <strong className="font-mono">{org.rsiSid}</strong></p>
            {org.verified_at && (
              <p className="text-xs text-gray-500">Verified {new Date(org.verified_at + 'Z').toLocaleDateString()}</p>
            )}
          </div>
        </div>
      )}

      {/* Editable fields */}
      <form onSubmit={handleSave} className="panel p-5 space-y-5">
        {FIELDS.map(({ key, label, placeholder, maxLength, type, multiline }) => (
          <div key={key}>
            <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">
              {label}
            </label>
            {multiline ? (
              <textarea
                value={form[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                rows={3}
                className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none resize-none"
              />
            ) : (
              <input
                type={type || 'text'}
                value={form[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength || 200}
                className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none"
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {saved && <span className="text-xs text-green-400">Settings saved</span>}
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
        </div>
      </form>

      {/* Sync from RSI — owner only */}
      {org.callerRole === 'owner' && org.rsiSid && (
        <SyncPanel slug={slug} lastSyncedAt={org.last_synced_at} onSynced={refetch} />
      )}

      {/* Delete — owner only */}
      {org.callerRole === 'owner' && (
        <DeletePanel slug={slug} orgName={org.name} />
      )}
    </div>
  )
}
