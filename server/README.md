# DK Server M22 | Physical NPC Harvesting and Deliveries (v0.2.44)

**Node.js 20+**, CommonJS, no external npm dependencies and no additional dashboard. This is the engine-free single-player authority for Demon Killer, presently **restricted to loopback**. The public GitHub Pages game does not have a deployed persistent backend.

## Lifetime and saved data

The process is launched in local development by `start-demon-killer.sh` and serves the normal Demon Killer game menu, temple, courtyard and village. The **browser can close while the server runs**. **Start Server / Stop Server** in the game Options resume or pause the whole world clock, saving the state without terminating the process.

`server/data/world.json` stores the character, regions, NPCs, businesses, territory, camp, mail, resources, run/pause flag and clock. The writer queue uses fsync plus atomic rename under a single-process lock. `server/data/world-events.ndjson` is an append-only long-term event record; the snapshot also retains the most recent 512 events. An archive-write error is logged; the world snapshot remains the authoritative state. Manual process shutdown pauses the world. An unexpected host outage does **not** manufacture time or NPC actions while the host is not running. Legacy M3/M4 data receives non-destructive missing-region, runtime and gameplay-field migration.

**One character slot** (slot 1), with no overwrite via New Game. Existing save files are not automatically deleted.

## Endpoints

All routes have the `/api/v1` prefix. The server serves game assets via an allowlist; no `server/data` or executable server sources are publicly served.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | DK Server build `local-m20`, online state and world running flag |
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

The original v0.2.33 commit included mobile-assets modules and the outdoor UI but accidentally left `server/dk-server.cjs` at the pre-M12 route integration. v0.2.34 corrects that server entry point, activates `ensureMobileAssets` at startup, adds `GET /api/v1/corpses`, and includes read-only corpse markers under `GET /api/v1/living`. The backend remains build `local-m20`; this is a server-wiring correction, not a new major server milestone. Existing world files are not reset.

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

## M15 village law and criminality

`server/law-m15.cjs` independently adapts the high-level RunUO concepts found in `Server/Region.cs`, `Scripts/Regions/GuardedRegion.cs`, and `Scripts/Misc/Notoriety.cs`. The populated village is guarded only while its territory belongs to settlers; the outdoor courtyard has no village-law enforcement. Recovered possessions from a deceased village resident trigger a corpse-theft case. The server checks living NPC positions within eight Manhattan tiles before treating the case as reported. Without an actual nearby witness, no warrant or fine is generated, though a private world-history event records the act. This is **not** omniscient crime detection.

A reported case adds a 12-gold fine, a 180-world-minute wanted period, 20 criminal heat and a small negative Town reputation change. The saved law store tracks cases, witnesses, citations and remaining fines. During server-world advancement, existing village guards can deviate from their normal routes to pursue a wanted living character using M10's cardinal pathfinding. Reaching the offender produces a citation and transfers actual available player gold into the Village Bank's funds. Unpaid fines cause a bounded nonfatal temporary hold penalty; this is **not** a fully built jail or court. No permanent character deletion is introduced.

`GET /api/v1/law` exposes the single player's legal standing and recent cases. `POST /api/v1/gameplay` accepts the validated `{"action":"pay_fine","amount":12}` transaction only at the open Village Bank, with real player funds. The outdoor sidebar displays fines, criminal heat and citations, plus a Pay Fine control. The existing serialized writer, verified save checkpoints and dated event archive preserve these changes. `tests/law-m15.cjs` covers visible/unseen crime, monster-held territory, money conservation, real guard intervention, valid restitution, invalid requests and HTTP persistence. Current module-level checks validated both witnessed and unwitnessed cases, physical fines, reputation changes and world-save integrity.

Further RunUO-like work must add theft of ordinary objects, guard reporting dialogue, NPC murderer/notoriety classification, legal ownership, jail rooms, bounties, trials, and true witness testimony. Single-player DK Server remains loopback-only and the GitHub Pages frontend remains a static preview.

## M16 district policy registry

`server/region-policies-m16.cjs` implements overlapping rectangular district policies with server-defined priority and canonical IDs, independently informed by RunUO's `Server/Region.cs` and `Scripts/Regions/GuardedRegion.cs`. Each area retains its original independent dimensions, and a higher-priority district supersedes a base residential district. The village currently has a guarded bank quarter, market, smiths quarter, north gate and residential fallback; the courtyard has Lilith's willow, temple grounds and homes. Monster occupation dynamically disables village guard status while keeping stable district IDs. Region policy is **not accepted from the browser**.

M15 saves receive `world.living.region_history` on startup and preserve character, business, crime, skill, NPC and item records. Character actions update `region_id` and persist `player.region.enter`/`player.region.exit` events, including through the temple door. Every world minute, the living-world simulator compares NPC locations against their previous district and saves one `npc.region.enter` event for each crossing, even if the player is logged out. The preexisting server event archive receives player crossing events through the same serialized write path. District history stays in the checkpointed world snapshot. Validation rejects fake or mismatched district IDs.

`GET /api/v1/region/current` returns the one current character's official district and the saved visit counts; there is no region-modification endpoint. The outdoor UI displays guarded/occupied/housing metadata. The existing M15 law code now consults tile-specific guarded status for corpse witnesses, wanted guard intervention and fine payment. This is the foundation for later distinct laws, property and dynamic guard jurisdictions, not a claim of full RunUO region scripting. `tests/districts-m16.cjs` adds policy, migration, event, entity-identity, validation and HTTP regression contracts. Full Node/browser integration testing still needs a complete checked-out project.

## M17: Physical house deeds and secured goods

`server/housing-m17.cjs` independently implements housing ownership inspired by RunUO `Scripts/Multis/BaseHouse.cs`, `Scripts/Multis/HouseSign.cs` and `Scripts/Regions/HouseRegion.cs` without copying their GPL code. Exactly ten real, variable-footprint `house` objects already present in the Courtyard and Village become saved title records. A record stores its original exterior ID, area, bounds, actual front-door tile, sale price, lawful owner (NPC/player/estate/vacant), private/public sign policy and immutable storage ID. Existing M16 worlds migrate these fields without altering exterior dimensions, NPC identities, item serials or character state.

Eight homes begin NPC-owned; two Courtyard homes are vacant. The one living player may buy **one** vacant home while at its doorway, if funds and the housing district allow. Purchases transfer price from the player to the Village Bank's business funds. Sales transfer half the price from that bank to the character, only if the home container has no goods and the bank has sufficient coins. Public/private access can be toggled by the owner. No client-supplied price, ledger transfer, title or interior state is trusted.

Every house has a distinct `house_store` container (64 total item capacity) in M10's entity registry. The existing `POST /api/v1/gameplay` `move_item` action can accept a destination `home_storage_<house_id>`, or retrieve an owned stored item into the backpack. Items retain their same M10 serial; partial transfers split stacks only by the existing rules. Server-side physical proximity and the deed owner are checked before reading or moving house contents. The container remains at the exterior door because **actual interiors have not been built yet**.

`POST /api/v1/gameplay` also supports `{"action":"buy_house","house_id":"courtyard_house_se"}`, `{"action":"sell_house","house_id":"courtyard_house_se"}`, and `{"action":"set_house_public","house_id":"courtyard_house_se","public":true}`. `GET /api/v1/housing` exposes only nearby title summaries and the player's known home. NPC deaths update a house title to an unsettled estate, rather than deleting the building, automatically selling it or transferring it to an invented heir. This is groundwork for future wills, family ownership, estate courts and house interiors, not a completed property-trading MMO.

`tests/housing-m17.cjs` covers old-save migration, original building dimensions, real money conservation, item serial identity, locked house access, one-home cap, corpse-to-estate transition and persisted HTTP deeds. Functional module checks passed; complete Node/browser suites require a full repository checkout and remain unverified. House icons are primitive original Canvas signs; no third-party sprites are introduced.

## M18 vendor containers and sale provenance

`server/vendors-m18.cjs` independently implements the vendor-stock organization inspired by RunUO's `Scripts/Mobiles/Vendors/BaseVendor.cs` and `Scripts/Mobiles/Vendors/SBInfo/SBInfo.cs`; no RunUO GPL code is used. Five merchandise businesses (bakery, smithy, village market, tavern and courtyard market) now each own a private `vendor_stock_<id>` container in M10's server-authored entity registry. The Village Bank's product string `bank` is a service and is deliberately excluded from physical merchandise. Existing numerical `business.stock` remains a compatibility view of the merchant's primary product. New `business.other_stock` separately stores secondary commodities accepted from players; those goods never inflate primary stock.

The existing `buy` gameplay action lowers a vendor's primary-product count and raises the player's actual inventory count, so the serialized entity reconciliation transfers item serials when possible or splits stacks on partial movement. The existing `sell` action now distinguishes a shop's primary product from secondary goods and rejects excess quantity above the 500-item capacity, preserving actual item types and one-time transactions. The merchant's *personal* `npc_pack_` container remains separate. No new player inventory format or third-party artwork is required.

At world initialization or migration, `ensureVendors` creates the five merchant containers; M10 reconciliation instantiates or reconciles their actual commodity quantities before validation and durable save. World-minute restocking is limited by the vendor's total occupied storage capacity. The legacy background customer sale simulation still represents **offscreen customer demand** and does not yet create an item for a specific NPC recipient. Physical trade from NPC to NPC, supply shipments, vendor provenance, warehousing, markup and per-item store pricing will be independent later milestones.

`GET /api/v1/vendors` returns current-area nearby merchant stock summaries only, and the outdoor sidebar displays the closest store's available products and secondary goods. Clients cannot mutate vendor stock through the read endpoint or transfer from a store as though it were their own bank. `tests/vendors-m18.cjs` covers migration, commodity separation, item serials, capacity, restocking and HTTP durability; module-level integration tests passed. The complete Node/browser suite remains to be run against a full checkout.

## M19: Actual autonomous customer transactions

`server/npc-commerce-m19.cjs` independently adds saved shopping goals and a server-owned item transfer engine to DK Server. On a world-time cadence, eligible shoppers (currently village guards and wandering caravan NPCs) choose a nearby, open food merchant they can afford. Their existing M6 cardinal pathfinding takes them to the real storefront. The sale occurs **only when the NPC arrives**, the vendor is open, the business has physical M18 merchandise, and the NPC has enough coins and backpack capacity. One item serial passes from the vendor stock container to that NPC's M12 personal pack, splitting an existing stack if necessary. The payment moves from NPC coins into business coins with no fabricated money, and the transaction is dated in the authoritative event journal as `business.trade` with buyer ID, vendor ID and item serial.

The old M5 periodic anonymous business sales are removed. Existing shop-open/close calculations and M11 scheduled supplier restocking continue, now supporting real NPC customer transactions instead of assuming an invisible customer buys goods every quarter hour. NPC survival no longer spends a coin to reduce hunger without providing food; `npc.food.eaten` events represent actual consumed `bread`, `produce`, `meals` or `rations` from personal inventory. World state, shopping goals, item transfers and food remain in the same single-writer checkpointed snapshot. `GET /api/v1/npc-commerce` provides a read-only summary of completed purchases and active shoppers; the outdoor UI displays it.

`tests/npc-commerce-m19.cjs` covers world migration, NPC movement to a store, physical purchase and coin conservation, provenance of the item serial, food consumption without extra money, no remote purchases, world pause and persistence through server restart. A combined 90-minute world simulation confirmed a live North Guard purchase at the Village Market, with real produce in his backpack. The complete Node/browser suite is still unverified in a full checkout.

**Limits:** Only selected existing residents plan these shopping trips. Suppliers remain abstract scheduled deliveries, not yet physically represented cargo. Not all customers, food sources, professions or relationships are fully simulated. No change to single-player character slots, engine-free rendering or online hosting.

## M20: Work performed from real material stocks

RunUO `Scripts/Engines/Craft/DefBlacksmithy.cs` and `DefCooking.cs` provided **architectural inspiration only**, not code. The independent `server/workshops-m20.cjs` defines three allowlisted NPC production recipes: Village Smithy consumes 2 ore + 1 wood to make 1 tool; Village Bakery consumes 2 produce to make 2 bread; Village Tavern consumes 2 produce to make 1 meal. Each recipe requires the actual shop to be open in a settler-controlled district, its living owner to stand close to the physical shop, sufficient secondary M18 merchandise inputs, free capacity in the 500-item storeroom, and 2 business coins for the worker's wage. A completed batch removes real input item serials from `vendor_stock_<id>`, creates a new serial for the output item, increments main product stock, credits the worker's actual wallet and debits the business. The world event includes input IDs and quantities, output ID, worker, business, wage and world minute.

M11 now schedules the `workshop_batch` task every 120 running world minutes with priority 0, ahead of other recurring activities due at that minute. M11's old abstract restock mechanism **does not create finished goods** for these three production businesses. The markets still receive existing scheduled supply deliveries; genuine NPC crop growth, forage transport, physical raw cargo and caravan logistics remain separate future milestones. M17–M19 world records migrate without inventory, gold, NPC or world-history resets, and M10 validation reconciles the physical shop serials to their typed counts. The outdoor page shows production totals and a read-only `GET /api/v1/workshops` lists the recipes and output counts. There is no client-controlled production transaction or access to arbitrary jobs.

`tests/workshops-m20.cjs` checks migration, smithy, bakery, tavern, wage conservation, material identity, unavailable workers/ingredients, occupied territories, scheduled execution, corruption and HTTP persistence. Older M11 and M18 timer/restock tests are updated for the sixth scheduled job and the end of phantom deliveries to workshops. Combined module simulation passed four produced units, paid wages and proper market restocking; full Node/browser suite is still unverified without a complete runnable checkout. No new art, MMO code, online hosting or permanent player-death behavior was added.

## M21 behavior state, threat sensing, and defense

`server/mobile-ai-m21.cjs` implements five durable NPC states (`work`, `flee`, `defend`, `recover`, `dead`). NPCs sense real M8 imps up to seven cardinal tiles away every five world minutes. Non-guard civilians search a bounded set of reachable cardinal tiles and choose a safer escape destination. Guards and caravan escorts route toward threatening imps and use the existing server-owned combat system. No arbitrary client AI commands or new browser timers are added.

After the threat disappears, NPCs recover for thirty running world minutes and then resume their ordinary home/shop/travel schedules. Fleeing shopkeepers suspend business, and customers postpone M19 transactions during combat. State changes create dated world-history events. M20 worlds receive NPC AI records non-destructively on load, with dedicated schema validation in `validateWorld`.

`GET /api/v1/npc-ai` is read-only and discloses only NPCs within ten cardinal tiles of the character, not the entire map. The outdoor sidebar presents fleeing/defending counts. `tests/mobile-ai-m21.cjs` covers migration, physical escape, guards, calm-time return, save persistence, bounded reads, corruption and HTTP method restrictions. Focused JS module checks and earlier M19-world integration passed; the complete Node/browser suites were not run in a full checkout.

RunUO's `Scripts/Mobiles/AI/BaseAI.cs` supplies architectural inspiration only; no GPL code is included. The public GitHub Pages site still cannot host a persistent server.

## M22 real resource paths and item custody

`server/npc-harvest-m22.cjs` creates a saved collection/delivery goal for three existing residents: the Village Market Vendor (new produce plot), Traveling Herbalist (existing courtyard herbs) and Blacksmith (existing ore/wood patches). Goals survive world saves and may span several world days. All routes use the existing cardinal `npc-navigation-m6.cjs` pathfinder with real area sizes, walls and collisions. Resources are harvested only while physically within one tile, decrement the shared finite M5 resource patch, and create an M10 item entity in the worker's own M12 backpack. Delivery requires being within one tile of that business's real door and transfers the **same serial** to the existing M18 vendor stock container. Stock counters and item records stay reconciled; ore and wood become M20 workshop input rather than magically finished tools.

The source node is shared with player gathering. A new `village_produce` resource patch is initialized at (80,73) in the Village's existing 128×128 scene (a checked walkable grass tile). Producer work is suspended whenever the M21 NPC AI is fleeing, defending, recovering or the territory is monster-occupied. Store opening rules now require the owner to be alive, safe, within six tiles of the registered storefront, and operating in daylight. The existing M20 workshop recipe still requires its worker within four tiles. Scheduled wholesale purchases remain separate and are not advertised as physically gathered supplies.

`GET /api/v1/npc-harvest` is read-only and reports saved harvesting/delivery counts and player-nearby goals, not hidden distant locations. `tests/npc-harvest-m22.cjs` includes M21 migration, finite resources, item custody, smithy raw material inputs, danger interruption, world time simulation and HTTP method checks. A focused JavaScript physical item transfer test passed; the full Node and browser suites remain unrun in this environment.

No RunUO GPL code was reused; the design was independently informed by Ultima Online's resource harvesting and vendor stock systems. The public GitHub Pages preview still cannot run an always-on server.
