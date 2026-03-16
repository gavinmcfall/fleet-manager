import React, { useState, useRef } from 'react'
import { useStatus, importHangarXplor, usePreferences, setPreferences, useUserSyncStatus, deleteSyncData } from '../hooks/useAPI'
import { Upload, FileJson, CheckCircle, XCircle, AlertTriangle, Loader, RefreshCw, AlertCircle, Plug, Database, Trash2, Download, ExternalLink } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AlertBanner from '../components/AlertBanner'
import PanelSection from '../components/PanelSection'
import ConfirmDialog from '../components/ConfirmDialog'
import useHangarSync, { SYNC_CATEGORIES } from '../hooks/useHangarSync'
import { formatDate } from '../lib/dates'

export default function Import() {
  const { data: appStatus, refetch: refetchStatus } = useStatus()
  const sync = useHangarSync()
  const { data: preferences, refetch: refetchPrefs } = usePreferences()
  const { data: syncStatus, refetch: refetchSyncStatus } = useUserSyncStatus()
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [notification, setNotification] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false })
  const [syncCategories, setSyncCategories] = useState(() =>
    Object.fromEntries(Object.entries(SYNC_CATEGORIES).map(([k, v]) => [k, v.default]))
  )
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  const vehicleCount = appStatus?.vehicles || 0

  const showNotification = (msg, variant = 'info') => {
    setNotification({ msg, variant })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleSyncClick = () => {
    // Reset categories to defaults each time the dialog opens
    setSyncCategories(Object.fromEntries(Object.entries(SYNC_CATEGORIES).map(([k, v]) => [k, v.default])))

    setConfirmDialog({
      open: true,
      title: 'Hangar Sync',
      message: 'sync-categories',
      variant: 'info',
      confirmLabel: 'Sync Now',
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        try {
          if (!preferences?.sync_consent) {
            await setPreferences({ sync_consent: new Date().toISOString() })
            refetchPrefs()
          }
          sync.startSync(syncCategories)
        } catch (err) {
          showNotification('Failed to start sync: ' + err.message, 'error')
        }
      },
    })
  }

  const processFile = async (file) => {
    if (!file) return

    setStatus('parsing')
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!Array.isArray(data)) {
        throw new Error('Expected a JSON array of ship entries')
      }

      const valid = data.filter((d) => d.ship_code || d.name || d.pledge_id)
      if (valid.length === 0) {
        throw new Error('No valid ship entries found in the JSON')
      }

      setPreview({
        filename: file.name,
        total: data.length,
        lti: data.filter((d) => d.lti).length,
        nonLTI: data.filter((d) => !d.lti).length,
        warbond: data.filter((d) => d.warbond).length,
        data: data,
      })
      setStatus(null)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const handleFile = (e) => processFile(e.target.files?.[0])

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.json')) {
      processFile(file)
    } else {
      setError('Please drop a .json file')
      setStatus('error')
    }
  }

  const handleImport = async () => {
    if (!preview?.data) return

    setStatus('importing')
    setError(null)

    try {
      const res = await importHangarXplor(preview.data)
      setResult(res)
      setStatus('success')
      setPreview(null)
      setTimeout(refetchStatus, 2000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="SYNC & IMPORT"
        subtitle="Sync your RSI hangar or import from HangarXplor"
      />

      {/* Inline notification */}
      {notification && (
        <div className={`panel p-4 flex items-center gap-2 text-sm animate-fade-in ${
          notification.variant === 'error' ? 'border-sc-danger/30 text-sc-danger' :
          notification.variant === 'success' ? 'border-sc-success/30 text-sc-success' :
          'text-gray-300'
        }`}>
          {notification.variant === 'success' && <CheckCircle className="w-4 h-4" />}
          {notification.variant === 'error' && <XCircle className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      <PanelSection title="SC Bridge Sync" icon={RefreshCw}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Sync your RSI hangar directly to SC Bridge using the browser extension.
            Ships, insurance, buy-back pledges, upgrade history, and account info.
          </p>

          {sync.status === 'detecting' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              Checking for extension...
            </div>
          )}

          {sync.status === 'no-extension' && (
            <div className="p-4 rounded bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <Plug className="w-4 h-4" />
                SC Bridge Sync extension not detected
              </div>
              <p className="text-xs text-gray-400">
                Install the extension to sync your hangar data directly from RSI.
              </p>
              <button onClick={sync.detect} className="text-xs text-sc-accent hover:underline">
                Retry detection
              </button>
            </div>
          )}

          {(sync.status === 'ready' || sync.status === 'complete' || sync.status === 'error') && (
            <div className="space-y-3">
              {sync.extensionVersion && (
                <div className="text-xs text-gray-500">
                  Extension v{sync.extensionVersion} detected
                </div>
              )}

              <button
                onClick={handleSyncClick}
                disabled={sync.status === 'collecting' || sync.status === 'uploading'}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </button>

              {sync.status === 'complete' && sync.result && (
                <div className="p-3 rounded bg-sc-success/10 border border-sc-success/20 text-sm text-sc-success flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Synced {sync.result.imported} ships, {sync.result.buyback_count} buy-back pledges, {sync.result.upgrade_count} upgrades
                </div>
              )}

              {sync.status === 'error' && (
                <div className="p-3 rounded bg-sc-danger/10 border border-sc-danger/20 space-y-2">
                  <div className="text-sm text-sc-danger flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {sync.error}
                  </div>
                  <button onClick={sync.retry} className="text-xs text-sc-accent hover:underline">
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {(sync.status === 'collecting' || sync.status === 'uploading') && (
            <div className="p-4 rounded bg-sc-accent/10 border border-sc-accent/20 space-y-2">
              <div className="flex items-center gap-2 text-sm text-sc-accent">
                <Loader className="w-4 h-4 animate-spin" />
                {sync.status === 'collecting' ? 'Collecting data from RSI...' : 'Saving to SC Bridge...'}
              </div>
              <p className="text-xs text-gray-400">
                {sync.status === 'collecting'
                  ? 'The extension is gathering your hangar data. This may take a minute.'
                  : 'Uploading your data to SC Bridge...'}
              </p>
            </div>
          )}
        </div>
      </PanelSection>

      <PanelSection title="Sync Data" icon={Database}>
        <div className="p-5 space-y-4">
          {syncStatus?.has_data ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Fleet ships</span>
                  <span className="text-white font-mono">{syncStatus.fleet_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Buy-back pledges</span>
                  <span className="text-white font-mono">{syncStatus.buyback_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">RSI profile</span>
                  <span className="text-white font-mono">{syncStatus.has_profile ? 'Yes' : 'No'}</span>
                </div>
                {syncStatus.last_synced && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Last synced</span>
                    <span className="text-white font-mono text-xs">{formatDate(syncStatus.last_synced)}</span>
                  </div>
                )}
                {syncStatus.consent_given && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Consent given</span>
                    <span className="text-white font-mono text-xs">{formatDate(syncStatus.consent_given)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setConfirmDialog({
                  open: true,
                  title: 'Delete All Synced Data',
                  message: `This will permanently remove all data synced from RSI:\n\n• ${syncStatus.fleet_count} fleet ship${syncStatus.fleet_count !== 1 ? 's' : ''}\n• ${syncStatus.buyback_count} buy-back pledge${syncStatus.buyback_count !== 1 ? 's' : ''}\n• RSI profile data\n• Sync consent\n\nThis cannot be undone. You can re-sync at any time.`,
                  variant: 'danger',
                  confirmLabel: 'Delete All Synced Data',
                  onConfirm: async () => {
                    setConfirmDialog({ open: false })
                    try {
                      const result = await deleteSyncData()
                      refetchSyncStatus()
                      refetchPrefs()
                      showNotification(
                        `Deleted ${result.fleet_deleted} ships, ${result.buyback_deleted} buy-back pledges${result.profile_deleted ? ', and RSI profile' : ''}`,
                        'success'
                      )
                    } catch (err) {
                      showNotification('Failed to delete sync data: ' + err.message, 'error')
                    }
                  },
                })}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border-2 border-sc-danger/30 text-sc-danger hover:bg-sc-danger/10 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All Synced Data
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No synced data. Use the SC Bridge Sync above to import your RSI hangar.
            </p>
          )}
        </div>
      </PanelSection>

      <PanelSection title="Get the Extension" icon={Download}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            The SC Bridge Sync extension connects to your RSI account and sends hangar data to SC Bridge.
          </p>
          <div className="space-y-3">
            <a
              href="https://chromewebstore.google.com/detail/sc-bridge-sync/gcokkoamjodagagbojhkimfbjjpdfefi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded border border-sc-border hover:border-sc-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#4285F4" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" fill="#4285F4"/><path d="M12 2a10 10 0 0 1 8.66 5H12" stroke="#EA4335" strokeWidth="1.5"/><path d="M3.34 7l5 8.66L12 8" stroke="#FBBC05" strokeWidth="1.5"/><path d="M20.66 7L15.66 15.66H22" stroke="#34A853" strokeWidth="1.5"/></svg>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Chrome Web Store</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">Pending Review</span>
            </a>
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/sc-bridge-sync/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded border border-sc-border hover:border-sc-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#FF7139"/><path d="M18.5 8.5c-.5-1.5-2-3-3.5-3.5.5 1 .5 2 0 3-1-2-3-3-5-3 2 2 2 4 1 6-1-1-1-3-1-3-1 2-1 4 0 6 .5 1 1.5 2 3 2.5 2 .5 4-.5 5-2 .5-1 .5-2 0-3-.5-.5-1-.5-1.5 0 .5-1 0-2-.5-2.5l-.5-.5z" fill="#FFE0C1"/></svg>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Firefox Add-ons</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">Pending Review</span>
            </a>
            <a
              href="https://microsoftedge.microsoft.com/addons/detail/sc-bridge-sync/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded border border-sc-border hover:border-sc-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V14h-2v-2h2V9.5C10 7.57 11.57 6 13.5 6H16v2h-2c-.55 0-1 .45-1 1v3h3l-.5 2H13v7.95C18.05 21.45 22 17.19 22 12c0-5.52-4.48-10-10-10z" fill="#0078D4"/></svg>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Microsoft Edge Add-ons</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">Pending Review</span>
            </a>
          </div>
        </div>
      </PanelSection>

      <details className="panel">
        <summary className="panel-header cursor-pointer select-none hover:text-gray-300 transition-colors flex items-center gap-2">
          <FileJson className="w-4 h-4 text-gray-500" />
          <span>HangarXplor Import (Legacy)</span>
        </summary>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Upload a JSON export from the HangarXplor browser extension. Includes full
            pledge and insurance details. Ship data is automatically enriched from the
            reference database (images, specs, manufacturer info).
          </p>

          {vehicleCount > 0 && (
            <div className="p-3 rounded bg-sc-accent/10 border border-sc-accent/20 text-sm text-gray-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-sc-accent" />
              Currently loaded: <span className="text-white font-medium">{vehicleCount} ships</span>
            </div>
          )}

          {vehicleCount > 0 && (
            <div className="p-3 rounded bg-sc-warn/10 border border-sc-warn/20 text-xs text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-sc-warn" />
              Importing will <span className="text-sc-warn font-medium">replace</span> your current fleet data with the new import.
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sc-accent" />
              <span>Ship names, manufacturer, images (from reference DB)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sc-accent" />
              <span>LTI / insurance type, warbond status</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sc-accent" />
              <span>Pledge name, date, and cost</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sc-accent" />
              <span>Custom ship names</span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Drop a JSON file here or click to browse for a file"
            className={`p-8 border-2 border-dashed rounded text-center cursor-pointer transition-all duration-200 ${
              dragging
                ? 'border-sc-accent bg-sc-accent/5 scale-[1.01]'
                : 'border-sc-border hover:border-sc-accent/30'
            }`}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFile}
            />
            <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? 'text-sc-accent' : 'text-gray-500'}`} aria-hidden="true" />
            <p className="text-sm text-gray-400">
              Drop <span className="text-gray-300 font-mono">.json</span> file or click to browse
            </p>
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-xl font-display font-bold text-white">{preview.total}</div>
                  <div className="text-xs font-mono text-gray-500">Total Ships</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display font-bold text-sc-lti">{preview.lti}</div>
                  <div className="text-xs font-mono text-gray-500">LTI</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display font-bold text-sc-warn">{preview.nonLTI}</div>
                  <div className="text-xs font-mono text-gray-500">Non-LTI</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display font-bold text-sc-success">{preview.warbond}</div>
                  <div className="text-xs font-mono text-gray-500">Warbond</div>
                </div>
              </div>
              <button onClick={handleImport} className="btn-primary w-full flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Import {preview.total} Ships
              </button>
            </div>
          )}

          {status === 'importing' && (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-sc-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-300">Importing...</span>
            </div>
          )}

          {status === 'success' && result && (
            <div className="p-3 rounded bg-sc-success/10 border border-sc-success/20 text-sm text-sc-success flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Import complete!
              {result.imported != null && (
                <span className="text-gray-400 ml-1">
                  {result.imported} of {result.total} entries imported
                </span>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded bg-sc-danger/10 border border-sc-danger/20 text-sm text-sc-danger flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <details>
            <summary className="cursor-pointer select-none text-sm text-gray-500 hover:text-gray-300 transition-colors">
              How to export from HangarXplor
            </summary>
            <div className="mt-3">
              <ol className="space-y-2 text-sm text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sc-accent font-mono font-bold shrink-0">1.</span>
                  Install the HangarXplor browser extension from{' '}
                  <a
                    href="https://hangarxplor.space/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sc-accent hover:underline"
                  >
                    https://hangarxplor.space/
                  </a>
                </li>
                <li className="flex gap-2">
                  <span className="text-sc-accent font-mono font-bold shrink-0">2.</span>
                  Go to <span className="font-mono text-gray-300">robertsspaceindustries.com</span> and log in
                </li>
                <li className="flex gap-2">
                  <span className="text-sc-accent font-mono font-bold shrink-0">3.</span>
                  Navigate to <span className="font-mono text-gray-300">My Hangar</span> and wait for the page to fully load
                </li>
                <li className="flex gap-2">
                  <span className="text-sc-accent font-mono font-bold shrink-0">4.</span>
                  Click the HangarXplor icon and export as JSON
                </li>
                <li className="flex gap-2">
                  <span className="text-sc-accent font-mono font-bold shrink-0">5.</span>
                  Upload the exported JSON file above
                </li>
              </ol>
            </div>
          </details>
        </div>
      </details>

      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog({ open: false })}
        title={confirmDialog.title}
        message={confirmDialog.message !== 'sync-categories' ? confirmDialog.message : undefined}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
      >
        {confirmDialog.message === 'sync-categories' && (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-gray-400">
              Choose which data to sync from your RSI account. Data is stored in your SC Bridge account only.
            </p>
            <div className="space-y-1.5">
              {Object.entries(SYNC_CATEGORIES).map(([key, cat]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-colors ${
                    syncCategories[key]
                      ? 'border-sc-accent/40 bg-sc-accent/5'
                      : 'border-sc-border/50 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={syncCategories[key]}
                    onChange={(e) => setSyncCategories(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="mt-0.5 accent-sc-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{cat.label}</div>
                    <div className="text-xs text-gray-500">{cat.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
