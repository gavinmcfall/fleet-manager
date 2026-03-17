import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, ShieldCheck, Copy, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { useOrgProfile } from '../hooks/useAPI'
import { updateOrgSettings } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const FIELDS = [
  { key: 'rsiSid', label: 'RSI Org SID', placeholder: 'MYORG', maxLength: 20 },
  { key: 'description', label: 'Description', placeholder: 'A brief description of your org', maxLength: 500, multiline: true },
  { key: 'rsiUrl', label: 'RSI Profile URL', placeholder: 'https://robertsspaceindustries.com/en/orgs/MYORG', type: 'url' },
  { key: 'homepage', label: 'Website', placeholder: 'https://myorg.example.com', type: 'url' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite-code', type: 'url' },
  { key: 'twitch', label: 'Twitch', placeholder: 'https://twitch.tv/channel', type: 'url' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel', type: 'url' },
]

function RsiVerification({ slug, org }) {
  const [rsiSid, setRsiSid] = useState(org.rsiSid || '')
  const [verifyKey, setVerifyKey] = useState(null)
  const [status, setStatus] = useState('idle') // idle | generating | key-ready | checking | verified | error
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  // Check verification status on mount
  useEffect(() => {
    fetch(`/api/orgs/${slug}/verify-rsi/status`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        if (data.verified) {
          setStatus('verified')
          setRsiSid(data.rsiSid || '')
        } else if (data.verification_key) {
          setVerifyKey(data.verification_key)
          setRsiSid(data.rsiSid || '')
          setStatus('key-ready')
        }
      })
      .catch(() => {})
  }, [slug])

  const handleGenerate = async () => {
    if (!rsiSid.trim()) return
    setStatus('generating')
    setMessage(null)
    try {
      const resp = await fetch(`/api/orgs/${slug}/verify-rsi/generate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsiSid: rsiSid.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to generate key')
      setVerifyKey(data.verification_key)
      setStatus('key-ready')
    } catch (err) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  const handleCheck = async () => {
    setStatus('checking')
    setMessage(null)
    try {
      const resp = await fetch(`/api/orgs/${slug}/verify-rsi/check`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Verification failed')
      if (data.verified) {
        setStatus('verified')
        setMessage(data.message)
      } else {
        setMessage(data.message)
        setStatus('key-ready')
      }
    } catch (err) {
      setMessage(err.message)
      setStatus('key-ready')
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(verifyKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'verified') {
    return (
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wider">RSI Verification</h3>
        </div>
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Verified as <strong>{rsiSid}</strong> on RSI{message ? ` — ${message}` : ''}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-sc-accent" />
        <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wider">RSI Verification</h3>
      </div>
      <p className="text-xs text-gray-400">
        Prove you own this RSI org by adding a verification key to the org's charter page.
      </p>

      {(status === 'idle' || status === 'generating' || status === 'error') && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">RSI Org SID</label>
            <input
              type="text"
              value={rsiSid}
              onChange={e => setRsiSid(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="MYORG"
              maxLength={20}
              className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none font-mono"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!rsiSid.trim() || status === 'generating'}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            {status === 'generating' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {status === 'generating' ? 'Generating...' : 'Generate Verification Key'}
          </button>
        </div>
      )}

      {(status === 'key-ready' || status === 'checking') && verifyKey && (
        <div className="space-y-3">
          <div className="p-3 bg-sc-darker border border-sc-border rounded space-y-2">
            <p className="text-xs text-gray-400">Add this key anywhere in your RSI org charter:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-sc-accent font-mono bg-black/30 px-3 py-2 rounded border border-sc-border select-all break-all">
                {verifyKey}
              </code>
              <button onClick={copyKey} className="shrink-0 p-2 text-gray-400 hover:text-white transition-colors" title="Copy key">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded text-xs text-gray-400">
            <span className="text-blue-400 font-mono shrink-0">1.</span>
            <span>Go to <a href={`https://robertsspaceindustries.com/en/orgs/${rsiSid}`} target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline inline-flex items-center gap-0.5">{rsiSid} on RSI <ExternalLink className="w-3 h-3" /></a></span>
          </div>
          <div className="flex items-start gap-2 px-3 text-xs text-gray-400">
            <span className="text-blue-400 font-mono shrink-0">2.</span>
            <span>Edit your org and paste the key into the <strong className="text-gray-300">Charter</strong> section</span>
          </div>
          <div className="flex items-start gap-2 px-3 text-xs text-gray-400">
            <span className="text-blue-400 font-mono shrink-0">3.</span>
            <span>Save on RSI, then click Verify below</span>
          </div>

          <button
            onClick={handleCheck}
            disabled={status === 'checking'}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            {status === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {status === 'checking' ? 'Checking RSI...' : 'Verify'}
          </button>
        </div>
      )}

      {message && status !== 'verified' && (
        <div className={`flex items-center gap-2 p-3 rounded text-sm ${
          status === 'error' ? 'bg-sc-danger/10 border border-sc-danger/30 text-sc-danger' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}

export default function OrgSettings() {
  const { slug } = useParams()
  const navigate = useNavigate()
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

          {saved && (
            <span className="text-xs text-green-400">Settings saved</span>
          )}
          {saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
        </div>
      </form>

      {org.callerRole === 'owner' && (
        <RsiVerification slug={slug} org={org} />
      )}
    </div>
  )
}
