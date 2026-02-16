import React, { useState, useRef } from 'react'
import { useStatus, importHangarXplor } from '../hooks/useAPI'
import { Upload, FileJson, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function Import() {
  const { data: appStatus, refetch: refetchStatus } = useStatus()
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const vehicleCount = appStatus?.vehicles || 0

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
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">IMPORT HANGAR</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Import your fleet from HangarXplor to populate ships, insurance, and pledge data
        </p>
      </div>

      <div className="glow-line" />

      {/* Current Fleet Indicator */}
      {vehicleCount > 0 && (
        <div className="panel p-4 flex items-center gap-3 border-l-2 border-l-sc-accent">
          <CheckCircle className="w-4 h-4 text-sc-accent shrink-0" />
          <span className="text-sm text-gray-300">
            Currently loaded: <span className="text-white font-medium">{vehicleCount} ships</span>
          </span>
        </div>
      )}

      {/* Warning about replacing data */}
      {vehicleCount > 0 && (
        <div className="panel p-3 flex items-start gap-2 border-l-2 border-l-sc-warn">
          <AlertTriangle className="w-4 h-4 text-sc-warn shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">
            Importing will <span className="text-sc-warn font-medium">replace</span> your
            current fleet data with the new import.
          </p>
        </div>
      )}

      {/* HangarXplor Import */}
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5" />
          HangarXplor Import
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Upload a JSON export from the HangarXplor browser extension. Includes full
            pledge and insurance details. Ship data is automatically enriched from the
            reference database (images, specs, manufacturer info).
          </p>
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
      {status === 'importing' && (
        <div className="panel p-5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-sc-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-300">Importing...</span>
        </div>
      )}

      {status === 'success' && result && (
        <div className="panel border-l-2 border-l-sc-success">
          <div className="p-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-sc-success" />
            <div>
              <span className="text-sm text-white font-medium">Import complete!</span>
              {result.imported != null && (
                <span className="text-sm text-gray-400 ml-2">
                  {result.imported} of {result.total} entries imported
                </span>
              )}
            </div>
          </div>
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
  )
}
