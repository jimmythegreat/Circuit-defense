'use strict';
// ================= Meta / Talents =================
const TALENTS = {
  // — core —
  // Talent cost curves rebalanced v1.38.0 (owner FEEDBACK "talents … way too easy to get …
  // after a few rounds you become way better and the game is easy and boring"). The lever is
  // PRICE, not power: every talent costs more (≥~25% general uplift the owner asked for) and the
  // damage/power outliers (firepower, the eight masteries, crit lab, overdrive) cost a LOT more
  // (~+50–100%) with a steeper per-rank slope, so the first few runs no longer snowball you to
  // trivialising the game. None removed (each maps to a distinct mechanic + removing one would
  // silently strip already-spent chips — save-unsafe). Owner waived the ≤25%/run swing rule here.
  funding:    { sect:'CORE', name:'Funding',     icon:'💰', max:8,  cost: r => 6 + r*5,    desc: r => `+${25*r} starting gold` },
  firepower:  { sect:'CORE', name:'Firepower',   icon:'⚔️', max:10, cost: r => 11 + r*9,   desc: r => `+${3*r}% tower damage` },
  engineering:{ sect:'CORE', name:'Engineering', icon:'🛠️', max:8,  cost: r => 8 + r*6,    desc: r => `-${3*r}% tower cost` },
  fortitude:  { sect:'CORE', name:'Fortitude',   icon:'❤️', max:8,  cost: r => 6 + r*5,    desc: r => `+${2*r} starting lives` },
  banking:    { sect:'CORE', name:'Banking',     icon:'📈', max:5,  cost: r => 8 + r*6,    desc: r => `interest cap +${10*r}` },
  surge:      { sect:'CORE', name:'Surge',       icon:'⚡', max:8,  cost: r => 6 + r*5,    desc: r => `-${6*r}% ability cooldowns` },
  fortune:    { sect:'CORE', name:'Fortune',     icon:'🎲', max:6,  cost: r => 6 + r*5,    desc: r => `${8*r}% double bounty chance` },
  scholar:    { sect:'CORE', name:'Scholar',     icon:'📚', max:5,  cost: r => 10 + r*8,   desc: r => `+${10*r}% chips earned` },
  salvage:    { sect:'CORE', name:'Salvage',     icon:'♻️', max:6,  cost: r => 6 + r*5,    desc: r => `sell refund +${5*r}%` },
  momentum:   { sect:'CORE', name:'Momentum',    icon:'🚀', max:6,  cost: r => 8 + r*6,    desc: r => `wave-clear bonus +${10*r}%` },
  critlab:    { sect:'CORE', name:'Crit Lab',    icon:'🔬', max:5,  cost: r => 11 + r*10,  desc: r => `+${2*r}% crit chance (×2.5)` },
  piercing:   { sect:'CORE', name:'Piercing',    icon:'🗡️', max:5,  cost: r => 9 + r*7,    desc: r => `towers ignore ${2*r} armor` },
  // Farsight (v1.92.0): the CORE tree's first GLOBAL tower-range talent. The masteries give a tiny
  // per-type +2%/rank range and Targeting Array is a run-only rare perk, but nothing in the META tree
  // raised range — so coverage was a damage-only progression axis. Range is the gentlest power lever
  // (it helps you HIT, not hit harder), and a meta range option directly counters the coverage-pressure
  // content (breachers' 2-life leaks, jammers disabling towers, cloak/fog) — a meaningful, "too easy"-safe
  // meta choice, not raw DPS creep. Applies to FIRING range only (effRange), never booster auras
  // (effBuffRange), the same boundary Targeting Array/Glass Cannon respect, so it can't feed the
  // documented booster-coverage snowball. +2%/rank → +10% at rank 5. Save-safe (loadMeta auto-migrates
  // a new talent key to 0 for old saves via the Object.keys(TALENTS) loop).
  farsight:   { sect:'CORE', name:'Farsight',    icon:'🔭', max:5,  cost: r => 9 + r*7,    desc: r => `+${2*r}% tower range` },
  overdrive:  { sect:'CORE', name:'Overdrive',   icon:'🌟', max:2,  cost: r => 120 + r*180, desc: r => `tower max level +${r}` },
  // — tower mastery: upgrade your towers permanently — (cheapest big-damage talents pre-v1.38.0;
  //   doubled in cost so stacking +30% dmg across eight tower types is a real grind, not a freebie)
  mastery_gun:    { sect:'TOWER MASTERY', name:'Gunner Mastery', icon:'🔫', max:5, cost: r => 8 + r*8, desc: r => `Gunners +${6*r}% dmg, +${2*r}% range` },
  mastery_sniper: { sect:'TOWER MASTERY', name:'Sniper Mastery', icon:'🎯', max:5, cost: r => 8 + r*8, desc: r => `Snipers +${6*r}% dmg, +${2*r}% range` },
  mastery_frost:  { sect:'TOWER MASTERY', name:'Frost Mastery',  icon:'❄️', max:5, cost: r => 8 + r*8, desc: r => `Frost +${6*r}% dmg, +${2*r}% range` },
  mastery_cannon: { sect:'TOWER MASTERY', name:'Cannon Mastery', icon:'💣', max:5, cost: r => 8 + r*8, desc: r => `Cannons +${6*r}% dmg, +${2*r}% range` },
  mastery_tesla:  { sect:'TOWER MASTERY', name:'Tesla Mastery',  icon:'⚡', max:5, cost: r => 8 + r*8, desc: r => `Teslas +${6*r}% dmg, +${2*r}% range` },
  mastery_poison: { sect:'TOWER MASTERY', name:'Poison Mastery', icon:'☣️', max:5, cost: r => 8 + r*8, desc: r => `Poison +${6*r}% dmg, +${2*r}% range` },
  mastery_mortar: { sect:'TOWER MASTERY', name:'Mortar Mastery', icon:'🎇', max:5, cost: r => 8 + r*8, desc: r => `Mortars +${6*r}% dmg, +${2*r}% range` },
  mastery_rail:   { sect:'TOWER MASTERY', name:'Railgun Mastery',icon:'🛤️', max:5, cost: r => 8 + r*8, desc: r => `Railguns +${6*r}% dmg, +${2*r}% range` },
  mastery_buff:   { sect:'TOWER MASTERY', name:'Booster Mastery',icon:'📡', max:5, cost: r => 8 + r*8, desc: r => `Boosters +${3*r}% aura, +${2*r}% range` },
};
let meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem('cd_meta'));
    if (m && typeof m.chips === 'number') meta = m;
  } catch(e) {}
  // additive schema migration — a minimal/old save may carry chips but no talents map
  if (!meta.talents || typeof meta.talents !== 'object') meta.talents = {};
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
function metaRangeMult() { return 1 + 0.02 * tRank('farsight'); }
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
  rail:   { name:'Railgun', icon:'🛤️', cost:160, range:200, dmg:36,  rate:1.7,  color:'#33e0d0', proj:'rail',   desc:'Piercing beam · hits all in a line', tip:'Fires an INSTANT piercing beam straight out to its range that damages EVERY enemy whose body the line crosses — devastating when foes are lined up along a path run, mediocre against spread-out targets. Respects armor and is slow to recharge, so it rewards positioning: aim it down a long straight stretch.' },
  buff:   { name:'Booster',icon:'📡', cost:100, range:45,  dmg:0,   rate:1,    color:'#f0883e', proj:'none',   desc:'+25% dmg aura (no stacking)' },
};
const TYPE_KEYS = Object.keys(TOWER_TYPES);
const MODES = ['first', 'last', 'strong', 'close', 'weak', 'support'];
const MODE_ICON = { first:'⏩ First', last:'⏪ Last', strong:'💪 Strong', close:'📍 Close', weak:'🩸 Weak', support:'🛡 Support' };
// Enemy kinds the 'support' targeting mode prioritises (they project auras: heal / damage-shield)
const SUPPORT_KINDS = { heal: true, warden: true, herald: true };

// Specializations: unlocked free at max level, one choice
const SPECS = {
  gun:    [ {id:'minigun', name:'Minigun',      desc:'Fire rate ×1.8'},          {id:'ap',       name:'AP Rounds',    desc:'+25% dmg, ignores armor'} ],
  sniper: [ {id:'deadeye', name:'Deadeye',      desc:'20% crits ×4 dmg'},        {id:'executor', name:'Executioner',  desc:'+90% dmg vs tanks & bosses'} ],
  frost:  [ {id:'deep',    name:'Deep Freeze',  desc:'Slow 65% instead of 40%'}, {id:'shatter',  name:'Shatter',      desc:'Damage ×4.5'} ],
  cannon: [ {id:'mega',    name:'Mega Blast',   desc:'+60% splash & +15% dmg'},  {id:'cluster',  name:'Cluster Bomb', desc:'+50% damage'} ],
  tesla:  [ {id:'super',   name:'Superconductor',desc:'Chains 5 targets, softer falloff'}, {id:'overcharge',name:'Overcharge',  desc:'No chain damage falloff'} ],
  poison: [ {id:'virulent',name:'Virulent',     desc:'Poison DPS ×2'},           {id:'lingering',name:'Lingering',    desc:'Poison duration ×2'} ],
  mortar: [ {id:'demo',    name:'Demolisher',   desc:'+35% damage'},             {id:'saturate', name:'Saturation',   desc:'+55% blast radius'} ],
  rail:   [ {id:'railpen', name:'Penetrator',   desc:'+20% damage'},             {id:'railwide', name:'Overcharged Coil', desc:'Wider beam — hits a broader line'} ],
  buff:   [ {id:'network', name:'Network',      desc:'Aura range +50% & power +10%'}, {id:'overclock',name:'Overclock',    desc:'Aura power +20%'} ],
};
function specOf(t) {
  if (!t.spec) return null;
  return SPECS[t.type].find(s => s.id === t.spec) || null;
}

// ================= Tower veterancy (v1.100.0) =================
// Purely COSMETIC kill-milestone ranks. Towers accumulate lifetime kills (`t.kills`,
// already saved/restored — old saves default to 0), and crossing a threshold promotes
// the tower a rank, shown as star pips over it (cd-render.js), a rank label in the
// upgrade panel (cd-game.js) and a chunky promotion flash/sound/floater (cd-update.js).
// NO stat effect of any kind — it's recognition/game-feel like the combo meter, so it
// can't power-creep the recurring "too easy" balance concern. Run-only render state only.
const TOWER_RANKS = [
  { name: 'Rookie',  min: 0,   color: null },
  { name: 'Veteran', min: 15,  color: '#cd7f32' }, // bronze
  { name: 'Elite',   min: 40,  color: '#c9d1d9' }, // silver
  { name: 'Ace',     min: 90,  color: '#ffd866' }, // gold
  { name: 'Legend',  min: 200, color: '#ff7bd5' }, // legendary pink
];
function towerRankTier(kills) {
  let tier = 0;
  for (let i = TOWER_RANKS.length - 1; i >= 1; i--) {
    if ((kills || 0) >= TOWER_RANKS[i].min) { tier = i; break; }
  }
  return tier;
}
function towerRank(kills) { return TOWER_RANKS[towerRankTier(kills)]; }

// ================= Abilities =================
const ABILITIES = {
  meteor: { name:'Meteor',    icon:'☄️', key:'Q', cd:30, desc:'Click map: massive AoE damage' },
  freeze: { name:'Time Freeze',icon:'🧊', key:'W', cd:45, desc:'Freeze ALL enemies for 4s' },
  rush:   { name:'Gold Rush', icon:'💰', key:'E', cd:60, desc:'Instant gold injection' },
  shock:  { name:'Shockwave', icon:'🌀', key:'R', cd:50, desc:'Blast ALL enemies backward along the path' },
  barrier:{ name:'Barrier',   icon:'🛡️', key:'T', cd:60, desc:'Vaporize the next 3 enemies that reach the exit — no lives lost' },
};
const BARRIER_CHARGES = 3;   // leak-blocks granted per Barrier cast (v1.93.0)
const BARRIER_DURATION = 20;  // seconds unused barrier charges last before fading (v1.100.1)
let abilityCd = { meteor: 0, freeze: 0, rush: 0, shock: 0, barrier: 0 };
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
    abilityCd.freeze = ABILITIES.freeze.cd * metaCdMult() * perkState.abilityCdMult;
    abilityUsedThisRun = true;
    for (const e of enemies) e.frozen = 4;
    addFloater(W/2, H/2, '🧊 TIME FREEZE', '#79c0ff', 26);
    SFX.freeze();
  }
  if (k === 'rush') {
    // Gold Rush is locked until the waves have started (v1.100.1, owner FEEDBACK [bug]):
    // before round one `wave` is 0, and without this gate you could farm the injection
    // repeatedly (waiting out the cooldown) to bankroll a full board pre-combat. Once you
    // start wave 1, `wave` is ≥1 for the rest of the run, so normal between-waves use is
    // unaffected. Silent like the other early-returns, plus a hint floater so it's not confusing.
    if (wave < 1) { addFloater(W/2, H/2, '⏳ Start a wave first', '#8b949e', 18); return; }
    abilityCd.rush = ABILITIES.rush.cd * metaCdMult() * perkState.abilityCdMult;
    abilityUsedThisRun = true;
    const amount = 50 + wave * 5;
    gold += amount;
    addFloater(W/2, H/2, `💰 +${amount} GOLD`, '#ffd866', 24);
    SFX.perk();
    updateHud();
  }
  if (k === 'shock') {
    // Knock every enemy backward along the path (rewind progress) — a defensive
    // repositioning tool, distinct from Freeze's in-place pause. Pure utility (no
    // damage), so it can't power-creep the "too easy" feedback. Crowd-control-immune
    // enemies (Heatwave wave-mod / Juggernaut boss) shrug it off, reinforcing the CC axis.
    abilityCd.shock = ABILITIES.shock.cd * metaCdMult() * perkState.abilityCdMult;
    abilityUsedThisRun = true;
    for (const e of enemies) {
      if (e.x === undefined || e.dead) continue;
      if (e.ccImmune || (e.kind === 'boss' && e.bossType === 'juggernaut')) continue;
      const kb = e.kind === 'boss' ? 28 : 75;
      e.dist = Math.max(0, e.dist - kb);
      e.frozen = Math.max(e.frozen, 0.35);   // brief stagger
      e.flash = 0.2;
    }
    addFloater(W/2, H/2, '🌀 SHOCKWAVE', '#b392ff', 26);
    addExplosion(W/2, H/2, '#b392ff', 30, 240);
    addExplosion(W/2, H/2, '#7d5cff', 18, 150);
    shake = Math.max(shake, 14);
    SFX.shock();
  }
  if (k === 'barrier') {
    // Barrier (v1.93.0): bank a few leak-blocks — the next enemies that reach the exit
    // are vaporized for zero lives (consumed at the leak site in cd-update.js). Purely
    // DEFENSIVE: it pays no bounty and only matters when you're about to leak, so it can't
    // power-creep the "too easy" feedback — a panic wall vs an overwhelming wave / boss leak,
    // countering the leak-pressure content (Breacher / Breacher Surge).
    abilityCd.barrier = ABILITIES.barrier.cd * metaCdMult() * perkState.abilityCdMult;
    abilityUsedThisRun = true;
    barrierCharges = BARRIER_CHARGES;
    barrierTimer = BARRIER_DURATION;   // charges fade after this many seconds (v1.100.1)
    addFloater(W/2, H/2, `🛡️ BARRIER ×${BARRIER_CHARGES}`, '#58e0ff', 26);
    addExplosion(W/2, H/2, '#58e0ff', 22, 160);
    SFX.barrier();
  }
  refreshAbilityBar();
}
function castMeteor(x, y) {
  abilityCd.meteor = ABILITIES.meteor.cd * metaCdMult() * perkState.meteorCdMult * perkState.abilityCdMult;
  armedAbility = null;
  abilityUsedThisRun = true;
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
const REPEATABLE = ['reinforce','chest','vault','guardian','ascension','wildcard'];
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
  // Targeting Array (v1.81.0): the perk pool's first RANGE buff — extends firing range +20%
  // (applied in effRange, NOT effBuffRange, so booster auras are untouched — keeps the documented
  // booster-coverage snowball in check, same boundary Glass Cannon respects). A coverage-builder, a
  // distinct axis from the existing damage/rate/gold perks: it counters the coverage-pressure content
  // (breachers' 2-life leaks, cloaking, fog) rather than adding raw DPS, so it's a meaningful draft
  // pick, not power creep. `rangeMult` lives in perkState (save-safe default 1).
  { id:'optics',  rarity:'rare', icon:'🔭', name:'Targeting Array',  desc:'All towers +20% range',         apply:s=>s.rangeMult *= 1.2 },
  // Ambush (v1.85.0): the OPENER counterpart to the 💀 Reaper legendary (which EXECUTES enemies below
  // 12% HP). Ambush adds +30% damage to enemies still above 80% HP — rewarding burst/front-loaded
  // damage on fresh spawns, a fresh axis no other perk touches (every other damage perk is flat or
  // tower-type-keyed; this is current-HP-keyed). Strictly NARROWER than a flat +30% type buff (only the
  // opening hits qualify; trash you'd one-shot anyway sees no gain, and a high-HP boss spends only a
  // brief window above 80%), so it's a modest, "too easy"-safe rare, not power creep. Applied in the
  // fire loop (target-HP-conditional → can't live in effDmg, like Reaper/Killing Spree). `ambush` lives
  // in perkState (save-safe default false). Pairs with Reaper for a bookend "burst then finish" build.
  { id:'ambush',  rarity:'rare', icon:'🏹', name:'Ambush',           desc:'+30% damage to enemies above 80% HP', apply:s=>s.ambush = true },
  // Capacitor (v1.86.0): the perk pool's first ALL-ABILITY cooldown reducer — every active
  // ability (Meteor/Time Freeze/Gold Rush/Shockwave) recharges 25% faster. A fresh axis no
  // perk touched (Singularity is meteor-ONLY; the 🌟 Overdrive talent's metaCdMult is a meta
  // unlock, not a draft pick), it makes the underused ability bar a real build pillar — more
  // freeze/shock uptime for a defensive line, more meteor/rush for an aggressive one. Bounded
  // & "too easy"-safe: a single −25% on cooldowns of 30–60s, and the abilities are mostly
  // utility (shock/freeze deal no damage; rush is gold), so it enables a playstyle rather than
  // adding raw board DPS. `abilityCdMult` lives in perkState (save-safe default 1), multiplied
  // into every abilityCd assignment alongside the existing metaCdMult()/meteorCdMult.
  { id:'capacitor',rarity:'rare', icon:'🔋', name:'Capacitor',        desc:'Abilities recharge 25% faster', apply:s=>s.abilityCdMult *= 0.75 },
  // Surge Protector (v1.97.0): the perk pool's FIRST counter to tower-disabling content. The game
  // grew three sources that knock a tower offline (set its run-only `empT` timer): the Mayhem ⚡ Static
  // Storm modifier (2.2s), the 🔵 Disruptor boss (2.2s) and the ⚡ Jammer enemy (1.6s) — but the player
  // had no answer; a jammed tower just sat dark. This makes towers shrug off jamming 3× faster
  // (`empResist` multiplies the `empT` decay in cd-update.js's fire loop — a SINGLE site that covers all
  // three sources, since they share the empT infra), cutting a 2.2s blackout to ~0.7s and a 1.6s one to
  // ~0.5s. A fresh DEFENSIVE/uptime axis no other perk touches, and a meaningful situational draft pick
  // (it does nothing in a run with no jam content, like Cryo Tech with no slows). Deliberately
  // "too easy"-safe: it adds ZERO damage/range/economy — it only shortens downtime, so it can't make a
  // run easier, it just answers a specific pressure (squarely the recurring "too easy" feedback's
  // counter-pressure design). `empResist` lives in perkState (save-safe default 1).
  { id:'surgeprot',rarity:'rare', icon:'🔌', name:'Surge Protector',  desc:'Towers shrug off jamming 3× faster', apply:s=>s.empResist *= 3 },
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
  // Glass Cannon (v1.32.0): a high-risk/high-reward TRADE-OFF — more damage at the cost of
  // reach. Deliberately NOT pure power creep (re: "too easy"): −30% range meaningfully cuts
  // coverage and demands careful placement, so it's a meaningful choice, not a free upgrade.
  { id:'glasscannon',rarity:'legendary',icon:'🔮', name:'Glass Cannon',   desc:'+50% tower damage, but −30% range',        apply:s=>s.glassCannon = true },
  // Wildcard (v1.48.0): a gamble legendary — resolves to a RANDOM legendary effect on pick.
  // Balance-neutral (you'd have taken a legendary anyway) but adds surprise/replay variety;
  // REPEATABLE so it can come up again. Its own apply is a no-op — pickPerk() special-cases it,
  // rolls resolveWildcard(), applies the RESOLVED perk's effect and stores THAT in runPerks (a
  // real perk id), so resume re-applies correctly and the perk row shows what you actually got.
  { id:'wildcard', rarity:'legendary', icon:'🎲', name:'Wildcard',        desc:'Gain a random legendary perk',             apply:()=>{} },
  // Overkill (v1.59.0): a slain enemy DETONATES, splashing 25% of its max HP as
  // armor-ignoring true damage to nearby enemies — a chunky chain-reaction swarm-clear
  // mechanic. Single-layer (the splash never re-detonates, see the `fromOverkill` guard in
  // damage()), so it's bounded — you still must land the killing blow on each "seed" enemy.
  { id:'overkill',rarity:'legendary',icon:'💢', name:'Overkill',         desc:'Slain enemies detonate (25% max-HP splash)', apply:s=>s.overkill = true },
  // Reaper (v1.65.0): an EXECUTE mechanic — any non-boss enemy dropped below 12% of its max HP
  // by a tower hit is instantly slain, skipping the long tail of each kill. Deliberately
  // bounded & "too easy"-safe: bosses (the real difficulty axis) are exempt, and it only
  // shaves the last sliver of HP off trash, so it's a modest, chunky DPS boost (well below
  // Diamond Core's flat +30%) that FEELS great on a weakened swarm. Implemented in damage()'s
  // kill path (not effDmg) so the upgrade panel doesn't churn; routes through the normal death
  // path so combo/bounty/Overkill all fire. The Wildcard perk can roll it.
  { id:'reaper',  rarity:'legendary',icon:'💀', name:'Reaper',           desc:'Instantly slay non-boss enemies below 12% HP', apply:s=>s.reaper = true },
  // Hair Trigger (v1.68.0): a build-altering TRADE-OFF and the inverse sibling of Glass Cannon —
  // towers fire much faster but hit softer (+55% fire rate, −25% damage per shot). Net DPS is only
  // ~+16% (1.55 × 0.75), so it's NOT pure power creep (re: "too easy"): the smaller per-shot damage
  // is eaten harder by flat ARMOR (worse vs armored/shield/late bosses) and the speed-up favours
  // splash/rapid towers while blunting slow heavy hitters (cannon/sniper/mortar lose their burst).
  // A genuine choice, not a free upgrade. Wired in effDmg (×0.75) + effRate (÷1.55); both are hashed
  // by upgradeKey() so the panel live-updates. `resolveWildcard()` can roll it.
  { id:'hairtrigger',rarity:'legendary',icon:'⏱️', name:'Hair Trigger',   desc:'+55% fire rate, but −25% damage per shot', apply:s=>s.hairTrigger = true },
  // Killing Spree (v1.73.0): the FIRST perk to tie into the kill-combo meter (until now a purely
  // cosmetic system). While a combo is hot, ALL towers hit harder, scaling +1% damage per combo,
  // capped +25% at a 25× streak (see comboDmgMult() in cd-state.js). Conditional & self-limiting —
  // the 2s combo window means a stalled or leaking run gets nothing, so it's strictly weaker than
  // the unconditional Diamond Core (+30%) and is NOT power creep (re: the recurring "too easy"
  // feedback); it rewards skilful chaining and makes your damage spike exactly when you're already
  // clearing. Applied in the FIRE path (not effDmg) so the upgrade panel doesn't churn every kill
  // (mirrors Reaper), and before the projectile branch so it covers tesla chain & poison too.
  // `comboPower` lives in perkState (save-safe default false); the Wildcard perk can roll it.
  { id:'spree',   rarity:'legendary',icon:'🔥', name:'Killing Spree',     desc:'+1% damage per combo while your streak is hot (max +25%)', apply:s=>s.comboPower = true },
  // Eagle Eye (v2.3.0): the LEGENDARY capstone of the range/coverage progression axis, completing
  // the tier above the 🔭 Targeting Array rare perk (+20%) and the 🔭 Farsight meta talent (+10% at
  // max). +40% firing range to all towers — it reuses the SAME `rangeMult` field (so no new perkState
  // field; maximally save-safe) and is applied in effRange ONLY, never effBuffRange (booster auras), the
  // same firing-range boundary Targeting Array / Glass Cannon respect. Range is the game's gentlest
  // power lever (per CLAUDE.md it helps you HIT, not hit harder), so it's "too easy"-safe; and it's a
  // genuine BUILD axis, not a flat Diamond-Core dupe — it enables a sparse, wide-coverage layout (fewer
  // towers reaching more of the path) and directly counters the coverage-pressure content (breachers'
  // 3-life leaks, fog, cloak). Stacks multiplicatively with Targeting Array (→ ×1.68), bounded. The
  // legendary-only resolveWildcard() rolls it automatically; upgradeKey() already hashes effRange so the
  // upgrade panel live-updates the moment it lands.
  { id:'eagleeye', rarity:'legendary',icon:'🦅', name:'Eagle Eye',          desc:'All towers +40% range', apply:s=>s.rangeMult *= 1.4 },
];
const RARITY_LABEL = { common:'COMMON', rare:'◆ RARE', legendary:'★ LEGENDARY' };
let perkState, runPerks, draftOpen = false;
function freshPerkState() {
  return { typeDmg:{}, rateMult:1, bountyAdd:0, slowBonus:0, splashMult:1, chainExtra:0, poisonDur:3,
    critChance:0, costMult:1, dmgMult:1, slowGlobal:1, waveBonusMult:1, sellBonus:0, midas:0,
    orbital:false, meteorMult:1, meteorCdMult:1, bossDmg:1, lastStand:false, livesLost:0,
    glassCannon:false, overkill:false, reaper:false, hairTrigger:false, comboPower:false, rangeMult:1,
    ambush:false, abilityCdMult:1, empResist:1 };
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
// Pick a random legendary effect for the Wildcard perk (v1.48.0). Prefers an un-taken
// legendary (excluding wildcard itself; REPEATABLE legendaries stay eligible); if every
// legendary is already held it falls back to ANY eligible perk so a Wildcard is never a dud.
function resolveWildcard() {
  const taken = new Set(runPerks.map(p => p.id));
  const eligible = p => p.id !== 'wildcard' && (!taken.has(p.id) || REPEATABLE.includes(p.id));
  let pool = PERKS.filter(p => p.rarity === 'legendary' && eligible(p));
  if (!pool.length) pool = PERKS.filter(eligible);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
function pickPerk(p) {
  if (p.id === 'wildcard') {
    const g = resolveWildcard();
    if (g) {
      g.apply(perkState);
      runPerks.push({id: g.id, icon: g.icon, name: g.name, rarity: g.rarity});
      addFloater(W/2, 120, `🎲 → ${g.icon} ${g.name}!`, '#ffd866', 20);
    }
  } else {
    p.apply(perkState);
    runPerks.push({id: p.id, icon: p.icon, name: p.name, rarity: p.rarity});
  }
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

