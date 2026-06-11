'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

// Accessibility: honour the OS "reduce motion" setting — when on, the render loop
// skips screen-shake (the most motion-sensitive effect). Read live so toggling the
// OS setting takes effect without a reload; guarded for environments w/o matchMedia.
let _rmQuery = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function reduceMotion() { return !!(_rmQuery && _rmQuery.matches); }

// User render/performance prefs (Settings panel, v1.13.0) — persisted on this device,
// independent of the OS reduce-motion gate. shakeEnabled gates screen-shake;
// particleDensity (1=Full, 0.5=Reduced, 0=Off) scales burst particle counts.
let shakeEnabled = localStorage.getItem('cd_shake') !== '0';   // default ON
let particleDensity = (() => {
  const v = localStorage.getItem('cd_particles');
  return v === null ? 1 : Math.max(0, Math.min(1, +v || 0));
})();

// ================= Version & What's New =================
const GAME_VERSION = 'v1.13.5';
// Most recent first. Show the FULL history (owner preference, v1.13.5 — do not trim
// to a recent-N window; the panel scrolls). Mirrors CHANGELOG.md headings.
const CHANGELOG_ENTRIES = [
  { v: 'v1.13.5', date: '2026-06-11', body: "What's New now shows the FULL update history again (your request) — the previous version had trimmed it to just the 10 most-recent entries, but you'd rather see everything. The panel scrolls, so the whole list is here to browse top to bottom." },
  { v: 'v1.13.4', date: '2026-06-11', body: "🩺 Health check (every-6th-run maintenance pass): full test suite green (200/0, zero console errors), all code files comfortably within size limits, every documented formula re-verified against the code, and old saves confirmed to still load via the migration defaults. Double-click play (file://) re-checked. No gameplay changes. Also tidied this What's New list back to its intended ~10 most-recent entries (the complete history is still in CHANGELOG.md), and refreshed the roadmap's table-stakes audit (touch controls remain the top mobile gap)." },
  { v: 'v1.13.3', date: '2026-06-11', body: "Difficulty curve steepened (your feedback — early waves are hard now but it plateaus). Enemy health now ramps faster the deeper you go: barely changed in the first ~10 waves (so the strong early game stays), then progressively tougher — roughly +12% by wave 10, +18% by wave 30, climbing toward +25% in deep endless. Each later wave is now a bigger jump than before." },
  { v: 'v1.13.2', date: '2026-06-11', body: "The ⚙ Settings panel now has a 🔊 Volume slider — set the master volume anywhere from 0 to 100% instead of just on/off mute. It scales all the game's sound and saves on your device. (Mute still works as a quick toggle.)" },
  { v: 'v1.13.1', date: '2026-06-11', body: "Hovering a tower in the shop now previews its range — a dashed ring (with the tower's name and range) appears on the board so you can compare coverage before you even pick it up. The shop tooltips show the range number too. (Once you select a tower, the range still follows your cursor as you place it, like before.)" },
  { v: 'v1.13.0', date: '2026-06-11', body: "New ⚙ Settings panel on the start screen. Toggle screen shake on/off, and set particle effects to Full / Reduced / Off — great for lower-end devices or if you just prefer a calmer board. Both save on your device. (These stack with your OS 'reduce motion' setting, which already minimises both.)" },
  { v: 'v1.12.2', date: '2026-06-11', body: "Cleaner game feel: when a bunch of enemies die together (splash, meteor, a fat combo), the floating +gold and CRIT numbers no longer pile up into an unreadable confetti — nearby ones now merge into a single growing number (e.g. +25 instead of +5 +7 +3 +10). Easier to read, less visual noise." },
  { v: 'v1.12.1', date: '2026-06-11', body: "The perk icons in the top-left of the board (the milestone bonuses you draft every 5 waves) now have a hover tooltip — mouse over any one to see its name and exactly what it does, colour-coded by rarity. No more forgetting which legendary you grabbed three waves ago." },
  { v: 'v1.12.0', date: '2026-06-11', body: "Concurrent waves! You can now start the next wave WHILE one is still running — the Start button becomes ➕ Add Wave, so you can pour up to 3 waves onto the path at the same time for a high-risk rush. Each wave spawns as its own parallel stream. When the field finally clears, every bundled wave pays out its clear bonus and any boss-wave draft you crossed still pops — so rushing never costs you gold or perks, it just throws everything at you at once. (Spacebar adds a wave too.)" },
  { v: 'v1.11.0', date: '2026-06-11', body: "New 🗑 Reset All button on the start screen — wipes everything (chips, talents, achievements, records, your current run, and settings) and starts you completely fresh. It's a two-click confirm so you can't nuke your progress by accident: the first click arms it (turns red, 'Erase ALL — click again'), the second within 3 seconds does the deed." },
  { v: 'v1.10.0', date: '2026-06-11', body: "Spec & poison rework (your feedback) plus polish. Booster's Network now adds +10% aura power on top of its +50% range, so wider coverage no longer means giving up damage. Cannon's Mega Blast gains +15% damage alongside a bigger +60% blast — a real crowd-clear pick vs Cluster's single-target punch. Poison got a serious glow-up: stronger damage-over-time AND its acid now corrodes enemy armor on every hit, melting shielded foes and bosses for the whole team. Frost's Shatter spec was dialed back (×6 → ×4.5 damage) — paired with Frost Mastery it was carrying whole runs solo. Enemies are also tougher: another +25% health on top of last update's bump (still too easy, per your runs). Bug fix: your game-speed setting (1×/2×/3×) now sticks across a refresh/resume — before, reloading silently dropped you to 1×, which made every tower look like it was firing at its base speed. Also: the COMBO timer bar now flashes red as your streak is about to lapse, and the game respects your OS 'reduce motion' setting (skips screen-shake, thins particle bursts)." },
  { v: 'v1.9.2', date: '2026-06-11', body: "Difficulty bump (your feedback — \"the game is still too easy\"): every enemy now has 20% more health, bosses and tanks included. It's a deliberately modest, across-the-board step — towers still clear the early waves comfortably, but a coasting defense will start to feel the squeeze in the mid-to-late game. More tuning to come as the curve gets dialed in." },
  { v: 'v1.9.1', date: '2026-06-11', body: "Tidier tower menu (your feedback): clicking a tower used to pop its upgrade/sell menu right where you clicked, often covering enemies and the action on the path. The menu now sits pinned in the bottom-left corner of the board instead — out of the way of live combat, in the same spot every time. It grows upward so the spec choice at level 5 never gets cut off." },
  { v: 'v1.9.0', date: '2026-06-11', body: "New enemy — the 👻 Phantom! From wave 13 on, ghostly teal blinkers join the line. Every couple of seconds a phantom flickers and teleports a short hop forward — and while it's mid-blink it's intangible, so shots pass right through it. Slow, single-target towers get punished; quick-firing and area towers shine. Listen for the whoosh." },
  { v: 'v1.8.6', date: '2026-06-11', body: "🩺 Health check (every-6th-run maintenance pass): tests all green (123/0), code files all well within size limits, docs verified against the code, and old saves still load correctly. Also added the basics a polished web game should have — a ⚡ favicon in the browser tab, a page description, a mobile-friendly viewport tag, and link-preview (Open Graph) tags. No gameplay changes. Audited the bigger missing pieces (touch controls, gamepad, reduced-motion, PWA install) onto the roadmap." },
  { v: 'v1.8.5', date: '2026-06-11', body: "Combo meter moved to the bottom-right corner (your suggestion): instead of squeezing it into the busy top area — where it kept bumping the boss bar, the 'Wave clear! +bonus' text, and the milestone pop, and was getting clipped against the top edge — the COMBO meter now lives in the empty bottom-right corner with room to breathe. The '🔥 N× COMBO!' milestone pop stays on the center board. No more overlap, anywhere." },
  { v: 'v1.8.4', date: '2026-06-11', body: "Combo pop placement, take two (your feedback): v1.8.3 moved the '🔥 N× COMBO!' milestone pop into the top-left corner — but that's where the COMBO meter itself lived, so they overlapped. The pop now fires on the center board, below the top HUD band. (The meter itself moved to the bottom-right in v1.8.5.)" },
  { v: 'v1.8.3', date: '2026-06-11', body: "Combo meter cleanup (your feedback): the draining timer bar no longer overlaps the word COMBO — the 'COMBO' label now sits to the right of the multiplier with the bar in its own lane below. (The milestone-pop placement from this update was corrected in v1.8.4.)" },
  { v: 'v1.8.2', date: '2026-06-11', body: "More under-the-hood tidy-up: the game's code is now split by domain into seven small files (core/audio, maps, definitions, state, gameplay, update, rendering) instead of one big script. Still zero change for you — double-click tower-defense.html and play exactly as before. Purely a maintainability win." },
  { v: 'v1.8.1', date: '2026-06-11', body: "Under-the-hood tidy-up: the game is now split into separate files — tower-defense.html (markup), tower-defense.css (styles) and the game code — instead of one giant HTML file. Nothing changes for you: just double-click tower-defense.html to play, exactly as before. This makes the codebase easier to maintain going forward." },
  { v: 'v1.8.0', date: '2026-06-11', body: "Combo Master! A new 💥 achievement for reaching a 30× kill-streak in a single run, plus a 🔥 Best combo stat on the Records panel that tracks your all-time highest streak. Chase those chains — the combo system finally pays off your account." },
  { v: 'v1.7.1', date: '2026-06-11', body: "Fix: the new COMBO meter was drawing behind the ability buttons (Meteor / Freeze / Gold Rush) in the top-right corner. Moved it to the top-left of the board so it no longer hides behind your abilities." },
  { v: 'v1.6.1', date: '2026-06-11', body: "New record! flourish — when a quick-mode run beats your best wave for that map × difficulty (your Records cell), the game-over/victory screen now celebrates with a golden banner showing the old→new wave delta, a triumphant fanfare, and a screen-shake + particle burst. First-ever entries record quietly; only beating a real best fires the party." },
  { v: 'v1.5.2', date: '2026-06-11', body: "What's New no longer grows taller than the game on big screens — the panel is now capped to the game's height and scrolls internally, so it stays a tidy window flush beside the board instead of overhanging the bottom." },
  { v: 'v1.5.1', date: '2026-06-11', body: "Cleaner start screen — when no game is running, the stats bar, tower shop, wave controls and hotkey hint now dim out and go non-interactive so the start menu is the only live surface. They light back up the moment you hit Play or resume a run." },
  { v: 'v1.4.1', date: '2026-06-10', body: "What's New now floats beside the ENTIRE game — opening it shifts the whole layout (title, HUD, towers, controls) together instead of only sliding the canvas over. On narrow screens it still tucks below." },
  { v: 'v1.4.0', date: '2026-06-10', body: "Added a What's New side panel (this list — it opens by default, sits flush beside the game, and scrolls; ✕ to hide) plus a version tag on the start screen. Established a headless Playwright test harness so future updates are verified automatically." },
  { v: 'v1.3.x', date: '2026-06', body: 'Removed the Scrapper perk and dropped rare-draft chance from 26% to 14% to make legendary perks feel special again.' },
  { v: 'v1.3.x', date: '2026-06', body: 'Increased enemy HP 20% across all modes and lengthened campaign waves (15 at level 1 up to 54 at level 40).' },
  { v: 'v1.2.0', date: '2026-06', body: 'Campaign mode (40 levels, random maps each attempt), abilities (Meteor / Freeze / Gold Rush), rarity-tiered perk drafts, and the Mayhem map.' },
  { v: 'v1.1.0', date: '2026-06', body: 'Talents and permanent chip progression, tower specializations at max level, difficulties, and save/resume.' },
];
// Open by default; only stays hidden if the player explicitly closes it (persisted).
let wnClosed = localStorage.getItem('cd_wnclosed') === '1';
function renderWnList() {
  const list = document.getElementById('wnList');
  list.innerHTML = '';
  for (const e of CHANGELOG_ENTRIES) {
    const d = document.createElement('div');
    d.className = 'wnEntry';
    d.innerHTML = `<span class="wnver">${e.v}</span><span class="wndate">${e.date}</span><div class="wnbody">${e.body}</div>`;
    list.appendChild(d);
  }
}
// Cap the panel to the game's height so it never grows past the game — it
// scrolls internally instead (the #gameCol drives the row height since the row
// is align-items:flex-start, so its offsetHeight is the game's natural height).
function syncWhatsNewHeight() {
  const gc = document.getElementById('gameCol');
  const wn = document.getElementById('whatsnew');
  if (!gc || !wn || getComputedStyle(wn).display === 'none') return;
  wn.style.maxHeight = gc.offsetHeight + 'px';
}
function openWhatsNew() {
  renderWnList();
  wnClosed = false;
  localStorage.removeItem('cd_wnclosed');
  document.getElementById('whatsnew').style.display = 'flex';
  syncWhatsNewHeight();
}
function closeWhatsNew() {
  wnClosed = true;
  localStorage.setItem('cd_wnclosed', '1');
  document.getElementById('whatsnew').style.display = 'none';
}
// Show it on first load (and every load) unless the player closed it before.
function initWhatsNew() {
  if (wnClosed) document.getElementById('whatsnew').style.display = 'none';
  else openWhatsNew();
}
// Keep the cap in sync as the viewport (and thus the game's height) changes.
window.addEventListener('resize', syncWhatsNewHeight);

// ================= Audio =================
let audioCtx = null;
let muted = localStorage.getItem('cd_mute') === '1';
let lastShootSfx = 0;
// Master volume (0..1), persisted as cd_vol (Settings panel, v1.13.2). All tone()/
// noise() output routes through a single master GainNode so the slider scales everything.
let masterVol = (() => { const v = localStorage.getItem('cd_vol'); return v === null ? 0.7 : Math.max(0, Math.min(1, +v || 0)); })();
let _masterGain = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function masterGain() {
  const a = ac();
  if (!_masterGain) { _masterGain = a.createGain(); _masterGain.gain.value = masterVol; _masterGain.connect(a.destination); }
  return _masterGain;
}
function setVolume(pct) {   // pct is 0..100 from the slider
  masterVol = Math.max(0, Math.min(1, (+pct || 0) / 100));
  try { localStorage.setItem('cd_vol', String(masterVol)); } catch(e) {}
  if (_masterGain) _masterGain.gain.value = masterVol;
}
function tone(freq, dur, type='square', vol=0.08, slide=0) {
  if (muted) return;
  try {
    const a = ac();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq+slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(masterGain());
    o.start(); o.stop(a.currentTime + dur);
  } catch(e) {}
}
let noiseBuf = null;
function noise(dur, vol, filterType='lowpass', freq=1000, slide=0, Q=1, delay=0) {
  if (muted) return;
  try {
    const a = ac();
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    }
    const t0 = a.currentTime + delay;
    const src = a.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = 0.7 + Math.random()*0.6;
    const f = a.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t0); f.Q.value = Q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(masterGain());
    src.start(t0); src.stop(t0 + dur);
  } catch(e) {}
}
const SFX = {
  // Gunner: dry mechanical tick-tack
  shoot()   { const n = performance.now(); if (n - lastShootSfx < 60) return; lastShootSfx = n;
              noise(0.03, 0.05, 'highpass', 3000); tone(700, 0.03, 'square', 0.02, -350); },
  // Sniper: sharp rifle crack with a tail
  snipe()   { noise(0.08, 0.12, 'highpass', 2200); tone(130, 0.16, 'sawtooth', 0.06, -70);
              noise(0.25, 0.04, 'lowpass', 900, -700); },
  // Cannon: deep boom — sub-bass thump + rumbling noise tail
  bomb()    { tone(55, 0.4, 'sine', 0.22, -28); noise(0.45, 0.18, 'lowpass', 480, -400);
              noise(0.06, 0.1, 'highpass', 1500); },
  // Tesla: lightning — bright crackle sweeping down + secondary snaps
  tesla()   { noise(0.16, 0.12, 'bandpass', 4200, -3600, 3); tone(2400, 0.1, 'sawtooth', 0.025, -2000);
              noise(0.04, 0.07, 'highpass', 5000, 0, 1, 0.04); noise(0.03, 0.05, 'highpass', 6000, 0, 1, 0.09); },
  // Frost: icy crystalline shimmer
  frost()   { tone(1900, 0.09, 'sine', 0.035, 600); tone(2500, 0.07, 'sine', 0.022, 400);
              noise(0.08, 0.025, 'highpass', 6500); },
  // Poison: wet gloopy burble
  poison()  { tone(280, 0.1, 'triangle', 0.045, -140); tone(190, 0.12, 'triangle', 0.035, -90);
              setTimeout(()=>tone(150, 0.08, 'triangle', 0.03, -60), 70); },
  death()   { tone(300, 0.15, 'triangle', 0.07, -200); },
  // Phantom blink: a quick rising whoosh as it teleports forward
  blink()   { tone(720, 0.07, 'sine', 0.03, 900); noise(0.05, 0.02, 'highpass', 4200, 1800); },
  // Kill-streak milestone: a bright rising chirp that climbs with the streak tier
  combo(n)  { const tier = Math.min(9, Math.floor(n/10)); const base = 540 + tier*70;
              tone(base, 0.07, 'square', 0.06, 140); tone(base*1.5, 0.06, 'sine', 0.03, 90);
              if (n >= 30) tone(base*2, 0.05, 'sine', 0.02, 120); },
  bossDeath(){ tone(70, 0.6, 'sine', 0.2, -35); noise(0.7, 0.2, 'lowpass', 600, -520);
               tone(160, 0.4, 'square', 0.07, -80); noise(0.1, 0.12, 'highpass', 1800); },
  life()    { tone(200, 0.3, 'square', 0.1, -120); },
  wave()    { tone(440, 0.1, 'square', 0.06); setTimeout(()=>tone(660, 0.12, 'square', 0.06), 110); },
  upgrade() { tone(523, 0.08, 'square', 0.06); setTimeout(()=>tone(659, 0.08, 'square', 0.06), 80); setTimeout(()=>tone(784, 0.12, 'square', 0.06), 160); },
  place()   { tone(330, 0.07, 'triangle', 0.06, 60); noise(0.05, 0.04, 'lowpass', 800); },
  sell()    { tone(500, 0.1, 'triangle', 0.06, -200); },
  perk()    { tone(660, 0.1, 'triangle', 0.08); setTimeout(()=>tone(990, 0.15, 'triangle', 0.08), 100); },
  // Meteor: long falling whistle into a huge boom
  meteor()  { tone(1400, 0.5, 'sine', 0.06, -1100); noise(0.5, 0.06, 'bandpass', 2000, -1500, 2);
              tone(45, 0.7, 'sine', 0.24, -20); noise(0.8, 0.22, 'lowpass', 400, -340); },
  freeze()  { tone(1200, 0.4, 'sine', 0.1, -800); tone(1800, 0.3, 'sine', 0.05, -1200);
              noise(0.4, 0.04, 'highpass', 5000, -2000); },
  crit()    { tone(1000, 0.06, 'square', 0.05, 200); },
  win()     { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f, 0.25, 'square', 0.07), i*150)); },
  over()    { [400,300,200,120].forEach((f,i)=>setTimeout(()=>tone(f, 0.3, 'sawtooth', 0.08, -40), i*200)); },
  // New record: bright rising fanfare with a shimmer on top
  record()  { [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>{ tone(f, 0.18, 'triangle', 0.08); tone(f*2, 0.1, 'sine', 0.025); }, i*90));
              setTimeout(()=>noise(0.3, 0.03, 'highpass', 7000), 360); },
};
function toggleMute() {
  muted = !muted;
  localStorage.setItem('cd_mute', muted ? '1' : '0');
  document.getElementById('muteBtn').textContent = muted ? '🔇 Muted' : '🔊 Sound';
  document.getElementById('muteBtn').classList.toggle('off', muted);
}
if (muted) { document.getElementById('muteBtn').textContent = '🔇 Muted'; document.getElementById('muteBtn').classList.add('off'); }

