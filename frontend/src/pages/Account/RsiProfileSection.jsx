import React from 'react'
import { Star, AlertCircle, Check, RefreshCw } from 'lucide-react'
import PanelSection from '../../components/PanelSection'
import RsiOrgChip from '../../components/RsiOrgChip'
import { formatDate } from '../../lib/dates'

export default function RsiProfileSection({
  timezone,
  rsiProfile, rsiLoading,
  rsiHandle, setRsiHandle,
  rsiSyncing, rsiError, rsiMsg,
  onRsiSync,
}) {
  return (
    <div id="section-rsi" className="scroll-mt-16">
    <PanelSection title="Star Citizen Profile" icon={Star}>
      <div className="p-5 space-y-4 max-w-md">
        {rsiError && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{rsiError}</span>
          </div>
        )}
        {rsiMsg && (
          <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{rsiMsg}</span>
          </div>
        )}

        <form onSubmit={onRsiSync} className="flex items-center gap-2">
          <div className="flex-1">
            <label htmlFor="rsi-handle" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Star Citizen Handle
            </label>
            <input
              id="rsi-handle"
              type="text"
              value={rsiHandle}
              onChange={(e) => setRsiHandle(e.target.value)}
              placeholder="e.g. NZVengeance"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
            />
          </div>
          <button
            type="submit"
            disabled={rsiSyncing || !rsiHandle.trim()}
            className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs flex items-center gap-2 self-end disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rsiSyncing ? 'animate-spin' : ''}`} />
            {rsiSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </form>

        {!rsiLoading && rsiProfile && (
          <div className="space-y-4">
            {/* Avatar + basic info */}
            <div className="flex items-start gap-4">
              {rsiProfile.avatar_url && (
                <img
                  src={rsiProfile.avatar_url}
                  alt={`${rsiProfile.handle} avatar`}
                  className="w-16 h-16 rounded border border-sc-border object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <a
                  href={`https://robertsspaceindustries.com/en/citizens/${rsiProfile.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wide text-sm font-medium"
                >
                  {rsiProfile.handle}
                </a>
                {rsiProfile.citizen_record && (
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{rsiProfile.citizen_record}</p>
                )}
                {rsiProfile.enlisted_at && (
                  <p className="text-xs text-gray-500 mt-0.5">Enlisted: {rsiProfile.enlisted_at}</p>
                )}
              </div>
            </div>

            {/* Org affiliations */}
            {rsiProfile.orgs && rsiProfile.orgs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Org Affiliations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rsiProfile.orgs.map((org) => (
                    <RsiOrgChip
                      key={org.slug}
                      slug={org.slug}
                      name={org.name}
                      isMain={org.is_main}
                      scBridge={false}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-600 font-mono">
              Synced: {rsiProfile.fetched_at ? formatDate(rsiProfile.fetched_at, timezone) : '\u2014'}
            </p>
          </div>
        )}

        {!rsiLoading && !rsiProfile && (
          <p className="text-sm text-gray-500">
            Enter your Star Citizen handle to sync your RSI citizen profile, including org affiliations.
          </p>
        )}
      </div>
    </PanelSection>
    </div>
  )
}
