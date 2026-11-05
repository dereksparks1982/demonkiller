# Demon Killer | Soul Colours, Death Shrouds, and Soul Crystals

**Recorded:** 2026-11-05  
**Status:** Owner-directed game design documentation only. This records the new soul-colour direction, without authorizing a gameplay build, balance system, sprite creation, asset replacement, or release.  
**Related canon:** [Forsaken Temple opening](forsaken-temple-opening-canon.md) · [DK Architect plan](architect-plan.md)  
**Scope:** Player, NPC souls, death-shroud appearance, soul-crystal variants, redemption and worsening of the soul.

## Core premise

In Demon Killer, **the colour of a soul and its death shroud has moral and narrative meaning**. Death exposes the condition of the soul. The soul's state is not necessarily permanent: the choices made afterward may **cleanse it** or **darken it further**. Resurrection offers another chance at life rather than automatically erasing past deeds.

The protagonist begins as a **black-shrouded soul**, stained by sins and selfishness. This is deliberate characterization and a meaningful starting point, not a neutral/default colour applied to every ghost.

The same metaphysical rules should eventually apply to other characters. In particular, wrongdoers may die and become **black souls**, wandering the world in search of a **soul crystal** and the possibility of returning to life for another chance. They are not automatically erased from the world when their living bodies die.

This is a **fictional rule of Demon Killer's world**. Do not present its colour judgments as a claim about real people, real deaths, or the user's personal spiritual condition.

## Established colour meanings

| Colour | Meaning established by the owner | Art or mechanical status |
| --- | --- | --- |
| **Black** | A soul heavily stained by wrongdoing, including selfishness and grave sins. The player starts here. People guilty of grave acts such as murder or sexual violence can also belong to this dark condition. Darkness has degrees; black does not imply that redemption is impossible. | An approved **black-shroud ghost** already exists in the art library; dynamic morality and NPC soul logic are not yet implemented. |
| **Brown** | A neighbouring shroud category **close to the threshold of black**. The owner's description places the protagonist just across the boundary into black rather than brown. | Category concept recorded; exact moral criteria, shade, and sprite are not approved. |
| **White** | A good or cleansed soul, the opposite direction from black. The protagonist may work toward cleansing their soul through choices. | Concept recorded; requirements, sprite and transitions are not yet decided. |
| **Other colours** | Different souls can have different colours. Colours beyond black, brown, and white can carry distinct meanings, but **their meanings are not assigned yet**. | To be designed and approved separately. |

**Important distinction:** A shroud's colour communicates a soul's moral condition. The player may move between moral conditions through meaningful conduct. Do not lock the player into permanent damnation because the opening begins with a black shroud, and do not assume one good act wipes out an entire history.

## Choices and the state of the soul

- The player begins with a **black death shroud** after the sacrifice.
- Subsequent choices must be able to **cleanse** the soul or **blacken** it further. This is a story and progression mechanic, not just a cosmetic palette swap.
- Shroud appearance should visibly communicate the current condition of a soul when it is represented in spirit form.
- The moral system must recognise **degrees** of darkness. Brown and black are adjacent conditions rather than arbitrary unrelated costumes.
- Other NPC souls should be governed by consistent world rules when that simulation is authorized.
- The precise actions that count, how much weight an act carries, the transition thresholds, and whether states can shift gradually or only at milestones **remain undecided**.
- Do **not** invent a numeric karma meter, a list of exact virtues/sins, rewards, punishments, or a fixed redemption ending without further owner approval.

## Soul crystals: requested future sprite sheet

The game will need a **consistent family of soul-crystal sprites in several colours**. These are **variants of the same underlying crystal design**, not unrelated objects. A crystal's colour means something in gameplay. The exact colour-to-function assignments are **not yet specified**, so no new effects or powers should be inferred.

**Future art requirements, pending separate authorization and visual approval:**

- Produce an **original pixel-art sprite sheet** containing multiple colour variants of the same crystal silhouette, aligned to the existing **32 × 32 tile** game art.
- Keep silhouette, dimensions, framing, material, and pixel-art treatment consistent so players can read colour as the meaningful difference.
- Maintain the approved crude/Gothic pixel aesthetic, transparent backgrounds and readable contrast on dark temple floors.
- Record each approved variant's colour and eventual meaning in an art manifest when those meanings are chosen.
- Preserve the existing **gold-glowing soul crystal** placed by Lilith in the Forsaken Temple opening. Its established optional resurrection interaction is not replaced merely because additional colours are planned.
- Do not silently recolour the existing opening crystal, swap it for black, assign an effect to a colour, or introduce unapproved sprite assets.

**Relationship still open:** Whether a crystal's colour must match the soul using it, affects resurrection, reflects the kind of soul stored within, or serves a different function has **not** been decided. Soul/shroud colours and crystal colours are related concepts, but their exact rules must be designed, not guessed.

## Death, wandering souls, and a second chance

The intended future world simulation includes a loop for NPCs as well as the player:

1. A living character dies; death need not permanently remove that character's presence from the simulation.
2. The character may persist as a **wandering soul**, with a shroud colour reflecting their condition. Black-shrouded wandering souls are specifically part of the requested world.
3. Such souls can seek a **soul crystal** as a possible route back to life, including souls that committed terrible wrongs and may be offered another chance.
4. Returning to life does not automatically cleanse the soul; the character's later conduct can matter.

The exact eligibility for wandering after death, the availability and ownership of crystals, autonomous NPC search behaviours, resurrection costs, time limits, and repeated deaths are **future mechanics, not approved implementations**.

## Connection to the existing temple opening

The Forsaken Temple's currently approved sequence still applies: the sacrifice, appearance of the black-shrouded ghost, the Devil's encounter, Lilith's prayer and placement of the **gold-glowing** crystal, and the choice to resurrect intentionally or remain a ghost. **Single-click examines; deliberate double-left-click resurrects when valid.**

The protagonist's black shroud is now explained **in the game design** as the initial state of a stained soul, not an arbitrary colour selection. The different branches of spirit and living perception remain intact. The existing courtyard/willow outcomes are **not changed** by this documentation.

The owner's outstanding visual corrections also remain unbuilt: keep the lying body at believable character scale; the Devil and Lilith must turn to face the ghost farther back in the aisle when addressing it; the cult leader faces the altar for the sacrifice. These corrections require separate gameplay authorization.

## Matters requiring later decisions

- The exact additional soul/shroud colours and their order, including the appearance of brown and white.
- Whether shroud changes appear immediately, gradually, or only after death or another event.
- What qualifies as cleansing or worsening the soul; how moral change is measured and communicated.
- Which crystal colours exist and **what each crystal colour means**.
- Whether coloured crystals are linked to the soul's current colour, independent of it, or both.
- How wandering NPC souls discover crystals, interact with them, and return to the world.
- What happens to a soul if it cannot find a crystal.
- Art sheet layout, colours, and any extra states or animations, only after owner review.

## Implementation boundary

**Documentation only.** No sprite sheet has been generated, no files under `assets/art/` have been changed, no game logic or saved data has been migrated, and no gameplay build has been authorized by this note. Preserve the approved room, altar, sprites, existing save keys, DK Architect tools, and choice-based opening. Record the owner's answers to the undecided questions before coding them.
