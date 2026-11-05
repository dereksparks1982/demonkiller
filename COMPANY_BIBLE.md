# DEMON KILLER
# COMPANY BIBLE

**Studio:** DK Softworks, whose DK represents Russian `ДК` (`Дом культуры`, Dom kultury), meaning **House of Culture**. DKLab is an internal lab/division. Preserve Elderred Softworks LLC where historically or legally relevant.
**Project:** Demon Killer
**Authority:** The owner and creator
**Adopted:** 2026-11-04
**Status:** Binding **development procedures**, not lore and not permission to build
**Source:** Adapted from Capital & Consequence `COMPANY_BIBLE.md`, read at source blob `a1773d33ebae0c48b31aed77fbf89e5f593ff251`, incorporating shared owner directives. Project-specific C&C storyline, chronology, mechanics, and its own prerelease save policy are **not automatically transferred** to Demon Killer.

> **FIX THE PROBLEM. PRESERVE THE WORLD.**

This Bible applies to assistants, developers, automation, future builds, refactors, tests, art, documentation, and handoffs. **Read it before touching this project.** Read the relevant Demon Killer canon too: [Forsaken Temple opening](docs/forsaken-temple-opening-canon.md), [Architect plan](docs/architect-plan.md), and other active source docs.

## Eleven non-negotiable rules

### 1. The owner is the final authority
The owner decides what belongs in the game, what changes, and what stays. Developers should suggest improvements, challenge weak ideas, identify risks and offer alternatives, with clear reasons. Advice never overrides an owner decision without consent.

### 2. Authorization is specific, not blanket permission
Permission for one named exception or change applies to that change alone. A named art request does not authorize game code, a new area, a release, a branch deletion or other unrequested work.

### 3. Preserve established gameplay
A repair must not break, erase, bypass or casually simplify another working or approved system. Keep story progression and gates, local save/export behavior, player movement and approved room/editor geometry unless the owner explicitly approves a change.

### 4. Never assume story or lore
Character identities, world-state differences, relationships, secrets, scene timing, location and plot outcomes remain authoritative. Do not invent facts, abilities or dialogue to make implementation easier. Proposals must be labeled as proposals.

### 5. No unauthorized changes
Do not implement extra features, remove restrictions, redesign screens, move approved UI geometry, replace assets, or change unrelated files. **"While I was here" is not authorization.**

### 6. Read project documentation before editing
Read this Bible and the latest relevant canon, owner decisions and current source. If texts conflict, prefer the later *explicitly approved* decision, document the discrepancy, and do not guess.

### 7. Tests must protect the game
Never rewrite valid expectations merely to pass a test. Investigate failing tests and preserve approved mechanics. When the owner changes a requirement, record approval first, then update the correct regression tests.

### 8. Failed builds are not accepted builds
A commit, command, green CI run or partial browser test cannot substitute for verifying the requested behavior. Say what was tested, what was not tested, and what needs the owner's acceptance.

### 9. Document changes and preserve history
Record what changed, why, what was authorized, and what was verified. Keep past history and canon instead of concealing an error by rewriting tests or erasing source branches. Documentation-only commits are not game releases.

### 10. Stop means stop
When the owner says **stop** or **don't build**, do not continue editing code, generating additional assets, pushing game builds, or performing mutating build actions. Resume only within the scope of a new clear authorization.

### 11. Listen first. Never build without clear authorization
**No game code, gameplay builds, assets, releases or commits for a build begin until the owner authorizes the specific work.** "Build", "implement", or a clear equivalent directed at a defined task is sufficient. A discussion, correction, proposed idea, "what do you think", "maybe", or instruction to read/research/document is not a build authorization.

The owner frequently works out details across several messages. Listen to the entire request. An expressly authorized **sprite sheet** is authority to make that sheet, not to put it into the game or to build a courtyard. An expressly authorized **documentation** change is authority to document, not to implement.

## Change-scope and review discipline

Before a change, identify:
1. The exact owner-authorized request.
2. Which files, assets, behavior and story gates may change.
3. Which unrelated systems must remain protected.
4. What tests and visual checks would verify the change.
5. What will be reported, including known omissions and any required owner approval.

If the intended repair requires an unapproved collateral change, stop that collateral work and explain the options.

## Development and release rules

- **Technology direction:** Demon Killer uses its own HTML/CSS/JavaScript and Canvas renderer with a hand-built, old-school Ultima Online-inspired client/gameplay approach. **No Godot or other off-the-shelf engine** unless the owner changes that directive.
- **Temple-first:** Keep the original Forsaken Temple and DK Architect as the working scene until expansion is separately authorized. Do not alter the established altar or architect layout to simplify a script.
- **Mouse-control contract:** In Walk Temple mode, right mouse is continuous movement; left mouse is inspection/interaction, with the crystal's later approved **double-left-click to resurrect**. In Architect Mode mouse actions remain editing controls. Reference [opening canon](docs/forsaken-temple-opening-canon.md).
- **Art:** Use original approved assets and cardinal variants. Keep the 32 × 32 art/grid conventions. Do not silently substitute off-style assets or invent lore-bearing art.
- **No assumptions about old saves:** The Capital & Consequence-specific prerelease save replacement rule is not automatically a Demon Killer rule. Preserve working current-project save/export behavior unless the owner expressly directs otherwise.
- **GitHub Actions and compute:** Allowed but **use sparingly**, per owner directive. Prefer proportionate local Linux checks. Avoid rerunning hosted CI unnecessarily, uploading oversized artifacts, excessive retention or avoidable charges. Report what verification actually ran.
- **Linux-first:** Work with the existing project. Never silently clone a replacement project as the new active game.
- **Terminal practices:** No password prompts, SSH-agent/keyring dependencies, automatic browser openings or `set -e` terminal traps. Use the approved single-command changed-files patch method when the user wants a local patch.
- **Source discipline:** Do not split or reorganize functioning code for style alone; do not introduce unrequested third-party assets/dependencies or executables.
- **Acceptance and GitHub:** Do not treat a source commit as an owner-accepted release. For a formal release, follow **accepted snapshot → local commit + annotated version tag → GitHub push + verification**, one accepted build at a time, with release notes/version and an up-to-date README. Do not call unaccepted game changes finished merely because a commit exists.
- **Branches and history:** Do not delete old Godot/archive branches solely on the assumption that doing so saves storage. Inspect unique history/assets and get owner approval first. A Git branch name ordinarily shares object storage with other branches.
- **Documentation-only scope:** An explicitly requested document update may be committed without authorizing gameplay, a tag, or release/deployment. When the owner authorizes just an art concept for review, keep it out of game asset usage until approved.

## Required reference separation

This file is the **company's rules for making the game**, not the game story. Keep the authoritative ghost/living-world contrast, woman/prayer scene, willow outcomes and design notes in [docs/forsaken-temple-opening-canon.md](docs/forsaken-temple-opening-canon.md). Other world and editor plans belong in their designated docs.

If any older README, test comment or implementation says the crystal starts present or is activated by single-click, treat that as the **older implementation** and the approved opening document as the **future target**. Do not quietly implement or modify tests without a build instruction.

## When a developer gets it wrong

Acknowledge the exact unauthorized change, identify affected files/behaviors/tests, and don't conceal it by inventing approval or weakening regression checks. Stop when told and await direction for correction.

**DEVELOPERS MAY PROPOSE BETTER IDEAS. THE OWNER DECIDES WHAT GETS BUILT.**

**FIX THE PROBLEM. PRESERVE THE WORLD.**
