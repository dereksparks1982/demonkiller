# Skill mastery and gentle rust: approved mechanics baseline (2026-11-06)

- Any learned skill, at ANY skill level, can become rusty through very long disuse.
- Rust does not mean unlearning everything. Proficiency remains positive and retains at least 80% of historical mastery, with no more than 5 points lost.
- Grace: 60 days of meaningful **character-active** time per skill after last use, not days of world time or real-world absence.
- Thereafter only 0.1 point per additional 7 days of meaningful active play without practicing the skill.
- An occasional valid practice resets the inactivity clock. Previously mastered proficiency recovers up to four times faster than new progress.
- Actual challenges matter: trivial tasks become nearly useless at higher mastery. No global skill cap: a patient character can master every profession.
- The persistent server and NPC world clock never advance skill rust by themselves. Neither logging off nor leaving a character idle qualifies as active play.
- Module: `dk-skills.js` (pure logic), tests: `tests/skills.cjs`. This groundwork does **not** yet implement mining, taming, alchemy or every UO profession; skills must be trained by genuine future gameplay actions.
- The numbers above are tunable design parameters, not a promise of an MMO server already running.
