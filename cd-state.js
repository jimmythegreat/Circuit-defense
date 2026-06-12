'use strict';
// ================= State =================
let gold, lives, wave, kills, towers, enemies, projectiles, particles, floaters, beams, pendingSpawns;
let livesLostThisRun = false;
let waveActive, selectedShop, selectedTower, gameOver, victory, started;
// Concurrent waves (v1.12.0): several waves can run at once. Each in-flight wave is a
// parallel spawner {queue,timer}; they spawn simultaneously. `waveActive` = ≥1 spawner
// or enemies still on the field. lastSettledWave = highest wave whose clear-bonus/draft
// has been paid; pendingDrafts = drafts owed but not yet shown (bundled rush settlement).
let spawners = [], lastSettledWave = 0, pendingDrafts = 0;
const MAX_CONCURRENT_WAVES = 3;  // cap unsettled waves so rapid Space can't stack endlessly
let speed = 1, paused = false, autoWave = true, autoStartTimer = -1, shake = 0, gameTime = 0;
// Restore the game-speed preference (1x/2x/3x) — persisted like cd_mute so a refresh
// (and resuming a run) keeps your chosen speed instead of silently dropping to 1x,
// which made every tower appear to fire at its base cadence after a reload.
{ const _sp = +localStorage.getItem('cd_speed'); if (_sp === 2 || _sp === 3) speed = _sp; }
// Kill-streak combo (run-only, never saved): consecutive kills within COMBO_WINDOW seconds
let comboCount = 0, comboTimer = 0, comboBest = 0, comboFlash = 0;
const COMBO_WINDOW = 2.0;
function comboColor(n) {
  return n >= 50 ? '#d2a8ff' : n >= 30 ? '#f85149' : n >= 20 ? '#ff7b42' : n >= 10 ? '#ffd866' : '#3fb950';
}
let bestKey = () => 'cd_best_' + diffKey;
let best = 0;

function costOf(typeKey) {
  return Math.max(5, Math.round(TOWER_TYPES[typeKey].cost * metaCostMult() * perkState.costMult));
}

function resetState() {
  const d = DIFFS[diffKey];
  perkState = freshPerkState();
  runPerks = [];
  gold = d.gold + 25 * tRank('funding');
  lives = d.lives + 2 * tRank('fortitude');
  wave = 0; kills = 0; gameTime = 0;
  towers = []; enemies = []; projectiles = []; particles = []; floaters = []; beams = []; pendingSpawns = [];
  waveActive = false; spawners = []; lastSettledWave = 0; pendingDrafts = 0;
  selectedShop = null; selectedTower = null; gameOver = false; victory = false;
  autoStartTimer = -1; shake = 0; paused = false; draftOpen = false;
  abilityCd = { meteor: 0, freeze: 0, rush: 0 };
  armedAbility = null;
  livesLostThisRun = false;
  waveMod = null; meteorRainTimer = 0;
  comboCount = 0; comboTimer = 0; comboBest = 0; comboFlash = 0;
  if (isMayhem()) MAPS.mayhem.pts = genMayhemPath();
  mapTheme = pickMapTheme();   // resolve the run's visual palette (cosmetic; loadRun overrides from save)
  best = +(localStorage.getItem(bestKey()) || 0);
  buildPath();
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('draftModal').style.display = 'none';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').textContent = '▶ Start Wave 1';
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
  document.getElementById('diffLabel').textContent =
    (gameMode === 'campaign' ? `Campaign ${campLevel}/${CAMPAIGN_LEVELS}` : MAPS[mapKey].name) + ` · ${d.name}`;
  hideUpgrade();
  renderAbilityBar();
  updateHud();
}

// ================= Save / Resume =================
function saveRun() {
  try {
    localStorage.setItem('cd_save', JSON.stringify({
      mapKey, diffKey, gameMode, campLevel, mapTheme,
      gold: Math.floor(gold), lives, kills,
      // resume from the last fully-settled wave: quitting mid-wave (or mid-rush with
      // several waves in flight) replays the unsettled wave(s), never double-paying
      wave: waveActive ? lastSettledWave : wave,
      perkState, runPerks, abilityCd,
      towers: towers.map(t => ({ type: t.type, x: t.x, y: t.y, level: t.level, mode: t.mode, spec: t.spec || null, invested: t.invested, dealt: Math.round(t.dealt), kills: t.kills }))
    }));
  } catch(e) {}
}
function clearRun() { localStorage.removeItem('cd_save'); }

// Full wipe: erase ALL persistent data (run, meta/chips/talents/achievements,
// campaign progress, records, prefs) and return to a brand-new state. Two-click
// confirm (like quitRun) since it's irreversible.
let resetArm = -Infinity;  // -Infinity (not 0) so the very first click always ARMS, even <3s after page load
function resetAllData() {
  const btn = document.getElementById('resetBtn');
  const now = performance.now();
  if (now - resetArm > 3000) {
    resetArm = now;
    if (btn) { btn.textContent = '🗑 Erase ALL — click again'; btn.classList.add('danger'); }
    setTimeout(() => { if (btn && btn.classList.contains('danger')) { btn.textContent = '🗑 Reset All'; btn.classList.remove('danger'); } }, 3000);
    return;
  }
  // remove every cd_-prefixed key (covers cd_save/cd_meta/cd_campaign/cd_best_*/
  // cd_mute/cd_speed/cd_wnclosed and any future ones) without touching other sites' data
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('cd_') === 0) keys.push(k); }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  // reset the in-memory persistent state to factory defaults
  meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
  loadMeta();
  speed = 1; best = 0; muted = false; shakeEnabled = true; particleDensity = 1;
  masterVol = 0.7; if (_masterGain) _masterGain.gain.value = 0.7;
  if (btn) { btn.textContent = '🗑 Reset All'; btn.classList.remove('danger'); }
  document.getElementById('speedBtn').textContent = '⏩ 1x';
  document.getElementById('muteBtn').textContent = '🔊 Sound';
  document.getElementById('muteBtn').classList.remove('off');
  backToMenu();
  addFloater(W / 2, H / 2, 'All data erased — fresh start', '#f85149', 18);
  SFX.sell();
}
function loadRun() {
  let s;
  try { s = JSON.parse(localStorage.getItem('cd_save')); } catch(e) { return false; }
  if (!s || !MAPS[s.mapKey] || !DIFFS[s.diffKey]) return false;
  mapKey = s.mapKey; diffKey = s.diffKey;
  gameMode = s.gameMode === 'campaign' ? 'campaign' : 'quick';
  campLevel = Math.max(1, Math.min(CAMPAIGN_LEVELS, s.campLevel || 1));
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  setActiveUI();
  resetState();
  gold = s.gold; lives = s.lives; wave = s.wave; kills = s.kills;
  lastSettledWave = wave;  // resumed at a clean boundary — all prior waves are settled
  livesLostThisRun = true; // resumed runs can't verify earlier waves were flawless
  // restore the saved palette so a resumed run looks identical (campaign rolls random
  // per attempt, so without this a resume would re-roll a different colour). Old saves
  // lack the field — resetState's pickMapTheme() default already covers them.
  if (s.mapTheme && (THEMES[s.mapTheme] || s.mapTheme === 'chaos')) mapTheme = s.mapTheme;
  if (s.perkState) perkState = Object.assign(freshPerkState(), s.perkState);
  if (s.runPerks) runPerks = s.runPerks;
  if (s.abilityCd) abilityCd = Object.assign({meteor:0,freeze:0,rush:0}, s.abilityCd);
  for (const st of s.towers) {
    const def = TOWER_TYPES[st.type];
    if (!def) continue;
    const lvl = Math.min(maxTowerLevel(), Math.max(1, st.level));
    towers.push({
      type: st.type, x: st.x, y: st.y, level: lvl,
      range: def.range * Math.pow(1.08, lvl-1),
      dmg: def.dmg * Math.pow(1.45, lvl-1),
      rate: def.rate * Math.pow(0.88, lvl-1),
      cd: 0, baseCost: def.cost, invested: st.invested, angle: 0,
      mode: MODES.includes(st.mode) ? st.mode : 'first',
      spec: st.spec || null,
      dealt: st.dealt || 0, kills: st.kills || 0,
      buffPower: 0.25 + 0.08*(lvl-1), flash: 0 // keep in sync with upgradeTower taper (v1.16.2)
    });
  }
  if (isMayhem() || gameMode === 'campaign') relocateTowers(); // saved positions won't match the freshly generated path
  document.getElementById('startBtn').textContent = `▶ Start Wave ${wave+1}`;
  addFloater(W/2, H/2, `Run resumed — wave ${wave} cleared`, '#58a6ff', 18);
  SFX.wave();
  renderAbilityBar();
  updateHud();
  return true;
}

