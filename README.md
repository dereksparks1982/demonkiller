# Demon Killer

**Demon Killer** is DK Softworks' original engine-free Gothic RPG, with Ultima Online-inspired cardinal movement, DK Architect construction, and a planned fully persistent single-player world. Its intentionally simple pixel art and approved sacrificial-temple opening remain the visual foundation.

## Current milestone: v0.2.26 | DK Server M5, the Living World

The project now has **three connected regions with independent sizes**: the 16×16 Forsaken Temple, 64×64 outdoor courtyard, and 128×128 village. The temple exterior occupies **16×16 tiles** in the courtyard, exactly matching the actual interior footprint. Walk through the open north doorway to change rooms automatically, or walk back to return. **A single click inspects a door; a double-click opens or closes it.** The courtyard contains Lilith's golden weeping willow in the ghost path or her sickly black willow in the living path, with a short in-game transformation. No new image pack or game engine was added.

The outdoor world scrolls with the character and uses existing DK Architect wall sections. Villages are not forced to fit into the temple's 16×16 viewport. Doors of houses are placeholders until their interiors are authored; **no fake house interiors are claimed**.

### Persistent simulation, when DK Server is actually running

- **One character, one life:** server-validated character actions, position, ghost/living state, inventory, gold and skills.
- **12 NPCs:** server-owned positions, cardinal movement, work/rest schedules, hunger, energy and health. NPCs move while the browser is closed.
- **6 businesses:** daily opening/closing, stock, purchases, sales, expenses and deliveries.
- **Dynamic territories:** monster threats and settlement capture or recovery are simulated without waiting for the player.
- **Traveling camp:** arrives and departs on the simulated world clock; wandering trader and escort NPCs travel between areas.
- **Bank and mail:** couriers deliver letters to the player's bank box, never to a magically omniscient messenger; letters must be collected physically at the Village Bank.
- **Gathering and commerce:** replenishing herbs/wood/ore, player-owned inventory, proximity-checked buying/selling, deposited gold and two starter skill tracks.
- **World history:** an append-only `server/data/world-events.ndjson` records world events and player transactions. Recent events remain in the save for quick display.
- **Start/Stop:** the server clock runs through a six-real-hour day and six-real-hour night. Closing the **browser** does not stop a running host. Stop Server pauses time and saves state; later Start resumes without adding stopped time.

### Important deployment boundary

**The public GitHub Pages version is still a standalone browser preview, not an online DK Server.** It can show the temple, courtyard and village with browser-only movement, but **persistent NPC lives, economics, server inventory, and real mail require a connected live DK Server**. The webpage correctly says **Not Connected** instead of claiming those features are online.

The backend is a **loopback-only Node.js prototype**, not securely hosted yet. Deploying it publicly will require an actual always-on Linux host, durable storage, HTTPS, and owner-only pairing/access controls. GitHub Pages, temporary sandboxes and ordinary short-lived serverless functions cannot by themselves run this world continuously.

This build also does **not** include complex pathfinding, complete NPC conversations, births/family systems, all house interiors, or the full server-authoritative Architect edit pipeline. Those remain future milestones.

## Project resources

- [Playable static browser preview](https://dereksparks1982.github.io/demonkiller/)
- [DK Server runtime and API](server/README.md)
- [Living-world architecture and milestone details](docs/uo-living-world-m5.md)
- [Changelog](CHANGELOG.md)

The canonical code, original art, and release history live together in this GitHub repository. No Godot runtime or game-engine dependency is needed.
