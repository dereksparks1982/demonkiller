# Sacrificial Temple | DK Architect Development Lab

**Current active branch:** `main`  
**Development milestone:** v0.2.2  
**Engine:** Original Canvas renderer and plain HTML/CSS/JavaScript; no Godot dependency.

> **Planning note (2026-11-04):** The owner approved a revised opening, documented in [Forsaken Temple opening canon](docs/forsaken-temple-opening-canon.md). This lab currently describes **implemented prototype behavior**, including old single-click resurrection and a pre-existing crystal. The **planned** interaction is *single left-click = inspect, double left-click = resurrect*. No gameplay implementation is authorized by this documentation update.

## Launch and controls

Open [test-center.html](test-center.html), or open [index.html](index.html) to see the approved pixel-art main menu and Zelda-style name registration.

- **Walk Temple:** WASD or arrow keys advance one grid tile; hold the right mouse button to move toward the cursor, faster when the cursor is farther away; **release to stop immediately**. Diagonal cursor travel is smooth, while the character still faces one of four static directions and construction remains cardinal-only. Left-click interacts, never moves. A ghost can pass through furnishings, but not the stone boundary. Left-click the crystal while within reach to begin the altar resurrection ritual. Walking across it does nothing. Avoid it to remain a ghost.
- **Architect Mode:** Place, Select/Move, Delete, Duplicate and Rotate **selected** items; floor paint/fill/rectangle, wall toggles, door states, spawn placement, eyedropper, undo/redo, and access check.
- **Persistence:** Save/reload in isolated browser local storage, or Export/Import Room JSON to transfer a layout.
- **Coordinates:** Every tile and item is addressable, with object IDs, footprint dimensions, and rotation in cardinal 90-degree steps.

**Editor preview:** choose Place and move your pointer over the grid to see a translucent approved sprite with a green/red footprint. Mouse-wheel rotation changes only the **unplaced preview**, in 90-degree increments. Clicking places at the chosen orientation. The existing Rotate button still acts only on **selected placed objects**. Approved directional PNGs, floor tiles and basic connected wall types are loaded from `assets/art/`; missing images fall back to procedural pixel blocks.

## Opening scene

| Component | Grid coordinates |
| --- | --- |
| Area ID | `dk.temple.sacrifice.001` |
| Room | 16 × 16 tiles, 32 px per tile |
| Ghost player spawn | (8, 12) |
| Sacrificial altar | (6, 5), footprint 4 × 2 |
| Soul crystal | (8, 9) |
| North doorway marker | (8, 0) |

On a new game, the red-haired woman enters from the north arch, goes around the altar, pauses, and leaves before the ghost can move. A left-click on the crystal afterward reunites the spirit with its body at the altar. The crystal becomes spent. The arch **does not** currently connect to another playable area. The future courtyard, the woman who becomes a weeping willow, and full ghost-route progression are not in this build.

## Test

```bash
node tests/test-center.cjs
```

The test covers the grid, resurrection, ability to reach the north arch without resurrecting, editor placement and undo/redo, local save/reload, and import guards. It is a simulated-interaction test, **not** a full browser visual test.

## Current source files

- `test-center.html`: playable editor and game UI.
- `test-center.css`: Gothic interface and pixel-grid presentation.
- `test-center.js`: grid model, Canvas art, player logic, tools and saves.
- `tests/test-center.cjs`: behavior contract checks.
- `index.html`: original-sprite menu with three named save records, loading into the existing Forsaken Temple screen.

We will improve the **existing** sacrificial temple instead of opening new areas until DK Architect is ready.


### Exact pointer and rebuilt masonry (v0.2.18)

The held right mouse steers to the **exact pointer coordinate** (no 17.6px dead zone or .35-tile standoff); releasing still stops immediately. Left-click remains interaction only. Collision and blocked north door are unchanged. In Architect Mode, the 32px orthographic wall palette contains five automatic textures and 220 individually selectable transparent modular pieces. Corners, straights, T joins and ends use identical 12px edge connectors; do not reintroduce angled/isometric wall art or hidden opaque tile backgrounds.

### v0.2.19 Right-click travel

A quick right-click now commands pixel-accurate point-to-point walking even after release; holding right mouse continues to steer manually, and releasing a hold stops immediately. Keyboard input cancels destination travel. Left-click remains interact-only. Movement still obeys collision tiles and does not provide obstacle-routing pathfinding.
