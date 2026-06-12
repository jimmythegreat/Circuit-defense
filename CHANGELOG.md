# Changelog

All notable changes to Circuit Defense. Newest first. Versions are semver-ish:
patch = fixes/balance, minor = features/content.

## v1.14.0 — 2026-06-11

**Responsive layout — the game is now usable on phones & tablets (FEEDBACK, important).**
Owner: *"This game looks terrible on phones. Pick various popular screen sizes and make it
work on those."*

The root problem: there were **zero media queries**. The canvas itself already scaled
(`max-width:100vw`), but every modal overlay (`#startScreen`, game-over `#overlay`,
`#draftModal`, talents, achievements, records, settings) was absolutely positioned **inside
the scaled, canvas-sized `#gameWrap`** — so on a 390px phone they crammed into a ~230px box
and their content overflowed with no way to scroll to it. Measured on a 390px viewport:
the start-screen action-button row was **826px wide** (running ~225px off the left and off
the right edge), and the menu content spilled out the bottom of an unscrollable box.

Added a responsive block to `tower-defense.css` (CSS-only — no markup or JS change, so it's
fully save-safe and desktop is byte-identical behaviour):

- **`@media (max-width: 920px)`** — chosen because the 900px-wide canvas starts scaling down
  below ~916px, which is exactly when the in-canvas overlays begin to cram; this also covers
  iPad-portrait tablets (768 / 810 / 834). All modal overlays detach to a **fixed,
  full-viewport, vertically-scrollable** layer (`position:fixed; inset:0; overflow-y:auto`),
  so their content is always reachable. Button rows (`#startScreen`, `#overlay`) get
  `flex-wrap`; the inline 17px/11-36px start-screen button sizing is neutralised so eight
  buttons fit a narrow column. Talent/achievement grids reflow **4→2 columns** with
  cell-filling cards and the whole panel scrolls (no nested scroller). Draft cards wrap;
  the What's New rail goes full-width below the game.
- **`@media (max-width: 430px)`** — phones: HUD/shop tighten further, tower buttons flex to
  fill, grids go **single-column**, draft cards stack vertically.

Verified live at 360 / 375 / 390 / 768px: **no horizontal overflow** in any state
(`scrollWidth === innerWidth`), start/talent/records/settings/draft panels all full-width
fixed and scrollable, in-game canvas/HUD/shop/controls within the viewport, zero console
errors. New test group **[29]** drives a real 390px Playwright viewport (overlays fixed +
scrollable, no horizontal overflow on the start screen / with talents open / in-game / with
a draft open, chrome inside the viewport) and asserts desktop (1280px) keeps overlays
canvas-bound (`position:absolute`) so the media block can't leak to desktop.

**First coherent slice** of the mobile request (layout & reachability). Remaining follow-up
(tracked under the "Touch / pointer controls" ROADMAP item, now marked partial): in-game
**touch ergonomics** — bigger touch targets, tap-to-place tuning, and a landscape pass.

## v1.13.8 — 2026-06-11

**Per-map visual themes — the maps no longer all look the same (FEEDBACK).**
Owner: *"All the maps look the same. We should add random colors and textures to them.
In classic mode it should always pick the same theme. In mayhem it should be wild (things
on fire, wild colors, etc). In campaign mode it should be random but not crazy like mayhem.
Also Mayhem should be a random map every time."*

- New `THEMES` palette table + `mapPalette()`/`pickMapTheme()` in `cd-maps.js`. A palette
  drives the **background gradient, starfield colour, grid, and all path bevel/glow/dash
  layers** in `draw()` (previously hardcoded blue). Each named quick-map gets a **fixed
  identity**: Classic → `circuit` (the canonical blue), Spiral → `verdant` (emerald),
  Serpent → `ember` (amber). **Campaign** rolls a tame palette per attempt from
  `CAMPAIGN_THEMES` (circuit/verdant/ember/violet/ice — always a valid static theme, never
  chaos). **Mayhem** uses an **animated `chaos` palette** whose hue sweeps for a "world on
  fire" feel — and collapses to a static fiery palette under OS reduce-motion.
- **"Mayhem random map every time"** was already satisfied — `resetState()` regenerates
  `MAPS.mayhem.pts` on every `beginGame()` — so this run focuses on the visual distinction
  the request was really about. Verified mayhem still re-rolls its path each run.
- **Save-safe:** the resolved theme key is stored in `cd_save` (`mapTheme`) and restored in
  `loadRun()` so a resumed run (esp. campaign, which rolls randomly) keeps the colours it
  started with. Old saves lack the field → `resetState()`'s `pickMapTheme()` default covers
  them. Purely cosmetic — zero gameplay/economy impact. Picking a map on the start screen
  now also previews its theme live.

New test group **[28]**: each named map resolves to a distinct theme, classic is
deterministic across runs, mayhem = `chaos`, campaign always rolls a tame (non-chaos)
palette over 12 rolls, `mapPalette()` yields full palettes for both static + chaos, `draw()`
renders cleanly under the animated chaos palette, and save→resume restores the palette key.
Suite green.

## v1.13.7 — 2026-06-11

**What's New entries now show the time alongside the date (FEEDBACK, high priority).**
Owner: *"You should list the time as well as the date for the whats new."*

- `CHANGELOG_ENTRIES` (`cd-core.js`) entries gained an optional `time` field. `renderWnList()`
  now renders `${date} · ${time}` when a `time` is present, falling back to just the date
  otherwise — so the same-day flood of updates can be ordered at a glance.
- New entries are timestamped going forward (this one: `18:51 EDT`). Historical entries have
  no recorded wall-clock time, so they keep showing date only rather than fabricating one.
  Display-data only — no gameplay/save/economy impact.
- **Convention note added to CLAUDE.md:** every new `CHANGELOG_ENTRIES` entry should carry a
  `time` field (local time, e.g. `'18:51 EDT'`).

New test group **[27]**: the newest entry has a `time`, its rendered date cell shows both
date and time, an older timeless entry still shows just its date, and no `undefined` leaks
into the cell. Suite green.

## v1.13.6 — 2026-06-11

**Panel-toggle fixes + difficulty rebalance for fresh runs (FEEDBACK).** Three owner
requests in one commit (coordinated alongside a concurrent edit, so this touches only
`cd-maps.js`/`cd-game.js`/`cd-update.js`/`tower-defense.html` plus the version/changelog).

- **What's New button now toggles.** It only ever opened the panel; owner: *"What's New
  button should close What's New if it's open."* New `toggleWhatsNew()` (in `cd-game.js`,
  kept out of the concurrently-edited `cd-core.js`) closes the panel when it's showing,
  opens it otherwise. The start-screen ✨ button calls it.
- **Settings button toggles too.** Owner: *"Settings button doesn't open when clicked."*
  The handler is correct (verified the panel opens via the real click handler, z-index
  20 above the start screen) — couldn't reproduce a hard failure, most likely a stale
  cached build. Made the ⚙ button a clean `toggleSettings()` (open if closed, close if
  open), which is robust against any open-then-reclick edge and matches What's New.
  `openSettings()` also now guards a missing panel element.
- **Difficulty rebalanced (owner failed wave 5 of classic-normal on a fresh, no-talent
  save).** `DIFFS` (`cd-maps.js`): **Easy** made *very* easy — `hp 0.8 → 0.6` (−25%),
  `lives 30 → 36`, `gold 160 → 190`; **Normal** eased a touch — `hp 1.0 → 0.85` (−15%),
  `lives 20 → 22`. Hard untouched. Each number ≤25% swing. This reduces HP at *all* waves
  uniformly (it's the `d.hp` multiplier), so it dials back the fresh-player early wall
  while the v1.13.3 late-wave steepening still applies on top. Difficulty stays ordered
  easy < normal < hard. (`enemyTemplate` reads `DIFFS[diffKey].hp` live — no save impact.)

New test group **[26]**: the rebalanced values, the easy<normal<hard ordering, and both
button toggles (open→close→open / open+render→close). Suite green.

## v1.13.5 — 2026-06-11

**What's New shows the full history again (owner request — reverses a v1.13.4 cleanup).**
The v1.13.4 health check had trimmed the in-game `CHANGELOG_ENTRIES` list to the 10 most-
recent entries (citing the old "keep ~10" comment). The owner prefers the panel show
**every** past update — it scrolls, so length isn't a problem.

- Restored all previously-removed entries (v1.9.2 … v1.1.0) verbatim from git, prepended a
  v1.13.5 entry, and changed the array comment from "keep ~10" to "show the FULL history".
- Recorded the preference in **CLAUDE.md** so future routine runs never re-trim it: the
  What's New panel must show every past update; keep prepending, never prune, unless the
  owner asks in writing.
- Display-data only — no gameplay/save/economy impact. Tests stay green.

## v1.13.4 — 2026-06-11

**🩺 Health check** (every-6th-run maintenance pass; resets the 5-run counter). 12
version entries had accumulated since the last health check (v1.8.6), so this run ships
no feature — it confirms the project is still pointed in the right direction.

- **Integrity spot-checks — all green:**
  - Full test suite **200 passed / 0 failed**, zero console errors (run by a subagent).
  - `file://` double-click playability re-verified: 7 classic `<script src>` files in
    dependency order (NEVER `type="module"`), inline SVG favicon, all paths relative,
    no CDN/network at runtime.
  - Old-format save migration: a minimal `cd_meta` (only `chips`+`talents`) loads via
    `loadMeta()` with `achievements`/`stats`/`bestCombo` defaulted in; chips & talents
    preserved. A minimal `cd_save` (no `lastSettledWave`) is resumable. (Tested in-page,
    real data backed up & restored.)
- **Docs coherence pass:** every formula in CLAUDE.md re-checked against the code and
  found accurate — `enemyTemplate` HP `(18 + w*7 + 1.25*w^1.9) * 1.80 * d.hp * campScale`,
  `victoryWave()` = `14 + campLevel` (campaign) / 30 (quick), campaign HP scale
  `1 + (campLevel-1)*0.04`, poison base dmg 7, `MAX_CONCURRENT_WAVES = 3`, the
  `masterGain()`/`cd_vol` audio routing, and the `loadMeta()` migration defaults. CHANGELOG
  versions are consistent with `GAME_VERSION`. No drift found in the architecture map.
- **Refactor audit:** all 9 game files comfortably within the ~1500-line cap (largest is
  `cd-update.js` at 580). No dead code, no leftover `console.`/`debugger` in shipped
  files, no duplicated logic spotted. No `[refactor]` split needed this run.
- **Small cleanup (doc-rot):** the in-game What's New list (`CHANGELOG_ENTRIES` in
  `cd-core.js`) had grown to ~30 entries despite the documented "keep ~10" intent;
  trimmed back to the 10 most-recent (full history stays here in CHANGELOG.md). Verified
  in-preview: panel renders 10 entries, `verTag` reads v1.13.4, zero console errors.
- **Table-stakes audit refreshed** — still-unaddressed gaps re-noted on ROADMAP, ordered:
  **touch/pointer controls** (top mobile blocker), colorblind-safe palette, gamepad,
  PWA install. Added two newly-spotted gaps: **high-DPI (devicePixelRatio) canvas scaling**
  and **menu/panel keyboard accessibility** (start-screen panels are mouse-only).

Version bumped v1.13.3 → **v1.13.4** (patch — maintenance only, no gameplay change).

## v1.13.3 — 2026-06-11

**Difficulty curve steepened — harder *per wave* at higher waves (FEEDBACK / balance).**
Owner (after resetting their save): *"the game is much harder but only for about the
first 10 levels of classic normal. I think we need to increase the difficulty per wave
more."*

- **Root cause:** every prior difficulty step (1.2→1.44→1.80) was a *uniform* multiplier
  — it shifts the whole HP curve up but doesn't change its **shape**, so the per-wave
  ramp plateaued exactly as the owner described.
- **Fix:** the superlinear term in `enemyTemplate()` (`cd-game.js`) goes
  `w^1.9` → **`1.25 * w^1.9`**. Because that term is negligible early and dominant late,
  the boost *grows with wave*: ~+1% at w1, +7% at w5, +12% at w10, +16% at w20, +18% at
  w30, +21% at w50, +23.6% at w200 — asymptoting toward **+25% but never reaching it**
  (the ratio's supremum as w→∞ is exactly 1.25, strictly never attained). So the strong
  early game the owner just praised is barely touched, while later waves get
  progressively harder and each wave-to-wave jump is bigger.
- **Guardrail:** scaling one term by a bounded ≤1.25 coefficient keeps the HP swing
  under 25% at *every* wave incl. deep endless — unlike an exponent bump, which would be
  unbounded. Simulated before/after across waves 1–200 (boost monotonically increasing:
  +1% → +24% over w1→w200, supremum 1.25 never reached). Bosses/tanks scale off the same template, so they steepen too.
- **No save/economy/theme impact** — HP is computed live from the formula; nothing
  persisted. Test group **[16]** updated to assert the steepened formula, that the boost
  grows with wave, and that it stays ≤25% at every sampled wave.

## v1.13.2 — 2026-06-11

**Volume slider (ROADMAP table-stakes).** Settings persisted only mute (`cd_mute`)
on/off. Added a 0–100 master **Volume** slider to the ⚙ Settings panel. All audio now
routes through a single master `GainNode` (`masterGain()` in `cd-core.js`) — `tone()`
and `noise()` connect to it instead of `a.destination` — and `setVolume(pct)` scales its
gain and persists `cd_vol` (0..1, default 0.7). The slider's `oninput` updates the live
gain + `%` label without re-rendering (smooth dragging); `onchange` plays a sample tone
at the new level. Independent of mute (mute still hard-skips all sound). `resetAllData()`
restores the default. Additive key, safe default — old saves unaffected. New test group
**[25]** verifies the gain routing, persistence, and 0/30/100 scaling.

## v1.13.1 — 2026-06-11

**Tower range preview on shop hover (ROADMAP polish).** The board already showed a
range ring once a tower was *selected* (placement preview follows the cursor). The gap
was previewing range *before* picking one. Now hovering a shop button sets `hoveredShop`
(via `onpointerenter`/`onpointerleave` on each button) and `draw()` renders a dashed
range ring + label (`icon name · range N`) at board centre while `hoveredShop && !
selectedShop`, in the tower's colour. The shop button `title` tooltips also now include
the range number. Render/DOM-only — no gameplay or save impact. New test group **[24]**
asserts the hover handlers set/clear `hoveredShop`, the title shows the range, and
`draw()` renders cleanly with a hover active.

## v1.13.0 — 2026-06-11

**Settings panel: screen-shake & particle-density controls (ROADMAP table-stakes).**
A new ⚙ **Settings** start-screen button opens `#settingsPanel` (mirrors the
Achievements/Records modals). Two prefs, persisted on the device and independent of the
OS reduce-motion gate:
- **Screen shake** On/Off (`cd_shake`) — gates the shake translate in `draw()`
  (`shake > 0 && shakeEnabled && !reduceMotion()`).
- **Particle effects** Full / Reduced / Off (`cd_particles` = 1 / 0.5 / 0) — scales
  burst counts in `addExplosion()` (`n = round(n * particleDensity)`, Off → no
  particles). Reduce-motion still thins further on top.

`openSettings`/`closeSettings`/`renderSettings` + `setShake`/`setParticles` setters
(`cd-update.js`); globals `shakeEnabled`/`particleDensity` read at load in `cd-core.js`.
The panel notes when the OS reduce-motion flag is active. `resetAllData()` restores both
to defaults. Additive localStorage keys (safe defaults; old saves unaffected). New test
group **[23]** verifies the toggles persist and scale particles Full/Reduced/Off.

## v1.12.2 — 2026-06-11

**Damage-number aggregation (ROADMAP polish).** Floaters spammed during mass-kill
moments (splash, meteor, big combos) — a dozen overlapping `+gold` and `CRIT` numbers.
`addFloater()` (`cd-game.js`) now takes an optional `{merge, value, prefix, suffix,
radius}` group: a tagged floater folds into a nearby recent one of the same group
instead of spawning a fresh number — the `value`s sum and the text/position/life
refresh. Applied to the two spammiest sources: the per-kill **+gold bounty**
(`merge:'gold'`, radius 36) and **CRIT** hits (`merge:'crit'`, radius 28). So a burst
reads as one growing `+25` / `CRIT 80!` instead of confetti; distant kills still get
their own number. Untagged `addFloater` calls are unchanged. Render-only, no economy
impact (gold is still awarded per kill; only the *display* merges). New test group
**[22]** verifies clustered pops merge (summed) while distant ones stay separate.

## v1.12.1 — 2026-06-11

**Hover tooltips for milestone bonuses (FEEDBACK).** Owner: *"milestone bonuses should
have a mouse hover that lets you know what they do."* The "milestone bonuses" are the
run-perks drafted every 5 waves, shown as a row of icons in the top-left of the board
(`cd-render.js`). They're canvas-drawn, so a DOM `title` won't work — instead the render
loop now detects when `mouseX/mouseY` is over a perk icon and draws a `drawPerkTooltip()`
box: the perk's name in its rarity colour, the rarity label, and its description. The
description is looked up from `PERKS` by id (not stored on the saved perk), so it works
for resumed/old runs too. Render-only, no save/economy impact. New test group **[21]**
asserts the description lookup resolves and the hover-index math picks the right perk.

## v1.12.0 — 2026-06-11

**Concurrent waves: start a new wave while one is running (FEEDBACK).** Owner: *"I
should be able to start a new wave even if the current wave is going. This would let me
spawn more than one wave AT THE SAME TIME."*

- **Parallel spawners.** The single `spawnQueue`/`spawnTimer` became an array of
  `spawners` (`{queue, timer}`), one per in-flight wave, each ticking independently in
  `update()` — so multiple waves spawn *simultaneously*, not back-to-back. `startWave()`
  no longer bails when `waveActive`; it pushes a new spawner and bumps `wave`. The Start
  button reads **➕ Add Wave N+1** while a wave runs (Spacebar works too).
- **Capped at 3 unsettled waves** (`MAX_CONCURRENT_WAVES`) so mashing Space can't stack
  endlessly or tank performance; the button shows `🌊 Wave N…` (disabled) at the cap.
- **Bundled settlement keeps the economy & drafts whole.** `endWave()` fires only when
  the field fully clears (no spawners/enemies/pendingSpawns) and then settles *every*
  wave from `lastSettledWave+1..wave`: it sums each wave's clear bonus + interest and
  pays them all, and queues a draft for **each** multiple-of-5 crossed (`pendingDrafts`,
  chained through `pickPerk`). So a rush never loses a clear bonus or a boss-wave perk —
  it just faces everything at once. Drafts always open on an empty field (clean).
- **Save-safe.** Spawn state was never persisted. `saveRun()` now stores
  `lastSettledWave` (not `wave-1`) when active, so quitting mid-rush resumes by replaying
  the unsettled waves — never double-paying. `loadRun()` syncs `lastSettledWave = wave`.
- New test group **[20]**: 3 parallel spawners start at once, the 4th is capped, the
  field settles all bundled waves, a rush across wave 5 defers exactly one draft, and a
  mid-rush save resumes at the last settled boundary. Full suite green.

## v1.11.0 — 2026-06-11

**Reset feature: wipe all data and start fresh (FEEDBACK).** Owner: *"A reset feature
that deletes everything and you start new."* Added a 🗑 **Reset All** button to the
start screen. `resetAllData()` (`cd-state.js`) removes every `cd_`-prefixed localStorage
key (save, meta/chips/talents/achievements, campaign, all per-map/per-diff records,
mute, speed, What's-New-closed) — iterating `localStorage` so it also catches future
keys and never touches other sites' data — then resets the in-memory `meta`, `speed`,
`best`, and `muted` to factory defaults and returns to a clean menu via `backToMenu()`.
Two-click confirm (mirrors `quitRun`): the first click arms the button (red `.danger`
pulse, "Erase ALL — click again"), a second click within 3s commits; otherwise it
disarms. New test group **[19]**. Pure additive — no schema change, can't corrupt
existing saves (it only deletes).

## v1.10.0 — 2026-06-11

**Spec rework + poison buff (FEEDBACK / balance) bundled with two polish wins.**
Owner asked to batch several smaller items this run. The mandated centerpiece is the
top FEEDBACK item (a `[balance]` spec/poison complaint); two low-risk polish items
ride along.

**1. FEEDBACK #1 — booster/cannon spec rework + poison buff.** Owner: *"Booster final
upgrades need a rework. I'm not sure I'd ever choose 50% range over 20% damage.
Similarly for cannon … 50% blast radius over 50% damage. Also, Poison is WAY under
powered. Maybe it should also reduce enemy defense. As well as do some more damage
over time."* The dominated specs were dominated because the alternative was pure
range/radius with **zero** damage upside. Fixed by giving each a damage hook so it's
a real axis choice, not a trap:
- **Booster · Network** (`effBuffPower`, `cd-game.js`): now grants **+10% aura power**
  in addition to its +50% range. So the "wide coverage" pick still adds damage —
  Overclock (+20% power) stays the max-concentrated option, Network is "+10% power
  across a much bigger footprint." New additive number (+0.10), no existing number swung.
- **Cannon · Mega Blast** (`effDmg` + splash radius in `cd-update.js`): now **+15%
  damage** *and* **+60% blast radius** (radius mult `1.5`→`1.6`, a +6.7% swing). The
  AoE/wave-clear pick now also hits harder; Cluster (+50% dmg) remains the
  single-target/boss pick. New +15% dmg is additive; the radius swing is well under 25%.
- **Poison** (`TOWER_TYPES.poison` + `hitEnemy` poison branch): base dmg `6`→`7`
  (+16.7%), DoT coefficient `2.2`→`2.6` (+18%), and **every poison hit now corrodes
  −3 enemy armor (floored at 0)** — directly answering "reduce enemy defense." Total
  DoT rises 13.2→18.2 dps (+38% — but each *individual* lever is ≤25%, satisfying the
  guardrail, which caps per-number swings, not stacked independent buffs). The armor
  corrosion makes poison a hard counter to shield/armored/boss enemies (whose HP just
  rose in v1.9.2), giving it a clear team role. The shop button's short label now reads
  "DoT + corrodes armor", and a new **hover tooltip** (`title` on the shop button, fed by
  an optional `tip` field on `TOWER_TYPES`) spells out exactly what corrosion does
  ("Each hit corrodes −3 enemy armor (down to 0)…") so the mechanic is discoverable.

**2. Difficulty step: enemy HP +25% more (owner FEEDBACK, recurring).** Owner cleared
campaign 9/40 on hard with just two L6 frosts + a booster — still trivially easy. The
global enemy-HP multiplier in `enemyTemplate()` goes **1.44 → 1.80** (+25%, the
guardrail-max single-number step). It's a different number from the v1.9.2 bump
(1.2→1.44) and from the spec/poison levers above, so all stay within the per-number
≤25% rule. Uniform coefficient → exactly +25% HP at every wave incl. deep endless;
bosses (`t.hp*mult`) and tanks (`t.hp*3.2`) scale off it too. Combined with the Shatter
nerf, this is a deliberate difficulty-focused run; tuning continues iteratively.

**3. Frost · Shatter nerf (owner FEEDBACK, mid-run sim report).** Owner: *"the
milestone that gives frost 50% more damage combined with shatter is overpowered …
I completed 9/40 on hard with two frost towers at L6 and a booster at L6. The frost
tower was doing 764 damage; with a +15% rare it hit 879."* Shatter's flat **×6**
damage multiplier (`effDmg`, `cd-game.js`) is the dominant lever in that build — it
multiplies *every* other frost bonus (Frost Mastery, Frostbite, the L6 booster aura,
perks), so a cheap fast-firing slow-tower turns into a sniper that carries solo runs.
Cut **×6 → ×4.5** (−25%, at the per-number guardrail edge, justified by the explicit
owner sim): 764→573, 879→659. Shatter stays clearly the damage pick over Deep Freeze
(slow 65%), just no longer run-warping. Booster aura scaling (+0.1/level → +75% at L6)
and Frost Mastery are noted as the next candidate levers on ROADMAP if it's still hot.

**4. Combo near-miss cue (ROADMAP game-feel follow-up).** The bottom-right COMBO
timer bar now **blinks red in the last third of the 2s window** (blink derived from
`comboTimer`, no wall-clock) so keeping a chain alive feels tense. Render-only.

**6. Bug fix: game speed now persists across refresh/resume (owner report).** Owner:
*"there's a bug where when you refresh and continue a game the towers still shoot at
their original speed. Damage seems to work right."* Root cause: the rAF loop runs
`update()` `speed` times per frame (`cd-render.js`), but the `speed` global (1×/2×/3×)
was never persisted — every page load reset it to **1×**. So after a refresh + Resume,
the *whole* game ran at 1× and every tower fired at its base cadence, while per-shot
damage (computed independently) looked correct — exactly the reported symptom.
*(Verified the tower-stat restore itself is correct: a resumed tower's `effRate` and
range are byte-identical to a freshly-built one, for both plain and minigun-spec towers
— so the fire-rate value was never the problem; the dropped game-speed was.)* Fix:
persist `speed` in `localStorage.cd_speed` (mirroring `cd_mute`) — restored at load in
`cd-state.js`, written in `toggleSpeed()`, and the speed button label synced at startup.
Additive key with a safe default; old saves unaffected.

**5. `prefers-reduced-motion` support (ROADMAP table-stakes / accessibility).** A new
`reduceMotion()` helper (`cd-core.js`, reads `matchMedia` live, guarded) gates the
screen-shake translate in `draw()` **and** thins particle bursts in `addExplosion()`
(count ×0.3, velocity ×0.5 — a faint hit cue remains, the spray is gone). With the OS
"reduce motion" setting on, the board no longer shakes or sprays — an accessibility +
motion-sensitivity win. (An optional *in-game* toggle, for users who want it without
the OS flag, remains a separate settings item on ROADMAP.)

**Why it's save-safe.** All combat numbers are computed live from base stats /
formulas every frame — nothing here is persisted. `loadRun()` rebuilds towers from the
new base poison dmg automatically. No schema change, no migration needed. Specs are
chosen in-run and stored as ids (`network`/`mega` already existed) — old saves with
those ids just get the new effects.

**Simulation / evidence.** New test group **[17]** asserts: Network's `effBuffPower`
exceeds plain booster power; Mega's `effDmg` ≈ 1.15× a no-spec cannon; poison DoT uses
the 2.6 coefficient and a poison hit drops a shielded enemy's armor by 3; **Shatter
frost `effDmg` is exactly 4.5× a no-spec frost (the −25% nerf, not the old ×6)**; and
`reduceMotion()` exists; the poison shop button's tooltip explains the corrosion.
Group **[16]** updated to assert the new **1.80** HP multiplier (and that it's strictly
above the prior 1.44). Remaining groups stay green (see suite output). Each changed
number is ≤25% swing; the combined poison DoT gain (+38%) is the sum of independent
≤25% levers, which the per-number guardrail allows.

## v1.9.2 — 2026-06-11

**Difficulty step: enemy HP +20% across the board (FEEDBACK / balance).** Owner
report (FEEDBACK #4, also ROADMAP "Late-campaign difficulty audit"): *"The game is
still a too easy. I'm able to clear classic-normal with money I got from the first
10 rounds … campaign 6 on hard can be completed with a single gunner and booster at
max level (only losing 5 hp to the final boss)."*

- **What changed:** the global enemy-HP multiplier in `enemyTemplate()` (`cd-game.js`)
  went from `1.2` → `1.44` — a flat **+20%** to every enemy's health. Because it's a
  single uniform coefficient, the swing is exactly +20% at *every* wave (including
  deep endless), staying safely under the ≤25%-per-number balance guardrail where an
  exponent change would have blown past it at high waves. Bosses (HP = `t.hp*mult`)
  and tanks (`t.hp*3.2`) scale off the same template, so they get tougher too —
  directly targeting the "only lost 5 hp to the boss" complaint.
- **Why uniform, not late-only:** I considered steepening the `w^1.9` exponent to bite
  only late, but any exponent bump produces an unbounded, ever-growing % swing that
  exceeds 25% in deep endless. A flat coefficient is the only lever that's both
  meaningful and guardrail-safe at all waves. This is a deliberately *modest* first
  step — the owner found it *trivially* easy (a fraction of the intended resources),
  which is a multi-run gap; the guardrail caps me at ~25%/run, so difficulty is being
  dialed up iteratively. Economy was left untouched this run to keep the diff to one
  reasoned lever (a follow-up economy-pacing pass is on the ROADMAP).
- **Simulation / evidence:** deterministic — every enemy's HP is exactly ×1.2 of the
  prior value, so total wave HP-to-kill rises a uniform +20% with zero change to
  spawn counts, speeds, bounties, economy, or saves. New test group **[16]** asserts
  `enemyTemplate(w).hp` matches `(18 + w*7 + w^1.9) * 1.44 * d.hp` at waves 1/5/10/20/30
  and that it's the buffed (not old-baseline) value. Full suite green (see below).
- **No save/economy/theme impact** — HP is computed live per wave from the formula;
  nothing about this is persisted, so old saves are unaffected.

## v1.9.1 — 2026-06-11

**Tower upgrade/sell menu pinned to the lower-left corner (FEEDBACK).** Owner
report: *"When I click on a tower the menu pops up to sell/upgrade. This sometimes
overlaps things happening on the game. I think it would be better if this was
positioned in the lower left corner and not hovering where I clicked."* (All five
PENDING items are `[Low priority]`, so this run was free to pick; this is the
cleanest, most concrete owner-described item and sits in the same UX-relocation
class as the recent combo-meter work.)

**What changed.** In `showUpgrade()` (`cd-game.js`) the panel was positioned at
`t.x + 20, t.y - 70` — i.e. floating at the clicked tower, exactly where it could
cover enemies on the path. It is now pinned to a fixed spot in the **lower-left
corner** (`left:10px`) and **bottom-anchored** (`top:auto; bottom:10px`) so taller
panels (the spec choice at level 5) grow upward and never clip off the canvas
bottom. Same place every time, independent of where you clicked.

**Why it's safe.** Render/DOM-only — one positioning block changed, no gameplay,
economy, save schema, or `eff*` helper touched. The faint between-wave "Next: …"
preview shares the bottom-left corner, but it only shows while no wave is active,
so the panel covers it only while you're inspecting a tower (planning) — never
during live combat, which was the actual complaint.

**Test evidence.** New test group **[15]** asserts the panel opens on tower
select, hugs the left edge (`offsetLeft ≤ 20`), sits at the bottom (small bottom
gap), is bottom-anchored (`top` cleared / `bottom` set), and — placing the tower
in the upper-right then moving it — that its position is **independent of the
tower location**. Full suite **139/0 green** (was 133/0; +6 new checks). Verified
live in-preview: with a tower at the upper-right, the panel renders at `left:10px`
with a 10px bottom gap, zero console errors.

## v1.9.0 — 2026-06-11

**👻 New enemy: the Phantom** — a blinking, intangible harasser that joins waves
from **wave 13 onward**. New content (owner likes new enemy types + surprises),
adds mid-game variety, and partly answers the standing *"still a bit too easy"*
FEEDBACK note by introducing a threat that slow single-target towers can't simply
out-trade.

**Behavior.** Phantoms are teal (`#39d0d8`), ~0.9× HP, 1.15× speed, no armor, and
spawn on the `i % 6 === 5` slot for w≥13 (so ~5 per wave at first). Every ~2s a
phantom **blinks forward 58px** along the path and is **intangible for 0.35s** —
during that window `pickTarget()` skips it and `damage()` returns early, so any
in-flight shot whiffs. Freezing a phantom (`frozen>0`) pauses its blink clock, so
frost/freeze still counter it. Render: drawn translucent (0.72 alpha, dropping to
0.22 mid-blink) with a 👻 glyph; a teal particle poof + rising `SFX.blink()` whoosh
on each teleport.

**Why it's safe.** Enemies only exist *during* a wave and `saveRun()` only writes
between waves, so the new `blinkCd`/`blinkInvuln` fields never touch the save
schema — zero migration needed. Purely additive: no change to existing enemy
stats, economy, or any `eff*` helper. `waveDesc(13+)` now lists `phantoms`.

**Test evidence.** New test group **[14]** drives a wave-13 quick run and asserts:
phantoms spawn at w≥13 and never before; a phantom goes `blinkInvuln>0` and is
skipped by `pickTarget`; `damage()` no-ops while intangible; phantoms are still
killable (blink ends) and a full run clears with zero console errors. Full suite
green (see test subagent report). Verified double-click `file://` playability and
in-preview that phantoms blink + flicker correctly.

## v1.8.6 — 2026-06-11

**🩺 Health check** (every-6th-run maintenance pass; resets the 5-run counter).
This is the first health check — there were 15 prior version entries and no
earlier health check, so the counter (≥5) triggered it. No `[bug]` FEEDBACK items
were pending (all 5 PENDING items are `[Low priority]`), so no feature shipped.

**1. Refactor audit.** All game files are comfortably within the ~1500-line cap —
largest is `cd-update.js` at 517 lines (html 116, css 255, cd-core 167→169,
cd-maps 153, cd-defs 298, cd-state 104, cd-game 443, cd-render 458). No oversized
files, no obvious dead code, no duplicated logic flagged. Test suite runs in ~15s
with no flakiness. **No split or refactor needed this run.**

**2. Docs coherence.** Verified CLAUDE.md against the actual code: the combo-meter
positions (bottom-right `W-16`/`H-26` meter in `cd-render.js:390`, center-board
`W/2,114/132` milestone pop in `cd-update.js:269`), the `loadMeta()` additive
migration (defaults `achievements`/`stats`/`dmg`/`runs`/`bestCombo`), and the
seven-file load-order map all match reality. `GAME_VERSION` is consistent with the
CHANGELOG. No drift found. ROADMAP's vetoed section is intact.

**3. Table-stakes audit + small fix.** Audited the polished-browser-game checklist.
The document `<head>` was missing the basics, so this run adds them (head-only,
zero gameplay/save/balance impact): a **⚡ inline-SVG favicon** (data URI — no
network, works offline on `file://`), a **responsive `viewport` meta**, a **meta
description**, a **`theme-color`**, and **Open Graph** title/description/type for
link previews. The page title is now "Circuit Defense — Browser Tower Defense".
The larger table-stakes gaps (touch/pointer controls, gamepad, `prefers-reduced-
motion`, colorblind-safe palette, PWA install manifest, full settings persistence)
are recorded as prioritized ROADMAP entries under a new **Table-stakes** section.

**4. Integrity spot-checks.** Full suite **123/0 green**, zero console errors
(8 new checks in a new `[13] Document metadata` group). `file://` playability
re-confirmed structurally (relative classic `<script src>`, no ES modules, no
network). Old-format save migration verified by the existing migration test plus a
direct read of `loadMeta()`'s defaults — minimal `cd_meta` (chips/talents only)
still loads and gains `achievements`/`stats` defaults.

**Tests:** 115/0 before the metadata change → **123/0 after** (8 new). Verified the
live DOM in-browser: favicon, viewport, theme-color, and OG title all present and
correct, zero console errors.

## v1.8.5 — 2026-06-11

**Combo meter relocated to the bottom-right corner (owner suggestion).**

After v1.8.3/v1.8.4, the persistent COMBO meter was still fighting for space in
the crowded top band — owner reported it was getting clipped against the top edge
(`topY≈11`, so "9×" read like "g×") and still felt cramped next to the boss bar /
round-clear bonus. Owner's suggestion: *"move the milestones or the combo meter to
the bottom right so we don't have to worry about the overlap."* Done.

- The meter now anchors to the **bottom-right corner** (`ax = W-16`, number
  baseline `H-26`): the `N×` multiplier is right-aligned to the corner, "COMBO"
  sits to its **left** on the same baseline, and the draining timer bar is in its
  own lane below (`y = H-16`), draining toward the corner. Right-anchored so wide
  counts (`100×`) grow leftward instead of off-edge.
- Verified by **reading actual canvas pixels**: a `9×` meter occupies x817–883 /
  y511–547 and a purple `100×` meter x754–883 / y511–547 — both fully inside the
  900×560 board with **no edge clipping** (the top-edge clip is gone). The corner
  is otherwise empty: the only bottom-edge text is the wave-preview on the bottom-
  **left**, and the top band (boss bar, round-clear bonus, ability bar) is now
  completely separate.
- The `🔥 N× COMBO!` milestone pop stays on the **center board** (`W/2,114/132`,
  from v1.8.4), which is clear of both the top band and the new bottom-right meter.

**Render-only, no balance/economy/save impact** — combo stays cosmetic and
run-only. **Tests:** suite green. The Test 11 layout block was rewritten to verify
the bottom-right meter's bar doesn't overlap the label, the whole meter (9× and
100×) fits on-canvas with no clipping, and the centered milestone floater clears
both the top band and the bottom-right meter. Zero console errors.

## v1.8.4 — 2026-06-11

**Fix: combo milestone pop was overlapping the meter (owner follow-up to v1.8.3).**

Owner report after v1.8.3: *"The combo meter still overlaps the milestone
[upgrades] in the top left corner."* v1.8.3 had moved the `🔥 N× COMBO!`
milestone burst/floater **into** the top-left corner to clear the centered
"Wave clear! +bonus" text — but that corner is exactly where the persistent
COMBO meter lives, so the pop landed on the meter instead. Traded one overlap
for another.

- The milestone burst + floater now fire on the **center board, below the whole
  top HUD band** (`W/2, 114` / `W/2, 132`) — clear of the top-left meter (bottom
  ~y48), the centered round-clear bonus text (~y36–90), **and** the centered
  boss HP bar (~y8–32). Measured in-browser: with the meter, the round-clear
  bonus, and the milestone pop all on screen at once, the floater (y113–136)
  sits 65px below the meter and 59px below the bonus — no collision with any of
  the three.
- The v1.8.3 meter relayout (COMBO label to the right of the multiplier, timer
  bar in its own lane below) is unchanged and still correct.

**Render-only, no balance/economy/save impact** — combo stays cosmetic and
run-only. **Tests:** suite **114/0 green**; the Test 11 layout assertion was
updated to verify the milestone floater clears the entire top HUD band (meter /
bonus / boss bar) vertically rather than the now-obsolete top-left anchoring.
Zero console errors.

## v1.8.3 — 2026-06-11

**Fix: combo-meter overlap (owner FEEDBACK / ROADMAP "Combo meter layout bug").**

Owner report: *"The newly added combo meter overlaps the round completion bonuses
display and the bar overlaps the word 'COMBO'."* Two render-only fixes:

- **Bar over "COMBO":** the top-left meter's draining timer bar (canvas y48–52)
  was sitting on top of the "COMBO" label (y45–53) — measured overlap. The label
  now renders **to the right of the multiplier** on the same baseline, and the
  bar drops to its **own lane** below the number (`y44`, with a ~10px gap to the
  number and ~12px to the label). The number font eased 28→26px so the compact
  `26×  COMBO` row fits cleanly. Verified numerically in-browser:
  `bar_overlaps_label` went `true → false`; bar clears both the number and the
  label.
- **Milestone pop over the round-clear bonus:** the `🔥 N× COMBO!` milestone
  floater + particle burst rendered dead-center (`W/2, 84`) — exactly where the
  centered *"Wave clear! +bonus"* round-completion floater lives (`W/2, 50`). A
  wave-ending kill is often itself a milestone, so the two texts stacked. The
  burst (`96, 40`) and floater (`120, 74`) are now **anchored to the top-left
  combo column**, so the combo system owns that corner and never lands on the
  centered bonus text. Measured: the floater footprint (x34–206) is fully clear
  of the bonus zone (x291–609) and stays on-canvas. The screen-shake is kept, so
  the milestone still feels chunky.

**No balance/economy/save impact** — the combo system stays purely cosmetic and
its state is still run-only (never persisted). Render coordinates only.

**Tests:** suite green. Test 11 gains two assertions — the timer bar does **not**
overlap the COMBO label, and the milestone floater stays top-left and clear of
the centered round-clear bonus. Verified live over `http://` with zero console
errors.

## v1.8.2 — 2026-06-11

**Refactor: domain-split `tower-defense.js` into seven ordered files (the "etc."
follow-up to v1.8.1; queued in FEEDBACK.md / ROADMAP.md).**

The 2118-line `tower-defense.js` exceeded the ~1500-line-per-file guideline, so
it's now seven classic `<script src>` files loaded in dependency order:

| File | Lines | Domain |
| --- | --- | --- |
| `cd-core.js` | 164 | canvas refs, version / What's-New panel, audio (`tone`/`noise`/`SFX`) |
| `cd-maps.js` | 153 | maps & paths, mayhem mode, stars, difficulty |
| `cd-defs.js` | 298 | talents/meta (`loadMeta`), towers, specs, abilities, perks (`openDraft`) |
| `cd-state.js` | 104 | run state, kill-combo vars, save/resume |
| `cd-game.js` | 443 | start screen, `beginGame`, enemies, `startWave`, shop, upgrade panel, effective stats, input |
| `cd-update.js` | 514 | `update()`, game-end, achievements, records, `endGame`/`winGame` |
| `cd-render.js` | 449 | `draw()`, main rAF loop, startup init |

**Zero behaviour change, proven mechanically.** The files were sliced strictly
at existing section boundaries with **no reordering**, so concatenating all
seven (minus the per-file `'use strict';` directive added to each) is
**byte-identical to the pre-split `tower-defense.js`** — the slicer asserted this
(`REBUILD MATCHES ORIGINAL: true`). Classic scripts share one global scope, so
load order = dependency order (the only top-level execution dependencies are the
`cv/ctx` canvas refs first and the startup init block last; everything between is
function/const declarations). **No ES modules** (they break `file://`); still
plays by double-clicking the HTML. Each file is independently strict, matching
the original single strict script. Saves untouched, no balance/feature edits.

**Tests:** suite stayed green across the change (the [12] block was rewritten to
assert all seven files exist, each begins with `'use strict'`, they're wired via
classic `<script src>` in the exact dependency order, no ES-module/inline-code
leaks, and cross-file globals from four different files all resolve over
`file://`). Full suite now **112/0 green**. Verified live in the browser preview
over `http://` too (v1.8.2, all 7 scripts load in order, globals resolve, zero
console errors).

## v1.8.1 — 2026-06-11

**Refactor: split the single `tower-defense.html` into html + css + js files
(FEEDBACK item: "split it out into its own files").**

`tower-defense.html` had grown to ~2480 lines with the whole game inlined in one
`<style>` and one `<script>`. It is now three files:

- `tower-defense.html` (109 lines) — markup only.
- `tower-defense.css` (255 lines) — the styles, extracted verbatim from the old
  inline `<style>`, linked via a classic `<link rel="stylesheet">`.
- `tower-defense.js` (2118 lines) — the code, extracted verbatim from the old
  inline `<script>`, loaded via a classic `<script src="tower-defense.js">` at
  the end of `<body>` (same execution position as before).

**Zero behaviour change.** The CSS/JS bodies are byte-identical to what was
inlined; the only code edit is the version bump + this changelog entry. **No ES
modules** — classic `<link>`/`<script src>` tags so the game still plays by
double-clicking `tower-defense.html` from Explorer over `file://` (ES modules
break on `file://` due to CORS). No build step, no network deps, saves
untouched.

Why: maintainability — a 2.5k-line monolith is hard to navigate and edit.
Separating markup/styles/code is the first slice; further domain-splitting of
the 2118-line JS (audio / maps / towers / rendering / ui / save) is noted as a
follow-up in FEEDBACK.md since it exceeds the ~1500-line-per-file guideline.

**Tests:** baseline 87/0 green *before* the split; identical 87/0 green *after*,
proving zero behaviour change. Added test block **[12] External-file split** —
asserts both external files exist, are wired via classic (non-module) tags, the
HTML has no leftover inline `<style>`/`<script>` code, and the external CSS+JS
actually load and run over `file://` (body bg = `rgb(13,17,23)` from the sheet,
game globals defined, zero console errors). Full suite now **97/0 green**. Also
verified live in the browser preview over `http://` (v1.8.1 renders, external
files load, no console errors). Two subagents independently re-ran the suite and
byte-audited the diff for guardrail compliance — both clean.

## v1.8.0 — 2026-06-11

**Feature: "Combo Master" achievement + lifetime best-combo stat (ROADMAP
combo follow-ups, from v1.7.0).**

The kill-streak combo system shipped in v1.7.0 was purely cosmetic and left no
mark on your account. This run cashes it in:

- **💥 Combo Master** — a new 9th achievement, granted when you reach a **30×
  kill-streak** in a single run. Evaluated in `grantAchievements()` from the
  run's peak (`comboBest`), so it unlocks on the end-of-run screen like the
  other badges.
- **🔥 Best combo** — a new lifetime stat on the 🏆 Records panel footer, next
  to lifetime damage / runs / chips. Tracks your all-time highest streak across
  every run via a new additive `meta.stats.bestCombo` field (`Math.max`
  semantics — a smaller later peak never lowers it).
- **Save-safe:** `meta.stats.bestCombo` is an additive field defaulted to `0`
  in `loadMeta()`'s migration, so pre-v1.8.0 saves load unchanged. No existing
  keys touched. No gold/economy/balance impact — this is progression flavor on
  top of the cosmetic combo system.
- **Test evidence:** `tests/` green — **87 checks, exit 0** (up from 83). Four
  new assertions: a 30× run grants `combo30` and records `bestCombo`; a sub-30
  peak does NOT grant it and never lowers a higher stored best.

## v1.7.1 — 2026-06-11

**Fix: combo meter was hidden behind the ability bar.**

The v1.7.0 COMBO meter rendered at the top-right of the board, directly behind
the `#abilityBar` HTML overlay (Meteor / Freeze / Gold Rush buttons), so it was
obscured during play. Moved it to the **top-left** corner, which is clear of
both the top-right ability bar and the centered boss HP bar. Render-only change
(coordinates + left text-align); no logic, balance, or save impact. Tests stay
green (83 checks, exit 0).

## v1.7.0 — 2026-06-11

**Feature: kill-streak combo system (ROADMAP "Game feel / polish" — combo /
kill-streak feedback).**

Chunky reward for clearing enemies fast. Consecutive kills within a 2-second
window now build a **combo streak** with escalating game-feel:

- A **COMBO meter** appears at the top-left of the board (`× N` + a "COMBO"
  label and a draining timer bar). _(Originally top-right; moved to top-left in
  v1.7.1 to clear the ability bar.)_ It pops on each kill and **glows hotter** as
  the streak climbs — green → gold → orange → red → purple
  (`comboColor(n)` thresholds at 10 / 20 / 30 / 50).
- Every **milestone** (5, then every 10) fires a new `SFX.combo(n)` rising chirp
  whose pitch climbs with the tier, plus a screen-shake and a golden/colored
  particle burst at the top of the board and a `🔥 N× COMBO!` floater — so
  wiping a packed wave feels punchy.
- The streak **lapses to 0** if no kill lands within `COMBO_WINDOW` (2s); a
  per-run peak is tracked in `comboBest`.
- **Purely cosmetic — zero balance/economy/save impact.** Combo state
  (`comboCount` / `comboTimer` / `comboBest` / `comboFlash`) is run-only, never
  written to localStorage, and grants no gold. Resets cleanly in `resetState()`
  so fresh and resumed runs both start at 0.
- **Test evidence:** `tests/` green (83 checks, exit 0). New **Test 11** asserts
  `comboColor`/`SFX.combo`/the combo vars exist, the color escalates by tier,
  clearing real waves builds a streak (peak ≥ 5), a fresh run zeroes the combo,
  and the streak lapses to 0 after its window with no kills. Verified in-browser:
  the meter renders without console errors at a live 22× (orange) streak.

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
