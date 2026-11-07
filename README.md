# Demon Killer

**Demon Killer** is DK Softworks' original engine-free Gothic RPG, with Ultima Online-inspired cardinal movement, DK Architect construction, and a planned fully persistent single-player world. Its intentionally simple pixel art and approved sacrificial-temple opening remain the visual foundation.

## Current milestone: v0.2.36 | DK Server M14, Skills and Professions

The project now has **three connected regions with independent sizes**: the 16×16 Forsaken Temple, 64×64 outdoor courtyard, and 128×128 village. The temple exterior occupies **16×16 tiles** in the courtyard, exactly matching the actual interior footprint. Walk through the open north doorway to change rooms automatically, or walk back to return. **A single click inspects a door; a double-click opens or closes it.** The courtyard contains Lilith's golden weeping willow in the ghost path or her sickly black willow in the living path, with a short in-game transformation. No new image pack or game engine was added.

The outdoor world scrolls with the character and uses existing DK Architect wall sections. Villages are not forced to fit into the temple's 16×16 viewport. Doors of houses are placeholders until their interiors are authored; **no fake house interiors are claimed**.

### M14: Learn by doing

- **Ten professions:** Herbalism, Lumberjacking, Mining, Trading, Blacksmithing, Cooking, Healing, Wrestling, Tactics and Survival each have their own server-owned skill value and use counter.
- **Ultima Online-style limits:** Skills use tenths of a point, with a 100.0 individual cap and a 700.0 combined cap. Each skill may be set to Up, Down or Locked. When at the combined cap, an Up skill may grow by lowering a skill deliberately marked Down.
- **Real practice:** Gathering, smithy work, cooking, bandaging, eating, resting, trading, fulfilling contracts and fighting imps train the corresponding skill when their original server-validated action succeeds. Skill levels cannot be specified in the action request.
- **Anti-grinding rules:** Gains slow as proficiency increases, require advancing world minutes and stop repeated use of the exact same resource or target beyond a small allowance. Changing the selected skill's training lock does not grant points.
- **Non-destructive migration:** Existing M13 saves retain their gold, world objects, NPCs and legacy experience. The new skillbook initializes from current experience and adds finer profession tracking without resetting the character.
- **In-game training controls:** A collapsible skill panel displays individual values and training directions. Training locks use the existing authoritative gameplay/save pipeline. The static website cannot fake a connected skill server.
- **Foundation, not every UO skill yet:** Spells, armor, weapon classes, tracking, stealth, animal taming and many other RunUO skill handlers still need their actual gameplay systems.

### M13: Preserve the world even if a save goes wrong

- **Managed save strategy:** All authoritative world writes still use a single serialized, fsynced, atomic `world.json`, but now pass through a dedicated persistence module.
- **Five verified checkpoints:** The server periodically captures SHA-256-verified snapshots containing the full world, identities, possessions, NPC history, scheduler and current character. Automatic checkpoints follow meaningful world revisions; a new one is also created at startup and clean shutdown.
- **Corruption detection:** Snapshot files have independent SHA-256 sidecars and are validated against the actual world schema. The oldest verified checkpoints are rotated out after five; invalid backups are reported, not silently adopted.
- **No involuntary rollback:** A damaged primary world still refuses startup. The service reports recoverable checkpoints but does not select an older history or reset the player's only life without an explicit recovery decision.
- **Options menu:** The connected game shows the count of verified world backups and offers **Save World Checkpoint**. The public GitHub Pages preview reports that no server is connected rather than claiming that backups exist.
- **Future scalability:** Event-log reconciliation, incremental sector snapshots, cold storage and hosted volumes are separate follow-up milestones. This build does not establish online server hosting.

### M12: An NPC's possessions outlive them

**v0.2.34 integration fix:** Restored the server startup migration and live corpse APIs that were missing from the M12 server entry point despite being present in the M12 gameplay modules. A connected DK Server now seeds saved NPC backpacks on older worlds, exposes corpse data to the outdoor scene and allows the actual gameplay endpoint to save corpse recovery.

- **Persistent NPC backpacks:** Every living resident has their own server-owned item container, separate from the player and from business stock. Starting belongings have distinct immutable item serials.
- **Deaths have physical consequences:** When a resident dies from starvation or monster attacks, DK Server creates a persistent corpse on the exact tile. The resident's money moves into the body, and their existing belongings retain their item identities.
- **Recover and remember:** A living player standing beside the corpse can recover its goods and coins once. The transaction happens on the server, updates their inventory and gold, and is written into permanent world history. Remote looting, ghosts and client-supplied rewards are rejected.
- **Decay on world time:** A corpse remains for 720 running world minutes, then its remaining contents decay. Cleanup is scheduled by the M11 saved job system; a deliberate server stop freezes the decay.
- **World views:** Corpses are indexed into M10 spatial sectors and drawn with a deliberately crude original pixel marker; the outdoor area adds an interaction button and double-click inspection.
- **Still single-player:** This is the foundation for later NPC estates, heirs, property inheritance, murders and investigations. Player permanent death is not added or decided here.

### M11: Scheduled world events independent of the browser

- **World-owned timer queue:** Four persistent server jobs have stable identifiers, due world-minute timestamps, repeat intervals, priority, execution counts and idempotent processing. Jobs are stored in the authoritative world save, not browser timers or unsaved callbacks.
- **Courier mail:** A delivery job checks the courier's real position by the Village Bank and delivers pending letters to the player's bank box without teleporting to the character. The letter is removed from the postal queue exactly once.
- **Merchant supplies and traveling camps:** Periodic restocks and camp arrival/departure now run from the saved scheduler rather than scattered modulo checks. Existing timing and event-history behavior is maintained.
- **Guard wages:** Living village guards now receive wages paid from actual Village Bank business funds every 360 world minutes. The bank's expenses increase accordingly; no coins appear from nowhere.
- **Stop means frozen:** Pausing DK Server freezes job due dates alongside the rest of the world. Reopening a stopped world does not replay the real-world downtime. Restarted jobs continue from their saved due minute.
- **Inspection:** The outdoor sidebar shows upcoming world timers when connected. `GET /api/v1/schedule` provides a read-only schedule. No browser can inject arbitrary jobs or scripts.

### M10: World identity, real containers and efficient sectors

- **Stable item serials:** Persistent world objects now have unique, server-assigned `ent_…` identifiers. A whole item stack preserves its serial when transferred between the pack, bank vault, equipped gear, ground, and a village chest. Splitting a stack creates a new serial for the separated piece. NPCs, monsters and building fixtures are also registered by stable identities.
- **Container ownership:** A persistent chest beside the Village Bank holds up to 64 items. Item transfers are atomic and enforce the player's real location, bank hours, equipment slots and capacity. Ground items still decay on world time and are collectible once.
- **Safe migration:** Existing M9 saves are upgraded without discarding characters, towns, NPCs, gold, existing goods or event history. The old item-count fields remain compatible with gathering, crafting and trading while the entity registry tracks identity. Registry records are cross-checked against those counts before every gameplay save.
- **Large-region spatial index:** The 16×16 temple is one sector; the 64×64 courtyard uses 16 sectors; the 128×128 village uses 64. The server indexes nearby mobile, monster, fixture and ground entities without treating all rooms as the same size or revealing distant world state.
- **Outdoor controls:** A basic village chest marker, Store/Take buttons and nearby-sector readout use the existing intentionally simple pixel renderer. The Village Bank now correctly returns its stored items through the game API.
- **What this is not:** Sectors currently provide efficient proximity lookup, not UO's complete activation/sleep system. Individual named unique weapons, NPC ownership inheritance and complex nested containers remain future features.

### M9: Goods have a place in the world

- **Bank vault:** The village bank now stores real inventory items, separately from banked gold and letters. Put goods in and take them out only while standing near an open bank. The saved bank has a 500-item total capacity.
- **Persistent ground goods:** Drop an actual quantity from the character's pack onto a traversable outdoor tile. That item becomes an independently saved world object until collected or decayed.
- **Pickups and decay:** Move beside a dropped pile to collect it once. Drops expire after 360 running world minutes and are recorded in the world event history.
- **Strict inventory accounting:** Deposits, withdrawals, drops and pickups all transfer actual server-owned quantities. The client cannot create free supplies, store things remotely or exceed pack capacity.
- **Outdoor controls:** Select a commodity and quantity, drop or pick up goods, and store or withdraw items inside the existing bank box. Simple square ground markers match the intentionally primitive approved pixel style.
- **No imaginary services:** The website remains an unconnected static preview. These are DK Server features, not claims that GitHub Pages runs a persistent world.

### M8: Monsters are actual inhabitants, not just a territory label

- **Occupied regions:** When monsters overrun an area, DK Server creates persistent imp entities with saved positions and health.
- **Creature AI:** Imps pursue nearby characters or guards, navigating around real walls and scenery in cardinal directions. Guards can fight back, and NPCs may be wounded or killed as the world continues.
- **Physical combat:** Attack only a living monster within one tile. Damage comes from the server, with equipped tools doing more damage; the player gains combat skill. Server-time cooldowns stop attack spam.
- **Consequences:** Imp attacks can injure the character and cause recoverable incapacitation. No permanent deletion of the player's one life has been introduced.
- **Persistent ground loot:** Defeated imps leave actual saved drops. Stand beside a drop and collect gold and goods; the server removes it, so the same loot cannot be collected twice.
- **Liberation:** Destroying the last occupying imp can restore control to settlers, affect shop operation, and create a dated territory event.
- **Outdoor interaction:** Basic red pixel imps and loot markers render with existing primitive code, with Attack and Loot buttons and double-click interactions. No new artwork was generated.

### M7: Use what you gather

- **Ingredient-based crafting:** Combine physically gathered or purchased goods into torches, rations, bandages and tools. Toolmaking requires visiting the village smithy.
- **Equipped gear:** Tools occupy the hand slot and provide a foraging skill benefit. Torches occupy the light slot and burn out after 90 world minutes.
- **Food and health:** Bread, produce, meals and crafted rations restore hunger. Bandages restore health and consume a real item.
- **Living character needs:** Hunger and energy change during actual server world time, including while Firefox is closed. Severe starvation can cause incapacitation; Rest allows recovery without silently deleting the player's single life.
- **World-backed advancement:** Crafting skill, equipment, needs and item counts are persisted and validated on the server. No recipes or rewards are calculated by the browser.
- **Usable interface:** Outdoor controls let you craft, eat, equip or unequip basic tools and torches, and rest. The static webpage preview does not pretend it has a connected server.

### M6: Meet people and earn your place in the world

- **NPC conversations:** Talk to living residents when within two cardinal tiles. The server checks the NPC's current location, schedule and whether they're alive.
- **Persistent acquaintances:** Meeting each NPC adds a permanent contact record. A cooldown prevents repeatedly clicking one person to farm standing.
- **Faction reputation:** Townsfolk, courtyard residents and travelers have separate saved reputation. Helping people changes how you're known.
- **Merchant commissions:** Accept a real delivery request from an open shopkeeper nearby, collect the requested commodities, and return before its deadline. The server takes goods from inventory, pays from that business's own coins, replenishes its stock, and awards commerce experience and faction reputation.
- **Contracts continue with world time:** Commissions can expire while you are away and time is running; stopping the world freezes the deadline.
- **Pathfinding:** Resident travel now finds routes around walls and structures using the existing Architect geometry, with no diagonal or through-wall movement and physical village/courtyard portal connections.
- **Playable controls:** The outdoor sidebar adds Talk, Accept Commission and Deliver Goods controls; double-clicking an NPC also talks to them while the actual DK Server is connected.

**This is foundational simulation, not a claim of full Ultima Online parity.** NPC dialogue is currently short and role-based, commissioning is deliberately limited to one active delivery, and contracts do not yet include procedurally authored stories or complex diplomacy.

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
