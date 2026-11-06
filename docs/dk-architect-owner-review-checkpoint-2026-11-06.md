# DK Architect owner review checkpoint | 2026-11-06

**Status:** Documentation-only preservation checkpoint. **No UI/game build authorized** by this discussion. Current playable branch: `main`, v0.2.21, head at review `f64aa6428c35aba2bba2d2a46c7593c37c090073`. Do not treat automated tests as visual acceptance.

## Owner screenshots / observed issues

The owner supplied four screenshots of the in-game UO-style Architect:
- Six-button gold bottom command bar: ornamental outer gold border is oversized and visually disconnected from the main builder; remove that decorative surround and make bottom command buttons similar in overall size to the top category buttons. Current top-row buttons have satisfactory sizing.
- Left icon cluster: center its tools properly. Remove the DK banner partly hidden beneath the controls.
- Right vertical icon cluster: top and bottom icon borders appear clipped/incomplete; fix alignment, container sizing and clipping.
- Several current controls do not work as expected. Audit *every visible Architect option*, not just the visually obvious buttons, and ensure each action has a real, testable outcome or is explicitly disabled with explanation.
- Pressing **Escape** in Architect must clear selection/active item so a previous object is no longer selected for editing/placement; exact hierarchy of Esc actions to be proposed and owner-approved.
- Transform tools such as **Rotate** should support **tool-first mode**: click Rotate first, then click a placed wall, NPC or decorative object to apply the action immediately. Do not require selecting the object first.
- Tool state should be clear, cursor/preview should reflect its active tool, and clicks on objects should not silently perform a stale prior action.
- Current wall assets are considered a *usable starting point* despite style confusion. Preserve their pack identities and do not replace art again without explicit approval.
- The **first Forsaken Temple room and opening scene must be polished and decorated properly before expanding the map**. The temple is the quality gate: joining walls, floors, props, altar, collision, dialogue and visual tone must all feel right.
- The owner wants UO-quality systems, not UO's exact graphic fidelity. Aim for a true, original *Ultima Online* spiritual successor: extensible GM/admin tools, accessible housing/building, and a deep earn-by-doing skill system.
- Craft/skill ambitions: mining increases by mining, taming by taming increasingly difficult creatures, poisoning by progressively stronger mixtures, training is slow and meaningful, and the player may ultimately become a jack of all trades through time and perseverance. Include social systems supporting friendship, relationships, weddings and exchangeable rings. Include strange/offbeat skills and plant growing; research exact Ultima Online precedents without assuming all have already been approved as a specific final implementation.
- Store implementation/research notes under `docs/`; **README is only the game description, features and link to playable web version**.
- **Do not build yet.** Research Ultima Online house design/GM workflow, Pandora's Box, relevant open-source projects, and prepare a phased implementation proposal for owner review.

## Constraints and non-goals for this checkpoint

No changes to HTML, CSS, JS, sprites, saves, quests, gameplay, versions, `README.md`, tags, asset folders or built/deployed executable. Preserve the current owner-approved story gates and editor geometry pending explicit visual sign-off. Avoid unnecessary GitHub Actions; a documentation-only change does not warrant a test/build workflow.

## Research to complete

(1) Ultima Online house customization, rotation and GM editing behavior; (2) Pandora's Box editor actions, categories and shortcuts; (3) maintained or archived repos and licensing; (4) UO classic skills, mastery progression, plants, relationships and rare professions; (5) action-by-action current DK Architect functionality matrix; (6) phased temple-first repair proposal with verification and acceptance criteria.

This document preserves the owner's instructions in case the conversation is interrupted. It is **not** permission to implement them.
