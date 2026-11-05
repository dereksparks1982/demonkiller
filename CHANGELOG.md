# Demon Killer Changelog

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
