import React from 'react'
import { Link } from 'react-router-dom'
import { Tag, Image, RefreshCw, Trash2, Ticket } from 'lucide-react'

const SECTIONS = [
  {
    to: '/admin/versions',
    icon: Tag,
    title: 'Versions',
    description: 'Flip default game version, purge PTU data',
  },
  {
    to: '/admin/data',
    icon: Image,
    title: 'Data',
    description: 'Add concept ships, manage image captures + media library',
  },
  {
    to: '/admin/sync',
    icon: RefreshCw,
    title: 'Sync',
    description: 'Manual RSI/UEX sync triggers + history',
  },
  {
    to: '/admin/cache',
    icon: Trash2,
    title: 'Cache',
    description: 'Purge SC_BRIDGE_CACHE KV',
  },
  {
    to: '/admin/users',
    icon: Ticket,
    title: 'Users',
    description: 'Generate invite links',
  },
]

export default function AdminOverview() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SECTIONS.map(({ to, icon: Icon, title, description }) => (
        <Link
          key={to}
          to={to}
          className="bg-sc-darker border border-sc-border rounded p-4 hover:border-sc-accent/40 transition-colors block"
        >
          <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 text-sc-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-display tracking-wider uppercase text-gray-200 mb-1">{title}</h3>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
