# DK Server M5 | Ultima Online-inspired Living World

**Project:** Demon Killer · DK Softworks
**Build:** v0.2.26 (2026-11-06)
**Status:** Implemented in engine-free JavaScript as a **local server and web preview**. This is not a deployed always-on internet service and is not full Ultima Online feature parity.

## Region model and physical scale

The world no longer assumes one universal map dimension. Region identifiers and dimensions:

| Area ID | Footprint | Purpose |
| --- | --- | --- |
| `dk.temple.sacrifice.001` | **16×16** | Existing sacrifice, ghost and resurrection cinematic, in-room Architect editing |
| `dk.courtyard.lilith.001` | **64×64** | Walled outdoor grounds, Lilith's tree, houses, market and road |
| `dk.village.001` | **128×128** | Large settlement, six houses, bank, shops, roads and outside gate |

The courtyard has a **16×16 exterior temple at (24,48)**, physically matching the 16×16 room inside. The north temple doorway is mapped to courtyard tile (32,47), and walking south into the exterior arch connects back to temple tile (8,1). The northern courtyard gate connects to the southern village gate. Each area keeps its own floors, walls, wall styles, and Architect atlas references. **The underlying wall renderer was changed to use each area's width and height**, not a hard-coded 16.

`world-regions.js` is the **single** deterministic geometry module for the Node server and browser, with a tiny `server/regions.cjs` CommonJS wrapper. Houses are dimensioned building footprints. Their future interior layouts have not yet been authored. The outdoor Canvas keeps a 20×20-tile viewport and follows the player through larger regions.

**Door semantics:** a single left click inspects, a double left click opens/closes, and walking into an **open** door immediately moves between areas. The persistent server is the authority for the canonical door state and player position. Cardinal directions only; no diagonal tile steps.

## Lilith's branching courtyard event

The first exit from the temple records `courtyard_visit_count` and `lilith_branch`. An unrecovered ghost sees Lilith in a green dress transform into a **golden weeping willow**; a character resurrected by deliberately double-clicking the crystal sees the **red-dress / sickly black willow** route. The branch is written server-side, and a small primitive Canvas transition stands in for frames still awaiting an approved extracted sprite sequence. No new image generation or unapproved detailed artwork was introduced.

The browser-only preview also allows walking through these regions, but that isolated preview does not run background NPC state.

## What the living simulation owns

The server stores a `world.living` structure containing a seeded pseudo-random generator, simulated minute counter, NPCs, businesses, territorial control, resource nodes, traveling camps, letters, and a bounded event cache.

**NPCs (12):** banker, baker, blacksmith, market seller, two guards, courtyard keeper, postal courier, wandering merchant, caravan escort, innkeeper and herbalist. Each has a persistent id, location, role, health, hunger, energy, coins, work/home target, scheduled status and alive/dead state. These are **generic starter NPC archetypes**, not new named canon story characters. Simple cardinal step-following toward targets is present; obstacle-aware pathfinding and complete dialogues are not.

**Businesses (6):** Village Bank, bakery, smithy, market, tavern and Courtyard Market. Shops open/close with day/night, simulate stock sales and income, pay expenses and restock through scheduled deliveries. Stock and coin balances persist while the player is offline.

**Territories:** the courtyard and village store `control`, monster `threat`, security and last raid. Threats change on the world clock and can make a settlement fall or recover without a player-triggered quest. Advanced monster combat and player-led town reclamation are future integrations.

**Travel:** the merchant/escort and a roaming camp move/arrive/depart over world time. The bank courier travels and deposits mail on a schedule; no instant letters delivered to a player's unknown location.

**Economy and bank:** the server grants one modest initial coin balance, tracks player inventory, foraging and commerce experience, exhaustible gathering patches (herbs/wood/ore) and gradual regeneration. Merchant transactions require physical proximity and available stock/gold. A bank box is only accessible by physically visiting the Village Bank. Letters remain there until collected. Deposits and withdrawals move actual gold between carried and bank balances.

## Time, autonomy and historical records

A full day/night cycle is **twelve real hours**: six hours daytime plus six hours nighttime. The simulation runs once per world minute of **elapsed active server time**, catches up in bounded batches if a timer is late, and uses a saved pseudo-random seed for repeatable results. The Node process runs the updates even if zero clients are connected.

On **Stop Server**, world clock and NPC work freeze. Closing a browser is different: a still-running process continues world time, NPC behavior and trade. Restart does not hallucinate world events for an interval when the server process was down.

The durable `world.json` remains the authoritative world state. Recent world events are indexed there, and an **append-only JSON Lines journal** stores player creation, moves, resurrection, world pause/resume, NPC movement, NPC needs, shop trades, resource regeneration, territory events and mail. Journaling is serialized with the world writer queue. The event log's append and snapshot are separate filesystem writes; a write failure can leave a missing journal entry, which is explicitly logged. Crash-safe exactly-once multi-file transactions would require a real database or write-ahead log.

## APIs, tests and developer boundaries

See `server/README.md` for the HTTP routes. Full client world snapshots are never trusted. Position, collision, door state, money, stock, and other gameplay changes are validated and persisted by the server.

The new Node regression contracts cover the three region footprints and portals, ghost versus living Lilith, stopping time, deterministic NPC events, bank post, gathering cooldown, buying/selling, coin conservation, and background activity without a connected browser. Browser visual verification is separate from these contracts.

**Not present:** server-hosted public website, secure web pairing, distributed or multiplayer access, live automatic Architect edits, a complete NPC pathfinder, structured conversations, player combat, crafting chains, player death consequences beyond the opening, full homes/interiors, entire world maps, births/aging beyond basic NPC age fields, or a robust DB-backed event ledger.

## Next builds, in order

1. Deploy **one** durable 24/7 Linux world process behind HTTPS with owner-only browser pairing. Do not expose the current unauthenticated loopback API.
2. Finish server-authoritative DK Architect room editing, publish/rollback, region resizing, and interior-room links.
3. Improve NPC multi-area pathfinding and behavioral schedules; add family and death records, traveling merchants' real cargo, economic demand and player employment.
4. Develop spiritual and living-world rules, quests, NPC dialogue, combat, loot, item pickup, crafting, territory liberation, monster raids and death consequences.
5. Expand banks, mail sorting and delivery routes as more regions are built.

The game remains engine-free, intentionally primitive in artwork, and uses original project imagery plus currently incorporated permissively licensed dungeon tiles. No Godot runtime.
