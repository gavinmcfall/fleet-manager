import React, { useState, useEffect } from 'react'
import { Trash2, FlaskConical, Tag } from 'lucide-react'
import PanelSection from '../../components/PanelSection'

function VersionControlPanel() {
  const [versions, setVersions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [flipping, setFlipping] = useState(null) // code being flipped
  const [confirming, setConfirming] = useState(null) // code in confirm state
  const [result, setResult] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patches', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Failed to load versions')
      const data = await res.json()
      setVersions(Array.isArray(data) ? data : data.data || [])
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleFlip = async (code) => {
    if (confirming !== code) {
      setConfirming(code)
      return
    }
    setFlipping(code)
    setConfirming(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/versions/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Flip failed')
      }
      const data = await res.json()
      setResult({
        type: 'success',
        message: `Default → ${data.code} (${data.channel}). Purged ${data.cache_purged ?? 0} cache keys.`,
      })
      setTimeout(() => setResult(null), 8000)
      await load()
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally {
      setFlipping(null)
    }
  }

  return (
    <PanelSection title="Game Version Default" icon={Tag}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500">
          Flips the public default game version. Updates <code className="text-gray-400">is_default</code> in D1
          and auto-purges <code className="text-gray-400">SC_BRIDGE_CACHE</code> so every endpoint
          immediately resolves to the new version's data. PTU shadow tables are unaffected.
        </p>
        {loading && !versions ? (
          <p className="text-xs text-gray-500">Loading versions…</p>
        ) : versions && versions.length === 0 ? (
          <p className="text-xs text-gray-500">No game versions found.</p>
        ) : (
          <div className="overflow-hidden rounded border border-sc-border">
            <table className="w-full text-sm">
              <thead className="bg-sc-darker">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Build</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(versions || []).map((v) => {
                  const isDefault = v.is_default === 1
                  const isConfirm = confirming === v.code
                  const isFlipping = flipping === v.code
                  return (
                    <tr key={v.code} className="border-t border-sc-border">
                      <td className="px-3 py-2 text-gray-200 font-mono text-xs">{v.code}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          v.channel === 'LIVE' ? 'bg-emerald-500/15 text-emerald-300' :
                          v.channel === 'PTU' ? 'bg-amber-500/15 text-amber-300' :
                          'bg-gray-500/15 text-gray-300'
                        }`}>{v.channel || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono text-xs">{v.build_number || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {isDefault ? (
                          <span className="text-xs font-medium text-sc-accent">CURRENT DEFAULT</span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleFlip(v.code)}
                              disabled={isFlipping || flipping}
                              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50 ${
                                isConfirm
                                  ? 'bg-sc-danger text-white hover:bg-sc-danger/80'
                                  : 'btn-primary'
                              }`}
                            >
                              {isFlipping ? 'Flipping…' : isConfirm ? `Confirm flip to ${v.code}?` : 'Set as default'}
                            </button>
                            {isConfirm && (
                              <button
                                onClick={() => setConfirming(null)}
                                className="text-xs text-gray-500 hover:text-gray-300"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <p className={`text-xs font-mono ${result.type === 'success' ? 'text-sc-success' : 'text-sc-danger'}`}>
            {result.message}
          </p>
        )}
      </div>
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

export default function AdminVersions() {
  return (
    <div className="space-y-6">
      <VersionControlPanel />
      <PTUPurgePanel />
    </div>
  )
}
