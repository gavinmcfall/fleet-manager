export default function InsuranceBadge({ isLifetime, label }) {
  if (!label) return <span className="text-xs text-gray-400">&mdash;</span>

  return isLifetime ? (
    <span className="badge badge-lti">LTI</span>
  ) : (
    <span className="badge badge-nonlti">{label}</span>
  )
}
