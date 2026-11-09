# Demon Killer

**Demon Killer** is an original Gothic fantasy RPG from **DK Softworks**. Explore a dangerous, changing world with classic top-down pixel-art characters, hands-on professions, construction, combat, and an evolving society of independent NPCs.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

## M80: Permanent hidden supply caches

The unified 9,216 × 9,216-tile world now has **server-persisted, non-decaying caches**. A living character can conceal a cache on nearby passable ground (one tile away), transfer real gathered materials into it, withdraw supplies and track their own cache coordinates from anywhere. Caches have a 128-unit physical capacity and a world-wide cap of 64 in the current prototype; deposits and withdrawals must be adjacent and never create goods. **Caches are not invulnerable:** another character can search the actual ground tile within two steps, discover the cache and take its inventory. Retirement leaves the cache and its stock in the world, removes old ownership, and does not disclose the hidden location to the new character. Ocean/solid terrain brushes cannot quietly erase a cache's contents. The connected Living World atlas shows a cache panel, local known cache markers and owner's permanent locations.

**Not yet implemented:** monsters or NPCs automatically discovering/looting caches; deliberate death ritual; inventory transfer onto corpses and monster-held stolen equipment. These remain separate, required milestones. Saves remain disposable. Server-authoritative actions are revision checked and persisted before confirming; no second outdoor world is introduced.

## M78: The Original Willow Village Is the World

The approved town circle is authored at (4096,4096) through (4159,4159) directly into the same sparse **9,216 × 9,216-tile world**. The only building present initially is the Forsaken Temple. Its **entire 16 × 16 tile exterior footprint** appears visibly in the playable world, including full roof and boundary walls. There is no second northern village or set of premade houses. Every new structure requires player or autonomous NPC construction. Temple exit now transfers the existing character directly into this world, where approaching the Queen triggers the form-dependent prayer and transformation. The tree speaks different lines when clicked as a ghost or living character. Development saves are disposable.

## Gameplay

Explore with cardinal movement, investigate hidden cults, practice skills, fight creatures, gather resources, operate businesses, and shape the world using **DK Architect**. **The new world starts as one enormous, flat green grass plane at elevation zero.** You paint the oceans, rivers, mountains, forests and other terrain yourself in DK Architect. The long-term goal is a single seamless world where settlements, work, trade, conflict, and rebuilding continue through the persistent server.

## Controls

- **Right mouse hold:** Move during gameplay.
- **Lilith's willow (M77):** All six distinct golden and six sickly transformation poses now draw from their individually measured positions in the original art sheet, with no fragments borrowed from neighboring figures. Size, dialogue, camera and tree footprint remain unchanged.
- **Original soundtrack (M79):** **The Last Breath** is a new **108-second** continuous temple score with a five-second sacrifice impact and an **84-second atmosphere section** that repeats without replaying the execution. Music continues across the ghost encounter, resurrection choice and temple exploration until exit; the old organ cannot return. **The Shrouded Road** is a separate **96-second** darker overworld theme, playing in both outdoor clients. The MP3 renders are published by an Actions workflow when available, and the same original MIDI scores are the browser fallback. Browser audio may require a user gesture.
- **Left click / double-click:** Inspect and interact.
- **F8:** DK Architect, with construction and terrain-editing tools.
- **World Pixel Painter:** From **Options → Persistent World → Open DK Architect** (when connected to DK Server), or from **F8 → Logistics → World Pixel Painter**. Paint all 9,216 × 9,216 world tiles using simple, hard-edged pixel blocks matching the existing 32×32 characters. Use whole-cell ocean/biome painting, or zoom in to individual terrain tiles. Painting grass restores the default land without allocating extra grass records.
- **Living World:** Choose **WALK HERE** in DK Architect or **Options → Persistent World → Enter the Living World**. Create a development character or enter with your existing character, walk using WASD/arrows or held right mouse, and place independent NPC scouts, guards, foragers and workers. Your painted terrain and elevations govern movement.
- **In DK Architect:** Left drag paints or places, **right mouse drag pans**, mouse wheel zooms (or rotates the active placement preview). The pixel painter offers world overview, zoom, undo/redo, water percentage and server export.
- **Gathering (M74):** In the Living World, select a nearby forest, pine, heath, marsh, reed, bog, highland, cliff, stone, dirt or beach tile and choose **GATHER FROM SELECTED TILE**. Resources enter your persisted pack; suitable forager/worker NPCs gather one unit per world hour and patches take six world hours to regrow. Untouched grass yields nothing, so paint relevant terrain first.
- **Construction (M75):** In the Living World, select level ground beside your character and stake a **shed (2×2)** or **cottage (3×3)**. Flatten land first in DK Architect; occupied, steep, underwater and overlapping footprints are refused. Deliver timber, stone, clay and reeds from the saved resource pack to the site, then work through foundation, frame and roof stages. Assign worker NPCs to deliver carried stock and build at fifteen-minute server intervals, paid **one gold per item or work step** from your actual gold balance. Without supplies or wages, labor stops. Site progress saves; completed foundations block walking and staked sites are protected from terrain edits. This is not yet usable housing or NPC city-building.
- **Finished buildings (M76):** Each completed M75 shed/cottage gains an actual doorway and small indoor room matching its existing 2×2 or 3×3 footprint. Stand at the outdoor door marker and use **BUILDINGS, INTERIORS & WORKSHOPS** in the Living World to enter. WASD moves within interior walls; return to the indoor door to exit. Title is tied to the real character serial, with owner locks, a 160-unit physical-material chest, a workbench installed for 2 timber + 1 stone, and plank/cord recipes consuming 2 timber/2 reeds respectively. Assign an adjacent paid worker caretaker to bring carried supplies to the chest hourly for one gold per unit. No material or currency is generated. Properties survive saves, retired owners release claims, and abandoned property may be registered for five gold. Rooms are small first-pass interiors, not comprehensive housing or automated towns.
- **Tab:** War/Peace stance. **P** opens the paper doll; **I** opens inventory; **C** opens cult investigations.

- **Lilith's transformation (M77 correction):** The animated golden and diseased willow use the clean initial Lilith and full final tree artwork from the approved sheet, scaled through six stages without stray artwork from neighboring sheet panels. The final willow appearance and courtyard timing are unchanged.

## Persistent world

The public link is a **browser preview**, not a hosted persistent server. The separate DK Server runs the authoritative world simulation and saves changes when connected. Early development saves are disposable: **Options → Reset Development World** creates a fresh green world after typed confirmation. Read the [server operations guide](server/README.md) for supported setup.

## Project documentation

- [World design, architecture, implementation roadmap, and UO/Life is Feudal research](docs/demon-killer-master-roadmap.md)
- [Current developer handoff and known gaps](docs/development-handoff.md)
- [Release history](CHANGELOG.md)
- [Original soundtrack, loop design, MP3 workflow and source credits](docs/releases/M79-original-soundtracks.md)
- [Historical development notes](docs/history/README-through-M68.md)
- [Recovered Godot archive, preserved historical source references and audio/licence records](docs/history/godot-recovery/README.md)

The project uses independent code and appropriately licensed/original artwork. No game engine is required.

**Life/death and story canon:** see `docs/underworld-two-worlds-canon.md` for the exact tree lines, original mythology, non-decaying caches, corpse-looting consequences, apparition flashes, and 90-second original temple soundtrack. The document explicitly distinguishes implemented M78 work from future requirements.
