'use strict';
// ================= Update =================
let abilityUiAcc = 0;
// Deep-wave mechanic scaling (v2.32.0, FEEDBACK follow-up to the v2.31.0 HP ramp): enemy
// ABILITIES/AURAS — regen tick %, summoner add cap, the warden/herald/enrager aura radii, and
// the siphon drain — grow with wave DEPTH so deep Endless keeps pressuring DPS/coverage instead
// of plateauing while the HP ramp does all the work (owner: "scale them with wave, not just HP").
// A pure function of the current `wave`: 1.0 through wave 40 (so early/mid is byte-identical —
// the owner said early/mid is "good"), then +1.5%/wave, CAPPED at +60% (reached at wave 80).
// Bounded by design — it scales the EXISTING bounded pressure (regen still beatable by DPS, a
// bigger aura is still a focus-fire decision, more adds are still weak), never adds raw HP, so it
// can't break the invariant-capped HP curve and stays "too easy"-safe. Reads the global `wave`
// (consistent with the siphon drain, which already wave-scaled); enemies don't carry their own
// wave. Deep waves are only reachable in Endless / deep Campaign, so normal quick runs (≤w30) and
// every focused mechanic test (which runs at wave 0 after beginGame) are unaffected.
function enemyMechScale() {
  return 1 + Math.min(0.6, Math.max(0, wave - 40) * 0.015);
}
// 🗯️ Retaliation perk (v2.39.0) levers: how much extra damage the comeback buff grants and how
// long it lasts after each leak. Transient (run-only `perkState.retaliateT`), armed at the leak
// site and read in the fire loop; "too easy"-safe (only ever fires while you're losing lives).
const RETALIATE_DMG = 1.25;   // tower damage multiplier while the buff is active
const RETALIATE_DUR = 4;      // seconds the buff lasts (refreshed by each fresh leak)
// ---- Boss-archetype tick levers (read by update()'s enemy loop below) ----
// Relocated here from cd-update.js's old combat section when the combat helpers moved out to
// cd-combat.js (v2.53.2) — these are read only by the archetype tick blocks in update(). The
// levers read by damage() (WARLORD_ARMOR / ABSORB_CAP / ADAPT_REDUCTION) live in cd-combat.js.
// Fortifier boss archetype (v2.10.0) levers: it ramps its own armor by FORTIFY_RATE/s up to a
// FORTIFY_CAP bonus over its starting armor, so it hardens the longer it survives (a DPS race).
const FORTIFY_RATE = 0.5;        // armor gained per second alive
const FORTIFY_CAP = 40;          // max bonus armor over the boss's starting armor (~80s to cap)
// Suppressor boss archetype (v2.16.0) lever: the radius of its fire-rate dampening aura. A non-buff
// tower within it reloads +25% slower (effRate's `t.suppressed` factor — a localized `brownout`).
const SUPPRESS_RANGE = 130;      // px reach of the suppression aura (matches the warper/conduit aura reach)
// Distorter boss archetype (v2.30.0, the 18th) lever: the radius of its tower-RANGE dampening aura. A
// non-buff tower within it has its firing range cut 20% (effRange's `t.distorted` factor — a localized
// `fog`), opening a coverage gap near the boss. Distinct axis from the Suppressor (fire rate vs range).
const DISTORT_RANGE = 130;       // px reach of the range-distortion aura (matches the suppressor aura reach)
// Nullifier boss archetype (v2.53.0, the 24th) lever: the radius of its tower-DAMAGE dampening aura. A
// non-buff tower within it deals 25% less damage (effDmg's `t.dampened` factor ×0.75). Completes the
// tower-debuff trio after the Suppressor (fire rate) and Distorter (range); 🔰 Hardened Circuits negates it.
const NULLIFY_RANGE = 130;       // px reach of the damage-dampening aura (matches the suppressor/distorter reach)
// Custodian boss archetype (v2.35.0) lever: it refreshes the warden damage-shield (warded → ×0.6 / −40%)
// on every nearby non-boss ally within this reach (×enemyMechScale, so it widens with wave depth like the
// warden/herald/enrager auras). The shield itself reuses the warden factor in damage(); only the radius lives here.
const CUSTODIAN_RANGE = 115;     // px reach of the protective ward aura
// Veil boss archetype (v2.36.0, the 20th) lever: the reach of its intangibility aura — it tags every
// nearby non-boss ally within this radius (×enemyMechScale) with the persistent `cloak` flag, handing
// them to the existing cloak machinery (periodic brief untargetability). Adds no HP/speed; freeze pauses it.
const VEIL_RANGE = 115;          // px reach of the cohort-cloak (intangibility) aura
// Accelerator boss archetype (v2.41.0, the 21st) levers: a self-SPEED ramp over time-alive — the
// longer the fight drags, the faster it moves (a pure DPS-race lever: burst it before it hits its
// stride and sprints to the exit). Distinct from the berserker (HP-linked accel) and the enrager/
// herald (aura-linked): this ramps purely with how long it survives. Ticked in the gated block so
// FREEZE pauses the ramp, and the movement line reads e.accelMul (slowMul zeroes it under freeze,
// frost slow multiplies in). Bounded: base boss speed is 0.45×, so even at the +80% cap (0.81×) it
// stays slower than a basic enemy — beatable, adds NO HP. Run-only `accelMul`/`accelCd`, never saved.
const ACCEL_RATE = 0.05;         // +speed multiplier per second alive (reaches cap in ~16s)
const ACCEL_CAP  = 1.8;          // max self-speed multiplier (+80%)
// Cleanser boss archetype (v2.42.0, the 22nd) lever: the reach of its anti-debuff purge. Every ~2.5s
// it PURGES the soft debuffs (poison DoT + frost slow) from itself and its nearby non-boss cohort
// within this radius (×enemyMechScale, like the warden/custodian/veil auras) — a fresh axis, since no
// other archetype/enemy removes poison. Deliberately does NOT clear `frozen`, so FREEZE stays the
// counter (and, ticking in the gated frozen<=0 block, a frozen Cleanser can't purge). Bounded/"too
// easy"-safe: adds NO HP or speed, only strips the player's DoT/slow advantage; periodic (not every
// frame) so poison/slow can re-accumulate between pulses. Run-only `cleanseCd`, never persisted.
const CLEANSE_RANGE = 115;       // px reach of the debuff-purge pulse
function update(dt) {
  if (gameOver || paused || !started || draftOpen) return;
  gameTime += dt;
  if (gold > peakGold) peakGold = gold;   // 💰 Hoarder feat tracking (v2.35.0)
  if (towers.length > peakTowers) peakTowers = towers.length;   // 🗼 Overlord feat tracking (v2.39.0)

  // ability cooldowns
  for (const k of Object.keys(abilityCd)) abilityCd[k] = Math.max(0, abilityCd[k] - dt);
  // 🛡️ Barrier charges fade after BARRIER_DURATION (v1.100.1): unused charges expire so the
  // leak-prevention doesn't last forever (owner FEEDBACK). Ticks only while charges are banked
  // and only during live play (this is past update()'s pause/draft/gameOver early-return).
  if (barrierCharges > 0) {
    barrierTimer = Math.max(0, barrierTimer - dt);
    if (barrierTimer <= 0) {
      barrierCharges = 0;
      addFloater(W/2, H/2, '🛡️ Barrier faded', '#8b949e', 18);
    }
  }
  // 📣 Amplify tower-overdrive buff (v2.48.0): decay the timer while playing (past the
  // pause/draft/gameOver early-return, so the buff pauses with the game). effDmg/effRate
  // read overdriveT>0; a brief floater cues when it wears off.
  if (overdriveT > 0) {
    overdriveT = Math.max(0, overdriveT - dt);
    if (overdriveT <= 0) addFloater(W/2, H/2, '📣 Amplify faded', '#8b949e', 18);
  }
  abilityUiAcc += dt;
  if (abilityUiAcc > 0.25) {
    abilityUiAcc = 0; refreshAbilityBar();
    const te = document.getElementById('time'); if (te) te.textContent = fmtTime(gameTime); // live HUD clock
  }

  if (autoStartTimer > 0 && !waveActive) {
    autoStartTimer -= dt;
    document.getElementById('startBtn').textContent = `▶ Start Wave ${wave+1} (${Math.ceil(autoStartTimer)}s)`;
    if (autoStartTimer <= 0) startWave();
  }

  // friendly meteor shower (mayhem modifier or Orbital Support legendary)
  if (waveActive && (modIs('meteors') || perkState.orbital)) {
    meteorRainTimer -= dt;
    if (meteorRainTimer <= 0) {
      meteorRainTimer = modIs('meteors') ? 3.5 : 8;
      const alive = enemies.filter(e => e.x !== undefined && !e.dead);
      if (alive.length) {
        const tgt = alive[Math.floor(Math.random() * alive.length)];
        const dmg = 50 + wave * 7;
        shake = Math.max(shake, 6);
        SFX.bomb();
        addExplosion(tgt.x, tgt.y, '#ff7b42', 18, 160);
        for (const e of alive) {
          if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < 65) damage(e, dmg, null);
        }
      }
    }
  }

  // Static Storm (mayhem modifier): periodically knock a random firing tower offline for a
  // couple of seconds, so coverage gaps roam the board — pressures tower uptime/redundancy
  // rather than enemy HP (the norm-HP curve is invariant-capped). Run-only `t.empT` timer.
  if (waveActive && modIs('emp')) {
    empStrikeTimer -= dt;
    if (empStrikeTimer <= 0) {
      empStrikeTimer = 3.5;
      const online = towers.filter(t => t.type !== 'buff' && !(t.empT > 0));
      if (online.length) {
        const t = online[Math.floor(Math.random() * online.length)];
        t.empT = 2.2;
        shake = Math.max(shake, 5);
        SFX.zap();
        addExplosion(t.x, t.y, '#7df9ff', 12, 130);
      }
    }
  }

  // spawning — every in-flight wave is a parallel spawner, so concurrent waves spawn
  // simultaneously. Drained spawners are removed once empty.
  if (waveActive) {
    for (const sp of spawners) {
      if (!sp.queue.length) continue;
      sp.timer -= dt;
      if (sp.timer <= 0) {
        const e = sp.queue.shift();
        enemies.push({...e, dist: 0, slow: 0, slowF: 0.6, frozen: 0, poison: null, flash: 0, px: 0, py: 0});
        sp.timer = e.gap;
      }
    }
    spawners = spawners.filter(sp => sp.queue.length);
  }

  // enemies
  const mechScale = enemyMechScale();   // deep-wave ability/aura scaling (v2.32.0), 1.0 through wave 40
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.frozen = Math.max(0, (e.frozen || 0) - dt);
    e.hasted = Math.max(0, (e.hasted || 0) - dt);   // enrager haste aura (v1.34.0), decays when out of range
    e.warded = Math.max(0, (e.warded || 0) - dt);   // warden damage-shield aura (v1.35.0), decays out of range / when the warden dies
    e.rallied = Math.max(0, (e.rallied || 0) - dt);  // warlord boss global armor rally (v2.14.0), decays the instant the warlord dies/freezes
    // juggernaut boss (v1.56.0): IMMUNE TO CROWD CONTROL — shrug off freeze + frost slow every
    // frame (before slowMul is computed below) so the Freeze ability and Frost towers can't lock it
    // down. A fresh pressure axis — none of the other archetypes touch CC — that also answers the
    // documented Frost-snowball balance concern: a freeze/frost-reliant build needs real DPS for
    // this one. Unconditional (mirrors the teleporter blinkInvuln decay) so it never sticks; base
    // 0.45× boss speed keeps it bounded/beatable, and it has no other mechanic (its whole gimmick
    // is being unstoppable). Run-only field — enemies are never persisted.
    if (e.kind === 'boss' && e.bossType === 'juggernaut') { e.frozen = 0; e.slow = 0; }
    // Conduit boss (v2.2.0): a frozen conduit drops its escort shield — clear the guard
    // unconditionally so the gated tick (which is skipped while frozen) can't leave a stale
    // shield up. Makes freeze a clean counter (freeze it → it takes full damage), consistent
    // with freeze pausing every archetype mechanic. Run-only field, never persisted.
    if (e.kind === 'boss' && e.bossType === 'conduit' && e.frozen > 0) e.conduitGuard = 0;
    // Heatwave wave mod (mayhem, v1.66.0): every tagged enemy + boss is IMMUNE TO CROWD CONTROL —
    // shrug off freeze + frost slow every frame (before slowMul, mirroring the juggernaut line
    // above), so the Freeze ability and Frost towers can't lock the wave down. A fresh axis: none
    // of the other 14 mods touch CC, and it pressures the documented Frost/booster snowball (a
    // freeze/frost-reliant build needs real DPS this wave). Bounded — it adds no HP/speed, only
    // removes the player's CC advantage, so it can never make a run easier (re: the "too easy"
    // feedback). Tagged at spawn in buildWave (run-only, never saved), so concurrent waves each
    // keep their own mod (like regen/adrenaline).
    if (e.ccImmune) { e.frozen = 0; e.slow = 0; }
    let slowMul = perkState.slowGlobal;
    if (e.frozen > 0) slowMul = 0;
    else if (e.slow > 0) {
      const base = e.kind === 'boss' ? 0.8 : (e.slowF || 0.6);
      slowMul *= Math.max(0.1, base - perkState.slowBonus);
    }
    e.slow = Math.max(0, e.slow - dt);
    if (e.poison && e.poison.t > 0) {
      e.poison.t -= dt;
      damage(e, e.poison.dps * dt, e.poison.src, true);
    }
    if (e.dead) continue;
    // phantom: periodically blink forward along the path, briefly untargetable —
    // punishes slow single-target towers (the shot lands where it no longer is)
    if (e.kind === 'phantom') {
      e.blinkInvuln = Math.max(0, (e.blinkInvuln || 0) - dt);
      if (e.frozen <= 0) {
        e.blinkCd = (e.blinkCd == null ? 1.8 : e.blinkCd) - dt;
        if (e.blinkCd <= 0) {
          e.blinkCd = 2.0;
          e.blinkInvuln = 0.35;
          if (e.x !== undefined) addExplosion(e.x, e.y, '#39d0d8', 7, 80);
          e.dist += 58;
          SFX.blink();
        }
      }
    }
    // Cloaking Field wave mod (mayhem, v1.72.0): every tagged enemy + boss periodically PHASES
    // OUT — briefly intangible (untargetable + immune, reusing the phantom `blinkInvuln` check in
    // pickTarget()/damage()), so a shot that lands while it's cloaked simply misses. The wave-wide
    // cousin of the phantom enemy on a fresh COVERAGE/UPTIME axis (none of the other 15 mods make
    // enemies untargetable); slow burst single-target towers suffer most, rapid towers least. Unlike
    // the phantom it does NOT teleport forward — pure intangibility, adding no speed/HP, so it can
    // never make a run easier (re: the recurring "too easy" feedback). `blinkInvuln` decays
    // unconditionally so an enemy frozen mid-cloak always becomes hittable again; the cloak TRIGGER
    // is paused by freeze (like phantom's blinkCd). Phantoms / teleporter bosses already own
    // `blinkInvuln`, so they're excluded to avoid decaying it twice per frame. Tagged at spawn in
    // buildWave (run-only, never saved), so concurrent waves each keep their own mod (like regen).
    if (e.cloak && e.kind !== 'phantom' && !(e.kind === 'boss' && e.bossType === 'teleporter')) {
      e.blinkInvuln = Math.max(0, (e.blinkInvuln || 0) - dt);
      if (e.frozen <= 0) {
        e.cloakCd = (e.cloakCd == null ? 2.5 : e.cloakCd) - dt;
        if (e.cloakCd <= 0) {
          e.cloakCd = 2.5;
          e.blinkInvuln = 0.45;
          if (e.x !== undefined) addExplosion(e.x, e.y, '#b98cff', 5, 60);
          SFX.blink();
        }
      }
    }
    e.px = e.x; e.py = e.y;
    // enrager haste aura (v1.34.0): an enraged enemy moves +35% faster. slowMul already
    // zeroes frozen movement, and frost slow multiplies in, so freeze/slow still counter it.
    const hasteMul = e.hasted > 0 ? 1.35 : 1;
    // berserker boss (v1.50.0): a wounded berserker accelerates, scaling its own speed with
    // missing HP up to +60% at death — a "race to burst it before it sprints to the exit" lever.
    // Computed inline (no ticked field); slowMul still zeroes it under freeze, so freeze counters
    // it like every other archetype, and frost slow multiplies in. Base boss speed is 0.45×, so
    // even a fully-raging berserker (0.72×) stays slower than a basic enemy — bounded + beatable.
    const berserkMul = (e.kind === 'boss' && e.bossType === 'berserker')
      ? 1 + 0.6 * Math.max(0, 1 - e.hp / e.maxHp) : 1;
    // Adrenaline wave mod (mayhem, v1.58.0): a tagged enemy accelerates as it loses HP,
    // up to +50% speed at near-death — the wave-wide cousin of the berserker boss, on a
    // fresh axis (HP-linked acceleration across the WHOLE wave; none of the other 13 mods
    // do this — frenzy is a flat speed bump). Pressures chip-damage builds (a wounded but
    // not-yet-dead enemy sprints for the exit, so you must burst it down) without raw HP,
    // per the recurring "too easy" feedback. Computed inline like berserkMul; slowMul zeroes
    // it under freeze (freeze counters it) and frost slow multiplies in. Because it ramps
    // from 0 with missing HP, the average over an enemy's life is well under frenzy's flat
    // +35% — bounded + beatable. Tagged at spawn in buildWave (run-only, never saved).
    const adrenalineMul = e.adrenaline ? 1 + 0.5 * Math.max(0, 1 - e.hp / e.maxHp) : 1;
    // accelerator boss (v2.41.0): ramps its own speed with time alive (e.accelMul, ticked in the
    // gated block below, capped at ACCEL_CAP). Read inline like berserkMul; slowMul zeroes it under
    // freeze (which also pauses the ramp), frost slow multiplies in — so freeze/slow still counter it.
    const accelBossMul = (e.kind === 'boss' && e.bossType === 'accelerator') ? (e.accelMul || 1) : 1;
    e.dist += e.spd * slowMul * hasteMul * berserkMul * adrenalineMul * accelBossMul * dt;
    const p = pointAt(e.dist);
    e.x = p.x; e.y = p.y;
    if (e.kind === 'heal' && e.frozen <= 0) {
      for (const o of enemies) {
        if (o === e || o.dead || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x-e.x, o.y-e.y) < 70) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.04 * mechScale * dt);
      }
    }
    // Warden support enemy (v1.35.0): projects a protective aura that refreshes a short
    // `warded` timer on nearby enemies each frame; a warded enemy takes 40% less damage
    // (applied in damage()). The timer decays once a target leaves the aura or the warden
    // dies, so popping the warden immediately unshields its cluster — a focus-fire / AoE
    // decision that pressures DPS without raw HP (re: the recurring "too easy" feedback).
    // Other wardens are EXCLUDED so a warden is always killable, and frozen wardens pause
    // (freeze counters it, like heal/boss mechanics). Run-only — enemies are never saved.
    if (e.kind === 'warden' && e.frozen <= 0) {
      for (const o of enemies) {
        if (o === e || o.dead || o.kind === 'warden') continue;
        if (Math.hypot(o.x-e.x, o.y-e.y) < 75 * mechScale) o.warded = 0.25;
      }
    }
    // Herald support enemy (v2.4.0): the REGULAR-enemy cousin of the Enrager boss — projects a
    // HASTE aura that speeds nearby allies, reusing the existing e.hasted/hasteMul infrastructure
    // (the Enrager boss already sets e.hasted, and the movement line reads hasteMul = 1.35 while
    // hasted). Refresh a short `hasted` timer on every nearby non-herald enemy each frame; it decays
    // once a target leaves the aura or the herald dies, so popping the herald slows the whole cluster
    // back to base speed — a focus-fire / target-priority decision (like the Warden's shield aura)
    // that raises pressure off the invariant-capped HP curve, in ALL modes. Other heralds EXCLUDED
    // so a herald is always at base speed, and frozen heralds pause (freeze counters it, like the
    // heal/warden auras; frost slow also still multiplies into hasteMul). Bounded — the haste is
    // capped at +35% and binary (no stacking) — so it can't make a run easier. Run-only — never saved.
    if (e.kind === 'herald' && e.frozen <= 0) {
      for (const o of enemies) {
        if (o === e || o.dead || o.kind === 'herald') continue;
        if (Math.hypot(o.x-e.x, o.y-e.y) < 90 * mechScale) o.hasted = 0.25;
      }
    }
    // Jammer enemy (v1.91.0): the REGULAR-enemy cousin of the Disruptor boss / Static Storm mod.
    // Every ~3s it knocks the NEAREST firing tower within 105px offline (sets t.empT) as it
    // advances, so a small coverage blackout rolls down the path with it — pressuring tower
    // UPTIME/coverage on a fresh axis (not the invariant-capped HP curve), in ALL modes. Reuses the
    // Static Storm `empT` infra: the firing-skip, per-frame decay, and render dim/⚡ ring are all
    // general (not mod-gated), so this pulse is the only new code. Bounded: one tower per pulse, a
    // SHORT 1.6s disable, buff towers immune (always), and the tower self-recovers (empT decays
    // unconditionally) even if the jammer dies mid-disable. Freeze pauses it (gated frozen<=0), like
    // the heal/warden auras. The 105px reach keeps it a LOCAL threat (space your towers / focus the
    // jammer to counter it). Run-only lazy timer — enemies are never saved, so no migration.
    if (e.kind === 'jammer' && e.frozen <= 0) {
      e.jamCd = (e.jamCd == null ? 2 : e.jamCd) - dt;
      if (e.jamCd <= 0) {
        e.jamCd = 3;
        let best = null, bd = 105*105;
        for (const t of towers) {
          if (t.type === 'buff' || t.empT > 0) continue;
          const d2 = (t.x-e.x)*(t.x-e.x) + (t.y-e.y)*(t.y-e.y);
          if (d2 < bd) { bd = d2; best = t; }
        }
        if (best) {
          best.empT = 1.6;
          addExplosion(best.x, best.y, '#7df9ff', 10, 120);
          addExplosion(e.x, e.y, '#7df9ff', 5, 80);
          SFX.zap();
          shake = Math.max(shake, 4);
        }
      }
    }
    // Regeneration wave mod (mayhem, v1.33.0): every tagged enemy self-heals 2%/s of its
    // max HP while alive — pressures under-investment in DPS without adding raw HP (re: the
    // recurring "too easy" feedback). Tagged at spawn in buildWave (run-only, never saved),
    // so concurrent waves each keep their own mod; freeze pauses it (like heal/boss-regen).
    if (e.regen && e.frozen <= 0 && !e.dead) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * mechScale * dt);
    // teleporter boss (v1.40.0): decay the post-blink intangibility EVERY frame — even while
    // frozen — so a boss frozen mid-blink can't get stuck permanently invulnerable (the blink
    // trigger itself is paused by freeze in the gated block below, like phantom's blinkCd).
    if (e.kind === 'boss' && e.bossType === 'teleporter') e.blinkInvuln = Math.max(0, (e.blinkInvuln || 0) - dt);
    // boss archetypes (v1.25.0; enrager v1.34.0; teleporter v1.40.0): late bosses (w20+) carry a mechanic on top of HP —
    //   regen      : self-heal 1.2%/s of max HP (punishes under-investment)
    //   bulwark    : cycles a 2s damage-soak shield (×0.4 incoming) every ~8s
    //   summoner   : periodically spawns weak adds behind it (up to 8 total)
    //   enrager    : haste aura — nearby enemies move +35% faster (pressures DPS/timing, no HP)
    //   teleporter : blinks ~80px forward every ~4s, briefly intangible mid-jump — skips tower
    //                coverage so the damage window shrinks and it reaches the exit faster
    //   berserker  : accelerates as it loses HP (up to +60% speed at death, in the movement line
    //                above) — pulses a roar here once wounded; race to burst it before it sprints
    //   disruptor  : every ~4s knocks the nearest firing tower offline (reuses the emp `empT`
    //                timer) — a coverage gap roams with it, pressuring tower uptime, not HP
    //   juggernaut : immune to freeze/slow (cleared unconditionally above, before slowMul) — a
    //                CC pressure axis; freeze/frost can't lock it down, so it needs raw DPS
    //   siphon     : drains the player's GOLD every ~3.5s while alive (floored at 0) — a fresh
    //                ECONOMIC pressure axis (no other archetype touches gold); kill it fast or it bleeds you
    //   warper     : every ~5s yanks nearby allies 30px FORWARD along the path (the offensive
    //                inverse of the player's Shockwave) — pressures coverage/leak, adds no HP/speed
    //   fortifier  : ramps its OWN armor over time (a DPS race), capped, freeze pauses it
    //   warlord    : the first GLOBAL aura — grants flat bonus armor to the WHOLE wave while alive
    //                (kill the keystone to strip it); checks the cheap high-rate-low-dmg build, no HP/speed
    //   suppressor : a continuous fire-rate DAMPENING aura — every nearby tower reloads +25% slower
    //                (a "localized brownout"; soft multi-tower counterpart to the disruptor's hard EMP)
    //   absorber   : caps per-hit damage at maxHp×5% (the cap lives in damage(); freeze lifts it)
    //   distorter  : a continuous tower-RANGE dampening aura — every nearby tower's range shrinks 20%
    //                (a "localized fog"; opens coverage/leak gaps, the range sibling of the suppressor)
    // Frozen bosses pause their mechanic (freeze counters it, like heal/phantom). Juggernaut is the
    // exception by design — it can never be frozen, so its CC immunity above runs every frame.
    // All fields are run-only and lazily initialised, so nothing touches save state.
    if (e.kind === 'boss' && e.bossType && e.frozen <= 0) {
      if (e.bossType === 'regen') {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * mechScale * dt);
      } else if (e.bossType === 'bulwark') {
        if (e.shieldOn) {
          e.shieldT -= dt;
          if (e.shieldT <= 0) { e.shieldOn = false; e.shieldCd = 6; }
        } else {
          e.shieldCd = (e.shieldCd == null ? 5 : e.shieldCd) - dt;
          if (e.shieldCd <= 0) { e.shieldT = 2; e.shieldOn = true; SFX.bossSkill(); }
        }
      } else if (e.bossType === 'summoner') {
        if (e.summonsLeft == null) e.summonsLeft = Math.round(8 * mechScale);
        e.summonCd = (e.summonCd == null ? 3 : e.summonCd) - dt;
        if (e.summonCd <= 0 && e.summonsLeft > 0) {
          e.summonCd = 4.5;
          for (let i = 0; i < 2 && e.summonsLeft > 0; i++) {
            e.summonsLeft--;
            const ahp = e.maxHp * 0.02;
            pendingSpawns.push({
              kind:'norm', hp: ahp, maxHp: ahp, spd: e.spd / 0.45, r: 8,
              bounty: Math.max(1, Math.round(e.bounty * 0.02)), color:'#ff9492', armor:0, gap:0,
              dist: Math.max(0, e.dist - 14 - i*16), slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0
            });
          }
          addExplosion(e.x, e.y, '#ff9492', 8, 90);
          SFX.bossSkill();
        }
      } else if (e.bossType === 'enrager') {
        // haste aura: refresh a short enrage timer on every nearby enemy each frame, so it
        // decays once they leave the aura. The boss skips itself. A periodic pulse fires the
        // SFX + a burst so the buff window is readable without spamming sound every frame.
        for (const o of enemies) {
          if (o === e || o.dead) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) < 120 * mechScale) o.hasted = 0.6;
        }
        e.enrageCd = (e.enrageCd == null ? 2.5 : e.enrageCd) - dt;
        if (e.enrageCd <= 0) { e.enrageCd = 2.5; addExplosion(e.x, e.y, '#ffb454', 8, 100); SFX.bossSkill(); }
      } else if (e.bossType === 'teleporter') {
        // blink forward along the path, briefly intangible mid-jump (reuses the phantom
        // blink fields). The intangibility decays every frame above, so a frozen boss can't
        // stay invulnerable; freeze pauses the trigger here. Pressures DPS/timing off the HP axis.
        e.blinkCd = (e.blinkCd == null ? 4 : e.blinkCd) - dt;
        if (e.blinkCd <= 0) {
          e.blinkCd = 4;
          e.blinkInvuln = 0.4;
          e.dist += 80;
          addExplosion(e.x, e.y, '#bc8cff', 10, 110);
          SFX.blink();
        }
      } else if (e.bossType === 'berserker') {
        // the speed scaling lives in the movement line above; here we only add chunky feedback
        // once it's actually been wounded — a periodic roar + burst so the rage reads at a glance
        // without spamming sound every frame. Run-only timer, never persisted (enemies aren't saved).
        e.rageCd = (e.rageCd == null ? 2 : e.rageCd) - dt;
        if (e.rageCd <= 0) {
          e.rageCd = 2;
          if (e.hp < e.maxHp * 0.85) { addExplosion(e.x, e.y, '#ff6a6a', 7, 95); SFX.bossSkill(); }
        }
      } else if (e.bossType === 'disruptor') {
        // EMP wake (v1.52.0): every ~4s the boss knocks the NEAREST firing tower offline as it
        // advances, so a coverage gap roams with it — pressures tower uptime/redundancy on a fresh
        // axis (not HP), in ALL modes. Reuses the Static Storm `empT` timer (firing-skip + decay +
        // render dim are already general, not mod-gated). One tower per pulse keeps it bounded;
        // buff towers are immune (like the emp wave mod), and freeze pauses the pulse (gated block).
        e.empPulseCd = (e.empPulseCd == null ? 3 : e.empPulseCd) - dt;
        if (e.empPulseCd <= 0) {
          e.empPulseCd = 4;
          let best = null, bd = 150*150;
          for (const t of towers) {
            if (t.type === 'buff' || t.empT > 0) continue;
            const d2 = (t.x-e.x)*(t.x-e.x) + (t.y-e.y)*(t.y-e.y);
            if (d2 < bd) { bd = d2; best = t; }
          }
          if (best) {
            best.empT = 2.2;
            addExplosion(best.x, best.y, '#7df9ff', 12, 130);
            addExplosion(e.x, e.y, '#7df9ff', 6, 90);
            SFX.zap();
            shake = Math.max(shake, 5);
          }
        }
      } else if (e.bossType === 'siphon') {
        // Gold leech (v1.71.0): every ~3.5s the boss drains a small, wave-scaled amount of the
        // player's GOLD while it's alive — a fresh ECONOMIC pressure axis (no other archetype
        // touches gold), on-theme with the recurring "money from the first 10 rounds" snowball
        // feedback (you can't farm out of trouble while it's on the field). Bounded: floored at 0
        // (never negative, so it can't soft-lock — kills still pay bounty), one pulse/3.5s, and
        // freeze pauses it (gated block). Run-only timer, never persisted.
        e.siphonCd = (e.siphonCd == null ? 3.5 : e.siphonCd) - dt;
        if (e.siphonCd <= 0) {
          e.siphonCd = 3.5;
          if (gold > 0) {
            const steal = Math.min(gold, Math.floor((6 + wave * 0.4) * mechScale));
            gold -= steal;
            addFloater(e.x, e.y - 26, `-${steal}💰`, '#e3b341', 15);
            addExplosion(e.x, e.y, '#e3b341', 8, 95);
            SFX.siphon();
            shake = Math.max(shake, 5);
            updateHud();
          }
        }
      } else if (e.bossType === 'conduit') {
        // Conduit (v2.2.0, the 12th archetype — a fresh axis: escorts shield the BOSS, the
        // inverse of the Warden, whose aura shields the cluster). Each frame, count the nearby
        // non-boss enemies linked to it; that count (capped at 5) is its damage shield, applied
        // in damage() as −14% per escort (cap −70%). So emptying its bar means CLEARING THE ADDS
        // first — a target-priority decision, not a raw HP spike. Bounded / "too easy"-safe: the
        // escorts are ones you'd kill anyway, the reduction caps, and a frozen conduit drops the
        // shield (the unconditional line above). Adds NO HP or speed. A periodic pulse fires the
        // SFX + a burst so the link is readable. Run-only fields, never persisted.
        let guard = 0;
        for (const o of enemies) {
          if (o === e || o.dead || o.kind === 'boss') continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) < 130) { guard++; if (guard >= 5) break; }
        }
        e.conduitGuard = guard;
        e.linkCd = (e.linkCd == null ? 2.5 : e.linkCd) - dt;
        if (e.linkCd <= 0) {
          e.linkCd = 2.5;
          if (guard > 0) { addExplosion(e.x, e.y, '#5ef2c8', 7, 95); SFX.bossSkill(); }
        }
      } else if (e.bossType === 'warper') {
        // Warper (v2.7.0, the 13th archetype — a fresh axis: it manipulates its ALLIES' path
        // POSITION, the offensive inverse of the player's Shockwave ability). Every ~5s it tears
        // a rift that YANKS every nearby non-boss enemy 30px FORWARD along the path (dist += 30),
        // so the cluster travelling with it lurches toward the exit — pressuring COVERAGE/leak,
        // not the invariant-capped HP curve. Distinct from the enrager (continuous speed buff)
        // and the teleporter (self-only blink): this is a discrete forward shove of OTHERS.
        // Bounded / "too easy"-safe: it adds NO HP or speed, the pull is small (30px) and periodic
        // (every 5s), only reaches nearby allies (130px), and freeze pauses it (gated block) — so
        // it can only add pressure, never make a run easier. Run-only lazy timer, never persisted.
        e.warpCd = (e.warpCd == null ? 4 : e.warpCd) - dt;
        if (e.warpCd <= 0) {
          e.warpCd = 5;
          let pulled = 0;
          for (const o of enemies) {
            if (o === e || o.dead || o.kind === 'boss') continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) < 130) { o.dist += 30; pulled++; }
          }
          if (pulled > 0) {
            addExplosion(e.x, e.y, '#7c6cff', 12, 130);
            SFX.shock();
            shake = Math.max(shake, 5);
          }
        }
      } else if (e.bossType === 'fortifier') {
        // Fortifier (v2.10.0, the 14th archetype — a fresh axis: it HARDENS over time, ramping its
        // own armor the longer it stays alive, so deep bosses become a DPS RACE: drop it fast or it
        // turns into a brick. Reuses the existing `e.armor` flat-subtraction in damage() (no new
        // damage() code), so — like the boss-armor lever the owner already tuned — it barely touches
        // high-damage builds (Sniper/Cannon) and is fully ignored by the anti-armor towers
        // (Mortar/AP-gun ignore armor, Poison corrodes it). Distinct from the bulwark (a periodic %
        // soak that hurts ALL builds equally): this is a steadily-growing FLAT armor that
        // asymmetrically checks low-per-hit DPS. The ramp is IN PLACE (increment `e.armor`, capped
        // at an absolute `fortifyCap` = starting armor + FORTIFY_CAP) rather than recomputed from a
        // base each frame — so Poison's −3 armor corrosion (in hitEnemy) PERSISTS and the boss
        // slowly re-hardens toward the cap, keeping the anti-armor counter meaningful (a brick that
        // re-sets). Bounded / "too easy"-safe: it adds NO HP or speed, the ramp CAPS, and freeze
        // pauses it (gated block, so a frozen fortifier stops hardening). Run-only fields (`fortifyCap`/
        // `fortifyCd` lazily snapshot/init), never persisted (enemies aren't saved).
        if (e.fortifyCap == null) e.fortifyCap = (e.armor || 0) + FORTIFY_CAP;
        if ((e.armor || 0) < e.fortifyCap) e.armor = Math.min(e.fortifyCap, (e.armor || 0) + FORTIFY_RATE * dt);
        e.fortifyCd = (e.fortifyCd == null ? 2.5 : e.fortifyCd) - dt;
        if (e.fortifyCd <= 0) { e.fortifyCd = 2.5; addExplosion(e.x, e.y, '#cd7f32', 8, 95); SFX.bossSkill(); }
      } else if (e.bossType === 'warlord') {
        // Warlord (v2.14.0, the 15th archetype — a fresh axis: the FIRST GLOBAL aura. Every other
        // aura (warden/herald/enrager/conduit) is range-gated; the Warlord rallies the ENTIRE wave
        // regardless of distance, so it's a pure "kill the keystone" puzzle — drop the Warlord and
        // the whole field's bonus armor vanishes at once). Each frame it refreshes a short `rallied`
        // timer on every living non-boss enemy (no range check); a rallied enemy gains WARLORD_ARMOR
        // flat armor in damage() (the existing flat-subtraction path — no new damage() code). The
        // timer decays the instant the Warlord dies or freezes (so the buff lapses within a frame),
        // making target-priority AND freeze clean counters. Distinct from the Fortifier (which ramps
        // its OWN armor) — this hardens the OTHERS. Bounded / "too easy"-safe: flat armor barely
        // touches high-per-hit towers (Sniper/Cannon) and is ignored/corroded by Mortar/AP/Poison —
        // it specifically checks the dominant cheap high-rate-low-dmg build, the documented "too
        // easy" offender — and it adds NO HP or speed. A periodic pulse fires the SFX + a burst so
        // the rally reads at a glance. Run-only fields (`rallied`/`rallyCd`), never persisted.
        for (const o of enemies) {
          if (o === e || o.dead || o.kind === 'boss') continue;
          o.rallied = 0.25;
        }
        e.rallyCd = (e.rallyCd == null ? 2.5 : e.rallyCd) - dt;
        if (e.rallyCd <= 0) { e.rallyCd = 2.5; addExplosion(e.x, e.y, '#f0c83c', 9, 110); SFX.bossSkill(); }
      } else if (e.bossType === 'suppressor') {
        // Suppressor (v2.16.0, the 16th archetype — a fresh axis: a continuous fire-rate DAMPENING
        // aura, the SOFT multi-tower counterpart to the Disruptor's HARD single-tower EMP). Each frame
        // it refreshes a short `suppressed` timer on every non-buff tower within SUPPRESS_RANGE; a
        // suppressed tower reloads +25% slower (effRate reads `t.suppressed`, reusing the exact
        // `brownout` wave-mod factor — a "localized brownout"). So unlike the Disruptor (one tower
        // fully offline every ~4s, a roaming gap), this softly throttles EVERY tower the boss passes
        // at once — pressuring tower CLUSTERING/positioning near the path. Bounded / "too easy"-safe:
        // it adds NO HP or speed, the throttle is a modest −20% DPS (×0.8) not a shutdown, buff towers
        // are immune (deal no damage), the tag decays the instant the boss leaves range or dies, and
        // freeze pauses the aura (gated block) so freeze counters it. A periodic pulse fires the SFX +
        // a burst so the field reads at a glance. Run-only `suppressed`/`suppressCd`, never persisted.
        for (const t of towers) {
          if (t.type === 'buff') continue;
          if (Math.hypot(t.x - e.x, t.y - e.y) < SUPPRESS_RANGE) t.suppressed = 0.3;
        }
        e.suppressCd = (e.suppressCd == null ? 2.5 : e.suppressCd) - dt;
        if (e.suppressCd <= 0) { e.suppressCd = 2.5; addExplosion(e.x, e.y, '#6f8faf', 9, SUPPRESS_RANGE); SFX.bossSkill(); }
      } else if (e.bossType === 'absorber') {
        // Absorber (v2.27.0, the 17th archetype): the per-hit damage CAP itself lives in damage()
        // (a passive, freeze-liftable ceiling — see ABSORB_CAP). This gated block only adds a periodic
        // "absorb" pulse for game-feel; like every other archetype's tick it's paused while frozen,
        // which doubles as the cue that freeze has dropped the cap. Run-only `absorbCd`, never persisted.
        e.absorbCd = (e.absorbCd == null ? 2.5 : e.absorbCd) - dt;
        if (e.absorbCd <= 0) { e.absorbCd = 2.5; addExplosion(e.x, e.y, '#2dd4bf', 10, 40); SFX.bossSkill(); }
      } else if (e.bossType === 'distorter') {
        // Distorter (v2.30.0, the 18th archetype — a fresh axis: a continuous tower-RANGE dampening
        // aura, the SECOND tower-debuff aura after the Suppressor's fire-rate. It is the `fog` Mayhem
        // mod as a boss, just as the Suppressor is the `brownout` mod as a boss. Each frame it refreshes
        // a short `distorted` timer on every non-buff tower within DISTORT_RANGE; a distorted tower's
        // firing range shrinks 20% (effRange reads `t.distorted`, the exact `fog` factor ×0.8), so
        // towers near the boss stop reaching the path — opening a COVERAGE/LEAK gap right where the boss
        // is (distinct from the Suppressor, which lowers DPS in place). Bounded / "too easy"-safe:
        // adds NO HP or speed, range only SHRINKS (can't make a run easier), buff towers are immune
        // (no firing range), the tag decays the instant the boss leaves range or dies, and freeze
        // pauses the aura (gated block) so freeze counters it. A periodic pulse fires the SFX + a burst
        // so the field reads at a glance. Run-only `distorted`/`distortCd`, never persisted.
        for (const t of towers) {
          if (t.type === 'buff') continue;
          if (Math.hypot(t.x - e.x, t.y - e.y) < DISTORT_RANGE) t.distorted = 0.3;
        }
        e.distortCd = (e.distortCd == null ? 2.5 : e.distortCd) - dt;
        if (e.distortCd <= 0) { e.distortCd = 2.5; addExplosion(e.x, e.y, '#e879f9', 9, DISTORT_RANGE); SFX.bossSkill(); }
      } else if (e.bossType === 'nullifier') {
        // Nullifier (v2.53.0, the 24th archetype — a fresh axis: a continuous tower-DAMAGE dampening
        // aura, completing the tower-debuff trio after the Suppressor's fire-rate (effRate) and the
        // Distorter's range (effRange). Each frame it refreshes a short `dampened` timer on every
        // non-buff tower within NULLIFY_RANGE; a dampened tower deals 25% less damage (effDmg reads
        // `t.dampened` ×0.75). Distinct FELT effect from the Suppressor: softer shots are eaten harder
        // by flat armor (armored/shield/fortifier), so it checks low-per-hit builds differently than a
        // reload throttle. Bounded / "too easy"-safe: adds NO HP or speed, damage only SHRINKS (can't
        // make a run easier), buff towers are immune (deal no damage), the tag decays the instant the
        // boss leaves range or dies, freeze pauses the aura (gated block), and 🔰 Hardened Circuits
        // negates it. A periodic pulse fires the SFX + a burst so the field reads at a glance.
        // Run-only `dampened`/`nullifyCd`, never persisted.
        for (const t of towers) {
          if (t.type === 'buff') continue;
          if (Math.hypot(t.x - e.x, t.y - e.y) < NULLIFY_RANGE) t.dampened = 0.3;
        }
        e.nullifyCd = (e.nullifyCd == null ? 2.5 : e.nullifyCd) - dt;
        if (e.nullifyCd <= 0) { e.nullifyCd = 2.5; addExplosion(e.x, e.y, '#c44a4a', 9, NULLIFY_RANGE); SFX.bossSkill(); }
      } else if (e.bossType === 'custodian') {
        // Custodian (v2.35.0, the 19th archetype — a fresh axis: a continuous damage-SHIELD aura
        // projected to its COHORT. It is the ◈ Warden's protective aura as a BOSS, just as the
        // Suppressor/Distorter are the brownout/fog mods as bosses. Each frame it refreshes a short
        // `warded` timer on every nearby non-boss ally within CUSTODIAN_RANGE (×mechScale so it grows
        // with wave depth, like the warden/herald/enrager auras); a warded enemy takes 40% less damage
        // (damage() reads `e.warded`, reusing the EXACT warden factor ×0.6). So the whole pack escorting
        // the boss is shielded — pressuring TARGET PRIORITY (drop the Custodian and the cohort's
        // protection lapses at once, since `warded` decays the instant nothing refreshes it). Distinct
        // from the Conduit (protected BY its escorts) and the Warlord (flat ARMOR rally): this is a %
        // damage reduction the boss GIVES to the cluster. Bounded / "too easy"-safe: it adds NO HP or
        // speed, the shield is the same bounded −40% the Warden already grants (no stacking — `warded`
        // is a single timer), buff towers are unaffected, and freeze pauses the aura (gated block) so a
        // frozen Custodian can't ward — making freeze + focus a clean counter. A periodic pulse fires the
        // SFX + a burst so the ward reads at a glance. Run-only `wardCd`, never persisted.
        const wr = CUSTODIAN_RANGE * mechScale;
        for (const o of enemies) {
          if (o === e || o.kind === 'boss' || o.dead) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) < wr) o.warded = 0.25;
        }
        e.wardCd = (e.wardCd == null ? 2.5 : e.wardCd) - dt;
        if (e.wardCd <= 0) { e.wardCd = 2.5; addExplosion(e.x, e.y, '#8ec7ff', 10, wr); SFX.bossSkill(); }
      } else if (e.bossType === 'veil') {
        // Veil (v2.36.0, the 20th archetype — a fresh axis: it spreads INTANGIBILITY to its cohort,
        // the 🫥 Cloaking Field mod / 👻 phantom enemy as a BOSS aura. Each frame (while unfrozen) it
        // tags every nearby non-boss ally within VEIL_RANGE (×mechScale, like the warden/custodian
        // auras) with `o.cloak = true`, handing them to the fully-managed cloak machinery (the general
        // cloak tick above decays their `blinkInvuln`, re-phases them ~every 2.5s, and the violet cue
        // ring + faded sphere already render) — so the whole pack escorting the boss periodically PHASES
        // OUT, untargetable in brief windows. Pressures COVERAGE/UPTIME (slow single-target towers waste
        // shots; rapid towers barely notice) — distinct from the Custodian's % shield, the Conduit's
        // by-escort shield, and the Warlord's flat armor. Bounded / "too easy"-safe: adds NO HP or speed,
        // the cloak is the same brief bounded phase the mod already grants (no stacking — `cloak` is a
        // binary flag), bosses are never tagged (always killable), and FREEZE pauses the tagging (gated
        // block) so a frozen Veil can't spread it (freeze + focus is a clean counter). The veil CLINGS —
        // a tagged escort keeps phasing for the rest of its life (the mod's persistent flag), so the
        // danger lingers past the boss kill. A periodic pulse fires the SFX + a burst so it reads at a
        // glance. Reuses the existing cloak infra (zero new fields/skip-sites). Run-only `veilCd`, never saved.
        const vr = VEIL_RANGE * mechScale;
        for (const o of enemies) {
          if (o === e || o.kind === 'boss' || o.dead) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) < vr) o.cloak = true;
        }
        e.veilCd = (e.veilCd == null ? 2.5 : e.veilCd) - dt;
        if (e.veilCd <= 0) { e.veilCd = 2.5; addExplosion(e.x, e.y, '#dcd2ff', 9, vr); SFX.blink(); }
      } else if (e.bossType === 'accelerator') {
        // Accelerator (v2.41.0, the 21st archetype — a fresh axis: it ramps its OWN speed with time
        // alive, so a slow opening fight turns into a sprint if you can't burst it. Distinct from the
        // berserker (HP-linked) and the enrager/herald (aura-linked): purely time-based. The ramp
        // lives in this gated block, so FREEZE pauses it (like every other archetype tick), and the
        // movement line reads e.accelMul (slowMul zeroes it under freeze, frost slow multiplies in).
        // Bounded / "too easy"-safe: it adds NO HP, and even at the +80% cap it stays slower than a
        // basic enemy (base boss speed 0.45× → 0.81×) — beatable. Run-only, never persisted.
        e.accelMul = Math.min(ACCEL_CAP, (e.accelMul || 1) + ACCEL_RATE * dt);
        e.accelCd = (e.accelCd == null ? 2.5 : e.accelCd) - dt;
        if (e.accelCd <= 0) { e.accelCd = 2.5; addExplosion(e.x, e.y, '#ffec5a', 9, e.r + 18); SFX.bossSkill(); }
      } else if (e.bossType === 'cleanser') {
        // Cleanser (v2.42.0, the 22nd archetype — a fresh ANTI-DEBUFF axis: no other archetype or
        // enemy removes poison). Every ~2.5s it PURGES the soft debuffs (poison DoT + frost slow) from
        // itself and every nearby non-boss ally within CLEANSE_RANGE (×mechScale, like the warden/
        // custodian/veil auras), so a DoT/slow build can't soften the pack — bring direct DPS. The
        // purge is PERIODIC (on the pulse, not every frame), so poison/slow re-accumulate between
        // pulses and the effect reads clearly (debuffs vanish on the flash). Deliberately does NOT
        // clear `frozen`: FREEZE stays the counter (and, in this gated frozen<=0 block, a frozen
        // Cleanser can't purge — freeze + focus is a clean answer). Bounded/"too easy"-safe: adds NO
        // HP or speed, only strips the player's DoT/slow advantage. Run-only `cleanseCd`, never saved.
        e.cleanseCd = (e.cleanseCd == null ? 2.5 : e.cleanseCd) - dt;
        if (e.cleanseCd <= 0) {
          e.cleanseCd = 2.5;
          const cr = CLEANSE_RANGE * mechScale;
          e.poison = null; e.slow = 0;
          for (const o of enemies) {
            if (o === e || o.kind === 'boss' || o.dead) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) < cr) { o.poison = null; o.slow = 0; }
          }
          addExplosion(e.x, e.y, '#e6fbff', 10, cr); SFX.bossSkill();
        }
      } else if (e.bossType === 'adaptive') {
        // Chameleon (v2.49.0, the 23rd archetype — a fresh BUILD-DIVERSITY axis). Its whole mechanic
        // is passive in damage() (a repeated same-tower-type hit deals −50%); this gated block only
        // adds a periodic shimmer pulse (SFX + a burst) so the "it's adapting" read is legible and,
        // because it's gated frozen<=0, the silence doubles as the cue that freeze has lifted the
        // adaptation (like the absorber's tick). Run-only `adaptCd`, never persisted.
        e.adaptCd = (e.adaptCd == null ? 2.5 : e.adaptCd) - dt;
        if (e.adaptCd <= 0) { e.adaptCd = 2.5; addExplosion(e.x, e.y, '#ff5a8c', 9, e.r + 16); SFX.bossSkill(); }
      }
    }
    if (e.dist >= pathLen) {
      e.dead = true;
      if (barrierCharges > 0) {
        // 🛡️ Barrier ability (v1.93.0): vaporize the leaker at the exit — no lives lost,
        // no bounty paid (purely defensive). Blocks any kind incl. a boss leak (which would
        // otherwise cost 5), so it's a real panic save; bounded by charge count + cooldown.
        barrierCharges--;
        barrierBlocks++;   // 🛡️ Ironclad achievement: 5+ blocked leaks in one run (v2.46.0)
        const ex = waypoints[waypoints.length-1][0], ey = waypoints[waypoints.length-1][1];
        addExplosion(ex, ey, '#58e0ff', 22, 200);
        addFloater(ex, ey - 24, barrierCharges > 0 ? `🛡️ BLOCKED (${barrierCharges})` : '🛡️ BLOCKED', '#58e0ff', 16);
        SFX.barrier();
        shake = Math.max(shake, 6);
        updateHud();
      } else {
        const dmgLives = e.lifeCost || (e.kind === 'boss' ? 5 : 1);   // breacher (v1.63.0) leaks lifeCost (3 as of v2.0.0); boss 5
        lives -= dmgLives;
        livesLostThisRun = true;
        perkState.livesLost += dmgLives;   // feeds the Last Stand comeback perk (v1.22.0)
        if (perkState.retaliation) perkState.retaliateT = RETALIATE_DUR;   // 🗯️ Retaliation: arm the comeback buff (v2.39.0)
        shake = Math.max(shake, e.kind === 'boss' ? 14 : 6);
        addFloater(W-60, waypoints[waypoints.length-1][1] - 20, `-${dmgLives}❤️`, '#f85149', 18);
        SFX.life();
        if (lives <= 0) {
          if (perkState.phoenix && !perkState.phoenixUsed) {
            // 🌅 Phoenix (v2.15.0): cheat death once — revive and hurl the whole field back to the
            // path start (a full lap of breathing room). Pure knockback + lives: no kills, no bounty.
            perkState.phoenixUsed = true;
            lives = PHOENIX_LIVES;
            for (const o of enemies) { if (!o.dead) o.dist = 0; }
            const px = waypoints[waypoints.length-1][0], py = waypoints[waypoints.length-1][1];
            addExplosion(px, py, '#ff8a34', 60, 320);
            addRing(W/2, H/2, '#ffb84d', 520, { life: 0.9, w: 7 });
            addFloater(W/2, 150, '🌅 PHOENIX RISES', '#ffb84d', 30);
            SFX.phoenix();
            shake = Math.max(shake, 18);
          } else { lives = 0; endGame(); }
        }
        updateHud();
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);
  if (pendingSpawns.length) {
    for (const c of pendingSpawns) enemies.push(c);
    pendingSpawns = [];
  }

  // towers fire
  for (const t of towers) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.rankFlash > 0) t.rankFlash = Math.max(0, t.rankFlash - dt * 1.4);   // veterancy promotion pulse (cosmetic, v1.100.0)
    if (t.empT > 0) t.empT = Math.max(0, t.empT - dt * perkState.empResist);   // tick down offline timer (all tower types); Surge Protector perk (empResist) recovers faster
    if (t.suppressed > 0) t.suppressed = Math.max(0, t.suppressed - dt);   // Suppressor boss aura: decays once out of range (effRate reads it, +25% reload while >0)
    if (t.distorted > 0) t.distorted = Math.max(0, t.distorted - dt);   // Distorter boss aura: decays once out of range (effRange reads it, −20% range while >0)
    if (t.dampened > 0) t.dampened = Math.max(0, t.dampened - dt);   // Nullifier boss aura (v2.53.0): decays once out of range (effDmg reads it, −25% damage while >0)
    if (t.type === 'buff') continue;
    t.cd -= dt;
    if (t.empT > 0) continue;   // Static Storm: tower is knocked offline, can't fire
    if (t.cd > 0) continue;
    const target = pickTarget(t);
    if (!target) continue;
    t.cd = effRate(t);
    t.flash = 0.08;
    t.angle = Math.atan2(target.y-t.y, target.x-t.x);
    const def = TOWER_TYPES[t.type];
    let dmg = effDmg(t);
    // crits
    let crit = false;
    const critCh = perkState.critChance + 0.02 * tRank('critlab') + (t.spec === 'deadeye' ? 0.2 : 0);
    if (critCh > 0 && Math.random() < critCh) {
      crit = true;
      // Critical Mass legendary (v2.20.0): perkState.critMult (default 1) amplifies the per-crit
      // multiplier — the first perk on the crit-DAMAGE axis (Crit Systems/Crit Lab only add chance).
      dmg *= (t.spec === 'deadeye' ? 4 : 2.5) * perkState.critMult;
    }
    if (t.spec === 'executor' && (target.kind === 'tank' || target.kind === 'boss')) dmg *= 1.9;
    if (perkState.bossDmg > 1 && (target.kind === 'tank' || target.kind === 'boss')) dmg *= perkState.bossDmg;
    // Ambush rare (v1.85.0): +30% damage to enemies still above 80% HP — the OPENER counterpart to
    // Reaper's execute. Keyed to the primary target's current HP, so it lives here (not effDmg);
    // applied before the proj branch so chain/rail/poison opening shots benefit too.
    if (perkState.ambush && target.hp > target.maxHp * 0.8) dmg *= 1.3;
    // Finisher rare (v2.43.0): +35% damage to enemies below 40% HP — the CLOSER counterpart to
    // Ambush's opener. Keyed to the primary target's current HP, so it lives here (not effDmg);
    // applied before the proj branch so chain/rail/poison finishing shots benefit too. Conditional
    // on a wounded target (never helps you START a kill), so it's a modest rare, not power creep.
    if (perkState.finisher && target.hp < target.maxHp * 0.4) dmg *= 1.35;
    // Point Blank rare (v2.45.0): +25% damage to enemies within HALF the tower's effective range —
    // a fresh POSITIONAL axis (Ambush/Finisher key off HP; this keys off distance). effRange(t) is
    // only computed when the perk is held (flag-gated), so no per-shot cost otherwise. Applied here
    // (not effDmg) before the proj branch so chain/rail/poison close-range shots benefit too.
    if (perkState.pointBlank && Math.hypot(target.x - t.x, target.y - t.y) <= effRange(t) * 0.5) dmg *= 1.25;
    // Corrosive Rounds rare (v2.50.0): +30% damage to a target with an active poison DoT — a
    // poison-anchored synergy. Keyed to the primary target's live poison state, so it lives here
    // (not effDmg); applied before the proj branch so chain/rail/poison shots benefit too.
    if (perkState.corrosive && target.poison && target.poison.t > 0) dmg *= 1.3;
    // Swarmbane rare (v2.51.0): +1% damage per LIVE enemy on the field (cap +25% at 25), so towers
    // hit hardest exactly when the board is swamped — a self-correcting anti-swarm/comeback reward
    // (the mirror of Phalanx's per-tower scaling). Keyed to the live enemies.length, so it lives
    // here (not effDmg); applied before the proj branch so chain/rail/poison shots benefit too.
    if (perkState.swarmbane) dmg *= 1 + Math.min(0.25, enemies.length * 0.01);
    // Killing Spree legendary (v1.73.0): a hot kill-combo amplifies ALL tower damage (+1%/combo,
    // cap +25% at 25×). Conditional on an active streak (gated inside comboDmgMult) so it's
    // self-limiting; applied here — before the proj branch, so it covers chain/poison too — and
    // NOT in effDmg, so the upgrade panel doesn't churn every kill.
    dmg *= comboDmgMult();
    // 🗯️ Retaliation (rare, v2.39.0): a comeback buff — for RETALIATE_DUR seconds after an enemy
    // LEAKS (armed at the leak site), all towers hit +25% harder. Only ever active while you're
    // losing lives, so a clean run gets nothing → "too easy"-safe. Transient (retaliateT decays in
    // update()), so it lives here in the fire path like Ambush/Killing Spree, NOT effDmg.
    if (perkState.retaliateT > 0) dmg *= RETALIATE_DMG;
    // Laser (v2.9.0): the beam RAMPS UP while held on the SAME target (sustained boss/tank
    // DPS) and resets to ×1 the instant the target changes or dies — so it's deliberately
    // poor at swarms (the inverse of an area tower). `charge`/`beamTarget` are run-only and
    // never serialized (saveRun only stores type/x/y/level/mode/spec/invested/dealt/kills),
    // so a resumed laser simply re-ramps from ×1 → save-safe.
    if (def.proj === 'beam') {
      if (t.beamTarget === target) t.charge = Math.min(BEAM_CHARGE_CAP, (t.charge || 1) + BEAM_CHARGE_STEP);
      else { t.beamTarget = target; t.charge = 1; }
      dmg *= t.charge;
    }
    if (def.proj === 'chain') {
      fireChain(t, target, dmg);
    } else if (def.proj === 'rail') {
      fireRail(t, target, dmg);
    } else if (def.proj === 'beam') {
      fireBeam(t, target, dmg);
    } else if (def.proj === 'nova') {
      firePulse(t, dmg);
    } else {
      // Mortar shells are LOBBED (v1.79.0): they get a render-only parabolic arc. The
      // launch point (px/py) is recorded as x0/y0 so the arc helper can compute flight
      // progress; only the drawn orb/trail/shadow lift — hit math still uses p.x/p.y.
      const px = t.x + Math.cos(t.angle)*14, py = t.y + Math.sin(t.angle)*14;
      const p = {
        x: px, y: py,
        target, dmg, kind: def.proj, src: t, crit,
        ignoreArmor: t.spec === 'ap' || t.type === 'mortar',  // mortar shells always ignore armor
        color: def.color, spd: def.proj === 'bomb' ? 260 : def.proj === 'mortar' ? 200 : def.proj === 'ricochet' ? 420 : 480,
        lob: def.proj === 'mortar', x0: px, y0: py
      };
      // Arc (v2.52.0): the bolt carries its remaining ricochets, the enemies it has already
      // struck (each foe is hit once per bolt — bounded, no re-ping loops), and its hop seek
      // radius. Ball Lightning spec adds 2 hops; Magnet Coil stretches the seek reach ×1.6.
      if (def.proj === 'ricochet') {
        p.hops = ARC_HOPS + (t.spec === 'arcbounce' ? 2 : 0);
        p.seek = ARC_SEEK * (t.spec === 'arcseek' ? 1.6 : 1);
        p.struck = [];
      }
      projectiles.push(p);
      if (t.type === 'sniper') SFX.snipe();
      else if (t.type === 'frost') SFX.frost();
      else if (t.type === 'poison') SFX.poison();
      else if (t.type === 'mortar') SFX.mortar();
      else if (t.type === 'arc') SFX.arc();
      else SFX.shoot();
    }
  }

  // projectiles
  for (const p of projectiles) {
    if (p.target.dead || p.target.hp <= 0) {
      // Arc bolt (v2.52.0): if its flight target dies mid-air (killed by another tower), the
      // bolt RETARGETS the nearest fresh enemy instead of fizzling (a free hop — it hasn't
      // delivered that hit yet). Every other projectile kind still fizzles as before.
      if (!(p.kind === 'ricochet' && ricochetNext(p, false))) p.dead = true;
      continue;
    }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.spd * dt;
    if (d <= step + p.target.r) {
      hitEnemy(p);
      // Arc bolt (v2.52.0): after a real strike, hop to the nearest unhit enemy (spends a
      // ricochet + applies the damage falloff inside ricochetNext). Dies when out of hops
      // or nothing fresh is in seek range.
      if (!(p.kind === 'ricochet' && ricochetNext(p, true))) p.dead = true;
    } else {
      p.x += dx/d * step; p.y += dy/d * step;
    }
  }
  projectiles = projectiles.filter(p => !p.dead);

  for (const b of beams) b.life -= dt;
  beams = beams.filter(b => b.life > 0);
  for (const pt of particles) {
    pt.life -= dt; pt.x += pt.vx*dt; pt.y += pt.vy*dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
  }
  particles = particles.filter(p => p.life > 0);
  for (const rg of rings) rg.life -= dt;
  rings = rings.filter(rg => rg.life > 0);
  for (const f of floaters) { f.life -= dt; f.y -= 28*dt; }
  floaters = floaters.filter(f => f.life > 0);

  shake = Math.max(0, shake - 40*dt);

  // 🗯️ Retaliation buff timer decays (armed at the leak site above when the perk is held); past
  // update()'s pause/draft/gameOver early-return, so it freezes when not actively playing.
  if (perkState.retaliateT > 0) perkState.retaliateT = Math.max(0, perkState.retaliateT - dt);
  // combo decay: streak lapses if no kill within the window
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { comboTimer = 0; comboCount = 0; } }
  if (comboFlash > 0) comboFlash = Math.max(0, comboFlash - dt*3);
  // wave-start banner fades over ~1.4s (v2.44.0); past the pause/draft/gameOver early-return so it
  // freezes while paused. Run-only render state, never saved.
  if (waveBanner) { waveBanner.t -= dt / 1.4; if (waveBanner.t <= 0) waveBanner = null; }

  if (waveActive && !spawners.length && !enemies.length && !pendingSpawns.length) endWave();
}
