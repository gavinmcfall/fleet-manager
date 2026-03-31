import { useState, useEffect, useRef } from 'react'
import { useSession } from '../lib/auth-client'
import { usePreferences, setPreferences as persistPreferences } from './useAPI'

const FONT_PRESETS = {
  default: {
    body: '"Inter", "Segoe UI"',
    display: '"Electrolize", "Rajdhani"',
  },
  lexend: {
    body: '"Lexend"',
    display: '"Lexend"',
  },
  atkinson: {
    body: '"Atkinson Hyperlegible"',
    display: '"Atkinson Hyperlegible"',
  },
  opendyslexic: {
    body: '"OpenDyslexic"',
    display: '"OpenDyslexic"',
  },
}

const STORAGE_KEY = 'font-preference'

function applyFontPreference(key) {
  const preset = FONT_PRESETS[key] || FONT_PRESETS.default
  document.documentElement.style.setProperty('--font-body', preset.body)
  document.documentElement.style.setProperty('--font-display', preset.display)
}

export default function useFontPreference() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const { data: prefs, loading: prefsLoading } = usePreferences({ skip: !isLoggedIn })

  const [fontPreference, setFontPreferenceState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'default' } catch { return 'default' }
  })

  const hasSynced = useRef(false)

  // Sync from API on load — API wins over localStorage for logged-in users.
  // On first load after feature rollout, migrates existing localStorage values to DB.
  useEffect(() => {
    if (prefsLoading || !isLoggedIn || prefs === null || hasSynced.current) return
    hasSynced.current = true

    const apiFont = prefs?.fontPreference
    if (apiFont && FONT_PRESETS[apiFont]) {
      setFontPreferenceState(apiFont)
      try { localStorage.setItem(STORAGE_KEY, apiFont) } catch {}
    } else if (!apiFont && prefs) {
      // No API value yet — migrate localStorage to DB if non-default
      const local = (() => { try { return localStorage.getItem(STORAGE_KEY) || 'default' } catch { return 'default' } })()
      if (local !== 'default') {
        persistPreferences({ fontPreference: local }).catch(() => {})
      }
    }
  }, [prefs, prefsLoading, isLoggedIn])

  useEffect(() => {
    applyFontPreference(fontPreference)
  }, [fontPreference])

  const setFontPreference = (key) => {
    setFontPreferenceState(key)
    try { localStorage.setItem(STORAGE_KEY, key) } catch {}
    if (isLoggedIn) persistPreferences({ fontPreference: key }).catch(() => {})
  }

  return { fontPreference, setFontPreference }
}
