# Demon Killer

Demon Killer is a Gothic fantasy RPG by DK Softworks, built with original top-down pixel art, Streaming Cells and an independent persistent-world server in development.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

## One DK Architect, real saves and the opening ritual

Press **F8** or **ARCHITECT** in the temple or outdoors to use the same Prison Architect-style construction menus. The browser preview stores local map drafts that can be exported as JSON. The first temple exit shows Lilith's prayer and the **approved** golden ghost-world or black living-world weeping-willow transformation.

The paper doll has Ultima Online-style commands, without destructive save buttons. **Main Menu → Options → Save Management** separates character deletion (world preserved), server-world reset (requires an actual connected server) and Start Fresh (browser-only on GitHub Pages).

## DK Server M41–M47: Seven connected gameplay slices

- **59 trainable skills**, 100.0 individual/700.0 overall caps, groups, training locks and existing-save migration.
- **Seven persistent monster species** with different strengths, patrols, NPC threats, loot and decay.
- **Active field skills**: tracking, hiding, anatomy, forensic evaluation, meditation, Spirit Speak and Animal Lore.
- **Magic**: mana, reagents, cardinal line of sight, Magic Arrow, Fireball, Heal, Protection and Night Sight.
- **Monster bounties**: real shop-issued quests; player kills counted and rewards paid from existing business funds.
- **Tameable wolves**: feed, follow, guard, stay, release, fight and leave persistent remains.
- **Grain milling**: harvest grain, grind it into grist, sack flour, and bake bread. Player or physically present NPC baker can run the work; wages, ingredients and serially tracked goods are real.

Use **P → Skills, Spellbook, Quests, Animals or Crafting** on a **connected DK Server** for these gameplay actions. The dedicated mill building, more kinds of magic, guilds, and the entire original Ultima Online feature set are **not** complete yet. The first milling station uses the **existing village bakery**, without changing the owner-approved village layout.

**Important:** GitHub Pages is a static **preview**. It does not host a persistent server, so it cannot run the independent NPC economy or save authoritative monster/pet states. The server needs to be running separately to simulate events while you are away. This release does not deploy a public server.

The six-shard GitHub Actions regression workflow remains **manual-only**, to conserve Actions minutes. New Node tests are included in the repository but are not automatically run on pushes.
