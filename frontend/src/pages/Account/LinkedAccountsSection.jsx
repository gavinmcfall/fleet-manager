import React from 'react'
import { Lock, Link2, AlertCircle, Plus, X } from 'lucide-react'
import { getProvider } from '../../lib/providers'
import PanelSection from '../../components/PanelSection'

export default function LinkedAccountsSection({
  providers,
  availableProviders,
  linkError,
  unlinkConfirm, setUnlinkConfirm,
  unlinking,
  onUnlinkProvider,
  onLinkProvider,
}) {
  return (
    <div id="section-linked" className="scroll-mt-16">
    <PanelSection title="Linked Accounts" icon={Link2}>
      <div className="p-5 space-y-4 max-w-md">
        {linkError && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{linkError}</span>
          </div>
        )}

        <p className="text-sm text-gray-400">
          Manage the sign-in methods linked to your account.
        </p>

        {/* Linked providers */}
        <div className="space-y-2">
          {providers.includes('credential') && (
            <div className="flex items-center justify-between p-3 bg-sc-darker border border-sc-border rounded">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-sc-accent" />
                <span className="text-sm text-white">Password</span>
              </div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                Manage below
              </span>
            </div>
          )}

          {providers.filter(p => p !== 'credential').map((providerId) => {
            const provider = getProvider(providerId)
            const canUnlink = providers.length >= 2
            return (
              <div
                key={providerId}
                className="flex items-center justify-between p-3 bg-sc-darker border border-sc-border rounded"
              >
                <div className="flex items-center gap-3">
                  {provider ? (
                    <svg className="w-4 h-4 text-sc-accent" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
                      <path d={provider.path} />
                    </svg>
                  ) : (
                    <Link2 className="w-4 h-4 text-sc-accent" />
                  )}
                  <span className="text-sm text-white">{provider?.label || providerId}</span>
                </div>

                {unlinkConfirm === providerId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Unlink?</span>
                    <button
                      onClick={() => onUnlinkProvider(providerId)}
                      disabled={unlinking}
                      className="px-2 py-1 text-xs text-sc-danger border border-sc-danger/30 rounded hover:bg-sc-danger/10 transition-colors disabled:opacity-50"
                    >
                      {unlinking ? 'Unlinking...' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setUnlinkConfirm(null)}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUnlinkConfirm(providerId)}
                    disabled={!canUnlink}
                    title={canUnlink ? `Unlink ${provider?.label || providerId}` : 'Cannot unlink your only authentication method'}
                    className="text-xs text-sc-danger hover:text-sc-danger/80 transition-colors font-mono uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Unlink
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Link new providers */}
        {(() => {
          const linkable = availableProviders.filter(id => !providers.includes(id))
          if (linkable.length === 0) return null
          return (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Link another account
              </p>
              <div className="flex flex-wrap gap-2">
                {linkable.map((providerId) => {
                  const provider = getProvider(providerId)
                  if (!provider) return null
                  return (
                    <button
                      key={providerId}
                      onClick={() => onLinkProvider(providerId)}
                      className="flex items-center gap-2 px-3 py-2 bg-sc-darker border border-sc-border rounded text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
                        <path d={provider.path} />
                      </svg>
                      <span className="font-display tracking-wide text-xs uppercase">{provider.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </PanelSection>
    </div>
  )
}
