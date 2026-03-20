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
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#4285F4" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/></svg>
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
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#FF7139" xmlns="http://www.w3.org/2000/svg"><path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z"/></svg>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Firefox Add-ons</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">Install</span>
            </a>
            <a
              href="https://microsoftedge.microsoft.com/addons/detail/sc-bridge-sync/edndedmmbdbofdphimpcofdccbpbgjib"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded border border-sc-border hover:border-sc-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4" xmlns="http://www.w3.org/2000/svg"><path d="M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.8-.28-1.48-.78-.68-.5-1.22-1.17-.53-.66-.92-1.44-.38-.77-.58-1.6-.2-.83-.2-1.67 0-1 .32-1.96.33-.97.87-1.8.14.95.55 1.77.41.82 1.02 1.5.6.68 1.38 1.21.78.54 1.64.9.86.36 1.77.56.92.2 1.8.2 1.12 0 2.18-.24 1.06-.23 2.06-.72l.2-.1.2-.05zm-15.5-1.27q0 1.1.27 2.15.27 1.06.78 2.03.51.96 1.24 1.77.74.82 1.66 1.4-1.47-.2-2.8-.74-1.33-.55-2.48-1.37-1.15-.83-2.08-1.9-.92-1.07-1.58-2.33T.36 14.94Q0 13.54 0 12.06q0-.81.32-1.49.31-.68.83-1.23.53-.55 1.2-.96.66-.4 1.35-.66.74-.27 1.5-.39.78-.12 1.55-.12.7 0 1.42.1.72.12 1.4.35.68.23 1.32.57.63.35 1.16.83-.35 0-.7.07-.33.07-.65.23v-.02q-.63.28-1.2.74-.57.46-1.05 1.04-.48.58-.87 1.26-.38.67-.65 1.39-.27.71-.42 1.44-.15.72-.15 1.38zM11.96.06q1.7 0 3.33.39 1.63.38 3.07 1.15 1.43.77 2.62 1.93 1.18 1.16 1.98 2.7.49.94.76 1.96.28 1 .28 2.08 0 .89-.23 1.7-.24.8-.69 1.48-.45.68-1.1 1.22-.64.53-1.45.88-.54.24-1.11.36-.58.13-1.16.13-.42 0-.97-.03-.54-.03-1.1-.12-.55-.1-1.05-.28-.5-.19-.84-.5-.12-.09-.23-.24-.1-.16-.1-.33 0-.15.16-.35.16-.2.35-.5.2-.28.36-.68.16-.4.16-.95 0-1.06-.4-1.96-.4-.91-1.06-1.64-.66-.74-1.52-1.28-.86-.55-1.79-.89-.84-.3-1.72-.44-.87-.14-1.76-.14-1.55 0-3.06.45T.94 7.55q.71-1.74 1.81-3.13 1.1-1.38 2.52-2.35Q6.68 1.1 8.37.58q1.7-.52 3.58-.52Z"/></svg>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Microsoft Edge Add-ons</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">Install</span>
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
