# Demon Killer | Canonical World, Construction and Simulation Roadmap

**Studio:** DK Softworks  
**Decision record:** November 8, 2026  
**Status:** design authority and staged implementation priorities, not a claim that every feature is playable.  
**Source:** owner-led design sessions; Ultima Online, private-server ecosystem, Life is Feudal: Your Own/MMO, Cities: Skylines and WorldBox were studied as inspiration. Implement independently and verify each external license before reuse.

## 1. Non-negotiable direction

Demon Killer is an engine-independent, browser-rendered, persistent Gothic fantasy RPG. The eventual world is one continuous, physically walkable realm, not a set of decorative map icons. It starts single-player and can consider multiplayer later. All player-visible locations, people, terrain, buildings, and possessions must have meaningful identities in the same simulated world.

**The old sacrificial temple, courtyard, and village layouts are retired as the design basis for the rebuilt world.** Do not reproduce those buildings, map layouts, or artificial settlement arrangements. Existing M68 legacy modules/records can remain temporarily **only** because NPCs, commerce, opening events, migration, and old tests still depend on them. Preserve historical code and saves safely; remove those dependencies by an explicit migration, not silent deletion.

Build functionality and world authoring first; do not generate unsolicited map pictures or premade scenery.

## 2. Actual world size, topology and Streaming Cells

- **9,216 × 9,216 playable logical tiles**: 84,934,656 possible locations, 32 pixel units per original top-down art tile.
- **72 × 72 Streaming Cells**, each 128 × 128 tiles. **576 × 576 sectors**, each 16 × 16 tiles. No massive 85-million-entry in-memory raster.
- Four cardinal movements; adjacent cells share exact world coordinates so crossing boundaries never teleports the actor.
- Terrain edits, world events, object IDs, NPCs, inventories, plants, corpses, constructions, and spawners persist under authoritative server ownership.
- Sector streaming and near-player rendering must remain independent of offscreen server simulation. Remote entities still age, work, travel and respond to events while the server process runs.
- World edges must be technically extendable later, including any future expansion beyond 9,216 tiles.

**Important implementation distinction:** M67 established a sparse global coordinate plan. M68 materialized just four 128 × 128 wilderness regions and kept old regions temporarily for story/economic compatibility. M69 begins sparse global terrain edits and upgrades bounds; the entire 9,216 map is **not** already materialized, walkable or fully rendered.

## 3. Geography and water

The geographic model is **loose Doggerland inspiration**, not a historical reconstruction. A believable original continent continues toward the eastern mainland with ocean on the western side. Aim for **about one third of the world being water**; this is a design target, not an automatically seeded sea across current saves.

Biomes and features: ocean/deep and shallow water; shelves, beaches, cliffs and islands; one vast navigable **Great River** modeled conceptually on the Amazon's role as a transportation artery; credible highland watersheds, tributaries, lakes, marshes, reedbeds and floodplains; fertile plains and coastal lowlands; forests and managed woodland; foothills, mountain chains and high plateaus; northern glaciers and valleys; underground caves and mines.

Rivers follow physical drainage into broader streams, lakes and the sea; valleys, bridges, waterfalls, ports and seasonal water effects should follow the same geometry. Water bodies are not just a blue texture. Eventually they need depth, current, navigability, swimming, boats, fishing, water mills and trade routes.

The world **must NOT** arrange settlements in a geometric six-pointed star. Planned inhabited topology is one large capital city, five additional major towns, three villages, and three distinct worker camps. Only the six major settlements have faction/town sigils. Place settlements naturally for terrain, mineral deposits, harbors, roads, rivers, agriculture, and strategic passes; plans are subject to simulation rather than fixed town prefabs. One river port should be a vital trade center.

## 4. DK Architect: Prison Architect + Cities: Skylines

Use one coherent editor, retaining the existing compact, category-driven Prison Architect-inspired construction UI, with Cities: Skylines-style sculpting and on-map feedback. No requirement to paint external Photoshop/GIMP bitmaps or import DragonMod color-palette files.

**Mouse contract:** LMB press/drag applies the current brush or places an object; RMB hold-and-drag pans; mouse wheel zooms the terrain camera when not rotating the current placement preview; no diagonals. A visible brush footprint should show size and validity. The author can zoom out to a broad world overview or zoom in to inspect single 32px tiles.

Editor tools to implement incrementally:

1. Terrain material brush: ocean, river, grassland, forest, marsh, sand/beach, rocky land, snow/glacier, paths and transitional materials.
2. Elevation: raise, lower, smooth, flatten to chosen reference height, grade slopes, carve valleys; make mountains stronger visually than UO's.
3. Water: continuous ocean painting, coastline preview, sea-level adjustment, carve/flow rivers, riverbeds, tributaries, lakes and marshes.
4. Geology: mountains, ridges, cliffs, mine entrances, passes, caves, underground levels, slope/collapse checks.
5. Construction: real custom building footprints; walls, floors, roofs, doors, furnishing, roads, bridges, wells and multistory/underground layouts; rotated previews and undo/redo.
6. Simulation: edit spawner regions, NPC roles and instructions, territories, events, ecology, roads and navigation permissions.
7. Export/import and inspection: world snapshots, cell chunks, elevation/material legends, version metadata, undo/history and terrain corruption detection.

**Server flow:** When the author commits a brush stroke, the editor sends an allowlisted revision-checked operation to the authoritative server. A successful response means it has been durably saved and checkpointed; a stale revision must block instead of silently overwriting another edit. In connected play, refreshed cells display new terrain. A server-exported JSON/portable snapshot must contain the exact world coordinates, height values, terrain materials, water-related fields and cell partitions so the owner can share the export for review.

Terrain geometry must be stored separately from static structures and dynamic simulation records. Editing water must never arbitrarily delete an NPC, building, inventory or spawner. Reject edits that would trap occupied tiles or destroy protected foundations unless explicitly handled as demolition.

## 5. Visual terrain model

Take inspiration from Ultima Online's elevation-aware terrain and sprite composition, not its dated mountain appearance. Prefer **2.5D**: real height values, top-down or slightly projected terrain surfaces with cliffs, slopes and coherent shading, while characters remain lightweight 2D sprites. The main gameplay camera stays straightforward overhead rather than converting the whole project to isometric.

Aim for believable foothills, ridgelines, high plateaus, deep cuts, shadows, snowlines, cliff texture and mountain passes; mountains must be traversable and explorable where the geometry permits. Keep terrain transitions continuous across cell seams and art original or clearly commercially licensed. A specialist elevation preview in DK Architect is allowed, but not a mandatory isometric game camera.

## 6. Life is Feudal-inspired physical building

Life is Feudal's central idea was good: actual ground work and resource-backed construction. Improve its execution by giving the player functioning NPC labor, meaningful choice, and less repetitive micromanagement.

**Construction sequence:** inspect site and building footprint → require stable ground and tolerable slope → dig, grade and level/terrace the location → reserve a real construction site/foundation → deliver original serial-bearing logs, planks, stone, clay, mortar, iron parts, nails and machinery as appropriate → workers physically perform foundation, frame, walls, roof, finishing and equipment stages → completed building becomes usable, ownable, rentable and operable.

Each construction site is a durable world object with explicit stages, genuine material inventory, delivered provenance, quality, contractor/worker assignment, wage debt, progress and construction time. Build work requires actual time and workers; the player can personally carry and assemble supplies or delegate to an employee/foreman, who continues work when the player is gone, only while the world server is running. Missing money, labor, materials, safe paths, tools or access can halt the job.

No building is granted automatically by a decorative editor preview, an abstract countdown or an NPC plot-selection whim. NPC-created settlements obey the same terrain, resources and construction laws as player settlements.

**Durability rule:** Kilns, ovens, mills and similar heavy installations should last years of meaningful work, not become broken after a few crafting attempts. Rare wear, catastrophic misuse, fires, sieges, geological events and occasional genuine accidents can damage them. General upkeep is sensible, not a mandatory repair treadmill. Older M50/M66 wear/rebuilding mechanics must later be rebalanced to this design.

## 7. Resources, labor, ecology and transport

Give meaningful jobs and dependencies to lumberjacks, sawmills, carpenters, miners, quarry workers, masons, smiths, teamsters, fishers, farmers, breeders, bakers, merchants, boat crews, guards and clerks. Forestry has planting, regrowth, yields and depletion; mining has ore quality, tunnel support and possible collapse; farming has soil and seasons; livestock needs physical food and shelter.

Physical ownership and serials persist through cargo, tools, goods, warehouses, carts, riverboats and stores. The Great River is a practical navigation/trade highway, not scenery. Businesses are hands-on enterprises with managers who can operate them in the owner's absence. Supplies, competition, transportation, prices and wages matter. Build contracts and bulk orders create demand without fabricated wealth or items.

## 8. Autonomous civilizations, WorldBox inspiration without repetition

The owner can seed a chosen number of starting NPCs in wilderness and give them broad initial aims, but their societies must not degenerate into random limitless building and perpetual war.

Simulated people have distinct skills, livelihoods, resources, relationships, beliefs, goals, temperaments, memories, property, roles and mortality. A settlement requires reliable water, supply chains, viable land, a food reserve, safe access and an actual construction economy. The NPCs may choose leaders, make local rules, trade, disagree, secede, found rival settlements, negotiate, form guilds and factions, wage wars, suffer occupation, evacuate, rebuild and eventually change history.

**Variety requirement:** Cities should develop different identities because of geography, professions, leadership, trade, religion/culture, local scarcity and past conflicts. No repetitive town blob or simplistic consume-everything-then-fight loop. Peace, alliances, commerce, faction division, social dissent, natural disasters and multigenerational change all need to be possible, with war not the only end state.

Players may remain outsiders or join institutions, buy/rent property, run companies, intervene in politics, fight, trade, establish a home, or just observe changes. Autonomous NPC society is essential even for a solo player. It must not require other humans to fill basic occupations, as was a major perceived shortcoming in Life is Feudal.

## 9. Ultima Online private server and tool research catalog

Every entry below is a **research and integration candidate**, NOT a completed import or unconditional approval to copy code. Inspect source, active maintenance, dependencies, license, IP and commercial compatibility individually. Prefer proven algorithms under permissive terms, otherwise independently implement the concepts. No UO artwork or RunUO/ServUO GPL code is to be copied into proprietary code without appropriate licensing.

**Top priority:**
- **Nerun's Distro / Premium Spawner:** scalable world and dungeon population, administrative tooling, spawn region definitions.
- **Daat99's OWLTR:** treasure maps, rare material grades, loot, resources, craft complexity.
- **RoninGT's FS Animal Taming System (FS-ATS):** taming, training, breeding, pet progression/evolution.
- **Xanthos Evo / Shrink:** pet evolution, stable identity, ownership, training and portable/managed companions.
- **Knives' Town Houses:** convert suitable structures to usable houses, titles, rental, permissions and upkeep.
- **Knives Chat:** durable communication channels, society/guild messages and possible eventual multiplayer.

**Landscape and authoring references:**
- **CentrED / CentrED#:** editing ground, height and static landscape.
- **Dragon / DragonMod / DragonSP:** palette-driven terrain generation and smart transitions (concepts absorbed into DK Architect, not the external Photoshop workflow).
- **UO Architect, UO Builder:** reusable building designs, on-site assembly, permits and construction plans.
- **UO Landscaper and MapCreator:** heightmaps, terrain classification, reference-only map workflows.
- **Pandora's Box:** integrated building and GM controls.
- **UOFiddler:** item art catalogs, tile and property definitions.
- **UltimaLive:** applying changes to live world clients.
- **SVDungeon:** seeded layouts, traversable caves, tunnels and dungeon generation.
- **Custom Regions in a Box:** protected areas, factions, overlapping rule regions.

**World simulation references:**
- **XmlSpawner2, UORespawn:** configurable conditional spawn areas, ecology, world triggers and quests.
- **Ultima Odyssey, Ultima Adventures, Shards of Minax:** exploration, professions, AI-driven factions, mortal consequences and persistent history.
- **Vita-Nex: Core:** modular hooks, services and event composition.
- **ServUO, ModernUO, RunUO:** persistence, entity identities, NPC behavior, game systems and background scheduling as architectural reference.
- **Bulk Order Deeds (BODs):** real resource-backed craft contracts, quality checks and merchant work.
- **ClassicUO, Razor, UOSteam:** client controls and ergonomics, not server-world features.

Additional UO principles worth reviving: single-world Felucia-like risk rather than Trammel/Felucia parallel maps, town sigils only for six major settlements, stealable/contestable faction sigils when appropriate, territory changes and forgotten social/professional mechanics. Use proper player and NPC justice systems, not accidental exploit-based griefing.

## 10. Planned implementation order and build acceptance

**Delivered before this plan:** M67 sparse original 4,096 atlas and building drafts; M68 four walkable overhead wilderness regions, still with legacy story/economy compatibility; many earlier NPC/combat/economy/streaming prototypes. Full RunUO parity and the live new atlas remain unimplemented.

**M70 whole-world pixel painter slice:** directly connected DK Architect atlas, sparse whole-cell ocean/biome fill, 72×72 live world preview down to individual tiles, pixel art deliberately no more detailed than the 32×32 NPCs, server saves, coverage, undo/redo and exports. Coordinates are editable globally, but nonmaterialized world regions are not yet fully playable. Protected legacy M68 cells must not be erased accidentally.

**M69 first slice:** enlarged sparse world topology (9,216²), terrain material/height ledger, revisioned server saves/exports, basic landscape brushes in currently materialized wilderness, improved editor right-drag and technical README relocation.

**Then, in dependency order (numbers are provisional):**
- **M70 delivered foundation:** whole-world DK Architect viewport, zoomed-out navigation, giant ocean/biome cell brushes, server-authored sparse terrain outside the four M68 regions and authored land/water coverage counters. Gameplay streaming into those unmaterialized regions remains pending.
- **M71 delivered:** flat grass at elevation zero across all 9,216² coordinates, implicit server default and reversible sparse edits. Authoring foundation only; old M68 runtime remains.
- **M72 delivered terrain-walk foundation:** server-persisted surveyor crosses any atlas Streaming Cell boundary, samples surrounding 25×25 ground/elevation, obeys water/cliff/building/height constraints and uses original human directional sprites in an independent top-down walking view. This is not yet the main character or autonomous NPC simulation in the replacement atlas.
- **M73 delivered initial character/NPC bridge:** Real character slot one now holds optional atlas position and can walk the global grass world with existing identity, inventory and skills. Separately tracked atlas NPCs have bounded independent server-clock movement and deliberately selected spawn positions. Development saves may be reset rather than carrying legacy structures along. The legacy area_id remains for modules not yet migrated, and the new NPCs do not yet produce economies or settlements.
- **M74:** Remove the old-area dependence from player/NPC item interaction and sector queries, then add minimal low-detail pixel cliff/shore transitions. Keep all terrain authored in DK Architect and every simulated actor under server authority.
- **M75:** Expand height-aware walking/collision and deliberately low-detail pixel cliff/slope transitions with seam checks. No 3D terrain meshes or visual polish that conflicts with the 32×32 NPC sprites.
- **M76:** Water depths, ocean and river-carving tools, flowing connected Great River, tributaries and coastline transition rules.
- **M77:** Underground cells, cave entrances, mines, tunnels, supports and collapse ecology.
- **M77–M78:** Nerun/XmlSpawner2/UORespawn-inspired region spawners, habitats, seasons, wandering, conditional events, persistence.
- **M79–M80:** Life is Feudal-inspired terrain-footprint validation, soil excavation, leveling, foundations, staged material delivery, active construction labor and durable heavy equipment.
- **M81–M83:** Quality-based economy, OWLTR/BOD jobs, logistics, forestry, mining/farming, worker camps, carts and river commerce.
- **M84–M85:** FS-ATS/Xanthos animal lineage, husbandry, taming, breeding, companion training and care.
- **M86–M88:** Knives' Town Houses, UO Builder properties, rental, player-owned constructions, independent NPC companies and worker delegation.
- **M89 onward:** Autonomous city founding, political disagreements and secession, differentiated settlements, meaningful diplomacy/war, refugees/rebuilding, Knives Chat and extensible world events; conclude with integration and acceptance tests.
- **Legacy migration gate:** retire the former temple/village runtime after old economy, character, creature, inventory and save dependencies have been migrated or explicitly reset by the owner.

Every slice should update technical docs and release notes, add focused regression contracts, test where execution is possible, update the brief user-facing README only when player-facing controls actually change, then commit and verify GitHub. Never claim visual/UI acceptance from source-only checks.

## 11. Working agreements

No builds without an explicit owner directive. User discussions and plans alone do not authorize repository edits. One build at a time; README before release acceptance; separate versioned release notes. Prefer Linux, noninteractive single commands, no browser auto-launch, no passwords, preserve Git history and original art. All future planning docs live in `docs/` rather than turning README into a development diary.
