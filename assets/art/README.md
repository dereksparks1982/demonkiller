# Demon Killer Art Library

This directory holds original game artwork for Demon Killer and DK Architect.

## Directory layout

- `temple/walls/`: straight walls, corners, junctions, end caps, and facing variants.
- `temple/floors/`: floor tile styles and floor variations.
- `temple/doors/`: door graphics and states.
- `temple/furniture/`: furnishings and movable objects.
- `temple/decorations/`: decorative details, candles, braziers, and statues.
- `temple/ritual/`: altar, resurrection crystal, runestones, and ritual objects.
- `characters/ghost/`: player ghost sprites.
- `characters/human/`: player human sprites.
- `characters/crystal-woman/`: red-haired woman in green dress.
- `characters/cult-leader/`: approved cult leader sheet with four cardinal views.
- `characters/devil/`: approved Devil sheet with four cardinal views.
- `shared/`: images reusable across areas.

## Approved soul crystal sprites (2026-11-05)

The exact owner-uploaded original master sheet is preserved as `crystals/Glowing and Dull Pixel Crystals.png`. It contains ten crystal colors in two rows, bright above and dim below. The repo now includes 19 separate transparent 32 × 32 PNG sprites extracted from that sheet, not new drawings: gold, red, orange, yellow, green, cyan, blue, purple, and pink each have `_bright` and `_dim` files. The bright silver crystal appears once as `crystal_silver_depleted.png`. No silver animation is used.

In the Forsaken Temple, the gold crystal stays bright/dim flickering at irregular intervals while unused. A successful double-left-click starts resurrection and immediately changes that particular crystal to permanent silver. The graphic is drawn into 24 × 24 pixels centered within its 32 × 32 interaction tile, with a smaller actual silhouette. Source extraction can be reproduced with `scripts/split-approved-crystals.py`; the original master is never altered. Additional soul-color meanings remain undecided; do not invent them.

## Artwork conventions

- Use the existing deliberately minimal, blocky DK Architect pixel-art style.
- Prefer transparent-background PNGs, on the established 32 × 32 tile grid where suitable.
- Include north, east, south, and west static views only where direction matters.
- Characters move and turn; no walking animation is required.
- Keep original asset names stable for later mapping into DK Architect.

The `.gitkeep` files reserve empty folders in GitHub until artwork is added. These are storage folders only; game logic is unchanged.

## Approved cult leader sheet

- `characters/cult-leader/cult_leader_spritesheet.png`: transparent 128 × 32 PNG with exactly four 32 × 32 static poses, from left to right: **south (front), west (left), east (right), north (back)**.
- Dark hooded robe, crimson ceremonial mantle, bone-white mask. No duplicate directions or animation frames.
- Asset-library addition only. The sprite is not yet connected to the opening cutscene or in-game renderer.

## Approved Devil sheet

- `characters/devil/devil_spritesheet.png`: transparent 128 × 32 PNG with four static 32 × 32 sprites, left to right: **south (front), west (left), east (right), north (back)**.
- Black suit, red shirt, black hair, no tie; intentionally crude 32 × 32 character art.
- Artwork only; the Devil has not been wired into the temple opening sequence yet.

## Approved player hero (purple villager, 2026-11-05)

- `characters/human/human_master_spritesheet.png` is the **unaltered, owner-approved original six-pose 1536 × 1024 PNG**: four standing cardinal views, lying alive, and lying dead with blood beneath the body. Keep this master as the sole source for future character edits.
- `characters/human/human_south.png`, `human_north.png`, `human_west.png`, and `human_east.png` are 32 × 32 transparent, nearest-neighbor extractions of the **same approved purple-tunic villager**, replacing the previous player sprite artwork while retaining stable runtime filenames.
- `characters/human/human_altar_alive.png` and `human_altar_dead.png` are 64 × 32 top-down horizontal extractions; the dead pose includes the blood pool. No side-view altar sprites or walking cycles.
- The original high-resolution master is preserved unchanged. No gameplay/cutscene logic is modified in this art-only commit. A new black-shroud ghost sheet is a separate pending asset and does **not** reuse the prior ghost artwork.

## Approved black-shroud player ghost (2026-11-05)

- `characters/ghost/ghost_spritesheet.png`: 128 × 32 transparent PNG, exactly four 32 × 32 views in **south, west, east, north** order. The four matching individual files use existing stable names `ghost_south.png`, `ghost_west.png`, `ghost_east.png`, `ghost_north.png`.
- Extracted and scaled from the **owner-approved black-shroud four-direction design**, with low-color pixel quantization for the 32 × 32 game grid. Slim black/charcoal figure with a pitch-black, featureless hood opening; no visible face and no animation frames.
- Replaces only the previous ghost artwork; does not change gameplay, scripts or scene geometry. The original approved high-resolution source remains outside this repository; the game-sized sheet is provided here.

## Approved sacrificial altar (steps-right default, 2026-11-05)

- Replaced `temple/ritual/altar_north.png`, `altar_east.png`, `altar_south.png`, and `altar_west.png` with clean four-orientation game-sized PNGs from the **approved newly generated stone altar sheet** (not the user's screenshot). Additional composite: `temple/ritual/altar_spritesheet.png` (256 × 256, 2 × 2 cells, north/east/south/west).
- **Default `north` / rotation 0** is deliberately the **horizontal steps-on-the-RIGHT version**, to match the already approved scene object at grid (6, 5) with rotation 0, 4 × 2 tiles. Rotated variants: east steps down (2 × 4 tiles), south steps left (4 × 2), west steps up (2 × 4).
- The unoccupied slab is **128 × 64**, leaving room for the separately layered approved **64 × 32 top-down lying hero**. Four brass/iron-colored rings may remain, although the character begins unconscious and unrestrained. No blood or bowl is embedded in the altar art; blood remains a separate body/effect asset.
- Source was re-rendered to a tiny reproducible fixed nine-color palette, transparent pixels and nearest-neighbor hard edges. The in-game Canvas art loader already points at the four replaced filenames. This commit changes art and the art guide only; no temple layout, gameplay, saves or scene code.

## Approved temple decorations master sheet (2026-11-05)

- `temple/decorations/temple_decorations_approved_spritesheet.png`: **original, unmodified 1024 × 1536 PNG generated and approved by the owner**. SHA-256: `b8f00ab38d725feaefd392d8a83d5f2a8f695221fe51ce9d3d2b8c508259c5b0`.
- Four columns of static north/east/south/west views per row: unlit and lit braziers, single candle, candle group, closed/open book, spider web, crawling beetle, coiled rope, bundled rope, loose chain, hanging chain, empty/part/full blood-catching bowls, and a generic horned demon statue. The statue's named deity has **not** been established in verified lore.
- This is the **original approved full-size concept sheet**, not a sliced transparent 32 × 32 runtime atlas. Before placing props in the game, separate background from artwork, extract each object/direction, scale to the deliberate low-resolution style as needed and preserve the approved original master. Artwork storage only: no gameplay, scene, editor placement or creature worship lore changes.
