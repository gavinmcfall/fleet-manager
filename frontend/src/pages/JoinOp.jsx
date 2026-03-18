import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, Clock, AlertCircle, Loader2, LogIn } from 'lucide-react'
import { usePublicOp } from '../hooks/useAPI'
import { useSession } from '../lib/auth-client'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

export default function JoinOp() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { data, loading, error } = usePublicOp(code)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  const handleJoin = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      const resp = await fetch(`/api/ops/join/${code}`, {
        method: 'POST',
        credentials: 'include',
      })
      const d = await resp.json()
      if (!resp.ok) throw new Error(d.error || 'Failed to join')
      navigate(`/orgs/${d.org_slug}/ops/${d.op_id}`)
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  if (isPending || loading) return <LoadingState message="Loading op..." />
  if (error) return <ErrorState message={error} />

  const op = data?.op
  if (!op) return <ErrorState message="Op not found" />

  const isLoggedIn = !!session?.user

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in-up pt-8">
      <PageHeader title="Join Operation" />

      <div className="panel p-6 space-y-4">
        {op.org_logo && (
          <img src={op.org_logo} alt={op.org_name} className="w-12 h-12 rounded border border-sc-border" />
        )}

        <div>
          <h2 className="text-lg font-medium text-white">{op.name}</h2>
          <p className="text-sm text-gray-400 mt-1">{op.op_type_label}</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {op.participant_count} participants
          </span>
          <span>·</span>
          <span>{op.org_name}</span>
        </div>

        {op.description && (
          <p className="text-sm text-gray-400 leading-relaxed">{op.description}</p>
        )}

        {joinError && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{joinError}</span>
          </div>
        )}

        {isLoggedIn ? (
          <button
            onClick={handleJoin}
            disabled={joining || op.status === 'completed' || op.status === 'cancelled'}
            className="btn-primary w-full px-4 py-3 font-display tracking-wider uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {joining ? 'Joining...' : op.status === 'completed' || op.status === 'cancelled' ? 'Op Closed' : 'Join Op'}
          </button>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-400">Sign in to join this op</p>
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/join/${code}`)}`}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 font-display tracking-wider uppercase text-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
