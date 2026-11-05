# Demon Killer Changelog

## Main menu visual and studio credit corrections | 2026-11-05

- Removed the haunted-house/castle decoration beneath the menu, leaving the approved logo and game-control buttons intact.
- Corrected the game menu and short player-facing README to credit DK Softworks, whose DK represents Дом культуры (House of Culture), while preserving historical/legal references where appropriate.
- Added a regression assertion that the castle cannot be silently reintroduced into the menu.

## Unreleased Cult of Kosmos-style investigation board | 2026-11-05

- Replaced the public Society Register in the Cult menu with a fullscreen, radial, four-branch cult hierarchy around a locked central leader.
- Actual members display masked 8-bit-style silhouettes until confirmed evidence unlocks their identities and discovered clues on a selectable cult card.
- False or premature suspicions remain separate unverified leads instead of falsely appearing as confirmed positions in the cult network.
- Confirmed members can be marked for tracking; saved tracking, previously revealed identities and eliminated members persist across Continue.
- Kept the population and daily schedules behind the scenes; no playable city map or cultist elimination missions are implied.
- Preserved character records, cult truth, existing architecture, movement and story.

## Unreleased procedural society population | 2026-11-05

- Added 24 seed-generated ordinary and prominent citizens with persistent identities, occupations, personality traits, acquaintances and daily work/home/public routines.
- Registered civilians in the existing cult simulation without exposing their secret membership, overwriting established cult discoveries or creating fixed story identities.
- Added a public Society Register tab beside discovered cult dossiers. The register lists only names, occupations, general work hours and encounter status, never membership.
- Added future in-scene hooks for citizen encounters, abstract schedule queries and advancing the population clock. No new playable city or changes to temple/editor geometry.
- Added migration for saved character slots and tests for deterministic worlds, varying memberships, non-spoiler public records and persistence.

## Unreleased cult system | 2026-11-05

- Added deterministic per-world cult affiliation and dynamic recruitment, exits, deaths, changing circumstances, leadership vacancies and promotions.
- Added player-only character dossiers, investigation evidence and cult leads separate from the world's hidden truth.
- Wired a separate cult state into each named character record and added an overlay journal without moving the approved temple or Architect UI.
- Added independent regression coverage and system documentation. The current temple contains no town NPC roster or playable cult quest chain yet.

## Unreleased menu music | 2026-11-04

- Added epb9000's CC0 “Creepy Ambient Loop” v2 OGG to `assets/audio/music/creepyloop-v2.ogg` as quiet looping main-menu music.
- Connected playback to the existing music preference and retried after user gestures when browser autoplay is blocked.
- Added audio-license documentation and menu regression coverage without altering gameplay, DK Architect or the minimal public README.

## Unreleased gameplay fixes | 2026-11-04

- Refreshing the temple page now returns to Demon Killer's main menu; normal New Game/Continue still open the temple.
- Soul crystal single-left-click now describes the crystal; double-left-click is required to begin the existing resurrection ritual, still subject to range and ghost-state checks.
- Updated temple instructions and regression checks without changing DK Architect editing, save keys, room geometry or the public README.

## Unreleased design documentation | 2026-11-04 | No gameplay build

- Recorded owner-approved future Forsaken Temple opening: free ghost exploration, temporary movement lock, five-second kneeling prayer, crystal placement in front of altar, barrier removal, and optional ghost exit.
- Specified single left-click crystal inspection versus deliberate double left-click resurrection, with ghost object messages and two worldview-dependent willow transformations.
- Documented the missing corpse artwork, planned kneeling/alternate-dress/willow artwork, and known main-menu and Architect defects without claiming they are fixed.
- Adopted the shared Capital & Consequence Company Bible development rules for Demon Killer, including **sparingly used GitHub Actions**.
- **Documentation only:** current game code, release version, and existing sprite assets unchanged.

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
