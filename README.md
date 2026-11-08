# Demon Killer

Demon Killer is a Gothic fantasy RPG by DK Softworks, built with original top-down pixel art, Streaming Cells and an independent persistent-world server in development.

[Play the browser preview](https://dereksparks1982.github.io/demonkiller/)

## One DK Architect, real saves and the opening ritual

Press **F8** or **ARCHITECT** in the temple or outdoors to use the same Prison Architect-style construction menus. The browser preview stores local map drafts that can be exported as JSON. The first temple exit shows Lilith's prayer and the **approved** golden ghost-world or black living-world weeping-willow transformation.

The paper doll has Ultima Online-style commands, without destructive save buttons. **Main Menu → Options → Save Management** separates character deletion (world preserved), server-world reset (requires an actual connected server) and Start Fresh (browser-only on GitHub Pages).

## DK Server M41–M55: Fifteen connected gameplay slices

- **59 trainable skills**, 100.0 individual/700.0 overall caps, groups, training locks and existing-save migration.
- **Seven persistent monster species** with different strengths, patrols, NPC threats, loot and decay.
- **Active field skills**: tracking, hiding, anatomy, forensic evaluation, meditation, Spirit Speak and Animal Lore.
- **Magic**: mana, reagents, cardinal line of sight, Magic Arrow, Fireball, Heal, Protection and Night Sight.
- **Monster bounties**: real shop-issued quests; player kills counted and rewards paid from existing business funds.
- **Tameable wolves**: feed, follow, guard, stay, release, fight and leave persistent remains.
- **Grain milling**: harvest grain, grind it into grist, sack flour, and bake bread. Player or physically present NPC baker can run the work; wages, ingredients and serially tracked goods are real.

- **Real player-owned shops**: acquire an existing business from its NPC proprietor, manage budgets, prices, inventory and assistant staffing, and serve actual NPC shoppers while at its counter.
- **Hands-on workshop production**: manufacture bread, tools and meals yourself from actual shop stock. Operators can carry on when you are hunting.
- **Breakdowns and maintenance**: production wears machinery, monster raids can damage it, and work stops until you use a tool or pay an actual worker for repairs.
- **Owner-served NPC customers**: NPCs really wait to be served when you're at your own counter. They leave if ignored or pay your assistant when you leave.
- **Stealth and camping**: Hide, sneak limited cardinal steps with real monster detection, and consume wood to set up a restorative outdoor camp.
- **Snooping and stealing**: inspect actual NPC backpacks, try to take known item serials, and face witness reports and guard fines.
- **Forged weapons and armor**: make swords, maces, spears, bows, arrows, shields, and armor from physical supplies. Equipping uses real serials; weapons wear down, armor reduces damage, and bows consume ammunition.
- **Working armorer service**: repair equipment yourself from ore/wood, hire the village smith to work while you're away, return to collect the exact same gear, or salvage unwanted gear.

Use **P → Skills, Spellbook, Quests, Animals, Crafting, BUSINESS, THIEVING or ARMORY** on a **connected DK Server** for these gameplay actions. The dedicated mill building, more kinds of magic, guilds, and the entire original Ultima Online feature set are **not** complete yet. The first milling station uses the **existing village bakery**, without changing the owner-approved village layout.

**Important:** GitHub Pages is a static **preview**. It does not host a persistent server, so it cannot run the independent NPC economy or save authoritative monster/pet states. The server needs to be running separately to simulate events while you are away. This release does not deploy a public server.

The six-shard GitHub Actions regression workflow remains **manual-only**, to conserve Actions minutes. New Node tests are included in the repository but are not automatically run on pushes.
