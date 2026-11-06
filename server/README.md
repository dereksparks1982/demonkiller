# DK Server M5 | Living World (v0.2.26)

**Node.js 20+**, CommonJS, no external npm dependencies and no additional dashboard. This is the engine-free single-player authority for Demon Killer, presently **restricted to loopback**. The public GitHub Pages game does not have a deployed persistent backend.

## Lifetime and saved data

The process is launched in local development by `start-demon-killer.sh` and serves the normal Demon Killer game menu, temple, courtyard and village. The **browser can close while the server runs**. **Start Server / Stop Server** in the game Options resume or pause the whole world clock, saving the state without terminating the process.

`server/data/world.json` stores the character, regions, NPCs, businesses, territory, camp, mail, resources, run/pause flag and clock. The writer queue uses fsync plus atomic rename under a single-process lock. `server/data/world-events.ndjson` is an append-only long-term event record; the snapshot also retains the most recent 512 events. An archive-write error is logged; the world snapshot remains the authoritative state. Manual process shutdown pauses the world. An unexpected host outage does **not** manufacture time or NPC actions while the host is not running. Legacy M3/M4 data receives non-destructive missing-region, runtime and gameplay-field migration.

**One character slot** (slot 1), with no overwrite via New Game. Existing save files are not automatically deleted.

## Endpoints

All routes have the `/api/v1` prefix. The server serves game assets via an allowlist; no `server/data` or executable server sources are publicly served.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | DK Server build `local-m5`, online state and world running flag |
| GET | `/world` | Temple legacy snapshot and world clock |
| GET | `/clock` | Six-hour day/night state and paused/running flag |
| GET | `/server/state` | Server world running/paused state |
| POST | `/server/start` | Resume world time, requires `X-DK-Control: start` |
| POST | `/server/stop` | Pause and durably save world, requires `X-DK-Control: stop` |
| POST | `/server/shutdown` | Existing explicit process shutdown, pauses first |
| GET | `/areas` | Region list with independent width and height |
| GET | `/areas/:id` | Full server-authoritative area geometry, doors and objects |
| GET | `/living` | Live NPCs, businesses, territory, camps and recent events |
| GET | `/living/events?after=N` | Cursor-based recent world events |
| GET | `/gameplay` | Character inventory/gold/skills, regional resources and merchants |
| POST | `/gameplay` | Strict gather, buy, sell, bank_deposit or bank_withdraw actions |
| GET | `/bank/box` | Letters only when physically present at the Village Bank |
| POST | `/bank/collect` | Collect one actually delivered bank-box letter |
| GET/POST | `/characters` | Read or create character, slot 1 only |
| GET | `/characters/1` | Load the authoritative record |
| POST | `/characters/1/actions` | Validated cardinal move, opening, resurrection or door toggle |
| GET | `/events` | Server-sent clock, state and living-world updates |

**Gameplay POST examples (body only)**:

- `{"action":"gather","node_id":"courtyard_herbs_west"}`
- `{"action":"buy","business_id":"courtyard_market","quantity":1}`
- `{"action":"sell","business_id":"courtyard_market","item_type":"herbs","quantity":1}`
- `{"action":"bank_deposit","amount":1}`
- `{"action":"bank_withdraw","amount":1}`

The server checks range, player form, stock, currency, inventory, cooldowns, shop hours and exact allowed fields; it never trusts a client-submitted world snapshot. The actual menu converts a double-click into the one validated `toggle_door` command.

## What runs with no browser

The Node timer advances stored world minutes and NPC routines while the server process remains running. Travel, business transactions, post delivery, resource renewal, territory threats and traveling camps are deterministic and persistent. A stopped server freezes them all. See [living-world design](../docs/uo-living-world-m5.md) for complete rules, performance limitations and next milestones.

## Safety and hosting boundary

Current `createDKServer()` **refuses public network interfaces** and filters Host, Origin and Fetch-Site. These local protections are not suitable internet-user authentication. Do not expose the local API publicly. An always-on host, durable mounted storage or database, HTTPS and a single-owner pairing/authorization mechanism are prerequisites for a hosted version.

Use `node --test tests/dk-uo-m5.cjs tests/outdoor-m5.cjs` in a development checkout to run the new regression contracts. No GitHub Actions testing infrastructure is required for the runtime itself.
