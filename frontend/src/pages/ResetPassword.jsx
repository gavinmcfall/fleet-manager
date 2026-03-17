import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Rocket, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const tokenError = searchParams.get('error')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(tokenError === 'INVALID_TOKEN' ? 'This reset link is invalid or has expired. Please request a new one.' : '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (error) {
        setError(error.message || 'Failed to reset password')
      } else {
        setSuccess(true)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sc-darker">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Rocket className="w-8 h-8 text-sc-accent" />
            <h1 className="font-display font-bold text-2xl tracking-wider text-sc-accent">
              SC BRIDGE
            </h1>
          </div>
          <p className="text-sm font-mono text-gray-500 tracking-widest">STAR CITIZEN COMPANION</p>
        </div>

        <div className="panel p-8">
          <h2 className="font-display font-bold text-lg text-white mb-6 text-center">Set New Password</h2>

          {success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Password reset successfully. Redirecting to sign in...</span>
              </div>
              <div className="text-center">
                <Link to="/login" className="text-xs font-mono text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wider">
                  Go to sign in now
                </Link>
              </div>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error || 'No reset token found. Please request a new password reset link.'}</span>
              </div>
              <div className="text-center">
                <Link to="/forgot-password" className="text-xs font-mono text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wider">
                  Request a new reset link
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 font-display tracking-wider uppercase text-sm disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <div className="text-center mt-4">
                <Link to="/login" className="text-xs font-mono text-gray-500 hover:text-gray-400 transition-colors tracking-wider inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
