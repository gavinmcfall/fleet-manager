import { useState, useEffect, useCallback, useRef } from 'react'

const ALLOWED_SOURCE = 'sc-bridge-sync'
const DETECT_TIMEOUT = 2000 // ms to wait for pong

/** Default sync categories — all enabled */
export const SYNC_CATEGORIES = {
  fleet: { key: 'fleet', label: 'Fleet & Pledges', description: 'Ships, vehicles, insurance, skins, and pledge details', default: true },
  buyback: { key: 'buyback', label: 'Buy-Back Pledges', description: 'Melted pledges available for reclaim', default: true },
  upgrades: { key: 'upgrades', label: 'Upgrade History', description: 'CCU chains and applied upgrades per pledge', default: true },
  account: { key: 'account', label: 'Account Info', description: 'Concierge level, subscriber status, org, balances', default: true },
  shipNames: { key: 'shipNames', label: 'Custom Ship Names', description: 'Your named ships (e.g. Jean-Luc, James Holden)', default: true },
}

export default function useHangarSync() {
  const [status, setStatus] = useState('idle') // idle | detecting | ready | no-extension | collecting | uploading | complete | error
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { imported, buyback_count, upgrade_count }
  const [extensionVersion, setExtensionVersion] = useState(null)
  const listenerRef = useRef(null)
  const timeoutRef = useRef(null)
  const statusRef = useRef(status)
  const categoriesRef = useRef(null)

  // Keep statusRef in sync so timeout callbacks see current value
  useEffect(() => {
    statusRef.current = status
  }, [status])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Detect extension
  const detect = useCallback(() => {
    setStatus('detecting')
    setError(null)

    // Remove any previous listener
    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    const handler = (event) => {
      if (event.data?.source !== ALLOWED_SOURCE) return
      if (event.data?.type === 'SCBRIDGE_PONG') {
        setStatus('ready')
        setExtensionVersion(event.data.version || null)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }

    listenerRef.current = handler
    window.addEventListener('message', handler)

    // Send ping
    window.postMessage({ type: 'SCBRIDGE_PING', source: 'scbridge-app' }, '*')

    // Timeout — no extension
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'detecting') {
        setStatus('no-extension')
      }
    }, DETECT_TIMEOUT)
  }, [])

  // Detect on mount
  useEffect(() => { detect() }, [detect])

  // Start sync — accepts optional categories map { fleet: true, buyback: false, ... }
  const startSync = useCallback((categories) => {
    if (statusRef.current !== 'ready' && statusRef.current !== 'complete' && statusRef.current !== 'error') return

    categoriesRef.current = categories || null
    setStatus('collecting')
    setError(null)
    setResult(null)

    // Remove old listener, set up new one for sync response
    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    const handler = async (event) => {
      if (event.data?.source !== ALLOWED_SOURCE) return

      if (event.data?.type === 'SCBRIDGE_SYNC_RESPONSE') {
        window.removeEventListener('message', handler)
        listenerRef.current = null
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (event.data.error) {
          setError(event.data.error)
          setStatus('error')
          return
        }

        // Filter payload based on selected categories
        const payload = event.data.payload
        const cats = categoriesRef.current
        if (cats && payload) {
          if (cats.fleet === false) payload.pledges = []
          if (cats.buyback === false) payload.buyback_pledges = []
          if (cats.upgrades === false) payload.upgrades = []
          if (cats.account === false) payload.account = null
          if (cats.shipNames === false) payload.named_ships = []
        }

        // Upload to our API
        setStatus('uploading')
        try {
          const res = await fetch('/api/import/hangar-sync', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          if (res.status === 401) {
            window.location.href = '/login'
            return
          }

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }))
            throw new Error(err.error || res.statusText)
          }

          const data = await res.json()
          setResult(data)
          setStatus('complete')
        } catch (err) {
          setError(err.message)
          setStatus('error')
        }
      }
    }

    listenerRef.current = handler
    window.addEventListener('message', handler)

    // Send sync request to bridge content script
    window.postMessage({ type: 'SCBRIDGE_SYNC_REQUEST', source: 'scbridge-app' }, '*')

    // Timeout for collection (3 minutes max)
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'collecting') {
        setError('Sync timed out — the extension took too long to respond')
        setStatus('error')
        if (listenerRef.current) {
          window.removeEventListener('message', listenerRef.current)
          listenerRef.current = null
        }
      }
    }, 180000)
  }, [])

  const retry = useCallback(() => {
    if (statusRef.current === 'no-extension') {
      detect()
    } else {
      startSync()
    }
  }, [detect, startSync])

  return { status, error, result, extensionVersion, startSync, retry, detect }
}
