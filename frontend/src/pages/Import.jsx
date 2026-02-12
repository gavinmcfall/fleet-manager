import React, { useState, useRef, useEffect } from 'react'
import { useStatus, triggerHangarSync, importHangarXplor, setFleetYardsUser, triggerEnrich } from '../hooks/useAPI'
import { Upload, FileJson, CheckCircle, XCircle, Globe, RefreshCw, AlertTriangle, ArrowRight, Sparkles, Save, Settings } from 'lucide-react'

export default function Import() {
  const { data: appStatus, refetch: refetchStatus } = useStatus()
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameSaved, setUsernameSaved] = useState(false)
  const fileRef = useRef(null)

  const currentSource = appStatus?.hangar_source || ''
  const vehicleCount = appStatus?.vehicles || 0
  const fleetyardsUser = appStatus?.config?.fleetyards_user || ''

  // Sync input with saved value
  useEffect(() => {
    if (fleetyardsUser && !usernameInput) {
      setUsernameInput(fleetyardsUser)
    }
  }, [fleetyardsUser])

  // --- FleetYards Username ---
  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim()
    if (!trimmed) return
    try {
      await setFleetYardsUser(trimmed)
      setUsernameSaved(true)
      setTimeout(() => setUsernameSaved(false), 2000)
      refetchStatus()
    } catch (err) {
      setError(err.message)
    }
  }

  // --- FleetYards Sync ---
  const handleFleetYardsSync = async () => {
    setStatus('syncing')
    setError(null)
    setResult(null)
    setPreview(null)

    try {
      const res = await triggerHangarSync()
      setResult({ message: res.message, source: 'fleetyards' })
      setStatus('success')
      setTimeout(refetchStatus, 3000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  // --- Enrich ---
  const handleEnrich = async () => {
    setStatus('enriching')
    setError(null)
    setResult(null)

    try {
      const res = await triggerEnrich()
      setResult({ message: res.message, source: 'enrich' })
      setStatus('success')
      setTimeout(refetchStatus, 3000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  // --- HangarXplor Import ---
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
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

  const handleImport = async () => {
    if (!preview?.data) return

    setStatus('importing')
    setError(null)

    try {
      const res = await importHangarXplor(preview.data)
      setResult({ ...res, source: 'hangarxplor' })
      setStatus('success')
      setPreview(null)
      setTimeout(refetchStatus, 2000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const sourceLabel = {
    fleetyards: 'FleetYards',
    hangarxplor: 'HangarXplor',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">IMPORT HANGAR</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Choose a source to populate your fleet — only one source is active at a time
        </p>
      </div>

      <div className="glow-line" />

      {/* FleetYards Username Setting */}
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" />
          FleetYards Username
        </div>
        <div className="p-4">
          <p className="text-xs text-gray-500 mb-3">
            Your public hangar username on <span className="font-mono text-gray-400">fleetyards.net</span> — used for syncing and enrichment
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => { setUsernameInput(e.target.value); setUsernameSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
              placeholder="e.g. NZVengeance"
              className="flex-1 bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/50"
            />
            <button
              onClick={handleSaveUsername}
              disabled={!usernameInput.trim() || usernameInput.trim() === fleetyardsUser}
              className="btn-primary flex items-center gap-2 disabled:opacity-30"
            >
              {usernameSaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {usernameSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Source Indicator */}
      {vehicleCount > 0 && (
        <div className="panel p-4 flex items-center gap-3 border-l-2 border-l-sc-accent">
          <CheckCircle className="w-4 h-4 text-sc-accent shrink-0" />
          <span className="text-sm text-gray-300">
            Currently loaded: <span className="text-white font-medium">{vehicleCount} ships</span> from{' '}
            <span className="text-sc-accent font-medium">{sourceLabel[currentSource] || 'Unknown'}</span>
          </span>
        </div>
      )}

      {/* Two Source Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Option 1: FleetYards */}
        <div className={`panel transition-all ${currentSource === 'fleetyards' ? 'ring-1 ring-sc-accent/30' : ''}`}>
          <div className="panel-header flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" />
            FleetYards Public Hangar
            {currentSource === 'fleetyards' && (
              <span className="ml-auto text-[10px] font-mono bg-sc-accent/20 text-sc-accent px-2 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Syncs your public hangar directly from FleetYards. Requires your hangar to be set to public
              on <span className="font-mono text-gray-300">fleetyards.net</span>.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-sc-accent" />
                <span>Ship names, manufacturer, paint/livery</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-sc-accent" />
                <span>Loaner detection</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-gray-600" />
                <span className="text-gray-600">No insurance/pledge data</span>
              </div>
            </div>

            {fleetyardsUser ? (
              <div className="space-y-2">
                <p className="text-xs font-mono text-gray-500">
                  Syncing as: <span className="text-gray-300">{fleetyardsUser}</span>
                </p>
                <button
                  onClick={handleFleetYardsSync}
                  disabled={status === 'syncing'}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {status === 'syncing' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      {currentSource === 'fleetyards' ? 'Re-sync from FleetYards' : 'Sync from FleetYards'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded bg-sc-warn/10 border border-sc-warn/20">
                <p className="text-xs text-sc-warn flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Enter your FleetYards username above to enable
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Option 2: HangarXplor */}
        <div className={`panel transition-all ${currentSource === 'hangarxplor' ? 'ring-1 ring-sc-accent/30' : ''}`}>
          <div className="panel-header flex items-center gap-2">
            <FileJson className="w-3.5 h-3.5" />
            HangarXplor Import
            {currentSource === 'hangarxplor' && (
              <span className="ml-auto text-[10px] font-mono bg-sc-accent/20 text-sc-accent px-2 py-0.5 rounded">ACTIVE</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Upload a JSON export from the HangarXplor browser extension. Includes full
              pledge and insurance details.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-sc-accent" />
                <span>Ship names, manufacturer</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-sc-accent" />
                <span>LTI / insurance status, warbond</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-sc-accent" />
                <span>Pledge name, date, and cost</span>
              </div>
            </div>

            <div
              className="p-4 border-2 border-dashed border-sc-border hover:border-sc-accent/30 transition-colors cursor-pointer rounded text-center"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFile}
              />
              <Upload className="w-6 h-6 mx-auto text-gray-600 mb-2" />
              <p className="text-xs text-gray-400">
                Drop <span className="text-gray-300 font-mono">.json</span> file or click to browse
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enrich Option - only when HangarXplor is active and FY user is set */}
      {currentSource === 'hangarxplor' && fleetyardsUser && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Enrich from FleetYards
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-400">
              Pull supplementary data from your FleetYards public hangar to enhance your HangarXplor import.
              This adds loaner flags, paint/livery names, and improves ship database matching — without
              replacing your pledge and insurance data.
            </p>
            <button
              onClick={handleEnrich}
              disabled={status === 'enriching'}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {status === 'enriching' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Enrich from FleetYards ({fleetyardsUser})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Warning about replacing data */}
      {vehicleCount > 0 && (
        <div className="panel p-3 flex items-start gap-2 border-l-2 border-l-sc-warn">
          <AlertTriangle className="w-4 h-4 text-sc-warn shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">
            Importing from a different source will <span className="text-sc-warn font-medium">replace</span> your
            current hangar data. Enrichment only adds to existing data.
          </p>
        </div>
      )}

      {/* HangarXplor Preview */}
      {preview && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <FileJson className="w-3.5 h-3.5" />
            {preview.filename}
          </div>
          <div className="p-5 space-y-4">
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
        </div>
      )}

      {/* Status Messages */}
      {(status === 'importing' || status === 'enriching') && (
        <div className="panel p-5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-sc-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-300">
            {status === 'enriching' ? 'Enriching from FleetYards...' : 'Importing...'}
          </span>
        </div>
      )}

      {status === 'success' && result && (
        <div className="panel border-l-2 border-l-sc-success">
          <div className="p-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-sc-success" />
            <div>
              <span className="text-sm text-white font-medium">
                {result.source === 'fleetyards' ? 'Hangar sync started!' :
                 result.source === 'enrich' ? 'Enrichment complete!' :
                 'Import complete!'}
              </span>
              {result.imported != null && (
                <span className="text-sm text-gray-400 ml-2">
                  {result.imported} of {result.total} entries imported
                </span>
              )}
            </div>
          </div>

          {/* Enrichment Stats */}
          {result.source === 'enrich' && result.enriched != null && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="bg-sc-darker rounded p-3 text-center">
                  <div className="text-lg font-display font-bold text-sc-success">{result.enriched}</div>
                  <div className="text-xs font-mono text-gray-500">Enriched</div>
                </div>
                {result.loaners_added > 0 && (
                  <div className="bg-sc-darker rounded p-3 text-center">
                    <div className="text-lg font-display font-bold text-sc-accent">{result.loaners_added}</div>
                    <div className="text-xs font-mono text-gray-500">Loaners</div>
                  </div>
                )}
                {result.paints_added > 0 && (
                  <div className="bg-sc-darker rounded p-3 text-center">
                    <div className="text-lg font-display font-bold text-sc-accent">{result.paints_added}</div>
                    <div className="text-xs font-mono text-gray-500">Paints</div>
                  </div>
                )}
                {result.slugs_improved > 0 && (
                  <div className="bg-sc-darker rounded p-3 text-center">
                    <div className="text-lg font-display font-bold text-sc-accent">{result.slugs_improved}</div>
                    <div className="text-xs font-mono text-gray-500">Slug Matches</div>
                  </div>
                )}
              </div>
              {result.skipped > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  {result.skipped} ship{result.skipped !== 1 ? 's' : ''} couldn't be matched with FleetYards data
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="panel p-5 flex items-center gap-3 border-l-2 border-l-sc-danger">
          <XCircle className="w-5 h-5 text-sc-danger" />
          <span className="text-sm text-sc-danger">{error}</span>
        </div>
      )}

      {/* HangarXplor Instructions (collapsed) */}
      <details className="panel">
        <summary className="panel-header cursor-pointer select-none hover:text-gray-300 transition-colors">
          How to export from HangarXplor
        </summary>
        <div className="p-5">
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-sc-accent font-mono font-bold shrink-0">1.</span>
              Install the HangarXplor browser extension for Chrome/Edge
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
  )
}
