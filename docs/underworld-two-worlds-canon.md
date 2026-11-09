# Demon Killer: The Underworld, the Village and Two Ways to See

Approved design, November 9, 2026. Do not confuse documented requirements with shipped features.

## One village, one world (M78 implemented)
The village is the ORIGINAL circle where the Queen becomes a willow. It occupies 64 × 64 authored ground tiles from global (4096,4096) on one contiguous 9,216 × 9,216 world; player exploration crosses 128 × 128 Streaming Cells naturally, with sixteen-tile terrain sectors. The rest of the world is flat grass by default, editable through DK Architect. The separate northern village is obsolete and must not be reproduced. There are **no starting buildings except the Forsaken Temple**. Its intact exterior occupies 16 × 16 world tiles at (4120,4144) and must be visible in full in the first outdoor view, including its roof and door. New buildings require physical resources and construction labor. Character test saves are disposable.

## The Queen, the King, and the cult
The Queen and King of the Underworld are titles, with true fantasy names to invent later. The Queen takes inspiration from Freyja's autonomy, Frigg's royal status and Athena's intelligence; she is a wholly original fantasy deity, not an actual object of real-world worship. The cult leader, King and Queen must use the same large Gothic dialogue/prayer window. **Pending**: King enters and disappears in a magical flash; Queen appears in a flash but **walks out the temple door normally**. Keep pixel-art effects original and appropriately brief.

## The witnessed tree (M78 implementation)
The player must exit the temple and WALK toward the Queen. On reaching a visible distance, the camera temporarily takes control, she prays in the large Gothic window, and the player sees the actual six-pose transformation. Ghost: splendid golden willow. Alive: twisted diseased black willow. It is the SAME tree and Queen at the SAME coordinates. Clicking when dead says: “Death does not reveal another world. It reveals the truth this one has always hidden.” Clicking when alive says: “The living fear what they cannot understand. Even a miracle looks like a curse through mortal eyes.” The spiritual perspective is unreliable: living eyes do not always show truth.

## Death as strategy (pending expansion)
The introductory sacrifice means everyone has died once before play. Later the player may deliberately return to ghost form to reach spirit-only rooms, symbols, beings, quests or traversal routes. The living and dead share exact physical coordinates but perceive different things, loosely inspired by the dual worlds of Zelda: A Link to the Past without importing artwork or story. A future optional **ritual death** command allows the character to voluntarily become a ghost without finding a monster, with solemn non-graphic presentation and consequences. Do not implement a free infinite toggle; the corpse remains physically in the persistent world.

## Bodies, stolen gear and storage (pending integration)
When a player dies, worn gear, carried resources and coins remain with the corpse or physical possessions, not automatically retained by the ghost. Monsters and people may rummage through corpses and TAKE actual items. Track the taker and ownership trail so player can seek the monster, recover or trade for gear. Corpses decompose over time while loot persists according to its physical carrier/container rules. The existing corpse/decay and scavenging systems are a partial foundation, not a full implementation of player-death possessions.

Storage categories: **bank vaults**, protected house storage, and player-created persistent hidden **caches** anywhere terrain permits. Caches themselves **do not decay**, but other actors can discover and loot them. They are saved physical objects with optional personal list/location markers; players can deliberately store gear before death. Caches and voluntary death mechanics are not shipped by M78.

## Original owned music (pending final assets and wiring)
DK Softworks alone creates soundtrack material. Temple/execution receives an original MIDI-styled **MP3 or other universally playable audio file**, not a raw MIDI the player cannot open. At least **90 seconds of continuous music**, lasting across sacrifice, prayer, resurrection choice, and exit. **Remove the previous temple music entirely** so it cannot return when a short cue ends. The overworld receives a darker, ominous, fully original *seamless loop*, not the cheerful existing track. Original main menu composition is retained. Music replacement is NOT completed in M78.

## NPC society and physical businesses (longer-term roadmap)
Follow UO/RunUO and Life is Feudal principles but exceed them: independent NPC builders, craftspeople, farmers, guards, employees and traders; one player character can own/operate businesses hands-on or delegate to assistants, producing real physical stock. Buildings emerge from level ground, material delivery and phases of construction, not magically spawned towns. Keep terrain/society persistent while the server runs without browser. Preserve original approved art; no Godot, no incompatible third-party rights.
