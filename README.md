# Demon Killer

**Demon Killer** is DK Softworks' original engine-free, top-down Gothic adventure with a local single-player persistent world, an Ultima Online-inspired control scheme, and the DK Architect construction tool. The playable Forsaken Temple, sacrifice, ghost, and resurrection story remain intact.

## Persistent world progress: DK Server M4 (v0.2.25)

The **public Demon Killer webpage** is published on GitHub Pages, but its **always-on world server is not deployed**. The website's Options → Persistent World panel reports **Not Connected** rather than inventing a server. The Start Server button cannot turn GitHub Pages into a backend.

The server code in this repository now supports **one authoritative character slot**, server-validated temple actions, durable world-state writes, and **Start / Stop world simulation** endpoints. Stop pauses the server-owned six-hour day / six-hour night clock and writes its state to disk. Start resumes from that exact game time without counting the paused interval. If DK Server stays running, closing the browser does not stop that clock. The integrated menu automatically sends Start when creating or continuing the server-owned character.

**This is not yet an autonomous NPC world:** NPC schedules, businesses, monster territory, and server-authoritative Architect edits still need implementation. A genuine always-on Linux host with persistent storage and owner-only HTTPS access must be supplied before the public website can connect to a real world. We deliberately have not exposed the current unauthenticated loopback-only prototype to the internet. Standard short-lived serverless functions are not suitable substitutes.

## Local development only

The repository includes a Linux-only detached launcher, `start-demon-killer.sh`, for developers to test the integrated local server without installing a game engine. That local development workflow is **not** a requirement for playing the eventual website. It runs DK Server at `127.0.0.1:8766`, uses one-character server-side saves, and can be paused/resumed through the game menu. The older process shutdown endpoint remains available to the launcher; the new normal Options Stop button **pauses the world without terminating its host process**.

## Playable public preview

[**▶ Open the browser preview**](https://dereksparks1982.github.io/demonkiller/)

See [server/README.md](server/README.md) for local API details and tests, and [CHANGELOG.md](CHANGELOG.md) for versioned build notes.
