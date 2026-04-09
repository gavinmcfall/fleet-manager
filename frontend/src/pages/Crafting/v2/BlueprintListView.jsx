import React, { useMemo } from 'react'
import BlueprintListHeader from './BlueprintListHeader'
import BlueprintListRow from './BlueprintListRow'
import useSortState from './useSortState'
import { STAT_CONFIG, readStat } from './statConfig'

/**
 * Selector builder — given a column key like 'dps_base' or 'rpm_max' or
 * 'craft' or 'name', return a function that extracts that value from a row.
 */
function buildSelector(colKey, statConfig) {
  if (colKey === 'name') return (bp) => bp.base_stats?.item_name || bp.name || ''
  if (colKey === 'craft') return (bp) => bp.craft_time_seconds ?? null

  // <statKey>_base or <statKey>_max
  const [statKey, tone] = colKey.split('_')
  const stat = statConfig?.stats.find(s => s.key === statKey)
  if (!stat) return () => null
  const path = tone === 'max' ? stat.maxPath : stat.basePath
  return (bp) => readStat(bp, path) ?? (tone === 'max' ? readStat(bp, stat.basePath) : null)
}

/**
 * List view container. Sticky two-row header + sortable data rows.
 *
 * Scroll context: the .list-view wrapper owns overflow (+ max-height set
 * by the caller). The header sticks to the top of this container, not
 * the viewport — see spec §11.2.
 */
export default function BlueprintListView({
  blueprints,
  activeType,
  compareItems = [],
  favorites = new Set(),
  onFavorite = () => {},
  onQualitySim = () => {},
  onCompare = () => {},
  maxHeight = 'calc(100vh - 280px)',
}) {
  const sort = useSortState('craft', 'desc')
  const statConfig = STAT_CONFIG[activeType]

  const sortedBlueprints = useMemo(() => {
    const selector = buildSelector(sort.column, statConfig)
    return sort.applySort(blueprints, selector)
  }, [blueprints, sort, statConfig])

  const inCompare = (bp) => compareItems.some(i => i.id === bp.id)

  return (
    <div
      className="overflow-auto rounded-[var(--radius-2xl)] border border-[var(--surface-list-border)] bg-[var(--surface-list)]"
      style={{ maxHeight }}
    >
      <BlueprintListHeader
        type={activeType}
        sortColumn={sort.column}
        sortDir={sort.direction}
        onSort={sort.toggle}
      />
      {sortedBlueprints.map(bp => (
        <BlueprintListRow
          key={bp.id}
          blueprint={bp}
          isInCompare={inCompare(bp)}
          isFavorite={favorites.has(bp.id)}
          onFavorite={onFavorite}
          onQualitySim={onQualitySim}
          onCompare={onCompare}
        />
      ))}
    </div>
  )
}
