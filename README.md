# Demon Killer

**Demon Killer** is an original, top-down Gothic fantasy adventure in active development by **Elderred Softworks LLC**. The game and its **DK Architect** world editor are being developed with our own HTML, CSS, JavaScript, Canvas rendering and grid-based world data, **without Godot or another external game engine**.

> **Current development milestone: v0.2.2 | Menu / Crystal Woman Intro / Forsaken Temple / DK Architect.** This is a development prototype, not a finished or released game.

## Play the current build

Open **[Demon Killer](index.html)** in Firefox or another modern desktop browser. The root is now a main menu using the approved pixel-art sheet. **New Game** offers three Zelda-I-style save records with a single character name (up to eight characters); **Continue** loads a named record. The existing **[Forsaken Temple / DK Architect](test-center.html)** screen remains intact, with all room-building tools, Save/Load, and JSON Export/Import. No installation, build step, npm dependencies, network connection, or third-party sprite pack is required.
 
**Movement:** in Walk Temple mode, hold the **right mouse button** and point to travel continuously, with higher speed when the pointer is farther away. **Left-click interacts** with nearby items and never auto-walks or teleports. WASD and arrow keys are also supported. In Architect Mode, left-click retains its editing behavior. The temple can still be opened directly.

The **16 × 16 temple**, at **32 × 32 pixels per tile**, begins with the player as a **ghost**. Walking onto the soul crystal does **nothing**. A nearby **left-click** starts a short ritual that reunites the ghost with its body on the altar, while passing it by preserves the secret ghost route. Either choice belongs to the story. The red-haired crystal woman enters the north arch, walks around the altar, pauses on the floor in front of it, then leaves. Ghost controls unlock afterward. The north arch remains a future connection marker and **does not yet load a courtyard**.

Switch to **Architect Mode** to edit the room. Existing tools include placement, selection and moving, 90-degree rotation of *selected* objects, floor painting/fill/rectangle, walls, doors, undo/redo, JSON export/import, browser-local saves, and exact object coordinates. See [Temple Lab / controls](TEST-CENTER.md) for details.

### Current limitations

- The approved north/east/south/west sprites are now used for characters and objects; floor and auto-connected wall PNGs render in the room. Architect placement has a translucent sprite preview, a green/red footprint, and mouse-wheel 90-degree rotation. Expanding the asset catalog, refining wall joins and broader Gothic decoration remain future work.
- The room is currently fixed at 16 × 16; variable-sized interconnected rooms and meadows are future work.
- The ghost and mortal paths are a working **opening choice**, not complete story routes.
- Saving uses an isolated DK Architect prototype key and separate named-character records in browser local storage. The existing test-center layout key remains unchanged; exports are the portable backup. Special name-triggered quests are a future idea, not implemented.

## Planned persistent world server

We are designing a **server-authoritative, RunUO-style persistent world** to back the existing browser player. The client will draw the game and send player intentions; our own server will own the clock, world objects, NPCs, interactions, character state, and durable saves. A preliminary theme proposal is **six real hours of day and six real hours of night**, configurable rather than hard-wired. The first test world remains **the sacrificial temple only**.

See the [world server design and prior-code audit](docs/world-server-design.md). **This server is planned, not yet implemented or deployed.** The browser prototype currently runs offline with local saves.

**Website note:** Hosting the web client from GitHub `main` is independent of running an always-on game server. GitHub Pages can serve the static client when Pages is configured, but cannot host the persistent backend.

## Development focus

**Only the sacrificial temple is in scope for now.** We are using it to mature DK Architect, Gothic artwork and gameplay, with original cardinal-direction sprites and **no diagonal construction**. Larger connected rooms and the courtyard come after the temple and editor meet their acceptance criteria.

Read [Architect development plan](docs/architect-plan.md), [changelog](CHANGELOG.md) and [legacy review](docs/legacy-review.md).

## Verification

Run `node tests/test-center.cjs` for simulated temple mechanics. Also run `node tests/menu.cjs` for name registration and `node tests/intro.cjs` for the opening scene. These are **not** a substitute for a visual browser test. The original temple prototype was visually tested on Ubuntu; the repository migration does not add gameplay logic.

## Prior Godot project

The former Godot working-tree snapshot was preserved **before cleanup** at [archive/godot-recovery-2026-11-04](https://github.com/dereksparks1982/demonkiller/tree/archive/godot-recovery-2026-11-04), commit `3f6cc95a237e45b9d71c9403b7757332672f2fbe`. Historical Git commits and tags are separate historical references. The active `main` no longer carries Godot runtime/editor files. See the [migration notes](docs/legacy-review.md) for a precise inventory, gaps and systems worth reimplementing.

Copyright and licensing remain subject to each component's actual rights and attribution. Historical files are **not** automatically licensed as original new-game assets. Contact: [CONTACT.md](CONTACT.md).
