# Demon Killer

Demon Killer is an original, single-player Gothic fantasy adventure with Zelda I-era top-down pixel art, a custom web runtime and a persistent server-in-development. It is designed for browser play without installing a local copy.

[Open Demon Killer](https://dereksparks1982.github.io/demonkiller/)

## M38 | DK Architect uses Prison Architect menus

The **ARCHITECT** button and **F8** open the **same construction menu system in the temple and outside**. The game does **not** switch to a different, generic map or open a separate page.

- Along the **bottom edge**, the Prison Architect-style categories are Foundations, Materials, Rooms, Objects, Staff, Utilities, Deployment, Logistics, Intelligence, Emergencies, Clone, and Planning.
- Selecting a category opens the **fly-out construction menu above its icon**, with tools and their labels. Unimplemented options remain visible but **disabled**, not pretending to work.
- In the temple, the tool menus operate the existing 16 × 16 DK Architect room tools and original 32-pixel sprite catalogue.
- Outdoors, the tool menus operate **on the actual game canvas**. Right-drag pans; mouse-wheel zooms. Select **Foundations → MOVE WHOLE BUILDING**, drag a whole shop or house, and release to save. The server and browser preview use the same collision logic, with green/red placement previews and errors for blocked paths.
- Doors, materials, wall placement/removal, wall runs, room outlines, inspector, undo/redo for moves/doors, and **EXPORT JSON** are available outdoors. Some temple-only facilities remain disabled in exterior mode until they have working exterior state.
- **GitHub Pages browser editing** saves a map-only **browser draft**, independent of your character. The draft is reloaded when you return to play. Export JSON to send the layout back for validation and GitHub integration. **GitHub Pages does not secretly run a server.**
- Where a DK Server is actually available, the server validates and persists its own authoritative edits. Stable building IDs preserve links to deeds, vendor stock and streaming cells.

The temple's southern position, courtyard pathway, empty center reserved for Lilith, and willow story destination are unchanged. This release does **not** implement the Lilith camera cutscene or publish interiors as enterable rooms.
