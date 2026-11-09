## M78 willow-square world consolidation, November 9, 2026

Single canonical outdoor world: **9,216 × 9,216**, sparse tile terrain. The approved town circle from the original 64 × 64 courtyard is anchored at (4096,4096), not spawned as a separate second outdoor map. Temple at (4120,4144), complete 16 × 16 footprint through (4135,4159), willow at (4127,4122). Only the temple starts built. Other prior buildings and the northern village are retired. Explorer 37 × 37 tile view ensures entire exterior is in view when leaving doorway at (4128,4143). The encounter begins on approach, not on temple exit. No save migration.

# Demon Killer | Developer Handoff (November 8, 2026)

This document is the working continuity reference if a conversation thread fills. Read `docs/demon-killer-master-roadmap.md` first for the current owner-approved direction, then the release-specific files.

## Source and release discipline

Repository: `dereksparks1982/demonkiller`, branch `main`. Studio DK Softworks. The M76 source target is game **0.2.74**, server **2.31.20**. Do not assume that source verification equals passed end-to-end gameplay. GitHub Pages runs a static preview. The Node authority is currently loopback-only by design and does not expose a public persistent hosted world. The existing server advances NPC life only while its process is running.

Do not build until explicitly instructed. When authorized: inspect current HEAD, one build at a time, document then create tested code, update release notes, commit/push/verify; no automatic browser launches or password prompts.

## Historical Godot archive branch consolidation (documentation-only)

The user requested retiring the extra `archive/godot-recovery-2026-11-04` branch **after** transferring needed material into `main`, but asked to perform deletion personally. The branch tip is `c57e15934ab29d9c0f1023f3e65039a640f6662f`. Its four archive-only commits, old Godot files and incomplete `recovery/source_payload` fragments were merged into `main`'s Git ancestry as a **second parent**; this keeps the entire partial branch retrievable by commit SHA after branch deletion. A curated read-only selection is now visible at `docs/history/godot-recovery/`, and six historical licence/attribution documents at `docs/licences/historical-godot/`. **No active game source, art or server behavior was changed; keep game 0.2.73 and server 2.31.19.** No runnable Godot engine or third-party code was imported into active paths.

Critical limits: the GitHub archive was only **39 files**. Its own recovery documentation says the authentic original 4,920-file v0.5.03 source tree and 62 source audio files were in separately supplied original ZIPs and were never uploaded to that branch. Keeping this Git history therefore does **not** protect those unreproduced binary/source backups. See `docs/history/godot-recovery/README.md` for exact archived commit identifiers and safeguards. Do not confuse historic licences with commercial-use clearance. The owner may delete the branch **name only** after verifying the two-parent merge.

## Owner's design decisions that supersede the old prototype

- All original temple and village architecture is scrapped for the replacement world. M68 still carries temple/Willow story compatibility and old economic area IDs; they are **temporary dependencies**, not approval to reuse the old physical design.
- Target **9,216 × 9,216** tiles, 32px top-down scale, 128-tile Streaming Cells, 16-tile detailed sectors.
- Do not create another illustrated world map. Author the actual playable terrain in DK Architect with Cities: Skylines-like sculpting tools and Prison Architect-like straightforward menus.
- Approximately one third ocean; western ocean, eastern continental mainland, glaciers, mountains, forests, marshes, huge inland Great River, multiple natural biomes.
- Natural settlement locations: six major cities/towns including one capital, three villages, three worker camps; only the six major settlements have sigils. No artificial geometric settlement layout.
- A 2.5D elevation-aware terrain renderer with proper mountain shading, walkable slopes/plateaus and 2D characters is preferred to full 3D models or an isometric world camera.
- User must be able to pan with held RMB in editor, LMB paint, wheel zoom, inspect elevation, undo/redo; world data automatically saves on server and can be exported with enough detail to reconstruct exact heights.
- Players and NPCs must flatten building sites, supply physical construction inventories, perform staged construction by hand or through autonomous paid labor, with material logistics and server-persistent progress.
- Kilns and heavy industrial equipment should have **very rare** breakdowns after years, not constantly wear out. M50/M66 failures need rebalancing.
- NPCs must autonomously found differentiated settlements, disagree and secede, trade and make peace or war, operate companies and continue independent lives. Avoid WorldBox's arbitrary population blobs and repetitive all-out war.
- Study the full private-server mod list in the master roadmap, prioritizing Nerun's Distro, OWLTR, FS-ATS, Xanthos Evo/Shrink, Knives Town Houses and Knives Chat. Do not copy proprietary UO art or unsuitable GPL code into commercial game source.

## M76: completed buildings become usable rooms, not scenery

M76 adds `server/atlas-buildings-m76.cjs`: a sparse registry of completed M75 structures, each with an exterior doorway on land, an indoor grid corresponding to its actual footprint, an owner tied to the entity-registry character serial, a lock, a physical material chest and an optional real workbench. Enter at an exterior door, walk using the real character indoors with persisted interior coordinates, and exit at the interior door. The external atlas position remains unchanged indoors; outdoor gathering and construction actions are rejected. The player can lock doors, move materials between their M74 pack and the building chest, install a workbench for timber/stone, and convert actual timber/reeds to plank/cord in the existing resource inventory. A stationed NPC caretaker can be assigned to move **carried** supplies into the chest on the hourly server tick for one real gold per item. No free materials or imaginary villages.

Character retirement relinquishes title/caretaker and former carried atlas pack instead of letting a later character in the same slot inherit the old identity. Unclaimed property may be registered for five gold. The connected Living World client displays visible door markers, a low-detail indoor room and an expandable building panel. Strict serialized `POST /api/v1/world/buildings` persists all operations. Tests `tests/atlas-buildings-m76.cjs` are added. V8 construction/room behavior was checked in isolation; full Linux Node tests, browser visual acceptance and occupied-save restart still require verification.

The original M75 2×2 and 3×3 footprints remain exact instead of manufacturing oversized interiors. Further owner-authorized builds should add larger multi-room structures, property rental, physical furniture placement and NPC indoor behavior, then autonomous settlement economics. The Godot history consolidated into main remains historical documentation only.

## M75: physical staged construction and paid autonomous work

M75 stores sparse real-world shed (2×2) and cottage (3×3) site footprints. A connected player stakes a preflattened, passable, unoccupied nearby area; terrain editing stays the DK Architect landscape tool. Site inventories receive real player/NPC M74 resources and only consume materials on completion of each separate foundation, frame and roof stage. Manual work is step-by-step. Workers must be stationed nearby and explicitly assigned, operate every fifteen world minutes while the server process is running, and receive one gold per item delivered or work step. That gold is debited from the real character and credited to a saved NPC `coins` field. Progress pauses for missing gold/materials. Completed foundations block player/NPC travel; staked footprints are protected against fine/broad terrain paint. An unfinished site can be canceled with unused inventory refunded if space allows. The old M67 plan schema stays distinct and cannot overlap an active construction site.

The connected living-world page shows site phases, stage materials, work/progress, stocks and crew. Server writes are serialized through `POST /api/v1/world/construction` and require expected revision. New `tests/atlas-construction-m75.cjs` add direct and HTTP regression contracts. Only syntax and isolated V8 behavior have been verified remotely. Run the complete Node suite and visually verify connected Firefox before acceptance. No automatic city founding, indoor rooms, finished-home interactions or remote hauling has been implemented.

**Next M76:** treat completed building footprints as usable structures with doors and interiors, player and NPC ownership, storage and workplace access. Then develop explicit transport and contracts for autonomous settlers.

## M74: terrain gathering and persistent NPC material packs

M74 adds `server/atlas-gathering-m74.cjs`: actual painted terrain now yields finite natural material in physical player and NPC packs. Forest and pine produce timber; heath herbs; wetlands reeds; stone and highland stone; dirt and beach clay. The untouched 9,216-tile green world has **no free resources**. Gathering requires adjacency and pack capacity. Every tile regrows after 360 server-world minutes. Forager and worker NPCs gather autonomously from their neighboring suitable tiles once every sixty minutes, including while the browser is closed but the server remains running. Workers remain at their sites rather than wandering aimlessly. These are raw stored supplies, **not** a fictional complete business or village workforce.

The connected M73 living-world page now exposes real manual gathering, live inventory totals and visible NPC packs; a subtle upper tile-edge / shore cue helps 2D elevation readability. The old area's `area_id` is still a temporary dependency. New regression contracts are in `tests/atlas-gathering-m74.cjs`; syntax was checked in isolated V8, but complete Node suite, save/restart and Firefox movement need verification from a Linux checkout. No automatically generated towns or 3D art.

**Next M75:** use harvested materials for genuine player-planned building sites: height/flattening checks, on-site delivery, foundation and assembly stages and paid NPC/player labor over server time, without imaginary free materials.

## M73: actual character, atlas NPCs, clean development resets

**Owner explicitly prefers disposable development saves and clean resets.** Do not spend subsequent builds maintaining compatibility with old temple/wilderness save data when schema changes warrant resetting. Existing world terrain, streaming-cell architecture, editor, inventory and NPC modules remain useful, but the old rendered temple/village geometry is retired as a design target. A fresh development world remains the same green plane; it is reset by a typed-confirmation **Options → RESET DEVELOPMENT WORLD** button, using the existing server reset endpoint. Do not reset without the owner's explicit action.

`server/world-actors-m73.cjs` adds the first actual slot-one `character.atlas_position={x,y,facing,steps}`, **not** just M72's detached surveyor. New development characters are created using `WORLD.createCharacter` with ordinary slot, inventory, skills, entity registry and identity; then temporarily start **living** in the atlas with obsolete opening skipped. Existing saved character profiles can be entered without duplication. The old `area_id` remains as a compatibility-only field for legacy systems; this does NOT constitute final migration of old RPG quest/combat/job services. A later build should retire that field after relocating dependent systems.

Autonomous atlas NPC prototypes are named `atlas_npc_N` and live under `world.living.atlas_npcs`, separately from legacy village NPCs. Allowed roles are scout, guard, forager and worker. The world minute calls `WORLD_ACTORS.advance(next,m)`, moving nonworkers on bounded, deterministic local routes and leaving workers at the site. All movements use authoritative height/material checks and occupation. Nothing automatically populates a city; NPCs are added deliberately through the M73 connected atlas UI. Protect real atlas characters/NPCs from impassable world brushes.

**UI:** `dk-world-explore-m73.html` and JS/CSS show original 32×32 characters, a 25×25 top-down view, real character name/form, local NPCs, creation/enter, WASD/arrows/RMB travel, and NPC placement/removal. DK Architect WALK HERE and Main Menu link to this route; the old M72 test page still exists for regression purposes. DK Server `GET/POST /api/v1/world/actors` powers the new view; action-dependent allowlisted headers and revisioned transactional server saves prevent arbitrary world snapshots.

**Not yet complete:** real NPC inventories, hiring, craft contracts, player-owned real estate, item spawning, combat on global atlas, final retirement of temple-area bookkeeping, autonomous towns, and permanent hosted server. The tiny NPC patrol is not an autonomous civilization. New `tests/world-actors-m73.cjs` adds focused and HTTP contracts. Isolated source-level tests passed entity navigation, patrol movement, worker stationarity, malformed requests and source syntax; full Node and Firefox verification require a checkout.

**Next:** M74 should remove the old-area dependence of actual character/NPC gameplay and begin common world-space entity queries, with minimal 2D cliff/shore legibility. Maintain owner control of terrain; do not auto-build a city or impose 3D rendering.

## M72: persistent top-down world walking (November 8, 2026)

The replacement world now has a **persistent single-surveyor walking test** in `server/world-walker-m72.cjs`. Its record is optional `world.world_grid.walker={x,y,facing,steps}`, and `world-grid-m67.cjs` plus `world.cjs` validate it. No old playable courtyard/temple area is copied into this new atlas and no giant floor matrix is saved. The surveyor is not yet the legacy `characters['1']` player entity, so it is important **not** to claim full character/NPC simulation has migrated.

**Author access:** connected DK Architect **WORLD PIXEL PAINTER → WALK HERE** (uses hovered coordinate or camera center), or Main Menu **Options → Persistent World → WALK THE WORLD (TEST)** to resume an already placed surveyor. New browser route `dk-world-explore-m72.html` renders a crisp 25×25 tile area, nearest-neighbor pixels and original 32×32 human direction sprites. WASD/arrows step one tile; hold RMB to move in one dominant cardinal direction; LMB inspects material/elevation. The authoritative loopback DK Server saves each step. There is no 3D, no generated terrain art, and no browser-trusted world movement.

**Server:** `GET /api/v1/world/walk` reads nearby material/elevations from the real M71 sparse default+overrides. `POST /api/v1/world/walk` with strict `place` or `step` commands serializes save with simulation and editor writes. The server refuses world edges, water, untraversable cliffs/boulders/crevasses and height gaps >1. Unbuilt building drafts are not physical barriers. Whole-cell and fine impassable brushes cannot paint over the occupied walker. Saves preserve previous M68 runtime world data; walker is a separate optional field.

**Verification:** isolated V8 code checks passed cell seam transitions, blocked water, resculpted walkable grass, one-level slope vs >1 steep block, world validators and protection from broad ocean painting. New `tests/world-walker-m72.cjs` covers Node HTTP save/restart. Full Node suite and actual Firefox walking are NOT verified in this remote editing environment.

**Next:** integrate the real character, NPCs, entities, and persistence/sector streaming into replacement atlas travel, then continue with simple 2D pixel elevation art, richer slope/cave/rivers and the larger construction/NPC autonomy plan. A prototype surveyor isn't the end state.

## M71: flat-green world baseline (November 8, 2026)

**Owner decision:** The replacement 9,216×9,216 world starts as one uninterrupted green grass plane at elevation 0, then the owner shapes it by painting land, oceans, rivers and mountains. Do NOT pre-generate an ornate map, prefabricated towns, rivers or ocean, and do not make the terrain visually more detailed than the intentionally basic 32×32 pixel NPC sprites.

The schema-1 terrain ledger now has `defaults:{material:'grass',elevation:0}`. The loader migrates older save ledgers without clearing authored `cells`, `sectors` or building records. Server tile reads, atlas viewport and JSON export all honor the implicit baseline. Whole-cell grass paint removes a previous ocean/biome fill rather than saving 16,384 grass tiles; fine grass-over-ocean overrides and signed elevations remain separately available. New coverage reports true base grass, painted water and authored/unedited counts.

**Acceptance:** isolated V8 checks passed for baseline edges, 33.3333% ocean fill, returning whole painted cells to grass, undo, fine edits, elevation restore, exact export defaults and migration. `tests/grass-plane-m71.cjs` adds Node API and restart checks, but full Node regression and live browser tests are still required. Old M68 temporary gameplay regions remain technically separate; do not claim their existing art was replaced.

**Next implementation:** connect the replacement world atlas to freely traversable server-owned terrain areas while maintaining sparse green defaults; add safe slope/elevation rules and simple low-detail pixel cliffs after that.

## M70 added whole-world authoring (November 8, 2026)

M70 introduces `server/world-atlas-m70.cjs` and a whole-world editor route `dk-world-architect-m70.html`. A connected browser may open **Options → Persistent World → Open DK Architect** directly, without running through the temple, or **F8 → Logistics → World Pixel Painter** from the older outdoor editor. The atlas samples any world coordinate at 72×72 display blocks, from 1:128 whole-world down to 1:1 tile painting. It intentionally uses hard-edged flat-color pixel blocks matching the project's original 32×32 NPCs; the owner explicitly asked for a UO-inspired but **less detailed** representation, not a polished or 3D illustration.

The M69 terrain ledger now includes optional sparse **`world_grid.terrain.cells`**, keyed by global Streaming Cell (`cx.cy`), permitting one material fill for an entire 128² tile area. Tile-level M69 overrides take priority. Broad cell paints are atomic, revision-checked and saved durably via `POST /api/v1/architect/world-atlas` with `X-DK-Architect: world-atlas`. The server exposes per-sample viewport and approximate authored-water coverage and includes cell records in the terrain JSON export. A broad impassable stroke skips M68 preview cells with active actors, objects or structures, reporting protected cells. No existing authored objects are erased.

**Do not exaggerate scope:** All coordinates are editable from the new atlas, but full world walkability, terrain streaming into new playable areas, height geometry, connected water simulation, cave levels and automated city-building remain future builds. The old M68 four-cell outdoor preview still exists separately. No new graphics were generated.

**Verification:** Source syntax and isolated V8 terrain/cell mock checks have passed; `tests/world-atlas-m70.cjs` adds Node regression cases. A Linux checkout is still needed to run `npm --prefix server test` and visually confirm browser controls and persistence after restart.

**Next:** M71 height-aware world display and walkability/streaming; M72 freshwater/ocean modeling, rivers and coastlines; then cave editing, spawners and material-backed construction.

## What M69 implements, and what it does NOT

The global grid schema now permits 9,216² tile addressing with sparse edited sectors, preserving older 4,096-grid building drafts through migration. `server/world-terrain-editor-m69.cjs` stores tile material overrides and signed heights, edits up to 1,024 tiles per transaction, supports paint/raise/lower/smooth/flatten and explicit restore for undo. It rejects oversized/malformed/out-of-bounds/stale brush requests and obstructing impassable paint. It projects material changes into existing M68 materialized wilderness cells for real collision and browser rendering.

DK Server `POST /api/v1/architect/world-terrain` uses the normal serial writer, validated revision and fsync/checkpoints. GET `/api/v1/world/terrain/sector?sx=&sy=` and GET `/api/v1/world/terrain/export` provide heights and a sparse JSON export, with optional `?cx=&cy=`. DK Architect's Landscape category uses these APIs when connected. `LOGISTICS -> EXPORT SERVER TERRAIN` downloads export JSON. `dk-architect-world-host-m39.js` now hardens RMB held-drag panning and release handling. The server asset allowlist serves the M68 terrain browser module.

**Not implemented in M69:** complete 9,216² terrain materialization, global camera, high-volume ocean-fill tools, full 2.5D slope rendering, physical water simulation, caves, terrain-compatible autonomous NPC founding, construction stage inventories, rare-kiln-durability rebalance, permanent online hosting, or complete UO/WorldBox/Life is Feudal parity. Older M68 generated scenery and three worker-camp fixtures remain on current materialized wilderness, pending user decisions and replacement-world authoring.

## Important code paths

- `server/world-grid-m67.cjs`: atlas schema, 128-tile cell addressing and planned building footprints.
- `server/world-terrain-editor-m69.cjs`: terrain material/height ledger, transactional edits, inspection and export.
- `dk-world-terrain-m68.js`: four deterministic materialized wilderness regions (temporary limited sample).
- `server/world.cjs`: world creation and validation.
- `server/dk-server.cjs`: single-writer process, endpoints, save checkpoints and world simulation integration.
- `dk-menu-server.js`: browser API facade.
- `dk-architect-core-m39.js`: shared tool state; `dk-architect-ui-m39.js`: toolbar; `dk-architect-world-host-m39.js`: overlay pointer controls and editing.
- `server/local-game.cjs`: loopback static asset allowlist.
- `tests/world-grid-m67.cjs`, `tests/world-terrain-m68.cjs`, `tests/world-terrain-m69.cjs`.
- `docs/history/README-through-M68.md`, `docs/history/server-README-through-M68.md`: full old technical README content retained for historical reference.
- `docs/releases/M69.md`: build-specific test/limitation record.

## Verification required before user accepts gameplay

Run `npm --prefix server test` from the full Linux checkout (manual-only workflow). Inspect Console errors and Node logs. Start the connected browser game from the loopback server. In a wilderness region enter F8, select Landscape, drag an ocean/mountain/height brush across a 128-tile boundary, confirm revision increases, verify actual collision and scene refresh, verify RMB pan and wheel zoom, undo, reapply, restart server, export and inspect material/heights. Check legacy area construction tools, placement, rotation, walls, doors, export and undo/redo independently. The old town/temple migration is unresolved and cannot be declared removed from runtime until full integration passes.

## Older M69 next-build guidance (superseded by M70 completion)

1. Build a **dedicated 9,216² world-viewport editing camera** so author is not trapped in four sample regions. Support very large ocean brushes and high-volume rasterless fill while streaming edited cells.
2. Implement height-aware rendering, slopes and ground transitions, not just elevation numbers.
3. Allow coastline/river sculpting with sea level and downhill drainage, beginning with continuous Great River geography.
4. Follow with caves, spawners, construction flattening and resources, then independent NPC civilization formation.

No additional visual assets or revised story scenes should be generated without owner instructions.
