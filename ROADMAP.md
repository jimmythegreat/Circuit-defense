# Circuit Defense — Roadmap

Prioritized backlog for the auto-improver. **OPEN items are the work queue;** the "Shipped"
section is a condensed do-not-re-implement log.

> **Condensed v2.0.0** (owner request: "feedback and roadmap are getting huge — summarize with
> enough detail so future runs don't implement the same thing"). Shipped features are now
> one-liners (`name — vX.Y.Z, one-line what + Test [N]`). Full prose lives in CHANGELOG.md / the
> in-game What's New panel; design rationale + every formula/invariant lives in **CLAUDE.md**
> (the source of truth). When you ship something here, check it off into "Shipped" as a one-liner.

## Known bugs

_None currently known._ (Add any here as found — top priority.)

## OPEN — pick from here (not in priority order; FEEDBACK.md overrides)

### [refactor]
- [x] **Split `cd-update.js` → `cd-combat.js`** — DONE v2.53.2 [12]. The combat helpers (`effSpeed`/
      `pickTarget`/`fireChain`/`fireRail`/`fireBeam`/`firePulse`/`ricochetNext`/`hitEnemy`/`damage`) moved
      verbatim into a new `cd-combat.js` (9th game file, loads after cd-update.js / before cd-endgame.js),
      leaving cd-update.js as just the per-frame `update()` sim: **1371 → 907 lines**, cd-combat.js 478.
      Zero behaviour change (2012/0 green before, 2017/0 after with 5 new anti-regression guards).
      **New size watch:** cd-update.js now has ~590 lines of headroom (~25 runs at the historic ~23/run,
      though the fire-path perk lines now land in cd-combat.js instead). `cd-render.js` (1191) is now the
      largest game file — next split candidate if it nears ~1400.

### Content & variety
- [ ] **Map: "Crossroads"** — a path that forks and rejoins, or two simultaneous lanes. Bigger
      lift: needs multi-path enemy distribution + targeting/`distToPath` over >1 path. Its own run.
      (All SEVEN static `THEMES` palettes are now claimed as map identities — an 8th *named* map needs a
      brand-new palette; but Crossroads could reuse one or get an 8th.)
- [x] **New single-path map (the 🌀 Vortex)** — DONE v2.25.0 [135], a rectangular inward-spiral kill-funnel
      with a new Neon (hot-magenta) palette (7th map / 7th theme).
- [x] **New tower (the 🔆 Laser)** — DONE v2.9.0 [121], a ramp-up beam (the 10th tower). The
      "charge up the longer it fires" mechanic now exists as a TOWER (was sketched as a Railgun spec idea).
- [x] **Arc/chain tower** — DONE v2.52.0 [193], the ⚛️ Arc (12th tower): a **travelling ricochet bolt**
      (`proj:'ricochet'`) exactly per the design note — hops to the nearest unhit enemy within 150px
      (vs Tesla's 90px instant chain), 5 hits/bolt at 0.85 falloff, low base dmg → spread-swarm sweeper.
      Specs Ball Lightning (+2 hops) / Magnet Coil (seek ×1.6); mastery_arc; 🪩 Pinball Wizard badge.
      Sim: mid-pack at equal gold (w11–12 vs Tesla w10 / Cannon w13). ~~Follow-up: a bolt-render flourish
      (zigzag tracer between hops)~~ DONE v2.54.0 [200] — each hop draws a jagged bolt from the struck enemy
      to the next, reusing the tesla beam render path (render-only, never serialized).
- [ ] **Tower spec follow-ups** — (a *charge-up* mechanic now exists via the 🔆 Laser tower v2.9.0);
      ~~explosion-penetration vs ⬢ Bastion~~ (DONE as the 💣 Shaped Charges *perk* v2.8.0 [120]; a *spec*
      version is still open if wanted); ~~a counter to blinkers (phantom/cloak/teleporter/veil)~~ (DONE as
      the 👁️ Spectral Sight *perk* v2.41.0 [161] — towers see through intangibility; a per-tower *spec* or
      predictive lead-shot version is still open if wanted). Audit frost (Deep Freeze vs Shatter) & gun
      (Minigun vs AP) for a strictly-dominated option (quick take: both look like healthy axes).
- [ ] **Boss/enemy follow-ups** — a 25th boss archetype (24th = 🚫 Nullifier tower-damage dampening aura,
      shipped v2.53.0 [197], first at w135 — completes the debuff trio after Suppressor/Distorter, −25% dmg,
      freeze-pausable/Hardened-Circuits-negated, brick-red ring; 23rd = 🦎 Chameleon adaptive damage-resistance
      v2.49.0 [186]; 22nd = 💧 Cleanser anti-debuff purge v2.42.0 [164]); per-campaign-tier *fixed* archetypes
      (vs the wave-number cycle); a Breacher variant that costs lives only if it *survives* a tower's range.
      (Color space for boss aura rings is VERY crowded now — a 25th needs a clearly-distinct hue, or reuse a
      shape/glyph cue instead.)
- [ ] **Perk/ability follow-ups** — (revival/comeback legendary 🌅 Phoenix DONE v2.15.0 [125] — cheat death
      once, revive + field-knockback; legendary +40% range 🦅 Eagle Eye DONE v2.3.0 [115]; expanding shock-ring
      render DONE v2.5.0 [117], now also reused on Meteor impact; Barrier-charges talent 🧱 Aegis DONE v2.6.0
      [118]; offensive-buff ability 📣 Amplify DONE v2.48.0 [183] — +30% tower dmg & rate for 5s); a per-tower
      ability; a meta talent version of Capacitor (ability-cooldown — note: ⚡ Surge talent
      already does −6%/rank ability cd, so this would overlap); ~~a Barrier *cooldown*-shortening talent (the
      other Barrier lever, distinct from Aegis's charges)~~ (DONE as 🏯 Rampart talent v2.46.0 [176] — −10%
      Barrier cooldown/rank, max 3); ~~a hidden unlock condition for a secret legendary~~ (DONE as 💠 **Second
      Wind** v2.54.0 [198] — hidden from the draft AND from Wildcard until the 💎 Flawless badge is earned;
      restores 1 life per wave cleared, capped at the run's starting lives. The generic `perkUnlocked()` /
      `secret()` gate is reusable, so further secret perks are now cheap to add).
- [ ] **Mayhem wave-mod follow-ups** — a genuinely new *path swap* (direction reverses). (Pool is 23 mods
      after ⚕️ Medic Surge v2.47.0 [181] — heal-aura escort surge; ⏩ Blitz v2.36.0 [147]; ⚑ Herald Surge
      v2.35.0 [144]; most axes covered, so prefer the path-swap idea over another stat-scaler/escort-surge.)
- [x] **In-game Bestiary / Codex** — DONE v2.26.0 [136] (enemies + boss powers) + **v2.28.0** (🛡 Towers
      section: all 12 towers + both specs each, built live from TOWER_TYPES/SPECS so it can't drift). A
      start-menu panel with glyph/colour/first-wave + a one-line counter tip per enemy/boss + role+specs
      per tower. **Mid-run access DONE v2.37.0 [150]** — a 📖 Codex button in the in-game controls + a `C`
      hotkey open it during a run (auto-pauses; closing resumes). **Boss deep-link DONE v2.54.0 [199]** —
      opening it while a mechanic boss is alive tints + scrolls to that archetype's row. An upgrade-panel
      deep-link (jump to the selected tower's entry) is a possible further follow-up.
- [ ] **Per-theme ground textures** — path fills are still solid-colour; add patterns/parallax per theme.

### Balance (simulate before/after, ≤25% per number per run)
- [~] **"Too easy" (recurring owner FEEDBACK)** — raised iteratively. **v2.0.0 added 🌑 Nightmare
      difficulty + a quick-mode `hard`/`nightmare` `lateScale`** (progressive late-game HP, capped) —
      see Shipped. Earlier levers: norm-HP curve, boss-HP slope, boss-armor slope, off-HP enemies
      (Warden/Breacher/Molten/Bastion/Jammer in ALL modes), boss archetypes, economy trims.
      **⚠ CAPPED LEVERS — need owner sign-off before touching (guardrail tests pin them):**
      - **Norm-HP `w^1.9` coeff is at its `1.25` ceiling.** Test `[16]` enforces ≤25% cumulative HP boost
        vs the v1.10.0 (coeff-1.0) baseline at EVERY wave; `1.25` already sits at that asymptote. The old
        "toward ~1.55" aspiration and this invariant are in tension — owner must resolve. Raise late
        difficulty via boss/economy/new-enemy levers, NOT this coeff.
      - **Boss-HP slope (`14 + w*0.6`) can't pass ~0.625** without breaking test `[44]`'s ≤25%-vs-0.5
        invariant. **Boss-armor slope is at `w*0.5`** (test `[44]`; further ≤25% bumps OK).
      - **Archetype threshold w20 can't drop to w15** — test `[45]` pins tutorial bosses (<w20) vanilla.
      - **Quick-mode `lateScale`** — v2.0.0 added a capped early ramp; **v2.31.0 [109] added an UNCAPPED
        DEEP ramp from wave 40** (hard +5%/wave, nightmare +8%/wave; FEEDBACK "way harder as levels
        progress, especially endless — 1.5m unused gold at w140", 25% rule waived). Hard ×2.5 @w65 / ×6.25
        @w140; bosses inherit it proportionally via `t.hp`. Normal/Easy/Campaign exempt so test `[16]`/`[44]`
        stay safe. **v2.32.0 [140] scaled enemy ABILITIES/AURAS with wave depth** — one `enemyMechScale()`
        (`1 + min(0.6, max(0,w−40)·0.015)`, 1.0 ≤w40, cap +60% @w80) feeds regen %, the warden/herald/enrager
        aura radii, summoner add-cap (8→13), and siphon drain. Bounded (no raw HP). **v2.33.0 [141] added the
        deep-wave COUNT ramp** — a shared `waveCount()` helper gives quick-mode hard/nightmare a bounded body
        bump from w40 (`+min(30, floor((w−40)·0.4))`, capped +30 for perf; ~+12% bodies @w140), shared by
        buildWave()+waveComposition() so the preview can't drift. Re-checked the proportional **boss** scaling
        — bosses inherit the deep HP ramp via `t.hp` proportionally (not super-linearly on top), matching the
        owner's "scaled (maybe not as high)" — left as-is. The harder-Endless FEEDBACK thread is now
        **CLOSED** — endless milestone drafts past wave 30 shipped v2.34.0 [142] (the draft loop was gated
        `w < victoryWave()`; Endless's victory wave is 30, so it stopped drafting the moment it went infinite).
      - **Economy lever near-exhausted** (measured v1.24.4): 10-wave war chest ≈2613 gold (≈70% bounty).
        Untrimmed levers move it <2% each → low leverage. Prefer difficulty/tower-power levers.
- [~] **Frost/booster damage snowball** — Shatter ×6→×4.5 (v1.10.0); booster aura power +75%→+65%
      (v1.16.2) + range 90→45 (v1.24.3, area 25% of original, FEEDBACK closed); 🔥 Molten CC-immune
      enemy (v1.77.0) checks freeze-reliant builds from the enemy side. **Remaining (≤25%, sim first):**
      trim Frost Mastery per-rank dmg, or a booster aura soft-cap if a super-booster still solo-carries.
- [~] **Interest/economy curve** — v1.16.1 trimmed bounty/bonus ~13% (10-wave chest). Next if still
      rich: early interest cap 30→~25, or start gold normal 120→100 (each ≤25%, sim). Test [32].
- [ ] **Late-campaign audit (L30–40)** — confirm hard-but-beatable with a maxed meta.

### Game feel / polish
- [x] **Start-menu revamp (FEEDBACK [high])** — DONE v2.1.0 [113]. The "full revamp" landed: a desktop
      two-column dashboard (config card left + a right rail stacking play actions over a vertical utility
      panel) so the menu fits the board with ▶ PLAY on-screen (it was below the fold). Nine slices total
      (button hierarchy v1.39.1 → accent tiles v2.0.2 → dashboard v2.1.0). FEEDBACK item moved to DONE.
- [ ] **What's New flush polish** — the panel butts against `#gameCol`'s right edge, ~21px wider than
      the canvas (driven by `.hint` margins) → minor cosmetic gap. Could constrain column width to canvas.
- [ ] **Small polish follow-ups** — (~~slide-in animation on overlay buttons~~ DONE v2.38.0 — overlay
      buttons rise + fade in, reduced-motion-gated; ~~a quick-restart hotkey, e.g.
      Enter on the game-over overlay~~ DONE v2.37.0 [150] — Enter → Play Again when offered);
      ~~hide the faint between-wave `Next:` preview while the upgrade panel is open~~ (DONE v2.29.0 [138]);
      ~~highlight the beaten Records cell when next opened~~ (DONE v2.22.0 [132] — latest-PB cell tinted gold + ★);
      ~~a per-kind hover tooltip~~ (DONE v2.52.0 [194] — hovering a Next:-strip kind disc pops its
      Bestiary name + counter tip from CODEX_ENEMIES) (~~an upgrade-panel Codex deep-link~~ DONE v2.56.0 [207]
      — opening the Bestiary with a tower selected scrolls to that tower's row, priority over a live boss)
      (~~DPS-relative read on the wave-threat number~~
      DONE v2.29.0 [138] — board DPS 🗡 shown beside the ⚔ threat HP via `boardDps()`);
      ~~visible grid lines (not just dots) + a "snap" tick sound~~ (DONE v2.24.0 [134] — full grid lines +
      target-cell highlight + a `SFX.tick()` on cell-cross while placing);
      ~~combo-tier label~~ (DONE v2.36.0 [148] — the meter shouts HEATING UP→RAMPAGE→UNSTOPPABLE→GODLIKE) +
      ~~combo-tier shape~~ (DONE v2.39.0 [156] — an escalating star-burst above the tier word);
      ~~high-contrast mode~~ (DONE v2.38.0 [151] — ◐ Settings toggle, bold dual-halo enemy outlines);
      ~~wave-start announcement banner~~ (DONE v2.44.0 [170] — centered "WAVE N" / "☠ BOSS WAVE N" flash);
      ~~sell-selected-tower hotkey~~ (DONE v2.44.0 [172] — press S, mirrors the U upgrade hotkey);
      ~~cycle-target-mode hotkey~~ (DONE v2.46.0 [178] — press D, mirrors U/S, non-buff only);
      ~~speed-toggle hotkey~~ (DONE v2.53.0 [196] — press F, cycles 1×→2×→3×, mirrors the ⏩ button);
      ~~low-lives danger cue~~ (DONE v2.48.0 [184] — red screen-edge vignette pulsing as lives fall);
      per-achievement chip reward (needs a chip-economy pass first); toast/sound when a badge unlocks mid-menu.
      (Veterancy visual thread now COMPLETE: lifetime tower-kills stat + 🏵️ Living Legend badge v2.19.0 [129],
      rank-tinted barrels v2.21.0 [131].)

### Tech / tooling
- [x] **Split `cd-update.js`** — DONE v2.15.2. The end-of-run + meta-UI half (achievements/records/settings/
      scoring/end-screen + endGame/winGame/nextLevel/quitRun/continueEndless) moved verbatim into a new
      **`cd-endgame.js`** (491 lines), loaded after cd-update.js, before cd-render.js. cd-update.js dropped
      **1448 → 963** (now just the per-frame `update()` sim + combat: pickTarget/fire*/hitEnemy/damage). Zero
      behaviour change (suite 1339→1342, +3 from the new file's coverage); HTML/sw.js/harness/CLAUDE.md updated
      in the same run. All 8 game files now have comfortable headroom (largest: cd-render 984, cd-game 909).
- [ ] **Split the test harness file** — `tests/run-tests.mjs` is **13,134 lines (193 groups, 2012
      assertions)** (health check v2.53.1; was ~12,165/182/1869 at v2.47.1 → ~160 lines/run). By far the
      largest file in the repo. Could split per-group into `tests/groups/*.mjs` with a small runner.
      Dev-only, suite green in ~70s, no flakiness observed. Worth doing before it doubles.
- [x] **Watch: `cd-update.js` size** — trigger REACHED at health check v2.53.1 (1371 lines). Promoted to the
      `[refactor]` section at the top of this file; do it in a normal run.
- [x] **Expand harness coverage** — ~~abilities (meteor/freeze/rush/shock/barrier)~~ DONE v2.37.0 [149];
      ~~spec selection at L5~~ DONE v2.39.0 [157]; ~~mayhem path-shift on resume~~ DONE v2.40.0 [160]
      (resumed Mayhem run regenerates the path, relocates towers, restores wave/towers, drives a wave).
      (Campaign next-level flow covered by [109].) ~~Daily-seed cross-page determinism~~ DONE v2.46.0 [179]
      (two fresh pages produce the identical date-seeded challenge — a guard against Date.now()/Math.random()
      slipping into the seeded stream). Note: Daily runs are one-off / not resumable by design, so this is
      cross-page-load determinism, not save-resume.
- [ ] **Audit tests for draft-RNG flakiness** — the harness auto-picks draft card `[0]`; any test asserting
      a numeric gold/dmg bound *after* a draft can flake if a gold/power perk lands in slot 0. v1.20.2 fixed
      group [32] by asserting the pre-draft economy. Sweep other run-driving groups; pin to pre-draft/perk-neutral.
- [x] **Harden the vacuous fire-path perk tests** — DONE v2.51.0. Retrofitted `[93]` Ambush, `[167]` Finisher and
      `[174]` Point Blank: they now place tower + a stationary (`spd:0`) enemy ON the path via `pointAt` and assert
      `railBestHit===1` (a fire guard), so the rail actually lands and the ×1.3/×1.35/×1.25 ratios test real
      damage (they used to hold trivially at 0 because `update()` shoved the mock enemy off the beam). Point Blank
      varies the *tower's* geometric offset from a fixed on-path enemy. Mirrors the good `[188]` pattern.

## Shipped (condensed — do NOT re-implement; check CLAUDE.md for detail)

### Towers / specs / targeting
- 12 towers (gun/sniper/frost/cannon/tesla/poison + Mortar v1.23.0 [42] + Railgun v1.83.0 [91] + Laser
  v2.9.0 [121] + Pulsar v2.23.0 [133] + Arc v2.52.0 [193]); a new tower is mostly additive (`TOWER_TYPES`+`SPECS`+optional mastery talent). Mortar
  lobbed-arc render v1.79.0 [87]. Laser = a ramp-up beam (×1→×2.2 on a held target, resets on switch) —
  sustained boss/tank DPS, poor at swarms; specs Focusing Array/Pulse Drive; hotkey `0`; mastery_laser.
  Pulsar = a self-centred radial AoE pulse (`proj:'nova'`, hits ALL in range at once, low per-hit dmg →
  swarm-clearer, poor vs bosses; the inverse of the Laser); specs Overload/Resonance; no number hotkey; mastery_pulsar.
  Arc = a travelling ricochet bolt (`proj:'ricochet'`, hops to the nearest unhit enemy ≤150px, 5 hits/bolt,
  0.85 falloff → spread-swarm sweeper, weak single-target); specs Ball Lightning/Magnet Coil; no number hotkey; mastery_arc.
- 9 targeting modes (first/last/strong/close + Weak v1.70.0 [80] + Support v1.49.0 [66] + Fastest v2.41.0 [163]
  + Boss v2.45.0 [173] + Cluster v2.53.0 [195] — aims at the densest knot for max AoE splash); default-mode
  device pref v1.89.0 [97]. Spec rework v1.10.0 (Network/Mega/Poison), Executioner buff v1.26.0,
  Superconductor falloff 0.7→0.8 v1.55.0 [17]. Railgun Penetrator nerfed +35%→+20% v2.0.0 [109].
- Tower veterancy (cosmetic kill-rank pips) v1.100.0 [107].

### Enemies / bosses / waves
- 13 enemy kinds (+boss): + heal/shield/split/molten(v1.77.0 [86])/phantom(v1.9.0 [14])/bastion(v1.90.0 [98])/
  warden(v1.35.0 [52])/jammer(v1.91.0 [99])/breacher(v1.63.0 [74], leak-cost 2→3 v2.0.0)/herald(v2.4.0 [116],
  haste-aura, Enrager's regular-enemy cousin). Concurrent waves (cap 3→8 v2.34.0 [20], FEEDBACK) v1.12.0.
- 24 boss archetypes from w20+ (regen→summoner→bulwark→enrager→teleporter→berserker→disruptor→juggernaut→
  siphon→hydra→revenant→conduit→warper→fortifier→warlord→suppressor→absorber→distorter→custodian→veil→accelerator→cleanser→adaptive→nullifier) v1.25.0–v2.53.0 [45]/[53]/[90]/[96]/[114]/[119]/[122]/[124]/[126]/[137]/[139]/[143]/[146]/[162]/[164]/[186]/[197]; boss-bar mechanic badge v1.36.0 [53]. Nullifier (v2.53.0 [197], first w135) dampens nearby tower DAMAGE −25% (the effDmg sibling of Suppressor's rate / Distorter's range; freeze-pausable, Hardened-Circuits-negated, adds no HP). Chameleon (v2.49.0 [186], first w130) throttles a repeated same-tower-type hit −50% (a build-diversity axis; freeze lifts it, adds no HP). Absorber (v2.27.0 [137]) caps per-hit damage at maxHp×5% (checks burst/crit builds; freeze lifts the cap). Distorter (v2.30.0 [139]) dampens nearby tower range −20% (the `fog` mod as a boss; freeze-counterable). Custodian (v2.35.0 [143]) shields its cohort −40% (the ◈ Warden's aura as a boss; freeze/focus-counterable). Veil (v2.36.0 [146], first w115) cloaks its cohort — nearby allies periodically phase out untargetable (the Cloaking Field mod / phantom as a boss; freeze/rapid-fire-counterable). Accelerator (v2.41.0 [162], first w120) ramps its own speed with time alive (up to +80%; a pure DPS-race lever, freeze pauses the ramp, adds no HP). Cleanser (v2.42.0 [164], first w125) purges poison/slow from itself + cohort every ~2.5s (an anti-debuff axis; freeze pauses it, adds no HP).
- 23 Mayhem wave mods (frenzy/blitz/swarm/titans/goldrush/drought/surge/fog/armored/brownout/regen/emp/wardens/
  adrenaline/heatwave/cloak/fission/breachers/jammers/bastions/heralds/medics/meteors) [46]+ many; Herald Surge v2.35.0 [144]; Blitz (+60% speed, the "double-time" Frenzy variant) v2.36.0 [147]; Medic Surge (heal-aura escort surge) v2.47.0 [181].

### Difficulty / progression / meta
- 4 difficulties: easy/normal/hard + **🌑 Nightmare v2.0.0** [109] (top tier, 2.2× chips, never in Daily).
- Quick-mode `lateScale` on hard/nightmare v2.0.0 + **uncapped deep ramp from w40 v2.31.0** [109] (deep-endless
  HP keeps climbing — hard +5%/wave, nightmare +8%/wave; bosses inherit it; Normal/Easy/Campaign exempt).
- 28 talents (CORE + 8 masteries + mastery_mortar v1.23.0 + mastery_rail v1.83.0 + mastery_laser v2.9.0 + mastery_arc v2.52.0
  + mastery_pulsar v2.23.0 + Farsight range v1.92.0 [100] + Aegis Barrier-charges v2.6.0 [118]
  + Rampart Barrier-cooldown v2.46.0 [176]);
  cost rework v1.38.0 [55]. 46 achievements (+ Nightmare Walker v2.0.0 + 🏵️ Living Legend v2.19.0 [129] —
  reach a tower's top Legend veterancy rank; + 🌌 Eternity v2.34.0 [142] — reach wave 100 in a run;
  + 💰 Hoarder v2.35.0 [145] — bank 10,000 gold at once; + 🌠 Combo God v2.36.0 [148] — reach a 50× kill-streak;
  + 💯 Centurion + ⚰️ Gravekeeper v2.38.0 [152] — finish 100 runs / defeat 100k enemies lifetime;
  + 🗼 Overlord + 🐢 Marathoner v2.39.0 [155] — field 12 towers at once / play a run 30+ min;
  + 🏰 Untouchable + 🎆 Combo Deity v2.40.0 [159] — win Nightmare flawless / reach a 100× streak;
  + 🪐 Astral v2.42.0 [166] — reach wave 150 in a run (the rung above Eternity);
  + 😰 Clutch + 🎗️ Old Guard v2.43.0 [168] — win with ≤3 lives / hold 3 Legend-rank towers at once;
  + 🎰 Jackpot + 🧊 Absolute Zero v2.44.0 [171] — collect 3 legendary perks / freeze 12+ in one cast;
  + 🐺 Lone Wolf + 🎴 Full House v2.45.0 [175] — win with ≤3 towers / cast every ability in a run (6 since v2.48.0);
  + 🛡️ Ironclad v2.46.0 [177] — block 5+ leaks with Barrier in a single run;
  + 🌋 Annihilator + 🦣 Big Game Hunter v2.47.0 [182] — deal 10M lifetime damage / defeat 5 bosses in a run;
  + 💥 Carpet Bomb v2.48.0 [184] — kill 12+ enemies with a single Meteor;
  + 🥊 Heavy Hitter + 🧠 Polymath v2.49.0 [187] — deal 200k with one tower / win with 6+ tower types;
  + 🛸 Transcendent + 🧪 Plague Doctor v2.50.0 [189] — reach wave 200 / 150 kills on one Poison tower;
  + 🪳 Exterminator + 🌊 Wave Rider v2.51.0 [192] — defeat 2,000 enemies in a run / stack 5+ waves at once;
  + 🪩 Pinball Wizard v2.52.0 [193] — strike 6+ enemies with a single Arc bolt;
  + 🎭 Jack of All Trades + 🗺️ Cartographer v2.55.0 [203] — field 8+ distinct tower types at once / reach the final wave on all 7 static Quick maps (cross-run completion);
  + 🏗️ Maxed Out v2.56.0 [208] — win with 3+ towers at max level;
  lifetime tower-kills stat in Records); roster data-driven [48]/[92]. Badge-unlock chime (SFX.badge) v2.55.0 [204].
- Run perks w/ rarity drafts; legendaries Last Stand/Glass Cannon/Wildcard/Overkill/Reaper/Hair Trigger/
  Killing Spree/Eagle Eye(+40% range, v2.3.0 [115])/Veteran's Edge(+5% dmg per tower veteran rank, max +20%,
  v2.13.0 [123])/Phoenix(once-per-run revive +12 lives & field-knockback, v2.15.0 [125])/
  Warpath(+2% dmg per wave reached, max +40% — a back-loaded scaling axis, v2.47.0 [180])/
  Overwhelm(+8% dmg per DISTINCT tower type on the board, max +40% at 5 — a build-DIVERSITY axis, the inverse of Phalanx, v2.55.0 [202]); rares Targeting
  Array/Ambush/Capacitor/Surge Protector/Shaped Charges(pierce ⬢ Bastion blast-shells, v2.8.0 [120])/
  Retaliation(+25% dmg for 4s after a leak — a comeback rare, v2.39.0 [154])/
  Hardened Circuits(towers ignore the Suppressor/Distorter dampening auras — counter-content rare, v2.40.0 [158])/
  Spectral Sight(towers target & hit intangible enemies — counters phantom/cloak/teleporter/veil, counter-content rare, v2.41.0 [161])/
  Phalanx(+2% tower dmg per tower on the board, max +20% — a wide-build rare, v2.42.0 [165])/
  Finisher(+35% dmg to enemies below 40% HP — the closer bookend to Ambush's opener, v2.43.0 [167])/
  Point Blank(+25% dmg to enemies within half a tower's range — a positional axis, v2.45.0 [174])/
  Empowered Arsenal(Meteor/Freeze/Shockwave effects +40% — an ability-magnitude axis, v2.49.0 [185])/
  Corrosive Rounds(+30% dmg to poisoned enemies — a poison-synergy axis, buffs the weak Poison archetype, v2.50.0 [188])/
  Swarmbane(+1% tower dmg per live enemy, max +25% — a crowd-pressure/comeback axis, the mirror of Phalanx, v2.51.0 [191])/
  Aftershock(on a leak, knock the whole field backward — a defensive repositioning comeback, the sibling of Retaliation, v2.56.0 [205]);
  **Critical Mass**(+10% crit chance & ×1.5 crit DAMAGE — the crit-multiplier axis, v2.20.0 [130]).
  [41]/[51]/[65]/[70]/[75]/[78]/[82]/[89]/[93]/[94]/[104]/[115]/[120]/[123]/[125]/[130]/[154]/[161]/[167]/[174]/[191]/[205].
- 6 abilities (meteor/freeze/rush + Shockwave v1.67.0 [77] + Barrier v1.93.0 [101], faded v1.100.1 [108]
  + **📣 Amplify v2.48.0 [183]** — the first offensive-BUFF ability: +30% tower dmg & fire rate for 5s, cd 55, hotkey Y).
- 7 quick maps (classic/spiral/serpent + gauntlet v1.54.0 [68] + cascade v1.87.0 [95] + nexus v1.98.0 [105]
  + vortex v2.25.0 [135], inward-spiral funnel + Neon theme — 7th static palette);
  per-map themes v1.13.8 [28]. Campaign 40 levels; **auto-level-select v2.0.0** [109].
- Daily Challenge (date-seeded) v1.28.0 [47] + streak v1.31.0 [50] + preview v1.47.0; combo meter v1.7.0 [71].
- **♾️ Endless mode** v2.17.0 [127] (FEEDBACK): menu tile (quick-mode + `endless` flag, NOT a 3rd gameMode);
  banks the wave-30 win once then continues with no victory wall; resumable; additive save field (old saves → false).
  **Milestone drafts continue past wave 30** v2.34.0 [142] (FEEDBACK — they used to stop at the victory wave).

### Scoring / records / save
- End-of-run score+grade + restyled overlay v1.16.0 [31]; speed bonus v1.78.0; breakdown v1.62.0 [73].
- Records panel (waves [waves grid] + scores grid v1.61.0 [72]) v1.6.0; new-record flourish v1.6.1.
- Save/resume round-trips; winGame clears save v1.38.1 [56]; run timer persisted v1.74.0 [83].
- One-click Play Again v1.75.0 [84].

### Table-stakes (COMPLETE) — re-audited each health check
favicon/meta/OG (v1.8.6) · PWA install+offline (v1.30.0 [49]) · responsive/mobile (v1.14.0 [29] / v1.15.0 [30]) ·
touch/pointer (v1.16.3 [34]) · 44px tap targets (v1.46.0 [64]) · gamepad (v1.43.0 [61]) · keyboard a11y menus
(v1.19.0 [37]) + draft (v1.20.0 [38]) · colorblind aid (v1.18.0 [36]) · reduced-motion (v1.10.0) · volume slider
(v1.13.2 [25]) · high-DPI scaling (v1.17.0 [35]) · high-contrast mode (v2.38.0 [151]) · settings persistence
(shake/particles/grid/colorblind/high-contrast/vol/speed/default-mode/auto-wave [v2.38.0 153]).
**Re-audited v2.53.1** — every item above still present and working; `sw.js` cache version tracks
`GAME_VERSION` (test [49]); all five `JSON.parse` storage reads are try/catch-guarded, so a corrupted
`cd_save`/`cd_meta`/`cd_daily_streak` degrades to defaults instead of a white screen.
_New table-stakes can be added here as the bar rises:_
- [x] **Screen-reader announcements** — DONE v2.54.0 [201]. A visually-hidden `aria-live="polite"`
      `#srLive` region + an `announce()` helper (cd-core.js) narrate wave starts, leaked lives and the
      run ending. Deliberately sparse (no per-kill chatter). ~~*Possible follow-ups:* announce a badge
      unlock, a boss spawn, and the perk you drafted.~~ DONE v2.56.0 [206] — a boss entering the field
      (with its archetype), the drafted perk, and any achievement unlock (`announceAchievements()`) are
      now narrated too.
- [ ] **Key rebinding** — the hotkey set is now large (1–0, Q/W/E/R/T/Y, U/S/D/A/F/C, Space, Esc, Enter)
      and entirely fixed. A Settings remap row (persisted `cd_keys`, additive) is the natural follow-up.

### Tech / tooling (done)
- Domain-split into 7 `cd-*.js` classic scripts v1.8.1/v1.8.2 [12] (NEVER ES modules). GitHub Actions CI v1.71.1
  (headless Playwright on push/PR; independent of Pages deploy; no build step).
- Menu-revamp slices (COMPLETE, FEEDBACK closed v2.1.0): button hierarchy v1.39.1 [58] · PLAY sheen v1.41.0 [59] ·
  config card v1.42.0 [60] · hero header v1.45.0 [63] · ambient backdrop v1.69.0 [79] · hover polish v1.94.0 [102] ·
  grouped toolbar v2.0.0 · accent tiles v2.0.2 [112] · **dashboard layout v2.1.0 [113]** ·
  **full-column overlay v2.18.0 [128]** (FEEDBACK: menu moved to `#gameCol` so it spans the whole
  game height — campaign's 40-level grid no longer overflows into a scrollbar; `backToMenu` no longer
  hardcodes `display:flex` over the desktop grid).

## Vetoed by owner — do not re-add

_(Reverts / owner undo-commits land here with hash + one-liner. Never reintroduce these or anything
substantially similar without written owner request.)_

- None recorded yet. (Commit `4a66ba3` removed the **Scrapper** perk and cut rare draft chance to 14% —
  a routine maintainer balance commit, not an owner veto, but treat Scrapper's removal as intentional:
  don't re-add it without justification.)

## Prompt suggestions for the owner

_(The routine forbids the agent from editing its own scheduled-task instruction file, so process-change
requests land here for the owner to paste in.)_

- **Make visual verification a permanent health-check step** (owner FEEDBACK, done ad-hoc v1.14.1; can't
  durably codify it since editing the scheduled-task SKILL.md is blocked). Add a step **5** to the
  "Health check run" section of `circuit-defense-auto-improver/SKILL.md`:

  > 5. **Visual verification** — confirm the game *looks right and is playable* on **both a large display
  >    (≥1280px) and a phone (≤430px)** using the preview tools. `preview_screenshot` times out on this
  >    game (the rAF loop keeps the page busy), so verify layout with `preview_inspect` bounding-box /
  >    computed-style reads + `preview_eval`. At each size assert: no horizontal page overflow; every menu
  >    (talents/achievements/records/settings/start/overlay/draft) opens on-screen and scrolls; What's New
  >    sits where intended; an in-game quick run shows canvas + HUD + shop + controls within the viewport
  >    with a board that isn't uselessly tiny. File precise px measurements to ROADMAP for anything wrong;
  >    clean up test state afterwards.

- **Resolve the norm-HP-curve tension** — the encoded test-`[16]` invariant (≤25% vs the coeff-1.0 baseline,
  which pins the `w^1.9` coeff at `1.25`) conflicts with the old aspiration to push toward "~1.55". Decide
  one: keep the invariant (raise late difficulty only via boss/economy/new-content levers) or rebaseline it.
