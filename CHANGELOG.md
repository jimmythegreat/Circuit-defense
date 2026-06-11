# Changelog

All notable changes to Circuit Defense. Newest first. Versions are semver-ish:
patch = fixes/balance, minor = features/content.

## v1.6.1 — 2026-06-11

**Feature: "New record!" end-of-run flourish (ROADMAP "Game feel / polish" +
v1.6.0 follow-up).**

When a quick-mode run finishes (defeat *or* victory) and its wave beats the
existing **Records-grid cell** for that map × difficulty, the game-over/victory
overlay now celebrates it.

- A golden **🏆 NEW RECORD!** banner appears above the result text, showing the
  new wave, the previous best, and the delta — e.g. *"Wave 15 — beat your best
  of 4 by 11 on Classic · Normal"*. The banner pops in with a spring scale
  animation and the title gets a brief golden pulse.
- A new triumphant `SFX.record()` fanfare (rising arpeggio + shimmer) plays
  ~450 ms after the win/defeat sting so it lands as its own beat, plus a
  screen-shake and a golden particle burst for chunky game-feel.
- `recordBest()` now returns a `{prev, now}` record event (or `null`) so callers
  can react; `endGame()`/`winGame()` pass it to the new `applyRecordFlourish()`.
  **First-ever** entries on a fresh cell record **silently** (prev 0) — the
  party only fires when you beat a *real* prior best, keeping it meaningful.
- **No save/schema changes.** The flourish is DOM/audio only; the same per-map
  (`cd_best_<map>_<diff>`) and legacy (`cd_best_<diff>`) keys are written exactly
  as before. Campaign runs never fire it (campaign maps are random per attempt,
  so they keep no per-map records).
- **Test evidence:** `tests/` green (76 checks, exit 0). New **Test 10** asserts
  the banner/`SFX.record`/`applyRecordFlourish` exist, beating a prior best adds
  the `.record` class + a correct banner + persists the new value, a first-ever
  entry does **not** fire the flourish, and a campaign defeat does **not** fire it.

## v1.6.0 — 2026-06-11

**Feature: Records / personal-bests panel (ROADMAP "Next up" item).**

A new 🏆 **Records** button on the start screen (beside Achievements) opens a
panel showing your highest wave reached on every quick-mode **map × difficulty**,
plus an **"★ Any map"** summary row, your **campaign progress**, **lifetime
damage**, **total runs** and **chips**.

- Quick-mode runs now log a best-wave **per map** (`cd_best_<map>_<diff>`), not
  just the legacy per-difficulty key (`cd_best_<diff>`). A new `recordBest()`
  helper writes both and replaced the two inline `if (wave > best)…` lines in
  `endGame()`/`winGame()` (identical behavior for the end-of-run "Best:" line).
- New keys are additive and read with a `|| 0` fallback — old saves are
  untouched. Map keys (classic/spiral/serpent/mayhem) can never collide with diff
  keys (easy/normal/hard), so `cd_best_classic_easy` ≠ legacy `cd_best_easy`.
- Campaign defeats/wins do **not** write per-map keys (campaign maps are random
  per attempt — a recorded design decision), so the matrix stays meaningful.
- The "Any map" row surfaces players' existing historical bests from the legacy
  keys immediately, so the panel isn't empty on first open.
- **Test evidence:** `tests/` green (68 checks, exit 0). New **Test 9** asserts
  per-map + legacy keys are both recorded on a quick defeat, the panel renders a
  table with the "Any map" row and the recorded value, the stats footer shows,
  and a campaign defeat adds **no** per-map key.

## v1.5.2 — 2026-06-11

**Fix: What's New panel no longer grows past the game (FEEDBACK item).**

Owner feedback: *"What's new should not grow past the game. It should instead
convert to a scrollable window."*

- On tall viewports the panel's `max-height:88vh` could exceed the game's own
  height (~836px), so the panel overhung the bottom of the board and dragged the
  `#appRow` flex row taller than `#gameCol`. The panel now caps to the game's
  actual height and scrolls its entries internally instead.
- Implementation: a new `syncWhatsNewHeight()` helper sets
  `#whatsnew.style.maxHeight = #gameCol.offsetHeight + 'px'` (the row is
  `align-items:flex-start`, so `#gameCol`'s height is its own content height,
  independent of the panel — no feedback loop). Called from `openWhatsNew()` and
  on `window` `resize`. Pure DOM/CSS; touches no save logic.
- **Test evidence:** `tests/` green (58 checks, exit 0), including a new
  tall-viewport regression block that asserts (a) the precondition that 88vh
  exceeds the game height, (b) panel height ≤ game height, (c) `#appRow` does not
  grow past the game, and (d) overflowing entries scroll inside the panel.
  Verified live in the browser preview: at 1280×1100 the panel dropped from 968px
  (overhanging) to 836px (= game), `#appRow` from 968→836, list scrollable.

## v1.5.1 — 2026-06-11

**UX polish: dim the in-game chrome on the start screen (FEEDBACK item).**

Owner feedback: *"The stats bar (bar below the game name) and the tower, wave
options, and hotkeys should not be shown or maybe they are dark like the current
level is if you're not currently in an active game."*

- When no game is active (start screen), the stats HUD (`#hud`), tower shop
  (`#shop`), wave controls (`#controls`) and hotkey hint (`.hint`) now dim to
  30% opacity with a grayscale tint and go `pointer-events:none`, so the start
  menu reads as the only live surface. They light back up (with a .25s fade) the
  instant you hit **Play** or **Resume**, and re-dim on return to the menu.
- Implementation: a single `.idle` class toggled on `#gameCol` by a new
  `setActiveUI()` helper, wired into `beginGame()`, `loadRun()`, `backToMenu()`
  and startup. Chrome stays lit during the game-over overlay (still an active
  session); re-dims only when the player hits Main Menu. No new localStorage
  keys; pure CSS + one helper — fully save-compatible.
- **Tests:** added Test 8 (9 assertions) verifying the chrome dims on the start
  screen, is non-interactive, lights up at full opacity during play, and re-dims
  after `backToMenu()` — reading opacity with transitions disabled so the fade
  can't race the assertion. Full suite **54 passed, 0 failed**.

## v1.5.0 — 2026-06-10

**Added: Achievements — 8 permanent, account-wide badges (top ROADMAP item).**

- A new meta-progression layer that persists across all runs (alongside chips/
  talents). The eight achievements: **First Victory** (win any game), **Flawless**
  (win without losing a single life), **No Mercy** (win on Hard), **Mountaineer**
  (clear Campaign L10), **Conqueror** (complete the campaign at L40), **Endless**
  (reach wave 50 in one run), **Megadamage** (1,000,000 total damage, lifetime),
  and **Veteran** (finish 25 runs).
- **Start screen:** a 🏅 Achievements button shows live `done/total` progress and
  opens a grid panel (locked badges are greyed/🔒, unlocked ones glow gold),
  mirroring the Talents panel's look. **End-of-run screen:** any newly-unlocked
  badge is announced inline ("🏅 Achievement unlocked: …").
- **Save schema (additive, migrated):** `meta` gains `achievements` (id→true map)
  and `stats` (`{dmg, runs}` lifetime counters). `loadMeta()` defaults both when
  absent, so pre-v1.5 `cd_meta` saves load untouched (verified by a migration
  test — chips/talents survive, new fields default). No existing field changed.
- **Flawless integrity:** a per-run `livesLostThisRun` flag (set when any life
  leaks) gates Flawless. Resumed runs are marked non-flawless since the earlier
  waves can't be verified.
- **Tests:** new section [7] (11 checks) — definitions present, panel exists,
  progress shown, a flawless Hard win grants three badges at once, the unlock is
  announced, Flawless is withheld when a life was lost, 1M damage grants
  Megadamage, and an old-save migration round-trips. Full suite green:
  **45 passed, 0 failed.** Guardrail review: PASS on all five (save-compat, scope
  ~154 lines, offline/no-build, theme, no duplicate ids / stray code).

## v1.4.1 — 2026-06-10

**Fixed: What's New panel now floats beside the ENTIRE game (owner feedback).**

- Previously the panel lived inside the `#stage` flex row beside only the canvas,
  so opening it slid the canvas over while the title/HUD (top) and towers/controls/
  hotkeys (bottom) stayed put — the game looked misaligned. Per owner FEEDBACK, the
  change log should float next to the *whole* game.
- **Layout restructure (pure CSS/DOM, zero behavior change):** the whole game now
  lives in a `#gameCol` column (title, HUD, `#stage`/canvas, shop, controls, hint),
  and `#whatsnew` is its sibling inside a new outer `#appRow` flex row. Opening the
  panel shifts the entire column together; on narrow viewports the panel still wraps
  below. Height cap changed from a fixed `562px` to `88vh` so it spans the taller
  full-game column and scrolls internally.
- **Tests:** updated section [6] geometry assertions to measure against `#gameCol`
  instead of `#gameWrap`, and added a new check — *"opening the panel shifts the
  WHOLE game together, not just the canvas"* (canvas stays centered relative to the
  HUD whether the panel is open or closed). Full suite green: **35 passed, 0 failed**.
- No save-schema, balance, or gameplay changes. Guardrail review: PASS on all five.

## v1.4.0 — 2026-06-10

**Added: in-game "What's New" panel + headless test harness.**

- **What's New side panel** — a scrollable **side panel** (an `<aside>` beside
  the game canvas, not a modal overlay) listing the last ~10 changelog entries
  (data in `CHANGELOG_ENTRIES` in `tower-defense.html`, mirroring this file). It
  is **open by default** and sits *flush* against the canvas's right edge on wide
  viewports, wraps below on narrow ones, is height-capped to the canvas and
  scrolls internally. A `✕` hides it and the choice persists (`cd_wnclosed`); the
  `✨ What's New` button and clickable version tag reopen it. New localStorage key
  `cd_wnclosed` is additive — no existing save schema changed.
- **Test harness** (`tests/`, dev-only) — Node + Playwright drives the real
  `tower-defense.html` headlessly and verifies: page loads with zero console
  errors; a scripted run clears several waves; a draft opens at wave 5 and a pick
  applies; the victory and defeat paths both trigger; and save → reload → resume
  round-trips. The harness drives the sim via `update(1/60)` loops (never
  wall-clock) per the project's testing rules.

_Why:_ first real auto-improver run. The routine designates the test harness as
the first run's improvement, and the What's New panel + version constant are
required bookkeeping infrastructure that every subsequent run depends on.

_Test evidence:_ `cd tests && npm test` → **34 passed, 0 failed.** Confirms zero
console errors on load, wave-5 draft applies, victory at wave 30, defeat at 0
lives, a save/reload/resume round-trip restoring wave + towers, and that the
What's New side panel is open by default, sits flush beside the game (not an
overlay), lists all entries, height-caps to the canvas, and that closing it
persists across a reload.

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
