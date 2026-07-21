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
  { id:'arsenal',   icon:'🧰', name:'Full Arsenal',      desc:'Win with all 12 tower types on the board' },
  { id:'speedrun',  icon:'⏱️', name:'Speed Demon',        desc:'Win a Quick run in under 7 minutes' },
  { id:'railhit5',  icon:'🎯', name:'Sharpshooter',       desc:'Hit 5+ enemies with a single Railgun beam' },
  { id:'nightmare_win', icon:'🌑', name:'Nightmare Walker', desc:'Win a game on Nightmare difficulty' },
  { id:'legend_tower',  icon:'🏵️', name:'Living Legend',     desc:'Promote a tower to Legend rank (200 kills)' },
  { id:'endless100',    icon:'🌌', name:'Eternity',           desc:'Reach wave 100 in a single run' },
  { id:'hoarder',       icon:'💰', name:'Hoarder',            desc:'Bank 10,000 gold at once in a single run' },
  { id:'combo50',       icon:'🌠', name:'Combo God',           desc:'Reach a 50× kill-streak in a single run' },
  { id:'centurion',     icon:'💯', name:'Centurion',           desc:'Finish 100 runs' },
  { id:'gravekeeper',   icon:'⚰️', name:'Gravekeeper',         desc:'Defeat 100,000 enemies (lifetime)' },
  { id:'overlord',      icon:'🗼', name:'Overlord',            desc:'Field 12 towers at once in a single run' },
  { id:'marathoner',    icon:'🐢', name:'Marathoner',          desc:'Play a single run for 30+ minutes' },
  { id:'untouchable',   icon:'🏰', name:'Untouchable',         desc:'Win on Nightmare without losing a single life' },
  { id:'combo100',      icon:'🎆', name:'Combo Deity',          desc:'Reach a 100× kill-streak in a single run' },
  { id:'endless150',    icon:'🪐', name:'Astral',               desc:'Reach wave 150 in a single run' },
  { id:'clutch',        icon:'😰', name:'Clutch',               desc:'Win a run with 3 or fewer lives left' },
  { id:'legion',        icon:'🎗️', name:'Old Guard',             desc:'Have 3 Legend-rank towers at once' },
  { id:'jackpot',       icon:'🎰', name:'Jackpot',              desc:'Collect 3 legendary perks in a single run' },
  { id:'absolute_zero', icon:'🧊', name:'Absolute Zero',        desc:'Freeze 12+ enemies with a single Time Freeze' },
  { id:'lone_wolf',     icon:'🐺', name:'Lone Wolf',            desc:'Win a game with 3 or fewer towers' },
  { id:'full_house',    icon:'🎴', name:'Full House',           desc:'Cast all 6 abilities in a single run' },
  { id:'ironclad',      icon:'🛡️', name:'Ironclad',             desc:'Block 5 leaks with Barrier in a single run' },
  { id:'annihilator',   icon:'🌋', name:'Annihilator',          desc:'Deal 10,000,000 total damage (lifetime)' },
  { id:'bosshunter',    icon:'🦣', name:'Big Game Hunter',       desc:'Defeat 5 bosses in a single run' },
  { id:'carpetbomb',    icon:'💥', name:'Carpet Bomb',          desc:'Kill 12+ enemies with a single Meteor' },
  { id:'heavy_hitter',  icon:'🥊', name:'Heavy Hitter',         desc:'Deal 200,000 damage with a single tower in one run' },
  { id:'polymath',      icon:'🧠', name:'Polymath',             desc:'Win a game using 6 or more tower types' },
  { id:'endless200',    icon:'🛸', name:'Transcendent',         desc:'Reach wave 200 in a single run' },
  { id:'plague',        icon:'🧪', name:'Plague Doctor',        desc:'Rack up 150 kills on a single Poison tower' },
  { id:'exterminator',  icon:'🪳', name:'Exterminator',         desc:'Defeat 2,000 enemies in a single run' },
  { id:'waverider',     icon:'🌊', name:'Wave Rider',            desc:'Have 5+ waves in flight at once' },
  { id:'pinball',       icon:'🪩', name:'Pinball Wizard',        desc:'Strike 6+ enemies with a single Arc bolt' },
  { id:'jack',          icon:'🎭', name:'Jack of All Trades',    desc:'Field 8+ distinct tower types at once' },
  { id:'cartographer',  icon:'🗺️', name:'Cartographer',          desc:'Reach the final wave on all Quick maps' },
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
  if (won && diffKey === 'nightmare' && !livesLostThisRun) give('untouchable');   // 🏰 v2.40.0 — flawless Nightmare (the hardest flawless feat)
  if (won && gameMode === 'campaign' && campLevel >= 10) give('camp10');
  if (won && gameMode === 'campaign' && campLevel >= CAMPAIGN_LEVELS) give('camp_done');
  if (wave >= 50) give('endless50');
  if (wave >= 100) give('endless100');   // 🌌 v2.34.0 — deep-endless milestone (no `won` gate, a feat)
  if (wave >= 150) give('endless150');   // 🪐 v2.42.0 — the next deep-endless rung above Eternity (no `won` gate)
  if (wave >= 200) give('endless200');   // 🛸 v2.50.0 — the next deep-endless rung above Astral (no `won` gate)
  if (meta.stats.dmg >= 1e6) give('million');
  if (meta.stats.dmg >= 1e7) give('annihilator');   // 🌋 v2.47.0 — the next lifetime-damage rung above Megadamage (reads the stat just tallied)
  if (bossKills >= 5) give('bosshunter');   // 🦣 v2.47.0 — a feat (no `won` gate): defeat 5 bosses in one run (run-only bossKills, cd-state.js)
  if (meteorBestKills >= 12) give('carpetbomb');   // 💥 v2.48.0 — a feat (no `won` gate): 12+ kills in one Meteor blast (run-only meteorBestKills, cd-defs.js)
  if (meta.stats.runs >= 25) give('veteran');
  if (meta.stats.runs >= 100) give('centurion');   // 💯 v2.38.0 — a grind/dedication feat (pairs with Veteran@25)
  if ((meta.stats.towerKills || 0) >= 100000) give('gravekeeper');   // ⚰️ v2.38.0 — lifetime enemy-defeat grind (reads the towerKills stat just tallied)
  if (comboBest >= 30) give('combo30');
  if (comboBest >= 50) give('combo50');   // 🌠 v2.36.0 — a feat (no `won` gate), pairs with the combo-tier "GODLIKE" word
  if (comboBest >= 100) give('combo100');   // 🎆 v2.40.0 — the next rung above Combo God (no `won` gate)
  if (railBestHit >= 5) give('railhit5');
  // Pinball Wizard (🪩 v2.52.0): a feat (no `won` gate, like railhit5) — a single Arc bolt
  // ricochets through 6+ enemies. Needs a spec (Ball Lightning's 7 hits) or a dense swarm.
  if (arcBestChain >= 6) give('pinball');
  if (peakGold >= 10000) give('hoarder');   // 💰 v2.35.0 — a feat (no `won` gate), most natural in a rich/deep run
  if (peakTowers >= 12) give('overlord');   // 🗼 v2.39.0 — a feat (no `won` gate): a big sprawling board
  // Exterminator (🪳 v2.51.0): a feat (no `won` gate) — defeat 2,000 enemies in a single run. Reads
  // runKills (the sum of every tower's kills this run, already tallied above) — the per-run version of
  // the lifetime Gravekeeper (100k) / per-tower Plague Doctor & Heavy Hitter feats. Natural deep in a run.
  if (runKills >= 2000) give('exterminator');
  // Wave Rider (🌊 v2.51.0): a feat (no `won` gate) — stack 5+ waves in flight at once (peak of
  // wave - lastSettledWave, tracked in startWave). Celebrates the concurrent-wave system (cap 8) and
  // the owner's "let me add as many waves as I want" request. Run-only peakConcurrentWaves (cd-state.js).
  if (peakConcurrentWaves >= 5) give('waverider');
  // Heavy Hitter (🥊 v2.49.0): a feat (no `won` gate) — a SINGLE tower dealing 200,000 damage in one
  // run. Reads the final towers board's max t.dealt (a fresh per-tower axis, vs the lifetime dmg stat).
  // Most natural on a carry tower in a long/endless run.
  if (towers.some(t => (t.dealt || 0) >= 200000)) give('heavy_hitter');
  // Plague Doctor (🧪 v2.50.0): a feat (no `won` gate) — a SINGLE Poison tower reaching 150 kills.
  // Poison DoT ticks credit the source tower's kills (silent kills still src.kills++), so a
  // well-placed Poison tower on a swarm rack up kills over a run. Pairs with the Corrosive Rounds
  // perk; reads the final towers board like Heavy Hitter / Living Legend.
  if (towers.some(t => t.type === 'poison' && (t.kills || 0) >= 150)) give('plague');
  if (gameTime >= 1800) give('marathoner'); // 🐢 v2.39.0 — a feat (no `won` gate): a 30-minute marathon run
  // Living Legend (v2.19.0): a feat, not a win condition (no `won` gate — like railhit5). Reaching
  // the top veterancy rank (200 kills on one tower) is most natural in a long endless run, win or lose.
  if (towers.some(t => towerRankTier(t.kills) === 4)) give('legend_tower');
  // Old Guard (🎗️ v2.43.0): a feat (no `won` gate, like Living Legend) — hold THREE Legend-rank
  // towers (200+ kills each) on the board at once. A deep-veterancy goal, most natural in a long
  // endless run where a well-defended core racks up kills. Reads the same final `towers` board.
  if (towers.filter(t => towerRankTier(t.kills) === 4).length >= 3) give('legion');
  // Jackpot (🎰 v2.44.0): a feat (no `won` gate) — draft 3+ legendary perks in one run. A pure
  // luck/greed goal; reads the run's runPerks (each carries its .rarity). Legendaries roll ~8%/slot.
  if (runPerks.filter(p => p.rarity === 'legendary').length >= 3) give('jackpot');
  // Absolute Zero (🧊 v2.44.0): a feat (no `won` gate) — catch 12+ enemies in a single 🧊 Time Freeze
  // cast. Reads the run-only bestFreeze peak (set in triggerAbility's freeze branch, cd-defs.js).
  if (bestFreeze >= 12) give('absolute_zero');
  // Clutch (😰 v2.43.0): win a run with the wall nearly breached — 3 or fewer lives remaining. A
  // nail-biter win feat (win-gated); `lives > 0` guards the edge where a final-leak win could read 0.
  if (won && lives > 0 && lives <= 3) give('clutch');
  if (won && !abilityUsedThisRun) give('pacifist');
  if (won && towers.length > 0 && new Set(towers.map(t => t.type)).size === 1) give('monotower');
  // Polymath (🧠 v2.49.0): win using 6+ distinct tower types — a build-DIVERSITY feat that sits
  // between 🧩 Specialist (exactly 1 type) and 🧰 Full Arsenal (all 12), rewarding a varied board
  // (thematically the lesson the 🦎 Chameleon boss teaches: mix your damage sources).
  if (won && new Set(towers.map(t => t.type)).size >= 6) give('polymath');
  if (won && towers.length > 0 && towers.length <= 5) give('minimalist');
  // Lone Wolf (🐺 v2.45.0): a stricter Minimalist — win with ≤3 towers (win-gated; reads the
  // final board like Minimalist/Specialist). A tight-build skill feat.
  if (won && towers.length > 0 && towers.length <= 3) give('lone_wolf');
  // Full House (🎴 v2.45.0): cast all five abilities (meteor/freeze/rush/shock/barrier) in one run.
  // No `won` gate — a completionist feat that nudges you to exercise the whole ability bar. Reads the
  // run-only abilitiesCastThisRun Set (cd-state.js); Object.keys(ABILITIES).length keeps it data-driven.
  if (abilitiesCastThisRun.size >= Object.keys(ABILITIES).length) give('full_house');
  // Ironclad (🛡️ v2.46.0): a defensive feat (no `won` gate) — vaporize 5+ leaks with the
  // Barrier ability in one run. Reads the run-only barrierBlocks counter (cd-state.js),
  // incremented at the leak-block site in cd-update.js. Pairs with the 🏯 Rampart / 🧱 Aegis
  // Barrier meta upgrades; most natural vs heavy leak-pressure content (Breacher Surge / bosses).
  if (barrierBlocks >= 5) give('ironclad');
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
  // Jack of All Trades (🎭 v2.55.0): a feat (no `won` gate) — field 8+ distinct tower types at once
  // in a single run. Reads the run-only peakTowerTypes tracker (cd-state.js, updated in update()).
  // A build-diversity goal between 🧠 Polymath (6+, win) and 🧰 Full Arsenal (all 12, win); pairs
  // with the 🌈 Overwhelm perk. Most natural in a long/rich run where you can afford a varied board.
  if (peakTowerTypes >= 8) give('jack');
  // Cartographer (🗺️ v2.55.0): a cross-run completionist feat (no `won` gate) — reach the final
  // wave (30) on EVERY static Quick map, in any difficulty. Data-driven: iterates the MAPS keys
  // (excluding random-path mayhem) and reads the per-map best-wave keys (cd_best_<map>_<diff>).
  // recordBest() runs AFTER grantAchievements(), so the current run's map isn't written yet — fold
  // it in inline (a quick run that reached wave 30 conquers its map). Save-safe: missing keys read 0.
  {
    const diffKeys = Object.keys(DIFFS);
    const conquered = m => (gameMode === 'quick' && mapKey === m && wave >= 30) ||
      diffKeys.some(d => +(localStorage.getItem('cd_best_' + m + '_' + d) || 0) >= 30);
    if (Object.keys(MAPS).filter(m => m !== 'mayhem').every(conquered)) give('cartographer');
  }
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

// ----- Bestiary / Codex panel (v2.26.0): an in-game reference for every enemy kind,
// every boss archetype, AND (v2.28.0) every tower + its specs — what its glyph/colour
// means and how its mechanic works. The game has many enemy kinds + boss powers + towers
// with no in-game explanation, so players faced glyphs (⬢ ‼ ◈ 🔥 ⚡ ⚑ …) and coloured
// auras with no idea what they did. Render/UI-only — no save/economy/balance impact.
// Data-driven COMPLETENESS is drift-guarded by test [136]: every PREVIEW_COLOR enemy kind
// and every BOSS_ARCHETYPES entry must appear here, so a future enemy/boss can't ship
// without a codex line. The Towers section is built LIVE from TOWER_TYPES/SPECS in
// renderCodex(), so a new tower auto-appears with its specs (can't drift). Enemy disc
// colour is read live from PREVIEW_COLOR (cd-render.js, loads later — fine, this is a
// function-time lookup); boss disc colours mirror the bossMechanicBadge() aura hues.
const CODEX_ENEMIES = [
  { kind: 'norm',     glyph: '',   name: 'Drone',     wave: 'Wave 1',  desc: 'The baseline threat — no special tricks.' },
  { kind: 'fast',     glyph: '»',  name: 'Sprinter',  wave: 'Wave 3',  desc: 'Much faster than a drone, but fragile.' },
  { kind: 'tank',     glyph: '◆',  name: 'Tank',      wave: 'Wave 5',  desc: 'Slow and beefy — soaks a lot of damage.' },
  { kind: 'heal',     glyph: '+',  name: 'Medic',     wave: 'Wave 7',  desc: 'Heals nearby enemies with an aura. Pop it first to stop the regen.' },
  { kind: 'shield',   glyph: '🛡', name: 'Shielded',  wave: 'Wave 9',  desc: 'Carries flat armor that blunts low-damage hits. Counter with piercing, AP/Mortar or Poison.' },
  { kind: 'split',    glyph: '✂',  name: 'Splitter',  wave: 'Wave 11', desc: 'Bursts into smaller enemies when killed.' },
  { kind: 'molten',   glyph: '🔥', name: 'Molten',    wave: 'Wave 12', desc: 'Immune to freeze & slow — plows through crowd control at full speed.' },
  { kind: 'phantom',  glyph: '👻', name: 'Phantom',   wave: 'Wave 13', desc: 'Blinks forward and turns briefly intangible — slow single-target towers waste shots on it.' },
  { kind: 'bastion',  glyph: '⬢',  name: 'Bastion',   wave: 'Wave 14', desc: 'Takes 50% less from explosive splash (Cannon/Mortar). Bring single-target DPS.' },
  { kind: 'warden',   glyph: '◈',  name: 'Warden',    wave: 'Wave 15', desc: 'Shields nearby enemies (−40% damage). Kill it to un-shield the pack.' },
  { kind: 'jammer',   glyph: '⚡',  name: 'Jammer',    wave: 'Wave 16', desc: 'Periodically knocks a nearby tower offline — threatens your coverage.' },
  { kind: 'breacher', glyph: '‼',  name: 'Breacher',  wave: 'Wave 17', desc: 'Slow and tanky — but costs you 3 lives if it leaks. Never let one through.' },
  { kind: 'herald',   glyph: '⚑',  name: 'Herald',    wave: 'Wave 18', desc: 'Hastes nearby enemies (+35% speed). Pop it to slow the pack.' },
  { kind: 'boss',     glyph: '☠',  name: 'Overlord',  wave: 'Every 5th wave', desc: 'A massive boss worth 5 lives if it leaks. From wave 20+ it also carries one of the powers below.' },
];
// Boss archetypes (cycle from wave 20+). `type` MUST match a BOSS_ARCHETYPES entry; colour
// mirrors the bossMechanicBadge() aura hue. Drift-guarded by test [136].
const CODEX_BOSSES = [
  { type: 'regen',      glyph: '♻',  color: '#56d364', label: 'Regenerating', wave: 'Wave 20', desc: 'Continuously heals itself — burst it down fast.' },
  { type: 'summoner',   glyph: '👥', color: '#ff9492', label: 'Summoner',     wave: 'Wave 25', desc: 'Spawns weak adds while alive (capped total).' },
  { type: 'bulwark',    glyph: '🛡', color: '#79c0ff', label: 'Bulwark',      wave: 'Wave 30', desc: 'Cycles a damage-soak shield (−60%) every few seconds.' },
  { type: 'enrager',    glyph: '💢', color: '#ffb454', label: 'Enrager',      wave: 'Wave 35', desc: 'Hastes nearby enemies (+35% speed).' },
  { type: 'teleporter', glyph: '✦',  color: '#bc8cff', label: 'Teleporter',   wave: 'Wave 40', desc: 'Blinks forward and turns briefly intangible.' },
  { type: 'berserker',  glyph: '🔥', color: '#ff6a6a', label: 'Berserker',    wave: 'Wave 45', desc: 'Speeds up as it loses HP (up to +60%).' },
  { type: 'disruptor',  glyph: '⚡',  color: '#7df9ff', label: 'Disruptor',    wave: 'Wave 50', desc: 'EMP-pulses a nearby tower offline every few seconds.' },
  { type: 'juggernaut', glyph: '⛔', color: '#c0c8d6', label: 'Juggernaut',   wave: 'Wave 55', desc: 'Immune to freeze & slow.' },
  { type: 'siphon',     glyph: '💰', color: '#e3b341', label: 'Siphon',       wave: 'Wave 60', desc: 'Drains your gold while alive — kill it fast.' },
  { type: 'hydra',      glyph: '🐉', color: '#9ae65c', label: 'Hydra',        wave: 'Wave 65', desc: 'Splits into two sub-units when killed.' },
  { type: 'revenant',   glyph: '↻',  color: '#e34fd0', label: 'Revenant',     wave: 'Wave 70', desc: 'Revives once at 35% HP the first time it dies.' },
  { type: 'conduit',    glyph: '🔗', color: '#5ef2c8', label: 'Conduit',      wave: 'Wave 75', desc: 'Shielded by nearby escorts (−14% each, up to −70%). Clear the adds first.' },
  { type: 'warper',     glyph: '🌀', color: '#7c6cff', label: 'Warper',       wave: 'Wave 80', desc: 'Yanks nearby allies forward along the path.' },
  { type: 'fortifier',  glyph: '🧱', color: '#cd7f32', label: 'Fortifier',    wave: 'Wave 85', desc: 'Hardens its armor over time — drop it fast or corrode with Poison.' },
  { type: 'warlord',    glyph: '⚔',  color: '#f0c83c', label: 'Warlord',      wave: 'Wave 90', desc: 'Grants +10 flat armor to the WHOLE wave. Kill the keystone.' },
  { type: 'suppressor', glyph: '🔇', color: '#6f8faf', label: 'Suppressor',   wave: 'Wave 95', desc: 'Dampens the fire rate of every nearby tower.' },
  { type: 'absorber',   glyph: '◎',  color: '#2dd4bf', label: 'Absorber',     wave: 'Wave 100', desc: 'Caps damage from a single hit — big crits are wasted. Use rapid fire or freeze it to crack it open.' },
  { type: 'distorter',  glyph: '🔮', color: '#e879f9', label: 'Distorter',    wave: 'Wave 105', desc: 'Shrinks the firing range of nearby towers (−20%), opening coverage gaps. Freeze it to stop the field.' },
  { type: 'custodian',  glyph: '🛡', color: '#8ec7ff', label: 'Custodian',    wave: 'Wave 110', desc: 'Shields its whole escort — nearby allies take 40% less damage. Kill the Custodian (or freeze it) to drop the ward.' },
  { type: 'veil',       glyph: '🫥', color: '#dcd2ff', label: 'Veil',         wave: 'Wave 115', desc: 'Cloaks its escorts — nearby allies periodically phase out, untargetable. Use rapid fire or freeze it to stop the spread.' },
  { type: 'accelerator',glyph: '🏎', color: '#ffec5a', label: 'Accelerator',  wave: 'Wave 120', desc: 'Ramps its own speed the longer it lives (up to +80%). Burst it down early, or freeze to pause the acceleration.' },
  { type: 'cleanser',   glyph: '💧', color: '#e6fbff', label: 'Cleanser',     wave: 'Wave 125', desc: 'Purges poison & slow from itself and its escorts every few seconds. Bring direct DPS, or freeze it to stop the purge.' },
  { type: 'adaptive',   glyph: '🦎', color: '#ff5a8c', label: 'Chameleon',    wave: 'Wave 130', desc: 'Adapts to your fire — a second hit from the SAME tower type deals 50% less. Mix your damage sources, or freeze it to lift the adaptation.' },
  { type: 'nullifier',  glyph: '🚫', color: '#c44a4a', label: 'Nullifier',    wave: 'Wave 135', desc: 'Dampens the DAMAGE of nearby towers (−25%) — softer shots are eaten harder by armor. Spread out, freeze it, or take Hardened Circuits.' },
];
// The 📖 Bestiary opens from the start menu AND mid-run (in-game Codex button / 'C' hotkey,
// v2.37.0). When opened during a live game it auto-pauses so the player can read counters
// without leaking; closeCodex() resumes the pause IT created and skips the start-screen
// re-render. On the menu (started=false) both are no-ops, so menu behaviour is unchanged.
function openCodex() {
  if (started && !gameOver && !paused) {
    paused = true;
    const pb = document.getElementById('pauseBtn'); if (pb) pb.textContent = '▶ Resume';
    codexPausedGame = true;
  }
  renderCodex();
  document.getElementById('codexPanel').style.display = 'flex';
  focusPanel('codexPanel');
}
function closeCodex() {
  document.getElementById('codexPanel').style.display = 'none';
  if (started && !gameOver) {
    if (codexPausedGame) {
      paused = false;
      const pb = document.getElementById('pauseBtn'); if (pb) pb.textContent = '⏸ Pause';
    }
    codexPausedGame = false;
  } else {
    renderStartScreen();
  }
}
function renderCodex() {
  const row = (color, glyph, name, tag, desc, extra, cls) =>
    `<div class="cdxRow${cls ? ' ' + cls : ''}"${cls ? ' id="cdxHere"' : ''}><span class="cdxDisc" style="background:${color}">${glyph || ''}</span>`
    + `<div class="cdxText"><b>${name}</b>${tag ? `<span class="cdxTag">${tag}</span>` : ''}`
    + `<small>${desc}</small>${extra || ''}</div></div>`;
  let html = '<h4 class="bestSub">👾 Enemies</h4><div class="cdxList">';
  for (const e of CODEX_ENEMIES) html += row((typeof PREVIEW_COLOR !== 'undefined' && PREVIEW_COLOR[e.kind]) || '#3fb950', e.glyph, e.name, e.wave, e.desc);
  html += '</div>';
  // Deep-link (v2.54.0): if a boss with a mechanic is alive right now, its Bestiary row is
  // tinted + scrolled into view when the codex opens mid-run — so the in-game 📖 button (or C)
  // answers "what is this thing doing to me?" in one press instead of a manual scroll through
  // 24 archetypes. Read-only; null on the start menu or against a vanilla (pre-w20) boss.
  const liveBoss = (typeof enemies !== 'undefined' && started && !gameOver)
    ? (enemies.find(e => e.kind === 'boss' && !e.dead && e.bossType) || null) : null;
  const hi = liveBoss ? liveBoss.bossType : null;
  html += '<h4 class="bestSub">☠ Boss powers</h4>'
    + '<p class="cdxNote">From wave 20, every boss also carries one of these mechanics, cycling deeper as you go.</p>'
    + '<div class="cdxList">';
  for (const b of CODEX_BOSSES) html += row(b.color, b.glyph, b.label, b.wave, b.desc, '', b.type === hi ? 'cdxHere' : '');
  html += '</div>';
  // Towers — built live from TOWER_TYPES/SPECS so a new tower auto-appears (can't drift).
  html += '<h4 class="bestSub">🛡 Towers</h4>'
    + '<p class="cdxNote">Pick the right tool for the threat. At max level each tower unlocks one of two specializations.</p>'
    + '<div class="cdxList">';
  for (const k of TYPE_KEYS) {
    const t = TOWER_TYPES[k];
    const specs = (SPECS[k] || []).map(s => `<b>${s.name}</b> — ${s.desc}`).join(' · ');
    const extra = specs ? `<small class="cdxSpec">Specs: ${specs}</small>` : '';
    html += row(t.color, t.icon, t.name, `${t.cost}g`, t.tip || t.desc, extra);
  }
  html += '</div>';
  document.getElementById('codexBody').innerHTML = html;
  // Scroll the deep-linked row into view (the codex body is the scroll container). Guarded —
  // scrollIntoView is absent in some headless/older environments, and there is no row when
  // no mechanic boss is alive, so the panel opens at the top exactly as before.
  const here = document.getElementById('cdxHere');
  if (here && here.scrollIntoView) { try { here.scrollIntoView({ block: 'center' }); } catch(e) {} }
}

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
function setHighContrast(on) { highContrast = !!on; try { localStorage.setItem('cd_highcontrast', on ? '1' : '0'); } catch(e) {} renderSettings(); }
function setGridSnap(on) { gridSnap = !!on; try { localStorage.setItem('cd_gridsnap', on ? '1' : '0'); } catch(e) {} renderSettings(); }
function setDefaultMode(m) { defaultTargetMode = MODES.includes(m) ? m : 'first'; try { localStorage.setItem('cd_defaultmode', defaultTargetMode); } catch(e) {} renderSettings(); }
function renderSettings() {
  const rows = [
    { name: '📳 Screen shake', fn: 'setShake', cur: shakeEnabled, opts: [['On', true], ['Off', false]] },
    { name: '✨ Particle effects', fn: 'setParticles', cur: particleDensity, opts: [['Full', 1], ['Reduced', 0.5], ['Off', 0]] },
    { name: '♿ Colorblind aid', fn: 'setColorblind', cur: colorblindAid, opts: [['On', true], ['Off', false]] },
    { name: '◐ High contrast', fn: 'setHighContrast', cur: highContrast, opts: [['On', true], ['Off', false]] },
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
  announce(`Game over on wave ${wave}.`);   // a11y (v2.54.0) — the end screen is DOM, but the transition isn't
  if (!daily) clearRun();  // daily never persists; don't wipe the player's normal saved run
  const earned = chipsForRun();
  meta.chips += earned;
  saveMeta();
  if (daily) recordDailyStreak();   // record FIRST so the streak achievement sees today's finish
  const newAch = grantAchievements(false);
  if (newAch.length) setTimeout(() => SFX.badge(), 500);   // badge chime after the over() sound (v2.55.0)
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
  announce(`Victory on wave ${wave}.`);   // a11y (v2.54.0) — fires for the endless bank-the-win crossing too
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
    if (newAch.length) { addFloater(W/2, 132, `🏅 +${newAch.length} achievement${newAch.length>1?'s':''}!`, '#d2a8ff', 15); setTimeout(() => SFX.badge(), 400); }
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
  if (newAch.length) setTimeout(() => SFX.badge(), 550);   // badge chime after the win() fanfare (v2.55.0)
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

