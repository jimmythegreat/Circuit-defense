'use strict';
// ================= End-of-run & meta UI =================
// Split out of cd-update.js (v2.15.2) when that file neared the ~1500-line cap. Holds the
// post-run flow + meta-progression panels: achievements (grant/render), daily streak, records
// (best waves/scores), the Settings panel, end-of-run scoring (computeScore/grade/breakdown),
// the end screen, and endGame/winGame/nextLevel/quitRun/continueEndless. All functions resolve
// at call time, so this loads after cd-update.js and before cd-render.js's startup block.
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
  { id:'pacifist',  icon:'🕊️', name:'Pacifist',         desc:'Win without casting a single ability' },
  { id:'monotower', icon:'🧩', name:'Specialist',        desc:'Win using only one type of tower' },
  { id:'minimalist',icon:'⚖️', name:'Minimalist',        desc:'Win with 5 or fewer towers' },
  { id:'daily20',   icon:'🗓️', name:'Daily Devotee',     desc:'Reach wave 20 in a Daily Challenge' },
  { id:'daily7',    icon:'📆', name:'Streak Keeper',     desc:'Reach a 7-day Daily Challenge streak' },
  { id:'arsenal',   icon:'🧰', name:'Full Arsenal',      desc:'Win with all 10 tower types on the board' },
  { id:'speedrun',  icon:'⏱️', name:'Speed Demon',        desc:'Win a Quick run in under 7 minutes' },
  { id:'railhit5',  icon:'🎯', name:'Sharpshooter',       desc:'Hit 5+ enemies with a single Railgun beam' },
  { id:'nightmare_win', icon:'🌑', name:'Nightmare Walker', desc:'Win a game on Nightmare difficulty' },
  { id:'legend_tower',  icon:'🏵️', name:'Living Legend',     desc:'Promote a tower to Legend rank (200 kills)' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
function achDone() { return ACHIEVEMENTS.filter(a => meta.achievements[a.id]).length; }
// Tally a finished run and grant any newly-earned achievements. Returns the new ones.
function grantAchievements(won) {
  const runDmg = towers.reduce((s, t) => s + (t.dealt || 0), 0);
  const runKills = towers.reduce((s, t) => s + (t.kills || 0), 0);
  meta.stats.dmg += runDmg;
  meta.stats.towerKills = (meta.stats.towerKills || 0) + runKills;
  meta.stats.runs += 1;
  if (comboBest > (meta.stats.bestCombo || 0)) meta.stats.bestCombo = comboBest;
  const newly = [];
  const give = id => { if (!meta.achievements[id]) { meta.achievements[id] = true; newly.push(ACH_BY_ID[id]); } };
  if (won) give('first_win');
  if (won && !livesLostThisRun) give('flawless');
  if (won && (diffKey === 'hard' || diffKey === 'nightmare')) give('hard_win');   // Nightmare ≥ Hard
  if (won && diffKey === 'nightmare') give('nightmare_win');   // 🌑 v2.0.0 — the new top tier
  if (won && gameMode === 'campaign' && campLevel >= 10) give('camp10');
  if (won && gameMode === 'campaign' && campLevel >= CAMPAIGN_LEVELS) give('camp_done');
  if (wave >= 50) give('endless50');
  if (meta.stats.dmg >= 1e6) give('million');
  if (meta.stats.runs >= 25) give('veteran');
  if (comboBest >= 30) give('combo30');
  if (railBestHit >= 5) give('railhit5');
  // Living Legend (v2.19.0): a feat, not a win condition (no `won` gate — like railhit5). Reaching
  // the top veterancy rank (200 kills on one tower) is most natural in a long endless run, win or lose.
  if (towers.some(t => towerRankTier(t.kills) === 4)) give('legend_tower');
  if (won && !abilityUsedThisRun) give('pacifist');
  if (won && towers.length > 0 && new Set(towers.map(t => t.type)).size === 1) give('monotower');
  if (won && towers.length > 0 && towers.length <= 5) give('minimalist');
  if (won && new Set(towers.map(t => t.type)).size === TYPE_KEYS.length) give('arsenal');
  // Speed Demon (v1.74.0): win a Quick run (always 30 waves → comparable target) in under 7
  // minutes of play time. The standard sequential clear takes ~13 min even rushing, so this
  // demands deliberate concurrent-wave rushing — a skill goal, not an accident. Quick-only:
  // campaign victory waves vary (15…54), so a flat time threshold there would be unfair.
  if (won && gameMode === 'quick' && gameTime < 420) give('speedrun');
  if (daily && wave >= 20) give('daily20');
  // Streak badge — checked AFTER recordDailyStreak() has folded today's finish into the count
  // (endGame/winGame record the streak before calling grantAchievements), so currentDailyStreak()
  // already reflects this run.
  if (daily && currentDailyStreak() >= 7) give('daily7');
  saveMeta();
  return newly;
}
function achLine(newly) {
  if (!newly.length) return '';
  return '\n🏅 Achievement' + (newly.length > 1 ? 's' : '') + ' unlocked: ' + newly.map(a => `${a.icon} ${a.name}`).join(' · ');
}
function openAchievements() { renderAchievements(); document.getElementById('achPanel').style.display = 'flex'; focusPanel('achPanel'); }
function closeAchievements() { document.getElementById('achPanel').style.display = 'none'; renderStartScreen(); }
// ----- Daily streak (v1.31.0) -----
// Consecutive calendar days on which the player has FINISHED a Daily Challenge (any outcome —
// win, loss, or endless continue). Stored additively in localStorage cd_daily_streak =
// {count, last:'YYYYMMDD'} (old saves simply lack it → streak 0). One additive key, no schema
// or gameplay impact. Owner loves addictive progression loops; a "keep your streak alive" hook
// is exactly that, and a natural follow-up to the v1.28.0 Daily Challenge.
function loadDailyStreak() {
  try {
    const s = JSON.parse(localStorage.getItem('cd_daily_streak') || 'null');
    if (s && typeof s.count === 'number' && typeof s.last === 'string') return { count: s.count, last: s.last };
  } catch (e) {}
  return { count: 0, last: '' };
}
// The streak as it currently STANDS for display: only counts if the last finish was today or
// yesterday — otherwise it has lapsed (a day was missed) and reads 0. Read-only; never writes.
function currentDailyStreak() {
  const s = loadDailyStreak();
  if (!s.last) return 0;
  const today = dailyDateString();
  return (s.last === today || s.last === dailyDayBefore(today)) ? s.count : 0;
}
// Record a finished daily run into the streak. todayKey defaults to the local date. Playing the
// daily again the same day is a no-op (the streak already counts today); a finish the day after
// the last one extends it; any larger gap (or first ever) restarts at 1. Returns the resulting
// {count, extended} (extended=true when this finish grew the count) so callers can celebrate.
function recordDailyStreak(todayKey) {
  todayKey = todayKey || dailyDateString();
  const s = loadDailyStreak();
  let extended = false;
  if (s.last === todayKey) {
    if (s.count < 1) s.count = 1;                       // already played today → unchanged
  } else if (s.last && s.last === dailyDayBefore(todayKey)) {
    s.count += 1; extended = true;                      // consecutive day → grow
  } else {
    s.count = 1; extended = true;                       // first ever or broken streak → restart
  }
  s.last = todayKey;
  try { localStorage.setItem('cd_daily_streak', JSON.stringify({ count: s.count, last: s.last })); } catch (e) {}
  return { count: s.count, extended };
}
// Records / personal bests. Updates the legacy per-difficulty key AND a new
// per-map+difficulty key (quick mode only; campaign maps are random per attempt).
// Both keys are additive — older saves without them just start at 0.
// Returns a record event {prev, now} when a quick-mode run beats its existing
// Records-grid cell (per map × difficulty), else null. First-ever entries
// (prev 0) record silently — the flourish only fires when you beat a real best.
function recordBest() {
  // For a daily run bestKey() routes to cd_daily_<date>; capture its prior value BEFORE the
  // generic best-write below so the "new record" flourish can compare against it.
  const dailyPrev = daily ? +(localStorage.getItem(bestKey()) || 0) : 0;
  if (wave > best) { best = wave; localStorage.setItem(bestKey(), best); }
  let rec = null;
  if (daily) {
    if (wave > dailyPrev && dailyPrev > 0) rec = { prev: dailyPrev, now: wave };
    return rec;
  }
  if (gameMode === 'quick') {
    const k = 'cd_best_' + mapKey + '_' + diffKey;
    const prev = +(localStorage.getItem(k) || 0);
    if (wave > prev) {
      localStorage.setItem(k, wave);
      // Remember this cell so the Records panel can spotlight your latest PB (v2.22.0).
      try { localStorage.setItem('cd_lastbest_wave', mapKey + '_' + diffKey); } catch(e) {}
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
function openBests() { renderBests(); document.getElementById('bestPanel').style.display = 'flex'; focusPanel('bestPanel'); }
function closeBests() { document.getElementById('bestPanel').style.display = 'none'; renderStartScreen(); }

// ----- Settings panel (performance / accessibility prefs, persisted on device) -----
function openSettings() { const p = document.getElementById('settingsPanel'); if (!p) return; renderSettings(); p.style.display = 'flex'; focusPanel('settingsPanel'); }
function closeSettings() { document.getElementById('settingsPanel').style.display = 'none'; renderStartScreen(); }
// Start-screen ⚙ button toggles the panel (open if closed, close if open) — owner
// FEEDBACK ("Settings button doesn't open"). A clean toggle is robust against any
// open-then-immediately-reclick edge and matches the What's New button's behaviour.
function toggleSettings() {
  const p = document.getElementById('settingsPanel');
  if (p && getComputedStyle(p).display !== 'none') closeSettings();
  else openSettings();
}
function setShake(on) { shakeEnabled = !!on; try { localStorage.setItem('cd_shake', on ? '1' : '0'); } catch(e) {} renderSettings(); }
function setParticles(d) { particleDensity = +d; try { localStorage.setItem('cd_particles', String(+d)); } catch(e) {} renderSettings(); }
function setColorblind(on) { colorblindAid = !!on; try { localStorage.setItem('cd_colorblind', on ? '1' : '0'); } catch(e) {} renderSettings(); }
function setGridSnap(on) { gridSnap = !!on; try { localStorage.setItem('cd_gridsnap', on ? '1' : '0'); } catch(e) {} renderSettings(); }
function setDefaultMode(m) { defaultTargetMode = MODES.includes(m) ? m : 'first'; try { localStorage.setItem('cd_defaultmode', defaultTargetMode); } catch(e) {} renderSettings(); }
function renderSettings() {
  const rows = [
    { name: '📳 Screen shake', fn: 'setShake', cur: shakeEnabled, opts: [['On', true], ['Off', false]] },
    { name: '✨ Particle effects', fn: 'setParticles', cur: particleDensity, opts: [['Full', 1], ['Reduced', 0.5], ['Off', 0]] },
    { name: '♿ Colorblind aid', fn: 'setColorblind', cur: colorblindAid, opts: [['On', true], ['Off', false]] },
    { name: '▦ Grid snap', fn: 'setGridSnap', cur: gridSnap, opts: [['On', true], ['Off', false]] },
    { name: '🎯 New-tower target', fn: 'setDefaultMode', cur: defaultTargetMode, opts: MODES.map(m => [MODE_ICON[m], m]) },
  ];
  let html = '<div class="setList">';
  // Volume slider (0..100). oninput scales the live gain + updates the % label without
  // re-rendering (so dragging stays smooth); onchange plays a sample tone at the new level.
  const volPct = Math.round(masterVol * 100);
  html += `<div class="setRow"><span class="setName">🔊 Volume</span><span class="setOpts">`
    + `<input class="setSlider" type="range" min="0" max="100" value="${volPct}" `
    + `oninput="setVolume(+this.value); document.getElementById('volVal').textContent=this.value+'%'" `
    + `onchange="if(!muted) tone(640,0.09,'square',0.09)">`
    + `<span id="volVal" style="color:#8b949e;min-width:42px;display:inline-block;text-align:right">${volPct}%</span>`
    + `</span></div>`;
  for (const r of rows) {
    html += `<div class="setRow"><span class="setName">${r.name}</span><span class="setOpts">`;
    for (const [lbl, val] of r.opts) {
      const active = r.cur === val ? ' active' : '';
      // string args (e.g. targeting-mode keys) get single quotes so they don't terminate
      // the double-quoted onclick attribute; booleans/numbers stay bare via JSON.stringify.
      const arg = typeof val === 'string' ? `'${val}'` : JSON.stringify(val);
      html += `<button class="setBtn${active}" onclick="${r.fn}(${arg})">${lbl}</button>`;
    }
    html += '</span></div>';
  }
  html += '</div>';
  if (colorblindAid) html += `<p style="color:#8b949e;font-size:12px;margin:0">Enemy symbols: » fast · ◆ tank · + heal · 🛡 shield · ✂ split · 👻 phantom · ◈ warden · ‼ breacher · 🔥 molten · ⬢ bastion · ⚡ jammer · ⚑ herald · ☠ boss.</p>`;
  if (reduceMotion()) html += `<p style="color:#8b949e;font-size:12px;margin:0">Your OS "reduce motion" setting is on — shake &amp; particles are already minimised.</p>`;
  document.getElementById('settingsBody').innerHTML = html;
}
function renderBests() {
  const diffs = Object.keys(DIFFS), maps = Object.keys(MAPS);
  // The map×diff cell whose per-map best you most recently set — spotlighted gold (v2.22.0).
  const lastWave = localStorage.getItem('cd_lastbest_wave') || '';
  const lastScore = localStorage.getItem('cd_lastbest_score') || '';
  // ----- Highest wave per map × difficulty -----
  let html = '<h4 class="bestSub">🌊 Best waves</h4>';
  html += '<table class="bestTbl"><thead><tr><th>Map</th>';
  for (const d of diffs) html += `<th>${DIFFS[d].name}</th>`;
  html += '</tr></thead><tbody>';
  for (const m of maps) {
    html += `<tr><td class="mname">${MAPS[m].name}</td>`;
    for (const d of diffs) {
      const v = +(localStorage.getItem('cd_best_' + m + '_' + d) || 0);
      const hl = v && (m + '_' + d) === lastWave;
      html += `<td${hl ? ' class="justbeat"' : ''}>${v ? (hl ? '★ ' : '') + v : '<span class="dash">—</span>'}</td>`;
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
  // ----- Best end-of-run SCORE per map × difficulty (quick mode; v1.61.0) -----
  html += '<h4 class="bestSub">🏆 Best scores</h4>';
  html += '<table class="bestTbl"><thead><tr><th>Map</th>';
  for (const d of diffs) html += `<th>${DIFFS[d].name}</th>`;
  html += '</tr></thead><tbody>';
  for (const m of maps) {
    html += `<tr><td class="mname">${MAPS[m].name}</td>`;
    for (const d of diffs) {
      const v = +(localStorage.getItem('cd_bestscore_' + m + '_' + d) || 0);
      const hl = v && (m + '_' + d) === lastScore;
      html += `<td${hl ? ' class="justbeat"' : ''}>${v ? (hl ? '★ ' : '') + fmtNum(v) : '<span class="dash">—</span>'}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  const dmg = (meta.stats && meta.stats.dmg) || 0, runs = (meta.stats && meta.stats.runs) || 0;
  const bestCombo = (meta.stats && meta.stats.bestCombo) || 0;
  const towerKills = (meta.stats && meta.stats.towerKills) || 0;
  const bestScore = +(localStorage.getItem('cd_bestscore') || 0);
  const dailyToday = +(localStorage.getItem('cd_daily_' + dailyDateString()) || 0);
  const dStreak = currentDailyStreak();
  html += `<div class="bestStats">`
    + `<span>🏆 Best score: <b>${bestScore ? fmtNum(bestScore) : '—'}</b></span>`
    + `<span>🗓 Daily (today): <b>${dailyToday ? 'wave ' + dailyToday : '—'}</b></span>`
    + `<span>🔥 Daily streak: <b>${dStreak ? dStreak + ' day' + (dStreak === 1 ? '' : 's') : '—'}</b></span>`
    + `<span>🎖 Campaign: <b>L${campaignDone()}</b> cleared</span>`
    + `<span>⚔ Lifetime dmg: <b>${fmtNum(dmg)}</b></span>`
    + `<span>💀 Tower kills: <b>${fmtNum(towerKills)}</b></span>`
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
// ----- End-of-run scoring (v1.16.0, owner FEEDBACK "a scoring system for the
// final victory/defeat screen … kill time, remaining gold, using fewer towers").
// One number rewarding how FAR (waves + campaign depth), how CLEAN (lives kept,
// few towers, big combos) and how RICH (gold banked) the run was, scaled by
// difficulty. Purely cosmetic + one additive all-time-best key (cd_bestscore) —
// no economy or save-schema impact. -----
function computeScore() {
  const diffMult = DIFFS[diffKey].chipMult;              // easy .5 · normal 1 · hard 1.6
  const nt = towers.length;
  // Efficiency: a clean clear with few towers beats a 30-tower zerg. ≤10 towers → up to +30%.
  const effMult = nt > 0 ? 1 + Math.max(0, 10 - nt) * 0.03 : 1;
  // Speed bonus (v1.78.0, the owner-invited "kill time" axis — the run timer landed v1.74.0):
  // a VICTORY finished under par scores higher, up to +25%, tapering linearly to +0% AT par and
  // staying +0% beyond it (never a penalty — a slow/turtle win is never punished, only a fast one
  // rewarded). par scales with the run's victory-wave count (victoryWave()×20s ≈ 600s for a 30-wave
  // quick win, ~300s for campaign L1, ~1080s for L40), so it's fair across modes/lengths. Only
  // applies on a win with logged time (gameTime>0) — a loss has no meaningful completion time, and
  // a 0-time edge (never ran update()) gets no bonus rather than the full one.
  const par = victoryWave() * 20;
  const spdMult = (victory && gameTime > 0)
    ? 1 + 0.25 * Math.max(0, Math.min(1, (par - gameTime) / par))
    : 1;
  const parts = {
    wave: wave * 100,
    kills: kills * 5,
    lives: lives * 120,
    gold: Math.floor(gold),
    combo: comboBest * 25,
    camp: gameMode === 'campaign' ? campLevel * 200 : 0,
    victory: victory ? 2500 : 0,
  };
  const raw = parts.wave + parts.kills + parts.lives + parts.gold + parts.combo + parts.camp + parts.victory;
  return { score: Math.max(0, Math.round(raw * diffMult * effMult * spdMult)), parts, diffMult, effMult, spdMult, nt };
}
// Letter grade off how much of the run's victory target was reached (S = flawless win).
function scoreGrade() {
  const goal = victoryWave();
  const prog = goal > 0 ? wave / goal : 0;
  if (victory && !livesLostThisRun) return { g: 'S', c: '#e3b341' };
  if (victory) return { g: 'A', c: '#3fb950' };
  if (prog >= 0.75) return { g: 'B', c: '#58a6ff' };
  if (prog >= 0.5)  return { g: 'C', c: '#d29922' };
  if (prog >= 0.25) return { g: 'D', c: '#db6d28' };
  return { g: 'F', c: '#f85149' };
}
// Record end-of-run score bests (v1.61.0). Always updates the all-time cd_bestscore;
// in quick mode (not daily) it ALSO updates a per-map+difficulty cd_bestscore_<map>_<diff>
// key — the score-grid mirror of recordBest()'s per-map WAVE logic (campaign maps are
// random per attempt, daily has its own seed, so neither writes per-map score keys).
// All keys additive (read with || 0), so old saves just start at 0. Returns the prior
// all-time best + whether it was beaten so renderEndScreen can show the ★ flag.
function recordScores(score) {
  const prevAllTime = +(localStorage.getItem('cd_bestscore') || 0);
  const isAllTimeBest = score > prevAllTime;
  if (isAllTimeBest) { try { localStorage.setItem('cd_bestscore', score); } catch(e) {} }
  if (!daily && gameMode === 'quick') {
    const k = 'cd_bestscore_' + mapKey + '_' + diffKey;
    // Also remember this cell so the Records panel spotlights your latest score PB (v2.22.0).
    if (score > +(localStorage.getItem(k) || 0)) { try { localStorage.setItem(k, score); localStorage.setItem('cd_lastbest_score', mapKey + '_' + diffKey); } catch(e) {} }
  }
  return { prevAllTime, isAllTimeBest };
}
// Collapsible "how the score was computed" breakdown (v1.62.0) — surfaces the
// per-term contributions + the difficulty/efficiency multipliers that computeScore()
// already returns but the end screen never showed (owner asked for a scoring system;
// this makes it legible). Render-only, hidden behind a <details> so the deliberately-
// decluttered end screen stays clean by default. Only non-zero terms are listed.
function scoreBreakdownHtml(sc) {
  const rows = [
    ['🌊 Waves', sc.parts.wave],
    ['💥 Kills', sc.parts.kills],
    ['❤️ Lives', sc.parts.lives],
    ['🪙 Gold', sc.parts.gold],
    ['🔥 Combo', sc.parts.combo],
    ['🎖️ Campaign', sc.parts.camp],
    ['🏆 Victory', sc.parts.victory],
  ].filter(([, v]) => v > 0);
  const subtotal = rows.reduce((a, [, v]) => a + v, 0);
  let body = rows.map(([k, v]) => `<tr><td>${k}</td><td>+${fmtNum(v)}</td></tr>`).join('');
  body += `<tr class="sub"><td>Subtotal</td><td>${fmtNum(subtotal)}</td></tr>`;
  body += `<tr><td>× Difficulty (${DIFFS[diffKey].name})</td><td>×${sc.diffMult}</td></tr>`;
  body += `<tr><td>× Efficiency (${sc.nt} tower${sc.nt === 1 ? '' : 's'})</td><td>×${sc.effMult.toFixed(2)}</td></tr>`;
  if (sc.spdMult > 1) body += `<tr><td>× Speed (${fmtTime(gameTime)} clear)</td><td>×${sc.spdMult.toFixed(2)}</td></tr>`;
  body += `<tr class="tot"><td>Score</td><td>${fmtNum(sc.score)}</td></tr>`;
  return `<details class="ovBreak"><summary>Score breakdown</summary><table class="breakTbl">${body}</table></details>`;
}
// Build the restyled end screen: score hero (grade badge + number + all-time best),
// a one-line headline, a stats grid, and compact MVP/perks/achievement sections —
// replacing the old single pre-line text blob (owner FEEDBACK "victory screen … overwhelming").
function renderEndScreen(won, earned, newAch) {
  const sc = computeScore(), gr = scoreGrade();
  const { prevAllTime, isAllTimeBest } = recordScores(sc.score);
  const isBest = isAllTimeBest;
  const shownBest = Math.max(prevAllTime, sc.score);

  document.getElementById('ovScore').innerHTML =
    `<div class="ovGrade" style="color:${gr.c}">${gr.g}</div>`
    + `<div class="ovScoreNum"><span class="lab">Score</span><span class="num">${fmtNum(sc.score)}</span>`
    + `<span class="best${isBest ? ' newbest' : ''}">${isBest ? '★ New best score!' : 'Best: ' + fmtNum(shownBest)}</span></div>`;

  const where = gameMode === 'campaign' ? `Campaign L${campLevel}` : MAPS[mapKey].name;
  document.getElementById('ovText').textContent =
    `${won ? 'Cleared' : 'Reached'} wave ${wave} · ${where} · ${DIFFS[diffKey].name}   ·   🪙 +${earned} chips (total ${meta.chips})`;

  const cells = [
    ['🌊', wave, 'Waves'],
    ['💥', fmtNum(kills), 'Kills'],
    ['❤️', lives, 'Lives'],
    ['🪙', fmtNum(Math.floor(gold)), 'Gold'],
    ['🔥', comboBest ? comboBest + '×' : '—', 'Combo'],
    ['🗼', sc.nt, 'Towers'],
    ['⏱️', fmtTime(gameTime), 'Time'],
  ];
  let html = '<div class="scoreGrid">'
    + cells.map(([ic, v, k]) => `<div class="cell"><div class="v">${ic} ${v}</div><div class="k">${k}</div></div>`).join('')
    + '</div>';
  const mvp = mvpLine().trim(), perk = perkLine().trim(), ach = achLine(newAch).trim();
  if (mvp)  html += `<div class="ovSection">${mvp}</div>`;
  if (perk) html += `<div class="ovSection">${perk}</div>`;
  if (ach)  html += `<div class="ovSection ach">${ach}</div>`;
  html += scoreBreakdownHtml(sc);
  document.getElementById('ovDetails').innerHTML = html;
  document.getElementById('overlay').classList.add('scored');
}
function endGame() {
  gameOver = true;
  SFX.over();
  if (!daily) clearRun();  // daily never persists; don't wipe the player's normal saved run
  const earned = chipsForRun();
  meta.chips += earned;
  saveMeta();
  if (daily) recordDailyStreak();   // record FIRST so the streak achievement sees today's finish
  const newAch = grantAchievements(false);
  const rec = recordBest();
  document.getElementById('ovTitle').textContent = '💀 GAME OVER';
  renderEndScreen(false, earned, newAch);
  document.getElementById('ovContinue').style.display = 'none';
  document.getElementById('ovNext').style.display = 'none';
  document.getElementById('ovRetry').style.display = daily ? 'none' : 'inline-block';
  document.getElementById('ovMain').textContent = 'Main Menu';
  document.getElementById('overlay').style.display = 'flex';
  applyRecordFlourish(rec);
  hideUpgrade();
  updateHud();
}
function winGame() {
  victory = true;
  // Endless mode (v2.17.0): bank the wave-victoryWave() win ONCE, then KEEP PLAYING — no victory
  // wall, no gameOver, no overlay. The reward path (chips/achievement/best) is identical to a Quick
  // win; we just skip the end screen and celebrate with a floater so the run flows on. The `!victory`
  // guard in endWave ensures this fires exactly once at the crossing. Deliberately does NOT clearRun()
  // (the run continues + stays resumable); endWave's saveRun() persists the ongoing endless run.
  if (endless) {
    const earned = chipsForRun();
    meta.chips += earned;
    saveMeta();
    const newAch = grantAchievements(true);
    recordBest();
    SFX.win();
    shake = Math.max(shake, 12);
    addFloater(W/2, 80, `♾️ WAVE ${wave} CLEARED — ENDLESS!`, '#ffd866', 22);
    addFloater(W/2, 108, `🪙 +${earned} chips · keep going`, '#7ee787', 15);
    if (newAch.length) addFloater(W/2, 132, `🏅 +${newAch.length} achievement${newAch.length>1?'s':''}!`, '#d2a8ff', 15);
    updateHud();
    return;
  }
  gameOver = true;
  if (!daily) clearRun();  // finishing a level/run must reset Resume — else the cleared
                           // level stays resumable forever (you could re-win it on repeat).
                           // daily never persists, so leave the player's normal save alone.
  SFX.win();
  const earned = chipsForRun();
  meta.chips += earned;
  saveMeta();
  if (daily) recordDailyStreak();   // record FIRST so the streak achievement sees today's finish
  const newAch = grantAchievements(true);
  const rec = recordBest();
  document.getElementById('ovTitle').textContent = gameMode === 'campaign' ? `🏆 LEVEL ${campLevel} CLEARED!` : '🏆 VICTORY!';
  renderEndScreen(true, earned, newAch);
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
  document.getElementById('ovRetry').style.display = daily ? 'none' : 'inline-block';
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

