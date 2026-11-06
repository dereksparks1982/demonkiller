# Demon Killer · Integrated Local DK Server (M3)

Node.js 20+, no additional npm dependencies and no separate dashboard. The current version is **single-player and local-only**, without passwords, accounts or login screens. Start the game with `./start-demon-killer.sh`; it launches DK Server detached and opens the normal Demon Killer menu. Do not run a separate `/player` page. `/player` now redirects to the menu.

## Process lifecycle

- Loopback only: `http://127.0.0.1:8766/`, same origin for game assets and world API.
- Browser close: does **not** stop the server. Its world clock uses a persistent UTC anchor and continues through restarts.
- **Options → Persistent World → SHUT DOWN SERVER**: POST a same-origin request with the browser's custom local control header. The host process waits for pending disk writes, closes subscriptions and listener, and releases the single-writer lock.
- Restart: run `./start-demon-killer.sh` again. The launcher detects a running M3 server and reopens the menu. An older M1/M2 server must be stopped manually once before updating. Logs: `${XDG_STATE_HOME:-$HOME/.local/state}/demon-killer/server.log`.
- The launcher explicitly opens the browser as part of launching the game. To debug the server in the foreground, run `node server/dk-server.cjs` instead, and then open its local address.
- Old private `server/data/owner-identity.json` and `admin-token` files, if present from prototype M2, are **not used** in M3. The server does not delete them or your world automatically.

## What the server owns now

DK Server exclusively writes `server/data/world.json` with durable temporary writes, file sync, atomic rename and a single-writer lock. The browser does **not** upload entire save files. The server validates these character commands:

- `GET /api/v1/health`: running status, build `local-m3`.
- `GET /api/v1/world`: shared public temple snapshot and synchronized day/night clock.
- `GET /api/v1/clock`: six real hours of day followed by six real hours of night.
- `GET /api/v1/events`: server-sent world-clock events.
- `GET /api/v1/characters`: server-owned character records, slots 1–3.
- `POST /api/v1/characters`: create an empty slot using exactly `{"slot":1,"name":"A"}`. Names may be one character; occupied slots cannot be silently replaced.
- `GET /api/v1/characters/1`: reload the authoritative record.
- `POST /api/v1/characters/1/actions`: accept only `{"action":"finish_opening"}`, `{"action":"move","direction":"north"}`, `{"action":"toggle_door"}` or `{"action":"resurrect"}`. The server checks action legitimacy, collision, position, form and object state, persists the result, and only then replies.
- `POST /api/v1/server/shutdown`: local in-menu control using the custom `X-DK-Control: shutdown` header.

Public remote clients are not supported. Local requests are restricted by loopback binding, Host/Origin/Fetch-Site checks, without CORS. The custom shutdown header prevents drive-by HTML form submissions. These restrictions do not constitute internet-facing multiplayer security.

## Current boundaries

No legacy browser saves are imported into the server. The old GitHub Pages preview still has its own isolated, non-authoritative save path; it is **not** part of the live persistent game. DK Architect room edits can still be exported, but server-mode browser room-save buttons are disabled until dedicated server-side edit transactions exist. Cult journal and NPC simulation state still require migration to validated server operations. No automated monster-territory, settlement or NPC daily simulation is claimed yet.

The world format is v1 with additive server-owned character fields. Corrupt or unsupported world files are **rejected**, never overwritten automatically. The approved temple remains a 16×16 grid with altar (7,5), north door (8,0), and a soul crystal introduced only by the ritual.

## Tests

```bash
node --test tests/dk-server.cjs tests/dk-server-local.cjs tests/menu.cjs
```

The server tests cover world geometry, day/night timing, atomic restart saves, collision, no-password character creation, one-character names, action validation, same-origin asset serving and private-file denial, single-writer exclusion, and graceful local shutdown. The menu test checks the established menu and music controls. Run tests locally before committing. No custom GitHub Actions workflow is used.
