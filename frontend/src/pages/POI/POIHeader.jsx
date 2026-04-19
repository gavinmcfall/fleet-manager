import React from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'

/**
 * POI page header — title + type badge + breadcrumb hierarchy.
 * Deliberately does NOT display a single "N items available" count, which
 * conflated loot-spawn-pool with shop-inventory on the old design. Each
 * section below the header has its own count.
 */
export default function POIHeader({ location }) {
  const breadcrumb = (location.hierarchy || [])
    .slice()
    .reverse() // deepest parent first → shown as breadcrumb
  const typeLabel =
    location.type && location.type !== 'unknown'
      ? location.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'POI'

  return (
    <div className="space-y-2">
      {breadcrumb.length > 0 && (
        <nav
          aria-label="Location hierarchy"
          className="text-[11px] font-mono text-gray-500 flex items-center gap-1 flex-wrap"
        >
          {breadcrumb.map((step, i) => (
            <React.Fragment key={step.slug}>
              <Link
                to={`/poi/${encodeURIComponent(step.slug)}`}
                className="hover:text-sc-accent transition-colors"
              >
                {step.name}
              </Link>
              {i < breadcrumb.length - 1 && <span className="text-gray-700">›</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      <PageHeader
        title={location.name}
        subtitle={null}
        actions={
          <span className="text-[10px] font-display uppercase tracking-wide px-2 py-1 rounded bg-sc-accent/10 text-sc-accent border border-sc-accent/30">
            {typeLabel}
          </span>
        }
      />
      {location.description && (
        <p className="text-xs text-gray-400 max-w-2xl">{location.description}</p>
      )}
    </div>
  )
}
