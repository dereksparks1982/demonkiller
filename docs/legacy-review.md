# Legacy Godot Audit and Migration | 2026-11-04

## Protected source snapshot

The prior `main` branch was preserved as `archive/godot-recovery-2026-11-04` at commit `3f6cc95a237e45b9d71c9403b7757332672f2fbe` **before** promoting the engine-free temple to `main`. The earlier `test-center` branch remains a historical snapshot of the first playable prototype.

This archive preserves the **29 tracked files present in the old working-tree snapshot**, including `CONTACT.md` and `README.md`. The old README describes a **4,920-file recovery**, but the current branch tree does **not** contain those 4,920 files. Do not describe the archive as a complete restored game. Consult historical commits/tags and independent source archives if deeper recovery is required.

## What stays active

- `CONTACT.md`, the company's public business contact.
- The complete standalone temple: `test-center.html`, `test-center.css`, `test-center.js`, `tests/test-center.cjs`.
- New `index.html`, current README, release notes, and development design documents.

## What left active main (remains in the archive)

| Legacy path | Decision | Reason |
| --- | --- | --- |
| `project.godot`, `icon.svg` | Archive | Old Godot launch/configuration and icon are not needed by the current HTML/Canvas game. |
| `addons/dk_door_linker/` | Archive source, retain design | Its linking and room-edge ideas fit our future door/area graph. The visible plugin preloads missing subordinate utility files, so it is not directly reusable. |
| `addons/dk_live_builder/`, `addons/dk_editor_startup_2d/`, `addons/dk_manual_placement_protection/`, `addons/dk_project_diagnostics/`, `addons/theme_gen_save_sync/` | Archive | Godot-only editor plugins. Recreate useful behaviors natively in DK Architect. |
| `addons/savekit/` | Archive source, retain save-design ideas | GDScript node serialization assumes the Godot scene tree and refers to missing serializer/deserializer files in this snapshot. |
| `scenes/player/DKSeamlessGameplayPlayer.tscn` | Archive source, retain art spec | References both human and ghost four-direction, 4×4 walk sheets, but referenced `Art/` PNGs and many scripts are **not present** in the current branch. Do not advertise those sprites as imported. |
| `scenes/world/DKDesignatedSavePoint.tscn`, `scripts/save/DKDesignatedSavePoint.gd` | Archive source, retain design | Source suggests designated save shrines and interaction ranges, for a later native save system. |
| `scripts/progression/DKFaith.gd` | Archive source, retain progression idea | Simple bounded faith counter; future mechanics must be designed for the new game's ghost/mortal branches. |
| `recovery/source_payload/part000.b64`, `part002.b64` through `part006.b64` | Archive | Incomplete base64 recovery fragments; `part001.b64` is missing from the current working-tree listing. Not game runtime assets. |

No old GDScript is executed by the new project. Anything reused from original or third-party historical code/assets requires source, authorship and license verification before moving to active `main`. Current temple art is original Canvas-drawn art.

## Salvage priorities (not implemented yet)

1. **Door/cell connections:** A graph of areas with a stable `area_id`, entry coordinate, facing and one-or-more exit links. Rooms may be tiny interiors or giant outdoor meadows. Only four cardinal directions.
2. **Player direction artwork:** Proper separate north/south/east/west poses, for ghost and resurrected form; movement cycles later.
3. **Save system:** Evolve isolated temple JSON into versioned multi-area saves, with independent editor drafts, safety checks and checkpoint rules.
4. **Progression and interaction:** Faith and other lore-aware mechanics only once story and character states are settled.
5. **Editor protection and diagnostics:** Rebuild useful Godot-era guardrails, without importing old Godot dependencies.

**This migration is repository organization, not an implemented gameplay expansion.**
