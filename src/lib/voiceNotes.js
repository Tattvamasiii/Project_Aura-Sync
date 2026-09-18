import { run, query } from './db'
import { encryptBytes, decryptBytes } from './crypto'

/** Convert a Blob to a Uint8Array for SQLite BLOB storage. */
async function blobToBytes(blob) {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

/** Convert stored (encrypted) bytes back into a playable Blob + object URL. */
export async function bytesToAudioUrl(encryptedBytes, mimeType = 'audio/webm') {
  const plainBytes = await decryptBytes(encryptedBytes)
  const blob = new Blob([plainBytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

export async function deleteVoiceNote(id) {
  await run(`DELETE FROM sync_queue WHERE entity_type = 'voice_note' AND entity_id = ?`, [id])
  await run(`DELETE FROM voice_notes WHERE id = ?`, [id])
}

export async function saveVoiceNote({ blob, durationMs = null }) {
  const rawBytes = await blobToBytes(blob)
  const encryptedBytes = await encryptBytes(rawBytes)

  const localUuid = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await run(
    `INSERT INTO voice_notes (local_uuid, created_at, duration_ms, size_bytes, mime_type, audio_blob, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    // size_bytes stores the original (unencrypted) size for display purposes
    [localUuid, createdAt, durationMs, rawBytes.byteLength, blob.type || 'audio/webm', encryptedBytes]
  )

  await run(
    `INSERT INTO sync_queue (entity_type, entity_id, action, created_at)
     SELECT 'voice_note', id, 'create', ? FROM voice_notes WHERE local_uuid = ?`,
    [createdAt, localUuid]
  )

  return localUuid
}

/** Return all voice notes, newest first, with a ready-to-play (decrypted) audio URL attached. */
export async function listVoiceNotes() {
  const rows = query(
    `SELECT id, local_uuid, created_at, duration_ms, size_bytes, mime_type, audio_blob, synced
     FROM voice_notes ORDER BY created_at DESC`
  )

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      localUuid: row.local_uuid,
      createdAt: row.created_at,
      sizeBytes: row.size_bytes,
      synced: !!row.synced,
      url: await bytesToAudioUrl(row.audio_blob, row.mime_type),
    }))
  )
}
