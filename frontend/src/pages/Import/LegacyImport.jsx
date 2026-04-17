import React, { useState, useRef } from 'react'
import { FileJson, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useStatus, importHangarXplor } from '../../hooks/useAPI'

export default function LegacyImport() {
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
      if (!Array.isArray(data)) throw new Error('Expected a JSON array of ship entries')
      const valid = data.filter((d) => d.ship_code || d.name || d.pledge_id)
      if (valid.length === 0) throw new Error('No valid ship entries found in the JSON')
      setPreview({ filename: file.name, total: data.length, lti: data.filter((d) => d.lti).length, nonLTI: data.filter((d) => !d.lti).length, warbond: data.filter((d) => d.warbond).length, data })
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
    <details className="group relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl shadow-lg shadow-black/20 animate-stagger-fade-up" style={{ animationDelay: '240ms' }}>
      <summary className="p-5 cursor-pointer select-none hover:text-gray-300 transition-colors flex items-center gap-2">
        <FileJson className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">HangarXplor Import (Legacy)</span>
      </summary>
      <div className="px-5 pb-5 space-y-4">
        <p className="text-sm text-gray-500">
          Upload a JSON export from the HangarXplor browser extension.
        </p>

        {vehicleCount > 0 && (
          <div className="p-3 rounded-lg bg-sc-accent/10 border border-sc-accent/20 text-sm text-gray-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sc-accent" />
            Currently loaded: <span className="text-white font-medium">{vehicleCount} ships</span>
          </div>
        )}

        {vehicleCount > 0 && (
          <div className="p-3 rounded-lg bg-sc-warn/10 border border-sc-warn/20 text-xs text-gray-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-sc-warn" />
            Importing will <span className="text-sc-warn font-medium">replace</span> your current fleet data.
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a JSON file here or click to browse"
          className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-200 ${
            dragging ? 'border-sc-accent bg-sc-accent/5 scale-[1.01]' : 'border-white/[0.08] hover:border-white/[0.15]'
          }`}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && f.name.endsWith('.json')) processFile(f); else { setError('Please drop a .json file'); setStatus('error') } }}
        >
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => processFile(e.target.files?.[0])} />
          <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${dragging ? 'text-sc-accent' : 'text-gray-600'}`} />
          <p className="text-xs text-gray-500">Drop <span className="font-mono text-gray-400">.json</span> file or click to browse</p>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Ships', value: preview.total, color: 'text-white' },
                { label: 'LTI', value: preview.lti, color: 'text-sc-lti' },
                { label: 'Non-LTI', value: preview.nonLTI, color: 'text-sc-warn' },
                { label: 'Warbond', value: preview.warbond, color: 'text-sc-success' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className={`text-xl font-display font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs font-mono text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={handleImport} className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer">
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
          <div className="p-3 rounded-lg bg-sc-success/10 border border-sc-success/20 text-sm text-sc-success flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Import complete! {result.imported != null && <span className="text-gray-400 ml-1">{result.imported} of {result.total} entries imported</span>}
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 rounded-lg bg-sc-danger/10 border border-sc-danger/20 text-sm text-sc-danger flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    </details>
  )
}
