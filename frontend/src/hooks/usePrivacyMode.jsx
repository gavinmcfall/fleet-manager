import { createContext, useContext, useState, useCallback } from 'react'

/**
 * Privacy/Stealth mode context.
 *
 * Modes:
 *   'off'     — show real values
 *   'hidden'  — mask with dots (•••)
 *   'stealth' — show values multiplied by stealthPercent
 */
const PrivacyModeContext = createContext({
  mode: 'off',
  privacyMode: false,
  stealthPercent: 10,
  cycleMode: () => {},
  setStealthPercent: () => {},
  togglePrivacy: () => {},
})

const MODE_ORDER = ['off', 'hidden', 'stealth']
const STORAGE_KEY = 'sc-bridge-privacy'
const PERCENT_KEY = 'sc-bridge-stealth-pct'

function loadMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '1' || v === 'hidden') return 'hidden'
    if (v === 'stealth') return 'stealth'
    return 'off'
  } catch { return 'off' }
}

function loadPercent() {
  try {
    const v = parseInt(localStorage.getItem(PERCENT_KEY), 10)
    return v > 0 && v <= 100 ? v : 10
  } catch { return 10 }
}

export function PrivacyModeProvider({ children }) {
  const [mode, setMode] = useState(loadMode)
  const [stealthPercent, setStealthPercentState] = useState(loadPercent)

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const idx = MODE_ORDER.indexOf(prev)
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  // Legacy toggle: cycles off → hidden → off (skips stealth for quick toggle)
  const togglePrivacy = useCallback(() => {
    cycleMode()
  }, [cycleMode])

  const setStealthPercent = useCallback((pct) => {
    const clamped = Math.max(1, Math.min(100, pct))
    setStealthPercentState(clamped)
    try { localStorage.setItem(PERCENT_KEY, String(clamped)) } catch {}
  }, [])

  return (
    <PrivacyModeContext.Provider value={{
      mode,
      privacyMode: mode !== 'off',
      stealthPercent,
      cycleMode,
      setStealthPercent,
      togglePrivacy,
    }}>
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
