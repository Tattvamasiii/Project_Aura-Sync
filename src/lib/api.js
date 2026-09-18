// src/lib/api.js
import { query } from './db.js'
import { decryptBytes } from './crypto.js'

const API_URL = import.meta.env.VITE_SYNC_API_URL

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// sync_queue.entity_type is written as the singular form ('location',
// 'voice_note') by locations.js / voiceNotes.js, but the actual SQLite
// tables are plural ('locations', 'voice_notes'). Map between them here
// instead of changing the insert statements, since that would require a
// migration for any sync_queue rows already sitting in a user's IndexedDB.
export const ENTITY_TABLE = {
  location: 'locations',
  voice_note: 'voice_notes',
}

/**
 * Looks up the actual row for a sync_queue entry and builds the API payload.
 */
function fetchEntityRow(entityType, entityId) {
  const table = ENTITY_TABLE[entityType]
  if (!table) {
    throw new Error(`Unknown entity_type: ${entityType}`)
  }
  const rows = query(`SELECT * FROM ${table} WHERE id = ?`, [entityId])
  if (rows.length === 0) {
    throw new Error(`No row found in ${table} with id ${entityId}`)
  }
  return rows[0]
}

/**
 * Syncs one sync_queue entry to the API Gateway endpoint.
 * @param {Object} queueRow - a row from sync_queue
 *   { id, entity_type, entity_id, action, created_at, attempts }
 */
export async function syncItem(queueRow) {
  if (!API_URL) {
    throw new Error('VITE_SYNC_API_URL is not set — check your .env file')
  }

  const row = fetchEntityRow(queueRow.entity_type, queueRow.entity_id)
  let payload

  if (queueRow.entity_type === 'voice_note') {
    // audio_blob is stored encrypted at rest (see crypto.js/saveVoiceNote) —
    // decrypt it first, or we'd upload unplayable ciphertext to S3.
    const plainBytes = await decryptBytes(row.audio_blob)
    // sql.js/decryptBytes return a Uint8Array, not a browser Blob — wrap it
    // before using FileReader
    const blob = new Blob([plainBytes], { type: row.mime_type || 'audio/webm' })
    const audioBase64 = await blobToBase64(blob)
    payload = {
      type: 'voice_note',
      data: {
        localUuid: row.local_uuid,
        audioBase64,
        durationMs: row.duration_ms,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      },
    }
  } else if (queueRow.entity_type === 'location') {
    payload = {
      type: 'location',
      data: {
        userId: row.user_id,
        lat: row.lat,
        lng: row.lng,
        accuracy: row.accuracy,
        createdAt: row.created_at,
      },
    }
  } else {
    throw new Error(`Unknown entity_type: ${queueRow.entity_type}`)
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sync failed (${response.status}): ${errorText}`)
  }

  return response.json()
}