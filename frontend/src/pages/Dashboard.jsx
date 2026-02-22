import React from 'react'
import { Link } from 'react-router-dom'
import { useStatus, useAnalysis, triggerImageSync } from '../hooks/useAPI'
import { RefreshCw, Rocket, Package, Users, Shield, DollarSign, Activity, Crosshair } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { CHART_COLORS, TOOLTIP_STYLE } from '../lib/theme'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
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

  const ltiPercent = totalVehicles > 0 ? Math.round(((overview.lti_count || 0) / totalVehicles) * 100) : 0
  const readyPercent = totalVehicles > 0 ? Math.round(((overview.flight_ready || 0) / totalVehicles) * 100) : 0

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

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Hero: Fleet Value — spans 2 cols */}
        <div className="panel col-span-2 p-6 bg-grid animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-sc-accent" />
            <span className="stat-label">Total Fleet Value</span>
          </div>
          <p className="text-5xl font-display font-bold text-sc-accent leading-tight">
            ${(overview.total_pledge_value || 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-2 font-mono">{totalVehicles} ships pledged</p>
        </div>

        {/* Ship Count */}
        <div className="panel p-5 bg-grid animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-4 h-4 text-sc-accent2" />
            <span className="stat-label">Ships</span>
          </div>
          <p className="text-4xl font-display font-bold text-white">{totalVehicles}</p>
        </div>

        {/* Cargo */}
        <div className="panel p-5 bg-grid animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-sc-accent2" />
            <span className="stat-label">Cargo (SCU)</span>
          </div>
          <p className="text-4xl font-display font-bold text-white">{(overview.total_cargo || 0).toLocaleString()}</p>
        </div>

        {/* Min Crew */}
        <div className="panel p-5 bg-grid animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="stat-label">Min Crew</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">{overview.min_crew || 0}</p>
        </div>

        {/* Max Crew */}
        <div className="panel p-5 bg-grid animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="stat-label">Max Crew</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">{overview.max_crew || 0}</p>
        </div>

        {/* Fleet Health — spans 2 cols */}
        <div className="panel col-span-2 p-5 bg-grid animate-slide-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-sc-success" />
            <span className="stat-label">Fleet Health</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-sc-lti">LTI Coverage</span>
                <span className="text-gray-400">{overview.lti_count || 0}/{totalVehicles} ({ltiPercent}%)</span>
              </div>
              <div className="status-bar" role="progressbar" aria-valuenow={ltiPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`LTI coverage: ${ltiPercent}%`}>
                <div className="status-bar-fill bg-sc-lti" style={{ width: `${ltiPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-sc-success">Flight Ready</span>
                <span className="text-gray-400">{overview.flight_ready || 0}/{totalVehicles} ({readyPercent}%)</span>
              </div>
              <div className="status-bar" role="progressbar" aria-valuenow={readyPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`Flight ready: ${readyPercent}%`}>
                <div className="status-bar-fill bg-sc-success" style={{ width: `${readyPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelSection title="Size Distribution" icon={Crosshair}>
          <div className="p-4 h-64 bg-grid" role="img" aria-label={`Size distribution: ${sizeData.map(d => `${d.name}: ${d.value}`).join(', ')}`}>
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

        <PanelSection title="Role Categories" icon={Shield}>
          <div className="p-4 h-64 bg-grid" role="img" aria-label={`Role categories: ${roleData.map(d => `${d.name}: ${d.count}`).join(', ')}`}>
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
