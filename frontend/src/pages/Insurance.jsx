import React from 'react'
import { useAnalysis } from '../hooks/useAPI'
import { Shield, ShieldAlert, ShieldQuestion, Calendar, DollarSign, Tag } from 'lucide-react'

export default function Insurance() {
  const { data: analysis, loading, error } = useAnalysis()

  if (loading) return <div className="text-gray-500 font-mono text-sm p-8">Loading insurance data...</div>
  if (error) return <div className="text-sc-danger font-mono text-sm p-8">Error: {error}</div>

  const ins = analysis?.insurance_summary || {}
  const lti = ins.lti_ships || []
  const nonLTI = ins.non_lti_ships || []
  const unknown = ins.unknown_ships || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">INSURANCE TRACKER</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Upload HangarXplor data to populate insurance info
        </p>
      </div>

      <div className="glow-line" />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card border-l-2 border-l-sc-lti">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sc-lti" />
            <span className="stat-label">LTI Ships</span>
          </div>
          <span className="stat-value text-sc-lti">{lti.length}</span>
        </div>
        <div className="stat-card border-l-2 border-l-sc-warn">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sc-warn" />
            <span className="stat-label">Non-LTI Ships</span>
          </div>
          <span className="stat-value text-sc-warn">{nonLTI.length}</span>
        </div>
        <div className="stat-card border-l-2 border-l-gray-600">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-gray-500" />
            <span className="stat-label">Unknown</span>
          </div>
          <span className="stat-value text-gray-500">{unknown.length}</span>
        </div>
      </div>

      {/* LTI Ships */}
      {lti.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-sc-lti" />
            Lifetime Insurance ({lti.length})
          </div>
          <div className="divide-y divide-sc-border/50">
            {lti.map((ship, i) => (
              <InsuranceRow key={i} ship={ship} />
            ))}
          </div>
        </div>
      )}

      {/* Non-LTI Ships */}
      {nonLTI.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-sc-warn" />
            Non-LTI Ships ({nonLTI.length})
          </div>
          <div className="divide-y divide-sc-border/50">
            {nonLTI.map((ship, i) => (
              <InsuranceRow key={i} ship={ship} />
            ))}
          </div>
        </div>
      )}

      {/* Unknown Insurance */}
      {unknown.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <ShieldQuestion className="w-3.5 h-3.5 text-gray-500" />
            Insurance Unknown ({unknown.length})
          </div>
          <p className="px-5 py-2 text-xs text-gray-500">
            Upload HangarXplor data to populate insurance info for these ships.
          </p>
          <div className="divide-y divide-sc-border/50">
            {unknown.map((ship, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <span className="text-sm text-gray-400">{ship.ship_name}</span>
                {ship.custom_name && (
                  <span className="text-xs text-gray-600 italic">"{ship.custom_name}"</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InsuranceRow({ ship }) {
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{ship.ship_name}</span>
          {ship.custom_name && (
            <span className="text-xs text-gray-500 italic truncate">"{ship.custom_name}"</span>
          )}
        </div>
        {ship.pledge_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <Tag className="w-3 h-3 text-gray-600" />
            <span className="text-[11px] font-mono text-gray-600 truncate">{ship.pledge_name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {ship.pledge_cost && (
          <span className="flex items-center gap-1 text-xs font-mono text-gray-400">
            <DollarSign className="w-3 h-3" />
            {ship.pledge_cost}
          </span>
        )}
        {ship.pledge_date && (
          <span className="flex items-center gap-1 text-xs font-mono text-gray-500">
            <Calendar className="w-3 h-3" />
            {ship.pledge_date}
          </span>
        )}
        {ship.lti ? (
          <span className="badge badge-lti">LTI</span>
        ) : (
          <span className="badge badge-nonlti">STD</span>
        )}
        {ship.warbond && <span className="badge badge-warbond">WB</span>}
      </div>
    </div>
  )
}
