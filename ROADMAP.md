# Circuit Defense — Roadmap

Prioritized backlog for the auto-improver. Top of each section first. Check off
shipped items and move them to CHANGELOG.md. Add new ideas freely.

## Known bugs

_None currently known._ (Add any here as they're found — these are top priority.)

## Next up (high value)

- [x] **Mobile deep-dive #2 (FEEDBACK item #1, high priority)** — shipped **v1.15.0**.
      Addressed the two complaints measured at 390×844: **(1) What's New "behind the game"** —
      the rail now starts **collapsed on ≤920px** (new additive `cd_wnopen` key gates an
      explicit opt-in; `initWhatsNew()` guards on `matchMedia('(max-width:920px)')`, desktop
      unchanged), so it no longer dumps full-width below the board. **(2) Tiny board** — since
      the 900:560 board is *width-bound* in portrait (can't be taller there), a real
      `@media (max-width:920px) and (orientation:landscape)` block sizes the canvas off
      viewport **height** (`max-height: calc(100vh-150px)` + auto, aspect kept), compacts the
      chrome, and a portrait-only "↻ Rotate for a bigger board" hint (`#rotateHint`) nudges
      players. Board 374×233 → 433×270 on a 390-wide phone (bigger on larger devices), Start
      Wave stays on-screen. Test [30]. **Follow-up remaining:** in-game **touch ergonomics**
      (bigger tap targets, `pointerdown`/`touchstart` for placement/upgrade/ability targeting) —
      still mouse-click paths; tracked under "Touch / pointer controls" below.
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

- [x] **Per-map visual themes** — shipped v1.13.8 (owner FEEDBACK "all the maps look the
      same"). `THEMES` palette table in `cd-maps.js` drives the background, stars, grid and
      path layers in `draw()`. Classic=blue circuit, Spiral=emerald, Serpent=amber (fixed);
      Campaign rolls a tame palette per attempt; Mayhem uses an animated fiery `chaos`
      palette (static under reduce-motion). Theme key saved/restored for resume parity.
      Test [28]. Follow-ups: *actual ground textures/patterns* (currently solid-colour path
      fills), and *per-theme star density / parallax* for more visual identity.
- [ ] **More wave modifiers** for Mayhem (fog/limited range, double-speed,
      armored surge, bounty boom).
- [x] **A secret / easter-egg legendary perk** — shipped **v1.22.0**: 🩸 **Last Stand**,
      a comeback perk that gives ALL towers +3% damage per life lost this run (cap +60% at
      20 lives lost). Deliberately conditional — a flawless run gets +0%, so it can't make an
      already-easy run easier (respects the "too easy" feedback); it's a pure rubber-band for
      a near-loss. `lastStand`/`livesLost` live in `perkState` (save-safe via `freshPerkState()`);
      counter incremented at the leak site in `cd-update.js`; `effDmg()` applies the multiplier.
      Test [41]. Follow-up: *more quirky legendaries* (e.g. a true random "Wildcard", or a
      glass-cannon trade-off), and maybe a hidden unlock condition for a secret one.
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

- [x] **End-of-run score + restyled victory/defeat screen** — shipped v1.16.0 (owner
      FEEDBACK, two low-priority items done together: a *scoring system* + *"victory screen
      … overwhelming, restyle it"*). `computeScore()`/`scoreGrade()` (`cd-update.js`) score each
      run on distance (waves + campaign depth), cleanliness (lives kept, big combos, **fewer
      towers** → up to +30%) and **gold banked**, scaled by difficulty; grade F→S (S = flawless
      win). All-time best in additive `cd_bestscore` with a ★ celebration. `renderEndScreen()`
      replaces the run-on `#ovText` blob with a score hero + stats grid + MVP/perks/ach sections.
      Test [31]. **Follow-ups:** *show the best score on the 🏆 Records panel* (a `cd_bestscore`
      row in `.bestStats`); *per-map or per-difficulty best scores*; *a score breakdown tooltip*
      (each term's contribution); and *a "new high score" leaderboard-style flash* distinct from
      the existing wave-record banner.
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
- [x] **Tower range preview on hover** in the shop — shipped v1.13.1. Hovering a shop
      button draws a dashed range ring + label at board centre (`hoveredShop`); tooltips
      show the range number. (Placement preview still follows the cursor once selected.)
      Test [24].
- [ ] **Idle start-screen sheen** — now that the chrome dims on the menu (v1.5.1),
      consider a subtle animated glow or pulse on the PLAY button to draw the eye
      to the one live surface, reinforcing the new focus.
- [x] **Wave preview** — shipped **v1.21.0**. The between-waves bottom-left `Next:` line
      now shows an **icon roster** — a colour disc (+ the same `enemyGlyph()` symbol the
      sphere uses) and `×count` per enemy kind, boss appended on every 5th wave — instead of
      a text kind-list, so you can see counts at a glance and plan purchases. `waveComposition(w)`
      (cd-game.js, replaces `waveDesc`) is a deterministic tally that mirrors `buildWave()`;
      `PREVIEW_COLOR` (cd-render.js) holds the per-kind disc colours. Render + one helper only;
      no gameplay/economy/save impact. Test [40]. Follow-up: *also surface the next wave's total
      HP / threat number*, and *a per-kind hover tooltip* on the preview.
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
      iteratively, ≤25%/run. Enemy HP: global multiplier `1.2`→`1.44` (v1.9.2)→`1.80`
      (v1.10.0) were uniform up-shifts; v1.13.3 added a `1.25` coeff on the `w^1.9`
      term to **steepen the curve** (owner: early game now hard but plateaus after
      ~w10) — boost grows with wave, asymptotes <25%. After a fresh-save reset the
      early game now feels right; the plateau was the gap. Next candidate levers if
      still too easy late — another `w^1.9`-coeff step (toward ~1.55 over a couple
      runs), slower economy snowball (trim early interest/wave-clear bonus/bounty),
      the Frost/booster snowball item below, or stronger late bosses (`14 + w*0.5`
      → `+w*0.6`, bounded +20%). Simulate before/after; ≤25% per number per run.
- [~] **Frost/booster damage snowball** (owner FEEDBACK, v1.10.0) — Shatter was cut
      ×6→×4.5, but the underlying multiplicative stack is still strong: a single
      **booster** aura was +75% at L6 (`buffPower` +0.1/level off a 0.25 base) and
      **Frost Mastery** adds +30%, all multiplying Shatter and Frostbite. Owner cleared
      campaign 9 on hard with just 2 frosts + 1 booster (and campaign 6 with a single
      gunner + maxed booster). **v1.16.2 took the booster slice:** tapered the per-level
      scaling **+0.1 → +0.08** (base/L1 unchanged; maxed booster +75%→+65%, ~−6% buffed-
      tower dmg at L6 — sim: gunner 14.0→13.2). Test [33]. **v1.20.1 also cut the aura
      *range*** 90→68 (FEEDBACK slice 1, −43% coverage area) — a single booster now reaches
      fewer towers, which hits the solo-carry from the coverage side (Test [39]; more range
      cuts queued in FEEDBACK toward the owner's −50%). **Remaining power levers** (≤25%
      each, sim first): trim **Frost Mastery**'s per-rank dmg, or add a **booster aura
      soft-cap** if a single super-booster still solo-carries. Don't gut any single build.
- [~] **Interest/economy curve review** — verify gold pacing across difficulties
      with the harness. Tie to the difficulty work above: the owner's "money from
      the first 10 rounds" line points at a front-loaded snowball. **v1.16.1 took the
      first slice** (measured via god-tower sim: kills = ~69% of early income): trimmed
      per-kill bounty `(4+w*0.6)→(3+w*0.6)` and the wave-clear bonus `(25+w*5)→(20+w*4)`,
      cutting the 10-wave war chest ~13% (front-loaded, ≤20%/number). **Next levers if
      still too rich:** trim the early interest cap (30→~25) or start gold (normal 120→100),
      or another bounty/bonus step — each ≤25%, sim before/after. Test [32].
- [ ] **Late-campaign difficulty audit** (L30–40) — confirm it's hard but
      beatable with a maxed meta.

## Table-stakes (polished-browser-game basics — re-audited v1.20.2 health check)

_Still-unaddressed, in priority order: **gamepad** → PWA install → **bigger HTML tap targets on small phones**.
Done: **draft keyboard a11y (v1.20.0)** — the mid-game perk picker's cards are now focusable
(`role=button`/`tabIndex`), Enter/Space-pickable, Tab-trapped (`_topTrapPanel()` returns `#draftModal`)
and Esc-exempt; `:focus-visible` lift + `role=dialog` on the modal — closing the last mouse-only-menu gap.
**menu keyboard a11y (v1.19.0)** — Esc-close + focus trap/restore + `:focus-visible` rings +
`role=dialog`/`aria-modal` on the start-screen panels (`A11Y_PANELS`/`focusPanel()` in `cd-core.js`),
**colorblind aid / shape-coded enemies (v1.18.0)**, document metadata (v1.8.6),
reduced-motion (v1.10.0), volume slider (v1.13.2),
**responsive layout (v1.14.0)**, **mobile board sizing + What's New default-collapse (v1.15.0)**,
**touch/pointer controls (v1.16.3)** — canvas board interaction (place/select/aim) is now
`pointerdown`-driven with a touch-generous tap radius + `touch-action:none` — and **high-DPI
canvas scaling (v1.17.0)** — the backing store now scales with `devicePixelRatio` (capped 2×) so
the board is crisp on Retina/4K/scaled displays. v1.14.1 visual pass confirmed desktop & phone
menus all render correctly. **Next normal run's strongest table-stakes pick: gamepad support**, then
PWA install (offline manifest, hosted-only). (Keyboard a11y is now complete — start-screen menus
v1.19.0 + the mid-game draft cards v1.20.0.)_


- [x] **Document metadata** — shipped v1.8.6. Favicon (inline SVG data URI,
      offline-safe), responsive `viewport` meta, meta description, `theme-color`,
      and Open Graph title/description/type. Head-only, zero gameplay impact.
- [x] **Touch / pointer controls** — _responsive **layout** done v1.14.0; **board sizing +
      landscape pass** done v1.15.0; **in-game interaction** done **v1.16.3**_. The canvas board
      handler moved from `click` → **`pointerdown`** (`coarsePointer()` helper in `cd-core.js`,
      primary-button guard), unifying mouse + touch and dropping the synthesized-click latency;
      the tower-select radius is **30px on a finger** (18px on a mouse — 30 < the 32px placement
      gap so it can't mis-grab), and `touch-action:none` stops board taps scrolling/zooming the
      page. Test [34]. **Follow-up (optional):** bigger HTML tap targets for the shop / upgrade
      buttons on small phones — currently sized by the v1.14.0/v1.15.0 mobile CSS, fine but could
      be chunkier.
- [x] **`prefers-reduced-motion` support** — shipped v1.10.0. A `reduceMotion()`
      helper (`cd-core.js`, reads `matchMedia` live, guarded) gates the **screen-shake**
      translate in `draw()` **and** thins particle bursts in `addExplosion()`
      (count ×0.3, velocity ×0.5). OS "reduce motion" → no shake, no spray. The only
      remaining piece is an *in-game* toggle for users who want it without the OS flag
      — tracked separately under the "shake/particle toggle" settings item below.
- [ ] **Gamepad support** — `navigator.getGamepads()` polling for tower select /
      ability fire / cursor movement. Lower priority than touch.
- [x] **Colorblind-safe palette option** — shipped **v1.18.0**. A ♿ Colorblind aid
      toggle in ⚙ Settings (`cd_colorblind`, default off) shape-codes the two enemy
      kinds that were hue-only (`fast`→`»`, `tank`→`◆`); the rest already carried
      glyphs (`+`/`🛡`/`✂`/`👻`/`☠`/`❄`), so every kind now reads as a unique symbol.
      `enemyGlyph()` helper in `cd-render.js` is the single source of truth (byte-
      identical rendering with the aid off). Test [36]. **Follow-ups:** *combo-tier
      shape/label* (the meter already shows the `N×` number so it's readable, but the
      colour ramp green→purple is still hue-only), and a *high-contrast path/grid mode*.
- [ ] **PWA install (offline manifest)** — a `manifest.webmanifest` + minimal
      service worker so the game is installable and offline-cacheable when *hosted*
      (it's already offline via `file://`). No build step required. Note: a service
      worker does nothing on `file://`, so this only helps the hosted case.
- [x] **Volume slider** — shipped v1.13.2. 0–100 master Volume in the ⚙ Settings panel;
      all audio routes through a master GainNode (`masterGain()`), `setVolume()` scales it
      and persists `cd_vol` (default 0.7). Independent of mute. Test [25].
- [x] **High-DPI (devicePixelRatio) canvas scaling** — shipped **v1.17.0**. `cd-core.js`
      captures logical `W`/`H` (900×560) from the canvas attributes *before* resizing, then
      `DPR = clamp(devicePixelRatio,1,2)` and `if (DPR>1) { cv.width=W·DPR; cv.height=H·DPR;
      ctx.scale(DPR,DPR) }` once at load — the scale persists (draw() never resets the transform).
      CSS `canvas { width:900px }` pins the displayed box to logical size so the bigger backing
      store doesn't enlarge the canvas (`height:auto` keeps the ratio; landscape `#game{width:auto}`
      overrides). Input derives from `getBoundingClientRect()` so it stays correct; dpr=1 skips the
      block entirely (byte-identical on standard displays + headless tests). Test [35]. Follow-up:
      *re-render-on-dpr-change* if a window is dragged between monitors of different scale (rare;
      the page would need a reload today).
- [x] **Menu / panel keyboard accessibility** — shipped **v1.19.0**. The start-screen panels
      (Talents, Achievements, Records, Settings, What's New) are now keyboard-navigable: Esc closes
      the open panel (modal-over-rail priority), opening one moves focus inside it and Tab is trapped
      (wraps both ways), closing restores focus to the opener, a `:focus-visible` ring shows for
      keyboard users, and the four modal panels carry `role=dialog`/`aria-modal`. `A11Y_PANELS` +
      `focusPanel()`/`_topAnyPanel()`/`_topTrapPanel()` + a document `keydown` listener in
      `cd-core.js`; `focusPanel(id)` called from each `open*()`. Panel-open is keyed off
      `getComputedStyle().display` (not `offsetParent`, which is null for the fixed mobile panels).
      Test [37]. **Follow-up done v1.20.0:** the mid-game **draft cards** are now keyboard-focusable
      (`role=button`/`tabIndex`), Enter/Space-pickable and Tab-trapped (`_topTrapPanel()` returns
      `#draftModal`); Esc stays disabled there since a pick is required. Test [38].

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
- [ ] **Audit tests for draft-RNG flakiness** — the harness auto-picks draft card
      `[0]`, and drafts are random, so any test that asserts a numeric bound on gold/dmg
      *after* a draft can flake when a gold/power perk lands in slot 0. v1.20.2 fixed the
      one in group [32] (Economy trim) by asserting the deterministic **pre-draft** economy
      instead. Sweep the other run-driving groups for the same pattern and pin them to
      pre-draft / perk-neutral measurements where a tight bound is asserted.

## Vetoed by owner — do not re-add

_(Reverts / owner undo-commits land here with hash + one-liner. Never reintroduce
these or anything substantially similar without written owner request.)_

- None recorded yet. (Commit `4a66ba3` removed the **Scrapper** perk and cut rare
  draft chance to 14% — that was a routine balance commit by the maintainer, not
  an owner veto, but treat Scrapper's removal as intentional: don't re-add it
  without justification.)

## Prompt suggestions for the owner

_(The routine forbids the agent from editing its own scheduled-task instruction file,
so process-change requests land here for the owner to paste in.)_

- **Make visual verification a permanent health-check step (your FEEDBACK request,
  addressed ad-hoc in v1.14.1).** You asked the health check to confirm the game *looks
  right and is playable* on both large displays and phones, not just via tests. The agent
  performed this in the v1.14.1 health check but can't durably codify it (editing the
  scheduled-task SKILL.md is blocked). To make it permanent, add a step **5** to the
  "Health check run" section of `circuit-defense-auto-improver/SKILL.md`, e.g.:

  > 5. **Visual verification** — tests aren't enough; confirm the game *looks right and is
  >    playable* on **both a large display (≥1280px) and a phone (≤430px)** using the
  >    preview tools. Note `preview_screenshot` times out on this game (the rAF loop keeps
  >    the page busy; suspending rAF doesn't help), so verify layout with `preview_inspect`
  >    bounding-box / computed-style reads + `preview_eval` instead. At each size assert:
  >    no horizontal page overflow; every menu (talents/achievements/records/settings/start/
  >    overlay/draft) opens on-screen and scrolls; What's New sits where intended; and an
  >    in-game quick run shows canvas + HUD + shop + controls within the viewport with a
  >    board that isn't uselessly tiny. File precise px measurements to ROADMAP for anything
  >    wrong; clean up test state afterwards.
