'use strict';
// ================= Update =================
let abilityUiAcc = 0;
function update(dt) {
  if (gameOver || paused || !started || draftOpen) return;
  gameTime += dt;

  // ability cooldowns
  for (const k of Object.keys(abilityCd)) abilityCd[k] = Math.max(0, abilityCd[k] - dt);
  abilityUiAcc += dt;
  if (abilityUiAcc > 0.25) { abilityUiAcc = 0; refreshAbilityBar(); }

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

  // spawning
  if (waveActive && spawnQueue.length) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const e = spawnQueue.shift();
      enemies.push({...e, dist: 0, slow: 0, slowF: 0.6, frozen: 0, poison: null, flash: 0, px: 0, py: 0});
      spawnTimer = e.gap;
    }
  }

  // enemies
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.frozen = Math.max(0, (e.frozen || 0) - dt);
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
    e.px = e.x; e.py = e.y;
    e.dist += e.spd * slowMul * dt;
    const p = pointAt(e.dist);
    e.x = p.x; e.y = p.y;
    if (e.kind === 'heal' && e.frozen <= 0) {
      for (const o of enemies) {
        if (o === e || o.dead || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x-e.x, o.y-e.y) < 70) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.04 * dt);
      }
    }
    if (e.dist >= pathLen) {
      e.dead = true;
      const dmgLives = e.kind === 'boss' ? 5 : 1;
      lives -= dmgLives;
      livesLostThisRun = true;
      shake = Math.max(shake, e.kind === 'boss' ? 14 : 6);
      addFloater(W-60, waypoints[waypoints.length-1][1] - 20, `-${dmgLives}❤️`, '#f85149', 18);
      SFX.life();
      if (lives <= 0) { lives = 0; endGame(); }
      updateHud();
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
    if (t.type === 'buff') continue;
    t.cd -= dt;
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
      dmg *= t.spec === 'deadeye' ? 4 : 2.5;
    }
    if (t.spec === 'executor' && (target.kind === 'tank' || target.kind === 'boss')) dmg *= 1.6;
    if (perkState.bossDmg > 1 && (target.kind === 'tank' || target.kind === 'boss')) dmg *= perkState.bossDmg;
    if (def.proj === 'chain') {
      fireChain(t, target, dmg);
    } else {
      projectiles.push({
        x: t.x + Math.cos(t.angle)*14, y: t.y + Math.sin(t.angle)*14,
        target, dmg, kind: def.proj, src: t, crit,
        ignoreArmor: t.spec === 'ap',
        color: def.color, spd: def.proj === 'bomb' ? 260 : 480
      });
      if (t.type === 'sniper') SFX.snipe();
      else if (t.type === 'frost') SFX.frost();
      else if (t.type === 'poison') SFX.poison();
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
  for (const f of floaters) { f.life -= dt; f.y -= 28*dt; }
  floaters = floaters.filter(f => f.life > 0);

  shake = Math.max(0, shake - 40*dt);

  // combo decay: streak lapses if no kill within the window
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { comboTimer = 0; comboCount = 0; } }
  if (comboFlash > 0) comboFlash = Math.max(0, comboFlash - dt*3);

  if (waveActive && !spawnQueue.length && !enemies.length && !pendingSpawns.length) endWave();
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
      case 'last':   val = -e.dist; break;
      case 'strong': val = e.hp; break;
      case 'close':  val = -d; break;
      default:       val = e.dist;
    }
    if (bestVal === null || val > bestVal) { bestVal = val; target = e; }
  }
  return target;
}

function fireChain(t, first, dmg) {
  SFX.tesla();
  const maxChain = 3 + perkState.chainExtra + (t.spec === 'super' ? 2 : 0);
  const falloff = t.spec === 'overcharge' ? 1 : 0.7;
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

function hitEnemy(p) {
  if (p.crit) {
    addFloater(p.target.x, p.target.y - 22, `CRIT ${Math.round(p.dmg)}!`, '#ff7b42', 15);
    SFX.crit();
  }
  if (p.kind === 'bomb') {
    SFX.bomb();
    shake = Math.max(shake, 3);
    const radius = 55 * perkState.splashMult * (p.src && p.src.spec === 'mega' ? 1.5 : 1);
    addExplosion(p.target.x, p.target.y, '#ffd866', 14, 140);
    for (const e of enemies) {
      if (e.x === undefined || e.dead) continue;
      if (Math.hypot(e.x-p.target.x, e.y-p.target.y) < radius) damage(e, p.dmg, p.src, false, p.ignoreArmor);
    }
  } else if (p.kind === 'poison') {
    let dur = perkState.poisonDur;
    let dps = p.dmg * 2.2;
    if (p.src) {
      if (p.src.spec === 'virulent') dps *= 2;
      if (p.src.spec === 'lingering') dur *= 2;
    }
    p.target.poison = { dps, t: dur, src: p.src };
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

function damage(e, dmg, src, silent=false, ignoreArmor=false) {
  if (e.hp <= 0 || e.dead) return;
  if (e.blinkInvuln > 0) return;  // phantom is intangible mid-blink
  const armor = ignoreArmor ? 0 : Math.max(0, (e.armor || 0) - 2 * tRank('piercing'));
  const actual = Math.max(0.5, dmg - armor * (dmg > 2 ? 1 : 0.05));
  const applied = Math.min(e.hp, actual);
  e.hp -= actual;
  if (!silent) e.flash = 0.08;
  if (src) src.dealt += applied;
  if (e.hp <= 0) {
    e.dead = true;
    kills++;
    if (src) src.kills++;
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
    addFloater(e.x, e.y - 14, `+${bounty}`, '#ffd866');
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
    updateHud();
  }
}

// ================= Game end =================
// ================= Achievements =================
const ACHIEVEMENTS = [
  { id:'first_win', icon:'🏆', name:'First Victory',  desc:'Win any game' },
  { id:'flawless',  icon:'💎', name:'Flawless',       desc:'Win a game without losing a single life' },
  { id:'hard_win',  icon:'🔥', name:'No Mercy',        desc:'Win a game on Hard difficulty' },
  { id:'camp10',    icon:'🏔️', name:'Mountaineer',     desc:'Clear Campaign level 10' },
  { id:'camp_done', icon:'👑', name:'Conqueror',       desc:'Complete the entire campaign (L40)' },
  { id:'endless50', icon:'♾️', name:'Endless',          desc:'Reach wave 50 in a single run' },
  { id:'million',   icon:'⚡', name:'Megadamage',       desc:'Deal 1,000,000 total damage (lifetime)' },
  { id:'veteran',   icon:'🎖️', name:'Veteran',          desc:'Finish 25 runs' },
  { id:'combo30',   icon:'💥', name:'Combo Master',     desc:'Reach a 30× kill-streak in a single run' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
function achDone() { return ACHIEVEMENTS.filter(a => meta.achievements[a.id]).length; }
// Tally a finished run and grant any newly-earned achievements. Returns the new ones.
function grantAchievements(won) {
  const runDmg = towers.reduce((s, t) => s + (t.dealt || 0), 0);
  meta.stats.dmg += runDmg;
  meta.stats.runs += 1;
  if (comboBest > (meta.stats.bestCombo || 0)) meta.stats.bestCombo = comboBest;
  const newly = [];
  const give = id => { if (!meta.achievements[id]) { meta.achievements[id] = true; newly.push(ACH_BY_ID[id]); } };
  if (won) give('first_win');
  if (won && !livesLostThisRun) give('flawless');
  if (won && diffKey === 'hard') give('hard_win');
  if (won && gameMode === 'campaign' && campLevel >= 10) give('camp10');
  if (won && gameMode === 'campaign' && campLevel >= CAMPAIGN_LEVELS) give('camp_done');
  if (wave >= 50) give('endless50');
  if (meta.stats.dmg >= 1e6) give('million');
  if (meta.stats.runs >= 25) give('veteran');
  if (comboBest >= 30) give('combo30');
  saveMeta();
  return newly;
}
function achLine(newly) {
  if (!newly.length) return '';
  return '\n🏅 Achievement' + (newly.length > 1 ? 's' : '') + ' unlocked: ' + newly.map(a => `${a.icon} ${a.name}`).join(' · ');
}
function openAchievements() { renderAchievements(); document.getElementById('achPanel').style.display = 'flex'; }
function closeAchievements() { document.getElementById('achPanel').style.display = 'none'; renderStartScreen(); }
// Records / personal bests. Updates the legacy per-difficulty key AND a new
// per-map+difficulty key (quick mode only; campaign maps are random per attempt).
// Both keys are additive — older saves without them just start at 0.
// Returns a record event {prev, now} when a quick-mode run beats its existing
// Records-grid cell (per map × difficulty), else null. First-ever entries
// (prev 0) record silently — the flourish only fires when you beat a real best.
function recordBest() {
  if (wave > best) { best = wave; localStorage.setItem(bestKey(), best); }
  let rec = null;
  if (gameMode === 'quick') {
    const k = 'cd_best_' + mapKey + '_' + diffKey;
    const prev = +(localStorage.getItem(k) || 0);
    if (wave > prev) {
      localStorage.setItem(k, wave);
      if (prev > 0) rec = { prev, now: wave };
    }
  }
  return rec;
}
// Celebrate a new personal best on the game-over/victory overlay: a golden
// banner + a triumphant fanfare + a particle/shake burst. rec=null clears it.
function applyRecordFlourish(rec) {
  const ov = document.getElementById('overlay'), el = document.getElementById('ovRecord');
  ov.classList.remove('record');
  if (!rec) { el.textContent = ''; return; }
  const delta = rec.now - rec.prev;
  el.textContent = `🏆 NEW RECORD! Wave ${rec.now} — beat your best of ${rec.prev} by ${delta} on ${MAPS[mapKey].name} · ${DIFFS[diffKey].name}`;
  void ov.offsetWidth;           // restart the pop/pulse animation
  ov.classList.add('record');
  setTimeout(() => SFX.record(), 450);   // land after the win/over sting
  shake = Math.max(shake, 16);
  for (let i = 0; i < 5; i++) addExplosion(120 + i*150, 60, '#e3b341', 14, 200);
}
function openBests() { renderBests(); document.getElementById('bestPanel').style.display = 'flex'; }
function closeBests() { document.getElementById('bestPanel').style.display = 'none'; renderStartScreen(); }
function renderBests() {
  const diffs = Object.keys(DIFFS), maps = Object.keys(MAPS);
  let html = '<table class="bestTbl"><thead><tr><th>Map</th>';
  for (const d of diffs) html += `<th>${DIFFS[d].name}</th>`;
  html += '</tr></thead><tbody>';
  for (const m of maps) {
    html += `<tr><td class="mname">${MAPS[m].name}</td>`;
    for (const d of diffs) {
      const v = +(localStorage.getItem('cd_best_' + m + '_' + d) || 0);
      html += `<td>${v ? v : '<span class="dash">—</span>'}</td>`;
    }
    html += '</tr>';
  }
  // "Any map" row surfaces the historical per-difficulty bests (legacy cd_best_<d>).
  html += '<tr class="anyrow"><td class="mname">★ Any map</td>';
  for (const d of diffs) {
    const v = +(localStorage.getItem('cd_best_' + d) || 0);
    html += `<td>${v ? v : '<span class="dash">—</span>'}</td>`;
  }
  html += '</tr></tbody></table>';
  const dmg = (meta.stats && meta.stats.dmg) || 0, runs = (meta.stats && meta.stats.runs) || 0;
  const bestCombo = (meta.stats && meta.stats.bestCombo) || 0;
  html += `<div class="bestStats">`
    + `<span>🎖 Campaign: <b>L${campaignDone()}</b> cleared</span>`
    + `<span>⚔ Lifetime dmg: <b>${fmtNum(dmg)}</b></span>`
    + `<span>🔥 Best combo: <b>${bestCombo ? bestCombo + '×' : '—'}</b></span>`
    + `<span>🎮 Runs: <b>${runs}</b></span>`
    + `<span>🪙 Chips: <b>${meta.chips}</b></span></div>`;
  document.getElementById('bestBody').innerHTML = html;
}
function renderAchievements() {
  document.getElementById('achProgress').textContent = `${achDone()} / ${ACHIEVEMENTS.length}`;
  const grid = document.getElementById('achGrid');
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const got = !!meta.achievements[a.id];
    const card = document.createElement('div');
    card.className = 'achCard' + (got ? ' got' : '');
    card.innerHTML = `<span class="aicon">${got ? a.icon : '🔒'}</span><b>${a.name}</b><small>${a.desc}</small>`;
    grid.appendChild(card);
  }
}

function chipsForRun() {
  const base = wave * DIFFS[diffKey].chipMult * (1 + 0.10 * tRank('scholar'));
  const victoryBonus = victory ? 25 + (gameMode === 'campaign' ? campLevel * 2 : 0) : 0;
  return Math.max(1, Math.round(base + victoryBonus));
}
function mvpLine() {
  const ranked = towers.filter(t => t.dealt > 0).sort((a,b) => b.dealt - a.dealt).slice(0, 3);
  if (!ranked.length) return '';
  return '\nMVPs: ' + ranked.map(t => `${TOWER_TYPES[t.type].icon} ${TOWER_TYPES[t.type].name} (${fmtNum(t.dealt)} dmg, ${t.kills} kills)`).join(' · ');
}
function perkLine() {
  if (!runPerks.length) return '';
  return '\nPerks: ' + runPerks.map(p => `${p.icon} ${p.name}`).join(' · ');
}
function endGame() {
  gameOver = true;
  SFX.over();
  clearRun();
  const earned = chipsForRun();
  meta.chips += earned;
  saveMeta();
  const newAch = grantAchievements(false);
  const rec = recordBest();
  document.getElementById('ovTitle').textContent = '💀 GAME OVER';
  document.getElementById('ovText').textContent =
    `You survived ${wave} waves with ${kills} kills on ${DIFFS[diffKey].name}. Best: ${best}\n🪙 +${earned} chips earned (total: ${meta.chips}) — spend them in Talents!` + mvpLine() + perkLine() + achLine(newAch);
  document.getElementById('ovContinue').style.display = 'none';
  document.getElementById('ovNext').style.display = 'none';
  document.getElementById('ovMain').textContent = 'Main Menu';
  document.getElementById('overlay').style.display = 'flex';
  applyRecordFlourish(rec);
  hideUpgrade();
  updateHud();
}
function winGame() {
  victory = true;
  gameOver = true;
  SFX.win();
  const earned = chipsForRun();
  meta.chips += earned;
  saveMeta();
  const newAch = grantAchievements(true);
  const rec = recordBest();
  const where = gameMode === 'campaign' ? `Campaign level ${campLevel}` : DIFFS[diffKey].name;
  document.getElementById('ovTitle').textContent = gameMode === 'campaign' ? `🏆 LEVEL ${campLevel} CLEARED!` : '🏆 VICTORY!';
  document.getElementById('ovText').textContent =
    `You beat all ${victoryWave()} waves (${where}, ${DIFFS[diffKey].name}) with ${kills} kills and ${lives} lives left!\n🪙 +${earned} chips earned (total: ${meta.chips})` + mvpLine() + perkLine() + achLine(newAch);
  if (gameMode === 'campaign') {
    if (campLevel > campaignDone()) localStorage.setItem('cd_campaign', campLevel);
    document.getElementById('ovNext').style.display = campLevel < CAMPAIGN_LEVELS ? 'inline-block' : 'none';
    document.getElementById('ovContinue').style.display = 'none';
    if (campLevel >= CAMPAIGN_LEVELS) {
      document.getElementById('ovTitle').textContent = '👑 CAMPAIGN COMPLETE!';
    }
  } else {
    document.getElementById('ovNext').style.display = 'none';
    document.getElementById('ovContinue').style.display = 'inline-block';
  }
  document.getElementById('ovMain').textContent = 'Main Menu';
  document.getElementById('overlay').style.display = 'flex';
  applyRecordFlourish(rec);
  hideUpgrade();
  updateHud();
}
function nextLevel() {
  if (gameMode !== 'campaign' || campLevel >= CAMPAIGN_LEVELS) return;
  campLevel++;
  document.getElementById('overlay').style.display = 'none';
  beginGame();
}
let quitArm = 0;
function quitRun() {
  if (!started || gameOver) return;
  const now = performance.now();
  if (now - quitArm > 3000) {
    quitArm = now;
    document.getElementById('quitBtn').textContent = '🚪 Sure?';
    setTimeout(() => { document.getElementById('quitBtn').textContent = '🚪 Quit'; }, 3000);
    return;
  }
  saveRun();
  document.getElementById('quitBtn').textContent = '🚪 Quit';
  backToMenu();
}
function continueEndless() {
  gameOver = false;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').textContent = `▶ Start Wave ${wave+1}`;
  if (autoWave) autoStartTimer = 4;
  updateHud();
}

