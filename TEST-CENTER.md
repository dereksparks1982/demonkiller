# Sacrificial Temple | DK Architect Development Lab

**Current active branch:** `main`  
**Development milestone:** v0.2.2  
**Engine:** Original Canvas renderer and plain HTML/CSS/JavaScript; no Godot dependency.

## Launch and controls

Open [test-center.html](test-center.html), or open [index.html](index.html) to see the approved pixel-art main menu and Zelda-style name registration.

- **Walk Temple:** WASD or arrow keys advance one grid tile; hold the right mouse button to move toward the cursor, faster when the cursor is farther away. Left-click interacts, never moves. A ghost can pass through furnishings, but not the stone boundary. Left-click the crystal while within reach to begin the altar resurrection ritual. Walking across it does nothing. Avoid it to remain a ghost.
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
