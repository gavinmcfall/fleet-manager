function formatInsuranceLabel(label) {
  if (!label) return null
  const lower = label.toLowerCase()
  if (lower.includes('lifetime') || lower === 'lti') return 'Lifetime'
  if (lower.includes('unknown')) return null
  const monthMatch = lower.match(/(\d+)[\s-]*month/)
  if (monthMatch) return `${monthMatch[1]} Months`
  if (lower === 'standard insurance' || lower === 'standard') return 'Standard'
  return label.replace(/\s*insurance\s*/i, '').trim() || label
}

export default function InsuranceBadge({ isLifetime, label }) {
  const display = isLifetime ? 'Lifetime' : formatInsuranceLabel(label)
  // F250: keep the em-dash placeholder when insurance data is missing, but
  // explain via title so users aren't left guessing why.
  if (!display) return (
    <span
      className="text-xs text-gray-400"
      title="No insurance data — sync or import pledge details to populate"
    >
      &mdash;
    </span>
  )

  return isLifetime ? (
    <span className="badge badge-lti whitespace-nowrap inline-block w-24 text-center">Lifetime</span>
  ) : (
    <span className="badge badge-nonlti whitespace-nowrap inline-block w-24 text-center">{display}</span>
  )
}
