# DK Architect masonry recovery and replacement

The old owner-created wall sets were unable to produce reliably joining corners and straights. On 2026-11-06, they were **retired from the playable branch** and replaced with 0x72's original matching asset packs.

The source sheet `assets/art/temple/Demon Killer Stone Wall Tileset.png`, old sliced pieces in `assets/art/dkarchitect/walls/`, five supposed seamless wall swatches, original wall master `assets/art/temple/walls/Dungeon Temple Wall Tile Atlas(1).png`, and their one-time extraction scripts were removed from active `main`. Their historical commits remain in Git and can be consulted if needed. Do not put them back into the active Architect palette without explicit approval.

The current auto-wall builder uses **0x72 Original Dungeon Tileset v5** by default, and **0x72 Dungeon Tileset II** as an independent style. Each wall cell saves its pack ID. The original first-pack walls use the same artist's base/front/outer corner layers, and Dungeon II uses its own top, side and front wall art. Per-piece manual selections remain available for precise placement. Pixel_Poem wall tiles are manually placeable and are not declared compatible with 0x72's automatic joins.

For the complete imported asset provenance, see `third-party-dungeon-art.md`. The public README intentionally contains no implementation diary.
