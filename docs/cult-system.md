# Cult System: Implemented Foundation

**Demon Killer | Elderred Softworks LLC**

**State:** The cult simulation, 24-person procedural population, local time/schedule model, per-character saves and read-only dossier/public-register journal are implemented. Visible city NPCs, playable civilian locations, investigative quests, cult reactions in scenes and an authoritative world server are not yet implemented.

## Design rules

A hidden conspiracy can involve ordinary citizens and influential people. Some members are permanently associated with established story events, while the allegiance of other citizens depends on the new game's seed and their motivation. Membership can change through recruitment, personal circumstances and departures. Death may produce leadership vacancies, which surviving members can fill. Not all prominent citizens are guilty.

The player may meet a citizen without discovering their affiliation. Dossiers must show only encountered public identities and evidence actually collected. Suspicion is not confirmation. Proof may reveal membership or rank, but later events can make previously confirmed information stale until fresh proof is collected. The game truth and the player's evidence must remain separate.

## Source locations

- cult-system.js: engine-free, dependency-free cult-world module.
- citizen-population.js: generates 24 ordinary and prominent procedural citizens, their public occupations, work hours, traits and reciprocal social ties. World-relative schedule locations are abstract (home, workplace, public), not newly built map areas.
- index.html: generates a unique world seed for every new named character slot.
- test-center.js: restores or initializes cult state inside the existing named-character save record; persists changes without replacing the DK Architect room save/export keys.
- test-center.html and cult-journal.css: fixed-position Cult Journal accessible in the temple.
- tests/cult-system.cjs and tests/cult-integration.cjs: deterministic simulation and save/DOM integration tests.
- tests/population.cjs: independent population and schedule regressions.

## World content integration

The engine has no invented named society figures or unapproved geographic hierarchy. Gameplay code can register documented citizens with fields id, name, occupation, region, prominent, traits, ties, eligible, and branch. Traits include ambition, greed, fear and belief in the range 0..1. An NPC profile with fixed=true always belongs to the cult. The initial world registers an unnamed ritualist as a hidden fixed participant in the planned temple sacrifice, but does not automatically disclose him.

The browser scene integration object window.DemonKillerCultHooks exposes these functions:

- registerCitizen(profile): register a public character with deterministic hidden affiliation.
- meet(id): reveal only the public card.
- evidence(id, {id,kind,title,source}): add knowledge. kind is suspicion, membership, innocence or rank.
- recruit(id,{by,pressure}), depart(id), kill(id), promote(id,branch), circumstances(id,traits): event-driven organization changes.
- dossier(id), board(): player-knowledge-only projections.

Proof of active membership/rank is rejected for non-members; exoneration of a currently active member is rejected. Evidence is deduplicated by ID. The journal renders text as text, not HTML. Clues are not fabricated automatically: future authored scenes and investigations must supply them.

## World persistence and limitations

Each character slot has a worldSeed at creation and a cultWorld state containing actual membership, political history and separate player knowledge. Continue restores that state. Older slots migrate using a stable legacy seed. Overwriting a slot creates a new seed and fresh investigation. Direct guest temple access gets a temporary session world without a separate local storage key.

The world now initializes 24 named **procedural** civilian profiles, but none are automatically encountered. The Society Register tab shows public names, occupations, published work hours and whether a character is encountered. Its contents never disclose affiliation, motives, internal contacts or evidence. The Discovered Dossiers tab correctly starts empty until actual encounters or evidence. In-scene systems will use window.DemonKillerPopulationHooks.publicRegister(), publicRecord(id), schedule(id), currentTime(), advanceHours(hours), and encounter(id). The roster is a simulation and journal record, not proof that those citizens have been placed into a playable street map.
 The previously approved opening cinematics, temple and character sprites, creature trees, architectural courtyard, editor geometry and main-menu README are untouched.

This is currently a **local, browser-based simulation**. Its secret data can be inspected with browser developer tools; true secrecy for a shared persistent world will require an authoritative backend later. Never treat the current work as a completed cult quest system.
