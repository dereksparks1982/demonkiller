# Demon Killer World Server

This directory contains the Node.js 20+ authoritative world simulator for Demon Killer. It owns the single-player world save, terrain edits, NPC activity, persistence, and streaming data. No external npm dependencies are needed.

To run from a source checkout: `node server/dk-server.cjs`. The default listener is **127.0.0.1:8766**. The game served by that process is the supported connected client. **GitHub Pages is a static browser preview and does not host this server.** Do not expose the loopback API to the public internet; remote hosting requires authentication and additional security.

The process saves to `server/data/world.json`, with verified checkpoints in the private save directory. Start/Stop controls pause and resume simulation. Closing the browser does not stop an already-running process, but shutting the server down freezes simulation rather than inventing offline progress.

Editing terrain through DK Architect sends an explicit, revision-checked command to the server; completed strokes save automatically. Use **Logistics → Export Server Terrain** in the connected editor to export the sparse world terrain and heights as JSON. The read-only endpoints are `/api/v1/world/grid`, `/api/v1/world/terrain/sector?sx=0&sy=0`, and `/api/v1/world/terrain/export`. You may add `?cx=0&cy=0` to the export route for one Streaming Cell. **World-terrain editing is currently available only in materialized outdoor wilderness regions**, not the entire eventual map.

Run the repository's Node regression suite with `npm --prefix server test`. Detailed development notes, release investigations, architecture, limitations, and the full former README have moved to [docs/](../docs/), including the [development handoff](../docs/development-handoff.md) and [server README archive](../docs/history/server-README-through-M68.md).
