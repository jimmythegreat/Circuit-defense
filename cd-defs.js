'use strict';
// ================= Meta / Talents =================
const TALENTS = {
  // — core —
  funding:    { sect:'CORE', name:'Funding',     icon:'💰', max:8,  cost: r => 5 + r*4,   desc: r => `+${25*r} starting gold` },
  firepower:  { sect:'CORE', name:'Firepower',   icon:'⚔️', max:10, cost: r => 6 + r*5,   desc: r => `+${3*r}% tower damage` },
  engineering:{ sect:'CORE', name:'Engineering', icon:'🛠️', max:8,  cost: r => 6 + r*5,   desc: r => `-${3*r}% tower cost` },
  fortitude:  { sect:'CORE', name:'Fortitude',   icon:'❤️', max:8,  cost: r => 5 + r*4,   desc: r => `+${2*r} starting lives` },
  banking:    { sect:'CORE', name:'Banking',     icon:'📈', max:5,  cost: r => 6 + r*5,   desc: r => `interest cap +${10*r}` },
  surge:      { sect:'CORE', name:'Surge',       icon:'⚡', max:8,  cost: r => 5 + r*4,   desc: r => `-${6*r}% ability cooldowns` },
  fortune:    { sect:'CORE', name:'Fortune',     icon:'🎲', max:6,  cost: r => 5 + r*4,   desc: r => `${8*r}% double bounty chance` },
  scholar:    { sect:'CORE', name:'Scholar',     icon:'📚', max:5,  cost: r => 8 + r*6,   desc: r => `+${10*r}% chips earned` },
  salvage:    { sect:'CORE', name:'Salvage',     icon:'♻️', max:6,  cost: r => 5 + r*4,   desc: r => `sell refund +${5*r}%` },
  momentum:   { sect:'CORE', name:'Momentum',    icon:'🚀', max:6,  cost: r => 6 + r*5,   desc: r => `wave-clear bonus +${10*r}%` },
  critlab:    { sect:'CORE', name:'Crit Lab',    icon:'🔬', max:5,  cost: r => 7 + r*6,   desc: r => `+${2*r}% crit chance (×2.5)` },
  piercing:   { sect:'CORE', name:'Piercing',    icon:'🗡️', max:5,  cost: r => 7 + r*6,   desc: r => `towers ignore ${2*r} armor` },
  overdrive:  { sect:'CORE', name:'Overdrive',   icon:'🌟', max:2,  cost: r => 80 + r*120, desc: r => `tower max level +${r}` },
  // — tower mastery: upgrade your towers permanently —
  mastery_gun:    { sect:'TOWER MASTERY', name:'Gunner Mastery', icon:'🔫', max:5, cost: r => 4 + r*4, desc: r => `Gunners +${6*r}% dmg, +${2*r}% range` },
  mastery_sniper: { sect:'TOWER MASTERY', name:'Sniper Mastery', icon:'🎯', max:5, cost: r => 4 + r*4, desc: r => `Snipers +${6*r}% dmg, +${2*r}% range` },
  mastery_frost:  { sect:'TOWER MASTERY', name:'Frost Mastery',  icon:'❄️', max:5, cost: r => 4 + r*4, desc: r => `Frost +${6*r}% dmg, +${2*r}% range` },
  mastery_cannon: { sect:'TOWER MASTERY', name:'Cannon Mastery', icon:'💣', max:5, cost: r => 4 + r*4, desc: r => `Cannons +${6*r}% dmg, +${2*r}% range` },
  mastery_tesla:  { sect:'TOWER MASTERY', name:'Tesla Mastery',  icon:'⚡', max:5, cost: r => 4 + r*4, desc: r => `Teslas +${6*r}% dmg, +${2*r}% range` },
  mastery_poison: { sect:'TOWER MASTERY', name:'Poison Mastery', icon:'☣️', max:5, cost: r => 4 + r*4, desc: r => `Poison +${6*r}% dmg, +${2*r}% range` },
  mastery_mortar: { sect:'TOWER MASTERY', name:'Mortar Mastery', icon:'🎇', max:5, cost: r => 4 + r*4, desc: r => `Mortars +${6*r}% dmg, +${2*r}% range` },
  mastery_buff:   { sect:'TOWER MASTERY', name:'Booster Mastery',icon:'📡', max:5, cost: r => 4 + r*4, desc: r => `Boosters +${3*r}% aura, +${2*r}% range` },
};
let meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem('cd_meta'));
    if (m && typeof m.chips === 'number') meta = m;
  } catch(e) {}
  for (const k of Object.keys(TALENTS)) {
    if (!(k in meta.talents)) meta.talents[k] = 0;
    meta.talents[k] = Math.min(meta.talents[k], TALENTS[k].max);
  }
  // additive schema migration — older saves predate achievements/stats
  if (!meta.achievements || typeof meta.achievements !== 'object') meta.achievements = {};
  if (!meta.stats || typeof meta.stats !== 'object') meta.stats = {};
  if (typeof meta.stats.dmg !== 'number') meta.stats.dmg = 0;
  if (typeof meta.stats.runs !== 'number') meta.stats.runs = 0;
  if (typeof meta.stats.bestCombo !== 'number') meta.stats.bestCombo = 0;
}
const maxTowerLevel = () => 5 + tRank('overdrive');
function saveMeta() { localStorage.setItem('cd_meta', JSON.stringify(meta)); }
function tRank(k) { return meta.talents[k] || 0; }
function metaDmgMult() { return 1 + 0.03 * tRank('firepower'); }
function metaCostMult() { return 1 - 0.03 * tRank('engineering'); }
function metaCdMult() { return 1 - 0.06 * tRank('surge'); }
function sellRatio() { return Math.min(0.95, 0.6 + 0.05 * tRank('salvage') + (perkState ? perkState.sellBonus : 0)); }

function openTalents() { renderTalents(); document.getElementById('talentPanel').style.display = 'flex'; focusPanel('talentPanel'); }
function closeTalents() { document.getElementById('talentPanel').style.display = 'none'; renderStartScreen(); updateHud(); }
function renderTalents() {
  document.getElementById('talentChips').textContent = meta.chips;
  const grid = document.getElementById('talentGrid');
  grid.innerHTML = '';
  let lastSect = '';
  for (const k of Object.keys(TALENTS)) {
    if (TALENTS[k].sect !== lastSect) {
      lastSect = TALENTS[k].sect;
      const h = document.createElement('div');
      h.className = 'talentSection';
      h.textContent = '— ' + lastSect + ' —';
      grid.appendChild(h);
    }
    const t = TALENTS[k], r = tRank(k);
    const cost = t.cost(r);
    const card = document.createElement('div');
    card.className = 'talentCard';
    card.innerHTML = `<span class="ticon">${t.icon}</span><b>${t.name}</b> <span class="ranks">${r}/${t.max}</span>
      <small>${t.desc(Math.max(1, r))}${r === 0 ? ' (per rank)' : ''}</small>
      <button ${r >= t.max || meta.chips < cost ? 'disabled' : ''} data-talent="${k}">${r >= t.max ? 'MAXED' : `Learn · ${cost}🪙`}</button>`;
    card.querySelector('button').onclick = () => buyTalent(k);
    grid.appendChild(card);
  }
}
function buyTalent(k) {
  const t = TALENTS[k], r = tRank(k);
  if (r >= t.max) return;
  const cost = t.cost(r);
  if (meta.chips < cost) return;
  meta.chips -= cost;
  meta.talents[k] = r + 1;
  saveMeta();
  SFX.upgrade();
  renderTalents();
}
function resetTalents() {
  let refund = 0;
  for (const k of Object.keys(TALENTS)) {
    for (let r = 0; r < tRank(k); r++) refund += TALENTS[k].cost(r);
    meta.talents[k] = 0;
  }
  meta.chips += refund;
  saveMeta();
  SFX.sell();
  renderTalents();
}

// ================= Towers =================
const TOWER_TYPES = {
  gun:    { name:'Gunner', icon:'🔫', cost:50,  range:110, dmg:8,   rate:0.35, color:'#58a6ff', proj:'bullet', desc:'Fast & reliable' },
  sniper: { name:'Sniper', icon:'🎯', cost:120, range:240, dmg:50,  rate:1.6,  color:'#f85149', proj:'bullet', desc:'Huge single hits' },
  frost:  { name:'Frost',  icon:'❄️', cost:80,  range:95,  dmg:4,   rate:0.6,  color:'#79c0ff', proj:'frost',  desc:'Slows 40%' },
  cannon: { name:'Cannon', icon:'💣', cost:150, range:130, dmg:26,  rate:1.2,  color:'#ffd866', proj:'bomb',   desc:'Splash damage' },
  tesla:  { name:'Tesla',  icon:'⚡', cost:200, range:120, dmg:14,  rate:0.7,  color:'#d2a8ff', proj:'chain',  desc:'Chains 3 targets' },
  poison: { name:'Poison', icon:'☣️', cost:90,  range:105, dmg:7,   rate:0.8,  color:'#3fb950', proj:'poison', desc:'DoT + corrodes armor', tip:'Stacking damage-over-time. Each hit also corrodes −3 enemy armor (down to 0), stripping shield/armored/boss defenses so your whole team hits harder.' },
  mortar: { name:'Mortar', icon:'🎇', cost:175, range:225, dmg:28,  rate:2.0,  color:'#b0894f', proj:'mortar', desc:'Long-range AoE · ignores armor', tip:'Lobs an explosive shell that detonates in an area and IGNORES enemy armor entirely — a back-line siege piece against shielded/armored packs and bosses. Slow to reload, so it favours single heavy shots over sustained DPS.' },
  buff:   { name:'Booster',icon:'📡', cost:100, range:52,  dmg:0,   rate:1,    color:'#f0883e', proj:'none',   desc:'+25% dmg aura (no stacking)' },
};
const TYPE_KEYS = Object.keys(TOWER_TYPES);
const MODES = ['first', 'last', 'strong', 'close'];
const MODE_ICON = { first:'⏩ First', last:'⏪ Last', strong:'💪 Strong', close:'📍 Close' };

// Specializations: unlocked free at max level, one choice
const SPECS = {
  gun:    [ {id:'minigun', name:'Minigun',      desc:'Fire rate ×1.8'},          {id:'ap',       name:'AP Rounds',    desc:'+25% dmg, ignores armor'} ],
  sniper: [ {id:'deadeye', name:'Deadeye',      desc:'20% crits ×4 dmg'},        {id:'executor', name:'Executioner',  desc:'+60% dmg vs tanks & bosses'} ],
  frost:  [ {id:'deep',    name:'Deep Freeze',  desc:'Slow 65% instead of 40%'}, {id:'shatter',  name:'Shatter',      desc:'Damage ×4.5'} ],
  cannon: [ {id:'mega',    name:'Mega Blast',   desc:'+60% splash & +15% dmg'},  {id:'cluster',  name:'Cluster Bomb', desc:'+50% damage'} ],
  tesla:  [ {id:'super',   name:'Superconductor',desc:'Chains 5 targets'},       {id:'overcharge',name:'Overcharge',  desc:'No chain damage falloff'} ],
  poison: [ {id:'virulent',name:'Virulent',     desc:'Poison DPS ×2'},           {id:'lingering',name:'Lingering',    desc:'Poison duration ×2'} ],
  mortar: [ {id:'demo',    name:'Demolisher',   desc:'+35% damage'},             {id:'saturate', name:'Saturation',   desc:'+55% blast radius'} ],
  buff:   [ {id:'network', name:'Network',      desc:'Aura range +50% & power +10%'}, {id:'overclock',name:'Overclock',    desc:'Aura power +20%'} ],
};
function specOf(t) {
  if (!t.spec) return null;
  return SPECS[t.type].find(s => s.id === t.spec) || null;
}

// ================= Abilities =================
const ABILITIES = {
  meteor: { name:'Meteor',    icon:'☄️', key:'Q', cd:30, desc:'Click map: massive AoE damage' },
  freeze: { name:'Time Freeze',icon:'🧊', key:'W', cd:45, desc:'Freeze ALL enemies for 4s' },
  rush:   { name:'Gold Rush', icon:'💰', key:'E', cd:60, desc:'Instant gold injection' },
};
let abilityCd = { meteor: 0, freeze: 0, rush: 0 };
let armedAbility = null;

function renderAbilityBar() {
  const bar = document.getElementById('abilityBar');
  bar.innerHTML = '';
  for (const k of Object.keys(ABILITIES)) {
    const a = ABILITIES[k];
    const btn = document.createElement('div');
    btn.className = 'abilityBtn' + (abilityCd[k] > 0 ? ' cooling' : '') + (armedAbility === k ? ' armed' : '');
    btn.id = 'ab_' + k;
    btn.title = `${a.name} — ${a.desc}`;
    btn.innerHTML = `<span class="keytip">${a.key}</span><span class="aicon">${a.icon}</span><span class="cdText">${abilityCd[k] > 0 ? Math.ceil(abilityCd[k]) + 's' : a.name.split(' ')[0]}</span><div class="cdshade" style="height:${Math.min(100, abilityCd[k] / (a.cd * metaCdMult()) * 100)}%"></div>`;
    btn.onclick = () => triggerAbility(k);
    bar.appendChild(btn);
  }
}
function refreshAbilityBar() {
  for (const k of Object.keys(ABILITIES)) {
    const el = document.getElementById('ab_' + k);
    if (!el) continue;
    el.classList.toggle('cooling', abilityCd[k] > 0);
    el.classList.toggle('armed', armedAbility === k);
    el.querySelector('.cdText').textContent = abilityCd[k] > 0 ? Math.ceil(abilityCd[k]) + 's' : ABILITIES[k].name.split(' ')[0];
    el.querySelector('.cdshade').style.height = Math.min(100, abilityCd[k] / (ABILITIES[k].cd * metaCdMult()) * 100) + '%';
  }
}
function triggerAbility(k) {
  if (!started || gameOver || paused || draftOpen) return;
  if (abilityCd[k] > 0) return;
  if (k === 'meteor') {
    armedAbility = armedAbility === 'meteor' ? null : 'meteor';
    refreshAbilityBar();
    return;
  }
  if (k === 'freeze') {
    abilityCd.freeze = ABILITIES.freeze.cd * metaCdMult();
    for (const e of enemies) e.frozen = 4;
    addFloater(W/2, H/2, '🧊 TIME FREEZE', '#79c0ff', 26);
    SFX.freeze();
  }
  if (k === 'rush') {
    abilityCd.rush = ABILITIES.rush.cd * metaCdMult();
    const amount = 50 + wave * 5;
    gold += amount;
    addFloater(W/2, H/2, `💰 +${amount} GOLD`, '#ffd866', 24);
    SFX.perk();
    updateHud();
  }
  refreshAbilityBar();
}
function castMeteor(x, y) {
  abilityCd.meteor = ABILITIES.meteor.cd * metaCdMult() * perkState.meteorCdMult;
  armedAbility = null;
  const dmg = (120 + wave * 14) * perkState.meteorMult;
  shake = Math.max(shake, 18);
  SFX.meteor();
  addExplosion(x, y, '#ff7b42', 40, 260);
  addExplosion(x, y, '#ffd866', 24, 160);
  for (const e of enemies) {
    if (e.x === undefined || e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) < 95) damage(e, dmg, null);
  }
  addFloater(x, y - 30, 'METEOR!', '#ff7b42', 22);
  refreshAbilityBar();
}

// ================= Run perks (draft every 5 waves) =================
const REPEATABLE = ['reinforce','chest','vault','guardian','ascension'];
const PERKS = [
  // ——— common ———
  { id:'sharp',   rarity:'common', icon:'🎯', name:'Sharpshooter',  desc:'Snipers +30% damage',          apply:s=>s.typeDmg.sniper = (s.typeDmg.sniper||1)*1.3 },
  { id:'heavy',   rarity:'common', icon:'🔫', name:'Heavy Rounds',  desc:'Gunners +30% damage',          apply:s=>s.typeDmg.gun = (s.typeDmg.gun||1)*1.3 },
  { id:'frostbite',rarity:'common',icon:'🧊', name:'Frostbite',    desc:'Frost towers +40% damage',     apply:s=>s.typeDmg.frost = (s.typeDmg.frost||1)*1.4 },
  { id:'rapid',   rarity:'common', icon:'⏱️', name:'Rapid Systems', desc:'All towers fire 10% faster',   apply:s=>s.rateMult *= 0.9 },
  { id:'bounty',  rarity:'common', icon:'💵', name:'Bounty Hunter', desc:'+1 gold per kill',             apply:s=>s.bountyAdd += 1 },
  { id:'deep',    rarity:'common', icon:'❄️', name:'Cryo Tech',     desc:'Slows are 15% stronger',       apply:s=>s.slowBonus += 0.15 },
  { id:'bang',    rarity:'common', icon:'💥', name:'Big Bang',      desc:'Splash radius +35%',           apply:s=>s.splashMult *= 1.35 },
  { id:'conduct', rarity:'common', icon:'⚡', name:'Conductor',     desc:'Tesla chains +1 target',       apply:s=>s.chainExtra += 1 },
  { id:'viro',    rarity:'common', icon:'☣️', name:'Virology',      desc:'Poison lasts +2s',             apply:s=>s.poisonDur += 2 },
  { id:'reinforce',rarity:'common',icon:'🛡️', name:'Reinforcements',desc:'+5 lives immediately',         apply:()=>{ lives += 5; updateHud(); } },
  { id:'chest',   rarity:'common', icon:'🎁', name:'War Chest',     desc:'+150 gold immediately',        apply:()=>{ gold += 150; updateHud(); } },
  { id:'discount',rarity:'common', icon:'🏷️', name:'Wholesale',     desc:'Towers & upgrades -10% cost',  apply:s=>s.costMult *= 0.9 },
  // ——— rare ———
  { id:'crit',    rarity:'rare', icon:'🍀', name:'Crit Systems',   desc:'All towers: 10% crit ×2.5',     apply:s=>s.critChance += 0.10 },
  { id:'overchg', rarity:'rare', icon:'🔋', name:'Overcharge',     desc:'ALL damage +15%',               apply:s=>s.dmgMult *= 1.15 },
  { id:'haste',   rarity:'rare', icon:'💨', name:'Hyper Servos',   desc:'All towers fire 15% faster',    apply:s=>s.rateMult *= 0.85 },
  { id:'chrono',  rarity:'rare', icon:'🕰️', name:'Chrono Field',   desc:'All enemies 10% slower',        apply:s=>s.slowGlobal *= 0.9 },
  { id:'goldmine',rarity:'rare', icon:'⛏️', name:'Gold Mine',      desc:'Wave-clear bonus +25%',         apply:s=>s.waveBonusMult *= 1.25 },
  { id:'vault',   rarity:'rare', icon:'🏦', name:'Vault Crack',    desc:'+400 gold immediately',         apply:()=>{ gold += 400; updateHud(); } },
  { id:'guardian',rarity:'rare', icon:'👼', name:'Guardian Angel', desc:'+10 lives immediately',         apply:()=>{ lives += 10; updateHud(); } },
  // ——— legendary: SUPER GRADES ———
  { id:'diamond', rarity:'legendary', icon:'💎', name:'Diamond Core',    desc:'ALL damage +30%',                          apply:s=>s.dmgMult *= 1.3 },
  { id:'midas',   rarity:'legendary', icon:'👑', name:'Midas Touch',     desc:'15% chance kills drop ×5 gold',            apply:s=>s.midas += 0.15 },
  { id:'orbital', rarity:'legendary', icon:'🛰️', name:'Orbital Support', desc:'Friendly meteor strike every 8s',          apply:s=>s.orbital = true },
  { id:'chronolord',rarity:'legendary',icon:'⌛', name:'Chrono Lord',     desc:'Enemies 20% slower, slows +10% stronger',  apply:s=>{ s.slowGlobal *= 0.8; s.slowBonus += 0.10; } },
  { id:'singularity',rarity:'legendary',icon:'🕳️',name:'Singularity',    desc:'Meteor ability: ×2 damage, half cooldown', apply:s=>{ s.meteorMult *= 2; s.meteorCdMult *= 0.5; } },
  { id:'titanslayer',rarity:'legendary',icon:'🗡️',name:'Titan Slayer',   desc:'+100% damage vs tanks & bosses',           apply:s=>s.bossDmg *= 2 },
  { id:'geese',   rarity:'legendary', icon:'🪿', name:'Golden Geese',    desc:'+3 gold per kill',                         apply:s=>s.bountyAdd += 3 },
  { id:'ascension',rarity:'legendary',icon:'🌟', name:'Ascension',       desc:'ALL towers +1 level instantly (free)',     apply:()=>{ ascendTowers(); } },
  // Comeback mechanic (v1.22.0): scales with lives lost this run, so it ONLY rewards a
  // struggling player (a flawless run gets +0%) — a deliberate "too easy"-safe legendary.
  { id:'laststand',rarity:'legendary',icon:'🩸', name:'Last Stand',      desc:'+3% damage per life lost (max +60%)',      apply:s=>s.lastStand = true },
];
const RARITY_LABEL = { common:'COMMON', rare:'◆ RARE', legendary:'★ LEGENDARY' };
let perkState, runPerks, draftOpen = false;
function freshPerkState() {
  return { typeDmg:{}, rateMult:1, bountyAdd:0, slowBonus:0, splashMult:1, chainExtra:0, poisonDur:3,
    critChance:0, costMult:1, dmgMult:1, slowGlobal:1, waveBonusMult:1, sellBonus:0, midas:0,
    orbital:false, meteorMult:1, meteorCdMult:1, bossDmg:1, lastStand:false, livesLost:0 };
}
function ascendTowers() {
  for (const t of towers) {
    if (t.level >= maxTowerLevel()) continue;
    t.level++;
    t.dmg *= 1.45; t.range *= 1.08; t.rate *= 0.88;
    if (t.type === 'buff') t.buffPower += 0.08; // matches upgradeTower taper (v1.16.2)
    addExplosion(t.x, t.y, '#ffd866', 10, 90);
  }
  updateHud();
}
function rollRarity() {
  const r = Math.random();
  if (r < 0.08) return 'legendary';
  if (r < 0.22) return 'rare';
  return 'common';
}
function openDraft() {
  draftOpen = true;
  document.getElementById('draftWave').textContent = wave;
  const taken = new Set(runPerks.map(p => p.id));
  const avail = PERKS.filter(p => !taken.has(p.id) || REPEATABLE.includes(p.id));
  const opts = [];
  for (let slot = 0; slot < 3 && avail.length; slot++) {
    let rar = rollRarity();
    let pool = avail.filter(p => p.rarity === rar && !opts.includes(p));
    if (!pool.length) pool = avail.filter(p => p.rarity === 'rare' && !opts.includes(p));
    if (!pool.length) pool = avail.filter(p => p.rarity === 'common' && !opts.includes(p));
    if (!pool.length) pool = avail.filter(p => !opts.includes(p));
    if (!pool.length) break;
    opts.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  const cards = document.getElementById('draftCards');
  cards.innerHTML = '';
  for (const p of opts) {
    const card = document.createElement('div');
    card.className = 'perkCard ' + p.rarity;
    // Keyboard a11y (v1.20.0): the draft is the one mid-game modal; make each
    // card focusable + operable so it isn't mouse-only. Enter/Space picks it.
    // stopPropagation keeps Space from also reaching the in-game keydown
    // (which would startWave the instant the pick closes the modal).
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${RARITY_LABEL[p.rarity]} — ${p.name}: ${p.desc}`);
    card.innerHTML = `<span class="rarity">${RARITY_LABEL[p.rarity]}</span><span class="picon">${p.icon}</span><b>${p.name}</b><small>${p.desc}</small>`;
    card.onclick = () => pickPerk(p);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pickPerk(p); } };
    cards.appendChild(card);
  }
  document.getElementById('draftModal').style.display = 'flex';
  // Move focus into the modal so keyboard users land on a card (Tab is trapped
  // here by _topTrapPanel() in cd-core.js; Esc stays disabled — a pick is required).
  const firstCard = cards.firstElementChild;
  if (firstCard) firstCard.focus();
}
function pickPerk(p) {
  p.apply(perkState);
  runPerks.push({id: p.id, icon: p.icon, name: p.name, rarity: p.rarity});
  if (p.rarity === 'legendary') { shake = Math.max(shake, 10); SFX.win(); }
  draftOpen = false;
  document.getElementById('draftModal').style.display = 'none';
  addFloater(W/2, 90, `${p.icon} ${p.name}!`, '#ffd866', 20);
  SFX.perk();
  if (pendingDrafts > 0) pendingDrafts--;
  if (pendingDrafts > 0) { openDraft(); return; }  // rush bundled several drafts — show the next
  if (autoWave) autoStartTimer = 6;
  saveRun();
  updateHud();
}

