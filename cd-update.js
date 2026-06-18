'use strict';
// ================= Update =================
let abilityUiAcc = 0;
function update(dt) {
  if (gameOver || paused || !started || draftOpen) return;
  gameTime += dt;

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
    e.dist += e.spd * slowMul * hasteMul * berserkMul * adrenalineMul * dt;
    const p = pointAt(e.dist);
    e.x = p.x; e.y = p.y;
    if (e.kind === 'heal' && e.frozen <= 0) {
      for (const o of enemies) {
        if (o === e || o.dead || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x-e.x, o.y-e.y) < 70) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.04 * dt);
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
        if (Math.hypot(o.x-e.x, o.y-e.y) < 75) o.warded = 0.25;
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
        if (Math.hypot(o.x-e.x, o.y-e.y) < 90) o.hasted = 0.25;
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
    if (e.regen && e.frozen <= 0 && !e.dead) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
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
    // Frozen bosses pause their mechanic (freeze counters it, like heal/phantom). Juggernaut is the
    // exception by design — it can never be frozen, so its CC immunity above runs every frame.
    // All fields are run-only and lazily initialised, so nothing touches save state.
    if (e.kind === 'boss' && e.bossType && e.frozen <= 0) {
      if (e.bossType === 'regen') {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);
      } else if (e.bossType === 'bulwark') {
        if (e.shieldOn) {
          e.shieldT -= dt;
          if (e.shieldT <= 0) { e.shieldOn = false; e.shieldCd = 6; }
        } else {
          e.shieldCd = (e.shieldCd == null ? 5 : e.shieldCd) - dt;
          if (e.shieldCd <= 0) { e.shieldT = 2; e.shieldOn = true; SFX.bossSkill(); }
        }
      } else if (e.bossType === 'summoner') {
        if (e.summonsLeft == null) e.summonsLeft = 8;
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
          if (Math.hypot(o.x - e.x, o.y - e.y) < 120) o.hasted = 0.6;
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
            const steal = Math.min(gold, 6 + Math.floor(wave * 0.4));
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
      }
    }
    if (e.dist >= pathLen) {
      e.dead = true;
      if (barrierCharges > 0) {
        // 🛡️ Barrier ability (v1.93.0): vaporize the leaker at the exit — no lives lost,
        // no bounty paid (purely defensive). Blocks any kind incl. a boss leak (which would
        // otherwise cost 5), so it's a real panic save; bounded by charge count + cooldown.
        barrierCharges--;
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
    // Killing Spree legendary (v1.73.0): a hot kill-combo amplifies ALL tower damage (+1%/combo,
    // cap +25% at 25×). Conditional on an active streak (gated inside comboDmgMult) so it's
    // self-limiting; applied here — before the proj branch, so it covers chain/poison too — and
    // NOT in effDmg, so the upgrade panel doesn't churn every kill.
    dmg *= comboDmgMult();
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
    } else {
      // Mortar shells are LOBBED (v1.79.0): they get a render-only parabolic arc. The
      // launch point (px/py) is recorded as x0/y0 so the arc helper can compute flight
      // progress; only the drawn orb/trail/shadow lift — hit math still uses p.x/p.y.
      const px = t.x + Math.cos(t.angle)*14, py = t.y + Math.sin(t.angle)*14;
      projectiles.push({
        x: px, y: py,
        target, dmg, kind: def.proj, src: t, crit,
        ignoreArmor: t.spec === 'ap' || t.type === 'mortar',  // mortar shells always ignore armor
        color: def.color, spd: def.proj === 'bomb' ? 260 : def.proj === 'mortar' ? 200 : 480,
        lob: def.proj === 'mortar', x0: px, y0: py
      });
      if (t.type === 'sniper') SFX.snipe();
      else if (t.type === 'frost') SFX.frost();
      else if (t.type === 'poison') SFX.poison();
      else if (t.type === 'mortar') SFX.mortar();
      else SFX.shoot();
    }
  }

  // projectiles
  for (const p of projectiles) {
    if (p.target.dead || p.target.hp <= 0) { p.dead = true; continue; }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.spd * dt;
    if (d <= step + p.target.r) {
      hitEnemy(p);
      p.dead = true;
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

  // combo decay: streak lapses if no kill within the window
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { comboTimer = 0; comboCount = 0; } }
  if (comboFlash > 0) comboFlash = Math.max(0, comboFlash - dt*3);

  if (waveActive && !spawners.length && !enemies.length && !pendingSpawns.length) endWave();
}

function pickTarget(t) {
  let target = null, bestVal = null;
  const range = effRange(t);
  for (const e of enemies) {
    if (e.x === undefined || e.dead || e.blinkInvuln > 0) continue;
    const d = Math.hypot(e.x-t.x, e.y-t.y);
    if (d > range) continue;
    let val;
    switch (t.mode) {
      case 'last':    val = -e.dist; break;
      case 'strong':  val = e.hp; break;
      case 'close':   val = -d; break;
      // 'weak': finisher — lowest current HP first (secure kills → feed the combo meter &
      // the Reaper execute), tie-break toward the furthest-along enemy so leaks get priority.
      case 'weak':    val = -e.hp + e.dist * 1e-4; break;
      // 'support': prioritise aura enemies (heal/warden) — popping them un-buffs their
      // cluster. Support outranks everything; among same class, furthest-along wins (like 'first').
      case 'support': val = (SUPPORT_KINDS[e.kind] ? 1e7 : 0) + e.dist; break;
      default:        val = e.dist;
    }
    if (bestVal === null || val > bestVal) { bestVal = val; target = e; }
  }
  return target;
}

function fireChain(t, first, dmg) {
  SFX.tesla();
  const maxChain = 3 + perkState.chainExtra + (t.spec === 'super' ? 2 : 0);
  // Superconductor's gentler falloff (0.8 vs base 0.7) makes its 2 extra chain
  // targets count for real damage instead of negligible chip — it now out-totals
  // Overcharge once a full 5-enemy swarm is chained (3.36× vs 3.0×) while Overcharge
  // (no falloff, full dmg to 3) stays the better few-target pick. Spec-specific, so
  // base tesla and Overcharge are unchanged. (Was strictly dominated, v1.55.0.)
  const falloff = t.spec === 'overcharge' ? 1 : (t.spec === 'super' ? 0.8 : 0.7);
  const hitSet = [first];
  let cur = first;
  for (let i = 0; i < maxChain - 1; i++) {
    let next = null, nd = Infinity;
    for (const e of enemies) {
      if (e.dead || hitSet.includes(e) || e.x === undefined) continue;
      const d = Math.hypot(e.x-cur.x, e.y-cur.y);
      if (d < 90 && d < nd) { nd = d; next = e; }
    }
    if (!next) break;
    hitSet.push(next);
    cur = next;
  }
  let px = t.x, py = t.y;
  let chainDmg = dmg;
  for (const e of hitSet) {
    beams.push({x1: px, y1: py, x2: e.x, y2: e.y, life: 0.12, color: '#d2a8ff'});
    damage(e, chainDmg, t);
    addExplosion(e.x, e.y, '#d2a8ff', 3, 70);
    px = e.x; py = e.y;
    chainDmg *= falloff;
  }
}

// Railgun (v1.83.0): an INSTANT piercing beam (like fireChain, it resolves immediately
// rather than spawning a travelling projectile). It fires a straight line from the muzzle
// out to the tower's range and damages EVERY live enemy whose body the line crosses — a
// positioning weapon that feasts on lined-up path runs and is mediocre vs spread targets.
// Respects armor (a kinetic slug — deliberately NOT a boss-melter); the Overcharged Coil
// spec widens the line. `dmg` already carries crit/boss/combo multipliers from the caller.
function fireRail(t, target, dmg) {
  SFX.rail();
  const def = TOWER_TYPES[t.type];
  const range = effRange(t);
  const ux = Math.cos(t.angle), uy = Math.sin(t.angle);   // unit dir toward the target
  const halfW = t.spec === 'railwide' ? 26 : 14;          // beam half-width (perp tolerance)
  let hits = 0;                                           // enemies raked by this single beam
  for (const e of enemies) {
    if (e.x === undefined || e.dead || e.blinkInvuln > 0) continue;  // skip intangible (phantom/cloak)
    const rx = e.x - t.x, ry = e.y - t.y;
    const along = rx*ux + ry*uy;                 // distance projected along the beam
    if (along < 0 || along > range + e.r) continue;       // behind the tower or past max range
    const perp = Math.abs(rx*uy - ry*ux);        // perpendicular offset from the beam line
    if (perp > halfW + e.r) continue;            // too far off the line to be struck
    damage(e, dmg, t);
    addExplosion(e.x, e.y, def.color, 4, 70);
    hits++;
  }
  // 🎯 Sharpshooter (v1.84.0): track the best single-beam rake for the achievement.
  if (hits > railBestHit) railBestHit = hits;
  // straight tracer from the muzzle to the far end of range (render-only)
  const mx = t.x + ux*14, my = t.y + uy*14;
  beams.push({ x1: mx, y1: my, x2: t.x + ux*range, y2: t.y + uy*range,
    life: 0.16, color: def.color, straight: true, w: t.spec === 'railwide' ? 5 : 3.5 });
  shake = Math.max(shake, 1.5);
}

// Laser (v2.9.0): a sustained single-target BEAM that resolves instantly (like fireChain/
// fireRail — no travelling projectile). The caller has already ramped `dmg` by the tower's
// `t.charge` (1×→2.2×, built up by holding the same target). It respects armor (a coherent
// beam, NOT a boss-melter past its ramp) and draws a straight tracer that thickens/brightens
// with the charge so the spin-up reads visually. The charge cap/step live here as the levers.
const BEAM_CHARGE_CAP = 2.2;     // max damage multiplier from a fully spun-up beam
const BEAM_CHARGE_STEP = 0.12;   // charge gained per shot held on the same target (~10 shots to cap)
// Fortifier boss archetype (v2.10.0) levers: it ramps its own armor by FORTIFY_RATE/s up to a
// FORTIFY_CAP bonus over its starting armor, so it hardens the longer it survives (a DPS race).
const FORTIFY_RATE = 0.5;        // armor gained per second alive
const FORTIFY_CAP = 40;          // max bonus armor over the boss's starting armor (~80s to cap)
// Warlord boss archetype (v2.14.0) lever: while alive it grants this much flat bonus armor to every
// living non-boss enemy (a global rally). Flat armor, so it asymmetrically checks low-per-hit DPS.
const WARLORD_ARMOR = 10;        // flat bonus armor on every rallied enemy
// Suppressor boss archetype (v2.16.0) lever: the radius of its fire-rate dampening aura. A non-buff
// tower within it reloads +25% slower (effRate's `t.suppressed` factor — a localized `brownout`).
const SUPPRESS_RANGE = 130;      // px reach of the suppression aura (matches the warper/conduit aura reach)
function fireBeam(t, target, dmg) {
  SFX.laser();
  const def = TOWER_TYPES[t.type];
  damage(target, dmg, t);
  const ux = Math.cos(t.angle), uy = Math.sin(t.angle);
  const mx = t.x + ux*14, my = t.y + uy*14;
  // The tracer visibly GROWS as the beam spins up on a held target (owner feedback): it starts
  // a thin precise line at ×1 and swells into a thick, brighter, halo'd beam at the ×2.2 cap —
  // width ~2.4→7.4px, glow 10→29, plus an outer bloom that fades in only as the charge climbs.
  const ramp = (t.charge || 1) - 1;   // 0 at ×1 → 1.2 at the ×2.2 cap
  beams.push({ x1: mx, y1: my, x2: target.x, y2: target.y,
    life: 0.1, color: def.color, straight: true,
    w: 2.4 + 4.2 * ramp, glow: 10 + 16 * ramp, bloom: 7 * ramp });
}

function hitEnemy(p) {
  if (p.crit) {
    const cd = Math.round(p.dmg);
    addFloater(p.target.x, p.target.y - 22, `CRIT ${cd}!`, '#ff7b42', 15,
      { merge: 'crit', value: cd, prefix: 'CRIT ', suffix: '!', radius: 28 });
    SFX.crit();
  }
  if (p.kind === 'bomb') {
    SFX.bomb();
    shake = Math.max(shake, 3);
    const radius = 55 * perkState.splashMult * (p.src && p.src.spec === 'mega' ? 1.6 : 1);
    addExplosion(p.target.x, p.target.y, '#ffd866', 14, 140);
    for (const e of enemies) {
      if (e.x === undefined || e.dead) continue;
      // Bastion (v1.90.0) resists explosive splash: the blast-shell takes half damage from
      // the Cannon bomb (and the Mortar shell below) so a pure-bombardment build can't melt it —
      // unless Shaped Charges (v2.8.0, perkState.aoePen) is held, which pierces the shell.
      if (Math.hypot(e.x-p.target.x, e.y-p.target.y) < radius) damage(e, p.dmg * (e.aoeResist && !perkState.aoePen ? 0.5 : 1), p.src, false, p.ignoreArmor);
    }
  } else if (p.kind === 'mortar') {
    // Lobbed siege shell: an armor-ignoring blast (p.ignoreArmor is forced true at
    // launch). Saturation spec widens the radius; damage already includes the
    // Demolisher spec via effDmg(). Distinct sandy burst + a heavier boom + shake.
    SFX.bomb();
    shake = Math.max(shake, 4);
    const radius = 46 * perkState.splashMult * (p.src && p.src.spec === 'saturate' ? 1.55 : 1);
    addExplosion(p.target.x, p.target.y, p.color, 16, 150);
    addExplosion(p.target.x, p.target.y, '#ffd866', 8, 90);
    for (const e of enemies) {
      if (e.x === undefined || e.dead) continue;
      // Bastion (v1.90.0) resists explosive splash: half damage from the Mortar shell too —
      // unless Shaped Charges (v2.8.0, perkState.aoePen) is held, which pierces the shell.
      if (Math.hypot(e.x-p.target.x, e.y-p.target.y) < radius) damage(e, p.dmg * (e.aoeResist && !perkState.aoePen ? 0.5 : 1), p.src, false, true);
    }
  } else if (p.kind === 'poison') {
    let dur = perkState.poisonDur;
    let dps = p.dmg * 2.6;
    if (p.src) {
      if (p.src.spec === 'virulent') dps *= 2;
      if (p.src.spec === 'lingering') dur *= 2;
    }
    p.target.poison = { dps, t: dur, src: p.src };
    // acid corrodes defense: each application strips a little armor (floors at 0),
    // so a poison tower softens shielded/armored enemies & bosses for the rest of
    // the team (owner FEEDBACK: "poison should also reduce enemy defense")
    if (p.target.armor) p.target.armor = Math.max(0, p.target.armor - 3);
    damage(p.target, p.dmg, p.src);
    addExplosion(p.target.x, p.target.y, '#3fb950', 4, 60);
  } else {
    if (p.kind === 'frost') {
      p.target.slow = 1.4;
      p.target.slowF = p.src && p.src.spec === 'deep' ? 0.35 : 0.6;
    }
    damage(p.target, p.dmg, p.src, false, p.ignoreArmor);
    addExplosion(p.target.x, p.target.y, p.color, 4, 60);
  }
}

function damage(e, dmg, src, silent=false, ignoreArmor=false, fromOverkill=false) {
  if (e.hp <= 0 || e.dead) return;
  if (e.blinkInvuln > 0) return;  // phantom is intangible mid-blink
  if (e.shieldOn) dmg *= 0.4;     // bulwark boss: active shield phase soaks 60% of incoming
  if (e.warded > 0) dmg *= 0.6;   // warden aura (v1.35.0): protected enemies take 40% less damage
  if (e.conduitGuard > 0) dmg *= (1 - 0.14 * e.conduitGuard);  // conduit boss (v2.2.0): each nearby escort shields it −14% (cap −70% at 5)
  // warlord boss (v2.14.0): a rallied enemy carries WARLORD_ARMOR flat bonus armor while the
  // Warlord lives — added into the existing flat-subtraction path, so Mortar/AP-gun (ignoreArmor)
  // skip it and high-per-hit towers barely feel it, but it blunts the cheap high-rate-low-dmg build.
  const rally = e.rallied > 0 ? WARLORD_ARMOR : 0;
  const armor = ignoreArmor ? 0 : Math.max(0, (e.armor || 0) + rally - 2 * tRank('piercing'));
  const actual = Math.max(0.5, dmg - armor * (dmg > 2 ? 1 : 0.05));
  const applied = Math.min(e.hp, actual);
  e.hp -= actual;
  if (!silent) e.flash = 0.08;
  if (src) src.dealt += applied;
  // Reaper legendary (v1.65.0): execute a non-boss enemy that survives this hit but sits below
  // 12% of its max HP — zero its HP so the normal death path below fires (combo/bounty/Overkill
  // all credit correctly). Bosses are exempt (bounded), and Overkill-splash hits (fromOverkill)
  // don't execute, keeping it single-layer. Credit the executed remainder to the firing tower.
  if (perkState.reaper && e.hp > 0 && e.kind !== 'boss' && !fromOverkill && e.hp < e.maxHp * 0.12) {
    if (src) src.dealt += e.hp;
    e.hp = 0;
    if (!silent) addFloater(e.x, e.y - 22, '💀 EXECUTE', '#ff5252', 13);
  }
  // Revenant boss archetype (v1.88.0, the 11th — a fresh DEATH-DEFIANCE axis: no other archetype
  // cheats its own death). The FIRST time a Revenant boss would die it instead reboots at 35% of
  // its max HP (a one-time second life), so emptying the bar isn't the kill — you must drop it
  // TWICE. Distinct from the Hydra (which dies and spawns weak heads); the Revenant itself rises,
  // keeping its full boss stats/armor. Bounded & single-layer: `revived` latches so it can never
  // revive again. Fires regardless of freeze (it's a death-trigger, like the hydra split). Run-only
  // (enemies are never serialized) → no save impact. Gated before the kill block so no bounty/combo
  // is paid on the fake death — only the real second kill below pays out.
  if (e.kind === 'boss' && e.bossType === 'revenant' && !e.revived && e.hp <= 0) {
    e.revived = true;
    e.hp = e.maxHp * 0.35;
    e.flash = 0.2;
    addExplosion(e.x, e.y, '#e34fd0', 22, 190);
    addFloater(e.x, e.y - 50, '↻ IT RISES!', '#e34fd0', 18);
    SFX.revenant();
    shake = Math.max(shake, 10);
    return;
  }
  if (e.hp <= 0) {
    e.dead = true;
    kills++;
    if (src) {
      src.kills++;
      // Tower veterancy (v1.100.0): a kill that crosses a rank threshold promotes the
      // tower — a chunky cosmetic flash (no stat change, "too easy"-safe). Compare the
      // tier before/after this single kill so it fires exactly once at each milestone.
      const newTier = towerRankTier(src.kills);
      if (newTier > towerRankTier(src.kills - 1)) {
        const rk = TOWER_RANKS[newTier];
        src.rankFlash = 1;
        addFloater(src.x, src.y - 30, '⭐ ' + rk.name.toUpperCase(), rk.color || '#fff', 15);
        addExplosion(src.x, src.y, rk.color || '#fff', 10, 110);
        SFX.rankup(newTier);
        shake = Math.max(shake, 4);
      }
    }
    // kill-streak combo: count this death, refresh the window, celebrate milestones
    comboCount++;
    comboTimer = COMBO_WINDOW;
    comboFlash = 1;
    if (comboCount > comboBest) comboBest = comboCount;
    if (comboCount === 5 || (comboCount >= 10 && comboCount % 10 === 0)) {
      const cc = comboColor(comboCount);
      SFX.combo(comboCount);
      shake = Math.max(shake, Math.min(13, 4 + comboCount * 0.16));
      // Celebrate on the center board, BELOW the whole top HUD band — clear of
      // the top-left combo meter (y~11-48), the centered round-clear
      // "Wave clear! +bonus" text (y~36-90), and the centered boss bar (y~8-32).
      addExplosion(W/2, 114, cc, 14, 150);
      addFloater(W/2, 132, `🔥 ${comboCount}× COMBO!`, cc, 22);
    }
    let bounty = e.bounty + perkState.bountyAdd;
    const luck = 0.08 * tRank('fortune');
    if (luck > 0 && Math.random() < luck) {
      bounty *= 2;
      addFloater(e.x, e.y - 28, 'LUCKY! ×2', '#d2a8ff', 13);
    }
    if (perkState.midas > 0 && Math.random() < perkState.midas) {
      bounty *= 5;
      addFloater(e.x, e.y - 40, '👑 MIDAS ×5!', '#ffd866', 16);
    }
    gold += bounty;
    // bounty pops fire on every kill — merge nearby ones so AoE/combo bursts read as
    // a single growing +N instead of a confetti of overlapping numbers
    addFloater(e.x, e.y - 14, `+${bounty}`, '#ffd866', 14,
      { merge: 'gold', value: bounty, prefix: '+', radius: 36 });
    if (e.kind === 'boss') {
      SFX.bossDeath();
      shake = Math.max(shake, 16);
      addExplosion(e.x, e.y, e.color, 36, 220);
      addFloater(e.x, e.y - 34, 'BOSS DOWN!', '#f85149', 22);
    } else {
      if (!silent) SFX.death();
      addExplosion(e.x, e.y, e.color, 10, 110);
    }
    if (e.kind === 'split') {
      for (let i = 0; i < 2; i++) {
        pendingSpawns.push({
          kind:'norm', hp: e.maxHp*0.3, maxHp: e.maxHp*0.3, spd: e.spd*1.4, r: 8,
          bounty: Math.max(1, Math.floor(e.bounty*0.3)), color:'#e3b341', armor:0, gap:0,
          dist: Math.max(0, e.dist - 6 - i*10), slow: 0, slowF: 0.6, frozen: 0, poison: null, flash: 0, px:0, py:0
        });
      }
    }
    // Fission wave-mod (v1.76.0, Mayhem): every slain enemy bursts into 2 weak spawnlings —
    // the wave-wide cousin of the native splitter (like Cloak is the cousin of the phantom).
    // The children are plain norms that do NOT carry the fission tag, so the wave can at most
    // ~triple in kills and never cascades (single layer, the Overkill/Cloak bounding pattern).
    // Bosses are excluded (kept clean — the summoner archetype already covers boss adds) and so
    // is the native `split` kind (it already spawns its own children — no double-burst). Children
    // pay a token bounty (0.2×, below split's 0.3×), so the mod is a net difficulty bump — more
    // targets + leak risk — not an economy farm; it can't make a run easier.
    if (e.fission && e.kind !== 'boss' && e.kind !== 'split') {
      for (let i = 0; i < 2; i++) {
        pendingSpawns.push({
          kind:'norm', hp: e.maxHp*0.18, maxHp: e.maxHp*0.18, spd: e.spd*1.25, r: 7,
          bounty: Math.max(1, Math.floor(e.bounty*0.2)), color:'#7ee787', armor:0, gap:0,
          dist: Math.max(0, e.dist - 6 - i*10), slow: 0, slowF: 0.6, frozen: 0, poison: null, flash: 0, px:0, py:0
        });
      }
      addExplosion(e.x, e.y, '#7ee787', 8, 90);
    }
    // Hydra boss archetype (v1.82.0, the 10th — a fresh DEATH-SPAWN axis: no other archetype
    // spawns on death; summoner spawns weak adds WHILE ALIVE). When a Hydra boss is slain it
    // splits into 2 sub-units ("heads") that continue the run — the fight isn't over when the
    // bar empties, so it pressures FOLLOW-UP DPS / coverage past the boss kill (pairs with
    // AoE / Reaper / Overkill). Bounded & single-layer: the heads are plain `norm`s (NOT bosses,
    // so no extra boss bar) with NO bossType, so they never re-split; they carry ~10% of the
    // boss's max HP each (well below the boss) and a token bounty, and they spawn slightly BEHIND
    // the death point so towers get a beat to react. Reuses the split/fission pendingSpawns
    // pattern (deferred spawn = safe to mutate `enemies` next frame). Run-only, no save impact.
    if (e.kind === 'boss' && e.bossType === 'hydra') {
      const hhp = e.maxHp * 0.10;
      for (let i = 0; i < 2; i++) {
        pendingSpawns.push({
          kind:'norm', hp: hhp, maxHp: hhp, spd: e.spd / 0.45 * 0.9, r: 10,
          bounty: Math.max(1, Math.floor(e.bounty * 0.05)), color:'#9ae65c', armor:0, gap:0,
          dist: Math.max(0, e.dist - 24 - i*18), slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0
        });
      }
      addExplosion(e.x, e.y, '#9ae65c', 16, 150);
      addFloater(e.x, e.y - 50, '🐉 IT SPLITS!', '#9ae65c', 18);
    }
    // Overkill perk (v1.59.0): the slain enemy detonates, splashing 25% of its max HP as
    // armor-ignoring true damage to nearby enemies. `fromOverkill` guards re-entry so a
    // splash-kill can't detonate again — single layer, naturally bounded by enemy count.
    if (perkState.overkill && !fromOverkill && e.kind !== 'boss') {
      const splash = e.maxHp * 0.25;
      addExplosion(e.x, e.y, '#ff7b3d', 14, 170);
      SFX.bomb();
      for (const o of enemies) {
        if (o === e || o.dead || o.hp <= 0) continue;
        const dx = o.x - e.x, dy = o.y - e.y;
        if (dx*dx + dy*dy <= 60*60) damage(o, splash, src, true, true, true);
      }
    }
    updateHud();
  }
}
