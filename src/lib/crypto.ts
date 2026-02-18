/**
 * AES-256-GCM encryption for sensitive API keys.
 * Uses Web Crypto API (native in Cloudflare Workers).
 * Port of internal/crypto/encryption.go
 */

/**
 * Import a base64-encoded 32-byte key as a CryptoKey for AES-GCM.
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error("Encryption key must be 32 bytes for AES-256");
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded ciphertext (nonce prepended).
 * Format matches Go implementation: base64(nonce + ciphertext + tag)
 */
export async function encrypt(
  plaintext: string,
  keyBase64: string,
): Promise<string> {
  const key = await importKey(keyBase64);

  // 12-byte random nonce (standard for AES-GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    encoded,
  );

  // Prepend nonce to ciphertext (matches Go's gcm.Seal(nonce, nonce, plaintext, nil))
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce, 0);
  combined.set(new Uint8Array(ciphertext), nonce.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt base64-encoded ciphertext using AES-256-GCM.
 * Expects nonce prepended to ciphertext (as produced by encrypt()).
 */
export async function decrypt(
  ciphertextBase64: string,
  keyBase64: string,
): Promise<string> {
  const key = await importKey(keyBase64);

  const combined = Uint8Array.from(atob(ciphertextBase64), (c) =>
    c.charCodeAt(0),
  );

  if (combined.length < 12) {
    throw new Error("Ciphertext too short");
  }

  const nonce = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Mask an API key for display (e.g., "sk-...abc123").
 */
export function maskAPIKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 10) return "***";
  return apiKey.slice(0, 3) + "..." + apiKey.slice(-4);
}
