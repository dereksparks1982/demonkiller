# Demon Killer · Sacrificial Temple Test Center

**Branch:** `test-center` (experimental, separate from `main`)  
**Prototype:** DK Architect Temple Lab v0.1.0  
**Runtime:** Plain HTML, CSS and JavaScript; no Godot, Electron, npm, network calls or third-party assets.

## Launch

Open `test-center.html` from a checkout of this branch in Firefox or Chromium. The page works directly as a local file and has no external dependencies. Do **not** open `project.godot` for this experiment: that belongs to the recovered Godot-era game on `main`.

## What you can test

The opening temple is **16 × 16 tiles at 32 × 32 pixels per tile**. The player begins as a **ghost at (8,12)**. The sacrificial altar is at **(6,5)** and occupies **4 × 2 tiles**. The soul crystal starts at **(8,9)**; stepping onto the crystal resurrects the player. Avoiding it preserves the secret ghost route. As a ghost, the player can walk through furniture and the altar, but not through stone boundary walls. Resurrected characters collide with solid furniture. The **north exit at (8,0)** marks a future connection to the courtyard, but does not load another area yet.

The test editor uses the same general conventions as Capital & Consequence's standalone `test-center`, but **all Demon Killer art is original code-drawn Gothic pixel art**. No code or artwork was copied from third-party sprite packs, and the separate Godot code is not executed.

- **Walk Temple:** WASD or arrow keys move one tile. Clicking a floor tile pathfinds to it without animation. An adjacent door can be clicked to open/close.
- **Architect Mode:** Place/Move/Rotate/Duplicate/Delete. Paint floors, flood-fill connected regions, paint rectangular areas, toggle walls and doors, move the spawn, eyedropper, undo/redo and access check.
- **Coordinates:** Every area, player, object, floor and wall is grid-addressed. Object identity survives moves and rotation.
- **Persistence:** Save and reload in isolated browser storage using `dkSoftworks.demonkiller.testCenter.v1`. Export and import JSON; imports check area identity, 256 grid cells, valid object types and coordinates. Reset never overwrites a saved layout until Save is pressed.
- **Art:** Original top-down stone, relic, altar, crystal, pillar, coffin, statue, brazier, ghost and living-character sprites drawn with Canvas shapes and a Gothic color palette. Fixed directional characters, no sprite animation.

## Test

From the checkout, run:

```bash
node tests/test-center.cjs
```

The regression test checks the 16 × 16 layout, first resurrection, secret ghost passage to the northern arch, editor placement, undo/redo, isolated save/reload and rejection of foreign-area JSON imports. A visual browser check on a Linux desktop is still needed before treating the experimental prototype as accepted.

## Files

- `test-center.html`: standalone page and tools.
- `test-center.css`: Gothic layout and responsive styling.
- `test-center.js`: self-contained room grid, rendering, character branches, editor, pathfinding and save logic.
- `tests/test-center.cjs`: Node.js interaction/contract regression.

## Scope and next connections

This is **only the first room** of the proposed spider-web world. It does not implement the courtyard, the nearby woman, the weeping willow, a persistent world server, quests or the complete ghost ending. Later areas will have their own `area_id` and coordinates, joined by declared doorway or path connections. For now, the north arch is an intentional stub rather than a fake transition.

**Existing Demon Killer `main`, Godot source, recovery files, and accepted versions remain unchanged.** This test center is not an approved game release and has not been tagged.
