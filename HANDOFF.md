# Demon Killer — Next-thread handshake

**Recorded:** November 5, 2026 (America/Chicago)  
**Repository:** https://github.com/dereksparks1982/demonkiller  
**Branch:** `main` only.  
**Baseline before this handoff:** `4706f5487887853960f004183414ac9557e364d8`.  
**Studio:** DK Softworks.

## Read this first when continuing

Continue the **existing Demon Killer** work; do not start again, replace approved artwork with newly generated designs, create a separate "Test Center" branch, or assume that planned work has already been committed. Check GitHub's actual `main` branch before editing.

The owner explicitly asked to **finish the previously approved temple artwork integration**. A separate **floor tile atlas has not been made**; the owner specifically said **do not worry about floors right now**. Do **not** create or promise to install a new floor atlas in this batch.

## What is actually finished and pushed

- The uploaded **Fire Emblem: The Sacred Stones — Lyon Organ Arrangement** MIDI is committed at `assets/audio/music/lyon-organ-arrangement.mid`. Its exact original content was restored after an initial transfer mismatch. Verified final file size: **2,799 bytes**, with Git blob `53df7d8f2481c4a61cff5414bc6eb59626589caf`.
- The browser synthesis and looping logic is in `temple-music.js`, included by `test-center.html`; it uses Web Audio and a `♪ MUSIC ON/OFF` button, honoring the existing saved menu audio setting. A simulated parser check read the exact MIDI and found **262 notes** across approximately **63.54 seconds**. Actual listening in a browser has not been confirmed.
- The existing `test-center.js` temple opening was updated: north door starts **closed**, opens for cult departure, closes after the final cult member departs; Devil **faces the ghost and vanishes in place** rather than exiting via the door; Lilith kneels and places the soul crystal, then opens the north door to leave and **leaves it open**. The previously accepted 16×16 room and altar geometry remain.
- Existing mechanics remain: the initial sacrifice sequence, ghost mode, deliberate **double-left-click** crystal resurrection, and DK Architect. The next area/courtyard is **not built**.
- Push confirmed at `4706f5487887853960f004183414ac9557e364d8`. GitHub verification and Pages deployment passed on the scene/music commit, and the subsequent exact-MIDI fix had a successful Pages deployment. This is **not** a claim of manual browser/visual or audible playback testing.

## Important unfinished work (next priority)

1. **Portraits:** The owner approved the intentionally crude **NES / original Zelda 1-style** `NES-Style RPG Character Portrait Atlas(1).png` in the preceding conversation. It is **not yet in GitHub**. Split approved portraits into **individual usable image files**, organize under `assets/art/characters/portraits/` (or a comparably appropriate existing art folder), add an atlas/index manifest if it helps runtime integration, and verify the final files. A preceding handoff anticipated **104 portraits**, but verify the image layout/cell count against the actual atlas before promising that exact quantity.
2. **Temple walls:** The owner approved `Dungeon Temple Wall Tile Atlas(1)(1).png`. It is **not yet in GitHub**. The room renderer currently uses existing `assets/art/temple/walls/wall_{straight,end,corner,t,cross}_{north,east,south,west}.png` paths. Extract/use **the exact approved wall art** and replace the prior wall tiles in a way consistent with those directional filenames and existing room connectivity, without changing temple geometry. Keep an untouched master sheet in the correct art folder for provenance.
3. After artwork upload, verify **all expected files** appear on `main`, inspect the scene visually if possible, check looping organ playback, and run the repo tests. Be explicit about anything that remains unverified.
4. If the two approved PNG atlases are not present as accessible attachments in the new thread, **request the exact images to be reattached**. Do not substitute similarly named/imagined assets or claim they are uploaded.

**Known source attachment names from the cut-off conversation:**  
- `NES-Style RPG Character Portrait Atlas(1).png`  
- `Dungeon Temple Wall Tile Atlas(1)(1).png`  
These were user-provided as approved art; their conversational file paths should not be assumed portable between threads.

## Other constraints to preserve

- The look is **deliberately low-detail pixel art, Zelda 1-era**, not modern detailed pixel illustration.
- Keep original art in `assets/art/...`, not `assets/artwork/...`.
- Do not invent a courtyard or willow transformation implementation during the art-import task.
- The MIDI arrangement is copyrighted game music and **temporary development/reference material only**. Do not distribute it in a commercial release unless necessary rights are cleared; an original/licensed replacement will be needed.
- Existing `README.md`, `docs/forsaken-temple-opening-canon.md`, and `docs/sacrifice-audio-and-temple-door-sequence.md` describe the scene. Prefer newer explicit owner decisions over older planning-only notes.
- Keep updates and commits accurate; do not claim GitHub changes have landed until pushed and verified.

## Resume phrase

> **Demon Killer handshake:** Continue from `HANDOFF.md` on `main`. Finish the approved **individual NES portraits** and **replacement temple wall sheet** GitHub imports; **skip floor tiles**. Preserve the already pushed looping Lyon organ MIDI and door/Devil/Lilith changes.
