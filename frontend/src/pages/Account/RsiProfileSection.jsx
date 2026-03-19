import React, { useState } from 'react'
import { Star, AlertCircle, Check, RefreshCw, ShieldCheck, Copy, Loader2, AlertTriangle, ExternalLink, Puzzle } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import RsiOrgChip from '../../components/RsiOrgChip'
import { formatDate } from '../../lib/dates'

export default function RsiProfileSection({
  timezone,
  rsiProfile, extensionProfile, verification,
  rsiLoading,
  rsiHandle, setRsiHandle,
  rsiSyncing, rsiError, rsiMsg,
  onRsiSync, onRefresh,
}) {
  const [verifyKey, setVerifyKey] = useState(null)
  const [verifyMsg, setVerifyMsg] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [verifyChecking, setVerifyChecking] = useState(false)
  const [verifyGenerating, setVerifyGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualHandle, setManualHandle] = useState('')

  const isVerified = verification?.verified
  const isPending = verification?.pending
  const pendingKey = verification?.pending_key || verifyKey
  const handleChanged = rsiProfile?.verified_handle && rsiProfile.handle && rsiProfile.verified_handle !== rsiProfile.handle

  const handleGenerate = async () => {
    const handle = manualHandle.trim() || rsiHandle.trim()
    if (!handle) return
    setVerifyGenerating(true)
    setVerifyError(null)
    setVerifyMsg(null)
    try {
      const resp = await fetch('/api/account/rsi-verify/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setVerifyError(data.error || 'Failed to generate verification key')
      } else {
        setVerifyKey(data.verification_key)
        setVerifyMsg(null)
        window.open('https://robertsspaceindustries.com/en/account/profile', '_blank')
        await onRefresh()
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
        await onRefresh()
      } else {
        setVerifyError(data.message || 'Key not found')
      }
    } catch (err) {
      setVerifyError(err.message || 'Check failed')
    } finally {
      setVerifyChecking(false)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Determine which handle and avatar to display
  const displayHandle = rsiProfile?.handle || extensionProfile?.rsi_handle
  const displayAvatar = rsiProfile?.avatar_url || extensionProfile?.avatar_url
  const displayName = rsiProfile?.display_name || extensionProfile?.rsi_displayname
  const hasProfileData = rsiProfile || extensionProfile
  const hasNoData = !rsiLoading && !hasProfileData && !isPending

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

        {/* ── Verified profile display ─────────────────────── */}
        {!rsiLoading && hasProfileData && isVerified && !handleChanged && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {displayAvatar && (
                <img
                  src={displayAvatar}
                  alt={`${displayHandle} avatar`}
                  className="w-16 h-16 rounded border border-sc-border object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://robertsspaceindustries.com/en/citizens/${displayHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wide text-sm font-medium"
                  >
                    {displayHandle}
                  </a>
                  <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 border border-green-400/30 px-1.5 py-0.5 rounded font-display uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    {verification?.source === 'extension' ? 'Extension' : 'Verified'}
                  </span>
                </div>
                {displayName && displayName !== displayHandle && (
                  <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
                )}
                {rsiProfile?.citizen_record && (
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{rsiProfile.citizen_record}</p>
                )}
                {(rsiProfile?.enlisted_at || extensionProfile?.enlisted_since) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enlisted: {rsiProfile?.enlisted_at || extensionProfile?.enlisted_since}
                  </p>
                )}
              </div>
            </div>

            {/* Org affiliations */}
            {rsiProfile?.orgs?.length > 0 && (
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

            {rsiProfile?.fetched_at && (
              <p className="text-[10px] text-gray-600 font-mono">
                Synced: {formatDate(rsiProfile.fetched_at, timezone)}
              </p>
            )}

            {/* Sync button for verified users */}
            <form onSubmit={onRsiSync} className="flex items-center gap-2">
              <input type="hidden" value={displayHandle} />
              <button
                type="submit"
                disabled={rsiSyncing}
                onClick={() => setRsiHandle(displayHandle)}
                className="btn-primary px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rsiSyncing ? 'animate-spin' : ''}`} />
                {rsiSyncing ? 'Syncing...' : 'Sync Profile'}
              </button>
            </form>
          </div>
        )}

        {/* ── Handle changed warning ───────────────────────── */}
        {!rsiLoading && hasProfileData && handleChanged && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-amber-400/10 border border-amber-400/30 rounded text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Your handle changed since verification. Please re-verify.</span>
            </div>
            <VerifyManualFlow
              handle={rsiProfile?.handle || ''}
              manualHandle={manualHandle}
              setManualHandle={setManualHandle}
              showHandleInput={false}
              pendingKey={pendingKey}
              isPending={isPending}
              pendingHandle={verification?.pending_handle}
              verifyError={verifyError}
              verifyMsg={verifyMsg}
              verifyGenerating={verifyGenerating}
              verifyChecking={verifyChecking}
              copied={copied}
              onGenerate={handleGenerate}
              onCheck={handleCheck}
              onCopy={handleCopy}
            />
          </div>
        )}

        {/* ── Pending verification (no profile yet) ────────── */}
        {!rsiLoading && !hasProfileData && isPending && (
          <VerifyManualFlow
            handle=""
            manualHandle={manualHandle}
            setManualHandle={setManualHandle}
            showHandleInput={false}
            pendingKey={pendingKey}
            isPending={isPending}
            pendingHandle={verification?.pending_handle}
            verifyError={verifyError}
            verifyMsg={verifyMsg}
            verifyGenerating={verifyGenerating}
            verifyChecking={verifyChecking}
            copied={copied}
            onGenerate={handleGenerate}
            onCheck={handleCheck}
            onCopy={handleCopy}
          />
        )}

        {/* ── Unverified profile with data ─────────────────── */}
        {!rsiLoading && hasProfileData && !isVerified && !handleChanged && !isPending && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {displayAvatar && (
                <img
                  src={displayAvatar}
                  alt={`${displayHandle} avatar`}
                  className="w-16 h-16 rounded border border-sc-border object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-white tracking-wide text-sm font-medium">
                    {displayHandle}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded font-display uppercase tracking-wider">
                    Unverified
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Your RSI profile is synced but not verified. Verify to prove handle ownership.
            </p>
            <VerifyManualFlow
              handle={displayHandle}
              manualHandle={manualHandle}
              setManualHandle={setManualHandle}
              showHandleInput={false}
              pendingKey={pendingKey}
              isPending={false}
              pendingHandle={null}
              verifyError={verifyError}
              verifyMsg={verifyMsg}
              verifyGenerating={verifyGenerating}
              verifyChecking={verifyChecking}
              copied={copied}
              onGenerate={handleGenerate}
              onCheck={handleCheck}
              onCopy={handleCopy}
            />
          </div>
        )}

        {/* ── No data — two options ────────────────────────── */}
        {hasNoData && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Link your Star Citizen identity to unlock fleet sync, org features, and more.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Extension sync card */}
              <div className="p-4 bg-sc-darker border border-sc-border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-sc-accent" />
                  <p className="text-xs font-display uppercase tracking-wider text-white">Via Extension</p>
                </div>
                <p className="text-xs text-gray-500">
                  Install the SC Bridge extension for automatic sync with full hangar data.
                </p>
                <p className="text-[10px] text-gray-600">
                  Auto-verifies your identity.
                </p>
              </div>

              {/* Manual verification card */}
              <div className="p-4 bg-sc-darker border border-sc-border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sc-accent" />
                  <p className="text-xs font-display uppercase tracking-wider text-white">Verify Manually</p>
                </div>
                <p className="text-xs text-gray-500">
                  Prove handle ownership by adding a key to your RSI bio.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={manualHandle}
                    onChange={(e) => setManualHandle(e.target.value)}
                    placeholder="Your RSI handle"
                    className="w-full px-3 py-2 bg-sc-dark border border-sc-border rounded text-xs text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={verifyGenerating || !manualHandle.trim()}
                    className="btn-primary w-full px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {verifyGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {verifyGenerating ? 'Starting...' : 'Start Verification'}
                  </button>
                </div>
                {verifyError && (
                  <div className="flex items-center gap-2 p-2 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelSection>
    </div>
  )
}

/** Shared manual verification flow UI */
function VerifyManualFlow({
  handle,
  manualHandle, setManualHandle,
  showHandleInput = true,
  pendingKey, isPending, pendingHandle,
  verifyError, verifyMsg,
  verifyGenerating, verifyChecking,
  copied,
  onGenerate, onCheck, onCopy,
}) {
  const activeKey = pendingKey
  const activeHandle = pendingHandle || handle || manualHandle

  return (
    <div className="space-y-3">
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

      {/* Pending with key — show instructions */}
      {(isPending || activeKey) && (
        <div className="space-y-2">
          {activeKey && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">
                Add this key to your{' '}
                <a
                  href="https://robertsspaceindustries.com/en/account/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sc-accent hover:underline inline-flex items-center gap-1"
                >
                  RSI profile Short Bio
                  <ExternalLink className="w-3 h-3" />
                </a>
                , save it, then click Check:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-sc-darker border border-sc-border rounded text-xs text-green-400 font-mono select-all break-all">
                  {activeKey}
                </code>
                <button
                  onClick={() => onCopy(activeKey)}
                  className="p-2 rounded border border-sc-border hover:border-sc-accent/30 hover:bg-sc-accent/10 transition-colors shrink-0"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
            </div>
          )}
          {!activeKey && isPending && (
            <p className="text-xs text-gray-400">
              Verification pending for <span className="text-white">{activeHandle}</span>.
              Add the key from earlier to your RSI Short Bio, then check.
            </p>
          )}
          <button
            onClick={onCheck}
            disabled={verifyChecking}
            className="btn-primary px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center gap-2 disabled:opacity-50"
          >
            {verifyChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {verifyChecking ? 'Checking...' : 'Check Verification'}
          </button>
        </div>
      )}

      {/* No pending — show generate button */}
      {!isPending && !activeKey && (
        <div className="space-y-2">
          {showHandleInput && (
            <input
              type="text"
              value={manualHandle}
              onChange={(e) => setManualHandle(e.target.value)}
              placeholder="Your RSI handle"
              className="w-full px-3 py-2 bg-sc-darker border border-sc-border rounded text-xs text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
            />
          )}
          <p className="text-xs text-gray-500">
            Prove you own this RSI handle by adding a verification key to your Short Bio.
          </p>
          <button
            onClick={onGenerate}
            disabled={verifyGenerating}
            className="btn-primary px-3 py-2 text-xs font-display tracking-wider uppercase flex items-center gap-2 disabled:opacity-50"
          >
            {verifyGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {verifyGenerating ? 'Starting...' : 'Start Verification'}
          </button>
        </div>
      )}
    </div>
  )
}
