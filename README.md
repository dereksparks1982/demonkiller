# Demon Killer

Demon Killer is a single-player Gothic fantasy RPG with original pixel art, a custom top-down runtime, and a persistent world server. Explore Streaming Cells, fight monsters, trade, and watch NPCs and the landscape change as the world continues.

[Open Demon Killer](https://dereksparks1982.github.io/demonkiller/)

## DK Architect | On-screen Construction (M37)

While playing **inside the temple or outside**, click the visible **ARCHITECT · F8** button or press **F8**. This opens a Prison Architect-inspired construction dock with **category icons along the bottom** and the available tool options above them, directly on the game screen.

- **Temple:** The existing placement, wall/floor tools, object transforms, sprite palette, spawn marker and export controls are available through the bottom toolbar. The old floating Architect panel is retired from the visible interface.
- **Courtyard/village:** The Architect controls open as an overlay **over gameplay**, rather than navigating away. Whole-building moves, doors, materials, inspection and JSON export are available without the player leaving the game page. Close with F8 or the visible close button.
- **Local DK Server:** Edits are validated and saved atomically in the single persistent world. Whole-building moves maintain stable Streaming Cell IDs, deeds, and vendor inventory locations.
- **Public GitHub Pages preview:** An independent **browser-only layout draft** is available for editing and exporting JSON. It is **not** a server world save and does not update the repository automatically. Send exported JSON back for validation and integration.

The temple exterior, portal, willow story anchor and other story-critical positions remain protected. This release does **not** rearrange the village or implement the Lilith cutscene. Interior drafts remain in the separate DK Architect interior workspace and are not yet playable.
