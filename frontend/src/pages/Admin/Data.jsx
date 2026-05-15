import React, { useState, useEffect, useCallback } from 'react'
import { Image, X } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import ConfirmDialog from '../../components/ConfirmDialog'

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

                    {/* Reference match — surface the resolved canonical
                        row (paint / fps_weapon / fps_armour / fps_helmet /
                        vehicle_component) or expose pickers per kind. */}
                    <td className="px-3 py-2">
                      {cap.matched_kind ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-px rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Matched to ${cap.matched_kind}`}>
                            ✓ {cap.matched_kind.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-gray-300 truncate max-w-[150px]" title={cap.matched_name || ''}>
                            {cap.matched_name || `#${cap.matched_id}`}
                          </span>
                          <button
                            onClick={() => setPaintMatchFor({ id: cap.id, title: cap.title, kind: cap.kind, currentKind: cap.matched_kind })}
                            className="text-[10px] text-gray-500 hover:text-sc-accent cursor-pointer"
                            title="Change match"
                          >
                            change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPaintMatchFor({ id: cap.id, title: cap.title, kind: cap.kind, currentKind: null })}
                          className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Pick a canonical reference row"
                        >
                          Pick match
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

/** All reference kinds the polymorphic match endpoint supports. */
const MATCH_KIND_OPTIONS = [
  { value: 'paint', label: 'Paint' },
  { value: 'fps_weapon', label: 'FPS Weapon' },
  { value: 'fps_armour', label: 'FPS Armour' },
  { value: 'fps_helmet', label: 'FPS Helmet' },
  { value: 'vehicle_component', label: 'Ship Component' },
]

/**
 * Default kind for a new picker — guess from the capture's pledge
 * `kind` so the admin lands on the right reference table without
 * having to switch tabs.
 */
function defaultKindForCapture(captureKind) {
  if (captureKind === 'Skin') return 'paint'
  if (captureKind === 'Component') return 'vehicle_component'
  // FPS Equipment is ambiguous — armour or weapon. Default to weapon
  // since users own more weapons than armour pieces.
  if (captureKind === 'FPS Equipment') return 'fps_weapon'
  return 'paint'
}

/**
 * Generic picker dialog that searches any supported reference table
 * and links the capture polymorphically. The admin can switch kind
 * tabs at the top — useful when "FPS Equipment" could be either a
 * weapon or a piece of armour.
 */
function PaintPickerDialog({ capture, onClose, onMatched }) {
  const [kind, setKind] = useState(capture.currentKind || defaultKindForCapture(capture.kind))
  const [query, setQuery] = useState(capture.title?.split(' - ')[0] || capture.title || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const search = useCallback(async (q, k) => {
    if (!q || !q.trim()) { setResults([]); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/match-search?kind=${encodeURIComponent(k)}&q=${encodeURIComponent(q.trim())}`,
        { credentials: 'same-origin' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch (err) {
      setError(err.message)
      setResults([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query, kind), 250)
    return () => clearTimeout(t)
  }, [query, kind, search])

  const link = async (rowId) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/image-captures/${capture.id}/match`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id: rowId }),
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
      await fetch(`/api/admin/image-captures/${capture.id}/match`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: null, id: null }),
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
          <h3 className="text-sm font-display uppercase tracking-wider text-gray-300">Pick match for "{capture.title}"</h3>
          <p className="text-[10px] text-gray-600 mt-1">Search the reference master list. Linked rows drop out of the unseen view.</p>
        </div>
        {/* Kind tabs */}
        <div className="px-5 pt-3 flex items-center gap-1 flex-wrap">
          {MATCH_KIND_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setKind(o.value)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                kind === o.value
                  ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/30'
                  : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="px-5 pt-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, class_name, or slug…"
            className="w-full px-2 py-1.5 text-sm bg-black/40 border border-white/10 rounded text-gray-200 focus:border-sc-accent/50 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="p-6 text-center text-gray-600 text-xs">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-xs">{query.trim() ? `No ${kind.replace('_', ' ')} rows match.` : 'Type to search.'}</div>
          ) : (
            <div className="space-y-1">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => link(r.id)}
                  disabled={submitting}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/[0.04] flex items-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <span className={`text-[10px] px-1.5 py-px rounded font-mono ${r.has_image ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.04] text-gray-600 border border-white/[0.06]'}`}>
                    {r.has_image ? 'CDN' : 'no img'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{r.name}</div>
                    <div className="text-[10px] font-mono text-gray-500 truncate">{r.class_name}{r.vehicle_names ? ` · ${r.vehicle_names}` : ''}</div>
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

export default function AdminData() {
  return (
    <div className="space-y-6">
      <ImageCapturePanel />
      <ItemMediaPanel />
    </div>
  )
}
