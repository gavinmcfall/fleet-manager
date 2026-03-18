import React, { useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Clock, CheckCircle, XCircle, Archive, Loader2, Users, AlertCircle } from 'lucide-react'
import { useOrgOps } from '../../hooks/useAPI'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import { formatDate } from '../../lib/dates'
import useTimezone from '../../hooks/useTimezone'

const STATUS_CONFIG = {
  planning: { label: 'Planning', icon: Clock, color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  active: { label: 'Active', icon: Loader2, color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-gray-400 bg-white/5 border-sc-border' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  archived: { label: 'Archived', icon: Archive, color: 'text-gray-600 bg-white/5 border-sc-border' },
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export default function OrgOpsList({ slug, callerRole, onCreateOp }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('opStatus') || ''
  const { timezone } = useTimezone()

  const { data, loading, error, refetch } = useOrgOps(slug, statusFilter || undefined)

  const setStatusFilter = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'ops')
      if (val) next.set('opStatus', val)
      else next.delete('opStatus')
      return next
    }, { replace: true })
  }, [setSearchParams])

  if (loading) return <LoadingState message="Loading ops..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const ops = data?.ops ?? []

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wide border transition-colors ${
                statusFilter === value
                  ? 'text-sc-accent border-sc-accent/30 bg-sc-accent/10'
                  : 'text-gray-400 border-sc-border hover:text-gray-300 hover:border-sc-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {onCreateOp && (
          <button
            onClick={onCreateOp}
            className="btn-primary px-3 py-1.5 text-xs font-display tracking-wider uppercase flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Op
          </button>
        )}
      </div>

      {/* Op list */}
      {ops.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-sm">No ops {statusFilter ? `with status "${statusFilter}"` : 'yet'}</p>
          {onCreateOp && (
            <button onClick={onCreateOp} className="btn-primary text-xs mt-3 inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create your first op
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ops.map((op) => {
            const cfg = STATUS_CONFIG[op.status] || STATUS_CONFIG.planning
            const Icon = cfg.icon
            return (
              <Link
                key={op.id}
                to={`/orgs/${slug}/ops/${op.id}`}
                className="flex items-center gap-3 p-3 rounded border border-sc-border/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate group-hover:text-sc-accent transition-colors">
                      {op.name}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border font-display shrink-0 ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span className="text-gray-400">{op.op_type_label}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {op.participant_count}
                    </span>
                    <span>·</span>
                    <span>{op.creator_name}</span>
                    <span>·</span>
                    <span className="font-mono">{formatDate(op.created_at, timezone)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
