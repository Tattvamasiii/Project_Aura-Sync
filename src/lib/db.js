import initSqlJs from 'sql.js'

const IDB_NAME = 'aura-sync-db'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'main.db'

let SQL = null
let db = null

/**
 * Low-level IndexedDB helpers (used to persist the sql.js binary blob
 * across page reloads / browser restarts — sql.js itself is in-memory only).
 */
function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadDbBytesFromIdb() {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function saveDbBytesToIdb(bytes) {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Persist the current in-memory DB state to IndexedDB. Call after every write. */
export async function persist() {
  if (!db) return
  const bytes = db.export()
  await saveDbBytesToIdb(bytes)
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_uuid TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  duration_ms INTEGER,
  size_bytes INTEGER,
  mime_type TEXT DEFAULT 'audio/webm',
  audio_blob BLOB,
  synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  created_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shelters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote_id TEXT UNIQUE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  capacity INTEGER,
  status TEXT DEFAULT 'unknown',
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0
);
`

/**
 * Initialize sql.js + open (or create) the database.
 * Must be awaited once before any query helpers are used — call this
 * from a top-level app effect (see AppContext).
 */
export async function initDb() {
  if (db) return db

  SQL = await initSqlJs({
    locateFile: (file) => `/${file}`, // serves /sql-wasm.wasm from public/
  })

  const existingBytes = await loadDbBytesFromIdb()
  db = existingBytes ? new SQL.Database(new Uint8Array(existingBytes)) : new SQL.Database()

  db.run(SCHEMA)
  await persist()

  return db
}

export function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

/** Run a write statement (INSERT/UPDATE/DELETE) with params, then persist. */
export async function run(sql, params = []) {
  const database = getDb()
  database.run(sql, params)
  await persist()
}

/** Run a SELECT and return rows as an array of plain objects. */
export function query(sql, params = []) {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}
