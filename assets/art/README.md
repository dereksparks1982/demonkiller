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
