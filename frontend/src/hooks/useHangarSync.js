import { useState, useEffect, useCallback, useRef } from 'react'

const ALLOWED_SOURCE = 'sc-bridge-sync'
const DETECT_TIMEOUT = 3000 // ms to wait for pong

const log = (...args) => console.log('[HangarSync]', ...args)

/** Default sync categories — all enabled */
export const SYNC_CATEGORIES = {
  fleet: { key: 'fleet', label: 'Fleet & Pledges', description: 'Ships, vehicles, insurance, skins, and pledge details', default: true },
  buyback: { key: 'buyback', label: 'Buy-Back Pledges', description: 'Melted pledges available for reclaim', default: true },
  upgrades: { key: 'upgrades', label: 'Upgrade History', description: 'CCU chains and applied upgrades per pledge', default: true },
  account: { key: 'account', label: 'Account Info', description: 'Concierge level, subscriber status, org, balances', default: true },
  shipNames: { key: 'shipNames', label: 'Custom Ship Names', description: 'Your named ships (e.g. Jean-Luc, James Holden)', default: true },
}

export default function useHangarSync() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [extensionVersion, setExtensionVersion] = useState(null)
  const listenerRef = useRef(null)
  const timeoutRef = useRef(null)
  const statusRef = useRef(status)
  const categoriesRef = useRef(null)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Global message logger — shows ALL postMessage traffic during detection
  useEffect(() => {
    const debugHandler = (event) => {
      // Log everything that comes through postMessage
      if (event.data && typeof event.data === 'object' && event.data.type) {
        log('postMessage received:', event.data.type, 'source:', event.data.source, 'origin:', event.origin, 'full:', event.data)
      }
    }
    window.addEventListener('message', debugHandler)
    log('Debug message listener installed')
    return () => window.removeEventListener('message', debugHandler)
  }, [])

  const detect = useCallback(() => {
    log('detect() called — sending SCBRIDGE_PING')
    setStatus('detecting')
    setError(null)

    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    const handler = (event) => {
      if (event.data?.source !== ALLOWED_SOURCE) return
      log('Got message from extension:', event.data.type, event.data)
      if (event.data?.type === 'SCBRIDGE_PONG') {
        log('PONG received! Version:', event.data.version)
        setStatus('ready')
        setExtensionVersion(event.data.version || null)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }

    listenerRef.current = handler
    window.addEventListener('message', handler)

    window.postMessage({ type: 'SCBRIDGE_PING', source: 'scbridge-app' }, '*')
    log('PING sent via postMessage')

    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'detecting') {
        log('Detection timeout — no PONG received after', DETECT_TIMEOUT, 'ms')
        setStatus('no-extension')
      }
    }, DETECT_TIMEOUT)
  }, [])

  useEffect(() => { detect() }, [detect])

  const startSync = useCallback((categories) => {
    if (statusRef.current !== 'ready' && statusRef.current !== 'complete' && statusRef.current !== 'error') return

    log('startSync() called with categories:', categories)
    categoriesRef.current = categories || null
    setStatus('collecting')
    setError(null)
    setResult(null)

    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    const handler = async (event) => {
      if (event.data?.source !== ALLOWED_SOURCE) return

      if (event.data?.type === 'SCBRIDGE_SYNC_RESPONSE') {
        log('SYNC_RESPONSE received:', event.data.success, event.data.error || '')
        window.removeEventListener('message', handler)
        listenerRef.current = null
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (event.data.error) {
          setError(event.data.error)
          setStatus('error')
          return
        }

        const payload = event.data.payload
        const cats = categoriesRef.current
        if (cats && payload) {
          if (cats.fleet === false) payload.pledges = []
          if (cats.buyback === false) payload.buyback_pledges = []
          if (cats.upgrades === false) payload.upgrades = []
          if (cats.account === false) payload.account = null
          if (cats.shipNames === false) payload.named_ships = []
        }

        setStatus('uploading')
        log('Uploading payload to API...', payload ? `${payload.pledges?.length} pledges` : 'null')
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
          log('API response:', data)
          setResult(data)
          setStatus('complete')
        } catch (err) {
          log('API error:', err.message)
          setError(err.message)
          setStatus('error')
        }
      }
    }

    listenerRef.current = handler
    window.addEventListener('message', handler)

    window.postMessage({ type: 'SCBRIDGE_SYNC_REQUEST', source: 'scbridge-app' }, '*')
    log('SYNC_REQUEST sent via postMessage')

    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'collecting') {
        log('Sync timeout — no response after 3 minutes')
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
