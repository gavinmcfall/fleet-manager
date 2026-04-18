import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

const BASE = '/api'

async function apiFetch(method, path, body) {
  const opts = { method, credentials: 'same-origin' }
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 401) {
    // Only redirect if user had an active session (session expired).
    // Unauthenticated visitors on public pages should not be redirected —
    // the 401 is expected for user-specific endpoints called by layout components.
    const hasSession = document.cookie.includes('better-auth.session_token')
    if (hasSession) {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

const fetchJSON = (path) => apiFetch('GET', path)
const postJSON = (path, body) => apiFetch('POST', path, body)
const patchJSON = (path, body) => apiFetch('PATCH', path, body)
const putJSON = (path, body) => apiFetch('PUT', path, body)

// F212/F253/F263/F297: concurrent mounts of useAPI(path) used to each fire
// their own fetch. Worst offender was /api/settings/preferences (fetched
// 4× per page load — App sidebar, useFontPreference, usePrivacyMode,
// useTimezone). Shared in-flight map dedupes concurrent callers — the
// first mount triggers the fetch, subsequent mounts while it's in flight
// subscribe to the same Promise. No long-lived cache (refetch/invalidation
// semantics stay unchanged) — only the "thundering herd on page load" case
// is fixed.
const inflight = new Map()
function sharedFetchJSON(path) {
  const hit = inflight.get(path)
  if (hit) return hit
  const p = fetchJSON(path).finally(() => {
    // Clear the entry after settle so subsequent refetches always hit the
    // network. The dedupe window is the duration of one round trip.
    if (inflight.get(path) === p) inflight.delete(path)
  })
  inflight.set(path, p)
  return p
}

export function useAPI(path, { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)

  const refetch = useCallback(() => {
    if (skip) return
    setLoading(true)
    setError(null)
    sharedFetchJSON(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path, skip])

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

export function useStatus() {
  return useAPI('/status')
}

export function useShips() {
  return useAPI('/ships')
}

export function useContracts() {
  return useAPI('/contracts')
}

export function useShip(slug) {
  return useAPI(slug ? `/ships/${slug}` : null, { skip: !slug })
}

export function useShipLoadout(slug) {
  return useAPI(slug ? `/ships/${slug}/loadout` : null, { skip: !slug })
}

export function useShipPaints(slug) {
  return useAPI(slug ? `/paints/ship/${slug}` : null, { skip: !slug })
}

export function useShipSalvage(slug) {
  return useAPI(slug ? `/ships/${slug}/salvage` : null, { skip: !slug })
}

export function useSalvageableShips() {
  return useAPI('/gamedata/salvageable-ships')
}

export function useCrafting() {
  return useAPI('/gamedata/crafting')
}

export function useMining() {
  return useAPI('/gamedata/mining')
}

export function useWeaponRacks() {
  return useAPI('/gamedata/weapon-racks')
}

export function useSuitLockers() {
  return useAPI('/gamedata/suit-lockers')
}

export function useNPCLoadouts() {
  return useAPI('/gamedata/npc-loadouts')
}

export function useFpsGear() {
  return useAPI('/gamedata/fps-gear')
}

export function useNPCFactionLoadouts(factionCode, page = 1, perPage = 50) {
  return useAPI(
    factionCode ? `/gamedata/npc-loadouts/${factionCode}?page=${page}&per_page=${perPage}` : null,
    { skip: !factionCode },
  )
}

export function usePaints() {
  return useAPI('/paints')
}

export function useFleet() {
  return useAPI('/vehicles')
}

export function useFleetEntryUpgrades(fleetEntryId) {
  return useAPI(fleetEntryId ? `/vehicles/${fleetEntryId}/upgrades` : null, { skip: !fleetEntryId })
}

export function useAnalysis(opts) {
  return useAPI('/analysis', opts)
}

export function useSyncStatus() {
  return useAPI('/sync/status')
}

// Sync management (admin)
export async function triggerRSISync() {
  return postJSON('/sync/rsi')
}

export async function triggerFullSync() {
  return postJSON('/sync/all')
}

export async function importHangarXplor(jsonData) {
  return postJSON('/import/hangarxplor', jsonData)
}

// User Preferences
export function usePreferences(opts) {
  return useAPI('/settings/preferences', opts)
}

export async function setPreferences(prefs) {
  return putJSON('/settings/preferences', prefs)
}

// Sync data management
export function useUserSyncStatus() {
  return useAPI('/settings/sync-status')
}

export async function deleteSyncData() {
  return apiFetch('DELETE', '/settings/sync-data')
}

// LLM Configuration
export function useLLMConfig() {
  return useAPI('/settings/llm-config')
}

export async function setLLMConfig(config) {
  return putJSON('/settings/llm-config', config)
}

export async function testLLMConnection(provider, apiKey) {
  return postJSON('/llm/test-connection', { provider, api_key: apiKey })
}

export async function generateAIAnalysis({ provider, model, context } = {}) {
  return postJSON('/llm/generate-analysis', { provider, model, context })
}

export function useLatestAIAnalysis() {
  return useAPI('/llm/latest-analysis')
}

export function useAIAnalysisHistory() {
  return useAPI('/llm/analysis-history')
}

// Organisation hooks
export function useUserOrgs(opts) {
  return useAPI('/orgs', opts)
}

export function useOrgProfile(slug) {
  return useAPI(slug ? `/orgs/${slug}` : null, { skip: !slug })
}

export function useOrgFleet(slug) {
  return useAPI(slug ? `/orgs/${slug}/fleet` : null, { skip: !slug })
}

export function useOrgMembers(slug) {
  return useAPI(slug ? `/orgs/${slug}/members` : null, { skip: !slug })
}

export function useOrgAnalysis(slug) {
  return useAPI(slug ? `/orgs/${slug}/analysis` : null, { skip: !slug })
}

export function useOrgStats(slug) {
  return useAPI(slug ? `/orgs/${slug}/stats` : null, { skip: !slug })
}

export function useOrgOps(slug, status) {
  const path = slug ? `/orgs/${slug}/ops${status ? `?status=${status}` : ''}` : null
  return useAPI(path, { skip: !slug })
}

export function useOrgOp(slug, opId) {
  return useAPI(slug && opId ? `/orgs/${slug}/ops/${opId}` : null, { skip: !slug || !opId })
}

export function useOpTypes(slug) {
  return useAPI(slug ? `/orgs/${slug}/ops/types` : null, { skip: !slug })
}

export function usePublicOp(code) {
  return useAPI(code ? `/ops/join/${code}` : null, { skip: !code })
}

export async function updateShipVisibility(fleetEntryId, updates) {
  return patchJSON(`/vehicles/${fleetEntryId}/visibility`, updates)
}

export async function updateOrgSettings(slug, settings) {
  return patchJSON(`/orgs/${slug}`, settings)
}

// Org verify-then-create flow
export async function generateOrgVerification(rsiSid) {
  return postJSON('/orgs/verify/generate', { rsiSid })
}

export async function checkOrgVerification() {
  return postJSON('/orgs/verify/check')
}

export function useOrgVerificationStatus() {
  return useAPI('/orgs/verify/status')
}

// Org sync + delete + primary
export async function syncOrgFromRsi(slug) {
  return postJSON(`/orgs/${slug}/sync-rsi`)
}

export async function deleteOrg(slug) {
  return apiFetch('DELETE', `/orgs/${slug}`)
}

export async function setPrimaryOrg(organizationId) {
  return putJSON('/orgs/primary', { organizationId })
}

// Loot / Item Finder
export function useLoot() {
  return useAPI('/loot')
}

export function useLootItem(uuid) {
  return useAPI(uuid ? `/loot/${uuid}` : null, { skip: !uuid })
}

export function useLootLocations() {
  return useAPI('/loot/locations')
}

export function useLootLocationDetail(type, slug) {
  const path = type && slug ? `/loot/locations/${type}/${encodeURIComponent(slug)}` : null
  return useAPI(path, { skip: !type || !slug })
}

export function useLootCollection(isAuthed) {
  return useAPI('/loot/collection', { skip: !isAuthed })
}

export async function toggleLootCollection(uuid, isCurrentlyCollected) {
  return apiFetch(isCurrentlyCollected ? 'DELETE' : 'POST', `/loot/collection/${uuid}`)
}

export async function setLootCollectionQuantity(uuid, quantity) {
  return patchJSON(`/loot/collection/${uuid}`, { quantity })
}

export async function setLootWishlistQuantity(uuid, quantity) {
  return patchJSON(`/loot/wishlist/${uuid}`, { quantity })
}

export function useLootWishlist(isAuthed) {
  return useAPI('/loot/wishlist', { skip: !isAuthed })
}

export async function toggleLootWishlist(uuid, isCurrentlyWishlisted) {
  return apiFetch(isCurrentlyWishlisted ? 'DELETE' : 'POST', `/loot/wishlist/${uuid}`)
}

export function useLocationShops(locationSlug) {
  return useAPI(locationSlug ? `/gamedata/locations/${locationSlug}/shops` : null, { skip: !locationSlug })
}

export function useLootSet(setSlug) {
  return useAPI(setSlug ? `/loot/sets/${setSlug}` : null, { skip: !setSlug })
}

export async function deleteAIAnalysis(id) {
  return apiFetch('DELETE', `/llm/analysis/${id}`)
}

// --- Localization Builder ---

export function useLocalizationConfig() {
  return useAPI('/localization/config')
}

export async function saveLocalizationConfig(config) {
  return putJSON('/localization/config', config)
}

export function useLocalizationShipOrder() {
  return useAPI('/localization/ship-order')
}

export async function saveLocalizationShipOrder(items) {
  return putJSON('/localization/ship-order', { items })
}

export function useLocalizationPreview() {
  return useAPI('/localization/preview')
}

export function useLocalizationPacks() {
  return useAPI('/localization/overlay-packs')
}

// Loadout Builder hooks
export function useLoadoutComponents(slug) {
  return useAPI(slug ? `/loadout/${slug}/components` : null, { skip: !slug })
}

export function useShipModules(slug) {
  return useAPI(slug ? `/loadout/${slug}/modules` : null, { skip: !slug })
}

export function useOwnedModules(slug) {
  return useAPI(slug ? `/loadout/${slug}/modules/owned` : null, { skip: !slug })
}

export function useCompatibleComponents(slug, portId) {
  return useAPI(slug && portId ? `/loadout/${slug}/compatible?port_id=${portId}` : null, { skip: !slug || !portId })
}

export function useFleetLoadout(fleetId) {
  return useAPI(fleetId ? `/loadout/fleet/${fleetId}` : null, { skip: !fleetId })
}

export async function saveFleetLoadout(fleetId, overrides) {
  return putJSON(`/loadout/fleet/${fleetId}`, { overrides })
}

export async function resetFleetLoadout(fleetId) {
  return apiFetch('DELETE', `/loadout/fleet/${fleetId}`)
}

export async function resetFleetLoadoutPort(fleetId, portId) {
  return apiFetch('DELETE', `/loadout/fleet/${fleetId}/port/${portId}`)
}

export function useLoadoutCart() {
  return useAPI('/loadout/cart')
}

export async function addToLoadoutCart(items) {
  return postJSON('/loadout/cart', { items })
}

export async function updateLoadoutCartItem(cartId, body) {
  return putJSON(`/loadout/cart/${cartId}`, body)
}

export async function removeLoadoutCartItem(cartId) {
  return apiFetch('DELETE', `/loadout/cart/${cartId}`)
}

export async function emptyLoadoutCart() {
  return apiFetch('DELETE', '/loadout/cart')
}

export async function optimizeLoadoutCart() {
  return postJSON('/loadout/cart/optimize', {})
}

// --- Components Reference ---

export function useComponents(type) {
  return useAPI(type ? `/components/${type}` : null, { skip: !type })
}

// --- Missions ---

export function useMissionGivers() {
  return useAPI('/gamedata/mission-givers')
}

export function useFactionDetail(slug) {
  return useAPI(slug ? `/gamedata/faction/${slug}` : null)
}

export function useMissionDetail(key) {
  return useAPI(key ? `/gamedata/mission/${key}` : null)
}

// --- User Blueprints (Crafting Tracker) ---

export function useUserBlueprints() {
  return useAPI('/blueprints')
}

export async function saveUserBlueprint({ craftingBlueprintId, nickname, qualityConfig }) {
  return postJSON('/blueprints', { craftingBlueprintId, nickname, qualityConfig })
}

export async function updateUserBlueprint(id, { nickname, craftedQuantity, qualityConfig }) {
  return patchJSON(`/blueprints/${id}`, { nickname, craftedQuantity, qualityConfig })
}

export async function deleteUserBlueprint(id) {
  return apiFetch('DELETE', `/blueprints/${id}`)
}
