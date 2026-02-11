import React, { useState, useRef } from 'react'
import { importHangarXplor, clearHangarImports } from '../hooks/useAPI'
import { Upload, FileJson, CheckCircle, XCircle, Trash2, AlertTriangle } from 'lucide-react'

export default function Import() {
  const [status, setStatus] = useState(null) // null | 'parsing' | 'importing' | 'success' | 'error'
  const [result, setResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

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

      // Validate structure
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
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear all HangarXplor import data?')) return
    try {
      await clearHangarImports()
      setResult(null)
      setPreview(null)
      setStatus(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">IMPORT DATA</h2>
          <p className="text-xs font-mono text-gray-500 mt-1">
            Upload HangarXplor browser extension export to enrich fleet data
          </p>
        </div>
        <button onClick={handleClear} className="btn-danger flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" /> Clear Imports
        </button>
      </div>

      <div className="glow-line" />

      {/* Instructions */}
      <div className="panel p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm text-white">How to export from HangarXplor</h3>
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
            Upload the exported JSON file below
          </li>
        </ol>
      </div>

      {/* Upload Zone */}
      <div
        className="panel p-8 border-2 border-dashed border-sc-border hover:border-sc-accent/30 transition-colors cursor-pointer text-center"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFile}
        />
        <FileJson className="w-12 h-12 mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">
          Drop your HangarXplor <span className="text-gray-300 font-mono">.json</span> file here or click to browse
        </p>
        <p className="text-xs text-gray-600 mt-1 font-mono">Supports the standard HangarXplor export format</p>
      </div>

      {/* Preview */}
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
        <div className="panel p-5 flex items-center gap-3 border-l-2 border-l-sc-success">
          <CheckCircle className="w-5 h-5 text-sc-success" />
          <div>
            <span className="text-sm text-white font-medium">Import complete!</span>
            <span className="text-sm text-gray-400 ml-2">
              {result.imported} of {result.total} entries imported
            </span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="panel p-5 flex items-center gap-3 border-l-2 border-l-sc-danger">
          <XCircle className="w-5 h-5 text-sc-danger" />
          <span className="text-sm text-sc-danger">{error}</span>
        </div>
      )}
    </div>
  )
}
