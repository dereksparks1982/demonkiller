# Demon Killer Changelog

## v0.2.14 development preview | 2026-11-05 | Coordinate inspector + copy/paste, build 3

- Added an object inspector inside the floating Pandora-inspired builder with exact X/Y position, north/east/south/west facing and optional solid/passable collision on non-door objects.
- Added copy-object then paste-on-click with accurate placement preview and standard overlap/geometry protection.
- Added bring-to-front and send-to-back controls for static scene-object draw order. Undo/redo and saved room data cover each change.
- Existing closed-door blocking remains authoritative; malicious or invalid collision fields are rejected on import.
- No player permission bypass, new NPC AI, quest creation, artwork, scene layout changes or new offscreen map.


## v0.2.13 development preview | 2026-11-05 | Staged approved sprite library, build 2

- Added a searchable approved Sprite Library tab to the floating Architect with individually usable 19 crystal sprites and 6 static character appearances: ghost, human, cult member, Lilith, cult leader, Devil.
- Staged assets are genuine one-tile objects: place, move, rotate to cardinal facings, duplicate, erase, undo/redo, save, load and import/export through existing Architect operations.
- Staged actors are visual-only scene props, not scripted live NPCs. Other crystal colors are static visual props only, with no invented soul powers or resurrection behavior.
- Explicitly reject unknown sprite IDs on room import. No new artwork was generated and no protected story, temple geometry, cult state or player save keys were changed.
- Approved decoration and portrait master sheets still need correct individual slicing and review before being placed from the library. Browser visuals remain pending.


## v0.2.12 development preview | 2026-11-05 | Floating Pandora-inspired Architect, build 1

- Replaced fixed Architect controls and the room details sidebar with a draggable, resizable floating construction window inspired by Pandora's Box and the UO house builder reference.
- Preserved existing tools, asset thumbnails, room properties, saving/export/import, wall construction, object operations and the original 512px playable canvas.
- Added category tabs (Walls/Floors/Structure/Items/Ritual) and clearly marked future Admin and Quest panels; neither panel claims server permissions or working mission creation.
- Added minimize/restore and close; close returns to Walk Temple. Saved only window position/dimensions and minimized state under a new isolated UI preference key.
- No old room/save keys, art assets, temple geometry, resurrection behavior or player world permissions changed. Owner browser review pending.


## v0.2.11 development preview | 2026-11-05 | Approved masonry + Pandora-inspired Architect

- Replaced the old 20 wall graphics with 80 extracted sprite variants sourced from the owner-approved Dungeon Temple Wall Tile Atlas: straight, corner, T, intersection/post and end in four directions and clean/moss/cracked/broken treatments.
- Used original source pixels with nearest-neighbor downscaling and cardinal rotations, never new wall imagery; master atlas stays unchanged.
- Added wall paint/drag, axis-aligned straight runs, rectangular room outlines, wall eraser, wall-style selection and searchable art browser within the existing DK Architect sidebar.
- Wall finishes are per-cell room data and survive save/load/export/import/undo/redo; old room JSON gains default clean finishes when loaded. The original binary wall geometry and collision system remain untouched.
- Initial temple perimeter uses restrained deterministic clean, moss, cracked and broken finishes without moving a single wall, door, altar, NPC or character.
- No new floor art yet; matching clean/worn/dirty/cracked/broken floor atlas is next for review. Browser visual acceptance remains pending.


## v0.2.10 development preview | 2026-11-05 | Approved soul crystals

- Split the exact owner-uploaded two-row "Glowing and Dull Pixel Crystals.png" master into 19 separately named 32×32 transparent game sprites: nine colors with bright/dim frames, one static silver depleted sprite.
- The Forsaken Temple gold crystal draws at 24×24 within its 32×32 interaction tile; its actual colored silhouette is smaller still.
- While unspent, the bright/dim gold image changes on a slow, irregular schedule. Refusing the crystal preserves this behavior.
- On a successful ghost double-left-click, only that selected crystal turns to silver immediately. Resurrection timing, choice, and all other gameplay/Architect geometry stay the same.
- Crystal source splitting is reproducible through a narrowly scoped, one-time GitHub Actions extraction. Browser visual acceptance is still pending.


## v0.2.9 development preview | 2026-11-05 | Pointed dialogue tails

- Replaced the shared 9×9 rectangular dialogue stub and detached bottom line with a longer, 26-pixel tapered pointer.
- Pointers are drawn with the same character-specific border color and dark interior; the base joins the speech bubble and aligns toward the speaker.
- Applied centrally to cult leader, Devil, and Lilith without changing raised box positions, NPC sizes, altar, temple geometry, or DK Architect.
- Updated simulated Canvas regression coverage and cache/version labels. Owner visual acceptance remains pending.

## v0.2.8 development preview | 2026-11-05 | Raised temple dialogue boxes

- Raised ritual speech bubbles for the cult leader, Devil, and Lilith to sit clear of the speaker and the bound player on the altar.
- Increased vertical clearance from 15 to 64 pixels and retained horizontal clamping and the upper canvas boundary.
- Added a regression test that confirms the cult leader's dialogue text is above the altar body area.
- Kept the approved 3×2 altar, NPC scales, scripted dialogue, Architect behavior, and disposable development saves unchanged.
- Updated the menu/temple cache query to v0.2.8.


## v0.2.7 development preview | 2026-11-05 | Altar and bound player scaling

- Shrunk the sacrificial altar footprint from 4×2 to 3×2 tiles (96×64 pixels), recentering its starter-room placement on the north aisle at (7,5).
- Scaled the lying human/corpse from 64×32 to 40×20 pixels, centered on the altar, with a matching fallback.
- Updated DK Architect's altar palette footprint, translucent placement preview, 2×3 rotated preview, collision and placement behavior through its shared catalog.
- Left the temple walls, NPCs, altar sequence, crystal placement, and editor controls intact.
- Development saves are disposable per owner direction; no old-save migration or compatibility workaround was added.
- Updated menu/temple cache versions and added altar-preview placement regression checks. Live browser visuals still require review.


## v0.2.5 development preview | 2026-11-05 | Sacrifice dialogue and cache refresh

- Added on-screen pixel speech bubbles above the cult leader, Devil, and Lilith, timed to prayer, sacrifice, confrontation, and kneeling.
- Leader: "The veil knows your name." then "Your life ends here."
- Devil: "You're mine." then "Death offers no escape."
- Lilith: "In ash and silence, let one light remain."
- Allowed a little more time for the leader's death announcement to be read.
- Temple navigation and its JavaScript request now carry the version to reduce stale browser-cache problems. A footer version provides visual verification.
- Speech bubbles are visual overlays, not saved objects; no temple geometry, approved art or gameplay controls change.
- Extended introductory regression coverage. Browser visual review remains necessary.


## v0.2.4 development preview | 2026-11-05 | Sacrifice-scene scale and staging corrections

- Draw the approved living/dead 64×32 lying-hero art at native size, centered on the unchanged 128×64 altar.
- Keep the cult leader at the foot of the altar facing north toward the body throughout prayer and sacrifice.
- Start the Devil beside the altar on its east side facing west, and Lilith on its west side facing east.
- Spawn the ghost farther down the existing center aisle at the room's configured player spawn (default 8,12).
- Correct the Devil and cult-leader sprite-sheet frame order to south/west/east/north.
- Render moving cult members using the four approved named directional PNGs rather than assuming an unverified sprite-sheet order.
- Retain the established ritual, optional crystal resurrection, room geometry, props, Architect editor and save behavior.
- Update cutscene and control regressions; visual acceptance still requires owner browser review.


## v0.2.3 development preview | 2026-11-05 | Main menu and sacrifice opening

- Preserved the approved sword-and-pixel-art menu and scaled its dimensions to fit available viewport height at ordinary browser zoom.
- Suppressed the unstyled fallback menu while the sprite sheet loads, while retaining accessible text if the image fails.
- Added the cult gathering, leader prayer and sacrifice, ghost emergence, Devil encounter and exact "You're mine" line.
- Devil leaves first; Lilith kneels facing the altar for about five seconds, leaves the soul crystal directly in front, then exits.
- The starter crystal no longer appears before Lilith places it. Single-click still inspects, double-left-click intentionally resurrects, and the north barrier lifts after the ritual.
- Rendered the altar body using the existing alive/dead human artwork, relocated the walkway candle, and selected the newer flame-bearing brazier art from the temple sheet.
- Kept the original altar/walls and 16×16 Architect geometry, movement controls, story branches, JSON tools and named records.
- Updated the staged-intro and temple regression coverage. Browser visual acceptance remains pending.


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
