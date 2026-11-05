# Demon Killer | Modular World, RunUO Research, Archive Audit & Temple Props

**Recorded:** 2026-11-05  
**Status:** Research and design documentation only. **No gameplay, server, save migration, multiplayer, seasonal, cheat, or temple-prop implementation authorized by this document.** The owner explicitly requested documentation before artwork and future implementation.

## Owner's direction

Make the existing engine-free HTML/CSS/JavaScript/Canvas Demon Killer game behave like a persistent, extensible RunUO-style world. Its separately packaged world service must eventually be able to run on a Linux computer while keeping the same playable game client. Build from stable interfaces so NPCs, seasons, monsters, factions, areas, seasonal events, menus and mod-like content packs can be added, disabled or replaced without breaking the base game. Preserve the existing temple, DK Architect, player routes, accepted graphics, editor geometry, cult mystery and local save slots until explicitly authorized changes.

**Today's state:** The world-server proposal lives in `docs/world-server-design.md`, but **no backend is deployed**. Current browser-local named slots, cultWorld, population and architect room-save mechanisms are not a persistent authoritative shared server. Browser-only pages cannot run a server while closed or the hosting machine is off.

## Research: existing UO servers and reusable libraries

| Source | License / stack | Good ideas / reuse path | What NOT to do |
| --- | --- | --- | --- |
| [RunUO](https://github.com/runuo/runuo) | GPL-2.0; older C#/.NET/Mono | Script registry; entity/spawner persistence, region/area hooks; holiday scripts including Halloween, Easter and Christmas | Do not copy GPL server code into a differently licensed JS product without evaluating resulting obligations. UO packet protocol and UO assets are not compatible with Demon Killer's browser client. |
| [ServUO](https://github.com/ServUO/ServUO) | GPL-2.0; C# | Expanded script/config/data/spawner separation, game events, staff event controls, season handling | Not a drag-and-drop backend or content license. |
| [ModernUO](https://github.com/modernuo/ModernUO) | GPL-3.0; C# | Efficient game loop; background save publication; versioned serializers; dirty tracking; crash-safe staged world save; timed systems | Its recent implementation details are licensed; study designs, do not silently transplant source into DK. |
| [POL](https://github.com/polserver/polserver) | C++ with eScript; verify precise licenses per component before copying | Separately configured script packages, custom event-driven world logic, Linux operation | Different runtime/protocol; do not install as DK's engine. |
| [Colyseus](https://github.com/colyseus/colyseus) | **MIT**; Node/TypeScript | Strong candidate for optional authoritative network transport: rooms, reconnection, per-client state synchronization, matchmaking | Not itself a persistent NPC economy or world database. Lock only after a single-temple prototype and performance/size review. |
| [ws](https://github.com/websockets/ws) | **MIT**; Node | Lean alternative WebSocket transport if full Colyseus is unnecessary | Must implement world protocol, validation, reconnect and interest management ourselves. |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | **MIT**; Node + SQLite | Embedded, transactional local server datastore; WAL and migrations; plausible first one-computer world DB | Requires supported Node version; not a browser database and not a global MMO scaling solution. |
| [node-cron](https://github.com/node-cron/node-cron) | **ISC** | Calendar trigger support and timezone-aware scheduled checks | It **does not** provide exactly-once durable event execution across crashes; the world database must record events. |
| [tModLoader](https://github.com/tModLoader/tModLoader) | **MIT**; C# / Terraria integration | Design reference for discoverable extension manifests, version checks and game hooks | Cannot use it directly with JS/Canvas, and Terraria-specific assets/code have separate rights. |

This is a review shortlist, not an installed dependency list or final technology selection. Pin versions, preserve copyright/license notices and perform a code/license audit on each file before inclusion. Publicly visible source does not automatically permit unrestricted reuse.

### Source-specific lessons

- RunUO's `Scripts/Holiday Stuff` contains named Christmas, Easter and Halloween content. Study how the **event's lifecycle and content** are separated from common world services; do not copy UO content/assets.
- ServUO examples show administrators can change a map's season independently from weather. Demon Killer should similarly separate the **season state**, **weather state** and **visual presentation**.
- ModernUO's recent release notes describe staged world-save publication and recovery. For DK, never expose an incomplete save as the newest valid world; use transactional snapshots and journaled updates.
- A useful starting choice, subject to testing: **shared JS domain logic + Node service + a storage adapter + ws or Colyseus**. This builds on our current game without swapping engines.

## Audit: legacy `archive/godot-recovery-2026-11-04`

The archived branch has 45 file/tree entries; it is a **partial recovery**, not the old complete 4,920-file workspace claimed by its archived README.

| Existing archive path | Confirmed behavior | Migration value / issue |
| --- | --- | --- |
| `addons/savekit/save_manager.gd` | Saveable-node groups; before/after hooks; in-memory and disk JSON; named nested save components; overwrite controls; save listing and load events | Good save lifecycle reference; `json_serializer.gd`, `json_deserializer.gd`, `serializer.gd`, `deserializer.gd`, `save_game_file.gd` are not present in this archive. **SaveKit credits Fern Forest Games Ltd**, so license/provenance review before copying. |
| `scripts/save/DKDesignatedSavePoint.gd` | In-range double-click shrine save with status messages; `save_anywhere_enabled = false` | Useful optional **checkpoint mode**; `scripts/save/DKSaveManager.gd` referenced from `project.godot` is missing. Do not silently impose shrine-only saves without player approval. |
| `addons/dk_door_linker/dk_door_linker_plugin.gd` | Link/unlink doors and world cells, create test cells, editor action undo | Design reference for area graph and transactional editor actions; requires missing link utility, inspector, panel, cell-root scripts. |
| `addons/dk_live_builder/dk_live_builder_plugin.gd` | Editor tool/panel lifecycle | Missing panel dependency; port concept to DK Architect, not GDScript. |
| `addons/dk_manual_placement_protection/dk_manual_placement_protection_plugin.gd` | Editor placement protection contract | Missing panel dependency; preserve explicit owner-approved geometry. |
| `addons/dk_project_diagnostics/dk_project_diagnostics_plugin.gd` | Startup probes, diagnostic session and panel orchestration | Missing helper scripts; reuse diagnostics contract, not the broken plugin. |
| `addons/theme_gen_save_sync/plugin.gd` | Editor resource change/save hook | Editor-only behavior; not a game-save backend. |
| `scripts/progression/DKFaith.gd` | Evented nonnegative integer faith state; add/spend checks | Small original isolated progression model worth translating **only if** owner later authorizes faith mechanic. |
| `scenes/player/DKSeamlessGameplayPlayer.tscn` | Camera/sensor/ghost/human visual configuration | Scene references missing scripts and image resources; cannot execute with current JS game. |
| `recovery/source_payload/part00*.b64` | Incomplete preserved compressed payload fragments | **part001.b64 missing**. Do not claim full reconstructed code or assets from these fragments. |

No **verified named demon/demonic god list** appears in current main's `docs/` or the accessible archived code. Earlier discussion may have a broader pantheon, but that is **not** proof of a specific demon roster. Do **not** assign a named cult deity, develop its powers or commit deity-specific statue lore until the correct source is located/approved.

## Proposed detachable architecture (no implementation yet)

```text
Demon Killer repository
├── client/                   # browser renderer, inputs, UI, DK Architect adapters
├── shared/                   # engine-independent state schemas, IDs, command definitions
├── world-core/               # portable deterministic rules, entity store, event bus, calendar
├── server/                   # OPTIONAL Node process; authoritative host and API
│   ├── transport/            # ws or Colyseus adapter
│   ├── storage/              # SQLite adapter, journal, schema migrations
│   └── scheduling/           # durable scheduled-event processor
├── modules/                  # versioned plug-in content and logic
│   ├── core-temple/          # required official scene module
│   ├── cult/                 # hidden truth, recruitment, investigations
│   ├── weather/              # optional
│   ├── seasons/              # optional
│   ├── monster-territories/  # optional when approved
│   ├── festival-calendar/    # optional timed modules
│   └── secret-modes/         # optional, no implementation authorization
├── assets/                   # approved authored sprites, no UO assets
└── docs/
```

**Important:** This is a *conceptual target layout*, not authority to reorganize the current repo or move working files. The existing root-level browser scripts continue until explicit migration approval.

**One world ruleset, multiple ways to host it:**
- Browser-only single player calls the same `world-core` command processor through an **in-process local adapter**. Existing local saves remain usable. It can catch up deterministically on next launch, but it cannot literally run offline while the app and host are shut down.
- Dedicated Linux single-player server calls that ruleset from a separate Node process on the same computer; a browser connects through a local WebSocket. It continues operating while the service runs.
- Later multiplayer clients use the same protocol and server-side validation. Browser clients send intent, not authoritative item/money/world-state mutations.
- **Removing the server package does not break offline single-player.** Removing an optional module does not crash load; unknown module-owned data is retained, not discarded. Required core game content cannot be disabled.

### Plug-in/mod boundaries

A minimal **proposed**, versioned manifest:
```json
{
  "id": "dk.seasons",
  "version": "0.1.0",
  "api_version": "1",
  "kind": "world-module",
  "required": false,
  "dependencies": ["dk.world-clock"],
  "hooks": ["world.ready", "calendar.dayChanged", "area.enter"],
  "assets": ["assets/seasons/"],
  "state_namespace": "dk.seasons"
}
```

- Modules register **namespaced objects, UI panels, content, commands, schedules, state schema, migrations and cleanup hooks** through published APIs. Avoid direct imports of unrelated private functions and avoid `eval`/arbitrary untrusted mods.
- Removal: detach hooks, timers, UI and temporary objects; preserve state by namespace unless an explicit destructive migration is approved. Inform player of incompatible dependencies. Required module missing = clear recovery error, not silent world corruption.
- Tests: install/disable/reinstall, hot restart, missing dependency, old/new schema, save/load, duplicate events, failure isolation, malicious client message handling, no unrelated gameplay changes.
- Separate **content-only mods** (safe JSON/assets) from **trusted code mods** (server admin opt-in; code can be dangerous). Automatic downloads and arbitrary remote code execution are out of scope.

### Saves and persistence

- Three separate ownership layers: (1) **character slots** (inventory, form, progress, learned facts, cheat flags), (2) **shared world** (NPCs, cult truth, time, property, regional state, events, economy), (3) **DK Architect editor drafts/history** (not an automatic world override).
- Each record has `schema_version`, stable `entity_id`, `world_id`, `module_states`, modified time and revision number. Saving is transactional; write temp/staging record + checksum, atomically publish, keep previous known-good snapshot, and replay an append-only event log where useful.
- Persist critical opening flags: living/unconscious/ghost state, corpse state, Lilith prayer, doorway barrier, crystal present/spent, scene completion; no duplicate ritual on reload.
- Single-player cheats are recorded on their own **cheat-enabled** save world and are never trusted by a future public authoritative server. Secret blue-fire menu and demon New Game+ remain proposals.
- Never migrate/remove current browser saves or change their storage keys without explicit approval and import/export verification.

### World calendar, seasons and seasonal events

- Keep existing **proposed** Rule of Six (6 real hours of day, 6 real hours of night), independent of a longer **world-year** calendar. Owner must approve the number of in-game days per season and date anchor.
- **Season module:** spring (new growth), summer (full foliage), autumn (color changes + separate falling leaf effect), winter (bare deciduous trees, snow where climate/weather applies). Evergreen trees keep needles. Seasons are not the same as weather. Dedicated server syncs canonical calendar/season. Local browser catches up on reconnect.
- **Weather module:** temperature, rain, wind, snowfall and melting with area/climate rules. Snow accumulation can be a tile overlay, not destructive art replacement. Leaves/snow particles remain optional cosmetic client layers. Avoid all-season snow everywhere.
- **Calendar events:** data-driven date ranges with UTC/timezone policy and locality-specific triggers. Examples only: winter lantern festival, fall harvest, a periodic cult gathering. Unnamed proposals; don't invent actual story rites.
- Durable event state uses unique keys `world_id:event_id:year_or_occurrence`; process missed time windows idempotently; support disable/re-enable, retries, restart and catch-up caps. Do not spawn duplicate event bosses/rewards if server restarts.
- **Dynamic territory module** (future): settlements can be safe/threatened/besieged/occupied/liberated, even if player never visited. NPC defense and trade effects run from server simulation. A player disconnect is not permission to kill their resting avatar by invisible combat. Catch-up simulates only meaningful changes.

## Temple prop sheet specification (explicit artwork request, not a game build)

Make **one REVIEW sheet first**, with deliberately *crude, low-detail, replicable* 32×32-per-view pixel art. Every object has **exactly four cardinal static views** in consistent order **north, east, south, west**; for symmetrical objects four rotations can visually match, but still include four discrete cells. No walking/particle animation in this initial review sheet.

**Required objects:**
1. New simple brazier: extinguished/unlit and burning versions (flame separate overlay preferred).
2. Small single candle; candle cluster; open/closed extinguished and lit as separate states when useful.
3. Closed ritual book and open book.
4. Spider web / cobweb corner and wall-hanging web.
5. Tiny crawling bug/beetle.
6. Coiled rope and straight rope.
7. Loose chain, wall-hanging chain.
8. Ritual collection bowl, **empty / partly filled / full**; blood states separate, not baked into altar.
9. Crude demonic-god stone statue with four directional silhouettes **pending exact canon deity identification**; do not name, give traits to, or finalize without owner approval.

**Good extra props for this ceremony:** crude candle stand, wall torch, ritual dagger (item, not an attached injury effect), rough parchment note, cracked offering plate, tiny fallen-stone pile, simple curtain/banner without unapproved cult emblem, wall hook, blood droplet/puddle overlays separately. Preserve user's no-fancy-art rule and no embedded blood on the altar.

Create image for visual review only; **do not upload props or wire into the temple until owner approves.** The existing altar was separately approved and replaced on main with steps-right north view in commit `073c1b9`.

## Implementation priorities (proposals, not authorized work)

1. Confirm the exact deity roster from a sourced canon document before locking the statue.
2. Approve prop sheet visually; then extract only approved 32×32 art and add to asset library in a separate owner-authorized commit.
3. Propose the portable world-core command/event/schema contract **without changing the working temple**.
4. Build/test local save adapter and reversible migrations, preserve cult and editor saves.
5. Stand up one-temple Linux authoritative service behind a transport adapter, with durable saves.
6. Build opt-in calendar/weather/season/event modules and their isolated tests.
7. Only then expand to new areas, events and eventual multiplayer when explicitly approved.

**No engine swap. No UO assets/protocol. No undocumented deity invention. No automatic changes to approved temple/editor/gameplay.**
