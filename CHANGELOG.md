# Changelog

All notable changes to Circuit Defense. Newest first. Versions are semver-ish:
patch = fixes/balance, minor = features/content.

## v1.4.0 — 2026-06-10

**Added: in-game "What's New" panel + headless test harness.**

- **What's New panel** — a new `✨ What's New` button and a clickable version
  tag (`v1.4.0`) on the start screen open a panel listing the last ~10 changelog
  entries (data lives in `CHANGELOG_ENTRIES` in `tower-defense.html`, mirroring
  this file). Styled to match the existing talent/draft modals; no save-schema
  changes.
- **Test harness** (`tests/`, dev-only) — Node + Playwright drives the real
  `tower-defense.html` headlessly and verifies: page loads with zero console
  errors; a scripted run clears several waves; a draft opens at wave 5 and a pick
  applies; the victory and defeat paths both trigger; and save → reload → resume
  round-trips. The harness drives the sim via `update(1/60)` loops (never
  wall-clock) per the project's testing rules.

_Why:_ first real auto-improver run. The routine designates the test harness as
the first run's improvement, and the What's New panel + version constant are
required bookkeeping infrastructure that every subsequent run depends on.

_Test evidence:_ `cd tests && npm test` → **27 passed, 0 failed.** Confirms zero
console errors on load, wave-5 draft applies, victory at wave 30, defeat at 0
lives, and a save/reload/resume round-trip restoring wave + towers.

---

### Earlier history (pre-changelog, reconstructed from git)

- **v1.3.x** — Removed the Scrapper perk; reduced rare-draft chance 26% → 14%.
  Increased enemy HP 20% across all modes. Lengthened campaign waves
  (15 at level 1 up to 54 at level 40).
- **v1.2.0** — Campaign mode (40 random-map levels), abilities (Meteor / Freeze /
  Gold Rush), rarity-tiered perk drafts, Mayhem map, graphics overhaul, quit flow.
- **v1.1.0** — Talents + chip progression, tower specializations, difficulties,
  save/resume.
- **v1.0.0** — Circuit Defense launch: single-file browser tower defense,
  synthesized WebAudio, canvas pseudo-3D rendering.
