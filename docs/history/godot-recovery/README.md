# Historical Godot recovery safely preserved on main

**Status:** Historical, read-only reference. **Not the current game, not an engine dependency.**
**Studio:** DK Softworks | **Current active game:** JavaScript/Canvas and DK Server on `main`.
**Archive branch before consolidation:** `archive/godot-recovery-2026-11-04`
**Exact archive tip:** `c57e15934ab29d9c0f1023f3e65039a640f6662f`
**Common ancestor with main before consolidation:** `3f6cc95a237e45b9d71c9403b7757332672f2fbe`
**Audit date:** 2026-11-08

## What was actually in the GitHub archive

The archive branch tip contains **39 files (58 tree entries including directories)**, not a complete 4,920-file original Godot project. Four archive-only commits preserve a partial old Godot snapshot plus provenance and recovery notes. Those commits were joined to `main` as the **second parent of the archive-consolidation merge commit**. Consequently all Git objects, including the old code, six 20KB base64 payload fragments, third-party plugin files and revision history, remain reachable from `main` even after the extra branch name is deleted.

The owner's **original v0.5.03 project was documented as 4,920 tracked files**, with six original historic commits recovered *from ZIP 4 locally*. The archive's recovery note explicitly states that this full original Git tree and the separate 62 original source audio files **were not uploaded to that GitHub branch**. The partial public archive does not replace the owner's original `1.zip`, `2.zip`, `3.zip`, `4.zip`, or the curated preservation ZIP. Keep those original archives safe independently. The `recovery/source_payload` folder in the partial archive contains part000 and part002–part006 but **no part001**; do not describe it as a usable reconstructed ZIP or try to execute it.

## What is visible in the main working tree

- **Historical licences and attribution:** `docs/licences/historical-godot/`. Six original records are preserved byte-for-byte, including CC0, CC BY, SaveKit/GLoot licence caveats and the Ashbringer track's **unverified commercial-use rights**. These historical usage claims do **not** mean the recordings are currently integrated into the web game.
- **Recovery references:** `records/` contains the original recovery assessment, audio inventory, four owner-upload SHA-256 values and the v0.5.05 third-party intake manifest. The manifest is historical evidence, not permission to ship third-party code or treat v0.5.05 as the accepted v0.5.03 baseline.
- **Original first-party technical references:** `source-reference/` contains selected archived GDScript scene, gameplay, editor and save-point sources. This is human-readable research only. Many source files refer to other original Godot dependencies that never reached this partial branch, so these are **not runnable** modules.
- **Complete partial-branch history:** archive tip `c57e159...` is retained as a parent of `main`'s archive-consolidation merge. To recover any other archive file not copied into this working tree, use the immutable commit `c57e159...` as a historical Git reference.

## Concepts worth retaining, without importing Godot into runtime

The older code documents direction-dependent door linking, editor/live placement protection (`dk_protected`, `dk_user_placed`, `dk_owner`, `dk_generated`), visible save-point interaction requiring a double-click, diagnostic overlays, and a small faith-state interface. Treat these as design references, not code to execute, and retain the current game's more recent architecture and owner-approved world decisions. The recovered source describes one save-shrine design; it does not automatically replace the current server checkpoint/autosave approach.

The archive also mentions original `DKSaveManager.gd`, `DKRegionCellDurableState.gd`, `DKStreamingMemoryManager.gd` and related scripts in owner ZIPs. **Those particular recovered files are not present in the partial GitHub branch**, so their bytes are not claimed to be preserved in this consolidation. Keep the original ZIPs or import a separately verified curated source package if future recovery is needed.

## Branch-removal verification

After this documentation-only merge, check that:
1. The final `main` commit has **two parents**, the prior main tip and `c57e159...`.
2. GitHub compare `archive/godot-recovery-2026-11-04...main` reports **zero archive-only commits**.
3. The documents in `records/`, `source-reference/` and `docs/licences/historical-godot/` are visible on `main`.
4. Game/server version and production JavaScript remain unchanged.

If these checks pass, deleting only the GitHub **branch reference** is safe for the material that was actually on that branch. **Do not delete the owner's original source ZIPs or confuse the partial GitHub branch with the separately recovered complete historical project.**
