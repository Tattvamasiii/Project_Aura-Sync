# AuraSync

**An offline-first emergency coordination app that keeps communities connected when the internet goes down.**

Built for [Hackathon Name] — a mobile-first web app (installable as a PWA) that lets people communicate, share their location, and find safe shelters even with zero connectivity, then syncs everything to the cloud automatically once a connection returns.

---

## Core Features (Planned)

| Feature | Status |
|---|---|
| 🎙️ Offline Walkie-Talkie | ✅ Built |
| 📍 Share Location | ✅ Built |
| 🏠 Find Safe Shelters | ⏳ Not started |
| ☁️ Sync with AWS | ⏳ Not started (UI stub only) |

---

## Tech Stack

- **React** (JavaScript, no TypeScript) + **Vite**
- **Tailwind CSS v3** for styling
- **lucide-react** for icons
- **react-router-dom** for page navigation
- **sql.js** (SQLite compiled to WebAssembly) for local, offline-first data storage
- **IndexedDB** as the persistence layer underneath sql.js (since sql.js itself is in-memory only)
- **AWS** (planned): AppSync + DynamoDB + S3 + Cognito + Lambda for cloud sync — not yet implemented

This is a **mobile-first PWA-style browser app**, not a native app — designed for one-handed use, small screens, poor lighting, and unreliable connectivity.

---

## Project Structure

```
aura-sync/
├── public/
│   └── sql-wasm-browser.wasm   # sql.js WASM binary (must match the browser build exactly)
├── src/
│   ├── components/
│   │   └── BottomNav.jsx       # thumb-reachable bottom tab bar
│   ├── context/
│   │   └── AppContext.jsx      # initializes SQLite once at app startup, exposes dbReady/isOnline
│   ├── lib/
│   │   ├── db.js               # sql.js init, schema, IndexedDB persistence, run()/query() helpers
│   │   ├── voiceNotes.js       # data access for voice_notes table
│   │   ├── locations.js        # data access for locations table
│   │   ├── geolocation.js      # navigator.geolocation wrappers (getCurrentPosition / watchPosition)
│   │   └── user.js             # generates/persists a stable anonymous local user ID
│   ├── pages/
│   │   ├── TalkPage.jsx        # Module 1: Walkie-Talkie (built)
│   │   ├── LocationPage.jsx    # Module 2: Location Share (built)
│   │   ├── SheltersPage.jsx    # Module 3: Safe Shelters (stub only)
│   │   └── SyncPage.jsx        # Module 4: Sync status (stub — shows online/offline only)
│   ├── App.jsx                 # route definitions + DB-ready gate
│   ├── main.jsx                # app entry, wraps App in Router + AppProvider
│   └── index.css               # Tailwind directives + base styles
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

---

## Local Database Schema

All local data lives in a single SQLite database (via `sql.js`), persisted as a binary blob in IndexedDB after every write.

```sql
CREATE TABLE voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_uuid TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  duration_ms INTEGER,
  size_bytes INTEGER,
  mime_type TEXT DEFAULT 'audio/webm',
  audio_blob BLOB,
  synced INTEGER DEFAULT 0
);

CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  created_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

CREATE TABLE shelters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote_id TEXT UNIQUE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  capacity INTEGER,
  status TEXT DEFAULT 'unknown',
  last_updated TEXT
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0
);
```

Every write to `voice_notes` or `locations` also inserts a row into `sync_queue`, so the (not-yet-built) sync engine has a durable, ordered list of what needs to be pushed to AWS once online.

---

## Modules Built So Far

### ✅ Module 1 — Offline Walkie-Talkie (`TalkPage.jsx`)
- Push-to-talk button using `navigator.mediaDevices.getUserMedia` + `MediaRecorder`
- Records real microphone audio, saves as a `Blob` directly into SQLite (`audio_blob` column)
- Instant local playback via generated object URLs
- Recordings **persist across page reloads** (verified working)
- Each new recording is queued in `sync_queue` for future AWS upload

### ✅ Module 2 — Share Location (`LocationPage.jsx`)
- **Capture Location**: one-tap GPS capture via `getCurrentPosition`, shows lat/lng + accuracy
- **Start/Stop Live Tracking**: continuous tracking via `watchPosition`, writes a new ping to SQLite on every update
- **Share**: uses the native Share Sheet (`navigator.share`) when available, falls back to copying a Google Maps link to the clipboard
- Recent location history list, persisted and reloadable after refresh (verified working)
- No live map rendering yet (intentionally skipped — real map tiles need internet or pre-cached tiles, treated as a later polish step)

### ⏳ Module 3 — Safe Shelters (`SheltersPage.jsx`)
Stub page only. Planned: seed local `shelters` table with pre-downloaded shelter data, list + filter by distance, pull live updates from AWS when online.

### ⏳ Module 4 — Sync with AWS (`SyncPage.jsx`)
Stub page only. Currently just shows live online/offline status via `navigator.onLine`. Planned: drain `sync_queue` table to AWS (AppSync/DynamoDB/S3) in order, on reconnect.

---

## Setup Notes / Gotchas Solved

1. **Tailwind version** — project explicitly uses **Tailwind v3** (`npx tailwindcss init -p` style config), not v4, since v4 changed the CLI/config flow.
2. **sql.js WASM filename mismatch** — Vite resolves `sql.js` to its browser build (`sql-wasm-browser.js`), which specifically requests a file named `sql-wasm-browser.wasm`. The public folder must contain **exactly that filename** (not `sql-wasm.wasm`, which is the Node build's file) or `initSqlJs()` fails silently with a fetch 404.
3. **Mobile-first design constraints** — bottom tab nav (not top nav/hamburger) for thumb reachability, 44px+ tap targets, 16px+ base font (prevents iOS auto-zoom on input focus), `env(safe-area-inset-*)` support for notched phones.

---

## Getting Started

```bash
npm install
npm run dev
```

Open on your phone or desktop browser at the local dev URL. Grant microphone/location permissions when prompted to test Modules 1 and 2.

```bash
npm run build      # production build
npm run preview    # preview the production build locally
```

---

## Docs

Additional planning docs (in progress):
- `docs/FRONTEND.md` — React/frontend architecture (done)
- `docs/SECURITY.md` — not started
- `docs/APP_LOGIC_DB.md` — not started
- `docs/AWS_DEPLOYMENT.md` — not started
