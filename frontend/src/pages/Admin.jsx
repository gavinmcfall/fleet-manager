import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Globe, Play, AlertCircle, Ticket, Copy, Check, Trash2, FlaskConical, Image, ThumbsUp, X, ExternalLink, DollarSign } from 'lucide-react'
import { useSyncStatus, triggerRSISync, triggerFullSync, triggerUexSync, setPreferences } from '../hooks/useAPI'
import useTimezone from '../hooks/useTimezone'

import { formatDate } from '../lib/dates'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import PanelSection from '../components/PanelSection'
import ConfirmDialog from '../components/ConfirmDialog'

const syncActions = [
  { id: 'rsi', label: 'RSI API', icon: Globe, trigger: triggerRSISync, description: 'Ship images from RSI GraphQL API' },
  // F279: manual UEX trigger — bypasses the 2h cron when community prices need a fresh pull.
  { id: 'uex', label: 'UEX Prices', icon: DollarSign, trigger: () => triggerUexSync('all'), description: 'Commodity + item prices from UEX Corp' },
]

function InvitePanel() {
  const [invites, setInvites] = useState([])
  const [generating, setGenerating] = useState(false)
  const [newUrl, setNewUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  // F276: confirm before generating — guards against accidental one-click
  // invite minting (every invite is an open door).
  const [confirmOpen, setConfirmOpen] = useState(false)
  const urlRef = useRef(null)

  useEffect(() => {
    fetch('/api/admin/invites', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setInvites)
      .catch(() => {})
  }, [])

  const handleGenerate = async () => {
    setConfirmOpen(false)
    setGenerating(true)
    setNewUrl(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      setNewUrl(data.url)
      setInvites((prev) => [{ token: data.token, created_at: new Date().toISOString(), used_at: null }, ...prev])
    } catch {
      // silently fail — user can retry
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!newUrl) return
    navigator.clipboard.writeText(newUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <PanelSection title="Invite Links" icon={Ticket}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={generating}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Ticket className="w-3.5 h-3.5" />
            {generating ? 'Generating...' : 'Generate Invite'}
          </button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onConfirm={handleGenerate}
          onCancel={() => setConfirmOpen(false)}
          title="Generate Invite Link"
          message="This creates a single-use invite link that registers the next person who opens it as a new SC Bridge user. Make sure you trust the recipient before sharing."
          confirmLabel="Generate"
          variant="warning"
        />

        {newUrl && (
          <div className="flex items-center gap-2">
            <input
              ref={urlRef}
              readOnly
              value={newUrl}
              onClick={(e) => e.target.select()}
              className="flex-1 px-3 py-2 bg-sc-darker border border-sc-accent/40 rounded text-xs font-mono text-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50 cursor-pointer"
            />
            <button
              onClick={handleCopy}
              className="p-2 border border-sc-border rounded hover:border-sc-accent/40 transition-colors text-gray-400 hover:text-white"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-sc-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Invite tokens</caption>
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sc-border/30">
                {invites.map((inv) => (
                  <tr key={inv.token} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-xs font-mono text-gray-400 truncate max-w-[160px]" title={inv.token}>
                      {inv.token.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">
                      {inv.created_at ? new Date(inv.created_at + 'Z').toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {inv.used_at ? (
                        <span className="text-xs font-mono text-gray-500">Used</span>
                      ) : (
                        <span className="text-xs font-mono text-sc-success">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelSection>
  )
}


// "All Cache" lives at the BOTTOM so the default (first) selection is the
// safer "All Game Data" prefix — the default previously was "All Cache" which
// made a single mis-click nuke the entire KV namespace (F274).
const CACHE_PREFIXES = [
  { value: 'gd:',            label: 'All Game Data' },
  { value: 'gd:npc-loadout', label: 'NPC Loadouts' },
  { value: 'gd:vehicles',    label: 'Vehicles' },
  { value: 'gd:shops',       label: 'Shops' },
  { value: 'gd:loot',        label: 'Loot' },
  { value: 'gd:missions',    label: 'Missions' },
  { value: 'gd:factions',    label: 'Factions' },
  { value: 'gd:contracts',   label: 'Contracts' },
  { value: '',               label: 'All Cache (danger)' },
]

function CachePurgePanel() {
  // Default to the safer "All Game Data" prefix (first entry). Users have to
  // explicitly select "All Cache (danger)" at the bottom of the list to nuke
  // everything. All purges go through ConfirmDialog (F274).
  const [prefix, setPrefix] = useState(CACHE_PREFIXES[0].value)
  const [purging, setPurging] = useState(false)
  const [result, setResult] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const selectedLabel = CACHE_PREFIXES.find((p) => p.value === prefix)?.label || prefix
  const isAllCache = prefix === ''

  const doPurge = async () => {
    setConfirming(false)
    setPurging(true)
    setResult(null)
    try {
      const body = prefix ? { prefix } : {}
      const res = await fetch('/api/admin/cache/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Purge failed')
      const data = await res.json()
      setResult({ type: 'success', message: `Purged ${data.deleted} key${data.deleted !== 1 ? 's' : ''}` })
      setTimeout(() => setResult(null), 4000)
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally {
      setPurging(false)
    }
  }

  return (
    <PanelSection title="KV Cache" icon={Trash2}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="flex-1 px-3 py-2 bg-sc-darker border border-sc-border rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
          >
            {CACHE_PREFIXES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}{p.value ? ` (${p.value}*)` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setConfirming(true)}
            disabled={purging}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {purging ? 'Purging...' : 'Purge'}
          </button>
        </div>
        {result && (
          <p className={`text-xs font-mono ${result.type === 'success' ? 'text-sc-success' : 'text-sc-danger'}`}>
            {result.message}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onConfirm={doPurge}
        onCancel={() => setConfirming(false)}
        title={isAllCache ? 'Purge ALL Cache' : 'Purge Cache'}
        message={
          isAllCache
            ? 'This will drop every KV cache entry site-wide. The next request to each cached endpoint will hit the DB and write a fresh cache entry. Continue?'
            : `Purge KV entries matching "${prefix}*" (${selectedLabel})?`
        }
        confirmLabel={isAllCache ? 'Purge All Cache' : 'Purge'}
        variant={isAllCache ? 'danger' : 'warning'}
      />
    </PanelSection>
  )
}

function PTUPurgePanel() {
  const [channel, setChannel] = useState('PTU')
  const [purging, setPurging] = useState(false)
  const [result, setResult] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const handlePurge = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setPurging(true)
    setResult(null)
    setConfirming(false)
    try {
      const res = await fetch('/api/admin/versions/ptu', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ channel }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Purge failed')
      }
      const data = await res.json()
      setResult({ type: 'success', message: `Purged ${data.tables_purged} tables for ${data.channel}` })
      setTimeout(() => setResult(null), 6000)
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally {
      setPurging(false)
    }
  }

  return (
    <PanelSection title="PTU Data" icon={FlaskConical}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500">
          Purge all game data for a PTU/EPTU channel. The version row is preserved so users don't need to reselect after new data is loaded.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={channel}
            onChange={(e) => { setChannel(e.target.value); setConfirming(false) }}
            className="px-3 py-2 bg-sc-darker border border-sc-border rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
          >
            <option value="PTU">PTU</option>
            <option value="EPTU">EPTU</option>
          </select>
          <button
            onClick={handlePurge}
            disabled={purging}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded font-medium transition-colors disabled:opacity-50 ${
              confirming
                ? 'bg-sc-danger text-white hover:bg-sc-danger/80'
                : 'btn-primary'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {purging ? 'Purging...' : confirming ? `Confirm purge ${channel}?` : `Purge ${channel} Data`}
          </button>
          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          )}
        </div>
        {result && (
          <p className={`text-xs font-mono ${result.type === 'success' ? 'text-sc-success' : 'text-sc-danger'}`}>
            {result.message}
          </p>
        )}
      </div>
    </PanelSection>
  )
}

/** Construct large RSI image URL from thumbnail URL */
function rsiLargeUrl(thumbUrl) {
  if (!thumbUrl) return null
  // media.robertsspaceindustries.com/{id}/subscribers_vault_thumbnail.jpg → store_large.jpg
  return thumbUrl.replace(/\/[^/]+$/, '/store_large.jpg')
}

/** Status badges for image captures */
function CaptureBadge({ label, yes }) {
  return (
    <span className={`text-[10px] px-1.5 py-px rounded font-mono ${yes ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.04] text-gray-600 border border-white/[0.06]'}`}>
      {label}: {yes ? 'Yes' : 'No'}
    </span>
  )
}

function ImageCapturePanel() {
  const [captures, setCaptures] = useState([])
  const [kinds, setKinds] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [kindFilter, setKindFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  // F278: confirm promote + ignore actions to prevent single-click mistakes
  // on ~125 pending rows (both write to prod CF Images / DB).
  const [pendingAction, setPendingAction] = useState(null) // { type: 'promote'|'ignore', id, title }

  const fetchCaptures = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), promoted: '0' })
      if (kindFilter) params.set('kind', kindFilter)
      const res = await fetch(`/api/admin/image-captures?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      setCaptures(data.captures || [])
      setTotal(data.total || 0)
      setKinds(data.kinds || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, kindFilter])

  useEffect(() => { fetchCaptures() }, [fetchCaptures])

  const handlePromote = async (id) => {
    await fetch(`/api/admin/image-captures/${id}/promote`, { method: 'POST', credentials: 'same-origin' })
    setCaptures(prev => prev.filter(c => c.id !== id))
    setTotal(prev => prev - 1)
  }

  const handleDecline = async (id) => {
    await fetch(`/api/admin/image-captures/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    setCaptures(prev => prev.filter(c => c.id !== id))
    setTotal(prev => prev - 1)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <PanelSection title={`Image Captures (${total} pending)`} icon={Image}>
      {/* Kind filter pills */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setKindFilter(''); setPage(1) }}
          className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${!kindFilter ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30' : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'}`}
        >All</button>
        {kinds.map(k => (
          <button
            key={k.kind}
            onClick={() => { setKindFilter(k.kind); setPage(1) }}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${kindFilter === k.kind ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30' : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'}`}
          >{k.kind || 'Unknown'} <span className="text-gray-600 ml-1">{k.cnt}</span></button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-600 text-sm">Loading...</div>
      ) : captures.length === 0 ? (
        <div className="p-8 text-center text-gray-600 text-sm">No pending image captures</div>
      ) : (
        /* Table header */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left">Image</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-center">Matched</th>
                <th className="px-3 py-2 text-center">CDN</th>
                <th className="px-3 py-2 text-center">New</th>
                <th className="px-3 py-2 text-center">Seen</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {captures.map(cap => {
                const hasMatch = !!(cap.vehicle_slug || cap.vehicle_id || cap.matched_paint_id || cap.matched_loot_id || cap.matched_component_id || cap.kind === 'Hangar decoration')
                const cdnImage = cap.current_vehicle_image || cap.matched_paint_image
                const hasCDN = !!(cdnImage && cdnImage.includes('imagedelivery.net'))
                const isNew = cap.seen_count <= 1

                return (
                  <tr key={cap.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Thumbnail — click for large preview */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setPreview(rsiLargeUrl(cap.url) || cap.url)}
                        className="flex-shrink-0 w-20 h-14 rounded overflow-hidden bg-white/[0.04] cursor-pointer hover:ring-2 hover:ring-sc-accent/50 transition-all block"
                      >
                        <img src={cap.url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                      </button>
                    </td>

                    {/* Title + slug */}
                    <td className="px-3 py-2">
                      <div className="text-gray-200 truncate max-w-[250px]">{cap.title || 'Untitled'}</div>
                      {cap.vehicle_slug && <div className="text-[11px] text-sc-accent font-mono">{cap.vehicle_slug}</div>}
                    </td>

                    {/* Type/Kind */}
                    <td className="px-3 py-2">
                      <span className="text-[11px] bg-white/[0.04] px-2 py-0.5 rounded text-gray-400">{cap.kind || '—'}</span>
                    </td>

                    {/* Matched to DB */}
                    <td className="px-3 py-2 text-center">
                      <CaptureBadge label="DB" yes={hasMatch} />
                    </td>

                    {/* CDN has image */}
                    <td className="px-3 py-2 text-center">
                      <CaptureBadge label="CDN" yes={hasCDN} />
                    </td>

                    {/* New image (first time seen) */}
                    <td className="px-3 py-2 text-center">
                      {isNew
                        ? <span className="text-[10px] px-1.5 py-px rounded font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">New</span>
                        : <span className="text-[10px] text-gray-700">—</span>
                      }
                    </td>

                    {/* Seen count */}
                    <td className="px-3 py-2 text-center">
                      <span className="font-mono text-[11px] text-gray-500">{cap.seen_count}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPendingAction({ type: 'promote', id: cap.id, title: cap.title })} className="px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer" title="Promote to CDN">
                          Promote
                        </button>
                        <button onClick={() => setPendingAction({ type: 'ignore', id: cap.id, title: cap.title })} className="px-2 py-1 text-[10px] bg-white/[0.04] text-gray-500 border border-white/[0.06] rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors cursor-pointer" title="Decline permanently">
                          Ignore
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/[0.04]">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 text-xs bg-white/[0.04] rounded disabled:opacity-30 cursor-pointer">Prev</button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 text-xs bg-white/[0.04] rounded disabled:opacity-30 cursor-pointer">Next</button>
        </div>
      )}

      {/* Full-size preview modal — shows store_large.jpg variant */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/80 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingAction}
        onConfirm={async () => {
          if (!pendingAction) return
          const { type, id } = pendingAction
          setPendingAction(null)
          if (type === 'promote') await handlePromote(id)
          else await handleDecline(id)
        }}
        onCancel={() => setPendingAction(null)}
        title={pendingAction?.type === 'promote' ? 'Promote Image to CDN' : 'Decline Image Capture'}
        message={pendingAction?.type === 'promote'
          ? `Upload "${pendingAction?.title || 'this image'}" to Cloudflare Images and mark the capture promoted. This counts against the CF Images quota and is hard to reverse.`
          : `Permanently discard "${pendingAction?.title || 'this image'}". The capture will be removed; the next sync can recapture it if it's still in the RSI store.`}
        confirmLabel={pendingAction?.type === 'promote' ? 'Promote' : 'Discard'}
        variant={pendingAction?.type === 'promote' ? 'warning' : 'danger'}
      />
    </PanelSection>
  )
}

export default function Admin() {
  const { timezone } = useTimezone()
  const { data: syncHistory, loading, error, refetch } = useSyncStatus()
  const [triggering, setTriggering] = useState(null)
  const [triggerError, setTriggerError] = useState(null)
  const [fullSyncConfirm, setFullSyncConfirm] = useState(false)

  const handleTrigger = async (id, triggerFn) => {
    setTriggering(id)
    setTriggerError(null)
    try {
      await triggerFn()
      setTimeout(refetch, 2000)
    } catch (err) {
      setTriggerError(err.message)
    } finally {
      setTriggering(null)
    }
  }

  // Full Sync runs the entire RSI ship-matrix + image chain (expensive, slow,
  // API-cost heavy). Require explicit confirmation before kicking it off (F275).
  const confirmFullSync = async () => {
    setFullSyncConfirm(false)
    setTriggering('all')
    setTriggerError(null)
    try {
      await triggerFullSync()
      setTimeout(refetch, 5000)
    } catch (err) {
      setTriggerError(err.message)
    } finally {
      setTriggering(null)
    }
  }

  if (loading) return <LoadingState variant="skeleton" />

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="ADMIN"
        subtitle="Sync management and system controls"
        actions={
          <button
            onClick={() => setFullSyncConfirm(true)}
            disabled={triggering !== null}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            {triggering === 'all' ? 'Running...' : 'Full Sync'}
          </button>
        }
      />

      <ConfirmDialog
        open={fullSyncConfirm}
        onConfirm={confirmFullSync}
        onCancel={() => setFullSyncConfirm(false)}
        title="Run Full Sync"
        message="Full Sync kicks off the RSI ship-matrix poller + image download chain. It's long-running, hits external RSI APIs, and consumes Worker CPU. Continue?"
        confirmLabel="Run Full Sync"
        variant="warning"
      />

      {triggerError && (
        <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{triggerError}</span>
        </div>
      )}

      {/* PTU Data */}
      <PTUPurgePanel />

      {/* KV Cache */}
      <CachePurgePanel />

      {/* Invite Links */}
      <InvitePanel />

      {/* Manual Sync Triggers */}
      <PanelSection title="Sync Triggers" icon={RefreshCw}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {syncActions.map(({ id, label, icon: Icon, trigger, description }) => (
            <button
              key={id}
              onClick={() => handleTrigger(id, trigger)}
              disabled={triggering !== null}
              className="flex items-start gap-3 p-3 bg-sc-darker border border-sc-border rounded hover:border-sc-accent/40 transition-all text-left disabled:opacity-50"
            >
              <Icon className="w-4 h-4 text-sc-accent mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-white block">
                  {triggering === id ? 'Triggering...' : label}
                </span>
                <span className="text-xs text-gray-500">{description}</span>
              </div>
            </button>
          ))}
        </div>
      </PanelSection>

      {/* Sync History */}
      {syncHistory && syncHistory.length > 0 && (
        <PanelSection title="Sync History" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Data sync history</caption>
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Records</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Started</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sc-border/30">
                {syncHistory.map((s, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-2 text-xs font-mono ${
                        s.status === 'success' ? 'text-sc-success' :
                        s.status === 'error' ? 'text-sc-danger' : 'text-sc-warn'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          s.status === 'success' ? 'bg-sc-success' :
                          s.status === 'error' ? 'bg-sc-danger' : 'bg-sc-warn animate-pulse'
                        }`} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-300">
                      {s.source_label || s.endpoint}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-400 text-right">
                      {(s.record_count || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                      {formatDate(s.started_at, timezone)}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-sc-danger truncate max-w-[200px]" title={s.error_message || ''}>
                      {s.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelSection>
      )}

      {error && (
        <div className="text-center text-gray-500 text-sm py-8">
          Failed to load sync history: {error}
        </div>
      )}

      {/* Image Captures — at bottom, large panel */}
      <ImageCapturePanel />
    </div>
  )
}
