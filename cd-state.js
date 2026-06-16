'use strict';
// ================= State =================
let gold, lives, wave, kills, towers, enemies, projectiles, particles, floaters, beams, pendingSpawns;
let livesLostThisRun = false;
// Pacifist tracking (v1.29.0): true once any ability (meteor/freeze/rush) is cast this run.
// Run-only, never saved; forced true on resume (loadRun) so a resumed run can't earn Pacifist.
let abilityUsedThisRun = false;
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
// Sharpshooter tracking (v1.84.0): peak number of enemies struck by a single Railgun beam
// this run. Run-only, never saved (enemies aren't persisted, and the feat is a momentary one
// that can recur any time the rail fires — so a resumed run can still earn it; no force-on-load).
let railBestHit = 0;
const COMBO_WINDOW = 2.0;
function comboColor(n) {
  return n >= 50 ? '#d2a8ff' : n >= 30 ? '#f85149' : n >= 20 ? '#ff7b42' : n >= 10 ? '#ffd866' : '#3fb950';
}
// Combo board-glow intensity tier (v1.60.0): 0 = no edge glow (below the first
// milestone, while the meter is still its baseline green), then 1..4 escalate
// with the combo tier (gold/orange/red/purple) to drive the pulsing board-edge
// glow in draw(). Pure mapping so the gating is unit-testable.
function comboGlowTier(n) {
  return n < 10 ? 0 : n >= 50 ? 4 : n >= 30 ? 3 : n >= 20 ? 2 : 1;
}
// Killing Spree perk (v1.73.0): the damage multiplier a HOT kill-combo grants when the
// 🔥 Killing Spree legendary is held — +1% per combo, capped +25% at a 25× streak. Returns
// 1 unless the perk is held AND a streak is currently active (comboTimer>0), so it's
// conditional/self-limiting (the 2s combo window means a stalled or leaking run gets nothing,
// making it strictly weaker than the unconditional Diamond Core +30% — NOT power creep).
// Called from the tower-fire loop in update() (NOT effDmg, to avoid upgrade-panel churn every
// kill — mirrors the Reaper perk). Pure mapping so the gating/cap is unit-testable.
function comboDmgMult() {
  if (typeof perkState === 'undefined' || !perkState || !perkState.comboPower || comboTimer <= 0) return 1;
  return 1 + Math.min(0.25, comboCount * 0.01);
}
// Daily runs track their own per-date best wave (cd_daily_<YYYYMMDD>); everything else uses
// the legacy per-difficulty key. Routes the HUD `best` load + the recordBest write.
let bestKey = () => daily ? 'cd_daily_' + dailyDateKey : 'cd_best_' + diffKey;
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
  abilityCd = { meteor: 0, freeze: 0, rush: 0, shock: 0 };
  armedAbility = null;
  livesLostThisRun = false;
  abilityUsedThisRun = false;
  waveMod = null; meteorRainTimer = 0;
  comboCount = 0; comboTimer = 0; comboBest = 0; comboFlash = 0;
  railBestHit = 0;
  if (isMayhem() && !daily) MAPS.mayhem.pts = genMayhemPath();  // daily keeps its seeded fixed path
  mapTheme = pickMapTheme();   // resolve the run's visual palette (cosmetic; loadRun overrides from save)
  best = +(localStorage.getItem(bestKey()) || 0);
  buildPath();
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('draftModal').style.display = 'none';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('startBtn').textContent = '▶ Start Wave 1';
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
  document.getElementById('diffLabel').textContent =
    (daily ? `🗓 Daily ${dailyDateKey}` : gameMode === 'campaign' ? `Campaign ${campLevel}/${CAMPAIGN_LEVELS}` : MAPS[mapKey].name) + ` · ${d.name}`;
  hideUpgrade();
  renderAbilityBar();
  updateHud();
}

// ================= Save / Resume =================
function saveRun() {
  if (daily) return;  // daily runs are one-off & not resumable; never overwrite the player's normal cd_save
  try {
    localStorage.setItem('cd_save', JSON.stringify({
      mapKey, diffKey, gameMode, campLevel, mapTheme,
      gold: Math.floor(gold), lives, kills, gameTime,
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
  daily = false;  // resuming is always a normal saved run (daily is never persisted)
  mapKey = s.mapKey; diffKey = s.diffKey;
  gameMode = s.gameMode === 'campaign' ? 'campaign' : 'quick';
  campLevel = Math.max(1, Math.min(CAMPAIGN_LEVELS, s.campLevel || 1));
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  setActiveUI();
  resetState();
  gold = s.gold; lives = s.lives; wave = s.wave; kills = s.kills;
  // Restore the elapsed run clock (additive field; old saves lack it → stays 0 from resetState).
  // Keeping it honest across resume also stops a Speed Demon (speedrun) earn by quitting near the
  // end and resuming — the timer keeps counting from where it was.
  if (typeof s.gameTime === 'number') gameTime = s.gameTime;
  // A resumed run already past its victory wave is an endless-continue save (winGame now
  // clears the save, so this only happens after Continue Endless re-saved). Mark victory so
  // update() doesn't instantly re-fire winGame() on the first tick. Normal mid-run saves have
  // wave < victoryWave(), so this is a no-op for them.
  if (wave >= victoryWave()) victory = true;
  lastSettledWave = wave;  // resumed at a clean boundary — all prior waves are settled
  livesLostThisRun = true; // resumed runs can't verify earlier waves were flawless
  abilityUsedThisRun = true; // …nor that no ability was cast earlier — Pacifist unearnable on resume
  // restore the saved palette so a resumed run looks identical (campaign rolls random
  // per attempt, so without this a resume would re-roll a different colour). Old saves
  // lack the field — resetState's pickMapTheme() default already covers them.
  if (s.mapTheme && (THEMES[s.mapTheme] || s.mapTheme === 'chaos')) mapTheme = s.mapTheme;
  if (s.perkState) perkState = Object.assign(freshPerkState(), s.perkState);
  if (s.runPerks) runPerks = s.runPerks;
  if (s.abilityCd) abilityCd = Object.assign({meteor:0,freeze:0,rush:0,shock:0}, s.abilityCd);
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

