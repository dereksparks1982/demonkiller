# DK Server: RunUO code review and independent design

**Review date:** 2026-11-06. **Source:** https://github.com/runuo/runuo (GPL-2.0). RunUO is the architectural research target, not a code or art donor. None of its GPL C# code is incorporated into DK Server.

## Direct source inspection

- `Server/World.cs`: maintains a registry of mobile and item entities by `Serial`; loads stable identities/types first, then calls each object's `Deserialize` to restore their data; calls `EventSink.InvokeWorldLoad` after restoration. On saves it pauses network state, waits for existing disk writes and delegates to a save strategy. DK analogue: stable entity IDs, a registry, a two-stage load once references exist, and serialized write transactions.
- `Server/Persistence/StandardSaveStrategy.cs`: writes mobile/item/guild records with type lists and location/length indexes. We should borrow the **separation of storage from simulation** and indexed entity records, not the binary format or scripts.
- `Server/Persistence/SaveStrategy.cs`: chooses a persistence strategy. DK analogue: keep durable storage behind a swappable interface; begin with a single local atomic JSON state, then evaluate SQLite as the world grows.
- `Server/Timer.cs`: central timer queues with priorities, suspended around world load/save. DK analogue: a server-owned scheduled-event queue and idempotent event keys with persisted deadlines. Browser timers cannot control world time.
- `Server/Item.cs`, `Server/Mobile.cs`: entity-specific serialization and durable properties. DK analogue: independent character, item, NPC and area schemas keyed by stable IDs.
- `Scripts/Accounting/Account.cs`: accounts are distinct from mobile characters. DK analogue: credentials/sessions separate from character state and world truth. One admin bootstrap key is **not** sufficient public-player authentication.

## Our implementation boundary

DK Server runs as a separate native Node service. It stores a newly created world and new server-owned character records; no Godot, no Ultima Online network protocol, no imported character saves, no GPL code or UO artwork. Its first snapshot is only the approved existing Forsaken Temple; the game client and its current localStorage behavior have **not** yet been replaced.

**First completed server milestone (development prototype):** immutable starting temple grid, UTC-based six-hour day/night clock, unique world identity and schema version, validated character creation, one-writer lock, crash-conscious atomic snapshot writes, token-protected local character endpoints, public read-only world clock and event stream. This is not yet a persistent NPC simulator, production multiplayer shard, or gameplay server.

## Save-authority invariants

1. Server creates world and character records. Client sends intentions, never arbitrary serialized snapshots.
2. Server validates and commits a change before acknowledging it. Duplicate creation cannot overwrite an occupied slot.
3. A corrupt or unknown-version world is never reset silently. No compatibility path from old browser saves.
4. Server state has stable IDs, area IDs, revisions and UTC clock anchors; future entity references will use two-pass hydration.
5. Room/story/altar/crystal rules remain unchanged until separately approved. The soul crystal appears only when the approved ritual places it, not at first world creation.
6. Only one writer owns the data directory. Production will require backups, transaction journaling and safe migrations for **future DK Server versions**.
7. Remote player access requires accounts/session security and TLS, never exposure of the local bootstrap admin key.

## Implementation next

Connect a properly authenticated game client and New Game / Continue to the server. Then migrate gameplay **behavior**, not old save data: server-authoritative movement/collision, per-character ghost/living path and one-time crystal transaction, object persistence, DK Architect privileges and world timers. Do not begin a courtyard or alter the approved opening during this work.

## Milestone 2: browser sign-in without exposing the admin token

A local /player page now configures one owner password (salted scrypt digest stored separately from the world), uses HttpOnly SameSite=Strict session cookies, and reads/creates authenticated character records through DK Server. No browser localStorage character migration or client-side save snapshots are accepted. This is a character-record interface, **not a playable temple migration**: the original public browser game is left unchanged pending authoritative gameplay integration. Tests cover session isolation, parallel setup, guessing lockout, restart sign-in and server-only record storage.

## Milestone 3: single-player integration (current)

The short-lived M2 owner-password and standalone /player prototype described above has been retired. DK Server now hosts Demon Killer's **existing main menu and temple** directly, accepts local single-player character creation and validated gameplay actions without passwords, and exposes graceful shutdown under **Options → Persistent World**. The Linux launcher starts the world process detached, so closing Firefox does not stop the clock. All old browser save imports remain disabled for the local persistent mode. Architect transactions, cult and citizen state, durable NPC simulation and multiplayer are separate future milestones. RunUO remained an architecture reference; no GPL source has been incorporated.

## Milestone 10 implementation follow-up (v0.2.31)

We have independently adopted RunUO's key *architectural ideas* from `World.cs`, `Item.cs`, `Sector.cs`, `Map.cs` and `Timer.cs`, without copying its GPL implementation. The new `server/entity-registry-m10.cjs` issues stable entity serials and validates container/ownership transfers. The new `server/sectors-m10.cjs` uses fixed 16×16 spatial buckets for each variable-size region, with read-only current-area proximity queries. Existing M9 saves migrate into the registry, preserving the single character and prior history. Full RunUO parity, sector sleep/activation, nested containers and a persistent hosted server are **not** claimed. Earlier milestone descriptions in this review remain historical notes and may no longer describe the current implementation.

## Milestone 11: Saved timer jobs (v0.2.32)

Source review of RunUO `Server/Timer.cs` confirmed priorities and server-controlled callback dispatch. DK Server M11 independently uses a small validated world-minute job queue (courier deliveries, camp rotation, merchant restock, guard wages) and retains all due times inside the world snapshot. No RunUO C# code is copied. Deliberate Stop freezes jobs; Start resumes with no offline catch-up. This provides the foundation for future timed NPC appointments, property tasks, crafting production and sector simulation.

## Milestone 12: Mobile possessions and corpse lifetime (v0.2.33)

RunUO's `Server/Mobile.cs`, `Server/Items/Container.cs` and `Scripts/Items/Misc/Corpses/Corpse.cs` illustrated mobile inventories, contained loot, ownership and decay timers. DK Server implements these concepts independently through `server/mobile-assets-m12.cjs`, M10's item serials and sectors, and M11's saved job scheduler. An NPC's backpack and wealth now persist into a physical corpse; looting transfers belongings without duplicating wealth, and unclaimed remains decay only on simulated world time. We have not implemented RunUO's full looting-rights, criminality, notoriety, carving, player corpse or resurrection systems.

## Milestone 13: SaveStrategy and verified world checkpoints (v0.2.35)

RunUO's `Server/Persistence/SaveStrategy.cs`, `StandardSaveStrategy.cs` and `SaveMetrics.cs` demonstrate a separate world persistence pipeline, independent from game objects. Demon Killer now independently implements a validated save strategy that keeps its existing atomic primary write and adds rotating SHA-256-verified world checkpoints and save health metrics. Corrupted primary saves remain blocked from startup until an owner makes an explicit recovery decision. Journal reconciliation, incremental sectors and hosted filesystem durability are follow-on milestones.

## Milestone 14: Use-based profession skills (v0.2.36)

Reviewed `Server/Skills.cs` and `Scripts/Misc/SkillCheck.cs` from RunUO. DK Server independently borrows the high-level concepts of tenths-point training, skill caps, Up/Down/Locked training, atrophy under a total cap, and anti-repetitive skill gain. Ten initial professions receive practice from actual authoritative game activity. The browser can only change training locks, not award XP, and the existing single life is preserved. The broader RunUO skill list and spell success/combat item gating remain unimplemented until corresponding game activities exist.

## Milestone 15: Guarded regions and witnessed crimes (v0.2.37)

RunUO `Server/Region.cs`, `Scripts/Regions/GuardedRegion.cs` and `Scripts/Misc/Notoriety.cs` organize lawful areas, criminal actions, guard candidates and notoriety. DK Server independently implements a first guarded settler-controlled village, physical NPC witnesses for theft from an NPC corpse, a saved criminal case/fine/warrant record, guard pursuit using cardinal geometry, and restitution using real bank funds. The courtyard is not subject to village justice, and guards do not magically discover unwitnessed actions. This is not RunUO's entire criminal/guard system, nor a multiplayer implementation.

## Milestone 16: Overlapping districts and region events (v0.2.38)

RunUO `Server/Region.cs` demonstrates overlapping priority regions, location-based entry/exit hooks and local rules. `Scripts/Regions/GuardedRegion.cs` supplies guarded-region architecture. M16 independently models these concepts for Demon Killer's existing three variable-sized areas, using canonical district IDs and world-saved visit history. These policies integrate with the M15 crime system without copying any RunUO GPL implementation; actual UO region event scripting and housing deeds remain unimplemented.

## Milestone 17: House signs, deeds and ownership (v0.2.39)

RunUO `Scripts/Multis/BaseHouse.cs`, `Scripts/Multis/HouseSign.cs` and `Scripts/Regions/HouseRegion.cs` show how property ownership, signed public/private status and secure containers interact with region rules. Our `server/housing-m17.cjs` independently applies these architectural ideas to the actual ten existing house exteriors and the M16 housing districts. Purchases use real gold balances, M10 serials persist through house storage, and NPC deaths preserve titles as estates. We have not copied GPL C# and have not introduced UO-style freeform house placement or full interior lock-down, access lists and housing decay.

## Milestone 18: Vendor-owned stock (v0.2.40)

RunUO `Scripts/Mobiles/Vendors/BaseVendor.cs` and `Scripts/Mobiles/Vendors/SBInfo/SBInfo.cs` distinguish merchandise lists and buy/sell logic from personal NPC possessions. Demon Killer now independently gives each merchandise shop its own persistent stock container, with M10 item IDs, typed secondary goods, actual player trades and bounded supplier restocking. The bank remains a financial service. Individual autonomous customer transfers and supplier cargo are not yet simulated.

## Milestone 19: Real mobile/vendor transactions (v0.2.41)

RunUO's mobile inventory and BaseVendor selling systems inspired the transition from abstract shop-sale counters to actual transactions with a living NPC buyer. Eligible DK Server customers navigate cardinally to a real open storefront, pay personal coins and receive a persistent item in their backpack. Hunger uses owned food rather than silently consuming money. All work is independently implemented in JavaScript; no GPL C# copied. Wider NPC customer roles and physical supply networks remain future slices.

## Milestone 20: Server-side NPC workshop recipes (v0.2.42)

RunUO `Scripts/Engines/Craft/DefBlacksmithy.cs` and `DefCooking.cs` illustrate recipe requirements and crafting output. DK Server independently applies fixed, server-owned recipes at existing businesses that consume actual M18 inputs, create serial-bearing output and pay real wages to M12 NPC staff through an M11 scheduled job. No GPL code copied. Broader professions, yield variability, physical crop growth and NPC resource shipments remain future milestones.
