import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from '../lib/auth-client'
import { usePreferences, setPreferences } from './useAPI'
import { formatVersionLabel } from '../lib/gameVersion'

const GameVersionContext = createContext({
  versions: [],
  defaultVersion: null,
  activeCode: null,
  activeVersion: null,
  isPreview: false,
  setActiveVersion: () => {},
  loading: false,
})

const STORAGE_KEY = 'sc-bridge-active-version'

export function GameVersionProvider({ children }) {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const { data: prefs, loading: prefsLoading } = usePreferences({ skip: !isLoggedIn })

  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [userSelectedCode, setUserSelectedCode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
  })

  // Track whether we've already synced from API to avoid re-triggering
  const hasSyncedFromAPI = useRef(false)

  // Sync from API preference on initial load (logged-in users only)
  useEffect(() => {
    if (prefsLoading || !isLoggedIn || hasSyncedFromAPI.current) return
    hasSyncedFromAPI.current = true

    const apiVersion = prefs?.preferredGameVersion || null
    const localVersion = (() => {
      try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
    })()

    if (apiVersion !== localVersion) {
      // API disagrees with localStorage — sync localStorage and reload
      try {
        if (apiVersion) localStorage.setItem(STORAGE_KEY, apiVersion)
        else localStorage.removeItem(STORAGE_KEY)
      } catch {}
      window.location.reload()
    }
  }, [prefs, prefsLoading, isLoggedIn])

  useEffect(() => {
    fetch('/api/patches')
      .then(r => r.json())
      .then(data => {
        setVersions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const defaultVersion = useMemo(
    () => versions.find(v => v.is_default) || versions[0] || null,
    [versions]
  )

  // Validate that user-selected version still exists in the list
  const validUserSelection = useMemo(() => {
    if (!userSelectedCode) return null
    return versions.find(v => v.code === userSelectedCode) || null
  }, [versions, userSelectedCode])

  const activeVersion = validUserSelection || defaultVersion
  const activeCode = activeVersion?.code || null
  const isPreview = !!validUserSelection && validUserSelection.code !== defaultVersion?.code

  const setActiveVersion = useCallback((code) => {
    const newCode = code && code !== defaultVersion?.code ? code : null

    // Update localStorage synchronously (for withVersionParam in useAPI.js)
    try {
      if (newCode) localStorage.setItem(STORAGE_KEY, newCode)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}

    // Persist to API for logged-in users (fire and forget)
    if (isLoggedIn) {
      setPreferences({ preferredGameVersion: newCode }).catch(() => {})
    }

    // Reload to re-fetch all data with the new version param
    window.location.reload()
  }, [defaultVersion, isLoggedIn])

  const value = useMemo(() => ({
    versions,
    defaultVersion,
    activeCode,
    activeVersion,
    isPreview,
    setActiveVersion,
    loading,
  }), [versions, defaultVersion, activeCode, activeVersion, isPreview, setActiveVersion, loading])

  return (
    <GameVersionContext.Provider value={value}>
      {children}
    </GameVersionContext.Provider>
  )
}

export default function useGameVersion() {
  return useContext(GameVersionContext)
}
