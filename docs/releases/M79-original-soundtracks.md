# M79 | Original continuous temple and dark overworld scores

**Date:** November 9, 2026. **Composer:** DK Softworks.
Melodies, structure and arrangement are new to Demon Killer, not adapted from
the retired temple track or from another game.

## The Last Breath: temple, sacrifice and lingering ghost
- **108 musical seconds** in an E-minor/Phrygian Gothic palette, 80 BPM, 36 bars.
- Instruments: organ, choir, low strings/cello, bell, harp, brass, wind,
  restrained ritual percussion. All musical events are source MIDI authored
  for this game.
- 0:00 to 0:05: restrained ceremony and mounting dread.
- 0:05: death-blow chord with brass/bells and percussion, in sync with the
  scripted sacrifice.
- 0:05 to 0:24: low spectral lament as the ghost sequence begins.
- 0:24 to 1:48: sustained eerie passage. This **84-second segment** repeats
  while the player decides whether to resurrect or remain a ghost. Cutscene
  completion does not restart or change the score. Leaving the temple ends it.
  Re-entering an already completed temple starts directly at 0:24.

## The Shrouded Road: overworld
- A different **96-second** original atmospheric E-Phrygian composition,
  with dissonant low drones and sparse mournful lines.
- The same score replaces the prior cheerful track in the old outdoors scene
  and the connected 9,216 × 9,216 tile atlas, looping at its full 96s length.
- The original menu theme is unchanged.

## Files, playback and rights
- Original source: `assets/audio/music/demon-killer-the-last-breath-v2.mid`
  and `assets/audio/music/demon-killer-overworld-shadowlands-v2.mid`.
- GitHub Actions automatically renders matching MP3 files under the same
  directory names (`.mp3`) from the MIDI sources using FluidSynth and ffmpeg.
  This asynchronous render/commit must be verified before claiming the
  binaries are published.
- On browsers, `dk-rendered-soundtrack-m79.js` plays the actual MP3 via
  WebAudio with explicit loop boundaries. When MP3 is missing/unsupported,
  it falls back to *the same new score* using the MIDI synth, never to the
  old temple or old overworld tunes.
- The compositions and MIDI events are original. SoundFont sample recordings
  are third-party render instruments; **audit their licences before commercial
  redistribution**. Source MIDI and the game's built-in oscillator fallback
  do not require distribution of external samples.

## Verification status
Both new MIDI sources were decoded with the game's parser in isolation:
**108.0s / 346 notes** for temple and **96.0s / 300 notes** for overworld.
All changed JavaScript was syntax checked. Live Firefox playback, automatic
Action MP3 deposit, actual loop seam and full Node suite remain to be verified.
