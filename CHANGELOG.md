# Demon Killer Changelog

## v0.2.27 / DK Server M6 | 2026-11-06 | NPC relationships, contracts and pathfinding

- **Social memory:** Added saved NPC contacts with per-person conversation frequency and a one-meeting-per-30-world-minute faction reputation gain limit.
- **Physical conversations:** Added `talk` server actions with alive/form/Manhattan-distance checks, role-specific NPC responses and durable world-history records.
- **Real commissions:** Open business owners can issue a single active goods-delivery contract. Deadlines progress only with running world time. Server validation prevents remote acceptance, reward spoofing, inventory forgery and repeated payouts; completing one transfers goods to shop stock and money from the shop to the character, adding commerce skill and reputation.
- **Pathfinding:** Replaced straight-line NPC steering with cardinal-only bounded BFS around existing Architect walls, house footprints and obstacle tiles. Travel passes through the real courtyard/village portal instead of cutting through a wall.
- **Playable interaction:** Outdoor UI includes Talk, Accept Commission and Deliver Goods controls; double-clicking an NPC starts a real conversation through the connected server. The static public preview does not claim these features function without DK Server.
- **New server APIs:** `GET/POST /api/v1/social` provide read-only nearby contacts/active contracts and allowlisted authoritative social actions. Social state migrates safely into existing M5 saved worlds, is validated, and is saved via the existing atomic writer and append-only event archive.
- **Testing:** Added social and NPC-navigation regression suites, extended the existing Node test command, updated version checks, README and server design documentation. Module-level pure-JavaScript checks exercised contracts, immutable transactions, duplicate-reward rejection, path detours and portal travel; complete Node integration suite still requires running in a full source checkout.
- **Boundaries:** No new graphics, no Godot, no new server dashboard, no additional character slots and no internet-hosted persistent backend. Full UO-level relationships, AI and world hosting remain future milestones.

## v0.2.26 / DK Server M5 | 2026-11-06 | Regions, living NPCs and UO-inspired economy

- **Variable-size world:** Added shared 16×16 temple, 64×64 courtyard and 128×128 village geometry with correct **16×16 temple exterior**, houses, paths and regional gate links; existing DK Architect walls now support arbitrary area dimensions.
- **Playable outdoor client:** Added camera-following courtyard/village pages using existing art and deliberately simple in-game scenery. Temple north-door exit and reverse entry now transfer automatically. **Single-click door inspection; double-click door toggling.** Houses have realistic footprints but are not falsely advertised as fully furnished interiors.
- **Lilith:** Server persists the first courtyard entry and the ghost/golden-willow versus resurrected/sickly-willow outcome; small Canvas transformation uses existing character material and primitive rendering, no new pictures.
- **Living server world:** Added 12 NPCs, schedules, physical movement, health/needs, 6 businesses, shops/stock/expenses, postal courier and bank box, roaming camp, monster-threat territories and autonomous settlement changes. The world advances on the server while the browser is closed.
- **Player systems:** Server-owned starting inventory, gold and bank balance, gathering nodes/respawn, commerce and foraging skill progress, proximity-checked buying/selling and bank deposits/withdrawals. Ghosts cannot transact with physical goods.
- **Permanent record foundation:** Atomic authoritative world snapshots plus a serialized append-only world-events NDJSON archive and bounded recent-event API. Expanded single-slot client and backend API, region discovery, state reads, bank collection and structured gameplay actions.
- **Server restrictions retained:** One character, no Godot, no passwords or second dashboard, loopback-only binding. The public static website still has **no hosted persistent DK Server**, so its preview never fabricates NPC simulation or a live bank.
- Added targeted Node regression contracts for spatial consistency, portals, living-world ticks, deterministic schedules, pause, mail, trade, skills and HTTP persistence. Documentation and game version updated.

## v0.2.25 / DK Server M4 | 2026-11-06 | Persistent run/pause state and one server-owned life

- Added durable server-owned world runtime with **START / STOP** control endpoints. Stop freezes the six-real-hour day/night cycle, and Start resumes from the saved instant. No time is counted while DK Server is off or deliberately paused.
- World clock checkpoints run through the single-writer queue even without an attached browser. Full process shutdown now pauses the clock before closing. Existing M3 worlds without a runtime are accepted.
- Enforced a **single character slot** at the backend, not just in the menu; attempts to create slots 2 and 3 are rejected.
- The integrated menu's Start/Stop buttons now call genuine endpoints on a connected local DK Server; New Game and Continue automatically resume the paused server world. Browser-only GitHub Pages continues to report **Not Connected** because there is still no hosted world process.
- Added four M4 regression tests for pause/resume, no offline catch-up, one-life enforcement, API control, restart persistence and legacy save reading. Updated the previous server tests and launcher for M4. **No internet-facing service deployed**; secure HTTPS hosting and autonomous NPC simulation remain pending.

## v0.2.24 | 2026-11-06 | Visible Persistent World options on the public webpage

- Fixed the public GitHub Pages menu hiding the entire Persistent World section; it now always appears under Options alongside Music.
- Added **Start Server**, **Stop Server**, **Refresh**, world server connection status and a day/night clock status. The existing local server is detected accurately and its graceful Stop action remains available.
- On GitHub Pages, the section transparently reports **Not Connected** and explains that an actual hosted DK Server has not been deployed; the Start button explains the missing host rather than issuing fake network requests. No password or separate player dashboard was added.
- Main menu now displays **one character slot** and prevents New Game from overwriting an existing character's life. The public preview's older browser save data remains isolated from server records pending a hosted backend.
- Added regression checks for visible server controls, single-slot behavior, public offline status, zero imaginary requests, and locally connected Stop Server operation. No persistent cloud hosting is claimed.

## v0.2.23 / DK Server M3 | 2026-11-06 | Single-player integrated persistent world

- Replaced the password-based local owner flow and separate `/player` dashboard with the **normal Demon Killer main menu** served by the loopback DK Server. No account or password is required to manage the three character records.
- Added `start-demon-killer.sh`, a Linux launcher that starts DK Server detached, opens the game, reuses the running compatible process, and warns rather than killing an incompatible older server. Closing Firefox does not terminate the persistent world process.
- Added **Options → Persistent World** with online status, day/night phase, and an explicit **SHUT DOWN SERVER** button. Shutdown is loopback/same-origin controlled and waits for serialized world writes before the host exits.
- Moved local New Game and Continue to DK Server, without importing browser saves. Extended validated server-side actions for opening completion, cardinal movement, north-door interaction and double-click soul-crystal resurrection. New game records permit names as short as one character. Browser-submitted save snapshots remain forbidden.
- Removed active authentication endpoints and the obsolete owner-login and separate dashboard files. Previously generated local private identity/token files are unused but not destroyed on update. Restricted game asset serving to allowlisted paths and checked Host, Origin and Fetch-Site without granting CORS.
- Preserved existing temple geometry, original art, ritual and DK Architect tools. **Not yet complete:** server-authoritative Architect edits, cult data, autonomous NPC/monster behavior, and multiplayer. GitHub Pages remains a standalone preview and cannot itself host the world process.
- Local M3 server regression tests passed; the Linux launcher was exercised against a real detached Node process, including authenticated-origin-independent shutdown. Browser visual smoke test remains pending.

## DK Server M2 development preview | 2026-11-06 | Owner sign-in and server-backed New Game / Continue

- Introduced a loopback-only DK Server character-record interface at /player, with first-time owner password setup, sign-in/out, a three-slot New Game form, and Continue reading the authenticated server record. No browser-local save import, client-submitted snapshots, or automatic record overwrite.
- Owner credentials are stored as a salted scrypt digest, not a password; local sessions use random HttpOnly SameSite=Strict cookies, memory-only session revocation, 12-hour validity, and a temporary lockout on repeated incorrect passwords. The bootstrap admin token is not included in public browser code.
- DK Server accepts authenticated session cookies alongside the existing private Bearer administration path. All changes are written by the server; the browser never sends arbitrary world saves. A failed or corrupted identity file refuses startup.
- Preserved the M1 world geometry and six-hour clock. Original browser gameplay and its older isolated saves remain untouched until the **playable** client is converted; this is not falsely presented as a completed gameplay migration.
- **13/13 Node tests passed locally**, including existing M1 tests, owner setup/sign-in, session revocation, parallel initialization, unauthorized mutations, and restart login. No GitHub Actions testing used. Chromium visual rendering could not be confirmed in the test environment; owner review remains pending.

## DK Server M1 development preview | 2026-11-06 | RunUO-inspired persistence foundation

- Added independent Linux **DK Server** under server/, with an original Node.js implementation. RunUO's World, SaveStrategy, entity and timer systems were inspected as design references; no GPL C# or UO assets copied.
- Server creates the approved 16×16 Forsaken Temple state, owns a durable world clock (six real hours of day, six real hours of night), and stores new character records with synchronized writes before acknowledging creation.
- Private authenticated localhost-only character-create/read endpoints reject forged save snapshots, bad inputs, cross-origin writes and duplicate slots. Server data and admin token stay out of Git. Two processes cannot write the same world directory.
- World snapshot, health, clock and read-only event stream power a small DK Server status page. Bad or unknown-version world data refuses startup rather than resetting; no migration of old browser saves.
- **Not yet connected to the browser game.** Current client-local save behavior has not been disabled or promoted to the new authority. Next step is authenticated New Game/Continue integration and authoritative player actions, then safe retirement of old browser saving.
- Nine native Node regression tests passed locally. No GitHub Actions tests were started; existing gameplay, intro, temple graphics, DK Architect, and audio remain unchanged. Development preview pending owner acceptance.

## v0.2.22 development preview | 2026-11-06 | Architect editing and character-only skill rust

- Main menu music: clear music toggle, persistent 0–200% volume slider (100% = unamplified track), Web Audio amplification with peak-reducing dynamics processing, and graceful unamplified fallback. Default 200% honors the louder-menu request. Older on/off preferences remain valid; tests updated. Temple audio unchanged.

- Repaired DK Architect's bottom row to six compact individually framed controls, matching the upper category buttons instead of using a large decorative gold strip. Left tools are centered, hidden overlapping DK pennant removed, and right-rail icons are scaled to fit fully inside their borders. Approved game room geometry unchanged.
- Split **Select** from **Move**. Move now operates click object → click destination. Rotate and Copy are tool-first: choose the tool, then click an existing placed object. Esc clears targeting and returns to Select, including when a text field was focused. Keyboard R arms Rotate; Delete arms Erase.
- Individually selected wall sprites can rotate 90 degrees in place and save their facing in optional `wallRotations`. Automatic wall faces still choose corners by neighbors. Old temple saves without the new field load with default zero rotations; undo/redo includes wall orientation.
- Added a pure, server-independent skill mastery/rust model. Every learned skill can rust a little after **60 days of meaningful per-character active playtime** without use. Only 0.1 per additional active week; at most five points or 20% loss, and never zero. Valid practice restores lost skill faster than new learning. No global cap across all skills.
- Skill records are stored in existing per-character slots, not the shared room layout. Brief genuine player movement/interaction advances the personal skill clock; offline time, idle time, editor time, opening cutscene and the server world clock do not. Actual mining, taming and alchemy gameplay are later systems, not claimed to exist in this release.
- Added regression checks for target-before-rotate, Esc cancellation, move/select separation, manual wall facing, and the skill module. No extra third-party assets, no changes to temple lore or approved sprites.
- This is a development preview awaiting owner visual and functional acceptance.


## v0.2.21 development preview | 2026-11-06 | Real creator-built dungeon construction sets

- Added 243 named transparent sprites from 0x72's **original 16x16 Dungeon Tileset v5**, verified byte-for-byte against both owner-provided copies and its official itch.io download.
- Kept 0x72 Dungeon Tileset II v1.7, Pixel_Poem's 2D Pixel Dungeon Asset Pack v2.0, and Pixel_Poem's Enemy Animations Set in creator-attributed game atlases. All four packs are now exposed through the UO-inspired DK Architect categories.
- Replaced the rejected wall renderer with separate **0x72 Original** and **0x72 Dungeon II** automatic wall systems. The original artist's matching base, front, outer edge and corner pieces are combined by wall neighborhood instead of inventing new corners. Individual walls from either pack and Pixel_Poem remain independently selectable, without pretending that different sets auto-connect.
- Removed 106 discarded hand-cropped DK wall pieces, 5 old wall-brush textures, both rejected source wall masters, obsolete wall scripts and one unnecessary inspection workflow from the playable branch. Retained historical versions through Git history.
- Added pack IDs per wall cell (`wallPacks`), exact custom wall IDs (`wallVariants`), and imported floor tile IDs (`floorArt`). Old local saves load with the new wall system and drop invalid unjoinable wallPiece objects.
- Added indexed imported sprites, multi-tile object placement previews, collision overrides, undo/redo support, validated object IDs, and live visual animation for NPC and enemy art. No AI, attack logic or loot behavior is implied by animated artwork.
- No gameplay story, temple layout, multiplayer/server state or approved UO-inspired toolbar geometry changed. Updated tests and technical docs; public README remains a game description and web-player link only.
- Visual corner approval in the live browser remains pending.


## v0.2.20 development preview | 2026-11-06 | Original wall sheet extraction, Architect scrolling and clean README

- Split the owner-uploaded `Demon Killer Stone Wall Tileset.png` into 106 individual original-pixel transparent PNG sprites, categorized into structures, corners, straight runs, mossy stone, ruins, curves, pillars and fortified sections; source sha256 and source rectangles recorded in the generated manifest.
- Each piece is placeable, rotatable, movable, removable and persistable in DK Architect with a true multi-tile footprint and no fake automatic joining. Save validation rejects unknown piece IDs.
- Removed 220 procedurally generated faux wall pieces from the active assets and all old 32px direction-specific artwork from the active wall palette. Existing room wall cells remain, now displaying one of five seam-tested 32px stone material tiles extracted/adapted from the owner's uploaded sheet, without pretending these are structural corner images. Old saved manual wall variants are safely normalized to grid masonry while retaining wall cells.
- Mouse-wheel events over the horizontal Architect sprite browser now scroll the sprite strip; existing arrows still work. Mouse-wheel events over the game canvas continue rotating an unplaced sprite.
- Kept the UO-inspired Architect toolbar geometry, original approved UI art, temple story and current saves. Removed obsolete wall-generation workflows and scripts so stale assets are not regenerated.
- Public README now contains only the game's description, current gameplay and player URL; the previous technical README moved verbatim into docs. Third-party CC0 asset research and compatibility guidance live in docs.
- No third-party art has been imported into the game or silently treated as a matching construction set. In-browser visual approval pending.


## v0.2.19 development preview | 2026-11-06 | One-click precise destination walking

- A short right mouse click now sets a fixed pixel-accurate destination; the ghost/living character continues travelling after mouse release and stops once the pointer coordinate is reached.
- Holding right mouse still steers continuously and stops immediately on release. Keyboard walking cancels one-click travel; losing focus cancels it. The existing left-click crystal/door interaction is unchanged.
- No navigation through solid walls, no new pathfinding, no fabricated server movement; this fixes how the destination is chosen and when movement stops. Dynamic regression checks cover a quick click across the room and a target less than 18px away.
- The orthographic, transparent 220-piece wall collection added in v0.2.18 remains unchanged. Pending owner browser visual approval.


## v0.2.18 development preview | 2026-11-06 | Exact cursor and seamless orthographic wall artwork

- Replaced the intentionally short-stopping mouse steering movement (17.6px dead zone plus another 0.35-tile standoff) with exact pixel-space clamped movement. The player no longer halts within a halo around the held right-mouse pointer. Existing left-click-to-interact, hold-to-steer and release-to-stop controls remain unchanged. Blocked destinations remain blocked.
- Replaced the earlier 80 heuristic-cropped wall tiles with **220 transparent 32×32 top-down original pixel-art variants**, generated from a fixed geometric junction mask. The archived approved master image remains untouched.
- 11 modular shapes (straight, corner, T, cross, end, pillar, arch, window, buttress, ruin, curve), each available in four cardinal orientations and five finishes: clean, dirty, mossy, cracked and broken. The 640×352 master has transparent background and no text.
- Generated sprites have standardized 12px cardinal edge profiles verified pixel-by-pixel in GitHub Actions before the files are committed. Rewrote automatic joining orientation rules to match exact north/east/south/west geometry, including the isolated-pillar case.
- DK Architect's scrollable tile palette now exposes five auto-join finishes and 220 exact component choices. Existing wallVariants, collision grid, room saves and brush/undo systems remain compatible.
- No change to canon, temple layout, resurrection, character sizes or UO-inspired interface proportions. Browser visual acceptance pending.


## v0.2.17 development preview | 2026-11-05 | Accurate approved UO-style stone and gold framing

- Rendered the horizontal tile browser's real old-stone window border as nine-slice Canvas regions from the exact approved UI master image (coordinates within the original file). No synthetic border art is substituted.
- Replaced the flat CSS command-strip approximation with the approved original gold six-button bar from the same image, aligning the existing Backup/Restore/Sync/Clear/Commit/Revert labels to its wells.
- Retained compact responsive CSS fallbacks only where the full decorative bar cannot fit on narrow/mobile viewports. The actual approved tool-button and DK-banner sprites are unchanged.
- No editor behavior, temple geometry, story events or room saves were altered by this visual-only enhancement. In-browser appearance still requires owner acceptance.


## v0.2.16 development preview | 2026-11-05 | Full approved wall-parts browser

- Expanded the horizontal Ultima Online-style wall tile browser from four automatic-join finish buttons to 84 art choices: four auto-join finishes plus all 80 original approved wall piece variants (straight, corner, T, post/cross, end × four facings × four finishes).
- A hand-picked piece is preserved in `scene.wallVariants` by tile coordinate. Automatic wall joining remains the default for all existing walls and for the four finish options. The original approved temple layout, north doorway and collision remain unchanged.
- Placing, line painting, room outlining and erasing now preserve or clear exact wall choices. Eyedropper selects a wall's current exact or auto style.
- Hover a hand-placed wall and use the Rotate action to cycle its four art directions; existing object rotation is unchanged.
- Import rejects unknown wall asset IDs; room saves created before the new optional wall-array field still load with auto-joining. Undo/redo and room export include manual selections. Browser visual review pending.


## v0.2.15 development preview | 2026-11-05 | Real approved-image UO house toolbar

- Owner rejected the previous dark, tall, tabbed floating sidebar (v0.2.12–0.2.14). Rebuilt the default DK Architect interface as a compact HORIZONTAL Ultima Online house-construction toolbar instead of restyling that sidebar.
- The UI directly renders exact regions of the owner-uploaded transparent 2172×724 `assets/art/dkarchitect/ui/Medieval Architect UI Sprite Sheet.png`: DK banner, selectable pixel-art tool buttons, minimize/close, arrows and decorative controls. The original source sheet remains intact.
- Working construction controls include visual horizontal tile browsing, Walls/Floors/Doors/Items/Ritual/Sprites categories, per-tile preview and selection, sprite sheet scroll arrows, placement/selection/rotation, wall brush, room outline, floor paint, undo/redo, object copy, erase and access inspection. Dragging moves the toolbar over the game.
- Backup/Restore use an isolated local draft snapshot, COMMIT saves the current room to local browser storage, and REVERT reloads the last local save. SYNC and CLEAR are deliberately disabled until a real persistent server and safe clear workflow exist. Building-level buttons remain disabled because this temple is currently one level.
- Detailed tools, X/Y object inspector and existing JSON room export/import live in an OPTIONAL expandable details drawer, never the default builder. The former rejected window dimensions are not loaded.
- No new art, altered story, temple geometry, collision, RPG gameplay or fictitious NPC/quest/server permissions. Browser visual acceptance remains pending.


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
