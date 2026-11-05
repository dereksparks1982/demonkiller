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
