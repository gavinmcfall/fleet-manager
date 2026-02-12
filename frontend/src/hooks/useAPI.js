import { useState, useEffect, useCallback } from 'react'

const BASE = '/api'

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function putJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function useAPI(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchJSON(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path])

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

export function useStatus() {
  return useAPI('/status')
}

export function useShips() {
  return useAPI('/ships')
}

export function useVehicles() {
  return useAPI('/vehicles/with-insurance')
}

export function useAnalysis() {
  return useAPI('/analysis')
}

export function useSyncStatus() {
  return useAPI('/sync/status')
}

export async function triggerShipSync() {
  return postJSON('/sync/ships')
}

export async function triggerHangarSync() {
  return postJSON('/sync/hangar')
}

export async function importHangarXplor(jsonData) {
  return postJSON('/import/hangarxplor', jsonData)
}

export async function clearHangarImports() {
  const res = await fetch(`${BASE}/import/hangarxplor`, { method: 'DELETE' })
  return res.json()
}

export async function setFleetYardsUser(username) {
  return putJSON('/settings/fleetyards-user', { username })
}

export async function triggerEnrich() {
  return postJSON('/sync/enrich')
}
