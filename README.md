# Demon Killer

**Demon Killer** is an original Gothic fantasy RPG from **DK Softworks**. Explore a dangerous, changing world with classic top-down pixel-art characters, hands-on professions, construction, combat, and an evolving society of independent NPCs.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

## Gameplay

Explore with cardinal movement, investigate hidden cults, practice skills, fight creatures, gather resources, operate businesses, and shape the world using **DK Architect**. **The new world starts as one enormous, flat green grass plane at elevation zero.** You paint the oceans, rivers, mountains, forests and other terrain yourself in DK Architect. The long-term goal is a single seamless world where settlements, work, trade, conflict, and rebuilding continue through the persistent server.

## Controls

- **Right mouse hold:** Move during gameplay.
- **Left click / double-click:** Inspect and interact.
- **F8:** DK Architect, with construction and terrain-editing tools.
- **World Pixel Painter:** From **Options → Persistent World → Open DK Architect** (when connected to DK Server), or from **F8 → Logistics → World Pixel Painter**. Paint all 9,216 × 9,216 world tiles using simple, hard-edged pixel blocks matching the existing 32×32 characters. Use whole-cell ocean/biome painting, or zoom in to individual terrain tiles. Painting grass restores the default land without allocating extra grass records.
- **Living World:** Choose **WALK HERE** in DK Architect or **Options → Persistent World → Enter the Living World**. Create a development character or enter with your existing character, walk using WASD/arrows or held right mouse, and place independent NPC scouts, guards, foragers and workers. Your painted terrain and elevations govern movement.
- **In DK Architect:** Left drag paints or places, **right mouse drag pans**, mouse wheel zooms (or rotates the active placement preview). The pixel painter offers world overview, zoom, undo/redo, water percentage and server export.
- **Gathering (M74):** In the Living World, select a nearby forest, pine, heath, marsh, reed, bog, highland, cliff, stone, dirt or beach tile and choose **GATHER FROM SELECTED TILE**. Resources enter your persisted pack; suitable forager/worker NPCs gather one unit per world hour and patches take six world hours to regrow. Untouched grass yields nothing, so paint relevant terrain first.
- **Tab:** War/Peace stance. **P** opens the paper doll; **I** opens inventory; **C** opens cult investigations.

## Persistent world

The public link is a **browser preview**, not a hosted persistent server. The separate DK Server runs the authoritative world simulation and saves changes when connected. Early development saves are disposable: **Options → Reset Development World** creates a fresh green world after typed confirmation. Read the [server operations guide](server/README.md) for supported setup.

## Project documentation

- [World design, architecture, implementation roadmap, and UO/Life is Feudal research](docs/demon-killer-master-roadmap.md)
- [Current developer handoff and known gaps](docs/development-handoff.md)
- [Release history](CHANGELOG.md)
- [Historical development notes](docs/history/README-through-M68.md)

The project uses independent code and appropriately licensed/original artwork. No game engine is required.
