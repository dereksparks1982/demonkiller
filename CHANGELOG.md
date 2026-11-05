# Demon Killer Changelog

## v0.2.2 | 2026-11-04 | Main menu and crystal woman opening

- Added the approved-sprite main menu and three Zelda-I-style named character records with New Game, Continue, Options and Quit guidance.
- New and continued characters open the **existing** Forsaken Temple with DK Architect and all original room Save, Load, Export and Import controls.
- Changed controls to hold right mouse for movement, move cursor farther to run, and left-click only for nearby object interactions.
- Fixed unwanted auto-resurrection when walking over the soul crystal. No E-key interaction.
- Added the red-haired woman NPC's timed temple entrance, route around the altar, and exit using the approved four-direction sprites. Player movement unlocks after departure.
- Added a minimal spirit-to-body altar resurrection sequence and retained the optional ghost path. No unapproved special powers or new story areas.
- Loaded original DK Architect art-pack PNGs for floors, wall joins, objects, ghost/human sprites; retained procedural pixel fallback on asset loading failure.
- Added translucent footprint-aware Architect placement previews and clockwise/counterclockwise mouse-wheel rotation, preserving the placed-object Rotate button.
- Added simulated regression checks. The persistent-world server is a separate future milestone.


## v0.2.0 | 2026-11-04 | Main-repository migration

- Promoted the already playable, engine-free sacrificial-temple prototype as the active direction for `main`.
- Retained the original game, editor, ghost-to-mortal crystal choice, existing tests and isolated browser saves; **no new gameplay mechanics in this migration**.
- Preserved the old Godot working-tree snapshot on `archive/godot-recovery-2026-11-04`.
- Removed Godot-only runtime/configuration, add-ons, GDScript scenes, incomplete recovery fragments and obsolete Godot README presentation from active `main`; all remain accessible in the legacy archive.
- Added a root landing page, refreshed README, documented legacy salvage decisions and clarified the temple-first DK Architect development plan.

## v0.1.0 | 2026-11-04 | Prototype

- First playable 16 × 16 sacrificial temple with original Canvas pixel art.
- Ghost start; touching soul crystal resurrects, avoiding it preserves the ghost branch.
- Cardinal grid movement, simple editor tools, undo/redo, browser save and JSON import/export.
