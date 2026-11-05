# Sacrificial Temple | DK Architect Development Lab

**Current active branch:** `main`  
**Development milestone:** v0.2.0  
**Engine:** Original Canvas renderer and plain HTML/CSS/JavaScript; no Godot dependency.

## Launch and controls

Open [test-center.html](test-center.html), or open [index.html](index.html) to be forwarded to it.

- **Walk Temple:** WASD or arrow keys advance one grid tile; click a reachable floor tile to follow a calculated four-direction route. A ghost can pass through furnishings, but not the stone boundary. Touch the soul crystal to resurrect. Avoid it to remain a ghost.
- **Architect Mode:** Place, Select/Move, Delete, Duplicate and Rotate **selected** items; floor paint/fill/rectangle, wall toggles, door states, spawn placement, eyedropper, undo/redo, and access check.
- **Persistence:** Save/reload in isolated browser local storage, or Export/Import Room JSON to transfer a layout.
- **Coordinates:** Every tile and item is addressable, with object IDs, footprint dimensions, and rotation in cardinal 90-degree steps.

**Important:** The mouse wheel does not yet rotate a prospective placement; the cursor currently shows a tile outline, not the actual sprite preview. Proper north/east/south/west artwork and wall auto-tiling still need development. The existing Rotate button acts on **selected placed objects**.

## Opening scene

| Component | Grid coordinates |
| --- | --- |
| Area ID | `dk.temple.sacrifice.001` |
| Room | 16 × 16 tiles, 32 px per tile |
| Ghost player spawn | (8, 12) |
| Sacrificial altar | (6, 5), footprint 4 × 2 |
| Soul crystal | (8, 9) |
| North doorway marker | (8, 0) |

The crystal changes the character from ghost to living and becomes spent. The arch **does not** currently connect to another playable area. The future courtyard, the woman who becomes a weeping willow, and full ghost-route progression are not in this build.

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
- `index.html`: small, stable landing page forwarding to the above.

We will improve the **existing** sacrificial temple instead of opening new areas until DK Architect is ready.
