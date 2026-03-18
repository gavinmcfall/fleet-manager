import React, { useState, useEffect, useCallback } from 'react'
import { Star, AlertCircle, Check, RefreshCw, ShieldCheck, Copy, Loader2, AlertTriangle } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import RsiOrgChip from '../../components/RsiOrgChip'
import { formatDate } from '../../lib/dates'

export default function RsiProfileSection({
  timezone,
  rsiProfile, rsiLoading,
  rsiHandle, setRsiHandle,
  rsiSyncing, rsiError, rsiMsg,
  onRsiSync,
}) {
  // Verification state
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [verifyLoading, setVerifyLoading] = useState(true)
  const [verifyKey, setVerifyKey] = useState(null)
  const [verifyMsg, setVerifyMsg] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [verifyChecking, setVerifyChecking] = useState(false)
  const [verifyGenerating, setVerifyGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchVerifyStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/account/rsi-verify/status', { credentials: 'include' })
      if (resp.ok) {
        const data = await resp.json()
        setVerifyStatus(data)
      }
    } catch {
      // Non-critical
    } finally {
      setVerifyLoading(false)
    }
  }, [])

  useEffect(() => { fetchVerifyStatus() }, [fetchVerifyStatus])

  const handleGenerate = async () => {
    if (!rsiProfile?.handle) return
    setVerifyGenerating(true)
    setVerifyError(null)
    setVerifyMsg(null)
    try {
      const resp = await fetch('/api/account/rsi-verify/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: rsiProfile.handle }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setVerifyError(data.error || 'Failed to generate verification key')
      } else {
        setVerifyKey(data.verification_key)
        setVerifyMsg(null)
        await fetchVerifyStatus()
      }
    } catch (err) {
      setVerifyError(err.message || 'Failed to generate key')
    } finally {
      setVerifyGenerating(false)
    }
  }

  const handleCheck = async () => {
    setVerifyChecking(true)
    setVerifyError(null)
    setVerifyMsg(null)
    try {
      const resp = await fetch('/api/account/rsi-verify/check', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await resp.json()
      if (!resp.ok) {
        setVerifyError(data.error || 'Verification check failed')
      } else if (data.verified) {
        setVerifyMsg(data.message)
        setVerifyKey(null)
        await fetchVerifyStatus()
      } else {
        setVerifyError(data.message || 'Key not found')
      }
    } catch (err) {
      setVerifyError(err.message || 'Check failed')
    } finally {
      setVerifyChecking(false)
    }
  }

  const handleCopy = () => {
    if (verifyKey) {
      navigator.clipboard.writeText(verifyKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isVerified = verifyStatus?.verified
  const isPending = verifyStatus?.pending
  const handleChanged = rsiProfile?.verified_handle && rsiProfile.handle && rsiProfile.verified_handle !== rsiProfile.handle

  return (
    <div id="section-rsi" className="scroll-mt-16">
    <PanelSection title="Star Citizen Profile" icon={Star}>
      <div className="p-5 space-y-4 max-w-md">
        {rsiError && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{rsiError}</span>
          </div>
        )}
        {rsiMsg && (
          <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{rsiMsg}</span>
          </div>
        )}

        <form onSubmit={onRsiSync} className="flex items-center gap-2">
          <div className="flex-1">
            <label htmlFor="rsi-handle" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Star Citizen Handle
            </label>
            <input
              id="rsi-handle"
              type="text"
              value={rsiHandle}
              onChange={(e) => setRsiHandle(e.target.value)}
              placeholder="e.g. NZVengeance"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
            />
          </div>
          <button
            type="submit"
            disabled={rsiSyncing || !rsiHandle.trim()}
            className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs flex items-center gap-2 self-end disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rsiSyncing ? 'animate-spin' : ''}`} />
            {rsiSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </form>

        {!rsiLoading && rsiProfile && (
          <div className="space-y-4">
            {/* Avatar + basic info */}
            <div className="flex items-start gap-4">
              {rsiProfile.avatar_url && (
                <img
                  src={rsiProfile.avatar_url}
                  alt={`${rsiProfile.handle} avatar`}
                  className="w-16 h-16 rounded border border-sc-border object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://robertsspaceindustries.com/en/citizens/${rsiProfile.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wide text-sm font-medium"
                  >
                    {rsiProfile.handle}
                  </a>
                  {isVerified && !handleChanged && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 border border-green-400/30 px-1.5 py-0.5 rounded font-display uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                {rsiProfile.citizen_record && (
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{rsiProfile.citizen_record}</p>
                )}
                {rsiProfile.enlisted_at && (
                  <p className="text-xs text-gray-500 mt-0.5">Enlisted: {rsiProfile.enlisted_at}</p>
                )}
              </div>
            </div>

            {/* Org affiliations */}
            {rsiProfile.orgs && rsiProfile.orgs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Org Affiliations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rsiProfile.orgs.map((org) => (
                    <RsiOrgChip
                      key={org.slug}
                      slug={org.slug}
                      name={org.name}
                      isMain={org.is_main}
                      scBridge={false}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-600 font-mono">
              Synced: {rsiProfile.fetched_at ? formatDate(rsiProfile.fetched_at, timezone) : '\u2014'}
            </p>

            {/* ── Identity Verification ─────────────────────────── */}
            {!verifyLoading && (
              <div className="border-t border-sc-border pt-4 space-y-3">
                <p className="text-xs font-display uppercase tracking-wider text-gray-400">
                  Identity Verification
                </p>

                {/* Handle changed warning */}
                {handleChanged && (
                  <div className="flex items-center gap-2 p-3 bg-amber-400/10 border border-amber-400/30 rounded text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Your handle changed since verification. Please re-verify.</span>
                  </div>
                )}

                {verifyError && (
                  <div className="flex items-center gap-2 p-2.5 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}
                {verifyMsg && (
                  <div className="flex items-center gap-2 p-2.5 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-xs">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{verifyMsg}</span>
                  </div>
                )}

                {/* Verified state */}
                {isVerified && !handleChanged && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    <span>Verified as <span className="text-white font-medium">{verifyStatus.verified_handle}</span></span>
                    {verifyStatus.verified_at && (
                      <span className="text-gray-600 font-mono ml-1">
                        {formatDate(verifyStatus.verified_at, timezone)}
                      </span>
                    )}
                  </div>
                )}

                {/* Not verified / handle changed — show generate or pending */}
                {(!isVerified || handleChanged) && (
                  <>
                    {/* Pending with key visible */}
                    {(isPending || verifyKey) && (
                      <div className="space-y-2">
                        {verifyKey && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-gray-400">
                              Add this key to your{' '}
                              <a
                                href={`https://robertsspaceindustries.com/en/citizens/${rsiProfile.handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sc-accent hover:underline"
                              >
                                RSI citizen bio
                              </a>
                              , then click Check:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 px-3 py-2 bg-sc-darker border border-sc-border rounded text-xs text-green-400 font-mono select-all break-all">
                                {verifyKey}
                              </code>
                              <button
                                onClick={handleCopy}
                                className="p-2 rounded border border-sc-border hover:border-sc-accent/30 hover:bg-sc-accent/10 transition-colors shrink-0"
                                title="Copy to clipboard"
                              >
                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                              </button>
                            </div>
                          </div>
                        )}
                        {!verifyKey && isPending && (
                          <p className="text-xs text-gray-400">
                            Verification pending for <span className="text-white">{verifyStatus.pending_handle}</span>.
                            Add the key from earlier to your RSI bio, then check.
                          </p>
                        )}
                        <button
                          onClick={handleCheck}
                          disabled={verifyChecking}
                          className="btn-primary px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center gap-2 disabled:opacity-50"
                        >
                          {verifyChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          {verifyChecking ? 'Checking...' : 'Check Verification'}
                        </button>
                      </div>
                    )}

                    {/* No pending — show generate button */}
                    {!isPending && !verifyKey && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">
                          Prove you own this RSI handle by adding a verification key to your citizen bio.
                        </p>
                        <button
                          onClick={handleGenerate}
                          disabled={verifyGenerating}
                          className="btn-primary px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center gap-2 disabled:opacity-50"
                        >
                          {verifyGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          {verifyGenerating ? 'Generating...' : 'Verify Identity'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!rsiLoading && !rsiProfile && (
          <p className="text-sm text-gray-500">
            Enter your Star Citizen handle to sync your RSI citizen profile, including org affiliations.
          </p>
        )}
      </div>
    </PanelSection>
    </div>
  )
}
