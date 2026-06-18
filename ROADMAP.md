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

### Content & variety
- [ ] **Map: "Crossroads"** — a path that forks and rejoins, or two simultaneous lanes. Bigger
      lift: needs multi-path enemy distribution + targeting/`distToPath` over >1 path. Its own run.
      (All SEVEN static `THEMES` palettes are now claimed as map identities — an 8th *named* map needs a
      brand-new palette; but Crossroads could reuse one or get an 8th.)
- [x] **New single-path map (the 🌀 Vortex)** — DONE v2.25.0 [135], a rectangular inward-spiral kill-funnel
      with a new Neon (hot-magenta) palette (7th map / 7th theme).
- [x] **New tower (the 🔆 Laser)** — DONE v2.9.0 [121], a ramp-up beam (the 10th tower). The
      "charge up the longer it fires" mechanic now exists as a TOWER (was sketched as a Railgun spec idea).
- [ ] **Arc/chain tower** — chain-lightning that *bounces* between nearby enemies (a swarm counter,
      distinct from Tesla's fixed-target chain AND the Laser's single-target ramp). The remaining "new tower" idea.
- [ ] **Tower spec follow-ups** — (a *charge-up* mechanic now exists via the 🔆 Laser tower v2.9.0);
      ~~explosion-penetration vs ⬢ Bastion~~ (DONE as the 💣 Shaped Charges *perk* v2.8.0 [120]; a *spec*
      version is still open if wanted); a predictive lead-shot spec to counter blinkers
      (phantom/cloak/teleporter). Audit frost (Deep Freeze vs Shatter) & gun (Minigun vs AP) for a
      strictly-dominated option (quick take: both look like healthy axes).
- [ ] **Boss/enemy follow-ups** — a 17th boss archetype (16th = 🩶 Suppressor fire-rate dampening aura,
      shipped v2.16.0 [126]; 15th = 🟡 Warlord global armor-rally v2.14.0 [124]); per-campaign-tier *fixed*
      archetypes (vs the wave-number cycle); a Breacher variant that costs lives only if it *survives* a tower's range.
- [ ] **Perk/ability follow-ups** — (revival/comeback legendary 🌅 Phoenix DONE v2.15.0 [125] — cheat death
      once, revive + field-knockback; legendary +40% range 🦅 Eagle Eye DONE v2.3.0 [115]; expanding shock-ring
      render DONE v2.5.0 [117], now also reused on Meteor impact; Barrier-charges talent 🧱 Aegis DONE v2.6.0
      [118]); a per-tower ability; a meta talent version of Capacitor (ability-cooldown — note: ⚡ Surge talent
      already does −6%/rank ability cd, so this would overlap); a Barrier *cooldown*-shortening talent (the
      other Barrier lever, distinct from Aegis's charges); a hidden unlock condition for a secret legendary.
- [ ] **Mayhem wave-mod follow-ups** — a genuinely new *path swap* (direction reverses); a stronger
      ×1.6 double-speed variant of `frenzy`. (Pool is 20 mods; most axes covered.)
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
      - **Quick-mode `lateScale` (v2.0.0)** is the newest late lever (hard cap +25%, nightmare cap +40%);
        Normal/Easy/Campaign exempt so test `[16]` stays safe. Room to tune the ramp ≤25%/run.
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
- [ ] **Small polish follow-ups** — slide-in animation on overlay buttons (note: R is already Shockwave —
      a quick-restart hotkey needs a free key, e.g. Enter on the game-over overlay);
      hide the faint between-wave `Next:` preview while the upgrade panel is open;
      ~~highlight the beaten Records cell when next opened~~ (DONE v2.22.0 [132] — latest-PB cell tinted gold + ★);
      a per-kind hover tooltip + DPS-relative read on the wave-threat number;
      ~~visible grid lines (not just dots) + a "snap" tick sound~~ (DONE v2.24.0 [134] — full grid lines +
      target-cell highlight + a `SFX.tick()` on cell-cross while placing); combo-tier shape/label + high-contrast mode;
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
- [ ] **Split the test harness file** — `tests/run-tests.mjs` is **~9,392 lines (~134 groups, 1445
      assertions)**, by far the largest file in the repo, growing ~75 lines/run. Could split per-group into
      `tests/groups/*.mjs` with a small runner. Dev-only, suite green ~35s. Worth doing before it doubles.
- [ ] **Expand harness coverage** — abilities (meteor/freeze/rush/shock/barrier), spec selection at L5,
      mayhem path-shift on resume. (Campaign next-level flow now covered by [109].)
- [ ] **Audit tests for draft-RNG flakiness** — the harness auto-picks draft card `[0]`; any test asserting
      a numeric gold/dmg bound *after* a draft can flake if a gold/power perk lands in slot 0. v1.20.2 fixed
      group [32] by asserting the pre-draft economy. Sweep other run-driving groups; pin to pre-draft/perk-neutral.

## Shipped (condensed — do NOT re-implement; check CLAUDE.md for detail)

### Towers / specs / targeting
- 11 towers (gun/sniper/frost/cannon/tesla/poison + Mortar v1.23.0 [42] + Railgun v1.83.0 [91] + Laser
  v2.9.0 [121] + Pulsar v2.23.0 [133]); a new tower is mostly additive (`TOWER_TYPES`+`SPECS`+optional mastery talent). Mortar
  lobbed-arc render v1.79.0 [87]. Laser = a ramp-up beam (×1→×2.2 on a held target, resets on switch) —
  sustained boss/tank DPS, poor at swarms; specs Focusing Array/Pulse Drive; hotkey `0`; mastery_laser.
  Pulsar = a self-centred radial AoE pulse (`proj:'nova'`, hits ALL in range at once, low per-hit dmg →
  swarm-clearer, poor vs bosses; the inverse of the Laser); specs Overload/Resonance; no number hotkey; mastery_pulsar.
- 6 targeting modes (first/last/strong/close + Weak v1.70.0 [80] + Support v1.49.0 [66]); default-mode
  device pref v1.89.0 [97]. Spec rework v1.10.0 (Network/Mega/Poison), Executioner buff v1.26.0,
  Superconductor falloff 0.7→0.8 v1.55.0 [17]. Railgun Penetrator nerfed +35%→+20% v2.0.0 [109].
- Tower veterancy (cosmetic kill-rank pips) v1.100.0 [107].

### Enemies / bosses / waves
- 13 enemy kinds (+boss): + heal/shield/split/molten(v1.77.0 [86])/phantom(v1.9.0 [14])/bastion(v1.90.0 [98])/
  warden(v1.35.0 [52])/jammer(v1.91.0 [99])/breacher(v1.63.0 [74], leak-cost 2→3 v2.0.0)/herald(v2.4.0 [116],
  haste-aura, Enrager's regular-enemy cousin). Concurrent waves (up to 3) v1.12.0 [20].
- 16 boss archetypes from w20+ (regen→summoner→bulwark→enrager→teleporter→berserker→disruptor→juggernaut→
  siphon→hydra→revenant→conduit→warper→fortifier→warlord→suppressor) v1.25.0–v2.16.0 [45]/[53]/[90]/[96]/[114]/[119]/[122]/[124]/[126]; boss-bar mechanic badge v1.36.0 [53].
- 20 Mayhem wave mods (frenzy/swarm/titans/goldrush/drought/surge/fog/armored/brownout/regen/emp/wardens/
  adrenaline/heatwave/cloak/fission/breachers/jammers/bastions/meteors) [46]+ many.

### Difficulty / progression / meta
- 4 difficulties: easy/normal/hard + **🌑 Nightmare v2.0.0** [109] (top tier, 2.2× chips, never in Daily).
- Quick-mode `lateScale` on hard/nightmare v2.0.0 [109] (progressive late HP, capped, Normal/Campaign exempt).
- 26 talents (CORE + 8 masteries + mastery_mortar v1.23.0 + mastery_rail v1.83.0 + mastery_laser v2.9.0
  + mastery_pulsar v2.23.0 + Farsight range v1.92.0 [100] + Aegis Barrier-charges v2.6.0 [118]);
  cost rework v1.38.0 [55]. 19 achievements (+ Nightmare Walker v2.0.0 + 🏵️ Living Legend v2.19.0 [129] —
  reach a tower's top Legend veterancy rank; lifetime tower-kills stat in Records); roster data-driven [48]/[92].
- Run perks w/ rarity drafts; legendaries Last Stand/Glass Cannon/Wildcard/Overkill/Reaper/Hair Trigger/
  Killing Spree/Eagle Eye(+40% range, v2.3.0 [115])/Veteran's Edge(+5% dmg per tower veteran rank, max +20%,
  v2.13.0 [123])/Phoenix(once-per-run revive +12 lives & field-knockback, v2.15.0 [125]); rares Targeting
  Array/Ambush/Capacitor/Surge Protector/Shaped Charges(pierce ⬢ Bastion blast-shells, v2.8.0 [120]);
  **Critical Mass**(+10% crit chance & ×1.5 crit DAMAGE — the crit-multiplier axis, v2.20.0 [130]).
  [41]/[51]/[65]/[70]/[75]/[78]/[82]/[89]/[93]/[94]/[104]/[115]/[120]/[123]/[125]/[130].
- 5 abilities (meteor/freeze/rush + Shockwave v1.67.0 [77] + Barrier v1.93.0 [101], faded v1.100.1 [108]).
- 7 quick maps (classic/spiral/serpent + gauntlet v1.54.0 [68] + cascade v1.87.0 [95] + nexus v1.98.0 [105]
  + vortex v2.25.0 [135], inward-spiral funnel + Neon theme — 7th static palette);
  per-map themes v1.13.8 [28]. Campaign 40 levels; **auto-level-select v2.0.0** [109].
- Daily Challenge (date-seeded) v1.28.0 [47] + streak v1.31.0 [50] + preview v1.47.0; combo meter v1.7.0 [71].
- **♾️ Endless mode** v2.17.0 [127] (FEEDBACK): menu tile (quick-mode + `endless` flag, NOT a 3rd gameMode);
  banks the wave-30 win once then continues with no victory wall; resumable; additive save field (old saves → false).

### Scoring / records / save
- End-of-run score+grade + restyled overlay v1.16.0 [31]; speed bonus v1.78.0; breakdown v1.62.0 [73].
- Records panel (waves [waves grid] + scores grid v1.61.0 [72]) v1.6.0; new-record flourish v1.6.1.
- Save/resume round-trips; winGame clears save v1.38.1 [56]; run timer persisted v1.74.0 [83].
- One-click Play Again v1.75.0 [84].

### Table-stakes (COMPLETE) — re-audited each health check
favicon/meta/OG (v1.8.6) · PWA install+offline (v1.30.0 [49]) · responsive/mobile (v1.14.0 [29] / v1.15.0 [30]) ·
touch/pointer (v1.16.3 [34]) · 44px tap targets (v1.46.0 [64]) · gamepad (v1.43.0 [61]) · keyboard a11y menus
(v1.19.0 [37]) + draft (v1.20.0 [38]) · colorblind aid (v1.18.0 [36]) · reduced-motion (v1.10.0) · volume slider
(v1.13.2 [25]) · high-DPI scaling (v1.17.0 [35]) · settings persistence (shake/particles/grid/colorblind/vol/speed/
default-mode). _New table-stakes can be added here as the bar rises._

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
