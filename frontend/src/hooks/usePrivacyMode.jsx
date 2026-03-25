import { createContext, useContext, useState, useCallback } from 'react'

const PrivacyModeContext = createContext({ privacyMode: false, togglePrivacy: () => {} })

export function PrivacyModeProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('sc-bridge-privacy') === '1' } catch { return false }
  })

  const togglePrivacy = useCallback(() => {
    setPrivacyMode(prev => {
      const next = !prev
      try { localStorage.setItem('sc-bridge-privacy', next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, togglePrivacy }}>
      {children}
    </PrivacyModeContext.Provider>
  )
}

export default function usePrivacyMode() {
  return useContext(PrivacyModeContext)
}

/** Mask a value when privacy mode is on. Returns the value or '•••' */
export function usePrivacyValue(value) {
  const { privacyMode } = useContext(PrivacyModeContext)
  if (!privacyMode) return value
  return '•••'
}
