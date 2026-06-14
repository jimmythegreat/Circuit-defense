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
      start-screen panel and end-of-run unlock toasts. **v1.29.0 added 4 more badges**
      (roster 9→13): 🕊️ Pacifist (ability-free win), 🧩 Specialist (mono-tower win),
      ⚖️ Minimalist (≤5-tower win), 🗓️ Daily Devotee (reach wave 20 in a Daily Challenge).
      Pacifist uses a run-only `abilityUsedThisRun` flag (forced true on resume, like Flawless).
      **v1.47.0 added 📆 Streak Keeper** (7-day daily streak, roster 13→14); **v1.53.0 added
      🧰 Full Arsenal** (win with all 8 tower types on the board, roster 14→15) — completes the
      build-style trio with Specialist (1 type) / Minimalist (≤5 towers), rewarding diversity over
      a mono-tower carry; data-driven, additive, save-safe (`new Set(towers.map(t=>t.type)).size
      === TYPE_KEYS.length`). Test [48]. Follow-ups still open: *toast/sound when a badge unlocks mid-menu*, a
      **speedrun** badge (needs a per-run clock — none exists yet), and a **per-achievement
      chip reward** (would touch the chip economy — needs a balance pass first).
- [x] **Endless-mode leaderboard / personal bests panel** — shipped v1.6.0. A
      🏆 Records start-screen panel shows highest wave per quick-mode map ×
      difficulty (new additive `cd_best_<map>_<diff>` keys), an "Any map" row from
      the legacy per-diff bests, plus campaign progress, lifetime damage, runs and
      chips. Follow-ups: *"new record!" flourish on the end-of-run screen when a
      cell is beaten*, and highlight the player's single all-time best in the grid.
- [x] **New enemy type: "warden"** — shipped **v1.35.0**. A ◈ blue **support** enemy from
      wave 15+ in **all** modes (Classic/Campaign/Mayhem). Projects a 75px protective aura that
      tags nearby enemies `warded` each frame; a warded enemy takes **40% less damage** (`damage()`
      `×0.6`). The timer decays out of range / when the Warden dies, so popping it instantly
      un-shields its cluster — a **target-priority / AoE** decision that raises the skill floor off
      the HP axis (the norm-HP curve is invariant-capped; see Balance). Freeze pauses the aura;
      Wardens never shield themselves/each other (always killable). Run-only fields, no save impact.
      `buildWave`/`waveComposition` (cd-game.js), aura+reduction (cd-update.js), aura/cue rings +
      glyph/colour (cd-render.js). Test [52]. ✅ **targeting-mode follow-up shipped v1.49.0** — a
      🛡 **Support** targeting mode (`pickTarget()` `case 'support'` in cd-update.js; `MODES`/`MODE_ICON`/
      `SUPPORT_KINDS` in cd-defs.js) makes a tower prioritise heal/warden aura enemies (pop the support
      → un-buff the cluster); falls back to 'first' with none in range. Save-safe (mode already round-trips).
      Test [66]. ✅ **Mayhem "warden surge" wave-mod shipped v1.51.0** — 💠 Warden Surge converts
      a fraction of basic enemies (slot `i%4===1`, norm-only) into ◈ Warden escorts so the wave is
      densely shielded; pressures target priority (pop the wardens → un-shield the cluster), pairs with
      the Support targeting mode. Conversion not addition (wave length unchanged), run-only. Test [67].
- [x] **New enemy type: "phantom"** — shipped v1.9.0. Teal blinker from wave 13+;
      teleports 58px forward every ~2s and is intangible (untargetable + immune)
      for 0.35s mid-blink, punishing slow single-target towers. Frost/freeze pauses
      its blink clock. Render-translucent with a 👻 glyph + `SFX.blink` whoosh.
      Test group [14]. Follow-ups: *a phantom-heavy Mayhem wave modifier*, and a
      tower spec tuned to counter blinkers (e.g. predictive lead-shot).
- [x] **New tower: "mortar"** — shipped **v1.23.0**. The 🎇 **Mortar** (8th tower, hotkey 8):
      a long-range (225), slow-firing (rate 2.0), lobbed **AoE that ignores armor** — a back-line
      siege/anti-armor piece distinct from the Cannon (mid-range armor-respecting splash). Deliberately
      a side-grade vs power creep: ~14 DPS (< Cannon's ~22), so it only out-performs on *armored*
      targets — keeping the "too easy" feedback in mind. Specs at L5: **Demolisher** (+35% dmg) /
      **Saturation** (+55% blast radius); plus a **Mortar Mastery** talent (auto-wires via the
      `mastery_<type>` lookup). Save-safe (additive; `loadRun` rebuilds any type generically).
      Test [42]. **Follow-ups:** the **arc/chain** tower is still open (chain-lightning that bounces —
      a swarm counter, distinct from Tesla's fixed chain); and a *visual arc* for the lobbed shell
      (currently homes straight like the bomb) would sell the artillery feel.
- [x] **Daily challenge seed** — shipped **v1.28.0**. A 🗓 **Daily Challenge** start-screen
      button (`beginDaily()`) launches today's date-seeded run: the map path, difficulty
      (normal/hard) and the per-wave Mayhem modifier schedule are all generated from a
      `mulberry32(dailySeedFrom(dailyDateString()))` stream (`setupDaily()` in `cd-maps.js`),
      so every player gets the SAME run today. Plays as a quick-mode Mayhem run (chaos theme +
      mods) but with a **fixed** map (no every-5-waves shift → comparable scores). Own additive
      best key `cd_daily_<YYYYMMDD>` (on the button + Records panel). One-off, not resumable,
      and never touches the player's normal save (`saveRun`/`clearRun` skip when `daily`).
      Offline-safe (local date, no network). Test [47]. **Follow-ups:** *a daily streak counter* ✅
      **shipped v1.31.0** — consecutive calendar days the player finishes a daily (any outcome);
      additive `cd_daily_streak` key, `🔥{n}d` on the Daily button + a Records row, lapses to 0 after
      a missed day (`dailyDayBefore`/`recordDailyStreak`/`currentDailyStreak`, test [50]).
      ✅ **"today's modifiers" preview shipped v1.47.0** — the Daily button now shows today's
      difficulty + wave-mod icons (read-only `dailyPreview()` in cd-maps.js mirrors `setupDaily()`'s
      seeded stream without mutating globals; names in the tooltip). ✅ **streak achievement badge
      shipped v1.47.0** — 📆 Streak Keeper (`daily7`), granted at a 7-day daily streak (roster 13→14);
      `recordDailyStreak()` reordered before `grantAchievements()` so it grants on the day-7 run.
      Test [47] (preview) + [48] (badge). Still open: *a per-day score key* (not just best wave)
      since `computeScore()` already exists.

## Content & variety

- [x] **Per-map visual themes** — shipped v1.13.8 (owner FEEDBACK "all the maps look the
      same"). `THEMES` palette table in `cd-maps.js` drives the background, stars, grid and
      path layers in `draw()`. Classic=blue circuit, Spiral=emerald, Serpent=amber (fixed);
      Campaign rolls a tame palette per attempt; Mayhem uses an animated fiery `chaos`
      palette (static under reduce-motion). Theme key saved/restored for resume parity.
      Test [28]. Follow-ups: *actual ground textures/patterns* (currently solid-colour path
      fills), and *per-theme star density / parallax* for more visual identity.
- [~] **More wave modifiers** for Mayhem. Shipped 2 in **v1.27.0** — **🛡️ Armored Surge**
      (`armored`: every enemy + boss gains `+5+floor(w·0.3)` flat armor — the first mod on the armor
      axis; countered by Mortar/Poison/AP) and **🔌 Brownout** (`brownout`: all towers fire 25%
      slower — completes the Surge/Fog/Brownout tower-stat trio). Then **💚 Regeneration** in **v1.33.0**
      (`regen`: every enemy + boss self-heals 2%/s of max HP, `e.regen` tagged in `buildWave`, ticked in
      `update()`, freeze pauses it; tight green halo in render) — the first *off-HP difficulty* mod,
      pressuring DPS without raw HP (re: the recurring "too easy" feedback). Then **⚡ Static Storm** in
      **v1.37.0** (`emp`: every 3.5s the storm knocks one random *firing* tower offline for 2.2s —
      `t.empT` timer, buff towers immune, recovers on its own; cyan crackle ring + `SFX.zap()`) — the
      genuinely-new "EMP/stun" idea, pressuring **tower uptime/coverage** on a fresh axis. Then
      **🏜️ Bounty Drought** in **v1.39.0** (`drought`: every enemy + boss pays **50% less** gold — the
      mirror of `goldrush` and the **first economy-*denial* mod**, pressuring the build on a fresh axis
      (can't farm out of trouble); one line each in `buildWave`'s enemy loop + boss block, baked into
      `e.bounty`/`boss.bounty` at spawn). Then **💠 Warden Surge** in **v1.51.0** (`wardens`: converts a
      fraction of would-be basic enemies into ◈ Warden support escorts — densely shields the wave, pressuring
      **target priority** off the HP axis; ties together the Warden enemy + the v1.49.0 Support targeting mode;
      conversion-not-addition so wave length is unchanged; run-only). Then **💉 Adrenaline** in **v1.58.0**
      (`adrenaline`: every enemy + boss accelerates as it loses HP, up to +50% speed at near-death — the
      wave-wide cousin of the Berserker boss, on a fresh axis no other mod touches (`frenzy` is a flat bump).
      One inline `adrenalineMul` in the movement line (beside `berserkMul`), tagged `e.adrenaline` in
      `buildWave`; freeze zeroes it / Frost slow multiplies in; faint red ring cue. Ramps from 0 with missing
      HP so the lifetime average is *below* Frenzy's flat +35% → challenging but fair, can't make a run easier.
      Pressures chip-damage builds (burst-or-leak), per the "too easy" feedback; run-only). Pool 7→9→10→11→12→13→**14**.
      Test [46] + [54] + [57] + [67] + [69].
      **Still open from the original idea:** *bounty boom* (≈ existing `goldrush`/`titans`), *double-speed*
      (≈ existing `frenzy` +35% spd — a stronger ×1.6 variant could differ), and a genuinely new one:
      a *path swap* (direction reverses).
- [x] **A secret / easter-egg legendary perk** — shipped **v1.22.0**: 🩸 **Last Stand**,
      a comeback perk that gives ALL towers +3% damage per life lost this run (cap +60% at
      20 lives lost). Deliberately conditional — a flawless run gets +0%, so it can't make an
      already-easy run easier (respects the "too easy" feedback); it's a pure rubber-band for
      a near-loss. `lastStand`/`livesLost` live in `perkState` (save-safe via `freshPerkState()`);
      counter incremented at the leak site in `cd-update.js`; `effDmg()` applies the multiplier.
      Test [41]. **Follow-up done v1.32.0:** 🔮 **Glass Cannon** (legendary) — the glass-cannon
      trade-off: **+50% tower damage, −30% firing range** (`s.glassCannon` flag; `effDmg ×1.5` +
      `effRange ×0.7`; aura range untouched). A meaningful draft choice, not power creep — the
      coverage loss is a real cost, so it's "too easy"-safe. Test [51]. **Tuning watch:** on
      chokepoint-heavy maps the range cost is partly mitigated, so it can skew toward a near-free
      +50% there — if it ever reads as too strong, nudge the damage (`×1.5 → ×1.4`) or deepen the
      range cut (`×0.7 → ×0.65`), ≤25%/run. ✅ **Wildcard shipped v1.48.0** — 🎲 **Wildcard**
      (legendary, REPEATABLE): a gamble perk that resolves to a **random legendary effect** on pick
      (`resolveWildcard()` + a `pickPerk` branch in cd-defs.js; reveals what you rolled). Balance-neutral
      (a legendary → a legendary, not power creep) and save-safe (the *resolved* perk id is stored in
      `runPerks`/`perkState`, never `'wildcard'`, so resume can't re-roll). Test [65]. Still open: maybe
      a *hidden unlock condition* for a secret legendary. ✅ **Overkill shipped v1.59.0** — 💢
      **Overkill** (legendary): a slain non-boss enemy **detonates**, splashing 25% of its max HP as
      armor-ignoring true damage within 60px — a chunky chain-reaction swarm-clear. Single-layer
      (a `fromOverkill` guard on `damage()` stops a splash-kill re-detonating → bounded depth 1, no
      cascade), bosses excluded, scales with enemy max HP so it stays relevant late, pairs with the
      combo meter. `overkill` flag in `perkState`/`freshPerkState()` (save-safe); detonation block in
      `damage()`'s kill path (cd-update.js). Wildcard rolls it automatically. Test [70].
- [x] **New quick-play map: "Gauntlet"** — shipped **v1.54.0**. A 4th hand-crafted quick map
      (`MAPS.gauntlet` in cd-maps.js, before Mayhem) — a 12-point axis-aligned switchback that
      funnels enemies through a dense central kill-box (closely-spaced vertical runs at x=300/480/660),
      so a tower wedged between two runs rakes both and splash/AoE towers feast — a concentrate-fire
      identity distinct from the open Classic/Spiral/Serpent. Path length ≈2260. Comes with a new
      `THEMES.crimson` (blood-red) palette as its fixed identity (`MAP_THEME.gauntlet`), also added to
      `CAMPAIGN_THEMES`. Fully data-driven (selector/Records/best-key/loadRun pick it up automatically);
      additive, save-safe (new `cd_best_gauntlet_<diff>` key, `||0`). Test [68]. **Follow-ups:** *ground
      textures/patterns per theme* (still solid-colour path fills), and the forking/multi-lane map below.
- [ ] **Map: "crossroads"** — a path that forks and rejoins, or two simultaneous
      lanes. (Bigger lift — needs multi-path enemy distribution + targeting/`distToPath`
      over more than one path; its own run when tackled.)
- [x] **Boss variety** — shipped **v1.25.0**. From wave 20+ each every-5th-wave boss carries a
      MECHANIC, cycling `regen → summoner → bulwark` by boss number (`BOSS_ARCHETYPES[(w/5−4)%3]`
      in `buildWave`). **Regen** self-heals 1.2%/s (freeze pauses it); **bulwark** cycles a 2s
      ×0.4 damage-soak shield (~+15% effective HP); **summoner** spawns 2 weak adds every 4.5s,
      capped at 8. Colour-coded boss aura (`cd-render.js`) + `SFX.bossSkill()`. Early/tutorial
      bosses (w5/10/15, campaign L1–5 finals) unchanged. Run-only state, no save impact. Hardens the
      late game through behaviour, not HP (the norm-HP curve is invariant-capped). Test `[45]`.
      **v1.34.0 added the 4th archetype — 😡 Enrager** (haste aura: nearby enemies +35% speed,
      `hasted` tag decays in 0.6s; frozen boss pauses it, Frost slows still multiply in; orange
      boss aura + per-enemy ring). **v1.40.0 added the 5th — 🟣 Teleporter** (blinks +80px forward
      every ~4s, briefly intangible mid-jump → shrinks the damage window + reaches the exit faster;
      reuses the phantom blink fields, violet aura/badge, freeze pauses the blink, invuln decays even
      while frozen so it's never immortal). Cycle now `(w/5−4)%5` (w40→teleporter, w45→regen).
      Test `[45]` extended. ✅ **boss-bar mechanic badge shipped v1.36.0** — the boss HP bar now names
      the active archetype under "OVERLORD — WAVE N", colour-matched to the aura ring (green
      REGENERATING / red SUMMONER / blue BULWARK↔SHIELDED / orange ENRAGED / violet TELEPORTER);
      `bossMechanicBadge()` in `cd-render.js`, render-only, test [53].
      ✅ **6th archetype shipped v1.50.0 — 🔴 Berserker** (accelerates as it loses HP, up to +60% speed at
      death; `berserkMul` computed inline in the movement line, no ticked field; freeze stops it via `slowMul=0`,
      Frost slows blunt it; crimson aura ring brightens/thickens with rage + a periodic roar; `BERSERK` boss-bar
      badge). Cycle now `(w/5−4)%6` (w45→berserker, w50→regen); the rotation reads `BOSS_ARCHETYPES.length` so
      it auto-extended. Run-only/save-safe, behaviour-not-HP. Test [45] (rotation + accel + freeze-stops + killable) + [53] (badge).
      ✅ **7th archetype shipped v1.52.0 — 🔵 Disruptor** (EMPs your towers): every ~4s it knocks the *nearest*
      firing tower offline for 2.2s (`e.empPulseCd` in cd-update.js, reusing the Static Storm `t.empT` infra —
      firing-skip + decay + render dim are already general), so a coverage dead-zone roams with the boss —
      pressures **tower uptime/coverage** on a fresh axis, in ALL modes. One tower/pulse (bounded), buff towers
      immune, freeze pauses it, tower always self-recovers (empT decays unconditionally). Cyan aura ring + DISRUPTOR
      badge. Cycle now `(w/5−4)%7` (w50→disruptor, w55→regen); first appears at w50 like the deep archetypes.
      Run-only/save-safe. Test [45] (rotation + knocks-offline + freeze-pauses + buff-immune + killable) + [53] (badge).
      ✅ **8th archetype shipped v1.56.0 — 🟦 Juggernaut** (immune to crowd control): one *unconditional* line at
      the top of update()'s enemy loop (before slowMul) clears `e.frozen=0; e.slow=0` for it every frame, so the
      Freeze ability and Frost towers can't lock it down — a fresh **CC pressure axis** (none of the other seven
      touch CC) that also gently checks the documented Frost-snowball balance concern. No gated behaviour, no extra
      HP/speed (base 0.45× boss speed → bounded/beatable); steel-grey aura ring + UNSTOPPABLE badge. Cycle now
      `(w/5−4)%8` (w55→juggernaut, w60→regen). Run-only/save-safe, behaviour-not-HP, no tunable number (CC immunity
      is binary, can't make a run *easier*). Test [45] (rotation + freeze-immune + control + slow-cleared + killable) + [53] (badge).
      **Follow-ups still open:** *step the threshold/intensity if late game is still soft* (w20 → w15);
      a 9th archetype; per-campaign-tier *fixed* archetypes (vs the current wave-number cycle).
- [~] **Tower spec pass** — audit the 2 specs per tower for one clearly-weaker
      option and buff it (justify with sim). v1.10.0 reworked the three the owner
      flagged (booster **Network** +10% power, cannon **Mega Blast** +15% dmg, plus
      a poison overhaul). **v1.26.0 fixed sniper:** Executioner was *strictly dominated*
      by Deadeye (Deadeye = +60% expected vs ALL targets via 20%×4 crit; Executioner =
      +60% vs tanks/bosses only → Deadeye matched it on bosses & beat it elsewhere).
      Buffed Executioner `×1.6 → ×1.9` (+90% vs tanks & bosses) so it's the guaranteed
      no-RNG boss-killer while Deadeye stays the all-rounder. Test [17]. **v1.55.0 fixed
      tesla:** the "verify falloff math" check found **Superconductor strictly dominated** —
      with the shared chain falloff at 0.7 it totalled only `2.77×` on a full 5-chain vs
      Overcharge's `3.0×` (full dmg to 3), so Overcharge out-totalled it everywhere and its
      2 extra jumps were ~34%/24% chip. Softened **Superconductor's falloff `0.7 → 0.8`**
      (spec-specific; base tesla + Overcharge unchanged): it now totals `3.36×` on a 5-enemy
      swarm (out-totals Overcharge) while Overcharge stays the few-target king (wins at ≤4),
      a clean swarm-vs-few axis. +21% output at full chain (≤25%/run). Test [17] extended.
      **Still to audit:** frost (Deep Freeze vs Shatter), gun (Minigun vs AP) — check none
      is strictly dominated. (Quick takes: **gun** Minigun ×1.8 DPS vs AP +25%+armor-ignore
      is *situational* — AP wins vs heavy armor where flat-armor subtraction guts the fast
      low-dmg gun, Minigun wins vs trash — looks healthy. **frost** Deep Freeze (CC) vs
      Shatter (dmg) is a genuine axis.)

## Game feel / polish

- [~] **Start-menu revamp** (owner FEEDBACK, `[low priority]`: "main interface is getting clunky …
      buttons on the bottom row are huge compared to everything else … revamp the whole starting
      menu"). **First slice shipped v1.39.1:** the single flex row of ten equally-large 17px buttons
      was split into a two-tier hierarchy — a prominent `.startPlay` row (▶ PLAY 18px + ⏯ Resume +
      🗓 Daily) over a smaller, muted `.startUtil` toolbar (Talents/Achievements/Records/What's New/
      Settings/Reset at 13px). Markup + CSS only, save-safe, desktop & mobile verified. Test [58].
      **Second slice shipped v1.41.0:** an animated PLAY sheen — the primary button now breathes a
      glow + sweeps a light glint on the dimmed menu (the "Idle start-screen sheen" item below, now
      done; reduced-motion-gated; test [59]).
      **Third slice shipped v1.42.0:** the MODE/MAP/DIFFICULTY selectors are now grouped into one
      bordered **config card** (`.startOpts` wrapper) with left-aligned, settings-form-style labels +
      options, so the run-setup controls read as a single structured panel instead of three rows of
      floating centered labels. Markup + CSS only, save-safe, desktop (720px centered) + mobile
      (full-width) verified; test [60].
      **Fourth slice shipped v1.45.0:** the title/version/tagline are now grouped into a `.startHero`
      header block with a soft blue accent divider, the version reads as a small rounded pill badge
      tucked under the (slightly larger, glowier) title instead of floating between the tagline and the
      config card. Markup + CSS only, save-safe; `#verTag` keeps its id+onclick, `.startUtil` stays the
      last child. Test [63].
      **Remaining (the broader "revamp"):** the utility toolbar could move to a left rail / panel
      layout; consider per-block visual polish (icons, richer hover states), and maybe a background
      treatment behind the start screen. FEEDBACK item stays PENDING (as-written, per owner pref)
      until the fuller revamp lands.
- [x] **Grid placement** — shipped **v1.24.0** (owner FEEDBACK, commit `3664000`: "the spaces to
      place the turrets were more of a grid so you could line them up cleaner"). Tower placement snaps
      to the centre of a `PLACE_GRID` (32px) cell — `gridSnap` global + `snapGridCoord()`/`placeCoord()`
      in `cd-core.js`; `cd-game.js` places at `placeCoord(mouseX,mouseY)`; `cd-render.js` snaps the ghost
      + draws a faint slot-dot overlay while placing. 32 == the min placement gap, so adjacent cells stay
      buildable. A ▦ Grid snap Settings toggle (`cd_gridsnap`, default On) opts out. Selection uses the raw
      cursor; only the placement target snaps. No save/economy impact. Test [43]. **Follow-ups:** *optional
      bigger/visible grid lines for the whole board (not just dots)*, and *a subtle "snap" tick sound on place*.
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
      of the 2s window. ✅ **Combo board glow** shipped **v1.60.0** — once the streak
      passes the first milestone (10×), the board edges breathe with the combo-tier
      colour, escalating green→gold→orange→red→purple as the chain grows
      (`comboGlowTier()` in cd-state.js + a tier-driven radial edge glow over the
      vignette in `draw()`). Particle-setting-scaled + reduce-motion-gated, render-only.
      Test [71]. (The "combo-gated board tint at huge streaks" follow-up is now done.)
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
- [x] **Idle start-screen sheen** — shipped **v1.41.0**. The primary ▶ PLAY button now
      breathes a soft green glow (`playGlow`) and sweeps a periodic diagonal light glint
      (`playSheen` on a clipped `::after`) while you're on the dimmed menu, drawing the eye to
      the one live action. CSS-only (`tower-defense.css`), reduced-motion-gated (both animations
      go `none` under `prefers-reduced-motion: reduce`). No save/economy/balance impact. Test [59].
- [x] **Wave preview** — shipped **v1.21.0**. The between-waves bottom-left `Next:` line
      now shows an **icon roster** — a colour disc (+ the same `enemyGlyph()` symbol the
      sphere uses) and `×count` per enemy kind, boss appended on every 5th wave — instead of
      a text kind-list, so you can see counts at a glance and plan purchases. `waveComposition(w)`
      (cd-game.js, replaces `waveDesc`) is a deterministic tally that mirrors `buildWave()`;
      `PREVIEW_COLOR` (cd-render.js) holds the per-kind disc colours. Render + one helper only;
      no gameplay/economy/save impact. Test [40]. ✅ **threat number shipped v1.57.0** — the
      preview now appends a `⚔ N HP` gauge (total raw HP of the next wave's base roster; reddens
      on boss waves; reflects difficulty + campaign level). `waveThreat(w)` (cd-game.js) sums
      `waveComposition()` counts × a `KIND_HP_MULT` map × `enemyTemplate(w)` + the boss mult,
      mirroring `buildWave()` (KEEP-IN-SYNC, drift-guarded by test [40]'s `waveThreat===buildWave`
      assertion). Render + one helper, no save/economy/balance impact. Still open follow-up:
      *a per-kind hover tooltip* on the preview, and *the threat number relative to your DPS*.
- [ ] **What's New flush polish** — since v1.4.1 the panel butts against the
      `#gameCol` right edge, which is ~21px wider than the canvas (driven by the
      `.hint` margins). Minor cosmetic gap between the canvas and the panel; could
      tighten by constraining the column width to the canvas. (Height overhang was
      fixed separately in v1.5.2 — the panel now caps to the game's height.)
- [x] **What's New "new since last visit" marker** — shipped **v1.44.0**. A new additive
      `cd_wnseen` key stores the newest version the player has viewed; since `CHANGELOG_ENTRIES`
      is newest-first, every entry above its index is "unseen." `unseenWhatsNewCount()`/
      `markWhatsNewSeen()`/`refreshWhatsNewBadge()` (cd-core.js) drive it: `renderWnList()` tags the
      unseen rows with a `.wnFresh` gold accent + a `NEW` pill, the ✨ What's New button (`#wnBtn`)
      shows a gold count pill, the version tag gets a `●` dot (`.hasNew`), and `openWhatsNew()`
      auto-scrolls `#wnList` to the top then marks everything seen. `initWhatsNew()` seeds the baseline
      on an absent key so old saves / new players start caught-up (no NEW flood). One additive key,
      swept by `resetAllData()`. Test [62]. **Follow-up:** *a per-entry "seen" tracking* (mark
      individual entries rather than a single high-water version) is overkill; this water-mark approach
      is sufficient.
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
      early game now feels right; the plateau was the gap. **v1.24.4 steepened the
      BOSS HP slope** `14 + w*0.5 → 14 + w*0.6` (+3% at w5 → +10% at w30, bounded +20%
      asymptote) — the open late-game lever, since the norm-HP curve is invariant-capped
      (see ⚠ below). **v1.25.0 took the off-HP lever: boss ARCHETYPES** (regen/bulwark/
      summoner from w20+, see "Boss variety" above) harden deep/late-campaign waves through
      *behaviour* rather than more HP — exactly the "boss mechanics" candidate below.
      **v1.35.0 added the ◈ Warden support enemy (w15+, ALL modes)** — a damage-shield aura
      (warded enemies take −40%) that pressures **target priority / AoE** rather than raw HP, and
      crucially hits **Classic & Campaign** (the modes the owner called too easy), not just
      Mayhem/late bosses. See "New enemy type: warden" above.
      Next candidate levers if still too easy late — **step the boss slope `0.6 → ~0.7`**,
      **lower the archetype threshold** (w20 → w15) or add another archetype (8 as of v1.56.0), the Frost/booster
      snowball item below, or boss **armor** slope (`w*0.4 → w*0.5`). Simulate
      before/after; ≤25% per number per run.
      - ⚠ **Norm-HP curve is at its ceiling — `w^1.9` coeff can't go past `1.25`
        without owner sign-off.** Test `[16]` enforces a **≤25% cumulative HP boost vs
        the v1.10.0 (coeff-1.0) baseline at EVERY wave**; the live `1.25` already sits
        at that asymptote, so bumping toward the old ROADMAP target "~1.55" would push
        the w30+ swing to +33–37% and **break that invariant** (and the ≤25% guardrail
        as the comment defines it). The "toward 1.55" aspiration and the encoded
        invariant are in tension — left for the owner to resolve (see "Prompt
        suggestions"). Until then, late difficulty is raised via the **boss** and
        **economy** levers, not the norm-HP coefficient.
      - **Economy lever near-exhausted (measured v1.24.4):** 10-wave war chest
        (god towers, no spend, classic-normal) = **2613 gold** ≈ 70% bounty (trimmed
        v1.16.1) / 16% wave-bonus (trimmed) / 9% interest / 5% start gold. The two
        untrimmed levers move the chest <2% each → low leverage. Prefer difficulty
        (boss/late-HP) and tower-power levers over more economy trimming.
- [~] **Frost/booster damage snowball** (owner FEEDBACK, v1.10.0) — Shatter was cut
      ×6→×4.5, but the underlying multiplicative stack is still strong: a single
      **booster** aura was +75% at L6 (`buffPower` +0.1/level off a 0.25 base) and
      **Frost Mastery** adds +30%, all multiplying Shatter and Frostbite. Owner cleared
      campaign 9 on hard with just 2 frosts + 1 booster (and campaign 6 with a single
      gunner + maxed booster). **v1.16.2 took the booster slice:** tapered the per-level
      scaling **+0.1 → +0.08** (base/L1 unchanged; maxed booster +75%→+65%, ~−6% buffed-
      tower dmg at L6 — sim: gunner 14.0→13.2). Test [33]. **The aura *range* is being cut
      toward the owner's −50%:** `90→68` (v1.20.1, slice 1) then `68→52` (v1.24.1, slice 2) —
      then `52→45` (v1.24.3, final slice) — `45 = 90×0.5`, the **literal halving complete**;
      cumulative coverage area is now 25% of the original (45²/90²), so a single booster reaches
      far fewer towers, hitting the solo-carry from the coverage side (Test [39]; FEEDBACK item
      now closed). **Remaining power levers** (≤25%
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

## Table-stakes (polished-browser-game basics — re-audited v1.24.2 + v1.27.1 + v1.37.1 + v1.40.1 + v1.45.1 + v1.50.1 + v1.55.1 + v1.60.1 health checks)

_**Table-stakes checklist is now COMPLETE.** The lone remaining gap — **bigger HTML tap targets on small
phones** — shipped **v1.46.0**: the floating upgrade/sell panel buttons (≤920px, both orientations) and the
shop / wave-control / start-screen option buttons (≤920px **portrait**, so the v1.15.0 landscape compaction
stays intact) now meet the ~44px recommended touch target (was ~29–33px). Test [64]. All other items shipped:
favicon/meta/OG, PWA install, touch/pointer, gamepad, keyboard a11y (menus + draft), colorblind aid,
reduced-motion, volume slider, high-DPI scaling, responsive/mobile. New table-stakes ideas can still be added
above as the bar for "polished browser game" rises._

_Earlier note:_
Done: **gamepad support (v1.43.0)** — a controller drives the same board cursor + actions as mouse/keyboard
(`pollGamepad(dt)` in `cd-game.js`, called from the rAF loop; no-op without a pad). Test [61].
Done: **PWA install (v1.30.0)** — installable + offline-cacheable when hosted via `manifest.webmanifest`
+ `sw.js` (precache shell, versioned cache) + maskable `icon.svg`; SW registration is http/https-guarded
so `file://` double-click play is unaffected; deploy workflow copies the three files. Test [49].
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
menus all render correctly. **PWA install shipped v1.30.0** (installable + offline-cacheable when
hosted). **Next normal run's strongest table-stakes pick: gamepad support** (then bigger HTML tap
targets on small phones). (Keyboard a11y is now complete — start-screen menus
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
      page. Test [34]. **Follow-up done v1.46.0:** bigger HTML tap targets on small phones — the
      floating upgrade/sell panel buttons + the shop / wave-control / start-screen option buttons now
      meet the ~44px recommended touch target (upgrade panel both orientations; shop/controls/options
      portrait-only so the v1.15.0 landscape compaction stays intact). Test [64].
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
- [x] **PWA install (offline manifest)** — shipped **v1.30.0**. `manifest.webmanifest`
      (name/short_name/`start_url:./tower-defense.html`/`display:standalone`/theme+bg colors/
      maskable `icon.svg`), `sw.js` (precache the app shell + cache-first runtime cache, versioned
      `circuit-defense-v1.30.0` so `activate` evicts stale caches), and `icon.svg` (gold-⚡ maskable
      app icon). HTML head links the manifest + apple-touch-icon + iOS web-app meta; `cd-render.js`
      registers the SW **guarded to http/https only** (skips `file://`, so double-click play + the
      headless harness are untouched). Deploy workflow copies the three files into `_site`. No build
      step, no localStorage/save change. Test [49]; verified live over http (SW activated, 13 shell
      assets cached). **Follow-up:** a real PNG icon set (192/512) for stricter installability audits
      (Lighthouse) — the single SVG icon installs fine in Chrome/Edge/Firefox but some installability
      checks prefer raster PNGs; would need a binary asset (currently the repo is asset-free).
- [x] **Gamepad support** — shipped **v1.43.0**. `pollGamepad(dt)` (`cd-game.js`) is called once per
      frame from the rAF `loop` (`cd-render.js`) and reads `navigator.getGamepads()`; a standard
      (Xbox-style) pad drives the **same board cursor** (`mouseX`/`mouseY`) and the **same actions** as
      mouse/keyboard — **left stick + D-pad** move a drawn crosshair, **A** place/select (or aim an
      armed meteor) via a shared `boardPress(x,y)` helper extracted from the `pointerdown` handler,
      **B** cancel, **X** cycle affordable tower, **LB/RB/LT** abilities (Meteor/Freeze/Rush), **Start**
      add-wave, **Back** pause (Back/Start un-pause). Press-edge detection (`gpPrev[]`) so held buttons
      don't repeat. **Complete no-op when no pad is connected** → standard play + the headless harness are
      byte-identical; no new game state, no save/economy/balance impact. Hotkey hint + reticle render added.
      Test [61]. **Follow-ups (optional):** *remappable buttons*, *right-stick fine-aim / cursor-speed
      setting*, *menu navigation with the pad* (start-screen panels + draft are still mouse/keyboard).
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
- [ ] **Split the test harness file** (noted v1.24.2, re-confirmed v1.27.1 + v1.32.1 + v1.37.1 + v1.40.1 + v1.45.1 + v1.50.1 + v1.55.1 + v1.60.1 health checks) —
      `tests/run-tests.mjs` has grown to **4,484 lines (71 groups `[1]`–`[71]`, 709 assertions)** in a
      single file. Dev-only, doesn't touch the shipped game, but it's well past the readability
      point; could split per-group into `tests/groups/*.mjs` with a small runner. Low priority
      (suite runs ~30s, green) — but it's by far the largest single file in the repo now and growing
      ~50 lines per feature run, so worth doing before it doubles.
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
