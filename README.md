# ⚡ Circuit Defense — an experiment in LLM-maintained software

**[▶ Play it here](https://jimmythegreat.github.io/Circuit-defense/)** — no install, works offline, runs entirely in your browser.

## What is this?

A browser tower defense game that is **built and maintained almost entirely by an LLM, on a schedule**. Roughly every hour, an automated Claude routine wakes up and ships one tested improvement — a feature, a bug fix, a balance change, new content, or engineering work — then commits and pushes it. The human owner steers; the LLM builds.

The game started as a single HTML file written in one session and has been evolving autonomously ever since. Check the [commit history](../../commits/master) and [CHANGELOG.md](CHANGELOG.md) to watch it grow, one hourly change at a time.

## How the loop works

1. **[routine-prompt.md](routine-prompt.md)** is the standing instruction set the LLM follows every run — what to work on, hard guardrails (browser-only, no build step, never break player saves), testing requirements, and bookkeeping rules.
2. **[FEEDBACK.md](FEEDBACK.md)** is the owner's voice: feedback and requests queued there get done before anything the LLM invents on its own.
3. **[ROADMAP.md](ROADMAP.md)** is the LLM's own backlog. Every run must deposit at least one new idea, so the list never runs dry. Owner `git revert`s are treated as vetoes and logged so they're never re-attempted.
4. **[CLAUDE.md](CLAUDE.md)** is the project constitution — architecture map, conventions, and recorded design decisions that persist across runs.
5. Every 6th run is a **health check**: no new features, just auditing for refactor needs, doc drift, and missing table-stakes engineering.
6. Every change must pass a **headless Playwright test suite** (`tests/`) before it can be committed.

## The game itself

A pseudo-3D canvas tower defense: 12 tower types with specializations, a talent tree fed by chips you earn each run, rarity-tiered perk drafts every 5 waves, active abilities, achievements, records, a 40-level campaign with randomly generated maps, and a Mayhem mode where the path itself shifts under your towers. All graphics are canvas-drawn and all audio is synthesized — no assets, no network, no dependencies.

**To play locally:** clone the repo and double-click `tower-defense.html`. That's it — there is deliberately no build step.

## Repo map

| File | What it is |
|---|---|
| `tower-defense.html` / `.css` / `cd-*.js` | The game (classic scripts, no modules, no build) |
| `routine-prompt.md` | Standing instructions for the hourly LLM run |
| `FEEDBACK.md` | Owner's request queue (highest priority) |
| `ROADMAP.md` | LLM's self-maintained backlog + owner vetoes |
| `CHANGELOG.md` | Every shipped change, newest first |
| `CLAUDE.md` | Architecture/conventions the LLM keeps current |
| `tests/` | Headless Playwright suite every change must pass |

## A note on issues & PRs

This repo is a hands-off experiment: the maintaining LLM works only from `FEEDBACK.md` and its own roadmap, and does not monitor issues, pull requests, or discussions. Feel free to open them for the humans watching, but don't expect the robot to respond — that's by design.

## License

[MIT](LICENSE)
