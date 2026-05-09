/**
 * Pure helpers for the /hangar page. Extracted into a separate module
 * so they can be unit-tested without spinning up the full page (which
 * needs router + auth + data hooks).
 */

export const KIND_ORDER = [
  'Ship',
  'Skin',
  'Insurance',
  'FPS Equipment',
  'Component',
  'Hangar decoration',
  'Credits',
]

const KIND_LABELS = {
  uncategorised: 'Uncategorised',
}

export function kindLabel(kind) {
  return KIND_LABELS[kind] || kind
}

/** Strip RSI's verbose pledge-name boilerplate so the sub-line stays scannable. */
export function cleanPledgeName(name) {
  if (!name) return null
  return name
    .replace(/^Standalone\s+Ships?\s*-\s*/i, '')
    .replace(/^Package\s*-\s*/i, '')
    .replace(/^Add-Ons\s*-\s*/i, '')
    .replace(/^Combo\s*-\s*/i, '')
    .replace(/^Upgrade\s*-\s*/i, 'CCU: ')
    .trim()
}

export function formatPledgeValue(cents) {
  if (cents == null || cents <= 0) return null
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

/**
 * Order the kinds returned by the API into the canonical chip-row sequence.
 * Known kinds appear in KIND_ORDER first; unknown ones appended in
 * insertion order; 'uncategorised' always last.
 */
export function orderedKinds(counts) {
  const seen = new Set()
  const result = []
  for (const k of KIND_ORDER) {
    if (counts[k]) {
      result.push(k)
      seen.add(k)
    }
  }
  for (const k of Object.keys(counts)) {
    if (k === 'uncategorised') continue
    if (!counts[k]) continue
    if (!seen.has(k)) {
      result.push(k)
      seen.add(k)
    }
  }
  if (counts.uncategorised) result.push('uncategorised')
  return result
}

/** Filter predicate factory used by the page-level useMemo. */
export function buildItemFilter({ search, kindFilter, mfrFilter }) {
  const needle = (search ?? '').trim().toLowerCase()
  return (item) => {
    if (kindFilter && kindFilter !== 'all') {
      const itemKind = item.kind ?? 'uncategorised'
      if (itemKind !== kindFilter) return false
    }
    if (mfrFilter && mfrFilter !== 'all') {
      if ((item.manufacturer_code ?? '') !== mfrFilter) return false
    }
    if (needle) {
      const haystack = [
        item.title,
        item.custom_name,
        item.manufacturer_code,
        item.manufacturer_name,
        item.pledge_name,
        item.serial,
        item.kind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  }
}
