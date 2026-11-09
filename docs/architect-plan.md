# DK Architect | Current Editor Roadmap

The old temple-only editor proposal has been retired and preserved under `docs/history/architect-plan-temple-era.md`. The authoritative owner-approved design lives in [the master roadmap](demon-killer-master-roadmap.md).

## Implemented foundation through M73

- The logical world grid is 9,216×9,216 tiles, each 32px in original top-down art scale, addressed through 128×128 Streaming Cells and 16×16 sectors.
- **M71 default:** Every unpainted tile in the replacement atlas is green grass at elevation 0, without any generated mountains, ocean or buildings. The server stores one default plus sparse changes rather than 84.9 million grass tiles. Painting whole Streaming Cells back to grass removes their cell material overrides, leaving fine details and height changes individually editable.
- The **M70 World Pixel Painter** can open directly from the connected server's main menu **Options → Persistent World → Open DK Architect** or from F8 **Logistics → World Pixel Painter**.
- It is intentionally simpler in visual detail than Ultima Online and uses the same hard-edged 32×32 character pixel vocabulary: 72×72 block world overview, no gradient, no GPU art model, no smoothed artwork.
- Hold right mouse and drag to pan. Wheel zooms eight levels from full atlas (128 tiles per block) to exact 1:1 tile. Left drag paints.
- **Whole-cell mode** is for oceans and major biomes; each 128×128-tile fill is a sparse record. **Fine mode** writes exact tile materials and heights, supporting raise/lower/flatten/smooth, original M69 paint and exact undo.
- Painting operations are serialized and durable on DK Server, with revision checks and safe collision protections. UI supports export, undo/redo and water-area coverage.
- M72 established the first **server-owned walking surveyor**, using the same painted grass/water and height grid. Open **WALK HERE** in DK Architect and walk with WASD/arrows or held RMB across 128×128 cell seams in the 25×25 tile top-down view. This is a terrain test avatar, not yet connected to the full character/NPC simulation. The old four-region M68 sample still serves its own prototype.

- M73 makes the real slot-one character a world actor with actual global position and introduces deliberate named NPC scouts, guards, foragers and stationary workers with deterministic server-clock local movement. The editor's WALK HERE launches the living-world atlas; old M72 surveyor exists only as a testing adapter. Development resets are explicitly allowed through typed-confirmation Options. Legacy temple metadata remains temporary, and professions/quests are not yet migrated.

## Next development sequence

1. Convert painted whole-world cells into actual player/NPC-traversable streamed terrain without importing old temple/village scenery.
2. Implement height-aware cliff rendering and pixel terrain transitions, preserving original sprite scale rather than smooth realistic 3D.
3. Add hydrology, ocean/river depth and connected river-carving tools with server-authoritative geometry.
4. Implement caves, enterable underground layers, mountainside entrances and spawner-region authoring.
5. Add level-footprint validation, genuine ground excavation, construction material stores, visible building stages and paid NPC work.
6. Continue the UO/Life is Feudal/private-server mod roadmap and NPC-generated differentiated settlements.

Use `docs/development-handoff.md` and versioned `docs/releases/` for build-specific notes; keep README short.
