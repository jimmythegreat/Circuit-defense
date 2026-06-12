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
      // v1.16.0: the unlock line moved from the run-on #ovText into a styled
      // .ovSection.ach row inside #ovDetails — read the whole overlay body.
      const txt = document.getElementById('overlay').textContent;
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

  // ---- Test 16: enemy HP difficulty scaling (steepened curve as of v1.13.3) ----
  console.log('\n[16] Enemy HP difficulty scaling');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      campLevel = 1;
      // Live formula = (18 + w*7 + 1.25*w^1.9) * 1.80 * DIFFS.normal.hp (campScale=1).
      // The 1.25 on the superlinear term steepens the curve (v1.13.3).
      const dh = DIFFS['normal'].hp;
      const expect = (w) => (18 + w*7 + 1.25 * Math.pow(w, 1.9)) * 1.80 * dh;
      // prevBaseline = the v1.10.0 formula (no 1.25 on w^1.9). Live must be above it,
      // and the gap must GROW with wave (steeper curve), while staying <25% everywhere.
      const prevBaseline = (w) => (18 + w*7 + Math.pow(w, 1.9)) * 1.80 * dh;
      const samples = [1, 5, 10, 20, 30, 50].map(w => {
        const got = enemyTemplate(w).hp;
        return { w, got, exp: expect(w), prev: prevBaseline(w),
                 ok: Math.abs(got - expect(w)) < 1e-6, pct: (got / prevBaseline(w) - 1) * 100 };
      });
      const tmpl = enemyTemplate(5);
      backToMenu();
      return { samples, tmplHp5: tmpl.hp };
    });
    for (const s of r.samples) {
      check(`enemy HP at wave ${s.w} matches the steepened (1.25·w^1.9) formula`, s.ok,
        `got=${s.got.toFixed(1)} exp=${s.exp.toFixed(1)}`);
    }
    // The boost over the prior curve must GROW with wave (later waves harder) ...
    const pcts = r.samples.map(s => s.pct);
    const monotonic = pcts.every((p, i) => i === 0 || p >= pcts[i - 1] - 1e-9);
    check('the HP boost over the prior curve grows with wave (steeper ramp)', monotonic,
      `pcts=${pcts.map(p => p.toFixed(1)).join(',')}`);
    // ... yet never exceed the ≤25%/number guardrail at any sampled wave.
    check('boost stays within the ≤25% guardrail at every wave', pcts.every(p => p <= 25 + 1e-6),
      `max=${Math.max(...pcts).toFixed(1)}%`);
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

  // ---- Test 21: milestone-bonus (run-perk) hover tooltip (v1.12.1) ----
  console.log('\n[21] Milestone-bonus hover tooltip');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      runPerks = [
        { id: 'sharp', icon: '🎯', name: 'Sharpshooter', rarity: 'common' },
        { id: 'diamond', icon: '💎', name: 'Diamond Core', rarity: 'legendary' },
        { id: 'crit', icon: '🍀', name: 'Crit Systems', rarity: 'rare' },
      ];
      const hasHelper = typeof drawPerkTooltip === 'function';
      // descriptions the tooltip shows are looked up from PERKS by id (works for old saves)
      const descs = runPerks.map(p => { const d = PERKS.find(pp => pp.id === p.id); return d ? d.desc : null; });
      // hover-index math: icons at x=12,34,56; band y∈[2,28]. Hover the 2nd (legendary).
      mouseX = 36; mouseY = 14;
      const idx = Math.floor((mouseX - 8) / 22);
      let drewWithHover = true; try { draw(); } catch (e) { drewWithHover = 'ERR:' + e.message; }
      mouseX = -100; mouseY = -100;
      let drewNoHover = true; try { draw(); } catch (e) { drewNoHover = 'ERR:' + e.message; }
      backToMenu();
      return { hasHelper, descs, idx, drewWithHover, drewNoHover };
    });
    check('drawPerkTooltip helper exists', r.hasHelper);
    check('perk descriptions resolve from PERKS by id', r.descs.every(d => d && d.length > 0),
      `descs=${JSON.stringify(r.descs)}`);
    check('hover-index math selects the correct perk', r.idx === 1, `idx=${r.idx}`);
    check('draw() renders cleanly with a perk hover active', r.drewWithHover === true, `${r.drewWithHover}`);
    check('draw() renders cleanly with no hover', r.drewNoHover === true, `${r.drewNoHover}`);
    check('no console errors during tooltip test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 22: damage-number floater aggregation (v1.12.2) ----
  console.log('\n[22] Damage-number aggregation');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      floaters.length = 0;
      // 4 gold pops clustered near (300,300) -> merge into one +25; one far away stays
      addFloater(300, 300, '+5', '#ffd866', 14, { merge: 'gold', value: 5, prefix: '+', radius: 36 });
      addFloater(310, 305, '+7', '#ffd866', 14, { merge: 'gold', value: 7, prefix: '+', radius: 36 });
      addFloater(295, 310, '+3', '#ffd866', 14, { merge: 'gold', value: 3, prefix: '+', radius: 36 });
      addFloater(305, 298, '+10', '#ffd866', 14, { merge: 'gold', value: 10, prefix: '+', radius: 36 });
      addFloater(600, 400, '+8', '#ffd866', 14, { merge: 'gold', value: 8, prefix: '+', radius: 36 });
      // two close crits -> merge to CRIT 80!
      addFloater(200, 200, 'CRIT 50!', '#ff7b42', 15, { merge: 'crit', value: 50, prefix: 'CRIT ', suffix: '!', radius: 28 });
      addFloater(210, 205, 'CRIT 30!', '#ff7b42', 15, { merge: 'crit', value: 30, prefix: 'CRIT ', suffix: '!', radius: 28 });
      // an untagged floater is never merged
      addFloater(300, 300, 'LEVEL UP!', '#3fb950', 14);
      const gold = floaters.filter(f => f.merge === 'gold').map(f => f.text).sort();
      const crit = floaters.filter(f => f.merge === 'crit').map(f => f.text);
      const plain = floaters.filter(f => !f.merge).length;
      backToMenu();
      return { gold, crit, plain, total: floaters.length };
    });
    check('clustered gold pops merge into one summed floater', r.gold.includes('+25'),
      `gold=${JSON.stringify(r.gold)}`);
    check('a distant gold pop stays separate', r.gold.includes('+8') && r.gold.length === 2,
      `gold=${JSON.stringify(r.gold)}`);
    check('nearby crits merge (summed damage)', r.crit.length === 1 && r.crit[0] === 'CRIT 80!',
      `crit=${JSON.stringify(r.crit)}`);
    check('untagged floaters never merge', r.plain === 1, `plain=${r.plain}`);
    check('no console errors during aggregation test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 23: Settings panel — shake/particle prefs persist & apply (v1.13.0) ----
  console.log('\n[23] Settings (shake / particle density)');
  {
    // Use an init script so cd_shake/cd_particles are present at module-load time.
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    await page.addInitScript(() => { try { localStorage.setItem('cd_mute', '1'); localStorage.setItem('cd_shake', '0'); localStorage.setItem('cd_particles', '0.5'); } catch (e) {} });
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.evaluate(INSTALL_DRIVER);
    const r = await page.evaluate(() => {
      const restored = { shakeEnabled, particleDensity };
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      // particle density scaling
      setParticles(0); particles.length = 0; addExplosion(0, 0, '#fff', 20, 100); const off = particles.length;
      setParticles(0.5); particles.length = 0; addExplosion(0, 0, '#fff', 20, 100); const half = particles.length;
      setParticles(1); particles.length = 0; addExplosion(0, 0, '#fff', 20, 100); const full = particles.length;
      // shake gate: with shake disabled, draw() must not throw
      setShake(false); shake = 20; let drew = true; try { draw(); } catch (e) { drew = 'ERR:' + e.message; }
      const persisted = { cd_shake: localStorage.getItem('cd_shake'), cd_particles: localStorage.getItem('cd_particles') };
      backToMenu();
      return { restored, off, half, full, drew, persisted };
    });
    check('shake/particle prefs restore from localStorage on load', r.restored.shakeEnabled === false && r.restored.particleDensity === 0.5,
      `restored=${JSON.stringify(r.restored)}`);
    check('particle density scales Off/Reduced/Full', r.off === 0 && r.half === 10 && r.full === 20,
      `off=${r.off} half=${r.half} full=${r.full}`);
    check('toggles persist to localStorage', r.persisted.cd_shake === '0' && r.persisted.cd_particles === '1',
      `persisted=${JSON.stringify(r.persisted)}`);
    check('draw() renders cleanly with shake disabled', r.drew === true, `${r.drew}`);
    check('no console errors during settings test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 24: tower range preview on shop hover (v1.13.1) ----
  console.log('\n[24] Shop range preview on hover');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();
      renderShop();
      const btn = [...document.getElementById('shop').children].find(b => b.title && b.title.startsWith('Sniper'));
      const hasHandlers = typeof btn.onpointerenter === 'function' && typeof btn.onpointerleave === 'function';
      const titleHasRange = /range \d+/.test(btn.title);
      btn.onpointerenter(); const afterEnter = hoveredShop;
      // draw with a shop hover active (no selection) must not throw
      selectedShop = null; let drewHover = true; try { draw(); } catch (e) { drewHover = 'ERR:' + e.message; }
      btn.onpointerleave(); const afterLeave = hoveredShop;
      backToMenu();
      return { hasHandlers, titleHasRange, afterEnter, afterLeave, drewHover };
    });
    check('shop buttons have pointer-enter/leave handlers', r.hasHandlers);
    check('shop tooltip includes the tower range', r.titleHasRange);
    check('hovering sets hoveredShop, leaving clears it', r.afterEnter === 'sniper' && r.afterLeave === null,
      `enter=${r.afterEnter} leave=${r.afterLeave}`);
    check('draw() renders cleanly with a shop hover active', r.drewHover === true, `${r.drewHover}`);
    check('no console errors during shop-hover test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 25: master volume slider (v1.13.2) ----
  console.log('\n[25] Volume slider');
  {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    // start muted=0 so the gain node gets created; preset a non-default cd_vol
    await page.addInitScript(() => { try { localStorage.setItem('cd_mute', '0'); localStorage.setItem('cd_vol', '0.45'); } catch (e) {} });
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.evaluate(INSTALL_DRIVER);
    const r = await page.evaluate(() => {
      muted = false;                       // INSTALL_DRIVER sets muted=true; undo for this test
      const restored = masterVol;          // expect 0.45 from cd_vol
      tone(440, 0.02, 'square', 0.01);     // create the master gain node
      const gainAtRestore = _masterGain ? +_masterGain.gain.value.toFixed(3) : null;
      setVolume(0); const g0 = +_masterGain.gain.value.toFixed(3);
      setVolume(30); const g30 = +_masterGain.gain.value.toFixed(3); const persisted = localStorage.getItem('cd_vol');
      setVolume(100); const g100 = +_masterGain.gain.value.toFixed(3);
      // the Settings panel renders a volume slider
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      openSettings();
      const hasSlider = !!document.querySelector('#settingsBody input.setSlider[type=range]');
      closeSettings();
      backToMenu();
      return { restored, gainAtRestore, g0, g30, g100, persisted, hasSlider };
    });
    check('volume restores from cd_vol on load', Math.abs(r.restored - 0.45) < 1e-6, `restored=${r.restored}`);
    check('master gain node initialises at the restored volume', r.gainAtRestore === 0.45, `gain=${r.gainAtRestore}`);
    check('setVolume scales the master gain 0/30/100', r.g0 === 0 && r.g30 === 0.3 && r.g100 === 1,
      `g0=${r.g0} g30=${r.g30} g100=${r.g100}`);
    check('setVolume persists cd_vol', r.persisted === '0.3', `cd_vol=${r.persisted}`);
    check('Settings panel renders a volume slider', r.hasSlider);
    check('no console errors during volume test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 26: difficulty rebalance + What's New / Settings toggles (v1.13.6) ----
  console.log('\n[26] Difficulty rebalance + panel toggles');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const d = {
        easyHp: DIFFS.easy.hp, easyLives: DIFFS.easy.lives, easyGold: DIFFS.easy.gold,
        normalHp: DIFFS.normal.hp, normalLives: DIFFS.normal.lives, hardHp: DIFFS.hard.hp,
      };
      // What's New toggle: open-by-default -> close -> open
      const wn = document.getElementById('whatsnew');
      const wn0 = getComputedStyle(wn).display;
      toggleWhatsNew(); const wn1 = getComputedStyle(wn).display;
      toggleWhatsNew(); const wn2 = getComputedStyle(wn).display;
      // Settings toggle: force closed -> open (body filled) -> close
      const sp = document.getElementById('settingsPanel');
      sp.style.display = 'none';
      toggleSettings(); const set1 = getComputedStyle(sp).display; const filled = document.getElementById('settingsBody').innerHTML.length > 0;
      toggleSettings(); const set2 = getComputedStyle(sp).display;
      document.getElementById('whatsnew').style.display = 'none';
      backToMenu();
      return { d, wn0, wn1, wn2, set1, filled, set2 };
    });
    check('Easy is now very easy (hp 0.6, +gold/+lives)', r.d.easyHp === 0.6 && r.d.easyGold === 190 && r.d.easyLives === 36,
      `hp=${r.d.easyHp} gold=${r.d.easyGold} lives=${r.d.easyLives}`);
    check('Normal eased a touch (hp 0.85, lives 22)', r.d.normalHp === 0.85 && r.d.normalLives === 22,
      `hp=${r.d.normalHp} lives=${r.d.normalLives}`);
    check('difficulty stays ordered easy < normal < hard (hp)', r.d.easyHp < r.d.normalHp && r.d.normalHp < r.d.hardHp,
      `${r.d.easyHp} / ${r.d.normalHp} / ${r.d.hardHp}`);
    check("What's New button toggles (open→close→open)", r.wn0 !== 'none' && r.wn1 === 'none' && r.wn2 !== 'none',
      `${r.wn0} -> ${r.wn1} -> ${r.wn2}`);
    check('Settings button toggles open (panel shows + body renders)', r.set1 === 'flex' && r.filled === true,
      `display=${r.set1} filled=${r.filled}`);
    check('Settings button toggles closed on second click', r.set2 === 'none', `display=${r.set2}`);
    check('no console errors during toggle/difficulty test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 27: What's New entries show time alongside date (v1.13.7) ----
  console.log("\n[27] What's New date + time");
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      openWhatsNew();
      const list = document.getElementById('wnList');
      const first = CHANGELOG_ENTRIES[0];
      const firstRow = list.children[0];
      const firstDateTxt = firstRow.querySelector('.wndate').textContent;
      // The newest entry carries a time and the rendered date cell includes it.
      const newestHasTime = !!first.time;
      const showsTime = newestHasTime && firstDateTxt.includes(first.date) && firstDateTxt.includes(first.time);
      // An older entry without a time renders just its date (graceful — no "undefined").
      const older = CHANGELOG_ENTRIES.find(e => !e.time);
      const olderIdx = CHANGELOG_ENTRIES.indexOf(older);
      const olderTxt = older ? list.children[olderIdx].querySelector('.wndate').textContent.trim() : '';
      const olderDateOnly = older ? (olderTxt === older.date) : true;
      const noUndefined = !firstDateTxt.includes('undefined') && !olderTxt.includes('undefined');
      document.getElementById('whatsnew').style.display = 'none';
      return { newestHasTime, showsTime, olderDateOnly, noUndefined };
    });
    check('newest entry has a time field', r.newestHasTime);
    check('date cell shows both date and time for timestamped entry', r.showsTime);
    check('older (timeless) entry still shows just its date', r.olderDateOnly);
    check('no "undefined" leaks into the date cell', r.noUndefined);
    check('no console errors during date+time test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 28: Per-map visual themes (v1.13.8) ----
  console.log('\n[28] Map themes');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // Each named quick-map resolves to its own fixed theme key.
      gameMode = 'quick'; diffKey = 'easy';
      mapKey = 'classic'; beginGame(); const classicTheme = mapTheme;
      mapKey = 'spiral';  beginGame(); const spiralTheme  = mapTheme;
      mapKey = 'serpent'; beginGame(); const serpentTheme = mapTheme;
      mapKey = 'mayhem';  beginGame(); const mayhemTheme  = mapTheme;
      // Classic is deterministic across runs; mayhem is the animated chaos palette.
      mapKey = 'classic'; beginGame(); const classicAgain = mapTheme;
      // Campaign rolls a tame palette (always a valid static THEMES key, never chaos).
      gameMode = 'campaign'; campLevel = 1;
      const campKeys = [];
      for (let i = 0; i < 12; i++) { beginGame(); campKeys.push(mapTheme); }
      const campAllTame = campKeys.every(k => !!THEMES[k]);
      // mapPalette() returns a usable palette for both a static theme and chaos.
      gameMode = 'quick'; mapKey = 'classic'; beginGame();
      const staticPal = mapPalette();
      mapKey = 'mayhem'; beginGame();
      const chaosPal = mapPalette();
      const palOk = !!(staticPal.bgIn && staticPal.pMid && staticPal.dash &&
                       chaosPal.bgIn && chaosPal.pMid && chaosPal.dash);
      // draw() renders cleanly under the animated chaos palette.
      let drew = true; try { draw(); } catch (e) { drew = false; }
      // Save/resume round-trips the resolved palette key (campaign parity).
      gameMode = 'campaign'; campLevel = 3; beginGame();
      const savedTheme = mapTheme;
      saveRun();
      mapTheme = 'circuit';           // clobber, then resume should restore it
      loadRun();
      const resumedTheme = mapTheme;
      localStorage.removeItem('cd_save');
      backToMenu();
      return {
        classicTheme, spiralTheme, serpentTheme, mayhemTheme, classicAgain,
        distinct: new Set([classicTheme, spiralTheme, serpentTheme]).size === 3,
        campAllTame, palOk, drew, savedTheme, resumedTheme,
      };
    });
    check('each named quick-map has a distinct theme', r.distinct,
      `${r.classicTheme}/${r.spiralTheme}/${r.serpentTheme}`);
    check('classic theme is deterministic across runs', r.classicTheme === r.classicAgain,
      `${r.classicTheme} vs ${r.classicAgain}`);
    check('mayhem uses the animated chaos palette', r.mayhemTheme === 'chaos', `${r.mayhemTheme}`);
    check('campaign always rolls a tame (non-chaos) palette', r.campAllTame);
    check('mapPalette() yields full palettes for static + chaos', r.palOk);
    check('draw() renders cleanly under the chaos palette', r.drew === true, `${r.drew}`);
    check('save→resume restores the run palette key', r.resumedTheme === r.savedTheme,
      `saved=${r.savedTheme} resumed=${r.resumedTheme}`);
    check('no console errors during map-theme test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 29: Responsive / mobile layout (v1.14.0) ----
  console.log('\n[29] Mobile layout');
  {
    const { page, consoleErrors } = await newPage(browser);
    // Phone viewport — the media queries fire on real CSS px here (the live
    // preview clamps width, so this Playwright run is the source of truth).
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await page.evaluate(() => {
      const innerW = window.innerWidth;
      const ovf = () => document.documentElement.scrollWidth <= innerW + 1; // no horizontal scroll
      const right = sel => Math.round(document.querySelector(sel).getBoundingClientRect().right);
      const pos = sel => getComputedStyle(document.querySelector(sel)).position;
      // Start screen: overlay detaches to a full-viewport fixed layer, button row wraps.
      const startFixed = pos('#startScreen') === 'fixed';
      const startBtnsInside = right('#startScreen > div:last-child') <= innerW;
      const startNoOverflow = ovf();
      // Talent panel: fixed + scrollable so all talents are reachable; no horizontal overflow.
      openTalents();
      const tp = document.getElementById('talentPanel');
      const talentFixed = getComputedStyle(tp).position === 'fixed';
      const talentScrolls = tp.scrollHeight > tp.clientHeight; // 20 talents > one phone screen
      const talentNoOverflow = ovf();
      closeTalents();
      // In-game chrome stays within the viewport.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame();
      const canvasInside = right('#game') <= innerW;
      const hudInside = right('#hud') <= innerW;
      const shopInside = right('#shop') <= innerW;
      const ingameNoOverflow = ovf();
      // Draft modal also detaches + fits.
      openDraft();
      const draftFixed = getComputedStyle(document.getElementById('draftModal')).position === 'fixed';
      const draftNoOverflow = ovf();
      const card = document.getElementById('draftCards').children[0];
      if (card) card.click();
      backToMenu();
      return { startFixed, startBtnsInside, startNoOverflow, talentFixed, talentScrolls,
               talentNoOverflow, canvasInside, hudInside, shopInside, ingameNoOverflow,
               draftFixed, draftNoOverflow, innerW };
    });
    // Desktop: media queries must NOT apply — overlays stay canvas-bound (absolute).
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => ({
      startAbsolute: getComputedStyle(document.getElementById('startScreen')).position === 'absolute',
    }));
    check('phone: start screen detaches to a fixed full-viewport overlay', m.startFixed);
    check('phone: start-screen button row wraps inside the viewport', m.startBtnsInside, `right=${m.innerW}`);
    check('phone: no horizontal overflow on the start screen', m.startNoOverflow);
    check('phone: talent panel is fixed and vertically scrollable', m.talentFixed && m.talentScrolls);
    check('phone: no horizontal overflow with talents open', m.talentNoOverflow);
    check('phone: canvas/HUD/shop stay within the viewport in-game', m.canvasInside && m.hudInside && m.shopInside);
    check('phone: no horizontal overflow during gameplay', m.ingameNoOverflow);
    check('phone: draft modal detaches (fixed) without overflow', m.draftFixed && m.draftNoOverflow);
    check('desktop: overlays remain canvas-bound (absolute, media not applied)', d.startAbsolute);
    check('no console errors during mobile-layout test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  console.log('\n[30] Mobile deep-dive #2 — board size + What\'s New default (v1.15.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const clearWn = () => page.evaluate(() => {
      try { localStorage.removeItem('cd_wnopen'); localStorage.removeItem('cd_wnclosed'); } catch (e) {}
    });
    // --- Portrait phone: load FRESH at phone size so initWhatsNew() evaluates the
    // small-screen default. The What's New rail used to open full-width below the
    // board and bury it ("shown behind the game"); it must now start CLOSED.
    await page.setViewportSize({ width: 390, height: 844 });
    await clearWn();
    await page.reload({ waitUntil: 'load' });
    const portrait = await page.evaluate(() => {
      const disp = s => getComputedStyle(document.querySelector(s)).display;
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame();
      const boardH = Math.round(document.querySelector('#game').getBoundingClientRect().height);
      return { wnHidden: disp('#whatsnew') === 'none', rotateShown: disp('#rotateHint') === 'block', boardH };
    });
    // Tapping ✨ What's New opens it AND persists the opt-in (cd_wnopen) so a phone
    // player who wants it keeps it across reloads.
    const opensOnTap = await page.evaluate(() => {
      openWhatsNew();
      return getComputedStyle(document.querySelector('#whatsnew')).display !== 'none'
        && localStorage.getItem('cd_wnopen') === '1';
    });
    await page.evaluate(() => backToMenu());

    // --- Landscape phone: the canvas is sized off viewport HEIGHT, so the board
    // grows; the chrome compacts so the controls (Start Wave) stay on-screen.
    await page.setViewportSize({ width: 844, height: 390 });
    await clearWn();
    await page.reload({ waitUntil: 'load' });
    const land = await page.evaluate(() => {
      const disp = s => getComputedStyle(document.querySelector(s)).display;
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame();
      const boardH = Math.round(document.querySelector('#game').getBoundingClientRect().height);
      const ctlBottom = document.querySelector('#controls').getBoundingClientRect().bottom;
      return {
        boardH,
        rotateHidden: disp('#rotateHint') === 'none',
        hintHidden: disp('.hint') === 'none',
        wnHidden: disp('#whatsnew') === 'none',
        ctlReachable: ctlBottom <= window.innerHeight + 1,
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      };
    });
    await page.evaluate(() => backToMenu());

    // --- Desktop: the default is unchanged — What's New opens, rotate hint hidden.
    await page.setViewportSize({ width: 1280, height: 800 });
    await clearWn();
    await page.reload({ waitUntil: 'load' });
    const desktop = await page.evaluate(() => {
      const disp = s => getComputedStyle(document.querySelector(s)).display;
      return { wnOpen: disp('#whatsnew') !== 'none', rotateHidden: disp('#rotateHint') === 'none' };
    });

    check('phone portrait: What\'s New starts collapsed (no longer buries the board)', portrait.wnHidden);
    check('phone portrait: "rotate for a bigger board" hint is shown', portrait.rotateShown);
    check('phone: tapping What\'s New opens it and persists the opt-in', opensOnTap);
    check('phone landscape: board grows taller than the portrait board',
          land.boardH > portrait.boardH, `landscape=${land.boardH} portrait=${portrait.boardH}`);
    check('phone landscape: rotate hint + hotkey hint + What\'s New all hidden',
          land.rotateHidden && land.hintHidden && land.wnHidden);
    check('phone landscape: controls stay on-screen (Start Wave reachable)', land.ctlReachable);
    check('phone landscape: no horizontal overflow', land.noOverflow);
    check('desktop: What\'s New still opens by default; rotate hint hidden',
          desktop.wnOpen && desktop.rotateHidden);
    check('no console errors during mobile board/What\'s New test',
          consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 31: End-of-run scoring + restyled overlay (v1.16.0) ----
  console.log('\n[31] End-of-run scoring + restyled overlay (v1.16.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      localStorage.removeItem('cd_bestscore');
      // --- Defeat run: known state → deterministic score; check the restyled overlay.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      wave = 12; kills = 100; lives = 5; gold = 200; comboBest = 8; victory = false;
      towers = [];                                  // 0 towers → effMult 1; normal chipMult 1
      const sc = computeScore();
      // raw = 12*100 + 100*5 + 5*120 + 200 + 8*25 = 1200+500+600+200+200 = 2700
      const expected = 2700;
      endGame();
      const ov = document.getElementById('overlay');
      const scored = ov.classList.contains('scored');
      const grade = document.querySelector('.ovGrade').textContent;      // prog 12/30 = .4 → 'D'
      const numText = document.querySelector('.ovScoreNum .num').textContent;
      const gridCells = document.querySelectorAll('#ovDetails .scoreGrid .cell').length;
      const bestPersisted = +localStorage.getItem('cd_bestscore');
      const newBestShown = !!document.querySelector('.ovScoreNum .best.newbest');
      backToMenu();

      // --- Victory run: flawless (no life lost) → grade S, and a higher score → new best.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; beginGame();
      wave = victoryWave(); kills = 500; lives = 10; gold = 400; comboBest = 20;
      towers = [];
      winGame();                                    // victory=true, livesLostThisRun=false → S
      const winGrade = document.querySelector('.ovGrade').textContent;
      const winNewBest = !!document.querySelector('.ovScoreNum .best.newbest');
      const winBest = +localStorage.getItem('cd_bestscore');
      backToMenu();
      ['cd_bestscore', 'cd_best_classic_normal', 'cd_best_classic_hard',
       'cd_best_normal', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      return { scOk: sc.score === expected, scScore: sc.score, expected, scored, grade,
               numLen: numText.length, gridCells, bestPersisted, newBestShown,
               winGrade, winNewBest, winBest };
    });
    check('computeScore() matches the documented formula', r.scOk, `got ${r.scScore}, want ${r.expected}`);
    check('overlay gains the .scored class (score UI shown)', r.scored);
    check('defeat at 40% of goal grades D', r.grade === 'D', r.grade);
    check('score number renders in the hero', r.numLen > 0);
    check('stats grid shows 6 cells', r.gridCells === 6, String(r.gridCells));
    check('best score persisted to cd_bestscore', r.bestPersisted === r.expected, String(r.bestPersisted));
    check('first run flags a new best score', r.newBestShown);
    check('flawless victory grades S', r.winGrade === 'S', r.winGrade);
    check('higher-scoring victory flags a new best', r.winNewBest);
    check('best score updates to the higher victory score', r.winBest > r.expected, String(r.winBest));
    check('no console errors during scoring test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 32: economy trim — front-loaded gold snowball (FEEDBACK balance, v1.16.1) ----
  console.log('\n[32] Economy trim — front-loaded gold snowball (v1.16.1)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      // (1) Per-kill bounty now uses the trimmed flat term: (3 + w*0.6), not (4 + w*0.6).
      const dB = DIFFS['normal'].bounty;
      const bountyExp = (w) => Math.max(2, Math.round((3 + w * 0.6) * dB));
      const bountySamples = [1, 5, 10, 20].map(w => {
        const got = enemyTemplate(w).bounty;
        const prev = Math.max(2, Math.round((4 + w * 0.6) * dB));   // pre-v1.16.1
        return { w, got, exp: bountyExp(w), prev,
                 ok: got === bountyExp(w), cutPct: (1 - got / prev) * 100 };
      });
      // (2) Drive a clean 10-wave run with god towers and capture two figures:
      //     • preDraftChest — gold the instant the FIRST draft opens (end of wave 5, before any
      //       perk is picked). This is RNG-free: god towers collect every (deterministic) bounty,
      //       and no random draft perk has applied yet — so it's the true economy-trim signal.
      //       (Old pre-v1.16.1 economy ≈ 1003 here; trimmed to 875 — the documented ~−13%.)
      //     • warChest — gold after wave 10. Used only as a loose sanity floor: it includes the
      //       wave-5/10 auto-picked draft perks (card[0]), which can be gold perks, so its exact
      //       value is non-deterministic — do NOT assert a tight upper bound on it (that flaked).
      beginGame();
      towers.length = 0;
      for (let gx = 80; gx <= 820; gx += 120)
        for (let gy = 60; gy <= 500; gy += 120) {
          if (distToPath(gx, gy) < 34) continue;
          if (towers.some(t => Math.hypot(t.x - gx, t.y - gy) < 32)) continue;
          towers.push({ type:'gun', x:gx, y:gy, range:2000, dmg:100000, rate:0.05, cd:0,
                        level:1, baseCost:60, invested:60, angle:0, mode:'first', spec:null,
                        dealt:0, kills:0, buffPower:0.25, flash:0 });
        }
      let preDraftChest = null;
      const pickFirstCard = () => {
        if (preDraftChest === null) preDraftChest = Math.floor(gold); // snapshot BEFORE the pick
        const c = document.getElementById('draftCards'); if (c && c.children.length) c.children[0].click();
      };
      for (let target = 1; target <= 10; target++) {
        startWave();
        let safety = 0;
        while ((waveActive || enemies.length ||
               (typeof pendingSpawns !== 'undefined' && pendingSpawns.length)) && safety < 20000) {
          update(1 / 60);
          if (draftOpen) pickFirstCard();
          safety++;
        }
        if (draftOpen) pickFirstCard();
      }
      const warChest = Math.floor(gold);
      backToMenu();
      return { bountySamples, warChest, preDraftChest };
    });
    for (const s of r.bountySamples)
      check(`wave ${s.w} bounty uses the trimmed (3 + w*0.6) flat term`, s.ok, `got=${s.got} exp=${s.exp}`);
    // The early trim is front-loaded: ~20% at w1, fading by w20 — every sample inside ≤25%.
    check('bounty cut is front-loaded and within the ≤25% guardrail',
      r.bountySamples.every(s => s.cutPct >= 0 && s.cutPct <= 25 + 1e-6),
      `cuts=${r.bountySamples.map(s => s.cutPct.toFixed(1)).join(',')}`);
    check('w1 bounty cut is the largest (front-loaded)',
      r.bountySamples[0].cutPct >= r.bountySamples[3].cutPct - 1e-9,
      `${r.bountySamples[0].cutPct.toFixed(1)} vs ${r.bountySamples[3].cutPct.toFixed(1)}`);
    // Pre-draft economy (deterministic): the trim must put it below the old ~1003 baseline while
    // keeping a real bank. (Asserting here instead of on the noisy 10-wave total, which folds in
    // random draft perks and previously flaked when a gold perk landed in card[0].)
    check('pre-draft economy trimmed below the old baseline', r.preDraftChest < 950, String(r.preDraftChest));
    check('pre-draft economy stays a meaningful bank (>700)', r.preDraftChest > 700, String(r.preDraftChest));
    // 10-wave total still completes and stays a real bank — loose floor only (no flaky upper bound).
    check('10-wave war chest stays a meaningful bank (>1500)', r.warChest > 1500, String(r.warChest));
    check('no console errors during economy-trim test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 33: booster aura taper — cool the maxed-booster carry (FEEDBACK balance, v1.16.2) ----
  console.log('\n[33] Booster aura taper — maxed-booster carry (v1.16.2)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      gold = 1e9;
      towers.length = 0;
      const b = { type:'buff', x:150, y:150, range:TOWER_TYPES.buff.range, dmg:0,
                  rate:TOWER_TYPES.buff.rate, cd:0, level:1, baseCost:60, invested:60,
                  angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0 };
      towers.push(b);
      selectedTower = b;
      const l1 = b.buffPower;            // 0.25
      upgradeTower();                    // -> L2
      const l2 = b.buffPower;            // 0.33 (increment now +0.08, was +0.1)
      const cap = maxTowerLevel();
      while (b.level < cap) { selectedTower = b; upgradeTower(); }
      const capLevel = b.level;
      const capPower = b.buffPower;      // 0.25 + 0.08*(cap-1)
      // Old +0.1 ramp would have produced this at the same level — assert we're below it.
      const oldPower = 0.25 + 0.1 * (capLevel - 1);
      // Save→reload round-trip parity: the rebuilt booster must keep the tapered power.
      saveRun();
      loadRun();
      const reb = towers.find(t => t.type === 'buff');
      const rebuiltPower = reb ? reb.buffPower : -1;
      backToMenu();
      localStorage.removeItem('cd_save');
      return { l1, l2, capLevel, capPower, oldPower, rebuiltPower };
    });
    check('booster per-level increment tapered to +0.08 (was +0.1)',
      Math.abs(r.l2 - r.l1 - 0.08) < 1e-9, `L1=${r.l1} L2=${r.l2}`);
    check('maxed booster aura follows the 0.25 + 0.08*(lvl-1) ramp',
      Math.abs(r.capPower - (0.25 + 0.08 * (r.capLevel - 1))) < 1e-9,
      `lvl=${r.capLevel} power=${r.capPower}`);
    check('maxed booster aura sits below the old +0.1 ramp (snowball cooled)',
      r.capPower < r.oldPower - 1e-9, `new=${r.capPower} old=${r.oldPower}`);
    check('resumed (loadRun) booster keeps the tapered power — save parity',
      Math.abs(r.rebuiltPower - r.capPower) < 1e-9,
      `live=${r.capPower} rebuilt=${r.rebuiltPower}`);
    check('no console errors during booster-taper test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 34: touch / pointer controls (v1.16.3) ----
  console.log('\n[34] Touch / pointer controls (v1.16.3)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      gold = 1e9;
      towers.length = 0;
      selectedTower = null; selectedShop = null;
      const hasCoarseFn = typeof coarsePointer === 'function';
      const touchAction = getComputedStyle(cv).touchAction;

      const rect = cv.getBoundingClientRect();
      const tap = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + x * rect.width / W,
        clientY: rect.top + y * rect.height / H,
        button: 0, bubbles: true,
      }));

      // Find a placeable board point (off-path, in-bounds).
      let pX = -1, pY = -1;
      for (let yy = 40; yy < H - 40 && pX < 0; yy += 20)
        for (let xx = 40; xx < W - 40; xx += 20) { if (canPlace(xx, yy)) { pX = xx; pY = yy; break; } }

      // 1) A pointerdown (not a click) places a tower at the tapped point.
      selectedShop = 'gun';
      const before = towers.length;
      tap(pX, pY);
      const placed = towers.length === before + 1;
      const t = towers[towers.length - 1];
      const placedAt = placed ? { x: t.x, y: t.y } : null;

      // 2) Tapping a placed tower selects it (opens the upgrade panel).
      selectedShop = null; selectedTower = null;
      tap(t.x, t.y);
      const selectedExact = selectedTower === t;

      // 3) Coarse pointer (finger): a 25px-off tap still selects (radius 30).
      _cpQuery = { matches: true };
      selectedTower = null; selectedShop = null;
      tap(t.x + 25, t.y);
      const coarseSelects = selectedTower === t;

      // 4) Fine pointer (mouse): the same 25px-off tap does NOT select (radius 18).
      _cpQuery = { matches: false };
      selectedTower = null; selectedShop = null;
      tap(t.x + 25, t.y);
      const fineNoSelect = selectedTower === null;

      // 5) Non-primary button (right/middle) is ignored.
      selectedShop = 'gun'; selectedTower = null;
      const beforeRight = towers.length;
      cv.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + (pX + 80) * rect.width / W,
        clientY: rect.top + pY * rect.height / H, button: 2, bubbles: true,
      }));
      const rightIgnored = towers.length === beforeRight;

      _cpQuery = (typeof window !== 'undefined' && window.matchMedia)
        ? window.matchMedia('(pointer: coarse)') : null;   // restore live query
      backToMenu();
      localStorage.removeItem('cd_save');
      return { hasCoarseFn, touchAction, placed, placedAt, pX, pY,
               selectedExact, coarseSelects, fineNoSelect, rightIgnored };
    });
    check('coarsePointer() helper exists', r.hasCoarseFn);
    check('canvas has touch-action:none (no scroll/zoom on board taps)', r.touchAction === 'none', r.touchAction);
    check('pointerdown places a tower at the tapped point', r.placed &&
      Math.abs(r.placedAt.x - r.pX) < 1 && Math.abs(r.placedAt.y - r.pY) < 1, JSON.stringify(r.placedAt));
    check('tapping a tower selects it (upgrade opens)', r.selectedExact);
    check('coarse pointer: 25px-off tap still selects (generous radius)', r.coarseSelects);
    check('fine pointer: 25px-off tap does NOT select (precise radius)', r.fineNoSelect);
    check('non-primary (right) button is ignored', r.rightIgnored);
    check('no console errors during touch-controls test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  console.log('\n[35] High-DPI canvas scaling (v1.17.0)');
  {
    // Standard 1× display: backing store stays logical, behaviour byte-identical.
    const { page, consoleErrors } = await newPage(browser);
    const one = await page.evaluate(() => ({
      dpr: window.devicePixelRatio, DPR, W, H,
      cvW: cv.width, cvH: cv.height,
      // a known transform-sensitive draw: scale identity at dpr=1
      a: ctx.getTransform().a, d: ctx.getTransform().d,
      cssWidth: getComputedStyle(cv).width,
    }));
    check('1× display: DPR resolves to 1', one.DPR === 1, JSON.stringify(one));
    check('1× display: backing store stays logical W×H', one.cvW === one.W && one.cvH === one.H,
      `${one.cvW}×${one.cvH}`);
    check('1× display: context transform is unscaled (a=d=1)', one.a === 1 && one.d === 1);
    check('no console errors on 1× display', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();

    // 2× (Retina-class) display: backing store doubles, context scaled, CSS box
    // unchanged, game still drives a wave with no errors.
    const ctx2 = await browser.newContext({ deviceScaleFactor: 2 });
    const hdErrors = [];
    const page2 = await ctx2.newPage();
    page2.on('console', (msg) => { if (msg.type() === 'error') hdErrors.push(msg.text()); });
    page2.on('pageerror', (err) => hdErrors.push('pageerror: ' + err.message));
    await page2.addInitScript(() => { try { localStorage.setItem('cd_mute', '1'); } catch (e) {} });
    await page2.goto(GAME_URL, { waitUntil: 'load' });
    await page2.evaluate(INSTALL_DRIVER);
    const two = await page2.evaluate(() => {
      const t = ctx.getTransform();
      const cssBox = { w: getComputedStyle(cv).width, h: getComputedStyle(cv).height };
      // Logical coords must be intact (paths/clicks use W/H, not cv.width).
      const logicalOK = W === 900 && H === 560;
      // Drive a quick wave to prove the scaled context renders without throwing.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; campLevel = 1;
      beginGame(); gold = 1e9; __cdGodTowers(6);
      const res = __cdDrive({ maxWave: 3 });
      backToMenu(); localStorage.removeItem('cd_save');
      return { dpr: window.devicePixelRatio, DPR, cvW: cv.width, cvH: cv.height,
               ta: t.a, td: t.d, cssBox, logicalOK, wave: res.wave };
    });
    check('2× display: DPR caps at 2', two.DPR === 2, JSON.stringify(two));
    check('2× display: backing store is W·dpr × H·dpr', two.cvW === 1800 && two.cvH === 1120,
      `${two.cvW}×${two.cvH}`);
    check('2× display: context scaled by dpr (a=d=2)', two.ta === 2 && two.td === 2);
    check('2× display: CSS display box stays logical 900px', two.cssBox.w === '900px', two.cssBox.w);
    check('2× display: logical W/H untouched at 900×560', two.logicalOK);
    check('2× display: game still drives waves on scaled context', two.wave >= 3, `wave=${two.wave}`);
    check('no console errors on 2× display', hdErrors.length === 0, hdErrors.join(' | '));
    await page2.close();
    await ctx2.close();
  }

  // ---- Test 36: Colorblind aid — shape-coded enemy kinds (v1.18.0) ----
  console.log('\n[36] Colorblind aid (shape-coded enemies)');
  {
    // Preset cd_colorblind='1' so the restore-on-load path is exercised.
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    await page.addInitScript(() => { try { localStorage.setItem('cd_mute', '1'); localStorage.setItem('cd_colorblind', '1'); } catch (e) {} });
    await page.goto(GAME_URL, { waitUntil: 'load' });
    await page.evaluate(INSTALL_DRIVER);
    const r = await page.evaluate(() => {
      const restored = colorblindAid;                 // expect true from cd_colorblind='1'
      const E = (kind, extra) => Object.assign({ kind, frozen: 0 }, extra || {});
      // With the aid ON, fast/tank gain a unique glyph; the always-coded kinds keep theirs.
      const on = {
        norm: enemyGlyph(E('norm')), fast: enemyGlyph(E('fast')), tank: enemyGlyph(E('tank')),
        heal: enemyGlyph(E('heal')), shield: enemyGlyph(E('shield')), split: enemyGlyph(E('split')),
        phantom: enemyGlyph(E('phantom')), boss: enemyGlyph(E('boss')),
        frozenTank: enemyGlyph(E('tank', { frozen: 1 })),
      };
      // glyphs must be distinct across all kinds (norm is the only intentionally-empty one)
      const symbols = [on.fast, on.tank, on.heal, on.shield, on.split, on.phantom, on.boss];
      const allDistinct = new Set(symbols).size === symbols.length && !symbols.includes('');
      // Turn the aid OFF: fast/tank go back to no glyph, the rest are unchanged.
      setColorblind(false);
      const off = {
        fast: enemyGlyph(E('fast')), tank: enemyGlyph(E('tank')),
        heal: enemyGlyph(E('heal')), boss: enemyGlyph(E('boss')),
      };
      const persistedOff = localStorage.getItem('cd_colorblind');
      setColorblind(true);
      const persistedOn = localStorage.getItem('cd_colorblind');
      // Settings panel renders a Colorblind aid row + legend when on.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      openSettings();
      const hasRow = /Colorblind aid/.test(document.getElementById('settingsBody').innerHTML);
      const hasLegend = /Enemy symbols:/.test(document.getElementById('settingsBody').innerHTML);
      closeSettings();
      // draw() with the aid on (enemies present) must not throw.
      startWave();
      let drew = true; try { for (let i = 0; i < 30; i++) update(1/60); draw(); } catch (e) { drew = 'ERR:' + e.message; }
      backToMenu(); localStorage.removeItem('cd_save');
      return { restored, on, off, allDistinct, persistedOff, persistedOn, hasRow, hasLegend, drew };
    });
    check('colorblindAid restores from cd_colorblind on load', r.restored === true, `restored=${r.restored}`);
    check('aid ON: fast/tank gain » and ◆ glyphs', r.on.fast === '»' && r.on.tank === '◆',
      `fast=${r.on.fast} tank=${r.on.tank}`);
    check('norm stays glyphless (baseline)', r.on.norm === '', `norm="${r.on.norm}"`);
    check('always-coded kinds keep their glyphs', r.on.heal === '+' && r.on.shield === '🛡' && r.on.split === '✂' && r.on.phantom === '👻' && r.on.boss === '☠',
      JSON.stringify(r.on));
    check('frozen overrides kind glyph (❄)', r.on.frozenTank === '❄', `frozenTank=${r.on.frozenTank}`);
    check('every enemy kind reads as a distinct symbol with the aid on', r.allDistinct);
    check('aid OFF: fast/tank lose their glyph; others unchanged', r.off.fast === '' && r.off.tank === '' && r.off.heal === '+' && r.off.boss === '☠',
      JSON.stringify(r.off));
    check('setColorblind persists cd_colorblind (0/1)', r.persistedOff === '0' && r.persistedOn === '1',
      `off=${r.persistedOff} on=${r.persistedOn}`);
    check('Settings renders the Colorblind aid row + legend', r.hasRow && r.hasLegend);
    check('draw() renders cleanly with the aid on and enemies present', r.drew === true, `${r.drew}`);
    check('no console errors during colorblind test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 37: Menu keyboard accessibility (v1.19.0) ----
  console.log('\n[37] Menu keyboard a11y');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(async () => {
      const fire = (key, shift = false) =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
      const tp = document.getElementById('talentPanel');
      const sp = document.getElementById('settingsPanel');
      const bp = document.getElementById('bestPanel');
      const wn = document.getElementById('whatsnew');
      wn.style.display = 'none';   // start with nothing open

      // 1) Opening a panel moves keyboard focus inside it.
      openTalents();
      const openDisp = getComputedStyle(tp).display;
      const focusInside = tp.contains(document.activeElement);
      closeTalents();

      // 2) Esc closes the open modal and restores focus to the opener.
      // Use the STATIC start-screen Talents button (renderStartScreen rebuilds the
      // mode/map/diff button rows, so a button from those would detach on close).
      const opener = document.querySelector('#startScreen [onclick="openTalents()"]');
      opener.focus();
      openTalents();
      fire('Escape');
      const closedByEsc = getComputedStyle(tp).display === 'none';
      const focusRestored = document.activeElement === opener;

      // 3) Tab is trapped inside the open modal (last→first, and Shift+Tab first→last).
      openSettings();
      const f = focusablesIn(sp);
      const first = f[0], last = f[f.length - 1];
      const enoughFocusable = f.length >= 2 && first !== last;
      last.focus(); fire('Tab');
      const wrapForward = document.activeElement === first;
      first.focus(); fire('Tab', true);
      const wrapBackward = document.activeElement === last;
      closeSettings();

      // 4) A modal panel takes Esc priority over the non-modal What's New rail.
      openWhatsNew();
      openBests();
      fire('Escape');
      const modalClosedFirst = getComputedStyle(bp).display === 'none' && getComputedStyle(wn).display !== 'none';
      fire('Escape');
      const railClosedSecond = getComputedStyle(wn).display === 'none';

      // 5) Modal panels are tagged as dialogs for screen readers.
      const ariaOk = ['talentPanel', 'achPanel', 'bestPanel', 'settingsPanel'].every(id => {
        const el = document.getElementById(id);
        return el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true';
      });

      backToMenu();
      return { openDisp, focusInside, closedByEsc, focusRestored, enoughFocusable, wrapForward, wrapBackward, modalClosedFirst, railClosedSecond, ariaOk };
    });
    // 6) A keyboard focus-ring rule exists in the shipped stylesheet. Read it from
    // disk in Node — the harness loads the game over file://, where in-page fetch
    // and CSSOM .cssRules are both blocked (cross-origin), so this can't run in-page.
    const cssSrc = readFileSync(resolve(ROOT, 'tower-defense.css'), 'utf8');
    const hasFocusRing = cssSrc.includes(':focus-visible');
    check('opening a panel moves focus inside it', r.openDisp === 'flex' && r.focusInside, `disp=${r.openDisp} inside=${r.focusInside}`);
    check('Esc closes the open modal panel', r.closedByEsc);
    check('Esc restores focus to the opener button', r.focusRestored);
    check('settings panel has ≥2 distinct focusable controls', r.enoughFocusable);
    check('Tab wraps from last focusable back to first (trap)', r.wrapForward);
    check('Shift+Tab wraps from first focusable back to last (trap)', r.wrapBackward);
    check("a modal panel takes Esc priority over the What's New rail", r.modalClosedFirst);
    check("a second Esc then closes the What's New rail", r.railClosedSecond);
    check('modal panels are tagged role=dialog aria-modal=true', r.ariaOk);
    check('a :focus-visible focus-ring rule exists in CSS', hasFocusRing);
    check('no console errors during a11y test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  console.log('\n[38] Draft (perk picker) keyboard a11y');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(async () => {
      const fire = (el, key, shift = false) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame();
      const modal = document.getElementById('draftModal');
      const cardsBox = document.getElementById('draftCards');

      // 1) Opening the draft populates focusable cards and lands focus on the first.
      openDraft();
      const cards = Array.from(cardsBox.children);
      const haveCards = cards.length >= 2;
      const allFocusable = cards.every(c => c.tabIndex === 0 && c.getAttribute('role') === 'button');
      const focusOnFirst = document.activeElement === cards[0];

      // 2) Tab is trapped inside the draft (last→first, Shift+Tab first→last).
      const first = cards[0], last = cards[cards.length - 1];
      last.focus(); fire(document, 'Tab');
      const wrapForward = document.activeElement === first;
      first.focus(); fire(document, 'Tab', true);
      const wrapBackward = document.activeElement === last;

      // 3) Esc does NOT close the draft — a pick is required.
      fire(document, 'Escape');
      const stillOpenAfterEsc = getComputedStyle(modal).display !== 'none' && draftOpen === true;

      // 4) It's tagged as a dialog for screen readers.
      const ariaOk = modal.getAttribute('role') === 'dialog' && modal.getAttribute('aria-modal') === 'true';

      // 5) Enter on the focused card picks that perk and closes the draft.
      const before = runPerks.length;
      const target = cards[0];
      target.focus();
      fire(target, 'Enter');
      const pickedAndClosed = draftOpen === false &&
        getComputedStyle(modal).display === 'none' && runPerks.length === before + 1;

      backToMenu();
      return { haveCards, allFocusable, focusOnFirst, wrapForward, wrapBackward, stillOpenAfterEsc, ariaOk, pickedAndClosed };
    });
    check('draft opens with ≥2 focusable role=button cards', r.haveCards && r.allFocusable);
    check('opening the draft moves focus onto the first card', r.focusOnFirst);
    check('Tab wraps last→first inside the draft (trap)', r.wrapForward);
    check('Shift+Tab wraps first→last inside the draft (trap)', r.wrapBackward);
    check('Esc does NOT close the draft (a pick is required)', r.stillOpenAfterEsc);
    check('draft modal is tagged role=dialog aria-modal=true', r.ariaOk);
    check('Enter on a focused card picks it and closes the draft', r.pickedAndClosed);
    check('no console errors during draft a11y test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 39: booster base-range reduction (FEEDBACK balance, slice 1) ----
  console.log('\n[39] Booster base-range reduction (FEEDBACK)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const mk = (spec) => ({
        type:'buff', x:200, y:200, range:TOWER_TYPES.buff.range, dmg:0,
        rate:TOWER_TYPES.buff.rate, cd:0, level:1, baseCost:100, invested:100,
        angle:0, mode:'first', spec, dealt:0, kills:0, buffPower:0.25, flash:0
      });
      const baseRange = TOWER_TYPES.buff.range;
      const plainRange = effBuffRange(mk(null));
      const netRange   = effBuffRange(mk('network'));   // ×1.5 spec
      // A gunner just outside the new aura (between new 68 and old 90) must NOT be buffed.
      const b = mk(null); b.x = 150; b.y = 150;
      towers.push(b);
      const farGun  = { type:'gun', x:150+80, y:150, level:1, spec:null };  // 80px away (>68, was <90)
      const nearGun = { type:'gun', x:150+50, y:150, level:1, spec:null };  // 50px away (still inside)
      const farMult  = buffMultFor(farGun);
      const nearMult = buffMultFor(nearGun);
      backToMenu();
      return { baseRange, plainRange, netRange, farMult, nearMult };
    });
    check('booster base range reduced to 68 (was 90; FEEDBACK −50% slice 1)',
      r.baseRange === 68, `got ${r.baseRange}`);
    check('plain aura range follows the reduced base', Math.abs(r.plainRange - 68) < 1e-6,
      `got ${r.plainRange}`);
    check('Network spec still ×1.5 the (reduced) base', Math.abs(r.netRange - 68 * 1.5) < 1e-6,
      `got ${r.netRange}`);
    check('tower at 80px is no longer buffed (was inside old 90 range)', Math.abs(r.farMult - 1) < 1e-9,
      `mult=${r.farMult}`);
    check('tower at 50px is still buffed (inside reduced range)', r.nearMult > 1 + 1e-9,
      `mult=${r.nearMult}`);
    check('no console errors during booster-range test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 40: wave-preview composition (icon roster with per-kind counts) ----
  console.log('\n[40] Wave-preview composition');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      // waveComposition must exactly match a buildWave() tally (no wave-mod active).
      function tallyBuild(w){ const t={}; buildWave(w).forEach(e=>t[e.kind]=(t[e.kind]||0)+1); return t; }
      const waves = [3,7,9,11,13,15,20,25];
      let allMatch = true; const mism = [];
      for (const w of waves) {
        const comp = {}; waveComposition(w).forEach(c=>comp[c.kind]=c.count);
        const build = tallyBuild(w);
        const keys = new Set([...Object.keys(comp),...Object.keys(build)]);
        for (const k of keys) if (comp[k] !== build[k]) { allMatch = false; mism.push(`w${w}.${k}`); }
      }
      const c15 = waveComposition(15);
      const c14 = waveComposition(14);
      const orderOk = c15[0].kind === 'norm' && c15[c15.length-1].kind === 'boss';
      const bossOnlyMult5 = (c15.some(e=>e.kind==='boss')) && (!c14.some(e=>e.kind==='boss'));
      // every kind that can appear has a preview colour
      const kinds = ['norm','fast','tank','heal','shield','split','phantom','boss'];
      const colorsOk = kinds.every(k => typeof PREVIEW_COLOR[k] === 'string');
      // draw the between-waves preview state cleanly
      wave = 13; waveActive = false; gameOver = false;
      let drew = true; try { draw(); } catch(e){ drew = false; }
      backToMenu();
      return { allMatch, mism, orderOk, bossOnlyMult5, colorsOk, drew, total15: c15.reduce((s,e)=>s+e.count,0) };
    });
    check('waveComposition tallies match buildWave() at every sampled wave', r.allMatch, r.mism.join(','));
    check('roster is ordered norm-first, boss-last', r.orderOk);
    check('boss appears only on multiples of 5 (w15 yes, w14 no)', r.bossOnlyMult5);
    check('PREVIEW_COLOR defines a colour for every enemy kind', r.colorsOk);
    check('w15 total = 33 normals/specials + 1 boss = 34', r.total15 === 34, `got ${r.total15}`);
    check('draw() renders the wave-preview state cleanly', r.drew);
    check('no console errors during wave-preview test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 41: Last Stand legendary perk (comeback damage, v1.22.0) ----
  console.log('\n[41] Last Stand comeback perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, rate:1, dealt:0, kills:0 };
      towers.push(gun);
      // perk exists in the pool and is a legendary
      const def = PERKS.find(p => p.id === 'laststand');
      const inPool = !!def && def.rarity === 'legendary';
      // clean run: perk held, no lives lost -> no bonus
      perkState.lastStand = true; perkState.livesLost = 0;
      const dClean = effDmg(gun);
      // 5 lives lost (one boss leak) -> +15%
      perkState.livesLost = 5;
      const d5 = effDmg(gun);
      // 20 lives lost -> +60% cap; 40 -> still capped
      perkState.livesLost = 20;
      const d20 = effDmg(gun);
      perkState.livesLost = 40;
      const d40 = effDmg(gun);
      // base (perk NOT held) ignores the counter entirely
      perkState.lastStand = false; perkState.livesLost = 30;
      const dNoPerk = effDmg(gun);
      const base = dClean;  // lastStand with 0 lost == base multiplier path
      // freshPerkState defaults are present & save-safe
      const fresh = freshPerkState();
      const defaultsOk = fresh.lastStand === false && fresh.livesLost === 0;
      // save -> restore round-trip (perkState persisted whole; reapply over freshPerkState)
      perkState.lastStand = true; perkState.livesLost = 7;
      saveRun();
      perkState.lastStand = false; perkState.livesLost = 0;  // clobber
      const loaded = loadRun();
      const restored = perkState.lastStand === true && perkState.livesLost === 7;
      // old-save migration: a cd_save whose perkState lacks the new fields defaults them
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.lastStand; delete old.perkState.livesLost;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.lastStand === false && perkState.livesLost === 0;
      localStorage.removeItem('cd_save');
      backToMenu();
      return { inPool, base, dClean, d5, d20, d40, dNoPerk, defaultsOk, loaded, restored, migratedOk };
    });
    check('Last Stand is a legendary perk in the pool', r.inPool);
    check('clean run (0 lives lost) gives no bonus', Math.abs(r.dClean - r.base) < 1e-9, `clean=${r.dClean}`);
    check('5 lives lost = +15% damage', Math.abs(r.d5 - r.base * 1.15) < 1e-6, `d5=${r.d5} base=${r.base}`);
    check('20 lives lost = +60% cap', Math.abs(r.d20 - r.base * 1.6) < 1e-6, `d20=${r.d20}`);
    check('40 lives lost stays capped at +60%', Math.abs(r.d40 - r.base * 1.6) < 1e-6, `d40=${r.d40}`);
    check('counter ignored when perk not held', Math.abs(r.dNoPerk - r.base) < 1e-9, `noPerk=${r.dNoPerk}`);
    check('freshPerkState defaults lastStand:false / livesLost:0', r.defaultsOk);
    check('save/reload round-trips the perk flag + counter', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing the fields migrates to defaults', r.migratedOk);
    check('no console errors during Last Stand test', consoleErrors.length === 0, consoleErrors.join(' | '));
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
