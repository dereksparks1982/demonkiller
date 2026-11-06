# Demon Killer original project recovery | November 2026

## Purpose

Historical reference for **Demon Killer**, not active JavaScript game code. The original game was a Godot project; today's Demon Killer game lives separately on `main`. Do not merge this archive branch into `main`, enable old Godot add-ons, copy third-party compiled plugins, or replace approved current assets without owner review.

## Verified original source

The owner supplied four old project ZIPs: `1.zip`, `2.zip`, `3.zip`, and `4.zip`, plus a v0.5.05 third-party intake manifest, `project.godot`, and `icon.svg.import`.

ZIP 4 contains the original `.git` repository and **six authentic historical commits**. HEAD `36aa9f3c2b4d45d306c29d56505938619a06a974` is the accepted Godot **v0.5.03** commit, with **4,920 tracked files**. The tags are v0.4.69, v0.4.71, v0.4.72, v0.5.00, v0.5.02, and v0.5.03. The original GitHub archive branch previously had only 29 tracked files, and must not be mistaken for the complete original.

ZIP 1 holds art, audio, documentation, add-ons, minigames; ZIP 3 holds scripts, scenes and tests. **All 4,169 overlapping non-import/non-UID files in ZIPs 1 and 3** were byte-for-byte verified against v0.5.03's original Git blob objects (4,033 + 136). ZIP 2 contains a redundant compressed copy of the documentation and a project manifest; ZIP 4's `.godot` entries are generated editor caches, not authoritative sources.

## Important sources to extract on demand

- `scripts/save/DKSaveManager.gd` and `scripts/save/DKRegionCellDurableState.gd`: recovered in ZIP 3, missing from this branch's earlier 29-file sketch.
- `scripts/streaming/DKStreamingMemoryManager.gd`, `scripts/tests/DKSeamlessCellStreamingController.gd`, `scripts/cells/DKCellRoot.gd`, `scripts/cells/DKCellDoor.gd`: streaming and area graph references.
- `addons/dk_door_linker/`, `addons/dk_live_builder/`, `addons/savekit/`: full editable source including previously missing dependencies in ZIP 1. Third-party SaveKit notice retained.
- `Audio/`: **62 original source audio files, 164,406,207 bytes of audio directory material including import metadata** in ZIP 1, retaining the original creator files and versions. See the audio provenance index below.
- `docs/`: 3,243 original documentation entries including session notes, changelogs, audit results, license and attribution records. The nested `docs.zip` in ZIP 2 contains duplicates.
- ZIP 4's `.git` objects preserve the complete authentic commit tree and earlier revisions.
- The additional `DK_PATCH_MANIFEST.json` describes a **v0.5.05 third-party MIT source intake**; this is NOT evidence the later sources were present in v0.5.03, nor permission to treat them as original DK code.

## Import policy

Original audio and its creator credits are preservation priorities. Do not remove original credits. License notes in `docs/licences/` include CC0 and CC BY materials, and one user-supplied track with an incomplete historical rights record. Preserve the notes exactly, without changing their stated license.

Exclude generated `.godot` cache, third-party compiled `.so`/`.dll`/`.dylib`/`.wasm`, duplicate documentation ZIPs, and irrelevant editor binaries from the curated source package. Keep raw original ZIPs untouched for recovery.

**Current archive status:** This commit installs the recovery documentation and historical audio provenance records. The large original binary audio and the full 4,920-file tree are **not yet uploaded through the GitHub connection**. A verified complete curated archive was prepared separately (4,719 files, including all 62 audio sources) for the bulk-transfer step. Do not report the entire original project or its audio files as present in GitHub until that upload is confirmed. No changes were made to the active `main` branch.
