import React from 'react'
import { useStatus, useAnalysis, triggerShipSync } from '../hooks/useAPI'
import { RefreshCw, Rocket, Package, Users, Shield, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'

const COLORS = ['#38bdf8', '#818cf8', '#a78bfa', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#6366f1']

export default function Dashboard() {
  const { data: status, loading: statusLoading, refetch: refetchStatus } = useStatus()
  const { data: analysis, loading: analysisLoading } = useAnalysis()

  const handleSyncShips = async () => {
    await triggerShipSync()
    setTimeout(refetchStatus, 2000)
  }

  if (statusLoading || analysisLoading) {
    return <LoadingState />
  }

  const overview = analysis?.overview || {}
  const sizeDist = analysis?.size_distribution || {}
  const roles = analysis?.role_categories || {}

  const sizeData = Object.entries(sizeDist).map(([name, value]) => ({ name, value }))
  const roleData = Object.entries(roles).map(([name, ships]) => ({ name, count: ships.length }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">FLEET OVERVIEW</h2>
          <p className="text-xs font-mono text-gray-500 mt-1">
            {status?.ships || 0} ships in database · {status?.vehicles || 0} in hangar
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSyncShips} className="btn-primary flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Sync Ship DB
          </button>
        </div>
      </div>

      <div className="glow-line" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={Rocket} label="Total Ships" value={overview.total_vehicles || 0} />
        <StatCard icon={Package} label="Cargo (SCU)" value={(overview.total_cargo || 0).toLocaleString()} />
        <StatCard icon={Users} label="Min Crew" value={overview.min_crew || 0} />
        <StatCard icon={Users} label="Max Crew" value={overview.max_crew || 0} />
        <StatCard icon={Shield} label="LTI" value={overview.lti_count || 0} color="text-sc-lti" />
        <StatCard
          icon={AlertTriangle}
          label="Pledge Value"
          value={`$${(overview.total_pledge_value || 0).toLocaleString()}`}
          color="text-sc-warn"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Size Distribution */}
        <div className="panel">
          <div className="panel-header">Size Distribution</div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sizeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={true}
                >
                  {sizeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Role Categories */}
        <div className="panel">
          <div className="panel-header">Role Categories</div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  width={75}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="#38bdf8" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {status?.sync_status && status.sync_status.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="panel-header">Recent Syncs</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items Synced
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sc-border/30">
                {status.sync_status.slice(0, 5).map((s, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-2 text-xs font-mono ${
                        s.status === 'success' ? 'text-sc-success' :
                        s.status === 'error' ? 'text-sc-danger' : 'text-sc-warn'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          s.status === 'success' ? 'bg-sc-success' :
                          s.status === 'error' ? 'bg-sc-danger' : 'bg-sc-warn animate-pulse'
                        }`} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-300">
                      {s.sync_type}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-400 text-right">
                      {s.item_count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color = 'text-white' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-600" />
        <span className="stat-label">{label}</span>
      </div>
      <span className={`stat-value ${color}`}>{value}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-sc-accent animate-spin mx-auto mb-3" />
        <p className="text-sm font-mono text-gray-500">Loading fleet data...</p>
      </div>
    </div>
  )
}
