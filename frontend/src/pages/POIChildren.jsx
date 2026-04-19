import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { usePOIChildren } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import SearchInput from '../components/SearchInput'

/**
 * Parent-level POI index — `/poi/at/:parentSlug`. Shows the full uncapped
 * list of POIs under the given parent, which the POI detail's sibling
 * section caps at 12. Reached via the "See all" link when a POI has >12
 * siblings.
 */
export default function POIChildren() {
  const { parentSlug } = useParams()
  const slug = parentSlug ? decodeURIComponent(parentSlug) : ''
  const { data, loading, error, refetch } = usePOIChildren(slug)
  const [query, setQuery] = useState('')
  const [activityOnly, setActivityOnly] = useState(false)

  const filtered = useMemo(() => {
    if (!data?.children) return []
    const q = query.trim().toLowerCase()
    return data.children.filter(c => {
      if (activityOnly && !c.has_activity) return false
      if (q && !c.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, query, activityOnly])

  if (loading) return <LoadingState message="Loading nearby POIs..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data || !data.parent) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <Link to="/poi" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Locations
        </Link>
        <EmptyState
          message="This parent location couldn't be found."
          icon={MapPin}
          large
          actionLink={{ to: '/poi', label: 'Browse all locations' }}
        />
      </div>
    )
  }

  const activityCount = data.children.filter(c => c.has_activity).length

  return (
    <div className="space-y-5 animate-fade-in-up">
      <Link
        to={`/poi/${encodeURIComponent(data.parent.slug)}`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {data.parent.name}
      </Link>

      <PageHeader
        title={`POIs at ${data.parent.name}`}
        subtitle={`${data.children.length} location${data.children.length !== 1 ? 's' : ''} · ${activityCount} with known activity`}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search POIs..."
          className="flex-1 max-w-sm"
        />
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={activityOnly}
            onChange={e => setActivityOnly(e.target.checked)}
            className="accent-sc-accent"
          />
          Only POIs with shops
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-6">No POIs match these filters.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map(c => (
            <Link
              key={c.id}
              to={`/poi/${encodeURIComponent(c.slug)}`}
              className={`flex items-center gap-2 px-3 py-2 border rounded text-xs transition-colors ${
                c.has_activity
                  ? 'border-sc-border hover:border-sc-accent/40 text-gray-200 hover:text-sc-accent'
                  : 'border-sc-border/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              <MapPin className={`w-3 h-3 shrink-0 ${c.has_activity ? 'text-sc-accent/50' : 'text-gray-600'}`} />
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
