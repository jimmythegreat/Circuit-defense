// Headless test harness for Circuit Defense.
//
// Drives the REAL tower-defense.html in a headless Chromium via Playwright.
// The game loop runs on requestAnimationFrame (throttled in hidden tabs), so we
// never rely on wall-clock time — every test drives the simulation by calling
// update(1/60) in a loop, exactly as CLAUDE.md prescribes.
//
// Run:  cd tests && npm install && npm test
//
// Exit code 0 = all green, 1 = at least one failure (so CI / subagents can gate on it).

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GAME_URL = pathToFileURL(resolve(ROOT, 'tower-defense.html')).href;

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// In-page driver. Installed once per page; exposes window.__cd helpers that run
// entirely inside the page so we avoid per-tick round-trips.
const INSTALL_DRIVER = () => {
  // Silence WebAudio during tests.
  try { muted = true; } catch (e) {}
  window.__cdErrors = window.__cdErrors || [];

  // Push N near-invincible towers so the board reliably clears waves.
  window.__cdGodTowers = function (n) {
    for (let i = 0; i < n; i++) {
      towers.push({
        type: 'gun', x: 40 + (i % 6) * 60, y: 40 + Math.floor(i / 6) * 60,
        range: 99999, dmg: 1e9, rate: 0.05,
        cd: 0, level: 1, baseCost: 50, invested: 50, angle: 0,
        mode: 'first', spec: null, dealt: 0, kills: 0, buffPower: 0.25, flash: 0
      });
    }
  };

  // Drive the sim until the game ends or we hit a wave/iteration cap.
  // Auto-picks the first draft card whenever a draft opens.
  window.__cdDrive = function (opts) {
    opts = opts || {};
    const maxWave = opts.maxWave || 9999;
    const cap = opts.cap || 400000;
    autoWave = false;
    let drafts = 0, guard = 0;
    // Stop only at a wave boundary (never mid-wave) so autosaves are deterministic.
    while (!gameOver && !(wave >= maxWave && !waveActive && !draftOpen) && guard < cap) {
      guard++;
      if (draftOpen) {
        const card = document.getElementById('draftCards').children[0];
        if (card) { card.click(); drafts++; }
        else { draftOpen = false; }
        continue;
      }
      if (!waveActive) startWave();
      update(1 / 60);
    }
    return { wave, lives, gold, gameOver, victory, drafts, perks: runPerks.length, hitCap: guard >= cap };
  };
};

async function newPage(browser) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  await page.addInitScript(() => { try { localStorage.setItem('cd_mute', '1'); } catch (e) {} });
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.evaluate(INSTALL_DRIVER);
  return { page, consoleErrors };
}

async function main() {
  const browser = await chromium.launch();

  // ---- Test 1: page loads with zero console errors ----
  console.log('\n[1] Page load & sanity');
  {
    const { page, consoleErrors } = await newPage(browser);
    const hasFns = await page.evaluate(() =>
      typeof beginGame === 'function' && typeof update === 'function' &&
      typeof startWave === 'function' && typeof loadRun === 'function');
    check('core functions exist (beginGame/update/startWave/loadRun)', hasFns);
    const ver = await page.evaluate(() => (typeof GAME_VERSION === 'string') ? GAME_VERSION : null);
    check('GAME_VERSION constant is defined', !!ver, 'got ' + ver);
    const verTag = await page.evaluate(() => document.getElementById('verTag') && document.getElementById('verTag').textContent);
    check("version tag rendered on start screen", verTag === ver, `tag="${verTag}" ver="${ver}"`);
    check('no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 2: scripted run clears several waves + draft opens at wave 5 and applies ----
  console.log('\n[2] Multi-wave run + wave-5 draft');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      gold = 999999;
      __cdGodTowers(8);
      return __cdDrive({ maxWave: 7 });
    });
    check('reached wave >= 7', r.wave >= 7, 'wave=' + r.wave);
    check('still alive (not defeated)', !r.gameOver || r.victory, JSON.stringify(r));
    check('a draft opened and a pick applied by wave 5', r.drafts >= 1 && r.perks >= 1,
      `drafts=${r.drafts} perks=${r.perks}`);
    check('no console errors during run', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 3: victory path triggers ----
  console.log('\n[3] Victory path (quick / 30 waves)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      gold = 999999; lives = 9999;
      __cdGodTowers(10);
      return __cdDrive({ maxWave: 9999 });
    });
    check('game ended in victory', r.gameOver && r.victory, JSON.stringify(r));
    check('victory at the victory wave (30)', r.wave === 30, 'wave=' + r.wave);
    check('did not hit iteration cap', !r.hitCap);
    check('no console errors during victory run', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 4: defeat path triggers ----
  console.log('\n[4] Defeat path (no towers)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard';
      beginGame();
      lives = 3; // no towers placed → leaks kill us
      return __cdDrive({ maxWave: 9999 });
    });
    check('game ended in defeat', r.gameOver && !r.victory, JSON.stringify(r));
    check('lives reached 0', r.lives <= 0, 'lives=' + r.lives);
    check('overlay shows GAME OVER', await page.evaluate(() =>
      document.getElementById('ovTitle').textContent.includes('GAME OVER')));
    check('no console errors during defeat run', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 5: save -> reload -> resume round-trips ----
  console.log('\n[5] Save / reload / resume round-trip');
  {
    const { page, consoleErrors } = await newPage(browser);
    // Clear a few waves; endWave() autosaves after each cleared wave.
    const before = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      gold = 999999;
      __cdGodTowers(8);
      const r = __cdDrive({ maxWave: 4 });
      const saved = JSON.parse(localStorage.getItem('cd_save'));
      return { wave: r.wave, savedWave: saved ? saved.wave : null, savedTowers: saved ? saved.towers.length : 0 };
    });
    check('a run was saved', before.savedWave !== null, JSON.stringify(before));
    check('saved wave matches cleared waves', before.savedWave === before.wave,
      `saved=${before.savedWave} cleared=${before.wave}`);

    // Reload the page (fresh load) and resume.
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(INSTALL_DRIVER);
    const resumeVisible = await page.evaluate(() =>
      document.getElementById('resumeBtn').style.display !== 'none');
    check('resume button visible after reload', resumeVisible);
    const after = await page.evaluate(() => {
      const ok = loadRun();
      return { ok, wave, towers: towers.length, started };
    });
    check('loadRun() succeeded', after.ok === true);
    check('resumed at saved wave', after.wave === before.savedWave,
      `resumed=${after.wave} saved=${before.savedWave}`);
    check('towers restored', after.towers === before.savedTowers,
      `restored=${after.towers} saved=${before.savedTowers}`);
    check('no console errors during resume', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 6: What's New side panel (open by default, flush, persists closed) ----
  console.log("\n[6] What's New side panel");
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1400, height: 820 });
    const r = await page.evaluate(() => {
      const panel = document.getElementById('whatsnew');
      const list = document.getElementById('wnList');
      const col = document.getElementById('gameCol');
      // Open by default on load — no click required.
      const openByDefault = panel.style.display === 'flex';
      const entries = list.children.length;
      // Side panel is a sibling of #gameCol inside #appRow — NOT a descendant overlay.
      const insideGame = !!col.querySelector('#whatsnew');
      // The panel now floats beside the ENTIRE game column, top-aligned with it.
      const cr = col.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      const beside = pr.left >= cr.right - 2 && Math.abs(pr.top - cr.top) < 6;
      const flush = Math.abs(pr.left - cr.right) <= 2; // no gap — attached to the game column
      const capped = pr.height <= cr.height + 4;        // scrolls internally, never taller than the game
      // The fix: opening the panel shifts the WHOLE game together, so the canvas stays
      // centered relative to the HUD whether the panel is open or closed (it used to
      // slide only the canvas over, knocking it out of line with the title/HUD/controls).
      const offset = () => {
        const c = document.getElementById('game').getBoundingClientRect();
        const h = document.getElementById('hud').getBoundingClientRect();
        return (c.left + c.width / 2) - (h.left + h.width / 2);
      };
      openWhatsNew(); const openDelta = offset();
      closeWhatsNew(); const closedDelta = offset();
      openWhatsNew();
      const shiftsTogether = Math.abs(openDelta - closedDelta) < 2;
      return { openByDefault, entries, total: CHANGELOG_ENTRIES.length, insideGame, beside, flush, capped, shiftsTogether };
    });
    check('panel is OPEN by default (no click needed)', r.openByDefault);
    check('lists ALL changelog entries', r.entries >= 1 && r.entries === r.total, `${r.entries}/${r.total}`);
    check('panel is a side panel, not a game overlay', !r.insideGame);
    check('panel sits beside the whole game (same top, to the right)', r.beside);
    check('panel is flush against the game column (no gap)', r.flush);
    check('panel height capped to game (scrolls internally)', r.capped);
    check('opening the panel shifts the WHOLE game together, not just the canvas', r.shiftsTogether);

    // Regression (v1.5.2): on a TALL viewport (where 88vh exceeds the game's own
    // height) the panel used to grow past the bottom of the game, dragging #appRow
    // taller than #gameCol. It must now cap to the game's height and scroll internally.
    await page.setViewportSize({ width: 1400, height: 1200 });
    const tall = await page.evaluate(() => {
      openWhatsNew();              // re-sync the cap for the new viewport
      const col = document.getElementById('gameCol').getBoundingClientRect();
      const panel = document.getElementById('whatsnew').getBoundingClientRect();
      const row = document.getElementById('appRow').getBoundingClientRect();
      const list = document.getElementById('wnList');
      return {
        gameH: Math.round(col.height), panelH: Math.round(panel.height), rowH: Math.round(row.height),
        eightyEight: Math.round(window.innerHeight * 0.88),
        scrolls: list.scrollHeight > list.clientHeight + 1,
      };
    });
    check('tall viewport: 88vh actually exceeds the game (precondition)',
      tall.eightyEight > tall.gameH, JSON.stringify(tall));
    check('tall viewport: panel height capped to the game, not 88vh',
      tall.panelH <= tall.gameH + 2, JSON.stringify(tall));
    check('tall viewport: appRow does NOT grow past the game',
      tall.rowH <= tall.gameH + 2, JSON.stringify(tall));
    check('tall viewport: overflowing entries scroll inside the panel', tall.scrolls, JSON.stringify(tall));
    await page.setViewportSize({ width: 1400, height: 820 });

    // Closing persists, and survives a reload.
    const closed = await page.evaluate(() => {
      document.getElementById('wnClose').click();
      return { display: document.getElementById('whatsnew').style.display, flag: localStorage.getItem('cd_wnclosed') };
    });
    check('clicking ✕ hides the panel', closed.display === 'none');
    check('closed state is persisted', closed.flag === '1');

    await page.reload({ waitUntil: 'load' });
    await page.evaluate(INSTALL_DRIVER);
    const afterReload = await page.evaluate(() => document.getElementById('whatsnew').style.display);
    check('panel stays closed after reload', afterReload === 'none', `display=${afterReload}`);

    const reopened = await page.evaluate(() => {
      openWhatsNew();
      return { display: document.getElementById('whatsnew').style.display, flag: localStorage.getItem('cd_wnclosed') };
    });
    check('reopening clears the closed flag', reopened.display === 'flex' && reopened.flag === null);
    check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 7: achievements grant, persist, and respect their conditions ----
  console.log('\n[7] Achievements');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Definitions exist and start screen reflects 0/N progress.
    const defs = await page.evaluate(() => ({
      count: ACHIEVEMENTS.length,
      done: achDone(),
      btn: document.getElementById('achBtn').textContent,
      panel: !!document.getElementById('achPanel'),
    }));
    check('ACHIEVEMENTS defined (>=4)', defs.count >= 4, 'count=' + defs.count);
    check('achievements panel exists', defs.panel);
    check('start screen shows 0/N progress', defs.done === 0 && defs.btn === `0/${defs.count}`, defs.btn);

    // A flawless Hard win grants First Victory + Flawless + No Mercy at once.
    const win = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; campLevel = 1;
      beginGame();
      wave = victoryWave();
      livesLostThisRun = false;
      towers.push({ type: 'gun', dealt: 500, kills: 10 });
      winGame();
      const txt = document.getElementById('ovText').textContent;
      const got = Object.keys(meta.achievements);
      backToMenu();
      return { got, achLine: txt.includes('Achievement') };
    });
    check('flawless Hard win grants first_win + flawless + hard_win',
      ['first_win', 'flawless', 'hard_win'].every(id => win.got.includes(id)), JSON.stringify(win.got));
    check('end-of-run screen announces the unlock', win.achLine);

    // Flawless is withheld when a life is lost; lifetime damage still accrues for million.
    const lossy = await page.evaluate(() => {
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0 };
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      wave = victoryWave();
      livesLostThisRun = true;
      towers.push({ type: 'gun', dealt: 1000000, kills: 1 });
      const newly = grantAchievements(true).map(a => a.id);
      const all = Object.keys(meta.achievements);
      backToMenu();
      return { newly, all };
    });
    check('flawless NOT granted when a life was lost', !lossy.all.includes('flawless'), JSON.stringify(lossy.all));
    check('1M lifetime damage grants million', lossy.all.includes('million'), JSON.stringify(lossy.all));

    // Old pre-v1.5 saves (no achievements/stats fields) migrate cleanly.
    const migrated = await page.evaluate(() => {
      localStorage.setItem('cd_meta', JSON.stringify({ chips: 42, talents: { firepower: 3 } }));
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
      loadMeta();
      const res = { chips: meta.chips, fp: meta.talents.firepower, ach: meta.achievements, stats: meta.stats };
      localStorage.removeItem('cd_meta');
      return res;
    });
    check('old save migrates: chips/talents intact', migrated.chips === 42 && migrated.fp === 3, JSON.stringify(migrated));
    check('old save migrates: achievements/stats defaulted',
      typeof migrated.ach === 'object' && migrated.stats.dmg === 0 && migrated.stats.runs === 0, JSON.stringify(migrated));

    // Combo Master (v1.8.0): a 30x run streak grants combo30 + records lifetime bestCombo.
    const combo = await page.evaluate(() => {
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0 };
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      wave = victoryWave();
      comboBest = 31;
      towers.push({ type: 'gun', dealt: 100, kills: 5 });
      const newly = grantAchievements(true).map(a => a.id);
      const res = { newly, all: Object.keys(meta.achievements), best: meta.stats.bestCombo };
      backToMenu();
      return res;
    });
    check('30x run streak grants combo30', combo.all.includes('combo30'), JSON.stringify(combo));
    check('lifetime bestCombo records the run peak', combo.best === 31, JSON.stringify(combo));

    // A sub-30 peak does NOT grant combo30 (but still updates bestCombo only if higher).
    const noCombo = await page.evaluate(() => {
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 40 };
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      wave = victoryWave();
      comboBest = 12;
      towers.push({ type: 'gun', dealt: 100, kills: 5 });
      grantAchievements(true);
      const res = { all: Object.keys(meta.achievements), best: meta.stats.bestCombo };
      backToMenu();
      return res;
    });
    check('sub-30 streak does NOT grant combo30', !noCombo.all.includes('combo30'), JSON.stringify(noCombo));
    check('bestCombo is not lowered by a smaller peak', noCombo.best === 40, JSON.stringify(noCombo));

    check('no console errors during achievements tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 8: in-game chrome dims on the start screen, lights up when playing ----
  console.log('\n[8] Idle chrome dimming (start screen vs active game)');
  {
    const { page, consoleErrors } = await newPage(browser);
    // Reads opacity with transitions disabled so the CSS animation can't race the assertion.
    const probe = await page.evaluate(() => {
      const col = document.getElementById('gameCol');
      const ids = ['hud', 'shop', 'controls'];
      const els = ids.map(i => document.getElementById(i)).concat([document.querySelector('.hint')]);
      const read = () => {
        const saved = els.map(e => e.style.transition);
        els.forEach(e => e.style.transition = 'none');
        const r = {
          idle: col.classList.contains('idle'),
          opacity: getComputedStyle(els[0]).opacity,
          pointer: getComputedStyle(els[0]).pointerEvents,
          hintOpacity: getComputedStyle(els[3]).opacity,
        };
        els.forEach((e, i) => e.style.transition = saved[i]);
        return r;
      };
      // On the start screen (no game started yet)
      const menu = read();
      // Active game
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      const playing = read();
      // Back to the menu
      backToMenu();
      const back = read();
      return { menu, playing, back };
    });
    check('start screen: gameCol has .idle', probe.menu.idle === true, JSON.stringify(probe.menu));
    check('start screen: chrome dimmed (opacity < 0.5)', parseFloat(probe.menu.opacity) < 0.5, probe.menu.opacity);
    check('start screen: chrome non-interactive (pointer-events none)', probe.menu.pointer === 'none', probe.menu.pointer);
    check('start screen: hotkey hint also dimmed', parseFloat(probe.menu.hintOpacity) < 0.5, probe.menu.hintOpacity);
    check('active game: .idle removed', probe.playing.idle === false, JSON.stringify(probe.playing));
    check('active game: chrome full opacity', parseFloat(probe.playing.opacity) === 1, probe.playing.opacity);
    check('active game: chrome interactive again', probe.playing.pointer === 'auto', probe.playing.pointer);
    check('back to menu: re-dims', probe.back.idle === true && parseFloat(probe.back.opacity) < 0.5, JSON.stringify(probe.back));
    check('no console errors during idle-chrome tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 9: Records panel records per-map best & surfaces it ----
  console.log('\n[9] Records / personal bests panel');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Panel + button + render fn exist.
    const defs = await page.evaluate(() => ({
      panel: !!document.getElementById('bestPanel'),
      openFn: typeof openBests === 'function',
      recFn: typeof recordBest === 'function',
    }));
    check('records panel exists', defs.panel);
    check('openBests/recordBest functions exist', defs.openFn && defs.recFn);

    // A finished quick run logs BOTH the legacy per-difficulty best and a new
    // per-map+difficulty best. Defeat at wave W on spiral/normal records W.
    const rec = await page.evaluate(() => {
      localStorage.removeItem('cd_best_spiral_normal');
      localStorage.removeItem('cd_best_normal');
      gameMode = 'quick'; mapKey = 'spiral'; diffKey = 'normal';
      beginGame();
      best = 0; wave = 12; lives = 0;
      endGame();
      const mapBest = +(localStorage.getItem('cd_best_spiral_normal') || 0);
      const diffBest = +(localStorage.getItem('cd_best_normal') || 0);
      backToMenu();
      return { mapBest, diffBest };
    });
    check('per-map+difficulty best recorded (spiral/normal = 12)', rec.mapBest === 12, JSON.stringify(rec));
    check('legacy per-difficulty best still recorded (normal = 12)', rec.diffBest === 12, JSON.stringify(rec));

    // Panel renders a cell for that map×difficulty showing the recorded value,
    // and an "Any map" summary row from the legacy keys.
    const render = await page.evaluate(() => {
      openBests();
      const open = document.getElementById('bestPanel').style.display === 'flex';
      const html = document.getElementById('bestBody').innerHTML;
      const hasTable = !!document.querySelector('.bestTbl');
      const hasAnyRow = !!document.querySelector('.bestTbl tr.anyrow');
      const shows12 = />12</.test(html);
      const hasStats = /Lifetime dmg/.test(html) && /Campaign/.test(html);
      closeBests();
      return { open, hasTable, hasAnyRow, shows12, hasStats };
    });
    check('openBests shows the panel', render.open);
    check('panel renders a bests table with an "Any map" row', render.hasTable && render.hasAnyRow);
    check('recorded best (12) appears in the table', render.shows12);
    check('panel shows campaign + lifetime stats', render.hasStats);

    // Campaign runs do NOT pollute per-map keys (maps are random per attempt).
    const camp = await page.evaluate(() => {
      const keysBefore = Object.keys(localStorage).filter(k => /^cd_best_[a-z]+_/.test(k)).length;
      gameMode = 'campaign'; mapKey = 'classic'; diffKey = 'easy'; campLevel = 1;
      beginGame();
      best = 0; wave = 8; lives = 0;
      endGame();
      const keysAfter = Object.keys(localStorage).filter(k => /^cd_best_[a-z]+_/.test(k)).length;
      backToMenu();
      return { keysBefore, keysAfter };
    });
    check('campaign defeat does not add a per-map best key', camp.keysAfter === camp.keysBefore,
      JSON.stringify(camp));

    // Cleanup test keys.
    await page.evaluate(() => {
      ['cd_best_spiral_normal', 'cd_best_normal', 'cd_best_easy', 'cd_save'].forEach(k => localStorage.removeItem(k));
    });
    check('no console errors during records tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 10: "New record!" end-of-run flourish ----
  console.log('\n[10] New record flourish');
  {
    const { page, consoleErrors } = await newPage(browser);

    const defs = await page.evaluate(() => ({
      banner: !!document.getElementById('ovRecord'),
      applyFn: typeof applyRecordFlourish === 'function',
      sfx: typeof SFX.record === 'function',
    }));
    check('ovRecord banner element exists', defs.banner);
    check('applyRecordFlourish + SFX.record exist', defs.applyFn && defs.sfx);

    // Beating a prior per-map best fires the flourish: banner text + record class.
    const beat = await page.evaluate(() => {
      localStorage.setItem('cd_best_classic_normal', '4');
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      best = 4; wave = 15; lives = 0;
      endGame();
      const ov = document.getElementById('overlay');
      const out = {
        rec: ov.classList.contains('record'),
        text: document.getElementById('ovRecord').textContent,
        stored: +(localStorage.getItem('cd_best_classic_normal') || 0),
      };
      backToMenu();
      return out;
    });
    check('beating a best adds the .record class', beat.rec, JSON.stringify(beat));
    check('banner shows old + new wave', /beat your best of 4/.test(beat.text) && /Wave 15/.test(beat.text), beat.text);
    check('beaten best is persisted (15)', beat.stored === 15, JSON.stringify(beat));

    // First-ever entry on a fresh cell records silently — no flourish.
    const first = await page.evaluate(() => {
      localStorage.removeItem('cd_best_serpent_hard');
      gameMode = 'quick'; mapKey = 'serpent'; diffKey = 'hard';
      beginGame();
      best = 0; wave = 9; lives = 0;
      endGame();
      const ov = document.getElementById('overlay');
      const out = { rec: ov.classList.contains('record'), text: document.getElementById('ovRecord').textContent };
      backToMenu();
      return out;
    });
    check('first-ever entry does not fire the flourish', !first.rec && first.text === '', JSON.stringify(first));

    // Campaign never fires the flourish (no per-map records).
    const camp = await page.evaluate(() => {
      gameMode = 'campaign'; mapKey = 'classic'; diffKey = 'easy'; campLevel = 1;
      beginGame();
      best = 0; wave = 20; lives = 0;
      endGame();
      const ov = document.getElementById('overlay');
      const out = { rec: ov.classList.contains('record') };
      backToMenu();
      return out;
    });
    check('campaign defeat does not fire the flourish', !camp.rec, JSON.stringify(camp));

    await page.evaluate(() => {
      ['cd_best_classic_normal', 'cd_best_serpent_hard', 'cd_best_normal', 'cd_best_hard', 'cd_best_easy', 'cd_save'].forEach(k => localStorage.removeItem(k));
    });
    check('no console errors during flourish tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 11: kill-streak combo builds, escalates, and lapses ----
  console.log('\n[11] Kill-streak combo');
  {
    const { page, consoleErrors } = await newPage(browser);

    const defs = await page.evaluate(() => ({
      colorFn: typeof comboColor === 'function',
      sfx: typeof SFX.combo === 'function',
      hasVars: typeof comboCount !== 'undefined' && typeof comboBest !== 'undefined' &&
               typeof comboTimer !== 'undefined' && typeof COMBO_WINDOW !== 'undefined',
    }));
    check('comboColor + SFX.combo exist', defs.colorFn && defs.sfx);
    check('combo state vars defined', defs.hasVars);

    // Color escalates from green through to purple as the streak climbs.
    const colors = await page.evaluate(() => ({
      lo: comboColor(3), mid: comboColor(12), hot: comboColor(35), top: comboColor(55),
    }));
    check('combo color escalates by tier',
      colors.lo === '#3fb950' && colors.mid === '#ffd866' && colors.hot === '#f85149' && colors.top === '#d2a8ff',
      JSON.stringify(colors));

    // Driving real waves of kills builds a streak; comboBest records the peak.
    const built = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 6 });
      return { wave: res.wave, comboBest, alive: !res.gameOver || res.victory };
    });
    check('clearing waves builds a combo streak (peak >= 5)', built.comboBest >= 5, JSON.stringify(built));

    // resetState() (via beginGame) zeroes the streak for a fresh run.
    const fresh = await page.evaluate(() => {
      backToMenu();
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      const out = { count: comboCount, timer: comboTimer, best: comboBest };
      backToMenu();
      return out;
    });
    check('a fresh run starts with a zeroed combo',
      fresh.count === 0 && fresh.best === 0 && fresh.timer === 0, JSON.stringify(fresh));

    // With no further kills the streak lapses to 0 after COMBO_WINDOW seconds.
    const lapse = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      comboCount = 7; comboTimer = COMBO_WINDOW;     // simulate a live streak
      for (let i = 0; i < 200; i++) update(1 / 60);  // ~3.3s, no kills → past the 2s window
      const out = { count: comboCount, timer: comboTimer };
      backToMenu();
      return out;
    });
    check('combo lapses to 0 after its window with no kills',
      lapse.count === 0 && lapse.timer === 0, JSON.stringify(lapse));

    // v1.8.5 layout: the combo meter lives in the BOTTOM-RIGHT corner (its own
    // empty space). Verify (a) its timer bar doesn't overlap the "COMBO" label,
    // (b) the whole meter — even a wide "100×" — fits on-canvas with no edge
    // clipping, and (c) the centered milestone floater clears both the top HUD
    // band (boss bar / round-clear bonus) and the bottom-right meter.
    const layout = await page.evaluate(() => {
      const W = cv.width, H = cv.height;
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      started = true; gameOver = false; comboTimer = 1.4; comboFlash = 1;
      // bottom-right meter geometry (mirrors draw(): ax=W-16, baseY=H-26)
      const measureMeter = (n) => {
        const ax = W - 16, baseY = H - 26;
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        const lbl = ctx.measureText('COMBO');
        ctx.font = 'bold 26px sans-serif';
        const numW = ctx.measureText(`${n}×`).width;
        ctx.restore();
        const pulse = 1.22;                // worst case (comboFlash=1)
        // number: right-aligned at ax, baseline baseY, scaled about (ax,baseY)
        const numTop = baseY - (26 * 0.78) * pulse;     // approx ascent
        const numLeft = ax - (numW + 6 + lbl.width) * pulse; // number + gap + label
        // label baseline baseY-2, right edge at ax-numW-6
        const labelBottom = (baseY - 2) + lbl.actualBoundingBoxDescent;
        const labelRight = ax - numW - 6;
        const bar = { left: ax - 84, right: ax, top: baseY + 10, bottom: baseY + 14 };
        const barOverlapsLabel = !(bar.top >= labelBottom) && (bar.left < labelRight); // vertical+horizontal
        return {
          n, numTop, numLeft, barBottom: bar.bottom, barRight: bar.right,
          barOverlapsLabel,
          fits: numTop >= 0 && numLeft >= 0 && bar.bottom <= H && bar.right <= W,
        };
      };
      comboCount = 9;  const narrow = measureMeter(9);
      comboCount = 100; const wide = measureMeter(100);
      // centered milestone floater (W/2, 132)
      ctx.save(); ctx.font = 'bold 22px sans-serif';
      const fMet = ctx.measureText('🔥 28× COMBO!');
      ctx.restore();
      const floaterTop = 132 - fMet.actualBoundingBoxAscent;
      const floaterBottom = 132 + fMet.actualBoundingBoxDescent;
      return {
        narrow, wide,
        floaterTop, floaterBottom,
        // clears top band (boss bar ~y32, round-clear bonus ~y90) and the
        // bottom-right meter (top ~y509 at worst-case pulse)
        floaterClearsTopBand: floaterTop > 90,
        floaterClearsMeter: floaterBottom < (H - 26 - (26 * 0.78) * 1.22),
        floaterOnCanvas: floaterBottom <= H,
      };
    });
    check('timer bar does not overlap the COMBO label (bottom-right meter)',
      !layout.narrow.barOverlapsLabel && !layout.wide.barOverlapsLabel, JSON.stringify(layout));
    check('combo meter fits on-canvas with no clipping (9× and 100×)',
      layout.narrow.fits && layout.wide.fits, JSON.stringify(layout));
    check('milestone combo floater clears the top band and the bottom-right meter',
      layout.floaterClearsTopBand && layout.floaterClearsMeter && layout.floaterOnCanvas, JSON.stringify(layout));
    await page.evaluate(() => { backToMenu(); });

    await page.evaluate(() => { localStorage.removeItem('cd_save'); });
    check('no console errors during combo tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 12: domain-split files (html/css + ordered js modules) wired & load over file:// ----
  // The game ships as separate files linked with classic <link>/<script src> tags
  // (NOT ES modules — those break on file://). The JS is split by domain into
  // ordered classic scripts that share global scope, so load order is load-bearing.
  // This guards against re-inlining, a broken reference, a dropped script, or an
  // accidental module tag, and confirms everything loads over file:// (= double-click).
  console.log('\n[12] Domain-split files (html/css/js)');
  {
    const html = readFileSync(resolve(ROOT, 'tower-defense.html'), 'utf8');
    // The ordered JS domain files (load order is dependency order — do not reorder).
    const JS_FILES = ['cd-core.js', 'cd-maps.js', 'cd-defs.js', 'cd-state.js',
                      'cd-game.js', 'cd-update.js', 'cd-render.js'];
    check('tower-defense.css file exists', existsSync(resolve(ROOT, 'tower-defense.css')));
    check('old monolithic tower-defense.js is gone', !existsSync(resolve(ROOT, 'tower-defense.js')));
    for (const f of JS_FILES) {
      check(`${f} file exists`, existsSync(resolve(ROOT, f)));
      check(`${f} starts with a 'use strict' directive`,
        /^\s*['"]use strict['"];/.test(readFileSync(resolve(ROOT, f), 'utf8')));
    }
    check('HTML links the external stylesheet',
      /<link[^>]+href=["']tower-defense\.css["']/.test(html));
    // Every domain file is referenced via a classic <script src>, in the right order.
    const srcOrder = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
    check('all domain JS files referenced via <script src>',
      JS_FILES.every(f => srcOrder.includes(f)), `found=${srcOrder.join(',')}`);
    check('domain JS files load in dependency order',
      JSON.stringify(srcOrder) === JSON.stringify(JS_FILES), `order=${srcOrder.join(',')}`);
    check('no script tag is an ES module (would break on file://)',
      !/<script[^>]+type=["']module["']/.test(html));
    check('HTML has no leftover inline <style> block', !/<style[\s>]/.test(html));
    // An inline <script> with a body (not a src include) would mean code was re-inlined.
    const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html);
    check('HTML has no leftover inline <script> code block', !inlineScript);

    const { page, consoleErrors } = await newPage(browser);
    // External stylesheet actually applied. NOTE: reading cssRules off a file://
    // stylesheet throws SecurityError, so instead assert a computed style the sheet
    // sets — the body background (#0d1117 = rgb(13,17,23)). If the link were broken
    // the UA default (rgba(0,0,0,0) / white) would show instead.
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('external stylesheet loaded & applied (body bg from css)',
      bodyBg === 'rgb(13, 17, 23)', `bodyBg=${bodyBg}`);
    // Globals from DIFFERENT domain files are present, proving they all executed and
    // share one global scope: beginGame lives in cd-game.js, draw in cd-render.js,
    // SFX in cd-core.js, TOWER_TYPES in cd-defs.js.
    const jsRan = await page.evaluate(() => typeof beginGame === 'function' &&
      typeof draw === 'function' && typeof SFX === 'object' && typeof TOWER_TYPES === 'object');
    check('all domain scripts executed & share global scope', jsRan);
    check('no console errors with split files', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------------------
  console.log('\n[13] Document metadata (favicon / viewport / OG — table stakes)');
  {
    const html = readFileSync(resolve(ROOT, 'tower-defense.html'), 'utf8');
    check('has a responsive viewport meta', /<meta[^>]+name=["']viewport["']/.test(html));
    check('has a meta description', /<meta[^>]+name=["']description["']/.test(html));
    check('has a theme-color meta', /<meta[^>]+name=["']theme-color["']/.test(html));
    check('declares an Open Graph title', /<meta[^>]+property=["']og:title["']/.test(html));
    // Favicon must be a self-contained data URI (offline-safe on file:// — no network fetch).
    const icon = html.match(/<link[^>]+rel=["']icon["'][^>]*>/);
    check('has a favicon link', !!icon, icon ? icon[0] : 'none');
    check('favicon is an inline data URI (no network request)',
      !!icon && /href=["']data:image\/svg\+xml,/.test(icon[0]), icon ? icon[0] : 'none');

    const { page, consoleErrors } = await newPage(browser);
    const fav = await page.evaluate(() => {
      const l = document.querySelector('link[rel="icon"]');
      return l ? l.getAttribute('href') : null;
    });
    check('favicon present in the live DOM', !!fav && fav.startsWith('data:image/svg+xml,'));
    check('no console errors with metadata', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 14: phantom enemy (wave-13 blinker, intangible mid-blink) ----
  console.log('\n[14] Phantom enemy (blink / intangibility)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w13, present from w13
      const w12 = buildWave(12).some(e => e.kind === 'phantom');
      const w13 = buildWave(13).filter(e => e.kind === 'phantom').length;

      // (b) focused blink mechanics with a single phantom + an overpowered tower
      enemies = []; projectiles = []; towers = [];
      const mid = pathLen * 0.4;
      const p0 = pointAt(mid);
      const ph = { kind:'phantom', hp:1000, maxHp:1000, spd:0, dist:mid,
                   x:p0.x, y:p0.y, px:p0.x, py:p0.y, armor:0, bounty:1, r:10,
                   color:'#39d0d8', flash:0, frozen:0, slow:0, blinkCd:0.0001 };
      enemies.push(ph);
      towers.push({ type:'gun', x:p0.x, y:p0.y, range:99999, dmg:1, rate:0.05,
                    cd:0, level:1, baseCost:50, invested:50, angle:0, mode:'first',
                    spec:null, dealt:0, kills:0, buffPower:0, flash:0 });
      const beforeDist = ph.dist;
      update(1/60);                              // blink fires this frame
      const blinked = ph.dist >= beforeDist + 50;
      const invulnAfterBlink = ph.blinkInvuln > 0;
      const targetSkipped = (pickTarget(towers[0]) === null);   // skipped while intangible
      const hpBefore = ph.hp;
      damage(ph, 500, null);
      const damageBlocked = ph.hp === hpBefore;  // damage no-ops mid-blink
      // let intangibility lapse (blinkCd just reset to 2.0, so no second blink)
      for (let i = 0; i < 40; i++) update(1/60);
      const targetableAgain = ph.blinkInvuln === 0 && pickTarget(towers[0]) !== null;
      const hpNow = ph.hp;
      damage(ph, 500, null);
      const damageAppliesAfter = ph.hp < hpNow;
      backToMenu();

      // (c) integration: a real wave-13+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 14 });
      backToMenu();
      localStorage.removeItem('cd_save');
      return { w12, w13, blinked, invulnAfterBlink, targetSkipped, damageBlocked,
               targetableAgain, damageAppliesAfter, run };
    });
    check('no phantoms before wave 13', r.w12 === false);
    check('phantoms spawn from wave 13', r.w13 >= 1, 'count=' + r.w13);
    check('phantom blinks forward (dist jumps ~58px)', r.blinked);
    check('phantom is intangible (blinkInvuln>0) right after a blink', r.invulnAfterBlink);
    check('pickTarget skips an intangible phantom', r.targetSkipped);
    check('damage() no-ops on an intangible phantom', r.damageBlocked);
    check('phantom becomes targetable again once the blink ends', r.targetableAgain);
    check('damage applies normally after the blink ends', r.damageAppliesAfter);
    check('wave-13+ run with phantoms reaches w>=14 alive', r.run.wave >= 14 && !r.run.gameOver,
      JSON.stringify(r.run));
    check('no console errors during phantom tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  console.log('\n[15] Upgrade panel pinned to lower-left corner');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 99999;
      const wrap = document.getElementById('gameWrap');
      // Place a tower well away from the lower-left (upper-right quadrant) and
      // open its menu — the panel must NOT track the tower's position.
      const t = { type:'gun', x: W - 60, y: 60, range:120, dmg:10, rate:0.5,
                  cd:0, level:1, baseCost:50, invested:50, angle:0, mode:'first',
                  spec:null, dealt:0, kills:0, buffPower:0, flash:0 };
      towers.push(t);
      showUpgrade(t);
      const up = document.getElementById('upgradePanel');
      const open = up.style.display === 'block';
      const left = up.offsetLeft;
      const bottomGap = wrap.offsetHeight - (up.offsetTop + up.offsetHeight);
      // bottom-anchored: clearing `top` keeps tall panels (spec choice) on-canvas
      const bottomAnchored = up.style.top === 'auto' && up.style.bottom !== '';
      // independence: move the tower far and reopen — panel stays put
      t.x = 40; t.y = H - 40; showUpgrade(t);
      const leftAgain = up.offsetLeft, bottomGapAgain = wrap.offsetHeight - (up.offsetTop + up.offsetHeight);
      hideUpgrade();
      backToMenu();
      localStorage.removeItem('cd_save');
      return { open, left, bottomGap, bottomAnchored, leftAgain, bottomGapAgain, wrapH: wrap.offsetHeight };
    });
    check('panel opens on tower select', r.open);
    check('panel hugs the left edge (offsetLeft small)', r.left <= 20, 'left=' + r.left);
    check('panel sits at the bottom (small bottom gap)', r.bottomGap >= 0 && r.bottomGap <= 20, 'gap=' + r.bottomGap);
    check('panel is bottom-anchored (top cleared, bottom set)', r.bottomAnchored);
    check('panel position is independent of tower location', r.leftAgain === r.left && r.bottomGapAgain === r.bottomGap,
      `left ${r.left}->${r.leftAgain}, gap ${r.bottomGap}->${r.bottomGapAgain}`);
    check('no console errors during panel-position tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 16: enemy HP difficulty scaling (1.80 multiplier as of v1.10.0) ----
  console.log('\n[16] Enemy HP difficulty scaling');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      campLevel = 1;
      // enemyTemplate uses the live formula; assert the 1.80 multiplier is applied
      // uniformly across waves. Expected = (18 + w*7 + w^1.9) * 1.80
      // * DIFFS.normal.hp (campScale=1 in quick mode).
      const dh = DIFFS['normal'].hp;
      const expect = (w) => (18 + w*7 + Math.pow(w, 1.9)) * 1.80 * dh;
      // prevBaseline(w) = the v1.9.2 formula (1.44 multiplier). The live value must
      // be strictly above it (it's now 1.80), so a revert to 1.44 would fail.
      const prevBaseline = (w) => (18 + w*7 + Math.pow(w, 1.9)) * 1.44 * dh;
      const samples = [1, 5, 10, 20, 30].map(w => {
        const got = enemyTemplate(w).hp;
        return { w, got, exp: expect(w), old: prevBaseline(w), ok: Math.abs(got - expect(w)) < 1e-6 };
      });
      // A boss (wave 5) scales off the same template HP, so it's tougher too.
      const tmpl = enemyTemplate(5);
      backToMenu();
      return { samples, tmplHp5: tmpl.hp };
    });
    for (const s of r.samples) {
      check(`enemy HP at wave ${s.w} matches the 1.80 formula`, s.ok,
        `got=${s.got.toFixed(1)} exp=${s.exp.toFixed(1)}`);
    }
    // Regression guard: HP must be the latest value, i.e. clearly above the prior
    // 1.44 baseline (a revert to 1.44 or 1.2 would fail this).
    check('wave-10 HP is the 1.80 value, strictly above the prior 1.44 baseline',
      r.samples[2].got > r.samples[2].old + 1e-6,
      `hp=${r.samples[2].got.toFixed(1)} prevBaseline=${r.samples[2].old.toFixed(1)}`);
    check('no console errors during HP-scaling tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 17: spec rework + poison buff (FEEDBACK balance, v1.10.0) ----
  console.log('\n[17] Spec rework + poison buff');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      const mk = (type, spec) => ({
        type, x: 200, y: 200, range: TOWER_TYPES[type].range, dmg: TOWER_TYPES[type].dmg,
        rate: TOWER_TYPES[type].rate, cd: 0, level: 1, baseCost: 50, invested: 50,
        angle: 0, mode: 'first', spec, dealt: 0, kills: 0, buffPower: 0.25, flash: 0
      });
      // Booster: Network now adds +10% power on top of its range (was range-only).
      const plain = effBuffPower(mk('buff', null));
      const net   = effBuffPower(mk('buff', 'network'));
      const over  = effBuffPower(mk('buff', 'overclock'));
      // Cannon: Mega Blast now also +15% dmg (was radius-only).
      const canPlain = effDmg(mk('cannon', null));
      const canMega  = effDmg(mk('cannon', 'mega'));
      // Frost: Shatter nerfed ×6 -> ×4.5 (run-warping solo carry, owner FEEDBACK).
      const frostPlain   = effDmg(mk('frost', null));
      const frostShatter = effDmg(mk('frost', 'shatter'));
      // Poison: base dmg bumped 6→7; DoT coefficient 2.6; armor corrosion −3/hit.
      const poisonBaseDmg = TOWER_TYPES.poison.dmg;
      const src = mk('poison', null);
      const foe = { kind:'shield', hp: 5000, x:200, y:200, r:13, armor: 10, dead:false,
                    blinkInvuln:0, flash:0, poison:null, slow:0, frozen:0 };
      const armorBefore = foe.armor;
      hitEnemy({ kind:'poison', target: foe, dmg: src.dmg, src, color:'#3fb950' });
      const armorAfter = foe.armor;
      const dotDps = foe.poison ? foe.poison.dps : 0;
      const hasReduceMotion = typeof reduceMotion === 'function';
      // Shop tooltip: the poison button's title should explain the armor corrosion.
      renderShop();
      const shopBtns = [...document.getElementById('shop').children];
      const poisonBtn = shopBtns.find(b => b.title && b.title.startsWith('Poison'));
      const poisonTip = poisonBtn ? poisonBtn.title : '';
      backToMenu();
      return { plain, net, over, canPlain, canMega, frostPlain, frostShatter,
               poisonBaseDmg, armorBefore, armorAfter, dotDps, hasReduceMotion, poisonTip };
    });
    check('Booster Network adds aura power (not range-only anymore)', r.net > r.plain + 1e-9,
      `plain=${r.plain.toFixed(3)} network=${r.net.toFixed(3)}`);
    check('Booster Overclock still the higher-power pick', r.over > r.net,
      `overclock=${r.over.toFixed(3)} network=${r.net.toFixed(3)}`);
    check('Cannon Mega Blast now adds ~15% damage', Math.abs(r.canMega - r.canPlain * 1.15) < 1e-6,
      `plain=${r.canPlain.toFixed(2)} mega=${r.canMega.toFixed(2)}`);
    check('Poison base damage buffed to 7', r.poisonBaseDmg === 7, `got ${r.poisonBaseDmg}`);
    check('Poison DoT uses the 2.6 coefficient', Math.abs(r.dotDps - r.poisonBaseDmg * 2.6) < 1e-6,
      `dps=${r.dotDps} expected=${(r.poisonBaseDmg * 2.6).toFixed(2)}`);
    check('Poison corrodes 3 armor per hit', r.armorBefore - r.armorAfter === 3,
      `before=${r.armorBefore} after=${r.armorAfter}`);
    check('Frost Shatter nerfed to exactly 4.5× (not the old ×6)',
      Math.abs(r.frostShatter - r.frostPlain * 4.5) < 1e-6,
      `plain=${r.frostPlain.toFixed(2)} shatter=${r.frostShatter.toFixed(2)}`);
    check('reduceMotion() helper exists (prefers-reduced-motion support)', r.hasReduceMotion);
    check('poison shop tooltip explains the armor corrosion', /corrod/i.test(r.poisonTip) && /armor/i.test(r.poisonTip),
      `tip="${r.poisonTip}"`);
    check('no console errors during spec/poison tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 18: game-speed preference persists across reload (bug fix, v1.10.0) ----
  console.log('\n[18] Game-speed preference persists');
  {
    // Set the speed pref, then load a FRESH page and confirm `speed` restored to 3×
    // (regression for: refresh/resume silently dropped to 1×, so towers appeared to
    // fire at their base cadence — "shoot at original speed" owner bug report).
    const page = await browser.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('cd_mute', '1'); localStorage.setItem('cd_speed', '3'); } catch (e) {} });
    await page.goto(GAME_URL, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const restored = { speed, btn: document.getElementById('speedBtn').textContent };
      toggleSpeed(); // 3 -> 1, should persist
      const afterToggle = { speed, stored: localStorage.getItem('cd_speed'), btn: document.getElementById('speedBtn').textContent };
      try { localStorage.removeItem('cd_speed'); } catch (e) {}
      return { restored, afterToggle };
    });
    check('speed restores to 3× from cd_speed on load', r.restored.speed === 3, `speed=${r.restored.speed}`);
    check('speed button label reflects the restored value', r.restored.btn.includes('3x'), `btn="${r.restored.btn}"`);
    check('toggling speed persists the new value to cd_speed', r.afterToggle.stored === '1',
      `stored=${r.afterToggle.stored}`);
    await page.close();
  }

  // ---- Test 19: Reset All wipes every cd_ key + in-memory state (v1.11.0) ----
  console.log('\n[19] Reset All (full data wipe)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // seed persistent data across several cd_ keys
      meta.chips = 500; meta.talents.firepower = 3; meta.stats.runs = 12; saveMeta();
      localStorage.setItem('cd_best_classic_normal', '27');
      localStorage.setItem('cd_campaign', '9');
      localStorage.setItem('cd_speed', '3');
      const before = Object.keys(localStorage).filter(k => k.indexOf('cd_') === 0).length;
      resetAllData();                       // first click: arms, no wipe
      const armed = !!localStorage.getItem('cd_meta');
      const armedLabel = document.getElementById('resetBtn').textContent;
      resetAllData();                       // second click within 3s: wipes
      const after = Object.keys(localStorage).filter(k => k.indexOf('cd_') === 0);
      return { before, armed, armedLabel, afterCount: after.length, afterKeys: after,
               chips: meta.chips, firepower: meta.talents.firepower, runs: meta.stats.runs, speed };
    });
    check('seeded multiple cd_ keys before reset', r.before >= 4, `count=${r.before}`);
    check('first click ARMS but does not wipe', r.armed === true && /again/i.test(r.armedLabel),
      `label="${r.armedLabel}"`);
    check('second click wipes ALL cd_ keys', r.afterCount === 0, `left=${JSON.stringify(r.afterKeys)}`);
    check('in-memory meta reset to factory (chips/talents/runs = 0)',
      r.chips === 0 && r.firepower === 0 && r.runs === 0,
      `chips=${r.chips} firepower=${r.firepower} runs=${r.runs}`);
    check('speed pref reset to 1×', r.speed === 1, `speed=${r.speed}`);
    check('no console errors during reset test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 20: concurrent waves (start a wave while one is running, v1.12.0) ----
  console.log('\n[20] Concurrent waves');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame(); gold = 999999;
      __cdGodTowers(8);
      autoWave = false;
      startWave(); startWave(); startWave();        // 3 parallel waves
      const parallel = { wave, spawners: spawners.length, active: waveActive };
      const w0 = wave; startWave();                  // capped: 4th must be blocked
      const capped = wave === w0;
      // drive to a full clear -> bundled settlement of waves 1,2,3 (no draft, no 5x)
      let g = 0; while ((spawners.length || enemies.length || pendingSpawns.length) && !draftOpen && g < 300000) { update(1/60); g++; }
      const settled = { wave, lastSettled: lastSettledWave, active: waveActive };
      // rush waves 4 & 5 -> crosses wave 5 -> exactly one deferred draft on clear
      startWave(); startWave();
      g = 0; while ((spawners.length || enemies.length || pendingSpawns.length) && !draftOpen && g < 300000) { update(1/60); g++; }
      const draftState = { draftOpen, pendingDrafts, wave };
      if (draftOpen) document.getElementById('draftCards').children[0].click();
      const afterPick = { draftOpen, pendingDrafts, perks: runPerks.length };
      backToMenu();
      return { parallel, capped, settled, draftState, afterPick };
    });
    check('three waves run as parallel spawners at once', r.parallel.spawners === 3 && r.parallel.wave === 3,
      `spawners=${r.parallel.spawners} wave=${r.parallel.wave}`);
    check('4th wave blocked at the concurrent cap (3)', r.capped, `wave went to ${r.parallel.wave}`);
    check('field fully clears and settles all bundled waves', r.settled.lastSettled === 3 && r.settled.active === false,
      `lastSettled=${r.settled.lastSettled} active=${r.settled.active}`);
    check('a rush across wave 5 defers exactly one draft', r.draftState.draftOpen === true && r.draftState.pendingDrafts === 1,
      `draftOpen=${r.draftState.draftOpen} pending=${r.draftState.pendingDrafts}`);
    check('picking the deferred draft clears the queue and resumes', r.afterPick.draftOpen === false && r.afterPick.pendingDrafts === 0 && r.afterPick.perks === 1,
      `open=${r.afterPick.draftOpen} pending=${r.afterPick.pendingDrafts} perks=${r.afterPick.perks}`);
    check('no console errors during concurrent-wave test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  await browser.close();

  console.log(`\n${'='.repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('All green ✅');
  process.exit(0);
}

main().catch((err) => { console.error('Harness crashed:', err); process.exit(1); });
