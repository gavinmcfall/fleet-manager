import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2, Plus, ExternalLink, Users, ChevronRight, X, AlertCircle, Loader2,
  ShieldCheck, Copy, CheckCircle, Star, RefreshCw
} from 'lucide-react'
import { useUserOrgs, generateOrgVerification, checkOrgVerification, useOrgVerificationStatus, setPrimaryOrg } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

const RSI_BASE = 'https://robertsspaceindustries.com'

const ROLE_BADGE = {
  owner: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  admin: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  member: 'text-gray-400 bg-white/5 border-sc-border',
}

// ── Create Org Modal (verify-then-create) ─────────────────────────────────

function CreateOrgModal({ open, onClose, onCreated }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('input') // input | key-ready | checking
  const [rsiSid, setRsiSid] = useState('')
  const [verifyKey, setVerifyKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  // Restore pending verification on mount (key is NOT returned from status — only SID)
  const { data: pendingStatus } = useOrgVerificationStatus()
  useEffect(() => {
    if (pendingStatus?.pending && open) {
      setRsiSid(pendingStatus.rsiSid || '')
      // Key must be re-generated — status endpoint no longer exposes it for security
      setStep('input')
    }
  }, [pendingStatus, open])

  if (!open) return null

  const handleGenerate = async () => {
    if (!rsiSid.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await generateOrgVerification(rsiSid.trim())
      setVerifyKey(data.verification_key)
      setStep('key-ready')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setStep('checking')
    setError('')
    setMessage(null)
    try {
      const data = await checkOrgVerification()
      if (data.verified) {
        onCreated?.()
        navigate(`/orgs/${data.slug}`)
      } else {
        setMessage(data.message)
        setStep('key-ready')
      }
    } catch (err) {
      setError(err.message)
      setStep('key-ready')
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(verifyKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

        <p className="text-xs text-gray-400">
          Prove you own an RSI org by adding a verification key to the org's charter. SC Bridge will then create the org from RSI data.
        </p>

        {/* Step 1: Enter RSI SID */}
        {step === 'input' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-gray-400 mb-1.5">RSI Org SID</label>
              <input
                type="text"
                value={rsiSid}
                onChange={e => setRsiSid(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="EXLS"
                maxLength={20}
                autoFocus
                className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sc-accent focus:outline-none font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Find your SID at{' '}
                <a href={`${RSI_BASE}/en/orgs`} target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">
                  robertsspaceindustries.com/orgs
                </a>
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!rsiSid.trim() || loading}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {loading ? 'Generating...' : 'Generate Verification Key'}
            </button>
          </div>
        )}

        {/* Step 2: Key ready, instructions */}
        {(step === 'key-ready' || step === 'checking') && verifyKey && (
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

            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex items-start gap-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded">
                <span className="text-blue-400 font-mono shrink-0">1.</span>
                <span>Go to <a href={`${RSI_BASE}/en/orgs/${rsiSid}`} target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline inline-flex items-center gap-0.5">{rsiSid} on RSI <ExternalLink className="w-3 h-3" /></a></span>
              </div>
              <div className="flex items-start gap-2 px-2">
                <span className="text-blue-400 font-mono shrink-0">2.</span>
                <span>Edit your org → paste the key into the <strong className="text-gray-300">Charter</strong> section</span>
              </div>
              <div className="flex items-start gap-2 px-2">
                <span className="text-blue-400 font-mono shrink-0">3.</span>
                <span>Save on RSI, then click Verify below</span>
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={step === 'checking'}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              {step === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {step === 'checking' ? 'Verifying with RSI...' : 'Verify'}
            </button>

            <button
              onClick={() => { setStep('input'); setVerifyKey(null); setMessage(null) }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-3"
            >
              Start over
            </button>
          </div>
        )}

        {/* Messages */}
        {message && (
          <div className="flex items-center gap-2 p-3 rounded text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded text-sm bg-sc-danger/10 border border-sc-danger/30 text-sc-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Orgs Page ────────────────────────────────────────────────────────

export default function Orgs() {
  const { data, loading, error, refetch } = useUserOrgs()
  const [showCreate, setShowCreate] = useState(false)
  const [settingPrimary, setSettingPrimary] = useState(null)

  const orgs = data?.orgs ?? []
  const primaryOrgId = data?.primaryOrgId ?? null

  const handleSetPrimary = async (orgId) => {
    setSettingPrimary(orgId)
    try {
      await setPrimaryOrg(orgId)
      refetch()
    } catch {
      // ignore
    } finally {
      setSettingPrimary(null)
    }
  }

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

      <CreateOrgModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
      />

      {orgs.length === 0 ? (
        <div className="max-w-md mx-auto space-y-4">
          <button
            onClick={() => setShowCreate(true)}
            className="panel p-8 w-full flex flex-col items-center gap-3 text-center hover:border-sc-accent/40 transition-colors group"
          >
            <ShieldCheck className="w-10 h-10 text-gray-600 group-hover:text-sc-accent transition-colors" />
            <div>
              <p className="font-display tracking-wide text-white group-hover:text-sc-accent transition-colors">Create Organisation</p>
              <p className="text-xs text-gray-500 mt-1">Verify your RSI org ownership</p>
            </div>
          </button>
          <div className="panel p-5 flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-300">Looking to join an existing org?</p>
              <p className="text-xs text-gray-500 mt-1">
                <Link to="/account" className="text-sc-accent hover:underline">Sync your RSI profile</Link> from your account page — you'll be automatically added to any SC Bridge orgs that match your RSI affiliations.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="panel p-4 flex items-center gap-4 group"
            >
              {/* Primary star */}
              <button
                onClick={(e) => { e.preventDefault(); handleSetPrimary(org.id) }}
                disabled={settingPrimary === org.id}
                className={`shrink-0 p-1 rounded transition-colors ${
                  primaryOrgId === org.id
                    ? 'text-amber-400'
                    : 'text-gray-600 hover:text-amber-400/60'
                }`}
                title={primaryOrgId === org.id ? 'Primary org' : 'Set as primary'}
              >
                <Star className={`w-4 h-4 ${primaryOrgId === org.id ? 'fill-current' : ''}`} />
              </button>

              <Link
                to={`/orgs/${org.slug}`}
                className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity"
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
                    {org.verified_at && (
                      <ShieldCheck className="w-3.5 h-3.5 text-green-400" title="RSI Verified" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {org.memberCount ?? '?'} members
                    </span>
                    {org.rsi_model && (
                      <span className="text-xs text-gray-600">{org.rsi_model}</span>
                    )}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
