import { run, query } from './db'
import { getLocalUserId } from './user'

export async function saveLocation({ lat, lng, accuracy = null }) {
  const userId = getLocalUserId()
  const createdAt = new Date().toISOString()

  await run(
    `INSERT INTO locations (user_id, lat, lng, accuracy, created_at, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [userId, lat, lng, accuracy, createdAt]
  )

  await run(
    `INSERT INTO sync_queue (entity_type, entity_id, action, created_at)
     SELECT 'location', id, 'create', ? FROM locations
     WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    [createdAt, userId]
  )
}

/** Return this device's location pings, newest first. */
export function listMyLocations(limit = 20) {
  const userId = getLocalUserId()
  return query(
    `SELECT id, lat, lng, accuracy, created_at, synced
     FROM locations WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  )
}

/** Return the single most recent location ping for this device, or null. */
export function getLatestLocation() {
  const rows = listMyLocations(1)
  return rows[0] || null
}

export async function deleteLocation(id) {
  await run(`DELETE FROM sync_queue WHERE entity_type = 'location' AND entity_id = ?`, [id])
  await run(`DELETE FROM locations WHERE id = ?`, [id])
}
