# Circuit Defense — Roadmap

Prioritized backlog for the auto-improver. Top of each section first. Check off
shipped items and move them to CHANGELOG.md. Add new ideas freely.

## Known bugs

_None currently known._ (Add any here as they're found — these are top priority.)

## Next up (high value)

- [x] **Achievements system** — shipped v1.5.0. 8 badges (First Victory, Flawless,
      No Mercy, Mountaineer L10, Conqueror L40, Endless w50, Megadamage 1M, Veteran
      25 runs), persisted in additive `meta.achievements`/`meta.stats`, with a 🏅
      start-screen panel and end-of-run unlock toasts. Follow-ups: *toast/sound when
      a badge unlocks mid-menu*, more badges (no-ability win, all-one-tower-type,
      speedrun), and a per-achievement chip reward.
- [ ] **Endless-mode leaderboard / personal bests panel** — show best wave per
      map+difficulty on the start screen (data already in `cd_best_*`).
- [ ] **New enemy type: "phantom"** — periodically dodges/blinks forward,
      punishing slow single-target towers. Introduce around wave 13+.
- [ ] **New tower: "arc/chain" or "mortar"** — a 7th/8th tower with a distinct
      role (chain-lightning bounce, or lobbed AoE that ignores armor).
- [ ] **Daily challenge seed** — a deterministic map+modifier set keyed off the
      date, with its own best-score key. (Offline-safe: derive from local date.)

## Content & variety

- [ ] **More wave modifiers** for Mayhem (fog/limited range, double-speed,
      armored surge, bounty boom).
- [ ] **A secret / easter-egg legendary perk** with a quirky effect (owner likes
      surprises).
- [ ] **Map: "crossroads"** — a path that forks and rejoins, or two simultaneous
      lanes.
- [ ] **Boss variety** — distinct boss behaviors per campaign tier (shielded,
      summoner, regenerator) instead of just scaled HP.
- [ ] **Tower spec pass** — audit the 2 specs per tower for one clearly-weaker
      option and buff it (justify with sim).

## Game feel / polish

- [ ] **Combo / kill-streak feedback** — escalating sound + particles for rapid
      kills; small score flourish.
- [ ] **Damage-number aggregation** — floaters can spam; merge nearby numbers.
- [ ] **Settings: particle density / screen-shake toggle** for lower-end devices
      (persist in localStorage).
- [ ] **Tower range preview on hover** in the shop (before placing).
- [ ] **Wave preview** — show the composition of the next wave (icons) so players
      can plan purchases.
- [ ] **What's New flush polish** — since v1.4.1 the panel butts against the
      `#gameCol` right edge, which is ~21px wider than the canvas (driven by the
      `.hint` margins). Minor cosmetic gap between the canvas and the panel; could
      tighten by constraining the column width to the canvas.

## Balance (simulate before/after, ≤25% per number per run)

- [ ] **Interest/economy curve review** — verify gold pacing across difficulties
      with the harness.
- [ ] **Late-campaign difficulty audit** (L30–40) — confirm it's hard but
      beatable with a maxed meta.

## Tech / tooling

- [ ] **GitHub Actions CI** running `tests/` on push (dev-only; never affects the
      shipped HTML).
- [ ] **Expand harness coverage** — abilities (meteor/freeze/rush), spec
      selection at level 5, mayhem path-shift on resume, campaign next-level flow.

## Vetoed by owner — do not re-add

_(Reverts / owner undo-commits land here with hash + one-liner. Never reintroduce
these or anything substantially similar without written owner request.)_

- None recorded yet. (Commit `4a66ba3` removed the **Scrapper** perk and cut rare
  draft chance to 14% — that was a routine balance commit by the maintainer, not
  an owner veto, but treat Scrapper's removal as intentional: don't re-add it
  without justification.)
