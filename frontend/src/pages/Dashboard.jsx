import React from 'react'
import { Link } from 'react-router-dom'
import { useStatus, useAnalysis, triggerImageSync } from '../hooks/useAPI'
import { RefreshCw, Rocket, Package, Users, Shield, AlertTriangle, DollarSign } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { CHART_COLORS, TOOLTIP_STYLE } from '../lib/theme'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import StatCard from '../components/StatCard'
import PanelSection from '../components/PanelSection'

export default function Dashboard() {
  const { data: status, loading: statusLoading, refetch: refetchStatus } = useStatus()
  const { data: analysis, loading: analysisLoading } = useAnalysis()

  const handleSyncImages = async () => {
    await triggerImageSync()
    setTimeout(refetchStatus, 2000)
  }

  if (statusLoading || analysisLoading) {
    return <LoadingState variant="skeleton" />
  }

  const overview = analysis?.overview || {}
  const sizeDist = analysis?.size_distribution || {}
  const roles = analysis?.role_categories || {}
  const totalVehicles = overview.total_vehicles || 0

  const sizeData = Object.entries(sizeDist).map(([name, value]) => ({ name, value }))
  const roleData = Object.entries(roles).map(([name, ships]) => ({ name, count: ships.length }))

  // Empty fleet — show onboarding
  if (totalVehicles === 0) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader
          title="FLEET OVERVIEW"
          subtitle={`${status?.ships || 0} ships in database`}
          actions={
            <button onClick={handleSyncImages} className="btn-primary flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Ship DB
            </button>
          }
        />
        <div className="panel p-12 text-center">
          <Rocket className="w-16 h-16 mx-auto mb-4 text-sc-accent/60" />
          <h2 className="font-display font-bold text-2xl text-white mb-2">Welcome, Commander</h2>
          <p className="text-gray-400 text-base mb-6 max-w-md mx-auto">
            Your fleet is empty. Import your hangar from HangarXplor to get started with fleet tracking, insurance monitoring, and gap analysis.
          </p>
          <Link to="/import" className="btn-primary inline-flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Import Your Fleet
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="FLEET OVERVIEW"
        subtitle={`${status?.ships || 0} ships in database · ${status?.vehicles || 0} in fleet`}
        actions={
          <div className="flex gap-2">
            <button onClick={handleSyncImages} className="btn-primary flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Ship DB
            </button>
          </div>
        }
      />

      {/* Hero Stat */}
      <div className="panel p-6 flex items-center justify-between">
        <div>
          <p className="stat-label mb-1">Total Fleet Value</p>
          <p className="text-4xl font-display font-bold text-sc-accent">
            ${(overview.total_pledge_value || 0).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="stat-label mb-1">Ship Count</p>
          <p className="text-3xl font-display font-bold text-white">
            {totalVehicles}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-fade-in-up">
        <StatCard icon={Rocket} label="Total Ships" value={totalVehicles} />
        <StatCard icon={Package} label="Cargo (SCU)" value={(overview.total_cargo || 0).toLocaleString()} />
        <StatCard icon={Users} label="Min Crew" value={overview.min_crew || 0} />
        <StatCard icon={Users} label="Max Crew" value={overview.max_crew || 0} />
        <StatCard icon={Shield} label="LTI" value={overview.lti_count || 0} color="text-sc-lti" />
        <StatCard
          icon={DollarSign}
          label="Pledge Value"
          value={`$${(overview.total_pledge_value || 0).toLocaleString()}`}
          color="text-sc-warn"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelSection title="Size Distribution">
          <div className="p-4 h-64" role="img" aria-label={`Size distribution: ${sizeData.map(d => `${d.name}: ${d.value}`).join(', ')}`}>
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
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PanelSection>

        <PanelSection title="Role Categories">
          <div className="p-4 h-64" role="img" aria-label={`Role categories: ${roleData.map(d => `${d.name}: ${d.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  width={75}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_COLORS[0]} fillOpacity={0.7} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelSection>
      </div>

      {/* Sync Status */}
      {status?.sync_status && status.sync_status.length > 0 && (
        <PanelSection title="Recent Syncs" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Recent data sync history</caption>
              <thead>
                <tr className="border-b border-sc-border/50">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Items Synced
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                      {s.source_label || s.endpoint}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-400 text-right">
                      {(s.record_count || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelSection>
      )}
    </div>
  )
}
