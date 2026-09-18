const USER_ID_KEY = 'aura-sync-user-id'

/** Get (or create) a stable anonymous ID for this device/browser. */
export function getLocalUserId() {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}
