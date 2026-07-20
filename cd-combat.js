'use strict';
// ================= Combat =================
// Target selection + every damage-resolution path, split out of cd-update.js (v2.53.2) when that
// file neared the ~1500-line cap. Loads AFTER cd-update.js and BEFORE cd-endgame.js; classic
// scripts share one global scope, and update() only calls these at frame time, so the order is
// safe. Zero behaviour change from the split — the functions moved verbatim.
//
// Contents: effSpeed / pickTarget (targeting modes) · fireChain (Tesla) · fireRail (Railgun) ·
// fireBeam (Laser) · firePulse (Pulsar) · ricochetNext (Arc) · hitEnemy (projectile impact) ·
// damage (the single armor/shield/kill-credit/bounty resolution path).

// Effective current movement speed of an enemy, used by the 'fastest' targeting mode (v2.41.0)
// to prioritise the sprinters that leak first. Mirrors the movement-line multipliers (haste /
// adrenaline / berserker / accelerator) so it tracks the DYNAMIC speed, not just base speed;
// a frozen enemy counts as 0 (it isn't moving, so it isn't the leak threat right now).
function effSpeed(e) {
  if (e.frozen > 0) return 0;
  let sp = e.spd;
  if (e.hasted > 0) sp *= 1.35;
  if (e.adrenaline) sp *= 1 + 0.5 * Math.max(0, 1 - e.hp / e.maxHp);
  if (e.kind === 'boss' && e.bossType === 'berserker') sp *= 1 + 0.6 * Math.max(0, 1 - e.hp / e.maxHp);
  if (e.kind === 'boss' && e.bossType === 'accelerator') sp *= (e.accelMul || 1);
  return sp;
}
// Neighbour radius for the 'cluster' targeting mode (v2.53.0) — matches the Cannon splash (55px),
// so an AoE tower picks the enemy sitting in the densest knot and maximises splash coverage.
const CLUSTER_RADIUS = 55;
function pickTarget(t) {
  let target = null, bestVal = null;
  const range = effRange(t);
  for (const e of enemies) {
    if (e.x === undefined || e.dead || (e.blinkInvuln > 0 && !perkState.phaseSight)) continue;  // Spectral Sight (v2.41.0): see through intangibility
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
      // 'fastest' (v2.41.0): pick the fastest-moving enemy (dynamic effective speed), tie-break
      // toward the furthest-along — pop the sprinters (heralds / hasted / berserker / accelerator
      // bosses) before they leak. A fresh targeting axis (speed) beside position/HP/distance/kind.
      case 'fastest': val = effSpeed(e) * 1e4 + e.dist; break;
      // 'boss' (v2.45.0): prioritise boss enemies (a dedicated boss-killer), tie-break among
      // same class toward the furthest-along (like 'first'). Distinct from 'strong' (highest
      // CURRENT HP) — this locks the boss even when it's wounded, instead of switching to a
      // full-HP tank. With no boss in range it degrades to plain 'first' (mirrors 'support').
      case 'boss':    val = (e.kind === 'boss' ? 1e7 : 0) + e.dist; break;
      // 'cluster' (v2.53.0): pick the enemy sitting in the densest knot (most neighbours within
      // CLUSTER_RADIUS) so an AoE tower (Cannon/Mortar/Pulsar) maximises its splash coverage — a
      // fresh axis beside position/HP/distance/speed/kind. The nested count runs only for a
      // cluster-mode tower's candidates (bounded enemy count), so the common path is untouched.
      // Tie-break toward the furthest-along enemy (leak priority), with dist << any 1-neighbour gap.
      case 'cluster': {
        let n = 0;
        for (const o of enemies) {
          if (o.x === undefined || o.dead) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) <= CLUSTER_RADIUS) n++;
        }
        val = n * 1e4 + e.dist;
        break;
      }
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
    if (e.x === undefined || e.dead || (e.blinkInvuln > 0 && !perkState.phaseSight)) continue;  // skip intangible (phantom/cloak) unless Spectral Sight (v2.41.0)
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
// Arc tower (v2.52.0) levers: a TRAVELLING ricochet bolt (kind 'ricochet') — after each strike it
// hops to the nearest live enemy it hasn't already struck, out to ARC_SEEK px (much farther than
// Tesla's tight 90px chain), losing a little damage per hop. Distinct from Tesla: the bolt takes
// real flight time between targets (damage arrives over ~a second and the wave keeps advancing),
// it seeks SPREAD-OUT stragglers rather than a packed cluster, and each foe is struck once per
// bolt (bounded — struck[] can never re-ping, so no loops). Low base dmg → deliberately weak
// single-target (the anti-swarm sweeper role, poor vs tanks/bosses). Respects armor.
const ARC_HOPS = 4;              // ricochets after the first strike (5 hits/bolt; Ball Lightning spec +2)
const ARC_SEEK = 150;            // px the bolt can leap to the nearest fresh enemy (Magnet Coil spec ×1.6)
const ARC_FALLOFF = 0.85;        // damage retained per ricochet (full 5-hit volley totals ×3.71 base dmg)
// Warlord boss archetype (v2.14.0) lever: while alive it grants this much flat bonus armor to every
// living non-boss enemy (a global rally). Flat armor, so it asymmetrically checks low-per-hit DPS.
const WARLORD_ARMOR = 10;        // flat bonus armor on every rallied enemy
// Absorber boss archetype (v2.27.0, the 17th) lever: the most damage a SINGLE blow can take off it,
// as a fraction of its max HP. A huge Sniper/Cannon/crit hit is wasted past this ceiling, while a
// rapid stream of small hits is unaffected — the precise counter to the high-per-hit burst/crit
// build. Bounded: a cap not immunity (sustained DPS still kills it), and FREEZE lifts it (counter).
const ABSORB_CAP = 0.05;         // single-hit damage ceiling = maxHp × this (≥20 hits to kill)
// Chameleon boss archetype (v2.49.0, the 23rd) lever: it ADAPTS to whatever last hit it, so a second
// consecutive hit from the SAME tower TYPE deals this much less. It reads the previous damaging hit's
// tower type (e.lastHitType, tracked in damage()) — so spamming one tower kind at it is throttled,
// while a MIXED board (alternating types) barely notices. A fresh BUILD-DIVERSITY axis (nothing else
// keys off the damage source's type) and the direct check on a single dominant tower spam (the
// recurring "too easy" offender). Bounded/"too easy"-safe: it adds NO HP/speed, mixing towers escapes
// it entirely, and FREEZE lifts it (the reduction is gated `frozen<=0` in damage(), like the absorber
// cap). Run-only `lastHitType`/`adaptCd`, never persisted (enemies aren't serialized).
const ADAPT_REDUCTION = 0.5;     // repeated same-tower-type hit deals (1 − this) damage
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

// Pulsar (v2.23.0): a self-centred radial AoE tower — it resolves INSTANTLY (no travelling
// projectile, like fireChain/fireRail/fireBeam) and damages EVERY enemy within its range at
// once. It's the only tower whose AoE is centred on itself rather than a projectile's impact
// point, so it's a dedicated swarm tool: total output scales with how many foes are packed in,
// but per-hit damage is among the lowest in the game and the range is short, so it's deliberately
// poor against single tanks/bosses (the inverse of the Laser). Respects armor (NOT a melter).
// The expanding ring is the firing cue (reuses addRing — gated by the particle/reduce-motion
// settings, so it suppresses with every other juice effect). The caller already ramped `dmg`
// (crit/boss/combo/ambush mults) before this branch, like the other instant-fire towers.
function firePulse(t, dmg) {
  SFX.pulsar();
  const def = TOWER_TYPES[t.type];
  const range = effRange(t);
  for (const e of enemies) {
    if (e.x === undefined || e.dead || (e.blinkInvuln > 0 && !perkState.phaseSight)) continue;   // skip intangible (phantom/cloak) unless Spectral Sight (v2.41.0)
    if (Math.hypot(e.x - t.x, e.y - t.y) <= range + e.r) {
      damage(e, dmg, t);
      addExplosion(e.x, e.y, def.color, 3, 60);
    }
  }
  addRing(t.x, t.y, def.color, range, { life: 0.4, w: 3 });
  shake = Math.max(shake, 0.8);
}

// Arc tower (v2.52.0): route the bolt to its next victim. Called from the projectile loop —
// `consume` is true after a real strike (records the victim, spends a hop, applies the damage
// falloff, and quiets the crit flair so it only fires on the first hit); false on a mid-flight
// retarget (the flight target died to someone else — the bolt hasn't delivered that hit yet, so
// the hop is free). Returns true if a fresh target was found; false → the caller kills the bolt.
function ricochetNext(p, consume) {
  if (consume) {
    p.struck.push(p.target);
    if (p.struck.length > arcBestChain) arcBestChain = p.struck.length;   // 🪩 Pinball achievement (v2.52.0)
    if (p.hops <= 0) return false;
    p.hops--;
    p.dmg *= ARC_FALLOFF;
    p.crit = false;   // one CRIT floater/sound per bolt (the multiplied dmg still carries through hops)
  }
  let next = null, nd = Infinity;
  for (const e of enemies) {
    if (e.x === undefined || e.dead || e.hp <= 0 || p.struck.includes(e)
        || (e.blinkInvuln > 0 && !perkState.phaseSight)) continue;   // skip intangible unless Spectral Sight
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < p.seek && d < nd) { nd = d; next = e; }
  }
  if (!next) return false;
  // Render flourish (v2.54.0): draw a short jagged arc between the enemy just struck and the one
  // the bolt leaps to, so a ricochet chain READS as a chain instead of an orb silently changing
  // course. Reuses the existing non-`straight` beam path (the tesla lightning look) — no new
  // render code, no new state. Only on a real strike (`consume`); a mid-flight free retarget has
  // no strike point to arc from. Beams are run-only and never serialized.
  if (consume) beams.push({ x1: p.x, y1: p.y, x2: next.x, y2: next.y, life: 0.12, color: TOWER_TYPES.arc.color });
  p.target = next;
  return true;
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
  if (e.blinkInvuln > 0 && !perkState.phaseSight) return;  // phantom is intangible mid-blink (Spectral Sight perk sees through it, v2.41.0)
  if (e.shieldOn) dmg *= 0.4;     // bulwark boss: active shield phase soaks 60% of incoming
  if (e.warded > 0) dmg *= 0.6;   // warden aura (v1.35.0): protected enemies take 40% less damage
  if (e.conduitGuard > 0) dmg *= (1 - 0.14 * e.conduitGuard);  // conduit boss (v2.2.0): each nearby escort shields it −14% (cap −70% at 5)
  // Absorber boss (v2.27.0, the 17th archetype — a fresh per-hit-CAP axis: it can only absorb so much
  // from one blow, so a single huge Sniper/Cannon/crit hit is wasted while a rapid stream of small
  // hits isn't). The precise counter to the high-per-hit burst/crit build (the recurring "too easy"
  // offender, strengthened by Critical Mass v2.20.0) — the inverse of the Fortifier (flat armor checks
  // LOW per-hit DPS). Bounded / "too easy"-safe: a cap not immunity (sustained DPS still kills it; adds
  // no HP/speed), and FREEZE COUNTERS IT (the cap lifts while frozen, so a Frost build cracks it open).
  if (e.bossType === 'absorber' && e.frozen <= 0) dmg = Math.min(dmg, e.maxHp * ABSORB_CAP);
  // Chameleon boss (v2.49.0, the 23rd): a fresh BUILD-DIVERSITY axis — a second consecutive hit from
  // the SAME tower TYPE deals −50%, so spamming one tower kind is throttled while a mixed board (hits
  // alternate types) barely feels it. Reads/updates the previous damaging hit's tower type. Gated
  // frozen<=0 (freeze lifts it, like the absorber cap) and src?.type (DoT/meteor with src=null skip).
  if (e.bossType === 'adaptive' && e.frozen <= 0 && src && src.type) {
    if (src.type === e.lastHitType) dmg *= (1 - ADAPT_REDUCTION);
    e.lastHitType = src.type;
  }
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
      bossKills++;   // 🦣 Big Game Hunter (v2.47.0): real boss kills only (the revenant fake death returns earlier)
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
