import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

/**
 * Sibling POIs under the same parent. Capped at 12 server-side, sorted so
 * activity-having rows (shops / missions / loot) come first. If truncated,
 * show a "see all" link — but the parent-level index page doesn't exist yet
 * (follow-up), so currently the link falls back to /poi.
 */
export default function POISiblings({ envelope, parentSlug }) {
  if (envelope.count === 0) return null

  return (
    <section>
      <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">
        Other POIs nearby ({envelope.count})
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {envelope.data.map(s => (
          <Link
            key={s.id}
            to={`/poi/${encodeURIComponent(s.slug)}`}
            className={`flex items-center gap-2 px-3 py-2 border rounded text-xs transition-colors ${
              s.has_activity
                ? 'border-sc-border hover:border-sc-accent/40 text-gray-200 hover:text-sc-accent'
                : 'border-sc-border/50 text-gray-500 hover:text-gray-300'
            }`}
          >
            <MapPin className={`w-3 h-3 shrink-0 ${s.has_activity ? 'text-sc-accent/50' : 'text-gray-600'}`} />
            <span className="truncate">{s.name}</span>
          </Link>
        ))}
      </div>
      {envelope.truncated && (
        <p className="mt-2 text-[10px] text-gray-500">
          Showing 12 of {envelope.count}+ nearby POIs.
          {parentSlug && (
            <Link to={`/poi/${encodeURIComponent(parentSlug)}`} className="ml-1 text-sc-accent hover:underline">
              See all
            </Link>
          )}
        </p>
      )}
    </section>
  )
}
