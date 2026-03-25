import React from 'react'
import { Fingerprint, AlertCircle, Check, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '../../lib/dates'
import PanelSection from '../../components/PanelSection'

export default function PasskeySection({
  timezone,
  passkeys, passkeysLoading,
  passkeyError, passkeyMsg,
  showPasskeyNamePrompt, setShowPasskeyNamePrompt,
  passkeyNameInput, setPasskeyNameInput,
  editingPasskeyId, setEditingPasskeyId,
  editingPasskeyName, setEditingPasskeyName,
  onAddPasskey,
  onUpdatePasskey,
  onDeletePasskey,
}) {
  return (
    <div id="section-passkeys" className="scroll-mt-16">
    <PanelSection title="Passkeys" icon={Fingerprint}>
      <div className="p-5">
        {passkeyError && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passkeyError}</span>
          </div>
        )}
        {passkeyMsg && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{passkeyMsg}</span>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-4">
          Passkeys let you sign in with biometrics (fingerprint, face) or a security key.
        </p>

        {passkeysLoading ? (
          <p className="text-sm text-gray-500">Loading passkeys...</p>
        ) : (
          <>
            {passkeys.length > 0 && (
              <div className="space-y-2 mb-4">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between p-3 bg-sc-darker border border-sc-border rounded"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Fingerprint className="w-4 h-4 text-sc-accent shrink-0" />
                      {editingPasskeyId === pk.id ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingPasskeyName}
                            onChange={(e) => setEditingPasskeyName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onUpdatePasskey(pk.id)
                              if (e.key === 'Escape') { setEditingPasskeyId(null); setEditingPasskeyName('') }
                            }}
                            autoFocus
                            className="flex-1 min-w-0 px-3 py-1.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                            placeholder="Passkey name"
                          />
                          <button
                            onClick={() => onUpdatePasskey(pk.id)}
                            className="btn-primary px-3 py-1.5 font-display tracking-wider uppercase text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingPasskeyId(null); setEditingPasskeyName('') }}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm text-white">{pk.name || 'Passkey'}</span>
                          <p className="text-xs text-gray-500 font-mono">
                            Added: {formatDate(pk.createdAt, timezone)}
                          </p>
                        </div>
                      )}
                    </div>
                    {editingPasskeyId !== pk.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingPasskeyId(pk.id); setEditingPasskeyName(pk.name || '') }}
                          title="Rename passkey"
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePasskey(pk.id)}
                          title="Remove passkey"
                          className="p-1.5 rounded text-sc-danger hover:bg-sc-danger/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showPasskeyNamePrompt ? (
              <div className="space-y-3 max-w-md">
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Passkey Name (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={passkeyNameInput}
                    onChange={(e) => setPasskeyNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onAddPasskey()
                      if (e.key === 'Escape') { setShowPasskeyNamePrompt(false); setPasskeyNameInput('') }
                    }}
                    autoFocus
                    className="flex-1 px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                    placeholder="e.g. MacBook Pro, YubiKey"
                  />
                  <button
                    onClick={onAddPasskey}
                    className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs"
                  >
                    Continue
                  </button>
                </div>
                <button
                  onClick={() => { setShowPasskeyNamePrompt(false); setPasskeyNameInput('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPasskeyNamePrompt(true)}
                className="btn-primary px-4 py-2 font-display tracking-wider uppercase text-xs flex items-center gap-2"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                Add Passkey
              </button>
            )}
          </>
        )}
      </div>
    </PanelSection>
    </div>
  )
}
