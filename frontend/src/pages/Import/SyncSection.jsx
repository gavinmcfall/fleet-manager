import React from 'react'
import { CheckCircle, AlertCircle, Loader, RefreshCw, Plug } from 'lucide-react'

export default function SyncSection({ sync, syncCategories, onSyncClick, SYNC_CATEGORIES }) {
  return (
    <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-5 shadow-lg shadow-black/20 animate-stagger-fade-up" style={{ animationDelay: '60ms' }}>
      {/* HUD brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/10 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/10 rounded-br-xl" />

      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 mb-4 flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 text-sc-accent" />
        SC Bridge Sync
      </h2>

      <p className="text-sm text-gray-500 mb-4">
        Sync your RSI hangar directly to SC Bridge using the browser extension.
      </p>

      {sync.status === 'detecting' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader className="w-4 h-4 animate-spin" />
          Checking for extension...
        </div>
      )}

      {sync.status === 'no-extension' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Plug className="w-4 h-4" />
            SC Bridge Sync extension not detected
          </div>
          <p className="text-xs text-gray-500">
            Install the extension to sync your hangar data directly from RSI.
          </p>
          <button onClick={sync.detect} className="text-xs text-sc-accent hover:underline cursor-pointer">
            Retry detection
          </button>
        </div>
      )}

      {(sync.status === 'ready' || sync.status === 'complete' || sync.status === 'error') && (
        <div className="space-y-3">
          {sync.extensionVersion && (
            <div className="text-xs text-gray-600 font-mono">
              Extension v{sync.extensionVersion} detected
            </div>
          )}

          <button
            onClick={onSyncClick}
            disabled={sync.status === 'collecting' || sync.status === 'uploading'}
            className="btn-primary flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Now
          </button>

          {sync.status === 'complete' && sync.result && (
            <div className="p-3 rounded-lg bg-sc-success/10 border border-sc-success/20 text-sm text-sc-success flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Synced {sync.result.imported} ships, {sync.result.buyback_count} buy-back pledges, {sync.result.upgrade_count} upgrades
            </div>
          )}

          {sync.status === 'error' && (
            <div className="p-3 rounded-lg bg-sc-danger/10 border border-sc-danger/20 space-y-2">
              <div className="text-sm text-sc-danger flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {sync.error}
              </div>
              <button onClick={sync.retry} className="text-xs text-sc-accent hover:underline cursor-pointer">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {(sync.status === 'collecting' || sync.status === 'uploading') && (
        <div className="p-4 rounded-lg bg-sc-accent/10 border border-sc-accent/20 space-y-2">
          <div className="flex items-center gap-2 text-sm text-sc-accent">
            <Loader className="w-4 h-4 animate-spin" />
            {sync.status === 'collecting' ? 'Collecting data from RSI...' : 'Saving to SC Bridge...'}
          </div>
          <p className="text-xs text-gray-500">
            {sync.status === 'collecting'
              ? 'The extension is gathering your hangar data. This may take a minute.'
              : 'Uploading your data to SC Bridge...'}
          </p>
        </div>
      )}
    </div>
  )
}
