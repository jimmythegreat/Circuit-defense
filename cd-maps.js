'use strict';
// ================= Maps =================
const MAPS = {
  classic: { name:'Classic', desc:'Winding circuit', pts: [
    [-30,100],[180,100],[180,280],[420,280],[420,90],[700,90],[700,360],[300,360],[300,470],[620,470],[620,430],[930,430]
  ]},
  spiral: { name:'Spiral', desc:'Long coiled route', pts: [
    [-30,60],[840,60],[840,500],[80,500],[80,160],[700,160],[700,400],[200,400],[200,260],[930,260]
  ]},
  serpent: { name:'Serpent', desc:'Brutal switchbacks', pts: [
    [-30,80],[820,80],[820,190],[80,190],[80,300],[820,300],[820,410],[80,410],[80,505],[930,505]
  ]},
  mayhem: { name:'🌀 Mayhem', desc:'Path shifts every 5 waves · chaos modifiers', pts: null },
};
let mapKey = 'classic';
let gameMode = 'quick';   // 'quick' | 'campaign'
let campLevel = 1;
const CAMPAIGN_LEVELS = 40;
let waypoints, segs, pathLen;
const isMayhem = () => gameMode === 'quick' && mapKey === 'mayhem';
// Daily Challenge (v1.28.0): a deterministic, date-seeded Mayhem-flavoured run — everyone
// gets the SAME map path + difficulty + wave-modifier schedule for a given local date, with
// its own per-day best-wave key (cd_daily_<YYYYMMDD>). A daily run is modelled as a quick-mode
// Mayhem run (so isMayhem() stays true → chaos theme + mods) with `daily=true` flipping the
// random bits to the seeded stream and FIXING the path (no every-5-waves shift, so scores
// compare). Run-only flags; daily runs never call saveRun()/clearRun() so the player's normal
// saved run is never touched (no schema change).
let daily = false;
let dailyDateKey = '';      // 'YYYYMMDD' for the active/last-setup daily
let dailySeed = 0;          // 32-bit numeric seed derived from dailyDateKey
let dailyMods = [];         // precomputed wave-mod id (or null) indexed by wave number (1-based)
function campaignDone() { return +(localStorage.getItem('cd_campaign') || 0); }
function victoryWave() { return gameMode === 'campaign' ? 14 + campLevel : 30; }
function genPathWith(rnd) {
  const pts = [];
  let y = 90 + rnd() * 380;
  pts.push([-30, y]);
  let x = 90 + rnd() * 80;
  pts.push([x, y]);
  while (x < 740) {
    let ny;
    do { ny = 70 + rnd() * 420; } while (Math.abs(ny - y) < 100);
    y = ny;
    pts.push([x, y]);
    x = Math.min(830, x + 130 + rnd() * 180);
    pts.push([x, y]);
  }
  pts.push([930, y]);
  return pts;
}
function genMayhemPath() { return genPathWith(Math.random); }
// campaign maps are freshly randomized on every attempt — no two runs alike
function genCampaignPath() { return genPathWith(Math.random); }

// ----- Daily Challenge seeded RNG (v1.28.0) -----
// Mulberry32: a tiny, fast, well-distributed 32-bit PRNG. Pure JS, offline-safe — the daily
// challenge derives its whole setup from the LOCAL date so every player gets the same run today.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 'YYYYMMDD' from a Date (defaults to now, in the player's LOCAL timezone so the day flips at
// local midnight — no network/UTC dependency).
function dailyDateString(d) {
  d = d || new Date();
  return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}
// 'YYYYMMDD' for the calendar day before a given key — used by the Daily streak counter to
// decide whether a finish continues yesterday's streak. Parses the key into a LOCAL Date
// (midnight), steps back one day (DST/month/year-safe via Date arithmetic), reformats.
function dailyDayBefore(key) {
  const d = new Date(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8));
  d.setDate(d.getDate() - 1);
  return dailyDateString(d);
}
// FNV-1a string hash → 32-bit seed.
function dailySeedFrom(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Resolve the deterministic setup for a date: difficulty, the fixed Mayhem path, and the
// per-wave modifier schedule (waves 1..30). Call order fixes the rng-stream consumption, so a
// given date always yields the same run. diffKey is forced to normal/hard (a daily is a
// challenge — never easy). Difficulty/path/mods all share ONE rng stream for reproducibility.
function setupDaily(dateStr) {
  dailyDateKey = dateStr || dailyDateString();
  dailySeed = dailySeedFrom(dailyDateKey);
  const rnd = mulberry32(dailySeed);
  diffKey = rnd() < 0.5 ? 'normal' : 'hard';
  MAPS.mayhem.pts = genPathWith(rnd);            // fixed map for the day (no shift)
  dailyMods = [null];                             // index 0 unused (waves are 1-based)
  for (let w = 1; w <= 30; w++) {
    dailyMods[w] = rnd() < 0.78 ? WAVE_MODS[Math.floor(rnd() * WAVE_MODS.length)].id : null;
  }
}
function buildPath() {
  if (gameMode === 'campaign') {
    waypoints = genCampaignPath();
    segs = []; pathLen = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x1,y1] = waypoints[i], [x2,y2] = waypoints[i+1];
      const len = Math.hypot(x2-x1, y2-y1);
      segs.push({x1,y1,x2,y2,len,start:pathLen});
      pathLen += len;
    }
    return;
  }
  if (isMayhem() && !MAPS.mayhem.pts) MAPS.mayhem.pts = genMayhemPath();
  waypoints = MAPS[mapKey].pts;
  segs = []; pathLen = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [x1,y1] = waypoints[i], [x2,y2] = waypoints[i+1];
    const len = Math.hypot(x2-x1, y2-y1);
    segs.push({x1,y1,x2,y2,len,start:pathLen});
    pathLen += len;
  }
}
function pointAt(d) {
  if (d <= 0) return {x: waypoints[0][0], y: waypoints[0][1]};
  for (const s of segs) {
    if (d <= s.start + s.len) {
      const t = (d - s.start) / s.len;
      return {x: s.x1 + (s.x2-s.x1)*t, y: s.y1 + (s.y2-s.y1)*t};
    }
  }
  const last = waypoints[waypoints.length-1];
  return {x:last[0], y:last[1]};
}
function distToPath(x, y) {
  let min = Infinity;
  for (const s of segs) {
    const dx = s.x2-s.x1, dy = s.y2-s.y1;
    const t = Math.max(0, Math.min(1, ((x-s.x1)*dx + (y-s.y1)*dy) / (s.len*s.len)));
    const px = s.x1 + dx*t, py = s.y1 + dy*t;
    min = Math.min(min, Math.hypot(x-px, y-py));
  }
  return min;
}

// ================= Mayhem mode =================
const WAVE_MODS = [
  { id:'frenzy',  icon:'💨', name:'Frenzy',        desc:'Enemies +35% speed' },
  { id:'swarm',   icon:'🐝', name:'Swarm',         desc:'+60% enemies at -35% HP' },
  { id:'titans',  icon:'🗿', name:'Titans',        desc:'Enemies +50% HP, +50% bounty' },
  { id:'goldrush',icon:'💰', name:'Gold Rush',     desc:'Double bounty this wave' },
  { id:'drought', icon:'🏜️', name:'Bounty Drought', desc:'Enemies drop 50% less gold' },
  { id:'surge',   icon:'⚡', name:'Power Surge',   desc:'Towers +30% damage' },
  { id:'fog',     icon:'🌫️', name:'Fog',           desc:'Tower range -20%' },
  { id:'armored', icon:'🛡️', name:'Armored Surge', desc:'Enemies gain heavy armor' },
  { id:'brownout',icon:'🔌', name:'Brownout',       desc:'Towers fire 25% slower' },
  { id:'regen',   icon:'💚', name:'Regeneration',   desc:'Enemies self-heal over time' },
  { id:'emp',     icon:'⚡', name:'Static Storm',   desc:'Towers randomly knocked offline' },
  { id:'wardens', icon:'💠', name:'Warden Surge',   desc:'Warden escorts shield the wave' },
  { id:'meteors', icon:'☄️', name:'Meteor Shower', desc:'Friendly meteors rain down' },
];
const MOD_BY_ID = Object.fromEntries(WAVE_MODS.map(m => [m.id, m]));
// Read-only preview of a date's Daily Challenge setup WITHOUT mutating any global state — mirrors
// setupDaily's rng-stream consumption EXACTLY (difficulty, then the path draw to advance the stream,
// then the 30-wave mod schedule incl. the short-circuit when the 78% roll fails) so the result is
// identical to what setupDaily(date) would produce. Returns the day's difficulty + the DISTINCT,
// in-first-appearance-order set of wave-mod ids, so the start screen can show today's flavour without
// starting the run. (v1.47.0)
function dailyPreview(dateStr) {
  const rnd = mulberry32(dailySeedFrom(dateStr || dailyDateString()));
  const diff = rnd() < 0.5 ? 'normal' : 'hard';
  genPathWith(rnd);                                // advance the stream identically (discard the path)
  const ids = [];
  for (let w = 1; w <= 30; w++) {
    const pick = rnd() < 0.78 ? WAVE_MODS[Math.floor(rnd() * WAVE_MODS.length)].id : null;
    if (pick && !ids.includes(pick)) ids.push(pick);
  }
  return { diff, modIds: ids };
}
let waveMod = null, meteorRainTimer = 0, empStrikeTimer = 0;
function shiftWorld() {
  MAPS.mayhem.pts = genMayhemPath();
  buildPath();
  relocateTowers();
  shake = Math.max(shake, 20);
  addFloater(W/2, H/2 - 20, '🌀 THE WORLD SHIFTS!', '#d2a8ff', 28);
  SFX.freeze();
}
function relocateTowers() {
  const old = [...towers];
  towers = [];
  for (const t of old) {
    let placed = false;
    for (let i = 0; i < 300 && !placed; i++) {
      const p = pointAt(Math.random() * pathLen);
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 80;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (canPlace(x, y)) { t.x = x; t.y = y; placed = true; }
    }
    for (let i = 0; i < 500 && !placed; i++) {
      const x = 20 + Math.random() * (W - 40), y = 20 + Math.random() * (H - 40);
      if (canPlace(x, y)) { t.x = x; t.y = y; placed = true; }
    }
    towers.push(t);
    addExplosion(t.x, t.y, '#d2a8ff', 8, 80);
  }
  hideUpgrade();
}
function rollWaveMod() {
  waveMod = null;
  // Daily Challenge: the modifier for each wave is fixed by the date seed (deterministic
  // schedule precomputed in setupDaily), so every player faces the same mods in the same order.
  if (daily) {
    const id = dailyMods[wave];
    if (id) waveMod = WAVE_MODS.find(m => m.id === id) || null;
  } else if (isMayhem()) {
    if (Math.random() < 0.78) waveMod = WAVE_MODS[Math.floor(Math.random() * WAVE_MODS.length)];
  }
  if (waveMod) {
    meteorRainTimer = 3;
    empStrikeTimer = 2.5;   // Static Storm: short grace before the first tower is zapped offline
    addFloater(W/2, 110, `${waveMod.icon} ${waveMod.name}: ${waveMod.desc}`, '#ffd866', 18);
    SFX.perk();
  }
}
const modIs = id => waveMod && waveMod.id === id;

// ================= Stars (background) =================
const stars = [];
for (let i = 0; i < 90; i++) {
  stars.push({x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.4+0.3, ph: Math.random()*Math.PI*2, sp: 0.5+Math.random()*2});
}

// ================= Difficulty =================
const DIFFS = {
  // easy made VERY easy (owner FEEDBACK): hp 0.8→0.6, +gold/+lives bumped. normal eased
  // a touch (hp 1→0.85, lives 20→22) — owner failed at wave 5 of classic-normal on a
  // fresh (no-talent) save. Each number ≤25% swing; hard left for veterans.
  easy:   { name:'Easy',   desc:'Very easy · lots of gold & lives', hp:0.6,  gold:190, lives:36, bounty:1.15, chipMult:0.5 },
  normal: { name:'Normal', desc:'The way it should be', hp:0.85, gold:120, lives:22, bounty:1,    chipMult:1 },
  hard:   { name:'Hard',   desc:'For veterans',         hp:1.3, gold:100, lives:10, bounty:0.9,  chipMult:1.6 },
};
let diffKey = 'normal';

// ================= Map themes (visual palettes) =================
// Owner FEEDBACK: "all the maps look the same — add random colors/textures.
// Classic always picks the same theme; mayhem is wild (on fire, wild colors);
// campaign is random but tame." So each named quick-map gets a fixed identity,
// campaign rolls a tame palette per attempt, and mayhem uses an animated "chaos"
// palette. PURELY COSMETIC — the palette only feeds draw(); the only persistent
// hook is saving the resolved theme key so a resumed run looks identical.
const THEMES = {
  circuit: { name:'Circuit', bgIn:'#0d1420', bgOut:'#070a10', star:'#9ecbff', grid:'rgba(88,166,255,0.05)',  pDark:'#04060a', pMid:'#1c2533', pLite:'#243044', glow:'rgba(88,166,255,0.4)',  dash:'rgba(88,166,255,0.25)' },
  verdant: { name:'Verdant', bgIn:'#0a1810', bgOut:'#040a06', star:'#9be8b4', grid:'rgba(80,220,140,0.05)',  pDark:'#03080a', pMid:'#16302a', pLite:'#1f4438', glow:'rgba(80,220,140,0.4)',  dash:'rgba(120,240,170,0.25)' },
  ember:   { name:'Ember',   bgIn:'#1a0f08', bgOut:'#0c0604', star:'#ffcaa0', grid:'rgba(255,150,80,0.05)',  pDark:'#0a0503', pMid:'#33231a', pLite:'#48321f', glow:'rgba(255,150,80,0.4)',  dash:'rgba(255,180,110,0.25)' },
  violet:  { name:'Violet',  bgIn:'#140a20', bgOut:'#08040f', star:'#d2a8ff', grid:'rgba(170,120,255,0.05)', pDark:'#070310', pMid:'#261c38', pLite:'#352a4a', glow:'rgba(170,120,255,0.4)', dash:'rgba(200,160,255,0.25)' },
  ice:     { name:'Ice',     bgIn:'#0a1620', bgOut:'#04090f', star:'#aef0ff', grid:'rgba(120,210,255,0.05)', pDark:'#03070a', pMid:'#173040', pLite:'#1f4458', glow:'rgba(120,210,255,0.4)', dash:'rgba(170,230,255,0.25)' },
};
// Fixed identity per named quick-map; campaign draws from the tame set below.
const MAP_THEME = { classic:'circuit', spiral:'verdant', serpent:'ember' };
const CAMPAIGN_THEMES = ['circuit', 'verdant', 'ember', 'violet', 'ice'];
let mapTheme = 'circuit';   // resolved theme KEY for the current run (run-only; saved for resume parity)
function pickMapTheme() {
  if (gameMode === 'campaign') return CAMPAIGN_THEMES[Math.floor(Math.random() * CAMPAIGN_THEMES.length)];
  if (isMayhem()) return 'chaos';
  return MAP_THEME[mapKey] || 'circuit';
}
// Resolve the concrete palette for THIS frame. 'chaos' (mayhem) is animated — the
// hue sweeps for a "world on fire" feel — but collapses to a static fiery palette
// when the OS asks to reduce motion. Every other theme is a static THEMES entry.
function mapPalette() {
  if (mapTheme === 'chaos') {
    const t = reduceMotion() ? 0 : performance.now() / 1000;
    const h = (t * 40) % 360, h2 = (h + 50) % 360;
    return {
      bgIn:`hsl(${(h + 10) % 360},55%,8%)`, bgOut:'#0a0204', star:`hsl(${h2},90%,75%)`,
      grid:`hsla(${h},90%,60%,0.06)`,
      pDark:'#0a0202', pMid:`hsl(${h},45%,16%)`, pLite:`hsl(${h2},55%,24%)`,
      glow:`hsla(${h},95%,55%,0.5)`, dash:`hsla(${h2},95%,65%,0.35)`,
    };
  }
  return THEMES[mapTheme] || THEMES.circuit;
}


