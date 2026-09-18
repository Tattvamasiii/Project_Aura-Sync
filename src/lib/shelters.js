import { run, query, getDb } from './db'

/** Haversine distance in kilometers between two lat/lng points. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Pre-downloaded shelter data, seeded once so the app has something to show
 * even on a brand new install with zero connectivity. In production this
 * list would be refreshed from AWS whenever the app is online (see sync
 * engine / Module 4), then cached here for offline lookup.
 */
const SEED_SHELTERS = [
  { remote_id: 'seed-1', name: 'Community Hall - Sector 5', lat: 20.2961, lng: 85.8245, capacity: 200, status: 'open' },
  { remote_id: 'seed-2', name: 'Government High School Shelter', lat: 20.3100, lng: 85.8400, capacity: 350, status: 'open' },
  { remote_id: 'seed-3', name: 'District Sports Complex', lat: 20.2700, lng: 85.8000, capacity: 500, status: 'open' },
  { remote_id: 'seed-4', name: 'Riverside Relief Camp', lat: 20.3300, lng: 85.7900, capacity: 150, status: 'full' },
  { remote_id: 'seed-5', name: 'St. Xavier Church Hall', lat: 20.2500, lng: 85.8500, capacity: 100, status: 'open' },
]

/** Insert seed shelters only if the table is currently empty. */
export async function seedSheltersIfEmpty() {
  const rows = query(`SELECT COUNT(*) as count FROM shelters`)
  if (rows[0]?.count > 0) return

  const now = new Date().toISOString()
  for (const s of SEED_SHELTERS) {
    await run(
      `INSERT INTO shelters (remote_id, name, lat, lng, capacity, status, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.remote_id, s.name, s.lat, s.lng, s.capacity, s.status, now]
    )
  }
}

/** Return all shelters. If a user position is given, sorted nearest-first with distanceKm attached. */
export function listShelters(userPos = null) {
  const rows = query(
    `SELECT id, remote_id, name, lat, lng, capacity, status, last_updated FROM shelters`
  )

  if (!userPos) return rows

  return rows
    .map((s) => ({ ...s, distance: distanceKm(userPos.lat, userPos.lng, s.lat, s.lng) }))
    .sort((a, b) => a.distance - b.distance)
}
