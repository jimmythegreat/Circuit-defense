# Circuit Defense — test harness

Headless [Playwright](https://playwright.dev) tests that drive the **real**
`../tower-defense.html` in a headless Chromium. Dev-only tooling — the shipped
game is still a single self-contained HTML file with no build step.

## Run

```bash
cd tests
npm install
npx playwright install chromium   # one-time browser download
npm test
```

Exit code is `0` when everything passes, `1` on any failure (so CI / review
agents can gate on it).

## What it covers

The game loop runs on `requestAnimationFrame`, which throttles in hidden tabs,
so the harness **never relies on wall-clock time** — it drives the simulation by
calling `update(1/60)` in a loop (`window.__cdDrive`), exactly as `CLAUDE.md`
prescribes.

1. **Page load** — zero console errors; core functions and `GAME_VERSION` exist.
2. **Multi-wave run + draft** — clears several waves; a draft opens at wave 5 and
   a pick applies.
3. **Victory path** — a stacked board beats all 30 quick-mode waves → `winGame`.
4. **Defeat path** — no towers → lives hit 0 → `endGame`, GAME OVER overlay.
5. **Save / reload / resume** — autosave round-trips through a real page reload
   and `loadRun()` restores wave + towers.
6. **What's New panel** — opens, lists changelog entries, closes.

## Adding tests

`run-tests.mjs` installs an in-page driver (`INSTALL_DRIVER`) exposing:

- `__cdGodTowers(n)` — push `n` near-invincible towers so waves clear reliably.
- `__cdDrive({maxWave, cap})` — run the sim to a wave boundary or game end,
  auto-picking the first draft card. Returns `{wave, lives, gold, gameOver,
  victory, drafts, perks, hitCap}`.

Use the `check(name, cond, detail)` helper so new assertions show up in the
summary and affect the exit code. Add a test whenever you add new behavior.
