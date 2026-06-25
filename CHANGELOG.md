# Changelog

All notable changes to Circuit Defense. Newest first. Versions are semver-ish:
patch = fixes/balance, minor = features/content.

## v2.37.0 — 2026-06-25 — 📖 Mid-run Bestiary + ⏎ Enter-to-restart + ability test coverage

**Type:** UX / quality-of-life + test coverage. Minor bump. FEEDBACK PENDING was empty — picked from ROADMAP ("link the Bestiary from in-game so it's reachable mid-run"; "Expand harness coverage — abilities"; "a quick-restart hotkey … Enter on the game-over overlay"). No economy/balance/save-schema change (all additive/UI; the one new global `codexPausedGame` is run-only UI state, never serialized).

- **📖 Bestiary reachable mid-run (ROADMAP).** The codex was start-menu-only. Added a 📖 Codex button to the in-game wave-controls row (and a `C` hotkey) that opens the existing Bestiary panel during a live run. Opening it **auto-pauses** the game so you can read a counter without leaking; closing **resumes the pause it created** (never clobbers a manual pause — `openCodex()`/`closeCodex()` are now run-aware, and the new run-only `codexPausedGame` flag tracks whether the codex did the pausing). On the start menu both functions behave exactly as before. The landscape `#controls` row was pinned to one non-wrapping scroll row (mirrors `#shop`) so the extra button can never push Start Wave off-screen. New test group **[150]**.
- **⏎ Enter restarts the run from the game-over overlay (ROADMAP).** Pressing Enter on the defeat/victory overlay now triggers Play Again (restart the same run) — only when Play Again is offered (hidden for one-off Daily runs). Saves a mouse trip after a loss. Part of test group **[150]**.
- **Ability test coverage (ROADMAP "expand harness coverage").** New group **[149]** exercises all five abilities headlessly: Meteor arm/disarm, Time Freeze (freezes every live enemy; blocked on cooldown), Gold Rush (gated pre-wave, injects post-wave), Shockwave (knocks enemies back; CC-immune enemies unaffected), and Barrier (banks `barrierMax()` charges, vaporizes a leaker for zero lives, unused charges fade on timer). The abilities were previously almost untested.

Suite **1611 → 1629** green (new [149]/[150]). `sw.js` cache → `v2.37.0`.

## v2.36.0 — 2026-06-24 — 🫥 Veil boss + ⏩ Blitz mod + combo-tier word + 🌠 Combo God

**Type:** Content (a boss archetype, a Mayhem wave-mod, an achievement) + game-feel polish. Minor bump. FEEDBACK PENDING was empty — picked from ROADMAP. No economy/balance/save-schema change (all additive; enemies/mods/combo state are run-only).

- **🫥 Veil — the 20th boss archetype (ROADMAP "boss follow-ups").** First appears at wave **115** (the cycle now wraps `w120 → regen`). While alive (and unfrozen) it spreads **intangibility** to its cohort — each frame it tags every nearby non-boss ally within `VEIL_RANGE` (115px ×`enemyMechScale`) with the persistent `cloak` flag, handing them to the existing cloak machinery (periodic brief untargetability + the violet cue ring / faded sphere). The escorting pack **phases out** in windows, so slow single-target towers waste shots while rapid fire barely notices — a fresh **coverage/uptime** axis (the 🫥 Cloaking Field mod / 👻 phantom as a boss). Adds **no HP/speed** (bounded), boss-bar badge reads **VEILING** (pale-spectral aura ring), the Bestiary lists it, and **freeze** pauses the spread (a clean counter). Reuses the cloak infra → zero new fields/skip-sites. New test group **[146]**.
- **⏩ Blitz — the 22nd Mayhem wave-mod (ROADMAP "wave-mod follow-ups").** A "double-time" speed surge: enemies (and the boss) move **+60% faster** (×1.60) — a bigger flat spike than Frenzy's +35%, leaning hard on coverage/leak. Conversion-free (no extra bodies), mutually exclusive with every other mod (one is ever active). New test group **[147]**.
- **Combo-tier word (game-feel polish).** The bottom-right combo meter now shouts an escalating label under the multiplier — **HEATING UP → RAMPAGE → UNSTOPPABLE → GODLIKE** — stepping at the same 10/20/30/50 breakpoints as the meter colour/glow. New `comboTierLabel()` (cd-state.js, pure/unit-testable); render-only.
- **🌠 Combo God — a new achievement (roster 21 → 22).** Reach a **50× kill-streak** in a single run (no `won` gate — a feat, like 💥 Combo Master at 30×; pairs with the new "GODLIKE" tier word). Reads the run's `comboBest` peak in `grantAchievements()`. New test group **[148]**.

Suite **1583 → 1610** green (new [146]/[147]/[148] + the roster-count & boss-rotation assertions updated). `sw.js` cache → `v2.36.0`.

## v2.35.1 — 2026-06-24 — 🩺 Health check — all green (1583/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (6 entries since the last health check v2.29.1: v2.30.0, v2.31.0, v2.32.0, v2.33.0, v2.34.0, v2.35.0 — at the 6-run trigger.)

Suite **1583/0** green, zero console errors, exit 0. All 8 game files under the ~1500-line cap (largest cd-update.js 1103, cd-render.js 1051, cd-game.js 993). file:// playability intact (8 classic scripts in order, no ES modules, SW guarded to http/https). Old-format save/meta migrate cleanly (verified live in-browser: legacy meta `{chips,talents}` back-fills achievements/stats/bestCombo/towerKills; legacy run defaults mapTheme/endless/gameTime, rebuilds towers). Docs coherent — every headline count matches code (11 towers, 5 abilities, 26 talents, 21 achievements, 21 Mayhem wave mods, 19 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties incl. 🌑 Nightmare, 7 quick maps + mayhem). Versions consistent (GAME_VERSION = sw.js cache = v2.35.1). Refreshed the stale ROADMAP test-harness figure (~9,715→10,274 lines, 138→145 groups, 1503→1583 assertions). Deploy workflow still a static no-build copy. Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.35.0 — 2026-06-23 — 🛡 Custodian boss + ⚑ Herald Surge mod + 💰 Hoarder badge

**Type:** Content (a boss archetype, a Mayhem wave-mod, an achievement). Minor bump. FEEDBACK PENDING was empty — picked from ROADMAP. No economy/balance/save-schema change (all additive; enemies/mods are run-only).

- **🛡 Custodian — the 19th boss archetype (ROADMAP "boss follow-ups").** First appears at wave **110** (the cycle now wraps `w115 → regen`). While alive (and unfrozen) it projects a continuous **damage-shield aura** over its cohort — every nearby non-boss ally within `CUSTODIAN_RANGE` (115px, ×`enemyMechScale` so it widens deep) takes **40% less damage**. It reuses the ◈ Warden's fully-managed `warded` infra (the general per-frame decay + the existing `dmg *= 0.6` line in `damage()`), so the only new logic is the aura tick. A "kill the keystone" target-priority fight: drop the Custodian (or **freeze** it) and the ward lapses off the whole pack at once. Adds **no HP/speed** (bounded; can't make a run easier), boss-bar badge reads **WARDING** (light-azure aura ring), and the Bestiary lists it. New test group **[143]**.
- **⚑ Herald Surge — the 21st Mayhem wave-mod (ROADMAP "wave-mod follow-ups").** Converts a fraction of would-be basic enemies (`i%4===1` norms) into haste-projecting ⚑ **Herald** escorts — the wave-wide cousin of the Herald enemy, mirroring Warden/Breacher/Jammer/Bastion Surge exactly (conversion, not addition; only norms convert; one mod ever active). A densely-heralded wave **surges** toward the exit en masse, pressuring **target priority** (pop the heralds to slow the pack). Reuses the general `kind==='herald'` aura tick, so no new aura code; bounded (haste is the capped +35%, frost slow/freeze still counter it). New test group **[144]**.
- **💰 Hoarder — a new achievement (roster 20 → 21).** Bank **10,000 gold at once** in a single run (no `won` gate — a feat, like 🎯 Sharpshooter; a wink at the deep-Endless gold pile-up). Tracked by a run-only `peakGold` (reset in `resetState()`, updated each `update()` frame, never saved → re-earnable on resume). New test group **[145]**.

Suite **1556 → 1583** green (new [143]/[144]/[145] + the roster-count & boss-rotation assertions updated). `sw.js` cache → `v2.35.0`.

## v2.34.0 — 2026-06-22 — ♾️ Endless milestone drafts past wave 30 + higher wave cap — FEEDBACK

**Type:** Bug fix + feature (owner FEEDBACK, the top two PENDING items) + a new achievement. Minor bump. No economy/balance/save-schema change (additive achievement only).

- **Endless milestone drafts past wave 30 (FEEDBACK #1, the bug).** In Endless the every-5-waves upgrade draft silently stopped at wave 30 — `endWave()`'s draft loop was gated `w % 5 === 0 && w < victoryWave()`, and Endless's `victoryWave()` is 30, so the run continued past the win with no more perk picks. Changed the gate to `w % 5 === 0 && (endless || w < victoryWave())`, so Endless now drafts at **every** multiple of 5 forever (including AT wave 30). Quick/Campaign are unchanged (the loop already `return`s at the victory crossing for non-endless). The perk pool can't run dry — 6 REPEATABLE perks always keep ≥3 cards available, so no empty/soft-locked modal. New test group **[142]**.
- **Concurrent-wave cap 3 → 8 (FEEDBACK #2, low-pri).** Owner: *"I should be able to add as many waves as I want."* Raised `MAX_CONCURRENT_WAVES` 3→8 — pour up to eight in-flight waves at once. Kept a (high) ceiling rather than fully unbounded so a stuck Space key or a deep-Endless stack (waves already field ~250 bodies each at w140) can't lock up the browser; say the word to lift it further. All settlement/draft/Add-Wave-button logic was already cap-agnostic (reads the constant). Test [20] rewritten to be cap-agnostic (fills to the cap, asserts one-beyond is blocked).
- **New achievement 🌌 Eternity (roster 19 → 20).** Reach **wave 100** in a single run (no `won` gate — a feat, like 🎯 Sharpshooter; pairs with the existing ♾️ Endless at wave 50). Rewards the now-rewarding deep-Endless grind. Additive/save-safe. Also fixed the stale 🧰 Full Arsenal description ("all 10 tower types" → "all 11"; the condition was always `TYPE_KEYS.length`, now 11 since the Pulsar).

Suite **1545 → 1556** green (new [142] + the roster-count + cap assertions updated). `sw.js` cache → `v2.34.0`. **PENDING now empty.**

## v2.33.0 — 2026-06-21 — 👥 Deep-wave enemy COUNT ramp (Hard/Nightmare) — FEEDBACK

**Type:** Balance / difficulty scaling (owner FEEDBACK — the top PENDING follow-up to the harder-Endless work, after the v2.31.0 HP slice + v2.32.0 ability/aura slice). Minor bump. Gated to quick-mode Hard/Nightmare; Normal/Easy/Campaign + waves ≤40 byte-identical. No economy/save/schema change.

Owner FEEDBACK (the "more enemies per deep wave" sub-ask): deep Endless still leaned almost entirely on the per-enemy HP ramp, so a defense that could focus-fire never felt crowd pressure. Added a single `waveCount()` helper (cd-game.js) — the historic base `8 + floor(w·1.7)` plus, for quick-mode Hard/Nightmare only, a **bounded deep-wave body bump from wave 40**: `+floor((w−40)·0.4)`, **capped at +30** (≈+10 @w65, +24 @w100, +30 from w115 on). It's shared by `buildWave()` AND `waveComposition()`, so the bottom-left wave-preview/threat read can never drift from the real spawn (test [40]'s `waveThreat===buildWave` invariant now holds at every difficulty). The +30 cap protects performance — deep endless already fields ~250 bodies at w140 (this tops out ~+12%); the base count is the same unbounded line it always was. Gated exactly like `enemyTemplate`'s deep `lateScale`, so Normal/Easy and ALL campaign waves are unchanged and waves ≤40 are byte-identical. Also **re-checked the proportional boss scaling** (sub-ask 2): bosses inherit the deep HP ramp via `t.hp` *proportionally* (not super-linearly on top), which matches the owner's "bosses should also be scaled (maybe not as high)" — left as-is. **Remaining PENDING:** endless milestone drafts past wave 30. New test group **[141]** (curve + cap + flat-early + spawn/preview parity at deep hard waves + campaign-exempt); suite **1533 → 1545** green. `sw.js` cache → `v2.33.0`.

## v2.32.0 — 2026-06-20 — 📈 Deep-wave enemy ability/aura scaling — FEEDBACK

**Type:** Balance / difficulty scaling (owner FEEDBACK — the top PENDING follow-up to the v2.31.0 HP slice). Minor bump. No economy/save/schema change. Waves ≤40 byte-identical (every focused mechanic test runs at wave 0, so unaffected).

Owner FEEDBACK (follow-up to harder-Endless): *"buff the enemies' special abilities/auras as the level grows — scale them with wave, not just HP (regen %, summoner add count, enrager/herald aura radius, siphon drain)."* v2.31.0 only scaled HP; deep bosses' *mechanics* still fired at their wave-20 strength. Added a single `enemyMechScale()` helper (cd-update.js) — a pure function of the current `wave`: **1.0 through wave 40**, then **+1.5%/wave, capped at +60%** (×1.6 at wave 80, then flat). Applied to: the **regen** wave-mod & **regen boss** self-heal %, the **heal** enemy aura %, the **Warden / Herald / Enrager** aura *radii*, the **Summoner** add cap (8 → up to 13), and the **Siphon** boss gold drain. Bounded by design — it scales the *existing* bounded pressure (regen still beatable by DPS, a wider aura is still a focus-fire decision, more adds are still weak), **never adds raw HP**, so the invariant-capped norm-HP curve (test [16]) and boss-HP/armor slopes (test [44]) are untouched, and **freeze still pauses every one of these**. A pure wave function so it applies in all modes, but deep waves (>40) are only reachable in Endless / deep Campaign (campaign maxes at wave 54 → +21%), so normal quick runs are unaffected. Remaining sub-asks still in PENDING: more enemies per deep wave; endless milestone drafts past wave 30. New test group **[140]** (curve shape + flat-early + deep-scaling of regen/radius/summon/siphon); suite green. `sw.js` cache → `v2.32.0`.

## v2.31.0 — 2026-06-19 — 🔥 Uncapped deep-endless HP ramp (Hard/Nightmare) — FEEDBACK

**Type:** Balance / difficulty scaling (owner FEEDBACK; the ≤25%/run swing rule was explicitly waived). Minor bump. Gated to quick-mode Hard/Nightmare — Normal/Easy/Campaign byte-identical, so test [16]/[44] invariants are untouched. No economy/save/schema change.

Owner FEEDBACK: *"Make the game way harder as the levels progress, especially endless — at wave 65 Hard I have 100k gold and don't need it; by wave 140 I had 1.5m gold and started selling towers just to end the game."* Root cause: `enemyTemplate`'s `lateScale` **capped** (+25% Hard ≈w32, +80% Nightmare ≈w37), so past ~w40 enemy HP stopped scaling while income kept climbing → deep Endless became a trivial victory lap. Added an **uncapped deep ramp from wave 40**: Hard +5%/wave, Nightmare +8%/wave, on top of the unchanged early ramp. So Hard is ×1.25 at w40 (unchanged), ×2.50 at w65, ×4.25 at w100, ×6.25 at w140; Nightmare ×1.80/×3.80/×6.60/×9.80. **Bosses inherit it proportionally** (boss HP = `t.hp × (14+0.6w)`) — honouring the owner's "bosses should also be scaled (maybe not as high)" without touching the test-[44]-pinned boss-HP slope. Waves ≤40 are byte-identical (owner said early/mid is "good"). The run now actually ends, so the player must spend gold and lean on talents. **Follow-ups noted in FEEDBACK/ROADMAP:** scale enemy *abilities/auras* (regen rate, summon count, aura radius) with wave; more enemies per deep wave; endless milestone drafts past wave 30. Test group [109] extended (deep-ramp values + monotonic growth + campaign deep-exempt); suite green. `sw.js` cache → `v2.31.0`.

## v2.30.0 — 2026-06-18 — 🔮 Distorter — 18th boss archetype (tower-range dampening aura)

**Type:** New content (boss archetype). Minor bump. Behaviour off the invariant-capped HP axis; no economy/save impact.

Added the **18th boss archetype**, 🔮 **Distorter**, to the wave-20+ cycle (first appears at **wave 105**, deep Endless). While alive it projects a tower-RANGE dampening aura: every non-buff tower within `DISTORT_RANGE` has its firing range cut 20% (`effRange ×0.8`, the same factor as the `fog` wave-mod), so towers near the boss stop reaching the path — opening a coverage/leak gap right where the boss walks. It's the **range sibling of the Suppressor** (fire-rate aura) and the `fog` Mayhem mod as a boss. **Bounded / "too easy"-safe:** adds no HP/speed, range only shrinks (can't make a run easier), buff towers immune, the tag lapses the instant the boss leaves range or dies, and **freeze pauses the aura** (a clean counter). Mirrors the Suppressor implementation: one freeze-gated tick block + one `effRange` factor + a fuchsia render ring; boss bar shows `DISTORTING`; added to the Bestiary. Run-only — no save migration. New test group `[139]`; suite **1503 → 1515** green. `sw.js` cache → `v2.30.0`.

## v2.29.1 — 2026-06-18 — 🩺 Health check — all green (1503/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v2.24.1: v2.25.0, v2.26.0, v2.27.0, v2.28.0, v2.29.0 — at the 5-run trigger.)

Suite **1503/0** green, zero console errors. All 8 game files under the ~1500-line cap (largest cd-render.js 1039, cd-update.js 1034). file:// playability intact (8 classic scripts in order, no ES modules, SW guarded to http/https). Old-format save/meta migrate cleanly (verified live: legacy meta back-fills achievements/stats; legacy run defaults mapTheme/endless/gameTime/barrierCharges). Docs coherent — every headline count matches code (11 towers, 17 boss archetypes, 19 achievements, 7 maps+mayhem, 20 wave mods, 26 talents, 5 abilities, 6 modes). Versions consistent (GAME_VERSION = sw.js cache = v2.29.1). Refreshed the stale ROADMAP test-harness figure (~9,392→9,715 lines, 138 groups, 1503 assertions). Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.29.0 — 2026-06-18 — 🗡 Board-DPS readout on the wave-preview strip

**Type:** Game-feel / readability polish. Minor bump. Render-only + one helper — no economy/balance/save impact.

The between-waves bottom-left strip now shows your total board DPS (🗡) beside the incoming wave's ⚔ threat HP, so you can gauge whether your defense can handle the next wave at a glance (ROADMAP polish: "DPS-relative read on the wave-threat number"). New `boardDps()` helper (cd-game.js) sums `effDmg(t) ÷ effRate(t)` over towers — booster auras included (baked into `effDmg`), buff towers contribute 0, and it's a conservative lower bound (AoE/chain/DoT/crits uncounted). Same run, the whole preview strip now hides while a tower's upgrade panel is open (ROADMAP polish — they shared the corner). New test group **[138]**; suite **1496 → 1503** green. `sw.js` cache → `v2.29.0`.

## v2.28.0 — 2026-06-18 — 🛡 Bestiary gains a Towers section (full reference)

**Type:** Table-stakes UX / panel extension. Minor bump. Render/UI-only — no economy/balance/save impact.

Extends the just-shipped 📖 Bestiary (v2.26.0) with a **🛡 Towers** section, completing it into a full in-game reference (ROADMAP follow-up: "a parallel tower/spec codex, folded into one Codex panel"). It lists all 11 towers — icon, rank-coloured disc, cost, a one-line role description (the shop `tip` where present, else `desc`), and **both max-level specializations** with their effects — so a player can plan a build and pick counters for the enemies/bosses listed above, without trial-and-error. The section is built **live from `TYPE_KEYS`/`TOWER_TYPES`/`SPECS`** in `renderCodex()`, so a new tower auto-appears with its specs (can't drift — no parallel data table to maintain). New `.cdxSpec` CSS for the specs sub-line. Test group **[136]** extended: the codex now has 3 sections, renders a row + spec line per tower, and covers EVERY tower and EVERY spec (completeness). Suite **1492 → 1496** green. `sw.js` cache → `v2.28.0`.

## v2.27.0 — 2026-06-18 — ◎ Absorber — 17th boss archetype (per-hit damage cap)

**Type:** New content (boss archetype). Minor bump. Behaviour off the invariant-capped HP axis; no economy/save impact.

Added the **17th boss archetype**, ◎ **Absorber**, to the wave-20+ cycle (first appears at **wave 100**, deep Endless). It caps the damage any single hit can deal it to `maxHp × 5%` (`ABSORB_CAP`), so a huge Sniper/Cannon/crit blow is wasted while a rapid stream of small hits is unaffected — the precise counter to the high-per-hit burst/crit build (the recurring "too easy" offender, strengthened by Critical Mass v2.20.0), and the inverse of the Fortifier (flat armor checks *low* per-hit DPS). **Bounded / "too easy"-safe:** a cap not immunity (sustained DPS still kills it; adds no HP/speed), and **freeze lifts the cap** so a Frost build cracks it open. Implemented as one freeze-gated line in `damage()` + a periodic absorb pulse for game-feel; boss bar shows `ABSORBING` + a teal aura ring; added to the Bestiary. Run-only — no save migration. Suite green. Test group `[137]`.

## v2.26.0 — 2026-06-18 — 📖 Bestiary — an in-game enemy & boss reference

**Type:** Table-stakes UX / new panel. Minor bump. Render/UI-only — no economy/balance/save impact.

The game has 14 enemy kinds + 16 boss archetypes but no in-game explanation, so players faced glyphs (⬢ ‼ ◈ 🔥 ⚡ ⚑ …) and coloured auras with no idea what they did. Added a **📖 Bestiary** panel (start-menu toolbar, beside Records) listing every enemy and every wave-20+ boss power with its colour disc + glyph, first-appearance wave, and a one-line how-to-beat-it tip (pop Medic/Warden/Herald first, bring single-target DPS vs Bastion, never leak a Breacher, etc.). Data lives in two tables (`CODEX_ENEMIES`/`CODEX_BOSSES` in cd-endgame.js); enemy disc colours read live from `PREVIEW_COLOR`, boss colours mirror the `bossMechanicBadge()` aura hues. Wired into `A11Y_PANELS` (Esc/Tab + focus trap), tagged `role="dialog"`, mobile full-screen-scroll selector, and `.startUtil` stays `#startScreen`'s last child (test [58] invariant preserved). New test group **[136]** asserts the panel/button/functions, a **completeness drift-guard** (every `PREVIEW_COLOR` kind + every `BOSS_ARCHETYPES` entry has a codex row — a new enemy/boss can't ship without a line), and open/close/render. Suite **1461 → ~1480** green. `sw.js` cache → `v2.26.0`.

## v2.25.0 — 2026-06-18 — 🌀 Vortex — the 7th quick-play map (inward-spiral kill-funnel)

**Type:** New content (map + theme). Minor bump. Additive/save-safe; no economy/balance change to existing systems.

A new quick-play map, **🌀 Vortex** (`vortex`, themed the new **Neon** hot-magenta palette): a tight rectangular inward spiral that funnels the crowd toward a dense centre before breaking out to the exit, and the path crosses itself (at the inner funnel ~490,380) for crossfire pockets — distinct from Spiral's loose zigzag and Nexus's perpendicular convergence. Adds a 7th `THEMES` palette (**neon**), claimed as Vortex's fixed `MAP_THEME` identity and added to the `CAMPAIGN_THEMES` random pool. Fully additive: it appears in the map selector with its own Records column, and every map/theme enumeration already iterates `Object.keys(MAPS)`. Save-safe (`loadRun` validates `MAPS[mapKey]`; `vortex`/`neon` don't collide with diff keys). New test group **[135]** (axis-aligned path, in-bounds, self-crossing, theme identity, selector button, real run to wave 5+, per-map best + save/resume round-trip). Suite **1445 → 1461** green. `sw.js` cache → `v2.25.0`. (Quick maps: 6 → 7; static themes: 6 → 7.)

## v2.24.1 — 2026-06-18 — 🩺 Health check — all green (1445/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v2.19.1: v2.20.0, v2.21.0, v2.22.0, v2.23.0, v2.24.0 — at the 5-run trigger.)

Suite green (**1445/0**, ~134 groups, zero console errors, exit 0). **Refactor audit:** all 8 game files under the ~1500-line cap — largest cd-render.js **1028**, cd-update.js **1015** (both crossed 1000 this cycle but keep ~470 lines of headroom), cd-game.js 931. No dead code / stray logging / TODOs (the TODO matches are prose inside old health-check What's-New bodies). The dev-only **test harness is now 9,392 lines / ~134 groups / 1445 assertions** — still by far the biggest file and the top split candidate in ROADMAP (not bound by the game-file cap). **Integrity:** `file://` double-click play intact (8 classic scripts in dependency order, no ES modules, SW guarded to http/https, no build step); old-format save migration verified (talent back-fill + additive `meta.stats`/`achievements`/`endless`/`gameTime`/`mapTheme`/perkState defaults). **Docs coherence:** every headline count matches code (11 towers, 5 abilities, 26 talents, 19 achievements, 20 wave mods, 16 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties, 6 quick maps + mayhem). Versions consistent (GAME_VERSION = sw.js cache = v2.24.1, test [49]). Fixed two stale ROADMAP notes: the harness-size line (9,014→9,392 lines / 129→~134 groups / 1390→1445 assertions) and the talent count (25→26 — `mastery_pulsar` v2.23.0 was missing from the inventory line). Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.24.0 — 2026-06-18 — ▦ Grid placement readability — visible lines + snap tick

**Type:** Game-feel/UX polish (render + audio). Minor bump. No gameplay/balance/economy/save impact.

Extends the owner-requested grid-snap placement (v1.24.0) per the ROADMAP polish item "visible grid lines (not just dots) + a snap tick sound." With grid snap on, selecting a tower to place now draws faint full **grid lines** across the board (replacing the old slot-dots) and **highlights the exact target cell** as a square tinted by placeability (blue=ok, red=blocked), so towers line up cleanly at a glance. A short, quiet `SFX.tick()` fires each time the placement ghost crosses into a new cell, making the grid feel tactile under the cursor. Render-only state: a `_placeSnapCell` global (cd-render.js, never saved) tracks the current cell to detect crossings and is cleared whenever the preview isn't shown (no spurious tick on re-selection); the whole effect is gated behind `gridSnap`, so grid-snap-off play is unchanged. New `SFX.tick` (cd-core.js). New test group **[134]** (tick on cell-cross only, no double-tick same cell, reset when idle, snap-off silent). Suite **1437 → 1445** green. `sw.js` cache → `v2.24.0`.

## v2.23.0 — 2026-06-18 — 💫 Pulsar — the 11th tower (a self-centred radial AoE pulse)

**Type:** New content (tower). Minor bump. Additive/save-safe; no economy/balance change to existing systems.

A new tower, the **💫 Pulsar** (cost 120, range 90, dmg 10, rate 0.8, `proj:'nova'`): instead of aiming a projectile it emits an instant **radial pulse** that damages **every enemy within its range at once** — the only tower whose AoE is centred on itself rather than a projectile's impact point. A dedicated swarm-clearer: total output scales with crowd density, but per-hit damage is among the lowest in the game (single-target DPS 12.5, 2nd-weakest) so it's deliberately **poor vs single tanks/bosses** (the inverse of the Laser) and respects armor — a positioning side-grade, **not** power creep. Resolves instantly via `firePulse(t, dmg)` (mirrors fireChain/fireRail/fireBeam); the expanding ring reuses `addRing` (gated by the particle/reduce-motion settings). Specs **Overload** (+40% dmg) / **Resonance** (+30% radius); a **Pulsar Mastery** talent (26 talents); `SFX.pulsar()`. **Balance:** at equal gold and upgraded it lands alongside the Cannon (sim: w24/23/30 on classic/gauntlet/nexus vs Cannon w24/24/30) — competitive but never clearly stronger. Save-safe (rebuilt generically by `loadRun`; the pulse is run-only, never serialized). New test group **[133]**; `sw.js` cache → `v2.23.0`. (Towers: 10 → 11.)

## v2.22.0 — 2026-06-18 — ⭐ Records spotlight — your latest personal best is highlighted

**Type:** Game-feel/UX polish (Records panel). Minor bump. Save-safe (two additive `cd_lastbest_*` keys); no economy/gameplay/balance impact.

The Records panel now spotlights the cell whose per-map best you most recently set: a gold tint + glow + a ★ marker, so opening Records shows at a glance which record you just beat (an addictive-loop feedback touch). Wave bests and score bests are tracked independently — `recordBest()` stamps `cd_lastbest_wave` and `recordScores()` stamps `cd_lastbest_score` (both `"<map>_<diff>"`, quick-mode + non-daily only, mirroring the per-map key gating; first-ever records stamp too). `renderBests()` adds a `.justbeat` class + ★ to the matching cell in each grid, only when that cell has a value. Both keys are additive (old saves show no highlight until your next PB) and swept by `resetAllData()`'s `cd_`-prefix clear. New test group **[132]** (stamp on wave/score, newer cell takes over, campaign/daily never stamp, both grids highlight, ★ marker, empty/absent → no highlight). Suite **1411 → 1421** green. `sw.js` cache → `v2.22.0`.

## v2.21.0 — 2026-06-18 — 🎖️ Rank-tinted tower barrels (veterancy visual)

**Type:** Graphics/UX polish (render-only). Minor bump. No gameplay/balance/economy/save impact.

Completes the veterancy visual thread (kill-rank pips v1.100.0): a veteran+ tower now gets its **barrel tinted in its rank colour** (bronze→silver→gold→legendary-pink) plus a bright muzzle band, so an Elite/Ace/Legend tower reads as battle-hardened at a glance instead of relying only on the small star pips above it. New pure helper `towerBarrelTint(t)` (cd-defs.js) returns the rank colour for a veteran+ non-buff tower (null for Rookie/buff); `draw()` (cd-render.js) draws a low-alpha rank wash over the barrel + a solid muzzle band inside the existing rotated barrel frame (so it tracks aim), flaring with `rankFlash` on promotion. **Cosmetic only** — no stat change, buff towers excluded, and the tint derives from each tower's saved `kills`, so existing saves keep their earned ranks. New test group **[131]** (helper threshold/null-safety/buff-exclusion + draw() renders ranked towers cleanly). Suite **1400 → 1411** green. `sw.js` cache → `v2.21.0`.

## v2.20.0 — 2026-06-17 — 🎯 Critical Mass — legendary perk on the crit-damage axis

**Type:** New content (legendary perk). Minor bump.

Added 🎯 **Critical Mass**, the first perk to amplify crit *damage* (the multiplier) rather than just crit *chance* — `apply` does `critChance += 0.10` AND `critMult *= 1.5`, so a normal crit goes ×2.5→×3.75 and a Deadeye sniper's ×4→×6. A build-defining synergy legendary (stacks with the 🔬 Crit Lab talent, 🍀 Crit Systems perk, Deadeye spec); without crit-chance investment the ×1.5 rarely fires, so it's conditional/probabilistic and stays "too easy"-safe (well below the unconditional Diamond Core +30% on a generic board). Wired as one term in the fire-loop crit branch (`dmg *= (deadeye?4:2.5) * perkState.critMult`) — not effDmg, so the panel doesn't churn. `critMult` lives in perkState (save-safe default 1; old saves load via the existing `Object.assign(freshPerkState(), s.perkState)` merge); the legendary-only `resolveWildcard()` rolls it. No new localStorage key / economy / save-schema impact. Test group [130]; suite green.

## v2.19.1 — 2026-06-17 — 🩺 Health check — all green (1390/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v2.15.1: v2.15.2, v2.16.0, v2.17.0, v2.18.0, v2.19.0 — at the 5-run trigger.)

Suite green (**1390/0**, 129 groups, zero console errors, exit 0). **Refactor audit:** all 8 game files comfortably under the ~1500-line cap — largest cd-render.js **994**, cd-update.js 987, cd-game.js 929 — all with healthy headroom after the v2.15.2 split. No dead code / stray logging / TODOs (the TODO matches are prose inside old health-check What's-New bodies). The dev-only **test harness is now 9,014 lines / 129 groups / 1390 assertions** (by far the biggest file, ~+75/run) — still flagged as the top split candidate in ROADMAP (not bound by the game-file cap). **Integrity:** `file://` double-click play intact (8 classic scripts in dependency order, no ES modules, no build step, SW guarded to http/https); old-format save migration verified (talent back-fill + additive `meta.stats`/`endless`/`gameTime`/`mapTheme` defaults). **Docs coherence:** every headline count matches code (10 towers, 5 abilities, 25 talents, 19 achievements, 20 wave mods, 16 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties, 6 quick maps + mayhem). Versions consistent (GAME_VERSION = sw.js cache = v2.19.1, test [49]). Fixed two stale ROADMAP notes: the harness-size line (8,703→9,014 lines / 126→129 groups / 1342→1390 assertions) and a talent count (24→25 — `mastery_laser` v2.9.0 was missing from the inventory line). Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.19.0 — 2026-06-17 — 🏵️ Living Legend achievement + lifetime tower-kills stat

**Type:** New content (achievement + progression stat). Minor bump. Recognition-only — no economy/gameplay/balance impact; save-safe (additive `meta.stats.towerKills`, old saves default 0).

Deepens the tower-veterancy system (cosmetic kill-rank pips v1.100.0; Veteran's Edge perk v2.13.0) on the progression axis instead of piling on more combat content (the game is saturated: 10 towers/16 boss archetypes/14 enemy kinds). A 19th achievement, 🏵️ **Living Legend** — promote any single tower to the top **Legend** rank (200 kills). It's a **feat, not a win condition** (no `won` gate, like Sharpshooter): granted in any mode, win or lose, so a long Endless run is the natural place to chase it — and it pairs with Veteran's Edge, which rewards those same high-rank towers. Implemented in `grantAchievements` via `towers.some(t => towerRankTier(t.kills) === 4)` reading the final board. Also added a lifetime **`meta.stats.towerKills`** counter (summed from each run's final-board tower kills) surfaced as a `💀 Tower kills` row in the Records panel. `meta.stats.towerKills` migrates additively in `loadMeta` (default 0). Test group **[129]** (badge defined, roster 18→19, migration, grant on Legend win-or-loss, accumulation, below-Legend withheld, Records row); group [48] roster assertion bumped 18→19. Suite **1381 → 1390** green. `sw.js` cache → `v2.19.0`.

## v2.18.0 — 2026-06-17 — Start menu spans the full game column (no scrollbar)

**Type:** UX fix (owner FEEDBACK). Minor bump. CSS/markup + one JS line; save/economy/balance-neutral; phone layout unchanged.

Owner FEEDBACK: "The menu screen now has a scroll bar. It should use the entire game size minus the What's New panel." The start menu was `#gameWrap`'s child, so it was clipped to the 900×560 canvas box — Campaign's tall 40-level grid overflowed into a scrollbar (the v2.1.0 `safe center` containment fallback). `#startScreen` now lives in `#gameCol` (made `position:relative`) as its last child, so it spans the **full game-column height** (title→hint, ~900px+), concentric with the canvas — the dashboard gets room to breathe and no longer scrolls in any mode. Also fixed a latent bug: `backToMenu()` hardcoded `style.display='flex'`, overriding the desktop dashboard `display:grid` after a game (reverting the menu to the tall stacked flow + reintroducing the scrollbar) — now it clears the inline display so the CSS governs. Child/position invariants preserved (tests [58]/[113]); mobile keeps its own `position:fixed` layout. New test group **[128]**. `sw.js` cache → `v2.18.0`.

## v2.17.0 — 2026-06-17 — ♾️ Endless mode is now selectable from the start menu

**Type:** Feature (owner FEEDBACK). Minor bump. Save-safe (additive `endless` save field; old saves default false); no economy/balance change.

Owner FEEDBACK: "You keep adding features to endless but I don't see a way to select that on the menu." Endless was previously only reachable by winning a Quick run and pressing **Continue Endless ∞**. Now a **♾️ Endless** tile sits on the start menu beside Quick Play and Campaign. It's **not a 3rd `gameMode`** — it stays `gameMode==='quick'` with a new `endless` config flag (so every quick-mode scaling/branch is unchanged), and selection keys off the flag. When set, reaching the victory wave (30) calls `winGame()`'s new **endless branch**: it banks the win exactly once (chips/achievements/best-wave) and celebrates with a floater, but keeps `gameOver` false and shows **no overlay** — `endWave()` then falls through to settle the wave-clear bonus and auto-start the next wave, so the run flows on seamlessly until defeat. Identical reward semantics to the existing Continue-Endless path (no double-economy change). Persisted in `cd_save` (`endless`, restored quick-only; old saves default false → load as normal runs) and resumable. Suite **1354 → 1368** green; new test group **[127]**. `sw.js` cache → `v2.17.0`.

## v2.16.0 — 2026-06-17 — 🩶 Suppressor — 16th boss archetype (fire-rate dampening aura)

**Type:** New content (boss archetype). Minor bump. Save-safe (boss mechanics are run-only, never persisted); no economy/schema change.

A 16th deep-endless boss archetype (first at **w95**), serving the recurring "too easy" feedback off the invariant-capped HP axis. The **Suppressor** projects a continuous fire-rate **dampening aura**: each frame it tags every non-buff tower within `SUPPRESS_RANGE` (130px) with a decaying `t.suppressed=0.3`, and `effRate()` reads it as **+25% reload** (×1.25 — the *exact* `brownout` wave-mod factor, a "localized brownout"). So unlike the **Disruptor** (one tower fully offline every ~4s — a roaming gap), the Suppressor *softly throttles every tower it passes at once*, pressuring tower **clustering/positioning** near the path. **Bounded / "too easy"-safe:** adds no HP/speed, it's a −20% DPS slow not a shutdown, buff/support towers are immune, the tag lapses the instant the boss leaves range or dies, and a **frozen** Suppressor can't suppress. Rendered with a slate aura ring + a `SUPPRESSING` boss-bar badge + a faint slate ring on each throttled tower. `BOSS_ARCHETYPES` 15→16 (cycle wrap now w100→regen). Suite **1342 → 1354** green; new test group **[126]**. `sw.js` cache → `v2.16.0`.

## v2.15.2 — 2026-06-17 — 🧹 Split cd-endgame.js out of cd-update.js (zero-behavior refactor)

**Type:** Refactor (its own run, zero behavior change). Patch bump. No gameplay/balance/economy/save change.

`cd-update.js` had reached **1448 lines** (~52 from the ~1500 cap, flagged top tech priority in the v2.15.1 health check). Moved its end-of-run + meta-UI half — `ACHIEVEMENTS`/`grantAchievements`, daily streak, records (`recordBest`/`recordScores`), the Settings panel, scoring (`computeScore`/`scoreGrade`/`scoreBreakdownHtml`/`renderEndScreen`), and `endGame`/`winGame`/`nextLevel`/`quitRun`/`continueEndless` — **verbatim** into a new **`cd-endgame.js`** (491 lines), loaded after cd-update.js and before cd-render.js. cd-update.js dropped to **963** (now just the per-frame `update()` sim + combat: `pickTarget`/`fire*`/`hitEnemy`/`damage`). The new file is a classic `<script src>` (NOT a module), added to the HTML load order, the `sw.js` precache, and the harness `JS_FILES`; CLAUDE.md's file map went seven→eight. Verbatim move (no logic/balance/symbol edits, confirmed byte-identical by the diff-review subagent); suite **1339 → 1342** green (+3 from the new file's existence/use-strict/executed coverage). `file://` double-click play intact (test [12] loads over file://). All 8 game files now have comfortable headroom (largest: cd-render 984). `sw.js` cache → `v2.15.2` (test [49]).

## v2.15.1 — 2026-06-17 — 🩺 Health check — all green (1339/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 feature entries since the last health check v2.10.1: v2.11.0, v2.12.0, v2.13.0, v2.14.0, v2.15.0 — at the 5-run trigger.)

Suite green (**1339/0**, 126 groups, zero console errors, exit 0). Refactor audit: all 7 game files under the ~1500-line cap; the largest, **cd-update.js, is now 1448** (+50 since v2.10.1, only ~52 lines headroom) — escalated in ROADMAP to **top tech priority**: the next content run that adds tick logic here likely crosses the cap, so the domain split should land in the next run or two. No dead code / stray logging / TODOs (the TODO matches are prose inside old health-check What's-New bodies). Integrity: `file://` double-click play intact (7 classic scripts in order, no ES modules, no build step, SW guarded to http/https); old-format save migration verified (talent back-fill + additive defaults, exercised by test [5] + the minimal-save guard). Docs coherence: every headline count matches code (10 towers, 5 abilities, 25 talents, 18 achievements, 20 wave mods, 15 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties, 6 quick maps). Versions consistent (GAME_VERSION = sw.js cache = v2.15.1, test [49]). Refreshed the two stale ROADMAP size notes (cd-update.js 1398→1448; harness 8430→8697 lines / 123→126 groups / 1307→1339 assertions). Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.15.0 — 2026-06-17 — 🌅 Phoenix — legendary perk that cheats death once

**Type:** New content (legendary run perk). Minor bump.

A new ★ legendary, 🌅 **Phoenix** — the game's **first player-revival mechanic**. When a leak would drop you to 0 lives, you instead cheat death **once per run**: revive at `PHOENIX_LIVES` (12) and the surge hurls the **whole field back to the path start** (`o.dist = 0` for every live enemy), buying a full lap to rebuild. Latches via `perkState.phoenixUsed` so it fires exactly once. **"Too easy"-safe** (the Last Stand rationale): it only triggers when you're already losing, so a winning run never reaches 0 lives and Phoenix does nothing — it can only soften a loss. Pure knockback + lives: **no kills, no bounty**, zero economy impact. Implemented at the single leak site in `cd-update.js`; both flags live in `perkState` (defaults false → save-safe; a saved "already used" run can't re-trigger on resume). `resolveWildcard()` rolls it automatically. Test group [125]; suite green.

## v2.14.0 — 2026-06-17 — 🟡 Warlord — the 15th boss archetype (rallies the whole wave)

**Type:** New content (boss archetype). Minor bump.

A 15th boss archetype, the 🟡 **Warlord** (deep/endless, w90+) — the **first GLOBAL aura** in the game. While alive it rallies the **entire wave**, granting every other enemy `WARLORD_ARMOR` (10) flat bonus armor regardless of distance (every prior aura is range-gated). So it's a pure "kill the keystone" target-priority puzzle: drop the Warlord and the whole field's armor evaporates at once. Flat armor checks the cheap high-rate-low-dmg gun build (the recurring "too easy" offender) while being ignored by Mortar/AP and corroded by Poison. **"Too easy"-safe**: adds no HP/speed, freeze pauses the rally (the buff lapses instantly). Reuses the existing `damage()` flat-armor path + a decaying `rallied` tag (no new damage-path code); run-only, never persisted → save-safe. Test group [124]; suite green.

## v2.13.0 — 2026-06-17 — 🎖️ Veteran's Edge legendary perk (veterancy gets teeth)

**Type:** New content (run perk). Minor bump.

A new ★ LEGENDARY draft perk, 🎖️ **Veteran's Edge** — the first perk to give the cosmetic tower-veterancy system (v1.100.0, kill-rank pips Rookie→Veteran→Elite→Ace→Legend) mechanical weight. Each tower deals **+5% damage per veteran tier** it has earned, capped **+20%** at Legend (200 kills); a fresh tower gets +0%. A new build axis — reward a "veteran core" of long-lived, well-placed elite towers rather than churning the board. Deliberately **"too easy"-safe**: conditional + back-loaded + capped, strictly below the unconditional Diamond Core (+30% flat, the better early pick), so it's a meaningful choice, not power creep. Wired in `effDmg` via `towerRankTier(t.kills)`, which `upgradeKey()` already hashes (panel churns only on a promotion, not every kill). `veteranBonus` lives in `perkState` (save-safe default false; `t.kills` already persists, so a resumed run keeps the bonus); the legendary-only `resolveWildcard()` rolls it. cd-update.js untouched. Test group [123]; suite green.

## v2.12.0 — 2026-06-17 — 🌑 Nightmare ~2× harder (owner feedback)

**Type:** Balance (owner-requested). Minor bump. Affects ONLY the 🌑 Nightmare tier — Easy/Normal/Hard/Campaign/Daily are byte-identical.

Owner FEEDBACK: "Nightmare should be about twice as hard." Hardened the tier across every lever, calibrated by a measured difficulty index (total wave HP ÷ total run income over waves 1–30): `hp 1.7→2.5`, `bounty 0.85→0.68`, `gold 90→75`, `lives 8→7`, plus a steeper/higher quick-mode late-scale (`enemyTemplate`: slope `.02→.03`, cap `+40%→+80%`, threshold w10 kept → +30% w20, +60% w30, cap ≈w37). Sim (classic, no talents): Nightmare index **152 → 310** = **×2.04 the old Nightmare** (and ×3.17 a Hard run). chipMult stays at the top 2.2× (still the best payout, now better-earned). Owner-requested, so the ≤25%/number swing rule is waived this run (per the FEEDBACK-overrides-guardrails rule); all numbers are documented here and in the `DIFFS.nightmare` comment. Fully save-safe — no schema/key change, records load unchanged; the Daily still rolls only normal/hard so it never lands on Nightmare. Test [109] updated (exact stats + new late-scale factors + a difficulty-index ratio guard >2.5×). Suite green.

## v2.11.0 — 2026-06-17 — 🔆 Laser beam visibly grows with charge (owner feedback)

**Type:** Game-feel polish (render-only). Minor bump.

Owner FEEDBACK: "Laser beam's beam should get bigger the longer it holds a target." The Laser's damage already ramped on a held target (×1→×2.2); now the *tracer* reads that spin-up — `fireBeam` scales the pushed beam's width (~2.4→7.4px), glow (shadowBlur 10→29) and an outer `bloom` halo (0→7px, absent at ×1) by `(charge-1)`. The shared `b.straight` render branch in `draw()` gains a guarded bloom pass + `b.glow || 14` / existing `b.w || 3.5` fallbacks, so the **Railgun tracer (sets neither field) renders byte-identically**. Purely cosmetic — the charge accrual and `damage()` call are untouched (no balance/economy change); beams are run-only (never serialized → save-safe). Suite green (**1308/0**); test [121] gains a beam-grows assertion.

## v2.10.1 — 2026-06-17 — 🩺 Health check — all green (1307/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 feature entries since the last health check v2.5.1: v2.6.0, v2.7.0, v2.8.0, v2.9.0, v2.10.0 — at the 5-run trigger.)

Suite green (**1307/0**, 123 groups, zero console errors). Refactor audit: all 7 game files under the ~1500-line cap; the largest, cd-update.js, is now **1398** (+80 since v2.5.1, ~100 lines headroom) — flagged in ROADMAP to split next run or two. No dead code / stray logging. Integrity: `file://` double-click play intact (7 classic scripts in order, no ES modules, no build step, SW guarded to http/https); old-format save migration verified (talent back-fill + additive defaults). Docs coherence: every headline count matches code (10 towers, 5 abilities, 25 talents, 18 achievements, 20 wave mods, 14 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties, 6 quick maps). Versions consistent (GAME_VERSION = sw.js cache = v2.10.1, test [49]). Refreshed the two stale ROADMAP size notes (cd-update.js 1318→1398; harness 8050→8430 lines / 117→123 groups / 1255→1307 assertions). Table-stakes checklist still complete. No gameplay/balance/economy/save changes.

## v2.10.0 — 2026-06-17 — 🟫 Fortifier — the 14th boss archetype (hardens its armor over time)

**Type:** New content (ROADMAP "a 14th boss archetype"). Minor bump. First appears at wave 85 (deep endless); rotation now `.length` 14 and wraps at w90 → regen.

The 🟫 **Fortifier** ramps its own armor while alive (`+0.5`/s, capped at `+40` over its starting armor), so deep bosses become a **DPS race** — drop it fast or it turns into a brick. It reuses the existing flat-armor subtraction in `damage()` (no new damage-path code), so like the documented boss-armor lever it barely touches high-damage builds (Sniper/Cannon) and is fully ignored by the anti-armor towers (Mortar/AP ignore armor), but meaningfully punishes the cheap high-rate/low-damage gun-spam build flagged "too easy". The ramp is **in place** (vs recomputing from a base each frame), so **Poison's −3 armor corrosion persists** — it knocks the armor down and the boss slowly re-hardens, keeping Poison's anti-armor counter meaningful. Distinct from the bulwark (a periodic % soak that hurts all builds equally): this is steadily-growing FLAT armor that asymmetrically checks low-per-hit DPS. **Bounded / "too easy"-safe:** no extra HP or speed, the ramp caps, and freeze pauses it (gated block). Bronze aura ring + `FORTIFYING` boss-bar badge; periodic clank (`SFX.bossSkill()` + bronze burst). All fields run-only (`fortifyCap`/`fortifyCd`, enemies never persisted) → save-safe. New test group [122] (+ rotation pins in [45]/[114]/[119] updated for the 13→14 cycle); suite green (1307/0). `sw.js` cache → `v2.10.0` (test [49]).

## v2.9.0 — 2026-06-17 — 🔆 Laser — the 10th tower (a beam that ramps damage on a held target)

**Type:** New content (ROADMAP "new tower" / tower variety). Minor bump. The first attack tower since the Railgun; tower count 9 → 10.

The 🔆 **Laser** (hotkey `0`, `proj:'beam'`, cost 165, range 175, dmg 6, rate 0.45) fires an instant single-target beam that **RAMPS UP** its damage while held on the same target — `t.charge` climbs `+0.12`/shot from ×1 to a **×2.2 cap** (~11 shots / ~5s) — then **resets to ×1** the instant the target dies or it switches. So it's a sustained boss/tank melter that's deliberately **poor at swarms** (the inverse of an area tower) — a genuine non-dominated choice, not power creep: it respects armor, and at full ramp its DPS sits around the Sniper's, well under the armor-ignoring Mortar or an Executioner Sniper vs bosses. Specs: **Focusing Array** (+35% dmg) / **Pulse Drive** (fire rate ×1.4 → faster ramp); plus a 🔆 **Laser Mastery** meta talent (talents 24 → 25). The charge logic is one block in the fire loop; rendering reuses the existing straight-beam (`b.straight`) path, thickening with charge. **Save-safe:** `charge`/`beamTarget` are run-only and never serialized (saveRun only stores type/x/y/level/mode/spec/invested/dealt/kills), so a resumed Laser just re-ramps from ×1; `loadMeta` auto-migrates the new mastery talent to rank 0. Hotkey handler now maps `'0'` → the 10th tower; the 🧰 Full Arsenal achievement desc updated 9 → 10 tower types. New test group **[121]**; suite green. `sw.js` cache → `v2.9.0` (test [49]).

## v2.8.0 — 2026-06-17 — 💣 Shaped Charges — rare perk that pierces Bastion blast-shells

**Type:** New content (ROADMAP "a spec/perk that adds explosion-penetration vs ⬢ Bastion blast-shells"). Minor bump.

A new ◆ rare run perk, 💣 **Shaped Charges** (`aoePen`): explosive towers (Cannon bomb + Mortar shell) pierce the ⬢ Bastion's `aoeResist` blast-shell and deal it **full splash** again (the shell normally halves their damage). A fresh **counter-content** axis — the sibling of 🔌 Surge Protector (vs jamming) — that keeps the AoE/splash strategy viable against the enemy built to check it (and the Bastion Surge mod). Wired as one extra term (`&& !perkState.aoePen`) at the two splash sites in `hitEnemy()`; single-target fire, Tesla chain and the Overkill detonation were never resisted, so they're untouched. **"Too easy"-safe:** it removes a specific resistance, adding no raw DPS/range/economy, so it can't make a run easier. A rare → the legendary-only `resolveWildcard()` skips it. Save-safe: `aoePen` lives in perkState (default false, round-trips via `loadRun`'s `Object.assign`). New test group **[120]**; suite green (1278/0). `sw.js` cache → `v2.8.0` (test [49]).

## v2.7.0 — 2026-06-17 — 🟣 Warper — the 13th boss archetype (yanks nearby allies forward)

**Type:** New content (boss archetype). Minor bump. The 13th archetype, first appearing at wave 80 (deep endless); rotation now `.length` 13 and wraps at w85.

The 🟣 **Warper** manipulates its *allies'* path position — the offensive inverse of the player's 🌀 Shockwave (which shoves enemies back). In the gated tick block a `warpCd` (~5s) fires a rift that adds `o.dist += 30` to every non-boss enemy within 130px, lurching the cluster toward the exit — a fresh axis (coverage/leak pressure), not the invariant-capped HP curve. Bounded/"too easy"-safe: no extra HP or speed, a small periodic local pull, and freeze pauses it. Indigo aura ring + `WARPER` boss-bar badge; fires `SFX.shock()` + an indigo burst. All fields run-only (enemies never persisted) → save-safe. Test group [119] (+ rotation pins in [45]/[96]/[114] updated for the 12→13 cycle); suite green (1269/0).

## v2.6.0 — 2026-06-17 — 🧱 Aegis — new meta talent (+1 Barrier charge per rank)

**Type:** New content (meta talent). Minor bump. The 24th talent and the first meta upgrade to the 🛡️ Barrier ability.

`aegis` (CORE, max 2, `cost 14 + r*12`) adds +1 banked Barrier charge per rank, so a cast banks `BARRIER_CHARGES + tRank('aegis')` (3 → up to 5) via the new `barrierMax()` helper (used for both the count and the floater text). Surge/Capacitor already cut ability cooldowns, so charges is Barrier's distinct lever. Purely defensive — Barrier vaporizes leaks for zero lives and pays no bounty, so it can't power-creep the "too easy" feedback; it just deepens the panic-wall vs leak-pressure content. Save-safe: `loadMeta`'s `Object.keys(TALENTS)` loop auto-migrates the new key to 0 for old saves. Test group [118]; suite green (1260/0).

## v2.5.1 — 2026-06-17 — 🩺 Health check — all green (1255/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (6 feature entries since the last health check v2.0.1: v2.0.2, v2.1.0, v2.2.0, v2.3.0, v2.4.0, v2.5.0 — past the 5-run trigger.)

Suite green (**1255/0**, 117 groups, zero console errors). Refactor audit: all 7 game files under the ~1500-line cap (largest cd-update.js at 1318 — added a ROADMAP "watch" note since it's the closest and grows each run). Integrity: `file://` double-click play intact (classic scripts, no ES modules, no build step, SW guarded to http/https); old-format save migration verified (group [3], green). Docs coherence: every headline count matches code (9 towers, 5 abilities, 23 talents, 18 achievements, 20 wave mods, 12 boss archetypes, 6 targeting modes, 14 enemy kinds incl. boss, 4 difficulties, 6 quick maps). Fixed a CLAUDE.md/ROADMAP drift — `metaCdMult()` reads the ⚡ **Surge** talent, not 🌟 Overdrive — and refreshed the stale test-harness-size note (now ~8,050 lines / 117 groups / 1255 assertions). Table-stakes checklist still complete. `sw.js` cache → `v2.5.1` (test [49]). No gameplay/balance/economy/save changes.

## v2.5.0 — 2026-06-17 — 🌀 Shock-ring effect — expanding pulse on Shockwave & Meteor

**Type:** Game-feel polish (ROADMAP "expanding-shockwave ring render"). Minor bump.

A reusable expanding-ring effect (`rings` run-only array + `addRing()` helper) now ripples outward when you cast **🌀 Shockwave** (a double ring from board centre) or **💥 Meteor** (a ring at the impact point), layered over the existing particle burst + screen-shake for chunkier feedback. Radius eases out (sqrt) for a fast initial burst; alpha + line-width fade over the ring's life. **Purely cosmetic** — no damage/economy/balance/save change. Gated exactly like the particle burst: **Particle effects = Off** (or OS reduced-motion) suppresses rings entirely at the emission site (`addRing` early-returns). Rings decay in `update()` beside particles, render after particles / before floaters, and are never serialized. New test group **[117]**; suite green. `sw.js` cache → `v2.5.0` (test [49]).

## v2.4.0 — 2026-06-17 — ⚑ Herald — haste-aura enemy (Enrager's regular-enemy cousin)

**Type:** New content (ROADMAP "Boss/enemy follow-ups"; new enemy kind). Minor bump.

A new enemy kind, the ⚑ **Herald** (from wave 18, all modes). It projects a **haste aura** that speeds nearby allies — the regular-enemy cousin of the Enrager boss, and a fresh 3rd aura axis (after the heal regen aura and the warden damage-shield aura). It pressures **target priority** off the invariant-capped HP curve: pop the Herald and the cluster slows back to base speed. Reuses the existing `e.hasted`/`hasteMul=1.35` infrastructure (Enrager already sets `e.hasted`), so the only new logic is the aura tick (mirrors the warden aura) + render/glyph/preview entries. **Bounded / "too easy"-safe:** haste capped at +35% and binary (no stacking with the Enrager); the Herald is slow (×0.9) and only moderately tanky (×1.25 HP); frost slow still multiplies in and freeze pauses the aura — so it can only add pressure, never make a run easier. Slots into `waveComposition`/`KIND_HP_MULT` (drift-guarded by test [40]) so the preview + ⚔ threat number count it. Run-only — enemies are never persisted → save-safe; no economy/balance change. New test group **[116]**; suite green. `sw.js` cache → `v2.4.0` (test [49]). Enemy kinds: 13 → 14.

## v2.3.0 — 2026-06-16 — 🦅 Eagle Eye — legendary +40% range perk

**Type:** New content (ROADMAP "a *legendary* +40% range perk"). Minor bump.

A new ★ legendary run perk, 🦅 **Eagle Eye** (+40% firing range to all towers), completing the range/coverage progression axis above the 🔭 Targeting Array rare (+20%) and 🔭 Farsight talent (+10% at max). It enables a sparse wide-coverage build (fewer towers reaching more of the path) and counters coverage-pressure content (Breachers' 3-life leaks, Fog, Cloaking Field). Wired as one line via the **existing `rangeMult` field** (no new perkState field → maximally save-safe); applied in `effRange` only, never booster auras (`effBuffRange`) — the same firing-range boundary Targeting Array/Glass Cannon respect. **"Too easy"-safe:** range helps you hit, not hit harder (per CLAUDE.md's gentlest-lever rationale), and it's a real build axis, not a flat Diamond-Core dupe. Stacks ×1.68 with Targeting Array (bounded); `resolveWildcard()` rolls it; `upgradeKey()` already hashes `effRange` so the panel live-updates. New test group **[115]**; suite green. `sw.js` cache → `v2.3.0` (test [49]).

## v2.2.0 — 2026-06-16 — 🟢 Conduit — the 12th boss archetype (escort-shielded)

**Type:** New content (ROADMAP "a 12th boss archetype"). Minor bump.

A new deep-game boss archetype, the 🟢 **Conduit** (appears w75+). It fights on a fresh axis no other boss touches: it's **shielded by its escorts** — the inverse of the ◈ Warden enemy (whose aura protects the cluster; here the cluster protects the boss). Each frame it counts nearby non-boss enemies within 130px (`conduitGuard`, capped at 5) and takes **−14% damage per linked escort** (cap −70%), applied as one line in `damage()`. So hammering its HP bar barely works — you must **clear the adds first** to break the link (a target-priority puzzle, not an HP spike). **Freezing it also drops the shield** (an unconditional CC-clear line zeroes the guard while frozen, so the gated tick can't leave a stale shield up). Render draws glowing mint tethers to each linked escort + a mint aura ring/badge. **Bounded / "too easy"-safe:** adds no HP or speed, the escorts are ones you'd kill anyway, and a frozen Conduit takes full damage — it can only ask you to prioritise, never make a run easier. All archetype fields are run-only/never persisted → save-safe; no economy/balance change. New test group **[114]** (+ badge coverage in [53], rotation update in [96]); suite green. `sw.js` cache → `v2.2.0` (test [49]).

## v2.1.0 — 2026-06-16 — 🧭 Start-menu dashboard layout (menu-revamp slice 9 — the "full revamp")

**Type:** UX layout (FEEDBACK [high] menu revamp, the remaining "full revamp" piece). Minor bump.

The menu was a tall single vertical stack — with 7 maps × 4 difficulties the run-setup card alone is ~415px, so hero + config + play + utility totalled ~733px and **overflowed the 900×560 board: ▶ PLAY sat below the fold**, the core "clunky" complaint. The start screen is now a **two-column dashboard** (desktop): the config card on the **left**, and a right **rail** stacking the play actions (PLAY/Resume/Daily) over the utility toolbar (now a vertical bordered panel) — so it fits on screen with PLAY front-and-centre. Pure CSS grid via `template-areas`, so the four children keep DOM order (hero first, util last) and every structure/a11y test ([58]/[60]/[63]/[112]) is untouched; `play` sits in the row above `util` so [58]'s play-above-util invariant holds. Desktop-only (`min-width:921px`); the ≤920px block keeps its own fixed/scroll mobile flow unchanged. CSS-only, save/economy/gameplay-neutral. Suite green (1209/0); new test [113]. (An uncommitted working-tree "contain the menu in the board" CSS edit — `#startScreen { overflow-y:auto; safe center }` + tighter hero/play spacing — was already present and is folded into this release; its `overflow-y:auto` provides the graceful scroll fallback for the intrinsically-tall campaign-mode 40-level grid.)

## v2.0.2 — 2026-06-16 — 🎨 Start-menu accent tiles (menu-revamp slice 8)

**Type:** UX polish (FEEDBACK [high] menu revamp, next slice). Patch bump.

The six start-screen utility buttons (Talents/Achievements/Records/What's New/Settings/Reset) were clashing solid colour blocks. They're now a cohesive set of dark **tiles**, each with its own accent colour as a left rail (`--acc`) + an accent-matched hover glow — the "per-block / accent-matched glows" piece of the revamp. CSS + inline-var only; `.startUtil` stays `#startScreen`'s last child; no save/economy/gameplay impact. Suite green (1196/0); new test [112]. Fuller left-rail revamp stays PENDING.

## v2.0.1 — 2026-06-16 — 🩺 Health check — all green (1179/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (7 feature entries since the last health check v1.95.0: v1.96.0, v1.97.0, v1.98.0, v1.99.0, v1.100.0, v1.100.1, v2.0.0 — well past the 5-run trigger.)

**1. Test suite.** Ran the full headless harness via a subagent: **1179 passed / 0 failed, exit code 0**, across 109 groups (last group `[109]` v2.0.0 release). Zero console errors. Matches the v2.0.0 CHANGELOG claim.

**2. Refactor audit.** Every game source file is comfortably under the ~1500-line cap — largest is `cd-update.js` at **1274** lines; then `cd-render.js` 915, `cd-game.js` 878, `tower-defense.css` 558, `cd-core.js` 532, `cd-defs.js` 516, `cd-maps.js` 313, `cd-state.js` 206, `tower-defense.html` 155. No dead code, leftover debug logging, or TODOs surfaced; no cleanup needed. (The dev-only test harness `tests/run-tests.mjs` is 7499 lines — already flagged in ROADMAP as a split candidate; refreshed the stale "~7400" note.)

**3. Docs coherence.** Verified every headline count in CLAUDE.md / ROADMAP.md against the actual code — all match: **9 towers** (TYPE_KEYS), **5 abilities** (meteor/freeze/rush/shock/barrier), **20 Mayhem wave mods** (frenzy…bastions + meteors), **11 boss archetypes** (regen…revenant), **18 achievements** (…nightmare_win), **6 targeting modes** (first/last/strong/close/weak/support), **13 enemy kinds incl. boss** (norm/fast/tank/heal/shield/split/molten/phantom/bastion/warden/jammer/breacher/boss), **4 difficulties** (easy/normal/hard/nightmare), **6 quick maps**. `GAME_VERSION` === `sw.js` CACHE === `v2.0.1`. ROADMAP is condensed and current; the "Vetoed by owner" section is intact (no new reverts in `git log`). No CLAUDE.md drift found.

**4. Table-stakes audit.** The polished-browser-game checklist remains COMPLETE: favicon + meta/OG (v1.8.6), PWA install/offline (v1.30.0), responsive/mobile (v1.14.0/v1.15.0), touch/pointer + 44px tap targets (v1.16.3/v1.46.0), gamepad (v1.43.0), keyboard a11y menus + draft (v1.19.0/v1.20.0), colorblind aid (v1.18.0), reduced-motion (v1.10.0), volume slider (v1.13.2), high-DPI (v1.17.0), settings persistence. No new gaps identified.

**5. Integrity spot-checks.** **file:// playability:** seven classic `<script src>` tags in dependency order, no `type="module"`; SW registration guarded to `location.protocol` http/https only (so double-click play and the file:// harness are unaffected); inline favicon, relative paths, no build step. **Old-save migration:** `loadMeta()` back-fills new talents at rank 0 via the `Object.keys(TALENTS)` loop and defaults `achievements`/`stats`; `loadRun()` merges `perkState` (`Object.assign(freshPerkState(), …)`) and `abilityCd` (with `barrier:0`), guards `gameTime`/`mapTheme` — a minimal pre-update save loads cleanly.

**Findings → ROADMAP; no code/balance/economy/save changes this run.** Counter reset (next health check after 5 more feature runs).

## v2.0.0 — 2026-06-16 — 🎉 Version 2.0 — 🌑 Nightmare difficulty + late-game scaling, Railgun/Breacher balance, campaign QoL, menu polish

**Type:** Major release (owner FEEDBACK [highest priority]: "push out a big change … do as many as possible … bump the version to 2 … include a big special change not listed"). Minor/major bump (v1.100.1 → v2.0.0). Six changes shipped together; balance ≤25%/run per existing number (the new Nightmare tier is new content, not a rebalance, so its raw stats aren't bound by the swing rule).

**Headline special (not in FEEDBACK/ROADMAP) — 🌑 Nightmare difficulty.** A brand-new 4th `DIFFS` tier above Hard (`cd-maps.js`): `hp:1.7, gold:90, lives:8, bounty:0.85, chipMult:2.2`. Tankier enemies, a thin safety margin, and the game's top chip payout to reward the grind (the recurring "too easy" feedback, answered with a new ceiling rather than nerfing the dominant build). Fully **data-driven** — every selector / Records grid / best-key path iterates `Object.keys(DIFFS)`, so the entry is all that's needed; the additive `cd_best_nightmare` / `cd_best_<map>_nightmare` / `cd_bestscore_<map>_nightmare` keys read with `||0` → **save-safe**. New **🌑 Nightmare Walker** achievement (`nightmare_win`, roster 17→18) on a Nightmare win; a Nightmare win also grants 🔥 No Mercy (`hard_win` now `hard || nightmare`). The Daily Challenge still rolls only normal/hard, so it never lands on Nightmare.

**Owner FEEDBACK items knocked out this run:**

1. **Progressive late-game hardness on Hard/Nightmare** ("scale the hardness on hard more as the waves progress … good early, easier mid, super easy late; campaign is good"). A new `lateScale` multiplier in `enemyTemplate()` (cd-game.js), **gated to `gameMode==='quick'` AND `hard`/`nightmare`** — so Normal/Easy and ALL campaign runs are byte-identical (the test-[16] Normal HP invariant is untouched; campaign already ramps via `campScale`, which the owner praised). It ramps from a wave threshold and **caps**, so each later wave is a bigger jump (the literal ask) while staying bounded: hard = `+1.5%/wave from w15, cap +25%` (≈+7.5% w20, +22.5% w30); nightmare = `+2%/wave from w10, cap +40%`. Bosses derive from the template, so late bosses harden too.
2. **Railgun Penetrator nerf** ("does too much at lvl 5 with Penetrator — more than snipers"). `effDmg`'s `railpen` multiplier `1.35 → 1.20` (+35% → +20%); spec desc updated. The piercing Railgun is a positioning side-grade again, not a Sniper-beater.
3. **Tougher leaks** ("the enemies that have increased life taking should be upped"). The ‼ Breacher (and the Mayhem **Breacher Surge** conversion) now costs **3 lives** on a leak, up from 2 (`lifeCost:2 → 3` in `buildWave`; the leak site already reads `e.lifeCost`). **Bosses already cost 5 lives** — more than the requested 3 — so they were deliberately left unchanged (lowering them to 3 would be a *nerf*, opposite to "should take more lives"); noted in FEEDBACK for owner confirmation.
4. **Campaign auto-level-select** ("auto-select the next level on back-to-menu instead of clicking Next; select the last completed level when clicking Campaign"). Clicking the **Campaign** mode button now selects `campaignDone()+1` (the next un-cleared level); and `backToMenu()` after a campaign **win** (`victory` true) auto-advances `campLevel` so the menu shows the next level pre-selected.
5. **Start-menu polish slice** ("the main interface is getting clunky … revamp the whole starting menu", [high priority]). The 6 secondary buttons (`.startUtil`) are now grouped into a single bordered **toolbar bar** (same visual language as the `.startOpts` config card), so the menu reads as deliberate stacked panels instead of scattered buttons. CSS-only on the existing `.startUtil` div (stays `#startScreen`'s last child, test [58]). The fuller left-rail revamp stays **PENDING** (per owner pref, the item is left as-written until fully done).

**Tests.** New group **[109]** asserts: Penetrator now ×1.20; Breacher `lifeCost===3` (enemy + Breacher Surge); the hard/nightmare quick `lateScale` ramps + caps while Normal is unchanged; the Nightmare `DIFFS` entry + records keys; the Nightmare-win achievements; and campaign auto-advance on back-to-menu + mode-switch. `sw.js` cache → `v2.0.0` (test [49]).

**Why it's safe.** New tier + new keys are additive (old saves read them as 0); `lateScale` is gated away from Normal/Easy/Campaign so no existing balanced surface moves; the Railgun/Breacher tweaks are single bounded numbers. No save-schema change.

## v1.100.1 — 2026-06-16 — 🐛 Ability-bar bug fixes — Gold Rush gated pre-wave + Barrier charges fade

**Type:** Bug fix (owner FEEDBACK [bug]). Patch bump.

**What changed.** Two issues with the ability bar, fixed together (owner asked for both in one run).

1. **Gold Rush no longer works before the waves start.** `triggerAbility()` was gated on
   `started` but not on whether any wave had begun, so on the board before round one you could
   fire 💰 Gold Rush over and over (waiting out the 60s cooldown each time) to bankroll a full
   board of towers before a single enemy spawned — an economy exploit. The `rush` branch now
   early-returns with a small `⏳ Start a wave first` floater while `wave < 1`. Once Wave 1 has
   started, `wave` is ≥1 for the rest of the run, so normal between-waves use is unchanged.
2. **Barrier charges now FADE.** Banked 🛡️ leak-blocks used to persist forever if you never
   leaked, so you could pre-cast Barrier and carry the protection indefinitely. A new run-only
   `barrierTimer` is set to `BARRIER_DURATION` (20s) on cast and decayed in `update()` (only
   while charges are banked, only during live play — past the pause/draft/gameOver early-return);
   when it hits 0 any unused charges clear with a `🛡️ Barrier faded` note. The cyan exit-ring
   dims + pulses faster over its final 5s as a warning (render-only).

**Why.** Both close "free power" loopholes (an infinite-gold pre-game farm; a permanent defensive
wall) — squarely in line with the recurring "too easy" feedback. Neither adds power.

**Save-safe.** `barrierTimer` is run-only and never serialized (verified by test) — old saves and
resumed runs are unaffected. No change to chips, talents, economy, or any existing balance number.

**Tests.** New group [108] (gold-rush pre-wave gate, post-wave restore, barrier fade, run-only
non-persistence). Updated [61] (gamepad) and [94] (Capacitor) to start a wave before invoking Gold
Rush, reflecting the new gate. Full suite **1162/0 green**; verified live in-browser (v1.100.1,
BARRIER_DURATION=20, pre-wave gold unchanged, post-wave works, barrier banks→fades), zero console errors.

## v1.100.0 — 2026-06-16 — ⭐ Tower Veterancy — towers earn battlefield ranks as they rack up kills

**Type:** New game-feel / cosmetic progression. Minor bump.

**What changed.** Towers now earn a **veterancy rank** from their lifetime kills — a pure
recognition layer, like the kill-combo meter. Every tower already tracks `t.kills` (shown
in the upgrade panel and saved with the run); crossing a milestone now **promotes** it:
**15 → ⭐ Veteran** (bronze), **40 → Elite** (silver), **90 → Ace** (gold), **200 → Legend**
(legendary-pink). A small row of `★` pips sits over each tower for its rank, the upgrade
panel names the rank beside the kill count, and the instant a tower ranks up it flashes a
particle burst + a floating `⭐ ELITE!` banner + a touch of screen-shake + a rising
`SFX.rankup()` chime (the pips pulse brighter for ~0.7s via a run-only `rankFlash`).

**Why.** The owner likes addictive progression loops, chunky game-feel, and the occasional
surprise — veterancy turns the reliable workhorse gun into a decorated unit you get attached
to, watching its kill count climb toward the next star. It's the first *per-tower* progression
the game has shown.

**"Too easy"-safe / balance-neutral.** Veterancy grants **NO stats whatsoever** — no damage,
range, fire-rate or economy — so it cannot make a run easier (mindful of the recurring
"too easy" feedback). It is recognition/feedback only, exactly like the combo meter.

**Save-safe.** Ranks are *derived* from the kill counts already serialized in `cd_save`, so a
resumed run keeps every tower's hard-earned rank and old saves simply start at their stored
counts. Buff/booster towers deal no damage, so they stay rankless (Rookie). No new
localStorage key, no schema change.

**Implementation.** `TOWER_RANKS` + `towerRankTier()`/`towerRank()` in `cd-defs.js`; the
promotion flash in `damage()`'s kill block + a `rankFlash` decay in the tower-fire loop
(`cd-update.js`); the pips in `draw()` (`cd-render.js`); the panel label + a `towerRankTier`
hash in `upgradeKey()` (`cd-game.js`); `SFX.rankup(tier)` (`cd-core.js`). `sw.js` cache
bumped to `v1.100.0`.

**Tests.** New group **[107]** — helper thresholds (0/15/40/90/200), a real milestone kill
promotes the tower (`rankFlash` fires) exactly once, `effDmg` is unchanged by rank (cosmetic),
a non-milestone kill doesn't re-fire, and a rank survives a save/resume round-trip. Full suite
**1153/0 green**, zero console errors.

---

## v1.99.0 — 2026-06-16 — ⬢ Bastion Surge — 20th Mayhem wave modifier (blast-shell escorts resist explosive splash)

**Type:** New content (Mayhem wave modifier). Minor bump.

**What & why:** Added **Bastion Surge** (`bastions`, ⬢), the 20th Mayhem wave modifier — the
**wave-wide cousin of the ⬢ Bastion enemy**, exactly as Warden Surge / Breacher Surge / Jammer Surge
mirror their respective enemies. When it rolls, a fraction of the wave's would-be basic enemies are
**converted** into ⬢ Bastion escorts (slot `i%4===1`, **norm-only**, in `buildWave`'s enemy loop right
after the Jammer Surge line) — heavy blast-shells carrying `aoeResist:true`. Because the resist already
lives at the two explosive-splash loops in `hitEnemy()` (the Cannon bomb + Mortar shell deal an
`aoeResist` enemy ×0.5), **no damage/render code changed** — only the one-line conversion. A
densely-shelled wave pressures the documented dominant **AoE/splash-clear** build (a big part of the
recurring "too easy" feedback) on the **damage-source axis** no other mod touches: a pure-bombardment
line chunks the wave slowly and is pushed to bring single-target DPS (Gun/Sniper/Railgun deal full
damage, and Tesla chain / Overkill detonation are not "explosion"-coded so they're unresisted either).

**Bounded / "too easy"-safe:** it's a **conversion not an addition** (wave length unchanged), it's
**resist not immunity** (×0.5), the bastions have only moderate HP (×1.6) and a slightly heavy gait
(×0.9) so any direct-fire line stops them, and only one modifier is ever active at a time (no stacking
with wardens/breachers/jammers despite the shared `i%4===1` slot). It can't make a run easier.

**Save safety:** the modifier and its converted enemies are **run-only** and never serialized, so old
saves load unchanged and there's no schema/economy/balance impact. `WAVE_MODS` 19 → 20.

**Test evidence:** new test group **[106]** — Bastion Surge is in `WAVE_MODS`; it adds bastions to a
wave-10 wave (none naturally before w14); converted bastions are well-formed (`aoeResist`/`maxHp`/slate
colour/r=14); it converts rather than lengthens (wave length unchanged, `fast` count untouched); it's
inert when off; a converted bastion takes **half** Cannon-bomb splash vs a norm's full; and a real
Mayhem run with the mod in the pool drives clean. Full suite **1145/0 green**, zero console errors.

## v1.98.0 — 2026-06-16 — 🟣 Nexus — new 6th quick-play map (central crossfire convergence, Violet theme)

**Type:** New content (map). Minor bump.

**What & why:** Added **Nexus**, the 6th hand-crafted quick-play map (inserted in `cd-maps.js`'s
`MAPS` table before Mayhem, so Mayhem stays the last key). Unlike every other map — which keeps
enemies flowing past your towers — Nexus folds the path back on **itself**: the route weaves through
a central convergence zone several times from different directions, so a tower wedged in one of the
crossing pockets rakes the same crowd repeatedly as it loops through the middle. That's a genuinely
distinct identity from the Gauntlet's *parallel* kill-box runs — there the lanes sit side-by-side;
here they actually **intersect** (the long vertical run at x=450 and the long horizontal run at y=280
cross at the dead-center point 450,280, with several more crossings around it). Splash towers, Tesla
chains and the Railgun's piercing line-beam feast on the overlapping traffic; the open outer arms
reward range. It carries the **Violet** palette (`MAP_THEME.nexus = 'violet'`) as its signature look —
the last of the six static themes that wasn't yet a map's identity (Violet was already in
`CAMPAIGN_THEMES`, so no new palette was needed). Path length ≈3300, axis-aligned, enters off-left
(−30) and exits off-right (930).

**Fully additive & save-safe:** the map shows up automatically in the start-screen picker, the Records
waves/scores grids, and `loadRun()` validation (all iterate `Object.keys(MAPS)` / read `MAPS[mapKey]`);
it gets its own additive `cd_best_nexus_<diff>` / `cd_bestscore_nexus_<diff>` keys (read `|| 0`, so old
saves are unaffected). No gameplay, balance, economy, or save-schema impact. Campaign still rolls a
random tame palette per attempt (unchanged); only the quick-mode Nexus map has Violet as a fixed
identity.

**Tests:** New group **[105]** — map exists/named, axis-aligned path in-bounds entering left/exiting
right, sits before Mayhem, maps to the Violet theme (palette resolves on a real run), appears in the
selector, **the path crosses itself at the central convergence (450,280)** (the identity assertion), a
real god-tower run drives clean to wave 5+, and per-map best + save/resume round-trip. Full suite
**1136/0 green**, zero console errors. Double-click `file://` play unaffected (additive data only).

## v1.97.0 — 2026-06-16 — 🔌 Surge Protector — new rare run perk (towers shake off jamming 3× faster)

**Type:** New content (run perk). Minor bump.

**What & why:** Added **🔌 Surge Protector** (`surgeprot`, rare), the **first player counter to the game's tower-disabling content**. The game grew three sources that knock a tower offline by setting its run-only `t.empT` timer — the Mayhem ⚡ **Static Storm** modifier (2.2s), the 🔵 **Disruptor** boss (2.2s), and the ⚡ **Jammer** enemy (1.6s) — but the player had no answer; a jammed tower just sat dark for the full window. Surge Protector multiplies the **`empT` decay rate ×3** (via `perkState.empResist`), so a jammed tower recovers in ~⅓ the usual time (a 2.2s blackout → ~0.73s, a 1.6s one → ~0.53s). It answers all three sources at once because they share the same `empT` infrastructure: the change is a **single site** — the per-frame decay line in `cd-update.js`'s tower-fire loop (`t.empT -= dt * perkState.empResist`).

**Why a perk / why "too easy"-safe:** it's a fresh **defensive / tower-uptime axis** no other perk touches (the pool had damage/rate/gold/CC/range/ability-cooldown perks but nothing for jam resistance), so it's a meaningful, situational draft choice — like the slow-boosting **Cryo Tech** doing nothing without slows, Surge Protector does nothing in a run with no jamming. It adds **zero damage, range, or economy** — it only shortens downtime, so it can't make a run *easier*; it's pure counter-pressure to the recent jam content (Static Storm / Disruptor / Jammer), squarely in keeping with the "too easy" feedback's design (answer pressure with tools, not raw power). A **rare** (not legendary), so `resolveWildcard()` won't roll it.

**Save-safe / additive:** `empResist` lives **inside `perkState`** (added to `freshPerkState()`, default `1`), so it's persisted whole by `saveRun()` and restored save-safely via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)` — old saves default to `1` (no bonus). No new localStorage key, no economy/balance/schema impact.

**Test evidence:** new test group **[104]** (perk in pool + rare/not-legendary; `apply` sets `empResist ×3`; the `empT` decay folds in `empResist` so a protected tower fully recovers a 1.2s jam within 0.5s while a baseline tower is still offline; `freshPerkState` default 1; save/reload round-trip; old-save migration to 1; zero console errors). Full suite green (1110 → 1120 assertions).

**Files touched:** `cd-defs.js` (perk + `freshPerkState`), `cd-update.js` (decay multiplier), `cd-core.js` (version + What's-New entry), `sw.js` (cache bump), `tests/run-tests.mjs` ([104]).

## v1.96.0 — 2026-06-16 — 📡 Jammer Surge — 19th Mayhem wave modifier (tower-disabling escorts)

**Type:** New content (Mayhem wave modifier). Minor bump.

**What & why:** Added **📡 Jammer Surge** (`jammers`), the 19th Mayhem wave modifier and the wave-wide cousin of the v1.91.0 ⚡ Jammer enemy — explicitly listed as an open follow-up in ROADMAP ("a Mayhem 'jammer surge' wave-mod cousin"). When it rolls, `buildWave` converts every would-be basic `norm` at slot `i % 4 === 1` into a ⚡ **Jammer escort** (`hp ×1.15`, `spd ×0.95`, full jammer stats) — exactly mirroring the Warden Surge (v1.51.0) and Breacher Surge (v1.80.0) conversion pattern: only `norm`s convert (the rarer special kinds are untouched) and it's a **conversion, not an addition**, so the wave is no longer than usual. Each converted jammer is driven by the existing general `e.kind === 'jammer'` tick in `update()` (its lazy `e.jamCd` pulse knocks the nearest non-buff tower within 105px offline via `t.empT`, reusing the Static Storm `empT` infrastructure), so a **densely-jammed wave produces several roaming tower-blackouts** instead of `emp`/Static Storm's single global timer — pressuring **tower uptime / coverage / spacing** on a fresh axis no other mod hits the same way. This serves the long-running "too easy" feedback off the invariant-capped HP curve.

**Bounded / "too easy"-safe:** each jammer disables just one tower per pulse for a brief self-recovering window, buff/support towers are immune, freeze pauses the sabotage, and only one mod is ever active at a time (so no stacking with wardens/breachers despite the shared `i % 4 === 1` slot). It converts existing enemies rather than adding HP/speed, so it can never make a run *easier*. Mayhem-only.

**Save-safe:** the modifier and its converted enemies are run-only and never serialized — old saves load unchanged; no chips/talents/gold/economy/balance/schema impact. Render (electric-yellow ring + ⚡ glyph), `waveComposition`/`waveThreat`/`KIND_HP_MULT`, and the colorblind legend already learned the Jammer enemy in v1.91.0, so the surge needed **only two lines** (a `WAVE_MODS` entry + the `buildWave` conversion).

**Tests:** new group **[103]** (8 + 1 checks): `WAVE_MODS` includes Jammer Surge; the surge adds jammers; converted jammers are well-formed (maxHp/colour/radius); it converts without lengthening the wave; special kinds untouched; inert when off; a converted jammer disables the nearest tower; no console errors; and a full Mayhem run with the mod in the pool drives to completion without hanging. **Suite 1110/0 green** (was 1101/0).

## v1.95.0 — 2026-06-16 — 🩺 Health check — all green (1101/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass; 6 normal runs since v1.89.1: v1.90.0–v1.94.0). Patch bump. No new feature.

**What ran:**
- **Refactor audit** — all seven game source files comfortably under the ~1,500-line cap (largest: `cd-update.js` 1,247). No dead code, no `console.log`/debug logging, no real TODO/FIXME markers. The dev-only test harness `tests/run-tests.mjs` is now **6,937 lines / 102 groups / 1,101 assertions** — still the largest file in the repo and still flagged for a per-group split (ROADMAP, low priority).
- **Docs coherence** — `GAME_VERSION`, the CHANGELOG top entry, and the `sw.js` offline cache const all read **v1.95.0** (bumped this run; test [49] pins cache === GAME_VERSION). Every headline count in CLAUDE.md matches the code: **9 towers, 5 abilities, 23 talents, 17 achievements, 18 Mayhem wave modifiers, 11 boss archetypes, 6 targeting modes, 12 enemy kinds (+ boss)**, plus the boss HP slope (×0.6/wave), boss armor slope (×0.5/wave) and the enemy-HP curve. Fixed the one piece of doc rot found: the ROADMAP "Split the test harness file" note still cited ~6,581 lines / 97 groups / 1045 assertions, and the table-stakes re-audit version list was missing this run.
- **Table-stakes audit** — checklist remains **complete** (favicon/meta/OG, PWA install + offline SW, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, ≥44px tap targets). No new gaps.
- **Integrity spot-checks** — full suite **1101/0, exit 0**, zero console errors (verified by subagent). Double-click `file://` playability intact: seven classic `<script src>` tags in dependency order, no `type="module"`, inline SVG favicon, all relative paths, no build step. Old-format save migration confirmed: `loadRun()` fills `abilityCd` (incl. the new `barrier`/`shock`) and the whole `perkState` from additive `Object.assign` defaults, so a minimal pre-update `cd_save`/`cd_meta` loads cleanly.

**Why:** routine maintenance — keep the docs honest, the files lean, and the basics solid. **No gameplay, balance, economy, save-schema, or behaviour change** (only the version/cache strings + this changelog moved).

## v1.94.0 — 2026-06-16 — ✨ Start-menu hover polish — responsive utility & secondary buttons

**Type:** UX polish (CSS-only). Minor bump. Latest slice of the ongoing "start-menu revamp" FEEDBACK item (after v1.39.1 hierarchy, v1.41.0 PLAY sheen, v1.42.0 config card, v1.45.0 hero header, v1.69.0 ambient backdrop).

**What:** Gave the start-menu **utility toolbar** (Talents / Achievements / Records / What's New / Settings / Reset) and the **secondary play-row** buttons (Resume Run / Daily Challenge) a proper hover affordance. They previously only faded opacity `.9→1` (util) or did nothing at all (Resume/Daily) on hover, which read flat/clunky. Now on hover they **lift 2px, brighten (`filter: brightness(1.12)`), and cast a soft drop-shadow** on a smooth `.14s` transition, and press back down (`translateY(0)`) on `:active`.
- New rules in `tower-defense.css` right after the `.startUtil` block: a shared `transition` + `:hover`/`:active` treatment scoped to `.startUtil .ctl, .startPlay .ctl:not(.play)`.
- The primary **▶ PLAY** button is excluded via `:not(.play)` so its animated `playGlow` box-shadow is never overridden.

**Why:** Owner FEEDBACK (`[low priority]`, still PENDING as-written): "the main interface is getting clunky … revamp the whole starting menu." The button sizing was fixed long ago; the remaining gap (per ROADMAP) was "richer hover states on the util buttons." Flat, unresponsive hover is a big part of the "clunky" read.

**Reduced-motion:** the existing `@media (prefers-reduced-motion: reduce)` block now also sets `transform: none` on the hover/active states, so the **lift** is dropped while the brighten/shadow stay (matches the project's reduce-motion care, like the v1.41.0 PLAY sheen).

**Save-safe / scope:** pure CSS, no markup/JS change → no layout, gameplay, balance, economy, or save impact; `.startUtil` remains `#startScreen`'s last child (test [58]/[60] invariant) and the mobile `!important` sizing rules are untouched.

**Tests:** new group **[102]** (hover lift via real Playwright `.hover()` + computed-style read on a util button; PLAY button excluded from the lift; reduce-motion drops the transform; transition present; no console errors). Full suite green. `sw.js` `CACHE` bumped to `circuit-defense-v1.94.0`.

## v1.93.0 — 2026-06-16 — 🛡️ Barrier — new 5th active ability (vaporize leaking enemies, no lives lost)

**Type:** Content (new active ability). Minor bump. Abilities 4 → 5.

**What:** Added **🛡️ Barrier** to the ability bar (hotkey **T** / gamepad **Y**) — the first new ability since Shockwave (v1.67.0). Casting it banks **3 charges** (`BARRIER_CHARGES`); each charge **vaporizes the next enemy that reaches the exit for zero lives lost** (consumed at the single leak site in `cd-update.js`, before the life-deduction `else` branch). A pulsing cyan shield ring + `🛡️N` counter renders over the 🏠 exit marker while charges are banked. Cooldown 60s; deals no damage, pays no bounty.
- `ABILITIES.barrier` + `BARRIER_CHARGES = 3` + a `triggerAbility('barrier')` branch (`cd-defs.js`).
- Run-only `barrierCharges` global (`cd-state.js`, declared + zeroed in `resetState()`, **never serialized**).
- Leak-site if/else: `barrierCharges>0` → decrement + exit burst + `SFX.barrier()`, no `lives`/bounty change; else the unchanged real-leak path (still `endGame()`s at `lives<=0`).
- Hotkey **T** (`cd-game.js` keydown), gamepad **Y** = button 3 (`pollGamepad`), `SFX.barrier()` shield-up shimmer (`cd-core.js`), exit shield render (`cd-render.js`).

**Why:** The four existing abilities cover damage (Meteor), CC (Freeze), economy (Gold Rush) and knockback (Shockwave) — there was no pure **defensive** panic button. Barrier fills that roster gap and directly counters the recent leak-pressure content (the ‼ Breacher enemy + Breacher Surge mod, which cost 2 lives per leak); it even blocks a boss leak (which would otherwise cost 5).

**Balance ("too easy"-safe):** purely defensive — no damage, no bounty, capped at 3 charges per cast on a 60s cooldown, and it only matters when you were about to *lose* a life, so it can't speed clears or snowball an already-winning run (it only softens a near-loss). Counts as an ability cast (sets `abilityUsedThisRun`, so it forgoes 🕊️ Pacifist like the others).

**Save-safe:** `barrierCharges` is run-only and never written to `cd_save` (resets to 0 on resume); `loadRun()`'s `abilityCd` `Object.assign` default gains `barrier:0` so old saves migrate cleanly. No economy/schema impact.

**Tests:** new group **[101]** (14 checks: ability registered on T; charges bank/spend; 3 leaks blocked then the 4th costs a life; blocked leak pays no gold; boss leak blocked by one charge; cooldown gate; never serialized; resets on resume; old-save migration; no console errors). Full suite **1095/0 green**. Verified in-browser (5 ability buttons, leak + boss-leak blocked, clean render, zero console errors). `sw.js` `CACHE` bumped to `circuit-defense-v1.93.0`.

## v1.92.0 — 2026-06-16 — 🔭 Farsight — new meta talent (+2%/rank global tower range)

**Type:** Content / progression (new meta talent). Minor bump. Talents 22 → 23.

**What:** Added **🔭 Farsight** to the CORE talent tree (`max 5`, cost `9 + 7·r` → 150 chips to max — the same curve as Piercing). Each rank gives **+2% firing range to all towers**, capped at **+10%** at rank 5. Wired via a new `metaRangeMult()` (`1 + 0.02·rank`, in `cd-defs.js` beside `metaDmgMult`/`metaCostMult`/`metaCdMult`) multiplied into `effRange()` (`cd-game.js`).

**Why:** The meta tree had no range axis — every other talent pushes damage (Firepower/Crit Lab/Masteries), economy (Scholar/Engineering/Banking/Fortune/Salvage), lives (Fortitude), or cooldowns (Surge); range was a damage-only progression dead end (the per-type Masteries give a tiny +2%/rank and Targeting Array is a *run-only* rare perk). Range is the gentlest power lever (it helps you *hit*, not hit harder), so it's a "too easy"-safe meta choice rather than raw DPS creep, and it directly counters the recent coverage-pressure content (Breacher double-leaks, Jammer tower-disables, cloak/fog). Applies to **firing range only** (`effRange`), never booster auras (`effBuffRange`) — the same boundary Targeting Array/Glass Cannon respect, so it can't feed the documented booster-coverage snowball.

**Balance:** +10% max range is well inside the ≤25%/number/run guardrail; it's a persistent meta talent gated behind a real chip grind. `upgradeKey()` already hashes `effRange`, so the upgrade panel live-updates.

**Save-safe:** purely additive — `loadMeta()`'s `Object.keys(TALENTS)` migration loop defaults the new `farsight` key to 0 for any old `cd_meta`, and `resetTalents()` refunds it generically. No new localStorage key, no economy/save-schema impact.

**Tests:** new group **[100]** — talent exists in CORE (max 5); rank 0 → `metaRangeMult 1` (no effect), rank 5 → +10% firing range; booster aura range untouched; `loadMeta` migrates a pre-Farsight save (key defaults 0); zero console errors. Full suite green.

**Note:** the talent code (the `farsight` definition + `metaRangeMult()` + the `effRange` wiring) was present uncommitted in the working tree at the start of this run (an interrupted prior run); this run verified it, added the missing test [100], and completed all version/doc bookkeeping.

## v1.91.0 — 2026-06-16 — ⚡ Jammer — new enemy that knocks your towers offline

**Type:** Content (new enemy kind). Minor bump. Enemy kinds 11 → 12.

**What & why.** Added the **⚡ Jammer**, a tower-**disabling** enemy that appears from **wave 16 in every mode** (Classic, Campaign, Mayhem). While alive (and not frozen) it periodically knocks the **nearest firing tower offline** for ~1.6s as it advances, so a small coverage blackout rolls down the path with it. This targets the long-standing **"too easy"** feedback on a **fresh axis — tower uptime/coverage**. Until now, tower-disable lived only on the deep **Disruptor** boss (w20+) and the Mayhem-only **Static Storm** wave-mod; the Jammer is the **regular-enemy cousin** of those (just as the Molten brought CC-immunity from boss/mayhem to a regular enemy), bringing that pressure to **Classic & Campaign** — the modes the owner flagged as too soft — off the invariant-capped HP curve. It rewards spacing towers out, building redundancy, and focusing the Jammer down fast.

**Bounded / "too easy"-safe.** It can never make a run *easier*: modest HP (`×1.15`), near-normal speed (`×0.95`), **one tower per pulse**, a **brief 1.6s** disable on a ~3s cycle (shorter than Static Storm/Disruptor's 2.2s), **buff/support towers immune**, **freeze pauses it**, a **local 105px reach**, and any disabled tower **self-recovers** (the `empT` timer decays unconditionally even if the Jammer dies mid-disable).

**Implementation (confined diff, reuses existing EMP infra).**
- `buildWave` (cd-game.js): appended `if (w >= 16 && i % 15 === 14) e = { kind:'jammer', hp:t.hp*1.15, spd:t.speed*0.95, r:12, bounty:Math.ceil(t.bounty*1.9), color:'#f2e34a', armor:0, gap:0.8 }` — the final regular-kind override on a slot collision. `waveComposition` + `KIND_HP_MULT` (=1.15) mirror it (drift-guarded by test `[40]`).
- The EMP **pulse lives in the enemy loop** (cd-update.js, gated `e.kind==='jammer' && e.frozen<=0`): a lazy `e.jamCd` timer (~3s) sets the nearest in-range non-buff tower's `t.empT = 1.6` + a cyan burst + `SFX.zap()` + small shake. It **reuses the Static Storm `empT` infrastructure** — the firing-skip, per-frame unconditional decay, and render dim/⚡ ring are all general (not mod-gated) — so the pulse is the only new logic.
- Render (cd-render.js): electric-yellow sphere `#f2e34a`, always-shown `⚡` glyph (`enemyGlyph`/`GLYPH_FONT`/`PREVIEW_COLOR`), an electric-yellow cue ring keyed on `e.kind==='jammer'`, plus the colorblind symbol-legend entry (cd-update.js).

**Save-safe.** Enemies are run-only (never persisted) and `jamCd` is lazily initialised — no save/schema change, no economy/balance impact on existing numbers. `GAME_VERSION` → v1.91.0; `sw.js` `CACHE` bumped to match.

**Tests.** New group `[99]` (cd tests/run-tests.mjs): wave gating (none <16, present ≥16), HP = template×1.15, knocks the nearest tower offline, freeze pauses it, buff towers immune, out-of-range (>105px) safe, composition/glyph/colour/HP-mult plumbing + `waveThreat===buildWave` sync at w16, and a wave-16+ god-tower integration run that clears alive. Full suite **1075/0 green**; verified in-browser (jammers gate at w16, a real tower hits `empT≈1.58`, ⚡ glyph, clean `draw()`, zero console errors).

## v1.90.0 — 2026-06-16 — ⬢ Bastion — new enemy that resists explosive splash

**Type:** Content (new enemy kind). Minor bump. Enemy kinds 10 → 11.

**What & why.** Added the **⬢ Bastion**, a heavy "blast-shell" enemy that appears from **wave 14 in every mode** (Classic, Campaign, Mayhem) — the first new enemy kind since the Molten (v1.77.0). It takes **50% less damage from the two explosive splash towers** (the Cannon's bomb and the Mortar's shell). This targets the long-standing **"too easy"** feedback on a **fresh axis**: splash/AoE bombardment is the dominant clear-everything build and nothing pushed back on it. The Bastion does — a pure Cannon/Mortar wall chips these down slowly, so they reward bringing **single-target DPS** (Gun/Sniper/Railgun all deal it **full** damage). A meaningful build decision, not a raw HP spike.

**Bounded / "too easy"-safe.** It's **resistance, not immunity** (×0.5), with only moderate HP (`×1.6`) and a slightly heavy gait (`×0.9`), so any direct-fire line stops it cleanly — it can never make a run *easier*. **Tesla's chain lightning and the Overkill perk's true-damage detonation cut through it normally** — it's specifically the *explosive* towers it armors against.

**Implementation (confined diff, no `damage()` signature change).**
- `buildWave` (cd-game.js): appended `if (w >= 14 && i % 14 === 13) e = { kind:'bastion', hp:t.hp*1.6, spd:t.speed*0.9, r:14, bounty:Math.ceil(t.bounty*2.2), color:'#7a86c8', armor:0, gap:0.85, aoeResist:true }` — the final regular-kind override on a slot collision. `waveComposition` + `KIND_HP_MULT` (=1.6) mirror it (drift-guarded by test `[40]`).
- The **resist lives at the two splash loops in `hitEnemy()`** (cd-update.js): each multiplies `p.dmg` by `(e.aoeResist ? 0.5 : 1)` before `damage()`. `damage()` itself is untouched, so the direct-fire path (`else`/`bullet`), Tesla chain (`fireChain`), and Overkill detonation are all full-damage by construction.
- Render (cd-render.js): slate sphere `#7a86c8`, always-shown `⬢` glyph (`enemyGlyph`/`GLYPH_FONT`/`PREVIEW_COLOR`), a slate cue ring keyed on `e.aoeResist`, plus the colorblind symbol-legend entry.

**Save-safe.** Enemies are never serialized, and `aoeResist` is a run-only flag, so old saves load unchanged; no new localStorage key, no economy/balance change to any existing number.

**Tests.** New group `[98]`: wave gating (none < w14, present from w14), `aoeResist` tag, HP ×1.6, **Cannon bomb + Mortar shell each deal a Bastion half what a norm takes** (and a **direct single-target hit deals it full**), preview plumbing (composition/glyph/colour/HP-mult/threat-in-sync), and a wave-14+ god-tower integration run clearing to w16. Full suite green (see test evidence below).

## v1.89.1 — 2026-06-16 — 🩺 Health check — all green (1045/0, docs coherent, no drift)

**Type:** Health check (maintenance, no new feature). Patch bump. This is the periodic 6th-run check (5 feature entries since the v1.84.1 health check: v1.85.0–v1.89.0).

**1. Refactor audit:** All seven `cd-*.js` files are comfortably under the ~1500-line soft cap — cd-update.js 1202, cd-render.js 854, cd-game.js 794, cd-core.js 512, cd-defs.js 447, cd-maps.js 298, cd-state.js 198. A whole-symbol cross-file sweep (incl. `tower-defense.html` string `onclick=` handlers) found **no dead code** and **no risky duplication** (the two near-duplicate CC-clear lines and the `genMayhem/CampaignPath` aliases are intentional and left as-is). No cleanup needed this run.

**2. Docs coherence:** Verified CLAUDE.md feature counts against the code — all accurate: 11 boss archetypes (`BOSS_ARCHETYPES`), 17 achievements (`ACHIEVEMENTS`), 9 towers, 6 targeting modes (`MODES`), 4 abilities (`ABILITIES`), 22 talents (`TALENTS`), 18 Mayhem wave-mods (`WAVE_MODS`). `GAME_VERSION`, `sw.js` `CACHE`, and the CHANGELOG/CHANGELOG_ENTRIES top entry are all consistent at v1.89.x. **Fixed one drift:** ROADMAP's "Split the test harness file" item still cited `~6,176 lines (92 groups, 986 assertions)` — actual is **6,581 lines, 97 groups `[1]`–`[97]`, 1045 assertions**; updated. Vetoed-by-owner section intact (still none recorded).

**3. Table-stakes audit:** The checklist remains **complete** — favicon/meta/OG, PWA install + offline, touch/pointer, gamepad, keyboard a11y (menus + draft), colorblind aid, reduced-motion, volume slider, high-DPI scaling, responsive/mobile, 44px tap targets. Only optional polish follow-ups remain (PNG icon set for stricter Lighthouse audits, remappable gamepad buttons, per-theme ground textures), already logged in ROADMAP. No new gaps found.

**4. Integrity spot-checks:** Full suite **1045/0 green**, zero console errors. `file://` playability intact — no `type="module"` in the markup, and the SW registration stays http/https-guarded. Old-save migration verified by inspection: `loadMeta()` defaults `talents`/`achievements`/`stats`/`bestCombo`; `loadRun()` guards `gameTime` (typeof), validates `mapTheme` and per-tower `mode` (`MODES.includes` → 'first'), and merges `perkState` over `freshPerkState()` so any newer perk field defaults cleanly.

**Net change:** version bumps (GAME_VERSION, sw.js CACHE, CHANGELOG_ENTRIES, What's New) + one stale ROADMAP metric corrected. No code, gameplay, balance, economy, or save changes. Resets the health-check counter.

## v1.89.0 — 2026-06-16 — 🎯 Default targeting mode — new towers inherit your chosen priority

**Type:** Quality-of-life (UX). Minor bump.

**What & why:** Every tower you place starts on the ⏩ **First** targeting priority, so anyone who prefers a different priority (focus the **Strong**est, the **Last**/furthest-along, the **Close**st, the **Weak**est finisher, or **Support** aura-poppers) has had to click each new tower and cycle its mode by hand **after every single placement** — tedious when you're building a board of 10+ towers. Now ⚙ **Settings** has a **🎯 New-tower target** picker: choose any of the six targeting modes and **every tower you place from then on inherits it automatically**. The choice is saved on this device (`cd_defaultmode`), so it sticks across runs and reloads. You can still cycle any individual tower's mode whenever you like — this only changes the *starting* default. (Explicit ROADMAP follow-up under the Weak-targeting item: "a per-tower default mode preference.")

**Bounded / save-safe:** purely a convenience — it doesn't touch tower stats, gold, chips, balance, or the save schema. The **per-tower `mode` already round-trips** through `saveRun`/`loadRun`, so loading an existing run is unchanged; the default only seeds *fresh* placements. An unrecognized/old persisted value safely falls back to **First** at both the setter and the placement site (validated against `MODES`).

**Implementation:** a `defaultTargetMode` device pref in `cd-core.js` (read raw from `cd_defaultmode`, default `'first'` — `MODES` isn't defined yet at that point, so it's validated at use); the placement site in `cd-game.js` seeds `mode: MODES.includes(defaultTargetMode) ? defaultTargetMode : 'first'`; `setDefaultMode(m)` + a data-driven Settings row (`opts: MODES.map(m => [MODE_ICON[m], m])`) in `cd-update.js`; `resetAllData()` (cd-state.js) restores it to `'first'`. **Also fixed a latent bug** in `renderSettings()`: the shared onclick builder used `JSON.stringify(val)`, which double-quotes **string** args and would have terminated the double-quoted `onclick` attribute — now string args are single-quoted (`'weak'`), booleans/numbers stay bare (no existing row passed a string, so no behaviour change there). One CSS tweak: `.setOpts` gains `flex-wrap: wrap; justify-content: flex-end` so the six mode buttons wrap cleanly to the right.

**Tests:** new group `[97]` (global + setter exist; with no default a new tower starts on First; `setDefaultMode` persists to `cd_defaultmode`; a newly-placed tower inherits the chosen default; setter **and** placement validate an unknown value back to First; every `MODES` value is a valid default; Settings renders the picker row; a saved tower keeps its own mode — no save-schema change; `resetAllData` restores First; zero console errors). Full suite **1045/0 green**.

## v1.88.0 — 2026-06-16 — ↻ Revenant — 11th boss archetype (reboots once on death)

**Type:** Content (new boss archetype). Minor bump.

**What & why:** Added the **Revenant**, the 11th boss archetype (first new one since the Hydra, v1.82.0). It enters the deep-boss rotation at **wave 70** (then every 11th boss) with a trick no other boss has: the **first** time you'd kill it, it **refuses to die** — it reboots at **35% max HP** and keeps coming, so you have to drop it **twice**. It's a fresh axis — a *death-DEFIANCE* mechanic. Every other archetype acts *while alive*, and even the Hydra dies for real (spawning weaker heads); the Revenant itself rises, with full stats and armor intact. That punishes a defense tuned to delete the boss in one clean burst and move on, and rewards keeping sustained firepower trained on it until it's truly gone. Squarely serves the long-running "too easy" feedback for **deep/late** runs, via behaviour rather than a raw HP-bar inflation.

**Bounded & fair:** it revives **exactly once** (`e.revived` latches → never an endless loop), comes back at just over a third health, and is otherwise a normal boss — a one-time twist, not a health-bar balloon. First appears at w70, so normal-length runs (Quick = 30 waves, Campaign finals ≤ w54) never even see it. A **magenta** aura ring and a **REVENANT** boss-bar badge warn you it's coming; the badge flips to **REVIVED** once its second life is spent, and an **"↻ IT RISES!"** flash with a rising power-up swell (`SFX.revenant()`) fires the moment it cheats death.

**Implementation:** one entry in `BOSS_ARCHETYPES` (cd-game.js, cycle length reads `.length` so it auto-extends) + a revive intercept in `damage()` (cd-update.js) placed **after** the HP subtraction (and the reaper-execute) but **before** the kill block, gated `e.kind==='boss' && e.bossType==='revenant' && !e.revived && e.hp<=0` — it sets `e.hp = e.maxHp*0.35`, latches `revived`, plays the FX, and `return`s (so the fake death pays **no** bounty/combo — only the real second kill pays out). Fires regardless of freeze (a death-trigger, like the hydra split). Plus a badge case + aura-ring colour in cd-render.js and `SFX.revenant()` in cd-core.js. **All run-only** — enemies are never serialized, so **no save/schema/economy/balance impact**; old saves load unchanged.

**Tests:** new group `[96]` (revenant is the 11th archetype at w70 + rotation wraps at w75; survives the first lethal hit and reboots at exactly 35% HP; latches `revived`; the fake death pays no bounty/combo; dies for real on the second kill; revives even while frozen; control — a non-revenant boss dies on the first hit; badge resolves REVENANT → REVIVED). Updated `[45]` (rotation + killable sweep now include revenant) and `[53]` (badge). Full suite **1034/0 green**.

## v1.87.0 — 2026-06-16 — ❄ Cascade — new 5th quick-play map (frozen stepped descent, Ice theme)

**Type:** Content (new map). Minor bump.

**What & why:** Added **Cascade**, the 5th quick-play map (first new map since the Gauntlet, v1.54.0). It's a **frozen stepped descent**: the path marches down-and-across in a staircase, then a tall climb and a final plunge to the exit — a flow no other map has. Where Serpent/Gauntlet double back through a single kill-box, Cascade keeps enemies making **forward progress** (more of a DPS race), and every step's **inside corner** is a tidy pocket where one tower covers two path segments at once — splash towers and the new Railgun line-beam feast on the bunched-up steps. Path length ≈1,800px (between Serpent and Gauntlet). It carries the **Ice** palette (`MAP_THEME.cascade = 'ice'`) as its fixed identity — the last of the six static themes that wasn't yet a map's signature look; `ice` was already in `THEMES` + `CAMPAIGN_THEMES`, so no new palette.

**Additive & save-safe:** the whole change is one `MAPS.cascade` entry (inserted **before** `mayhem` so mayhem stays the last key, per the architecture rule) + one `MAP_THEME` line. Everything else auto-generates from `Object.keys(MAPS)`: the start-screen MAP selector, the Records best-wave / best-score grids, the additive `cd_best_cascade_<diff>` / `cd_bestscore_cascade_<diff>` keys (read `||0`), and `loadRun`'s `MAPS[mapKey]` validation. No economy/balance/schema impact; old saves load unchanged.

**Tests:** new group `[95]` (map exists/named, axis-aligned in-bounds path entering off-left/exiting off-right, sits before Mayhem, Ice theme identity + palette resolve, appears in the selector, a real run drives clean to wave 5+, per-map best record + save/resume round-trip, zero console errors). Full suite green.

## v1.86.0 — 2026-06-15 — 🔋 Capacitor — new rare run perk (all abilities recharge 25% faster)

**Type:** Content (new run perk). Minor bump.

**What & why:** Added 🔋 **Capacitor** (rare) — the perk pool's **first all-ability cooldown reducer**: every active ability (☄️ Meteor / 🧊 Time Freeze / 💰 Gold Rush / 🌀 Shockwave) recharges **25% faster** (`abilityCdMult ×0.75`). A **genuinely fresh axis** no perk touched: the 🕳️ Singularity legendary only halves the **Meteor's** cooldown, and the 🌟 Overdrive talent's `metaCdMult()` is a permanent meta unlock, not a draft pick. Capacitor makes the underused **ability bar** a real build pillar — more Freeze/Shockwave uptime for a defensive line, more Meteor/Rush for an aggressive one — a meaningful draft choice rather than another raw-DPS bump.

**"Too easy"-safe / not power creep:** a single −25% on cooldowns that are already 30–60s long, and most abilities are **utility** (Shockwave & Freeze deal no damage; Gold Rush is gold), so it enables a *playstyle* rather than pumping board damage. It sits comfortably in the rare tier next to 🔭 Targeting Array and 🏹 Ambush.

**Implementation:**
- `cd-defs.js` — `PERKS` rare entry `capacitor` (`apply: s=>s.abilityCdMult *= 0.75`); `freshPerkState()` gains `abilityCdMult:1`; the four ability-cooldown assignments (`triggerAbility()` freeze/rush/shock + `castMeteor()`) now multiply by `perkState.abilityCdMult` alongside the existing `metaCdMult()`/`meteorCdMult`.

**Save-safe:** `abilityCdMult` lives in `perkState`, persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)`; old saves default `1`. No new localStorage key, no economy/schema impact. Ability cooldowns themselves are never persisted (run-only). It's a *rare*, so the legendary-only Wildcard doesn't roll it.

**Test:** new group **[94]** — perk is in the pool as rare (and not legendary, so Wildcard can't roll it); `apply` sets `abilityCdMult` to 0.75; all four abilities (freeze/rush/shock/meteor) fold the multiplier into their assigned cooldown; `freshPerkState` default 1; save/reload round-trip; old-save migration to default 1. Full suite green (subagent-run), zero console errors.

## v1.85.0 — 2026-06-15 — 🏹 Ambush — new rare run perk (+30% damage to high-HP enemies)

**Type:** Content (new run perk). Minor bump.

**What & why:** Added 🏹 **Ambush** (rare), the **opener counterpart** to the 💀 **Reaper** legendary. Reaper *executes* non-boss enemies below 12% HP (a finisher); Ambush adds **+30% damage to any enemy still above 80% HP** (an opener). Drafting both gives a thematic "open big, then execute" bookend build. It's a **fresh damage axis** — every other damage perk is either flat (Diamond Core, Overcharge) or tower-type-keyed (Sharpshooter, Heavy Rounds, Frostbite); Ambush is the first keyed to the target's **current HP fraction**.

**"Too easy"-safe / not power creep:** the bonus only ever touches the *first* hits on a unit. Trash you'd one-shot anyway gains nothing; a high-HP boss spends only a brief window above 80%, so the real-world payoff is far below a flat +30% type buff. It's strictly narrower than the common +30% type-damage perks, so it sits comfortably (on the modest side) in the rare tier — keeping faith with the recurring "too easy" feedback.

**Implementation:**
- `cd-defs.js` — `PERKS` rare entry `ambush` (`apply: s=>s.ambush = true`); `freshPerkState()` gains `ambush:false`.
- `cd-update.js` — one line in the tower-fire loop, after the boss-damage line and before the proj/chain branch (so chain/rail/poison opening shots benefit too): `if (perkState.ambush && target.hp > target.maxHp * 0.8) dmg *= 1.3;`. Keyed to the primary target's **current** HP → it lives in the fire path, **not** `effDmg()` (so the upgrade panel doesn't churn — mirrors Reaper/Killing Spree). No `upgradeKey` change needed.

**Save-safe:** `ambush` lives in `perkState`, persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)`; old saves default `false`. No new localStorage key, no economy/schema impact. (It's a *rare*, so the legendary-only Wildcard doesn't roll it.)

**Test:** new group **[93]** — perk is in the pool as rare; **not** reflected in `effDmg` (panel-churn guard); a rail shot deals exactly +30% to a >80%-HP enemy and +0% to a <80%-HP one (one-tick `update()` drive); `freshPerkState` default false; save/reload round-trip; old-save migration to default. Full suite green (subagent-run), zero console errors.

## v1.84.1 — 2026-06-15 — 🩺 Health check — all green (986/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v1.79.1: v1.80.0, v1.81.0, v1.82.0, v1.83.0, v1.84.0.)

**Test suite:** Green — **986 assertions across 92 groups [1]–[92], 0 failures, exit 0**, zero console errors (subagent-run).

**Integrity spot-checks:**
- **`file://` playability:** intact — `tower-defense.html` links the CSS + seven classic `<script src>` tags in dependency order (`cd-core`→`cd-maps`→`cd-defs`→`cd-state`→`cd-game`→`cd-update`→`cd-render`), **no `type="module"`**, inline-SVG favicon, all relative paths, no build step. `index.html` redirect intact. The SW registration in `cd-render.js` stays http/https-guarded, so double-click play + the headless harness (both `file://`) are unaffected.
- **Old-save migration:** the suite's save/resume + old-format-save groups pass; `loadRun()` restores newer fields via additive defaults — `gameTime` (guarded `typeof === 'number'`, else 0), `mapTheme` (validated against `THEMES`/chaos, else `pickMapTheme()`), `perkState` (`Object.assign(freshPerkState(), s.perkState)` so every new flag defaults off), per-tower `mode` (`MODES.includes()` guard → 'first'); `loadMeta()` still defaults `achievements`/`stats`/`bestCombo` for minimal `cd_meta`.
- **PWA cache version:** `sw.js` `CACHE` bumped `circuit-defense-v1.84.0 → v1.84.1` to match `GAME_VERSION` (test [49] guards this).

**Docs coherence (CLAUDE.md vs code — all match):** 9 towers (`TOWER_TYPES`), 10 enemy kinds + boss (`PREVIEW_COLOR`), **10 boss archetypes** (`BOSS_ARCHETYPES`: regen/summoner/bulwark/enrager/teleporter/berserker/disruptor/juggernaut/siphon/hydra), **18 Mayhem wave mods** (`WAVE_MODS`), **17 achievements** (`ACHIEVEMENTS`), 6 targeting modes (`MODES`), 4 abilities (`ABILITIES`), 22 talents / 9 mastery (`TALENTS`), boss HP slope `14 + w*0.6`, boss armor slope `w*0.5`. `CHANGELOG_ENTRIES` newest = `v1.84.0`, in sync with this file. Versions consistent everywhere.

**Refactor audit:** every game file under the ~1500-line cap (largest `cd-update.js` ~1175, then `cd-render.js` ~853, `cd-game.js` ~791). No dead code, debug logging (`console.log`/`debugger`), or TODO/FIXME markers in the `cd-*.js` files. The dev-only test harness `tests/run-tests.mjs` is now **~6,176 lines** (the largest file in the repo) — still flagged on ROADMAP for a per-group split; low priority (suite ~30s, green).

**Table-stakes audit:** checklist remains **complete** (favicon/meta/OG, PWA install + offline, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI scaling, responsive/mobile, bigger tap targets). Only open follow-ups are non-blocking: a raster PNG icon set for stricter PWA installability audits (needs a binary asset; repo is asset-free), and the long-standing test-harness file split.

**Findings → ROADMAP:** refreshed the test-harness-size note (was "5,810 lines / 87 groups / 938 assertions" → "6,176 lines / 92 groups / 986 assertions") and appended v1.84.1 to the table-stakes re-audit list. No bugs found; no code behavior changed this run.

---

## v1.84.0 — 2026-06-15 — 🎯 Sharpshooter — new achievement (master the Railgun's piercing line)

**Type:** New content (achievement). Minor bump.

**What:** A 17th achievement badge — **🎯 Sharpshooter** (`railhit5` in `ACHIEVEMENTS`, cd-update.js): *Hit 5+ enemies with a single Railgun beam.* The Railgun (v1.83.0) is the only tower that fires a dead-straight line and rakes every enemy it crosses, so this badge rewards mastering its signature trick — line the shot down a long straight path run (the Gauntlet kill-box, serpentine bends) when a crowd is bunched and one shot skewers the whole column. A new run-only counter `railBestHit` (declared in cd-state.js beside the combo vars, reset in `resetState()`, **never saved**) tracks the peak single-beam rake: `fireRail()` (cd-update.js) now counts the enemies it strikes and updates `railBestHit = max(railBestHit, hits)`. `grantAchievements()` grants the badge when `railBestHit >= 5`, with **no `won` gate** (a feat, not a victory condition — earnable in any mode, win or lose, like Combo Master). It slots next to the build-style badges (Specialist/Minimalist/Full Arsenal/Combo Master). Also fixed a **stale label**: the 🧰 Full Arsenal badge desc now reads *"all 9 tower types"* (the condition has counted `TYPE_KEYS.length` = 9 since the Railgun shipped, but the visible text still said 8).

**Why:** Content additions have dominated recent runs (tower/boss/perk/wave-mod); this gives players a fun skill *"aha"* moment and a reason to build and aim the newest tower well, extending the addictive completion loop the owner likes — without piling on more difficulty content. It keeps faith with the "too easy" feedback indirectly (the reward is for skillful positioning, not raw power) and ties the just-shipped Railgun into the meta. Roster: **16 → 17 badges**.

**Save/economy:** Fully additive & save-safe. `railBestHit` is run-only (never persisted; the feat is momentary and can recur any time the rail fires, so no force-on-resume like Flawless/Pacifist). `meta.achievements`/`meta.stats` load unchanged; no new localStorage key; no chips/talents/gold/balance impact.

**Tests:** New group **[92]** — badge defined & wired, the Full-Arsenal "9 tower types" label fix, `railBestHit` resets on a new run, `fireRail` tracks a 6-in-a-line rake, `railBestHit>=5` grants the badge on a loss, a 4-enemy beam does **not** grant it, zero console errors. Suite green.

---

## v1.83.0 — 2026-06-15 — 🛤️ Railgun — new 9th tower (instant piercing line-beam)

**Type:** New content (tower). Minor bump.

**What:** A brand-new tower — the **🛤️ Railgun** (`TOWER_TYPES.rail` in cd-defs.js), the first new tower since the Mortar (v1.23.0). It fires an **instant piercing beam** in a dead-straight line out to its range and damages **every** live enemy whose body the line crosses — not one target, the whole row. Implemented like Tesla's chain (resolved immediately, no travelling projectile): a new `fireRail(t, target, dmg)` (cd-update.js) reached via a `def.proj === 'rail'` branch in the tower-fire loop. It projects each enemy onto the firing ray (`along = r·û`), rejects ones behind the tower or past range (`along<0 || along>range+e.r`), and strikes those within the perpendicular half-width (`perp = |r×û| ≤ halfW + e.r`), skipping intangible phantom/cloak enemies (`blinkInvuln>0`). Stats: cost 160, range 200, dmg 36, rate 1.7, color cyan `#33e0d0`. Two L5 specs (`SPECS.rail`): **Penetrator** (`railpen`, +35% dmg via `effDmg`) and **Overcharged Coil** (`railwide`, beam half-width 14→26 — a broader line). New **Railgun Mastery** talent (`mastery_rail`, auto-wires via the generic `mastery_<type>` lookup in `effDmg`/`effRange`). A clean straight tracer with a bright white core renders via a new `b.straight` branch in `draw()`'s beam loop (cd-render.js); `SFX.rail()` is an electromagnetic charge-and-crack (cd-core.js). Hotkey **9**; the `.hint` text updated 1–8 → 1–9.

**Why:** It's the meatiest additive content the owner loves and a genuinely new *positioning* axis — every other tower hits at a point; the Railgun hits along a line, so its value comes from aiming down a long straight path run (the Gauntlet kill-box, serpentine bends) rather than raw stats. Deliberately a **side-grade, not power creep** (re: the long-running "too easy" feedback): single-target DPS ≈ 21/s (≈ Cannon, below Sniper), and it **respects armor** (a kinetic slug, no `ignoreArmor`) so it's no boss-melter — the upside is earned by lining up the shot. Overcharged Coil trades concentration for coverage (no damage bump), keeping the L5 pick a real axis.

**Save-safe:** fully additive — `loadRun()` rebuilds a placed Railgun generically from `TOWER_TYPES`; the beam is render-only (run-only `beams` array, never serialized) and `fireRail` resolves instantly so no `proj:'rail'` projectile is ever spawned/saved. Old saves load unchanged (new tower/spec/talent are additive; `mastery_rail` defaults to rank 0). The shop, hotkeys, placement, spec-choice and save/restore all auto-generate from `TYPE_KEYS`. Note: the 🧰 Full Arsenal achievement (`new Set(towers.map(t=>t.type)).size === TYPE_KEYS.length`) now requires all **9** tower types (data-driven, intentional).

**Tests:** new group **[91]** — definition/specs/mastery/shop wiring, Penetrator +35%, pierces all 3 in-line enemies while missing off-line/behind/out-of-range, Overcharged Coil catches a 30px-off enemy a narrow beam misses, respects armor, the straight-beam `draw()` branch renders without throwing, and a placed Railgun save/resume round-trips. Group **[55]** count assertion relaxed `=== 21` → `>= 21` (new towers legitimately add a `mastery_<type>` talent → 22). Full suite **979/0 green**, zero console errors. Verified the dev server serves v1.83.0 (a stale preview SW cache masked it in the browser — an environmental artifact, not a code issue).

## v1.82.0 — 2026-06-15 — 🐉 Hydra — 10th boss archetype (splits into two heads on death)

**Type:** New content (boss archetype). Minor bump.

**What:** A 10th late-game boss archetype, **🐉 Hydra**, added to `BOSS_ARCHETYPES` (cycle 9→10). It joins the wave-20+ rotation at the 10th slot (**w65**, then every 10th boss; w70 wraps back to regen). Its mechanic is a brand-new axis: **when the boss is slain it splits into 2 sub-units** ("heads") that keep advancing up the path. Implemented in `damage()`'s kill block (cd-update.js, gated `e.kind==='boss' && e.bossType==='hydra'`, right after the `fission` block) — it pushes 2 `kind:'norm'` heads to `pendingSpawns` (each `maxHp×0.10`, `spd e.spd/0.45·0.9`, token `bounty×0.05`, spawned `dist−24−i·18` *behind* the death point) plus a `🐉 IT SPLITS!` floater and a green burst. A toxic-green aura ring + `HYDRA` boss-bar badge telegraph it (cd-render.js: aura colour `154,230,92` + `bossMechanicBadge`).

**Why:** Every existing archetype acts *while alive* (summoner spawns adds, regen self-heals, etc.); none does anything on death. The Hydra opens a fresh **death-spawn axis** — the fight isn't over when the bar empties, so a defense tuned only to delete the boss can leak if it has no follow-up firepower. It rewards keeping splash/Reaper/Overkill in reserve to mop up the heads. Squarely serves the long-running "too easy" feedback for **deep** runs, hardening the very late game through *behaviour, not a raw HP spike* (the same philosophy as the other nine archetypes; the norm-HP curve is invariant-capped by test `[16]`).

**Bounded / safe:** The heads are plain norms — **not bosses** (no extra boss bar) and carrying **no `hydra`/`bossType` tag**, so they can never re-split (single layer, no cascade — the Overkill/Fission bounding pattern). Each is ~10% of the boss's max HP, pays a token bounty, and spawns *behind* the kill point so towers get a beat to react. Reuses the proven split/fission deferred-`pendingSpawns` path (safe to mutate `enemies` next frame). Archetype fields are run-only and never persisted → **no save/schema/economy change**; old saves load unchanged.

**Tests:** New group **[90]** (in-rotation at w65, queues 2 sub-units on death, heads spawn into the field, ≤10% boss-HP bounded, heads are plain norms not bosses, killing a head spawns nothing = no cascade, a non-hydra boss does not split, the `HYDRA` badge resolves). Group **[45]** extended (rotation now `…→siphon→hydra`, w65→hydra & w70→regen; hydra added to the killable-boss sweep). Full suite green; zero console errors.

## v1.81.0 — 2026-06-15 — 🔭 Targeting Array — new rare run perk (+20% tower range)

**Type:** New content (run perk) + minor UX polish. Minor bump.

**What:** A new rare draft perk, **🔭 Targeting Array** (`optics`): pick it from the every-5-waves draft and all towers gain **+20% firing range** (`perkState.rangeMult *= 1.2`). Plus a small polish: the tower info panel now displays **effective** range instead of base range, so Targeting Array, Glass Cannon (−30%) and the Fog modifier (−20%) all visibly move the number.

**Why:** The perk pool had **no range buff at all** — every offensive perk pumps damage, fire rate or gold, and the only thing touching range was the Glass Cannon legendary, which *cuts* it. Range is a distinct axis: more reach = more path covered per tower, so it's a **coverage-builder** — a direct counter to the recent coverage-pressure content (Breachers that cost 2 lives on a leak, Cloaking Field, Fog) rather than another raw-DPS bump. That makes it a meaningful draft trade (board control vs a damage/gold perk), not power creep — keeping faith with the recurring "too easy" feedback. Rare-appropriate: a global +20% range (~+44% coverage area) sits alongside the other rares (+15% all damage, +10 lives, +400 gold).

**Implementation:**
- `cd-defs.js` — `PERKS` rare entry `optics`; `freshPerkState()` gains `rangeMult:1`.
- `cd-game.js` — `effRange()` multiplies by `perkState.rangeMult` (**firing range only**, NOT `effBuffRange`, so booster auras are untouched — the same boundary Glass Cannon respects, keeping the documented booster-coverage snowball in check). The upgrade panel statline now shows `effRange(t)` (was `t.range`), and `upgradeKey()` hashes `effRange` so the panel stays live.

**Save-safe:** `rangeMult` lives inside `perkState`, persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)`; old saves default to `1`. No new localStorage key, no economy/schema impact. `resolveWildcard()` does not roll it (rare, not legendary).

**Test:** new group `[89]` — perk applies (range ×1.2), it hits firing range but not booster aura range, save/resume round-trips the multiplier, and the perk is in the pool. Full suite green.

## v1.80.0 — 2026-06-15 — ‼️ Breacher Surge — 18th Mayhem wave modifier (heavy escorts, double leak-cost)

**Type:** New content (Mayhem wave modifier). Minor bump.

**What:** A new Mayhem / Daily wave modifier, **‼️ Breacher Surge** (`breachers`). When it rolls, a fraction of the wave's basic enemies are converted into heavy **‼ Breacher** escorts — the slow, tanky units (×2.0 HP, ×0.7 speed) that drain **2 lives** instead of 1 if they reach the exit.

**Why:** It's the **wave-wide cousin of the Breacher enemy** (the pattern established by Cloaking Field ↔ Phantom and Fission ↔ Splitter) and presses on the one axis no other modifier touches — **leak cost**. Every other mod scales HP, speed, economy, tower stats, armor, regen, tower uptime, target priority, CC, untargetability, or multiplication; none of them touch *lives*. Doubling the price of a leak rewards solid coverage / chokepoints over a gappy glass-cannon line, squarely serving the recurring "too easy" feedback. Bounded & fair: breachers are slow (they bunch up and are easy to focus), only **norms** convert (the rarer special kinds are untouched and the wave doesn't get longer — conversion, not addition), and it adds no extra HP curve — it can't make a run easier.

**Implementation (mirrors Warden Surge v1.51.0):**
- `cd-maps.js` — `WAVE_MODS` entry (inserted before `meteors`; pool **17 → 18**).
- `cd-game.js` `buildWave` — one conversion line after the Warden Surge line: `if (modIs('breachers') && e.kind === 'norm' && i % 4 === 1) e = { kind:'breacher', …, lifeCost:2 }`. The leak site already reads `e.lifeCost` (v1.63.0), and the render already draws the breacher glyph + `lifeCost>1` cue ring, so **no leak/render code changed** — fully data-driven.
- Run-only (enemies are never persisted) → no save/schema/economy impact; one mod is ever active so no stacking with Warden Surge despite the shared slot.

**Tests:** new group `[88]` — mod present; adds breachers to a wave; converted breachers well-formed (maxHp/colour/radius/lifeCost:2); conversion-not-addition (length unchanged); special kinds untouched; inert when off; a leaked surge breacher costs 2 lives (and feeds `perkState.livesLost` for Last Stand); a real Mayhem run with the mod in the pool drives clean. Full suite green.

## v1.79.1 — 2026-06-15 — 🩺 Health check — all green (938/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v1.74.1: v1.75.0, v1.76.0, v1.77.0, v1.78.0, v1.79.0.)

**Result: clean.** Nothing required fixing in the game; this run verifies the project is still pointed in the right direction.

- **Tests:** full suite **938 passed / 0 failed across 87 groups** `[1]`–`[87]`, zero console errors (run by a subagent).
- **Refactor audit:** every game file is comfortably under the ~1500-line cap — cd-update.js 1117, cd-render.js 831, cd-game.js 779, cd-core.js 483 (now), cd-defs.js 417, cd-maps.js 294, cd-state.js 192. No dead code, no debug `console.*`, no real TODOs/FIXMEs. The only oversized file is the **dev-only** test harness `tests/run-tests.mjs`, now **5,810 lines (87 groups, 938 assertions)** — up from 5,447/83/878 at v1.74.1 — still flagged for a per-group split (ROADMAP → Tech/tooling). It never ships with the game.
- **Docs coherence:** CLAUDE.md ↔ code spot-checks all match — **8 towers, 10 enemy kinds** (Molten added v1.77.0), **9 boss archetypes, 17 Mayhem wave modifiers** (Fission added v1.76.0), **16 achievements, 6 targeting modes, 4 abilities**, boss HP slope ×0.6/wave, boss armor slope ×0.5/wave. Versions consistent everywhere: `GAME_VERSION`, CHANGELOG.md top, in-game `CHANGELOG_ENTRIES` top, and `sw.js` `CACHE` all at v1.79.1. index.html `<meta refresh>` redirect intact; HTML loads the seven `cd-*.js` in dependency order with no `type="module"`.
- **Table-stakes:** checklist remains complete (favicon/meta/OG, PWA install + offline SW, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile). Lone optional gap unchanged: a raster PNG icon set (192/512) for stricter PWA installability audits (repo is intentionally asset-free).
- **Integrity spot-checks:** ran in a real browser over http. Game loads at v1.79.1 with 8 tower types and zero console errors. **Old-save migration verified live:** a minimal old `cd_meta` (chips+talents only) migrates with `achievements`/`stats`/`bestCombo` defaulted; a minimal pre-v1.74 `cd_save` (no `gameTime`, no `mapTheme`, sparse `perkState`, no `shock` cooldown) loads via the additive defaults (`gameTime→0`, `mapTheme→circuit`, `abilityCd.shock→0`, `perkState.glassCannon`/`reaper→false`), then resumed and drove a full wave (6→7) cleanly. file:// playability confirmed structurally (classic scripts, correct order, inline favicon, no build step). Test localStorage cleaned up afterward.

No code behaviour changed this run — version/cache/docs bookkeeping only.

---

## v1.79.0 — 2026-06-15 — 🎇 Mortar shells now arc through the air

**Type:** Polish / game-feel. Minor bump.

**What & why.** The 🎇 **Mortar** is the long-range siege tower, but its lobbed shells flew **dead-flat**
toward the target — identical to the Cannon's bomb — which never sold the "heavy shell raining down from
above" fantasy (a noted ROADMAP follow-up, twice: *"a visual arc for the lobbed shell would sell the
artillery feel"*). Mortar shells now **rise in a parabola and fall onto the target**, with a faint ground
shadow drifting beneath to anchor the height. The arc is **taller for longer shots** (capped), so you can
read which tower is the artillery at a glance.

**Implementation.** Render-only, fully decoupled from gameplay:
- **cd-update.js** — when a mortar fires, the projectile records its launch point as `x0`/`y0` and a
  `lob: true` flag (only mortar; gun/sniper/cannon-bomb/etc. keep `lob` falsy). One small change in the
  projectile-spawn block; the muzzle coords are computed once into `px`/`py`.
- **cd-render.js** — a new pure helper `lobLift(p)` returns the upward pixel offset for a lobbed shell:
  `frac = traveled/(traveled+remaining)` (robust as the target moves; 0 at launch → ~1 at impact),
  `peak = min(46, total*0.2)`, `lift = peak·4·frac·(1−frac)` (parabola, peaks at mid-flight). The
  projectile-draw loop lifts the orb, trail and highlight by `lift` and draws a fading ground shadow
  ellipse under the shell — **`p.x`/`p.y` stay the ground truth used by hit detection** (targeting,
  damage, blast radius, armor-ignore all untouched). Returns `0` for any non-lob projectile, so Cannon
  bombs and all bullets render byte-identically.

**Save/economy/balance:** zero impact — projectiles are transient run-only objects (never persisted), and
the change touches only the *drawn* position of mortar shells. No new localStorage key.

**Test evidence:** new group `[87]` (12 checks) — `lobLift()` purity (0 for non-lob, ≈40 peak mid-flight for
a 200px shot, 0 at both ends, symmetric, rises-then-falls, capped ≈46 on an 800px shot); a *fired* mortar
shell carries `lob/x0/y0` with a positive in-flight arc while a fired gun bullet stays flat; and a lobbed
shell still homes & lands its hit (gameplay unaffected). Suite green; PWA `CACHE` bumped to
`circuit-defense-v1.79.0` (test `[49]`).

## v1.78.0 — 2026-06-15 — ⏱️ Speed bonus — fast victories score higher

**Type:** Feature / scoring. Minor bump.

**What & why.** Added a **speed multiplier** to the end-of-run score (`computeScore()`, cd-update.js).
When the original scoring system shipped (v1.16.0) the owner asked it to weigh "kill time, remaining gold,
using fewer towers" — gold and tower-count (efficiency) went in, but **kill time couldn't**, because the
game had no clock. The **run timer landed in v1.74.0** (`gameTime`, accumulated in `update()`, persisted in
`cd_save`), so this finally wires the missing axis: a **win** finished under par scores up to **+25%**,
tapering linearly to +0% **at** par and clamped to +0% beyond it. It is a **pure carrot, never a stick** —
a slow/turtle win is never penalised, only a fast one rewarded — which keeps it from being a balance lever
(it's score-only / cosmetic, like the rest of the scoring). Pairs naturally with the ⏱️ Speed Demon
achievement (v1.74.0) and gives score-chasers a reason to lean on the concurrent-wave rush.

**Formula.** `spdMult = (victory && gameTime > 0) ? 1 + 0.25 · clamp((par − gameTime) / par, 0, 1) : 1`,
with `par = victoryWave() · 20` seconds (≈600s for a 30-wave Quick win, ≈300s for campaign L1, ≈1080s for
L40 — so it scales fairly across modes/lengths). `score = raw · diffMult · effMult · **spdMult**`. Applies
only on a victory with logged time; a loss (no meaningful finish time) and a 0-time edge (never ran
`update()`) both get `spdMult = 1` (no bonus, rather than the full one).

**Surfaced.** When the bonus applies (`spdMult > 1`), `scoreBreakdownHtml()` adds a `× Speed (M:SS clear)`
row to the collapsible end-screen breakdown, beside `× Difficulty` and `× Efficiency`. Hidden otherwise so
losses/slow wins don't show a redundant ×1.00 row.

**Implementation (additive, cosmetic — no save/economy/balance impact).**
- `computeScore()` (cd-update.js): compute `par`/`spdMult`, multiply into `score`, add `spdMult` to the
  returned object.
- `scoreBreakdownHtml()` (cd-update.js): conditional `× Speed` row.
- No new globals, no new localStorage key (reuses the already-persisted `gameTime`); old saves unaffected.

**Tests.** Extended group **[31]** (8 new assertions): half-par win → +12.5%, at-par → +0%, over-par
clamps to +0% (never a penalty), a fast win out-scores the same win at par, a slow win equals par (no
penalty), a loss never gets the bonus, and the breakdown shows/hides the `× Speed` row correctly. Existing
[31] assertions unchanged (the defeat/victory sub-runs log `gameTime = 0`, so `spdMult = 1` and their
documented scores are byte-identical). Spawned a subagent to run the full suite; green, zero console errors.

**Bump:** GAME_VERSION → v1.78.0, sw.js CACHE → circuit-defense-v1.78.0. The low-priority start-menu-revamp
FEEDBACK item remains PENDING (left as-written per owner pref).

---

## v1.77.0 — 2026-06-15 — 🔥 Molten — new CC-immune enemy (counters the Frost snowball)

**Type:** Content / enemy type. Minor bump.

**What & why.** Added a new enemy kind — the **🔥 Molten** (`kind:'molten'`, `#e8482e`, glyph 🔥) —
spawning from **wave 12+ in ALL modes** (Classic, Campaign, Mayhem). Its mechanic: it is **immune to
crowd control**. It sets `ccImmune:true`, reusing the proven Heatwave/Juggernaut infrastructure — the
`if (e.ccImmune) { e.frozen = 0; e.slow = 0; }` line in `update()` (cd-update.js) clears its CC every
frame before `slowMul`, and the warm-orange cue ring in `draw()` (cd-render.js) already keys off
`e.ccImmune` — so the Freeze ability and Frost towers can't slow or freeze it: it plows down the path
at full speed. This is a **fresh difficulty axis for a regular enemy** — CC-immunity previously lived
only on the w55+ Juggernaut boss and the Mayhem-only Heatwave wave-mod — and it directly answers the
recurring **"too easy" / Frost-booster-snowball** feedback by putting a "you must actually KILL this,
not just stall it" threat into **Classic & Campaign** (the modes the owner flagged as easiest), not
just deep boss/Mayhem waves. **Bounded:** moderate HP (×1.35 of the wave template), normal speed, no
other trick, so it can't make a run easier — it just demands real DPS instead of perma-slow.

**Implementation (additive, save-safe — enemies are never persisted).**
- `buildWave()` (cd-game.js): a new **last** regular-kind `if` (`w >= 12 && i % 13 === 6`) so it wins
  its slot on a collision, mirroring the warden/breacher pattern. Tagged `ccImmune:true`.
- `waveComposition()` + `KIND_HP_MULT.molten = 1.35` + the `order` array (cd-game.js) learn it, so the
  bottom-left wave preview discs and the ⚔ threat number count it (drift-guarded by test [40]'s
  `waveThreat === sum(buildWave.maxHp)` invariant).
- `enemyGlyph` → 🔥, `GLYPH_FONT['🔥']`, `PREVIEW_COLOR.molten` (cd-render.js); colorblind legend row
  (cd-update.js). The CC-immune cue ring comment updated to note it now also marks Molten enemies.

**Tests.** New group **[86]** (14 assertions): wave-gating (none < w12, present ≥ w12), `ccImmune`
tagging, HP = template×1.35, a frozen Molten shrugs off CC and keeps moving while a frozen norm stays
put (control), composition/glyph/colour/HP-mult plumbing, the threat drift-guard at w12, and a god-tower
w12+ integration run. Updated the **Heatwave [76]** baseline assertions to exclude intrinsically-immune
Moltens (`e.ccImmune && e.kind !== 'molten'`). Suite **918/0** green, zero console errors.

**Bump:** GAME_VERSION → v1.77.0, sw.js CACHE → circuit-defense-v1.77.0. No save/economy/schema impact.
The low-priority start-menu-revamp FEEDBACK item remains PENDING (left as-written per owner pref).

---

## v1.76.0 — 2026-06-15 — 🧫 Fission — 17th Mayhem wave modifier (slain enemies multiply)

**Type:** Content / wave modifier. Minor bump.

**What changed:** A **17th Mayhem wave modifier**, 🧫 **Fission**. When it rolls, every enemy you kill bursts into **2 weak spawnlings** that race up the path behind it, so a wave can nearly **triple in bodies** before it clears. It's the **wave-wide cousin of the Splitter enemy** (the way Cloaking Field is the cousin of the Phantom), on a fresh **multiplication / clear-speed axis** no other mod touches. It rewards splash and rapid-fire firepower (Cannon, Mortar, Tesla chains, the Overkill perk) and pressures thin lines of slow single-target towers, which get swamped and start leaking. The spawnlings are deliberately feeble (a fraction of the parent's HP, slightly faster, a token bounty) and — crucially — do **NOT** themselves fission, so the chaos is **bounded**: at most two children per kill, never a cascade.

**Why:** Continues the established additive wave-mod pattern (pool 16→17) and leans into the long-running "too easy" feedback — Fission is a *net difficulty bump* (more targets, more leak pressure), not a way to make a run easier or farm gold. The token bounty (0.2×, below the native splitter's 0.3×) and the boss exemption keep it from snowballing the economy or the boss-wave threat.

**Implementation (additive, save-safe, no economy/schema change):**
- `cd-maps.js` — `WAVE_MODS` gains `{ id:'fission', icon:'🧫', name:'Fission', desc:'Slain enemies burst into weak spawn' }` (before `meteors`). `MOD_BY_ID`/`dailyPreview()`/`rollWaveMod()` pick it up generically.
- `cd-game.js` — `buildWave()` tags `if (modIs('fission')) e.fission = true;` for every **non-boss** enemy (the boss is left untagged — kept clean; the summoner archetype already covers boss adds).
- `cd-update.js` — in `damage()`'s kill block, right after the native `split` block: a slain enemy gated `e.fission && e.kind !== 'boss' && e.kind !== 'split'` pushes **2** plain `norm` spawnlings to `pendingSpawns` (`maxHp×0.18`, `spd×1.25`, `r:7`, bounty `max(1, floor(bounty×0.2))`, colour `#7ee787`) + a green `addExplosion`. The children carry **no `fission` flag**, so they never re-burst (single layer, the Overkill/Cloak bounding pattern). `split` is excluded so the splitter doesn't double-burst.
- `cd-render.js` — a dashed spring-green cue ring (`rgba(126,231,135,0.6)`, `setLineDash([3,3])`, wrapped in `ctx.save()/restore()` so the dash doesn't leak) on each `e.fission` enemy, distinct from the solid green regen halo (only one mod is ever active, so they never overlap).

**Save/economy impact:** **None.** The `fission` tag and the spawnlings are run-only objects, never serialized (`saveRun()` doesn't persist enemies or the tag); Mayhem/Daily-only. No new localStorage key, no schema change, no balance change to existing systems.

**Tests:** new group **[85]** (15 checks) — mod in pool; inert when off; tags every non-boss enemy; boss left untagged; base HP/speed/armor/bounty untouched; a kill spawns exactly 2 weaker, token-bounty spawnlings; spawnlings do NOT cascade (single layer); bosses never fission (double-guard); the native splitter doesn't double-burst; inert once cleared; a fission field fully clears in bounded frames with total kills > originals (proves multiplication + termination); zero console errors. **Suite 904/0 green, exit 0.** Verified live in-browser (v1.76.0 loaded, Fission tags non-boss enemies, a kill yields 2 spawnlings, `draw()` renders the cue cleanly, zero console errors).

## v1.75.0 — 2026-06-15 — 🔄 Play Again — one-click replay from the end screen

**Type:** Feature / QoL. Minor bump.

**What changed:** The end-of-run overlay (win or lose) now has a **🔄 Play Again** button that restarts the same run — same `gameMode` / `mapKey` / `diffKey` / `campLevel` — in a single click, with no trip back to the start menu to re-pick everything. It removes the friction from the core replay loop the owner values: instant rematch after a near-loss, or replay a cleared Quick run to chase a better score. In Campaign it restarts the **same level** (useful for grinding a tough one or improving the grade), shown alongside the existing `Next Level ▶` / `Continue Endless ∞`. It is **hidden for the 🗓 Daily Challenge** — that's a one-off, date-seeded run, so replaying the identical seed is meaningless and the daily never persists.

**Implementation:**
- `tower-defense.html` — a new `#ovRetry` button in the overlay button row (green `#238636`, `display:none` by default), `onclick="playAgain()"`.
- `cd-game.js` — `playAgain()` (beside `backToMenu()`): a belt-and-suspenders `if (daily) return`, hide the overlay, then `beginGame()` (which `clearRun()`s + `resetState()`s a fresh identical run from the globals still in memory). Mirrors `nextLevel()`.
- `cd-update.js` — `endGame()` and `winGame()` set `ovRetry.style.display = daily ? 'none' : 'inline-block'`.

**Save/economy impact:** **None.** Reuses run settings already in memory; no new localStorage key, no schema change, no balance/economy/render change. A defeat/win already `clearRun()`s when `!daily`, so `beginGame()`'s `clearRun()` is a harmless no-op.

**Tests:** new group **[84]** — button exists; shown on a Quick defeat and a Quick victory; hidden on a Daily run; `playAgain()` restarts a fresh run (`started`/`gameOver`/`wave` reset, same mode/map/difficulty) and hides the overlay; zero console errors. **Suite 889/0 green, exit 0.** Verified live in-browser (button renders with correct label/colour on the defeat overlay; click restarts a fresh wave-0 run; daily hides it; no console errors).

## v1.74.1 — 2026-06-15 — 🩺 Health check — all green (878/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. (5 entries since the last health check v1.70.1: v1.71.0, v1.71.1, v1.72.0, v1.73.0, v1.74.0.)

**Test suite:** **878/0 green, exit 0** (83 groups `[1]`–`[83]`), zero console errors. Run via subagent.

**Refactor audit:** all seven game files comfortably under the ~1500-line cap — cd-update.js **1080** (largest, growing ~10–30 lines/feature run; watch but no action), cd-render.js 791, cd-game.js 754, cd-core.js 477, cd-defs.js 417, cd-maps.js 293, cd-state.js 192. tower-defense.html 154, tower-defense.css 518, sw.js 51. **No dead code, no debug logging, no TODOs** in any game file (the only `TODO` grep hits are the word inside past changelog bodies). The dev-only `tests/run-tests.mjs` is now **5,447 lines** (83 groups, 878 assertions) — by far the largest file in the repo; ROADMAP "Split the test harness file" note refreshed.

**Docs coherence:** CLAUDE.md, ROADMAP.md, FEEDBACK.md verified against the code — every count and formula still matches: **8** towers, **9** boss archetypes (`['regen','summoner','bulwark','enrager','teleporter','berserker','disruptor','juggernaut','siphon']`), **16** Mayhem wave modifiers, **16** achievements, **6** targeting modes (`first/last/strong/close/weak/support`), **4** abilities, boss HP slope `14 + w*0.6`, boss armor slope `w*0.5`, enemy-HP curve `(18 + w*7 + 1.25·w^1.9)·1.80·d.hp·campScale`. `GAME_VERSION`, the CHANGELOG heading, and the `sw.js` cache const are all consistent at **v1.74.1**. No drift found.

**Integrity spot-checks:** double-click `file://` playability intact — classic `<script src>` in dependency order (cd-core → maps → defs → state → game → update → render), no ES modules, inline SVG favicon, relative paths, SW registration http/https-guarded so it can't fire on `file://`. Old-save migration verified: `loadMeta()` defaults `talents/achievements/stats/dmg/runs/bestCombo` on a minimal `{chips}` save; `loadRun()` restores the new v1.74.0 `gameTime` field under a `typeof === 'number'` guard (old saves start at 0). Deploy workflow (`pages.yml`) still copies index.html + tower-defense.html + tower-defense.css + cd-*.js + the PWA trio as a static deploy; CI (`ci.yml`) runs the harness on push/PR.

**Table-stakes audit:** checklist remains **complete** (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, 44px tap targets). Audio note: the `AudioContext` is created lazily inside user-gesture click handlers, so it starts in the running state — no explicit `resume()` needed; no gap.

**Findings → ROADMAP (no fixes needed this run):** test-harness file size (logged, low priority); cd-update.js trending toward the cap (informational). No owner vetoes/reverts since last run.

## v1.74.0 — 2026-06-15 — ⏱️ Run timer & Speed Demon achievement

**Type:** New feature (run clock + achievement). Minor bump. Additive, save-safe.

**What:** The game now has a **run timer**. A run-only `gameTime` accumulator (already declared & zeroed in `resetState()`, incremented in `update()` since long ago but never surfaced) is now shown two ways: a **live HUD clock** (`⏱️` element in `#hud`, set in `updateHud()` and ticked every 0.25s via `update()`'s existing `abilityUiAcc` throttle) and a **Time stat cell** on the end-of-run screen (`renderEndScreen`'s `.scoreGrid`, now 7 cells). A new `fmtTime(s)` helper (cd-game.js, beside `fmtNum`) formats seconds as `M:SS` (or `H:MM:SS` past an hour, clamps negatives). A new **⏱️ Speed Demon** achievement (`speedrun`, the 16th badge) is granted for `won && gameMode === 'quick' && gameTime < 420` — win a Quick run (always 30 waves) in under 7 minutes.

**Why:** The scoring system (v1.16.0) always wanted a "kill time" axis but noted "there's no per-run clock in the game"; ROADMAP listed a speedrun badge as blocked on the same gap. This adds the clock (engagement + a future-scoring hook) and a genuine skill challenge. The timer correctly **freezes on pause / draft / menu / game-over** (it sits after `update()`'s early-return) and **tracks in-game time, not wall-clock** (at 2×/3× speed `update()` runs N× per frame, so `gameTime` advances N×dt).

**Threshold calibrated by simulation:** a god-tower **sequential** 30-wave rush takes ~776s (~13 min); a maximally-**concurrent** rush (overlapping up to 3 waves) takes ~272s (~4:32). So 420s (7 min) requires deliberate concurrent-wave rushing — achievable by a strong build, impossible by a leisurely auto-wave clear. **Quick-mode only** because campaign victory waves vary (15…54), making a flat time target unfair there.

**Save-safe:** `gameTime` is now written into `cd_save` and restored in `loadRun()` (guarded `typeof s.gameTime === 'number'`, after `resetState()` zeroes it) — old saves simply lack the field and start at 0. Keeping it honest across resume also closes a quit-near-the-end exploit on the speedrun badge. No new localStorage key, no economy/balance/schema impact; cosmetic + one additive save field + one badge.

**Tests:** new group **[83]** (21 checks): `fmtTime` formatting incl. hours & negative-clamp; `gameTime` zeroes fresh, accrues in `update()`, freezes while paused/drafting; HUD clock renders `M:SS`; save→resume round-trips `gameTime`; old save without the field defaults to 0; Speed Demon in the roster; granted on a sub-7-min Quick win, withheld on a slow win / a fast loss / a fast Campaign win; end screen shows the Time cell. Updated two count assertions ([31] stats grid 6→7, [48] roster 15→16). Full suite **878/0 green**; verified in-browser (live HUD clock, end-screen Time cell, zero console errors).

## v1.73.0 — 2026-06-15 — 🔥 Killing Spree — new legendary perk (combo-scaling tower damage)

**Type:** New content (legendary perk). Minor bump. Run-only, save-safe.

**What:** A new legendary draft perk, **🔥 Killing Spree** (`id:'spree'`, cd-defs.js). While held, a *hot* kill-combo amplifies **all** tower damage, scaling **+1% per combo, capped +25% at a 25× streak**. The multiplier lives in a new `comboDmgMult()` helper (cd-state.js, beside `comboColor`/`comboGlowTier`): it returns `1` unless `perkState.comboPower` is set **and** a streak is currently active (`comboTimer > 0`), else `1 + Math.min(0.25, comboCount * 0.01)`. It's called once in the tower-fire loop (cd-update.js) as `dmg *= comboDmgMult();` — placed right after the boss-damage line and **before** the chain/projectile branch, so it covers every tower type including Tesla chain and Poison. `apply` sets `s.comboPower = true`; `comboPower:false` was added to `freshPerkState()`.

**Why:** The **first perk to plug into the kill-combo meter** — a core run system that until now was purely cosmetic (the v1.60.0 board glow is render-only). It deepens an existing system the owner loves (addictive loops, chunky game-feel: your defense spikes exactly when you're chaining kills) and is a natural fit with the recent 🩸 Weak targeting mode (more confirmed kills → hotter streaks) and 💀 Reaper execute (faster finishes feed the chain).

**Not power creep (re: recurring "too easy" feedback):** it's **conditional & self-limiting**. The combo window is 2s, so a stalled or leaking run gets **+0%**; it's strictly weaker than the unconditional 💎 Diamond Core (+30% always) — a build-flavoring draft choice, not a free upgrade. It can't make a *struggling* run easier (you need to already be chaining kills to benefit). Magnitude is bounded ≤25% (the per-run cap) and sustaining 25× is itself a skill feat.

**Design echoes Reaper:** applied in the **fire path, not `effDmg()`**, so the upgrade panel doesn't churn every kill (`comboCount` changes constantly). The combo state is run-only and recomputed live; on resume `comboCount` resets to 0 (no benefit until you build a fresh streak).

**Save-safe:** `comboPower` lives inside `perkState` (default `false`), persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)` — old saves default to `false`. No new localStorage key / economy / schema impact. The 🎲 Wildcard perk rolls it automatically (it's an eligible legendary).

**Tests:** new group **[82]** (14 checks): perk metadata + `apply`; `comboDmgMult()` math & gating (off / no-streak / +1%-per-combo / +25% cap); a **fire-path integration test** (real `update()` drive — a gun + a huge-HP enemy share a path point so the shot lands point-blank; the combo/base damage ratio is ~+25%, isolating the perk); `freshPerkState` default; save→reload round-trip; old-save migration; Wildcard can roll it. Full suite **857/0 green**.

**Files:** `cd-state.js` (`comboDmgMult()`), `cd-defs.js` (perk entry + `freshPerkState` default), `cd-update.js` (one `dmg *= comboDmgMult()` line in the fire loop), `cd-core.js` (version + What's New entry), `sw.js` (cache bump), `tests/run-tests.mjs` ([82]), docs.

## v1.72.0 — 2026-06-15 — 🫥 Cloaking Field — 16th Mayhem wave modifier (enemies phase out)

**Type:** New content (wave modifier). Minor bump. Run-only, save-safe.

**What:** A 16th Mayhem/Daily wave modifier, **🫥 Cloaking Field**. When it rolls, every enemy + the boss is tagged `e.cloak=true` (in `buildWave`, beside the `heatwave`/`adrenaline` tags). In `update()`'s enemy loop — just after the phantom block — a cloak cycle runs: it decays `e.blinkInvuln` **unconditionally** and, while `frozen<=0`, ticks `e.cloakCd` (lazy-init 2.5s); on expiry it sets `e.blinkInvuln=0.45` + a small violet burst + `SFX.blink()`. So each enemy becomes **briefly untargetable + immune for ~0.45s every ~2.5s (~18% of the time)** — it reuses the phantom's `blinkInvuln` checks already present in `pickTarget()` (skip) and `damage()` (early-return), so no new gating was needed. Render (cd-render.js): a violet cue ring (flares to 0.85 alpha the instant it cloaks, 0.4 otherwise) and the sphere fades to 0.25 alpha mid-cloak (one new branch on the existing `phantomA` ternary).

**Why:** The **wave-wide cousin of the 👻 Phantom enemy** — an explicitly-listed open follow-up under both the phantom entry ("a phantom-heavy Mayhem wave modifier") and "More wave modifiers" in ROADMAP. It pressures a **coverage/uptime axis no other modifier touches** (none make enemies untargetable): slow, hard-hitting single-target towers (Sniper/Cannon/Mortar) waste big shots on a target that blinks out, while rapid-fire towers barely notice — a build-relevant wrinkle, not a flat stat scale. Follows the established "wave-wide cousin" pattern (heatwave↔juggernaut, adrenaline↔berserker; here cloak↔phantom).

**Balance / "too easy"-safe:** Unlike the phantom it does **NOT teleport enemies forward** and adds **no HP or speed** — it only removes the player's ability to hit them ~18% of the time, so it can never make a run *easier* (re: the recurring "too easy" feedback). Bounded the same way the phantom is. Freeze pauses the cloak *trigger* (gated by `frozen<=0`) while `blinkInvuln` still decays unconditionally, so an enemy frozen mid-cloak always becomes hittable again (can't get stuck invulnerable). **Phantoms / teleporter bosses are excluded from the cloak tick** (`e.kind !== 'phantom' && !(boss && bossType==='teleporter')`) because they already own `blinkInvuln` — prevents decaying it twice per frame.

**Safety / scope:** All cloak state (`cloak`, `cloakCd`, `blinkInvuln`) is run-only on enemy objects (never persisted — enemies aren't saved), so no save/schema migration. Mayhem/Daily-only like every modifier (`rollWaveMod()` picks one mod per wave; no economy interaction, so no mutual-exclusivity wiring). No economy/balance/talent/chip impact. Pool 15 → 16.

**Version bump:** `GAME_VERSION` and the `sw.js` `CACHE` const bumped v1.71.1 → v1.72.0 in lockstep (test `[49]` asserts they match).

**Tests:** New group **`[81]`** (13 checks) — `WAVE_MODS` includes it; inert off / tags every enemy + the boss / base HP·speed·armor·bounty untouched; a tagged enemy phases out (`blinkInvuln` set) on cloak; a cloaked enemy is untargetable (`pickTarget` skips it) **and** immune (`damage()` is a no-op); cloak adds no speed/no teleport (advance matches an identical plain enemy over 30 frames); freeze pauses the trigger; intangibility decays back to hittable; phantoms are excluded from the tick (no double-decay); inert once cleared; zero console errors. Full suite re-run before commit. The What's New panel + CLAUDE.md `WAVE_MODS` map updated.

## v1.71.1 — 2026-06-15 — 🤖 Continuous integration — test suite runs on every push

**Type:** Dev tooling / table-stakes engineering. Patch bump. Zero game change.

**What:** Added `.github/workflows/ci.yml` — a GitHub Actions workflow that runs the headless Playwright test harness (`tests/`, 80 groups / 828 assertions) on every push to `master`, every pull request, and on manual dispatch. Checks out, sets up Node 20 with npm caching, `npm ci` in `tests/`, `npx playwright install --with-deps chromium`, then `npm test` (exit 0 = green).

**Why:** The test suite has 823 assertions guarding balance invariants, save compat, and render layout, but until now it only ran when someone remembered to run it locally. The repo is public and auto-improved; CI is the standard safety net a polished project has so a regression can't land silently. It was the top open item under ROADMAP → Tech/tooling ("GitHub Actions CI running `tests/` on push").

**Safety / scope:** Dev-only and fully independent of the Pages deploy (`pages.yml`) — a separate job, separate trigger, `contents: read` only (no Pages permissions), its own concurrency group. **The shipped game is untouched:** no build step, the raw files still play by double-clicking `tower-defense.html`, and CI does not stage or modify any game file (it drives the real `tower-defense.html` over `file://`, exactly like a local run). No save/economy/balance/schema impact.

**Version bump:** `GAME_VERSION` and the `sw.js` `CACHE` const bumped v1.71.0 → v1.71.1 in lockstep (test `[49]` asserts they match). The PWA cache key change just re-fetches the unchanged app shell on next hosted visit — no save impact (saves use localStorage, not the Cache API).

**Tests:** No new game behavior, so no new assertion group; the workflow's own validity is verified by it running the existing suite. Full suite re-run locally before commit — green (828/0). The What's New panel + CHANGELOG carry this entry.

## v1.71.0 — 2026-06-15 — 💰 Siphon — 9th boss archetype (drains your gold)

**Type:** New content (boss archetype). Minor bump. Run-only, save-safe.

**What:** A 9th boss archetype, **💰 Siphon**, joins the wave-20+ rotation. While a Siphon boss is alive it **drains the player's gold every ~3.5s** (a small, wave-scaled amount: `6 + floor(wave·0.4)`), shown as a gold `-N💰` pop over the boss with a draining sound (`SFX.siphon()`) and a small shake. Cycle now `(w/5−4) % 9` → `regen → summoner → bulwark → enrager → teleporter → berserker → disruptor → juggernaut → siphon` (w60 → siphon, w65 wraps to regen). The cycle reads `BOSS_ARCHETYPES.length`, so adding it to the array + its handlers was enough.

**Why:** The 8 existing archetypes harden the late game through HP/heal, adds, shields, haste, blink, accel, tower-EMP, and CC-immunity — **none touched the player's economy**, which is the owner's #1 recurring "too easy / money snowballs early" complaint. Siphon opens that fresh **economic-pressure axis**: you can't farm your way through a tough boss wave, and the answer is to **kill it fast** before it bleeds you (rewards focused fire / burst). Distinct from every other archetype.

**Bounded / fair:** the drain is **floored at 0** (never negative → can't soft-lock; kills still pay full bounty), fires **once per ~3.5s**, and like every boss mechanic a **Time Freeze pauses it** (gated block). No extra HP or speed — purely the gold bleed. It can never make a run *easier*.

**Render:** gold aura ring (`227,179,65`) + a `SIPHON` boss-bar badge (`bossMechanicBadge()`), colour-matched.

**Files:** `BOSS_ARCHETYPES` + comment (`cd-game.js`); `siphon` tick branch + comment (`cd-update.js`); `SFX.siphon()` (`cd-core.js`); badge + aura colour + comment (`cd-render.js`). All archetype fields are run-only / lazily initialised — **no save/schema/economy-baseline change** (old saves unaffected; cooldowns never persisted).

**Tests:** group `[45]` extended — rotation now asserts `w60→siphon, w65→regen`; new checks that a siphon boss drains gold, that freezing it pauses the drain, that the drain floors at 0, and that it's killable. Group `[53]` extended — `SIPHON` (gold) badge. Suite green.

## v1.70.1 — 2026-06-15 — 🩺 Health check — all green (823/0, docs coherent, no drift)

**Type:** Health check (every 6th run — no new feature). Patch bump.

**Counter:** 5 version entries since the last health check (v1.65.1): v1.66.0 Heatwave, v1.67.0 Shockwave, v1.68.0 Hair Trigger, v1.69.0 ambient backdrop, v1.70.0 Weak targeting → this run is the scheduled health check. (FEEDBACK PENDING holds one `[low priority]` start-menu item, not a `[bug]`, so the health check proceeds.)

**1. Refactor audit:** All seven game files are well under the ~1500-line cap (largest: `cd-update.js` 1020, `cd-render.js` 778, `cd-game.js` 742). No new dead code or duplicated logic spotted. The only oversized file remains the dev-only test harness `tests/run-tests.mjs` (~5,110 lines, 80 groups) — already the standing top `[refactor]` item in ROADMAP (split into `tests/groups/*.mjs`); left as-is (low priority, suite green and fast).

**2. Docs coherence:** Read CLAUDE.md/ROADMAP/FEEDBACK against the code. All documented counts verified against source: targeting `MODES` = 6 (first/last/strong/close/weak/support), `ABILITIES` = 4 (meteor/freeze/rush/shock), `WAVE_MODS` = 15, `BOSS_ARCHETYPES` = 8, `TOWER_TYPES` = 8, `ACHIEVEMENTS` = 15 — all match. `GAME_VERSION` and the `sw.js` `CACHE` const are in sync (both v1.70.1). **Fixed one drift:** the ROADMAP "split the test harness" item still read "~4,990 lines (78 groups, 805 assertions)" → corrected to ~5,110 lines / 80 groups `[1]`–`[80]` / 823 assertions. Vetoed section intact (still none recorded).

**3. Table-stakes audit:** Checklist remains COMPLETE (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, ~44px tap targets). No new gaps identified.

**4. Integrity spot-checks:** Full suite **823/0 green**, ~18s, zero console errors (subagent-run). Double-click `file://` playability confirmed — the headless harness itself loads via `pathToFileURL` and the SW registration is http/https-guarded, so offline double-click is unaffected. Old-format save migration verified by reading `loadMeta()` (defaults `talents`/`achievements`/`stats` for minimal saves) and the `loadRun()` `Object.assign(freshPerkState(), …)` perk-state restore — old saves load through the additive defaults.

**Findings → ROADMAP / fixes this run:** doc-drift fix applied; no code changes beyond the version + SW-cache bump. Resets the 5-run health-check counter.

**Test evidence:** 823/0 green after the bump (test `[49]` asserts `sw.js` cache === `GAME_VERSION`, so the synced v1.70.1 bump is verified by the suite).

---

## v1.70.0 — 2026-06-15 — 🩸 Weak — new tower targeting mode (lowest-HP finisher)

**Type:** New content (tower targeting mode). Minor bump.

**What:** A 6th per-tower targeting mode, **🩸 Weak**, joins ⏩ First / ⏪ Last / 💪 Strong / 📍 Close / 🛡 Support. A tower set to Weak fires at the **lowest current-HP enemy** in range, breaking ties toward the one **furthest along the path** (leak priority). `MODES`/`MODE_ICON` in `cd-defs.js` gain the entry; `pickTarget()` (`cd-update.js`) gains `case 'weak': val = -e.hp + e.dist * 1e-4`.

**Why:** The targeting-priority axis hadn't been extended since Support (v1.49.0, 20 versions ago), and a dedicated **finisher** was the obvious missing lever. It's the natural counterpart to 💪 Strong (crack the tanks) — put a fast tower on Weak to mop up stragglers so nothing limps past — and it leans into two systems the game already invests in: the kill-streak **combo meter** (more confirmed kills/sec → longer streaks + hotter board glow) and the **💀 Reaper** execute perk (Weak tees up wounded enemies). Pure target-priority — it raises no stat, so it's not power creep (re: the recurring "too easy" feedback); it's a tactical choice.

**Balance:** None — Weak changes *which* enemy a tower shoots, not how hard. No economy/HP/schema impact.

**Save-safe:** The per-tower `mode` already round-trips through `saveRun`/`loadRun`, and `loadRun`'s `MODES.includes(st.mode) ? st.mode : 'first'` guard validates any old/unknown value to `'first'` — so old saves load unchanged and the new mode needs no migration. The shop, `cycleMode()`, the panel button and the `upgradeKey()` hash all auto-include it (data-driven from `MODES`).

**Tests:** New group **[80]** — Weak is in `MODES`/`MODE_ICON`; picks the lowest-HP enemy over closer/further ones; ties break toward the furthest-along; it's the opposite pick from `strong`; `cycleMode` reaches it; save/resume round-trips it; an unknown saved mode still falls back to `first`; zero console errors. Full suite green.

**Docs:** CLAUDE.md targeting-mode note updated (5 → 6 modes); ROADMAP/FEEDBACK bookkeeping. (Also backfilled the v1.69.0 CHANGELOG.md heading below, which was present in the in-game What's New panel but missing from this file.)

---

## v1.69.0 — 2026-06-15 — 🌌 Ambient start-menu backdrop — drifting glow behind the start screen

**Type:** Polish / UX (start-menu revamp, slice 5). Minor bump.

**What:** A `#startScreen::before` (in `tower-defense.css`, after the `#startScreen h2` rule) paints a slow-drifting radial glow in the circuit palette (blue/teal/violet) behind the menu content — `position:absolute; inset:0; z-index:-1` so it stays out of the flex flow, above `#startScreen`'s dark background but below the in-flow hero/config/buttons. `@keyframes startAmbient` sweeps `background-position` over 22s; the existing `@media (prefers-reduced-motion: reduce)` block adds `#startScreen::before { animation:none }` (gradient stays, drift stops).

**Why:** The start screen was a flat near-black sheet; the ambient glow makes it read as a designed panel and pairs with the v1.41.0 PLAY glow/sheen. Next slice of the ongoing "revamp the starting menu" FEEDBACK item.

**Save-safe:** CSS-only, start-screen-specific (the `::before` targets only `#startScreen`, not the shared `#overlay`/panel rule). No markup/JS/save/economy/gameplay impact.

**Tests:** Group **[79]** — `::before` exists, runs `startAmbient`, is absolute/`z-index:-1`/non-interactive, paints a gradient, doesn't bleed onto `#overlay`, menu content stays on top, reduce-motion freezes the drift but keeps the gradient.

---

## v1.68.0 — 2026-06-15 — ⏱️ Hair Trigger — new legendary perk (+55% fire rate, −25% damage)

**Type:** New content (legendary run perk). Minor bump.

**What:** A new legendary perk, **⏱️ Hair Trigger**, in the every-5-waves draft pool — a build-altering **trade-off** and the inverse sibling of 🔮 Glass Cannon. While held, all towers fire **+55% faster** but deal **−25% damage per shot**. Net DPS is only ≈ **+16%** (1.55 × 0.75 = 1.1625).

**Why:** The owner explicitly enjoys "a weird legendary perk" and meaningful build choices, and the game already has a deep content base — so a perk that changes *how a build feels* rather than just adding power is the right shape. Deliberately **not** power creep (re: the recurring "too easy" feedback): the ~+16% net gain sits *below* a flat legendary like Diamond Core (+30%), and it carries real downsides — the smaller per-shot damage is eaten harder by **flat armor** (worse vs armored / shielded / late bosses, where flat reduction takes a bigger fraction of a smaller hit), and the speed-up favours splash/rapid towers while blunting slow heavy hitters (Cannon/Sniper/Mortar lose the burst that defines them). So it's a genuine draft decision, not a free upgrade, and it forms a clean triangle with Glass Cannon (range→damage) and the default build (balanced). Mirrors the well-precedented Glass Cannon implementation.

**How (additive, run-only, save-safe):**
- `cd-defs.js`: perk pushed to `PERKS` — `{ id:'hairtrigger', rarity:'legendary', icon:'⏱️', name:'Hair Trigger', desc:'+55% fire rate, but −25% damage per shot', apply:s=>s.hairTrigger=true }`; `freshPerkState()` gains `hairTrigger:false`.
- `cd-game.js`: `effDmg()` adds `if (perkState.hairTrigger) d *= 0.75;` (beside the Glass Cannon line); `effRate()` adds `if (perkState.hairTrigger) r /= 1.55;` (shorter reload = faster fire). Both `effDmg` + `effRate` are already hashed by `upgradeKey()`, so the upgrade panel live-updates when the perk lands.
- **Save-safe:** `hairTrigger` lives **inside `perkState`**, persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)` (old saves default `false`). `resolveWildcard()` rolls it automatically. No new localStorage key, no economy/balance/schema impact.

**Tests:** New group **[78]** (11 checks) — Hair Trigger is a legendary in the pool; `apply()` sets the flag; **−25% damage**; **+55% fire rate** (`rate / 1.55`); **range untouched**; the **net DPS gain ≈ +16%** and is `< 1.2` (bounded, not power creep); `freshPerkState` default `false`; save→reload round-trips the flag; an old save missing the field migrates to `false`; `resolveWildcard()` can roll it; zero console errors. Full suite **805/0 green across 78 groups** (subagent-run). Diff reviewed by a second subagent for guardrails (save compat, scope, theme).

**Docs note:** restored the **v1.67.0 (Shockwave)** CHANGELOG.md entry below — it shipped but its CHANGELOG.md heading was missing (the `cd-core.js` What's-New entry was present), so the markdown changelog had drifted one version behind `GAME_VERSION`. Now back in sync.

---

## v1.67.0 — 2026-06-14 — 🌀 Shockwave — 4th active ability (knock all enemies backward)

**Type:** New content (active ability). Minor bump.

**What:** A 4th active ability, **🌀 Shockwave** (hotkey **R** / gamepad **RT**, cooldown 50s), joining ☄️ Meteor / 🧊 Time Freeze / 💰 Gold Rush — the first new ability in a long time. On cast it **knocks every live enemy backward along the path** (`e.dist -= 75`; bosses only `28`; clamped ≥ 0) plus a brief 0.35s stagger — a defensive panic / repositioning tool distinct from Time Freeze (which pauses enemies in place; Shockwave rewinds their progress and re-exposes them to your towers).

**Why:** Adds tactical depth and chunky game-feel without power creep — it's **pure utility, deals NO damage**, so it can't make the "too easy" balance easier. **CC-immune enemies shrug it off** (`e.ccImmune` Heatwave wave-mod, or a `juggernaut` boss are skipped entirely), reinforcing the crowd-control axis those mechanics are built on.

**How (additive, run-only, save-safe):**
- `cd-defs.js`: `ABILITIES.shock` entry; the ability bar renders generically from `Object.keys(ABILITIES)`, so the 4th button is automatic.
- `cd-state.js`: `abilityCd.shock` initialised in `resetState()` and defaulted in `loadRun()`'s `Object.assign` (old saves load with it ready, cooldown 0).
- `cd-game.js`: a `triggerAbility('shock')` branch (rewind + stagger, skipping CC-immune enemies), an **R** hotkey, and gamepad **RT** (button 7) in `pollGamepad`. Sets `abilityUsedThisRun` (counts against the Pacifist achievement, like Freeze/Rush).
- `cd-core.js`: `SFX.shock()` — a kinetic thump + outward whoosh.
- Run-only (cooldowns never persisted) → save-safe; no economy/schema impact.

**Tests:** Group **[77]** — Shockwave is the 4th ability bound to R; `abilityCd.shock` initialises to 0; knocks a normal enemy back 75; clamps at 0 (no negative dist); a boss is knocked a smaller 28; a Juggernaut boss and a Heatwave (CC-immune) enemy are immune; deals no damage; goes on cooldown; sets `abilityUsedThisRun`; briefly staggers; a second cast while cooling is a no-op; an old save missing `abilityCd.shock` migrates to 0; zero console errors.

---

## v1.66.0 — 2026-06-14 — 🔥 Heatwave — 15th Mayhem wave modifier (enemies resist slow & freeze)

**Type:** New content (Mayhem wave modifier). Minor bump.

**What:** A 15th Mayhem wave modifier, **🔥 Heatwave** — when it rolls on a Mayhem (or Daily Challenge) wave, every enemy + boss is **immune to crowd control**: the Freeze ability and Frost towers' slow do nothing to them for that wave. A warm orange ring marks each immune enemy so the player can see why their Frost towers aren't biting. Mayhem modifier pool **14 → 15**.

**Why:** A genuinely fresh axis — none of the previous fourteen mods touch crowd control. It's the **wave-wide cousin of the Juggernaut boss** (v1.56.0), which already shrugs off CC, and it serves two recurring threads at once: the owner's "too easy" feedback, and the documented **Frost / booster snowball** balance concern — a freeze/slow-reliant build needs real DPS this wave. Deliberately **bounded**: it adds **no HP and no speed**, only removes the player's CC advantage, so it can never make a run *easier* (a stall-only build can't kill faster from it), exactly like the Juggernaut's CC immunity.

**How (additive, run-only, save-safe):**
- `WAVE_MODS` gains `{ id:'heatwave', icon:'🔥', name:'Heatwave', desc:'Enemies resist slow & freeze' }` (inserted before `meteors`) in `cd-maps.js`. `rollWaveMod`/`MOD_BY_ID`/`dailyPreview` all read the array dynamically, so it's picked up automatically (Daily seeded schedule shifts, as with any added mod — the preview mirrors the same stream).
- `buildWave` (cd-game.js) tags `e.ccImmune = true` / `boss.ccImmune = true` when `modIs('heatwave')` — at spawn, like `regen`/`adrenaline`, so concurrent waves each keep their own mod.
- `update()` (cd-update.js) clears `e.frozen = 0; e.slow = 0` for any `e.ccImmune` enemy every frame, **before** `slowMul` is computed (mirrors the Juggernaut line directly above it). So freeze/slow simply never take hold; the timers don't linger.
- `cd-render.js` draws a warm-orange CC-immune cue ring (`rgba(255,138,52,0.6)`) beside the existing regen/adrenaline/warded cues.
- No new localStorage key, no economy/balance/schema impact; `ccImmune` is a run-only enemy field (enemies are never persisted).

**Tests:** New group **[76]** — Heatwave is in `WAVE_MODS`; inert off-mod (no enemy tagged); tags every enemy + the boss; leaves base HP/speed/armor/bounty untouched; a frozen tagged enemy moves at full speed (matches an un-CC'd baseline), a slowed tagged enemy moves at full speed, the frozen/slow timers are cleared each frame; a control untagged frozen enemy stays put (CC works off-mod); inert once the mod is cleared; zero console errors. Full suite green.

## v1.65.1 — 2026-06-14 — 🩺 Health check — all green (769/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass). Patch bump. No new feature.

This is the periodic integrity sweep — 5 feature runs since the last health check (v1.60.1): v1.61.0 (best-scores grid), v1.62.0 (score breakdown), v1.63.0 (Breacher enemy), v1.64.0 (boss armor slope), v1.65.0 (Reaper perk).

**Findings — everything green:**

- **Test suite:** `tests/run-tests.mjs` runs **769 assertions across 75 groups `[1]`–`[75]`, 0 failures**, zero console errors (was 709/71 at v1.60.1; +60 assertions over the five feature runs).
- **Offline / `file://` play intact:** seven classic `<script src>` files load in dependency order (cd-render.js last), no ES modules, inline SVG favicon, PWA trio linked (`manifest.webmanifest` + `sw.js` + `icon.svg`), all paths relative, no build step.
- **Save migration:** old/minimal `cd_save`/`cd_meta` load via additive defaults — `loadMeta()` defaults `talents`/`achievements`/`stats`/`bestCombo`; `loadRun()` `Object.assign(freshPerkState(), …)` defaults new perk flags (reaper/overkill/glassCannon/lastStand) and `mapTheme`. Confirmed by the save round-trip + per-perk migration tests.
- **Docs coherence:** CLAUDE.md formulas/counts all match the code — 8 towers, 8 boss archetypes (`BOSS_ARCHETYPES.length`), 14 Mayhem wave modifiers, 15 achievements, 5 targeting modes; boss HP `template × (14 + w*0.6)`, boss armor `w*0.5`, shield armor `3 + w*0.5`, `enemyTemplate = (18 + w*7 + 1.25·w^1.9) × 1.80 × d.hp × campScale`, Reaper execute threshold 12%.
- **Versions consistent everywhere:** `GAME_VERSION`, `sw.js` `CACHE`, CHANGELOG heading, and the top `CHANGELOG_ENTRIES` body all read v1.65.1.
- **File sizes:** all source files well under the ~1500-line cap — largest is cd-update.js at 1,008 lines (cd-render.js 768, cd-game.js 734, tower-defense.css 497, cd-core.js 459). No dead code, no stray `console.log`/`console.warn`, no TODO/FIXME markers.
- **Table-stakes:** checklist remains complete (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, 44px tap targets). Only open follow-ups: a raster PNG icon set (192/512) for stricter installability audits, and a GitHub Actions CI workflow — both already filed in ROADMAP, neither blocking.

**Fixes this run (small):** refreshed the stale ROADMAP "Split the test harness file" note (4,610→4,784 lines, 73→75 groups, 737→769 assertions) and appended v1.65.1 to the test-harness + table-stakes re-audit lists. No code behaviour change.

## v1.65.0 — 2026-06-14 — 💀 Reaper — new legendary perk (execute non-boss enemies below 12% HP)

**Type:** New content (legendary perk). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry — the Vetoed section stands. Health-check counter: the previous health check was v1.60.1; since then v1.61.0 / v1.62.0 / v1.63.0 / v1.64.0 → this is normal run **#5** of the cycle, so a feature run (the **next** run, the 6th, will be the health check). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices shipped); the routine lets low-priority items be skipped, so I chose my own work. Recent runs leaned difficulty-side (breacher, boss armor); this one diversifies to the **player build-variety** side with a new legendary perk — the owner explicitly enjoys "a weird legendary perk" surprise — while keeping it bounded so it doesn't undercut the "too easy" difficulty work.

**What changed.** Added **💀 Reaper** (legendary) to `PERKS` in `cd-defs.js`: an **execute** mechanic. When a tower hit drops a **non-boss** enemy below **12% of its max HP**, the enemy is instantly destroyed (a `💀 EXECUTE` floater pops). Implemented as a small block in `damage()`'s kill path (`cd-update.js`) — *not* in `effDmg()` — so it routes through the normal death path (combo / bounty / Overkill all credit correctly) and **doesn't churn the upgrade panel** (a combo/effDmg-based scaler would rebuild the panel every kill). Gated `perkState.reaper && e.kind!=='boss' && !fromOverkill` so **bosses are exempt** (the real difficulty axis is untouched) and an Overkill *splash* hit can't trigger an execute (single-layer). The executed remainder is credited to the firing tower's `dealt` (MVP accounting). `reaper:false` added to `freshPerkState()`.

**Why bounded / "too easy"-safe.** It only shaves the last ≤12% off trash you'd have killed a beat later, so the effective non-boss DPS gain is ≤~12% — well below Diamond Core's flat +30% — and **zero** on bosses. As a legendary it's an 8%-draft → 1-of-14-legendaries pick, so it's rare. It pairs nicely with high-rate / chip-damage builds (which struggle to land a finishing blow but love chipping a swarm to the execute line) and with Overkill (an execute can chain an Overkill detonation). `resolveWildcard()` auto-includes it (any un-taken legendary) — no change needed there.

**Save-safe.** `reaper` lives inside `perkState` (added to `freshPerkState()`, default `false`), persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)` — old saves default `false`. No new localStorage key, no economy/schema/balance-of-existing-systems impact.

**Tests.** New group **[75]** (Reaper): execute fires below 12% and not at/above it; bosses exempt; off by default / no execute without the perk; `fromOverkill` splash doesn't execute; save→load round-trips the flag; `resolveWildcard` can roll it. Full suite green (subagent-run). Diff reviewed by a second subagent for guardrails (save compat, scope, theme).

**Files:** `cd-defs.js` (perk + `freshPerkState`), `cd-update.js` (execute block in `damage()`), `cd-core.js` (`GAME_VERSION` + What's-New entry), `sw.js` (cache bump), `tests/run-tests.mjs` ([75]), docs.

---

## v1.64.0 — 2026-06-14 — 🛡 Boss armor slope — late-game bosses harden (anti-armor builds rewarded)

**Type:** Balance (late-game difficulty). Minor bump (behaviour change, no new content/UI).

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: the previous health check was v1.60.1; since then v1.61.0 / v1.62.0 / v1.63.0 → this is normal run #4 of the cycle, a feature run (5+ triggers the next health check). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices shipped); the routine lets low-priority items be skipped, and recent runs have been content-heavy (breacher, adrenaline, overkill, juggernaut), so I picked a **pure balance** lever to diversify and hit the owner's #1 recurring complaint ("too easy, plateaus late").

**What changed.** The boss **armor** slope was steepened `w*0.4 → w*0.5` in `buildWave()` (cd-game.js) — the only number changed. A boss's flat armor now grows a touch faster with wave (now matching the shielded enemy's existing `3 + w*0.5` slope): w20 8→10, w30 12→15, w50 20→25.

**Why this lever (and not boss HP).** I first evaluated the ROADMAP-listed "step the boss HP slope `0.6 → ~0.7`," but found it **conflicts with test [44]'s `≤25%-vs-the-0.5-baseline` invariant**: 0.7/0.5 asymptotes to +40%, breaking the guardrail at w50+ (25.6% at w50). Like the norm-HP curve, the boss HP slope is effectively capped (~0.625) and can't move without owner sign-off. The boss **archetype threshold** (w20→w15) is similarly pinned by test [45] ("bosses below wave 20 stay vanilla", a deliberate tutorial-boss design). The boss **armor slope has no guardrail test** — it's the genuinely-open documented lever.

**Why armor is the right harden.** Armor is *flat subtraction* (`damage()` does `dmg − armor`), so the change is **build-selective**, which is the point:
- High-damage towers barely notice — a Cannon (~120/shot) / Sniper (~300/shot) kills the boss only ~2–5% slower late.
- The anti-armor tools the owner built **ignore it entirely** — Mortar and the gun's AP spec ignore armor; Poison corrodes it −3/hit.
- It **meaningfully** slows the cheap, high-fire-rate / low-damage build (a wall of basic guns) that was trivializing the late game — exactly the "too easy" complaint.

**Simulation (boss kill-time, before→after; full table in the run log).** A *leveled gun* (~45/shot) boss kill is **+5.7% / +10% / +25% slower at w20 / w30 / w50**; Cannon +1.8/2.9/5.3%; Sniper +0.7/1.1/1.8%; Mortar/AP/Poison ~0%. The armor *number* rises exactly **+25%** (the per-run guardrail), and even the worst realistic build's effective-HP swing stays ≤25% up to w50. A lone leveled gun still kills the boss (just slower) → **still beatable**.

**Scope / safety.** Run-only enemy stat — enemies are never persisted, so **no save/schema change**. No new localStorage key, no economy/talent/tower-balance impact. Not covered by the norm-HP invariant ([16]) or the boss-HP invariant ([44]). `waveThreat()`'s boss mirror uses HP, not armor, so no sync needed (test [40] stayed green).

**Tests.** Extended group **[44]** (now "Boss HP + armor slopes"): asserts the live boss armor uses the `w*0.5` slope at every sampled wave and that it's exactly a +25% bump over the old `0.4`. Fixed the stale hardcoded expectation in **[46]** (Armored Surge: wave-10 boss armor is now base `5` + mod `8` = `13`, was `4 + 8`) — the drift-guard catching the base-slope change, as designed. Full suite **756/0 green** (was 749/0; +7 assertions in [44] — six per-wave armor-slope checks + the +25%-swing check — and the [46] boss-armor expectation updated). `sw.js` `CACHE` bumped to `v1.64.0` (test [49]).

## v1.63.0 — 2026-06-14 — ‼ Breacher — heavy enemy that costs 2 lives if it leaks

**Type:** Content / difficulty (new enemy kind). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: the previous health check was v1.60.1; since then v1.61.0 + v1.62.0 — so this is normal run #3 of the cycle, a feature run (not a health check; 5+ triggers the next one). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices shipped); the routine lets low-priority items be skipped, so I picked a higher-value, broad-reach content item.

**What changed.** A new enemy kind — the **‼ Breacher** — spawns from **wave 17+ in every mode** (Classic, Campaign, Mayhem). It's a slow (`spd ×0.7`), moderately-healthy (`hp ×2.0`) dark-red heavy that carries a fresh threat: **if it reaches the exit it costs 2 lives, not 1**. The single life-leak site in `cd-update.js` was generalised from `e.kind === 'boss' ? 5 : 1` to `e.lifeCost || (e.kind === 'boss' ? 5 : 1)`, and the Breacher sets `lifeCost: 2` (so the Last Stand `perkState.livesLost` counter also tallies it correctly). `buildWave()` assigns it at slot `i % 12 === 11` (w≥17), and `waveComposition()` + `KIND_HP_MULT` learn it identically so the bottom-left wave preview shows it and the `⚔ threat` number counts it. It pays a generous bounty (`×2.5`).

**Why.** The owner's most-repeated note is "the game is too easy" — but the norm-enemy HP curve is invariant-capped (test [16]) and the boss/Mayhem levers only bite late or in one mode. Leak-cost is a **brand-new difficulty axis** (no other enemy varies it) that pressures **coverage** in the *early* modes (Classic/Campaign), exactly where the complaint lands. It's deliberately bounded — slow and only moderately tanky, so a competent defense stops it cold; the danger is purely about not letting one through a gap. No HP-curve or economy inflation.

**Scope / safety.** Run-only enemy behaviour — enemies are never persisted, so **no save/schema change**. No new localStorage key, no economy/talent/balance impact. The 2-life cost is not a `%` stat so the ≤25%/run guardrail is N/A; the moderate stats keep it fair. Render: a distinct colour (`#d4566b`), an always-shown `‼` glyph (with `GLYPH_FONT` entry + colorblind-legend entry), and a dark-red cue ring so it reads as a priority threat in a crowd. The threat-gauge drift guard (test [40]: `waveThreat(w) === Σ buildWave(w).maxHp`) stayed green, proving `waveComposition`/`KIND_HP_MULT` stayed in sync with `buildWave`.

**Tests.** New group [74]: wave gating (none <17, present ≥17), the `lifeCost:2` field, a leaked breacher draining exactly 2 lives (vs a norm draining 1, as a control), preview plumbing (`waveComposition`/`enemyGlyph ‼`/`PREVIEW_COLOR`/`KIND_HP_MULT`), the `waveThreat`-vs-`buildWave` sync at w17, and a real w17+ god-tower run clearing cleanly. Full suite **749/0 green** (was 737; +12), zero console errors. `sw.js` cache bumped to `v1.63.0` (test [49]).

## v1.62.0 — 2026-06-14 — 🧮 Score breakdown on the end screen

**Type:** Feature / UX polish. Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: the previous health check was v1.60.1; since then only v1.61.0 — so this is normal run #2 of the cycle, a feature run (not a health check). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices already shipped); the routine lets low-priority items be skipped, so I picked a higher-value ROADMAP follow-up instead.

**What changed.** The end-of-run screen now exposes a collapsible **score breakdown**. `computeScore()` (cd-update.js) has long returned `parts` (per-term points), `diffMult` and `effMult`, but `renderEndScreen()` discarded all of it — the player saw only the final number with no explanation. A new `scoreBreakdownHtml(sc)` helper renders a `<details class="ovBreak">` under the score grid: each non-zero term (🌊 waves / 💥 kills / ❤️ lives / 🪙 gold / 🔥 combo / 🎖️ campaign / 🏆 victory) with its point value, a subtotal, then `× Difficulty (name)` and `× Efficiency (N towers)`, then the final score. It's collapsed by default (`<summary>▸ Score breakdown</summary>`), so the deliberately-decluttered v1.16.0 screen reads exactly as cleanly as before unless the player opens it.

**Why.** ROADMAP listed "a score breakdown tooltip (each term's contribution)" as an open follow-up to the v1.16.0 scoring system. The owner asked for a scoring system; making the *fewer-towers / bigger-combos / more-gold* levers legible lets players see which choices actually move the number and chase a better grade on purpose.

**Scope / safety.** Render-only. No new localStorage key, no economy/balance/save-schema impact — it only *reads* the object `computeScore()` already builds. Only non-zero terms are listed (campaign/victory rows hidden on a quick-mode defeat). Native `<details>`/`<summary>` — no JS toggle, works offline on `file://`.

**Tests.** New group [73] asserts the breakdown renders on the end screen, lists the contributing terms, the difficulty + efficiency multiplier rows, and the final score, and stays collapsed by default. Full suite green (subagent-run). CSS lives beside the `.ovSection` block in tower-defense.css.

## v1.61.0 — 2026-06-14 — 🏆 Best scores on the Records panel

**Type:** Feature / progression. Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: the previous entry (v1.60.1) was a health check, so this is normal run #1 of the next cycle — a feature run. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices already shipped); the routine lets low-priority items be skipped, so I chose a higher-value ROADMAP follow-up instead.

**What changed.** The 🏆 Records panel now tracks **best end-of-run SCORE**, not just deepest wave. The scoring system (v1.16.0) already grades every run — distance × cleanliness (lives, combos, fewer towers) × gold, scaled by difficulty — but the result only flashed on the end screen and a single hidden all-time best was kept. Now:
- A new **🏆 Best scores** grid (per map × difficulty, quick mode) renders below the existing **🌊 Best waves** grid, both with section sub-headers.
- An **🏆 Best score** all-time stat joins the `.bestStats` footer.
- A new `recordScores(score)` helper (cd-update.js) writes the all-time `cd_bestscore` (as before) **and**, in quick mode (not daily), an additive per-map+difficulty `cd_bestscore_<map>_<diff>` key — the score mirror of `recordBest()`'s per-map wave logic. Campaign (random maps) and Daily (own seed) don't post per-map scores, matching best-wave. `renderEndScreen()` now calls it instead of recording the all-time best inline (identical all-time behaviour).

**Why.** Gives a fresh replay hook: beat a map you've already cleared not by surviving one wave deeper, but by posting a cleaner, higher-scoring run — feeding the addictive progression loop the owner likes. Closes two ROADMAP follow-ups under "End-of-run score" ("show the best score on the Records panel" + "per-map / per-difficulty best scores").

**Save-safe / scope.** Purely additive — new `cd_bestscore_*` keys read with `|| 0`, so old saves start blank and fill in as you play; no gold/chip/economy/balance impact; swept by `resetAllData()`'s `cd_`-prefix clear. CSS adds one `.bestSub` rule; the panel subtitle updated to mention scores. SW `CACHE` bumped to v1.61.0.

**Tests.** New group **[72]** (16 assertions): `recordScores` records all-time + per-map on a first run, a lower score lowers neither, a higher score raises the per-map best, the key is difficulty-specific, campaign/daily write no per-map key (but all-time still updates in every mode), and `renderBests()` emits two sub-headers + two grids + the footer best-score stat. Full suite **725/0 green**. Verified in-preview at v1.61.0 (two grids + sub-headers render, footer "🏆 Best score: 52.3k", zero console errors; SW cache cleared first per the known stale-shell gotcha).

## v1.60.1 — 2026-06-14 — 🩺 Health check — all green (709/0, docs coherent, no drift)

**Type:** Maintenance / health check (no new feature). Patch bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: 5 normal entries since the last health check (v1.55.1 → v1.56.0, v1.57.0, v1.58.0, v1.59.0, v1.60.0) → **this is the health-check run**. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices in); the routine lets low-priority items be skipped, and no `[bug]` items are queued, so the health check proceeds.

**1. Refactor audit:** All seven game source files are comfortably under the ~1500-line cap — cd-update.js 942, cd-render.js 757, cd-game.js 716, cd-core.js 453, cd-defs.js 369, cd-maps.js 291, cd-state.js 177 (plus tower-defense.html 153, tower-defense.css 483, sw.js 51). No dead code, no leftover `console.log`/`debugger`, no real TODO/FIXME (the lone "TODO" grep hit is text inside a past changelog body). The dev-only `tests/run-tests.mjs` is now **4,484 lines (71 groups `[1]`–`[71]`, 709 assertions)** — by far the largest file in the repo, still the standing `[refactor]` ROADMAP item (updated its stale 4,234/69-group counts). No new refactor needed this run.

**2. Docs coherence:** Read CLAUDE.md / CHANGELOG.md / FEEDBACK.md / ROADMAP.md against the code. Every documented number still matches reality: **8** towers (`TYPE_KEYS`), **8** boss archetypes (`BOSS_ARCHETYPES`), **14** Mayhem wave mods (`WAVE_MODS`), **15** achievements (`ACHIEVEMENTS`), **5** targeting modes, boss HP slope `14 + w*0.6` (cd-game.js buildWave + waveThreat mirror), `KIND_HP_MULT` map intact. Versions consistent everywhere: `GAME_VERSION`, `sw.js` CACHE, and the newest `CHANGELOG_ENTRIES`/CHANGELOG heading all read v1.60.1. **Fixed one piece of doc rot:** CLAUDE.md's test-harness line still called the shipped game "the three raw files" (pre-domain-split language from before v1.8.2) — corrected to "HTML + CSS + the seven `cd-*.js` files + the PWA trio." Vetoed section intact; FEEDBACK pending item left as-written.

**3. Table-stakes audit:** Checklist remains **complete** (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, ~44px tap targets). No new gaps found; the optional follow-ups (raster PNG icon set for stricter Lighthouse installability, dev error reporting) stay noted in ROADMAP, not blocking.

**4. Integrity spot-checks:** Full suite **709 passed / 0 failed**, exit 0 (run by subagent). The harness drives the real `tower-defense.html` headlessly over `file://`, so green also confirms double-click offline playability with zero console errors (classic script tags, correct load order, no ES modules, inline favicon, all relative paths). Old-format save migration verified by inspection: `loadMeta()` defaults a minimal `cd_meta` (chips-only) with talents/achievements/stats maps and clamps ranks; `loadRun()` uses `Object.assign(freshPerkState(), …)` + a `MODES.includes` guard, so pre-update saves keep loading.

**Findings → ROADMAP:** none new of substance; refreshed the test-harness-split entry's counts and the table-stakes re-audit marker. Files touched: CLAUDE.md (1 line), ROADMAP.md (2 lines), CHANGELOG.md, cd-core.js (version + entry), sw.js (cache version). No code/behaviour/balance/save change.

---

## v1.60.0 — 2026-06-14 — 🌈 Combo board glow — hot streaks light up the whole board

**Type:** Game-feel / polish (render-only). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: 4 normal entries since the last health check (v1.55.1 → v1.56.0, v1.57.0, v1.58.0, v1.59.0) → **normal improvement run** (health check due next run at 5). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices in); per the routine, low-priority items don't pre-empt own-prioritized work. Recent runs were all content (perk/mod/gauge/boss), so picked a fresh game-feel item from the ROADMAP "Game feel / polish" list — the long-standing *"combo-gated board tint at huge streaks"* (a chunky-feedback effect the owner explicitly loves), a nice change of pace from yet another piece of content.

**What & why:** A new **combo board glow**. Once your kill-streak passes the first milestone (10×), the playfield edges breathe with the combo-tier colour and that glow **escalates with the streak** — gold at 10×, deepening through orange (20×) and red (30×) to blazing purple at 50×. It makes a hot streak *feel* hot (the screen lights up around you as you keep clears rolling) and fades the instant the chain breaks. Pure spectacle layered over the existing dark vignette — no gameplay, economy, balance, or save impact.

**Settings-aware:** it pulses, so it's gated exactly like every other juice effect — the ✨ Particle setting scales it (Reduced dials it down via the `particleDensity` multiplier, **Off** suppresses it entirely) and OS **reduce-motion** suppresses it. So players who opt out of motion/particles never see it.

**Code:** `cd-state.js` — new pure helper `comboGlowTier(n)` (0 below 10×, then 1..4 by tier — beside `comboColor`, so the gating is unit-testable). `cd-render.js` — in `draw()`, right after the dark vignette, a tier-driven radial-gradient edge glow (transparent centre → `comboColor()` edge via 8-digit `#RRGGBBAA` stops; alpha = `(0.07 + tier·0.07)·particleDensity·breathe`, a `performance.now()`-driven breathe), gated `comboTimer>0 && started && !gameOver && particleDensity>0 && !reduceMotion()`.

**Save-safe:** render-only, run-only combo state (never serialized). No new localStorage key, no schema/economy change.

**Tests:** new group **[71]** — `comboGlowTier` tier boundaries (9→0, 10→1, 20→2, 30→3, 50→4), `draw()` renders cleanly at a hot combo, and the glow path is reduce-motion/particles-off gated (no throw). Full suite green. Reviewed by subagents for guardrails (save-compat, scope, version bookkeeping) — all pass.

---

## v1.59.0 — 2026-06-14 — 💢 Overkill — new legendary perk (slain enemies detonate)

**Type:** Content (new run perk). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: 3 normal entries since the last health check (v1.55.1 → v1.56.0, v1.57.0, v1.58.0) → **normal improvement run** (health check is due at 5). FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, four slices in); per the routine, low-priority items don't pre-empt own-prioritized work, so picked a fresh content addition the owner explicitly likes ("surprise them … a weird legendary perk").

**What & why:** A brand-new legendary run-perk, **💢 Overkill**: while held, any slain non-boss enemy **detonates**, splashing **25% of its max HP** as armor-ignoring true damage to enemies within 60px. It's a chunky chain-reaction swarm-clear mechanic — landing a kill inside a tight cluster can light up the whole pack at once — that pairs with the kill-streak combo meter (faster clears → longer streaks) and stays relevant deep into a run because the splash scales with the slain enemy's max HP. Squarely in the owner's loved category (chunky game feel + a weird legendary), it adds replay variety and a build-defining draft choice (swarm-clear / chip-damage synergy).

**Bounded by design (not "too easy"-breaking):** it's **single-layer** — only the *original* killing blow detonates; a splash-killed enemy does **not** re-explode — so you still must land the killing blow on each "seed" enemy yourself. Bosses don't detonate. Implementation guards re-entry with a new optional `fromOverkill` param on `damage()` (defaults false → all existing callers unaffected); the splash call passes it `true`, so recursion depth is bounded to 1 and total work is bounded by the live enemy count (same pattern as the existing cannon/mortar splash).

**Code:** `cd-defs.js` — perk pushed to `PERKS` (legendary) + `overkill:false` added to `freshPerkState()`. `cd-update.js` — `damage()` gains the `fromOverkill` param and a guarded detonation block inside the kill path (`addExplosion` + `SFX.bomb()` + a 60px-radius splash loop). The Wildcard gamble perk (`resolveWildcard()`) now includes Overkill in its legendary pool automatically.

**Save-safe:** `overkill` lives inside `perkState`, persisted whole by `saveRun()` and restored via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)`; old saves default to `false`. No new localStorage key, no economy/schema impact.

**Tests:** new group **[70]** (12 checks) — perk is a pool legendary, `apply()`/`freshPerkState` defaults, 25% splash to a near enemy, far enemy untouched, armor-ignoring, **single-layer guard** (a splash-kill doesn't chain onto a third enemy), boss exclusion, no-detonation-when-unheld, save round-trip + old-save migration. Full suite **700/0 green** (was 688; +12). Reviewed by subagents for guardrails (save-compat, scope, recursion bound, version bookkeeping) — all pass.

---

## v1.58.0 — 2026-06-14 — 💉 Adrenaline — 14th Mayhem wave modifier (wounded enemies accelerate)

**Type:** Content (new Mayhem wave modifier). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: 2 normal entries since the last health check (v1.55.1 → v1.56.0, v1.57.0) → **normal improvement run**. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already four slices in); per the routine, low-priority items don't pre-empt own-prioritized work, so picked the strongest clean ROADMAP follow-up instead.

**What & why:** The open ROADMAP item "More wave modifiers" (the `[~]` pool, at 13) asks for genuinely-fresh mechanics rather than clones of the existing ones. None of the 13 mods tie enemy **speed to damage taken across the whole wave** — `frenzy` is a flat +35%, and the wounded-accelerates idea only existed on the single Berserker boss. **Adrenaline** is the wave-wide version: every enemy speeds up as it loses HP, up to **+50% at near-death**. It pressures **chip-damage builds on a fresh axis** — a wounded-but-alive enemy sprints for the exit and can leak before slow/spread fire finishes it, rewarding bursty focused damage — which serves the recurring "too easy" feedback without adding raw HP (the norm-HP curve is invariant-capped by test `[16]`). Because the boost ramps from 0 with missing HP, the **average** speed over an enemy's life is *below* Frenzy's flat +35%, so it's challenging but fair, and it can never make a run *easier* (speed only goes up).

**Implementation (additive, run-only — no save/economy/balance impact):**
- `cd-maps.js` — new `{ id:'adrenaline', icon:'💉', name:'Adrenaline', desc:'Wounded enemies accelerate' }` in `WAVE_MODS`, inserted before `meteors` (so the friendly Meteor Shower stays visually last). `MOD_BY_ID` + the rng pool size pick it up automatically. Pool **13 → 14**.
- `cd-game.js` — `buildWave()` tags `e.adrenaline = true` on each enemy (and `boss.adrenaline = true`) when `modIs('adrenaline')`, mirroring the `regen` tag.
- `cd-update.js` — one inline factor in the movement line (beside `berserkMul`): `adrenalineMul = e.adrenaline ? 1 + 0.5*max(0, 1 - hp/maxHp) : 1`. `slowMul` zeroes it under freeze (freeze counters it cleanly) and Frost slow multiplies in — identical CC interaction to the Berserker.
- `cd-render.js` — a faint red ring fades in around an accelerating enemy (alpha scales with missing HP), only once it's actually below full HP, so the "this one is racing" cue reads at a glance. Mirrors the regen-halo draw.

**Balance:** Peak +50% (a NEW conditional mod effect, in line with peers — `titans` +50% HP, `swarm` +60% count, `frenzy` +35% spd; the Berserker boss uses +60%). Average impact across an enemy's lifetime is below Frenzy's flat +35%, and base enemy/boss speeds are unchanged. Bounded and beatable; counters exist (Freeze/Frost, burst damage).

**Testing:** New test group **[69]** (10 checks): the mod is in `WAVE_MODS`; `buildWave` tags every enemy + boss when active and is inert otherwise; base HP/speed/armor/bounty are untouched; a one-frame `update()` sim confirms a wounded tagged enemy outruns a full-HP one (~+40% at 80% missing HP), a full-HP tagged enemy matches an untagged one (ramp starts at 0), freeze zeroes movement, and the multiplier is bounded to +50%. Full suite run via subagent + a guardrail-review subagent on the diff before commit. Verified live in the http preview.

## v1.57.0 — 2026-06-14 — ⚔ Threat gauge — next-wave total-HP number on the wave preview

**Type:** UX / quality-of-life (render + one pure helper). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: 1 normal entry since the last health check (v1.55.1) → **normal improvement run**. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already four slices in); per the routine, low-priority items don't pre-empt own-prioritized work, so picked the strongest clean ROADMAP follow-up instead.

**What & why:** The bottom-left between-waves preview already shows a glanceable **icon roster** of the next wave (a colour disc + glyph + ×count per enemy kind) so you know *what* is coming. The open ROADMAP follow-up under "Wave preview" asks to also surface the next wave's **total HP / threat number** so you know *how hard* it hits. Added a `⚔ N HP` gauge to that strip (e.g. `⚔ 15.1k HP`): it lets you spot an incoming HP spike — a boss wave, or a wave thick with tanks — and buy up *before* it lands instead of getting caught short. It **reddens on every 5th (boss) wave** to flag the climactic ones, and it automatically reflects difficulty + campaign level (Hard / deep-campaign waves read bigger). Serves the recurring "give me strategic depth / planning tools" thread without touching balance.

**Implementation (additive, render-only — no save/economy/balance impact):**
- `cd-game.js` — new `waveThreat(w)` helper (beside `waveComposition`) returns the total raw HP of an upcoming wave's **deterministic base roster**. Built from `waveComposition()` (the single source of kind counts) × a `KIND_HP_MULT` map × `enemyTemplate(w)` (the single source of base HP + difficulty + campaign scaling), plus the boss's `14 + w*0.6` mult. The per-kind multipliers + boss formula **mirror `buildWave()`** with a KEEP-IN-SYNC comment — the same hand-mirror convention `waveComposition` already uses.
- `cd-render.js` — draws the `⚔ {fmtNum(threat)} HP` label after the icon roster in the existing `!waveActive` preview block (violet normally, red `#f85149` on boss waves). Pure draw; reuses the established `px`/`py` cursor.
- Like `waveComposition`, it's the **pre-mod base** (Mayhem's swarm/titans/etc. aren't rolled yet) — a planning estimate, documented in the helper comment.

**Testing:** Extended test group **[40]** (Wave-preview composition) with four assertions: `waveThreat()` equals the real `buildWave()` total HP at every sampled wave (a direct drift-guard on the mirrored multipliers), rises with wave number, spikes on a boss wave (w15 > w14), and scales with difficulty (hard > normal). Full suite **678 passed / 0 failed** (was 674). Verified live in the http preview (SW/cache cleared first): `waveThreat(10)` === `buildWave(10)` sum to the float, formats as "15.1k", boss-wave spike confirmed, preview draws with zero console errors. A guardrail-review subagent confirmed: no persisted state, multipliers mirror `buildWave` exactly, load order correct (`waveThreat`/`fmtNum` in cd-game.js used by cd-render.js which loads after), no PII.

## v1.56.0 — 2026-06-14 — ⬜ Juggernaut — 8th boss archetype (immune to crowd control)

**Type:** Content (new boss archetype). Minor bump.

**Pre-flight:** `git pull` clean (already up to date). No revert/veto commits since the last entry. Health-check counter: the last entry (v1.55.1) was a health check, so 0 normal runs since — **this is a normal improvement run**. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp); per the routine, low-priority items don't pre-empt own-prioritized work, and that revamp already has four shipped slices. Prioritized the strongest open ROADMAP signal instead.

**What & why:** The owner's most-repeated feedback is "too easy **and boring**" — both raw difficulty and *variety*. The ROADMAP lists "an 8th archetype" as an open Boss-variety follow-up, and that additive, run-only pattern has shipped safely seven times. Added **🟦 Juggernaut** — a boss that is **immune to crowd control**: the Time Freeze ability and Frost towers can't freeze or slow it. This is a genuinely new pressure axis (none of the other seven archetypes touch CC) and it doubles as a gentle check on the long-standing **Frost/booster snowball** balance concern (a freeze/frost-reliant build now needs real DPS for this one boss). It only appears on deep bosses (wave 20+); it has no other mechanic and still moves at the base 0.45× boss speed, so it's bounded and beatable — behaviour, not more HP (the norm-HP curve is invariant-capped by test [16]).

**Implementation (additive, save-safe — enemies are never persisted):**
- `cd-game.js` — `'juggernaut'` appended to `BOSS_ARCHETYPES` (cycle length reads `.length`, so the rotation auto-extends to 8: w50→disruptor, w55→juggernaut, w60→regen). Rotation/comment updated.
- `cd-update.js` — one **unconditional** line in the enemy loop *before* `slowMul` is computed: `if (e.kind==='boss' && e.bossType==='juggernaut') { e.frozen=0; e.slow=0; }`. Mirrors the teleporter `blinkInvuln` decay pattern (runs every frame so CC never sticks). No gated-block behaviour — its whole gimmick is the CC immunity. Archetype summary comment updated.
- `cd-render.js` — steel-grey aura ring (`192,200,214`) + `bossMechanicBadge` → `UNSTOPPABLE` (same colour), matching the established colour-coded-aura/badge convention.
- `sw.js` — CACHE bumped to `circuit-defense-v1.56.0` (test [49] asserts it tracks `GAME_VERSION`).

**Balance:** No tunable number — CC immunity is binary, and the boss has no extra HP/speed/damage, so it can't make any run *easier* (it strictly raises difficulty for freeze-reliant builds). Within all guardrails (no ≤25%-swing concern since no stat changed).

**Tests:** Extended group **[45]** — rotation now asserts the 8-cycle (w55→juggernaut, w60→regen); new behaviour checks: a frozen juggernaut still advances (immune), a frozen *non*-juggernaut boss stays pinned (control), frost slow is cleared, and the juggernaut is killable. Extended group **[53]** — `UNSTOPPABLE` badge label+colour. Suite run via subagent before commit.

## v1.55.1 — 2026-06-14 — 🩺 Health check — all green (669/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. Health-check counter: 5 entries since the last health check (v1.50.1) — v1.51.0, v1.52.0, v1.53.0, v1.54.0, v1.55.0 → **this run is the health check**. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp) — low-priority items don't pre-empt the health check.

**1. Refactor audit:** All seven game files are well under the ~1500-line cap — cd-update.js 908, cd-render.js 720, cd-game.js 696, cd-core.js 447, cd-defs.js 364, cd-maps.js 290, cd-state.js 170 (HTML 153, CSS 483, sw.js 51). No new duplicated logic or dead code spotted. The lone oversized file remains the **dev-only test harness** (`tests/run-tests.mjs`, now 4,234 lines / 69 groups) — already tracked as a `[ ]` split item in ROADMAP (stat refreshed this run); it doesn't ship.

**2. Docs coherence pass:** Verified CLAUDE.md against the code — all key counts/formulas still match: **8 towers**, **21 talents**, **13 Mayhem wave modifiers** (frenzy/swarm/titans/goldrush/drought/surge/fog/armored/brownout/regen/emp/wardens/meteors), **7 boss archetypes** (regen→summoner→bulwark→enrager→teleporter→berserker→disruptor), **15 achievements**, **5 targeting modes** (first/last/strong/close/support). Formula spot-checks: norm-HP `(18 + w*7 + 1.25·w^1.9)·1.80` ✓, boss HP mult `14 + w·0.6` ✓, Tesla chain falloff `overcharge?1:(super?0.8:0.7)` (the v1.55.0 buff) ✓. `GAME_VERSION` = `sw.js` CACHE = CHANGELOG head = v1.55.1 ✓. Fixed drift: cited the Gauntlet map's test group `[68]` in CLAUDE.md's maps section (was uncited); refreshed ROADMAP's stale test-harness stat (3,991→4,234 lines, 67→69 groups `[0]`–`[68]`, 608→645 check sites / 632→669 assertions) and appended v1.55.1 to the two re-audit lists.

**3. Table-stakes audit:** Checklist remains **complete** — favicon/meta/OG, installable PWA (offline SW), touch/pointer controls, gamepad, keyboard a11y (menus + draft), colorblind aid, reduced-motion, volume slider, high-DPI scaling, responsive/mobile, ~44px tap targets. No new gaps; optional follow-ups (raster PNG icon set, gamepad menu nav, remappable buttons) stay logged in ROADMAP.

**4. Integrity spot-checks:** Full suite **669/0 green, exit 0**. Double-click `file://` playability intact (classic `<script src>` in dependency order, no ES modules, inline favicon, no build step, all relative paths; SW registration http/https-guarded so local-file play + the headless harness are unaffected). Old/minimal-save migration verified: `loadMeta()` defaults a missing `talents`/`achievements`/`stats` map and clamps ranks; `loadRun()` merges `perkState` over `freshPerkState()` defaults. Deploy workflow copies `index.html` + game shell + `cd-*.js` + the PWA trio into `_site`.

**Findings → ROADMAP; fixes this run stayed small (doc-only).** No code/behaviour/balance/save change beyond the version + cache-version bump.

## v1.55.0 — 2026-06-14 — ⚡ Superconductor buff — Tesla's swarm spec is no longer dominated

**Type:** Balance (tower spec rebalance). Minor bump. Buffs a strictly-dominated level-5 spec; no save/economy impact. Simulated before/after, swing under the ≤25%/run cap.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. Health-check counter: 4 entries (v1.51.0, v1.52.0, v1.53.0, v1.54.0) since the last health check (v1.50.1) → normal run. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already 4 slices in) — low-priority items don't override own-pick selection, so I chose own work. Picked the explicit ROADMAP **"Tower spec pass"** `[~]` item (audit each tower's 2 specs for a strictly-dominated option and buff it), which had flagged tesla's "verify falloff math" as outstanding.

**What & why:**

- **Audit finding:** Tesla's two level-5 specs are **Superconductor** (chains 5 targets instead of 3) vs **Overcharge** (3 targets, no damage falloff). With the shared chain falloff at 0.7, Superconductor's total output even on a full 5-enemy chain was `1+0.7+0.49+0.343+0.24 = 2.77×`, while Overcharge dealt `1+1+1 = 3.0×` — so **Overcharge out-totalled Superconductor in *every* scenario** and dealt full damage to each of its 3 targets, while Superconductor's two extra jumps landed only ~34%/24% chip. Superconductor was a strictly-dominated trap pick.
- **Fix:** softened **Superconductor's chain falloff `0.7 → 0.8`** (spec-specific — base Tesla and Overcharge are untouched). Superconductor's tail jumps now take 51%/41% instead of 34%/24%, so on a full 5-enemy swarm it totals `3.36×` and **out-totals Overcharge (3.0×)** — the intended swarm-clearer identity — while Overcharge stays the better pick for a few tough targets (full damage to 3; it still wins at ≤4 chained). A genuine swarm-vs-few axis instead of a trap.
- **Why this lever:** restoring a real level-5 choice serves the owner's "meaningful choices" value. It's a buff to a weak option (not power creep toward "too easy"): it only matters when a tower chains a real 5-enemy swarm, and Overcharge — the previously-correct pick — is unchanged.

**Balance / simulation:** Superconductor's total output at a full 5-enemy chain rises `2.77× → 3.36×` = **+21.2%**, inside the ≤25%/number/run cap. Crossover vs Overcharge (`3.0×`): Superconductor wins at 5 chained, Overcharge wins at ≤4 — clean axis. Base Tesla (3 chains @ 0.7) and Overcharge (3 chains @ 1.0) are byte-identical.

**Save/economy/theme:** No schema or localStorage change (the falloff is computed live in `fireChain`, never persisted). No economy impact. Stays a tower-defense balance tweak.

**Tests:** Extended group `[17]` with six checks driving `fireChain` over a 6-enemy line — Superconductor chains 5 / 2nd link = 80 (0.8 falloff) / out-totals Overcharge on a swarm / under the +25% cap; Overcharge unchanged (3 links, no falloff); base Tesla unchanged (3 links, 2nd = 70). Full suite green (subagent-run). Diff-reviewed for guardrails (save-safe, scope, ≤25% swing).

**Files:** `cd-update.js` (`fireChain` falloff), `cd-defs.js` (Superconductor desc → "Chains 5 targets, softer falloff"), `cd-core.js` (version + changelog), `sw.js` (cache bump), `tests/run-tests.mjs` (group `[17]`), `CHANGELOG.md`, `ROADMAP.md`, `CLAUDE.md`.

## v1.54.0 — 2026-06-14 — ⚔️ Gauntlet — 4th quick-play map (central kill-box) + Crimson theme

**Type:** Content (new map + visual theme). Minor bump. Additive, save-safe, no economy/balance/HP impact — a new hand-crafted path with a distinct strategic flavour.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. Health-check counter: 3 entries (v1.51.0, v1.52.0, v1.53.0) since the last health check (v1.50.1) → normal run. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already 4 slices in) — low-priority items don't override own-pick selection, so I chose own work. Deliberately broke from the recent cadence (the last several runs were boss archetypes / wave mods / achievements — all enemy/economy-side) and picked the **map** content axis, untouched since the original three quick maps + Mayhem.

**What & why:**

- **⚔️ Gauntlet** — a 4th named quick-play map (`MAPS.gauntlet` in cd-maps.js, inserted before Mayhem so Mayhem stays last). A 12-point, axis-aligned switchback path that enters mid-left, weaves tightly down the centre as a stack of closely-spaced vertical runs (columns at x=300/480/660 over y≈110–420), then exits mid-right. Path length ≈2260 — between Classic and Serpent.
- **Why:** the existing maps are *open* (winding/coiled/wide switchbacks); the Gauntlet packs its lanes close together so a tower wedged between two runs rakes both at once. It rewards a **concentrated wall of fire over spreading thin**, and splash/AoE towers (Cannon, Mortar, Tesla) shine — a distinct strategic identity, plus a new per-map best to chase. Map content hasn't been added since the originals, so it's fresh replay variety.
- **🟥 Crimson theme** — a new `THEMES.crimson` palette (deep blood-red) gives the Gauntlet its own visual identity (`MAP_THEME.gauntlet:'crimson'`); also added to `CAMPAIGN_THEMES` so campaign attempts can roll it too. Purely cosmetic (feeds `draw()` background/stars/grid/path layers via the existing palette system).
- **Fully data-driven surfaces:** the start-screen MAP selector (`renderStartScreen` iterates `Object.keys(MAPS)`), the Records grid (`renderBests` per map × difficulty), `recordBest()`'s `cd_best_<map>_<diff>` key, and `loadRun()`'s `MAPS[mapKey]` validation all pick the new map up with no other edits.

**Save-safety:** purely additive. New `MAPS`/`THEMES`/`MAP_THEME`/`CAMPAIGN_THEMES` entries; a new per-map best key `cd_best_gauntlet_<diff>` read with `|| 0`. No schema change to `cd_save`/`cd_meta`/`cd_campaign`. Old saves referencing existing maps still validate; a Gauntlet save round-trips (it's a static map, so no relocate needed on resume). `mapTheme` already saved/restored for resume parity; old saves fall back cleanly.

**Tests:** new group `[68]` — map exists/named, path is axis-aligned (no diagonals/zero-length segs) within bounds entering -30 / exiting 930, sits before Mayhem; Crimson palette exists, is the map's fixed identity, resolves on a run, and is in the campaign pool; appears in the start-screen selector; a real run wires the static path and drives clean to wave 5+; records a per-map best; save/resume round-trips. Suite **663/0** green (+15). Verified live in-browser (v1.54.0, map/theme/selector/path all correct, a wave completed with no leak, zero console errors). Subagents ran the full suite and reviewed the diff for guardrail compliance before commit.

## v1.53.0 — 2026-06-14 — 🧰 Full Arsenal — 15th achievement (win with all 8 tower types)

**Type:** Content (new achievement badge). Minor bump. Additive, save-safe, no economy/balance/HP impact — a build-diversity goal that rewards fielding one of every tower type.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. Health-check counter: 2 entries (v1.51.0, v1.52.0) since the last health check (v1.50.1) → normal run. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already 4 slices in) — low-priority items don't override own-pick selection, so I chose own work. Considered the ROADMAP tower-spec audit (frost/tesla/gun) first but confirmed it's a no-op: none is *strictly* dominated (tesla = genuine concentrate-3-vs-spread-5 axis, gun = situational armor axis, frost = CC-vs-dmg axis). Avoided a boss/wave-mod/targeting follow-on (the last several runs) and picked a fresh, contained, owner-aligned ("loves achievements/surprises") addition.

**What & why:**

- **🧰 Full Arsenal** (`arsenal`) — a 15th badge in the `ACHIEVEMENTS` array (cd-update.js), granted from `grantAchievements(won)` when `won && new Set(towers.map(t => t.type)).size === TYPE_KEYS.length` (all 8 tower types present on the final board at victory). Reads the same final-board snapshot as Specialist/Minimalist; ability-agnostic.
- **Why:** completes the build-style trio — 🧩 Specialist (1 type), ⚖️ Minimalist (≤5 towers), 🧰 Full Arsenal (all 8 types). A deliberate counterpoint to mono-tower min-maxing: you must spread gold across one of every kind and keep them all alive to the win, a "meaningful choice" the owner values. Not power creep (it's a *constraint*, if anything harder), so it's "too easy"-safe.
- **Fully data-driven surfaces:** `renderAchievements()` / the `#achBtn` `done/total` counter / `ACH_BY_ID` all read `ACHIEVEMENTS` directly, so the panel + start-screen count pick it up with no other edits.

**Save-safety:** purely additive — one new badge id in the existing id→true `meta.achievements` map (already migrated with a default in `loadMeta()`). No new localStorage key, no schema/migration impact; old saves simply start with the badge locked.

**Tests:** group `[48]` extended — Full Arsenal **granted** for an all-8-types win, **withheld** when one type is missing (7 of 8) and for 8 towers of a single type, zero-tower finish grants it neither; roster-count assertion bumped 14 → **15**. Subagent ran the full suite (green) and reviewed the diff for guardrail compliance before commit.

## v1.52.0 — 2026-06-14 — 🔵 Disruptor — 7th boss archetype (EMPs your towers, w20+)

**Type:** Content (new boss archetype). Minor bump. Ships the ROADMAP "Boss variety → a 7th archetype" follow-up. Additive, run-only state, save-safe, no economy/HP-curve impact — hardens the late game by pressuring **tower uptime/coverage** (behaviour), not the invariant-capped HP axis.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. Health-check counter: 1 entry (v1.51.0) since the last health check (v1.50.1) → normal run. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already 4 slices in) — low-priority items don't override own-pick selection, so I chose the highest-value open ROADMAP follow-up serving the recurring "too easy" feedback.

**What & why:**

- **🔵 Disruptor** (`bossType:'disruptor'`) — a 7th entry in `BOSS_ARCHETYPES` (cd-game.js). From wave 20+ each every-5th-wave boss carries a mechanic, cycling by boss number `(w/5−4) % BOSS_ARCHETYPES.length`; the Disruptor lands at index 6 → first appears at **w50** (then w85…), and the cycle now runs regen → summoner → bulwark → enrager → teleporter → berserker → **disruptor** (w55 wraps to regen). Early/tutorial bosses (w5/10/15, campaign L1–5 finals) stay vanilla.
- **Mechanic:** ticked in `update()`'s gated boss block (cd-update.js, `e.kind==='boss' && e.bossType && e.frozen<=0`). Every ~4s (`empPulseCd`, seeded 3) it knocks the **nearest** firing tower within 150px **offline** by setting `t.empT = 2.2` — **reusing the Static Storm `empT` infrastructure** (the firing-skip + per-frame decay + render dim are already general, not mod-gated). A cyan crackle ring + ⚡ already draw over any `empT>0` tower. Fires `SFX.zap()` + a cyan burst on the tower and the boss + a small shake.
- **Bounded & fair:** one tower per pulse (a coverage dead-zone *roams* with the boss rather than a board-wide blackout); **buff/support towers are immune** (skipped, like the emp wave mod); **freeze pauses** the pulse (it's in the gated block); and the silenced tower **always recovers on its own** (empT decays unconditionally), even if the boss dies mid-pulse — so a tower can never get stuck offline. Rewards redundant overlapping fire over leaning on one super-tower at a chokepoint.
- **Render** (cd-render.js): a **cyan** archetype aura ring (`125,249,255`) + a **DISRUPTOR** boss-bar badge (`bossMechanicBadge()`), colour-matched.

**Save-safety:** all fields (`bossType`, `empPulseCd`, the towers' `empT`) are **run-only and lazily initialised** — enemies are never persisted, and `empT` is not a serialized tower field in `saveRun()` (and decays unconditionally), so there's zero save/schema/migration impact. No new localStorage key, no economy/balance change.

**Tests:** group `[45]` extended — rotation now asserts w50→disruptor / w55→regen; a new behaviour block confirms the Disruptor knocks the nearest tower offline (`empT>0`), that freezing it pauses the pulse, and that a buff tower is never silenced; `disruptor` added to the killable sweep. Group `[53]` asserts the DISRUPTOR badge (cyan). Suite green (run via subagent).

## v1.51.0 — 2026-06-14 — 💠 Warden Surge — 13th Mayhem wave modifier (target-priority pressure)

**Type:** Content (new Mayhem wave modifier). Minor bump. Ships the ROADMAP "More wave modifiers → a Mayhem *warden surge* wave-mod" follow-up. Additive, run-only state, save-safe, no economy/HP-curve impact — raises difficulty through *target priority* (behaviour), not the invariant-capped HP axis.

**Pre-flight:** `git pull` clean. No revert/veto commits since the last entry. FEEDBACK.md PENDING holds one `[low priority]` item (start-menu revamp, already 4 slices in) — low-priority items don't override own-pick selection, so I chose the highest-value open ROADMAP follow-up.

**What & why:**

- **💠 Warden Surge** (`wardens`) — a 13th `WAVE_MODS` entry (cd-maps.js), Mayhem/Daily-only like every mod. When it rolls, `buildWave()` (cd-game.js) converts every would-be `norm` enemy at slot `i%4===1` into a **◈ Warden** support escort (full warden stats: `hp t.hp×1.3`, blue `#58a6ff`, r 13, the same 75px damage-shield aura). With several wardens woven through the wave, nearly the whole pack is shielded (warded enemies take −40%), so just pouring fire into the crowd barely scratches it.
- **The pressure is target priority, not HP** — pop the wardens to drop the bubble and the cluster instantly becomes vulnerable. Ties together two existing systems: the **◈ Warden enemy** (v1.35.0) and the new **🛡 Support targeting mode** (v1.49.0, which hunts healers/wardens first); splash damage also shines. Serves the recurring "too easy" feedback off the HP axis (the norm-HP curve is invariant-capped by test `[16]`).
- **Conversion, not addition** — only `norm` enemies convert, so the rarer special kinds (fast/tank/heal/shield/split/phantom) are untouched, and the wave **length is unchanged** (it's a swap). Only one wave-mod is ever active, so no stacking with titans/frenzy/etc. Wardens never shield themselves or each other → always killable.
- **Save-safe:** the converted wardens are ordinary run-only enemy objects (never persisted); no new localStorage key, no schema/economy/balance change to existing numbers.

**Tests:** new group `[67]` — asserts the mod is in the pool, that a wave-10 wave gains wardens with it on (0→3) vs none off, converted wardens are well-formed (maxHp/colour/radius), the wave length is unchanged (conversion) and the special kinds untouched, the mod is inert when cleared, and a real Mayhem run with it in the pool drives clean with zero console errors. Full suite **640/0 green** (was 632/0).

---

## v1.50.1 — 2026-06-14 — 🩺 Health check — all green (632/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass). No new feature. Patch bump. 5 normal runs since the v1.45.1 health check (v1.46.0–v1.50.0), so this run is the scheduled checkup.

**Pre-flight:** `git pull` clean (up to date). No revert/veto commits since the last CHANGELOG entry. FEEDBACK.md PENDING has one `[low priority]` item (start-menu revamp) — low-priority items don't override the health-check schedule, so it stays queued.

**1. Refactor audit:** all seven game files comfortably under the ~1500-line guideline — `cd-update.js` 876, `cd-render.js` 718, `cd-game.js` 691, `cd-core.js` 441, `cd-defs.js` 364, `cd-maps.js` 285, `cd-state.js` 170. No dead code, duplication, or domain-bleed found. The lone oversized file remains the **dev-only test harness** `tests/run-tests.mjs` (now **3,991 lines / 67 groups**) — already tracked as a low-priority `[ ]` split in ROADMAP (refreshed this run); it never ships.

**2. Docs coherence:** CLAUDE.md verified against the code — `BOSS_ARCHETYPES` = 6 (`regen/summoner/bulwark/enrager/teleporter/berserker`), `MODES` = 5 (incl. `support`), `WAVE_MODS` = 12, `ACHIEVEMENTS` = 14, `GAME_VERSION` = `v1.50.0` ↔ `sw.js` cache matched. No formula drift. Fixed the one stale doc: ROADMAP's test-split note still said "3,750 lines / 64 groups `[0]`–`[63]` / 573 checks" → corrected to **3,991 lines / 67 groups `[0]`–`[66]` / 608 `check()` sites / 632 assertions**. Table-stakes re-audit line stamped v1.50.1.

**3. Table-stakes:** checklist remains **COMPLETE** (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI, responsive/mobile, ~44px tap targets). No new gap surfaced.

**4. Integrity spot-checks:** full suite **632/0 green**. `file://` playability intact — HTML wires all 7 `cd-*.js` in dependency order + the CSS link, `index.html` redirect present, SW registration is `http`/`https`-guarded in `cd-render.js` (skips `file://`), deploy workflow copies `index.html` + `tower-defense.html` + `tower-defense.css` + `cd-*.js` + the PWA trio. Old-save migration confirmed robust — `loadMeta()` defaults a missing `talents`/`achievements`/`stats` map (hardened v1.45.1), `loadRun()` validates an unknown targeting `mode` to `'first'`.

**Findings → ROADMAP; fixes this run:** doc-only (stale test-counts in ROADMAP). No code/behaviour/balance/save change. Version + sw.js cache bumped to v1.50.1 in lockstep.

---

## v1.50.0 — 2026-06-14 — 🔴 Berserker — 6th boss archetype (accelerates as it loses HP)

**Type:** Content (new boss mechanic). Minor bump. Ships the ROADMAP "Boss variety → a 6th archetype" follow-up. Additive, run-only state, save-safe, no economy/HP-curve impact — hardens the late game through *behaviour*, not the invariant-capped HP axis.

**What & why:**

- **🔴 Berserker** — a sixth boss archetype (`BOSS_ARCHETYPES` 5→6 in cd-game.js). From wave 20+ the every-5th-wave boss carries one mechanic on a 6-cycle: regen → summoner → bulwark → enrager → teleporter → **berserker** (w45 → berserker, w50 wraps to regen). The cycle length reads `BOSS_ARCHETYPES.length`, so adding the archetype to the array auto-extended the rotation.
- **Mechanic:** the Berserker accelerates as it loses HP — speed scales with missing HP up to **+60% at death** (`berserkMul = 1 + 0.6·max(0, 1 − hp/maxHp)`, computed **inline in the movement line** in cd-update.js, no ticked field needed for the speed). A near-dead Berserker sprints for the exit right when it's almost down, so it pressures **damage + timing** ("burst it before it rages"), not raw HP. Base boss speed is 0.45×, so even fully enraged (0.72×) it stays slower than a basic enemy — bounded and beatable.
- **Counters:** freeze stops it cold (`slowMul = 0` zeroes movement, raging or not — consistent with every other archetype pausing under freeze), and Frost slows blunt the rush (the slow multiplies in).
- **Game-feel / readability:** a periodic roar (`rageCd` ~2s, `addExplosion` + `SFX.bossSkill()`) once it drops below 85% HP; the crimson boss aura ring (`bossMechanicBadge` → `BERSERK`, colour `255,106,106`) grows brighter + thicker as it rages (alpha/width scale with missing HP) so the rage level reads at a glance. Boss-bar badge labelled **BERSERK**.
- **Save-safe:** all fields (`rageMul` is computed, `rageCd` is lazily-initialised run-only) live on enemy objects, which are never persisted — no save/schema change. New content, so not bound by the ≤25%/run *rebalance* rule (like the +35% enrager haste / +80px teleporter blink before it).

**Tests:** group `[45]` extended — rotation now asserts the 6-cycle (w20–w50, incl. w45→berserker, w50→regen wrap), a wounded berserker covers clearly more distance than a full-HP one, a frozen berserker doesn't move, and it's in the killable loop. Group `[53]` badge test asserts the `BERSERK` label/colour. Full suite **632/0 green**.

---

## v1.49.0 — 2026-06-14 — 🛡 Support targeting mode — towers prioritise heal/warden aura enemies

**Type:** Content / gameplay depth (new tower targeting mode). Minor bump. Ships the ROADMAP "New enemy type: warden" follow-up *("a tower spec/targeting mode that prioritises support enemies")*. Additive, save-safe, no economy/balance-number impact.

**What & why:**

- **🛡 Support** — a fifth per-tower targeting mode beside ⏩ First / ⏪ Last / 💪 Strong / 📍 Close (tap a tower, cycle its targeting button one more step). A Support-mode tower targets the **aura enemies that buff the pack — 💚 heal and ◈ warden** — before any normal enemy in range. Killing a healer/warden instantly strips its cluster's heal/shield, so this turns a single tower into a dedicated "pop the support first" tool — exactly the target-priority decision the Warden (v1.35.0) and heal (w7+) enemies were designed to create. Serves the recurring "too easy / give me more depth" feedback by adding a *choice*, not more numbers: it raises no stat.
- **Implementation** — `MODES` gains `'support'` and `MODE_ICON` gains its label (`cd-defs.js`); a `SUPPORT_KINDS = {heal, warden}` lookup defines the priority set. `pickTarget()` (`cd-update.js`) adds one `case 'support'`: `val = (SUPPORT_KINDS[e.kind] ? 1e7 : 0) + e.dist`, so any support enemy in range outranks everything, and among the same class the furthest-along wins (identical tiebreak to 'first'). With **no** support enemy in range it degrades to plain 'first' targeting — never a wasted setting.
- **Save-safe** — the per-tower `mode` already round-trips through `saveRun()`/`loadRun()`, and the loader (`cd-state.js`) validates `mode` against `MODES` with a `'first'` fallback, so a saved `'support'` loads cleanly and any unknown/old value still falls back safely. No new localStorage key, no schema change. Buff towers don't show a targeting button (they deal no damage), so the new mode only appears on attacking towers via the auto-generated cycle. The upgrade panel already hashes `t.mode` in `upgradeKey()`, so the button label updates live.

**Tests:** new group `[66]` — asserts `support` is in `MODES` with a label; a Support tower picks a heal enemy over a further-along norm; picks the furthest-along among two support enemies; falls back to 'first' with no support in range; `cycleMode()` reaches it; and the mode survives a save/resume round-trip. Full suite green.

## v1.48.0 — 2026-06-14 — 🎲 Wildcard — gamble legendary perk (random legendary effect)

**Type:** Content (new run-perk). Minor bump. Ships the ROADMAP "a true random 'Wildcard' perk" idea (under Content & variety → "secret / easter-egg legendary perk" follow-ups). Additive, save-safe, **balance-neutral**, no economy impact.

**What & why:**

- **🎲 Wildcard** (legendary, `REPEATABLE`) — a gamble perk: picking it from a draft instantly **resolves into a random legendary perk's effect** for the rest of the run, with an on-board reveal floater (`🎲 → 💎 Diamond Core!`). Owner likes surprises / "a weird legendary perk"; this adds replay variety without power creep — since you'd be drafting a legendary card either way, average power is unchanged (no per-number stat is raised, so the ≤25%/number rule isn't even engaged).
- **Resolution** — `resolveWildcard()` (cd-defs.js) prefers an un-taken legendary (excluding wildcard itself; `REPEATABLE` legendaries like Ascension stay eligible), and falls back to *any* eligible perk if every legendary is somehow held, so it's never a dud and can never resolve to itself (no recursion). `pickPerk()` special-cases the wildcard id: it applies the **resolved** perk's effect to `perkState` and pushes the **resolved** perk (a real perk id, not `'wildcard'`) into `runPerks`.
- **Save-safe** — because the resolved perk's effect is baked into `perkState` (persisted whole) and the resolved perk id is what lands in `runPerks` (also persisted), resume is correct: `loadRun()` copies `runPerks`/`perkState` verbatim and never re-calls `apply()`, so the randomness **cannot re-roll on reload**. The `'wildcard'` id is never stored, so the perk-row icon + tooltip lookups resolve normally. No new localStorage key, no schema change; old saves load unaffected. The wildcard's own `apply` is a deliberate no-op.

**Test evidence:** new group `[65]` (11 checks): wildcard is a legendary + repeatable in the pool; `resolveWildcard()` never returns null / never returns itself / resolves to a legendary while some remain; picking it adds exactly one perk to `runPerks` that is a real non-wildcard perk; wildcard is never stored; save→reload keeps the resolved id (no re-roll); fallback returns a perk when all non-repeatable legendaries are taken; zero console errors. Full suite **620 passed / 0 failed**. Verified live over http (v1.48.0, six picks resolved to chronolord/midas/titanslayer/ascension/geese/laststand, wildcard never stored, no console errors). SW cache bumped to `circuit-defense-v1.48.0` (test [49]).

## v1.47.0 — 2026-06-13 — 🗓 Daily Challenge preview + 📆 Streak Keeper achievement

**Type:** Content / UX (Daily Challenge polish + a new achievement). Minor bump. Two ROADMAP follow-ups under "Daily challenge seed" — *"a small 'today's modifiers' preview on the button"* and *"a streak achievement badge (e.g. 7-day streak)"* — done together (same Daily domain). Additive, no save/economy/balance impact.

**What & why:**

- **Daily button preview** — the 🗓 Daily Challenge start-screen button now previews today's seeded run before you commit: today's **difficulty** (Normal/Hard) + the **icons of the wave-modifiers** that will appear (`💨🛡️⚡…`, capped at 5), with the full modifier **names** spelled out in the hover tooltip. Everyone still gets the same date-seeded run; this just surfaces what `setupDaily()` already fixed by date. Implemented as a new **read-only** `dailyPreview(dateStr)` helper (`cd-maps.js`) that mirrors `setupDaily()`'s RNG-stream consumption *exactly* (difficulty roll → `genPathWith(rnd)` to advance the stream → the 30-wave `rnd()<0.78 ? pick : null` schedule, including the short-circuit so the second `rnd()` is only consumed on a passing roll) but writes **nothing** to globals (`diffKey`/`MAPS.mayhem.pts`/`dailyMods` untouched), so the preview is guaranteed identical to the actual run. Added a `MOD_BY_ID` lookup alongside `WAVE_MODS`. Render-only on the button.

- **📆 Streak Keeper achievement** (`daily7`, roster 13→14) — granted by reaching a **7-day Daily Challenge streak** (finish a daily on seven consecutive calendar days; your existing streak counts). Uses the existing `currentDailyStreak()` infrastructure (v1.31.0). To make it grant on the same run that hits day 7, `recordDailyStreak()` is now called **before** `grantAchievements()` in both `endGame()` and `winGame()` (it was after) — `recordDailyStreak` is idempotent per-day so this is a safe reorder; `grantAchievements` then checks `daily && currentDailyStreak() >= 7`. Additive to the `ACHIEVEMENTS` array (`meta.achievements` is an id→true map, old saves just lack the badge — no migration).

**Save/economy:** zero impact — `dailyPreview()` touches no storage; the badge is additive; no schema/key changes; no gameplay numbers moved.

**Test evidence:** group `[47]` gained 4 checks (preview difficulty matches `setupDaily`, mod set matches the seeded schedule, preview does **not** mutate global state, returns distinct/valid mod ids); group `[48]` gained 2 checks (Streak Keeper granted at a 7-day streak, withheld below it) + updated the roster count 13→14. Full suite **609/0 green** (verified by subagent); guardrail review (save-compat, determinism, reorder-safety, scope) passed clean. Render path exercised in fresh contexts via `renderStartScreen()` in test cleanups (no console errors).

## v1.46.0 — 2026-06-13 — 📱 Bigger phone tap targets (table-stakes mobile polish)

**Type:** UX / table-stakes mobile polish. Minor bump. Closes the **lone remaining table-stakes gap** ("bigger HTML tap targets on small phones"). CSS-only (+ version/cache bump + a new test) — no gameplay/economy/save/balance impact, desktop byte-identical.

**What & why:** the in-game HTML buttons were below the ~44px recommended touch-target size on phones — the floating upgrade/sell panel buttons measured ~29px and the wave-control buttons (Start Wave, etc.) ~33px, easy to fat-finger mid-battle. This run brings them up to the guideline on small screens:

- **`#upgradePanel button`** (the tap-a-tower Upgrade/Sell/targeting/spec panel) → `min-height:44px; padding:9px 12px; font-size:14px`, inside the general `@media (max-width:920px)` block. The panel is an absolutely-positioned overlay (not part of the landscape chrome budget), so the bump is safe in **both** orientations. Measured 29→44px on a 390px phone; desktop keeps its compact ~29px (rule scoped to ≤920px).
- **`.towerBtn` / `button.ctl`** → `min-height:46px`, and **`.optBtn` / `.lvlBtn`** (start-screen MODE/MAP/DIFFICULTY + campaign-level buttons) → `min-height:44px`, scoped to **`@media (max-width:920px) and (orientation: portrait)`**. Portrait-only on purpose: the v1.15.0 **landscape** block deliberately compacts the shop/controls (no `min-height`) to keep Start Wave on-screen alongside the tall board, and must stay untouched. Measured on a 390×844 phone: shop buttons 77px, controls 33→46px, option buttons 51px.

**Test evidence:** new test group `[64]` (Mobile tap targets) drives a real 390×844 Playwright viewport — asserts shop / control / upgrade-panel / option buttons all ≥44px, and that the desktop (1280px) upgrade-panel button keeps its compact <44px height (proving the mobile rule didn't leak). Full suite **603/0 green**. Live-verified in-preview at 390×844 (all targets ≥44px) and 1280×800 (unchanged, zero console errors).

## v1.45.1 — 2026-06-13 — 🩺 Health check (save-migration hardening)

**Type:** Health check (every-6th-run maintenance pass — 5 normal runs since the v1.40.1 check: v1.41.0–v1.45.0). No new feature; a top-to-bottom integrity/docs pass with one small, safe fix. Patch bump.

**Fix this run — old-save robustness in `loadMeta()` (cd-defs.js):** integrity spot-check #4 (minimal `cd_meta` loads via migration defaults) surfaced a real crash. `loadMeta()` does `meta = m` (when the parsed save has a numeric `chips`) and then immediately `if (!(k in meta.talents))` in the talents loop. A minimal/old save like `{"chips":100}` (no `talents` map) made `meta.talents` `undefined`, so the `in` operator threw `TypeError: Cannot use 'in' operator … in undefined` at startup — a hard crash for that save shape. Added one defensive line before the loop: `if (!meta.talents || typeof meta.talents !== 'object') meta.talents = {};` (mirrors the existing achievements/stats migration guards just below). Reproduced the throw in Node first, then verified the guard. Save-safe, additive, no economy/schema change.

**Health-check findings (all green, no drift):**
- **Tests:** full suite **597/0** (exit 0), up from 595/0 — added 2 assertions to test group [3]'s migration block (minimal save loads without throwing + defaults talents/achievements/stats).
- **Refactor audit:** every game file comfortably under the ~1500-line cap (largest: `cd-update.js` 850, `cd-render.js` 715). No new dead code or domain bleed. The lone outsized file remains the dev-only test harness `tests/run-tests.mjs` (**3,750 lines, 64 groups [0]–[63], 573 `check()` sites / 597 assertions**) — still a `[refactor]` backlog item (split per-group), not shipped game code.
- **Versions in sync:** `GAME_VERSION` = `sw.js` CACHE = CHANGELOG top = **v1.45.1** (test [49] asserts SW==GAME_VERSION).
- **`file://` playability:** classic `<script src>` tags in dependency order, zero `type="module"`, inline-SVG favicon, manifest/SW links present; SW registration stays http/https-guarded so double-click play + the headless harness are unaffected.
- **Docs coherence:** CLAUDE.md counts re-verified against code — 8 towers, 21 talents, 12 Mayhem `WAVE_MODS`, 5 `BOSS_ARCHETYPES` (regen/summoner/bulwark/enrager/teleporter), classic scripts. No drift. Updated two stale ROADMAP notes (test-harness line/group/assertion counts; table-stakes re-audit marker + the now-complete list).
- **Table-stakes audit:** the only remaining gap is **chunkier HTML tap targets on small phones**; everything else is shipped (favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y for menus + draft, colorblind aid, reduced-motion, volume slider, high-DPI scaling, responsive/mobile).
- **Veto scan:** no owner reverts since the last CHANGELOG entry; vetoed section intact.

**Bookkeeping:** `GAME_VERSION`/`sw.js`/CHANGELOG_ENTRIES bumped to v1.45.1; ROADMAP refreshed; FEEDBACK untouched (the lone PENDING item is `[low priority]` and skippable per the routine). Resets the 5-run health-check counter.

## v1.45.0 — 2026-06-13 — 🪧 Start-screen hero header (menu revamp slice 4)

**Type:** UX / menu polish. Minor bump. Fourth slice of the owner's `[low priority]` FEEDBACK "revamp the whole starting menu" thread (after v1.39.1 two-tier buttons, v1.41.0 PLAY sheen, v1.42.0 config card) — also the ROADMAP "Start-menu revamp" item under *Game feel / polish*. The only PENDING FEEDBACK is this same low-priority revamp, so continuing it is the right call.

**What changed:** the top of the start screen reads as one cohesive header instead of a loose stack.
- The title `<h2>`, version `#verTag`, and tagline `<p>` are now wrapped in a single **`.startHero`** block (markup, `tower-defense.html`), reordered so the version sits directly **under the title** (it previously floated awkwardly between the tagline and the config card).
- **`.startHero`** (CSS) is a centered column with a soft blue **accent divider** (`::after`, a 190px transparent→`#58a6ff`→transparent gradient rule) separating the header from the config card below.
- The **title** is a touch larger (32→34px), bolder (800), with letter-spacing and a richer two-layer glow. The ⚡ emoji is left intact (no gradient text-clip, which would blank the emoji).
- The **version** now renders as a small **rounded pill badge** (1px border, `999px` radius, `#161b22` bg) tucked under the title — still clickable to open What's New, still gets the gold `●` dot when updates are unseen (`.hasNew::after` unchanged).

**Why:** the owner's standing FEEDBACK item asks to clean up the "clunky" start menu; the title/version area was the last loose part. Grouping it into a hero block with a divider gives the menu a clear top-to-bottom structure (header → setup card → play row → utility toolbar).

**Save/economy/behaviour impact:** none. Markup + CSS only. `#verTag` keeps its `id` + `onclick` so `renderStartScreen()` still sets its text and the `.hasNew` dot; `.startUtil` stays `#startScreen`'s last child (test [58] invariant) and `.startOpts` is untouched (test [60]).

**Tests:** new group **[63]** (hero exists, groups title+version+tagline, is a column, version is a bordered/rounded pill, hero is first child, util toolbar stays last child, `#verTag` keeps its onclick, no console errors). Full suite **595/0 green**. Verified in-preview at 1280px (title 34px, badge centered under title, divider rendered, no horizontal overflow) and mobile (title 26px, stacks cleanly).

**Bookkeeping:** `GAME_VERSION`/`sw.js` cache bumped to v1.45.0; CHANGELOG_ENTRIES prepended; FEEDBACK item left PENDING (as-written, per owner pref — the fuller revamp isn't done yet).

## v1.44.0 — 2026-06-13 — 🆕 What's New "new since last visit" marker

**Type:** UX / game-feel polish. Minor bump. Ships the ROADMAP "What's New 'new since last visit' marker" item (under *Game feel / polish* — "highlight entries newer than the last-seen version (persist `cd_wnseen`) with a dot/badge … and auto-scroll the list to the top on open"). Chosen over a 4th consecutive start-menu slice (the only PENDING FEEDBACK item is `[low priority]`, skippable, and already had three back-to-back slices in v1.39.1/v1.41.0/v1.42.0) per the routine's "don't just follow up the most recent change."

**What changed:** the ✨ What's New panel now flags the updates you haven't read yet.
- A new additive **`cd_wnseen`** localStorage key stores the newest version string the player has already viewed in the panel. Since `CHANGELOG_ENTRIES` is newest-first, every entry **above** that version's index is "unseen."
- **`unseenWhatsNewCount()`** (cd-core.js) returns that count (0 when caught up; 0 for an absent or stale/unknown seen-version — never a flood). **`markWhatsNewSeen()`** writes the current newest version. **`refreshWhatsNewBadge()`** updates the start-screen cue.
- **`renderWnList()`** tags the first `unseen` rows with a `.wnFresh` class (brighter gold accent rail + faint glow) and a gold **`NEW`** pill beside the version.
- **`openWhatsNew()`** renders *before* marking seen (so the current view still shows the badges), then **auto-scrolls `#wnList` to the top**, calls `markWhatsNewSeen()` and `refreshWhatsNewBadge()` — so the highlights/cue clear on the next render/visit.
- Start-screen cue: the **✨ What's New button** (`#wnBtn`) shows a gold count pill of the unseen total, and the **version tag** (`#verTag`) gets a small gold `●` dot (`.hasNew::after`). Refreshed from `renderStartScreen()`.
- **First-encounter baseline:** `initWhatsNew()` seeds `cd_wnseen` to the current version when the key is absent (old saves / new players), so the whole back-catalogue isn't flagged NEW — only updates shipped from here on light up.

**Scope / safety:** pure DOM/CSS/localStorage UX. **One additive key (`cd_wnseen`)**, swept by `resetAllData()`'s existing `cd_`-prefix wipe — no migration needed, old saves load unchanged. No gameplay/economy/balance/schema impact. SW cache bumped `v1.43.0 → v1.44.0`.

**Test evidence:** new group `[62]` (15 checks) — absent key seeds the baseline (caught-up, 0 unseen); a stale seen-version flags exactly the newer entries with the `wnFresh` highlight + `NEW` pill (and the last-seen row has none); the button shows the count pill and the version tag the dot; opening marks everything seen, auto-scrolls to top, and clears the count to 0; an unknown/stale seen-version is safe (no flood). Full suite **587/0 green** (ran directly + subagent-verified); verified in-browser (gold `NEW` rail `rgb(240,180,41)` vs seen rows' green, `✨ What's New 3` count pill, `hasNew` version dot, scrollTop 0, zero console errors).

## v1.43.0 — 2026-06-13 — 🎮 Gamepad support (controller play — towers, abilities, waves)

**Type:** Feature / table-stakes engineering. Minor bump. Clears the long-standing **gamepad** table-stakes gap (the explicitly-flagged "next strongest pick" in ROADMAP, re-noted across the v1.24.2/v1.27.1/v1.37.1/v1.40.1 health checks).

**What changed:** you can now play with a standard (Xbox-style) controller. `pollGamepad(dt)` (`cd-game.js`) is called once per frame from the rAF `loop` (`cd-render.js`) and reads `navigator.getGamepads()`. A connected pad drives the **same board cursor** (`mouseX`/`mouseY`) and the **same actions** as mouse/keyboard:
- **Left stick + D-pad** → move the cursor (a crosshair reticle is drawn on the board so you can see where A will act). Dead-zone `0.25`, speed `520px/s` at full deflection, clamped to the board.
- **A** (button 0) → primary press at the cursor — aims an armed meteor, else selects the tower under the cursor, else places the selected shop tower (grid-snapped). Routed through a new shared `boardPress(x,y)` helper extracted verbatim from the `pointerdown` handler, so mouse/touch and gamepad placement are byte-identical.
- **B** (1) → cancel (deselect shop / un-arm ability / hide upgrade — same as Esc).
- **X** (2) → cycle to the next *affordable* tower type (`gpCycleTower()`).
- **LB / RB / LT** (4/5/6) → abilities Meteor / Freeze / Gold Rush (= Q/W/E).
- **Start** (9) → start/add a wave (self-guards on the concurrent-wave cap). **Back** (8) → pause; **Back or Start** un-pauses.

Press-edge detection (`gpPrev[]`, computed in one pass per frame) means held buttons never auto-repeat, and a button held across a pause/menu can't replay on resume.

**Scope / safety:** pure **additive input** sitting alongside mouse, touch and keyboard. `pollGamepad()` is a **complete no-op when no pad is connected** (`getGamepads()` empty → early return), so standard play and the **headless test harness are byte-identical**. No new game state, **no save/economy/balance/schema impact**, no new localStorage key. The reticle only draws when `gamepadActive && started && !gameOver && !paused`. Hotkey hint line updated with the controller map. SW cache bumped `v1.42.0 → v1.43.0`.

**Test evidence:** new group `[61]` drives a mocked `navigator.getGamepads()` and calls `pollGamepad(1/60)` directly — left stick moves the cursor (and clamps), A places a selected tower / selects a hovered tower / aims an armed meteor, X cycles affordable towers, LB/RB/LT arm abilities, Start adds a wave, Back pauses & resumes, held buttons fire once (press-edge), and a no-pad poll is a no-op. Full suite green (subagent-verified before commit); double-click `file://` play re-verified (no pad → unchanged).

## v1.42.0 — 2026-06-13 — 🗂️ Start-screen config card — MODE/MAP/DIFFICULTY grouped into one panel (menu revamp slice 3)

**Type:** UX / layout polish. Minor bump. Third slice of the owner's active (`[low priority]`) "revamp the whole starting menu" FEEDBACK — after v1.39.1 (two-tier button hierarchy) and v1.41.0 (animated PLAY button), this one restructures the run-setup controls themselves.

**What changed:** the three setup selectors (MODE, MAP, DIFFICULTY) used to sit as three rows of floating, centered labels + button rows drifting loose in the middle of the start screen. They're now wrapped in a single bordered **config card** (`<div class="startOpts">` in `tower-defense.html`) so the menu reads as one structured "set up your run" panel. Inside the card, the labels and their option buttons **left-align** (`justify-content: flex-start`, `text-align: left`) for a clean settings-form feel, with consistent group spacing. The card is a subtle rounded panel (`background: rgba(22,27,34,.5)`, `1px solid #30363d`, `border-radius: 14px`, soft shadow), capped at `max-width: 720px` and centered on desktop; on ≤920px it goes full-width with tighter padding.

**Scope:** markup + CSS only (`tower-defense.html`, `tower-defense.css`). The load-bearing IDs (`modeRow`/`mapRow`/`diffRow`/`mapLabel`) are preserved inside the wrapper, so every `getElementById` in `renderStartScreen()` still resolves; `#startScreen`'s last child stays the `.startUtil` toolbar (a test `[58]` invariant). No JS logic, save/economy/balance/schema impact — purely visual grouping. SW cache bumped `v1.41.0 → v1.42.0`.

**Why the FEEDBACK item stays PENDING:** the owner prefers PENDING items left as-written until the *full* ask lands. The broader revamp (cleaner title/version treatment, possible card/rail layout for the utility buttons) is still open in ROADMAP; this is the run-setup slice of it.

**Test evidence:** new group `[60]` — the `.startOpts` card exists, groups the MODE/MAP/DIFFICULTY rows, is a bordered/rounded/column panel with left-aligned labels, and `#startScreen`'s last child is still the util toolbar; zero console errors. Full suite **556/0 green** (subagent-verified before commit). Verified in-preview: card renders centered at 720px on desktop and full-width on mobile, campaign's long "LEVEL —" label + 40 level buttons fit with no horizontal overflow, zero console errors.

## v1.41.0 — 2026-06-13 — ✨ Idle start-screen PLAY sheen (menu polish)

**Type:** UX / game-feel polish. Minor bump. Serves the owner's active (`[low priority]`) "revamp the starting menu" FEEDBACK — a small slice continuing v1.39.1's button-hierarchy work — and ticks the ROADMAP "Idle start-screen sheen" item.

**What changed:** the start screen's primary ▶ PLAY button now animates while you're on the (otherwise dimmed) menu — it breathes a soft green glow (`playGlow`, a pulsing box-shadow) and a thin diagonal band of light sweeps across it every few seconds (`playSheen`, a `::after` gradient that translates left→right then rests off-canvas). With the rest of the chrome dimmed via the `.idle` class, this draws the eye to the one live action. The sheen is clipped to the button (`overflow:hidden` + `position:relative`) so it stays inside the rounded shape.

**Reduced-motion safe:** a `@media (prefers-reduced-motion: reduce)` block switches both animations off entirely (`animation:none`; the sheen pseudo is `display:none`) — this is the new-motion piece the v1.10.0 reduce-motion work left open for the menu.

**Scope:** CSS-only (`tower-defense.css`), no markup/JS change. No save/economy/balance/schema impact — purely cosmetic. Desktop and mobile unaffected structurally (the ≤920px `!important` sizing rule doesn't touch animation). SW cache bumped `v1.40.1 → v1.41.0`.

**Test evidence:** new group `[59]` — PLAY carries `playGlow`, its `::after` exists and runs `playSheen`, the button clips the sheen (`overflow:hidden` + `relative`), and under emulated `prefers-reduced-motion: reduce` both the glow and sheen go `none` (sheen `display:none`). Suite green (subagent-verified before commit). Verified in-preview: glow/sheen render on the menu, zero console errors.

## v1.40.1 — 2026-06-13 — 🩺 Health check — all green (543/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump. Resets the 5-run counter (5 normal runs since v1.37.1: v1.38.0, v1.38.1, v1.39.0, v1.39.1, v1.40.0).

**Integrity spot-checks — all green:**
- **Test suite:** 543 checks across 58 groups (`[0]`–`[58]`), **0 failures**, exit 0.
- **`file://` playability:** classic `<script src>` tags in dependency order (cd-core → maps → defs → state → game → update → render), **no `type="module"`**, inline SVG favicon, all paths relative, no build step. SW registration is guarded to http/https (`location.protocol`), so double-click play + the headless harness are unaffected.
- **Old-save migration:** `loadMeta()` defaults `achievements`/`stats`/`stats.bestCombo` when absent; `loadRun()` merges `perkState` via `Object.assign(freshPerkState(), …)` and `abilityCd` via defaults — minimal old `cd_save`/`cd_meta` load cleanly. `saveRun()`'s write is `try/catch`-wrapped (storage-quota safe).
- **Version sync:** `GAME_VERSION` = `sw.js` CACHE = CHANGELOG top = What's New top = **v1.40.1** (test `[49]` enforces SW===version).

**Docs coherence — verified against code, no drift:** 8 towers, 21 talents, **12 Mayhem wave modifiers** (frenzy/swarm/titans/goldrush/drought/surge/fog/armored/brownout/regen/emp/meteors), 13 achievements, **5 boss archetypes** (`BOSS_ARCHETYPES = ['regen','summoner','bulwark','enrager','teleporter']`, cycle `(w/5−4)%5` from w20+), boss HP slope `14 + w*0.6`, booster aura range 45. CLAUDE.md formulas all match. Deploy workflow copies all shipped files (index/tower-defense.html/css/cd-*.js + manifest/sw.js/icon.svg).

**Refactor audit:** all game files well under the ~1500-line cap (largest: cd-update.js 850, cd-render.js 698, cd-game.js 611). No dead code or domain-bleed found. The dev-only test harness `tests/run-tests.mjs` is now **3,424 lines / 58 groups / 519 `check()` sites** (was logged stale at 3,180/54/505) — still the largest single file and the standing `[refactor]` candidate (split per-group); low priority (suite ~30s green).

**Table-stakes audit:** still-open items, in priority order — **gamepad support** → **bigger HTML tap targets on small phones**. Everything else done (PWA install, menu + draft keyboard a11y, colorblind aid, document metadata, reduced-motion, volume slider, responsive layout, mobile board sizing, touch/pointer, high-DPI). ROADMAP table-stakes header refreshed with this run.

**Findings → ROADMAP** (stale test counts corrected, table-stakes audit dated v1.40.1). No code-behavior change this run beyond the version/cache bump.

## v1.40.0 — 2026-06-13 — 🟣 Teleporter — 5th boss archetype (blink + brief intangibility, w20+, all modes)

**Type:** Content / late-game difficulty. Minor bump. **ROADMAP** "Boss variety" follow-up (the explicitly-listed open item: *"a 5th archetype (teleporter)"*). Continues the recurring "too easy" thread by hardening deep bosses through **behaviour**, not HP (the norm-enemy HP curve is invariant-capped by test `[16]`; archetypes are the off-HP lever).

**What changed:** `BOSS_ARCHETYPES` grows `4 → 5` (`['regen','summoner','bulwark','enrager','teleporter']`, `cd-game.js`). From wave 20+ the every-5th-wave boss cycles `(w/5−4) % 5`, so the rotation is now **Regen → Summoner → Bulwark → Enrager → Teleporter** (w20/25/30/35/40; w45 wraps to Regen). Early/tutorial bosses (w5/10/15, campaign L1–5 finals at `victoryWave<20`) stay vanilla.

**The Teleporter mechanic** (`cd-update.js`, in the boss-tick block gated `frozen<=0`): every **~4s** the boss blinks **+80px** forward along the path and sets `e.blinkInvuln = 0.4` — reusing the **phantom** blink fields, so mid-blink it's untargetable (`pickTarget` skip) and immune (`damage()` early-return). The intangibility decays **every frame even while frozen** (a dedicated line *above* the gated block) so a boss frozen mid-blink can't get stuck permanently invulnerable; the blink *trigger* is paused by freeze (like phantom's `blinkCd`). Because it keeps skipping ahead it spends less time in firing arcs (harder to whittle down) and reaches the exit sooner — pressuring DPS/timing off the HP axis. Counter: freeze pauses the blink; dense back-stretch coverage maximises the shrinking damage window.

**Render** (`cd-render.js`): violet aura ring (`188,140,255`) matching the other colour-coded auras; the boss fades to 0.3 alpha while intangible mid-jump (the cue); `bossMechanicBadge()` returns `{label:'TELEPORTER', c:'188,140,255'}` so the boss HP bar names it. Blink burst uses `SFX.blink()`.

**Save-safe:** all fields (`blinkInvuln`/`blinkCd`/`bossType`) are run-only and lazily initialised — enemies are never persisted, so no schema/migration change. No economy/balance impact (no HP/bounty change). **Tests:** group `[45]` extended (rotation now asserts w40=teleporter / w45=regen; blink-advances-dist, mid-blink-intangible, freeze-pauses-blink, invuln-decays-while-frozen, teleporter-is-killable) + `[53]` (TELEPORTER badge). Suite green.

## v1.39.1 — 2026-06-13 — 🎛️ Start-menu button hierarchy (FEEDBACK "bottom-row buttons huge / menu clunky", first slice)

**Type:** UX / layout polish. Patch bump. **From FEEDBACK** (the one PENDING item, marked `[low priority]`): *"The main interface is getting clunky now. The buttons on the bottom row are huge compared to everything else. I think its time we revamp the whole starting menu."* A full menu revamp is too big for one run; this is the **first coherent slice** — fixing the concrete complaint that the bottom-row buttons all read equally huge.

**What changed:** the start screen's single flex row of **ten equally-large 17px buttons** (PLAY, Resume, Daily, Talents, Achievements, Records, What's New, Settings, Reset All) is split into a **two-tier hierarchy**:
- **`.startPlay`** — a prominent primary row for the actions that *launch a run*: ▶ PLAY (18px, extra-wide), ⏯ Resume (shown only when a save exists), 🗓 Daily Challenge.
- **`.startUtil`** — a smaller, slightly-muted (opacity .9) toolbar below for the menu/utility buttons (🧬 Talents, 🏅 Achievements, 🏆 Records, ✨ What's New, ⚙ Settings, 🗑 Reset All), at 13px / 7px-14px padding so they recede as "extras" instead of competing with PLAY.

**Implementation** (markup + CSS only, save-safe, behaviour-identical):
- `tower-defense.html` — the one button `<div>` became two (`.startPlay` + `.startUtil`); removed the per-button inline `font-size`/`padding` (now driven by the new CSS classes), kept the inline background colours and all `id`s/`onclick`s (`resumeBtn`/`dailyBtn`/`resetBtn`/`chipsBtn`/`achBtn` unchanged, so `renderStartScreen()`'s `resumeBtn` display toggle + the a11y opener lookup still work).
- `tower-defense.css` — new `.startPlay` / `.startUtil` rules near `.optRow`. `.startUtil` `max-width:780px` keeps the toolbar on one tidy row on desktop while still wrapping on mobile. The existing `@media (max-width:920px)` `#startScreen .ctl { …!important }` rule still compacts both rows uniformly on phones (unchanged).

**Why this way:** purely visual hierarchy — no JS logic, no new localStorage keys, no economy/balance/save-schema impact. Desktop and mobile both verified in-preview (PLAY 18px / util 13px, two distinct rows; one util row on desktop, no horizontal overflow at 390px, last row fits the viewport). The broader "revamp the whole starting menu" stays in FEEDBACK PENDING as a follow-up.

**Tests:** new group `[58]` asserts the two-row structure exists, PLAY is larger than a utility button, the utility toolbar fits inside the start screen, and all the load-bearing button `id`s survive. Full suite green.

---

## v1.39.0 — 2026-06-13 — 🏜️ Bounty Drought (12th Mayhem wave modifier — economy denial)

**Type:** Content (new Mayhem wave modifier). Minor bump. **Self-directed** (ROADMAP "More wave modifiers" → *bounty drought (−50% gold this wave)*; FEEDBACK only had a low-priority menu-revamp item).

**What changed:** a twelfth Mayhem wave modifier, 🏜️ **Bounty Drought** (`drought`). When it rolls on a wave (78% per-wave chance, Mayhem-only), **every enemy + the boss pays out 50% less gold** (`Math.max(1, floor(bounty*0.5))`, floored so nothing drops below 1). It's the direct mirror of 💰 Gold Rush and — crucially — the **first wave modifier that squeezes the economy *downward*.** Every existing mod either scales enemy stats (frenzy/swarm/titans/armored/regen/emp) or hands the player *more* gold (goldrush/titans); none denied income. Drought pressures the build on a **fresh axis**: you can't farm your way out of trouble, and a drought right before a boss can leave you short on firepower — rewarding spending discipline and a reserve.

**Implementation** (mirrors the `goldrush`/`titans` pattern exactly — minimal, low-risk):
- `cd-maps.js` — one `WAVE_MODS` entry (pool **11 → 12**), inserted next to its opposite, Gold Rush.
- `cd-game.js` `buildWave` — one line in the enemy loop + one in the boss block, baking the ×0.5 into `e.bounty`/`boss.bounty` at spawn (so the kill floater, Fortune ×2, and Midas ×5 all scale off the already-reduced base, same as Gold Rush). Drought and Gold Rush/Titans are mutually exclusive (one mod per wave), so no stacking.

**Scope / save-safety:** Mayhem-only and per-wave — never touches Classic/Campaign, saves, or the economy outside the drought wave. End-of-run **chips are unaffected** (this only cuts in-run gold from kills during the wave). It also joins the seeded **Daily Challenge** rotation (everyone faces it on the same day). Transient run state, no schema/persistence change.

**Tests:** new group **[57]** — `WAVE_MODS` includes Bounty Drought; a wave-10 normal enemy and the boss are both halved (floored, min 1); every enemy in the wave is reduced and none drop below 1; HP/speed/armor are left untouched (economy-only); inert when the mod is off. Full suite green (spawned subagent). SW cache bumped to `v1.39.0` (test [49]).

## v1.38.1 — 2026-06-13 — 🐛 Resume-after-win reset + tower-select flicker fix

**Type:** Bug fix. Patch bump. **Owner FEEDBACK** (bug): *"Completing a level doesn't reset 'resume'. You can resume from the last level over and over. Also, sometimes clicking to select a tower blinks the tower you're trying to click on and off."*

**Two fixes, one report:**

1. **Completing a run now resets Resume.** `endGame()` already cleared the saved run on a loss, but `winGame()` never did — so after clearing a Campaign level (or winning a Quick run), `cd_save` survived and the start-screen Resume button re-offered the *already-won* level, which you could resume and re-win indefinitely (verified in-browser: post-win label `⏯ Resume (wave 14, Campaign 1)`). Fix: `winGame()` now calls `clearRun()` (guarded `!daily`, mirroring `endGame()`).
   - **Daily Challenge unaffected:** a daily win still leaves your separate normal save intact (`clearRun` skipped when `daily`).
   - **Continue Endless still works:** after a Quick victory you can still continue past wave 30; `loadRun()` now sets `victory = true` when a resumed save is already past its `victoryWave()` (only reachable from an endless-continue re-save now that wins clear the save), so resuming an endless run no longer instantly re-fires the victory screen. Normal mid-run saves have `wave < victoryWave()`, so this is a no-op for them.

2. **Selecting a tower no longer flickers it.** When a shop tower type was still selected and you moved the cursor over an existing tower to click it, the red "can't build here" placement ghost (range ring + disc) drew right on top of that tower and flickered as grid-snap jumped the snapped point between cells (confirmed in-browser: ghost draw-condition true, `canPlace` false over the tower). Fix: extracted a shared `towerAt(x,y)` hit-test (same radius the click handler uses — 30px coarse / 18px fine) and the placement preview is now suppressed whenever the cursor is over a selectable tower (you can't place there anyway, so nothing is lost).

**Save-safe / scope:** only `winGame` (clear), `loadRun` (endless victory guard), a new `towerAt` helper, and one render condition changed. No schema, economy, or balance impact. Verified all paths in-browser (campaign/quick clear, daily preserved, endless resume playable, `towerAt` over-tower vs open-ground), zero console errors.

**Tests:** new group **[56]** — campaign/quick win clears `cd_save` (+ Resume hidden), daily win keeps the normal save, endless-continue save resumes with `victory` pre-set & playable, `towerAt()` finds a tower under the cursor and nothing on open ground. SW cache bumped to `v1.38.1` (test [49]).

## v1.38.0 — 2026-06-13 — ⚖️ Talent cost rework (slow the snowball)

**Type:** Balance / meta-economy. Minor bump. **Owner FEEDBACK** (medium priority): *"The talents are way over powered, which is good but they are way too easy to get … after a few rounds you become way better and the game is easy and boring … Review all the talents: which ones are OP→increase cost a lot, which ones could be removed→remove. I think a general 25% cost increase would be good. Ignore the ~25% swing rule for this run."*

**What changed (cost only — power untouched):** every talent's per-rank price went up. The lever is *acquisition speed*, not strength — talents stay exactly as powerful, they just take longer to earn, which is the design intent (CLAUDE.md: talents are deliberately grindy).

- **General uplift (~25%, all CORE talents):** Funding `5+4r→6+5r`, Engineering `6+5r→8+6r`, Fortitude `5+4r→6+5r`, Banking `6+5r→8+6r`, Surge `5+4r→6+5r`, Fortune `5+4r→6+5r`, Scholar `8+6r→10+8r`, Salvage `5+4r→6+5r`, Momentum `6+5r→8+6r`, Piercing `7+6r→9+7r`.
- **OP damage/power talents — a lot more (~+50–100%, steeper slope):** ⚔️ Firepower `6+5r→11+9r` (max-out **285→515 chips**, +81%); 🔬 Crit Lab `7+6r→11+10r` (95→155, +63%); 🌟 Overdrive `80+120r→120+180r` (280→420, +50%); the **eight 🛡 Tower Mastery** talents `4+4r→8+8r` (each **60→120**, doubled — these were the cheapest big-damage picks, and 8 of them stack across tower types).
- **Whole tree to max:** ≈ **2,350 → 3,550 chips** (+51%, ~47 → ~71 winning runs), with the steepest hikes on exactly the early upgrades that were trivialising the game.

**None removed.** Reviewed every talent for redundancy — each maps to a distinct mechanic, and deleting one would silently strip chips a player already spent on it (no respec/refund path mid-tree), which is save-unsafe. Cost increase is the lever the owner emphasised.

**Save-safe.** Only the cost *functions* changed; ranks/chips/`cd_meta` are untouched and load unchanged (`loadMeta` migration intact). `resetTalents()` refunds at current prices, so an already-maxed player who respecs after this update gets a one-time windfall (= new total − old total); not a repeatable fountain (buy↔reset is break-even at any single price). Owner waived the ≤25%/run swing guardrail for this run.

**Tests:** new group **[55]** — every rank-0 cost rose vs the pre-v1.38.0 table, OP talents cost a lot more, OP max-out totals (firepower 515, mastery 120) verified, all 21 talents retained, `buyTalent` deducts the new cost and ranks up. Full suite green (spawned subagent). SW cache bumped to `v1.38.0` (test [49]).

## v1.37.1 — 2026-06-13 — 🩺 Health check (all green — 505/0, docs coherent, no drift)

**Type:** Health check (every-6th-run maintenance pass — no new feature). Patch bump.

**Why:** Five feature releases since the last health check (v1.32.1 → v1.33.0/1.34.0/1.35.0/1.36.0/1.37.0), so the routine triggers a checkpoint to confirm the project is still pointed in the right direction before piling on more content.

**Refactor audit:** All seven game files remain comfortably under the ~1500-line cap — largest is `cd-update.js` at 829 lines (others: cd-render 692, cd-game 604, cd-core 385, cd-defs 326, cd-maps 266, cd-state 165). No dead code or domain-misplaced functions spotted. The dev-only test harness `tests/run-tests.mjs` is now **3180 lines / 54 groups / 505 checks** — already tracked under ROADMAP "Tech/tooling → Split the test harness file"; left as-is (it's tooling, not the shipped game).

**Docs coherence:** No drift found. `GAME_VERSION` (v1.37.0→**v1.37.1**) == in-game `CHANGELOG_ENTRIES[0]` == `sw.js` `CACHE` (all bumped together this run; test `[49]` enforces the last). Verified every count CLAUDE.md/ROADMAP claims against the code: **13** achievements, **11** WAVE_MODS (frenzy/swarm/titans/goldrush/surge/fog/armored/brownout/regen/emp/meteors), **4** BOSS_ARCHETYPES (regen/summoner/bulwark/enrager), **8** towers, **21** talents (13 core + 8 mastery) — all match. Vetoed section + Prompt-suggestions section both intact.

**Table-stakes audit:** Done — PWA install (v1.30.0), menu (v1.19.0) + draft (v1.20.0) keyboard a11y, colorblind aid (v1.18.0), reduced-motion (v1.10.0), volume slider (v1.13.2), responsive/mobile (v1.14.0/v1.15.0), touch/pointer (v1.16.3), high-DPI (v1.17.0), document metadata (v1.8.6). Still-open (all already logged in ROADMAP, unchanged): **gamepad support**, **bigger HTML tap targets on small phones**, and a **raster PNG icon set** for stricter Lighthouse installability. Gamepad remains the strongest next table-stakes pick.

**Integrity spot-checks:**
- **Test suite:** `npm test` → **505 passed, 0 failed**, exit 0.
- **file:// playability:** no `type="module"` anywhere; classic `<script src>` load order intact (core→maps→defs→state→game→update→render); SW registration guarded to `http/https` only, so double-click play + the headless harness are unaffected.
- **Old-save migration:** a minimal `cd_meta` (`{chips,talents}` only) loads and gains `achievements`/`stats`/`stats.bestCombo` defaults via `loadMeta()`; a minimal `cd_save` lacking newer fields (`mapTheme`, `perkState.glassCannon`, etc.) loads and rebuilds tower stats from base × level. Both round-trip cleanly.
- **Visual verification (owner FEEDBACK request):** desktop loads with **zero console errors** (v1.37.0 globals present); a manual `update(1/60)` drive cleared **3 waves** with no leaks; at **375px mobile** there's **no horizontal overflow** and all four start-screen panels (Talents/Records/Achievements/Settings) are `position:fixed` and fit within the viewport.

**Findings → ROADMAP:** none new — the project is coherent and the open backlog items are unchanged. Resets the 5-run health-check counter.

## v1.37.0 — 2026-06-13 — ⚡ Static Storm (11th Mayhem wave modifier — towers knocked offline)

**Type:** Content (new Mayhem wave modifier; serves the recurring "too easy" feedback on a fresh axis — **tower uptime**, not enemy HP). Mayhem-only, run-only state, save-safe.

**Why:** Difficulty has been pushed to the design ceiling on the HP axis (the norm-HP curve is invariant-capped by test `[16]`; the economy lever is near-exhausted — see FEEDBACK/ROADMAP). The existing tower-debuff mods only *scale* tower stats (Fog −20% range, Brownout +25% reload). Static Storm is the first mod that intermittently **removes** a tower from the fight, pressuring coverage redundancy and placement rather than raw stats. It's listed under ROADMAP "More wave modifiers" as the genuinely-new "EMP/stun (a tower offline for N seconds)" idea.

**What:**
- New `WAVE_MODS` entry (`cd-maps.js`) — `{ id:'emp', icon:'⚡', name:'Static Storm', desc:'Towers randomly knocked offline' }`. Pool **10 → 11**.
- Striker logic in `update()` (`cd-update.js`): while the mod is active, an `empStrikeTimer` fires every **3.5s** and knocks one random **firing** tower offline (`t.empT = 2.2s`); buff/support towers are excluded (always immune). Each strike does a cyan burst + `SFX.zap()` + light shake.
- Firing-loop gate (`cd-update.js`): `t.empT` decays every frame for all tower types; a firing tower with `empT > 0` skips its shot (`continue`). The timer decays unconditionally, so a tower always recovers even if the mod ends mid-strike.
- `empStrikeTimer` global declared beside `meteorRainTimer` (`cd-maps.js`); seeded to `2.5` in `rollWaveMod()` (short grace before the first zap).
- New `SFX.zap()` (`cd-core.js`) — a sharp electric crackle + buzzing tail.
- Render (`cd-render.js`): an offline tower dims (translucent overlay) with a flickering cyan crackle ring + a ⚡ glyph above it.

**Save-safety:** `empT` is **not** among the serialized tower fields in `saveRun()` (type/x/y/level/mode/spec/invested/dealt/kills), so it never persists; on resume towers default to online (`empT` undefined → falsy). Even a mid-strike quit would decay to 0 within ~2s of resuming. No new localStorage key, no schema/economy change.

**Test evidence:** new group `[54]` (9 checks) — `WAVE_MODS` includes `emp`; an offline tower can't fire with a target in range; it fires again once back online; the storm actually disables a firing tower; the offline timer stays within the 2.2s duration; buff towers are immune; timers decay to 0 after the storm; nothing disabled when the mod is off; zero console errors. (Group `[46]`'s Mayhem god-tower drive also exercises the larger pool.) Full suite expected green. PWA `CACHE` (`sw.js`) bumped to `circuit-defense-v1.37.0` to match `GAME_VERSION` (test `[49]`).

## v1.36.0 — 2026-06-13 — 🏷️ Boss-bar mechanic badge (names the active archetype)

**Type:** UX / readability polish (ROADMAP "Boss variety" follow-up: *a boss-bar badge naming the active mechanic*). Render-only — no gameplay/balance/economy/save impact.

**Why:** The boss-archetype system has grown to **four** mechanics (v1.25.0 regen/summoner/bulwark → v1.34.0 enrager) carried by every wave-20+ boss, but the only in-game cue was a colour-coded aura ring around the boss — easy to miss and impossible to decode mid-fight. Players couldn't tell a Regenerator from a Bulwark without memorising the colour key. Naming the mechanic on the always-visible boss HP bar closes that readability gap without touching difficulty.

**What:**
- New `bossMechanicBadge(e)` helper in `cd-render.js` (beside `enemyGlyph`/`PREVIEW_COLOR`/`GLYPH_FONT`) — the single source of truth for the badge `{label, c}`. Returns `null` for vanilla (pre-w20) bosses with no `bossType`, and for `null`/unknown input (no crash). Maps: `regen`→`REGENERATING` (green `86,211,100`), `summoner`→`SUMMONER` (red `255,148,146`), `bulwark`→`BULWARK` / `SHIELDED` while `shieldOn` (blue `121,192,255`), `enrager`→`ENRAGED` (orange `255,180,84`). **Colours match the existing aura-ring colours** in the same file, so the bar and the ring read as one cue.
- The boss-bar block in `draw()` now renders the badge as a bold 10px second line under `☠ OVERLORD — WAVE N` (at `by+26`), and **expands the bar's background box** from height 24→36 only when an archetype is present (`bh = mech ? 36 : 24`). Vanilla bosses (waves 5/10/15, campaign L1–5 finals) keep the original compact bar, byte-identical.
- Bulwark's label flips to **SHIELDED** for the ~2s its damage-soak shield is up, so the hold-your-big-hits window is readable from the bar (mirrors the ring's flare).

**Test evidence:** new group `[53]` (9 checks) — vanilla/null/unknown → no badge; each archetype's exact label + aura-matched colour; bulwark BULWARK↔SHIELDED flip; zero console errors. Full suite **496/0 green across 53 groups**. Verified live over http (`GAME_VERSION=v1.36.0`, badges correct, `draw()` runs clean with a live wave-20 archetype boss + boss bar, zero console errors). PWA `CACHE` bumped to `circuit-defense-v1.36.0` to match `GAME_VERSION` (test `[49]`).

## v1.35.0 — 2026-06-13 — ◈ Warden (support enemy with a damage-shield aura)

**Type:** Content (new enemy type; serves the recurring "too easy" feedback off the HP axis, across **all** modes).

**What:** Added an 8th enemy kind — **◈ Warden** — that appears from **wave 15+** in every mode
(Classic / Campaign / Mayhem). Slotted into `buildWave` (`cd-game.js`) at `i % 11 === 10` as the
last kind-`if` so it wins its slot (~9% of a wave, ~3 wardens at w15). Stats: `hp t.hp×1.3`,
`spd t.speed×0.85`, `r 13`, `bounty t.bounty×2.4` (a fat reward for popping it), `color #58a6ff`.
A Warden projects a **protective aura** (radius 75) that refreshes a short `e.warded` timer on every
nearby enemy each frame (`cd-update.js`, mirrors the heal aura); a warded enemy takes **40% less
damage** — one line in `damage()` (`if (e.warded > 0) dmg *= 0.6`, alongside the bulwark `shieldOn`
soak). The timer **decays** (`e.warded -= dt`, like `hasted`) so it lapses the instant a target leaves
the aura **or the Warden dies** — popping the Warden instantly un-shields its whole cluster.
`cd-render.js` draws a soft blue aura disc on the Warden and a faint blue ring on each warded enemy;
`enemyGlyph()`/`GLYPH_FONT`/`PREVIEW_COLOR` and the wave-preview `waveComposition()` all learn the
new kind, and the colorblind legend gains `◈ warden`.

**Why:** Difficulty has been raised on the HP axis to its design ceiling (the norm-HP curve is
invariant-capped by test `[16]`; economy levers are near-exhausted — see FEEDBACK/ROADMAP), so this
adds pressure on a **fresh axis: target priority**. A Warden makes a modest pack a slog until you
focus it down or splash it with AoE, raising the skill floor without piling on raw HP — and unlike the
recent boss/Mayhem additions it shows up in **Classic and Campaign too**, the exact modes the owner
called too easy. Distinct from the existing support enemy (heal restores HP) and the bulwark boss
(self-soak): the Warden is an *aura* damage-shield on *others*.

**Counters:** freezing a Warden pauses its aura entirely (gated `e.frozen <= 0`, like heal/boss
mechanics); Frost slows keep the cluster bunched for AoE; Wardens **never** shield themselves or each
other (excluded in the aura loop), so a Warden is always killable.

**Save-safe:** all fields (`warded` on victims, the Warden kind itself) are run-only — enemies are
never persisted, so no save/schema change. PWA cache const (`sw.js`) bumped to `v1.35.0` to match
`GAME_VERSION` (test `[49]`).

**Test evidence:** new group `[52]` — wave gating (none < w15, present from w15), aura tagging,
self/peer exclusion (always killable), out-of-aura enemies untouched, the ×0.6 damage reduction vs full
damage, frozen-Warden pause, timer decay once the Warden is gone, preview/glyph/colour plumbing, and a
live wave-15+ god-tower drive to w≥16. Full suite green (subagent-run).

## v1.34.0 — 2026-06-13 — 😡 Enrager (4th boss archetype)

**Type:** Content / balance (new boss mechanic; serves the recurring "too easy" feedback off the HP axis).

**What:** Added a fourth boss archetype — **😡 Enrager** — to the wave-20+ boss rotation
(`BOSS_ARCHETYPES` 3 → 4: `['regen','summoner','bulwark','enrager']` in `cd-game.js`). An Enrager
boss projects a **haste aura**: every enemy within 120px is tagged `hasted` each frame, and a hasted
enemy moves **+35% faster** (`hasteMul` in `cd-update.js`'s movement line). The tag decays in 0.6s once
an enemy leaves the aura. The boss pulses `SFX.bossSkill()` + an orange burst every ~2.5s; render
(`cd-render.js`) draws an **orange** boss aura ring (joining green-regen / red-summoner / blue-bulwark)
and a faint orange ring on each hasted enemy.

**Why:** Like the v1.25.0 archetypes and the v1.33.0 Regeneration mod, it hardens the **late game through
behaviour, not raw HP** — the norm-enemy HP curve is invariant-capped by test `[16]` (≤25% vs the v1.10.0
baseline at every wave), so difficulty is added off the HP axis. A fast escort overwhelms a defense that
relied on enemies dawdling through tower coverage, pressuring DPS and timing. Explicitly the "4th archetype
(enrager that speeds nearby enemies)" follow-up listed under ROADMAP → Boss variety.

**Counters:** freezing the Enrager pauses its aura entirely (the boss handler is gated `e.frozen <= 0`,
like regen/heal/summoner); Frost slows still multiply in on top of the haste (`slowMul × hasteMul`), so
crowd-control answers it directly.

**Rotation shift:** the cycle is now `(w/5 − 4) % 4`, so w20=regen / w25=summoner / w30=bulwark are
unchanged, w35 becomes enrager (was regen), w40 becomes regen (was summoner). Early/tutorial bosses
(w5/10/15, campaign L1–5 finals at `victoryWave < 20`) stay vanilla.

**Save-safe:** all fields (`bossType`, `hasted`, `enrageCd`) are run-only and lazily initialised; enemies
are never persisted, so no save/schema change. The PWA cache const (`sw.js`) bumped to `v1.34.0` to match
`GAME_VERSION` (test `[49]`).

**Test evidence:** extended group `[45]` — updated the rotation assertion (regen→summoner→bulwark→**enrager**),
added "enrager hastes nearby enemies" + "freezing an enrager pauses its haste aura" behaviour checks, and
added the enrager to the per-archetype killability loop and the live-wave drive. Full suite green (subagent-run).

## v1.33.0 — 2026-06-13 — 💚 Regeneration (10th Mayhem wave modifier)

**Type:** Content / balance (new Mayhem wave modifier; serves the recurring "too easy" feedback off the HP axis).

**What:** Added a tenth Mayhem wave modifier — **💚 Regeneration** (`WAVE_MODS` pool 9 → 10, `cd-maps.js`).
When it rolls on a wave, **every enemy in that wave (boss included) self-heals 2% of its max HP per
second** while alive on the path. A tight green halo marks regenerating enemies (`cd-render.js`).

**Why:** It's the first off-HP *difficulty* modifier (the existing pool had speed/count/HP/bounty/armor/
tower-stat twists + friendly meteors, but nothing that pressures sustained kill-throughput). Regen
punishes an under-built or marginal-DPS defense — stragglers patch themselves up and start leaking —
without adding raw HP (the norm-enemy HP curve is already invariant-capped by test `[16]`, see CLAUDE.md).
It rewards burst and is hard-countered by freeze (Frost towers / the Freeze ability **pause** the heal,
exactly like the boss-regen archetype and the heal enemy) and by any tower that out-DPSes the 2%/s tick.

**How:** `buildWave()` (cd-game.js) tags each enemy + the boss with `e.regen = true` under `modIs('regen')`
(baked at spawn so concurrent waves keep their own mod — mirrors `armored`/`titans`). `update()`'s enemy
loop (cd-update.js) heals tagged enemies: `e.hp = min(maxHp, hp + maxHp×0.02·dt)`, gated
`e.regen && e.frozen<=0 && !e.dead`. Render draws a green ring. The `regen` tag rides the run-only enemy
object (enemies are never persisted), so there's **no save/schema/economy impact**. Also appears in the
seeded Daily Challenge's modifier rotation automatically (it's just another `WAVE_MODS` entry).

**Tests:** Extended group `[46]` — `WAVE_MODS` includes `regen`; `buildWave` tags every enemy + boss only
when the mod is on; a tagged enemy actually heals over time in `update()`; and a **frozen** regen enemy does
NOT heal (freeze-pauses-it invariant). Full suite green via subagent; zero console errors.

## v1.32.1 — 2026-06-13 — 🩺 Health check (+ PWA cache-version fix)

**Type:** Health check (every-6th-run maintenance pass — 5 normal runs since the v1.27.1 health
check: v1.28.0, v1.29.0, v1.30.0, v1.31.0, v1.32.0). Ships no new feature; one small correctness fix.

**Fix — PWA offline cache version had drifted.** `sw.js`'s `CACHE` const was still
`circuit-defense-v1.30.0` even though the game had advanced to v1.32.0 (CLAUDE.md's convention is
to bump it every release so the service worker's `activate` step evicts the previous cache). With a
cache-first strategy and a name that never changed, a player who installed the **hosted** PWA at
v1.30.0 would keep being served the stale v1.30.0 shell offline and never pick up v1.31.0/v1.32.0.
Bumped `CACHE → circuit-defense-v1.32.1` to match `GAME_VERSION`. **Regression guard:** test `[49]`
now extracts `GAME_VERSION` from `cd-core.js` and the `circuit-defense-vX.Y.Z` version from `sw.js`
and asserts they're equal, so a forgotten bump fails the suite from now on. Only affects the
hosted/installed web-app — `file://` double-click play, the headless harness, and saves are
untouched (the SW never registers on `file://`).

**Health-check audit results (all clean):**
- **Tests:** full suite green — **465 checks across 51 groups `[0]`–`[51]`, 0 failures, 0 console
  errors** (was 393/47 at v1.27.1; +72 checks / +4 groups from v1.28.0–v1.32.0, incl. the new
  cache-version guard added this run).
- **Refactor audit:** every game source file well under the ~1500-line cap (largest `cd-update.js`
  774, `cd-render.js` 618, `cd-game.js` 598). No dead code, no debug logging, no real TODOs (the
  only `TODO` grep hit is the word inside a changelog string). The dev-only `tests/run-tests.mjs` is
  now ~2920 lines / 51 groups — re-flagged on ROADMAP as the split candidate (numbers refreshed
  from the stale 2559/47/393).
- **Docs coherence:** CLAUDE.md numbers re-verified against code and all match — 8 towers, 21
  talents, 9 Mayhem wave modifiers, 13 achievements, booster aura range 45, boss HP slope
  `14 + w*0.6`, Glass Cannon (`effDmg ×1.5`, `effRange ×0.7`, aura range untouched). Fixed the one
  drift found: CLAUDE.md hardcoded the SW cache name `circuit-defense-v1.30.0` → now documents the
  `circuit-defense-<GAME_VERSION>` convention + the new guard test. `GAME_VERSION` consistent
  everywhere (v1.32.1).
- **Integrity spot-checks:** `file://` playability intact — no `type="module"`, seven classic
  `<script src>` tags in dependency order, inline-SVG favicon, all relative paths, SW registration
  protocol-guarded to http/https (the migration/old-save and offline-play assertions are covered by
  the green suite). Deploy workflow still copies the PWA trio (`manifest.webmanifest` + `sw.js` +
  `icon.svg`) into `_site` as a static deploy.
- **Table-stakes audit:** still-open gaps, priority order — **gamepad support**, then **bigger HTML
  tap targets on small phones**. PWA install (v1.30.0), keyboard a11y (v1.19.0/v1.20.0), colorblind
  aid (v1.18.0), high-DPI (v1.17.0), touch/pointer (v1.16.3), reduced-motion (v1.10.0), volume
  slider (v1.13.2), responsive layout (v1.14.0/v1.15.0), document metadata (v1.8.6) all done.

**Test evidence:** `npm test` → `Results: 465 passed, 0 failed`, `All green ✅`, exit 0. The new
`[49]` cache-version assertion passes (GAME_VERSION=v1.32.1, CACHE=v1.32.1).

## v1.32.0 — 2026-06-13 — 🔮 Glass Cannon legendary perk

**What:** A new **legendary** run-perk in the every-5-waves draft pool (`PERKS` in `cd-defs.js`):
🔮 **Glass Cannon** — **+50% damage to all towers, but −30% firing range**. A genuine
high-risk/high-reward trade rather than a free power spike: the extra punch melts tanks and
bosses, but the shorter reach means each tower covers far less of the path, rewarding tight
placement, slows, and chokepoints over a snowballing comfortable run.

**Why:** The "Tone of additions" guidance asks to occasionally surprise the owner with *"a weird
legendary perk,"* and ROADMAP lists *"more quirky legendaries (e.g. a glass-cannon trade-off)"* as
an open follow-up. Recent runs leaned on features (Daily/PWA/streak) and difficulty/balance; this
adds replay variety and a meaningful draft choice. Deliberately **"too easy"-safe**: the −30% range
is a real cost (you lose coverage), so unlike a flat damage perk it doesn't trivially ease an
already-easy run — it trades survivability/coverage for burst, the classic glass-cannon archetype.

**How:**
- `cd-defs.js`: new perk `{ id:'glasscannon', rarity:'legendary', icon:'🔮', … apply:s=>s.glassCannon=true }`;
  `freshPerkState()` gains `glassCannon:false`.
- `cd-game.js`: `effDmg()` multiplies by `1.5` when held; `effRange()` multiplies by `0.7` when held.
  The range cut applies to **combat/firing range only** (`effRange`), not booster auras
  (`effBuffRange`) — buff towers deal no damage, so the perk leaves their aura reach untouched.
- `cd-core.js`: `GAME_VERSION` → v1.32.0 + changelog entry.

**Save-safe:** `glassCannon` lives **inside `perkState`**, so it's persisted whole by `saveRun()`
and restored save-safely via `loadRun()`'s `Object.assign(freshPerkState(), s.perkState)`; old saves
lack it and default to `false`. `upgradeKey()` already hashes `effDmg()`, so the upgrade panel
reflects the +50% (and perks are only ever drafted on an empty field with the panel closed, so the
range cut is in place before the panel can reopen). No new localStorage key, no economy/chip/schema
impact.

**Tests:** new group **[51]** (8 checks) — perk is a legendary in the pool, +50% damage, −30% range,
booster aura range untouched, `freshPerkState` default, save→reload round-trip, old-save migration to
`false`, zero console errors. Full suite **464/0 green**.

## v1.31.0 — 2026-06-13 — 🔥 Daily streak counter

**What:** The v1.28.0 Daily Challenge now tracks a **consecutive-day streak**. Each calendar day
you *finish* a daily run — win, loss, or playing on into endless; any finish counts — your streak
grows by one; miss a day and it resets to 1 on your next finish. Replaying the daily multiple times
in a day is a no-op (one per calendar day). The current streak is surfaced on the 🗓 Daily Challenge
button (e.g. `🔥5d`, with a "keep it alive" tooltip) and as a `🔥 Daily streak` row in the 🏆 Records
panel. A streak that has lapsed (last finish older than yesterday) reads 0.

**Why:** ROADMAP — *Daily Challenge follow-up: "a daily streak counter"* (listed first under the
v1.28.0 Daily Challenge item). The owner loves addictive progression loops; "come back tomorrow to
keep your streak" is exactly that, with zero balance risk.

**How:**
- `cd-maps.js`: `dailyDayBefore(key)` — `'YYYYMMDD'` for the calendar day before a key (parses to a
  local `Date`, steps back one day for DST/month/year safety, reformats).
- `cd-update.js`: `loadDailyStreak()` / `currentDailyStreak()` (read-only, lapses to 0 if the last
  finish is older than yesterday) / `recordDailyStreak(todayKey?)` (one-per-day, extend-or-reset).
  `endGame()` and `winGame()` call `recordDailyStreak()` when `daily`. `renderBests()` shows the row.
- `cd-game.js`: `renderStartScreen()` appends `🔥{n}d` + a streak tooltip to the Daily button when
  the streak is ≥2.
- `cd-core.js`: `GAME_VERSION` → v1.31.0 + changelog entry.

**Save-safe:** one new additive localStorage key `cd_daily_streak = {count, last:'YYYYMMDD'}`; old
saves lack it and default to 0. `resetAllData()` already clears it (cd_-prefix sweep). No gameplay,
balance, economy, chip, or schema impact. Offline (local date, no network).

**Tests:** new group **[50]** (15 checks) — `dailyDayBefore` arithmetic incl. month/year rollover,
start/grow/reset-on-miss, same-day no-op, yesterday/today still-standing, lapsed/missing/malformed
defaults to 0, and the live `endGame()` path records the streak. Full suite **456/0 green**, zero
console errors.

## v1.30.0 — 2026-06-13 — 📲 PWA — installable + offline-cacheable (hosted)

**What:** Made the game an installable Progressive Web App for the **hosted** (http/https)
deploy. Three new static files — `manifest.webmanifest` (name/short_name/start_url/
`display:standalone`/theme+background colors/icon), `icon.svg` (a maskable gold-⚡ app icon
matching the favicon), and `sw.js` (a service worker that precaches the app shell and serves
cache-first with a same-origin runtime-cache + offline fallback to the game). The HTML head
links the manifest + an apple-touch-icon and adds the iOS web-app meta tags; `cd-render.js`
registers the SW **guarded to http/https only**. The deploy workflow now copies the three
files into `_site`.

**Why:** Table-stakes for a polished browser game (ROADMAP "PWA install"), and especially
aligned with the owner's repeated mobile focus — players can now "Add to Home Screen" and get
a real app icon + own-window launch + offline play on the hosted version.

**Guardrails:** `file://` double-click play is **completely unaffected** — service workers
can't register on `file://`, and the registration is protocol-guarded so it never runs (or
throws) there; the headless harness (also `file://`) confirms no SW registers and zero console
errors. No build step (plain static files, classic `<link rel="manifest">`, NOT a module),
no runtime network dependency for the core game, and **no localStorage / save-schema change**
(the SW uses the separate Cache API). Cache name is versioned (`circuit-defense-v1.30.0`) so
the `activate` step evicts stale caches on each release.

**Test evidence:** New test group **[49]** (manifest valid JSON + required install fields,
maskable icon, `icon.svg` exists, SW has install/activate/fetch handlers + precaches the shell,
HTML links manifest + apple-touch-icon, SW registration is protocol-guarded, manifest link in
the live DOM, **no SW registered on `file://`**, zero console errors). Full suite **441/0**.
Also verified live over http in the preview: SW activated (scope `/`), all 13 shell assets
precached, manifest + apple-touch-icon present, version v1.30.0, zero console errors; then
unregistered the dev SW to keep the preview clean.

## v1.29.0 — 2026-06-12 — 🏅 Four new achievement badges

**What:** Added four new achievements (the roster grows 9 → 13), all evaluated in
`grantAchievements()` (`cd-update.js`) at end of run:
- 🕊️ **Pacifist** — win without casting a single ability (meteor/freeze/rush).
- 🧩 **Specialist** — win using only one type of tower.
- ⚖️ **Minimalist** — win with 5 or fewer towers placed.
- 🗓️ **Daily Devotee** — reach wave 20 in a Daily Challenge (granted on any finish, win or loss).

To support Pacifist, a run-only `abilityUsedThisRun` flag (declared in `cd-state.js` next to
`livesLostThisRun`, reset in `resetState()`) is set `true` whenever an ability actually fires —
in `triggerAbility()`'s freeze/rush branches and in `castMeteor()` (`cd-defs.js`). Arming the
meteor without casting does **not** count. Like Flawless, the flag is forced `true` in `loadRun()`
so **Pacifist can't be earned on a resumed run** (earlier waves can't be verified ability-free).
Specialist/Minimalist read the final `towers` board at the moment of victory (a degenerate
zero-tower finish grants neither). Daily Devotee reads the existing run-only `daily` flag + `wave`.

**Why:** ROADMAP "Achievements system" follow-ups explicitly listed *"more badges (no-ability win,
all-one-tower-type, …)"*. Adds fresh, addictive completion goals (the owner likes progression
loops + meaningful constraints), and Daily Devotee gives the new v1.28.0 Daily Challenge something
extra to chase. The badge panel + `#achBtn` done/total counter auto-generate from the
`ACHIEVEMENTS` array, so this is purely additive.

**Save safety:** `meta.achievements` is an additive id→true map (new ids just start absent/false);
no schema change, no migration needed. `abilityUsedThisRun` is run-only and never persisted. No
balance/economy/gameplay impact — winning is unchanged; the badges only *observe* how you won.

**Tests:** New test group `[48]` (11 checks) drives wins under each scenario and asserts each badge
is granted only when its condition holds (and withheld otherwise), plus the zero-tower guard, the
non-daily guard, and the roster size (13). Full suite **421/0 green**, zero console errors.

## v1.28.0 — 2026-06-12 — 🗓 Daily Challenge

**What:** A new **Daily Challenge** game mode (start-screen button, `beginDaily()`). Today's run is
**fully determined by the local date** — the map path, the difficulty, and the per-wave Mayhem
modifier schedule are all generated from a date-seeded PRNG, so **every player faces the same run
today** (and can chase the same target tomorrow). It plays like a Mayhem run (animated `chaos`
theme, per-wave twists) but the map is **FIXED for the day** (no every-5-waves world-shift), so
scores are comparable. Difficulty is locked to **Normal or Hard** by the seed (a daily is a
challenge — never Easy). Best wave per day is tracked under its own additive key
`cd_daily_<YYYYMMDD>`, shown on the Daily button and in the 🏆 Records panel, separate from the
normal per-map records. A daily is **one-off & not resumable** and **never touches the player's
normal saved run** (it doesn't `clearRun()` on start and `saveRun()` bails while `daily`). Comes
back fresh at local midnight.

**Why:** ROADMAP "Next up (high value)" — *Daily challenge seed: a deterministic map+modifier set
keyed off the date, with its own best-score key (offline-safe: derive from local date)*. Owner
loves addictive progression loops; a fresh daily target is exactly that. Recent runs were heavy on
difficulty/boss/balance, so this adds variety. The standing FEEDBACK item is `[Low priority]`, so
per the routine a self-chosen high-value ROADMAP item was eligible.

**How (all additive, save-safe, no economy/balance touch to existing modes):**
- `cd-maps.js`: `mulberry32()` seeded PRNG + `dailyDateString()` (local) + `dailySeedFrom()`
  (FNV-1a) + `setupDaily()` (resolves diffKey, the seeded fixed path via `genPathWith(rnd)`, and the
  `dailyMods[1..30]` schedule from one rng stream). New run-only globals `daily`/`dailyDateKey`/
  `dailySeed`/`dailyMods`. `rollWaveMod()` reads `dailyMods[wave]` when `daily` (deterministic).
- `cd-game.js`: `beginDaily()` (no `clearRun`); `startWave()` skips `shiftWorld` when `daily`;
  `beginGame()`/`backToMenu()` clear the flag; start-screen button shows today's best.
- `cd-state.js`: `bestKey()` routes to `cd_daily_<date>` when `daily`; `resetState()` keeps the
  seeded path (`!daily` guard) and labels the run `🗓 Daily <date>`; `saveRun()` bails when `daily`;
  `loadRun()` clears the flag.
- `cd-update.js`: `recordBest()` records/flourishes off the per-date daily key; `endGame()` skips
  `clearRun()` when `daily`; `renderBests()` shows today's daily best.
- `cd-render.js`: the "world will shift" hint is hidden for daily (path is fixed).
- HTML: a `🗓 Daily Challenge` button on the start screen.

**Test evidence:** new test group `[47]` (17 checks) — setup determinism per date, distinct dates
differ, diff always normal/hard, 1..30 mod schedule, `rollWaveMod` follows the schedule, `beginDaily`
wiring, fixed path across a 5-wave boundary, normal-save left untouched, clean multi-wave drive,
per-date best key writes (not the per-map quick keys), silent first-record / flourish-on-beat /
no-flourish-on-lower, monotonic best, `bestKey()` routing. **Full suite 410/0 green**, zero console
errors. Verified in-preview: button present, today's seed → Hard / chaos theme / victory wave 30,
diff label `🗓 Daily 20260612 · Hard`, path fixed across waves, `cd_save` sentinel preserved, button
+ Records panel both surface the daily best.

## v1.27.1 — 2026-06-12 — 🩺 Health check

Every-6th-run maintenance pass (5 version entries since the v1.24.2 health check: v1.24.3, v1.24.4,
v1.25.0, v1.26.0, v1.27.0). No new feature — verification only. The PENDING FEEDBACK item is
`[Low priority]` and not a gameplay-breaking `[bug]`, so the health check takes precedence this run.

**1. Refactor audit.** All seven game files comfortably under the ~1500-line cap:
`cd-update.js` 713, `cd-render.js` 609, `cd-game.js` 566, `cd-defs.js` 318, `cd-core.js` 370,
`cd-maps.js` 198, `cd-state.js` 156 (+ `tower-defense.css` 407, `tower-defense.html` 138). No dead
code, no `console.*`/`debugger` leftovers, no TODO/FIXME. **Finding:** the dev-only test harness
`tests/run-tests.mjs` grew 2294 → **2559 lines** (47 groups `[0]`–`[46]`, 393 checks) and is now the
single largest file in the repo — flagged in ROADMAP as the next `[refactor]` (split per-group).

**2. Docs coherence.** Cross-checked CLAUDE.md against the code — every documented number still
matches: 8 towers, 21 talents, 9 Mayhem wave mods (`frenzy/swarm/titans/goldrush/surge/fog/armored/
brownout/meteors`), booster aura range `45`, boss HP slope `14 + w*0.6`, norm-HP curve
`(18 + w*7 + 1.25·w^1.9)·1.80`. No drift found. Versions consistent across `GAME_VERSION`,
`CHANGELOG_ENTRIES[0]`, and CHANGELOG.md (all v1.27.1). What's New still carries the full 59-entry
history (owner preference — never trimmed). ROADMAP test-harness + table-stakes notes refreshed.

**3. Table-stakes audit.** Favicon (inline SVG data URI), `viewport`/`description`/`theme-color`/
Open Graph all present. Done since last audit: a11y (menu v1.19.0 + draft v1.20.0), colorblind aid
(v1.18.0), responsive/mobile (v1.14.0/v1.15.0), touch/pointer (v1.16.3), high-DPI (v1.17.0), volume
slider (v1.13.2), reduced-motion (v1.10.0). Still-unaddressed (all in ROADMAP): **gamepad support**,
**PWA install** (offline manifest, hosted-only), **bigger HTML tap targets on small phones**.

**4. Integrity spot-checks.** Full suite **393/0**, exit 0. `file://` playability intact — classic
`<script src>` load order (core→maps→defs→state→game→update→render), zero `type="module"`, relative
paths, data-URI favicon. Live-loaded the page (preview): start screen renders, **zero console
errors**, all globals present (v1.27.1 / 8 towers / 9 mods / 21 talents / 59 entries); a manual
god-tower drive cleared wave 1 (9 kills, no lives lost, no exceptions). Old-save migration verified
in code: `loadMeta()` defaults `achievements/stats/dmg/runs/bestCombo`; `loadRun()` guards `mapTheme`
and rebuilds `perkState` via `Object.assign(freshPerkState(), …)`. Deploy workflow copies
`index.html + tower-defense.{html,css} + cd-*.js` (wildcard catches all seven) as a static deploy.

**Result:** project is healthy and on-course. Nothing required fixing; findings logged to ROADMAP.

## v1.27.0 — 2026-06-12 — 🌀 Two new Mayhem wave modifiers: Armored Surge + Brownout

**New content** (ROADMAP "More wave modifiers for Mayhem"). Mayhem rolls a random per-wave twist
(78% chance) from `WAVE_MODS`; the pool grew from 7 → 9. Both new mods introduce an axis none of the
existing seven touched.

- **🛡️ Armored Surge (`armored`)** — every enemy in the wave (and the boss) gains flat armor
  `+5 + floor(w·0.3)` on top of its base (+8 at w10, +14 at w30). Armor subtracts from each hit
  (reduced by the Piercing talent), so it disproportionately blunts fast low-damage towers. Hard
  counters already in the game: **Mortar** (shells force `ignoreArmor`), **Poison** (corrodes −3
  armor/hit), and the Sniper's **AP** spec / **Piercing** talent. Wired in `buildWave()` (cd-game.js)
  for both the per-enemy loop and the boss, mirroring the existing `titans`/`goldrush` lines.
- **🔌 Brownout (`brownout`)** — all towers fire **25% slower** that wave (`effRate ×1.25`). Completes
  the tower-stat-twist trio: **Power Surge** (+30% dmg) / **Fog** (−20% range) / **Brownout**
  (−rate). One line in `effRate()` (cd-game.js); auto-reflected in the upgrade panel since `effRate`
  is hashed into `upgradeKey()`.

Both are **Mayhem-only** (rolled by `rollWaveMod()`, which bails outside mayhem) and **per-wave**
(transient run state, never persisted) — zero impact on normal/campaign modes, saves, or the economy.
The floater banner + name/desc surface automatically. New test group **[46]** (mod presence, armor
math at w10 incl. boss, the 25% rate slow, inertness when cleared, and a full Mayhem run driving
clean with the mods in the pool). Suite green; zero console errors.

## v1.26.0 — 2026-06-12 — 🎯 Executioner sniper spec un-dominated (+60% → +90% vs tanks & bosses)

**Balance / meaningful-choice** (ROADMAP "Tower spec pass" — audit the 2 specs per tower for a
strictly-dominated option and buff it). The Sniper's L5 choice was a trap: **Executioner** was
strictly dominated by **Deadeye**.

- **The domination:** Deadeye = `20% crit ×4`, i.e. an expected `0.8×1 + 0.2×4 = 1.6×` (+60%) vs
  **all** targets (and it scales further with crit talents/perks). Executioner gave `×1.6` (+60%)
  vs **tanks & bosses only**, `×1.0` vs everything else. So with zero crit investment Deadeye
  *matched* Executioner on bosses (both 1.6× in expectation) and *beat* it on every other enemy —
  there was no scenario where Executioner won.
- **The fix:** Executioner `×1.6 → ×1.9` (`cd-update.js`, the inline tank/boss multiplier), desc
  `+60% → +90% vs tanks & bosses` (`cd-defs.js`). Now Executioner is the **dedicated boss-killer**:
  `1.9×` guaranteed (no crit RNG) vs tanks/bosses *beats* Deadeye's `1.6×` average on the targets
  that matter, while Deadeye stays the consistent all-rounder (and the only one that helps vs trash
  waves + scales with crit gear). Genuine trade-off, tied to your targeting strategy.
- **Guardrail:** `1.9/1.6 = +18.75%` to the multiplier — inside the ≤25%/number/run limit. One
  number changed; Deadeye, all other specs/towers, economy and save schema untouched. Kept distinct
  from the **Titan Slayer** legendary (`+100%` vs tanks & bosses) — they stack multiplicatively
  (Executioner sniper + Titan Slayer = `1.9 × 2.0 = 3.8×` vs a boss) for a satisfying boss-deletion
  build. Synergizes with the recent boss-difficulty work (v1.24.4 tankier bosses, v1.25.0 archetypes):
  tankier bosses make a boss-specialist spec more worthwhile.
- **Tests:** group `[17]` extended — drives a real Executioner sniper shot at a boss / tank / norm
  and asserts `1.9×` vs tanks & bosses, `1.0×` vs trash, the `+90%` description, and that the boss
  multiplier now exceeds Deadeye's `1.6×` expectation (no longer dominated). Full suite green.

## v1.25.0 — 2026-06-12 — 👑 Boss archetypes (regen / bulwark / summoner)

**Content + late-game difficulty** (ROADMAP "Boss variety", and serves the recurring FEEDBACK *"too easy"* —
hardening deep waves **off the HP axis**, since the norm-enemy curve is invariant-capped by test `[16]`). Bosses
(every 5th wave) were just scaled HP. From **wave 20 onward** each boss now also carries a **mechanic**, cycling
through three archetypes by boss number (`BOSS_ARCHETYPES = ['regen','summoner','bulwark']`, indexed
`(w/5 − 4) % 3` in `buildWave`, `cd-game.js`):

- **🟢 Regenerator** — self-heals `1.2%/s` of max HP (`cd-update.js` enemy loop). Punishes under-investment;
  **freezing it pauses the heal** (gated on `e.frozen<=0`, like the heal enemy).
- **🔵 Bulwark** — cycles a **2s damage-soak shield** (`×0.4` incoming, i.e. −60%) every ~8s. The reduction is a
  single line in `damage()` (`if (e.shieldOn) dmg *= 0.4`); the aura ring flares bright/thick during the active
  window so it's readable. Average effective-HP gain ≈ +15% (2s on / 8s cycle × 0.6 soak).
- **🔴 Summoner** — spawns **2 weak adds** behind it every 4.5s, **capped at 8 total** (`summonsLeft`). Adds are
  `maxHp×0.02` (~half a norm enemy), tiny bounty, so they split tower attention / threaten leaks without feeding
  the economy.

A coloured boss aura (`cd-render.js`) codes the archetype (green/red/blue), and `SFX.bossSkill()` (`cd-core.js`) —
a short ominous metallic swell — fires when a boss raises its shield or summons. **Early/tutorial bosses
(w5/10/15, and campaign L1–5 finals at `victoryWave<20`) are unchanged**, so the opening (which the notes mark as
already feeling right) is untouched.

- **Save-safe:** every archetype field (`bossType`, `shieldOn/shieldT/shieldCd`, `summonCd/summonsLeft`) is
  run-only and lazily initialised in `update()` — enemies are never persisted, so there's no schema change or
  migration. Old saves resume identically.
- **Tests:** new group `[45]` (boss archetypes) — asserts vanilla bosses below w20, the correct archetype
  rotation at w20/25/30/35, that regen heals & freeze pauses it, that the bulwark shield soaks damage & cycles,
  that the summoner spawns capped adds, and that an archetype boss wave still clears with overwhelming towers
  (beatable, no hang, zero console errors). Full suite green.
- **Why mechanics, not more HP:** the regular-enemy HP curve is at its design ceiling (test `[16]`); behaviour is
  the open lever. ROADMAP "Boss variety" called for exactly *"distinct boss behaviors (shielded, summoner,
  regenerator) instead of just scaled HP."*

## v1.24.4 — 2026-06-12 — 🐲 Tougher late-game bosses (boss HP slope 0.5 → 0.6)

**Addresses the recurring FEEDBACK item** *"The game is still too easy."* (kept in PENDING — recurring,
iterative, ≤25%/number/run). A boss spawns every 5th wave with HP = `enemyTemplate(w).hp × mult`, where
`mult = 14 + w·0.5`. This run steepens the slope to **`14 + w·0.6`** (`cd-game.js`, `buildWave`), so bosses
get relatively tankier the deeper the run goes — targeting the documented **mid-/late-game plateau** (the
maintainer notes mark the early game as already feeling right; the plateau is the gap).

- **Why bosses, not the regular HP curve:** the norm-enemy curve `(18 + 7w + 1.25·w^1.9)·1.80·d.hp` is already
  at its design ceiling — test `[16]` enforces a **≤25% cumulative boost vs the v1.10.0 baseline** at *every*
  wave, and the `1.25` coefficient already sits at that ceiling's asymptote. So the **boss multiplier** (not
  covered by that invariant) is the open late-game lever. ROADMAP listed this exact step: *"stronger late
  bosses (`14 + w*0.5` → `+w*0.6`, bounded +20%)."*
- **Simulated swing (classic-normal, in-engine before/after):** boss HP **+3.0%** (w5) · **+5.3%** (w10) ·
  **+7.0%** (w15) · **+8.3%** (w20) · **+10.3%** (w30) · **+12.8%** (w50) — the ratio `(14+0.6w)/(14+0.5w)` is
  independent of `d.hp`/campScale, so these hold on every difficulty. The `+14` constant bounds the ratio
  `(14+0.6w)/(14+0.5w)` to a **+20% asymptote** as `w→∞`, so the per-run swing stays inside the ≤25%/number
  guardrail at *every* wave (incl. deep endless). The coefficient itself moves `0.5 → 0.6` = +20%.
- **Scope:** one number. Specials/tanks/norms unchanged; campaign bosses inherit the same template×mult so they
  scale with this too (the late-campaign "too easy" case — e.g. a campaign-L40 final boss at w50 is +12.8%).
  Boss bounty (`t.bounty×12`), speed, armor (`w·0.4`) all unchanged. No economy/save-schema impact (boss HP is
  computed at spawn, never persisted).
- **Tests:** new group **[44]** — asserts the live `14+0.6w` slope at six waves, that the boost over the old
  0.5 slope **grows with wave yet stays ≤25%** everywhere, and that a boss wave still clears with overwhelming
  towers (beatable, no crash). Suite green.
- **FEEDBACK note:** this is the "steepening late difficulty" half of the standing item; the **economy** half is
  now near-exhausted (see ROADMAP — the 10-wave war chest is ~70% bounty, already trimmed in v1.16.1, so the
  remaining interest/start-gold levers move it <2% each). Flagged the HP-invariant ↔ ROADMAP-"1.55" tension to
  the owner in ROADMAP.

## v1.24.3 — 2026-06-12 — 🎯 Booster aura-range cut, final slice (52→45)

**Closes the FEEDBACK item** *"Reduce the range of booster by 50% base. This helps make network better."*
The Booster's aura is the circle within which it grants its +25% damage buff (`effBuffRange`); cutting its
radius makes one booster reach fewer towers, so the +50% **Network** spec (and Booster Mastery) matter more
off the smaller base — exactly the owner's goal.

- **Change:** `TOWER_TYPES.buff.range` **52 → 45** (`cd-defs.js`). −13.5% this run (inside the ≤25%/number/run
  cap). This is the **third and final slice** of the −50% request: across the three runs the base has gone
  **90 → 68 (v1.20.1) → 52 (v1.24.1) → 45 (this run)** — `45 = 90 × 0.5`, the literal halving.
- **Cumulative effect:** coverage **area** is now `45²/90² = 25%` of the original — a single booster blankets
  roughly a quarter of the towers it used to, chipping the "one gunner + maxed booster solo-carries" outlier
  from the coverage side (complements the v1.16.2 aura-*power* taper +75%→+65%).
- **`effBuffRange(t) = t.range × (network?1.5:1) × (1 + 0.02·mastery_buff)`** — unchanged; only the base shrank.
  Network now reaches `45×1.5 = 67.5` (vs the plain `45`), so the spec is a bigger relative jump than ever.
- **Save-safe:** fresh placement (`cd-game.js`) and the `loadRun` rebuild (`cd-state.js`) both read `def.range`,
  so resumed boosters just adopt the new radius. No economy/schema impact (pure base-stat number).
- **Files:** `cd-defs.js` (`buff.range` 52→45), `cd-core.js` (version + changelog entry).
- **Tests:** group **[39]** updated — base is now 45, plain/Network aura ranges follow, a tower at **48px**
  (inside the old 52 aura, outside the new 45) is no longer buffed, and one at **40px** still is. Subagent
  ran the suite → green. FEEDBACK item moved to DONE.

---

## v1.24.2 — 2026-06-12 — 🩺 Health check

**Every-6th-run maintenance pass** (resets the 5-run counter; 5 entries since the v1.20.2 health
check — v1.21.0, v1.22.0, v1.23.0, v1.24.0, v1.24.1). Ships no new feature. `git pull` was clean;
the recent owner `feedback` commit (`3664000`) only adds two lines to FEEDBACK.md — **not a revert**,
so no new vetoes. No FEEDBACK `[bug]` items (both PENDING items are `[Low priority]` balance), so the
normal health-check path ran.

**1. Refactor audit.** All seven game files are well under the ~1500-line cap:
`cd-core` 360, `cd-maps` 196, `cd-defs` 318, `cd-state` 156, `cd-game` 545, `cd-update` 676,
`cd-render` 598 (CSS 407, HTML 138, index 12). No dead code, no `console.log`/debug remnants, no
`TODO`/`FIXME`. `waveDesc` (replaced by `waveComposition` in v1.21.0) is fully gone. The booster
`+0.08` taper is intentionally mirrored across three sites (cd-game/cd-defs/cd-state) and all three
agree. **Finding:** the dev-only `tests/run-tests.mjs` has grown to 2294 lines in one file — logged
to ROADMAP as a future split (does not affect the shipped game).

**2. Docs coherence.** `GAME_VERSION` (v1.24.1 at audit time) matched the CHANGELOG top entry.
Spot-checked every numeric claim in CLAUDE.md against the code — **no drift**: 8 towers
(`TYPE_KEYS.length`), booster aura range 52, `buffPower` base 0.25 + 0.08/level, enemy-HP template
`(18 + w·7 + 1.25·w^1.9) · 1.80 · d.hp · campScale`, perk rarity 78/14/8 (legendary `<0.08`, rare
`<0.22`), 21 talents, `MAX_CONCURRENT_WAVES`. Test groups `[0]`–`[43]` are contiguous. FEEDBACK
PENDING items left verbatim; ROADMAP vetoed section intact.

**3. Table-stakes audit.** Still-unaddressed, in priority order (carried in ROADMAP):
**gamepad support** → **PWA install (offline manifest)** → **bigger HTML tap targets on small phones**.
Everything else a polished browser game expects is in place — favicon/meta/OG (v1.8.6), reduced-motion
(v1.10.0), volume slider (v1.13.2), responsive + landscape layout (v1.14.0/v1.15.0), touch/pointer
controls (v1.16.3), high-DPI canvas (v1.17.0), colorblind aid (v1.18.0), full keyboard a11y
(v1.19.0 menus + v1.20.0 draft).

**4. Integrity spot-checks.**
- **Tests:** subagent ran `npm test` → **356 passed, 0 failed**, exit 0.
- **`file://` playability:** HTML uses classic `<script src>` tags (cd-core→cd-render in order), an
  inline-SVG-data-URI favicon, and a `<link>` stylesheet — no `type="module"`, no network deps.
- **Old-save migration (verified in-browser):** a pre-achievements meta `{chips:12, talents:{firepower:2}}`
  migrated cleanly (gained `achievements`/`stats` defaults, kept chips + talents); a minimal old
  `cd_save` resumed (wave restored, tower rebuilt, `mapTheme`→`circuit` default, `perkState.lastStand`→false).
- **Deploy:** `.github/workflows/pages.yml` still copies `index.html tower-defense.html tower-defense.css
  cd-*.js` into `_site` — static, no build step.
- A 1-wave quick-mode drive ran with zero console errors; injected test data cleaned up afterward.

**Verdict:** healthy, no fixes needed. Findings → ROADMAP. Patch bump to v1.24.2.

---

## v1.24.1 — 2026-06-12 — 🎯 Booster aura-range cut, slice 2 (68→52)

**What & why.** FEEDBACK PENDING item #1 (first pending, owner: *"[Low priority] Reduce the range of
booster by 50% base. This helps make network better."*). All current PENDING items are `[Low priority]`,
so the routine leaves the pick open, but this is an explicitly-queued, mid-progress owner request with a
defined next slice (v1.20.1 noted "next step e.g. 68→52"), and it also chips at the recurring **"too easy /
single-tower-carries"** complaint. This run takes the second slice: `TOWER_TYPES.buff.range` **68 → 52**.

**Sizing.** −23.5% this run (inside the ≤25%/number/run guardrail). The aura is a circle, so this is
~**−41% of the covered area** at 52 vs 68. Cumulative with the original `90 → 68 → 52`, a booster's coverage
area is now **~33% of the original** (52²/90² ≈ 0.33) — well under half, matching the spirit of the owner's
"−50% base" ask (final step `52 → ~45` will land the literal halving next run).

**Effect.** One booster can no longer blanket a sprawling defense, so it's placed deliberately near key
towers (or you build a second), and the **Network** spec (+50% range, the "makes network better" point) and
**Booster Mastery** range matter more off the smaller base. `effBuffRange(t) = t.range × (network?1.5:1) ×
(1 + 0.02·mastery_buff)` is unchanged — only the base feeding it shrank.

**Scope / safety.** Save-safe: fresh placement (`cd-game.js`) and `loadRun`'s rebuild (`cd-state.js`,
`range: def.range × 1.08^(lvl-1)`) both read `def.range`, so resumed boosters pick up the new radius with no
migration. No damage/economy/save-schema impact.

- **Files:** `cd-defs.js` (`buff.range` 68→52), `cd-core.js` (version + changelog entry).
- **Tests:** group **[39]** updated — base is now 52, plain/Network ranges follow, a tower at **60px** (inside
  the old 68 ring) is no longer buffed while one at **45px** still is. Suite expected green.

## v1.24.0 — 2026-06-12 — ▦ Grid placement (line your towers up cleanly)

**What & why.** Newest owner FEEDBACK (commit `3664000`, top of PENDING): *"[Low priority][external
user] It would be cool if the spaces to place the turrets were more of a grid so you could line them up
cleaner."* All current PENDING items are `[Low priority]`, so the routine leaves the choice open — this
is the freshest, most concrete owner signal, so I took it. Tower placement now **snaps to a tidy grid**:
when you go to place a tower, its spot rounds to the centre of a `PLACE_GRID` (32px) cell, so towers form
neat rows/columns instead of landing wherever the cursor happened to be. A **faint grid of slot dots**
fades in while you're placing (only when snapping is on) so you can see the alignment, and the placement
preview ring sits exactly where the tower will land.

**Sizing rationale.** `PLACE_GRID === 32`, which is exactly the existing minimum placement gap (`canPlace`
forbids towers `< 32` apart). So cells in adjacent rows/columns are exactly 32 apart and **stay buildable** —
you can still pack a clean solid wall of towers; the grid only tidies *where* each one sits. Cell centres are
`floor(v/32)*32 + 16`, so the nearest cell-centre to the cursor.

**Opt-out.** A new **▦ Grid snap** row in ⚙ Settings (default **On**, per the owner's request) toggles it;
`setGridSnap()` persists `cd_gridsnap` (`'1'`/`'0'`) on the device, mirroring the other Settings prefs.
With it **Off**, placement is byte-identical to before (free-hand at the raw cursor point).

**Scope / safety.** Selection still uses the **raw** cursor (you click *on* a tower to open its panel); only
the placement *target* snaps. Towers store their resolved `x`/`y` as before, so save/resume is unaffected and
no migration is needed (the toggle is a device pref like `cd_shake`/`cd_colorblind`, not run state). Purely a
placement-feel change — **no damage/economy/balance/save impact**.

- **Files:** `cd-core.js` (`gridSnap` global + `PLACE_GRID`/`snapGridCoord()`/`placeCoord()` helpers, version
  bump + changelog entry), `cd-game.js` (pointerdown places at `placeCoord(mouseX,mouseY)`), `cd-render.js`
  (ghost + range ring snap; faint slot-dot overlay while placing), `cd-update.js` (`setGridSnap()` + Settings row).
- **Tests:** new group **[43]** (helpers exist; off-centre tap lands on the cell centre; tower sits exactly on a
  grid node; snap-OFF places at the raw point; `setGridSnap` persists; adjacent grid cells stay buildable).
  Group [34] (touch/pointer) sets `gridSnap=false` so it keeps asserting exact pointer placement. **356/0 green.**
  Verified in-preview: snap math, grid-overlay `draw()` clean, toggle persists, zero console errors.

## v1.23.0 — 2026-06-12 — 🎇 New tower: Mortar (long-range armor-ignoring siege)

**What & why.** ROADMAP "Next up (high value) → New tower: arc/chain or mortar — a 7th/8th tower with
a distinct role" (the top unchecked high-value item). Added the **Mortar** (🎇), the 8th tower: a
**long-range, slow-firing lobbed AoE that completely ignores enemy armor**. It fills a clear gap —
a dedicated siege/anti-armor piece distinct from the Cannon (mid-range, faster, armor-respecting
direct splash) and Sniper (single-target). Its niche is the heavily-armored crowd (shield/tank/boss),
which normally shrugs off part of every hit; the Mortar lands full damage on them from across the board.

**Balance stance (re: recurring "too easy" feedback).** Deliberately a **side-grade, not power creep**.
Stats: cost 175, range 225, dmg 28, rate 2.0 → ~14 DPS — *lower* than the Cannon's ~22 DPS, so against
ordinary unarmored enemies a Cannon still out-damages it. The Mortar only pulls ahead on armored targets
(where it bypasses the reduction). The slow reload is the balancing lever — it favours heavy single shots
over sustained fire. No existing number changed (new content, not a swing), so it stays inside the
≤25%/number guardrail trivially.

**How.**
- `cd-defs.js`: `TOWER_TYPES.mortar` (proj `'mortar'`); `SPECS.mortar` = **Demolisher** (+35% dmg) /
  **Saturation** (+55% blast radius); `TALENTS.mastery_mortar` (+6% dmg & +2% range/rank, like the other
  per-tower masteries — auto-wires via `effDmg`/`effRange`'s `mastery_<type>` lookup).
- `cd-game.js` `effDmg()`: Demolisher `+35%` (`t.spec === 'demo'`).
- `cd-update.js`: firing sets `ignoreArmor: … || t.type === 'mortar'` and a slow lob speed (200 vs bomb 260);
  new `hitEnemy` branch — armor-ignoring blast (radius 46 × Saturation 1.55 × `splashMult`), sandy burst +
  reused boom; `SFX.mortar()` launch sound.
- `cd-render.js`: heavy shells (`bomb`|`mortar`) draw the chunkier trail/orb.
- `cd-core.js`: `SFX.mortar()` (hollow tube thunk + rising whistle; impact reuses `bomb()`).
- `tower-defense.html`: hotkey hint `1–7` → `1–8` (shop/hotkeys/placement/spec/save all auto-generate
  from `TYPE_KEYS`/`TOWER_TYPES`).

**Save-safe.** Fully additive — `loadRun()` rebuilds any tower generically from `TOWER_TYPES[type]` and skips
unknown types, `loadMeta()` defaults the new `mastery_mortar` talent to 0. An old save with no Mortar loads
byte-identically.

**Tests.** New group **[42]** — definition/specs/mastery wired, Mortar button auto-renders in the shop,
Demolisher = +35% via `effDmg`, blast ignores armor (full dmg vs an armored target vs a reduced bullet),
AoE hits a cluster, `SFX.mortar` exists, and a placed Mortar (level/spec/mode) save→resume round-trips.

## v1.22.0 — 2026-06-12 — 🩸 New legendary perk: Last Stand (comeback damage)

**What & why.** ROADMAP "Content & variety → A secret / easter-egg legendary perk with a quirky
effect (owner likes surprises)." Added **Last Stand** (🩸, legendary): ALL towers deal **+3% damage
per life lost this run, capped at +60%** (reached at 20 lives lost). It's a deliberate rubber-band —
a flawless run gets **+0%**, so it can only ever help a *struggling* player. That makes it the
safest possible power perk against the owner's recurring **"game is too easy"** feedback: it cannot
make an already-dominant run any stronger, it only softens a near-loss into a rally.

**How.**
- `PERKS` gains the entry (`id:'laststand'`, legendary tier) in `cd-defs.js`; `freshPerkState()`
  gains `lastStand:false` and a `livesLost:0` counter.
- The leak site in `cd-update.js` (`lives -= dmgLives`) now also does `perkState.livesLost += dmgLives`
  (boss leaks count their full 5), so the counter is always maintained whether or not the perk is held.
- `effDmg()` in `cd-game.js` applies `d *= 1 + Math.min(0.6, 0.03 * perkState.livesLost)` when
  `perkState.lastStand`. Because `upgradeKey()` already hashes `effDmg`, the upgrade panel live-updates
  if a life leaks while it's open; the board perk tooltip works automatically (looked up from `PERKS`).

**Balance.** Conditional by design. A leak (1 life) → +3%; a boss breakthrough (5 lives) → +15%;
cap +60% at 20 lives lost. Compare the unconditional Diamond Core (+30%). Sim (Last Stand held,
gunner base 10 dmg): 0 lives lost → ×1.00 (10.0); 5 lost → ×1.15 (11.5); 20+ lost → ×1.60 (16.0,
capped). No effect on a clean run.

**Save-safe.** The two new fields live inside `perkState`, which is persisted whole and restored via
`Object.assign(freshPerkState(), s.perkState)` — old saves default to `lastStand:false`/`livesLost:0`.
A run that drafts Last Stand keeps its life-loss tally across save/resume.

**Tests.** New group `[41]` (perk applies the flag; damage scales with `livesLost` and hits the +60%
cap; a clean run gets ×1.0; save→reload round-trips the perk + counter). Cosmetic/board tooltip and
draft a11y inherited from the existing perk infrastructure.

## v1.21.0 — 2026-06-12 — 🔮 Wave preview with per-kind counts

**What & why.** ROADMAP "Game feel / polish → Wave preview — show the composition of the next
wave (icons) so players can plan purchases." The between-waves bottom-left preview already listed
the *kinds* present in the next wave as text (`Next: 18 enemies · fast · tanks · healers · BOSS ☠`),
but gave **no counts** — the actual planning info (how many tanks? is there a boss?). This run turns
that text line into a glanceable **icon roster**: a colour disc per enemy kind + `×count`, e.g.
`Next: ● ×13  » ×3  ◆ ×4  + ×2  🛡 ×2  ✂ ×2  👻 ×5` (boss appended as `☠ ×1` on every 5th wave).

**How.**
- `cd-game.js`: replaced the text-only `waveDesc(w)` (its only consumer was the preview) with
  `waveComposition(w)` — a **deterministic** tally that returns ordered `{kind,count}` entries by
  replaying buildWave()'s exact modular kind-assignment (norm → fast → tank → heal → shield → split
  → phantom, boss last on multiples of 5). It mirrors `buildWave()` with a `KEEP IN SYNC` comment;
  test [40] asserts the two agree at waves 3/7/9/11/13/15/20/25.
- `cd-render.js`: a new `PREVIEW_COLOR` map (kind → sphere colour, synced with buildWave) + the
  preview render block draws a small filled disc per kind (boss slightly bigger), overlays the
  **same** `enemyGlyph()` symbol the sphere uses (single source of truth — honours the colourblind
  aid; boss/heal/shield/split/phantom always coded), then the `×count`. Bosses are tinted red.
- Width: ≤8 entries ends near logical x≈374 — well clear of the bottom-right combo meter (x>750)
  and inside the 900-wide board; no overflow. The mayhem "world will shift" note still sits above it.

**Scope / safety.** Purely render + one deterministic helper. No gameplay, economy, balance or save
impact; no new localStorage keys. Desktop and mobile unaffected beyond the richer preview.

**Tests.** New group [40] (composition matches buildWave at 8 waves; norm-first/boss-last ordering;
boss only on ×5 waves; every kind has a preview colour; w15 totals 34; `draw()` renders the
preview state with zero console errors). Verified in-preview: `waveComposition(14)/(15)` exact,
preview pixels drawn in the bottom-left strip (rightmost logical x≈374, no clipping), console clean.

## v1.20.2 — 2026-06-12 — 🩺 Health check

**Every-6th-run maintenance pass** (5 version entries since the v1.16.4 health check: v1.17.0,
v1.18.0, v1.19.0, v1.20.0, v1.20.1). Ships no new feature — confirms the project is still healthy
and the docs still match the code. Both pending FEEDBACK items are "[Low priority]" (neither is a
`[bug]`), so they did not override the health check.

**1. Refactor audit.** All eight game files comfortably within the ~1500-line cap — counts:
cd-update.js 637, cd-render.js 534, cd-game.js 517, cd-core.js 330, cd-defs.js 305, cd-maps.js 190,
cd-state.js 151; plus tower-defense.css 407, tower-defense.html 137. No file near the cap, no dead
code or out-of-domain functions found. The booster taper still lives in three sites
(`upgradeTower`/`ascendTowers`/`loadRun` rebuild) by design, each with a "keep in sync" comment —
intentional, not drift. **No `[refactor]` items needed.**

**2. Docs coherence.** Re-verified the key CLAUDE.md formulas against the code — all matched:
booster aura range `TOWER_TYPES.buff.range = 68` (v1.20.1), enemy-HP
`(18 + w*7 + 1.25·w^1.9)·1.80·d.hp·campScale`, booster taper `0.25 + 0.08·(lvl-1)` (and `+= 0.08`
at both upgrade sites), and poison DoT coefficient `2.6`. `GAME_VERSION` matched the latest
CHANGELOG heading (was v1.20.1). No doc drift found this pass; ROADMAP table-stakes audit note
refreshed to v1.20.2; vetoed section intact (still none recorded).

**3. Table-stakes audit.** Walked the polished-browser-game list. Keyboard accessibility is now
**complete** (start-screen menus v1.19.0 + the mid-game draft v1.20.0), joining reduced-motion,
colourblind aid, high-DPI canvas, volume slider, responsive/mobile layout and touch/pointer
controls. Still-open, unchanged: **gamepad support** and **PWA install (offline manifest)**, plus
the optional *bigger HTML tap targets on small phones* — all already logged in ROADMAP, none
regressed. **Strongest pick for the next normal run: gamepad support.** No new gaps found.

**4. Integrity spot-checks.** Full suite **320/0 green** (39 groups), zero console errors.
Old-format save migration verified live: a minimal old `cd_meta` (chips + talents only) loaded with
`achievements`/`stats` defaulted (`bestCombo` → 0) and talents preserved, and an old `cd_save` with
no `mapTheme`/`lastSettledWave` restored cleanly (towers rebuilt with full `dmg`/`range` stats,
`mapTheme` resolved to a valid key, `livesLostThisRun` forced true). Double-click `file://` play
re-verified (classic `<script src>` load order, no ES modules, inline SVG favicon). Test data
cleaned up afterwards.

**Flaky test fixed (small, safe).** Test group **[32] Economy trim** intermittently failed: it
asserted a tight upper bound (`< 2900`) on the **10-wave** gold bank, but the harness auto-picks
draft card `[0]` at waves 5 and 10 and the draft is **random** — a gold perk (interest/Midas/bounty)
in slot 0 inflated the bank (measured 2613 typical, but 3013 on the failing run). The deterministic
bounty-formula checks already prove the trim is wired; the war-chest bound was the only RNG-sensitive
part. Fixed by asserting on the **pre-draft economy** instead — gold the instant the first draft
opens (end of wave 5, before any perk), which is RNG-free and is exactly what the economy trim
affects: measured a perfectly stable **875** across 6 runs vs the old pre-trim **≈1003** (the
documented ~−13% trim). New checks: `pre-draft economy trimmed below the old baseline` (`< 950`) and
`> 700`; the 10-wave total keeps only its loose `> 1500` floor (no flaky upper bound). Test-only
change — no game code, balance or save impact.

**Version bump:** v1.20.1 → **v1.20.2** (patch). This resets the 5-run health-check counter.

## v1.20.1 — 2026-06-12 — Booster aura-range cut, slice 1 (FEEDBACK balance)

**What & why.** FEEDBACK PENDING item #1 (owner, low priority): *"Reduce the range of booster by 50%
base."* The Booster's aura range is the radius within which it grants its +25% damage buff (`effBuffRange`
in `cd-game.js`, keyed off `TOWER_TYPES.buff.range`). At 90 it covered a large patch of board, letting
one booster blanket an entire defense — a contributor to the owner's separate *"single gunner + maxed
booster carries campaign-6-hard"* complaint, since the booster's reach is what makes a one-tower build
viable. Cutting it forces more deliberate placement (or a second booster for spread defenses).

**Guardrail note — sliced.** The owner asked for −50% (90→45), but the project guardrail caps any single
balance number at ~25%/run. Per the routine's big-FEEDBACK-item rule I shipped the **first coherent
slice** this run: base range **90 → 68** (−24.4%, inside the cap). The remaining reduction toward the full
−50% continues over the next couple of runs (noted at the top of FEEDBACK PENDING).

**What changed.** One number: `TOWER_TYPES.buff.range` `90 → 68` (`cd-defs.js`). Everything downstream
follows automatically — fresh placement (`cd-game.js`) and resume rebuild (`cd-state.js`) both read
`def.range`, the Network spec still multiplies it ×1.5, and Booster Mastery still adds +2%/rank, all off
the smaller base.

**Simulation / evidence.** Aura *area* shrinks to `(68/90)² ≈ 0.57` of before — about **−43% coverage**.
A tower 80px from a booster (inside the old 90 radius, outside the new 68) is **no longer buffed**; one at
50px still is — both asserted in the new test. A maxed Network booster goes 135→102 radius; plain
goes 90→68.

**No save/economy-schema impact.** No new localStorage keys, no migration needed — a resumed booster
simply rebuilds with the new radius. New **test group [39]** (base value, plain/Network aura range,
buffed/un-buffed at the boundary). Full suite **319/0** green, zero console errors.

## v1.20.0 — 2026-06-12 — Draft (perk picker) keyboard accessibility (table-stakes, ROADMAP)

**What & why.** Direct follow-up to v1.19.0 (flagged twice in ROADMAP: the Table-stakes summary and
the Menu-a11y item's own follow-up note). v1.19.0 made every **start-screen** panel keyboard-navigable
but left one gap: the **mid-game perk draft** — the "⭐ Choose an upgrade" modal that pops up every 5
waves — was the last mouse-only menu. Its three perk cards are plain `<div>`s with an `onclick`, so a
keyboard or screen-reader player could not pick a perk without a mouse, even though the rest of the
in-game flow has rich hotkeys. The draft is a **forced** modal (the game is paused until you choose),
so it's exactly where being mouse-trapped hurts most.

**What changed.** Each draft card is now keyboard-operable (`openDraft()` in `cd-defs.js`):
- **Cards are focusable + operable**: `tabIndex = 0`, `role="button"`, and an `aria-label`
  (`"{rarity} — {name}: {desc}"`) so screen readers announce each option. **Enter or Space picks** the
  card (`onkeydown` → `pickPerk`). The handler calls `stopPropagation()` so Space doesn't also reach the
  in-game `keydown` (which would otherwise `startWave()` the instant the pick closes the modal).
- **Focus lands on the first card** when the draft opens, so a keyboard user is immediately on a choice.
- **Tab is trapped inside the draft** (wraps last→first / Shift+Tab first→last). Reused the v1.19.0
  trap: `_topTrapPanel()` in `cd-core.js` now returns `#draftModal` when it's open. The draft stays
  **deliberately absent from `A11Y_PANELS`**, so the Esc handler still can't close it — a pick is
  required (unchanged behaviour).
- **Visible focus ring** via a `.perkCard:focus-visible` CSS rule: the focused card lifts (same as the
  mouse-hover affordance) and shows the blue keyboard outline; hidden for mouse clicks.
- **Screen-reader role**: `#draftModal` now carries `role="dialog" aria-modal="true" aria-label`.

**No save/economy/gameplay impact.** Pure DOM/UX: no new localStorage keys, no balance numbers, no
schema change, the perks/draft odds themselves untouched. Mouse-click picking is byte-identical.

**Tests.** New group **[38]** (8 checks): the draft opens with ≥2 focusable `role=button` cards;
opening it moves focus onto the first card; Tab/Shift+Tab wrap inside the draft (trap); **Esc does NOT
close it** (a pick is required); the modal is `role=dialog`/`aria-modal=true`; **Enter** on a focused
card picks it (closes the modal, applies exactly one perk); zero console errors. Suite **313/0** green.

## v1.19.0 — 2026-06-12 — Menu keyboard accessibility (table-stakes, ROADMAP)

**What & why.** The strongest open accessibility / table-stakes item (flagged in the v1.16.4
health-check audit and the ROADMAP table-stakes summary as the next normal-run pick): in-game play
has rich hotkeys, but the **start-screen panels were mouse-only** — no Esc-to-close, no focus
management, no visible keyboard focus, no screen-reader roles. A keyboard or screen-reader user
could open Talents/Achievements/Records/Settings/What's New but then had to mouse over to the "Done"
button, and Tab would wander off into the dimmed page behind the modal.

**What changed.** A small a11y layer in `cd-core.js` (loads first, so its helpers are global):
- **Esc closes the open panel.** A document-level `keydown` listener finds the highest-priority open
  panel (`A11Y_PANELS`: the four modal overlays first, then the non-modal What's New rail) and closes
  it — a modal takes priority over the rail, so one Esc closes the modal and a second closes the rail.
  The draft modal is deliberately NOT Esc-closable (you must pick a perk).
- **Focus moves into a panel on open and back to the opener on close.** `focusPanel(id)` (called from
  each `open*()` in `cd-defs.js`/`cd-update.js`) remembers the triggering button, then focuses the
  panel's first control; `_restoreOpenerFocus()` returns focus on Esc-close.
- **Tab is trapped inside the open modal** so focus can't escape to the page behind (wraps last→first
  and Shift+Tab first→last).
- **Visible focus ring** via a single `:focus-visible` CSS rule (blue outline) — shows for keyboard
  users, stays hidden for mouse clicks.
- **Screen-reader roles**: the four modal panels carry `role="dialog" aria-modal="true" aria-label`.

**Robustness note.** Panel-open detection uses `getComputedStyle(el).display`, NOT `offsetParent` —
the latter is `null` for the `position:fixed` panels of the ≤920px mobile layout, which would have
made Esc silently no-op on phones. Verified the focus-trap + Esc still work under the fixed layout
(focusable controls of a fixed panel keep a non-null `offsetParent` via the positioned ancestor).

**No save/economy/gameplay impact.** Pure DOM/UX: no new localStorage keys, no balance numbers, no
schema change. The in-game Esc (cancel ability targeting) is untouched — it lives behind a `!started`
guard and panels are start-screen-only, so there's no conflict.

**Tests.** New group **[37]** (11 checks): opening a panel moves focus inside it; Esc closes the
modal and restores focus to the opener button; the settings panel exposes ≥2 distinct focusables;
Tab/Shift+Tab wrap (trap); a modal takes Esc priority over the What's New rail and a second Esc
closes the rail; the four modal panels are `role=dialog`/`aria-modal=true`; a `:focus-visible` rule
exists in the shipped CSS (asserted from disk in Node — the harness runs over `file://`, where
in-page `fetch` and CSSOM `.cssRules` are both blocked cross-origin). Suite **305/0** green; verified
in-preview (incl. the fixed-position mobile layout) with zero console errors.

## v1.18.0 — 2026-06-12 — Colorblind aid: shape-coded enemy kinds (table-stakes, ROADMAP)

**What & why.** The top open accessibility / table-stakes item (flagged in the v1.16.4 health-check
audit as the "strongest next pick"): enemy kinds lean on **hue** to be told apart. Most kinds
already carry a symbol (`+` heal, `🛡` shield, `✂` split, `👻` phantom, `☠` boss, `❄` frozen),
but **fast** and **tank** were distinguished by **colour alone** (purple `#d2a8ff` vs orange
`#f0883e`) — exactly the green/orange/purple axis that protan/deutan colourblind players struggle
with. A new **♿ Colorblind aid** toggle in ⚙ Settings shape-codes them too: `»` for fast, `◆` for
tank, so every enemy kind reads as a unique glyph rather than a colour.

**How (self-contained, save-safe, no gameplay impact).**
- `cd-core.js`: new `colorblindAid` pref, `localStorage.getItem('cd_colorblind') === '1'` (default
  **OFF**). One additive key, read with a default — old saves unaffected.
- `cd-render.js`: extracted the enemy-glyph decision into a single pure helper `enemyGlyph(e)`
  (frozen → `❄`; heal/shield/split/phantom/boss always coded; **fast/tank coded only when the aid
  is on**; norm stays glyphless as the baseline). A `GLYPH_FONT` map preserves each existing
  glyph's exact font + offset, so with the aid **off** the rendering is **byte-identical** to
  before (verified by the guardrail review). `draw()` now calls the helper.
- `cd-update.js`: `setColorblind(on)` setter (persists `cd_colorblind`, re-renders) + a
  `♿ Colorblind aid On/Off` row in `renderSettings()`, plus a legend line listing every symbol
  when the aid is on.

**Tests.** New group **[36]**: restore-on-load from `cd_colorblind='1'`; aid ON → fast=`»`/tank=`◆`
and all kinds distinct; norm stays empty; always-coded kinds keep their glyphs; frozen overrides
kind; aid OFF → fast/tank lose the glyph (others unchanged); `setColorblind` persists `0`/`1`;
Settings renders the row + legend; `draw()` clean with the aid on and live enemies. Suite **294/0**
green. Verified in-preview at v1.18.0: default off, glyphs correct, a 2-second live wave with the
aid on renders with zero console errors.

## v1.17.0 — 2026-06-12 — High-DPI canvas scaling (table-stakes, ROADMAP)

**What & why.** The strongest open table-stakes item (flagged in the v1.16.4 health-check
audit): the canvas was a fixed 900×560 backing store, so on Retina / 4K / 150%-scaled Windows
displays the browser upsamples it and towers/text/enemies render slightly soft. Now the backing
store is sized to `W·dpr × H·dpr` (dpr capped at 2) and the 2D context is scaled once at
load, so every existing draw call keeps using logical `0..900 / 0..560` coords while the pixels
are crisp.

**How (self-contained, save-safe, no gameplay impact).**
- `cd-core.js`: `W`/`H` are captured from the canvas attributes (900×560) **before** any resize,
  so they stay the logical coordinate space regardless of dpr. A new `DPR = clamp(devicePixelRatio,1,2)`
  guards `if (DPR > 1) { cv.width = W·DPR; cv.height = H·DPR; ctx.scale(DPR,DPR); }`. The scale
  persists across frames — `draw()` wraps everything in `ctx.save()/restore()` and never resets
  the transform, so the base scale is preserved. At **dpr=1 the block is skipped entirely**, so
  standard displays (and the headless test harness) are byte-identical.
- `tower-defense.css`: the `canvas` rule gains `width: 900px` so the **displayed** box stays the
  logical size even when the backing store doubles (`height:auto` keeps the 900:560 ratio,
  `max-width` still scales it on phones, and the landscape `#game { width:auto }` rule overrides it
  for the height-bound landscape layout).
- **Input unaffected:** pointer/click coords are derived from `getBoundingClientRect()`, which
  reflects the displayed CSS box (still 900-logical), not the backing store.

**Tests.** New group **[35]**: a 1× page (backing store stays 900×560, transform unscaled) and a
real `deviceScaleFactor: 2` context (backing store 1800×1120, context `a=d=2`, CSS box still
`900px`, logical `W/H` untouched, a 3-wave run drives without throwing). Suite **283/0** green.
Verified in-preview: v1.17.0 loads, a 10-second update+draw run produces no console errors.

## v1.16.4 — 2026-06-12 — 🩺 Health check

**Every-6th-run maintenance pass** (5 version entries since the v1.14.1 health check: v1.15.0,
v1.16.0, v1.16.1, v1.16.2, v1.16.3). Ships no new feature — confirms the project is still
healthy and the docs still match the code. The pending FEEDBACK item is "[Low priority]" (not a
`[bug]`), so it did not override the health check.

**1. Refactor audit.** All eight game files are comfortably within the ~1500-line cap — line
counts: cd-update.js 656, cd-render.js 533, cd-game.js 527, cd-defs.js 300, cd-core.js 240,
cd-maps.js 196, cd-state.js 156; plus tower-defense.css 393, tower-defense.html 138. No file is
near the cap, no dead code or out-of-domain functions found. The booster-aura taper appears in
three sites (`upgradeTower`/`ascendTowers`/`loadRun` rebuild) by design — each carries a
"keep in sync" comment, so it's intentional duplication, not drift. **No `[refactor]` items
needed.**

**2. Docs coherence.** Re-verified the key CLAUDE.md formulas against the code — all matched:
enemy-HP `(18 + w*7 + 1.25·w^1.9)·1.80·d.hp·campScale`, per-kill bounty `max(2, round((3+w·0.6)·d.bounty))`,
wave-clear bonus `(20 + w·4)·…`, booster taper `0.25 + 0.08·(lvl-1)` (and `+= 0.08` at both
upgrade sites), the `computeScore()` term list + `effMult = 1 + max(0,10−nt)·0.03`, and the
touch select radius `coarsePointer() ? 30 : 18`. `GAME_VERSION` matched the latest CHANGELOG
heading (was v1.16.3). **One drift fixed:** `index.html` (the GitHub Pages root → `tower-defense.html`
redirect, added in the public-release commit, plus the static-deploy workflow that bundles it) was
undocumented in CLAUDE.md — now described in the intro. ROADMAP table-stakes audit note refreshed
to v1.16.4; vetoed section intact (still none recorded).

**3. Table-stakes audit.** Walked the polished-browser-game list. Still-open, unchanged since the
v1.15.0/v1.16.3 mobile work: **colourblind-safe palette**, **gamepad**, **PWA install**,
**high-DPI canvas**, **menu keyboard a11y** — all already logged in ROADMAP, none regressed, none
newly closed. Flagged high-DPI canvas scaling or the colourblind palette as the strongest pick for
the next normal run. No new gaps found.

**4. Integrity spot-checks.** Full suite **272/0 green** (34 groups), zero console errors. Page
loads with all globals present (`GAME_VERSION`/`beginGame`/`loadMeta`/`coarsePointer`/`computeScore`).
Old-format save migration verified live: a minimal old `cd_meta` (chips + talents only) loaded with
`achievements`/`stats` defaulted (`bestCombo` → 0), and an old `cd_save` with no `mapTheme`/`lastSettledWave`
restored cleanly (`mapTheme` → `circuit` default, towers rebuilt). Test data cleaned up afterwards.

**Version bump:** v1.16.3 → **v1.16.4** (patch). This resets the 5-run health-check counter.

## v1.16.3 — 2026-06-12 — Touch / pointer controls: make tapping the board reliable on phones (ROADMAP table-stakes)

**Why:** Mobile has been the owner's recurring theme (v1.14.0 layout, v1.15.0 board-sizing). The
remaining gap — flagged on ROADMAP as *"the top remaining mobile gap"* — was **in-game touch
ergonomics**: tower placement / selection / ability targeting all ran through the canvas `click`
handler with a fixed **18px logical** hit radius. On a phone the 900-logical board scales to
~374px, so 18px logical ≈ **7px on screen** — towers were genuinely hard to tap — and the action
waited on the browser's synthesized click (a fractional delay on some mobile browsers).

**Change (input layer only — no gameplay/economy/save impact):**
- New `coarsePointer()` helper in `cd-core.js` (mirrors `reduceMotion()`): reads
  `matchMedia('(pointer: coarse)')` live, guarded for no-`matchMedia` envs.
- The canvas board handler moved from `click` → **`pointerdown`** (`cd-game.js`): one path unifies
  mouse + touch, reacts on press (snappier), and sidesteps the synthesized-click latency. Guarded
  to the **primary button** (`e.button > 0` returns) so right/middle clicks don't place towers,
  matching the old click-only behaviour.
- **Bigger tap target on a finger:** the tower-select radius is now **30px on coarse pointers**
  (18px on a mouse — desktop unchanged). 30 < the 32px forbidden-placement gap, so the generous
  radius can never steal a tap meant to place a tower beside an existing one.
- `touch-action: none` on the canvas (`tower-defense.css`) so board taps place/aim instead of
  scrolling or pinch-zooming the page out from under you.

**Tests:** new group **[34]** — asserts the helper exists, `touch-action:none`, a real
`pointerdown` places a tower at the exact tapped point, tap-to-select opens the upgrade panel, the
coarse-radius (25px-off selects) vs fine-radius (25px-off does not) split, and that a non-primary
button is ignored. Full suite **272/0** green, zero console errors. Verified in-preview: a
dispatched `pointerdown` placed a tower at the tap point, the wave ran and the tower scored a
kill, no console errors.

**Remaining mobile follow-up:** even bigger HTML tap targets (shop/upgrade buttons) if the owner
wants them; this run covers the canvas-interaction half (placement / selection / ability aim).

## v1.16.2 — 2026-06-12 — Booster aura taper: cool the maxed-booster solo-carry (FEEDBACK balance)

**Owner FEEDBACK (PENDING, "still too easy"):** *"campaign 6 on hard can be completed with a
single gunner and booster at max level (only losing 5 hp to the final boss)."* v1.16.1 took the
**economy** half ("money from the first 10 rounds"); this run takes the **tower-power** half —
the *single maxed booster carries the whole run* outlier the owner and ROADMAP ("Frost/booster
damage snowball") both flag. The booster aura's per-level scaling was the snowball lever.

**Change (one number, `+0.1 → +0.08` per level — a −20% trim to the increment, ≤25% guardrail):**
- The booster's `buffPower` grew `+0.1`/level off a `0.25` base → **+75% aura damage at L6**. Now
  it grows **`+0.08`/level → +65% at L6**. Base (L1, +25%) is **unchanged** — the trim only kicks
  in as you sink levels into one booster, so it bites the maxed solo-carry, not casual aura use.
- Synced across all three sites so resume parity holds: `upgradeTower` (`cd-game.js`),
  `ascendTowers`/Ascension perk (`cd-defs.js`), and the `loadRun` rebuild formula
  `0.25 + 0.08*(lvl-1)` (`cd-state.js`).

**Effect (re-simulated in-engine, classic-normal):** a buffed gunner's damage drops
**14.0 → 13.2 (−5.7%)** with an L6 booster and **13.2 → 12.56 (−4.8%)** at the L5 base cap; a
low-level booster is byte-identical. The nerf grows with booster level — exactly the snowball
shape — and never approaches the guardrail. Deliberately modest so it doesn't gut a real
multi-tower build (ROADMAP: "Don't gut any single build").

**Save-safe:** the live-upgrade increment and the `loadRun` rebuild both use `0.08`, so a resumed
booster has identical power to a freshly-leveled one; old `cd_save` entries still load (power is
recomputed from `level`, no schema change). **Tests:** new group **[33]** asserts the `+0.08`
increment, the `0.25 + 0.08*(lvl-1)` ramp, that the maxed aura now sits below the old `+0.1` ramp,
and a save→reload round-trip parity (resumed booster keeps the tapered power). Suite **264/0**.

## v1.16.1 — 2026-06-12 — Economy trim: cool the front-loaded gold snowball (FEEDBACK balance)

**Owner FEEDBACK (PENDING, "still too easy"):** *"I'm able to clear classic-normal with money
I got from the first 10 rounds."* This run takes the first iterative slice at the **economy**
root the owner and ROADMAP both point at (HP has been bumped repeatedly; the gap is that you
out-*economy* the difficulty and over-build).

**What I measured first (real in-game sim, classic-normal, god towers, clean play to wave 10):**
- War chest banked by wave 10 ≈ **2950 gold** — enough to field a full army.
- Source breakdown over waves 1–10: **kill bounty ≈ 1838 (69%)**, wave-clear bonus 525 (20%),
  interest 175 (7%), start 120. So the snowball is mostly *bounty*, then the *clear bonus*.

**Change (two front-loaded sources, each ≤20% — inside the ≤25%/number guardrail):**
- **Per-kill bounty** `(4 + w*0.6)` → `(3 + w*0.6)` (cut the flat term, kept the slope). Front-
  loaded: **−20% at w1**, fading to ~−10% by w10 and ~−6% by w20 — it bites in the early
  over-build window but barely touches deep endless. Specials/boss bounty scale off this, so the
  trim propagates proportionally. (`cd-game.js` `enemyTemplate`.)
- **Wave-clear bonus** `(25 + w*5)` → `(20 + w*4)` — a flat ~20% cut to the second-largest early
  source. (`cd-game.js` `endWave`.)

**Effect (re-simulated, analytic + harness):** wave-10 war chest **2658 → 2312 (−13%)** on the
no-draft baseline (bounty 1838→1613, passive 700→579). You can no longer quite afford a full army
off the opening rounds. Talent-chip economy is untouched (`chipsForRun`), and per-difficulty
`d.bounty` ratios (easy 1.15 / normal 1 / hard 0.9) preserve relative difficulty.

**Save-safe:** pure in-run number tweaks; no schema/key changes. **Tests:** new group **[32]**
asserts the trimmed bounty formula at waves 1/5/10/20, that the cut is front-loaded and ≤25%, and
that a real 10-wave god-tower run banks below the old baseline while staying a meaningful bank.

## v1.16.0 — 2026-06-11 — End-of-run scoring + restyled victory/defeat screen (FEEDBACK)

**Owner FEEDBACK (two low-priority items, same area, done together):**
1. *"A scoring system for the final victory/defeat screen. Based on stuff like kill time,
   remaining gold, using fewer towers, etc."*
2. *"The victory screen is getting a bit overwhelming. I think it just needs to be restyled."*

Both touch the same surface — the `#overlay` end screen — so they shipped as one run.

**Scoring.** New `computeScore()` (`cd-update.js`) turns each finished run into one number:
`(wave×100 + kills×5 + lives×120 + gold + bestCombo×25 + campLevel×200[campaign] + 2500[victory])
× difficulty × efficiency`, where **difficulty** reuses `DIFFS[diffKey].chipMult` (easy ×0.5 ·
normal ×1 · hard ×1.6) and **efficiency** is `1 + max(0, 10−towers)×0.03` — clearing with ≤10
towers is worth up to **+30%**, directly honouring the owner's "using fewer towers" and
"remaining gold" cues. `scoreGrade()` assigns a letter from how much of `victoryWave()` was
reached: **S** = flawless win (no life lost), **A** = any win, **B/C/D** at ≥75/50/25 % of the
goal, **F** below. An all-time best is tracked in a new additive `cd_bestscore` key (read with
`|| 0`, `try/catch` write — old saves unaffected) with a ★ "New best score!" celebration.

**Restyle.** The old single run-on `#ovText` paragraph (survival line + chips + MVPs + perks +
achievements crammed into one `white-space:pre-line` blob — the "overwhelming" complaint) is
replaced by a structured `renderEndScreen()`: a **score hero** (grade badge + big number +
best), a **one-line headline**, a **stats grid** (🌊 waves · 💥 kills · ❤️ lives · 🪙 gold ·
🔥 combo · 🗼 towers), and **MVP / perks / achievement** lines as their own styled sections.

Purely cosmetic + one additive key — no economy, balance, or save-schema impact (`computeScore`
only *reads* run state). New CSS is scoped to `#ovScore`/`#ovDetails`/`.scoreGrid`/`.ovSection`;
the overlay gains a `.scored` class to reveal the hero. **Tests:** new group **[31]** drives a
defeat run (asserts the documented formula, grade D at 40 % of goal, the 6-cell grid, `.scored`,
`cd_bestscore` persistence + new-best flag) and a flawless victory (grade S, higher score beats
the best); the existing achievement test now reads the unlock line from `#overlay` (it moved out
of `#ovText`). Suite **250/0** green, zero console errors. Verified in-preview at desktop & 375px
mobile (overlay fixed + no horizontal overflow, grid wraps).

## v1.15.0 — 2026-06-11 — Mobile deep-dive #2: bigger board + What's New tucked away (FEEDBACK)

**Owner FEEDBACK (high priority):** *"While the game technically works on phones it doesn't seem
like it's built for it. The What's New is shown behind the game. When you start a game it's tiny.
There are lots of issues with mobile. Take another deep dive."* This is the next slice after the
v1.14.0 layout pass (menus/overlays). Grounded the work in `preview_inspect` measurements at
390×844: the board scales to **374×233px** (the 900:560 board is *width-bound* in portrait, so it
can't get taller there), and the What's New rail was **open by default, full-width at y=643**,
dumping below the fold and burying the board — exactly the two complaints.

**Two fixes (CSS media queries + minimal JS; desktop byte-identical, save-safe):**

1. **What's New starts collapsed on phones/tablets (≤920px).** It used to stack full-width *below*
   the board and bury it. `initWhatsNew()` now defaults it **closed** on small screens unless the
   player has explicitly opened it before — tracked by a new additive `cd_wnopen` localStorage key
   (set in `openWhatsNew()`, cleared in `closeWhatsNew()`). On desktop (`matchMedia('(max-width:920px)')`
   is false) the logic collapses to the old `if (wnClosed)` — **unchanged**.
2. **Real landscape layout for a bigger board.** Since portrait is width-bound, the genuine answer to
   "it's tiny" is landscape. A new `@media (max-width:920px) and (orientation:landscape)` block sizes
   the canvas off **viewport height** (`max-height: calc(100vh - 150px)` + `max-width` with auto
   sizing, aspect preserved), compacts the H1/HUD/shop/controls, and hides the hotkey hint. Rotating a
   390-wide phone takes the board from **374×233 → 433×270** (and larger on bigger phones / tablets),
   with the **Start Wave** button still on-screen (verified `controls.bottom ≤ viewport`). A
   portrait-only **"↻ Rotate your phone sideways for a bigger board"** hint (`#rotateHint`, hidden by
   default, shown only in the ≤920px portrait block) points players at it.

**Why CSS-first:** same approach as v1.14.0 — no markup/JS behavior change on desktop, so saves and
desktop rendering are untouched. The canvas click handler already recomputes coords from
`getBoundingClientRect()`, so any rendered size stays click-accurate.

**Tests:** new group **[30]** drives real 390×844 (portrait) and 844×390 (landscape) Playwright
viewports with reloads (the default-collapse is decided at load via `matchMedia`): asserts the rail
starts hidden in portrait, the rotate hint shows, tapping opens + persists the opt-in, the landscape
board is taller than the portrait board, the controls stay on-screen with no horizontal overflow, and
**desktop still opens What's New by default**. Suite **239 passed / 0 failed**, zero console errors.
Verified in-preview at 390×844, 844×390, 880×412, and 1280×860 (desktop unchanged).

**Remaining mobile follow-up:** in-game *touch ergonomics* (bigger tap targets, `pointerdown`/
`touchstart` paths for placement/upgrade/ability targeting) — still mouse-click-driven; tracked under
ROADMAP "Touch / pointer controls".

## v1.14.1 — 2026-06-11 — 🩺 Health check

**Every-6th-run maintenance pass** (5 entries since the v1.13.4 health check: v1.13.5–v1.14.0).
No new gameplay; integrity + direction check. Findings → ROADMAP.

- **Tests:** full suite **230 passed / 0 failed**, zero console errors.
- **Refactor audit:** all nine source files well within the ~1500-line cap (largest is
  `cd-update.js` at 588). A subagent scan found **no dead code, no duplicated logic, no
  commented-out blocks** — every defined function is referenced.
- **Docs coherence:** a subagent diffed CLAUDE.md's documented numbers against the code —
  **zero drift**. Verified: JS load order & file map, poison base dmg 7, enemy-HP formula
  `(18 + w*7 + 1.25*w^1.9) * 1.80 * d.hp * campScale`, `maxTowerLevel = 5 + overdrive`,
  20 talents, 9 achievements, `victoryWave` 14+campLevel/30, `MAX_CONCURRENT_WAVES = 3`,
  `COMBO_WINDOW = 2.0`. `GAME_VERSION` consistent with CHANGELOG. Vetoed section intact.
- **Integrity spot-checks:** `file://` structure sound (classic `<script src>`, **zero**
  `type="module"`, inline SVG favicon, no network). Old-format save migration confirmed:
  a minimal `cd_meta` (no `achievements`/`stats`) gets defaults via `loadMeta()`, and an
  old `cd_save` lacking `mapTheme`/`lastSettledWave` loads via `loadRun()` (mapTheme falls
  back to `circuit`, tower/wave/gold/lives restored).
- **Visual verification (NEW — owner FEEDBACK):** the owner asked that the health check
  confirm the game *looks right and is playable* on both large displays and phones, not
  only via tests. Done this run with the preview tools at **1280×860 (desktop)** and
  **390×844 (phone)**. (`preview_screenshot` times out on this game — the rAF loop keeps
  the page busy and suspending rAF doesn't help — so layout was verified with
  `preview_inspect` bounding-box reads, which are more rigorous for overlap/overflow.)
  Results: **desktop** — no horizontal overflow; start screen + all panels (talents/
  achievements/records/settings) + What's New on-screen and correct; in-game chrome (HUD/
  shop/controls) laid out; a driven wave advanced with no errors. **Phone** — no horizontal
  overflow; all overlays `position:fixed`, full-viewport and scrollable (the v1.14.0 fix
  holds); all menus reachable. **But** it reproduced the two complaints in FEEDBACK item #1:
  (1) **"the game is tiny"** — the canvas scales to **374×233px**, so the live board uses
  only the top ~28% of an 844px-tall phone while the shop/controls/What's-New stack below;
  (2) **"What's New behind the game"** — on phones the rail is open by default and renders
  full-width **below** the board at y≈643 (off-screen, and hidden behind the fixed start
  screen on load). Both logged as precise ROADMAP entries for the next feature run (the
  dedicated mobile deep-dive, FEEDBACK item #1).
- **Process note:** I could not durably codify the visual-check step into the health-check
  routine myself — editing my own scheduled-task instruction file is correctly blocked. The
  exact step the owner can paste into the routine is in ROADMAP under **"Prompt suggestions
  for the owner."** The verification itself was performed this run regardless.

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
