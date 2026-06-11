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
  { id:'surge',   icon:'⚡', name:'Power Surge',   desc:'Towers +30% damage' },
  { id:'fog',     icon:'🌫️', name:'Fog',           desc:'Tower range -20%' },
  { id:'meteors', icon:'☄️', name:'Meteor Shower', desc:'Friendly meteors rain down' },
];
let waveMod = null, meteorRainTimer = 0;
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
  if (!isMayhem()) return;
  if (Math.random() < 0.78) {
    waveMod = WAVE_MODS[Math.floor(Math.random() * WAVE_MODS.length)];
    meteorRainTimer = 3;
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
  easy:   { name:'Easy',   desc:'+gold, +lives',       hp:0.8,  gold:160, lives:30, bounty:1.15, chipMult:0.5 },
  normal: { name:'Normal', desc:'The way it should be', hp:1,   gold:120, lives:20, bounty:1,    chipMult:1 },
  hard:   { name:'Hard',   desc:'For veterans',         hp:1.3, gold:100, lives:10, bounty:0.9,  chipMult:1.6 },
};
let diffKey = 'normal';


