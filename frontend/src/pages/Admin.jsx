import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Globe, Play, AlertCircle, Ticket, Copy, Check, Trash2, FlaskConical, Image, ThumbsUp, X, ExternalLink, DollarSign } from 'lucide-react'
import { useSyncStatus, triggerRSISync, triggerFullSync, triggerUexSync, setPreferences } from '../hooks/useAPI'
import useTimezone from '../hooks/useTimezone'

import { formatDate } from '../lib/dates'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import PanelSection from '../components/PanelSection'
import ConfirmDialog from '../components/ConfirmDialog'

// D1 write cost hints on each entry — surfaced under each button so admins
// see the cost before clicking. Every manual fire does the same writes as the
// corresponding cron, which bills into the monthly D1 row-write quota.
// Context: feedback_d1_write_cost_awareness.md (2026-04 incident: $200 bill
// for 184M writes, mostly pipeline reloads + cron churn).
const syncActions = [
  { id: 'rsi', label: 'RSI API', icon: Globe, trigger: triggerRSISync,
    description: 'Ship images from RSI GraphQL API', costHint: '~1.3k D1 writes' },
  // F279: manual UEX trigger — bypasses the 2h cron when community prices need a fresh pull.
  { id: 'uex', label: 'UEX Prices', icon: DollarSign, trigger: () => triggerUexSync('all'),
    description: 'Commodity + item prices from UEX Corp', costHint: '~5.5k D1 writes' },
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
  // Default: hide captures we already have a CDN image for elsewhere
  // (linked vehicle, matched paint, or pledge_item_media entry).
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  // F278: confirm promote + ignore actions to prevent single-click mistakes
  // on ~125 pending rows (both write to prod CF Images / DB).
  const [pendingAction, setPendingAction] = useState(null) // { type: 'promote'|'ignore', id, title }
  // Paint-match dialog state — { capture: { id, title } } when open
  const [paintMatchFor, setPaintMatchFor] = useState(null)

  const fetchCaptures = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), promoted: '0' })
      if (kindFilter) params.set('kind', kindFilter)
      if (showAll) params.set('show_all', '1')
      const res = await fetch(`/api/admin/image-captures?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      setCaptures(data.captures || [])
      setTotal(data.total || 0)
      setKinds(data.kinds || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, kindFilter, showAll])

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
    <PanelSection title={`Image Captures (${total} ${showAll ? 'pending' : 'unseen'})`} icon={Image}>
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
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => { setShowAll(e.target.checked); setPage(1) }}
              className="cursor-pointer"
            />
            Show captures we already have
          </label>
        </div>
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
                <th className="px-3 py-2 text-left">Paint match</th>
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

                    {/* Paint match — for Skin captures, surface the
                        resolved canonical paint (or a "Pick paint"
                        button when nothing auto-matched). */}
                    <td className="px-3 py-2">
                      {cap.kind !== 'Skin' ? (
                        <span className="text-[10px] text-gray-700">—</span>
                      ) : cap.matched_paint_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-px rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Matched to a canonical paint row">
                            ✓
                          </span>
                          <span className="text-[11px] text-gray-300 truncate max-w-[180px]" title={cap.matched_paint_name || ''}>
                            {cap.matched_paint_name || `paint #${cap.matched_paint_id}`}
                          </span>
                          <button
                            onClick={() => setPaintMatchFor({ id: cap.id, title: cap.title })}
                            className="text-[10px] text-gray-500 hover:text-sc-accent cursor-pointer"
                            title="Change paint match"
                          >
                            change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPaintMatchFor({ id: cap.id, title: cap.title })}
                          className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Pick a canonical paint row from the master list"
                        >
                          Pick paint
                        </button>
                      )}
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

      {paintMatchFor && (
        <PaintPickerDialog
          capture={paintMatchFor}
          onClose={() => setPaintMatchFor(null)}
          onMatched={() => { setPaintMatchFor(null); fetchCaptures() }}
        />
      )}
    </PanelSection>
  )
}

/**
 * Modal: search the paints master list and pick a canonical row to
 * link a capture to. Renders inline on top of the captures table.
 */
function PaintPickerDialog({ capture, onClose, onMatched }) {
  const [query, setQuery] = useState(capture.title?.split(' - ')[0] || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const search = useCallback(async (q) => {
    if (!q || !q.trim()) { setResults([]); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/paints/search?q=${encodeURIComponent(q.trim())}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResults(data.paints || [])
    } catch (err) {
      setError(err.message)
      setResults([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  const link = async (paintId) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/image-captures/${capture.id}/paint-match`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paint_id: paintId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onMatched()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const unlink = async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/admin/image-captures/${capture.id}/paint-match`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paint_id: null }),
      })
      onMatched()
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer" onClick={() => !submitting && onClose()}>
      <div onClick={e => e.stopPropagation()} className="bg-sc-darker border border-white/10 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col cursor-default">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-display uppercase tracking-wider text-gray-300">Pick paint for "{capture.title}"</h3>
          <p className="text-[10px] text-gray-600 mt-1">Search by paint name, class_name, or slug. Linked paints drop out of the unseen view.</p>
        </div>
        <div className="px-5 pt-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. red alert, pisces, bis2952"
            className="w-full px-2 py-1.5 text-sm bg-black/40 border border-white/10 rounded text-gray-200 focus:border-sc-accent/50 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="p-6 text-center text-gray-600 text-xs">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-xs">{query.trim() ? 'No paints match.' : 'Type to search.'}</div>
          ) : (
            <div className="space-y-1">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => link(p.id)}
                  disabled={submitting}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/[0.04] flex items-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <span className={`text-[10px] px-1.5 py-px rounded font-mono ${p.has_image ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.04] text-gray-600 border border-white/[0.06]'}`}>
                    {p.has_image ? 'CDN' : 'no img'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-gray-500 truncate">{p.class_name}{p.vehicle_names ? ` · ${p.vehicle_names}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && (
          <div className="px-5 py-2 text-xs text-sc-danger bg-sc-danger/10 border-t border-sc-danger/20">{error}</div>
        )}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <button onClick={unlink} disabled={submitting} className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-gray-500 hover:text-gray-300 cursor-pointer disabled:opacity-30">
            Clear match
          </button>
          <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-gray-400 hover:text-gray-200 cursor-pointer disabled:opacity-30">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Item Media Library — manages pledge_item_media: one canonical
 * CF-hosted image per pledge-item title. Used as the fallback source
 * for /api/hangar when the extension's scrape didn't capture a URL.
 *
 * Two views: existing entries (with reference_count + delete) and
 * top gap titles (sorted by missing_count, with quick-add form).
 */
function ItemMediaPanel() {
  const [view, setView] = useState('entries') // 'entries' | 'gaps'
  const [entries, setEntries] = useState([])
  const [gaps, setGaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadFor, setUploadFor] = useState(null) // { title } | null
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, gRes] = await Promise.all([
        fetch('/api/admin/item-media', { credentials: 'same-origin' }),
        fetch('/api/admin/item-media/gap-titles', { credentials: 'same-origin' }),
      ])
      const eData = await eRes.json()
      const gData = await gRes.json()
      setEntries(eData.items || [])
      setGaps(gData.titles || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFor || !sourceUrl) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/admin/item-media', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: uploadFor.title, source_url: sourceUrl, notes: notes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setUploadFor(null)
      setSourceUrl('')
      setNotes('')
      await refetch()
    } catch (err) {
      setSubmitError(err.message)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this item-media entry? Hangar UI will fall back to the placeholder for items with this title.')) return
    await fetch(`/api/admin/item-media/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Length': '0' },
    })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <PanelSection title="Item Media Library" icon={Image}>
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button
          onClick={() => setView('entries')}
          className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${view === 'entries' ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30' : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'}`}
        >Entries <span className="text-gray-600 ml-1">{entries.length}</span></button>
        <button
          onClick={() => setView('gaps')}
          className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${view === 'gaps' ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30' : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'}`}
        >Gap Titles <span className="text-gray-600 ml-1">{gaps.length}</span></button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-600 text-sm">Loading...</div>
      ) : view === 'entries' ? (
        entries.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">No item-media entries yet. Switch to Gap Titles to seed images for the highest-impact items.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left">Image</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-center">References</th>
                  <th className="px-3 py-2 text-left">Uploaded</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2">
                      <div className="w-20 h-14 rounded overflow-hidden bg-white/[0.04]">
                        <img src={e.cf_image_url} alt="" className="w-full h-full object-cover" onError={ev => { ev.target.style.display = 'none' }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-200 truncate max-w-[300px]">{e.title}</td>
                    <td className="px-3 py-2 text-center text-sc-accent font-mono">{e.reference_count}</td>
                    <td className="px-3 py-2 text-[11px] text-gray-500 font-mono">{e.uploaded_at?.replace('T', ' ').slice(0, 16) || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="px-2 py-1 text-xs bg-sc-danger/10 hover:bg-sc-danger/20 border border-sc-danger/30 text-sc-danger rounded cursor-pointer"
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        gaps.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">No gap titles — every item without a scrape image_url already has a media entry.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-center">Missing</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {gaps.map((g, i) => (
                  <tr key={`${g.title}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-gray-200 truncate max-w-[400px]">{g.title}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-gray-500">{g.kind || '—'}</td>
                    <td className="px-3 py-2 text-center text-amber-400 font-mono">{g.missing_count}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setUploadFor(g); setSourceUrl(''); setNotes(''); setSubmitError(null) }}
                        className="px-2 py-1 text-xs bg-sc-accent/10 hover:bg-sc-accent/20 border border-sc-accent/30 text-sc-accent rounded cursor-pointer"
                      >Add image</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Upload dialog — pasting a public source URL is enough; CF Images
          fetches it server-side. */}
      {uploadFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer" onClick={() => !submitting && setUploadFor(null)}>
          <form
            onSubmit={handleUpload}
            onClick={e => e.stopPropagation()}
            className="bg-sc-darker border border-white/10 rounded-lg p-5 w-full max-w-lg space-y-3 cursor-default"
          >
            <h3 className="text-sm font-display uppercase tracking-wider text-gray-300">Add image for "{uploadFor.title}"</h3>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Source image URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                required
                placeholder="https://..."
                className="w-full px-2 py-1.5 text-sm bg-black/40 border border-white/10 rounded text-gray-200 focus:border-sc-accent/50 outline-none"
              />
              <div className="text-[10px] text-gray-600 mt-1">CF Images fetches this URL server-side and stores the result.</div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. RSI store screenshot 2026-05"
                className="w-full px-2 py-1.5 text-sm bg-black/40 border border-white/10 rounded text-gray-200 focus:border-sc-accent/50 outline-none"
              />
            </div>
            {submitError && (
              <div className="text-xs text-sc-danger bg-sc-danger/10 border border-sc-danger/20 rounded px-2 py-1.5">{submitError}</div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setUploadFor(null)} disabled={submitting} className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded text-gray-400 hover:text-gray-200 cursor-pointer disabled:opacity-30">Cancel</button>
              <button type="submit" disabled={submitting || !sourceUrl} className="px-3 py-1.5 text-xs bg-sc-accent/15 border border-sc-accent/40 rounded text-sc-accent hover:bg-sc-accent/25 cursor-pointer disabled:opacity-30">
                {submitting ? 'Uploading…' : 'Upload to CF Images'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PanelSection>
  )
}

export default function Admin() {
  const { timezone } = useTimezone()
  const { data: syncHistory, loading, error, refetch } = useSyncStatus()
  const [triggering, setTriggering] = useState(null)
  const [triggerError, setTriggerError] = useState(null)
  // Per-button last-run result: { id, data, at } — shows inline diff/summary
  // after a manual trigger so QA can confirm what actually happened without
  // waiting on the next sync_history refresh.
  const [triggerResult, setTriggerResult] = useState(null)
  const [fullSyncConfirm, setFullSyncConfirm] = useState(false)

  const handleTrigger = async (id, triggerFn) => {
    setTriggering(id)
    setTriggerError(null)
    setTriggerResult(null)
    try {
      const data = await triggerFn()
      setTriggerResult({ id, data, at: Date.now() })
      setTimeout(refetch, 2000)
    } catch (err) {
      setTriggerError(err.message)
    } finally {
      setTriggering(null)
    }
  }

  // Render a concise one-line summary of a trigger response. Shape varies
  // by endpoint — format what we recognise, fall back to the key count.
  const summarizeTriggerResult = (id, data) => {
    if (!data || typeof data !== 'object') return 'done'
    if (id === 'uex') {
      const c = data.commodities ?? 0
      const i = data.items ?? 0
      const errs = Array.isArray(data.errors) ? data.errors.length : 0
      return `${c} commodities · ${i} items${errs ? ` · ${errs} errors` : ''}`
    }
    if (id === 'rsi') {
      const parts = []
      if (typeof data.ships === 'number') parts.push(`${data.ships} ships`)
      if (typeof data.paints === 'number') parts.push(`${data.paints} paints`)
      return parts.length ? parts.join(' · ') : 'sync queued'
    }
    // Generic fallback — show the first 1-2 numeric keys
    const numeric = Object.entries(data).filter(([, v]) => typeof v === 'number')
    if (numeric.length > 0) {
      return numeric.slice(0, 3).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(' · ')
    }
    return 'done'
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
          {syncActions.map(({ id, label, icon: Icon, trigger, description, costHint }) => {
            const hasResult = triggerResult && triggerResult.id === id
            return (
              <button
                key={id}
                onClick={() => handleTrigger(id, trigger)}
                disabled={triggering !== null}
                className="flex items-start gap-3 p-3 bg-sc-darker border border-sc-border rounded hover:border-sc-accent/40 transition-all text-left disabled:opacity-50"
              >
                <Icon className="w-4 h-4 text-sc-accent mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white block">
                    {triggering === id ? 'Triggering...' : label}
                  </span>
                  <span className="text-xs text-gray-500 block">{description}</span>
                  {costHint && (
                    <span className="text-[10px] font-mono text-amber-500/70 block mt-0.5">
                      ⚠ {costHint}
                    </span>
                  )}
                  {hasResult && (
                    <span className="text-[11px] font-mono text-emerald-400/80 block mt-1 truncate">
                      ✓ {summarizeTriggerResult(id, triggerResult.data)}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
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

      {/* Image Captures — large panel */}
      <ImageCapturePanel />

      {/* Item Media Library — pledge-item title fallback for /api/hangar */}
      <ItemMediaPanel />
    </div>
  )
}
