import { useSearchParams } from 'react-router-dom'

const STORAGE_KEY = 'uxVariant'

/**
 * Resolves the UX variant for A/B testing the design overhaul.
 *
 * Rules (from crafting-v2 design spec §3.10):
 *   - No query string → read localStorage ('v2' or fall back to 'v1')
 *   - ?ux=v2 → flip to v2 and persist to localStorage
 *   - ?ux=v1 → flip to v1 and clear localStorage (escape hatch)
 *   - ?ux=<anything else> → fall through to localStorage
 *
 * Call at the route level (e.g. inside a CraftingRouter component),
 * not inside page bodies, so the rendered variant is stable per mount.
 *
 * @returns {'v1' | 'v2'}
 */
export default function useUxVariant() {
  const [params] = useSearchParams()
  const queryVariant = params.get('ux')

  if (queryVariant === 'v1') {
    localStorage.removeItem(STORAGE_KEY)
    return 'v1'
  }

  if (queryVariant === 'v2') {
    localStorage.setItem(STORAGE_KEY, 'v2')
    return 'v2'
  }

  return localStorage.getItem(STORAGE_KEY) === 'v2' ? 'v2' : 'v1'
}
