## Public website UI status (v0.2.24, 2026-11-06)

The GitHub Pages Options screen always exposes **Persistent World** with Start Server, Stop Server, Refresh, world status and day/night status. Without a genuine hosted backend, the public page must show **Not Connected** and must not invent state changes or pretend browser localStorage can simulate a continuous server. The existing loopback process can be stopped through the actual menu control. Cloud hosting, secure single-player administration, hosted start/stop supervision and full NPC simulation are **not deployed yet**. The public preview's browser saves remain separate. The menu offers one character slot and no overwrite.

## Current implementation (M3, 2026-11-06)

Demon Killer is now hosted by its local loopback DK Server, not a separate /player page. No password or login is required for this deliberately single-player build. The Linux launcher starts the server detached; Firefox can close while the server's world clock continues; the main menu Options includes a deliberate shutdown command. Character creation and temple opening/movement/door/resurrection are persisted as validated server actions. Older browser saves are not imported. Architect edits, cult/NPC autonomous simulation, area conquest and multiplayer remain **planned**, not completed.

# Demon Killer | Persistent World Server Design

**Status:** Design target plus the first implemented DK Server localhost prototype. New-character persistence, local password-based owner sign-in, server-owned New Game/Continue record selection, and a shared world clock work in the separate server; the **playable temple client is not yet connected** and the service is not deployed.  
**Source:** New Demon Killer server, independently implemented, with architectural inspiration from RunUO / Ultima Online and earlier in-house work.  
**First playable world:** The one existing sacrificial temple (`dk.temple.sacrifice.001`). Do not add the courtyard or any meadow during server development.

## Purpose

The browser-based Demon Killer player remains a thin **game client**. The **server is authoritative**: clients send attempted actions and receive resolved outcomes. Players share an evolving world that continues even when nobody is connected. The server persists NPCs, creatures, characters, items, doors, the crystal, world time, and future room connections. DK Architect can eventually be an authorized editor of that same world.

No dependency on Godot, no Ultima Online game data, and no expectation that an Ultima Online protocol server can simply be connected to our Canvas page.

## Repository and hosting split

- **GitHub `main`**: canonical source for browser/client **and** our future server implementation, versioned together.
- **Static website** (e.g. GitHub Pages, once configured): loads HTML/CSS/JavaScript/assets; cannot itself run a persistent server.
- **Persistent backend process**: separate Linux machine, VPS, or server-capable hosting; not a GitHub Pages process. Should be able to keep running when users close their browsers.
- **Network transport**: prefer a documented versioned WebSocket protocol for the game stream, with HTTPS endpoints for initial bootstrap/auth/administration as appropriate. Reject untrusted client state updates.
- **Durable data**: server-maintained records and snapshots with explicit schemas and migrations; do not overwrite good saves or world snapshots on failed writes.

The backend framework and deployment provider are **not locked**. A Node.js prototype fits the present JavaScript stack, with a later performance review before scaling.

## Proposed time model: the Rule of Six

Configuration proposal (real-world seconds):

```json
{
  "cycle_real_seconds": 43200,
  "day_real_seconds": 21600,
  "night_real_seconds": 21600,
  "time_anchor_utc": "configurable",
  "clock_mode": "server_authoritative"
}
```

- **Day lasts six real hours**, night lasts **six real hours**; one full light/dark cycle is 12 real hours, or two full in-game day/night cycles per real day. This is a proposed design value, not a coded feature yet.
- Derive world clock from server-held time anchors and elapsed real time. Persist anchors, so reboot/restart does not reset dawn to zero.
- All connected clients see the same day/night phase. No client can advance the shared clock by pressing buttons.
- Important transitions (dawn, dusk, timed ritual/event/AI behaviors) must be idempotent, so restarts and replays do not trigger events twice.
- Use six as a **thematic design motif**: perhaps six watches/bells, six phases in special rituals, six unique consequences, and recurring symbolic geometry. Do not force six into network tick rates, security thresholds, autosave intervals, or enemy counts when it would damage gameplay.
- Use a separate **simulation tick** for responsive movement/combat; no game logic should wait six minutes or hours to react.
- For offline simulation, use elapsed-time catch-up and scheduled events, with bounded processing and safeguards against surprise player deaths or irretrievable loss while disconnected.

## Authoritative entities and coordinates

All world entities have a durable ID and coordinates relative to a named area. Coordinates are **grid based**, 32x32 pixels/tile in the temple.

Example shape (illustrative only; this is not a deployed protocol):

```json
{
  "entity_id": "soul_crystal",
  "area_id": "dk.temple.sacrifice.001",
  "x": 8,
  "y": 9,
  "facing": "north",
  "footprint": {"w": 1, "h": 1},
  "state": {"spent": false}
}
```

- Directions: north/east/south/west, including for sprite/rotation selection. **No diagonals** in construction or automatic pathfinding.
- Later "rooms" may be one little chamber or a giant open meadow, each with `area_id`, width/height and edges/door connections.
- Later connections form a **graph**, not an expectation that every area is one giant tiled map.
- Efficiently stream only the client's visible area and nearby relevant changes; the server still owns the rest of the world.
- A single world instance is the first goal. Multiple shards, PvP, other players, economies, and chat are later explicit design decisions.

## Temple-first server sequence

1. **Read-only server test:** run the same 16×16 temple data on a local process; serve current state and synchronized world clock to one browser client. Show connection/disconnection accurately.
2. **Authoritative movement:** client sends up/down/left/right requests and server validates solid walls, player form and object collisions. Reconcile client display after round-trip.
3. **Crystal branching:** server confirms only one resurrection transaction for a character and persists ghost/living form; avoiding it remains a valid path.
4. **World persistence:** serialize versioned world/character state, rehydrate after process restart, and test power-loss recovery without resetting temple objects.
5. **Live DK Architect edits:** authorized editor publishes a wall, floor, door, orientation or object change only after server validation. Other clients receive updates. Preserve undo boundaries/audit history.
6. **Server NPC/time pilot:** create a minimal NPC or temple ambient behavior using the shared six-hour day/night state. Persist and test it without opening another playable room.

Do not represent an unimplemented feature as running. Before moving to a multi-area graph, demonstrate the current temple on the live world server first.

## Previous work worth reusing conceptually

### Nougat Media Plus

`dereksparks1982/Nougat-Media-Plus` contains actual Linux C++ launcher/manager code:

- `src/games/uo_server_manager.cpp` and `.hpp`: manages a *separate SphereServer* executable, including ownership tokens, process PID, start/reuse, readiness polling, stale-state detection and stop.
- `src/games/uo_playable_runtime.cpp`: launches and configures an Ultima Online client with its dedicated local server, port `2593`.
- `src/games/uo_client.cpp`: client launch/configuration.

This is **genuine process lifecycle work**, but **not** a Demon Killer world simulation, not a browser WebSocket game backend, and not an MMO stack ready to copy wholesale. Reuse the ideas and independently authored code where appropriate, respecting original third-party rights and project license boundaries.

### Capital & Consequence

`dereksparks1982/capitalandconsequence/ONLINE-SYSTEMS-DESIGN.md` documents static-site client, account-backed durable saves, a proposed Cloudflare backend, data migrations, chat/ranking trust boundaries and local-save recovery. This is a useful **design** for identity/save safety, not an existing shared authoritative simulation. Its historical game rules and assets should not be imported.

### Demon Killer legacy Godot archive

`archive/godot-recovery-2026-11-04` retains door-linker and save ideas, but the old Godot modules are not executable by the current client, and their archive snapshot contains missing dependencies. Rebuild functional concepts natively instead of mixing runtimes.

## Server acceptance checklist (future build)

- Server survives client disconnects; restarting the client does **not** restart the world.
- Clock advances exactly by the configured elapsed time across process restarts, with consistent six-hour light/dark transitions.
- State changes are authoritative and persist across a forced process restart; invalid or duplicate action packets are rejected.
- Ghost and mortal outcomes survive reconnection and are separate save states.
- Two connected clients observe consistent entity states without trusting a forged browser save.
- Browser offline mode does not silently overwrite newer server data when reconnecting.
- All connections are authenticated/authorized where needed, have sensible size/rate limits, and log actionable diagnostics without exposing private data.

This document describes **proposed architecture**; it is not evidence of a deployed server.
