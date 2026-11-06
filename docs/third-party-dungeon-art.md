# Imported dungeon art: creator credits and use

## 0x72, original Dungeon Tileset v5

Source: https://0x72.itch.io/16x16-dungeon-tileset

The user uploaded two identical v5 archives. SHA-256: `4749333cf50b35c025d889bc9ae63e61b101c5f1d226ce742bdc6106a01cf984`. The creator's official archive matched. The 243 original transparent item sprites were integrated into `assets/art/dkarchitect/imported/ox72-first-game-atlas.png`; `first-manifest.json` describes their exact source frames, filenames and footprints. The author offers the artwork as CC0. Credit: **0x72**.

## 0x72, Dungeon Tileset II v1.7

Source: https://0x72.itch.io/dungeontileset-ii

The creator's assets were imported as part of `assets/art/dkarchitect/imported/dk-imported-game-atlas.png`, indexed by `manifest.json` and `catalog.js`. The creator publishes the set under CC0. Credit: **0x72**.

## Pixel_Poem, 2D Pixel Dungeon Asset Pack v2.0 and Enemy Animations Set

Source: https://pixel-poem.itch.io/dungeon-assetpuck

These are **two distinct user-supplied packs** included in the combined game atlas. Their tiles, props, door components, environment items, NPCs and enemy animation sequences are available in DK Architect by their catalog IDs. The artist permits use and modification in commercial game projects and requests credit; the standalone source pack must not be re-sold or republished. This repository includes in-game atlases rather than standalone source-package ZIPs. Credit: **Pixel_Poem**.

## In-game behavior

- DK Architect exposes wall sets, floors, doors/structures, furniture, equipment/items, original DK sprites, and NPC/enemy visuals.
- 0x72's Original and Dungeon II wall kits are independent matched automatic wall choices. Per-wall pack identity survives save/load.
- Pixel_Poem's wall art can be placed manually, but is not arbitrarily combined with 0x72 wall corners by the auto-wall brush.
- Creatures and animated props display their frames in the game. They are **visual art objects only** until a later behavior, collision, combat and NPC-system build.
- Library references and original filenames are tracked by manifests. Third-party creator rights and attribution should remain documented even for public-domain artwork.

The only GitHub Actions used for importing the binary artwork were one-time, self-removing import jobs. Do not add recurring generated-art workflows.
