'use strict';
// ================= Start screen =================
function renderStartScreen() {
  document.getElementById('chipsBtn').textContent = meta.chips;
  document.getElementById('achBtn').textContent = `${achDone()}/${ACHIEVEMENTS.length}`;
  document.getElementById('verTag').textContent = GAME_VERSION;
  refreshWhatsNewBadge();   // "fresh updates" count pill on ✨ What's New + version-tag dot
  // Daily Challenge button: show today's date + this player's best wave so far today.
  const dBtn = document.getElementById('dailyBtn');
  if (dBtn) {
    const ds = dailyDateString();
    const dbest = +(localStorage.getItem('cd_daily_' + ds) || 0);
    const streak = currentDailyStreak();
    // Today's deterministic flavour preview (difficulty + the distinct wave-mods that will appear).
    const pv = dailyPreview(ds);
    const diffName = DIFFS[pv.diff] ? DIFFS[pv.diff].name : pv.diff;
    const modIcons = pv.modIds.map(id => MOD_BY_ID[id] && MOD_BY_ID[id].icon).filter(Boolean).slice(0, 5).join(' ');
    const tags = (dbest ? `best w${dbest}` : '') + (streak > 1 ? `${dbest ? ' · ' : ''}🔥${streak}d` : '');
    const preview = `${diffName}${modIcons ? ' · ' + modIcons : ''}`;
    dBtn.innerHTML = `🗓 Daily Challenge`
      + ` <small style="opacity:.85">${preview}</small>`
      + (tags ? `<small style="opacity:.6;display:block;font-size:11px">${tags}</small>` : '');
    const modNames = pv.modIds.map(id => MOD_BY_ID[id] && MOD_BY_ID[id].name).filter(Boolean).join(', ');
    dBtn.title = `Today's seeded challenge (${ds}) — ${diffName} difficulty, same map & modifiers for every player today.`
      + (modNames ? ` Modifiers in play: ${modNames}.` : '')
      + ` One-off run; doesn't affect your saved game.`
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
  // Endless (v2.17.0, owner FEEDBACK): a menu-selectable variant of Quick Play that never stops at
  // wave 30 — it banks the win and keeps going. It's gameMode==='quick' + the `endless` flag (NOT a
  // 3rd gameMode), so it shares the map row and all quick-mode scaling; selection keys off `endless`.
  const modes = [
    { id:'quick', name:'Quick Play', desc:'Pick a map, survive 30 waves', endless:false },
    { id:'endless', name:'♾️ Endless', desc:'Same maps — survive as long as you can', endless:true },
    { id:'campaign', name:'🏔️ Campaign', desc:`${campaignDone()}/${CAMPAIGN_LEVELS} levels cleared` },
  ];
  for (const m of modes) {
    const b = document.createElement('button');
    const sel = m.id === 'campaign' ? gameMode === 'campaign'
                                    : (gameMode === 'quick' && !!endless === !!m.endless);
    b.className = 'optBtn' + (sel ? ' sel' : '');
    b.innerHTML = `${m.name}<small>${m.desc}</small>`;
    // v2.0.0 (owner FEEDBACK): clicking into Campaign jumps the selection to the next
    // un-cleared level (the one you'd actually play) instead of leaving it on whatever
    // was last selected. campaignDone()+1, clamped to the final level.
    b.onclick = () => {
      if (m.id === 'campaign') { gameMode = 'campaign'; endless = false; campLevel = Math.min(CAMPAIGN_LEVELS, campaignDone() + 1); }
      else { gameMode = 'quick'; endless = !!m.endless; }
      renderStartScreen();
    };
    modeRow.appendChild(b);
  }
  const mapRow = document.getElementById('mapRow');
  mapRow.innerHTML = '';
  if (gameMode === 'quick') {
    document.getElementById('mapLabel').textContent = endless ? 'MAP — ♾️ Endless: no wave cap, runs until you fall' : 'MAP';
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
  endless = false;       // a daily is a fixed one-off, never endless
  gameMode = 'quick';
  mapKey = 'mayhem';
  setupDaily();          // sets dailyDateKey/dailySeed, diffKey, MAPS.mayhem.pts, dailyMods
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  resetState();          // !daily-guarded so it keeps the seeded path; loads cd_daily_<date> as `best`
  setActiveUI();
  SFX.wave();
}
// Play Again (v1.75.0): one-click replay of the same run from the end-of-run overlay —
// reuses the current gameMode/mapKey/diffKey/campLevel (all still set from the run that just
// ended), so beginGame() restarts an identical fresh run with no trip back to the menu. Hidden
// for the Daily Challenge (one-off, deterministic per date — replaying the same seed is pointless
// and it never persists). Mirrors nextLevel(): hide the overlay, then beginGame() (which clearRun()s
// + resetState()s). No save/economy impact (a defeat/win already cleared the save when !daily).
function playAgain() {
  if (daily) return;  // belt-and-suspenders: the button is hidden for daily runs
  document.getElementById('overlay').style.display = 'none';
  beginGame();
}
function backToMenu() {
  started = false;
  daily = false;
  // v2.0.0 (owner FEEDBACK): after CLEARING a campaign level, returning to the menu auto-advances
  // the selection to the next level — no need to click "Next Level ▶" on the victory screen first.
  // winGame() already wrote cd_campaign, so campaignDone() reflects the just-beaten level; we bump
  // campLevel before renderStartScreen() (which then shows the next level selected). Guarded on
  // `victory` so a defeat→menu keeps the current level, and resetState() (below) clears `victory`.
  if (gameMode === 'campaign' && victory && campLevel < CAMPAIGN_LEVELS) campLevel++;
  document.getElementById('overlay').style.display = 'none';
  // Clear the inline display (not a hardcoded 'flex') so the CSS governs the menu layout —
  // the desktop dashboard `display:grid` (v2.1.0) and the ≤920px fixed/flex layout both win
  // again. A hardcoded 'flex' here used to override the grid after a game, reverting the menu
  // to the tall stacked flow (and re-introducing the scrollbar). (v2.18.0)
  document.getElementById('startScreen').style.display = '';
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
  // Progressive late-game hardness for the harder QUICK difficulties (v2.0.0, owner FEEDBACK:
  // "scale the hardness on hard more as the waves progress … good early, easier mid, super easy
  // late; campaign progression is good"). Campaign already ramps via campScale and the owner
  // praised it, so this is gated to gameMode==='quick' AND hard/nightmare — Normal/Easy and ALL
  // campaign runs are byte-identical (so the test-[16] Normal HP invariant is untouched). It
  // ramps from a wave threshold and CAPS, so it stays inside the per-run swing guardrail and
  // makes each LATER wave a bigger jump (exactly the "scale more as waves progress" ask):
  //   • hard:      +1.5%/wave from w15, cap +25% (reached ≈w32) → +7.5% w20, +22.5% w30.
  //   • nightmare: +3%/wave from w10, cap +80% (reached ≈w37) — steepened v2.12.0 (was +2%/cap+40%)
  //     as part of the owner "Nightmare should be about twice as hard" pass: +30% w20, +60% w30.
  const lateScale = gameMode === 'quick'
    ? (diffKey === 'nightmare' ? 1 + Math.min(0.80, Math.max(0, w - 10) * 0.03)
     : diffKey === 'hard'      ? 1 + Math.min(0.25, Math.max(0, w - 15) * 0.015)
     : 1)
    : 1;
  const hpBase = (18 + w*7 + 1.25 * Math.pow(w, 1.9)) * 1.80 * d.hp * campScale * lateScale;
  // Bounty per kill, trimmed v1.16.1 to cool the front-loaded gold snowball (owner FEEDBACK
  // "I clear classic-normal with money from the first 10 rounds"). Kills are ~69% of early
  // income; cutting the FLAT term 4->3 (slope w*0.6 kept) trims bounty ~20% at w1, fading to
  // ~10% by w10 and ~6% by w20 — front-loaded where the over-build happens, barely touching
  // deep endless. Specials/boss scale off this, so the trim propagates proportionally.
  return { hp: hpBase, speed: 55 + Math.min(50, w*1.6), bounty: Math.max(2, Math.round((3 + w*0.6) * d.bounty)) };
}
// Boss archetype rotation (v1.25.0; enrager added v1.34.0, teleporter v1.40.0, berserker v1.50.0,
// disruptor v1.52.0, juggernaut v1.56.0, siphon v1.71.0, hydra v1.82.0, revenant v1.88.0,
// conduit v2.2.0, warper v2.7.0, fortifier v2.10.0, warlord v2.14.0, suppressor v2.16.0). Indexed by
// boss number from wave 20 on, so deep bosses cycle regen → summoner → bulwark → enrager → teleporter →
// berserker → disruptor → juggernaut → siphon → hydra → revenant → conduit → warper → fortifier →
// warlord → suppressor (w90 → warlord, w95 → suppressor, w100 wraps to regen). The cycle length reads
// BOSS_ARCHETYPES.length below, so a new archetype only needs adding here plus its handlers. KEEP IN
// SYNC with the update()/render() and damage() handlers (cd-update.js / cd-render.js) and the wave-preview note below.
const BOSS_ARCHETYPES = ['regen', 'summoner', 'bulwark', 'enrager', 'teleporter', 'berserker', 'disruptor', 'juggernaut', 'siphon', 'hydra', 'revenant', 'conduit', 'warper', 'fortifier', 'warlord', 'suppressor'];
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
    if (w >= 15 && i % 11 === 10) e = { kind:'warden', hp:t.hp*1.3, spd:t.speed*0.85, r:13, bounty:Math.ceil(t.bounty*2.4), color:'#58a6ff', armor:0, gap:0.85 };
    // Breacher (v1.63.0): a slow, heavy unit from wave 17+ that costs LIVES if it leaks
    // (read at the leak site via e.lifeCost). A fresh difficulty axis — no other enemy varies
    // leak cost — that pressures COVERAGE in ALL modes (incl. Classic/Campaign, the modes the
    // owner flagged as "too easy"), without inflating the invariant-capped HP curve or economy.
    // Moderate HP + slow speed keep it stoppable: only a real coverage gap lets one through.
    // v2.0.0: leak cost 2 → 3 (owner FEEDBACK "the enemies that have increase life taking should
    // be upped"), so a leaked Breacher now drains 3 lives. (Bosses already cost 5 — see leak site.)
    if (w >= 17 && i % 12 === 11) e = { kind:'breacher', hp:t.hp*2.0, spd:t.speed*0.7, r:15, bounty:Math.ceil(t.bounty*2.5), color:'#d4566b', armor:0, gap:0.9, lifeCost:3 };
    // Molten (v1.77.0): a CC-IMMUNE regular enemy from wave 12+ in ALL modes. It sets
    // ccImmune:true, reusing the Heatwave/Juggernaut infrastructure — the `if (e.ccImmune)`
    // line in update() clears its frozen/slow every frame (before slowMul), and render draws
    // the warm-orange cue ring — so the Freeze ability and Frost towers can't slow or freeze
    // it: it plows down the path at full speed. A fresh difficulty axis for a REGULAR enemy
    // (CC-immunity previously lived only on the w55+ Juggernaut boss and the Mayhem-only
    // Heatwave mod), specifically checking the documented Frost/booster snowball in Classic &
    // Campaign — the modes the owner flagged "too easy" — not just Mayhem/late bosses. Bounded:
    // moderate HP (×1.35), normal speed, no other trick, so it can't make a run easier — it
    // just demands real DPS instead of perma-slow. Run-only (enemies are never persisted). As
    // the LAST regular-kind if it wins its slot on a collision.
    if (w >= 12 && i % 13 === 6) e = { kind:'molten', hp:t.hp*1.35, spd:t.speed, r:12, bounty:Math.ceil(t.bounty*1.6), color:'#e8482e', armor:0, gap:0.75, ccImmune:true };
    // Bastion (v1.90.0): a heavy blast-SHELL enemy from wave 14+ in ALL modes. It sets
    // aoeResist:true, which makes the two explosive splash towers — the Cannon's bomb and
    // the Mortar's shell — deal it only HALF damage (the resist is applied at those two
    // splash loops in hitEnemy(), NOT in damage(), so no other damage path changes). A
    // fresh difficulty axis aimed straight at the documented dominant strategy: splash/AoE
    // clears everything (Cannon+Mortar), which is a big part of the recurring "too easy"
    // feedback. The Bastion shrugs off explosions, so a pure-bombardment build chunks it
    // slowly — it rewards bringing real SINGLE-TARGET DPS (Gun/Sniper/Railgun deal full
    // damage), a meaningful build choice rather than a raw HP spike. Bounded: it's resist,
    // not immunity (50%), with moderate HP (×1.6) and a slightly heavy gait (×0.9), so any
    // direct-fire line stops it — it can't make a run easier. Tesla chain and the Overkill
    // perk's true-damage detonation are deliberately NOT resisted (it's "explosion"-coded:
    // the two dedicated explosive towers). Run-only (enemies are never persisted) — no save
    // migration. Appended last, so it's the final regular-kind override on a slot collision.
    if (w >= 14 && i % 14 === 13) e = { kind:'bastion', hp:t.hp*1.6, spd:t.speed*0.9, r:14, bounty:Math.ceil(t.bounty*2.2), color:'#7a86c8', armor:0, gap:0.85, aoeResist:true };
    // Jammer (v1.91.0): a tower-DISABLING regular enemy from wave 16+ in ALL modes. While alive
    // (and not frozen) it periodically knocks the nearest firing tower offline (sets empT, ticked
    // in update()), so a small coverage blackout rolls down the path with it — the REGULAR-enemy
    // cousin of the Disruptor boss / Static Storm wave-mod (just as the Molten is the regular-enemy
    // cousin of Heatwave/Juggernaut CC-immunity). It brings tower-UPTIME/coverage pressure —
    // previously only on the w20+ Disruptor boss and the Mayhem-only Static Storm — to a regular
    // enemy in Classic & Campaign too (the modes the owner flagged "too easy"), off the
    // invariant-capped HP curve. Bounded: modest HP (×1.15), near-normal speed, one tower per
    // pulse, a brief self-recovering disable, buff towers immune, freeze pauses it — so it can't
    // make a run easier; kill it fast (or space/redundant your towers) to stop the blackouts.
    // Appended last → the final regular-kind override on a slot collision. Run-only (enemies are
    // never persisted) — no save migration.
    if (w >= 16 && i % 15 === 14) e = { kind:'jammer', hp:t.hp*1.15, spd:t.speed*0.95, r:12, bounty:Math.ceil(t.bounty*1.9), color:'#f2e34a', armor:0, gap:0.8 };
    // Herald (v2.4.0): a HASTE-aura support enemy from wave 18+ in ALL modes — the REGULAR-enemy
    // cousin of the Enrager boss (just as the Molten mirrors Heatwave/Juggernaut and the Jammer
    // mirrors the Disruptor/Static Storm). While alive (and not frozen) it tags nearby allies with
    // e.hasted (ticked in update()), and the existing hasteMul=1.35 movement factor speeds them up
    // — so the whole cluster around it surges toward the exit. A fresh aura axis (the 3rd, after the
    // heal regen aura and the warden damage-shield aura) that pressures TARGET PRIORITY off the
    // invariant-capped HP curve: pop the herald and the pack slows back to base speed. Bounded /
    // "too easy"-safe: the haste is capped at +35% and binary (no stacking with the Enrager), the
    // herald itself is slow (×0.9) and moderately tanky, frost slow still multiplies in and freeze
    // pauses the aura — so it can only add pressure, never make a run easier. The LAST regular-kind
    // if, so it wins its slot on a collision. Run-only (enemies are never persisted) — no migration.
    if (w >= 18 && i % 16 === 15) e = { kind:'herald', hp:t.hp*1.25, spd:t.speed*0.9, r:13, bounty:Math.ceil(t.bounty*2.2), color:'#ff79c6', armor:0, gap:0.85 };
    // Warden Surge (Mayhem): convert a fraction of would-be basic enemies into warden
    // escorts so the wave is densely shielded — pressures TARGET PRIORITY (pop the
    // wardens to un-shield the cluster), not raw HP. Only norms convert, so it never
    // overrides the rarer special kinds above; one mod is ever active so no stacking.
    if (modIs('wardens') && e.kind === 'norm' && i % 4 === 1) e = { kind:'warden', hp:t.hp*1.3, spd:t.speed*0.85, r:13, bounty:Math.ceil(t.bounty*2.4), color:'#58a6ff', armor:0, gap:0.85 };
    // Breacher Surge (Mayhem): convert a fraction of would-be basic enemies into heavy
    // ‼ Breacher escorts (the wave-wide cousin of the Breacher enemy, like Warden Surge ↔
    // the Warden). Mirrors the warden conversion exactly — only norms convert (so it never
    // overrides the rarer special kinds above) and it's a conversion not an addition (wave
    // length unchanged). The breachers carry the full enemy stats incl. lifeCost:3 (v2.0.0, up
    // from 2 — matches the base Breacher), so a densely-breached wave pressures COVERAGE on the
    // LEAK-COST axis (no other mod touches lives) — leaking even one stings. Bounded: slow (×0.7) so
    // they bunch up and can be focused; only a real coverage gap lets one through, and one
    // mod is ever active so no stacking. Run-only (enemies are never persisted).
    if (modIs('breachers') && e.kind === 'norm' && i % 4 === 1) e = { kind:'breacher', hp:t.hp*2.0, spd:t.speed*0.7, r:15, bounty:Math.ceil(t.bounty*2.5), color:'#d4566b', armor:0, gap:0.9, lifeCost:3 };
    // Jammer Surge (Mayhem, v1.96.0): convert a fraction of would-be basic enemies into ⚡ Jammer
    // escorts (the wave-wide cousin of the Jammer enemy, like Warden Surge ↔ the Warden / Breacher
    // Surge ↔ the Breacher). Mirrors those conversions exactly — only norms convert (so it never
    // overrides the rarer special kinds above) and it's a conversion not an addition (wave length
    // unchanged). A densely-jammed wave pressures TOWER UPTIME/COVERAGE: each jammer periodically
    // knocks the nearest tower offline as it advances (the kind==='jammer' tick in update() handles
    // the converted ones identically — its lazy jamCd inits on first tick regardless of wave), so
    // roaming blackouts stack across the wave. Distinct from Static Storm's single global timer —
    // here the dead-zones are SPATIAL and scale with how many you let through. Bounded: each jams
    // one tower per pulse for a brief self-recovering window, buff/support towers are immune, freeze
    // pauses it, and one mod is ever active so no stacking with wardens/breachers despite the shared
    // slot. Run-only (enemies are never persisted) — no save migration.
    if (modIs('jammers') && e.kind === 'norm' && i % 4 === 1) e = { kind:'jammer', hp:t.hp*1.15, spd:t.speed*0.95, r:12, bounty:Math.ceil(t.bounty*1.9), color:'#f2e34a', armor:0, gap:0.8 };
    // Bastion Surge (Mayhem, v1.99.0): convert a fraction of would-be basic enemies into ⬢ Bastion
    // escorts (the wave-wide cousin of the Bastion enemy, like Warden Surge ↔ the Warden / Breacher
    // Surge ↔ the Breacher / Jammer Surge ↔ the Jammer). Mirrors those conversions exactly — only
    // norms convert (so it never overrides the rarer special kinds above) and it's a conversion not
    // an addition (wave length unchanged). The bastions carry aoeResist:true, so a densely-shelled
    // wave pressures the dominant AoE/splash build on the DAMAGE-SOURCE axis: the two explosive
    // splash towers (Cannon bomb + Mortar shell) deal them only HALF damage (applied at the splash
    // loops in hitEnemy(), unchanged), so a pure-bombardment line chunks the wave slowly and is
    // pushed to bring single-target DPS (Gun/Sniper/Railgun deal full). Bounded: resist not immunity
    // (×0.5), moderate HP (×1.6), slightly heavy gait (×0.9), so it can't make a run easier; one mod
    // is ever active so no stacking with wardens/breachers/jammers despite the shared slot. Run-only
    // (enemies are never persisted) — no save migration.
    if (modIs('bastions') && e.kind === 'norm' && i % 4 === 1) e = { kind:'bastion', hp:t.hp*1.6, spd:t.speed*0.9, r:14, bounty:Math.ceil(t.bounty*2.2), color:'#7a86c8', armor:0, gap:0.85, aoeResist:true };
    if (modIs('swarm'))  e.hp *= 0.65;
    if (modIs('titans')) { e.hp *= 1.5; e.bounty = Math.ceil(e.bounty * 1.5); }
    if (modIs('frenzy')) e.spd *= 1.35;
    if (modIs('goldrush')) e.bounty *= 2;
    if (modIs('drought'))  e.bounty = Math.max(1, Math.floor(e.bounty * 0.5));
    if (modIs('armored')) e.armor += 5 + Math.floor(w * 0.3);
    if (modIs('regen'))   e.regen = true;
    if (modIs('adrenaline')) e.adrenaline = true;
    if (modIs('heatwave')) e.ccImmune = true;
    if (modIs('cloak')) e.cloak = true;
    if (modIs('fission')) e.fission = true;
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
    // Boss ARMOR slope steepened 0.4 -> 0.5 (v1.64.0) — the genuinely-open late-game
    // difficulty lever (the boss HP slope above is invariant-capped by test [44]'s
    // ≤25%-vs-0.5-baseline check; raising it past ~0.625 would break that, so it can't
    // move without owner sign-off). Armor is FLAT subtraction (damage()), so this barely
    // touches high-damage builds (cannon/sniper ~+2-5% kill time) and is fully ignored by
    // the anti-armor towers the owner added (Mortar/AP-gun ignore armor, Poison corrodes
    // it -3/hit) — but it meaningfully hardens the high-rate-LOW-damage build the owner
    // flagged as trivializing the game (a leveled gun's boss kill is +5.7%/+10%/+25%
    // slower at w20/w30/w50; sim in CHANGELOG v1.64.0). The number changes exactly +25%
    // (the per-run guardrail) and the effective-HP swing stays ≤25% for the worst
    // realistic build up to w50. Matches the shield enemy's `3 + w*0.5` armor slope.
    const boss = { kind:'boss', hp:t.hp*mult, maxHp:t.hp*mult, spd:t.speed*0.45, r:24, bounty:t.bounty*12, color:'#f85149', armor: w*0.5, gap:1.5 };
    // Boss ARCHETYPES (v1.25.0; enrager added v1.34.0, teleporter v1.40.0): from wave 20+ the
    // every-5th-wave boss gains a MECHANIC (regen / summoner / bulwark shield / enrager
    // haste-aura / teleporter blink) on a 5-cycle — hardening the LATE game off the
    // HP axis, since the norm-enemy HP curve is already invariant-capped (see [16] / the
    // enemyTemplate note in CLAUDE.md). Early/tutorial bosses (w5/10/15, and campaign
    // L1–5 finals at victoryWave<20) stay vanilla, so the early game is untouched. The
    // mechanic itself is run-only state (ticked in update()), so it's never persisted.
    if (w >= 20) boss.bossType = BOSS_ARCHETYPES[(w/5 - 4) % BOSS_ARCHETYPES.length];
    if (modIs('titans')) { boss.hp *= 1.5; boss.bounty = Math.ceil(boss.bounty * 1.5); }
    if (modIs('goldrush')) boss.bounty *= 2;
    if (modIs('drought'))  boss.bounty = Math.max(1, Math.floor(boss.bounty * 0.5));
    if (modIs('frenzy')) boss.spd *= 1.35;
    if (modIs('armored')) boss.armor += 5 + Math.floor(w * 0.3);
    if (modIs('regen'))   boss.regen = true;
    if (modIs('adrenaline')) boss.adrenaline = true;
    if (modIs('heatwave')) boss.ccImmune = true;
    if (modIs('cloak')) boss.cloak = true;
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
    if (w >= 15 && i % 11 === 10) k = 'warden';
    if (w >= 17 && i % 12 === 11) k = 'breacher';
    if (w >= 12 && i % 13 === 6) k = 'molten';
    if (w >= 14 && i % 14 === 13) k = 'bastion';
    if (w >= 16 && i % 15 === 14) k = 'jammer';
    if (w >= 18 && i % 16 === 15) k = 'herald';   // LAST, mirrors buildWave (final override)
    tally[k] = (tally[k] || 0) + 1;
  }
  const order = ['norm','fast','tank','heal','shield','split','phantom','warden','breacher','molten','bastion','jammer','herald'];
  const out = order.filter(k => tally[k]).map(k => ({ kind: k, count: tally[k] }));
  if (w % 5 === 0 && w > 0) out.push({ kind: 'boss', count: 1 });
  return out;
}
// Total raw HP of an upcoming wave's DETERMINISTIC base roster — the "threat" number on the
// bottom-left wave preview, so you can gauge an incoming HP spike (a tanky/boss wave) and buy
// up before it lands. Built from waveComposition() (the single source for kind counts) and
// enemyTemplate() (the single source for base HP + difficulty + campaign scaling), so it tracks
// difficulty and campaign level automatically. The per-kind HP multipliers + the boss multiplier
// MIRROR buildWave() — KEEP IN SYNC if those change. Like waveComposition, this is the pre-mod
// base (Mayhem wave-mods like swarm/titans aren't rolled yet), so it's a planning estimate.
const KIND_HP_MULT = { norm:1, fast:0.55, tank:3.2, heal:1.4, shield:1.8, split:1.6, phantom:0.9, warden:1.3, breacher:2.0, molten:1.35, bastion:1.6, jammer:1.15, herald:1.25 };
function waveThreat(w) {
  const t = enemyTemplate(w);
  let total = 0;
  for (const c of waveComposition(w)) {
    if (c.kind === 'boss') total += t.hp * (14 + w*0.6);   // mirrors buildWave's boss HP mult
    else total += c.count * (KIND_HP_MULT[c.kind] || 1) * t.hp;
  }
  return total;
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
  // Victory crossing. Normally this ENDS the run (winGame shows the overlay + returns). In Endless
  // mode winGame instead banks the win once and keeps `gameOver` false, so we fall through to settle
  // the wave-clear bonus/draft and auto-start the next wave — the run continues with no victory wall.
  if (wave >= victoryWave() && !victory) { winGame(); if (!endless) return; }
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
  document.getElementById('time').textContent = fmtTime(gameTime);
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
// Expanding shock-ring (v2.5.0): a single outward pulse that grows to `maxR` then fades.
// Cosmetic only (never saved). Gated like the particle burst — Particle effects = Off
// suppresses it, and reduced-motion drops it entirely (a ring is pure motion; the particle
// cue still fires). Pushed by Shockwave/Meteor for chunkier feedback.
function addRing(x, y, color, maxR, opts) {
  if (particleDensity <= 0 || reduceMotion()) return;
  const life = (opts && opts.life) || 0.5;
  rings.push({x, y, color, maxR, life, maxLife: life, w: (opts && opts.w) || 4});
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
    btn.innerHTML = `<span class="key">${i < 9 ? i+1 : '0'}</span><span class="icon">${t.icon}</span>${t.name}<br><span class="price">${cost}💰</span><br><small style="color:#8b949e">${t.desc}</small>`;
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
    : Math.round(effDmg(t)) + '|' + effRate(t).toFixed(3) + '|' + Math.round(effRange(t));
  return [t.level, t.spec, gold >= upCost, Math.floor(t.invested * sellRatio()), t.mode, Math.floor(t.dealt / 500), towerRankTier(t.kills), stat].join('|');
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
      : `<span class="statline">dmg ${Math.round(effDmg(t))} · range ${Math.round(effRange(t))} · ${(1/effRate(t)).toFixed(1)}/s</span><br>
         <span class="statline">dealt: ${fmtNum(t.dealt)} · kills: ${t.kills}${(() => { const rt = towerRankTier(t.kills); return rt > 0 ? ` · <b style="color:${TOWER_RANKS[rt].color}">${'★'.repeat(rt)} ${TOWER_RANKS[rt].name}</b>` : ''; })()}</span>`}
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
// Format an elapsed-seconds duration as M:SS (or H:MM:SS past an hour) — the run
// timer (run-only `gameTime`, accumulated in update() while playing). Used by the
// HUD clock + the end-screen Time stat + the Speed Demon achievement (v1.74.0).
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
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
  if (t.spec === 'railpen') d *= 1.20;   // v2.0.0: was 1.35 — Penetrator out-DPS'd the Sniper at L5 (owner FEEDBACK)
  if (t.spec === 'focus') d *= 1.35;     // Laser Focusing Array
  if (modIs('surge')) d *= 1.3;
  // Last Stand legendary (v1.22.0): comeback damage scaling with lives lost this run.
  if (perkState.lastStand) d *= 1 + Math.min(0.6, 0.03 * perkState.livesLost);
  // Glass Cannon legendary (v1.32.0): +50% damage (paired with a −30% range cut in effRange).
  if (perkState.glassCannon) d *= 1.5;
  // Hair Trigger legendary (v1.68.0): −25% damage per shot (paired with +55% fire rate in effRate).
  if (perkState.hairTrigger) d *= 0.75;
  // Veteran's Edge legendary (v2.13.0): +5% damage per veteran rank this tower has earned (max +20%
  // at Legend). Keyed to towerRankTier(t.kills), which upgradeKey() hashes — so it only churns the
  // panel on a promotion, not every kill (safe to live in effDmg, unlike combo/ambush). Conditional &
  // capped → below Diamond Core (+30% flat); rewards a small core of long-lived, elite towers.
  if (perkState.veteranBonus) d *= 1 + 0.05 * towerRankTier(t.kills);
  return d;
}
function effRate(t) {
  let r = t.rate * perkState.rateMult;
  if (t.spec === 'minigun') r *= 0.55;
  if (t.spec === 'rapidcoil') r *= 0.714;  // Laser Pulse Drive: fire rate ×1.4 (also ramps charge faster)
  if (modIs('brownout')) r *= 1.25;  // mayhem debuff: +25% reload = slower fire
  if (t.suppressed > 0) r *= 1.25;   // Suppressor boss aura (v2.16.0): localized brownout — +25% reload while in range

  // Hair Trigger legendary (v1.68.0): +55% fire rate (shorter reload; paired with −25% dmg in effDmg).
  if (perkState.hairTrigger) r /= 1.55;
  return r;
}
function effRange(t) {
  // Glass Cannon legendary (v1.32.0): −30% combat range (the cost of the +50% damage in effDmg).
  // Targeting Array rare perk (v1.81.0): ×rangeMult (+20% per pick). Farsight talent (v1.92.0):
  // ×metaRangeMult (+2%/rank, meta tree). All apply to firing range only, not booster auras
  // (effBuffRange) — buff towers deal no damage.
  return t.range * metaRangeMult() * (1 + 0.02 * tRank('mastery_' + t.type)) * (modIs('fog') ? 0.8 : 1) * (perkState.glassCannon ? 0.7 : 1) * perkState.rangeMult;
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
  boardPress(mouseX, mouseY);
});
// Shared board-press logic for a primary press at board point (x,y) — used by the
// pointerdown handler (mouse/touch) AND the gamepad A button (v1.43.0). Extracting it
// keeps the two input paths byte-identical: aim an armed meteor, else select a tower
// under the point, else place the selected shop tower (grid-snapped, v1.24.0).
function boardPress(x, y) {
  if (gameOver || !started || draftOpen) return;
  if (armedAbility === 'meteor' && !paused) {
    castMeteor(x, y);
    return;
  }
  const hit = towerAt(x, y);
  if (hit) { selectedShop = null; renderShop(); showUpgrade(hit); return; }
  hideUpgrade();
  if (!selectedShop) return;
  const cost = costOf(selectedShop);
  if (gold < cost) return;
  // Snap to the placement grid when grid-snap is on (default), so towers line up cleanly
  // (owner FEEDBACK, v1.24.0). canPlace runs on the snapped point so spacing/path checks
  // match exactly where the tower lands.
  const p = placeCoord(x, y);
  if (!canPlace(p.x, p.y)) return;
  const def = TOWER_TYPES[selectedShop];
  gold -= cost;
  towers.push({
    type: selectedShop, x: p.x, y: p.y,
    range: def.range, dmg: def.dmg, rate: def.rate,
    cd: 0, level: 1, baseCost: def.cost, invested: cost, angle: 0,
    // New towers inherit the Settings default targeting mode (v1.89.0); validate against
    // MODES so an unknown/old persisted value falls back to 'first'. (Buff towers ignore mode.)
    mode: MODES.includes(defaultTargetMode) ? defaultTargetMode : 'first',
    spec: null, dealt: 0, kills: 0, buffPower: 0.25, flash: 0
  });
  addExplosion(p.x, p.y, def.color, 8, 60);
  SFX.place();
  if (gold < cost) selectedShop = null;
  updateHud();
}
// The tower (if any) under a board point, using the same hit radius as tower selection.
// Bigger tap target on a finger: the forbidden placement gap is 32, so a 30px select
// radius still can't steal a tap meant to place an adjacent tower (desktop keeps 18).
// Shared by the pointerdown select hit-test and the render placement-ghost suppression.
function towerAt(x, y) {
  const selectR = coarsePointer() ? 30 : 18;
  return towers.find(t => Math.hypot(t.x - x, t.y - y) < selectR);
}
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
  if (e.key === 'r' || e.key === 'R') triggerAbility('shock');
  if (e.key === 't' || e.key === 'T') triggerAbility('barrier');
  const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;   // keys 1-9 → towers 1-9; '0' → 10th tower
  if (idx >= 0 && idx < TYPE_KEYS.length) {
    const key = TYPE_KEYS[idx];
    if (gold >= costOf(key)) {
      selectedShop = selectedShop === key ? null : key;
      hideUpgrade(); renderShop();
    }
  }
  if (e.key === 'Escape') { selectedShop = null; armedAbility = null; refreshAbilityBar(); hideUpgrade(); renderShop(); }
});

// ===== Gamepad support (v1.43.0) =====
// A controller drives the same board cursor (mouseX/mouseY) and the same actions as
// mouse/keyboard, so it's pure additive input — no new game state, no save/economy
// impact. pollGamepad() is called once per frame from the rAF loop (cd-render.js) and is
// a COMPLETE no-op when no pad is connected (navigator.getGamepads() empty), so standard
// mouse/touch play AND the headless harness are byte-identical. Standard (Xbox-style)
// button layout: A place/select · B cancel · X cycle tower · Start add-wave · Back pause ·
// LB/RB/LT abilities Q/W/E. Left stick + D-pad move the cursor.
let gamepadActive = false;        // a pad is connected → draw the on-board reticle
let gpPrev = [];                  // previous per-button pressed state, for press-edge detection
const GP_DEAD = 0.25;             // analog-stick dead zone
const GP_SPEED = 520;             // cursor px/sec at full stick deflection
function gpButton(gp, i) { const b = gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.5)); }
function pollGamepad(dt) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let gp = null;
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) { if (pads[i]) { gp = pads[i]; break; } }
  if (!gp) { gamepadActive = false; gpPrev = []; return; }
  gamepadActive = true;
  // Compute every button's press-edge up front and refresh gpPrev in one pass, so a held
  // button never auto-repeats and resuming play can't replay a button held down meanwhile.
  const n = gp.buttons ? gp.buttons.length : 0;
  const edge = [];
  for (let i = 0; i < n; i++) { const cur = gpButton(gp, i); edge[i] = cur && !gpPrev[i]; gpPrev[i] = cur; }
  const E = i => !!edge[i];
  if (!started || gameOver || draftOpen) return;      // no board actions outside live play
  if (paused) { if (E(8) || E(9)) togglePause(); return; }   // Back/Start resume

  // ----- cursor (left stick + D-pad) -----
  let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (Math.abs(ax) < GP_DEAD) ax = 0;
  if (Math.abs(ay) < GP_DEAD) ay = 0;
  if (gpButton(gp, 14)) ax = -1; else if (gpButton(gp, 15)) ax = 1;   // D-pad L/R
  if (gpButton(gp, 12)) ay = -1; else if (gpButton(gp, 13)) ay = 1;   // D-pad U/D
  if (ax || ay) {
    if (mouseX < 0 || mouseY < 0) { mouseX = W / 2; mouseY = H / 2; }   // appear at centre
    mouseX = Math.max(0, Math.min(W, mouseX + ax * GP_SPEED * dt));
    mouseY = Math.max(0, Math.min(H, mouseY + ay * GP_SPEED * dt));
  }
  // ----- buttons (press-edge) -----
  if (E(0)) boardPress(mouseX, mouseY);                       // A: place / select / aim meteor
  if (E(1)) { selectedShop = null; armedAbility = null; refreshAbilityBar(); hideUpgrade(); renderShop(); }  // B: cancel
  if (E(2)) gpCycleTower();                                   // X: cycle affordable tower type
  if (E(9)) startWave();                                      // Start: start/add wave (self-guards on cap)
  if (E(8)) togglePause();                                    // Back: pause
  if (E(4)) triggerAbility('meteor');                         // LB
  if (E(5)) triggerAbility('freeze');                         // RB
  if (E(6)) triggerAbility('rush');                           // LT
  if (E(7)) triggerAbility('shock');                          // RT
  if (E(3)) triggerAbility('barrier');                        // Y
}
// Cycle the shop selection to the next tower type the player can currently afford (X button).
function gpCycleTower() {
  const start = selectedShop ? TYPE_KEYS.indexOf(selectedShop) : -1;
  for (let n = 1; n <= TYPE_KEYS.length; n++) {
    const key = TYPE_KEYS[(start + n) % TYPE_KEYS.length];
    if (gold >= costOf(key)) { selectedShop = key; hideUpgrade(); renderShop(); return; }
  }
}

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

