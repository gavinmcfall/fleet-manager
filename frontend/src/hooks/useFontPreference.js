import { useState, useEffect } from 'react'

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
  const [fontPreference, setFontPreferenceState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'default'
    } catch {
      return 'default'
    }
  })

  useEffect(() => {
    applyFontPreference(fontPreference)
  }, [fontPreference])

  const setFontPreference = (key) => {
    setFontPreferenceState(key)
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // localStorage unavailable
    }
  }

  return { fontPreference, setFontPreference }
}
