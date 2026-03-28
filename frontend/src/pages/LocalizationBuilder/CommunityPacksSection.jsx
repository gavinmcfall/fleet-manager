import React from 'react'
import { FlaskConical, AlertTriangle, Gem, Wrench, Zap, FileText, Package } from 'lucide-react'

const ICON_MAP = {
  FlaskConical, AlertTriangle, Gem, Wrench, Zap, FileText, Package,
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-sc-accent' : 'bg-gray-700'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-[2px] ${checked ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  )
}

const BADGE_COLORS = {
  'blueprint-pools': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'contraband-warnings': 'bg-red-500/10 text-red-400 border-red-500/20',
  'material-names': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function CommunityPacksSection({ packs, enabledPacks, onTogglePack }) {
  if (!packs || packs.length === 0) {
    return (
      <div className="panel">
        <div className="px-5 py-4 border-b border-sc-border">
          <h3 className="font-display font-semibold text-sm text-white">Community Packs</h3>
          <p className="text-xs text-gray-500 mt-0.5">Curated string replacement packs from the community</p>
        </div>
        <div className="p-8 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-sm text-gray-500">No community packs available yet.</p>
          <p className="text-xs text-gray-600 mt-1">Packs will appear here once uploaded by an admin.</p>
        </div>
      </div>
    )
  }

  const enabledSet = new Set(enabledPacks || [])

  return (
    <div className="panel">
      <div className="px-5 py-4 border-b border-sc-border">
        <h3 className="font-display font-semibold text-sm text-white">Community Packs</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Curated string replacement packs inspired by{' '}
          <span className="text-sc-accent">StarStrings</span>. Toggle packs on to include their overrides in your download.
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {packs.map(pack => {
          const enabled = enabledSet.has(pack.name)
          const IconComp = ICON_MAP[pack.icon] || Package
          const badgeColor = BADGE_COLORS[pack.name] || 'bg-sc-accent/10 text-sc-accent border-sc-accent/20'

          return (
            <div
              key={pack.name}
              className={`flex gap-3 p-4 rounded-lg border transition-all ${
                enabled
                  ? 'bg-white/[0.03] border-sc-accent/30'
                  : 'bg-white/[0.01] border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                enabled ? 'bg-sc-accent/10' : 'bg-white/[0.03]'
              }`}>
                <IconComp className={`w-5 h-5 ${enabled ? 'text-sc-accent' : 'text-gray-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-white">{pack.label}</h4>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeColor}`}>
                    {pack.keyCount.toLocaleString()} overrides
                  </span>
                </div>
                {pack.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">{pack.description}</p>
                )}
              </div>
              <div className="shrink-0 flex items-start pt-1">
                <Toggle checked={enabled} onChange={() => onTogglePack(pack.name)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
