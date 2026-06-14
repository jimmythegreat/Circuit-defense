# Changelog

All notable changes to Circuit Defense. Newest first. Versions are semver-ish:
patch = fixes/balance, minor = features/content.

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
