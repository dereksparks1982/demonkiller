# Demon Killer

Demon Killer is a Gothic fantasy RPG by DK Softworks, built with original top-down pixel art, Streaming Cells, and an independent persistent-world server in development.

[Play Demon Killer](https://dereksparks1982.github.io/demonkiller/)

## DK Architect

Press **F8** or click **ARCHITECT** in the temple or outdoors for the same Prison Architect-style construction categories, searchable approved art, building tools, and editor commands. In the browser preview, map edits save in Firefox; export them via **Logistics → Export Map JSON** for integration. A connected DK Server validates permanent world edits.

## Lilith's courtyard prayer (M40)

On the first temple exit, the character becomes hidden and controls lock. The camera moves ahead and follows Lilith up the existing courtyard path. She speaks **three lines of prayer in a visible dialogue box** inside the otherwise empty stone circle, then transforms using the six approved sprite stages for the current state. **Dead/ghost = healthy golden willow (green dress). Living = black diseased willow (red dress).** The camera then returns to the character and control resumes. Later visits show the completed tree, not the scene.

## UO-style paper doll

Press **P** in either region for the same Classic Ultima Online-inspired paper-doll menu. Its Help, Journal, Skills, Status, Backpack, Profile, Options and Log Out actions use existing Demon Killer functions. Guild, Quests, and Peace/War are shown as unavailable until their real gameplay systems are built. **There is no Delete Save button on the paper doll.** Options opens Save Management at the main menu; Log Out leaves the character/world intact.

## Save Management

Under **Main Menu → Options → Save Management**:
- **Delete Character:** deletes only the character and their belongings; the persistent world keeps its history, economy and NPCs.
- **Reset Server World:** requires a real connected DK Server and typed \`RESET WORLD\`. Clears its world, character, history, previous checkpoints and journal.
- **Start Fresh:** typed \`START FRESH\` clears character and browser drafts, plus the world **only when a server is actually connected**. On GitHub Pages it clears browser saves only, because the static preview has no server.

GitHub Actions' six-shard regression workflow is **manual-only**; no hosted test runs are required for this build.
