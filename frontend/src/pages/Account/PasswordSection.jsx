import React from 'react'
import { Lock, AlertCircle, Check } from 'lucide-react'
import PanelSection from '../../components/PanelSection'

export default function PasswordSection({
  hasPassword,
  providers,
  // Change password state
  currentPassword, setCurrentPassword,
  newPassword, setNewPassword,
  confirmPassword, setConfirmPassword,
  passwordSaving, passwordMsg, passwordError,
  onChangePassword,
  // Set password state (OAuth-only users)
  initPw, setInitPw,
  initPwConfirm, setInitPwConfirm,
  initPwSaving, initPwMsg, initPwError,
  onSetPassword,
}) {
  return (
    <div id="section-password" className="scroll-mt-16">
    <PanelSection title={hasPassword ? "Change Password" : "Set Password"} icon={Lock}>
      {hasPassword === false ? (
        /* OAuth-only user — no password yet */
        <form onSubmit={onSetPassword} className="p-5 space-y-4 max-w-md">
          <p className="text-sm text-gray-400">
            You signed in with {providers.filter(p => p !== 'credential').join(', ')}. Set a password to enable two-factor authentication and password-based login.
          </p>
          {initPwError && (
            <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{initPwError}</span>
            </div>
          )}
          {initPwMsg && (
            <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{initPwMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="set-pw" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              id="set-pw"
              type="password"
              value={initPw}
              onChange={(e) => setInitPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label htmlFor="set-pw-confirm" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Confirm Password
            </label>
            <input
              id="set-pw-confirm"
              type="password"
              value={initPwConfirm}
              onChange={(e) => setInitPwConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
              placeholder="Confirm password"
            />
          </div>

          <button
            type="submit"
            disabled={initPwSaving}
            className="btn-primary px-6 py-2 font-display tracking-wider uppercase text-sm disabled:opacity-50"
          >
            {initPwSaving ? 'Setting...' : 'Set Password'}
          </button>
        </form>
      ) : (
        /* User has a password — change it */
        <form onSubmit={onChangePassword} className="p-5 space-y-4 max-w-md">
          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}
          {passwordMsg && (
            <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{passwordMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="current-pw" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Current Password
            </label>
            <input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
            />
          </div>

          <div>
            <label htmlFor="new-pw" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              New Password
            </label>
            <input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm-pw" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Confirm New Password
            </label>
            <input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={passwordSaving}
            className="btn-primary px-6 py-2 font-display tracking-wider uppercase text-sm disabled:opacity-50"
          >
            {passwordSaving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      )}
    </PanelSection>
    </div>
  )
}
