# Demon Killer

**Demon Killer** is DK Softworks' original engine-free, top-down Gothic adventure with a local single-player persistent world, an Ultima Online-inspired control scheme, and the DK Architect construction tool. The playable Forsaken Temple, sacrifice, ghost, and resurrection story remain intact.

## Play on Linux: one integrated game

Requires Node.js 20+ and a desktop browser. From the project directory run:

```bash
./start-demon-killer.sh
```

The launcher starts **DK Server in the background** (if it is not already running) and opens the **regular Demon Killer main menu** at http://127.0.0.1:8766/. No password, login, separate dashboard, or second player page is required. Closing the browser leaves the process and world clock running. **Options → Persistent World → SHUT DOWN SERVER** saves pending changes and stops the process. Restart by running the launcher again.

If an older server is still running on port 8766, stop that old process with Ctrl+C first. The launcher refuses to replace or kill a running older server behind your back.

**Character saves and the basic temple gameplay actions are now server-owned:** creating/reopening the first of the existing server records, completing the opening ritual, cardinal-direction movement, operating the north door, and double-click resurrection are validated and persisted by DK Server. No old browser character saves are imported. The temple's approved layout and its assets have not been replaced.

**Still in development:** comprehensive server-owned Architect edit transactions, cult/NPC persistence, active background NPC behavior, territory simulation, true multiplayer, and full production-grade crash recovery. The persistent six-real-hour day/night clock runs even while Firefox is closed. The **GitHub Pages Options menu now always shows Persistent World** with Start Server, Stop Server, world-clock status and Refresh. On the public website, it reports **Not Connected** until a real hosted DK Server exists. It does not simulate an online server or secretly start a browser-only fake world. GitHub Pages itself cannot run a background Node.js world process.

The character picker displays **one life / one character slot**; no previously stored slot is overwritten by New Game. The public GitHub Pages build still uses isolated browser-preview saves until hosted server infrastructure is connected, and **is not** the persistent world.

## Playable public preview

[**▶ Open the browser preview**](https://dereksparks1982.github.io/demonkiller/)

See [server/README.md](server/README.md) for local API details and tests, and [CHANGELOG.md](CHANGELOG.md) for versioned build notes.
