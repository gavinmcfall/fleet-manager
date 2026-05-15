import React, { useState, useEffect, useRef } from 'react'
import { Ticket, Copy, Check } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import ConfirmDialog from '../../components/ConfirmDialog'

function InvitePanel() {
  const [invites, setInvites] = useState([])
  const [generating, setGenerating] = useState(false)
  const [newUrl, setNewUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  // F276: confirm before generating — guards against accidental one-click
  // invite minting (every invite is an open door).
  const [confirmOpen, setConfirmOpen] = useState(false)
  const urlRef = useRef(null)

  useEffect(() => {
    fetch('/api/admin/invites', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setInvites)
      .catch(() => {})
  }, [])

  const handleGenerate = async () => {
    setConfirmOpen(false)
    setGenerating(true)
    setNewUrl(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      setNewUrl(data.url)
      setInvites((prev) => [{ token: data.token, created_at: new Date().toISOString(), used_at: null }, ...prev])
    } catch {
      // silently fail — user can retry
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!newUrl) return
    navigator.clipboard.writeText(newUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <PanelSection title="Invite Links" icon={Ticket}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={generating}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Ticket className="w-3.5 h-3.5" />
            {generating ? 'Generating...' : 'Generate Invite'}
          </button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onConfirm={handleGenerate}
          onCancel={() => setConfirmOpen(false)}
          title="Generate Invite Link"
          message="This creates a single-use invite link that registers the next person who opens it as a new SC Bridge user. Make sure you trust the recipient before sharing."
          confirmLabel="Generate"
          variant="warning"
        />

        {newUrl && (
          <div className="flex items-center gap-2">
            <input
              ref={urlRef}
              readOnly
              value={newUrl}
              onClick={(e) => e.target.select()}
              className="flex-1 px-3 py-2 bg-sc-darker border border-sc-accent/40 rounded text-xs font-mono text-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50 cursor-pointer"
            />
            <button
              onClick={handleCopy}
              className="p-2 border border-sc-border rounded hover:border-sc-accent/40 transition-colors text-gray-400 hover:text-white"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-sc-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Invite tokens</caption>
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sc-border/30">
                {invites.map((inv) => (
                  <tr key={inv.token} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-xs font-mono text-gray-400 truncate max-w-[160px]" title={inv.token}>
                      {inv.token.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">
                      {inv.created_at ? new Date(inv.created_at + 'Z').toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {inv.used_at ? (
                        <span className="text-xs font-mono text-gray-500">Used</span>
                      ) : (
                        <span className="text-xs font-mono text-sc-success">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelSection>
  )
}

export default function AdminUsers() {
  return <InvitePanel />
}
