# Demon Killer

Demon Killer is a Gothic fantasy RPG by DK Softworks, built with original top-down pixel art, Streaming Cells and an independent persistent-world server in development.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

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
