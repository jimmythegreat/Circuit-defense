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
- [x] **Endless-mode leaderboard / personal bests panel** — shipped v1.6.0. A
      🏆 Records start-screen panel shows highest wave per quick-mode map ×
      difficulty (new additive `cd_best_<map>_<diff>` keys), an "Any map" row from
      the legacy per-diff bests, plus campaign progress, lifetime damage, runs and
      chips. Follow-ups: *"new record!" flourish on the end-of-run screen when a
      cell is beaten*, and highlight the player's single all-time best in the grid.
- [x] **New enemy type: "phantom"** — shipped v1.9.0. Teal blinker from wave 13+;
      teleports 58px forward every ~2s and is intangible (untargetable + immune)
      for 0.35s mid-blink, punishing slow single-target towers. Frost/freeze pauses
      its blink clock. Render-translucent with a 👻 glyph + `SFX.blink` whoosh.
      Test group [14]. Follow-ups: *a phantom-heavy Mayhem wave modifier*, and a
      tower spec tuned to counter blinkers (e.g. predictive lead-shot).
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
- [~] **Tower spec pass** — audit the 2 specs per tower for one clearly-weaker
      option and buff it (justify with sim). v1.10.0 reworked the three the owner
      flagged (booster **Network** +10% power, cannon **Mega Blast** +15% dmg, plus
      a poison overhaul). Still to audit: sniper (Deadeye vs Executioner), frost
      (Deep Freeze vs Shatter), tesla (Superconductor vs Overcharge), gun (Minigun
      vs AP) — check none is strictly dominated.

## Game feel / polish

- [x] **Combo / kill-streak feedback** — shipped v1.7.0. Chaining kills within a
      2s window builds a top-right COMBO meter that glows hotter (green→gold→
      orange→red→purple); milestones (5, then every 10) fire a rising `SFX.combo`
      chirp + shake + particle burst + floater. Cosmetic only — no gold/save
      impact. Follow-ups: ✅ **best-combo stat on Records panel** + ✅ **"Combo
      Master" achievement (30× streak)** both shipped v1.8.0 (💥 9th badge + 🔥
      lifetime `meta.stats.bestCombo`). ✅ **Mid-streak "near miss" cue** shipped
      v1.10.0 — the bottom-right combo timer bar now blinks red in the last third
      of the 2s window. Remaining: *combo-gated board tint at huge streaks*.
- [x] **Combo meter layout bug** (owner-reported, FEEDBACK) — fixed across
      v1.8.3 → v1.8.5. The "COMBO" label sits beside the multiplier with the
      timer bar in its own lane (no bar-over-text). The persistent meter now
      lives in the **bottom-right corner** (`ax=W-16`, baseline `H-26`) — its own
      empty space, which also fixed the top-edge clipping ("9×"→"g×") seen at the
      old top-left spot. The `🔥 N× COMBO!` milestone pop is on the **center
      board** (`W/2,114/132`). (Path: top-right v1.7.0 → top-left v1.7.1 →
      relayout v1.8.3 → pop to center v1.8.4 → meter to bottom-right v1.8.5.)
      Render-only; Test 11 verifies bar-vs-label, on-canvas fit for 9×/100×, and
      the pop clearing both the top band and the corner meter.
- [x] **Tower menu position** — shipped v1.9.1 (owner FEEDBACK). The upgrade/sell
      panel no longer hovers at the clicked tower (where it covered combat); it's
      pinned to the lower-left corner, bottom-anchored. Test group [15]. Follow-up:
      *hide/dim the faint between-wave `Next:` preview while the panel is open* so
      the corner never double-stacks, and a small slide-in animation for game feel.
- [x] **Damage-number aggregation** — shipped v1.12.2. `addFloater()` takes an
      optional `{merge,value,prefix,suffix,radius}` group; nearby same-group floaters
      fold into one growing number. Applied to per-kill +gold and CRIT hits. Test [22].
- [x] **Settings: particle density / screen-shake toggle** — shipped v1.13.0. ⚙
      Settings start-screen panel: screen-shake On/Off (`cd_shake`) + particle effects
      Full/Reduced/Off (`cd_particles`), persisted, stacking with OS reduce-motion.
      Test [23]. (Volume slider lives in the same panel — see Table-stakes below.)
- [ ] **Tower range preview on hover** in the shop (before placing).
- [ ] **Idle start-screen sheen** — now that the chrome dims on the menu (v1.5.1),
      consider a subtle animated glow or pulse on the PLAY button to draw the eye
      to the one live surface, reinforcing the new focus.
- [ ] **Wave preview** — show the composition of the next wave (icons) so players
      can plan purchases.
- [ ] **What's New flush polish** — since v1.4.1 the panel butts against the
      `#gameCol` right edge, which is ~21px wider than the canvas (driven by the
      `.hint` margins). Minor cosmetic gap between the canvas and the panel; could
      tighten by constraining the column width to the canvas. (Height overhang was
      fixed separately in v1.5.2 — the panel now caps to the game's height.)
- [ ] **What's New "new since last visit" marker** — now that the panel caps to
      the game height (v1.5.2), highlight entries newer than the last-seen version
      (persist `cd_wnseen`) with a dot/badge so players notice fresh changelog
      items, and auto-scroll the list to the top on open.
- [x] **"New record!" end-of-run flourish** — shipped v1.6.1. Beating a quick-mode
      Records cell now fires a golden 🏆 banner (old→new wave delta), an `SFX.record`
      fanfare, and a shake/particle burst on the game-over/victory overlay. First-ever
      entries record silently; campaign never fires it. Follow-ups: *also highlight the
      beaten cell in the Records grid when it's next opened (persist a "last-beaten"
      marker)*, and a matching flourish for a new **campaign-level** record.

## Balance (simulate before/after, ≤25% per number per run)

- [~] **Overall difficulty too easy** (owner FEEDBACK, recurring) — being raised
      iteratively, ≤25%/run. Enemy HP multiplier (`enemyTemplate`): `1.2`→`1.44`
      (v1.9.2, +20%)→`1.80` (v1.10.0, +25% more). The owner still cleared campaign
      9/40 on hard with 2 frosts + a booster, so keep ratcheting: next candidate
      levers — another HP step, slower economy snowball (trim early interest/
      wave-clear bonus/bounty), the Frost/booster snowball item below, or stronger
      late bosses. Don't exceed 25% on any one number per run; simulate before/after.
- [ ] **Frost/booster damage snowball** (owner FEEDBACK, v1.10.0) — Shatter was cut
      ×6→×4.5, but the underlying multiplicative stack is still strong: a single L6
      **booster** aura is +75% (`buffPower` +0.1/level off a 0.25 base) and **Frost
      Mastery** adds +30%, all multiplying Shatter and Frostbite. Owner cleared
      campaign 9 on hard with just 2 frosts + 1 booster. Next candidate levers (≤25%
      each, sim first): taper booster per-level scaling (e.g. +0.08/level, or a soft
      cap), or trim Frost Mastery's per-rank dmg. Don't gut any single build.
- [ ] **Interest/economy curve review** — verify gold pacing across difficulties
      with the harness. Tie to the difficulty work above: the owner's "money from
      the first 10 rounds" line points at a front-loaded snowball — a modest cut to
      early interest cap / wave-clear bonus is the cleanest next economy lever.
- [ ] **Late-campaign difficulty audit** (L30–40) — confirm it's hard but
      beatable with a maxed meta.

## Table-stakes (polished-browser-game basics — audited v1.8.6 health check)

- [x] **Document metadata** — shipped v1.8.6. Favicon (inline SVG data URI,
      offline-safe), responsive `viewport` meta, meta description, `theme-color`,
      and Open Graph title/description/type. Head-only, zero gameplay impact.
- [ ] **Touch / pointer controls** — the whole game is mouse-click driven (tower
      placement, upgrade panel, ability targeting). On touch devices there are no
      handlers, so it's effectively unplayable on phones/tablets. Add
      `pointerdown`/`touchstart` paths (pointer events unify mouse+touch). The
      `viewport` meta is now in place (v1.8.6), so this is the next mobile blocker.
- [x] **`prefers-reduced-motion` support** — shipped v1.10.0. A `reduceMotion()`
      helper (`cd-core.js`, reads `matchMedia` live, guarded) gates the **screen-shake**
      translate in `draw()` **and** thins particle bursts in `addExplosion()`
      (count ×0.3, velocity ×0.5). OS "reduce motion" → no shake, no spray. The only
      remaining piece is an *in-game* toggle for users who want it without the OS flag
      — tracked separately under the "shake/particle toggle" settings item below.
- [ ] **Gamepad support** — `navigator.getGamepads()` polling for tower select /
      ability fire / cursor movement. Lower priority than touch.
- [ ] **Colorblind-safe palette option** — enemy kinds and combo tiers lean on
      hue (green/gold/orange/red/purple). Add a high-contrast / shape-coded mode.
- [ ] **PWA install (offline manifest)** — a `manifest.webmanifest` + minimal
      service worker so the game is installable and offline-cacheable when *hosted*
      (it's already offline via `file://`). No build step required. Note: a service
      worker does nothing on `file://`, so this only helps the hosted case.
- [ ] **Volume slider** — settings currently persist only mute (`cd_mute`). Add a
      0–100 volume level (scale the WebAudio gain), persisted in localStorage.

## Tech / tooling

- [x] **Split the single HTML file** — shipped v1.8.1. `tower-defense.html` →
      html + css (`tower-defense.css`) + js (`tower-defense.js`), classic
      `<link>`/`<script src>` tags (never ES modules). Zero behaviour change,
      87/0→97/0 green. Follow-up below.
- [x] **Domain-split `tower-defense.js`** — shipped v1.8.2. Sliced at section
      boundaries (no reordering) into seven ordered classic `<script src>` files
      (`cd-core`/`cd-maps`/`cd-defs`/`cd-state`/`cd-game`/`cd-update`/`cd-render`),
      each independently `'use strict'`. Concatenation proven byte-identical to the
      pre-split file; 112/0 green; double-click `file://` play re-verified.
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
