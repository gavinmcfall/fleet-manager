import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
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
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [userSelectedCode, setUserSelectedCode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
  })

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
    try {
      if (code && code !== defaultVersion?.code) {
        localStorage.setItem(STORAGE_KEY, code)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch { /* localStorage unavailable */ }
    // Reload to re-fetch all data with the new version param
    window.location.reload()
  }, [defaultVersion])

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
