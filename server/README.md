# DK Server | First persistent-world milestone

**Status: development prototype, milestone 2.** Independently implemented Node.js service, not a RunUO port, a public MMO, or the live game's save authority **yet**. The existing Demon Killer browser client is not connected. The design target is server-owned saves only, with **no legacy browser-save migration**.

## Start on Linux

Requires Node.js 20 or later, no npm installation or external game engine.

**New player UI:** http://127.0.0.1:8766/player. Set up one private owner password (at least 12 characters) on first visit, then sign in to create, list or continue server-owned character records. The password is stored only as a salted scrypt hash in the private data directory; authenticated browser requests use an HttpOnly SameSite=Strict session cookie. The admin token is never embedded into the web UI. Signing out revokes the session; a server restart requires signing in again.

    node server/dk-server.cjs

The default server listens only at http://127.0.0.1:8766/ . Open that address manually to see a read-only world monitor. The server continues after browsers disconnect. Stop with Ctrl+C. To choose a private data directory or port:

    DK_SERVER_DATA="$HOME/DKLab/dk-server-data" DK_SERVER_PORT=8767 node server/dk-server.cjs

World saves go into server/data/world.json by default and are excluded from Git. The first start creates a random admin-token in the same private directory. **Treat this as a secret.** Never publish tokens or world data to GitHub. If you configure DK_SERVER_TOKEN directly, it must be 32 characters or longer.

## Implemented persistence and network endpoints

- GET /api/v1/health: local service status.
- GET /api/v1/world: public read-only temple layout and synchronized world clock. Private character records are omitted.
- GET /api/v1/clock: server-authoritative cycle with six real hours of day followed by six hours of night.
- GET /api/v1/events: read-only Server-Sent Events stream for initial world snapshot and repeating clock updates.
- GET /api/v1/auth/status: whether an owner exists and this browser is signed in.
- POST /api/v1/auth/setup: first local owner password setup. Refuses duplicate setup.
- POST /api/v1/auth/login: owner login with rate limiting.
- POST /api/v1/auth/logout: revoke the browser session.
- GET /player: server-hosted character selection page; no localStorage save imports.
- GET /api/v1/characters: authenticated server-owned character slots.
- POST /api/v1/characters: authenticated creation of a **new** character, accepting exactly {"slot":1,"name":"Name"}. No overwrite, no arbitrary saves, no upload/import.
- GET /api/v1/characters/1: authenticated read of one character slot.

The new character UI authenticates using an HttpOnly local session cookie; the admin-token Bearer header remains a separate local administration API mechanism. **Never embed an admin token in browser JavaScript.** Remote access and client integration require separate player accounts/sessions and TLS first. The service rejects non-loopback binding.

Each accepted character creation is serialized, verified and persisted to a temporary same-directory file, synced, then atomically renamed before an HTTP success response. Startup refuses unknown schema, invalid data and corrupt JSON instead of silently overwriting. A private writer lock prevents two server processes from updating the same directory. Clock phase comes from a persistent UTC anchor and survives restarts.

Only the approved 16×16 Forsaken Temple template is installed. The altar remains at (7,5), north door at (8,0), and the soul crystal does not exist before the introductory ritual. The temple layout and story in the browser were not modified.

## Local verification

From repository root:

    node --test tests/dk-server.cjs tests/dk-server-auth.cjs

Thirteen tests verify world geometry, six-hour boundaries, restart and persistence, invalid-save refusal, authentication, forged-save rejection, concurrent slot creation, single-writer lock, world event stream and loopback safety. GitHub Actions are **not** required or used for these checks.

## Next engineering milestones

1. Connect the **playable Forsaken Temple** to the already-working DK Server owner session and server-owned New Game / Continue records. The /player screen creates and reopens records now, but **does not launch gameplay yet**; the public GitHub Pages client remains separate. Do not migrate old localStorage saves.
2. Add a versioned action channel and server-validated movement, collisions, player forms and idempotent resurrection. Never trust client-supplied world state.
3. Add uniquely identified NPCs, items, relationships, room links, authoritative Architect edit transactions, and durable scheduled events.
4. Add crash recovery, backups, migrations for future DK Server versions (not old saves), monitoring and multiplayer security before production hosting.

RunUO sources were reviewed as architecture references only. See docs/dk-server-runuo-review.md for exact source paths. No GPL-licensed RunUO game code or assets were copied.
