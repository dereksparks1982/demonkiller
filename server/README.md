# DK Server M14 | Skills, Training Locks and Professions (v0.2.36)

**Node.js 20+**, CommonJS, no external npm dependencies and no additional dashboard. This is the engine-free single-player authority for Demon Killer, presently **restricted to loopback**. The public GitHub Pages game does not have a deployed persistent backend.

## Lifetime and saved data

The process is launched in local development by `start-demon-killer.sh` and serves the normal Demon Killer game menu, temple, courtyard and village. The **browser can close while the server runs**. **Start Server / Stop Server** in the game Options resume or pause the whole world clock, saving the state without terminating the process.

`server/data/world.json` stores the character, regions, NPCs, businesses, territory, camp, mail, resources, run/pause flag and clock. The writer queue uses fsync plus atomic rename under a single-process lock. `server/data/world-events.ndjson` is an append-only long-term event record; the snapshot also retains the most recent 512 events. An archive-write error is logged; the world snapshot remains the authoritative state. Manual process shutdown pauses the world. An unexpected host outage does **not** manufacture time or NPC actions while the host is not running. Legacy M3/M4 data receives non-destructive missing-region, runtime and gameplay-field migration.

**One character slot** (slot 1), with no overwrite via New Game. Existing save files are not automatically deleted.

## Endpoints

All routes have the `/api/v1` prefix. The server serves game assets via an allowlist; no `server/data` or executable server sources are publicly served.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | DK Server build `local-m14`, online state and world running flag |
| GET | `/world` | Temple legacy snapshot and world clock |
| GET | `/clock` | Six-hour day/night state and paused/running flag |
| GET | `/server/state` | Server world running/paused state |
| POST | `/server/start` | Resume world time, requires `X-DK-Control: start` |
| POST | `/server/stop` | Pause and durably save world, requires `X-DK-Control: stop` |
| POST | `/server/shutdown` | Existing explicit process shutdown, pauses first |
| GET | `/areas` | Region list with independent width and height |
| GET | `/areas/:id` | Full server-authoritative area geometry, doors and objects |
| GET | `/living` | Live NPCs, businesses, territory, camps and recent events |
| GET | `/living/events?after=N` | Cursor-based recent world events |
| GET | `/gameplay` | Character inventory/gold/skills, regional resources and merchants |
| POST | `/gameplay` | Strict gather, buy, sell, bank_deposit or bank_withdraw actions |
| GET | `/bank/box` | Letters only when physically present at the Village Bank |
| POST | `/bank/collect` | Collect one actually delivered bank-box letter |
| GET/POST | `/characters` | Read or create character, slot 1 only |
| GET | `/characters/1` | Load the authoritative record |
| POST | `/characters/1/actions` | Validated cardinal move, opening, resurrection or door toggle |
| GET | `/events` | Server-sent clock, state and living-world updates |

**Gameplay POST examples (body only)**:

- `{"action":"gather","node_id":"courtyard_herbs_west"}`
- `{"action":"buy","business_id":"courtyard_market","quantity":1}`
- `{"action":"sell","business_id":"courtyard_market","item_type":"herbs","quantity":1}`
- `{"action":"bank_deposit","amount":1}`
- `{"action":"bank_withdraw","amount":1}`

The server checks range, player form, stock, currency, inventory, cooldowns, shop hours and exact allowed fields; it never trusts a client-submitted world snapshot. The actual menu converts a double-click into the one validated `toggle_door` command.

## What runs with no browser

The Node timer advances stored world minutes and NPC routines while the server process remains running. Travel, business transactions, post delivery, resource renewal, territory threats and traveling camps are deterministic and persistent. A stopped server freezes them all. See [living-world design](../docs/uo-living-world-m5.md) for complete rules, performance limitations and next milestones.

## Safety and hosting boundary

Current `createDKServer()` **refuses public network interfaces** and filters Host, Origin and Fetch-Site. These local protections are not suitable internet-user authentication. Do not expose the local API publicly. An always-on host, durable mounted storage or database, HTTPS and a single-owner pairing/authorization mechanism are prerequisites for a hosted version.

Use `node --test tests/dk-uo-m5.cjs tests/outdoor-m5.cjs` in a development checkout to run the new regression contracts. No GitHub Actions testing infrastructure is required for the runtime itself.

## M6 social authority

- `GET /api/v1/social`: saved faction reputation, contacts, currently active commission and nearby NPC conversation prompts; no game action is executed by reading it.
- `POST /api/v1/social`: strict JSON allowlist for `{"action":"talk","npc_id":"baker"}`, `{"action":"accept_contract","business_id":"village_bakery"}`, and `{"action":"complete_contract","contract_id":"contract_1"}`.
- The server checks the NPC is alive and physically reachable, the player is living, businesses are open and safely controlled, commission deadlines have not passed, and goods, shop funds and inventory are sufficient. Gold and commodities are transferred in the single-writer transaction, and a durable social event is added to the archive.
- `server/social-m6.cjs`: new-game social records, backwards-compatible initialization of M5 saves, reputation cooldown, limited open commissions and deadline expiration.
- `server/npc-navigation-m6.cjs`: cardinal-only breadth-first search across the actual region's wall, floor and object collision map. The portal step uses the exact region connection. Large-area search is bounded to avoid runaway AI work.
- Both social and navigation paths are covered by `tests/social-m6.cjs` and `tests/npc-navigation-m6.cjs`. The full server test command is `npm --prefix server test`, but no npm download is required.

**Still not deployed to a public persistent host.** Do not expose unauthenticated loopback world APIs publicly. The GitHub Pages version remains an isolated browser preview.

## M7 crafting and survival implementation

The existing `POST /api/v1/gameplay` now also accepts allowlisted `craft`, `consume`, `equip`, `unequip` and `rest` transactions. Specific examples:

- `{"action":"craft","recipe":"torch"}` consumes 1 wood + 1 herbs to create one torch.
- `{"action":"craft","recipe":"rations"}` consumes 1 bread + 1 produce to produce two rations.
- `{"action":"craft","recipe":"bandages"}` consumes 2 herbs + 1 produce to produce one bandage.
- `{"action":"craft","recipe":"tools"}` consumes 2 ore + 1 wood at the village smithy to make tools.
- `{"action":"consume","item_type":"rations"}` restores hunger; bandages heal health.
- `{"action":"equip","item_type":"tools"}`, `{"action":"equip","item_type":"torches"}`, and `{"action":"unequip","slot":"hand"}` or `light` move real equipment between inventory and fixed slots.
- `{"action":"rest"}` restores energy with a world-minute cooldown, and allows recovery from a nonfatal incapacitation.

`server/crafting-m7.cjs` owns the recipes, validation, needs, gear and timed torch expiry. `server/gameplay.cjs` dispatches these transactions through the same serialized and atomic authority path as gathering, trading and banking. `server/living-world.cjs` advances the hunger/energy loop as simulated minutes pass, **only when the server world is running**. Unknown parameters, fake counts and client-supplied rewards are rejected. The single life is never deleted by this module. The basic UI is on the outdoor page. Run `npm --prefix server test` locally against a full checkout to exercise the M7 regression suite.

Online persistent hosting, full combat, equipment durability, death and resurrection consequences, housing and vendor inventories beyond the current prototypes remain unfinished.

## M8 persistent monster combat

- `server/combat-m8.cjs` adds one server-owned combat store under `world.living.combat`, containing living imps, their health and positions, and persistent ground loot. Existing saves migrate non-destructively. Combat state is validated with the rest of the world before writing.
- Whenever an existing territory is occupied by monsters, the server seeds a bounded group of imps on actual traversable tiles. Every five simulated world minutes, imps track nearby player/guard targets using bounded cardinal pathfinding and can attack. Guards fight back and can die. The player can become incapacitated, but their one character save is not deleted.
- `POST /api/v1/gameplay` accepts exactly `{"action":"attack","target_id":"imp_1"}` and `{"action":"loot","drop_id":"drop_2"}`. The server validates form, proximity, world state, weapon bonus and a real-time 900ms strike cooldown. Kills generate fixed loot and, on the last enemy, a physical territory-liberation transaction. Loot adds actual gold and one ingredient to inventory and deletes the world drop in the same atomic save.
- `GET /api/v1/living` now exposes read-only creature positions/health and loot markers for the local game client. The outdoor screen displays deliberately simple imps and loot, and supports double-click plus Attack / Loot controls.
- The server-owned write queue persists the **entire attack event batch** (strike, death, loot creation and liberation) to the append-only event archive, rather than only the final event.
- `tests/combat-m8.cjs` verifies migration, spawn, distance, cooldown, skill, guard combat, liberation, unique loot and HTTP persistence. Run it from a full Node checkout using the existing server test script.

**Limitations:** Imp movement/guard combat are a prototype, not a finished combat system; no UO-style spells, weapon durability, armor, dungeon drops or player permadeath. Public GitHub Pages still has no connected persistent server; internet-facing binding remains deliberately disabled.

## M9 physical items and bank vaults

- `server/storage-m9.cjs` adds `world.living.storage`: one persistent bank vault for the sole character and a bounded set of outdoor ground-item records. These save alongside the existing world, without replacing M8 data.
- `POST /api/v1/gameplay` adds four allowlisted commands: `{"action":"bank_store","item_type":"herbs","quantity":2}`, `{"action":"bank_take","item_type":"herbs","quantity":2}`, `{"action":"drop_item","item_type":"herbs","quantity":2}`, and `{"action":"pick_up","drop_id":"ground_1"}`. Clients cannot specify credits or rewards.
- Bank goods require a living, conscious character physically beside the open village bank. The bank vault holds up to 500 total items and the pack up to 200; transfers reject missing inventory, invalid quantities or overcapacity.
- Dropped goods are stored with a world-minute origin and 360-world-minute expiry. A local player within one cardinal tile may collect each pile once. World ticks remove expired piles even when nobody has the webpage open, provided DK Server is running.
- The existing `GET /api/v1/bank/box` includes stored goods as `items` alongside letters. `GET /api/v1/living` returns the public ground-item positions and counts for drawing minimal pixel markers. Actual server save and event archival remain behind the existing single-writer queue.
- `tests/storage-m9.cjs` adds bank balance, location, closed hours, validation, one-time item collection, world-time decay and HTTP persistence contracts. No internet-hosted process exists and public APIs remain loopback-only.

## M10: World entity identities, physical containers and sectors

**Identity:** `server/entity-registry-m10.cjs` independently implements serial IDs (e.g. `ent_53`) for active and retired character/NPC/monster/fixture/ground references and persistent item stacks. The same stack keeps its serial on a full transfer; a partially separated quantity gets a new serial. The monotonic serial counter is saved alongside the world. No RunUO GPL implementation or asset is copied.

**Ownership and migration:** Item records track `parent` across `pack_1`, `vault_1`, `hand_1`, `light_1`, `chest_village_1`, and existing ground pile IDs. On loading an older save, the registry is generated from the original M9 counts. Subsequent M5–M9 actions reconcile their count changes with existing serial records. Source and destination quantities are checked for consistency before saving; the M9 format remains a compatibility view, not a second authoritative inventory. The chest at Village (54,105) has a 64-item capacity and retains distinct item serials. Banks remain accessible only in person while open. Full moves preserve identity; split moves create a new serial for the separated quantity. Item state and world-event history are written through the existing single-writer atomic commit.

**Sector index:** `server/sectors-m10.cjs` builds a derived 16×16-tile spatial index for each independent map's actual dimensions. It indexes nearby characters, NPCs, monsters, map fixtures, world drops and chest markers. The sector map is rebuilt on world revision change and is **not** an independently saved state. Its server-controlled query is limited to the single player's current area, a maximum Manhattan radius of 16 tiles and strictly validated coordinates. This is a foundation for later interest management and NPC activation; it does not suspend autonomous simulation.

**API additions:** `GET /api/v1/nearby?radius=8` returns the player's local sector and nearby entity summaries. `GET /api/v1/entities/items` returns only owned pack/equipment items plus vault and chest items when physically accessible. The existing `POST /api/v1/gameplay` now supports `{"action":"move_item","serial":"ent_50","quantity":1,"destination":"chest_village_1"}`. Destinations include pack, vault, chest, hand, light and ground, subject to type/capacity/proximity checks. Existing bank-box reads now return the M9 item-vault counts, and living-world reads return persisted ground piles for the outdoor renderer.

**Regression coverage:** `tests/entities-m10.cjs` and `tests/sectors-m10.cjs` cover safe M9 migration, serial stability, stack splitting, guarded transfers, no duplicate goods, sector boundaries, physical proximity, cross-region isolation and persistence on disk across server restarts. Full Node integration tests must run against a complete source checkout before a gameplay test release.

**Not yet available:** Public always-on hosted world; full UO persistence format, multiple item attributes/provenance, nested containers, housing deeds, regional sector sleeping and streamed interest subscriptions. Current DK Server remains loopback-only and the public static game has no connected backend.

## M11 durable world scheduler

`server/world-scheduler-m11.cjs` independently implements the architecture suggested by RunUO's `Server/Timer.cs`: saved due times, intervals, priorities, bounded deterministic execution, and a fixed handler registry. No GPL RunUO code was incorporated. Timers are **world-minute based**, part of the same atomic world save, and advance only while DK Server is running. Handler names and schedule parameters come from server code, never from HTTP requests or executable serialized functions.

Four jobs currently run: `postal_dispatch` each minute, `camp_rotation` each 90 minutes, `shop_restock` each 120 minutes, and `guard_payroll` each 360 minutes. The first three replace prior M5 inline modulo routines without changing player-facing postal/camp/restock behavior. Guard wages now debit the bank's business coins and credit living village guards, with a dated NPC-wages history event. Each task stores next due minute and successful execution count, so a server restart or duplicate invocation cannot replay the same minute. The existing world pause/resume mechanism freezes these tasks exactly as it freezes NPC simulation.

`GET /api/v1/schedule` provides a **read-only** inspection of the schedule and running state. The outdoor sidebar displays the nearest jobs. The route accepts no write operations. Legacy M10 saves are migrated with new due dates computed from their last simulated minute, not the current wall clock. The `tests/scheduler-m11.cjs` suite covers courier delivery, merchant restock, traveling camps, guard wages, idempotency, save migration, pause/resume and HTTP inspection.

**Limitations:** Four fixed jobs, not a full hierarchical/calendar scheduler. No user-supplied scripts, no dynamic NPC appointments yet, and no public hosted process. Sector activation and UO-style long-distance AI job scheduling remain future work.

## M12 NPC mobile possessions and corpses

`server/mobile-assets-m12.cjs` independently adapts the ownership and corpse-container concepts reviewed in RunUO `Server/Mobile.cs` and `Scripts/Items/Misc/Corpses/Corpse.cs`. All new NPCs receive a registered `npc_pack_<id>` container with a single small initial provision. The provision's server-issued `ent_...` item serial is preserved if the NPC later dies and the player recovers the item. NPC wealth is not duplicated: death transfers coins from the NPC record into a persistent corpse record; corpse looting transfers the same wealth into the player's wallet. NPC records remain dead and searchable as part of world history.

Deaths from survival and monster attacks now call the same idempotent corpse creation routine. The M10 sector index includes corpse markers. `GET /api/v1/corpses` returns only bodies physically within two tiles of the current character, with the contained items. `POST /api/v1/gameplay` accepts the allowlisted `{"action":"loot_corpse","corpse_id":"corpse_1"}`; the server requires a living, conscious character within one cardinal tile and sufficient pack space and gold capacity. The action is saved atomically, permanently removes the corpse, writes a dated history event, and retains each transferred item's serial. Looting twice and loot from a distance are rejected.

The world scheduler now has a fifth recurring job `corpse_cleanup` every 60 running world minutes. Corpses expire 720 world minutes after death, with removal of any unclaimed NPC goods and containers. Existing M11 scheduler saves acquire the new job without losing old due times or replaying previous jobs. Old NPCs are migrated safely, preserving their health, schedule, coins and other existing world state. The game remains single-player and locally authoritative; none of this means GitHub Pages now has a hosted DK Server.

`tests/mobile-assets-m12.cjs` adds regression cases for migration, NPC backpacks, corpse creation, looting, duplicate and remote access prevention, scheduled decay, item identity and HTTP persistence. The M11 scheduler tests were updated for the fifth job. Full Node integration still needs to be run in a complete checkout, although the new combined modules passed isolated functional checks.

**Unimplemented:** Player permanent death, heirs, probate, player-owned houses, crime/guard justice, individualized equipment damage, insurance, resurrection penalties, dynamic NPC generation, and a continuously hosted online process.

## v0.2.34 integration correction

The original v0.2.33 commit included mobile-assets modules and the outdoor UI but accidentally left `server/dk-server.cjs` at the pre-M12 route integration. v0.2.34 corrects that server entry point, activates `ensureMobileAssets` at startup, adds `GET /api/v1/corpses`, and includes read-only corpse markers under `GET /api/v1/living`. The backend remains build `local-m14`; this is a server-wiring correction, not a new major server milestone. Existing world files are not reset.

## M13 save-strategy and verification

`server/save-strategy-m13.cjs` provides a dedicated persistence layer inspired architecturally by RunUO's `Server/Persistence/SaveStrategy.cs` and `StandardSaveStrategy.cs`, with all code independently implemented. Existing writes keep the atomic fsync+rename discipline but are now routed through the one-authority save strategy. The module validates the entire world before writing and periodically stores SHA-256-verified checkpoints under the private server data directory's `snapshots/` subfolder. The first verified checkpoint is created at process startup, then generally after 25 meaningful world revisions, on explicit checkpoint request, and when stopping a running process.

Up to **five valid world checkpoints** are retained. Each has a companion `.sha256` checksum file. Invalid or incomplete backups remain observable as errors; the retention routine only deletes excess **validated** checkpoints, never files that cannot be verified. Failed secondary backups are reported but do not turn an already-completed primary world transaction into a misleading failed gameplay request. The backup health result is exposed through `GET /api/v1/save/status`. To request a verified checkpoint from the connected game, use `POST /api/v1/save/checkpoint` with `X-DK-Control: checkpoint`. It is still loopback-only and subject to the existing origin restrictions. Main Menu → Options displays verification status and a Save World Checkpoint control.

**No automatic rollback.** If the main `world.json` cannot be parsed or validated, the original refusal-to-start behavior remains, even when checkpoints exist. Manually authorized world recovery will be implemented separately because choosing an older save without consent would permanently alter a one-life world. This milestone does not include event-journal gap reconciliation or backups of the full unbounded NDJSON event archive.

`tests/save-strategy-m13.cjs` verifies backups, checksums, retention, refusal to overwrite invalid data, non-recovery on corrupt primary and the HTTP status/control boundary. Full test execution still requires a complete source checkout. No new art, MMO requirements or online hosting were introduced.

## M14 persistent skillbook

The independent `server/skills-m14.cjs` provides 10 profession skills with fixed-point values in tenths of a point, maximum 1000 each (100.0), total training cap 7000 (700.0) and three player-selectable locks: `up`, `down`, `locked`. At total cap, only an existing `down` skill with positive value can be reduced to permit another `up` skill to advance. Higher skills need longer simulated-world-minute gaps between gains. The same source/target cannot be used endlessly for rapid training; repeating it beyond three attempts inside 15 simulated minutes suppresses gains. This is independently implemented from RunUO's Skill/SkillCheck *concepts*, not copied GPL C#.

Old characters are upgraded in place: `herbalism`, `trading`, `tactics` and `survival` initialize conservatively from earlier experience counters, and all prior fields remain intact. The new `character.skillbook` is validated on every save. Skill increases are only triggered inside successful, server-validated gathering, crafting, food/bandage use, combat, commerce and trade-contract actions. A client cannot provide a skill level or gain amount.

`GET /api/v1/skills` reports the single character's training levels and lock settings. `POST /api/v1/gameplay` accepts the strict allowlisted `{"action":"skill_lock","skill":"mining","lock":"locked"}` transaction, which saves atomically and writes a dated journal event. An expandable panel in the outdoor game reads these values and can set Up/Down/Locked. As with M13, the local Node server is the only real world authority; GitHub Pages cannot advance the simulation.

Run `npm --prefix server test` against a full checkout for the added `tests/skills-m14.cjs` regression suite. The immediate module-level checks covered legacy migration, skill caps, lock atrophy, repeated-source throttling, three real gameplay professions, and a world-validating lock transaction. Full browser or Node end-to-end verification remains outstanding.

**Later RunUO slices:** More professions only when their in-world activities exist; skill-check success chances, skill-gated items, tool wear, NPC skills, spellcasting, justice and sector activation. Multiplayer remains a future possibility rather than an enabled mode.
