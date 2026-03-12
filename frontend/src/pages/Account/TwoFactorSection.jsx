import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Key, AlertCircle, Check, Copy } from 'lucide-react'
import PanelSection from '../../components/PanelSection'

export default function TwoFactorSection({
  user,
  hasPassword,
  totpUri, setTotpUri,
  backupCodes, setBackupCodes,
  totpCode, setTotpCode,
  twoFALoading, twoFAError, twoFAMsg, setTwoFAMsg,
  twoFAPassword, setTwoFAPassword,
  showEnablePrompt, setShowEnablePrompt,
  showDisablePrompt, setShowDisablePrompt,
  setTwoFAError,
  onEnable2FA,
  onVerify2FA,
  onDisable2FA,
}) {
  return (
    <div id="section-2fa" className="scroll-mt-16">
    <PanelSection title="Two-Factor Authentication" icon={Key}>
      <div className="p-5 max-w-md">
        {twoFAError && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{twoFAError}</span>
          </div>
        )}
        {twoFAMsg && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{twoFAMsg}</span>
          </div>
        )}

        {totpUri ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Scan this QR code with your authenticator app, then enter the 6-digit code to verify.
            </p>
            <div className="flex justify-center p-4 bg-white rounded">
              <QRCodeSVG value={totpUri} size={200} />
            </div>

            {backupCodes && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Backup Codes</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(backupCodes.join('\n'))
                      setTwoFAMsg('Backup codes copied')
                      setTimeout(() => setTwoFAMsg(null), 2000)
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    title="Copy backup codes"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">Save these codes in a safe place. Each can be used once if you lose your authenticator.</p>
                <div className="grid grid-cols-2 gap-1 p-3 bg-sc-darker border border-sc-border rounded font-mono text-xs text-gray-300">
                  {backupCodes.map((code, i) => (
                    <span key={i}>{code}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                className="flex-1 px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-center text-sm font-mono text-white tracking-[0.3em] placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
              />
              <button
                onClick={onVerify2FA}
                disabled={twoFALoading || totpCode.length !== 6}
                className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs disabled:opacity-50"
              >
                Verify
              </button>
            </div>
            <button
              onClick={() => { setTotpUri(null); setTotpCode(''); setBackupCodes(null); setTwoFAError(null) }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : user.twoFactorEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-sc-success">
                <Check className="w-4 h-4" /> Two-factor authentication is enabled
              </span>
            </div>
            {showDisablePrompt ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Enter your password to disable 2FA:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={twoFAPassword}
                    onChange={(e) => setTwoFAPassword(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="flex-1 px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                    onKeyDown={(e) => { if (e.key === 'Enter' && twoFAPassword) onDisable2FA() }}
                  />
                  <button
                    onClick={onDisable2FA}
                    disabled={twoFALoading || !twoFAPassword}
                    className="px-4 py-2.5 bg-sc-danger text-white font-display tracking-wider uppercase text-xs rounded hover:bg-sc-danger/80 transition-colors disabled:opacity-50"
                  >
                    {twoFALoading ? 'Disabling...' : 'Confirm Disable'}
                  </button>
                </div>
                <button
                  onClick={() => { setShowDisablePrompt(false); setTwoFAPassword(''); setTwoFAError(null) }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDisablePrompt(true)}
                className="text-xs text-sc-danger hover:text-sc-danger/80 transition-colors font-mono uppercase tracking-wider"
              >
                Disable 2FA
              </button>
            )}
          </div>
        ) : hasPassword === false ? (
          /* OAuth-only user without a password — can't enable 2FA yet */
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Add an extra layer of security using a TOTP authenticator app.
            </p>
            <div className="flex items-center gap-2 p-3 bg-sc-warn/10 border border-sc-warn/30 rounded text-sc-warn text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Set a password in the section above before enabling two-factor authentication.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Add an extra layer of security using a TOTP authenticator app.
            </p>
            {showEnablePrompt ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Enter your password to continue:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={twoFAPassword}
                    onChange={(e) => setTwoFAPassword(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="flex-1 px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                    onKeyDown={(e) => { if (e.key === 'Enter' && twoFAPassword) onEnable2FA() }}
                  />
                  <button
                    onClick={onEnable2FA}
                    disabled={twoFALoading || !twoFAPassword}
                    className="btn-primary px-4 py-2.5 font-display tracking-wider uppercase text-xs disabled:opacity-50"
                  >
                    {twoFALoading ? 'Setting up...' : 'Continue'}
                  </button>
                </div>
                <button
                  onClick={() => { setShowEnablePrompt(false); setTwoFAPassword(''); setTwoFAError(null) }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowEnablePrompt(true)}
                disabled={twoFALoading}
                className="btn-primary px-4 py-2 font-display tracking-wider uppercase text-xs disabled:opacity-50"
              >
                Enable 2FA
              </button>
            )}
          </div>
        )}
      </div>
    </PanelSection>
    </div>
  )
}
