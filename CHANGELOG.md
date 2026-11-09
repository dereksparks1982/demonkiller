## v0.2.71 / M73 | 2026-11-08 | Real character and autonomous atlas NPC foundations

- Added `server/world-actors-m73.cjs`: the real saved slot-one character can enter the 9,216² green atlas and cross Streaming Cell boundaries while retaining their name, inventory, skill progression and entity identity. Atlas coordinates, facing and steps live on the character record, not a separate surveyor.
- New development atlas-character creation uses the existing character pipeline, then temporarily starts living in the atlas rather than replaying the retired temple opening. Existing characters can enter without duplication. The old `area_id` remains a temporary compatibility field for other systems, not a finished gameplay migration.
- Atlas NPCs are named, individually persisted scouts, guards, foragers and workers. Bounded NPC patrols advance on the persistent server clock independently of the browser, and workers currently remain at their chosen sites. No automated settlements or NPC production economy yet.
- Added collision between the real atlas character and NPCs; fine tile paints and broad ocean/cliff brushes prevent impassable terrain from swallowing them. Cardinal movement uses the same terrain material and elevation authority.
- Added allowlisted `GET/POST /api/v1/world/actors` routes for new development character, entering, stepping, adding NPCs and removing NPCs, with serialized durable server saves. Existing M72 traversal source remains separately available for regression tests.
- Added connected `dk-world-explore-m73.html` with existing 32×32 sprites and simple pixel ground. WASD/arrows/RMB walking, ground inspection and deliberate NPC placement/removal are integrated with DK Architect's WALK HERE and the main-menu Living World entry.
- Main-menu Options includes **RESET DEVELOPMENT WORLD**, requiring the user to type `RESET WORLD`, using the existing revision-checked reset endpoint. No development data was reset automatically; future builds can make clean schema breaks without elaborate save migration work.
- Nine focused M73 regression contracts cover player identity, NPC clock movement, occupied terrain, malformed commands, browser integration, API persistence/restart and reset. Isolated source-level smoke tests passed, while the full Node suite and browser interaction remain unverified.
- Detailed development notes and limitations remain in `docs/`; no new 3D or generated world artwork.

## v0.2.70 / M72 | 2026-11-08 | Walk the user-painted world

- Added a server-owned walking surveyor across the full 9,216 × 9,216 flat grass atlas, persisting global position, direction and steps without materializing thousands of regions.
- A bounded 25×25 tile view streams actual authored ground and signed elevation. Cardinal movement crosses 128-tile Streaming Cells, blocks water/cliffs/steep slopes and does not wrap at world edges. Unbuilt blueprint drafts do not physically obstruct walking.
- GET/POST `/api/v1/world/walk` perform validated loopback-only placement and one-step movement through the existing durable writer. Existing saves and terrain strokes remain intact.
- Added a simple 2D browser walking view using existing original 32×32 human sprites, WASD, arrow keys, held RMB movement, LMB terrain inspection, and an editor **WALK HERE** button. No generated art, 3D or image smoothing.
- Whole-cell and fine material brush operations protect the surveyor from being buried in impassable terrain; editor previews and native RPG character state remain separate for now.
- Added 10 test contracts, updated README and development handoff, and recorded limitations in `docs/releases/M72.md`. Isolated V8 movement and terrain tests passed; full Node and browser tests were not run.
- The walking surveyor is an **authoring/traversal prototype**, not yet the full legacy character/NPC/combat system connected to the replacement world.

## v0.2.69 / M71 | 2026-11-08 | Flat green default world

- The entire new **9,216 × 9,216 tile world** now starts as **flat grass at elevation 0**, including coordinates temporarily overlapping old M68 wilderness samples in the atlas. No oceans, mountains, rivers or settlements are automatically generated into the replacement atlas.
- Authoritative `world_grid.terrain.defaults={material:'grass',elevation:0}` is attached to newly created and migrated worlds without erasing existing painted cell materials, per-tile overrides, heights or building drafts. Older terrain ledgers without the field upgrade safely and validation enforces the baseline.
- DK Server terrain inspection and atlas viewport return grass/zero for every untouched valid coordinate. Exported JSON includes exact implicit defaults so geography can be reconstructed without serializing **84,934,656** grass tiles.
- Whole-cell grass painting removes a prior ocean/biome fill, restoring default land with reversible undo. Fine grass paint over cell-filled water creates only necessary overrides; identical/default fine paints and height-zero restoration do not create redundant entries.
- Corrected atlas coverage: base grass represents the unedited world, water counts painted bodies, and authored versus inherited tile counts stay distinct. Fine terrain materials and height-only edits are counted.
- The DK Architect World Pixel Painter clearly labels the flat green starting plane while retaining intentionally simple pixel art, right-drag panning, left-drag painting, zoom, server autosave and export.
- Added M71 tests for world corners, all zoom levels, coverage, ocean-to-grass rollback, tile/elevation edits, save migration/validation, browser integration and API export/restart. Updated M69/M70 regressions to expect grass instead of an empty atlas.
- **Legacy caveat:** The separate temporary M68 playable outdoor prototype may still display its older procedural floor art; connected gameplay streaming of new atlas tiles, terrain-driven elevation/movement and hydrology are not completed in M71. No new artwork or prefabs.
- Isolated JavaScript/V8 cross-module checks passed; complete Node regression and visual browser tests still require a source checkout.

## v0.2.68 / M70 | 2026-11-08 | DK Architect whole-world pixel painter

- Built the first whole-atlas **DK Architect World Pixel Painter** for all 9,216×9,216 logical tiles (72×72 Streaming Cells), with a direct launcher from main menu Options / persistent server and from the in-game F8 Logistics panel.
- Matched the existing 32×32 NPC pixel language with a coarse, intentionally simpler-than-UO terrain representation: hard-edged flat-color blocks, no antialiased terrain imagery, high-detail textures, predesigned map backgrounds or new artwork.
- Added configurable eight-step zoom from entire world (128 tiles per display square) down to individual ground tiles, global right-mouse pan, left-drag rectangular whole-cell and fine material painting, terrain elevation edits, undo/redo, on-demand server export and ocean coverage counter.
- Added sparse `world_grid.terrain.cells` as a backward-compatible M69 ledger field, rather than allocating 85 million terrain tile objects. A single atomic `fill_cells` operation can paint up to all 5,184 Streaming Cells; fine 16×16 sector overrides retain precedence.
- Added authoritative `GET /api/v1/world/terrain/atlas` and `GET /api/v1/world/terrain/coverage`, plus revision-checked `POST /api/v1/architect/world-atlas` using the same durable serialized server writer as M69. Full JSON exports now include whole-cell fills.
- Impassable broad brushes skip occupied/protected temporary M68 cells without canceling all safe cells. Skipped positions are returned to the editor.
- Added M70 server, pixel painter, coverage, undo, world export and security regression tests. V8 isolated tests passed one-third-ocean fill, restore, tile override and viewport. Full Node regression and browser end-to-end still require local execution.
- No change to old temple/courtyard scenery, 2.5D game renderer, permanent server hosting, river hydrology or autonomous city simulation.

## v0.2.67 / M69 | 2026-11-08 | Authoritative world terrain painting and documentation reorganization

- Expanded the replacement world's coordinate bounds to 9,216 × 9,216 tiles (72 × 72 Streaming Cells, 576 × 576 detailed 16-tile sectors), including non-destructive migration of legacy 4,096 × 4,096 grid records.
- Added sparse world-terrain edit persistence for terrain types and signed elevations, supporting painting, raise/lower, flatten, smooth and exact previous-overrides restore. Brush operations validate all tiles before applying any changes and reject stale server revisions and obstructed footprints.
- Added revision-checked, serialized and checkpointed world-terrain mutations in DK Server, read-only per-sector inspection, full sparse world export and optional cell-scoped export. Materialized wilderness areas update their authoritative floor data for collision and renderer refresh; unmaterialized regions remain sparse, not invented playable land.
- Added the Landscape menu to the existing DK Architect toolbar, with paint and height tools, immediate server auto-save per completed stroke, undo/redo, export, and robust right-mouse pointer-capture map panning. No fabricated save behavior for the static GitHub Pages preview.
- Fixed DK Server's static allowlist so the M68 wilderness-terrain script can load in the connected browser.
- Moved technical README history into docs/history/, replaced both READMEs with concise player and operator guides, and added comprehensive world and feature roadmap, source handoff and release notes.
- Added M69 tests for boundaries, terrain paint/collision, height edits, persistence, export, stale edits and editor/server contracts. Full Node suite and live browser interaction require verification in a checked-out environment.
- No new images, premade buildings, whole-world raster allocation, public hosting or fully implemented 2.5D terrain renderer.

## 0.2.66 | M68 (2026-11-08)

- Replaced the previously populated outdoor courtyard with wooded temple grounds. Retained only the temple exterior and Lilith's willow; removed the courtyard homes, stalls and old gateway.
- Retired the old village's physical street and building geometry and disconnected the old village from player travel. Legacy server economy and NPC state remain quarantined until migration.
- Materialized four true top-down 128×128 wilderness regions (65,536 walkable/blocked tile positions) from M67's 4096×4096 world grid. Ocean, beach, forests, highlands, glacier, mountains, rivers, marsh and bridges are now actual ground tiles.
- Added boundary-accurate cardinal world traversal, an entry path from the temple grounds and consistent 16×16 sector-stream geometry.
- Matched live Streaming Cell IDs to M67's `dk.cell.world.<column>.<row>` addressing. Generated visual tiles are identical in the browser and server.
- Introduced three physical overhead work-camp sites (timber, quarry, marsh), without generating their future workers or economy yet.
- Added eight regression tests for preservation, geography, terrain boundaries, world-grid IDs, actor movement and browser integration.
- Preserved M67's blank unallocated map-plan and building draft registry. No new raster world-map image.

## 0.2.65 | M67 (2026-11-08)

- Introduced a clean 4096 × 4096 global world-grid model, partitioned into 16-tile sectors and 128-tile Streaming Cells, without importing the retired temple, courtyard or village scenery.
- Added cardinal coordinate stepping, adjacent-cell addressing and cross-boundary building draft placement with strict geometry and overlap validation.
- Added persisted, empty world-grid metadata and non-destructive migration for older saves.
- Added read-only world-grid diagnostics and focused M67 regression tests. Legacy browser scenes remain available only during migration; no new art or replacement scene was created.

# Demon Killer Changelog

## v0.2.64 / M66 | 2026-11-08 | Real-material reconstruction of ruined settlements

- Sieges now damage actual village/courtyard business sites and immediately close them; each region has saved site integrity, repair history, work orders and recorded losses.
- Worker-owned rebuilding jobs acquire two wood and one tool from existing serialized vendor inventory; real workers carry the same serials to the site through cardinal navigation before 30-minute, paid labor restores 25 structural points.
- Businesses pay the supplier's configured prices and six gold labor wages; suppliers and employees receive the transferred coins. No free material replenishment or imaginary repair crews.
- Player-owned businesses respect assistant service and pricing choices; an NPC harvester completes active timber gathering before beginning reconstruction supply runs.
- An occupied town, unpaid wages, unavailable supplies, closed/uncrewed source or dead workman can halt the job. Missing cargo is not fabricated; dead workers' freight stays under its last real custody.
- Rebuilt structures are required for normal shop opening, manual smith/bakery/tavern work, milling and M65's restored-peace outcome. M50 equipment repairs remain distinct.
- New read-only `GET /api/v1/reconstruction`, strict legacy-save migration/validation and 14 M66 regression contracts. Updated the M65 campaign test to account for real building repairs.

## v0.2.63 / M65 | 2026-11-08 | Integrated siege simulation and per-minute clock correction

- Fixed the authoritative world clock during multi-minute catch-up: each minute is recorded **before** running NPC, combat, guard, refugee, traffic, commerce, and scheduler systems. Frozen batch endpoint avoids extending the loop accidentally.
- Added a world-minute drift assertion, preventing silent de-synchronization when future systems are added.
- Added persistent two-region settlement campaign records showing occupation, liberation, rebuilding and peace, alongside dead/displaced resident counts, defenders, active monsters and open shops.
- Recovery requires 90 safe minutes, every surviving resident returned, and a genuinely operating business; no fake recovery, gold, NPCs, goods or teleportation.
- Campaign records tolerate direct player-led liberation between scheduled ticks. They catch up when simulation resumes without blocking world saves.
- Corrected guard medical purchase eligibility so an absent/dead employee cannot dispense stock merely because a shop's open flag is still true.
- Added nine M65 cross-system regression contracts and read-only campaign diagnostics, without new artwork or on-screen buttons.

## v0.2.62 / M64 | 2026-11-08 | Collision-aware NPC traffic and blocked gate arrivals

- NPC route selection now checks actual occupied tiles by living players, other NPCs, monsters and companions. Ghosts remain intangible. Every allowed step remains cardinal.
- Cross-region portals validate their destination tile's occupancy. Congested streets get legal detours, gates wait if blocked, and actors stop beside rather than on top of occupied targets.
- Added durable per-NPC movement/blocked-step records and throttled traffic-jam events, all tied to exact world minutes.
- New residents receive separate traffic records, while legacy M63 worlds migrate without losing characters or world history.
- Read-only `GET /api/v1/traffic`; nine focused test cases for crowd avoidance, gate queues, duplicate ticks and save validation.
- Existing M61–M63 guards, garrison care and refugees retain their behavior, with safer movements. No visible toolbar, imported assets or cutscene changes.

## v0.2.61 / M63 | 2026-11-08 | Civilian evacuation and homecoming

- Saved per-NPC refuge status: home, evacuating, sheltered, returning, stranded or lost. Occupied towns trigger real journeys over the existing cardinal navigation and inter-region portals.
- Refugees get unique legal camp destinations in a safe neighboring region. There are no fabricated "safe" areas and nobody teleports at the moment of an invasion.
- Civilians wait for 90 consecutive world minutes of restored home-region safety before traveling home. If both regions fall, they shelter in place and remain vulnerable.
- Guards/escorts and caravan activities retain their existing duties. Displacement persists and affects worker proximity to shops, commerce and mills.
- Eight tests cover migration, real movement intent, camp uniqueness, stable safety windows, stranded civilians, death and historical counters.
- Read-only refugee endpoint. No client-side world authority, new sprites or HUD controls.

## v0.2.60 / M62 | 2026-11-08 | Resource-backed garrison medical care

- New saved garrison care records: treatment timing, spent coins, healing totals and patients, with idempotent migration.
- Wounded guards and escorts can travel to an open market/tavern using existing cardinal routing, obtain paid treatment only while physically near a staffed storefront and consume real bandages, meals or herbs from stock.
- The same unique item serial ledger and shop gold balances change as an atomic server transaction. Player-run stores are not bypassed.
- War damage and settlement occupation can suspend recovery. No free healing, infinite supplies, war-mode changes, HUD buttons or new art.
- Eight regression contracts cover economy, medical supply depletion, migration, cooldowns and invalid/stale state.

## v0.2.59 / M61 | 2026-11-08 | Active settlement guard watches

- Moved guard offense out of the monster turn loop and into one world-owned, exact-once defensive pass per combat interval.
- Persistent NPC sentry records track alarm targets, alarms, strikes, kills and action timestamps. Guards sound local alarms, share threat sightings, follow cardinal paths, and defend towns without player presence.
- Wounded guards do not blindly attack. Successful guard kills use ordinary physical remains, loot and territory liberation, including M59 spawn suppression.
- Backward-compatible M60 world migration; strict validation and a read-only diagnostic endpoint.
- Added seven M61 regression contracts covering migration, alarm, combat, repeat ticks, corpse/territory effects, wounded response, NPC succession and HTTP wiring. No imported RunUO implementation.

## v0.2.58 / M60 | 2026-11-08 | UO keyboard controls and persistent combat behavior

- Tab/Alt+C toggles a saved character War/Peace stance across temple and overworld; double-clicking a creature attacks only while the browser is in War Mode, otherwise inspects. T selects nearest hostile; L attacks last target.
- Mapped Alt+P/I/K/J/R/S/B/O/X, Alt+D backpack alias, Alt+Enter fullscreen and ? reference. Added keyboard-only windows and a small non-button stance status badge; kept P/I/C/B/F8 and cardinal movement intact.
- Added per-monster behavioral memory: visible-target pursuit, blocked-line-of-sight awareness, limited searching, injury retreats, home-bound return and deterministic patrolling.
- Monster intelligence state migrates alongside M59 spawners and persists with each world creature. A read-only inspection route exposes behavior without permitting client state edits.
- Added seven M60 regression cases for key mapping, war mode authority, save migration, AI and browser/server contract wiring.
- No new art, audio, cult script, Lilith transition or game-save resets. No GPL RunUO code imported.

## v0.2.57 / M59 | 2026-11-07 | Durable creature spawner controls

- Added four persisted regional creature spawners with exact-once world-minute dispatch, saved due times and regional population limits.
- Monster invasions seed one immediate bounded wave. Occupied regions receive species-rotating reinforcements every 90 simulated minutes, without spawning on crowded tiles.
- Ordinary wilderness spawns are gated by regional threat, remain under a population cap and use a 120-minute schedule.
- Liberating an occupied region persists a 120-minute grace period before enemies can reoccupy it through the spawner. Existing monster bodies and loot remain in world terrain.
- Spawn placement excludes player/NPC tiles and already-occupied monster positions. Existing M58 saves migrate non-destructively. Malformed spawner ledgers reject world validation.
- Added read-only server spawner diagnostics and focused M59 regression contracts. No new on-screen buttons or imported assets.

## v0.2.56 / M58 | 2026-11-07 | Original MIDI title and overworld soundtracks

- Added the exact owner-approved **The Land Beyond the Altar** overworld MIDI and the original dark title score **The Oath Beneath the Ashes** to `assets/audio/music/`.
- The courtyard, village and future outdoor regions use one looping score. The main menu uses its distinct funeral-organ, choir and bell theme instead of the old OGG menu loop.
- Added a standalone Standard MIDI / Web Audio synthesizer with tempo-aware looping, several period-appropriate instrument timbres, active-note cleanup, volume control, and browser gesture handling.
- Both tracks follow saved music preferences. The original temple organ track and temple cutscene logic remain untouched.
- Added M58 source, parser, page-wiring, menu, and loopback server regression coverage. Browser listening remains to be accepted by the owner.

## v0.2.47 / DK Server M25 | 2026-11-06 | Persistent caravan manifests

- Added a bounded server-owned manifest history for actual merchant journeys with unique trip IDs, cargo serials, simulated purchase/finish minutes and delivered/interrupted status.
- Older M24 worlds and active trips migrate idempotently; existing merchandise, merchant money, world events and cargo identities remain unchanged.
- Caravan status returns up to three completed or interrupted trip summaries without exposing the location of a distant active merchant.
- Added four focused regression tests covering successful delivery, interruption, old-save migration and invalid shipment records. Checked manifest transitions and fixed a duplicate-created-on-start bug before release.
- No changes to movement, item transfers, shop prices, player character slots, original pixel art or hosting.

## v0.2.46 / DK Server M24 | 2026-11-06 | Physical merchant caravans between settlements

- Implemented an independent, server-owned caravan job for the existing wandering merchant and escort. The merchant navigates from Village Market to Courtyard Market through cardinal tile routes and actual region portals.
- Transactions transfer two units of produce from Village Market to the merchant's physical backpack for four existing merchant coins, then to the Courtyard Market for six existing destination-shop coins. The same M10 item serial is preserved throughout; server-side stock, business funds and merchant profit are updated atomically.
- Caravan goals survive world restarts, stop/pause, and safe travel; living escorts, shop hours, owner staffing, terrain and territorial control are enforced. A dead trader or escort cancels the trip without deleting carried goods.
- M19 NPC shopping cannot redirect active caravans or consume shipment-reserved food. Normal NPC provisions remain usable.
- Added read-only nearby-only `GET /api/v1/caravans`, outdoor caravan progress text, safe M23 save migration and cargo-validation rules.
- Added `tests/caravan-logistics-m24.cjs` regression contracts. Standalone JS transport simulations passed for purchase, cross-region sale, stable serial, guarded physical transactions, funds and inventory conservation. Full Node checkout suite not yet run.
- No new art, no Godot, no additional player slot and no hosted persistent online server.

## v0.2.45 / DK Server M23 | 2026-11-06 | NPC succession and vacancy recruitment

- Added server-owned, validated settlement posts for ten essential village and courtyard roles. Each post remembers its current occupant, vacancy and appointment history. Existing M22 worlds migrate without resetting businesses, corpses or inventories.
- Added a seventh persistent scheduler job every 120 world minutes. Recruitment waits at least 120 world minutes after a death, respects monster-held territory and NPC-count limits, and transfers 12 real coins from the supporting business into the new resident's wallet.
- New replacements are distinct NPCs with their own immutable world identities, M12 backpacks, M16 district records, M21 behavior and starting locations; dead predecessors, possessions, history and corpses remain unchanged.
- The live owner of the affected business changes without duplicating its stock. The shop closes until the new owner reaches its actual counter.
- Updated M22 harvesting to resolve the *current* blacksmith, market vendor and herbalist by business owner ID, and M11's courier delivery to use the current post holder.
- Added nearby-only `GET /api/v1/npc-succession` status and outdoor worker-appointment reporting. Updated M11 scheduler tests and added focused M23 regression tests.
- Isolated JS checks passed for funded recruitment, identity uniqueness, repeat-hire prevention, forgery rejection, and successor market harvesting through real item serials. The full checkout Node integration suite has **not** yet been executed.
- RunUO spawner and spawn-entry behavior was studied for architectural guidance only. No GPL sources or artworks, extra character slot or public server hosting were added.

## v0.2.44 / DK Server M22 | 2026-11-06 | NPC harvesting, finite resources and shop deliveries

- Added saved NPC harvesting goals that take real market, herbalist and smithy workers to actual resource patches, collect a unit, and return to their storefront with a persistent M10 item serial.
- Added a finite village produce patch on an existing walkable grass tile. Workers consume shared, regenerating resource-node units also used by the player, and deposit real goods into vendor containers only after physical travel.
- Market produce and courtyard herbs increase available merchandise; blacksmith ore/wood goes to existing M20 workshop ingredient stock, not magically converted to finished products.
- Updated shop hours to close when a living shopkeeper is physically absent and to respect monster occupation and M21 fleeing. Saved harvesting pauses safely during threats and resumes when workers recover.
- Added read-only nearby work-trip reporting in `GET /api/v1/npc-harvest`, outdoor status text, non-destructive old-save migration, and `tests/npc-harvest-m22.cjs` regression contracts.
- Focused checks passed for resource depletion, real item serial custody, physical delivery and consistent shop counts. Full Node/browser integration testing remains outstanding.
- No hosted server, MMO, engine, new art or player permadeath was introduced.

## v0.2.43 / DK Server M21 | 2026-11-06 | Persistent NPC flight, guard defense and recovery

- Implemented independently authored RunUO-inspired mobile AI behavior modes with saved NPC identities, current threats and 30-world-minute recovery timers.
- Civilians move away from nearby imps using reachable cardinal-only escape paths; guards and escorts pursue imps so existing physical combat can protect inhabitants.
- NPCs resume their established routines after danger. Fleeing shop owners suspend operations and M19 shoppers delay physical purchases during combat; M20 paid ingredient-consuming workshops remain unchanged.
- Added startup migration, schema validation, the player-nearby read-only NPC AI endpoint, outdoor status text, regression tests, and versioned release documentation.
- Focused behavior checks confirmed flight, defense, recovery and validation. Full Node test suite and browser smoke tests still require a complete source checkout.
- No extra character slots, Godot, new art, permanent player death, multiplayer or online persistent hosting.

## v0.2.42 / DK Server M20 | 2026-11-06 | Physical NPC workshop production

- Added `server/workshops-m20.cjs` with actual server-owned smithy, bakery and tavern recipes. Crafting consumes stored ore, wood or produce, records physical input item serials and creates persistent output tools, bread or meals with fresh item IDs.
- Workshop work requires living NPC staff present at the real business, an open operating period, safe settler control, enough actual material stock and room in the storeroom. Each batch pays a saved 2-coin wage from business funds to the worker.
- Added a sixth M11 durable recurring job (`workshop_batch`, 120 world minutes). Stopped worlds pause production and jobs cannot replay already processed minutes.
- Removed abstract finished-goods supplier restocks for smithy, bakery and tavern. Market supplies continue temporarily through the existing scheduled supplier model; real farming and caravan cargo still remain future work.
- Added read-only `GET /api/v1/workshops`, outdoor production readout, `tests/workshops-m20.cjs`, and updated M11/M18 regression expectations. Module-level functional checks passed recipe, provenance, money conservation, missing-input and scheduled supplier scenarios. Full Node/browser integration remains unverified.
- Architecture independently influenced by RunUO's Blacksmithy and Cooking crafting recipe systems. No GPL source copied; still single-player and no hosted web backend.

## v0.2.41 / DK Server M19 | 2026-11-06 | Physical NPC customers and meals

- Replaced anonymous automatic merchandise sales with real NPC shopping goals, cardinal storefront travel and server-authoritative arrival/purchase checks. NPCs must be alive, physically nearby, funded and equipped with sufficient personal pack space.
- Shop purchases debit NPC coins, credit the business, reduce real M18 vendor merchandise and transfer a persistent M10 item serial to that NPC's M12 backpack. Shop history records buyer, vendor, item and payment.
- NPC survival no longer burns coins to make hunger disappear. A real food item must be consumed from the personal backpack, with a dated `npc.food.eaten` event, or hunger continues increasing.
- Shopping goals and purchase history persist as `world.living.npc_trade`. The world clock controls all movement and purchasing, and Stop Server freezes the process.
- Added read-only `GET /api/v1/npc-commerce`, outdoor customer activity status and `tests/npc-commerce-m19.cjs` regression contracts. Functional 90-minute server module simulation passed with a real guard buying produce. Full Node/browser suites are still pending.
- Continued independent RunUO-inspired mobile/vendor architecture without copying GPL code or claiming the static website runs a hosted persistent world.

## v0.2.40 / DK Server M18 | 2026-11-06 | Physical merchant merchandise

- Migrated five merchant primary-product stocks into individually identified M10 persistent merchandise containers without changing existing shop locations or NPC personal backpacks. Financial-service banking remains distinct from ordinary retail.
- Separated commodities purchased from the player into explicit type-specific secondary merchant stock, ending the prior error where selling ore or wood to a smithy increased its saleable tools count.
- Integrated item-serial-preserving purchasing and selling, strict 500-item vendor capacity, M11 restock limits, world validation and non-destructive M17-save migration.
- Added a read-only local `GET /api/v1/vendors` and outdoor inventory display with no new artwork. Existing buy and sell controls remain.
- Added `tests/vendors-m18.cjs` migration, serial, capacity, stock and HTTP regression contracts. Functional module checks passed for commodity conservation, buying, selling, stock restocking and world validation. Full Node/browser tests remain unverified.
- Architecture informed by RunUO BaseVendor/SBInfo only; no GPL implementation copied. Background customers and suppliers are not yet physically instantiated, and the project remains unhosted online.

## v0.2.39 / DK Server M17 | 2026-11-06 | Existing house deeds and persistent property

- Added server-owned titles, prices, ownership, home storage and sign access metadata for the existing four Courtyard and six Village house exteriors, preserving actual original building dimensions.
- Eight resident-owned homes and two initially vacant Courtyard homes. The single player may acquire one deed in person for actual saved gold, sell an empty house back for half value when the bank has funds, and toggle public/private title access.
- Added 64-item secure house containers to the existing persistent item registry, including owner and cardinal proximity checks. Whole item stacks retain their stable serial identities during movement between pack and home.
- NPC housing titles now enter unsettled estates on owner death. No invented heirs or automatic home destruction. Kept existing NPC backpack and corpse persistence intact.
- Added `GET /api/v1/housing`, three allowlisted title transactions through the existing gameplay endpoint, an outdoor property panel and simple original pixel house signs.
- Added `tests/housing-m17.cjs` contracts and updated versioned docs. Functional module tests verified gold conservation, identity stability, resale safeguards, access control and estate transition. Full Node/browser integration remains unverified.
- Referenced RunUO house/region architecture only as design inspiration; no GPL code copied. Remains single-player with no hosted browser backend or complete house interiors.

## v0.2.38 / DK Server M16 | 2026-11-06 | Priority districts and world location history

- Added a server-owned priority district registry across the existing variable-sized temple, courtyard and village. Regions include Lilith's willow, temple grounds, four village districts and residential fallbacks with housing and guarded metadata.
- Added persistent enter/exit event history for the single player and district-entry events for moving NPCs, including pathfinding movement while the web browser is closed and DK Server is running.
- Integrated M15 crime/guard protection checks with the actual district coordinates and monster-occupation state. A fallen village loses protected status without deleting its districts.
- Added `GET /api/v1/region/current`, an outdoor district readout, migration of old saves, and `tests/districts-m16.cjs` regression coverage. Module-level simulations passed player/NPC crossings, jurisdiction toggles, region validation and world save consistency. Complete Node/visual integration not yet run.
- The RunUO region concept was independently implemented in JavaScript; no GPL C# copied. One character, approved art, no fixed-size world restriction, and no online server hosting changes.

## v0.2.37 / DK Server M15 | 2026-11-06 | Guarded villages and witnessed crime

- Reviewed RunUO `Server/Region.cs`, `Scripts/Regions/GuardedRegion.cs` and `Scripts/Misc/Notoriety.cs` as architectural references. Implemented independent guarded-region, crime-case, witness and legal-status rules without copying GPL C#.
- Looting a villager's corpse in a functioning settler-controlled village can be witnessed by a living nearby NPC. Only *reported* crimes generate a 12-gold fine, a short wanted period, criminal heat and Town reputation loss. Unwitnessed actions still enter private world history, but guards are not informed magically.
- Existing village guards can pursue wanted characters across the actual cardinal grid. Guard intervention transfers available gold from the player to bank business funds, or issues a bounded nonfatal detention penalty when money is insufficient.
- Fine payment at the open Village Bank uses real money and clears the warrant when the debt is settled. Cases, citations, witnesses and outstanding debts persist with M13 checkpoint-backed world saves.
- Added `GET /api/v1/law`, `pay_fine` gameplay action, a simple outdoor legal-status panel, versioned docs and `tests/law-m15.cjs`. Combined module checks passed for reported/unreported theft, guard payment, bank restitution and world validation. The complete Node and browser test suites remain unverified.
- No multiplayer, fabricated hosting, jail interior, permanent player death, new artwork, or arbitrary criminal actions introduced.

## v0.2.36 / DK Server M14 | 2026-11-06 | Skills, training locks and professions

- Reviewed RunUO `Server/Skills.cs` and `Scripts/Misc/SkillCheck.cs` for the independent design of individual fixed-point skill ratings, training locks, caps, gain restrictions and anti-repetition rules. No RunUO GPL implementation was copied.
- Added ten server-owned profession skills: Herbalism, Lumberjacking, Mining, Trading, Blacksmithing, Cooking, Healing, Wrestling, Tactics and Survival. Every skill has a 100.0 maximum and all skills share a 700.0 total cap.
- Added Up/Down/Locked training and automatic atrophy of a player-selected Down skill when another Up skill advances at total cap. Growth slows at higher proficiency, and repeated use of the same target/location temporarily suppresses training.
- Wired skill gains only to successful server-authored gathering, crafting, trade, recovery, food use, rest, and monster-combat actions. No direct skill XP grants are accepted from browser requests.
- Existing M13 characters retain all world progression, legacy experience and inventory, with an idempotent non-destructive skillbook migration.
- Added read-only `GET /api/v1/skills`, strict `skill_lock` gameplay command, expandable outdoor skills/training controls, version updates and `tests/skills-m14.cjs`. Module checks verified migration, caps, anti-grinding rules, and actual gameplay integration with world validation. The full Node integration suite still needs a complete checkout.
- Single-player only. No new graphics, engine, additional character slots, hosted backend or premature spellcasting/crafting-profession claims.

## v0.2.35 / DK Server M13 | 2026-11-06 | Verified world save checkpoints

- Extracted authoritative saves into `server/save-strategy-m13.cjs` while keeping the existing single-writer queue and fsynced atomic world-file replacement. The strategy validates state before writing.
- Created automatically managed checkpoints with SHA-256 sidecar verification, schema validation and retention of five valid copies. Backups are created on startup/shutdown and at significant revision intervals.
- Added read-only `GET /api/v1/save/status` with primary save validity and verified/invalid backup counts, plus an explicit loopback-only `POST /api/v1/save/checkpoint` action.
- Integrated backup health and Save World Checkpoint into Options. The public GitHub Pages preview still reports no connected backend and does not attempt to fabricate a save.
- Preserved the one-life safety rule: a damaged `world.json` refuses startup even with valid older checkpoints, and no automatic world reset or history rollback occurs.
- Added `tests/save-strategy-m13.cjs` regression contracts for snapshot creation, checksums, corruption, revision intervals, retention and HTTP inspection. Full Node suite must run against the complete repository checkout.
- RunUO's save strategy was used only for architectural inspiration; no GPL code was copied. No new artwork or hosted server deployment.

## v0.2.34 | 2026-11-06 | M12 server integration correction

- Fixed the M12 release missing its `server/dk-server.cjs` mobile-assets integration. Ensures NPC backpacks at startup and publishes both nearby corpses and read-only corpse markers to the actual server routes.
- Restored compatibility with the outdoor corpse renderer and saved corpse loot transactions. The original v0.2.33 modules were already committed; their live server entry point is corrected here.
- Updated versioned docs and cache references, with no game artwork, world resets, hosted deployment or extra character slots.

## v0.2.33 / DK Server M12 | 2026-11-06 | NPC possessions and persistent corpses

- Added individual server-owned NPC backpacks and starter possessions with stable serial IDs, independently inspired by RunUO's Mobile/Corpse/Container architecture.
- NPC survival deaths and monster attack deaths produce durable corpses with the deceased's actual coins and existing inventory records. NPC wealth is transferred out of their living record; corpses and loot use immutable transaction authority and a permanent event history.
- A living player adjacent to a corpse can loot its goods and coins once. Validations prevent distant or ghost looting, forged rewards, over-capacity and duplicate claims. M10 item serials remain the same through the transfer.
- Added corpses to region sector lookups, original crude on-map markers, double-click and in-game Recover Nearby Body Goods control, and read-only `GET /api/v1/corpses` for nearby inspection.
- Added a fifth persistent job `corpse_cleanup` that removes unclaimed corpses after 720 running world minutes, on the next 60-minute cleanup cycle. Old M11 scheduler saves migrate without timer replay or NPC save loss.
- Added `tests/mobile-assets-m12.cjs` and updated the M11 scheduler suite for the fifth recurring job. Pure module tests passed for NPC provisioning, wealth conservation, stable item serials, one-time looting and decay. Full Node integration testing is pending a complete repository checkout.
- The game remains single-player. No MMO code, no permanent player death, no new art pack and no hosted persistent server were added.

## v0.2.32 / DK Server M11 | 2026-11-06 | Persistent scheduled-world jobs

- Added a durable, validated and idempotent world-time job scheduler with saved job IDs, priorities, intervals, next due minute, and execution counts. The queue is independent of browser timers.
- Migrated existing in-world postal delivery, traveling camp rotation and merchant restocking from ad hoc minute loops into recurring scheduled jobs, retaining the existing physical courier/bank-box requirement.
- Added village guard payroll every 360 simulated minutes: existing Village Bank business money funds guards' wages, generating permanent economic history events without money creation.
- Added read-only `GET /api/v1/schedule`, outdoor scheduled-events status, old-save migration, updated tests and documentation.
- Verified pure module-level integration for delivery at the bank, future timer execution, no duplicate firing, guard payroll, frozen world pause and resume without offline catch-up. The full Node checkout suite remains to be run.
- RunUO's `Timer.cs` was reviewed as architectural inspiration; no GPL source code was copied. The game remains single-player and loopback-only until persistent website hosting is arranged.

## v0.2.31 / DK Server M10 | 2026-11-06 | Persistent entity registry, containers and sectors

- **RunUO-informed independent design:** Added a typed world entity registry with stable monotonic serial IDs for item stacks, character/NPC/monster references, fixtures and ground items. No GPL RunUO code is incorporated.
- **Identity-preserving item transfers:** A complete item stack keeps the same serial when moved among the player pack, bank vault, equipped hand/light, a persistent village chest and ground. Partial transfers split into a new serial without multiplying item quantities. The village chest has a 64-item capacity and physical access requirements.
- **Non-destructive M9 migration:** Existing inventory, bank balances, world ground piles, NPCs and event history remain. M5–M9 gameplay count changes reconcile against serial-bearing items, and counts are asserted before committing authoritative gameplay saves.
- **16×16 sectors:** Added spatial lookup derived from real per-region dimensions, including the 16×16 temple, 64×64 courtyard and 128×128 village. Indexes NPCs, monsters, fixtures, ground items and containers with bounded player-centric queries. No new map-size restriction or diagonal movement.
- **New read APIs:** `GET /api/v1/nearby?radius=8` and `GET /api/v1/entities/items` give current-area and physically accessible data. Existing `POST /api/v1/gameplay` accepts a validated item-serial transfer command.
- **M9 integration repairs:** Server startup now migrates the M9 storage module; the bank-box endpoint returns item counts, and the living-world response includes ground drops for the renderer. These features were not fully exposed in the prior server release.
- **Client and testing:** Added simple chest drawing and controls, sector status, two targeted Node regression suites, server version and menu cache updates. Module-level simulations verified serial preservation, safe migration, sector geometry, chest access, wall-clock ticks and inventory conservation. The full Node integration suite still requires running in a complete checkout.
- **Boundaries:** No new artwork, no engine, no added character slots, no public hosted server, and no claim of completed UO-style sector activation or nested/individualized item property simulation.

## v0.2.30 / DK Server M9 | 2026-11-06 | Bank item vault and persistent ground goods

- Added a server-owned 500-item vault at the Village Bank. Goods deposits and withdrawals require the player to physically visit the bank while it is open; transfers update bank and inventory amounts in one atomic world transaction.
- Added persistent outdoor item drops, cardinal-distance pickup rules, item quantities, one-time collection, 200-item pack limits and expiry after 360 simulated running minutes. Item decay advances with the world, not the client's browser.
- Added basic original ground-item pixel markers, commodity and quantity selector, Drop/Pick Up controls and goods storage inside the existing bank-box view.
- Existing bank-letter and deposited-gold functionality remain intact. No separate inventory dashboard or new art pack was introduced.
- Added `tests/storage-m9.cjs` regression contracts for save migration, ownership, closed-bank rules, forgery, item decay, duplication prevention and HTTP persistence. Full Node integration run still requires a current checked-out source tree.
- Incremented DK Server build identity to `local-m9` and updated versioned release docs and frontend cache references. The public GitHub Pages game remains an unconnected browser preview, not an internet-hosted persistent server.

## v0.2.29 / DK Server M8 | 2026-11-06 | Persistent imps, guard combat and territorial liberation

- Added real imp creatures to monster-held courtyard/village regions, with server-owned position, health, bounded cardinal pathfinding, and saved state that continues progressing without an open browser while DK Server runs.
- Existing guard NPCs fight imps; imps pursue nearby residents or the player, inflict real health damage, and can incapacitate a living character without deleting the one-life record.
- Added server-validated player `attack` action: adjacent-target check, 900ms cooldown, skill growth and equipment-dependent damage. No client-supplied damage or reward values are accepted.
- Added permanent world-ground loot drops and `loot` collection. Imp defeat creates real persistent gold/materials; collecting them moves items into the player's pack once, preventing duplicate payouts.
- Killing the final occupying imp can return an area to settlers and resume settlement functions. The server writes related combat, defeat, and liberation events through the append-only world-history queue.
- Added basic original Canvas imp and loot markers plus outdoor Attack and Loot controls. Reused the same actor inspection/double-click interaction pattern; no new art assets.
- Added `tests/combat-m8.cjs` regression contracts; updated server version checks, M8 docs, frontend cache versions and test script. Pure in-memory tests verified damage, cooldowns, loot, liberation and world validation; the complete Node integration suite still requires a full source checkout.
- Public GitHub Pages remains a static preview without an always-on hosted DK Server. No multiplayer, Godot or permanent player death.

## v0.2.28 / DK Server M7 | 2026-11-06 | Crafting, equipment and world-time survival

- Added server-authored recipes for torches, rations, bandages and smithy tools. Crafting consumes actual server inventory and awards crafting progression, with a world-minute cooldown.
- Added equip/unequip hand tools and torches. Worn tools improve foraging experience; lit torches expire after 90 world minutes, with a saved event.
- Added living-character hunger, energy, health and nonfatal incapacitation, advanced by the persistent world tick even while no browser is open. Food and bandages consume real items to restore needs. Rest has a cooldown and provides a way to recover from collapse.
- Extended inventory type validation and save migration for existing characters. Server gameplay dispatch, durable journal logging, public readout and future region travel all use the existing character's single authoritative record.
- Added outdoor buttons for Make Torch, Make Rations, Make Bandages, Eat, Equip Tools, Light Torch and Rest. No newly generated graphics.
- Added `tests/crafting-m7.cjs` to server suite; corrected stale main-menu asset cache-bust versions, build identifiers, README and design docs. Module-level checks passed for crafting, equipment, food, timed torch expiry and save validation; complete Node integration suite must still be run in a full checkout.
- No new hosting or multiplayer. Public GitHub Pages remains a static preview without a connected persistent DK Server.

## v0.2.27 / DK Server M6 | 2026-11-06 | NPC relationships, contracts and pathfinding

- **Social memory:** Added saved NPC contacts with per-person conversation frequency and a one-meeting-per-30-world-minute faction reputation gain limit.
- **Physical conversations:** Added `talk` server actions with alive/form/Manhattan-distance checks, role-specific NPC responses and durable world-history records.
- **Real commissions:** Open business owners can issue a single active goods-delivery contract. Deadlines progress only with running world time. Server validation prevents remote acceptance, reward spoofing, inventory forgery and repeated payouts; completing one transfers goods to shop stock and money from the shop to the character, adding commerce skill and reputation.
- **Pathfinding:** Replaced straight-line NPC steering with cardinal-only bounded BFS around existing Architect walls, house footprints and obstacle tiles. Travel passes through the real courtyard/village portal instead of cutting through a wall.
- **Playable interaction:** Outdoor UI includes Talk, Accept Commission and Deliver Goods controls; double-clicking an NPC starts a real conversation through the connected server. The static public preview does not claim these features function without DK Server.
- **New server APIs:** `GET/POST /api/v1/social` provide read-only nearby contacts/active contracts and allowlisted authoritative social actions. Social state migrates safely into existing M5 saved worlds, is validated, and is saved via the existing atomic writer and append-only event archive.
- **Testing:** Added social and NPC-navigation regression suites, extended the existing Node test command, updated version checks, README and server design documentation. Module-level pure-JavaScript checks exercised contracts, immutable transactions, duplicate-reward rejection, path detours and portal travel; complete Node integration suite still requires running in a full source checkout.
- **Boundaries:** No new graphics, no Godot, no new server dashboard, no additional character slots and no internet-hosted persistent backend. Full UO-level relationships, AI and world hosting remain future milestones.

## v0.2.26 / DK Server M5 | 2026-11-06 | Regions, living NPCs and UO-inspired economy

- **Variable-size world:** Added shared 16×16 temple, 64×64 courtyard and 128×128 village geometry with correct **16×16 temple exterior**, houses, paths and regional gate links; existing DK Architect walls now support arbitrary area dimensions.
- **Playable outdoor client:** Added camera-following courtyard/village pages using existing art and deliberately simple in-game scenery. Temple north-door exit and reverse entry now transfer automatically. **Single-click door inspection; double-click door toggling.** Houses have realistic footprints but are not falsely advertised as fully furnished interiors.
- **Lilith:** Server persists the first courtyard entry and the ghost/golden-willow versus resurrected/sickly-willow outcome; small Canvas transformation uses existing character material and primitive rendering, no new pictures.
- **Living server world:** Added 12 NPCs, schedules, physical movement, health/needs, 6 businesses, shops/stock/expenses, postal courier and bank box, roaming camp, monster-threat territories and autonomous settlement changes. The world advances on the server while the browser is closed.
- **Player systems:** Server-owned starting inventory, gold and bank balance, gathering nodes/respawn, commerce and foraging skill progress, proximity-checked buying/selling and bank deposits/withdrawals. Ghosts cannot transact with physical goods.
- **Permanent record foundation:** Atomic authoritative world snapshots plus a serialized append-only world-events NDJSON archive and bounded recent-event API. Expanded single-slot client and backend API, region discovery, state reads, bank collection and structured gameplay actions.
- **Server restrictions retained:** One character, no Godot, no passwords or second dashboard, loopback-only binding. The public static website still has **no hosted persistent DK Server**, so its preview never fabricates NPC simulation or a live bank.
- Added targeted Node regression contracts for spatial consistency, portals, living-world ticks, deterministic schedules, pause, mail, trade, skills and HTTP persistence. Documentation and game version updated.

## v0.2.25 / DK Server M4 | 2026-11-06 | Persistent run/pause state and one server-owned life

- Added durable server-owned world runtime with **START / STOP** control endpoints. Stop freezes the six-real-hour day/night cycle, and Start resumes from the saved instant. No time is counted while DK Server is off or deliberately paused.
- World clock checkpoints run through the single-writer queue even without an attached browser. Full process shutdown now pauses the clock before closing. Existing M3 worlds without a runtime are accepted.
- Enforced a **single character slot** at the backend, not just in the menu; attempts to create slots 2 and 3 are rejected.
- The integrated menu's Start/Stop buttons now call genuine endpoints on a connected local DK Server; New Game and Continue automatically resume the paused server world. Browser-only GitHub Pages continues to report **Not Connected** because there is still no hosted world process.
- Added four M4 regression tests for pause/resume, no offline catch-up, one-life enforcement, API control, restart persistence and legacy save reading. Updated the previous server tests and launcher for M4. **No internet-facing service deployed**; secure HTTPS hosting and autonomous NPC simulation remain pending.

## v0.2.24 | 2026-11-06 | Visible Persistent World options on the public webpage

- Fixed the public GitHub Pages menu hiding the entire Persistent World section; it now always appears under Options alongside Music.
- Added **Start Server**, **Stop Server**, **Refresh**, world server connection status and a day/night clock status. The existing local server is detected accurately and its graceful Stop action remains available.
- On GitHub Pages, the section transparently reports **Not Connected** and explains that an actual hosted DK Server has not been deployed; the Start button explains the missing host rather than issuing fake network requests. No password or separate player dashboard was added.
- Main menu now displays **one character slot** and prevents New Game from overwriting an existing character's life. The public preview's older browser save data remains isolated from server records pending a hosted backend.
- Added regression checks for visible server controls, single-slot behavior, public offline status, zero imaginary requests, and locally connected Stop Server operation. No persistent cloud hosting is claimed.

## v0.2.23 / DK Server M3 | 2026-11-06 | Single-player integrated persistent world

- Replaced the password-based local owner flow and separate `/player` dashboard with the **normal Demon Killer main menu** served by the loopback DK Server. No account or password is required to manage the three character records.
- Added `start-demon-killer.sh`, a Linux launcher that starts DK Server detached, opens the game, reuses the running compatible process, and warns rather than killing an incompatible older server. Closing Firefox does not terminate the persistent world process.
- Added **Options → Persistent World** with online status, day/night phase, and an explicit **SHUT DOWN SERVER** button. Shutdown is loopback/same-origin controlled and waits for serialized world writes before the host exits.
- Moved local New Game and Continue to DK Server, without importing browser saves. Extended validated server-side actions for opening completion, cardinal movement, north-door interaction and double-click soul-crystal resurrection. New game records permit names as short as one character. Browser-submitted save snapshots remain forbidden.
- Removed active authentication endpoints and the obsolete owner-login and separate dashboard files. Previously generated local private identity/token files are unused but not destroyed on update. Restricted game asset serving to allowlisted paths and checked Host, Origin and Fetch-Site without granting CORS.
- Preserved existing temple geometry, original art, ritual and DK Architect tools. **Not yet complete:** server-authoritative Architect edits, cult data, autonomous NPC/monster behavior, and multiplayer. GitHub Pages remains a standalone preview and cannot itself host the world process.
- Local M3 server regression tests passed; the Linux launcher was exercised against a real detached Node process, including authenticated-origin-independent shutdown. Browser visual smoke test remains pending.

## DK Server M2 development preview | 2026-11-06 | Owner sign-in and server-backed New Game / Continue

- Introduced a loopback-only DK Server character-record interface at /player, with first-time owner password setup, sign-in/out, a three-slot New Game form, and Continue reading the authenticated server record. No browser-local save import, client-submitted snapshots, or automatic record overwrite.
- Owner credentials are stored as a salted scrypt digest, not a password; local sessions use random HttpOnly SameSite=Strict cookies, memory-only session revocation, 12-hour validity, and a temporary lockout on repeated incorrect passwords. The bootstrap admin token is not included in public browser code.
- DK Server accepts authenticated session cookies alongside the existing private Bearer administration path. All changes are written by the server; the browser never sends arbitrary world saves. A failed or corrupted identity file refuses startup.
- Preserved the M1 world geometry and six-hour clock. Original browser gameplay and its older isolated saves remain untouched until the **playable** client is converted; this is not falsely presented as a completed gameplay migration.
- **13/13 Node tests passed locally**, including existing M1 tests, owner setup/sign-in, session revocation, parallel initialization, unauthorized mutations, and restart login. No GitHub Actions testing used. Chromium visual rendering could not be confirmed in the test environment; owner review remains pending.

## DK Server M1 development preview | 2026-11-06 | RunUO-inspired persistence foundation

- Added independent Linux **DK Server** under server/, with an original Node.js implementation. RunUO's World, SaveStrategy, entity and timer systems were inspected as design references; no GPL C# or UO assets copied.
- Server creates the approved 16×16 Forsaken Temple state, owns a durable world clock (six real hours of day, six real hours of night), and stores new character records with synchronized writes before acknowledging creation.
- Private authenticated localhost-only character-create/read endpoints reject forged save snapshots, bad inputs, cross-origin writes and duplicate slots. Server data and admin token stay out of Git. Two processes cannot write the same world directory.
- World snapshot, health, clock and read-only event stream power a small DK Server status page. Bad or unknown-version world data refuses startup rather than resetting; no migration of old browser saves.
- **Not yet connected to the browser game.** Current client-local save behavior has not been disabled or promoted to the new authority. Next step is authenticated New Game/Continue integration and authoritative player actions, then safe retirement of old browser saving.
- Nine native Node regression tests passed locally. No GitHub Actions tests were started; existing gameplay, intro, temple graphics, DK Architect, and audio remain unchanged. Development preview pending owner acceptance.

## v0.2.22 development preview | 2026-11-06 | Architect editing and character-only skill rust

- Main menu music: clear music toggle, persistent 0–200% volume slider (100% = unamplified track), Web Audio amplification with peak-reducing dynamics processing, and graceful unamplified fallback. Default 200% honors the louder-menu request. Older on/off preferences remain valid; tests updated. Temple audio unchanged.

- Repaired DK Architect's bottom row to six compact individually framed controls, matching the upper category buttons instead of using a large decorative gold strip. Left tools are centered, hidden overlapping DK pennant removed, and right-rail icons are scaled to fit fully inside their borders. Approved game room geometry unchanged.
- Split **Select** from **Move**. Move now operates click object → click destination. Rotate and Copy are tool-first: choose the tool, then click an existing placed object. Esc clears targeting and returns to Select, including when a text field was focused. Keyboard R arms Rotate; Delete arms Erase.
- Individually selected wall sprites can rotate 90 degrees in place and save their facing in optional `wallRotations`. Automatic wall faces still choose corners by neighbors. Old temple saves without the new field load with default zero rotations; undo/redo includes wall orientation.
- Added a pure, server-independent skill mastery/rust model. Every learned skill can rust a little after **60 days of meaningful per-character active playtime** without use. Only 0.1 per additional active week; at most five points or 20% loss, and never zero. Valid practice restores lost skill faster than new learning. No global cap across all skills.
- Skill records are stored in existing per-character slots, not the shared room layout. Brief genuine player movement/interaction advances the personal skill clock; offline time, idle time, editor time, opening cutscene and the server world clock do not. Actual mining, taming and alchemy gameplay are later systems, not claimed to exist in this release.
- Added regression checks for target-before-rotate, Esc cancellation, move/select separation, manual wall facing, and the skill module. No extra third-party assets, no changes to temple lore or approved sprites.
- This is a development preview awaiting owner visual and functional acceptance.


## v0.2.21 development preview | 2026-11-06 | Real creator-built dungeon construction sets

- Added 243 named transparent sprites from 0x72's **original 16x16 Dungeon Tileset v5**, verified byte-for-byte against both owner-provided copies and its official itch.io download.
- Kept 0x72 Dungeon Tileset II v1.7, Pixel_Poem's 2D Pixel Dungeon Asset Pack v2.0, and Pixel_Poem's Enemy Animations Set in creator-attributed game atlases. All four packs are now exposed through the UO-inspired DK Architect categories.
- Replaced the rejected wall renderer with separate **0x72 Original** and **0x72 Dungeon II** automatic wall systems. The original artist's matching base, front, outer edge and corner pieces are combined by wall neighborhood instead of inventing new corners. Individual walls from either pack and Pixel_Poem remain independently selectable, without pretending that different sets auto-connect.
- Removed 106 discarded hand-cropped DK wall pieces, 5 old wall-brush textures, both rejected source wall masters, obsolete wall scripts and one unnecessary inspection workflow from the playable branch. Retained historical versions through Git history.
- Added pack IDs per wall cell (`wallPacks`), exact custom wall IDs (`wallVariants`), and imported floor tile IDs (`floorArt`). Old local saves load with the new wall system and drop invalid unjoinable wallPiece objects.
- Added indexed imported sprites, multi-tile object placement previews, collision overrides, undo/redo support, validated object IDs, and live visual animation for NPC and enemy art. No AI, attack logic or loot behavior is implied by animated artwork.
- No gameplay story, temple layout, multiplayer/server state or approved UO-inspired toolbar geometry changed. Updated tests and technical docs; public README remains a game description and web-player link only.
- Visual corner approval in the live browser remains pending.


## v0.2.20 development preview | 2026-11-06 | Original wall sheet extraction, Architect scrolling and clean README

- Split the owner-uploaded `Demon Killer Stone Wall Tileset.png` into 106 individual original-pixel transparent PNG sprites, categorized into structures, corners, straight runs, mossy stone, ruins, curves, pillars and fortified sections; source sha256 and source rectangles recorded in the generated manifest.
- Each piece is placeable, rotatable, movable, removable and persistable in DK Architect with a true multi-tile footprint and no fake automatic joining. Save validation rejects unknown piece IDs.
- Removed 220 procedurally generated faux wall pieces from the active assets and all old 32px direction-specific artwork from the active wall palette. Existing room wall cells remain, now displaying one of five seam-tested 32px stone material tiles extracted/adapted from the owner's uploaded sheet, without pretending these are structural corner images. Old saved manual wall variants are safely normalized to grid masonry while retaining wall cells.
- Mouse-wheel events over the horizontal Architect sprite browser now scroll the sprite strip; existing arrows still work. Mouse-wheel events over the game canvas continue rotating an unplaced sprite.
- Kept the UO-inspired Architect toolbar geometry, original approved UI art, temple story and current saves. Removed obsolete wall-generation workflows and scripts so stale assets are not regenerated.
- Public README now contains only the game's description, current gameplay and player URL; the previous technical README moved verbatim into docs. Third-party CC0 asset research and compatibility guidance live in docs.
- No third-party art has been imported into the game or silently treated as a matching construction set. In-browser visual approval pending.


## v0.2.19 development preview | 2026-11-06 | One-click precise destination walking

- A short right mouse click now sets a fixed pixel-accurate destination; the ghost/living character continues travelling after mouse release and stops once the pointer coordinate is reached.
- Holding right mouse still steers continuously and stops immediately on release. Keyboard walking cancels one-click travel; losing focus cancels it. The existing left-click crystal/door interaction is unchanged.
- No navigation through solid walls, no new pathfinding, no fabricated server movement; this fixes how the destination is chosen and when movement stops. Dynamic regression checks cover a quick click across the room and a target less than 18px away.
- The orthographic, transparent 220-piece wall collection added in v0.2.18 remains unchanged. Pending owner browser visual approval.


## v0.2.18 development preview | 2026-11-06 | Exact cursor and seamless orthographic wall artwork

- Replaced the intentionally short-stopping mouse steering movement (17.6px dead zone plus another 0.35-tile standoff) with exact pixel-space clamped movement. The player no longer halts within a halo around the held right-mouse pointer. Existing left-click-to-interact, hold-to-steer and release-to-stop controls remain unchanged. Blocked destinations remain blocked.
- Replaced the earlier 80 heuristic-cropped wall tiles with **220 transparent 32×32 top-down original pixel-art variants**, generated from a fixed geometric junction mask. The archived approved master image remains untouched.
- 11 modular shapes (straight, corner, T, cross, end, pillar, arch, window, buttress, ruin, curve), each available in four cardinal orientations and five finishes: clean, dirty, mossy, cracked and broken. The 640×352 master has transparent background and no text.
- Generated sprites have standardized 12px cardinal edge profiles verified pixel-by-pixel in GitHub Actions before the files are committed. Rewrote automatic joining orientation rules to match exact north/east/south/west geometry, including the isolated-pillar case.
- DK Architect's scrollable tile palette now exposes five auto-join finishes and 220 exact component choices. Existing wallVariants, collision grid, room saves and brush/undo systems remain compatible.
- No change to canon, temple layout, resurrection, character sizes or UO-inspired interface proportions. Browser visual acceptance pending.


## v0.2.17 development preview | 2026-11-05 | Accurate approved UO-style stone and gold framing

- Rendered the horizontal tile browser's real old-stone window border as nine-slice Canvas regions from the exact approved UI master image (coordinates within the original file). No synthetic border art is substituted.
- Replaced the flat CSS command-strip approximation with the approved original gold six-button bar from the same image, aligning the existing Backup/Restore/Sync/Clear/Commit/Revert labels to its wells.
- Retained compact responsive CSS fallbacks only where the full decorative bar cannot fit on narrow/mobile viewports. The actual approved tool-button and DK-banner sprites are unchanged.
- No editor behavior, temple geometry, story events or room saves were altered by this visual-only enhancement. In-browser appearance still requires owner acceptance.


## v0.2.16 development preview | 2026-11-05 | Full approved wall-parts browser

- Expanded the horizontal Ultima Online-style wall tile browser from four automatic-join finish buttons to 84 art choices: four auto-join finishes plus all 80 original approved wall piece variants (straight, corner, T, post/cross, end × four facings × four finishes).
- A hand-picked piece is preserved in `scene.wallVariants` by tile coordinate. Automatic wall joining remains the default for all existing walls and for the four finish options. The original approved temple layout, north doorway and collision remain unchanged.
- Placing, line painting, room outlining and erasing now preserve or clear exact wall choices. Eyedropper selects a wall's current exact or auto style.
- Hover a hand-placed wall and use the Rotate action to cycle its four art directions; existing object rotation is unchanged.
- Import rejects unknown wall asset IDs; room saves created before the new optional wall-array field still load with auto-joining. Undo/redo and room export include manual selections. Browser visual review pending.


## v0.2.15 development preview | 2026-11-05 | Real approved-image UO house toolbar

- Owner rejected the previous dark, tall, tabbed floating sidebar (v0.2.12–0.2.14). Rebuilt the default DK Architect interface as a compact HORIZONTAL Ultima Online house-construction toolbar instead of restyling that sidebar.
- The UI directly renders exact regions of the owner-uploaded transparent 2172×724 `assets/art/dkarchitect/ui/Medieval Architect UI Sprite Sheet.png`: DK banner, selectable pixel-art tool buttons, minimize/close, arrows and decorative controls. The original source sheet remains intact.
- Working construction controls include visual horizontal tile browsing, Walls/Floors/Doors/Items/Ritual/Sprites categories, per-tile preview and selection, sprite sheet scroll arrows, placement/selection/rotation, wall brush, room outline, floor paint, undo/redo, object copy, erase and access inspection. Dragging moves the toolbar over the game.
- Backup/Restore use an isolated local draft snapshot, COMMIT saves the current room to local browser storage, and REVERT reloads the last local save. SYNC and CLEAR are deliberately disabled until a real persistent server and safe clear workflow exist. Building-level buttons remain disabled because this temple is currently one level.
- Detailed tools, X/Y object inspector and existing JSON room export/import live in an OPTIONAL expandable details drawer, never the default builder. The former rejected window dimensions are not loaded.
- No new art, altered story, temple geometry, collision, RPG gameplay or fictitious NPC/quest/server permissions. Browser visual acceptance remains pending.


## v0.2.14 development preview | 2026-11-05 | Coordinate inspector + copy/paste, build 3

- Added an object inspector inside the floating Pandora-inspired builder with exact X/Y position, north/east/south/west facing and optional solid/passable collision on non-door objects.
- Added copy-object then paste-on-click with accurate placement preview and standard overlap/geometry protection.
- Added bring-to-front and send-to-back controls for static scene-object draw order. Undo/redo and saved room data cover each change.
- Existing closed-door blocking remains authoritative; malicious or invalid collision fields are rejected on import.
- No player permission bypass, new NPC AI, quest creation, artwork, scene layout changes or new offscreen map.


## v0.2.13 development preview | 2026-11-05 | Staged approved sprite library, build 2

- Added a searchable approved Sprite Library tab to the floating Architect with individually usable 19 crystal sprites and 6 static character appearances: ghost, human, cult member, Lilith, cult leader, Devil.
- Staged assets are genuine one-tile objects: place, move, rotate to cardinal facings, duplicate, erase, undo/redo, save, load and import/export through existing Architect operations.
- Staged actors are visual-only scene props, not scripted live NPCs. Other crystal colors are static visual props only, with no invented soul powers or resurrection behavior.
- Explicitly reject unknown sprite IDs on room import. No new artwork was generated and no protected story, temple geometry, cult state or player save keys were changed.
- Approved decoration and portrait master sheets still need correct individual slicing and review before being placed from the library. Browser visuals remain pending.


## v0.2.12 development preview | 2026-11-05 | Floating Pandora-inspired Architect, build 1

- Replaced fixed Architect controls and the room details sidebar with a draggable, resizable floating construction window inspired by Pandora's Box and the UO house builder reference.
- Preserved existing tools, asset thumbnails, room properties, saving/export/import, wall construction, object operations and the original 512px playable canvas.
- Added category tabs (Walls/Floors/Structure/Items/Ritual) and clearly marked future Admin and Quest panels; neither panel claims server permissions or working mission creation.
- Added minimize/restore and close; close returns to Walk Temple. Saved only window position/dimensions and minimized state under a new isolated UI preference key.
- No old room/save keys, art assets, temple geometry, resurrection behavior or player world permissions changed. Owner browser review pending.


## v0.2.11 development preview | 2026-11-05 | Approved masonry + Pandora-inspired Architect

- Replaced the old 20 wall graphics with 80 extracted sprite variants sourced from the owner-approved Dungeon Temple Wall Tile Atlas: straight, corner, T, intersection/post and end in four directions and clean/moss/cracked/broken treatments.
- Used original source pixels with nearest-neighbor downscaling and cardinal rotations, never new wall imagery; master atlas stays unchanged.
- Added wall paint/drag, axis-aligned straight runs, rectangular room outlines, wall eraser, wall-style selection and searchable art browser within the existing DK Architect sidebar.
- Wall finishes are per-cell room data and survive save/load/export/import/undo/redo; old room JSON gains default clean finishes when loaded. The original binary wall geometry and collision system remain untouched.
- Initial temple perimeter uses restrained deterministic clean, moss, cracked and broken finishes without moving a single wall, door, altar, NPC or character.
- No new floor art yet; matching clean/worn/dirty/cracked/broken floor atlas is next for review. Browser visual acceptance remains pending.


## v0.2.10 development preview | 2026-11-05 | Approved soul crystals

- Split the exact owner-uploaded two-row "Glowing and Dull Pixel Crystals.png" master into 19 separately named 32×32 transparent game sprites: nine colors with bright/dim frames, one static silver depleted sprite.
- The Forsaken Temple gold crystal draws at 24×24 within its 32×32 interaction tile; its actual colored silhouette is smaller still.
- While unspent, the bright/dim gold image changes on a slow, irregular schedule. Refusing the crystal preserves this behavior.
- On a successful ghost double-left-click, only that selected crystal turns to silver immediately. Resurrection timing, choice, and all other gameplay/Architect geometry stay the same.
- Crystal source splitting is reproducible through a narrowly scoped, one-time GitHub Actions extraction. Browser visual acceptance is still pending.


## v0.2.9 development preview | 2026-11-05 | Pointed dialogue tails

- Replaced the shared 9×9 rectangular dialogue stub and detached bottom line with a longer, 26-pixel tapered pointer.
- Pointers are drawn with the same character-specific border color and dark interior; the base joins the speech bubble and aligns toward the speaker.
- Applied centrally to cult leader, Devil, and Lilith without changing raised box positions, NPC sizes, altar, temple geometry, or DK Architect.
- Updated simulated Canvas regression coverage and cache/version labels. Owner visual acceptance remains pending.

## v0.2.8 development preview | 2026-11-05 | Raised temple dialogue boxes

- Raised ritual speech bubbles for the cult leader, Devil, and Lilith to sit clear of the speaker and the bound player on the altar.
- Increased vertical clearance from 15 to 64 pixels and retained horizontal clamping and the upper canvas boundary.
- Added a regression test that confirms the cult leader's dialogue text is above the altar body area.
- Kept the approved 3×2 altar, NPC scales, scripted dialogue, Architect behavior, and disposable development saves unchanged.
- Updated the menu/temple cache query to v0.2.8.


## v0.2.7 development preview | 2026-11-05 | Altar and bound player scaling

- Shrunk the sacrificial altar footprint from 4×2 to 3×2 tiles (96×64 pixels), recentering its starter-room placement on the north aisle at (7,5).
- Scaled the lying human/corpse from 64×32 to 40×20 pixels, centered on the altar, with a matching fallback.
- Updated DK Architect's altar palette footprint, translucent placement preview, 2×3 rotated preview, collision and placement behavior through its shared catalog.
- Left the temple walls, NPCs, altar sequence, crystal placement, and editor controls intact.
- Development saves are disposable per owner direction; no old-save migration or compatibility workaround was added.
- Updated menu/temple cache versions and added altar-preview placement regression checks. Live browser visuals still require review.


## v0.2.5 development preview | 2026-11-05 | Sacrifice dialogue and cache refresh

- Added on-screen pixel speech bubbles above the cult leader, Devil, and Lilith, timed to prayer, sacrifice, confrontation, and kneeling.
- Leader: "The veil knows your name." then "Your life ends here."
- Devil: "You're mine." then "Death offers no escape."
- Lilith: "In ash and silence, let one light remain."
- Allowed a little more time for the leader's death announcement to be read.
- Temple navigation and its JavaScript request now carry the version to reduce stale browser-cache problems. A footer version provides visual verification.
- Speech bubbles are visual overlays, not saved objects; no temple geometry, approved art or gameplay controls change.
- Extended introductory regression coverage. Browser visual review remains necessary.


## v0.2.4 development preview | 2026-11-05 | Sacrifice-scene scale and staging corrections

- Draw the approved living/dead 64×32 lying-hero art at native size, centered on the unchanged 128×64 altar.
- Keep the cult leader at the foot of the altar facing north toward the body throughout prayer and sacrifice.
- Start the Devil beside the altar on its east side facing west, and Lilith on its west side facing east.
- Spawn the ghost farther down the existing center aisle at the room's configured player spawn (default 8,12).
- Correct the Devil and cult-leader sprite-sheet frame order to south/west/east/north.
- Render moving cult members using the four approved named directional PNGs rather than assuming an unverified sprite-sheet order.
- Retain the established ritual, optional crystal resurrection, room geometry, props, Architect editor and save behavior.
- Update cutscene and control regressions; visual acceptance still requires owner browser review.


## v0.2.3 development preview | 2026-11-05 | Main menu and sacrifice opening

- Preserved the approved sword-and-pixel-art menu and scaled its dimensions to fit available viewport height at ordinary browser zoom.
- Suppressed the unstyled fallback menu while the sprite sheet loads, while retaining accessible text if the image fails.
- Added the cult gathering, leader prayer and sacrifice, ghost emergence, Devil encounter and exact "You're mine" line.
- Devil leaves first; Lilith kneels facing the altar for about five seconds, leaves the soul crystal directly in front, then exits.
- The starter crystal no longer appears before Lilith places it. Single-click still inspects, double-left-click intentionally resurrects, and the north barrier lifts after the ritual.
- Rendered the altar body using the existing alive/dead human artwork, relocated the walkway candle, and selected the newer flame-bearing brazier art from the temple sheet.
- Kept the original altar/walls and 16×16 Architect geometry, movement controls, story branches, JSON tools and named records.
- Updated the staged-intro and temple regression coverage. Browser visual acceptance remains pending.


## Main menu visual and studio credit corrections | 2026-11-05

- Removed the haunted-house/castle decoration beneath the menu, leaving the approved logo and game-control buttons intact.
- Corrected the game menu and short player-facing README to credit DK Softworks, whose DK represents Дом культуры (House of Culture), while preserving historical/legal references where appropriate.
- Added a regression assertion that the castle cannot be silently reintroduced into the menu.

## Unreleased Cult of Kosmos-style investigation board | 2026-11-05

- Replaced the public Society Register in the Cult menu with a fullscreen, radial, four-branch cult hierarchy around a locked central leader.
- Actual members display masked 8-bit-style silhouettes until confirmed evidence unlocks their identities and discovered clues on a selectable cult card.
- False or premature suspicions remain separate unverified leads instead of falsely appearing as confirmed positions in the cult network.
- Confirmed members can be marked for tracking; saved tracking, previously revealed identities and eliminated members persist across Continue.
- Kept the population and daily schedules behind the scenes; no playable city map or cultist elimination missions are implied.
- Preserved character records, cult truth, existing architecture, movement and story.

## Unreleased procedural society population | 2026-11-05

- Added 24 seed-generated ordinary and prominent citizens with persistent identities, occupations, personality traits, acquaintances and daily work/home/public routines.
- Registered civilians in the existing cult simulation without exposing their secret membership, overwriting established cult discoveries or creating fixed story identities.
- Added a public Society Register tab beside discovered cult dossiers. The register lists only names, occupations, general work hours and encounter status, never membership.
- Added future in-scene hooks for citizen encounters, abstract schedule queries and advancing the population clock. No new playable city or changes to temple/editor geometry.
- Added migration for saved character slots and tests for deterministic worlds, varying memberships, non-spoiler public records and persistence.

## Unreleased cult system | 2026-11-05

- Added deterministic per-world cult affiliation and dynamic recruitment, exits, deaths, changing circumstances, leadership vacancies and promotions.
- Added player-only character dossiers, investigation evidence and cult leads separate from the world's hidden truth.
- Wired a separate cult state into each named character record and added an overlay journal without moving the approved temple or Architect UI.
- Added independent regression coverage and system documentation. The current temple contains no town NPC roster or playable cult quest chain yet.

## Unreleased menu music | 2026-11-04

- Added epb9000's CC0 “Creepy Ambient Loop” v2 OGG to `assets/audio/music/creepyloop-v2.ogg` as quiet looping main-menu music.
- Connected playback to the existing music preference and retried after user gestures when browser autoplay is blocked.
- Added audio-license documentation and menu regression coverage without altering gameplay, DK Architect or the minimal public README.

## Unreleased gameplay fixes | 2026-11-04

- Refreshing the temple page now returns to Demon Killer's main menu; normal New Game/Continue still open the temple.
- Soul crystal single-left-click now describes the crystal; double-left-click is required to begin the existing resurrection ritual, still subject to range and ghost-state checks.
- Updated temple instructions and regression checks without changing DK Architect editing, save keys, room geometry or the public README.

## Unreleased design documentation | 2026-11-04 | No gameplay build

- Recorded owner-approved future Forsaken Temple opening: free ghost exploration, temporary movement lock, five-second kneeling prayer, crystal placement in front of altar, barrier removal, and optional ghost exit.
- Specified single left-click crystal inspection versus deliberate double left-click resurrection, with ghost object messages and two worldview-dependent willow transformations.
- Documented the missing corpse artwork, planned kneeling/alternate-dress/willow artwork, and known main-menu and Architect defects without claiming they are fixed.
- Adopted the shared Capital & Consequence Company Bible development rules for Demon Killer, including **sparingly used GitHub Actions**.
- **Documentation only:** current game code, release version, and existing sprite assets unchanged.

## v0.2.2 | 2026-11-04 | Main menu and crystal woman opening

- Added the approved-sprite main menu and three Zelda-I-style named character records with New Game, Continue, Options and Quit guidance.
- New and continued characters open the **existing** Forsaken Temple with DK Architect and all original room Save, Load, Export and Import controls.
- Changed controls to hold right mouse for movement, move cursor farther to run, and left-click only for nearby object interactions.
- Fixed unwanted auto-resurrection when walking over the soul crystal. No E-key interaction.
- Added the red-haired woman NPC's timed temple entrance, route around the altar, and exit using the approved four-direction sprites. Player movement unlocks after departure.
- Added a minimal spirit-to-body altar resurrection sequence and retained the optional ghost path. No unapproved special powers or new story areas.
- Loaded original DK Architect art-pack PNGs for floors, wall joins, objects, ghost/human sprites; retained procedural pixel fallback on asset loading failure.
- Added translucent footprint-aware Architect placement previews and clockwise/counterclockwise mouse-wheel rotation, preserving the placed-object Rotate button.
- Added simulated regression checks. The persistent-world server is a separate future milestone.


## v0.2.0 | 2026-11-04 | Main-repository migration

- Promoted the already playable, engine-free sacrificial-temple prototype as the active direction for `main`.
- Retained the original game, editor, ghost-to-mortal crystal choice, existing tests and isolated browser saves; **no new gameplay mechanics in this migration**.
- Preserved the old Godot working-tree snapshot on `archive/godot-recovery-2026-11-04`.
- Removed Godot-only runtime/configuration, add-ons, GDScript scenes, incomplete recovery fragments and obsolete Godot README presentation from active `main`; all remain accessible in the legacy archive.
- Added a root landing page, refreshed README, documented legacy salvage decisions and clarified the temple-first DK Architect development plan.

## v0.1.0 | 2026-11-04 | Prototype

- First playable 16 × 16 sacrificial temple with original Canvas pixel art.
- Ghost start; touching soul crystal resurrects, avoiding it preserves the ghost branch.
- Cardinal grid movement, simple editor tools, undo/redo, browser save and JSON import/export.
