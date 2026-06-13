'use strict';
// ================= Start screen =================
function renderStartScreen() {
  document.getElementById('chipsBtn').textContent = meta.chips;
  document.getElementById('achBtn').textContent = `${achDone()}/${ACHIEVEMENTS.length}`;
  document.getElementById('verTag').textContent = GAME_VERSION;
  // Daily Challenge button: show today's date + this player's best wave so far today.
  const dBtn = document.getElementById('dailyBtn');
  if (dBtn) {
    const ds = dailyDateString();
    const dbest = +(localStorage.getItem('cd_daily_' + ds) || 0);
    const streak = currentDailyStreak();
    const tags = (dbest ? `best w${dbest}` : '') + (streak > 1 ? `${dbest ? ' · ' : ''}🔥${streak}d` : '');
    dBtn.innerHTML = `🗓 Daily Challenge${tags ? ` <small style="opacity:.75">${tags}</small>` : ''}`;
    dBtn.title = `Today's seeded challenge (${ds}) — same map, difficulty & modifiers for every player today. One-off run; doesn't affect your saved game.`
      + (streak > 1 ? ` You're on a ${streak}-day streak — play today to keep it alive!` : '');
  }
  let hasSave = false;
  try { const s = JSON.parse(localStorage.getItem('cd_save')); hasSave = !!(s && s.wave > 0); } catch(e) {}
  document.getElementById('resumeBtn').style.display = hasSave ? 'inline-block' : 'none';
  if (hasSave) {
    try {
      const s = JSON.parse(localStorage.getItem('cd_save'));
      const whereLbl = s.gameMode === 'campaign' ? `Campaign ${s.campLevel}` : MAPS[s.mapKey].name;
      document.getElementById('resumeBtn').textContent = `⏯ Resume (wave ${s.wave}, ${whereLbl})`;
    } catch(e) {}
  }
  // mode selector
  const modeRow = document.getElementById('modeRow');
  modeRow.innerHTML = '';
  const modes = [
    { id:'quick', name:'Quick Play', desc:'Pick a map, survive 30 waves' },
    { id:'campaign', name:'🏔️ Campaign', desc:`${campaignDone()}/${CAMPAIGN_LEVELS} levels cleared` },
  ];
  for (const m of modes) {
    const b = document.createElement('button');
    b.className = 'optBtn' + (gameMode === m.id ? ' sel' : '');
    b.innerHTML = `${m.name}<small>${m.desc}</small>`;
    b.onclick = () => { gameMode = m.id; renderStartScreen(); };
    modeRow.appendChild(b);
  }
  const mapRow = document.getElementById('mapRow');
  mapRow.innerHTML = '';
  if (gameMode === 'quick') {
    document.getElementById('mapLabel').textContent = 'MAP';
    for (const k of Object.keys(MAPS)) {
      const b = document.createElement('button');
      b.className = 'optBtn' + (mapKey===k ? ' sel' : '');
      b.innerHTML = `${MAPS[k].name}<small>${MAPS[k].desc}</small>`;
      b.onclick = () => { mapKey = k; mapTheme = pickMapTheme(); renderStartScreen(); buildPath(); };
      mapRow.appendChild(b);
    }
  } else {
    document.getElementById('mapLabel').textContent = `LEVEL — waves to clear: ${14 + campLevel}, random map each attempt`;
    const done = campaignDone();
    if (campLevel > done + 1) campLevel = done + 1;
    for (let i = 1; i <= CAMPAIGN_LEVELS; i++) {
      const b = document.createElement('button');
      const locked = i > done + 1;
      b.className = 'lvlBtn' + (campLevel === i ? ' sel' : '') + (i <= done ? ' done' : '') + (locked ? ' locked' : '');
      b.innerHTML = i <= done ? `${i}<small>✓</small>` : locked ? `🔒<small>${i}</small>` : `${i}<small>${14 + i}w</small>`;
      if (!locked) b.onclick = () => { campLevel = i; renderStartScreen(); };
      mapRow.appendChild(b);
    }
  }
  const diffRow = document.getElementById('diffRow');
  diffRow.innerHTML = '';
  for (const k of Object.keys(DIFFS)) {
    const b = document.createElement('button');
    b.className = 'optBtn' + (diffKey===k ? ' sel' : '');
    const bw = +(localStorage.getItem('cd_best_' + k) || 0);
    b.innerHTML = `${DIFFS[k].name}<small>${DIFFS[k].desc}${bw ? ' · best: '+bw : ''} · ${DIFFS[k].chipMult}× 🪙</small>`;
    b.onclick = () => { diffKey = k; renderStartScreen(); };
    diffRow.appendChild(b);
  }
}
// Dim the in-game chrome (stats HUD, tower shop, wave controls, hotkey hint)
// when no game is active so the start screen reads as the only live surface.
function setActiveUI() {
  const col = document.getElementById('gameCol');
  if (col) col.classList.toggle('idle', !started);
}
function beginGame() {
  daily = false;
  clearRun();
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  resetState();
  setActiveUI();
  SFX.wave();
}
// Daily Challenge (v1.28.0): start today's deterministic, date-seeded Mayhem run. The map path,
// difficulty and per-wave modifier schedule are all fixed by the local date (setupDaily), so
// scores are comparable day-to-day. Deliberately does NOT clearRun() — a daily is one-off and
// not resumable (saveRun bails on `daily`), so the player's existing saved run survives untouched.
function beginDaily() {
  daily = true;
  gameMode = 'quick';
  mapKey = 'mayhem';
  setupDaily();          // sets dailyDateKey/dailySeed, diffKey, MAPS.mayhem.pts, dailyMods
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  resetState();          // !daily-guarded so it keeps the seeded path; loads cd_daily_<date> as `best`
  setActiveUI();
  SFX.wave();
}
function backToMenu() {
  started = false;
  daily = false;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  renderStartScreen();
  resetState();
  setActiveUI();
}

// ================= Enemies =================
function enemyTemplate(w) {
  const d = DIFFS[diffKey];
  const campScale = gameMode === 'campaign' ? 1 + (campLevel - 1) * 0.04 : 1;
  // Enemy HP, tuned iteratively per recurring owner "too easy" FEEDBACK:
  //  • global multiplier 1.2 -> 1.44 (v1.9.2) -> 1.80 (v1.10.0): uniform up-shift.
  //  • v1.13.3: the SUPERLINEAR term `w^1.9` gets a ×1.25 coefficient to STEEPEN the
  //    per-wave ramp (owner: early waves are now hard but it plateaus after ~w10).
  //    Because it scales only the dominant-at-high-w term, the HP swing is tiny early
  //    (~+7% at w5, +12% at w10) and grows toward — but never exceeds — +25% as the
  //    term dominates (asymptote = 1.25), so it stays inside the ≤25%/number guardrail
  //    at EVERY wave incl. deep endless, while making each later wave a bigger jump.
  const hpBase = (18 + w*7 + 1.25 * Math.pow(w, 1.9)) * 1.80 * d.hp * campScale;
  // Bounty per kill, trimmed v1.16.1 to cool the front-loaded gold snowball (owner FEEDBACK
  // "I clear classic-normal with money from the first 10 rounds"). Kills are ~69% of early
  // income; cutting the FLAT term 4->3 (slope w*0.6 kept) trims bounty ~20% at w1, fading to
  // ~10% by w10 and ~6% by w20 — front-loaded where the over-build happens, barely touching
  // deep endless. Specials/boss scale off this, so the trim propagates proportionally.
  return { hp: hpBase, speed: 55 + Math.min(50, w*1.6), bounty: Math.max(2, Math.round((3 + w*0.6) * d.bounty)) };
}
// Boss archetype rotation (v1.25.0). Indexed by boss number from wave 20 on, so deep
// bosses cycle regen → summoner → bulwark. KEEP IN SYNC with the update()/render() and
// damage() handlers (cd-update.js / cd-render.js) and the wave-preview note below.
const BOSS_ARCHETYPES = ['regen', 'summoner', 'bulwark'];
function buildWave(w) {
  const q = [];
  let count = 8 + Math.floor(w*1.7);
  if (modIs('swarm')) count = Math.floor(count * 1.6);
  const t = enemyTemplate(w);
  for (let i = 0; i < count; i++) {
    let e = { kind:'norm', hp:t.hp, spd:t.speed, r:11, bounty:t.bounty, color:'#3fb950', armor:0, gap:0.8 };
    if (w >= 3 && i % 5 === 4)  e = { kind:'fast', hp:t.hp*0.55, spd:t.speed*1.8, r:8,  bounty:Math.ceil(t.bounty*1.2), color:'#d2a8ff', armor:0, gap:0.45 };
    if (w >= 5 && i % 7 === 6)  e = { kind:'tank', hp:t.hp*3.2,  spd:t.speed*0.6, r:16, bounty:Math.ceil(t.bounty*2),   color:'#f0883e', armor:0, gap:0.8 };
    if (w >= 7 && i % 9 === 8)  e = { kind:'heal', hp:t.hp*1.4,  spd:t.speed*0.8, r:12, bounty:Math.ceil(t.bounty*2.2), color:'#56d364', armor:0, gap:0.9 };
    if (w >= 9 && i % 8 === 7)  e = { kind:'shield', hp:t.hp*1.8, spd:t.speed*0.75, r:13, bounty:Math.ceil(t.bounty*2), color:'#8b949e', armor: 3 + w*0.5, gap:0.85 };
    if (w >= 11 && i % 10 === 9) e = { kind:'split', hp:t.hp*1.6, spd:t.speed*0.9, r:14, bounty:Math.ceil(t.bounty*1.5), color:'#e3b341', armor:0, gap:0.9 };
    if (w >= 13 && i % 6 === 5)  e = { kind:'phantom', hp:t.hp*0.9, spd:t.speed*1.15, r:10, bounty:Math.ceil(t.bounty*1.8), color:'#39d0d8', armor:0, gap:0.6 };
    if (modIs('swarm'))  e.hp *= 0.65;
    if (modIs('titans')) { e.hp *= 1.5; e.bounty = Math.ceil(e.bounty * 1.5); }
    if (modIs('frenzy')) e.spd *= 1.35;
    if (modIs('goldrush')) e.bounty *= 2;
    if (modIs('armored')) e.armor += 5 + Math.floor(w * 0.3);
    if (modIs('regen'))   e.regen = true;
    e.maxHp = e.hp;
    q.push(e);
  }
  if (w % 5 === 0 && w > 0) {
    // Boss HP = template × mult. Slope steepened 0.5 -> 0.6 (v1.24.4) to make the
    // climactic every-5th-wave threat harder LATE without touching early waves — the
    // documented "too easy" plateau is mid-late (owner FEEDBACK), and the norm-enemy
    // HP curve is already maxed against test [16]'s ≤25%-vs-baseline invariant, so the
    // boss slope (untouched by that test) is the open late-game lever. The +14 constant
    // bounds the swing: per-wave boss HP grows +3% (w5) → +10% (w30), asymptoting to +20%
    // (= the coefficient change), inside the ≤25%/number/run guardrail at every wave.
    const mult = 14 + w*0.6;
    const boss = { kind:'boss', hp:t.hp*mult, maxHp:t.hp*mult, spd:t.speed*0.45, r:24, bounty:t.bounty*12, color:'#f85149', armor: w*0.4, gap:1.5 };
    // Boss ARCHETYPES (v1.25.0): from wave 20+ the every-5th-wave boss gains a MECHANIC
    // (regen / summoner / bulwark shield) on a 3-cycle — hardening the LATE game off the
    // HP axis, since the norm-enemy HP curve is already invariant-capped (see [16] / the
    // enemyTemplate note in CLAUDE.md). Early/tutorial bosses (w5/10/15, and campaign
    // L1–5 finals at victoryWave<20) stay vanilla, so the early game is untouched. The
    // mechanic itself is run-only state (ticked in update()), so it's never persisted.
    if (w >= 20) boss.bossType = BOSS_ARCHETYPES[(w/5 - 4) % BOSS_ARCHETYPES.length];
    if (modIs('titans')) { boss.hp *= 1.5; boss.bounty = Math.ceil(boss.bounty * 1.5); }
    if (modIs('goldrush')) boss.bounty *= 2;
    if (modIs('frenzy')) boss.spd *= 1.35;
    if (modIs('armored')) boss.armor += 5 + Math.floor(w * 0.3);
    if (modIs('regen'))   boss.regen = true;
    boss.maxHp = boss.hp;
    q.push(boss);
  }
  return q;
}
// Composition of an upcoming wave as ordered {kind,count} entries — the DETERMINISTIC
// base roster (before any mayhem wave-mod is rolled), feeding the bottom-left icon
// wave-preview so players can plan purchases (how many tanks? is there a boss?).
// Mirrors the kind-assignment order/conditions in buildWave() — KEEP IN SYNC.
function waveComposition(w) {
  const count = 8 + Math.floor(w*1.7);
  const tally = {};
  for (let i = 0; i < count; i++) {
    let k = 'norm';
    if (w >= 3  && i % 5  === 4) k = 'fast';
    if (w >= 5  && i % 7  === 6) k = 'tank';
    if (w >= 7  && i % 9  === 8) k = 'heal';
    if (w >= 9  && i % 8  === 7) k = 'shield';
    if (w >= 11 && i % 10 === 9) k = 'split';
    if (w >= 13 && i % 6  === 5) k = 'phantom';
    tally[k] = (tally[k] || 0) + 1;
  }
  const order = ['norm','fast','tank','heal','shield','split','phantom'];
  const out = order.filter(k => tally[k]).map(k => ({ kind: k, count: tally[k] }));
  if (w % 5 === 0 && w > 0) out.push({ kind: 'boss', count: 1 });
  return out;
}

function startWave() {
  if (gameOver || !started || draftOpen) return;
  // Concurrent waves: allow starting the next wave while others are still running,
  // up to MAX_CONCURRENT_WAVES unsettled at once (so you can pour multiple waves onto
  // the path at the same time). The classic between-waves start still works too.
  if (wave - lastSettledWave >= MAX_CONCURRENT_WAVES) return;
  if (!waveActive && autoStartTimer > 0.5 && wave > 0) {
    const bonus = Math.floor(autoStartTimer * 4);
    gold += bonus;
    addFloater(W/2, 70, `Early call! +${bonus}💰`, '#3fb950', 16);
  }
  wave++;
  if (isMayhem() && !daily && wave > 1 && (wave - 1) % 5 === 0) shiftWorld();  // daily path is fixed
  rollWaveMod();
  spawners.push({ queue: buildWave(wave), timer: 0 });  // a parallel spawn stream for this wave
  waveActive = true;
  autoStartTimer = -1;
  document.getElementById('startBtn').disabled = (wave - lastSettledWave >= MAX_CONCURRENT_WAVES);
  document.getElementById('startBtn').textContent =
    (wave - lastSettledWave >= MAX_CONCURRENT_WAVES) ? `🌊 Wave ${wave}...` : `➕ Add Wave ${wave+1}`;
  SFX.wave();
  updateHud();
}

// Called once when the field fully clears (no spawners, enemies, or pending spawns).
// Settles EVERY bundled wave from lastSettledWave+1..wave: pays each clear bonus and
// queues a draft for each multiple-of-5 crossed, so rushing never loses bonuses/drafts.
function endWave() {
  waveActive = false;
  waveMod = null;
  const from = lastSettledWave + 1, to = wave;
  lastSettledWave = wave;
  if (wave >= victoryWave() && !victory) { winGame(); return; }
  let totalBonus = 0, drafts = 0;
  const interestCap = 30 + 10 * tRank('banking');
  for (let w = from; w <= to; w++) {
    const interest = Math.floor(Math.min((gold + totalBonus) * 0.05, interestCap));
    // Wave-clear bonus, trimmed v1.16.1 (25->20 base, w*5->w*4 slope) — a flat ~20% cut to the
    // second-largest early income source, part of the same front-loaded-snowball trim as bounty.
    totalBonus += Math.floor((20 + w*4) * (1 + 0.10 * tRank('momentum')) * perkState.waveBonusMult) + interest;
    if (w % 5 === 0 && w < victoryWave()) drafts++;
  }
  gold += totalBonus;
  const label = to > from ? `${to - from + 1} waves clear!` : 'Wave clear!';
  addFloater(W/2, 50, `${label} +${totalBonus}💰`, '#ffd866', 18);
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').textContent = `▶ Start Wave ${wave+1}`;
  pendingDrafts += drafts;
  if (pendingDrafts > 0) {
    openDraft();
  } else if (autoWave) {
    autoStartTimer = 6;
  }
  saveRun();
  updateHud();
}

// ================= Helpers =================
function updateHud() {
  document.getElementById('gold').textContent = Math.floor(gold);
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('waveGoal').textContent = victory ? '∞' : victoryWave();
  document.getElementById('kills').textContent = kills;
  document.getElementById('chips').textContent = meta.chips;
  document.getElementById('best').textContent = best;
  renderShop();
  maybeRefreshUpgrade();
}
function addFloater(x, y, text, color, size=14, opts=null) {
  // Aggregation: floaters tagged with a `merge` group (e.g. gold/crit) fold into a
  // nearby recent one of the same group instead of spamming a fresh number — their
  // `value`s sum and the text/position/life refresh. Keeps mass-kill bursts readable.
  if (opts && opts.merge) {
    let best = null, bd = opts.radius || 32;
    for (const f of floaters) {
      if (f.merge !== opts.merge || f.life < 0.25) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) {
      best.value += opts.value;
      best.text = (opts.prefix || '') + Math.round(best.value) + (opts.suffix || '');
      best.life = 1.2; best.x = (best.x + x) / 2; best.y = Math.min(best.y, y);
      best.size = size; best.color = color;
      return best;
    }
    floaters.push({ x, y, text, color, size, life: 1.2, merge: opts.merge, value: opts.value });
    return;
  }
  floaters.push({x, y, text, color, size, life: 1.2});
}
function shade(col, amt) {
  if (col[0] !== '#') return col;
  const n = parseInt(col.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
function addExplosion(x, y, color, n=10, spd=120) {
  n = Math.round(n * particleDensity);                  // user Settings: Full/Reduced/Off
  // reduced-motion: thin out the burst further (keep a faint hit cue, drop the spray)
  if (reduceMotion() && n > 0) { n = Math.max(1, Math.ceil(n * 0.3)); spd *= 0.5; }
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, v = (0.3+Math.random()*0.7)*spd;
    particles.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 0.4+Math.random()*0.3, color});
  }
}

// ================= Shop =================
function renderShop() {
  const shop = document.getElementById('shop');
  shop.innerHTML = '';
  TYPE_KEYS.forEach((key, i) => {
    const t = TOWER_TYPES[key];
    const cost = costOf(key);
    const btn = document.createElement('div');
    btn.className = 'towerBtn' + (selectedShop===key ? ' selected' : '') + (gold < cost ? ' cant' : '');
    btn.title = `${t.name} — ${t.tip || t.desc} · range ${Math.round(t.range)}`;  // hover tooltip
    btn.innerHTML = `<span class="key">${i+1}</span><span class="icon">${t.icon}</span>${t.name}<br><span class="price">${cost}💰</span><br><small style="color:#8b949e">${t.desc}</small>`;
    btn.onclick = () => {
      if (gold < cost) return;
      selectedShop = selectedShop === key ? null : key;
      selectedTower = null; hideUpgrade();
      armedAbility = null; refreshAbilityBar();
      renderShop();
    };
    // hovering a shop button previews that tower's range ring on the board (before
    // you select/place) so you can compare coverage at a glance
    btn.onpointerenter = () => { hoveredShop = key; };
    btn.onpointerleave = () => { if (hoveredShop === key) hoveredShop = null; };
    shop.appendChild(btn);
  });
}

// ================= Upgrade panel =================
const upPanel = document.getElementById('upgradePanel');
let upPanelKey = '';
function upgradeKey(t) {
  const upCost = Math.floor(costOf(t.type) * 0.8 * t.level);
  const stat = t.type === 'buff'
    ? Math.round(effBuffPower(t) * 100) + '|' + Math.round(effBuffRange(t))
    : Math.round(effDmg(t)) + '|' + effRate(t).toFixed(3);
  return [t.level, t.spec, gold >= upCost, Math.floor(t.invested * sellRatio()), t.mode, Math.floor(t.dealt / 500), stat].join('|');
}
function maybeRefreshUpgrade() {
  if (!selectedTower || upPanel.style.display !== 'block') return;
  if (upgradeKey(selectedTower) !== upPanelKey) showUpgrade(selectedTower);
}
function showUpgrade(t) {
  selectedTower = t;
  upPanelKey = upgradeKey(t);
  const lvl = t.level;
  const upCost = Math.floor(costOf(t.type) * 0.8 * lvl);
  const sellVal = Math.floor(t.invested * sellRatio());
  const maxed = lvl >= maxTowerLevel();
  const def = TOWER_TYPES[t.type];
  const isBuff = t.type === 'buff';
  const spec = specOf(t);
  let specHtml = '';
  if (lvl >= 5 && !t.spec) {
    specHtml = SPECS[t.type].map((s, i) =>
      `<button class="spec" onclick="chooseSpec(${i})">★ ${s.name}<br><small>${s.desc}</small></button>`).join('');
  } else if (spec) {
    specHtml = `<div class="specTag">★ ${spec.name}</div>`;
  }
  upPanel.innerHTML = `
    <b>${def.icon} ${def.name} Lv.${lvl}</b><br>
    ${isBuff
      ? `<span class="statline">aura +${Math.round(effBuffPower(t)*100)}% dmg · range ${Math.round(effBuffRange(t))}</span><br>
         <span class="statline">auras don't stack — strongest applies</span>`
      : `<span class="statline">dmg ${Math.round(effDmg(t))} · range ${Math.round(t.range)} · ${(1/effRate(t)).toFixed(1)}/s</span><br>
         <span class="statline">dealt: ${fmtNum(t.dealt)} · kills: ${t.kills}</span>`}
    ${specHtml}
    ${!isBuff ? `<button class="mode" onclick="cycleMode()">${MODE_ICON[t.mode]}</button>` : ''}
    <button ${maxed || gold < upCost ? 'disabled' : ''} onclick="upgradeTower()">${maxed ? 'MAX LEVEL' : `⬆ Upgrade ${upCost}💰`}</button>
    <button class="sell" onclick="sellTower()">💸 Sell ${sellVal}💰</button>`;
  upPanel.style.display = 'block';
  // Pinned to the lower-left corner (owner request) instead of hovering at the
  // clicked tower, so the menu never covers live combat on the path. Bottom-
  // anchored so a taller panel (spec choice at L5) grows upward and never clips
  // off the canvas bottom. The faint between-wave "Next:" preview shares this
  // corner but only shows while no wave is active, so the overlap is minimal.
  upPanel.style.left = '10px';
  upPanel.style.top = 'auto';
  upPanel.style.bottom = '10px';
}
function chooseSpec(i) {
  const t = selectedTower;
  if (!t || t.spec || t.level < 5) return;
  t.spec = SPECS[t.type][i].id;
  addFloater(t.x, t.y - 24, `★ ${SPECS[t.type][i].name}!`, '#d2a8ff', 16);
  addExplosion(t.x, t.y, '#d2a8ff', 16, 100);
  SFX.upgrade();
  saveRun();
  showUpgrade(t);
}
function fmtNum(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
  return Math.round(n);
}
function hideUpgrade() { upPanel.style.display = 'none'; selectedTower = null; }
function cycleMode() {
  const t = selectedTower;
  if (!t) return;
  t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length];
  showUpgrade(t);
}
function upgradeTower() {
  const t = selectedTower;
  if (!t || t.level >= maxTowerLevel()) return;
  const cost = Math.floor(costOf(t.type) * 0.8 * t.level);
  if (gold < cost) return;
  gold -= cost;
  t.invested += cost;
  t.level++;
  t.dmg *= 1.45;
  t.range *= 1.08;
  t.rate *= 0.88;
  if (t.type === 'buff') t.buffPower += 0.08; // tapered from 0.1 (v1.16.2) — cool the maxed-booster carry
  addFloater(t.x, t.y - 20, 'LEVEL UP!', '#3fb950', 14);
  addExplosion(t.x, t.y, '#3fb950', 12, 80);
  SFX.upgrade();
  updateHud();
  showUpgrade(t);
}
function sellTower() {
  const t = selectedTower;
  if (!t) return;
  const refund = Math.floor(t.invested * sellRatio());
  gold += refund;
  towers = towers.filter(x => x !== t);
  addFloater(t.x, t.y, `+${refund}💰`, '#ffd866');
  SFX.sell();
  hideUpgrade();
  updateHud();
}

// ================= Effective stats =================
function effDmg(t) {
  let d = t.dmg * metaDmgMult() * buffMultFor(t) * (perkState.typeDmg[t.type] || 1) * perkState.dmgMult;
  d *= 1 + 0.06 * tRank('mastery_' + t.type);
  if (t.spec === 'ap') d *= 1.25;
  if (t.spec === 'shatter') d *= 4.5;
  if (t.spec === 'cluster') d *= 1.5;
  if (t.spec === 'mega') d *= 1.15;
  if (t.spec === 'demo') d *= 1.35;
  if (modIs('surge')) d *= 1.3;
  // Last Stand legendary (v1.22.0): comeback damage scaling with lives lost this run.
  if (perkState.lastStand) d *= 1 + Math.min(0.6, 0.03 * perkState.livesLost);
  // Glass Cannon legendary (v1.32.0): +50% damage (paired with a −30% range cut in effRange).
  if (perkState.glassCannon) d *= 1.5;
  return d;
}
function effRate(t) {
  let r = t.rate * perkState.rateMult;
  if (t.spec === 'minigun') r *= 0.55;
  if (modIs('brownout')) r *= 1.25;  // mayhem debuff: +25% reload = slower fire
  return r;
}
function effRange(t) {
  // Glass Cannon legendary (v1.32.0): −30% combat range (the cost of the +50% damage in effDmg).
  // Applies to firing range only, not booster auras (effBuffRange) — buff towers deal no damage.
  return t.range * (1 + 0.02 * tRank('mastery_' + t.type)) * (modIs('fog') ? 0.8 : 1) * (perkState.glassCannon ? 0.7 : 1);
}
function effBuffPower(t) {
  return t.buffPower + (t.spec === 'overclock' ? 0.2 : 0) + (t.spec === 'network' ? 0.1 : 0) + 0.03 * tRank('mastery_buff');
}
function effBuffRange(t) {
  return t.range * (t.spec === 'network' ? 1.5 : 1) * (1 + 0.02 * tRank('mastery_buff'));
}
function buffMultFor(t) {
  if (t.type === 'buff') return 1;
  let m = 0;
  for (const b of towers) {
    if (b.type !== 'buff') continue;
    if (Math.hypot(b.x-t.x, b.y-t.y) <= effBuffRange(b)) m = Math.max(m, effBuffPower(b));
  }
  return 1 + m;
}

// ================= Input =================
let mouseX = -100, mouseY = -100;
let hoveredShop = null;  // which shop tower is being hovered (for the range preview)
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (W / r.width);
  mouseY = (e.clientY - r.top) * (H / r.height);
});
cv.addEventListener('pointerleave', () => { mouseX = -100; mouseY = -100; });
// Board interaction fires on pointerdown (not click): it unifies mouse + touch in one
// path, reacts on press (snappier game-feel), and sidesteps the ~300ms synthesized-click
// latency some mobile browsers add. Guard to the primary button so right/middle clicks
// don't place towers (matching the old click-only behaviour). v1.16.3.
cv.addEventListener('pointerdown', e => {
  if (e.button > 0) return;                 // primary button / touch only
  if (gameOver || !started || draftOpen) return;
  const r = cv.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (W / r.width);
  mouseY = (e.clientY - r.top) * (H / r.height);
  if (armedAbility === 'meteor' && !paused) {
    castMeteor(mouseX, mouseY);
    return;
  }
  // Bigger tap target on a finger: the forbidden placement gap is 32, so a 30px select
  // radius still can't steal a tap meant to place an adjacent tower (desktop keeps 18).
  const selectR = coarsePointer() ? 30 : 18;
  const hit = towers.find(t => Math.hypot(t.x-mouseX, t.y-mouseY) < selectR);
  if (hit) { selectedShop = null; renderShop(); showUpgrade(hit); return; }
  hideUpgrade();
  if (!selectedShop) return;
  const cost = costOf(selectedShop);
  if (gold < cost) return;
  // Snap to the placement grid when grid-snap is on (default), so towers line up cleanly
  // (owner FEEDBACK, v1.24.0). canPlace runs on the snapped point so spacing/path checks
  // match exactly where the tower lands.
  const p = placeCoord(mouseX, mouseY);
  if (!canPlace(p.x, p.y)) return;
  const def = TOWER_TYPES[selectedShop];
  gold -= cost;
  towers.push({
    type: selectedShop, x: p.x, y: p.y,
    range: def.range, dmg: def.dmg, rate: def.rate,
    cd: 0, level: 1, baseCost: def.cost, invested: cost, angle: 0,
    mode: 'first', spec: null, dealt: 0, kills: 0, buffPower: 0.25, flash: 0
  });
  addExplosion(p.x, p.y, def.color, 8, 60);
  SFX.place();
  if (gold < cost) selectedShop = null;
  updateHud();
});
function canPlace(x, y) {
  if (x < 14 || x > W-14 || y < 14 || y > H-14) return false;
  if (distToPath(x, y) < 34) return false;
  return !towers.some(t => Math.hypot(t.x-x, t.y-y) < 32);
}
// Start-screen ✨ button: toggle the What's New panel (close it if it's open) — owner
// FEEDBACK. (Defined here, not cd-core.js, to stay out of a concurrently-edited file;
// openWhatsNew/closeWhatsNew resolve at call time.)
function toggleWhatsNew() {
  const wn = document.getElementById('whatsnew');
  if (wn && getComputedStyle(wn).display !== 'none') closeWhatsNew();
  else openWhatsNew();
}
document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.key === ' ') { e.preventDefault(); if (!paused && !draftOpen) startWave(); }  // start/add a wave (startWave self-guards on the concurrent cap)
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (e.key === 'q' || e.key === 'Q') triggerAbility('meteor');
  if (e.key === 'w' || e.key === 'W') triggerAbility('freeze');
  if (e.key === 'e' || e.key === 'E') triggerAbility('rush');
  const idx = parseInt(e.key) - 1;
  if (idx >= 0 && idx < TYPE_KEYS.length) {
    const key = TYPE_KEYS[idx];
    if (gold >= costOf(key)) {
      selectedShop = selectedShop === key ? null : key;
      hideUpgrade(); renderShop();
    }
  }
  if (e.key === 'Escape') { selectedShop = null; armedAbility = null; refreshAbilityBar(); hideUpgrade(); renderShop(); }
});

function toggleSpeed() {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
  try { localStorage.setItem('cd_speed', speed); } catch(e) {}
  document.getElementById('speedBtn').textContent = `⏩ ${speed}x`;
}
function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
}
function toggleAuto() {
  autoWave = !autoWave;
  document.getElementById('autoBtn').textContent = `🔁 Auto-wave: ${autoWave ? 'ON' : 'OFF'}`;
  document.getElementById('autoBtn').classList.toggle('off', !autoWave);
  if (!autoWave) {
    autoStartTimer = -1;
    if (!waveActive && started && !gameOver) document.getElementById('startBtn').textContent = `▶ Start Wave ${wave+1}`;
  } else if (!waveActive && started && !gameOver && wave > 0 && !draftOpen) {
    autoStartTimer = 6;
  }
}

