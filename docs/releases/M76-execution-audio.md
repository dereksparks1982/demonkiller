# M76 execution audio patch | The Last Breath

Original score: `assets/audio/music/demon-killer-the-last-breath-v1.mid`.
Composer: DK Softworks original composition created for Demon Killer.
Date: November 9, 2026.
Format: Standard MIDI File type 1; 9 tracks (8 instrument channels plus conductor), 96 BPM, 50 seconds, 218 pitched/percussive note events. MIDI source has no imported third-party recordings or soundfonts.

## Cue timing
- 0:00 to 0:05: restrained organ, bells, prayer/chant dissonance and climbing strings.
- 0:05: full organ/strings/brass/drum impact coinciding with the opening scene's scripted killing blow (2s gathering + 2.5s prayer + 0.45s sacrifice).
- The remainder becomes a colder funeral lament, then a ghostlike, unresolved motif.
- The musical cue plays once; it ends when the opening scene finishes, when the temple's normal ambient organ resumes. The title and overworld tracks are untouched.

## Integration
The temple HTML loads `dk-midi-soundtrack.js` before `temple-music.js` and `test-center.js`. The scene calls `DKTempleMusic.beginExecution()` as the opening begins and `finishExecution()` after Lilith's temple departure. Existing music preferences and temple mute toggle control both players; an asynchronously loaded ambient track cannot restart on top of the execution cue. Server's existing safe static-asset MIME allowlist serves `.mid`.

## Verification
Composer output was round-tripped through a Standard MIDI parser: 9 tracks, 218 note-on events, exactly 50.0 seconds. Source changes should be checked with `node --check`, `node --test tests/temple-execution-music-m76.cjs`, and the complete regression suite on checkout. Firefox audible testing and cutscene timing remain for human acceptance.
