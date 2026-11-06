# Demon Killer: Ultima Online's spiritual successor

**Vision:** Build a genuine modern spiritual successor to the *freedom and persistent-world design* of Ultima Online, as an original Demon Killer game. The user's phrase for the ambition is **UO 2.0**. This is a direction and design record, not a claim of affiliation with, endorsement from, or ownership of Ultima Online.

## Principles

1. **The world persists:** a dedicated Linux-hosted world service continues NPC, monster, territory and world-clock changes even while players are disconnected. Browser-local files cannot pretend to be that service.
2. **The world belongs to its inhabitants:** meaningful crafting, property, housing, player commerce, social ties, exploration, risk and consequences. Player actions have durable effects instead of resetting on each login.
3. **Housing and building matter:** DK Architect should eventually approach the freedom of classic UO house customization with precise tile selection, working rotation, multi-story structures, draft/backup/commit state, and permission-aware building. Advanced Game Master features live alongside, not inside an unwieldy construction toolbar.
4. **Admins can develop a living world:** a RunUO-inspired extensible server with persistent entities, quests, spawners, special events, permissions, audit logs, and backup recovery.
5. **Compatibility before quantity:** all wall/floor/door art must have a known perspective, coherent scale and validated construction connections. A collection of independent decorative pieces is not a seamless structural tileset.
6. **Demon Killer remains its own game:** preserve the Forsaken Temple story, ghosts, cult investigation and approved pixel aesthetic. Study functional design principles, not original UO source/assets/protocol/UI files or trademarked presentation.
7. **Build iteratively:** prove persistent saving on the existing temple, then integrate server-controlled construction and NPC behavior before adding a sprawling world.

## Current work and status

The current browser client and DK Architect are playable development prototypes, **not** yet a persistent MMO. The new owner-supplied wall sheet was split into 106 independently placeable pieces; only five verified 32px stone materials currently support tile-to-tile seam-safe wall painting. Third-party art candidates and their fit checks are documented in [Architect wall recovery and reuse](architect-wall-recovery-and-reuse.md). A RunUO-inspired server has a planning document in [world server design](world-server-design.md).

This strategic note belongs in `docs/`, not the public README, per the owner's explicit documentation rule.
