/**
 * Client-side encryption for sensitive data at rest (voice notes, location
 * history) stored in SQLite/IndexedDB. Uses WebCrypto AES-GCM with a key
 * derived from a device-local secret, so data is unreadable if the raw
 * IndexedDB/SQLite file is copied off the device (lost/stolen/seized phone).
 *
 * This is NOT a substitute for a user password — the key itself lives in
 * localStorage. It protects against casual/offline extraction of the DB
 * file, not against someone with full access to the unlocked browser.
 */

const KEY_STORAGE_KEY = 'aura-sync-device-key'

/** Get (or create) a persistent AES-GCM CryptoKey for this device. */
async function getDeviceKey() {
  const stored = localStorage.getItem(KEY_STORAGE_KEY)

  if (stored) {
    const raw = base64ToBytes(stored)
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', key)
  localStorage.setItem(KEY_STORAGE_KEY, bytesToBase64(new Uint8Array(raw)))
  return key
}

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Encrypt raw bytes. Returns a single Uint8Array laid out as:
 * [12-byte IV][ciphertext + auth tag] — ready to store directly as a BLOB.
 */
export async function encryptBytes(plainBytes) {
  const key = await getDeviceKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes
  )

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return combined
}

/** Reverse of encryptBytes — expects [12-byte IV][ciphertext]. */
export async function decryptBytes(combinedBytes) {
  const key = await getDeviceKey()
  const iv = combinedBytes.slice(0, 12)
  const ciphertext = combinedBytes.slice(12)

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new Uint8Array(plainBuf)
}

/** Convenience: encrypt a UTF-8 string (e.g. JSON) and return bytes. */
export async function encryptText(text) {
  return encryptBytes(new TextEncoder().encode(text))
}

/** Convenience: decrypt bytes back into a UTF-8 string. */
export async function decryptText(bytes) {
  const plainBytes = await decryptBytes(bytes)
  return new TextDecoder().decode(plainBytes)
}
