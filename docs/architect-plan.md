# DK Architect | Temple-first development plan

## Locked design principles

- Use original Gothic/noir artwork inspired by the clarity and interconnected world structure of classic top-down adventure games, **not** borrowed Zelda artwork.
- Base construction grid: **32 × 32 pixel tiles**. Objects may occupy several rectangular grid cells. Every object has a stable ID, exact X/Y grid coordinates, footprint and optional interaction/state.
- **Cardinal directions only:** North, east, south, west; rotations at 0°, 90°, 180°, 270°. No diagonal walls or diagonal placement.
- A **room** is an area with its own `area_id` and size, from one tiny chamber to a huge playable meadow. Later rooms form a non-linear connected graph rather than one huge global grid.
- For now, work **only in `dk.temple.sacrifice.001`**. Do not build the courtyard or other world regions until approved.
- Maintain both opening routes: take the crystal and become mortal, or avoid it and continue as a ghost. The ghost-only completion route is a long-term secret design goal, not yet implemented.

## Next substantial temple + editor build

1. Actual semi-transparent sprite placement preview attached to the pointer, with exact multi-tile footprint and green/red validity.
2. **Mouse wheel rotates the unplaced preview** one cardinal step in either direction (only when the placement tool is active). **Rotate button** rotates a *selected already-placed* item or a wall; never silently rotates the unplaced preview.
3. Produce real directional art, not just mechanically turn the same sprite image, for directional furniture, doors, statues and characters. Symmetric terrain can reuse one view.
4. Auto-joining walls: horizontal/vertical runs, corners, ends, T junctions, crossings, entrances and compatible door frames. Never diagonal.
5. Visual asset browser: searchable categories and thumbnails for architecture, ritual props, floors, furniture and eventually terrain.
6. Decorate the **same** sacrificial temple convincingly: ritual banners, carved stone details, torches/braziers, candle clusters, offerings, ruined columns, stains, chains and additional altarpieces. Preserve the established altar, crystal and player choice unless approved otherwise.
7. Improve object inspector: stable ID, X/Y coordinate, orientation, footprint, blocking, interaction and custom properties. Add tests for editor actions and save round trips.
8. Carefully layer light, shadows and atmospheric effects so they enhance spatial legibility; they must not hide the grid during editing.

## Later, after temple acceptance

Variable-sized areas, culling, camera panning/zooming, doorway transition data, area state persistence and the connected courtyard. Build one area at a time and do not mutate accepted room geometry without approval.

## Release discipline

Before a new accepted release: update README and changelog, run contract tests and visual checks, obtain acceptance, commit, annotate a version tag when available, push and verify GitHub. Preserve historical branches and source/license attribution.
