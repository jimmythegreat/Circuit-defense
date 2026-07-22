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
  // Aegis (v2.6.0): the first META upgrade to the 🛡️ Barrier ability — +1 banked leak-block per
  // rank (3 base → up to 5). Surge/Capacitor already shorten ability cooldowns, so charges is the
  // distinct Barrier lever. Purely DEFENSIVE (Barrier vaporizes a leak for zero lives, pays no
  // bounty, and only matters when you're about to lose lives), so it can't power-creep the recurring
  // "too easy" feedback — it just deepens the panic-wall vs leak-pressure content (Breacher / Breacher
  // Surge / boss leaks). Save-safe: loadMeta auto-migrates the new key to 0 for old saves.
  aegis:      { sect:'CORE', name:'Aegis',       icon:'🧱', max:2,  cost: r => 14 + r*12,  desc: r => `Barrier +${r} charge${r === 1 ? '' : 's'}` },
  // Rampart (v2.46.0): the SECOND Barrier-ability meta upgrade and its distinct COOLDOWN lever
  // (Aegis raises charges; the ⚡ Surge talent already shortens ALL ability cooldowns, so a
  // Barrier-only cooldown talent is a fresh, distinct axis). −10%/rank → up to −30% off the
  // Barrier recharge, applied via barrierCdMult() ONLY to abilityCd.barrier. Purely DEFENSIVE
  // (Barrier vaporizes a leak for zero lives + no bounty, only matters when about to lose lives),
  // so it can't power-creep the "too easy" feedback — it just gives the panic wall more uptime vs
  // leak-pressure content. Save-safe: loadMeta auto-migrates the new key to 0 for old saves.
  rampart:    { sect:'CORE', name:'Rampart',     icon:'🏯', max:3,  cost: r => 12 + r*10,  desc: r => `Barrier recharges ${10*r}% faster` },
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
  mastery_laser:  { sect:'TOWER MASTERY', name:'Laser Mastery',  icon:'🔆', max:5, cost: r => 8 + r*8, desc: r => `Lasers +${6*r}% dmg, +${2*r}% range` },
  mastery_pulsar: { sect:'TOWER MASTERY', name:'Pulsar Mastery', icon:'💫', max:5, cost: r => 8 + r*8, desc: r => `Pulsars +${6*r}% dmg, +${2*r}% radius` },
  mastery_arc:    { sect:'TOWER MASTERY', name:'Arc Mastery',    icon:'⚛️', max:5, cost: r => 8 + r*8, desc: r => `Arcs +${6*r}% dmg, +${2*r}% range` },
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
  if (typeof meta.stats.towerKills !== 'number') meta.stats.towerKills = 0; // lifetime tower kills (v2.19.0)
}
const maxTowerLevel = () => 5 + tRank('overdrive');
function saveMeta() { localStorage.setItem('cd_meta', JSON.stringify(meta)); }
function tRank(k) { return meta.talents[k] || 0; }
function metaDmgMult() { return 1 + 0.03 * tRank('firepower'); }
function metaCostMult() { return 1 - 0.03 * tRank('engineering'); }
function metaCdMult() { return 1 - 0.06 * tRank('surge'); }
function metaRangeMult() { return 1 + 0.02 * tRank('farsight'); }
function barrierMax() { return BARRIER_CHARGES + tRank('aegis'); }  // 🧱 Aegis: +1 leak-block/rank (v2.6.0)
function barrierCdMult() { return 1 - 0.1 * tRank('rampart'); }  // 🏯 Rampart: −10% Barrier cooldown/rank (v2.46.0)
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
  laser:  { name:'Laser',  icon:'🔆', cost:165, range:175, dmg:6,   rate:0.45, color:'#ff5db1', proj:'beam',   desc:'Beam ramps on a held target', tip:'Fires a continuous beam that RAMPS UP its damage the longer it stays locked on the SAME target (up to ×2.2) — a sustained boss/tank melter. The charge resets to ×1 the instant the target dies or it switches, so it is deliberately POOR against swarms (the inverse of an area tower). Respects armor.' },
  pulsar: { name:'Pulsar', icon:'💫', cost:120, range:90,  dmg:10,  rate:0.8,  color:'#b15dff', proj:'nova',   desc:'Radial pulse · hits all nearby', tip:'Emits a radial energy PULSE that hits EVERY enemy within its short range at once — no aiming, no projectile. A dedicated SWARM tool: total damage scales with how many foes are packed inside it, but its per-hit damage is among the lowest in the game, so it is deliberately POOR against single tanks/bosses (the inverse of the Laser). Short range and respects armor — place it on a chokepoint where the crowd bunches up.' },
  arc:    { name:'Arc',    icon:'⚛️', cost:140, range:125, dmg:9,   rate:0.9,  color:'#b8e34b', proj:'ricochet', desc:'Bolt ricochets between foes', tip:'Fires a TRAVELLING energy bolt that ricochets to the nearest fresh enemy after each strike — up to 5 hits per bolt, leaping much farther between targets than a Tesla chain (a spread-swarm sweeper vs Tesla\'s tight-cluster zap). Damage fades a little with each hop and each foe is struck once per bolt, so it is deliberately WEAK against single tanks/bosses. Respects armor.' },
};
const TYPE_KEYS = Object.keys(TOWER_TYPES);
const MODES = ['first', 'last', 'strong', 'close', 'weak', 'support', 'fastest', 'boss', 'cluster'];
const MODE_ICON = { first:'⏩ First', last:'⏪ Last', strong:'💪 Strong', close:'📍 Close', weak:'🩸 Weak', support:'🛡 Support', fastest:'🏎 Fastest', boss:'👑 Boss', cluster:'💠 Cluster' };
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
  laser:  [ {id:'focus',   name:'Focusing Array',desc:'+35% damage'},             {id:'rapidcoil',name:'Pulse Drive',  desc:'Fire rate ×1.4 (ramps faster)'} ],
  pulsar: [ {id:'pulsepower',name:'Overload',    desc:'+40% damage'},             {id:'pulsewide',name:'Resonance',    desc:'+30% pulse radius'} ],
  // Arc (v2.52.0): both specs deepen the ricochet geometry rather than cloning Tesla's
  // falloff pair — MORE hops (swarm depth) vs LONGER hops (spread reach). Wired in the
  // projectile-push branch in cd-update.js (hops / seek), not effDmg.
  arc:    [ {id:'arcbounce', name:'Ball Lightning', desc:'+2 ricochets (7 hits per bolt)'}, {id:'arcseek', name:'Magnet Coil', desc:'Ricochet seek range +60%'} ],
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
// Rank colour for a tower's barrel tint (v2.21.0, cosmetic veterancy follow-up): the rank
// colour for a veteran+ tower, else null (Rookie / buff towers — buff towers never rank). Used
// by draw() to tint the barrel so an elite/legend tower reads as battle-hardened at a glance.
function towerBarrelTint(t) {
  if (!t || t.type === 'buff') return null;
  const tier = towerRankTier(t.kills);
  return tier > 0 ? TOWER_RANKS[tier].color : null;
}

// ================= Abilities =================
const ABILITIES = {
  meteor: { name:'Meteor',    icon:'☄️', key:'Q', cd:30, desc:'Click map: massive AoE damage' },
  freeze: { name:'Time Freeze',icon:'🧊', key:'W', cd:45, desc:'Freeze ALL enemies for 4s' },
  rush:   { name:'Gold Rush', icon:'💰', key:'E', cd:60, desc:'Instant gold injection' },
  shock:  { name:'Shockwave', icon:'🌀', key:'R', cd:50, desc:'Blast ALL enemies backward along the path' },
  barrier:{ name:'Barrier',   icon:'🛡️', key:'T', cd:60, desc:'Vaporize the next 3 enemies that reach the exit — no lives lost' },
  amp:    { name:'Amplify',   icon:'📣', key:'Y', cd:55, desc:'All towers +30% damage & fire rate for 5s' },
};
const BARRIER_CHARGES = 3;   // leak-blocks granted per Barrier cast (v1.93.0)
const BARRIER_DURATION = 20;  // seconds unused barrier charges last before fading (v1.100.1)
const PHOENIX_LIVES = 12;     // lives restored when 🌅 Phoenix cheats death once per run (v2.15.0)
const OVERDRIVE_DUR = 5;      // seconds the 📣 Amplify tower-overdrive buff lasts (v2.48.0)
const OVERDRIVE_MULT = 1.30;  // Amplify: ×dmg and ÷reload while overdriveT>0 (+30% dmg & fire rate)
let abilityCd = { meteor: 0, freeze: 0, rush: 0, shock: 0, barrier: 0, amp: 0 };
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
    const freezeDur = 4 * perkState.abilityPower;   // 🎛️ Empowered Arsenal (v2.49.0)
    for (const e of enemies) e.frozen = freezeDur;
    // Absolute Zero (v2.44.0): track the most enemies caught by one Freeze cast (feat at 12+).
    bestFreeze = Math.max(bestFreeze, enemies.filter(e => !e.dead).length);
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
      const kb = (e.kind === 'boss' ? 28 : 75) * perkState.abilityPower;   // 🎛️ Empowered Arsenal (v2.49.0)
      e.dist = Math.max(0, e.dist - kb);
      e.frozen = Math.max(e.frozen, 0.35);   // brief stagger
      e.flash = 0.2;
    }
    addFloater(W/2, H/2, '🌀 SHOCKWAVE', '#b392ff', 26);
    addExplosion(W/2, H/2, '#b392ff', 30, 240);
    addExplosion(W/2, H/2, '#7d5cff', 18, 150);
    addRing(W/2, H/2, '#b392ff', 320, {life: 0.55, w: 6});   // outward kinetic pulse
    addRing(W/2, H/2, '#c9b8ff', 210, {life: 0.4,  w: 3});
    shake = Math.max(shake, 14);
    SFX.shock();
  }
  if (k === 'barrier') {
    // Barrier (v1.93.0): bank a few leak-blocks — the next enemies that reach the exit
    // are vaporized for zero lives (consumed at the leak site in cd-update.js). Purely
    // DEFENSIVE: it pays no bounty and only matters when you're about to leak, so it can't
    // power-creep the "too easy" feedback — a panic wall vs an overwhelming wave / boss leak,
    // countering the leak-pressure content (Breacher / Breacher Surge).
    abilityCd.barrier = ABILITIES.barrier.cd * metaCdMult() * perkState.abilityCdMult * barrierCdMult();  // 🏯 Rampart shortens it (v2.46.0)
    abilityUsedThisRun = true;
    const charges = barrierMax();   // 🧱 Aegis talent adds +1 charge/rank (v2.6.0)
    barrierCharges = charges;
    barrierTimer = BARRIER_DURATION;   // charges fade after this many seconds (v1.100.1)
    addFloater(W/2, H/2, `🛡️ BARRIER ×${charges}`, '#58e0ff', 26);
    addExplosion(W/2, H/2, '#58e0ff', 22, 160);
    SFX.barrier();
  }
  if (k === 'amp') {
    // Amplify (v2.48.0): the first OFFENSIVE-BUFF ability — a short window where every tower
    // hits +30% harder AND reloads +30% faster (read by effDmg/effRate via the run-only
    // `overdriveT` timer, decayed in update()). A fresh axis: the other five abilities are
    // damage/CC/economy/knockback/defense — none temporarily buffs the towers themselves.
    // Deliberately bounded/"too easy"-safe: it's a 5s burst on a 55s cooldown (~8% uptime of
    // ~+69% DPS → only ~+6% average board DPS, below a single Diamond Core), so it enables a
    // burst-timing playstyle (drop it on a boss/overwhelming wave) rather than raw power creep.
    abilityCd.amp = ABILITIES.amp.cd * metaCdMult() * perkState.abilityCdMult;
    abilityUsedThisRun = true;
    overdriveT = OVERDRIVE_DUR;
    addFloater(W/2, H/2, '📣 AMPLIFY', '#ffd866', 26);
    addExplosion(W/2, H/2, '#ffd866', 22, 180);
    addRing(W/2, H/2, '#ffd866', 300, {life: 0.5, w: 5});
    shake = Math.max(shake, 8);
    SFX.amp();
  }
  // Full House (v2.45.0): track which ability TYPES were actually cast this run (freeze/rush/shock/
  // barrier reach here only on a successful cast — rush's pre-wave block early-returns above; meteor
  // arms and returns without reaching here, so it's tracked in castMeteor instead). Run-only Set,
  // never saved — the feat is re-earnable like bestFreeze, no force-on-load.
  abilitiesCastThisRun.add(k);
  refreshAbilityBar();
}
function castMeteor(x, y) {
  abilityCd.meteor = ABILITIES.meteor.cd * metaCdMult() * perkState.meteorCdMult * perkState.abilityCdMult;
  armedAbility = null;
  abilityUsedThisRun = true;
  abilitiesCastThisRun.add('meteor');   // Full House (v2.45.0): count the actual meteor cast, not the arm
  const dmg = (120 + wave * 14) * perkState.meteorMult * perkState.abilityPower;   // 🎛️ Empowered Arsenal (v2.49.0)
  shake = Math.max(shake, 18);
  SFX.meteor();
  addExplosion(x, y, '#ff7b42', 40, 260);
  addExplosion(x, y, '#ffd866', 24, 160);
  addRing(x, y, '#ff7b42', 150, {life: 0.45, w: 5});   // impact shock ring
  const killsBefore = kills;   // 💥 Carpet Bomb feat: count how many this single blast slays (v2.48.0)
  for (const e of enemies) {
    if (e.x === undefined || e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) < 95) damage(e, dmg, null);
  }
  meteorBestKills = Math.max(meteorBestKills, kills - killsBefore);
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
  // perk touched (Singularity is meteor-ONLY; the ⚡ Surge talent's metaCdMult is a meta
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
  // Shaped Charges (v2.8.0): the perk pool's counter to the ⬢ Bastion's blast-shell. The Bastion
  // (v1.90.0, regular enemy w14+ AND the Bastion Surge mayhem mod) carries aoeResist:true, which
  // halves the damage it takes from the two EXPLOSIVE splash towers (the Cannon bomb + the Mortar
  // shell). This perk pierces that shell, so explosive towers deal those enemies FULL splash again.
  // A fresh COUNTER-CONTENT axis (the sibling of Surge Protector vs jammers) and a meaningful
  // situational pick — it does nothing in a run with no Bastion content. Wired as one extra term at
  // the two splash sites in hitEnemy() (`e.aoeResist && !perkState.aoePen`); single-target fire,
  // tesla chain and the Overkill detonation were never resisted, so they're untouched. Deliberately
  // "too easy"-safe: it removes a specific resistance rather than adding raw DPS/range/economy (a
  // bombardment build still pays full price vs every other enemy), so it can't make a run easier —
  // it just keeps the AoE strategy viable against the content built to check it. `aoePen` lives in
  // perkState (save-safe default false); a RARE, so the legendary-only resolveWildcard() skips it.
  { id:'shaped',  rarity:'rare', icon:'💣', name:'Shaped Charges',   desc:'Explosive towers pierce ⬢ Bastion blast-shells', apply:s=>s.aoePen = true },
  // Hardened Circuits (v2.40.0; extended v2.53.0): the perk pool's counter to the deep-Endless bosses
  // that DAMPEN your defenses — the 🔵 Suppressor (v2.16.0, a fire-rate aura → +25% reload via
  // t.suppressed in effRate), the 🔮 Distorter (v2.30.0, a range aura → ×0.8 range via t.distorted in
  // effRange) and the 🚫 Nullifier (v2.53.0, a damage aura → ×0.75 dmg via t.dampened in effDmg).
  // It makes towers IMMUNE to all three: each `eff*` factor is gated on `!perkState.auraImmune`,
  // so a tower keeps its full fire rate, range and damage even while standing in the boss's field. A fresh
  // COUNTER-CONTENT axis (the sibling of 🔌 Surge Protector vs jamming and 💣 Shaped Charges vs the
  // Bastion shell) and a meaningful situational pick — it does nothing in a run without those bosses
  // (both first appear deep in Endless, w95/w105). Deliberately "too easy"-safe: it adds ZERO
  // damage/range/economy of its own (range/rate can never exceed a tower's baseline) — it only
  // removes a debuff, so it can't make a run easier, it just keeps your line firing where those
  // bosses walk. `auraImmune` lives in perkState (save-safe default false; round-trips via loadRun's
  // Object.assign(freshPerkState(), s.perkState) — old saves default false). A RARE, so the
  // legendary-only resolveWildcard() skips it. upgradeKey() hashes effRate/effRange so the panel
  // live-updates. Test group [158].
  { id:'hardened',rarity:'rare', icon:'🔰', name:'Hardened Circuits', desc:'Towers ignore boss fire-rate, range & damage dampening auras', apply:s=>s.auraImmune = true },
  // Spectral Sight (v2.41.0): the perk pool's counter to the whole INTANGIBILITY axis — the 👻 phantom
  // enemy, the 🫥 Cloaking Field mod, the ✦ Teleporter boss, and the 🫥 Veil boss's cohort-cloak all
  // use the same `blinkInvuln` "briefly untargetable + immune" window. This makes your towers see
  // through it: the four intangibility gates (pickTarget skip, fireRail/firePulse skip, and damage()'s
  // early-return) are gated on `!perkState.phaseSight`, so towers can target AND hit a phasing enemy.
  // A fresh COUNTER-CONTENT axis (the sibling of 🔌 Surge Protector, 💣 Shaped Charges, 🔰 Hardened
  // Circuits) and a meaningful situational pick — it does nothing in a run without phasing enemies.
  // Deliberately "too easy"-safe: it adds ZERO damage/range/economy — it only removes an evasion
  // window, so it can't make a run easier, it just keeps blinkers honest. `phaseSight` lives in
  // perkState (save-safe default false; round-trips via loadRun's Object.assign(freshPerkState(),
  // s.perkState) — old saves default false). A RARE, so the legendary-only resolveWildcard() skips
  // it. Test group [161].
  { id:'phaselock',rarity:'rare', icon:'👁️', name:'Spectral Sight',    desc:'Towers can target & hit cloaked / blinking enemies', apply:s=>s.phaseSight = true },
  // Empowered Arsenal (rare, v2.49.0): the perk pool's first ABILITY-POWER (magnitude) boost — a fresh
  // axis distinct from 🔋 Capacitor (cooldown) and 🕳️ Singularity (meteor-ONLY). It scales the EFFECT
  // of your three combat abilities by +40%: bigger ☄️ Meteor blast damage, longer 🧊 Time Freeze, and a
  // stronger 🌀 Shockwave knockback. Makes an ability-focused build a real pillar (more defensive
  // uptime + a harder meteor) rather than raw board DPS. Deliberately "too easy"-safe: two of the three
  // (Freeze/Shockwave) deal NO damage — it enables a PLAYSTYLE, and the one offensive boost (Meteor) is
  // a burst on a 30s cooldown, so it's bounded. Wired via perkState.abilityPower (default 1) at the
  // three cast sites in cd-defs.js (castMeteor dmg / freeze duration / shock knockback). `abilityPower`
  // lives in perkState (save-safe default 1; round-trips via loadRun's Object.assign(freshPerkState(),
  // s.perkState) — old saves default 1; ability cooldowns/effects are run-only so nothing else migrates).
  // A RARE, so the legendary-only resolveWildcard() skips it. Test group [185].
  { id:'arsenal_pw',rarity:'rare', icon:'🎛️', name:'Empowered Arsenal', desc:'Meteor, Time Freeze & Shockwave effects +40%', apply:s=>s.abilityPower *= 1.4 },
  // Corrosive Rounds (rare, v2.50.0): a fresh SYNERGY axis — +30% damage to any enemy currently
  // poisoned (has an active `poison` DoT on it). Rewards a poison-anchored build: a Poison tower
  // softens the target (DoT + −3 armor corrosion) and every other tower then hits it 30% harder.
  // Deliberately buffs the historically WEAKER Poison archetype (buffed as underpowered v1.10.0),
  // so it's the "too easy"-safe DIRECTION — and it's conditional (does nothing until a Poison tower
  // has tagged the target), in the same modest bracket as Ambush (+30% vs >80% HP) / Finisher
  // (+35% vs <40% HP). Keyed to the primary target's live poison state → implemented in the FIRE
  // path (cd-update.js), not effDmg (no upgrade-panel churn); applied before the proj branch so
  // chain/rail/poison shots benefit too. `corrosive` lives in perkState (save-safe default false;
  // round-trips via loadRun's Object.assign(freshPerkState(), s.perkState) — old saves default
  // false). A RARE, so the legendary-only resolveWildcard() skips it. Test group [188].
  { id:'corrosive',rarity:'rare', icon:'🧪', name:'Corrosive Rounds',   desc:'+30% damage to poisoned enemies', apply:s=>s.corrosive = true },
  // Swarmbane (rare, v2.51.0): a fresh CROWD-PRESSURE axis — every tower deals +1% damage per LIVE
  // enemy on the field, capped +25% at 25 enemies. It's the mirror of 🏛️ Phalanx (which scales with
  // YOUR towers): Swarmbane scales with the THREAT, so it's worth the most exactly when the board is
  // swamped and worth nothing when it's clear — a soft comeback/anti-swarm reward that self-corrects
  // (you get the boost when overrun, not when comfortably ahead). Deliberately "too easy"-safe: it's
  // CONDITIONAL on being crowded and CAPPED at +25% (below the unconditional Diamond Core +30%), and
  // it does NOT feed any watched snowball (it's independent of Frost/booster). Keyed to the live
  // enemies.length in the FIRE path (cd-update.js), not effDmg (no upgrade-panel churn); applied
  // before the proj branch so chain/rail/poison shots benefit too. `swarmbane` lives in perkState
  // (save-safe default false; round-trips via loadRun's Object.assign(freshPerkState(), s.perkState)
  // — old saves default false). A RARE, so the legendary-only resolveWildcard() skips it. Test [191].
  { id:'swarmbane',rarity:'rare', icon:'🐝', name:'Swarmbane',          desc:'+1% tower damage per live enemy (max +25%)', apply:s=>s.swarmbane = true },
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
  // Veteran's Edge (v2.13.0): the FIRST perk to give the cosmetic tower-veterancy system (v1.100.0 —
  // kill-milestone ranks Rookie→Veteran→Elite→Ace→Legend) mechanical weight. Each tower deals +5%
  // damage per veteran tier it has earned, so a battle-hardened front-liner (Legend = 200 kills) hits
  // +20%, while a freshly-placed tower gets +0%. A fresh BUILD axis — it rewards keeping a few elite
  // towers alive and well-positioned (a "veteran core" playstyle) rather than churning the board.
  // Deliberately "too easy"-safe: it's back-loaded and CONDITIONAL (worth nothing until your towers
  // rack up kills) and CAPPED at +20% — strictly below the unconditional Diamond Core (+30% flat),
  // which is the better early pick — so it's a meaningful draft choice, not power creep. Wired in
  // effDmg via towerRankTier(t.kills); upgradeKey() already hashes that tier (not raw kills), so the
  // panel only churns on a promotion, never every kill. `veteranBonus` lives in perkState (save-safe
  // default false; t.kills already persists, so resumed towers keep their earned bonus). The
  // legendary-only resolveWildcard() rolls it automatically.
  { id:'veteran', rarity:'legendary',icon:'🎖️', name:"Veteran's Edge",     desc:'+5% damage per tower veteran rank (max +20%)', apply:s=>s.veteranBonus = true },
  // Phoenix (v2.15.0): the FIRST player-revival mechanic — a once-per-run death-cheat. When a leak
  // would drop you to 0 lives, instead of game-over you revive at PHOENIX_LIVES (12) and the surge
  // hurls the WHOLE field back to the path start (every enemy's progress resets to 0), buying a full
  // lap of breathing room. Latches via perkState.phoenixUsed so it fires EXACTLY once per run.
  // Deliberately "too easy"-safe (the Last Stand rationale): it only ever triggers when you're already
  // losing, so a run you'd win never hits 0 lives and Phoenix does nothing — it can only soften a loss,
  // never make a winning run easier. Pays NO bounty / kills nothing (pure knockback + lives), so zero
  // economy impact. Both fields live in perkState (persisted whole; defaults false → save-safe; if you
  // save AFTER using it, phoenixUsed=true round-trips so it can't re-trigger on resume). The
  // legendary-only resolveWildcard() rolls it automatically. Implemented at the single leak site in
  // cd-update.js. Test group [125].
  { id:'phoenix', rarity:'legendary',icon:'🌅', name:'Phoenix',            desc:'Cheat death once: revive at 12 lives & hurl the field back to the start', apply:s=>s.phoenix = true },
  // Critical Mass (v2.20.0): the FIRST perk to amplify crit DAMAGE (the multiplier), a fresh axis —
  // the 🍀 Crit Systems rare perk and the 🔬 Crit Lab talent only raise crit CHANCE, and the per-crit
  // multiplier was fixed (×2.5, or ×4 on a Deadeye sniper). Critical Mass adds +10% crit chance AND
  // makes every crit hit ×1.5 HARDER (a normal crit → ×3.75, a Deadeye crit → ×6). A build-defining
  // SYNERGY legendary, not a flat board buff: without crit-chance investment (Crit Lab / Crit Systems /
  // Deadeye) the ×1.5 fires rarely, so it rewards a dedicated crit build and stays "too easy"-safe — its
  // value is conditional + probabilistic (like Killing Spree's combo gating), well below the
  // unconditional Diamond Core (+30%) on a generic board. Chunky game-feel: bigger gold CRIT! numbers +
  // the crit SFX land harder. Applied in the FIRE path's crit branch (not effDmg, so the upgrade panel
  // doesn't churn). `critMult` lives in perkState (save-safe default 1; round-trips via loadRun's
  // Object.assign(freshPerkState(), s.perkState) — old saves default 1). The legendary-only
  // resolveWildcard() rolls it automatically. Test group [130].
  { id:'critmass', rarity:'legendary',icon:'🎯', name:'Critical Mass',     desc:'+10% crit chance; crits hit ×1.5 harder', apply:s=>{ s.critChance += 0.10; s.critMult *= 1.5; } },
  // Retaliation (rare, v2.39.0): a COMEBACK perk on a fresh axis — for a few seconds after an enemy
  // LEAKS (you lose a life), every tower deals +25% damage. It can ONLY trigger when you're being
  // overrun, so a clean run gets nothing → "too easy"-safe by the Last Stand / Phoenix rationale (it
  // softens a near-loss, never makes a winning run easier). Distinct from Last Stand (which scales
  // PERMANENTLY with total lives lost): this is a short, repeating BURST armed by each fresh leak.
  // Implemented in the FIRE path (a transient timer `retaliateT`, decayed in update()) like Ambush /
  // Killing Spree — NOT effDmg, so the upgrade panel doesn't churn. Both fields live in perkState
  // (save-safe defaults; round-trip via loadRun's Object.assign(freshPerkState(), s.perkState) — old
  // saves default false/0). A RARE, so the legendary-only resolveWildcard() does NOT roll it. Test [154].
  { id:'retaliation', rarity:'rare', icon:'🗯️', name:'Retaliation',        desc:'After a leak: +25% tower damage for 4s', apply:s=>s.retaliation = true },
  // Aftershock (rare, v2.56.0): the DEFENSIVE sibling of 🗯️ Retaliation on the leak axis — when an
  // enemy LEAKS (you lose a life), every remaining enemy is knocked backward along the path (a free,
  // automatic mini-Shockwave). Pure repositioning: it deals NO damage and pays NO bounty, and it can
  // ONLY fire when you're being overrun, so a clean run gets nothing → "too easy"-safe by the Last
  // Stand / Retaliation / Phoenix rationale (it buys a couple seconds to recover, never makes a
  // winning run easier). Distinct from the comeback siblings by EFFECT — Last Stand/Retaliation buff
  // damage, Phoenix revives, Second Wind heals; Aftershock REPOSITIONS. Reuses the 🌀 Shockwave
  // knockback (softer: 40px, boss 18px) and respects CC-immune / juggernaut enemies exactly like the
  // ability, wired at the single leak site in cd-update.js. `aftershock` lives in perkState (save-safe
  // default false; round-trips via loadRun's Object.assign(freshPerkState(), s.perkState) — old saves
  // default false). A RARE, so the legendary-only resolveWildcard() does NOT roll it. Test group [205].
  { id:'aftershock', rarity:'rare', icon:'🌊', name:'Aftershock',          desc:'When an enemy leaks, knock the whole field backward', apply:s=>s.aftershock = true },
  // Phalanx (rare, v2.42.0): a "wide-build" damage perk on a fresh axis — every tower deals +2%
  // damage per tower on the board (capped +20% at 10 towers). It rewards a broad, well-spread
  // defensive line (the inverse of 🔮 Glass Cannon's few-heavy-hitters trade-off and ⚖️ Minimalist),
  // so it's a genuine BUILD choice, not a flat board buff. Deliberately "too easy"-safe: it's
  // CONDITIONAL on a real investment (a full +20% needs ten towers, which spreads your gold thin and
  // demands the coverage to earn it) and CAPPED at +20% — strictly below the unconditional Diamond
  // Core (+30% flat, the better pick for a concentrated build). Wired in effDmg via towers.length
  // (upgradeKey() hashes effDmg, so the panel live-updates as you place/sell towers). `phalanx` lives
  // in perkState (save-safe default false; round-trips via loadRun's Object.assign(freshPerkState(),
  // s.perkState) — old saves default false). A RARE, so the legendary-only resolveWildcard() skips it.
  { id:'phalanx', rarity:'rare', icon:'🏛️', name:'Phalanx',              desc:'+2% tower damage per tower on the board (max +20%)', apply:s=>s.phalanx = true },
  // Finisher (rare, v2.43.0): the CLOSER counterpart to the 🏹 Ambush rare (which adds +30% to
  // enemies still above 80% HP). Finisher adds +35% damage to enemies already below 40% HP — a
  // clean bookend with Ambush on the fresh current-HP-fraction axis. Distinct from 💀 Reaper
  // (which EXECUTES non-boss enemies below 12% HP): this is a damage BOOST that helps you close
  // out wounded tanks/bosses too (it applies to any kind, unlike Reaper's non-boss-only execute).
  // Deliberately "too easy"-safe: it's CONDITIONAL (only wounded enemies qualify; the tanky top
  // 60% of every enemy's HP is unaffected, so it never helps you START killing something), which
  // makes it strictly narrower than a flat +35% buff — a modest rare, not power creep. Applied in
  // the FIRE path (keyed to the primary target's current HP, like Ambush/Killing Spree — can't live
  // in effDmg), before the proj branch so chain/rail/poison finishing shots benefit too. `finisher`
  // lives in perkState (save-safe default false). A RARE, so the legendary-only resolveWildcard() skips it.
  { id:'finisher', rarity:'rare', icon:'🔪', name:'Finisher',            desc:'+35% damage to enemies below 40% HP', apply:s=>s.finisher = true },
  // Point Blank (rare, v2.45.0): a fresh POSITIONAL damage axis — every other damage perk keys off
  // enemy HP (Ambush/Finisher), tower type (Sharpshooter/Heavy Rounds) or is flat (Overcharge). This
  // adds +25% damage to any enemy within HALF a tower's effective range, rewarding tight placement
  // right on the path (the natural partner of the 📍 Close targeting mode). Applied in the FIRE path,
  // keyed to the primary target's distance vs effRange(t) (can't live in effDmg, like Ambush/Finisher);
  // the effRange call is gated behind the flag so it costs nothing unless held. Deliberately
  // "too easy"-safe: it's CONDITIONAL on proximity — a back-line sniper/mortar peppering the far edge
  // of its range gets +0%, so it's a build/placement choice (cluster close for the bonus, trade coverage)
  // rather than a flat board buff. `pointBlank` lives in perkState (save-safe default false;
  // round-trips via loadRun's Object.assign(freshPerkState(), s.perkState)). A RARE, so the
  // legendary-only resolveWildcard() skips it. Test group [174].
  { id:'pointblank', rarity:'rare', icon:'🎯', name:'Point Blank',        desc:'+25% damage to enemies within half a tower’s range', apply:s=>s.pointBlank = true },
  // Warpath (legendary, v2.47.0): a fresh SCALING axis — tower damage grows +2% per wave you've
  // reached this run, capped +40% (at wave 20). A "scale into the late game" pick: drafted early it
  // starts weak (+10% at wave 5), CROSSES the flat 💎 Diamond Core (+30%) around wave 15, and edges
  // it out (+40%) deep in a run — so it's a genuine BACK-LOADED trade-off vs an immediate flat buff,
  // NOT a dominated dupe (early it's strictly worse, late it's strictly better). Rewards long runs /
  // Endless, which fits the addictive "get stronger the longer you survive" loop the owner likes.
  // Deliberately "too easy"-safe: it's CAPPED (+40%) and worth little until you've already survived
  // deep, where enemy HP has scaled far harder (the uncapped deep-wave lateScale), so it can't trivialise
  // the early/mid game. Wired in effDmg via the live `wave` global (upgradeKey hashes effDmg, so the
  // panel steps up each wave). `warpath` lives in perkState (save-safe default false; round-trips via
  // loadRun's Object.assign(freshPerkState(), s.perkState) — old saves default false). A legendary, so
  // resolveWildcard() rolls it automatically. Test group [180].
  { id:'warpath',  rarity:'legendary', icon:'🐗', name:'Warpath',          desc:'+2% tower damage per wave reached (max +40%)', apply:s=>s.warpath = true },
  // Overwhelm (legendary, v2.55.0): a fresh BUILD-DIVERSITY axis — tower damage grows +8% per DISTINCT
  // tower type on the board, capped +40% at 5 types. The inverse of 💠 Glass Cannon (few heavy hitters)
  // and 🏛️ Phalanx (many towers of any type): Overwhelm rewards a VARIED board. Non-dominated vs Phalanx —
  // a mono-type spam board (the common optimum) gets only +8% here but +20% from Phalanx, so they favour
  // opposite strategies. To BEAT the flat 💎 Diamond Core (+30%) you need 4+ different tower types, which
  // splits your gold/upgrades across them (each tower weaker than a mono-focused board) — a real trade-off,
  // "too easy"-safe. Reinforces the "every strategy viable" pillar and pairs with 🧠 Polymath / 🎭 Jack of
  // All Trades / 🧰 Full Arsenal. Wired in effDmg via a distinct-type count over `towers` (upgradeKey hashes
  // effDmg, so the panel live-updates as you place/sell types). `overwhelm` lives in perkState (save-safe
  // default false; round-trips via loadRun's Object.assign). A legendary, so resolveWildcard rolls it. [202]
  { id:'overwhelm', rarity:'legendary', icon:'🌈', name:'Overwhelm',        desc:'+8% tower damage per distinct tower type on the board (max +40%)', apply:s=>s.overwhelm = true },
  // 💠 SECOND WIND (v2.54.0) — the pool's first SECRET perk. It stays out of the draft (and out of
  // Wildcard's roll) until the player has earned the 🛡️ Flawless achievement; `secret()` is the gate,
  // read live from meta so it unlocks the moment that badge lands. The first perk to RESTORE lives:
  // clearing a wave gives 1 life back, hard-capped at the run's STARTING life total (`startLives`),
  // so it can never push you above where you began. "Too easy"-safe on the Last Stand / Phoenix
  // rationale: a run you're already winning never lost a life, so it heals nothing — it only softens
  // a run that is bleeding. ONE life per field clear (not per bundled wave — see endWave's note).
  // Additive perkState field (old saves default false).
  { id:'secondwind', rarity:'legendary', icon:'💠', name:'Second Wind',
    desc:'Clearing the field restores 1 life (never above your starting lives)',
    secret: () => !!(meta && meta.achievements && meta.achievements.flawless),
    apply:s=>s.secondWind = true },
];
// A perk is draftable unless it declares a `secret()` unlock gate that is not yet satisfied.
// Used by BOTH the draft pool and resolveWildcard, so a locked perk can never leak in either way.
function perkUnlocked(p) { return !p.secret || !!p.secret(); }
const RARITY_LABEL = { common:'COMMON', rare:'◆ RARE', legendary:'★ LEGENDARY' };
let perkState, runPerks, draftOpen = false;
function freshPerkState() {
  return { typeDmg:{}, rateMult:1, bountyAdd:0, slowBonus:0, splashMult:1, chainExtra:0, poisonDur:3,
    critChance:0, critMult:1, costMult:1, dmgMult:1, slowGlobal:1, waveBonusMult:1, sellBonus:0, midas:0,
    orbital:false, meteorMult:1, meteorCdMult:1, bossDmg:1, lastStand:false, livesLost:0,
    glassCannon:false, overkill:false, reaper:false, hairTrigger:false, comboPower:false, rangeMult:1,
    ambush:false, abilityCdMult:1, empResist:1, aoePen:false, veteranBonus:false,
    phoenix:false, phoenixUsed:false, retaliation:false, retaliateT:0, auraImmune:false,
    phaseSight:false, phalanx:false, finisher:false, pointBlank:false, warpath:false, abilityPower:1,
    corrosive:false, swarmbane:false, secondWind:false, overwhelm:false, aftershock:false };
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
  const avail = PERKS.filter(p => perkUnlocked(p) && (!taken.has(p.id) || REPEATABLE.includes(p.id)));
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
  const eligible = p => p.id !== 'wildcard' && perkUnlocked(p) && (!taken.has(p.id) || REPEATABLE.includes(p.id));
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
  // a11y (v2.56.0): the draft is DOM, but the pick's outcome (and a Wildcard resolve) is canvas-only.
  { const g = (p.id === 'wildcard' && runPerks.length) ? runPerks[runPerks.length - 1] : p;
    announce(`Perk chosen: ${g.name}.`); }
  SFX.perk();
  if (pendingDrafts > 0) pendingDrafts--;
  if (pendingDrafts > 0) { openDraft(); return; }  // rush bundled several drafts — show the next
  if (autoWave) autoStartTimer = 6;
  saveRun();
  updateHud();
}

