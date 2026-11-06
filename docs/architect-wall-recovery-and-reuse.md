# DK Architect: verified masonry and reusable pixel-art research

**Scope:** Current owner-authorized v0.2.20 wall replacement, 2026-11-06.

The owner-uploaded original at `assets/art/temple/Demon Killer Stone Wall Tileset.png` (1536×1024 pixels, SHA-256 `204ccc88f97f9246de3096bf341bd3f7f8142179525cb1bce16822b191204def`) produced **106** individual transparent full-art sprites. They reside in `assets/art/dkarchitect/walls/` with a generated manifest/catalog describing crop rectangles, display dimensions, and 32px construction footprints.

**Important:** A long wall segment, curved stone face or column is not inherently compatible with a 32px four-way wall autotile set. All 106 original-pixel cutouts are **stand-alone construction objects**, not guaranteed to join. Only the five 32px `grid_wall_{clean,dirty,moss,cracked,broken}.png` stone materials have tested identical opposing-edge pixels; these alone render the grid brush and temple perimeter until a complete matching modular joint set is approved. Never put unverified parts into the automatic four-way joining system.

The previously generated 220 synthetic shape/finish tiles from `scripts/build-dk-topdown-walls.py` were rejected by the owner's visual review and removed from current use and the active art folder. The older historical approved `Dungeon Temple Wall Tile Atlas(1).png` remains in the repository as reference but is not shown in the active palette. The 32px wall masks are intentionally not confused with the independent original cutouts. Existing wall coordinate saves remain intact.

## Researched existing reusable art (not imported)

- **Screaming Brain Studios, Top Down Dungeon Pack:** 2,256 seamless tiles, 1,316 wall tiles and 940 floor tiles, with Tiled autotile metadata. **CC0** stated on the creator's OpenGameArt page. Strong top-down geometry candidate, but original assets are 64×64 with magenta backgrounds and a different visual treatment. Would require exact tile-size/palette normalization, transparency audit, and side-by-side visual approval. https://opengameart.org/content/top-down-dungeon-pack
- **Screaming Brain Studios, Tiny Top Down Pack:** 100 tiles at 32×32; seamless walls and floors, plus doors. **CC0**, commercial-use permitted per creator. Candidate for a compact fixed-size starter set, but match to existing Demon Killer art is unverified. https://opengameart.org/content/tiny-top-down-pack
- **stealthix, 32×32 Dungeon Tileset:** CC0 small dungeon set at correct tile size. Candidate for stone/floor and corner examination; connection completeness not verified. https://opengameart.org/content/32x32-dungeon-tileset
- **Kenney, Tiny Dungeon:** over 130 CC0 original pixel sprites with separate tiles and Tiled example. **16×16** and partial 3/4-view features, so scale and perspective compatibility need review before any use. https://kenney-assets.itch.io/tiny-dungeon
- **ThatOneRandomGameDev, 32X32 Dungeon Tileset:** CC0 walls, floors, gates, grates, doors, stairs, furnishings, traps; independently evaluate corner connectivity. https://opengameart.org/content/32x32-dungeon-tileset-0

**Third-party intake gate:** Confirm specific upstream asset, author, source URL, exact license, permitted redistribution/commercial use, asset perspective, palette, integer tile scaling, and actual wall-join compatibility. Save evidence of those checks in docs; do not blindly copy entire repositories, borrow UO art, or describe a commercial-use requirement as license-free by implication. The game can legally emulate broad design principles of classic UO but must not copy protected game graphics or trademarks.

## Tools and verification

- `scripts/split-dk-architect-walls.py`: deterministic extraction script, source SHA guard, 106 part count checks, and seam assertions for the five square material swatches.
- One necessary, one-time GitHub-hosted Pillow run separated the binary image into physical PNGs; its trigger/workflow was removed by that same job. No standing wall-extraction Action remains.
- `tests/test-center.cjs`: PNG/crop manifest expectations, staged object save validation, mouse wheel interactions, and existing movement/temple regression coverage.
