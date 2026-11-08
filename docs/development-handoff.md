# Demon Killer | Developer Handoff (November 8, 2026)

This document is the working continuity reference if a conversation thread fills. Read `docs/demon-killer-master-roadmap.md` first for the current owner-approved direction, then the release-specific files.

## Source and release discipline

Repository: `dereksparks1982/demonkiller`, branch `main`. Studio DK Softworks. The current M70 release target is game **0.2.68**, server **2.31.14**. Do not assume that source verification equals passed end-to-end gameplay. GitHub Pages runs a static preview. The Node authority is currently loopback-only by design and does not expose a public persistent hosted world. The existing server advances NPC life only while its process is running.

Do not build until explicitly instructed. When authorized: inspect current HEAD, one build at a time, document then create tested code, update release notes, commit/push/verify; no automatic browser launches or password prompts.

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
