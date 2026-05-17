// PART L L8 — Storage taxonomy display for ship detail.
// Summary tiles (rolled-up totals) + collapsible per-feature detail list.

const TYPE_LABELS = {
  internal_grid: 'Interior Grid',
  external_pod: 'External Pod',
  fuel_cargo: 'Refuel Cargo',
  personal_locker: 'Personal Locker',
  suit_locker: 'Suit Locker',
  weapon_rack: 'Weapon Rack',
}

const TYPE_ORDER = [
  'internal_grid',
  'external_pod',
  'fuel_cargo',
  'personal_locker',
  'suit_locker',
  'weapon_rack',
]

function fmtScu(n) {
  if (n == null || n === 0) return null
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} SCU`
}

function fmtMicroScu(n) {
  if (n == null || n === 0) return null
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} µSCU`
}

function SummaryTile({ label, value, accent }) {
  if (value == null || value === 0 || value === '') return null
  return (
    <div className="panel">
      <div className="p-3">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">{label}</div>
        <div className={`text-lg font-mono mt-1 ${accent || 'text-white'}`}>{value}</div>
      </div>
    </div>
  )
}

function DetailRow({ row }) {
  const capacity = row.scu_capacity != null
    ? fmtScu(row.scu_capacity)
    : fmtMicroScu(row.microscu_capacity)
  const count = row.count > 1 ? ` × ${row.count}` : ''
  const total = row.scu_capacity != null && row.count > 1
    ? ` = ${fmtScu(row.scu_capacity * row.count)}`
    : ''
  const label = TYPE_LABELS[row.storage_type] || row.storage_type
  const location = row.location_label || row.container_class_name || ''
  return (
    <li className="flex items-baseline justify-between gap-3 py-1 text-xs font-mono">
      <span className="text-gray-400">
        <span className="text-white">{label}</span>
        {location ? <span className="text-gray-500"> · {location}</span> : null}
      </span>
      <span className="text-gray-300 whitespace-nowrap">
        {capacity ?? '—'}{count}{total}
      </span>
    </li>
  )
}

export default function StorageBreakdown({ storage, summary }) {
  const hasSummary = summary && (
    summary.internal_cargo_scu > 0
    || summary.external_cargo_scu > 0
    || summary.fuel_cargo_scu > 0
    || summary.personal_grid_microscu > 0
    || summary.locker_count > 0
  )
  const hasDetail = Array.isArray(storage) && storage.length > 0
  if (!hasSummary && !hasDetail) return null

  const sortedStorage = hasDetail
    ? [...storage].sort((a, b) => {
        const ai = TYPE_ORDER.indexOf(a.storage_type)
        const bi = TYPE_ORDER.indexOf(b.storage_type)
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        return (b.scu_capacity || 0) - (a.scu_capacity || 0)
      })
    : []

  return (
    <div className="space-y-3">
      {hasSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <SummaryTile label="Interior Cargo" value={fmtScu(summary.internal_cargo_scu)} />
          <SummaryTile label="External Pods" value={fmtScu(summary.external_cargo_scu)} accent="text-emerald-400" />
          <SummaryTile label="Refuel Cargo" value={fmtScu(summary.fuel_cargo_scu)} accent="text-sky-400" />
          <SummaryTile label="Personal Grid" value={fmtMicroScu(summary.personal_grid_microscu)} />
          <SummaryTile label="Suit Lockers" value={summary.locker_count > 0 ? String(summary.locker_count) : null} />
        </div>
      )}
      {hasDetail && (
        <details className="panel">
          <summary className="px-3 py-2 cursor-pointer text-xs font-mono text-gray-400 uppercase tracking-wider hover:text-white">
            Storage detail ({sortedStorage.length})
          </summary>
          <ul className="px-3 pb-3 space-y-1">
            {sortedStorage.map((row) => <DetailRow key={row.id ?? `${row.storage_type}-${row.container_class_name}-${row.location_label}`} row={row} />)}
          </ul>
        </details>
      )}
    </div>
  )
}
