import React, { useState } from 'react'
import { RefreshCw, Globe, Play, AlertCircle, DollarSign } from 'lucide-react'
import { useSyncStatus, triggerRSISync, triggerFullSync, triggerUexSync } from '../../hooks/useAPI'
import useTimezone from '../../hooks/useTimezone'
import { formatDate } from '../../lib/dates'
import LoadingState from '../../components/LoadingState'
import PanelSection from '../../components/PanelSection'
import ConfirmDialog from '../../components/ConfirmDialog'

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

export default function AdminSync() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setFullSyncConfirm(true)}
          disabled={triggering !== null}
          className="btn-primary flex items-center gap-2"
        >
          <Play className="w-3.5 h-3.5" />
          {triggering === 'all' ? 'Running...' : 'Full Sync'}
        </button>
      </div>

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
    </div>
  )
}
