import usePrivacyMode from '../hooks/usePrivacyMode'

/** Masks children when privacy mode is on. Shows ••• placeholder. */
export default function PrivacyMask({ children, placeholder = '•••' }) {
  const { privacyMode } = usePrivacyMode()
  if (!privacyMode) return children
  return <span className="text-gray-600 select-none">{placeholder}</span>
}
