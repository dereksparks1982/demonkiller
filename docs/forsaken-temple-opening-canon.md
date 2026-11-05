# Forsaken Temple Opening | Approved Scene Canon (Planning Only)

**Project:** Demon Killer, Elderred Softworks LLC / DKLab
**Recorded:** 2026-11-04
**Status:** Owner-approved **design specification**. Documentation and a matching kneeling-sprite concept are authorized; **gameplay changes, courtyard construction, editor repairs, additional assets and deployment are NOT authorized by this instruction**.
**Area:** `dk.temple.sacrifice.001`, the existing Forsaken Temple.
**Rule of precedence:** This document supersedes earlier prototype descriptions where they differ. Current code and tests may still implement an older sequence.

## Story principle

The living world and the spirit world reveal **different appearances of the same mysterious woman and her transformation**. Preserve this contrast exactly; do not add explanations of why, invent her name or identity, or create powers/dialogue not approved by the owner.

At the first encounter the player is dead/a ghost, the woman has **red hair and a green dress**, and the soul crystal has not yet been placed. The player's corpse will be visible on the existing sacrificial altar once an original corpse sprite is approved and built. **No corpse sprite exists yet.**

## Authoritative opening sequence

1. **Ghost begins in the existing room.** Keep the current Forsaken Temple and DK Architect tools intact. The player has control and can wander a little before the scene begins; the altar holds the player's body when that art is available. The crystal is **absent** during this exploration.
2. **Explore and discover ghosthood.** Left-click nearby objects to examine or attempt interactions; the results explain ghost limitations without causing movement. While the original supernatural barrier is active, attempting to leave through the north doorway shows: **"I cannot leave."**
3. **After a short exploration period** (exact trigger/delay to be tuned in a future authorized build), the ghost temporarily cannot move. The red-haired woman enters through the **north arch**, wearing her approved **green dress**.
4. **Walk to the front of the altar.** Use the established temple, not a replacement scene. She walks around the altar to the place shown in the owner's image: **immediately in front of the altar, facing away from the player/toward the altar**. The scene should not spawn a pre-existing crystal behind her.
5. **Kneeling prayer.** She kneels with her back to the player, facing the altar, and remains in prayer for approximately **five seconds**. This requires a second, green-dress sprite-sheet variant with a kneeling back-facing pose; do not merely rotate a standing frame.
6. **Rise and place the crystal.** She gets up and leaves a **gold-glowing soul crystal on the ground at the exact prayer position in front of the altar**. Placement is synchronized with rising, not a permanent object spawned when the scene first loads.
7. **Exit.** She leaves through the north arch. Ghost movement is restored. The original supernatural barrier that prevented leaving the room **is now gone**, regardless of whether the player has resurrected.
8. **Player choice.** The crystal remains optional. The ghost can inspect it, deliberately resurrect, stay in the room, or leave through the north doorway as a ghost. No walking-over, single-click, scripted timeout or automatic contact may trigger resurrection.

### Original layout and placement reference

- Current prototype room: **16 × 16**, with **32 × 32-pixel tiles**.
- Existing altar: grid **(6, 5)**, footprint **4 × 2**; north doorway marker **(8, 0)**; player ghost spawn documented as **(8, 12)**.
- The current/prototype crystal is documented at **(8, 9)**, too far south/behind the woman. **This is the wrong position for the revised scene.**
- Intended crystal position is **the woman's kneeling/prayer position immediately south of the altar**, visually aligned with the center of the altar in the supplied temple screenshot. A likely grid target is **(8, 7)**, but coordinate must be verified against that screenshot and the actual collision/placement system before any gameplay change. **Do not treat (8, 7) as an owner-approved exact coordinate independent of the image.**
- Do not move the altar, resize the temple, or alter accepted editor geometry to accommodate this scene.

## Mouse and movement behavior

**Walk Temple mode** follows the agreed old-school Ultima Online-inspired control contract:
- **Hold right mouse button** to move continuously in the cursor's direction; cursor farther away = faster movement, release = stop. Movement must not teleport.
- **Left single-click** = inspect/examine or attempt an object interaction, with appropriate text. It **never** moves the character and **never** resurrects.
- **Left double-click** on the nearby soul crystal = deliberately begin the resurrection sequence. Single-click displays a description, e.g. **"A glowing gold crystal."**
- Proximity and line-of-access must still be respected. Avoid double-firing single-click gameplay effects when a double-click is recognized.
- In **DK Architect**, mouse gestures keep their editor meanings; do not let game interactions break Place/Move/Rotate/Save/Load/Export/Import.

### Ghost interaction text

| Nearby target / action | Approved ghost response |
| --- | --- |
| Book | "A ghost cannot do that." |
| Fire brazier | "The fire doesn't affect me." |
| Bench / trying to sit | "Ghosts need no rest." |
| North doorway **before** the prayer/barrier removal | "I cannot leave." |
| Soul crystal, **single** left-click after placement | "A glowing gold crystal." (or close owner-approved descriptive copy) |
| Soul crystal, **double** left-click after placement | Start resurrection, only if in range. |
| Body on altar | Behavior/text **not decided yet**; do not invent. |

After the woman prays and exits, the north doorway is no longer blocked by the original barrier. The ghost may exit **without** using the crystal. Ordinary solid walls remain solid.

## Two courtyard outcomes

The doorway eventually leads to a **courtyard**. This is **future approved canon**, not an authorization to construct that area now.

| Player state upon exiting after prayer | First courtyard view of the woman | Her transformation |
| --- | --- | --- |
| **Still a ghost**; ignored crystal | Red hair, **green dress**, same as in the temple | A **golden, shimmering weeping willow** |
| **Resurrected / alive**; deliberately double-clicked crystal | Red hair, **red dress** | A **black, sickly-looking weeping willow** |

These are *different world-state/perception presentations*, not random cosmetic changes. The woman in the red dress is the **same person**, not another character. Preserve the timing and branches exactly, and do not explain away the contrast with invented lore.

A future save design must preserve at minimum whether the opening prayer happened, barrier was removed, crystal was placed/used, and whether the player is ghost or alive. Save/continue must not replay or bypass the ritual improperly. Exact save schema is an implementation decision for an authorized build.

## Artwork specifications and scope

### Approved source of truth

Existing original transparent PNGs under:
`assets/art/characters/crystal-woman/`
- `crystal_woman_north.png`
- `crystal_woman_east.png`
- `crystal_woman_south.png`
- `crystal_woman_west.png`
- `crystal_woman_spritesheet.png`

The original character is red-haired, green-dressed, **32 × 32 tile-aligned**, minimal crisp pixel art; no smooth/vector redraw and no borrowed artwork. The new artwork must **match the originals** in face/hair shape, dress greens, outlines, pixel scale and transparency, not establish a new visual style.

### Current narrowly approved art deliverable

A **second green-dress character sprite sheet** retaining the existing four cardinal standing views and adding **one new back-facing, kneeling/praying north-facing pose**. Back to viewer, face toward altar, knees on floor, green dress and visible red hair. The new pose can be held static for ~5 seconds; no walking animation or extra frames are required. Preserve the source four views exactly when assembling a composite if practical.

**Order:** documentation first, artwork second, owner's visual review next. **Do not add the unapproved sheet to the game or upload it to GitHub as an in-game asset until approved.**

### Separate future art to approve later

- The **dead player's body** lying on the altar, missing today and the likely next sprite task.
- The same red-haired woman's **red-dress** version for the living-world courtyard view (matching scale and silhouette, not required in this request).
- Golden shimmering willow and black sickly willow, with any desired effects, for the courtyard (not required in this request).
- The courtyard itself (not yet approved to build).

## Existing implementation vs the agreed design

As of this document's creation, the public README/test-center describe an older opening: woman appears before ghost exploration, crystal begins on the floor at prototype coordinates, and **one** left-click resurrects. The current north arch has no courtyard scene. **These are known mismatches, not the approved final design.** This document does **not** claim they were repaired.

Also reported by the owner, **not fixed by this documentation task**:
- Main menu sometimes does not appear on refresh; the temple opens directly. Investigate entry point/URLs and published Pages behavior in an authorized fix.
- DK Architect selected-object rotation/move can shift objects by multiple tiles.
- DK Architect browser is missing approved sprite variants/directions.
- Original Godot/history branch storage is a concern. **Do not delete/archive branches without checking uniquely referenced work and receiving approval**; Git branches share objects, so removing a branch may not save much storage.

## Acceptance checklist for a future authorized gameplay build

- Crystal **does not exist** until placed by the woman after kneeling.
- Ghost has free exploration + correct object lines before arrival.
- Barrier blocks doorway at first; it is gone after prayer for **both** routes.
- Cutscene locks movement only during arrival/prayer/departure, then releases it.
- Woman follows original north doorway/altar route, kneels **back to camera** ~5 seconds, rises, deposits crystal at screenshot-aligned position, exits.
- Left **single**-click crystal describes; left **double**-click crystal resurrects; walking on crystal never resurrects.
- Right-mouse continuous Ultima Online movement and DK Architect editing remain intact.
- Ghost exits to **green-dress woman → shimmering gold willow**; living exits to **red-dress woman → black sickly willow**, only once the courtyard has been authorized and built.
- Save/Continue respects state; no accidental automatic resurrection.
- Existing temple, altar geometry, editor functionality and JSON import/export preserved.
- Browser visually inspected; automated tests complement, not replace, manual checks. GitHub Actions used **sparingly** under Company Bible.

## Authorization boundary

The owner expressly requested **"don't build"** while planning, then narrowly authorized **documentation and one kneeling green-dress sprite sheet after documentation**. This instruction **does not authorize gameplay code, a courtyard, a corpse, a red-dress sheet, tree art, release/tag/deployment, or branch deletion**. Reference `COMPANY_BIBLE.md` for shared project change-control rules.
