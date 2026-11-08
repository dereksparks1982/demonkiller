# Demon Killer

Demon Killer is a Gothic fantasy RPG by DK Softworks, built with original top-down pixel art, Streaming Cells and an independent persistent-world server in development.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

## M68 | Walkable top-down wilderness replaces the former village

**The only previous building carried into the playable world is the Forsaken Temple.** Its original 16×16 interior remains. The surrounding 64×64 temple grounds have been cleared of all four houses, market stalls, well and the old village gate. Lilith's willow and the temple entrance remain because the opening sequence still uses them. The former 128×128 village has **no buildings or streets and cannot be entered from the temple**. A retired server area identity and older NPC/business records remain temporarily for compatibility with M66 systems; they are not imported as playable settlements. Future builds must migrate those economic records before removing the legacy ID completely.

**Real terrain, not a picture.** The four connected 128×128 wilderness regions represent **256×256 walkable 32px tiles**, or 65,536 actual terrain positions, on M67's 4,096×4,096 master grid. Their precise M67 cell identities are **dk.cell.world.12.14, 13.14, 12.15 and 13.15**. The same existing 16×16-sector browser streaming applies inside each region. Terrain and roads are deterministic from global coordinates, so they continue across sector and region edges. Inland terrain includes forests, heath, highlands, cliffs, northern glaciers, a branching river system, a lake, southwestern wetland and a western ocean shore. Seas, cliffs, boulders and deep water block walking; roads and bridges are physical tiles. No 16-million-tile browser allocation is made. The remaining parts of the master world have **not** been populated yet.

**One-tile borders:** Cardinal movement crosses wilderness region edges without diagonal steps. An actual northbound connection links the retained temple grounds to the southwest wilderness region. The previous village gateway is gone. All three requested worker camps are represented by full-size inspectable overhead pixel-tile footprints: a timber camp, quarry camp and marsh camp. They are terrain fixtures in this slice, **not yet staffed business simulations**. No capital, towns, or villages are fabricated before their detailed design.

The approved existing character images, temple scene, Lilith sequence, DK Architect, music and mouse controls remain in the browser game. This build adds shared browser/Node terrain code, physical overhead tiles and eight regression contracts. Syntax and targeted movement/geometry simulations passed; the entire Node suite and a full live browser acceptance run remain outstanding.

## M67 | Empty replacement-world grid and editable building foundations

The existing temple, courtyard and village layouts are **retired from the design of the replacement world**. M67 adds a separate, server-saved, initially empty **4,096 × 4,096 tile grid** with 32 px logical tiles, 16 × 16 terrain sectors and 128 × 128 Streaming Cells. The new grid has **zero imported structures or scenery**. Global coordinates, cardinal steps, cross-cell bounds and draft structure footprints are implemented without allocating millions of tiles or generating a new map illustration.

A draft building footprint may straddle sector and cell borders; overlaps, invalid coordinates and corrupt save records are rejected. These are **plans, not instantly built or player-usable structures**. No construction materials are fabricated, no economy rules bypassed, and no new client write commands are exposed. Read-only `GET /api/v1/world/grid` and `?x=128&y=128` report the replacement grid and coordinate addressing.

**Transition limitation:** The existing browser game and M66 economy still require the legacy named regions. Their content is not imported into the new grid, but remains in the legacy runtime during migration. The new location and opening story will be rebuilt later, with no new artwork or replacement scene in M67. Tests cover grid addressing, movement, drafts and old-save migration.

## M66 | Physical rebuilding with serialized materials and paid crews

A monster occupation now leaves **physical damage records against actual shop and service buildings**. M65's recovery ledger cannot declare peace merely because residents return and a business briefly opens: every damaged site must also finish reconstruction. The normal shop-hour and manual production rules keep damaged workshops, the mill and destroyed storefronts closed until their structural condition is restored. Existing M50 equipment breakdowns remain separate from building damage, so a rebuilt smithy may still need a machinery repair.

**Construction is real server work, not a timer that manufactures resources.** Each region receives one saved work order at a time. The village blacksmith and courtyard caretaker can be assigned to the reconstruction site. The worker walks to an actual supply storefront, takes **two wood and one tool** from serialized vendor stock into a persistent NPC cargo backpack, travels through the ordinary cardinal pathfinder to the damaged building, and works there for **30 simulated minutes** before restoring at most **25 structural condition**. Goods are consumed only when that work finishes. The damaged business pays the supplier its actual price and pays **6 gold wages** on completion, so the purchasing business loses money, the supplier earns money and the worker receives wages. A shop supplied by itself has no artificial self-payment. Historical work orders, construction costs and condition changes are saved.

The village smithy already gathers wood and produces tools through the existing resource harvesting and workshop systems. When the blacksmith has an active harvest trip, harvesting takes priority so reconstruction cannot starve its own supply. The courtyard needs genuine supplies stocked at its market, creating a meaningful logistics problem rather than imaginary deliveries. A closed shop, fleeing supplier, hostile occupation, absent/dead worker, insufficient stock, unpaid wages or disabled player-business assistant can interrupt construction. A killed carrier's actual paid freight stays recorded under their NPC custody; a future worker must acquire new resources. No owner-controlled business is silently debited when its assistant is disabled.

**Read-only diagnostic:** `GET /api/v1/reconstruction` reports damaged sites, contracts, supplier materials, worker condition, money spent and recent events. No additional HUD buttons, imported art, cutscene edits or save resets. Existing browser play remains on GitHub.

## M65 | Integrated siege recovery and authoritative per-minute simulation

**World catch-up fix:** Every simulated minute now updates the authoritative `living.minute` before the NPC, combat, economy, scheduling, and event work for that minute. A runtime drift guard prevents future regressions. This makes multi-minute simulation batches consistent with small successive time advances, so healing, traffic, saving and world clocks no longer refer to different minutes within the same tick.

**Settlement campaign ledger:** Courtyard and village each have a persisted `peace → occupied → rebuilding → peace` history, based on real territorial control, refugees, living residents, guards, remaining hostiles, and operating businesses. Occupation and liberation are recorded once, while a destroyed town cannot be marked recovered simply because the monsters disappeared. Recovery requires at least **90 safe world minutes**, all surviving civilians back from displacement, and at least one actual shop operating if businesses exist in that region. Deaths and displacement remain recorded; nothing is resurrected, restocked or teleported just to satisfy the ledger. The same authoritative tick logs the transition. Player-triggered liberation between scheduled ticks remains savable.

**Medical service integrity:** A shop marked open is no longer sufficient to treat an injured guard when the actual employee is dead or has fled. Medical purchases still require the original physical goods, personal gold, inventory serials, and proximity. This prevents M62 care from ignoring M63 evacuation.

Read-only development status: `GET /api/v1/settlements/campaigns`. Nine integrated regression contracts join the existing 32 M61–M64 cases. The standalone browser-playable game, controls, sprites, music and opening scene are unchanged.

## M64 | Collision-aware NPC traffic and streaming-world movement

All server-controlled mobile routes now use the existing **cardinal pathfinder with actual actor occupancy**: living characters, NPCs, monsters and companion animals can no longer choose the same tile as another mobile merely because the terrain itself is passable. Ghosts remain intangible. Crowds can navigate around blocked streets and stop adjacent to occupied targets; **portals refuse movement when their arrival tile is occupied**, so characters wait rather than overlap or teleport through one another.

A saved traffic ledger tracks each NPC's position, actual steps, repeated blocked attempts and congestion alerts. Events are throttled to avoid flooding the world archive, and old world records gain missing traffic data without changing NPCs. Refugees from M63, sentries from M61, caravans, citizens and traveling workers use the same real movement constraints. No new UI buttons; diagnostics only at read-only `GET /api/v1/traffic`.

## M63 | Civilian evacuation, displacement and homecoming

Civilians no longer continue ordinary work as though nothing happened when their settlement falls. The server saves each noncombatant's evacuation state, origin, temporary shelter, arrival and return dates. Surviving residents flee toward a different **actually safe** region via the existing walkable **courtyard/village gates**, never by teleportation. Camps have distinct assigned tiles, and refugees wait until their home territory has stayed safe for **90 simulated minutes** before attempting to return to their actual home positions. If both regions are occupied, civilians become stranded rather than materializing in an imaginary safe city. Death while displaced is irreversible and counted once.

Guards and caravan escorts remain on their existing M61/M24 defensive/escort duties. Shop staffing and NPC routines use the actual current locations of displaced workers, so trade and production can be interrupted by an invasion. Returns resume existing jobs without inventing a new NPC or rewriting company titles. Current-world migration preserves existing NPC records. Read-only server diagnostics: `GET /api/v1/refugees`. No additional play-screen buttons.

## M62 | Paid medical care and physical garrison supplies

Guards and escorts wounded in battle now seek an **actual staffed, open storefront** when treatment is available and affordable. Their recovery is not a free world-tick heal: village market bandages, tavern meals or courtyard herbal supplies are physically consumed by serial, while actual NPC coins transfer into the shop treasury. A medic's supply stock and the buyer's position must be valid. Player-operated businesses requiring personal service are not bypassed. Occupied settlements, closed shops, exhausted stock, missing money and distant patients prevent treatment.

The server records medical transactions and accumulated care in a validated garrison ledger. Guards can travel toward viable care through the existing cardinal NPC navigator. Sentry defense, faction succession, normal NPC commerce and workshops share the same item registry. No extra play-screen buttons are added. Read-only diagnostics: `GET /api/v1/garrison`.

## M61 | Persistent settlement guard watch

Guard and escort NPCs now keep real server-owned duty records, alarm targets, combat counters and last-action minutes. A sentry spots a hostile through the actual area terrain, shares a recent alarm with nearby colleagues, advances toward the enemy on navigable cardinal ground, and strikes within melee reach. Badly wounded guards withdraw from attacking; the existing citizen/NPC succession system can recruit a successor when a guard dies. Strikes occur at most once per guard per five-world-minute combat step; a duplicate tick or browser reload cannot invent extra attacks. Deaths use the **same combat corpse, loot, territory liberation and decay system** as player kills.

Read-only `GET /api/v1/guard-watch` reports nearby sentries, alarms, attacks and kills. There are **no client guard-damage commands** and no additional HUD buttons. M60's persistent monster AI and M59's spawn ecology remain active. Saved M60 worlds gain missing guard-watch records non-destructively.

## M60 | Classic UO controls, War Mode and creature intelligence

**Tab** and **Alt+C** toggle a persistent **War / Peace** stance. Creature double-clicks inspect in Peace Mode or initiate an attack in War Mode; pressing **T** selects the nearest visible hostile and **L** repeats the last selected target attack. The existing **right-mouse movement, left-click inspection, double-click interaction, P paper doll, I backpack, C cult dossier, B burial and F8 Architect** remain. Both the temple and overworld now understand the common UO keyboard controls:

| Shortcut | Demon Killer behavior |
|---|---|
| Tab / Alt+C | War / Peace mode (saved on the server character, or browser-preview character) |
| P / Alt+P | Paper doll |
| I / Alt+I / Alt+D | Backpack |
| Alt+K / Alt+S | Skills / character status |
| Alt+J / Alt+R | Journal / radar map; repeat Alt+R to enlarge |
| Alt+B | Spellbook |
| Alt+O | Music options |
| Alt+Enter | Browser fullscreen request |
| Alt+X | Confirm return to title screen |
| T / L in War Mode | Select nearest hostile / attack selected last target |
| ? / Escape | Keyboard reference / close the shortcut window |

Shortcut windows appear only when requested. The play screen gains a small **WAR / PEACE** status label, **not another action-button toolbar**. Movement, game editing, Lilith's cinematics and item double-click meanings remain intact. Features without a working authoritative action, such as NPC PvP attacks or UO speech macros, are not simulated as fake controls.

**Monster AI** now maintains each creature's saved home position, current behavioral mode, last known target location and sighting time. Creatures pursue visible targets, search briefly after losing sight, withdraw when seriously injured and return toward home rather than chasing across the entire world. Server read-only diagnostics: `GET /api/v1/monster-ai`. Existing monsters migrate without losing identity, loot or location.

## M59 | Persistent creature spawning and regional ecology

Demon Killer's world now has four server-owned **creature spawners** for courtyard/village wilderness and monster-held territory. Spawn schedules, created counts and liberation cooldowns are saved as world data; viewing the map or reloading cannot reset timers or manufacture enemies. Wild creatures appear only when regional threat is high enough. Occupied towns receive an initial siege wave and bounded reinforcements, while clearing the last hostile grants a two-hour-in-world grace period even if the area is conquered again immediately. Spawn placement respects cardinal terrain, living NPCs, the player and other creatures. A read-only `GET /api/v1/spawners` reports population, caps and next scheduled time for diagnosis. Existing characters, shops, physical loot, corpses, scripts and opening cinematic remain unchanged. This follows RunUO's durable-world design principles without importing RunUO code.

## Original MIDI score | M58

**Title screen:** *The Oath Beneath the Ashes*, an original 78 BPM dark-fantasy score (church organ, distant choir, funeral bells, strings and ritual percussion). **Overworld:** *The Land Beyond the Altar*, the owner-approved original 114 BPM exploration theme. Both are committed as editable Standard MIDI Files in `assets/audio/music/` and played locally using `dk-midi-soundtrack.js` with Web Audio, without downloading a soundfont or an external service. The menu's saved **Music** toggle and volume setting carry into the courtyard, village and other outdoor regions. Audio begins after the browser permits playback, resumes when a player interacts, and stops on page exit. The existing Forsaken Temple soundtrack is separate and unchanged. No additional gameplay buttons were added.

## One DK Architect, real saves and the opening ritual

Press **F8** or **ARCHITECT** in the temple or outdoors to use the same Prison Architect-style construction menus. The browser preview stores local map drafts that can be exported as JSON. The first temple exit shows Lilith's prayer and the **approved** golden ghost-world or black living-world weeping-willow transformation.

**M57 first-exit repair:** Leaving the temple for the courtyard now plays the complete approved Lilith sequence: the camera follows her north, she prays visibly, the owner-approved green/golden or red/black six-stage willow transformation runs, and the camera returns before control is restored. Characters remain hidden during the scene. The 12 panels come from the original archived art, not new drawings. Existing saves receive one opportunity to see the restored scene despite the old premature completion marker. A local running DK Server is required for persistent-world state.

The paper doll has Ultima Online-style commands, without destructive save buttons. **Main Menu → Options → Save Management** separates character deletion (world preserved), server-world reset (requires an actual connected server) and Start Fresh (browser-only on GitHub Pages).

## DK Server M41–M56: Sixteen connected gameplay slices

- **59 trainable skills**, 100.0 individual/700.0 overall caps, groups, training locks and existing-save migration.
- **Seven persistent monster species** with different strengths, patrols, NPC threats, loot and decay.
- **Active field skills**: tracking, hiding, anatomy, forensic evaluation, meditation, Spirit Speak and Animal Lore.
- **Magic**: mana, reagents, cardinal line of sight, Magic Arrow, Fireball, Heal, Protection and Night Sight.
- **Monster bounties**: real shop-issued quests; player kills counted and rewards paid from existing business funds.
- **Tameable wolves**: feed, follow, guard, stay, release, fight and leave persistent remains.
- **Grain milling**: harvest grain, grind it into grist, sack flour, and bake bread. Player or physically present NPC baker can run the work; wages, ingredients and serially tracked goods are real.

- **Real player-owned shops**: acquire an existing business from its NPC proprietor, manage budgets, prices, inventory and assistant staffing, and serve actual NPC shoppers while at its counter.
- **Hands-on workshop production**: manufacture bread, tools and meals yourself from actual shop stock. Operators can carry on when you are hunting.
- **Breakdowns and maintenance**: production wears machinery, monster raids can damage it, and work stops until you use a tool or pay an actual worker for repairs.
- **Owner-served NPC customers**: NPCs really wait to be served when you're at your own counter. They leave if ignored or pay your assistant when you leave.
- **Stealth and camping**: Hide, sneak limited cardinal steps with real monster detection, and consume wood to set up a restorative outdoor camp.
- **Snooping and stealing**: inspect actual NPC backpacks, try to take known item serials, and face witness reports and guard fines.
- **Forged weapons and armor**: make swords, maces, spears, bows, arrows, shields, and armor from physical supplies. Equipping uses real serials; weapons wear down, armor reduces damage, and bows consume ammunition.
- **Working armorer service**: repair equipment yourself from ore/wood, hire the village smith to work while you're away, return to collect the exact same gear, or salvage unwanted gear.
- **Real carcass harvesting**: skin wolves for hides, butcher fresh wolf meat, harvest spider silk and venom, cook meals, and supply actual NPC tavern production. One physical corpse remains and decays.

Use **P → Skills, Spellbook, Quests, Animals, Crafting, BUSINESS, THIEVING, ARMORY or HUNTING** on a **connected DK Server** for these gameplay actions. The dedicated mill building, more kinds of magic, guilds, and the entire original Ultima Online feature set are **not** complete yet. The first milling station uses the **existing village bakery**, without changing the owner-approved village layout.

**Important:** GitHub Pages is a static **preview**. It does not host a persistent server, so it cannot run the independent NPC economy or save authoritative monster/pet states. The server needs to be running separately to simulate events while you are away. This release does not deploy a public server.

The six-shard GitHub Actions regression workflow remains **manual-only**, to conserve Actions minutes. New Node tests are included in the repository but are not automatically run on pushes.
