## Implemented milestone: DK Server M16 (v0.2.38)

`server/region-policies-m16.cjs` creates stable, prioritized subregion identities on top of the existing variable-size world maps without altering their geometry. The world records player-enter/exit and NPC-enter events and visit counts in the single authoritative snapshot. District policy governs guarded status (M15) at actual tile coordinates, responding dynamically to territory occupation by monsters. Housing permission is recorded as policy metadata, not yet real home ownership. The server exposes the current player district read-only through `GET /api/v1/region/current`, and the connected game displays its name and safety. These district records do not change any persistent item serials or world checkpoint strategy.

## Implemented milestone: DK Server M15 (v0.2.37)

DK Server introduces region-aware settlement justice in `server/law-m15.cjs`. The settler-controlled village is guarded; the courtyard is not, and a village overrun by monsters stops ordinary guard enforcement. Recovering personal items from a villager's corpse records a crime but only living NPCs physically within eight tiles may report it. Reported theft creates a dated case, persistent fine, criminal heat and reduced Town reputation. Guards respond using the established NPC pathfinding toward an offender in their region; guard payments and deliberate fine payments at the Village Bank conserve money instead of creating it. Unpaid cases remain actionable for a limited wanted interval; citation and nonfatal detainment status are saved, with no unilateral destruction of the one character.

`GET /api/v1/law` is read-only; `pay_fine` is a strict server gameplay transaction. All effects persist through the existing atomic M13 save strategy and event log. Further legal systems are pending: actual jails, testimony, NPC ownership transfer, trials, false accusations, ordinary theft and bounty hunting. No public always-on server exists yet.

## Implemented milestone: DK Server M14 (v0.2.36)

RunUO's skill descriptions, fixed-point values, per-skill locks, total caps and skill-check gain protections motivated an independently written `server/skills-m14.cjs`. Every character has one server-owned `skillbook`: ten named professions with numeric values in 0.1 increments, a 100.0 per-skill cap, combined 700.0 training limit, and Up/Down/Locked directions. At total cap, a deliberately Down-locked profession may lose 0.1 to permit another profession to gain 0.1. Success-based skill usage advances only with world time, slows as mastery grows, and has limited anti-repetition defenses. Legacy experience values from M13 are retained and migrated without resetting the single-character save.

Existing validated gathering, crafting, eating, healing, combat and merchant commission transactions now award appropriate skill *practice*. The game client cannot pass numeric experience grants. The read-only `GET /api/v1/skills` endpoint and `skill_lock` gameplay action connect the collapsible outdoor training panel to the authoritative snapshot and world journal. Additional RunUO professions and genuine skill difficulty checks are future milestones. The public webpage still cannot run an always-on DK Server.

## Implemented milestone: DK Server M13 (v0.2.35)

Persistent world saves now flow through an independent `server/save-strategy-m13.cjs`. The main world snapshot remains atomic and crash conscious (private temporary file, fsync, rename, directory sync), with up to five retained, SHA-256-verified backup snapshots of the entire authoritative state. Checkpoints are created after significant revisions, on startup, on clean server shutdown and on user request. The server offers read-only save-health inspection and a checkpoint command through the same local-only origin-restricted interface. Secondary backup failure is not misreported as a failed completed game-state transaction.

One-life preservation is explicit: old checkpoints **are never automatically restored** over a corrupted or incompatible primary world, and no new world is silently created in its place. A future admin recovery milestone will require manual selection and provenance verification. The NDJSON event archive remains separate from these snapshot backups; journal reconciliation and incremental backups remain future architecture work. This does not change the persistent server's lack of web hosting.

## Implemented milestone: DK Server M12 (v0.2.33)

Individual NPCs now have durable personal containers and items, separate from the player's backpack and business inventory. `server/mobile-assets-m12.cjs` owns NPC backpack identities and corpse records. On NPC death from starvation or monster combat, coins are taken out of the living NPC record and placed inside a corpse at the actual map tile, while personal items keep their M10 serials. The one living character can recover nearby NPC possessions through the existing authoritative gameplay endpoint. Bodies are registered in M10 sectors and expire after 720 running world minutes via a fifth M11 scheduler job, without ghost/remote/item-forgery exploits. Corpse decay while the server is deliberately paused does not occur.

Migration from M11 supplies each surviving NPC with a personal starter provision and adds the cleanup job, without destroying existing business inventories, relationships, money or event history. The user's one-life rules remain unchanged: there is no player permadeath system yet. Future work can use these records for property inheritance, murders, funerals, crime, estates and family ties. The public website is still a static preview and does not run a hosted DK Server.

## Implemented milestone: DK Server M11 (v0.2.32)

RunUO's timer priorities and world-event dispatch informed an independent, persisted **world-minute scheduler**. `server/world-scheduler-m11.cjs` owns the fixed allowlisted job registry, due times, recurring intervals, priority ordering and idempotent last-processed minute. Postal dispatch, traveling camp rotation and merchant supply deliveries are no longer scattered through M5's minute loop. Guards gain recurring wages funded from actual bank business coins. These events save with the same authoritative snapshot and existing history journal, so browser closure does not stop them and deliberate server stop freezes them without wall-clock catch-up. M10 worlds migrate with the next due minute after their last simulated time.

The only new route is `GET /api/v1/schedule` for inspection; clients cannot create jobs or run arbitrary server callbacks. There is no hosted browser-accessible world yet, no multiplayer requirement, and no sector sleep manager at this stage.

## Implemented milestone: DK Server M10 (v0.2.31)

The world now has an independent RunUO-inspired entity registry (`server/entity-registry-m10.cjs`) with monotonically allocated stable IDs for mobile/object references and movable item stacks. Every item belongs to a real pack, equipment slot, bank vault, one village chest or saved ground pile; a whole transfer preserves the serial and a partial transfer creates a distinct serial without duplication. The registry is migrated from M9 counts non-destructively. Legacy crafting, gathering, bank, combat and inventory actions continue using M9-compatible count views while world saving reconciles and asserts serial-derived quantities. The physical village chest and API-protected transfers require real player proximity.

`server/sectors-m10.cjs` divides each region independently into 16×16 spatial sectors and provides derived, bounded location queries for world fixtures, players, living NPCs, monsters and drops. The sector index itself is not an extra save and is rebuilt when the authoritative world revision changes. The local server exposes read-only player-area nearby queries and owned/physically reachable item records; ordinary non-hosted GitHub Pages still does not run the server.

**Open requirements:** Real always-on web hosting and access protection, nested containers and individualized item attributes, NPC property inheritance, sector activation/sleep, broad map generation and more extensive UO-style simulation. This is a tested module-level foundation, not proof of complete end-to-end browser gameplay.

## Implemented milestone: DK Server M9 (v0.2.30)

The single player now has a persistent **bank-item vault** alongside their existing gold balance and correspondence box. Item deposits and withdrawals require a living, conscious character close to the open Village Bank and are saved atomically with player inventory; vault holds up to 500 goods. The world also stores physically dropped outdoor goods with item IDs, quantities, exact area and tile positions, and server-time decay after 360 running minutes. Pickup requires proximity and is a one-time atomic transaction. The outdoor view uses original primitive markers and has item-select controls for drop/pickup and bank storage. New server routes are unnecessary; gameplay actions are dispatched through the existing allowlisted `/api/v1/gameplay` endpoint. The bank box's read endpoint includes stored item counts.

`server/storage-m9.cjs` is the new bounded, validated authority module and `tests/storage-m9.cjs` covers the contracts. The canonical world snapshot and append-only event history remain the persistence layer. GitHub Pages still **does not host the running world**, and no claim of autonomous simulation on the public website is made.

## Implemented milestone: DK Server M8 (v0.2.29)

The persistent world now represents monster occupancy with actual imp entities rather than a status flag alone. When territory becomes occupied, imp populations are seeded onto traversable grid tiles. They patrol/pursue nearby targets on the server using cardinal pathfinding; guards can fight back, and NPC lives and character health are affected. The server exposes combat state read-only and provides validated, atomic `attack` and `loot` gameplay actions. Monster kills produce saved ground loot and can liberate the occupied territory, with all related actions in the permanent NDJSON archive. The existing M7 hunger/health/incapacitation state provides a nonfatal fallback for player defeat, without overwriting the single character.

The outdoor view displays original primitive monster and drop markers; no new generated art. `server/combat-m8.cjs` is the authoritative module and `tests/combat-m8.cjs` provides regression contracts. This is not UO-level combat or a network-hosted persistent server. Public GitHub Pages still cannot run the simulation.

## Implemented milestone: DK Server M7 (v0.2.28)

The authoritative world now tracks a living player's hunger, energy, health, incapacitation, two equipment slots, crafting skill, cooldowns and torch expiration. Recipe transactions consume and produce actual inventory items: torch (wood/herbs), rations (bread/produce), bandages (herbs/produce), and tools (ore/wood, smithy proximity required). Eating, bandaging, equipping, removing gear and resting are server-authored state transactions, recorded in the existing world event journal. Passive needs advance only with running simulated minutes. The module does not implement permanent player death or overwrite the single life. Existing characters receive a non-destructive default M7 crafting record on startup.

Source: `server/crafting-m7.cjs`, `server/gameplay.cjs`, `server/living-world.cjs`. Contracts and NPC relationships from M6 remain. New outdoor UI actions use the existing gameplay endpoint. Public GitHub Pages is **not a persistent online server**; no remote provider is configured.

## Implemented milestone: DK Server M6 (v0.2.27)

M6 adds real NPC conversational actions, persistent contact records, faction reputation, time-limited physical goods commissions and NPC pathfinding that obeys existing variable-size DK Architect geometry. The social state is validated, migrated safely from M5 worlds, written atomically, and recorded in the permanent event log. Shop commissions check proximity, status, inventory, actual business funds and server-time deadlines; the player receives real gold and skill progress, rather than a browser-only reward. See `server/social-m6.cjs`, `server/npc-navigation-m6.cjs`, `tests/social-m6.cjs`, and `tests/npc-navigation-m6.cjs`.

The existing courtyard/village renderer now includes server-backed social controls, with no newly generated pictures. NPC pathfinding is bounded, cardinal-only, and uses actual region portals. M6 does **not** create a publicly hosted persistent process; the GitHub Pages menu still reports Not Connected. Future work includes richer NPC inventories and speech, faction conflict, UO-style crafting, equipment, housing, player economy, guard response, and substantial settlement scale.

## Implemented milestone: DK Server M5 | 2026-11-06

The authoritative local server now includes three connected variable-size regions, autonomous NPC work/rest/movement, shops, traveling camps, territorial threats, bank-box mail, resources, server-owned inventory and gold, and a persistent event archive. This **supersedes earlier planning notes** below that describe the temple as the only region or claim the playable client is not connected. The public GitHub Pages preview is not connected to a hosted DK Server; its static gameplay demonstration is not an online persistent world. The full current design and implementation boundaries are in [UO Living World M5](uo-living-world-m5.md).

## DK Server M4: pause/resume world runtime (v0.2.25)

The loopback game service has durable `runtime.running`, `runtime.elapsed_ms` and `runtime.resumed_at_utc` fields. `POST /api/v1/server/start` resumes the world clock; `POST /api/v1/server/stop` saves and freezes it, without killing the process. The process-restart path does not simulate elapsed time while the service was off. World writes are serialized and checkpoints continue with no browser connected. The server now enforces **one character slot**. Local New Game/Continue automatically resumes world time.

This **does not constitute hosted deployment** or an NPC simulation. The public page reports Not Connected until a secure always-on process and durable storage are deployed. The current loopback-only API must not be bound publicly without owner/device authorization. UI controls exist, but remote connectivity and true autonomous NPC/business schedules remain to be built.

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
