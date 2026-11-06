# DK Server M10 | Persistent Entity Registry and Spatial Sectors (v0.2.31)

**Node.js 20+**, CommonJS, no external npm dependencies and no additional dashboard. This is the engine-free single-player authority for Demon Killer, presently **restricted to loopback**. The public GitHub Pages game does not have a deployed persistent backend.

## Lifetime and saved data

The process is launched in local development by `start-demon-killer.sh` and serves the normal Demon Killer game menu, temple, courtyard and village. The **browser can close while the server runs**. **Start Server / Stop Server** in the game Options resume or pause the whole world clock, saving the state without terminating the process.

`server/data/world.json` stores the character, regions, NPCs, businesses, territory, camp, mail, resources, run/pause flag and clock. The writer queue uses fsync plus atomic rename under a single-process lock. `server/data/world-events.ndjson` is an append-only long-term event record; the snapshot also retains the most recent 512 events. An archive-write error is logged; the world snapshot remains the authoritative state. Manual process shutdown pauses the world. An unexpected host outage does **not** manufacture time or NPC actions while the host is not running. Legacy M3/M4 data receives non-destructive missing-region, runtime and gameplay-field migration.

**One character slot** (slot 1), with no overwrite via New Game. Existing save files are not automatically deleted.

## Endpoints

All routes have the `/api/v1` prefix. The server serves game assets via an allowlist; no `server/data` or executable server sources are publicly served.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | DK Server build `local-m10`, online state and world running flag |
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
