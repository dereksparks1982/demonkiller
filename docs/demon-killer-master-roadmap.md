# Demon Killer | Canonical World, Construction and Simulation Roadmap

**Studio:** DK Softworks  
**Decision record:** November 8, 2026; amended November 9, 2026 (owner's latest map, death, storage, audio, and pause directions)  
**Status:** design authority and staged implementation priorities, not a claim that every feature is playable.  
**Source:** owner-led design sessions; Ultima Online, private-server ecosystem, Life is Feudal: Your Own/MMO, Cities: Skylines and WorldBox were studied as inspiration. Implement independently and verify each external license before reuse.

## 1. Non-negotiable direction

Demon Killer is an engine-independent, browser-rendered, persistent Gothic fantasy RPG. The eventual world is one continuous, physically walkable realm, not a set of decorative map icons. It starts single-player and can consider multiplayer later. All player-visible locations, people, terrain, buildings, and possessions must have meaningful identities in the same simulated world.

**November 9 supersession:** The existing **Lilith transformation town circle IS the village and the anchor of the one 9,216 × 9,216-tile playable world**. Do not retire, duplicate, or relocate the approved willow/temple scene into a separate map merely because an older atlas prototype was created independently. Extend/integrate that authored area into the world itself. **Remove the redundant, separately accessible northern village and the two-world split.** Preserve the approved scene, art, interaction and world simulation, but **do not preserve old development saves**. Earlier statements that retired the courtyard, favored a detached blank atlas over it, or required save migrations are superseded by the owner's later explicit decision. See section 12.

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
- **Current world-integration gate (owner supersession November 9):** make Lilith's circle the village in the contiguous 9,216² atlas; remove separate northern village and duplicate map entry points; redesign affected old-area systems directly. Development test saves can be discarded; do not delay for backwards-compatibility migrations.

Every slice should update technical docs and release notes, add focused regression contracts, test where execution is possible, update the brief user-facing README only when player-facing controls actually change, then commit and verify GitHub. Never claim visual/UI acceptance from source-only checks.

## 11. Working agreements

No builds without an explicit owner directive. User discussions and plans alone do not authorize repository edits. One build at a time; README before release acceptance; separate versioned release notes. Prefer Linux, noninteractive single commands, no browser auto-launch, no passwords, preserve Git history and original art. All future planning docs live in `docs/` rather than turning README into a development diary.

## 12. November 9, 2026: binding scene/world correction and paused build handoff

**Priority/precedence:** These are later explicit owner decisions, overriding older November 8 wording, earlier courtyard-retirement assumptions and suggestions about preserving save files. They apply to the authorized build when work resumes. The owner **stopped all building on November 9 to refresh the browser and leave voice mode**. Until fresh build authorization, do **not** edit gameplay, assets, map geometry, tests or releases. The current request authorizes **documenting decisions and the stopping point only**. This section is a handoff, not a claim of implementation or acceptance.

### 12.1 One world, one real village, one opening scene

- The circle/town square where the red-haired woman (Lilith, the **Queen of the Underworld**) becomes the willow **is the village**. The owner does **not** want a second, redundant village to the north. The circle and its immediate temple grounds are the starting, playable village area, not a disconnected 64 × 64 scenic island or a small side-room attached by portals to a completely separate 9,216-tile atlas.
- **Expand/integrate the existing Lilith circle into the real 9,216 × 9,216, 32-pixel-tile global map**. The player walks out of the temple into that same continuous world. The circle, willow, paths, surrounding settlement/terrain, and temple entrance are authored world tiles and objects on the global coordinate system. Movement away from town crosses Streaming Cells naturally, without a teleport/loading transition into a separate map. The temple may remain an interior scene with a real exterior doorway, not a second outdoor world.
- **Eliminate the separate northern village** as a playable settlement and remove redundant maps/portals/navigation/routes that imply it is another village. Relocate/rebuild any genuinely required NPC services, economic systems and future workplaces at the **actual Lilith-circle village** as appropriate; do not re-create the old northern settlement. Preserve no fake village merely to satisfy current legacy code or test data.
- The global world is **9,216 × 9,216 logical tiles** with sparse terrain/sector/cell storage, **72 × 72 Streaming Cells of 128 × 128 tiles**, and **576 × 576 16 × 16 sectors**. Do not allocate an 84,934,656-element gameplay array; integrate local scene tiles and objects into the sparse world model. Keep cardinal walking and the same physical coordinates for people, NPCs, inventory, corpses, buildings and land.
- Preserve the *approved* town-circle staging and actual tree, though surrounding terrain/buildings are editable by DK Architect and later simulation. The important correction is **extend the intended location**, not throw it away and replace it with a second grass map. The initial world outside the authored town may use the agreed flat elevation-zero grass base for subsequent painting.
- **No old-save compatibility work.** The owner repeatedly and explicitly says that while Demon Killer is in active development, old character saves, inventory snapshots and playtest world saves are disposable. Reset them when required, without seeking approval, designing migration layers, or delaying the requested map change. This binding rule is now in `COMPANY_BIBLE.md` (commit `d86d741483e4d73abc305a3c28918f91256bd9eb`). Do not conflate disposable test saves with source history, approved art, documents or unrelated files.

**Observed repository state at the pause (not a completed integration):** `world-regions.js` still declares `COURT='dk.courtyard.lilith.001'` as a 64 × 64 outdoor region and `VILLAGE='dk.village.001'` as a 128 × 128, now-empty retired region; `world-regions.js` also contains a portal from the courtyard into a materialized 128 × 128 M68 wilderness cell. The separate `world_grid` and `dk-world-explore-m73.html/js` expose the 9,216² atlas and an independent actor-entry workflow. That is exactly the split the owner rejects. Prior stage work removed the *physical old northern village*, but **did not integrate the courtyard as the village in the single atlas**. Do not misreport that as done.

### 12.2 Approved opening, Lilith, and player perception

- The player starts **alive, bound on a sacrificial temple altar**; cult members, a robed priest and ritual prayer precede the murder. The player's body remains on the altar as the ghost appears. This introductory sacrifice is **every player's first death**. Do **not** gate spirit-world content on a later milestone merely for "having died once": everyone has already done so during the introduction.
- The **King of the Underworld** (previously described as the Devil) appears to the player's right and says **"You're mine."** The Queen/Lilith appears to the left. The King flashes out; the Queen remains and physically walks, rather than magically vanishing through the door. The Queen is a Gothic fictional character; do not assert unapproved real-world religious theology or borrow literal mythic identities as canon. Story/dialogue presentation should use the approved large Gothic prayer/dialogue window.
- The Queen kneels and prays, deposits the gold resurrection/soul crystal at the altar, then leaves the temple. The player has control as a ghost and can **double-left-click** the crystal to return to life, or ignore it and remain a ghost. A single click inspects; no automatic resurrection from walking over it.
- **Do not transform the Queen before the player sees it.** When the player exits the temple and gets close enough to her at the town circle, temporarily take control of the camera; pan/follow her to the chosen point, show her prayer and visible transformation, hold the result, and return the camera/control to the player. A one-time opening/cutscene gate should be bound to actual progression, not a timer that transforms her unseen before arrival.
- **Same Queen, same location, distinct living/ghost appearance:** if the player resurrected, the woman may appear in her red-dress living-world presentation and transforms into a **black, diseased/sickly, disturbing weeping willow**. If the player remained dead, she wears the green dress and becomes a **beautiful shimmering/golden willow**. The fixed original approved transformation sequence has six distinctive poses per branch (12 total), with real frame boundaries, not six equally sliced cells that stitch neighboring pixel art onto her. This visual/perception distinction is a foundational clue to the two world-states.
- **Exact owner-accepted tree-click lines, November 9 dialogue selection** (the vanished earlier draft could not be recovered verbatim; the following *reconstructed* lines were read back to and accepted by the owner):
  - **Living / black decaying willow:** “The living fear what they cannot understand. Even a miracle looks like a curse through mortal eyes.”
  - **Dead / golden willow:** “Death does not reveal another world. It reveals the truth this one has always hidden.”
- Show the appropriate full line **when the player clicks the tree**, not merely a generic description. A ghost sees the golden tree; a living character sees the black tree. The prose represents perception, not a second tree or separate copy of the map. One earlier client branch chose a tree's appearance based on *first exit* and cached it; later changes of form must not silently show the wrong spoken line. Design appearance/first-transformation canon carefully and test both branches.
- **Unfinished quality gates from preceding builds:** the camera must visibly take over and play the correct entire Queen scene after leaving the temple; approved woman/willow sprites must display without pieces of old pixel art or frames cut from neighbors; inspect/click must show full conditional lines. Do not mark these fixed without actual browser verification.

### 12.3 Living world and spirit world: same geography, different access

- Inspiration: **the Light and Dark World distinction in Zelda: A Link to the Past**, but Demon Killer uses **the same physical world and corresponding coordinates viewed and interacted with differently while living or dead**, not two unrelated, separate 9,216² maps.
- Ghost form is **not automatically failure**. There should be reasons to become a ghost strategically, and reasons to regain a living body. Some spaces, inhabitants, secrets, paths, history, inscriptions, demons, spirits and quests can be perceivable or reachable **only while dead**. Other objects, trades, tools, work, physical buildings and activities require life.
- Candidate mechanics discussed, to be designed/implemented deliberately rather than presumed complete: a physical wall that a ghost can cross; ghost-only community or NPC conversations; a ruined castle whose former inhabitants/story are legible to the dead; spirit-only text, locked chambers or alternate passages; optional supernatural abilities such as possession **only if separately specified**. The main rule is **spirit-world access creates meaningful gameplay choices without deleting the living-world economy**.
- The living and dead worlds should be persistently simulated server-side, with meaningful interaction rules, rather than browser-only visual filters. A ghost should not freely access, withdraw or manipulate ordinary physical inventory, money or bank/house goods.

### 12.4 Voluntary death, resurrection and physical remains

- Provide a **deliberate in-game option to let the character die/enter ghost form**, rather than forcing them to hunt a monster. The player referenced historical Japanese **seppuku** as a thematic sword-based choice. The proposed name **Ritual Death** and a restrained/non-graphic kneeling/fade animation are working presentation suggestions, not a requirement for graphic depiction. A supernatural soul-separation route could also exist later, including for characters who lack a sword.
- Death **must be consequential**: a later player corpse remains at the actual location with the carried equipment and lootable possessions; physical belongings do **not** automatically follow the ghost. The exact resurrection method, ownership/protection after resurrection, time limits and balance need specification and testing, not shortcuts or automatic equipment recovery. The opening sacrifice/one-time crystal remains its special canonical sequence.
- **Monsters and other living agents must be able to rummage through player corpses**, actually take item quantities/serials, retain/possibly equip them, travel with them, lose them in later combat, or move/sell/trade them within a persistent economy. If a monster takes the player's sword, the owner wants the possibility of hunting that particular monster down and recovering it, or tracking the item after it enters trade. No deletion-and-respawn sleight of hand; use item custody, durable IDs and transaction provenance.
- Physical corpse access, inventory custody, decaying remains, burial, resurrection and monster scavenging need one server-authoritative model. The existing M12/M29/M30 NPC remains and scavenger systems are a foundation, **not proof that player corpses and monster equipment theft already work**. Current combat can incapacitate rather than produce a full player ghost/corpse loop. Ensure the later game connects those systems properly.

### 12.5 Persistent storage, player caches and theft risk

- **Bank:** secure physical item and gold deposits for a living character. Reasonable precautions before entering the spirit world include banking especially valuable items. The existing server bank is a foundation, not the final global network.
- **Homes/buildings:** persistent chests and other storage associated with property, deeds, locks and real ownership; storage security is meaningful and may be breached by thieves. Support player homes and business property in the same simulated world.
- **Player-created caches:** the owner explicitly wants a **Create Cache** action enabling multiple hidden long-lived supply depots throughout the 9,216² world, including discreet wilderness stashes/buried chests/other sensible containers. **Caches do not decay on a timer** and must survive logout and an active server. They are nevertheless **discoverable and lootable** by capable NPCs/monsters/other players if their hiding place or defenses are overcome; permanent does not mean guaranteed safe.
- A **personal cache registry** or map/list of discovered/owned depots may help the player return to them, with optional unmarked/secret locations. The registry should not grant omniscience to thieves, other clients or a ghost. Define reasonable limits/access checks and item serial custody; never use a purely cosmetic map pin as the physical cache.
- Living players can move physical goods between pack, bank, homes, corpses and caches under proximity and ownership rules. A ghost cannot simply withdraw a sword from the bank or recover carried equipment by opening a chest; there must be a meaningful return-to-life path. Dying after stowing valuables provides a strategic trade-off, **not immunity from theft everywhere**.

### 12.6 Music, presentation, testing and original-assets rule

- Temple opening: user accepted the original `The Last Breath` MIDI mood but requested **at least 1 minute 30 seconds**, replacing the prior temple soundtrack for the **entire temple sequence**. Do **not** fall back to old/third-party temple music after Lilith's prayer. MP3 review renders can be supplied for listening; production playback must operate in Firefox, with music transitions governed by the actual scene and browser gesture requirements.
- Overworld: replace the overly cheerful track with **new original, substantially darker Gothic music that loops seamlessly**, appropriate for the world outside the temple. Maintain audible continuity and proper mute/volume settings; avoid unlicensed source assets.
- Respect four cardinal character directions, the approved sprites, pixel scale and minimal animation. No extra strips of old art should show through the human/ghost/Queen character. The approved 12-frame willow sheet needs measured, individually bounded cells with both rows and all progression stages visually validated.
- The finished build must test **both** life choices from the beginning through the temple door to the circle; verify the camera pan/prayer/visible transformation, tree appearance and spoken line, reentry, no premature trigger, world-border movement, no second village, player corpse/inventory state, monster theft/custody, cache persistence and theft, save/load from fresh disposable test data, and original soundtrack behavior. Source tests do not substitute for on-screen confirmation.

### 12.7 Related already-approved long-range systems, not to be omitted

- In the integrated world, implement **autonomous human NPC society** that can found settlements and independently gather, farm, build, mine, craft, patrol, trade, hire, maintain and adapt, even when the player is away. NPCs are not merely static vendors or multiplayer substitutes. Server simulation continues while the server actually runs; a publicly hosted always-on server is **not yet implemented**.
- Full **player-owned persistent enterprises**, beyond an Ultima Online vendor stall: procurement, skilled labor, real equipment, hands-on production (e.g., grind grain in a flour mill and bag flour), manager/assistant delegation when the player leaves, sales, pricing, inventory, security, equipment breakdown, staffing, customers, logistics and financial ledgers. Players must be able to do the work personally or pay capable NPCs.
- **Life is Feudal-inspired construction**, improving on the original: manually flatten/grade real ground, preview an actual footprint with blocked/uneven/valid cells and elevation, place a staged foundation, haul and store specific building materials at the site, use tools/labor to progress visible phases and determine quality, or employ NPC builders. Forestry should regrow, earth/soil should be conserved, mines should require support/collapse logic. Buildings aren't decorative insta-spawns.
- **Dynamic territory control:** settlements and even cities never personally captured can suffer monster attacks or fall; liberated places can be retaken while the player is offline. AI towns, refugees, businesses, defenses and territory changes persist independently under the running authoritative server. Player and NPC actions create consequences. Preserve UO-style deep interaction with significantly richer world simulation and DK Architect authoring.

### 12.8 Build state, next steps and stop condition (do not confuse intentions with results)

- **Confirmed documentation change before the stop:** `COMPANY_BIBLE.md` was committed and reread at `d86d741483e4d73abc305a3c28918f91256bd9eb`, explicitly making old development saves disposable and documenting the single-world village direction.
- **No completed or verified code integration in this interrupted work session:** Inspection found existing code paths, but the latest `world-regions.js`/atlas split remained. The fresh map integration, northern-village removal from active runtime, new tree-click lines, strategic player death, monster theft, caches, and complete soundtrack replacement **have not been implemented and tested by this stopped session**. The previous version's README may describe prior partial willow/audio fixes; do not mistake that for verified satisfaction of this latest request.
- **Next authorized build order, subject to the owner's next instruction:** (1) make the existing town circle the actual continuous atlas village with all 9,216² coordinates; retire duplicate village and disconnected outdoor transitions; (2) wire the Temple exit/Queen cinematic and both exact tree lines and fix sprite bleed; (3) implement server-owned voluntary ghost transition and lootable player remains, monster item theft and resurrection paths; (4) nondecaying discoverable caches integrated with bank and house custody; (5) complete original temple/overworld scores, browser verification and regression checks. Maintain earlier autonomous-NPC/building/business/territory roadmap.
- **User's final instruction of this conversation:** **STOP building and document everything in the roadmap so the browser can be refreshed and voice mode exited.** This pause is binding immediately. Do not quietly resume, commit a gameplay change, or claim a build was finished. Resume gameplay work only after the user explicitly authorizes it in a later turn.
