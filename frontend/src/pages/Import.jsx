import React, { useState, useRef } from 'react'
import { useStatus, importHangarXplor } from '../hooks/useAPI'
import { Upload, FileJson, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AlertBanner from '../components/AlertBanner'
import PanelSection from '../components/PanelSection'

export default function Import() {
  const { data: appStatus, refetch: refetchStatus } = useStatus()
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  const vehicleCount = appStatus?.vehicles || 0

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
        title="IMPORT HANGAR"
        subtitle="Import your fleet from HangarXplor to populate ships, insurance, and pledge data"
      />

      {vehicleCount > 0 && (
        <AlertBanner variant="info" icon={CheckCircle}>
          <span className="text-sm text-gray-300">
            Currently loaded: <span className="text-white font-medium">{vehicleCount} ships</span>
          </span>
        </AlertBanner>
      )}

      {vehicleCount > 0 && (
        <AlertBanner variant="warning" icon={AlertTriangle}>
          <p className="text-xs text-gray-400">
            Importing will <span className="text-sc-warn font-medium">replace</span> your
            current fleet data with the new import.
          </p>
        </AlertBanner>
      )}

      <PanelSection title="HangarXplor Import" icon={FileJson}>
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
        </div>
      </PanelSection>

      {preview && (
        <PanelSection title={preview.filename} icon={FileJson}>
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
        </PanelSection>
      )}

      {status === 'importing' && (
        <div className="panel p-5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-sc-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-300">Importing...</span>
        </div>
      )}

      {status === 'success' && result && (
        <AlertBanner variant="success" icon={CheckCircle}>
          <span className="text-sm text-white font-medium">Import complete!</span>
          {result.imported != null && (
            <span className="text-sm text-gray-400 ml-2">
              {result.imported} of {result.total} entries imported
            </span>
          )}
        </AlertBanner>
      )}

      {status === 'error' && (
        <AlertBanner variant="error" icon={XCircle}>
          <span className="text-sm text-sc-danger">{error}</span>
        </AlertBanner>
      )}

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
