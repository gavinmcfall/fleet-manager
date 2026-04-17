import React from 'react'
import { Database, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '../../lib/dates'

export default function SyncDataSection({ syncStatus, onDelete, notification }) {
  return (
    <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-5 shadow-lg shadow-black/20 animate-stagger-fade-up" style={{ animationDelay: '120ms' }}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/10 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/10 rounded-br-xl" />

      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 mb-4 flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-sc-accent" />
        Sync Data
      </h2>

      {notification && (
        <div className={`mb-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
          notification.variant === 'error' ? 'bg-sc-danger/10 border border-sc-danger/20 text-sc-danger' :
          notification.variant === 'success' ? 'bg-sc-success/10 border border-sc-success/20 text-sc-success' :
          'text-gray-300'
        }`}>
          {notification.variant === 'success' && <CheckCircle className="w-4 h-4" />}
          {notification.variant === 'error' && <XCircle className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      {syncStatus?.has_data ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Fleet ships</span>
              <span className="text-white font-mono">{syncStatus.fleet_count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Buy-back pledges</span>
              <span className="text-white font-mono">{syncStatus.buyback_count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">RSI profile</span>
              <span className="text-white font-mono">{syncStatus.has_profile ? 'Yes' : 'No'}</span>
            </div>
            {syncStatus.last_synced && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Last synced</span>
                <span className="text-white font-mono text-xs">{formatDate(syncStatus.last_synced)}</span>
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-sc-danger/30 text-sc-danger hover:bg-sc-danger/10 transition-colors text-sm font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete All Synced Data
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No synced data. Use SC Bridge Sync above to import your RSI hangar.
        </p>
      )}
    </div>
  )
}
