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
- **In DK Architect:** Left drag paints or places, **right mouse drag pans**, mouse wheel zooms (or rotates the active placement preview). The pixel painter offers world overview, zoom, undo/redo, water percentage and server export.
- **Tab:** War/Peace stance. **P** opens the paper doll; **I** opens inventory; **C** opens cult investigations.

## Persistent world

The public link is a **browser preview**, not a hosted persistent server. The separate DK Server runs the authoritative world simulation and stores its saves when connected. Read the [server operations guide](server/README.md) for supported setup.

## Project documentation

- [World design, architecture, implementation roadmap, and UO/Life is Feudal research](docs/demon-killer-master-roadmap.md)
- [Current developer handoff and known gaps](docs/development-handoff.md)
- [Release history](CHANGELOG.md)
- [Historical development notes](docs/history/README-through-M68.md)

The project uses independent code and appropriately licensed/original artwork. No game engine is required.
