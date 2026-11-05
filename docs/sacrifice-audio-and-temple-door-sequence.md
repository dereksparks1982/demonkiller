# Forsaken Temple | Sacrifice Music, Door Choreography, and Disappearance

**Recorded:** 2026-11-05  
**Authority:** Owner's latest scene direction.  
**Status:** Design documentation only. No game code, audio, sprite, UI, scene, or build changes authorized by this note.  
**Scene:** `dk.temple.sacrifice.001`.  
**Related:** [Opening canon](forsaken-temple-opening-canon.md) · [Soul colours](soul-colours-death-shrouds-and-crystals.md).

## Purpose

The Forsaken Temple opening should feel like one continuous supernatural event rather than isolated character entrances and departures. The door's physical state, the Devil's supernatural disappearance, Lilith's deliberate departure, and the music must reinforce the player's choice to stay dead or resurrect.

These later owner instructions supersede the prior scripted approximation wherever the old sequence differs. Do not change the existing temple layout or its approved altar/props to accommodate them.

## Required door and encounter choreography

1. **Before the cult departs:** The **north temple door begins closed**. The cult's ceremony and the player's sacrifice proceed in the existing room. The door must visually read as shut, not an open arch.
2. **Cult departure:** The cult members and their leader **open the north door** to leave. They physically pass through it by their existing route. The **last departing cult member closes the door behind the group**. The door must visibly close after the last person has cleared it, not while someone is in the doorway or before the exit animation has finished.
3. **Ghost encounter:** The player ghost emerges farther back in the central aisle, retaining the chosen ghost distance. The **Devil is to the right/east of the altar**, and **Lilith is to the left/west of it**. Both **turn to face south toward the ghost**, rather than looking at the altar. The Devil addresses the ghost with the approved "You're mine" line and any later approved follow-up dialogue.
4. **Devil's departure:** **The Devil does not walk away and does not touch the door. He disappears supernaturally from where he stands** after addressing the ghost. The method or visual effect of disappearance is not specified yet; do not invent a teleport destination, new realm, smoke asset, animation, or power without approval. The closed door stays closed.
5. **Lilith's prayer:** After the Devil disappears, Lilith approaches the **front of the altar**, faces north and kneels in prayer for about **five seconds**. She rises and leaves the **existing glowing gold soul crystal at the prayer location**, not in the initial room state.
6. **Lilith's exit:** She then walks to the north doorway, **opens the closed door**, passes through and **leaves the door open**. Unlike the cult, she **does not close it behind her**.
7. **Player choice:** The temple door is **open and passable by the ghost or a resurrected living player**, whichever path the player chooses. The previously described supernatural barrier must also be removed by this point. Opening the door does **not** trigger automatic resurrection; the existing crystal interaction remains a deliberate double-left-click.

### Door state timeline

| Stage | North door | Player control and passage |
| --- | --- | --- |
| Ceremony/sacrifice | **Closed** | Scripted opening; player cannot leave. |
| Cult exit | **Opens**, then **last member closes it** | Cutscene-controlled; player remains unable to leave. |
| Devil faces ghost | **Closed** | Devil disappears in place, without using the door. |
| Lilith prayer / crystal | **Closed** | Crystal absent until prayer placement; player waits for scene completion. |
| Lilith walks out | **Opens and remains open** | Once she has gone and the lock is lifted, ghost and living player may leave. |
| After cutscene | **Open** | Player may inspect the crystal, resurrect intentionally, or leave in either form. |

### Cutscene/simulation requirements (future authorized build)

- Explicitly track **door open/closed state at each sequence phase** and represent it using approved north-door art.
- Avoid teleporting the cult members through a visually closed door; the last cult member's closure must happen only after their departure.
- Distinguish **Devil vanishing** from pathfinding through the north door; he cannot accidentally appear moving along the cult/Lilith exit route.
- Distinguish **Lilith holding/opening the door to exit** from the cult shutting it; she leaves the doorway passable.
- Preserve the ghost spawn farther down the aisle, the visual facing correction, the altar/body scale correction, the 16×16 tile positions and DK Architect geometry.
- Keep one canonical door state shared by cutscene and gameplay. Do not persist a permanently open-looking architectural prop while gameplay claims it is closed.
- On saving/continuing, never replay or skip the opening in a manner that incorrectly resets the door or traps a player. Ensure the final open-door and barrier-cleared state survives Continue.
- Do not silently fabricate a playable courtyard; the door can remain a connector marker pending approval for the next area.

## Sacrifice and aftermath soundtrack

The owner requests an **eerie, fitting, seamless music loop** that plays during the sacrifice **and continues afterward**. The track should be suitable for repeated playback without an obvious pop, abrupt restart, or tiring climax.

**Desired playback direction for later implementation:**

- Begin the chosen track at the start of the temple sacrifice/ceremony.
- Keep the **same uninterrupted loop** through the death, ghost appearance, Devil's claim, Lilith's prayer, crystal placement and the player's initial exploration afterward.
- Do not restart or switch the music when the ghost appears or when the Devil disappears.
- Keep music sufficiently quiet that the dialogue balloons are easy to read and any future spoken dialogue could remain intelligible.
- When the player eventually transitions out of the temple, the loop may fade or transition to the next area's score; this **transition treatment is a proposal**, not an approved timing or new track.
- Respect the existing audio preferences and browser autoplay restrictions; use the project's existing local audio approach rather than requiring streaming or a music service.
- Keep a local audio asset and record its provenance and licensing only after the owner selects and approves the actual song.

### Initial music candidates, *not yet selected or auditioned by the owner*

**First candidate: "Dark Shrine Loop" by qubodup.** OpenGameArt lists this under **CC0** and tags it for shrine/temple, mystery, prayer, cult and looping music. It offers an OGG file of approximately **679 KB**, appropriate for a relatively small web-game download. Source: https://opengameart.org/content/dark-shrine-loop. **Recommendation for consideration only**, not an approved final soundtrack. Verify the actual loop audibly before use.

**Alternative: "Echoes of the Past" by isaiah658.** Listed as **CC0** and explicitly described by its creator as a seamless, dark, mysterious ambient loop. Available as WAV (~8.5 MB); for deployment it may require an approved encoded OGG version. Source: https://opengameart.org/content/echoes-of-the-past. Also **not selected or licensed through a downloaded in-repo file yet**.

No music has been added to the game or claimed as tested.

## Outstanding visual corrections retained

- Player's body on the altar must **visually match normal living NPCs and the ghost in scale**, not simply reuse an oversized 64×32 render unchanged.
- The **cult leader faces the altar** during the prayer and sacrifice.
- During the ghost encounter, **the Devil and Lilith face the ghost down the aisle**, not the altar; Lilith turns north only when she goes to pray.
- Character travel must use the correct cardinal sprites. The Devil does not walk out at all under this revised direction.
- The player's ghost remains farther back in the aisle, reflecting the owner's intended scene composition.

## Approval boundary

**Documentation only.** This document does not authorize building the door logic, introducing supernatural effects, generating new music, downloading audio into the repository, making sprite sheets, changing save formats, or committing a gameplay release. Wait for explicit build authorization and the owner's soundtrack selection.
