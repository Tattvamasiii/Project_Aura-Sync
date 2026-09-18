<div align="center">

<img src="public/pwa-192x192.png" alt="AuraSync" width="110" />

# AuraSync

### Emergency coordination that works when the internet doesn't.

**Talk. Share your location. Find shelter. With zero connectivity.**
Everything syncs to the cloud automatically the moment a signal returns.

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![SQLite WASM](https://img.shields.io/badge/SQLite-WASM-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Lambda%20%2B%20API%20Gateway-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

</div>

---

## The Problem

In a flood, cyclone, earthquake or blackout, the first thing to fail is the network. Towers go down, power goes out, bandwidth collapses under load. And that is the exact moment people most need to reach each other, tell rescuers where they are, and find the nearest safe building.

Every mainstream messaging and mapping app assumes a working internet connection. When the connection dies, they show a spinner.

## The Solution

**AuraSync is built the other way around: offline is the default, online is the bonus.**

The entire app — UI, database, voice recording, shelter directory — lives on the device. Nothing is blocked waiting for a server. When connectivity returns, a durable queue drains everything to AWS in order, without the user having to think about it.

> Install it once, in advance. When the disaster hits, it still opens.

---

## Features

| | Module | What it does | Status |
|:--:|---|---|:--:|
| 🎙️ | **Voice Notes** | Record real microphone audio, stored **encrypted** in local SQLite. Survives reloads and reboots. | ✅ |
| 📡 | **Local Talk (P2P)** | Live two-way voice between two phones over WebRTC on the **same WiFi or hotspot** — no server, no internet, no signaling infrastructure. | ✅ |
| 📍 | **Location Share** | One-tap GPS capture and continuous live tracking. Share via the native share sheet or a Maps link. Full history kept offline. | ✅ |
| 🏠 | **Safe Shelters** | Shelter directory pre-seeded into the local DB, sorted nearest-first using Haversine distance, with open/full capacity status. | ✅ |
| ☁️ | **Sync Engine** | Durable `sync_queue` drains to AWS API Gateway + Lambda on reconnect, with retry, attempt caps and per-item status. | ✅ |
| 📲 | **Installable PWA** | Service worker precaches the app shell *and* the SQLite WASM binary, so a cold start works fully offline. | ✅ |

---

## What Makes It Different

**1. No signaling server for peer-to-peer voice.**
WebRTC normally needs an internet-hosted server to introduce two peers. AuraSync removes that dependency entirely: the SDP handshake is base64-encoded into a short text code that the two people exchange by hand. Two phones on one hotspot can talk with the router unplugged from the world.

**2. A real relational database in the browser.**
Not `localStorage`, not a key-value shim — SQLite compiled to WebAssembly, with a proper schema, foreign entity mapping and a transactional sync queue, persisted as a binary blob into IndexedDB after every write.

**3. Encrypted at rest.**
Voice recordings and location history are encrypted with WebCrypto **AES-GCM** before they ever touch the database, using a device-local 256-bit key. If the phone is lost, stolen or seized, a copied IndexedDB file is unreadable. Payloads are decrypted only at the moment of upload.

**4. The sync queue is the architecture, not an afterthought.**
Every write to `voice_notes` or `locations` also inserts a row into `sync_queue`. Sync is therefore durable across crashes, ordered by creation time, idempotent on retry, and capped at 5 attempts so a permanently failing item can never block the ones behind it.

**5. Designed for the worst conditions.**
Bottom tab navigation for one-handed use, 44px+ tap targets, 16px+ base font to prevent iOS zoom-on-focus, safe-area insets for notched phones, and a dark palette for low battery and low light.

---

## Architecture

```
┌──────────────────────── DEVICE (works with zero internet) ────────────────────────┐
│                                                                                   │
│   React 19 + Vite + Tailwind          Service Worker (Workbox)                     │
│   ┌────────────────────────┐          precaches shell + sql-wasm-browser.wasm      │
│   │ Talk │ Location │      │                                                       │
│   │ Shelters │ Sync       │──────┐                                                 │
│   └────────────────────────┘      │                                                │
│                                   ▼                                                │
│   MediaRecorder ──► crypto.js (AES-GCM) ──► sql.js  ──persist──► IndexedDB          │
│   Geolocation   ──►                          SQLite                                │
│                                                │                                   │
│   WebRTC (LAN P2P voice, no server) ◄──────────┤                                   │
│                                                ▼                                   │
│                                          sync_queue                                │
└────────────────────────────────────────────────┼───────────────────────────────────┘
                                                 │  on reconnect (navigator.onLine)
                                                 ▼
                              AWS API Gateway ──► Lambda ──► storage + triage
```

---

## Tech Stack

**Frontend** — React 19, Vite 8, Tailwind CSS v3, React Router 7, lucide-react
**Offline data** — sql.js (SQLite/WASM), IndexedDB persistence layer
**Security** — WebCrypto AES-GCM 256-bit encryption at rest
**Realtime** — WebRTC with manual SDP exchange (serverless by design)
**Offline shell** — vite-plugin-pwa / Workbox, NetworkFirst HTML + CacheFirst hashed assets
**Cloud** — AWS API Gateway + Lambda sync endpoint, deployed via AWS Amplify

---

## Local Database Schema

```sql
CREATE TABLE voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_uuid TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  duration_ms INTEGER,
  size_bytes  INTEGER,
  mime_type   TEXT DEFAULT 'audio/webm',
  audio_blob  BLOB,            -- AES-GCM encrypted: [12-byte IV][ciphertext+tag]
  synced      INTEGER DEFAULT 0
);

CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  accuracy REAL, created_at TEXT NOT NULL, synced INTEGER DEFAULT 0
);

CREATE TABLE shelters (
  id INTEGER PRIMARY KEY AUTOINCREMENT, remote_id TEXT UNIQUE,
  name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  capacity INTEGER, status TEXT DEFAULT 'unknown', last_updated TEXT
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,   -- 'voice_note' | 'location'
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  attempts    INTEGER DEFAULT 0
);
```

---

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file in the project root:

```env
VITE_SYNC_API_URL=<your API Gateway sync endpoint>
```

Then open the dev URL and grant **microphone** and **location** permissions.

```bash
npm run build     # production build
npm run preview   # serve the production build locally
```

---

## How to Test It (for judges)

**1 — Offline voice notes**
Record a note on the Talk tab → refresh the page → the recording is still there, decrypted and playable from local SQLite.

**2 — True offline mode**
Open DevTools → Network → **Offline**, then hard-reload. The app boots completely: UI, database and all saved data. Nothing is fetched from a server.

**3 — Peer-to-peer voice with no internet**
Open the app on two phones joined to the same WiFi or hotspot. On device A press **Host** and copy the offer code; paste it into device B's **Join** field and send the answer code back. Live two-way audio, with no server involved at any point.

**4 — Shelters**
Capture a location, then open Shelters — the list reorders nearest-first with live distances computed on-device.

**5 — Queue and sync**
While offline, create notes and locations; the Sync tab shows the pending count. Restore the network and it auto-syncs to AWS, reporting succeeded / failed / pending.

---

## Engineering Notes

A few non-obvious problems solved along the way:

- **sql.js WASM filename** — Vite resolves `sql.js` to its browser build, which requests `sql-wasm-browser.wasm` specifically. Shipping the Node build's `sql-wasm.wasm` makes `initSqlJs()` fail with a silent 404.
- **Service worker cache trap** — a precached, Cache-First `index.html` would be served forever, so even a redeployed or deleted site would never update for a returning visitor. HTML uses **NetworkFirst** with a 4s timeout; hashed JS/CSS/WASM stay Cache-First.
- **Singular vs plural entity names** — `sync_queue` stores `'voice_note'` / `'location'` while tables are plural. Mapped at the API layer rather than migrating rows already sitting in users' IndexedDB.
- **Encrypted upload** — audio must be decrypted before upload, or the cloud receives unplayable ciphertext. `sql.js` returns `Uint8Array`, so it is rewrapped into a `Blob` before base64 encoding.
- **Hotspot NAT** — many phone hotspots NAT their own clients, so a STUN server is included as best-effort. With no internet it is simply unreachable and host candidates are used, leaving the fully-offline path intact.

---

## Roadmap

- Offline vector map tiles for shelter navigation
- Multi-peer mesh voice (currently 1-to-1)
- Live shelter capacity pushed down from AWS
- Background sync via the Background Sync API
- End-to-end encrypted cloud payloads

---

<div align="center">

**AuraSync** — built for the moment the network gives up.

</div>