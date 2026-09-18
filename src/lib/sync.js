// src/lib/sync.js
import { getDb, query, run } from './db.js'
import { syncItem, ENTITY_TABLE } from './api.js'

const MAX_ATTEMPTS = 5

/**
 * Processes every row currently in sync_queue:
 * - success -> deletes the queue row, marks the source row synced = 1
 * - failure -> increments attempts; if attempts >= MAX_ATTEMPTS, marks it
 *   'failed' so it's skipped on future runs instead of retried forever
 *
 * Safe to call repeatedly (e.g. on network reconnect, on an interval,
 * or on app load) — already-synced items simply won't be in the queue.
 */
export async function runSync() {
  const queueRows = query(
    `SELECT * FROM sync_queue WHERE attempts < ? ORDER BY created_at ASC`,
    [MAX_ATTEMPTS]
  )

  const results = { succeeded: 0, failed: 0, skipped: 0 }

  for (const queueRow of queueRows) {
    try {
      const response = await syncItem(queueRow)
      logger_ok(queueRow, response)

      // Mark the source row as synced
      const table = ENTITY_TABLE[queueRow.entity_type] // 'voice_notes' | 'locations'
      await run(`UPDATE ${table} SET synced = 1 WHERE id = ?`, [queueRow.entity_id])

      // Remove it from the queue — it's done
      await run(`DELETE FROM sync_queue WHERE id = ?`, [queueRow.id])

      results.succeeded++
    } catch (err) {
      console.error(`Sync failed for ${queueRow.entity_type}#${queueRow.entity_id}:`, err.message)

      const newAttempts = queueRow.attempts + 1
      await run(`UPDATE sync_queue SET attempts = ? WHERE id = ?`, [newAttempts, queueRow.id])

      if (newAttempts >= MAX_ATTEMPTS) {
        console.warn(`Giving up on ${queueRow.entity_type}#${queueRow.entity_id} after ${MAX_ATTEMPTS} attempts`)
        results.failed++
      } else {
        results.skipped++
      }
    }
  }

  return results
}

function logger_ok(queueRow, response) {
  console.log(
    `Synced ${queueRow.entity_type}#${queueRow.entity_id} -> eventId ${response.eventId} (urgency: ${response.triage?.urgency})`
  )
}