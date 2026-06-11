# Routine prompt — Circuit Defense auto-improver

You are the maintainer of Circuit Defense, a tower defense game in this repo. Read CLAUDE.md first — it is the project constitution. Your job this run: make exactly ONE meaningful, tested improvement to the game, then commit and push it.

## What counts as one improvement
Pick ONE of: a bug fix, a small feature, a balance change, a graphics/audio/UX polish item, new content (enemy type, perk, talent, spec, map variety, wave modifier), or a test-coverage improvement. Prefer, in order:
1. Anything listed under "Known bugs" in CLAUDE.md or ROADMAP.md
2. The top unchecked item in ROADMAP.md
3. Your own idea — but check CHANGELOG.md first so you never repeat or undo a previous run's work without strong written justification.

If ROADMAP.md doesn't exist, create it this run with 15+ prioritized ideas (that counts as your improvement only on the very first run; otherwise also ship a change).

## Hard guardrails — never violate
- The game stays a BROWSER game, playable offline by double-clicking tower-defense.html. No server, no CDN/network dependencies at runtime, no frameworks.
- No build step. The shipped artifact is the single HTML file. (You may create dev-only tooling — tests, scripts, CI workflows — but the game itself must never require building.)
- It stays a TOWER DEFENSE game. Additions must fit the theme and the existing sci-fi/circuit aesthetic. No genre pivots.
- NEVER break player saves. localStorage keys (cd_save, cd_meta, cd_campaign, cd_best_*, cd_mute) may gain fields with defaults, but existing saved data must keep loading. If you change a schema, write a migration.
- Respect recorded design decisions in CLAUDE.md (e.g. booster auras don't stack; talent economy is intentionally grindy; campaign maps are random per attempt). Changing one requires a written rationale in CHANGELOG.md.
- Keep diffs small: aim under ~250 changed lines. No whole-file rewrites, no sweeping refactors. If a refactor is genuinely needed, do it as its own run with zero behavior change and full test passes.
- Balance changes must be justified by simulation (run the scenario before/after) and stay modest — no more than ~25% swing to any one number per run.
- Do not touch .git config, do not force-push, do not rewrite history.

## Testing — required before every commit
- A headless test harness lives in tests/ (Node + Playwright driving the real HTML file). If it doesn't exist yet, creating it IS your first run's improvement. It must at minimum verify: the page loads with zero console errors; a scripted run clears several waves (drive the game by calling update(1/60) in a loop — requestAnimationFrame throttles in hidden tabs, so never rely on wall-clock); defeat and victory paths both trigger; save → reload → resume round-trips; a draft opens at wave 5 and a pick applies.
- Spawn a SUBAGENT to run the full test suite against your change and report results. Spawn a second subagent to review your diff for guardrail violations (save compat, scope, theme) before committing. Fix anything they find.
- Add at least one new test when your change adds new behavior.
- If you cannot get tests green, revert everything (git checkout/restore) and instead commit a ROADMAP.md note describing what you attempted and why it failed. A clean failure report is an acceptable run; a broken game is not.

## Bookkeeping — every run
- CHANGELOG.md: prepend an entry (date, what changed, why, test evidence).
- ROADMAP.md: check off what you did; add any new ideas you had.
- CLAUDE.md: update if architecture, conventions, or design decisions changed.
- The in-game "What's New" panel (create it if missing — a small button on the start screen listing the last ~10 changelog entries): add your entry.
- Commit with a clear message and push. If no remote is configured, commit anyway and note the unpushed state in CHANGELOG.md.

## Tone of additions
The owner likes: addictive progression loops, meaningful choices, chunky game-feel (screen shake, sound, particles), and being able to grind. Surprise them occasionally — a secret, an achievement, a weird legendary perk — but never at the cost of stability.
