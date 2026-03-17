import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Rocket, Mail, AlertCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })
      if (error) {
        setError(error.message || 'Failed to send reset email')
      } else {
        setSent(true)
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
          <h2 className="font-display font-bold text-lg text-white mb-6 text-center">Reset Password</h2>

          {sent ? (
            <div className="space-y-4">
              <div className="p-3 bg-sc-accent/10 border border-sc-accent/30 rounded text-sm text-sc-accent text-center">
                Check your inbox — we sent a password reset link to <strong>{email}</strong>. It expires in 10 minutes.
              </div>
              <div className="text-center">
                <Link to="/login" className="text-xs font-mono text-sc-accent hover:text-sc-accent/80 transition-colors tracking-wider inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4 text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                      placeholder="commander@rsi.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 font-display tracking-wider uppercase text-sm disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
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
