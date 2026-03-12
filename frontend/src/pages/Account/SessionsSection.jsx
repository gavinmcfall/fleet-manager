import React from 'react'
import { Monitor, Trash2 } from 'lucide-react'
import { formatDate } from '../../lib/dates'
import PanelSection from '../../components/PanelSection'

export default function SessionsSection({
  timezone,
  session,
  sessions, sessionsLoading,
  onRevokeSession,
  onRevokeAllSessions,
}) {
  return (
    <div id="section-sessions" className="scroll-mt-16">
    <PanelSection title="Active Sessions" icon={Monitor}>
      <div className="p-5">
        {sessionsLoading ? (
          <p className="text-sm text-gray-500">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isCurrent = s.token === session?.session?.token
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-sc-darker border border-sc-border rounded"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {isCurrent ? 'Current Session' : 'Session'}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono text-sc-accent bg-sc-accent/10 px-1.5 py-0.5 rounded">
                          THIS DEVICE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      Expires: {formatDate(s.expiresAt, timezone)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRevokeSession(s.token)}
                    className="text-xs text-sc-danger hover:text-sc-danger/80 transition-colors font-mono uppercase tracking-wider"
                  >
                    Revoke
                  </button>
                </div>
              )
            })}

            {sessions.length > 1 && (
              <button
                onClick={onRevokeAllSessions}
                className="mt-2 px-4 py-2 bg-sc-danger/10 border border-sc-danger/30 text-sc-danger font-display tracking-wider uppercase text-xs rounded hover:bg-sc-danger/20 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kill All Sessions
              </button>
            )}
          </div>
        )}
      </div>
    </PanelSection>
    </div>
  )
}
