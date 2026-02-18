/**
 * Shared utility functions used across sync modules and routes.
 */

/** Promise-based delay for rate limiting */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
