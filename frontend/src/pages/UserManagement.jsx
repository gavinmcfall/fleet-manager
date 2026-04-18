import React, { useState, useEffect, useCallback } from 'react'
import { Users, Shield, Ban, Trash2, AlertCircle, UserCheck } from 'lucide-react'
import { authClient, useSession } from '../lib/auth-client'
import useTimezone from '../hooks/useTimezone'
import { formatDate } from '../lib/dates'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import PanelSection from '../components/PanelSection'
import ConfirmDialog from '../components/ConfirmDialog'

const ROLES = ['user', 'admin', 'super_admin']

const PAGE_SIZE = 100

export default function UserManagement() {
  const { timezone } = useTimezone()
  const { data: session } = useSession()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [banTarget, setBanTarget] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [impersonateTarget, setImpersonateTarget] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.admin.listUsers({ query: { limit: PAGE_SIZE } })
      const fetched = result.data?.users || []
      setUsers(fetched)
      setHasMore(fetched.length >= PAGE_SIZE)
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await authClient.admin.listUsers({ query: { limit: PAGE_SIZE, offset: users.length } })
      const fetched = result.data?.users || []
      setUsers(prev => [...prev, ...fetched])
      setHasMore(fetched.length >= PAGE_SIZE)
    } catch (err) {
      setActionError(err.message || 'Failed to load more users')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, users.length])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const confirmSetRole = async () => {
    if (!roleTarget) return
    const { id, role } = roleTarget
    setRoleTarget(null)
    setActionLoading(id)
    setActionError(null)
    try {
      await authClient.admin.setRole({ userId: id, role })
      await fetchUsers()
    } catch (err) {
      setActionError(err.message || 'Failed to update role')
    } finally {
      setActionLoading(null)
    }
  }

  const confirmBan = async () => {
    if (!banTarget) return
    const { id, banned } = banTarget
    setBanTarget(null)
    setActionLoading(id)
    setActionError(null)
    try {
      if (banned) {
        await authClient.admin.banUser({ userId: id })
      } else {
        await authClient.admin.unbanUser({ userId: id })
      }
      await fetchUsers()
    } catch (err) {
      setActionError(err.message || `Failed to ${banned ? 'ban' : 'unban'} user`)
    } finally {
      setActionLoading(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setActionLoading(id)
    setActionError(null)
    try {
      await authClient.admin.removeUser({ userId: id })
      await fetchUsers()
    } catch (err) {
      setActionError(err.message || 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  const confirmImpersonate = async () => {
    if (!impersonateTarget) return
    const { id } = impersonateTarget
    setImpersonateTarget(null)
    setActionLoading(id)
    setActionError(null)
    try {
      await authClient.admin.impersonateUser({ userId: id })
      window.location.href = '/'
    } catch (err) {
      setActionError(err.message || 'Failed to impersonate user')
      setActionLoading(null)
    }
  }

  if (loading) return <LoadingState variant="skeleton" />

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="USER MANAGEMENT"
        subtitle={`${users.length} registered user${users.length !== 1 ? 's' : ''}`}
      />

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {error ? (
        <div className="text-center text-gray-500 text-sm py-8">
          Failed to load users: {error}
        </div>
      ) : (
        <PanelSection title="Users" icon={Users} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Registered users</caption>
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sc-border/30">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm text-white">{u.name || '—'}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-300">{u.email}</td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role || 'user'}
                        onChange={(e) => {
                          const newRole = e.target.value
                          if (newRole !== (u.role || 'user')) {
                            setRoleTarget({ id: u.id, name: u.name || u.email, currentRole: u.role || 'user', role: newRole })
                          }
                        }}
                        disabled={actionLoading === u.id}
                        className="bg-sc-darker border border-sc-border rounded px-2 py-1 text-xs text-gray-300 focus:border-sc-accent focus:outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      {u.banned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-sc-danger">
                          <Ban className="w-3 h-3" /> Banned
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-sc-success">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                      {formatDate(u.createdAt, timezone)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setImpersonateTarget({ id: u.id, name: u.name || u.email })}
                          disabled={actionLoading === u.id || u.id === session?.user?.id}
                          aria-label={`Impersonate ${u.name || u.email}`}
                          title="Impersonate"
                          className="p-1.5 rounded text-sc-accent hover:bg-sc-accent/10 transition-colors disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setBanTarget({ id: u.id, name: u.name || u.email, banned: !u.banned })}
                          disabled={actionLoading === u.id || u.id === session?.user?.id}
                          aria-label={`${u.banned ? 'Unban' : 'Ban'} ${u.name || u.email}`}
                          title={u.banned ? 'Unban' : 'Ban'}
                          className={`p-1.5 rounded transition-colors ${
                            u.banned
                              ? 'text-sc-success hover:bg-sc-success/10'
                              : 'text-sc-warn hover:bg-sc-warn/10'
                          } disabled:opacity-50`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: u.id, name: u.name || u.email })}
                          disabled={actionLoading === u.id || u.id === session?.user?.id}
                          aria-label={`Delete user ${u.name || u.email}`}
                          title="Delete user"
                          className="p-1.5 rounded text-sc-danger hover:bg-sc-danger/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelSection>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-secondary text-xs"
          >
            {loadingMore ? 'Loading...' : `Load More (showing ${users.length})`}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete User"
        message={deleteTarget ? `Delete user "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        open={!!roleTarget}
        onConfirm={confirmSetRole}
        onCancel={() => setRoleTarget(null)}
        title="Change Role"
        message={
          roleTarget
            ? `Change role for "${roleTarget.name}" from ${roleTarget.currentRole} to ${roleTarget.role}?${
                roleTarget.role === 'super_admin'
                  ? ' This grants full access to every user and every admin action.'
                  : ''
              }`
            : ''
        }
        confirmLabel={roleTarget?.role === 'super_admin' ? 'Grant super_admin' : 'Change Role'}
        variant={roleTarget?.role === 'super_admin' ? 'danger' : 'warning'}
      />

      <ConfirmDialog
        open={!!banTarget}
        onConfirm={confirmBan}
        onCancel={() => setBanTarget(null)}
        title={banTarget?.banned ? 'Ban User' : 'Unban User'}
        message={
          banTarget
            ? banTarget.banned
              ? `Ban "${banTarget.name}"? They will be signed out and unable to log in.`
              : `Unban "${banTarget.name}"? They will be able to log in again.`
            : ''
        }
        confirmLabel={banTarget?.banned ? 'Ban' : 'Unban'}
        variant={banTarget?.banned ? 'danger' : 'warning'}
      />

      <ConfirmDialog
        open={!!impersonateTarget}
        onConfirm={confirmImpersonate}
        onCancel={() => setImpersonateTarget(null)}
        title="Impersonate User"
        message={
          impersonateTarget
            ? `Sign in as "${impersonateTarget.name}"? You'll see the app as they do until you stop impersonating.`
            : ''
        }
        confirmLabel="Impersonate"
        variant="warning"
      />
    </div>
  )
}
