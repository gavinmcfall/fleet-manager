import usePrivacyMode from '../hooks/usePrivacyMode'

/**
 * Masks children based on privacy mode.
 *
 * - off:     show children
 * - hidden:  show placeholder (•••)
 * - stealth: if `value` is provided, show value * stealthPercent%;
 *            otherwise fall back to placeholder
 *
 * @param {React.ReactNode} children — real content
 * @param {string} placeholder — shown in hidden mode
 * @param {number} [value] — numeric value for stealth calculation
 * @param {string} [prefix='$'] — prefix for stealth display (e.g. '$')
 */
export default function PrivacyMask({ children, placeholder = '•••', value, prefix = '$' }) {
  const { mode, stealthPercent } = usePrivacyMode()

  if (mode === 'off') return children

  if (mode === 'stealth' && value != null && !isNaN(value)) {
    const altered = Math.round(value * stealthPercent / 100)
    return <span className="text-inherit">{prefix}{altered.toLocaleString()}</span>
  }

  return <span className="text-gray-600 select-none">{placeholder}</span>
}
