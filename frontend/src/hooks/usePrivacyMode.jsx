import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from '../lib/auth-client'
import { usePreferences, setPreferences as persistPreferences } from './useAPI'

/**
 * Privacy/Stealth mode context.
 *
 * Modes:
 *   'off'     — show real values
 *   'hidden'  — mask with dots (•••)
 *   'stealth' — show values multiplied by stealthPercent
 *
 * Preference is synced to the DB via /api/settings/preferences so it
 * persists across browsers for logged-in users.
 */
const PrivacyModeContext = createContext({
  mode: 'off',
  privacyMode: false,
  stealthPercent: 10,
  cycleMode: () => {},
  setMode: () => {},
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
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const { data: prefs, loading: prefsLoading } = usePreferences({ skip: !isLoggedIn })

  const [mode, setMode] = useState(loadMode)
  const [stealthPercent, setStealthPercentState] = useState(loadPercent)

  const hasSynced = useRef(false)

  // Sync from API on load — API wins over localStorage for logged-in users.
  // On first load after feature rollout, migrates existing localStorage values to DB.
  useEffect(() => {
    if (prefsLoading || !isLoggedIn || prefs === null || hasSynced.current) return
    hasSynced.current = true

    const apiMode = prefs?.privacyMode
    if (apiMode && MODE_ORDER.includes(apiMode)) {
      setMode(apiMode)
      try { localStorage.setItem(STORAGE_KEY, apiMode) } catch {}
    } else if (!apiMode && prefs) {
      // No API value yet — migrate localStorage to DB if non-default
      const localMode = loadMode()
      if (localMode !== 'off') {
        persistPreferences({ privacyMode: localMode }).catch(() => {})
      }
    }

    const apiPct = prefs?.stealthPercent
    if (apiPct) {
      const pct = parseInt(apiPct, 10)
      if (pct > 0 && pct <= 100) {
        setStealthPercentState(pct)
        try { localStorage.setItem(PERCENT_KEY, String(pct)) } catch {}
      }
    } else if (!apiPct && prefs) {
      const localPct = loadPercent()
      if (localPct !== 10) {
        persistPreferences({ stealthPercent: String(localPct) }).catch(() => {})
      }
    }
  }, [prefs, prefsLoading, isLoggedIn])

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const idx = MODE_ORDER.indexOf(prev)
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      if (isLoggedIn) persistPreferences({ privacyMode: next }).catch(() => {})
      return next
    })
  }, [isLoggedIn])

  // Legacy toggle: cycles off → hidden → off (skips stealth for quick toggle)
  const togglePrivacy = useCallback(() => {
    cycleMode()
  }, [cycleMode])

  const setModeExplicit = useCallback((newMode) => {
    if (MODE_ORDER.includes(newMode)) {
      setMode(newMode)
      try { localStorage.setItem(STORAGE_KEY, newMode) } catch {}
      if (isLoggedIn) persistPreferences({ privacyMode: newMode }).catch(() => {})
    }
  }, [isLoggedIn])

  const setStealthPercent = useCallback((pct) => {
    const clamped = Math.max(1, Math.min(100, pct))
    setStealthPercentState(clamped)
    try { localStorage.setItem(PERCENT_KEY, String(clamped)) } catch {}
    if (isLoggedIn) persistPreferences({ stealthPercent: String(clamped) }).catch(() => {})
  }, [isLoggedIn])

  return (
    <PrivacyModeContext.Provider value={{
      mode,
      privacyMode: mode !== 'off',
      stealthPercent,
      cycleMode,
      setMode: setModeExplicit,
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
