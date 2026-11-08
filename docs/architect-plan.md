# DK Architect | Current Terrain and Construction Direction

The former temple-only plan was superseded when the owner retired the old temple/village layouts and approved a new **9,216 × 9,216-tile** world. The original text is preserved at [history/architect-plan-temple-era.md](history/architect-plan-temple-era.md).

**Canonical reference:** [Demon Killer master roadmap](demon-killer-master-roadmap.md).  
**Implementation and handoff:** [development-handoff.md](development-handoff.md).

## Working editor contract

Use one coherent toolbar combining the existing Prison Architect-like object/build categories and Cities: Skylines-like terrain brushes.

- Left drag paints terrain, changes elevation or places a structure.
- Hold right mouse and drag to pan the map. A movement click in play mode is separate.
- Mouse wheel zooms the map; active object preview rotation follows existing placement-mode rules.
- Terrain strokes save automatically to the authoritative server in connected play. GitHub Pages is only a browser preview.
- Provide undo/redo, elevation inspection and full/world-cell export via server.
- All world state is partitioned into 128×128 Streaming Cells, 16×16 sectors and a 9,216² global coordinate system.
- Respect actor/structure collision, cardinal movement and server-authoritative revisions.

## Current boundaries

M69 supports a sparse terrain ledger, material painting, signed height editing, a Landscape menu in the connected existing outdoor editor, limited-area rendering, undo and export. Whole-world navigation, big-brush oceans, realistic height-aware 2.5D terrain, rivers with hydrology, cave authoring, spawner painting and staged construction are **not complete**.

The replacement world should have about one-third ocean, a great navigable river, natural mountains and marshes, six sigil towns (one capital), three villages, three worker camps, and ultimately independent NPC civilization building.

Further work must not reintroduce prefabricated old town/temple geometry. Treat historical architectural notes as archived reference, not active design instructions.
