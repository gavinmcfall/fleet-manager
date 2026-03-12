import React from 'react'
import { Download, AlertCircle, Check, Send, AlertTriangle, Trash2 } from 'lucide-react'
import PanelSection from '../../components/PanelSection'

export default function DataPrivacySection({
  exporting, emailing,
  dataMsg, dataError,
  showDeleteConfirm, setShowDeleteConfirm,
  deleteConfirmText, setDeleteConfirmText,
  deleting,
  onExportDownload,
  onExportEmail,
  onDeleteAccount,
}) {
  return (
    <div id="section-data" className="scroll-mt-16">
    <PanelSection title="Data & Privacy" icon={Download}>
      <div className="p-5 space-y-6">
        {dataError && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dataError}</span>
          </div>
        )}
        {dataMsg && (
          <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{dataMsg}</span>
          </div>
        )}

        {/* Data Export */}
        <div>
          <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Data Export</h3>
          <p className="text-sm text-gray-500 mb-3">
            Download or email a complete copy of all your SC Bridge data (GDPR right of access).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onExportDownload}
              disabled={exporting}
              className="btn-primary px-4 py-2 font-display tracking-wider uppercase text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Download My Data'}
            </button>
            <button
              onClick={onExportEmail}
              disabled={emailing}
              className="px-4 py-2 font-display tracking-wider uppercase text-xs flex items-center gap-2 border border-sc-border rounded text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {emailing ? 'Sending...' : 'Email My Data'}
            </button>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="border border-sc-danger/30 rounded-lg p-4 bg-sc-danger/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-sc-danger" />
            <h3 className="text-xs font-medium text-sc-danger uppercase tracking-wider">Danger Zone</h3>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Type <strong className="text-sc-danger font-mono">DELETE</strong> to confirm:
              </p>
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="flex-1 px-4 py-2.5 bg-sc-darker border border-sc-danger/30 rounded text-sm font-mono text-white placeholder-gray-600 focus:border-sc-danger focus:outline-none focus:ring-1 focus:ring-sc-danger/50"
                  autoFocus
                />
                <button
                  onClick={onDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="px-4 py-2.5 bg-sc-danger text-white font-display tracking-wider uppercase text-xs rounded hover:bg-sc-danger/80 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-sc-danger/10 border border-sc-danger/30 text-sc-danger font-display tracking-wider uppercase text-xs rounded hover:bg-sc-danger/20 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete My Account
            </button>
          )}
        </div>
      </div>
    </PanelSection>
    </div>
  )
}
