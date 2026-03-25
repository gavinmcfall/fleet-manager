import React from 'react'
import { ExternalLink } from 'lucide-react'

const TOOLS = [
  {
    name: 'CCU Game',
    url: 'https://ccugame.app/',
    logo: '/partners/ccugame.png',
    description: 'Find the cheapest upgrade path to any ship. Scans your hangar, buyback, and the pledge store to build optimal CCU chains.',
  },
]

export default function CommunityTools() {
  return (
    <div className="panel">
      <div className="panel-header text-[10px] uppercase tracking-widest text-gray-500">Community Tools</div>
      <div className="p-4 space-y-3">
        {TOOLS.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 -m-1 rounded-lg hover:bg-white/[0.03] transition-colors group"
          >
            <img src={tool.logo} alt="" className="w-8 h-8 rounded shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{tool.name}</span>
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{tool.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
