'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

// ================= Version & What's New =================
const GAME_VERSION = 'v1.8.4';
// Most recent first; keep ~10. Mirrors CHANGELOG.md headings.
const CHANGELOG_ENTRIES = [
  { v: 'v1.8.4', date: '2026-06-11', body: "Combo pop placement, take two (your feedback): v1.8.3 moved the '🔥 N× COMBO!' milestone pop into the top-left corner — but that's where the COMBO meter itself lives, so they overlapped. The pop now fires on the center board, just below the top HUD band, so it's clear of the meter, the 'Wave clear! +bonus' text AND the boss HP bar. The meter's own bar-vs-label fix from v1.8.3 stays." },
  { v: 'v1.8.3', date: '2026-06-11', body: "Combo meter cleanup (your feedback): the draining timer bar no longer overlaps the word COMBO — the 'COMBO' label now sits to the right of the multiplier with the bar in its own lane below. (The milestone-pop placement from this update was corrected in v1.8.4.)" },
  { v: 'v1.8.2', date: '2026-06-11', body: "More under-the-hood tidy-up: the game's code is now split by domain into seven small files (core/audio, maps, definitions, state, gameplay, update, rendering) instead of one big script. Still zero change for you — double-click tower-defense.html and play exactly as before. Purely a maintainability win." },
  { v: 'v1.8.1', date: '2026-06-11', body: "Under-the-hood tidy-up: the game is now split into separate files — tower-defense.html (markup), tower-defense.css (styles) and the game code — instead of one giant HTML file. Nothing changes for you: just double-click tower-defense.html to play, exactly as before. This makes the codebase easier to maintain going forward." },
  { v: 'v1.8.0', date: '2026-06-11', body: "Combo Master! A new 💥 achievement for reaching a 30× kill-streak in a single run, plus a 🔥 Best combo stat on the Records panel that tracks your all-time highest streak. Chase those chains — the combo system finally pays off your account." },
  { v: 'v1.7.1', date: '2026-06-11', body: "Fix: the new COMBO meter was drawing behind the ability buttons (Meteor / Freeze / Gold Rush) in the top-right corner. Moved it to the top-left of the board so it no longer hides behind your abilities." },
  { v: 'v1.7.0', date: '2026-06-11', body: "Kill streaks! Chain kills within 2 seconds to build a COMBO meter (top-left of the board) that glows hotter as it climbs — green → gold → orange → red → purple. Every milestone (5, then every 10) fires a rising chirp, a screen-shake and a particle burst, so wiping out a packed wave feels chunky. Purely cosmetic — no effect on gold or saves." },
  { v: 'v1.6.1', date: '2026-06-11', body: "New record! flourish — when a quick-mode run beats your best wave for that map × difficulty (your Records cell), the game-over/victory screen now celebrates with a golden banner showing the old→new wave delta, a triumphant fanfare, and a screen-shake + particle burst. First-ever entries record quietly; only beating a real best fires the party." },
  { v: 'v1.6.0', date: '2026-06-11', body: "Records! A new 🏆 Records button on the start screen shows your highest wave reached on every map × difficulty, plus an 'Any map' row of your all-time bests, your campaign progress, lifetime damage, total runs and chips. Quick-mode runs now log a best-wave per map (not just per difficulty)." },
  { v: 'v1.5.2', date: '2026-06-11', body: "What's New no longer grows taller than the game on big screens — the panel is now capped to the game's height and scrolls internally, so it stays a tidy window flush beside the board instead of overhanging the bottom." },
  { v: 'v1.5.1', date: '2026-06-11', body: "Cleaner start screen — when no game is running, the stats bar, tower shop, wave controls and hotkey hint now dim out and go non-interactive so the start menu is the only live surface. They light back up the moment you hit Play or resume a run." },
  { v: 'v1.5.0', date: '2026-06-10', body: "Achievements! Earn 8 permanent badges across all your runs — First Victory, Flawless (win without losing a life), No Mercy (win on Hard), Mountaineer (Campaign L10), Conqueror (finish the campaign), Endless (reach wave 50), Megadamage (1M lifetime damage) and Veteran (25 runs). A new 🏅 Achievements button on the start screen shows your progress; unlocks pop on the end-of-run screen." },
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
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
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
    o.connect(g); g.connect(a.destination);
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
    src.connect(f); f.connect(g); g.connect(a.destination);
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

