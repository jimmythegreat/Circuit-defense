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

    // Minimal/old save with chips but NO talents map must not throw in loadMeta (v1.45.1 guard).
    const minimal = await page.evaluate(() => {
      localStorage.setItem('cd_meta', JSON.stringify({ chips: 100 })); // no talents/achievements/stats
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
      let threw = false;
      try { loadMeta(); } catch (e) { threw = true; }
      const res = { threw, chips: meta.chips, talentsObj: meta.talents && typeof meta.talents === 'object',
        ach: typeof meta.achievements === 'object', statDmg: meta.stats.dmg };
      localStorage.removeItem('cd_meta');
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0, bestCombo: 0 } }; loadMeta();
      return res;
    });
    check('minimal save (chips, no talents) loads without throwing', !minimal.threw, JSON.stringify(minimal));
    check('minimal save defaults talents map + achievements/stats',
      minimal.talentsObj && minimal.chips === 100 && minimal.ach && minimal.statDmg === 0, JSON.stringify(minimal));

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
                      'cd-game.js', 'cd-update.js', 'cd-endgame.js', 'cd-render.js'];
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
    // cd-endgame.js (split off cd-update.js v2.15.2) executed — its end-of-run + meta-UI
    // globals are present. Guards against a future re-inline or a dropped/misordered tag.
    const endgameRan = await page.evaluate(() => typeof computeScore === 'function' &&
      typeof endGame === 'function' && typeof grantAchievements === 'function' &&
      typeof renderEndScreen === 'function' && Array.isArray(ACHIEVEMENTS));
    check('cd-endgame.js executed (end-of-run + meta-UI globals present)', endgameRan);
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
      // Sniper: Executioner buffed +60% → +90% vs tanks & bosses (v1.26.0). It was
      // strictly dominated by Deadeye — Deadeye gives +60% EXPECTED dmg vs ALL targets
      // (0.8×1 + 0.2×4 = 1.6×), while Executioner gave +60% vs tanks/bosses ONLY, so
      // Deadeye matched it on bosses and beat it everywhere else. Now 1.9× makes
      // Executioner the dedicated boss-killer (beats Deadeye's 1.6× on the big targets,
      // guaranteed/no RNG) while Deadeye stays the all-rounder.
      const execDesc = SPECS.sniper.find(s => s.id === 'executor').desc;
      const snip = mk('sniper', 'executor');
      snip.x = 850; snip.y = 40; snip.range = 9999;   // far from path so the shot can't land same-frame
      const snBase = effDmg(snip);
      const fireAt = (kind) => {
        enemies.length = 0; projectiles.length = 0;
        towers.length = 0; towers.push(snip);
        spawners.length = 0; pendingSpawns.length = 0;
        snip.cd = 0; waveActive = true;
        enemies.push({ kind, hp: 1e6, maxHp: 1e6, x: 60, y: 300, dist: 50, spd: 1, r: 13,
                       dead:false, blinkInvuln:0, flash:0, slow:0, slowF:0.6, frozen:0, poison:null, px:0, py:0 });
        update(1/60);
        return projectiles.length ? projectiles[0].dmg : -1;
      };
      const execBoss = fireAt('boss');
      const execTank = fireAt('tank');
      const execNorm = fireAt('norm');
      // Tesla: Superconductor's chain falloff softened 0.7 → 0.8 (v1.55.0) so its 2
      // extra targets deal real damage and it out-totals Overcharge on a full swarm,
      // while Overcharge (no falloff, full dmg to 3) stays the few-target pick. Base
      // tesla + Overcharge unchanged (spec-specific). 6 enemies in a 40px-spaced line
      // (within the 90px chain radius) so the bolt can chain forward through all of them.
      const teslaChain = (spec) => {
        enemies.length = 0; beams.length = 0;
        const line = [];
        for (let i = 0; i < 6; i++) {
          const e = { kind:'norm', hp: 1e7, maxHp: 1e7, x: 200 + i*40, y: 300, dist: 50,
                      spd: 1, r: 13, dead:false, blinkInvuln:0, flash:0, slow:0, frozen:0,
                      warded:0, shieldOn:false, armor:0, poison:null };
          enemies.push(e); line.push(e);
        }
        const tt = mk('tesla', spec); tt.x = 200; tt.y = 300;
        fireChain(tt, line[0], 100);
        return line.map(e => e.maxHp - e.hp);   // damage dealt to each link
      };
      const teslaSuper = teslaChain('super');
      const teslaOver  = teslaChain('overcharge');
      const teslaBase  = teslaChain(null);
      const sum = a => a.reduce((s,x) => s + x, 0);
      const teslaSuperSum = sum(teslaSuper), teslaOverSum = sum(teslaOver);
      // Shop tooltip: the poison button's title should explain the armor corrosion.
      renderShop();
      const shopBtns = [...document.getElementById('shop').children];
      const poisonBtn = shopBtns.find(b => b.title && b.title.startsWith('Poison'));
      const poisonTip = poisonBtn ? poisonBtn.title : '';
      backToMenu();
      return { plain, net, over, canPlain, canMega, frostPlain, frostShatter,
               poisonBaseDmg, armorBefore, armorAfter, dotDps, hasReduceMotion, poisonTip,
               execDesc, snBase, execBoss, execTank, execNorm,
               teslaSuper, teslaOver, teslaBase, teslaSuperSum, teslaOverSum };
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
    check('Sniper Executioner desc now reads +90% vs tanks & bosses', /90%/.test(r.execDesc),
      `desc="${r.execDesc}"`);
    check('Executioner deals 1.9× vs bosses', Math.abs(r.execBoss - r.snBase * 1.9) < 1e-6,
      `base=${r.snBase.toFixed(2)} boss=${r.execBoss.toFixed(2)}`);
    check('Executioner deals 1.9× vs tanks', Math.abs(r.execTank - r.snBase * 1.9) < 1e-6,
      `base=${r.snBase.toFixed(2)} tank=${r.execTank.toFixed(2)}`);
    check('Executioner unchanged vs trash (1.0×)', Math.abs(r.execNorm - r.snBase) < 1e-6,
      `base=${r.snBase.toFixed(2)} norm=${r.execNorm.toFixed(2)}`);
    check('Executioner boss multiplier (1.9×) now exceeds Deadeye expected (1.6×) — no longer dominated',
      r.snBase > 0 && r.execBoss / r.snBase > 1.6 + 1e-9, `ratio=${(r.execBoss / r.snBase).toFixed(3)}`);
    check('reduceMotion() helper exists (prefers-reduced-motion support)', r.hasReduceMotion);
    check('poison shop tooltip explains the armor corrosion', /corrod/i.test(r.poisonTip) && /armor/i.test(r.poisonTip),
      `tip="${r.poisonTip}"`);
    // Tesla spec rebalance (v1.55.0): Superconductor falloff 0.7 → 0.8.
    check('Tesla Superconductor chains 5 targets', r.teslaSuper.filter(d => d > 0).length === 5,
      `hits=[${r.teslaSuper.map(d => d.toFixed(1)).join(',')}]`);
    check('Tesla Superconductor 2nd link takes 80% (falloff 0.8, was 0.7→70%)',
      Math.abs(r.teslaSuper[1] - 80) < 1e-6, `2nd=${r.teslaSuper[1].toFixed(2)}`);
    check('Tesla Overcharge unchanged: 3 full-damage links (no falloff)',
      r.teslaOver.filter(d => d > 0).length === 3 && Math.abs(r.teslaOver[1] - 100) < 1e-6,
      `hits=[${r.teslaOver.map(d => d.toFixed(1)).join(',')}]`);
    check('Tesla base unchanged: 3 links at 0.7 falloff (2nd=70)',
      r.teslaBase.filter(d => d > 0).length === 3 && Math.abs(r.teslaBase[1] - 70) < 1e-6,
      `hits=[${r.teslaBase.map(d => d.toFixed(1)).join(',')}]`);
    check('Tesla Superconductor now out-totals Overcharge on a 5-enemy swarm (was dominated)',
      r.teslaSuperSum > r.teslaOverSum + 1e-6,
      `super=${r.teslaSuperSum.toFixed(2)} over=${r.teslaOverSum.toFixed(2)}`);
    check('Tesla Superconductor swarm buff stays under the +25%/run cap vs old 0.7 falloff',
      r.teslaSuperSum <= 277.3 * 1.25 + 1e-6, `super=${r.teslaSuperSum.toFixed(2)} cap=${(277.3*1.25).toFixed(2)}`);
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

      // --- Speed bonus (v1.78.0): a fast VICTORY scores higher, up to +25%, tapering to +0% at par.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      wave = victoryWave(); kills = 0; lives = 0; gold = 0; comboBest = 0; towers = []; victory = true;
      const par = victoryWave() * 20;
      gameTime = par * 0.5;  const fast  = computeScore();   // half par → +12.5%
      gameTime = par;        const atPar = computeScore();   // at par   → +0%
      gameTime = par * 2;    const slow  = computeScore();   // over par → clamped +0% (never a penalty)
      // A loss never gets the bonus, regardless of how fast it ended.
      victory = false; gameTime = par * 0.1; const lossNoBonus = computeScore().spdMult;
      // Breakdown surfaces the × Speed row only when the bonus applies.
      victory = true; gameTime = par * 0.5;
      const breakHasSpeed = scoreBreakdownHtml(computeScore()).includes('× Speed');
      victory = false; gameTime = par; const breakNoSpeed = scoreBreakdownHtml(computeScore()).includes('× Speed');
      gameTime = 0; victory = false; backToMenu();
      ['cd_bestscore', 'cd_best_classic_normal', 'cd_best_classic_hard',
       'cd_best_normal', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      return { scOk: sc.score === expected, scScore: sc.score, expected, scored, grade,
               numLen: numText.length, gridCells, bestPersisted, newBestShown,
               winGrade, winNewBest, winBest,
               spdFast: fast.spdMult, spdAtPar: atPar.spdMult, spdSlow: slow.spdMult,
               fastBeatsPar: fast.score > atPar.score, parEqualsSlow: atPar.score === slow.score,
               lossNoBonus, breakHasSpeed, breakNoSpeed };
    });
    check('computeScore() matches the documented formula', r.scOk, `got ${r.scScore}, want ${r.expected}`);
    check('overlay gains the .scored class (score UI shown)', r.scored);
    check('defeat at 40% of goal grades D', r.grade === 'D', r.grade);
    check('score number renders in the hero', r.numLen > 0);
    check('stats grid shows 7 cells', r.gridCells === 7, String(r.gridCells));
    check('best score persisted to cd_bestscore', r.bestPersisted === r.expected, String(r.bestPersisted));
    check('first run flags a new best score', r.newBestShown);
    check('flawless victory grades S', r.winGrade === 'S', r.winGrade);
    check('higher-scoring victory flags a new best', r.winNewBest);
    check('best score updates to the higher victory score', r.winBest > r.expected, String(r.winBest));
    // Speed bonus (v1.78.0)
    check('fast victory (half par) gives +12.5% speed bonus', Math.abs(r.spdFast - 1.125) < 1e-9, String(r.spdFast));
    check('victory at par gives no speed bonus', r.spdAtPar === 1, String(r.spdAtPar));
    check('victory over par clamps to no bonus (never a penalty)', r.spdSlow === 1, String(r.spdSlow));
    check('a fast win scores higher than the same win at par', r.fastBeatsPar);
    check('a slow win scores the same as one at par (no penalty)', r.parEqualsSlow);
    check('a loss never gets the speed bonus', r.lossNoBonus === 1, String(r.lossNoBonus));
    check('breakdown shows × Speed row when bonus applies', r.breakHasSpeed);
    check('breakdown hides × Speed row when no bonus', !r.breakNoSpeed);
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
      gridSnap = false;   // test exact pointer placement, not grid-snapped (v1.24.0)
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

  // ---- Test 39: booster base-range reduction (FEEDBACK balance, slice 2) ----
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
      // A gunner just outside the new aura (between new 45 and old 52) must NOT be buffed.
      const b = mk(null); b.x = 150; b.y = 150;
      towers.push(b);
      const farGun  = { type:'gun', x:150+48, y:150, level:1, spec:null };  // 48px away (>45, was <52)
      const nearGun = { type:'gun', x:150+40, y:150, level:1, spec:null };  // 40px away (still inside)
      const farMult  = buffMultFor(farGun);
      const nearMult = buffMultFor(nearGun);
      backToMenu();
      return { baseRange, plainRange, netRange, farMult, nearMult };
    });
    check('booster base range reduced to 45 (was 52; FEEDBACK −50% final slice, 90→45)',
      r.baseRange === 45, `got ${r.baseRange}`);
    check('plain aura range follows the reduced base', Math.abs(r.plainRange - 45) < 1e-6,
      `got ${r.plainRange}`);
    check('Network spec still ×1.5 the (reduced) base', Math.abs(r.netRange - 45 * 1.5) < 1e-6,
      `got ${r.netRange}`);
    check('tower at 48px is no longer buffed (was inside old 52 range)', Math.abs(r.farMult - 1) < 1e-9,
      `mult=${r.farMult}`);
    check('tower at 40px is still buffed (inside reduced range)', r.nearMult > 1 + 1e-9,
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
      // threat gauge — waveThreat() must equal the real buildWave() total HP (no mod active),
      // proving the preview's per-kind multipliers stay in sync with the source of truth.
      function buildHp(w){ return buildWave(w).reduce((s,e)=>s+e.maxHp,0); }
      let threatMatches = true; const tmism = [];
      for (const w of waves) {
        const a = waveThreat(w), b = buildHp(w);
        if (Math.abs(a - b) > 0.01) { threatMatches = false; tmism.push(`w${w}:${a.toFixed(0)}≠${b.toFixed(0)}`); }
      }
      const threatRises = waveThreat(10) > waveThreat(5) && waveThreat(20) > waveThreat(10);
      const bossSpikes = waveThreat(15) > waveThreat(14);   // boss wave is a clear spike
      const threatNormal = waveThreat(10);
      diffKey = 'hard'; const threatHard = waveThreat(10); diffKey = 'normal';
      const threatScalesDiff = threatHard > threatNormal;
      // draw the between-waves preview state cleanly
      wave = 13; waveActive = false; gameOver = false;
      let drew = true; try { draw(); } catch(e){ drew = false; }
      backToMenu();
      return { allMatch, mism, orderOk, bossOnlyMult5, colorsOk, drew, total15: c15.reduce((s,e)=>s+e.count,0),
        threatMatches, tmism, threatRises, bossSpikes, threatScalesDiff };
    });
    check('waveComposition tallies match buildWave() at every sampled wave', r.allMatch, r.mism.join(','));
    check('roster is ordered norm-first, boss-last', r.orderOk);
    check('boss appears only on multiples of 5 (w15 yes, w14 no)', r.bossOnlyMult5);
    check('PREVIEW_COLOR defines a colour for every enemy kind', r.colorsOk);
    check('w15 total = 33 normals/specials + 1 boss = 34', r.total15 === 34, `got ${r.total15}`);
    check('draw() renders the wave-preview state cleanly', r.drew);
    check('waveThreat() equals buildWave() total HP at every sampled wave', r.threatMatches, r.tmism.join(','));
    check('waveThreat rises with wave number', r.threatRises);
    check('waveThreat spikes on a boss wave (w15 > w14)', r.bossSpikes);
    check('waveThreat scales with difficulty (hard > normal)', r.threatScalesDiff);
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

  // ---- Test 42: Mortar tower (new 8th tower — long-range armor-ignoring AoE) ----
  console.log('\n[42] Mortar tower');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // definitions present & wired
      const def = TOWER_TYPES.mortar;
      const defOk = !!def && def.proj === 'mortar' && def.range > 200 && def.dmg > 0;
      const specsOk = Array.isArray(SPECS.mortar) && SPECS.mortar.length === 2
        && SPECS.mortar.some(s => s.id === 'demo') && SPECS.mortar.some(s => s.id === 'saturate');
      const masteryOk = !!TALENTS.mastery_mortar && TALENTS.mastery_mortar.sect === 'TOWER MASTERY';
      const inShopKeys = TYPE_KEYS.includes('mortar');

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      // shop renders a mortar button (auto-generated from TYPE_KEYS)
      const shopHasMortar = !!document.querySelector('#shop') &&
        Array.prototype.some.call(document.querySelectorAll('.towerBtn'), b => /Mortar/.test(b.textContent));

      // Demolisher spec adds +35% damage via effDmg
      const m = { type:'mortar', x:300, y:300, level:1, spec:null, dmg:100, rate:2, range:225,
                  dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0 };
      const dBase = effDmg(m);
      m.spec = 'demo';
      const dDemo = effDmg(m);
      const demoOk = Math.abs(dDemo - dBase * 1.35) < 1e-6;
      m.spec = null;

      // Armored enemy takes FULL mortar damage (armor ignored). Compare a mortar blast
      // vs a plain bullet of identical raw dmg against the same armored target.
      towers.length = 0; towers.push(m);
      const mkArmored = () => ({ x:300, y:300, r:12, hp:1000, maxHp:1000, armor:50, dead:false,
                                 flash:0, kind:'shield', blinkInvuln:0, bounty:1 });
      const arm1 = mkArmored(); enemies.length = 0; enemies.push(arm1);
      // mortar projectile (ignoreArmor forced true at hitEnemy)
      hitEnemy({ target: arm1, dmg: 100, kind:'mortar', src: m, crit:false, ignoreArmor:true, color:def.color });
      const mortarDealt = 1000 - arm1.hp;     // expect ~100 (armor bypassed)
      const arm2 = mkArmored(); enemies.length = 0; enemies.push(arm2);
      // a normal bullet of the same dmg against armor 50 → heavily reduced
      hitEnemy({ target: arm2, dmg: 100, kind:'bullet', src: m, crit:false, ignoreArmor:false, color:'#58a6ff' });
      const bulletDealt = 1000 - arm2.hp;
      const ignoresArmor = mortarDealt > bulletDealt + 1 && Math.abs(mortarDealt - 100) < 1;

      // AoE: a single mortar blast hits multiple clustered enemies
      enemies.length = 0;
      const cluster = [];
      for (let i = 0; i < 3; i++) { const e = { x:300 + i*12, y:300, r:11, hp:500, maxHp:500, armor:0,
        dead:false, flash:0, kind:'norm', blinkInvuln:0, bounty:1 }; cluster.push(e); enemies.push(e); }
      hitEnemy({ target: cluster[0], dmg: 60, kind:'mortar', src: m, crit:false, ignoreArmor:true, color:def.color });
      const splashHits = cluster.filter(e => e.hp < 500).length;

      // SFX hook exists
      const sfxOk = typeof SFX.mortar === 'function';

      // save/resume round-trips a placed mortar (rebuilt generically from TOWER_TYPES)
      towers.length = 0;
      towers.push({ type:'mortar', x:250, y:250, level:3, spec:'saturate', mode:'last',
        invested:300, dealt:42, kills:2, range:def.range*Math.pow(1.08,2), dmg:def.dmg*Math.pow(1.45,2),
        rate:def.rate*Math.pow(0.88,2), cd:0, baseCost:def.cost, angle:0, buffPower:0.25, flash:0 });
      wave = 2; lives = 20; gold = 100; waveActive = false;
      saveRun();
      towers.length = 0;
      const loaded = loadRun();
      const rt = towers.find(t => t.type === 'mortar');
      const roundTrips = loaded === true && !!rt && rt.level === 3 && rt.spec === 'saturate' && rt.mode === 'last';
      localStorage.removeItem('cd_save');
      backToMenu();
      return { defOk, specsOk, masteryOk, inShopKeys, shopHasMortar, demoOk,
               mortarDealt, bulletDealt, ignoresArmor, splashHits, sfxOk, roundTrips };
    });
    check('Mortar definition wired (proj/range/dmg)', r.defOk);
    check('Mortar has 2 specs (Demolisher + Saturation)', r.specsOk);
    check('Mortar Mastery talent exists', r.masteryOk);
    check('Mortar is in the shop tower keys', r.inShopKeys);
    check('Mortar button rendered in the shop', r.shopHasMortar);
    check('Demolisher spec = +35% damage', r.demoOk);
    check('Mortar blast ignores armor (full dmg vs armored)', r.ignoresArmor,
      `mortar=${r.mortarDealt} bullet=${r.bulletDealt}`);
    check('Mortar blast is AoE (hits clustered enemies)', r.splashHits >= 2, `hits=${r.splashHits}`);
    check('SFX.mortar launch sound exists', r.sfxOk);
    check('placed Mortar save/resume round-trips', r.roundTrips);
    check('no console errors during Mortar test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [43] Grid placement snapping (v1.24.0)
  console.log('\n[43] Grid placement snapping (v1.24.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      gold = 1e9; towers.length = 0; selectedTower = null; selectedShop = null;

      const hasHelpers = typeof placeCoord === 'function' && typeof snapGridCoord === 'function'
        && typeof PLACE_GRID === 'number';
      const settingFn = typeof setGridSnap === 'function';

      const rect = cv.getBoundingClientRect();
      const tap = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + x * rect.width / W,
        clientY: rect.top + y * rect.height / H, button: 0, bubbles: true,
      }));
      // Centre of a cell + a small off-centre offset; both should land on the same snapped centre.
      const onGrid = v => Math.floor(v / PLACE_GRID) * PLACE_GRID + PLACE_GRID / 2;

      // Find an off-centre tap point whose SNAPPED cell is placeable, then place with snap ON.
      gridSnap = true;
      let pX = -1, pY = -1;
      for (let yy = 67; yy < H - 60 && pX < 0; yy += 13)
        for (let xx = 67; xx < W - 60; xx += 13) {
          const sp = placeCoord(xx, yy);
          // require the tap to be genuinely off the cell centre so snapping is observable
          if ((xx !== sp.x || yy !== sp.y) && canPlace(sp.x, sp.y)) { pX = xx; pY = yy; break; }
        }
      selectedShop = 'gun';
      const before = towers.length;
      tap(pX, pY);
      const placedT = towers[towers.length - 1];
      const snappedPlace = towers.length === before + 1
        && placedT.x === onGrid(pX) && placedT.y === onGrid(pY);
      const onGridExactly = (placedT.x - PLACE_GRID/2) % PLACE_GRID === 0
        && (placedT.y - PLACE_GRID/2) % PLACE_GRID === 0;

      // Grid snap OFF: places at the raw tapped point (no snapping).
      gridSnap = false; towers.length = 0; selectedShop = 'gun';
      // pick a fresh placeable raw point
      let qX = -1, qY = -1;
      for (let yy = 70; yy < H - 70 && qX < 0; yy += 13)
        for (let xx = 70; xx < W - 70; xx += 13) { if (canPlace(xx + 5, yy + 5)) { qX = xx + 5; qY = yy + 5; break; } }
      tap(qX, qY);
      const offT = towers[towers.length - 1];
      const freePlace = offT && Math.abs(offT.x - qX) < 0.5 && Math.abs(offT.y - qY) < 0.5;

      // setGridSnap persists.
      setGridSnap(true);
      const persisted = localStorage.getItem('cd_gridsnap') === '1' && gridSnap === true;

      // PLACE_GRID === min placement gap (32) so a tower in the adjacent cell stays buildable.
      gridSnap = true; towers.length = 0;
      let adjacentBuildable = false;
      for (let yy = 60; yy < H - 60 && !adjacentBuildable; yy += 13)
        for (let xx = 60; xx < W - 120; xx += 13) {
          const s1 = placeCoord(xx, yy), s2 = placeCoord(xx + PLACE_GRID, yy);
          if (s2.x - s1.x !== PLACE_GRID) continue;               // genuinely adjacent cells
          if (!canPlace(s1.x, s1.y) || !canPlace(s2.x, s2.y)) continue;
          towers.push({ type:'gun', x:s1.x, y:s1.y });            // occupy cell 1
          adjacentBuildable = canPlace(s2.x, s2.y);               // cell 2 still buildable beside it
          towers.length = 0;
          break;
        }

      gridSnap = true; try { localStorage.setItem('cd_gridsnap', '1'); } catch(e) {}
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasHelpers, settingFn, snappedPlace, onGridExactly, freePlace, persisted, adjacentBuildable };
    });
    check('grid helpers exist (placeCoord/snapGridCoord/PLACE_GRID)', r.hasHelpers);
    check('setGridSnap setter exists', r.settingFn);
    check('grid-snap ON: off-centre tap places on the cell centre', r.snappedPlace);
    check('placed tower lands exactly on a grid node', r.onGridExactly);
    check('grid-snap OFF: places at the raw tapped point', r.freePlace);
    check('setGridSnap persists to cd_gridsnap', r.persisted);
    check('adjacent grid cells are still buildable (grid == min gap)', r.adjacentBuildable);
    check('no console errors during grid-placement test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 44: boss HP slope 0.5->0.6 (v1.24.4) + boss armor slope 0.4->0.5 (v1.64.0) — "too easy" FEEDBACK ----
  console.log('\n[44] Boss HP + armor slopes (late-game difficulty)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      // Live boss mult must be 14 + 0.6w (was 14 + 0.5w). Measure mult = bossHp / template.
      const waves = [5, 10, 15, 20, 30, 50];
      const samples = waves.map(w => {
        const boss = buildWave(w).find(e => e.kind === 'boss');
        const tmpl = enemyTemplate(w).hp;
        const mult = boss.hp / tmpl;
        const oldMult = 14 + w * 0.5;
        return { w, mult, expMult: 14 + w * 0.6,
                 ok: Math.abs(mult - (14 + w * 0.6)) < 1e-6,
                 pct: (boss.hp / (tmpl * oldMult) - 1) * 100,   // swing vs the old 0.5 slope
                 armor: boss.armor };
      });
      backToMenu();
      return { samples };
    });
    for (const s of r.samples) {
      check(`boss HP at wave ${s.w} uses the 14+0.6w slope`, s.ok,
        `mult=${s.mult.toFixed(3)} exp=${s.expMult.toFixed(3)}`);
    }
    // The steepening must grow with wave (later bosses relatively tankier) ...
    const pcts = r.samples.map(s => s.pct);
    const monotonic = pcts.every((p, i) => i === 0 || p >= pcts[i - 1] - 1e-9);
    check('boss HP boost over the old 0.5 slope grows with wave', monotonic,
      `pcts=${pcts.map(p => p.toFixed(1)).join(',')}`);
    // ... but stay inside the ≤25%/number/run guardrail at every wave (asymptote = +20%).
    check('boss HP boost stays within the ≤25% guardrail at every wave',
      pcts.every(p => p <= 25 + 1e-6), `max=${Math.max(...pcts).toFixed(1)}%`);
    // Boss ARMOR slope steepened 0.4 -> 0.5 (v1.64.0) — the genuinely-open late lever
    // (boss HP slope is invariant-capped above). Flat-subtraction armor barely touches
    // high-dmg towers, is ignored by Mortar/AP/Poison, but hardens cheap high-rate guns.
    for (const s of r.samples) {
      check(`boss armor at wave ${s.w} uses the 14… w*0.5 slope`,
        Math.abs(s.armor - s.w * 0.5) < 1e-6, `armor=${s.armor} exp=${s.w * 0.5}`);
    }
    // The per-run swing on the armor number is exactly +25% over the old 0.4 slope.
    const armorSwingOk = r.samples.every(s => Math.abs(s.armor / (s.w * 0.4) - 1.25) < 1e-6);
    check('boss armor slope is a +25% (≤25%/run guardrail) bump over the old 0.4', armorSwingOk);
    // A boss-bearing wave still drives to a clean clear with god towers (beatable, no crash).
    const beat = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const path = waypoints[Math.floor(waypoints.length / 2)] || { x: W/2, y: H/2 };
      towers.push({ type:'gun', x:path.x, y:path.y, range:99999, dmg:1e9, rate:0.05, cd:0,
        level:1, baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0,
        buffPower:0.25, flash:0 });
      wave = 4; lastSettledWave = 4;            // next startWave() => wave 5 (a boss wave)
      startWave();
      let guard = 0;
      while ((spawners.length || enemies.length || (typeof pendingSpawns !== 'undefined' && pendingSpawns.length)) && guard < 20000) { update(1/60); guard++; }
      const cleared = enemies.length === 0 && spawners.length === 0;
      const r2 = { cleared, wave, lives, guard };
      backToMenu(); localStorage.removeItem('cd_save');
      return r2;
    });
    check('boss wave 5 still clears with overwhelming towers (beatable)', beat.cleared,
      `enemies left, guard=${beat.guard}`);
    check('boss wave clear did not hit the sim guard / time out', beat.guard < 20000, `guard=${beat.guard}`);
    check('lives survive the boss wave with overwhelming towers', beat.lives > 0, `lives=${beat.lives}`);
    check('no console errors during boss-HP test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [45] Boss archetypes — regen / summoner / bulwark / enrager / teleporter / berserker / disruptor / juggernaut / siphon (v1.25.0+)
  console.log('\n[45] Boss archetypes (regen/summoner/bulwark/enrager/teleporter/berserker/disruptor/juggernaut/siphon)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // Archetypes only attach from wave 20+; earlier (tutorial) bosses stay vanilla.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const vanillaEarly = bt(5) === undefined && bt(10) === undefined && bt(15) === undefined;
      // Rotation by boss number: (w/5 - 4) % 16 → regen, summoner, bulwark, enrager, teleporter,
      // berserker, disruptor, juggernaut, siphon, hydra, revenant, conduit, warper, fortifier,
      // warlord, suppressor, then wraps (w90 → warlord, w95 → suppressor, w100 → regen).
      const rotation = bt(20) === 'regen' && bt(25) === 'summoner'
                    && bt(30) === 'bulwark' && bt(35) === 'enrager'
                    && bt(40) === 'teleporter' && bt(45) === 'berserker'
                    && bt(50) === 'disruptor' && bt(55) === 'juggernaut'
                    && bt(60) === 'siphon' && bt(65) === 'hydra' && bt(70) === 'revenant'
                    && bt(75) === 'conduit' && bt(80) === 'warper' && bt(85) === 'fortifier'
                    && bt(90) === 'warlord' && bt(95) === 'suppressor' && bt(100) === 'regen';

      // Drop a controlled boss into the live enemy array and tick update() on it.
      const mkBoss = (bossType, over = {}) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        const e = { kind:'boss', bossType, hp:1000, maxHp:2000, spd:20, r:24, bounty:100,
          color:'#f85149', armor:0, gap:1.5, dist:5, x:W/2, y:H/2, px:W/2, py:H/2,
          slow:0, slowF:0.8, frozen:0, poison:null, flash:0 };
        Object.assign(e, over);
        enemies.push(e);
        return e;
      };

      // REGEN — heals over time; freeze pauses the heal.
      let e = mkBoss('regen'); const hp0 = e.hp;
      for (let i = 0; i < 30; i++) update(1/60);
      const regenHeals = enemies[0] && enemies[0].hp > hp0;
      e = mkBoss('regen', { frozen: 5 }); const fhp0 = e.hp;
      for (let i = 0; i < 30; i++) update(1/60);
      const frozenNoHeal = enemies[0] && Math.abs(enemies[0].hp - fhp0) < 1e-6;

      // BULWARK — active shield soaks 60% of a hit; the cycle raises a shield over time.
      e = mkBoss('bulwark', { shieldOn: true, shieldT: 2 });
      const hpB = e.hp; damage(e, 100, null);
      const shieldSoaks = Math.abs((hpB - e.hp) - 40) < 1e-6;   // 100 × 0.4
      e = mkBoss('bulwark', { spd: 0 });                         // pin so it can't leak
      let shieldRaised = false;
      for (let i = 0; i < 600 && !shieldRaised; i++) { update(1/60); if (enemies[0] && enemies[0].shieldOn) shieldRaised = true; }

      // SUMMONER — spawns weak adds, capped at 8 total. Pin boss (spd 0) so adds (spd
      // inherits 0) and the boss stay put and can be counted deterministically.
      e = mkBoss('summoner', { spd: 0 });
      for (let i = 0; i < 1500; i++) update(1/60);
      const adds = enemies.filter(k => k.kind === 'norm').length;
      const bossNow = enemies.find(k => k.kind === 'boss');
      const summonerCapped = adds === 8 && bossNow && bossNow.summonsLeft === 0;

      // ENRAGER — hastes nearby enemies (+35% speed); freeze pauses the aura. Pin both
      // (spd 0 on the boss so it stays in range) and put a mover right on top of it.
      const enrageRun = (bossFrozen) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        const boss = { kind:'boss', bossType:'enrager', hp:1000, maxHp:2000, spd:0, r:24, bounty:100,
          color:'#f85149', armor:0, gap:1.5, dist:5, x:W/2, y:H/2, px:W/2, py:H/2,
          slow:0, slowF:0.8, frozen: bossFrozen ? 5 : 0, poison:null, flash:0 };
        const mover = { kind:'norm', hp:1e9, maxHp:1e9, spd:50, r:11, bounty:1, color:'#3fb950',
          armor:0, gap:0.8, dist:5, x:W/2, y:H/2, px:W/2, py:H/2, slow:0, slowF:0.6, frozen:0, poison:null, flash:0 };
        enemies.push(boss, mover);
        for (let i = 0; i < 30; i++) update(1/60);
        return enemies.find(k => k.kind === 'norm');
      };
      const hm = enrageRun(false);
      const enrageHastes = hm && hm.hasted > 0;
      const fm = enrageRun(true);
      const frozenNoHaste = fm && !(fm.hasted > 0);

      // TELEPORTER — blinks forward (dist jumps) and goes briefly intangible; freeze pauses
      // the jump. Pin spd 0 so any dist gain comes only from the blink, then run long enough
      // to guarantee a blink (~4s cd).
      e = mkBoss('teleporter', { spd: 0, dist: 5 });
      let blinked = false, sawInvuln = false;
      for (let i = 0; i < 300; i++) { update(1/60); if (enemies[0] && enemies[0].blinkInvuln > 0) sawInvuln = true; }
      blinked = enemies[0] && enemies[0].dist > 5;
      // freeze pauses the jump: a frozen teleporter (spd 0) should never advance.
      e = mkBoss('teleporter', { spd: 0, dist: 5, frozen: 99 });
      for (let i = 0; i < 300; i++) update(1/60);
      const frozenNoBlink = enemies[0] && Math.abs(enemies[0].dist - 5) < 1e-6;
      // intangibility decays even while frozen, so a boss frozen mid-blink can't stay immortal.
      e = mkBoss('teleporter', { spd: 0, dist: 5, frozen: 99, blinkInvuln: 0.4 });
      for (let i = 0; i < 60; i++) update(1/60);
      const frozenInvulnDecays = enemies[0] && enemies[0].blinkInvuln <= 0;

      // BERSERKER — accelerates as HP drops. A near-dead berserker should cover clearly more
      // distance than a full-HP one over the same sim (speed scales with missing HP in the
      // movement line; no ticked field). Freeze pins it (slowMul=0), raging or not.
      e = mkBoss('berserker', { hp: 2000, maxHp: 2000, spd: 30, dist: 5 });   // full HP → no rage (×1.0)
      for (let i = 0; i < 60; i++) update(1/60);
      const fullDist = enemies[0].dist - 5;
      e = mkBoss('berserker', { hp: 200, maxHp: 2000, spd: 30, dist: 5 });    // 10% HP → ×1.54
      for (let i = 0; i < 60; i++) update(1/60);
      const woundedDist = enemies[0].dist - 5;
      const berserkerAccelerates = woundedDist > fullDist * 1.3 && fullDist > 0;
      e = mkBoss('berserker', { hp: 200, maxHp: 2000, spd: 30, dist: 5, frozen: 99 });
      for (let i = 0; i < 60; i++) update(1/60);
      const frozenNoRush = enemies[0] && Math.abs(enemies[0].dist - 5) < 1e-6;

      // DISRUPTOR — periodically EMPs the nearest firing tower (sets empT > 0); freeze pauses it.
      // Pin the boss (spd 0, dist 60) and drop a gun tower right at the boss's RESOLVED path point
      // (update() overwrites e.x/e.y from pointAt(dist) every tick, so co-locate via pointAt — the
      // aura-enemy x/y gotcha). Run past one pulse (~4s cd at 60fps → 240 frames; give margin).
      const dp = pointAt(60);
      const disruptRun = (bossFrozen) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        const boss = { kind:'boss', bossType:'disruptor', hp:1000, maxHp:2000, spd:0, r:24, bounty:100,
          color:'#f85149', armor:0, gap:1.5, dist:60, x:dp.x, y:dp.y, px:dp.x, py:dp.y,
          slow:0, slowF:0.8, frozen: bossFrozen ? 999 : 0, poison:null, flash:0 };
        const tw = { type:'gun', x:dp.x+20, y:dp.y, range:120, dmg:1, rate:1, cd:0, level:1,
          baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, empT:0 };
        enemies.push(boss); towers.push(tw);
        let sawOffline = false;
        for (let i = 0; i < 360; i++) { update(1/60); if (towers[0] && towers[0].empT > 0) sawOffline = true; }
        return sawOffline;
      };
      const disruptorEmps = disruptRun(false);
      const frozenNoEmp = !disruptRun(true);
      // a buff/support tower is immune — the boss should never knock it offline (same co-location)
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
      enemies.push({ kind:'boss', bossType:'disruptor', hp:1000, maxHp:2000, spd:0, r:24, bounty:100,
        color:'#f85149', armor:0, gap:1.5, dist:60, x:dp.x, y:dp.y, px:dp.x, py:dp.y, slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });
      towers.push({ type:'buff', x:dp.x+20, y:dp.y, range:120, dmg:0, rate:1, cd:0, level:1, baseCost:50,
        invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, empT:0 });
      for (let i = 0; i < 360; i++) update(1/60);
      const buffImmune = !(towers[0] && towers[0].empT > 0);

      // JUGGERNAUT — immune to crowd control: a FROZEN juggernaut still advances (its CC clear
      // runs unconditionally, before slowMul), and frost slow never sticks. The control (a frozen
      // vanilla boss) must stay pinned, so the assertion proves the immunity isn't just "all bosses
      // move". Pin nothing — give it real speed so distance is observable.
      e = mkBoss('juggernaut', { spd: 30, dist: 5, frozen: 99 });
      for (let i = 0; i < 60; i++) update(1/60);
      const juggIgnoresFreeze = enemies[0] && enemies[0].dist > 5 && enemies[0].frozen === 0;
      e = mkBoss('regen', { spd: 30, dist: 5, frozen: 99 });   // control: a normal frozen boss is pinned
      for (let i = 0; i < 60; i++) update(1/60);
      const frozenBossStays = enemies[0] && Math.abs(enemies[0].dist - 5) < 1e-6;
      e = mkBoss('juggernaut', { spd: 30, dist: 5, slow: 5 }); // frost slow is shrugged off too
      for (let i = 0; i < 5; i++) update(1/60);
      const juggIgnoresSlow = enemies[0] && enemies[0].slow === 0;

      // SIPHON — drains the player's GOLD every ~3.5s while alive; floored at 0; freeze pauses it.
      // Pin spd 0 (no leak/kills), so gold can only move via the drain. Run past one ~3.5s pulse.
      e = mkBoss('siphon', { spd: 0, dist: 5 });
      gold = 1000;
      for (let i = 0; i < 300; i++) update(1/60);
      const siphonDrains = gold < 1000;
      // freeze pauses the drain — a frozen siphon boss must not touch gold.
      e = mkBoss('siphon', { spd: 0, dist: 5, frozen: 999 });
      gold = 1000;
      for (let i = 0; i < 300; i++) update(1/60);
      const frozenNoDrain = Math.abs(gold - 1000) < 1e-6;
      // floored at 0 — with no gold the drain can never push you negative (no soft-lock).
      e = mkBoss('siphon', { spd: 0, dist: 5 });
      gold = 0;
      for (let i = 0; i < 300; i++) update(1/60);
      const siphonFloors = gold === 0;

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { vanillaEarly, rotation, regenHeals, frozenNoHeal, shieldSoaks, shieldRaised, adds, summonerCapped, enrageHastes, frozenNoHaste, blinked, sawInvuln, frozenNoBlink, frozenInvulnDecays, berserkerAccelerates, frozenNoRush, disruptorEmps, frozenNoEmp, buffImmune, juggIgnoresFreeze, frozenBossStays, juggIgnoresSlow, siphonDrains, frozenNoDrain, siphonFloors };
    });
    check('bosses below wave 20 stay vanilla (no archetype)', r.vanillaEarly);
    check('archetype rotation at w20/25/30/35/40 (regen→summoner→bulwark→…)', r.rotation);
    check('regen boss heals itself over time', r.regenHeals);
    check('freezing a regen boss pauses its healing', r.frozenNoHeal);
    check('bulwark active shield soaks 60% of a hit', r.shieldSoaks);
    check('bulwark raises its shield on a cycle', r.shieldRaised);
    check('summoner spawns adds capped at 8 total', r.summonerCapped, `adds=${r.adds}`);
    check('enrager hastes nearby enemies', r.enrageHastes);
    check('freezing an enrager pauses its haste aura', r.frozenNoHaste);
    check('teleporter boss blinks forward (dist jumps)', r.blinked);
    check('teleporter boss goes intangible mid-blink', r.sawInvuln);
    check('freezing a teleporter pauses its blink', r.frozenNoBlink);
    check('teleporter intangibility decays even while frozen (no immortality)', r.frozenInvulnDecays);
    check('berserker boss accelerates as its HP drops', r.berserkerAccelerates);
    check('freezing a berserker stops its rush (no movement)', r.frozenNoRush);
    check('disruptor boss knocks the nearest tower offline (empT > 0)', r.disruptorEmps);
    check('freezing a disruptor pauses its EMP pulse', r.frozenNoEmp);
    check('disruptor never silences a buff/support tower', r.buffImmune);
    check('juggernaut boss is immune to freeze (still advances while frozen)', r.juggIgnoresFreeze);
    check('control: a frozen non-juggernaut boss stays pinned', r.frozenBossStays);
    check('juggernaut boss shrugs off frost slow (slow cleared)', r.juggIgnoresSlow);
    check('siphon boss drains the player\'s gold while alive', r.siphonDrains);
    check('freezing a siphon boss pauses its gold drain', r.frozenNoDrain);
    check('siphon drain is floored at 0 (never negative)', r.siphonFloors);

    // Each archetype boss is still KILLABLE — inject one of each at modest HP, co-located
    // with a god tower at a real path point (pointAt(d) returns proper {x,y}; raw
    // waypoints are [x,y] arrays), then confirm it dies within a bounded sim (no immortal
    // mechanic / hang). Even the bulwark's damage-soak only delays, never blocks, a kill.
    const killable = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const sp = pointAt(60);
      const results = {};
      for (const bt of ['regen', 'bulwark', 'summoner', 'enrager', 'teleporter', 'berserker', 'disruptor', 'juggernaut', 'siphon', 'hydra', 'revenant']) {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        towers.push({ type:'gun', x:sp.x, y:sp.y, range:99999, dmg:1e9, rate:0.05, cd:0,
          level:1, baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0,
          buffPower:0.25, flash:0 });
        enemies.push({ kind:'boss', bossType:bt, hp:5000, maxHp:5000, spd:6, r:24, bounty:100,
          color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
          slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });
        let guard = 0;
        while (enemies.some(e => e.kind === 'boss') && guard < 3000) { update(1/60); guard++; }
        results[bt] = { died: !enemies.some(e => e.kind === 'boss'), guard };
      }
      backToMenu(); localStorage.removeItem('cd_save');
      return results;
    });
    check('regen boss is killable (dies under sustained fire)', killable.regen.died, `guard=${killable.regen.guard}`);
    check('bulwark boss is killable (shield only delays, not immortal)', killable.bulwark.died, `guard=${killable.bulwark.guard}`);
    check('summoner boss is killable', killable.summoner.died, `guard=${killable.summoner.guard}`);
    check('enrager boss is killable', killable.enrager.died, `guard=${killable.enrager.guard}`);
    check('teleporter boss is killable', killable.teleporter.died, `guard=${killable.teleporter.guard}`);
    check('berserker boss is killable', killable.berserker.died, `guard=${killable.berserker.guard}`);
    check('disruptor boss is killable', killable.disruptor.died, `guard=${killable.disruptor.guard}`);
    check('juggernaut boss is killable', killable.juggernaut.died, `guard=${killable.juggernaut.guard}`);
    check('siphon boss is killable', killable.siphon.died, `guard=${killable.siphon.guard}`);
    check('hydra boss is killable', killable.hydra.died, `guard=${killable.hydra.guard}`);
    check('revenant boss is killable (revives once, then dies)', killable.revenant.died, `guard=${killable.revenant.guard}`);

    // Full late wave with the archetype boss still drives to completion (multi-tower
    // god setup via the harness driver — the proven pattern from groups [2]/[3]).
    const beat = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const r = __cdDrive({ maxWave: 22 });    // drives THROUGH wave 20 (regen archetype boss)
      const r2 = { reached: wave >= 21, wave, hitCap: r.hitCap, gameOver };
      backToMenu(); localStorage.removeItem('cd_save');
      return r2;
    });
    check('drives through the w20 archetype boss wave without hanging', beat.reached && !beat.hitCap,
      `wave=${beat.wave} hitCap=${beat.hitCap} gameOver=${beat.gameOver}`);
    check('no console errors during boss-archetype test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [46] New Mayhem wave modifiers — Armored Surge + Brownout (v1.27.0)
  console.log('\n[46] Mayhem wave mods (armored / brownout)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasArmored  = WAVE_MODS.some(m => m.id === 'armored');
      const hasBrownout = WAVE_MODS.some(m => m.id === 'brownout');
      const hasRegen    = WAVE_MODS.some(m => m.id === 'regen');

      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // REGENERATION — every enemy (and the boss) of the wave is tagged to self-heal.
      setMod(null);
      const plainTagged = buildWave(10).some(e => e.regen);
      setMod('regen');
      const regenWave = buildWave(10);
      const regenNormTagged = regenWave.filter(e => e.kind === 'norm').every(e => e.regen === true);
      const regenBossTagged = buildWave(10).find(e => e.kind === 'boss').regen === true;

      // ARMORED SURGE — every enemy (and the boss) gains flat armor on top of its base.
      setMod(null);
      const wave10Plain = buildWave(10);
      const plainNorm = wave10Plain.find(e => e.kind === 'norm');
      setMod('armored');
      const wave10Armored = buildWave(10);
      const armoredNorm = wave10Armored.find(e => e.kind === 'norm');
      const armoredBoss = buildWave(10).find(e => e.kind === 'boss');
      // +5 + floor(10*0.3) = +8 at wave 10.
      const armorAdds = armoredNorm.armor - plainNorm.armor === 8;
      // Base boss armor is w*0.5 (v1.64.0; was w*0.4) → at w10 that's 5, +8 from the mod = 13.
      const bossArmorAdds = armoredBoss.armor === (10 * 0.5) + 8;

      // BROWNOUT — towers fire 25% slower (effRate ×1.25). Inert when the mod is off.
      const t = { type:'gun', rate:1.0, spec:null, level:1 };
      setMod(null);     const rateNormal   = effRate(t);
      setMod('brownout'); const rateBrownout = effRate(t);
      const brownoutSlows = Math.abs(rateBrownout - rateNormal * 1.25) < 1e-9;

      // Mods are inert in NON-mayhem mode (rollWaveMod bails) — sanity that the menu
      // path can't accidentally apply them. effRate with no waveMod is the base rate.
      setMod(null);
      const inertOff = Math.abs(effRate(t) - rateNormal) < 1e-9;

      // A regen-tagged enemy actually heals over time in update() — and freeze pauses it.
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;   // no auto-start polluting `enemies`
      const mk = (frozen) => ({ kind:'norm', hp:50, maxHp:100, spd:0, r:11, bounty:1, color:'#3fb950',
        armor:0, gap:0, dist:0, slow:0, slowF:0.6, frozen, poison:null, flash:0, px:0, py:0, regen:true });
      const heals = mk(0);
      enemies.push(heals);
      const hpBefore = heals.hp;
      for (let i = 0; i < 60; i++) update(1/60);   // ~1s -> +~2 HP
      const healedUp = heals.hp > hpBefore && heals.hp <= heals.maxHp;
      // Frozen regen enemy does NOT heal (freeze pauses it, like boss-regen/heal).
      enemies.length = 0;
      const frozenE = mk(5);
      enemies.push(frozenE);
      const fBefore = frozenE.hp;
      for (let i = 0; i < 60; i++) update(1/60);
      const frozenNoHeal = Math.abs(frozenE.hp - fBefore) < 1e-6;
      enemies.length = 0;

      waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasArmored, hasBrownout, hasRegen, armorAdds, bossArmorAdds, brownoutSlows, inertOff,
               plainArmor: plainNorm.armor, armoredArmor: armoredNorm.armor,
               plainTagged, regenNormTagged, regenBossTagged, healedUp, frozenNoHeal };
    });
    check('WAVE_MODS includes Armored Surge', r.hasArmored);
    check('WAVE_MODS includes Brownout', r.hasBrownout);
    check('WAVE_MODS includes Regeneration', r.hasRegen);
    check('Regeneration tags every enemy + boss (and not when off)', !r.plainTagged && r.regenNormTagged && r.regenBossTagged);
    check('Regeneration enemy self-heals over time', r.healedUp);
    check('Frozen regen enemy does not heal (freeze pauses it)', r.frozenNoHeal);
    check('Armored Surge adds +8 armor to enemies at wave 10', r.armorAdds, `${r.plainArmor}->${r.armoredArmor}`);
    check('Armored Surge adds armor to the boss too', r.bossArmorAdds);
    check('Brownout slows tower fire-rate by 25%', r.brownoutSlows);
    check('wave mods are inert when waveMod is cleared', r.inertOff);

    // A real Mayhem run still drives to completion with these mods in the pool (the
    // 78% roll can land either new mod) — no hang, no console error.
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 8 });
      const out = { reached: wave >= 7, wave, hitCap: res.hitCap };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Mayhem run drives clean with new mods in pool', drove.reached && !drove.hitCap,
      `wave=${drove.wave} hitCap=${drove.hitCap}`);
    check('no console errors during wave-mod test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [47] Daily Challenge — deterministic date-seeded run (v1.28.0)
  console.log('\n[47] Daily Challenge (seeded daily run)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const D1 = '20260615', D2 = '20260616';
      // Determinism: same date -> identical difficulty, path, and modifier schedule.
      setupDaily(D1);
      const a = { diff: diffKey, pts: JSON.stringify(MAPS.mayhem.pts), mods: dailyMods.slice(0).join(',') };
      setupDaily(D2);  // perturb the rng stream / globals
      setupDaily(D1);
      const b = { diff: diffKey, pts: JSON.stringify(MAPS.mayhem.pts), mods: dailyMods.slice(0).join(',') };
      const deterministic = a.diff === b.diff && a.pts === b.pts && a.mods === b.mods;

      // Different dates generally differ (path and/or mod schedule).
      setupDaily(D2);
      const c = { diff: diffKey, pts: JSON.stringify(MAPS.mayhem.pts), mods: dailyMods.slice(0).join(',') };
      const datesDiffer = c.pts !== a.pts || c.mods !== a.mods;

      // Difficulty is always normal/hard (never easy) — a daily is a challenge.
      let diffOk = true;
      for (const ds of ['20260101', '20260202', '20260303', '20260404', '20260505', '20260606']) {
        setupDaily(ds); if (diffKey !== 'normal' && diffKey !== 'hard') diffOk = false;
      }

      // Mod schedule is a deterministic per-wave lookup, so rollWaveMod is reproducible.
      setupDaily(D1); daily = true; gameMode = 'quick'; mapKey = 'mayhem';
      const sched = [null];  // 1-based, mirror dailyMods
      for (let w = 1; w <= 30; w++) { wave = w; rollWaveMod(); sched[w] = waveMod ? waveMod.id : null; }
      let matchesSchedule = true;
      for (let w = 1; w <= 30; w++) if (sched[w] !== (dailyMods[w] || null)) matchesSchedule = false;
      daily = false; waveMod = null;

      // dailyPreview() mirrors setupDaily's seeded setup WITHOUT mutating any global state:
      // same difficulty, and its distinct mod-id set equals the non-null entries of the schedule.
      setupDaily(D1);
      const liveDiff = diffKey;
      const liveModSet = [...new Set(dailyMods.slice(1).filter(Boolean))].sort().join(',');
      const livePath = JSON.stringify(MAPS.mayhem.pts);
      const pv = dailyPreview(D1);
      const previewDiffMatch = pv.diff === liveDiff;
      const previewModsMatch = [...pv.modIds].sort().join(',') === liveModSet;
      // calling the preview must NOT change diffKey / the path / the mod schedule.
      const previewPure = diffKey === liveDiff
        && JSON.stringify(MAPS.mayhem.pts) === livePath
        && [...new Set(dailyMods.slice(1).filter(Boolean))].sort().join(',') === liveModSet;
      // modIds is distinct (no duplicate ids) and all valid WAVE_MODS ids.
      const previewDistinct = pv.modIds.length === new Set(pv.modIds).size
        && pv.modIds.every(id => MOD_BY_ID[id]);

      return { deterministic, datesDiffer, diffOk, matchesSchedule,
               modsLen: dailyMods.length,
               previewDiffMatch, previewModsMatch, previewPure, previewDistinct };
    });
    check('daily setup is deterministic for a given date', r.deterministic);
    check('different dates produce different daily runs', r.datesDiffer);
    check('daily difficulty is always normal/hard (never easy)', r.diffOk);
    check('daily wave-mod schedule covers waves 1..30', r.modsLen === 31);
    check('rollWaveMod follows the seeded daily schedule', r.matchesSchedule);
    check('dailyPreview difficulty matches setupDaily', r.previewDiffMatch);
    check('dailyPreview mod set matches the seeded schedule', r.previewModsMatch);
    check('dailyPreview does not mutate global state', r.previewPure);
    check('dailyPreview returns distinct, valid mod ids', r.previewDistinct);

    // beginDaily wires a real run; the map is FIXED (no every-5-waves shift) and the
    // player's existing saved run is left untouched (daily never saves).
    const run = await page.evaluate(() => {
      localStorage.setItem('cd_save', '__SENTINEL__');  // pretend the player has a normal run saved
      beginDaily();
      const flagged = daily === true && gameMode === 'quick' && mapKey === 'mayhem';
      const pathBefore = JSON.stringify(MAPS.mayhem.pts);
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 7 });   // crosses a 5-wave boundary (would shift in normal Mayhem)
      const pathFixed = JSON.stringify(MAPS.mayhem.pts) === pathBefore;
      const saveUntouched = localStorage.getItem('cd_save') === '__SENTINEL__';  // saveRun bailed
      const out = { flagged, pathFixed, saveUntouched, reached: wave >= 6, hitCap: res.hitCap, daily };
      daily = false; backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('beginDaily sets daily/quick/mayhem', run.flagged);
    check('daily map path stays fixed across a 5-wave boundary', run.pathFixed);
    check('daily run does not overwrite the normal saved run', run.saveUntouched);
    check('daily run drives clean past several waves', run.reached && !run.hitCap, `wave=${run.wave} hitCap=${run.hitCap}`);

    // recordBest writes the per-date daily key (and not a per-map quick key).
    const rec = await page.evaluate(() => {
      const DK = '20260615';
      localStorage.removeItem('cd_daily_' + DK);
      localStorage.removeItem('cd_best_mayhem_hard'); localStorage.removeItem('cd_best_mayhem_normal');
      daily = true; gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'hard';
      dailyDateKey = DK; dailySeed = 1; wave = 12; best = 0;
      const ev1 = recordBest();                 // first entry — records silently (no flourish)
      const stored = +(localStorage.getItem('cd_daily_' + DK) || 0);
      const noMapKey = localStorage.getItem('cd_best_mayhem_hard') === null
                    && localStorage.getItem('cd_best_mayhem_normal') === null;
      // beating it fires the flourish event; a lower wave does not.
      best = 12; wave = 18; const ev2 = recordBest();
      best = 18; wave = 9;  const ev3 = recordBest();
      const finalStored = +(localStorage.getItem('cd_daily_' + DK) || 0);
      // bestKey() routes to the daily key when daily is on.
      const keyRoutes = bestKey() === 'cd_daily_' + DK;
      daily = false;
      localStorage.removeItem('cd_daily_' + DK);
      return { stored, noMapKey, firstSilent: ev1 === null, beatFires: !!ev2 && ev2.now === 18 && ev2.prev === 12,
               lowerNoFire: ev3 === null, finalStored, keyRoutes };
    });
    check('daily best stored under cd_daily_<date>', rec.stored === 12, `stored=${rec.stored}`);
    check('daily run does not pollute per-map quick records', rec.noMapKey);
    check('first daily best records silently (no flourish)', rec.firstSilent);
    check('beating the daily best fires the record flourish', rec.beatFires);
    check('a lower daily wave does not fire the flourish', rec.lowerNoFire);
    check('daily best key only climbs (stays 18 after a wave-9 run)', rec.finalStored === 18);
    check('bestKey() routes to the daily key during a daily run', rec.keyRoutes);
    check('no console errors during daily challenge test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [48] New achievement badges — Pacifist / Specialist / Minimalist / Daily Devotee (v1.29.0)
  console.log('\n[48] New achievements (pacifist/specialist/minimalist/daily)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const fresh = () => { meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0 }; };
      // Set up a winnable run, apply the scenario, and return the freshly-granted badge ids.
      const win = (setup) => {
        gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
        beginGame();              // resetState clears daily + abilityUsedThisRun
        wave = victoryWave();
        daily = false;
        towers = [];
        setup();
        return grantAchievements(true).map(a => a.id);
      };

      // PACIFIST — win without casting any ability.
      fresh(); const pacifistYes = win(() => { abilityUsedThisRun = false; towers.push({ type:'gun', dealt:100, kills:1 }); }).includes('pacifist');
      fresh(); const pacifistNo  = win(() => { abilityUsedThisRun = true;  towers.push({ type:'gun', dealt:100, kills:1 }); }).includes('pacifist');

      // SPECIALIST — win using only one tower type.
      fresh(); const monoYes = win(() => { abilityUsedThisRun = true; towers.push({type:'gun'},{type:'gun'},{type:'gun'}); }).includes('monotower');
      fresh(); const monoNo  = win(() => { abilityUsedThisRun = true; towers.push({type:'gun'},{type:'frost'}); }).includes('monotower');

      // MINIMALIST — win with 5 or fewer towers.
      fresh(); const miniYes = win(() => { abilityUsedThisRun = true; for (let i=0;i<5;i++) towers.push({type:'gun'}); }).includes('minimalist');
      fresh(); const miniNo  = win(() => { abilityUsedThisRun = true; for (let i=0;i<6;i++) towers.push({type:'gun'}); }).includes('minimalist');
      // a (degenerate) zero-tower finish must grant neither board badge.
      fresh(); const zero = win(() => { abilityUsedThisRun = true; });
      const zeroNoBadge = !zero.includes('minimalist') && !zero.includes('monotower') && !zero.includes('arsenal');

      // FULL ARSENAL — win with all 8 tower types on the board.
      fresh(); const arsenalYes = win(() => { abilityUsedThisRun = true; for (const k of TYPE_KEYS) towers.push({type:k}); }).includes('arsenal');
      // ...and withheld when even one type is missing (7 of 8).
      fresh(); const arsenalNo  = win(() => { abilityUsedThisRun = true; for (const k of TYPE_KEYS.slice(0, TYPE_KEYS.length - 1)) towers.push({type:k}); }).includes('arsenal');
      // duplicates of fewer types must not satisfy it (8 towers, 1 type).
      fresh(); const arsenalDup = win(() => { abilityUsedThisRun = true; for (let i=0;i<8;i++) towers.push({type:'gun'}); }).includes('arsenal');

      // DAILY DEVOTEE — reach wave 20 in a daily run (granted on ANY finish, win or loss).
      fresh();
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; beginGame();
      daily = true; wave = 20; towers.push({type:'gun'});
      const dailyYes = grantAchievements(false).map(a => a.id).includes('daily20');
      fresh();
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; beginGame();
      daily = false; wave = 25; towers.push({type:'gun'});
      const dailyNoFlag = grantAchievements(false).map(a => a.id).includes('daily20');

      // STREAK KEEPER — reach a 7-day daily streak. recordDailyStreak runs BEFORE grantAchievements
      // in endGame/winGame, so a finish that lifts the streak to 7 grants daily7 on the same run.
      fresh();
      localStorage.setItem('cd_daily_streak', JSON.stringify({ count: 6, last: dailyDayBefore(dailyDateString()) }));
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; beginGame();
      daily = true; wave = 5; towers.push({ type:'gun' });
      recordDailyStreak();                       // extends 6 -> 7 (today)
      const streak7Yes = grantAchievements(false).map(a => a.id).includes('daily7');
      // A finish that only reaches 3 must NOT grant it.
      fresh();
      localStorage.setItem('cd_daily_streak', JSON.stringify({ count: 2, last: dailyDayBefore(dailyDateString()) }));
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; beginGame();
      daily = true; wave = 5; towers.push({ type:'gun' });
      recordDailyStreak();                       // extends 2 -> 3
      const streak7No = grantAchievements(false).map(a => a.id).includes('daily7');

      const total = ACHIEVEMENTS.length;
      daily = false;
      backToMenu();
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg:0, runs:0, bestCombo:0 } };
      localStorage.removeItem('cd_save'); localStorage.removeItem('cd_meta'); localStorage.removeItem('cd_daily_streak');
      return { pacifistYes, pacifistNo, monoYes, monoNo, miniYes, miniNo, zeroNoBadge, arsenalYes, arsenalNo, arsenalDup, dailyYes, dailyNoFlag, streak7Yes, streak7No, total };
    });
    check('Pacifist granted on an ability-free win', r.pacifistYes);
    check('Pacifist withheld when an ability was cast', !r.pacifistNo);
    check('Specialist granted for a mono-type win', r.monoYes);
    check('Specialist withheld for a mixed-type win', !r.monoNo);
    check('Minimalist granted for a ≤5-tower win', r.miniYes);
    check('Minimalist withheld for a 6-tower win', !r.miniNo);
    check('board badges withheld when no towers exist', r.zeroNoBadge);
    check('Full Arsenal granted for an all-8-types win', r.arsenalYes);
    check('Full Arsenal withheld when a type is missing (7 of 8)', !r.arsenalNo);
    check('Full Arsenal withheld for 8 towers of one type', !r.arsenalDup);
    check('Daily Devotee granted at wave 20 in a daily run', r.dailyYes);
    check('Daily Devotee withheld outside a daily run', !r.dailyNoFlag);
    check('Streak Keeper granted on reaching a 7-day daily streak', r.streak7Yes);
    check('Streak Keeper withheld below a 7-day streak', !r.streak7No);
    check('achievement roster grew to 19 badges', r.total === 19, `total=${r.total}`);
    check('no console errors during achievements test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------------------
  console.log('\n[49] PWA — installable manifest + offline service worker (table stakes)');
  {
    // (a) manifest.webmanifest exists, is valid JSON, has the required install fields.
    const manRaw = readFileSync(resolve(ROOT, 'manifest.webmanifest'), 'utf8');
    let man = null, parsed = false;
    try { man = JSON.parse(manRaw); parsed = true; } catch (e) {}
    check('manifest.webmanifest is valid JSON', parsed);
    check('manifest declares name + short_name', !!(man && man.name && man.short_name));
    check('manifest start_url points at the game', !!(man && /tower-defense\.html/.test(man.start_url || '')));
    check('manifest display is standalone', !!(man && man.display === 'standalone'));
    check('manifest sets theme + background colors', !!(man && man.theme_color && man.background_color));
    check('manifest lists at least one icon', !!(man && Array.isArray(man.icons) && man.icons.length >= 1));
    check('manifest icon references icon.svg', !!(man && man.icons && man.icons.some(i => /icon\.svg/.test(i.src || ''))));
    check('manifest icon is maskable', !!(man && man.icons && man.icons.some(i => /maskable/.test(i.purpose || ''))));

    // (b) the referenced icon file exists.
    check('icon.svg exists', existsSync(resolve(ROOT, 'icon.svg')));

    // (c) service worker exists and has the three lifecycle handlers + caches the shell.
    const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
    check('sw.js registers an install handler', /addEventListener\(['"]install['"]/.test(sw));
    check('sw.js registers an activate handler', /addEventListener\(['"]activate['"]/.test(sw));
    check('sw.js registers a fetch handler', /addEventListener\(['"]fetch['"]/.test(sw));
    check('sw.js precaches the game shell (html + css + js)',
      /tower-defense\.html/.test(sw) && /tower-defense\.css/.test(sw) && /cd-core\.js/.test(sw));
    check('sw.js precaches the manifest + icon', /manifest\.webmanifest/.test(sw) && /icon\.svg/.test(sw));
    // (c2) the versioned cache name must track GAME_VERSION so `activate` evicts the stale
    //      shell on every release — else hosted/installed PWA users keep an old cached game
    //      offline (this drifted v1.30.0→v1.32.0 before the v1.32.1 health check caught it).
    const coreSrc = readFileSync(resolve(ROOT, 'cd-core.js'), 'utf8');
    const gameVer = (coreSrc.match(/GAME_VERSION\s*=\s*['"](v[\d.]+)['"]/) || [])[1];
    const cacheVer = (sw.match(/circuit-defense-(v[\d.]+)/) || [])[1];
    check('sw.js cache version matches GAME_VERSION (no stale offline cache)',
      !!gameVer && cacheVer === gameVer, `GAME_VERSION=${gameVer} CACHE=${cacheVer}`);

    // (d) HTML head wires the manifest + apple touch icon.
    const html = readFileSync(resolve(ROOT, 'tower-defense.html'), 'utf8');
    check('HTML links the manifest', /<link[^>]+rel=["']manifest["'][^>]+href=["']manifest\.webmanifest["']/.test(html));
    check('HTML declares an apple-touch-icon', /<link[^>]+rel=["']apple-touch-icon["']/.test(html));

    // (e) the SW registration is guarded so it NEVER runs on file:// (double-click play
    //     + this headless harness must be unaffected — SWs can't register on file://).
    const render = readFileSync(resolve(ROOT, 'cd-render.js'), 'utf8');
    check('SW registration is protocol-guarded (http/https only)',
      /serviceWorker/.test(render) && /location\.protocol\s*===\s*['"]https:['"]/.test(render));

    // (f) live page (served file://): manifest link is in the DOM, no SW controller got
    //     installed (guard held), and zero console errors.
    const { page, consoleErrors } = await newPage(browser);
    const live = await page.evaluate(() => ({
      hasManifestLink: !!document.querySelector('link[rel="manifest"]'),
      protocol: location.protocol,
      swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    }));
    check('manifest link present in the live DOM', live.hasManifestLink);
    check('no service worker registered on file://', live.protocol !== 'file:' || live.swController === false);
    check('no console errors with PWA wiring', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------------------
  // [50] Daily streak counter — consecutive-day tracking (v1.31.0)
  console.log('\n[50] Daily streak (consecutive-day counter)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      localStorage.removeItem('cd_daily_streak');
      const out = {};

      // dailyDayBefore: correct calendar arithmetic incl. month/year rollover.
      out.before1 = dailyDayBefore('20260615') === '20260614';
      out.beforeMonth = dailyDayBefore('20260601') === '20260531';
      out.beforeYear = dailyDayBefore('20260101') === '20251231';

      // Fresh: no streak yet.
      out.fresh = currentDailyStreak() === 0;

      // First finish starts the streak at 1.
      let res = recordDailyStreak('20260610');
      out.firstIsOne = res.count === 1 && res.extended === true;

      // Same day again is a no-op (one per calendar day).
      res = recordDailyStreak('20260610');
      out.sameDayNoop = res.count === 1 && res.extended === false;

      // Consecutive days extend.
      res = recordDailyStreak('20260611'); const c2 = res.count, e2 = res.extended;
      res = recordDailyStreak('20260612'); const c3 = res.count, e3 = res.extended;
      out.consecGrows = c2 === 2 && e2 && c3 === 3 && e3;

      // A gap (missed day) resets to 1.
      res = recordDailyStreak('20260614');
      out.gapResets = res.count === 1 && res.extended === true;

      // currentDailyStreak counts a streak whose last finish was "yesterday" relative to today,
      // but reads 0 once it has lapsed (last finish older than yesterday).
      const today = dailyDateString();
      localStorage.setItem('cd_daily_streak', JSON.stringify({ count: 7, last: dailyDayBefore(today) }));
      out.standsYesterday = currentDailyStreak() === 7;
      localStorage.setItem('cd_daily_streak', JSON.stringify({ count: 7, last: today }));
      out.standsToday = currentDailyStreak() === 7;
      localStorage.setItem('cd_daily_streak', JSON.stringify({ count: 7, last: dailyDayBefore(dailyDayBefore(today)) }));
      out.lapsedReadsZero = currentDailyStreak() === 0;

      // Old saves (no key / malformed) default cleanly to 0.
      localStorage.removeItem('cd_daily_streak');
      out.missingIsZero = currentDailyStreak() === 0;
      localStorage.setItem('cd_daily_streak', 'not json');
      out.malformedIsZero = currentDailyStreak() === 0;

      // A finished daily run actually records a streak via endGame (the live path).
      localStorage.removeItem('cd_daily_streak');
      daily = true; gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'hard';
      dailyDateKey = dailyDateString(); dailySeed = 1; wave = 8; best = 0;
      started = true; gameOver = false;
      endGame();
      const stored = JSON.parse(localStorage.getItem('cd_daily_streak') || 'null');
      out.endGameRecorded = !!(stored && stored.count === 1 && stored.last === dailyDateString());

      // Cleanup.
      daily = false; localStorage.removeItem('cd_daily_streak'); backToMenu();
      return out;
    });
    check('dailyDayBefore steps back one day', r.before1);
    check('dailyDayBefore handles month rollover', r.beforeMonth);
    check('dailyDayBefore handles year rollover', r.beforeYear);
    check('no streak before any daily is finished', r.fresh);
    check('first daily finish starts streak at 1', r.firstIsOne);
    check('replaying the same day does not pad the streak', r.sameDayNoop);
    check('consecutive days grow the streak', r.consecGrows);
    check('a missed day resets the streak to 1', r.gapResets);
    check('streak still stands when last finish was yesterday', r.standsYesterday);
    check('streak still stands when last finish was today', r.standsToday);
    check('a lapsed streak (older than yesterday) reads 0', r.lapsedReadsZero);
    check('missing streak key defaults to 0', r.missingIsZero);
    check('malformed streak key defaults to 0', r.malformedIsZero);
    check('finishing a daily run records the streak via endGame', r.endGameRecorded);
    check('no console errors during daily streak test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [51] Glass Cannon legendary perk — +50% damage / −30% range trade-off (v1.32.0)
  console.log('\n[51] Glass Cannon trade-off perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // perk exists in the pool and is a legendary
      const def = PERKS.find(p => p.id === 'glasscannon');
      const inPool = !!def && def.rarity === 'legendary';

      // baseline (perk not held)
      perkState.glassCannon = false;
      const dBase = effDmg(gun), rBase = effRange(gun);
      // perk held: +50% damage, −30% range
      perkState.glassCannon = true;
      const dGC = effDmg(gun), rGC = effRange(gun);

      // booster aura range (effBuffRange) is NOT affected by Glass Cannon
      const booster = { type:'buff', x:400, y:300, level:1, spec:null, range:45, buffPower:0.25 };
      towers.push(booster);
      const buffRangeGC = effBuffRange(booster);
      const buffRangeExpected = booster.range; // mastery_buff rank 0 => ×1

      // freshPerkState default present & save-safe
      const fresh = freshPerkState();
      const defaultsOk = fresh.glassCannon === false;

      // save -> restore round-trip
      perkState.glassCannon = true;
      saveRun();
      perkState.glassCannon = false; // clobber
      const loaded = loadRun();
      const restored = perkState.glassCannon === true;

      // old-save migration: a cd_save whose perkState lacks the field defaults it to false
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.glassCannon;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.glassCannon === false;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, dBase, dGC, rBase, rGC, buffRangeGC, buffRangeExpected, defaultsOk, loaded, restored, migratedOk };
    });
    check('Glass Cannon is a legendary perk in the pool', r.inPool);
    check('Glass Cannon gives +50% damage', Math.abs(r.dGC - r.dBase * 1.5) < 1e-6, `base=${r.dBase} gc=${r.dGC}`);
    check('Glass Cannon cuts range by 30%', Math.abs(r.rGC - r.rBase * 0.7) < 1e-6, `base=${r.rBase} gc=${r.rGC}`);
    check('Glass Cannon leaves booster aura range untouched', Math.abs(r.buffRangeGC - r.buffRangeExpected) < 1e-6, `buff=${r.buffRangeGC}`);
    check('freshPerkState defaults glassCannon:false', r.defaultsOk);
    check('save/reload round-trips the Glass Cannon flag', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing glassCannon migrates to default', r.migratedOk);
    check('no console errors during Glass Cannon test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [52] Warden enemy — protective damage-shield aura (v1.35.0)
  console.log('\n[52] Warden enemy (damage-shield aura)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w15, present from w15
      const w14 = buildWave(14).some(e => e.kind === 'warden');
      const w15 = buildWave(15).filter(e => e.kind === 'warden').length;

      // (b) focused aura mechanics: a warden + victims, no movement so positions stick
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;   // no auto-start polluting `enemies`
      const mid = pathLen * 0.4;
      // x/y are set explicitly from the path point (like the phantom test) so the aura's
      // distance check is valid on the very first frame regardless of array order — update()
      // refreshes e.x/e.y per-enemy at the start of its own iteration, so a brand-new mock
      // enemy processed AFTER the warden would otherwise have undefined x/y that frame.
      const mk = (kind, dist, extra = {}) => { const p = pointAt(dist); return ({ kind,
        hp:1000, maxHp:1000, spd:0, r:11, bounty:1, color:'#58a6ff', armor:0, gap:0, dist,
        x:p.x, y:p.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0, ...extra }); };
      const warden  = mk('warden', mid);
      const victim  = mk('norm', mid);   // same point on the path -> inside the aura
      const far     = mk('norm', 0);     // start of path -> well outside the aura
      const warden2 = mk('warden', mid); // a second warden -> must NOT be warded
      enemies.push(warden, victim, far, warden2);
      update(1/60);                       // aura tags this frame
      const victimWarded   = victim.warded > 0;
      const wardenSelfFree = !(warden.warded > 0);   // wardens never ward themselves...
      const wardenPeerFree = !(warden2.warded > 0);  // ...nor each other (always killable)
      const farUnwarded    = !(far.warded > 0);

      // damage reduction: a warded enemy takes 40% less (×0.6); an unwarded one takes full
      const hpW = victim.hp; damage(victim, 100, null);
      const wardedTook = hpW - victim.hp;            // expect 60
      const hpF = far.hp;    damage(far, 100, null);
      const unwardedTook = hpF - far.hp;             // expect 100

      // frozen warden pauses the aura (freeze counters it, like heal/boss mechanics)
      enemies.length = 0;
      const fw = mk('warden', mid, { frozen: 5 });
      const fv = mk('norm', mid);
      enemies.push(fw, fv);
      update(1/60);
      const frozenNoWard = !(fv.warded > 0);

      // the warded timer decays once the warden is gone (pop it -> cluster un-shields)
      enemies.length = 0;
      const v2 = mk('norm', mid, { warded: 0.25 });
      enemies.push(v2);                  // no warden present
      for (let i = 0; i < 20; i++) update(1/60);
      const decays = v2.warded === 0;
      enemies.length = 0;

      // (c) preview/render plumbing: composition + glyph + colour all know the warden
      const compHasWarden = waveComposition(15).some(c => c.kind === 'warden');
      const glyph = enemyGlyph({ kind:'warden', frozen:0 });
      const hasColor = !!PREVIEW_COLOR.warden;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (d) integration: a real wave-15+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 16 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w14, w15, victimWarded, wardenSelfFree, wardenPeerFree, farUnwarded,
               wardedTook, unwardedTook, frozenNoWard, decays, compHasWarden, glyph, hasColor, run };
    });
    check('no wardens before wave 15', r.w14 === false);
    check('wardens spawn from wave 15', r.w15 >= 1, 'count=' + r.w15);
    check('warden tags a nearby enemy as warded', r.victimWarded);
    check('a warden does not ward itself', r.wardenSelfFree);
    check('a warden does not ward other wardens (stays killable)', r.wardenPeerFree);
    check('an enemy outside the aura is not warded', r.farUnwarded);
    check('warded enemy takes 40% less damage (×0.6)', Math.abs(r.wardedTook - 60) < 1e-6, 'took=' + r.wardedTook);
    check('unwarded enemy takes full damage', Math.abs(r.unwardedTook - 100) < 1e-6, 'took=' + r.unwardedTook);
    check('frozen warden does not project its aura', r.frozenNoWard);
    check('warded timer decays once the warden is gone', r.decays);
    check('waveComposition includes warden at wave 15', r.compHasWarden);
    check('enemyGlyph returns ◈ for warden', r.glyph === '◈', 'glyph=' + r.glyph);
    check('PREVIEW_COLOR has a warden colour', r.hasColor);
    check('wave-15+ run with wardens reaches w>=16 alive', r.run.wave >= 16 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during warden tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [53] Boss-bar mechanic badge — names the active archetype on the boss HP bar (v1.36.0)
  console.log('\n[53] Boss-bar mechanic badge');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const mk = (over = {}) => Object.assign(
        { kind:'boss', hp:1000, maxHp:2000, x:W/2, y:H/2 }, over);
      const out = {
        // vanilla (pre-w20) boss has no archetype → no badge
        vanilla: bossMechanicBadge(mk({})),
        regen: bossMechanicBadge(mk({ bossType:'regen' })),
        summoner: bossMechanicBadge(mk({ bossType:'summoner' })),
        bulwark: bossMechanicBadge(mk({ bossType:'bulwark' })),
        bulwarkShielded: bossMechanicBadge(mk({ bossType:'bulwark', shieldOn:true })),
        enrager: bossMechanicBadge(mk({ bossType:'enrager' })),
        teleporter: bossMechanicBadge(mk({ bossType:'teleporter' })),
        berserker: bossMechanicBadge(mk({ bossType:'berserker' })),
        disruptor: bossMechanicBadge(mk({ bossType:'disruptor' })),
        juggernaut: bossMechanicBadge(mk({ bossType:'juggernaut' })),
        siphon: bossMechanicBadge(mk({ bossType:'siphon' })),
        revenant: bossMechanicBadge(mk({ bossType:'revenant' })),
        revenantUsed: bossMechanicBadge(mk({ bossType:'revenant', revived:true })),
        conduit: bossMechanicBadge(mk({ bossType:'conduit' })),
        conduitShielded: bossMechanicBadge(mk({ bossType:'conduit', conduitGuard:3 })),
        nullBoss: bossMechanicBadge(null),
        unknown: bossMechanicBadge(mk({ bossType:'mystery' })),
      };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('vanilla boss (no archetype) shows no badge', r.vanilla === null);
    check('null boss → no badge (no crash)', r.nullBoss === null);
    check('unknown archetype → no badge', r.unknown === null);
    check('regen badge labelled REGENERATING (green)', r.regen && r.regen.label === 'REGENERATING' && r.regen.c === '86,211,100', JSON.stringify(r.regen));
    check('summoner badge labelled SUMMONER (red)', r.summoner && r.summoner.label === 'SUMMONER' && r.summoner.c === '255,148,146', JSON.stringify(r.summoner));
    check('bulwark badge labelled BULWARK when shield down (blue)', r.bulwark && r.bulwark.label === 'BULWARK' && r.bulwark.c === '121,192,255', JSON.stringify(r.bulwark));
    check('bulwark badge flips to SHIELDED while shield is up', r.bulwarkShielded && r.bulwarkShielded.label === 'SHIELDED', JSON.stringify(r.bulwarkShielded));
    check('enrager badge labelled ENRAGED (orange)', r.enrager && r.enrager.label === 'ENRAGED' && r.enrager.c === '255,180,84', JSON.stringify(r.enrager));
    check('teleporter badge labelled TELEPORTER (violet)', r.teleporter && r.teleporter.label === 'TELEPORTER' && r.teleporter.c === '188,140,255', JSON.stringify(r.teleporter));
    check('berserker badge labelled BERSERK (crimson)', r.berserker && r.berserker.label === 'BERSERK' && r.berserker.c === '255,106,106', JSON.stringify(r.berserker));
    check('disruptor badge labelled DISRUPTOR (cyan)', r.disruptor && r.disruptor.label === 'DISRUPTOR' && r.disruptor.c === '125,249,255', JSON.stringify(r.disruptor));
    check('juggernaut badge labelled UNSTOPPABLE (steel)', r.juggernaut && r.juggernaut.label === 'UNSTOPPABLE' && r.juggernaut.c === '192,200,214', JSON.stringify(r.juggernaut));
    check('siphon badge labelled SIPHON (gold)', r.siphon && r.siphon.label === 'SIPHON' && r.siphon.c === '227,179,65', JSON.stringify(r.siphon));
    check('revenant badge labelled REVENANT (magenta)', r.revenant && r.revenant.label === 'REVENANT' && r.revenant.c === '227,79,208', JSON.stringify(r.revenant));
    check('revenant badge flips to REVIVED once its second life is used', r.revenantUsed && r.revenantUsed.label === 'REVIVED', JSON.stringify(r.revenantUsed));
    check('conduit badge labelled CONDUIT (mint)', r.conduit && r.conduit.label === 'CONDUIT' && r.conduit.c === '94,242,200', JSON.stringify(r.conduit));
    check('conduit badge flips to SHIELDED while escorts are linked', r.conduitShielded && r.conduitShielded.label === 'SHIELDED', JSON.stringify(r.conduitShielded));
    check('no console errors during boss-badge tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [54] Static Storm wave mod — towers randomly knocked offline (v1.37.0)
  console.log('\n[54] Static Storm (EMP wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const hasEmp = WAVE_MODS.some(m => m.id === 'emp');

      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      autoStartTimer = -1;

      // A stationary dummy keeps the field non-empty so update()'s field-clear endWave()
      // never fires mid-test (spd 0 / dist 0 → update parks it at the path start each frame).
      const dummy = { kind:'norm', hp:1e9, maxHp:1e9, spd:0, r:11, x:0, y:0, dist:0,
        slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0, armor:0, bounty:1, color:'#3fb950' };

      // --- GATE: an offline tower (empT>0) cannot fire even with a target in range ---
      // Detected via target HP (timing-independent): a point-blank projectile resolves in the
      // same update() tick, so projectiles.length is a poor signal — damage dealt is the truth.
      towers.length = 0; projectiles.length = 0; enemies.length = 0;
      spawners.length = 0; pendingSpawns.length = 0;
      waveActive = true; waveMod = null;
      enemies.push(dummy);
      update(1/60);   // let update() park the dummy at its real on-path position
      const gun = { type:'gun', x: dummy.x + 12, y: dummy.y, level:1, cd:0, flash:0, angle:0,
        range:200, dmg:10, rate:1, mode:'first', spec:null, dealt:0, kills:0, empT:5 };
      towers.push(gun);
      const hpBeforeOffline = dummy.hp;
      for (let i = 0; i < 18; i++) update(1/60);
      const offlineNoFire = dummy.hp === hpBeforeOffline;   // offline tower dealt no damage
      gun.empT = 0; gun.cd = 0;
      const hpBeforeOnline = dummy.hp;
      for (let i = 0; i < 18; i++) update(1/60);
      const onlineFires = dummy.hp < hpBeforeOnline;         // back online → resumes firing

      // --- STRIKER: with the mod active, random firing towers go offline; buff towers immune ---
      towers.length = 0; projectiles.length = 0;
      for (let i = 0; i < 6; i++) towers.push({ type:'gun', x:60+i*30, y:120, level:1, cd:0,
        flash:0, angle:0, range:80, dmg:10, rate:1, mode:'first', spec:null, dealt:0, kills:0, empT:0 });
      const buffT = { type:'buff', x:400, y:400, level:1, cd:0, flash:0, range:90, empT:0 };
      towers.push(buffT);
      waveMod = WAVE_MODS.find(m => m.id === 'emp');
      empStrikeTimer = 0.05;
      let anyZapped = false, buffZapped = false, maxEmpSeen = 0;
      for (let i = 0; i < 480; i++) {   // ~8s → ≥2 strikes (one every 3.5s)
        update(1/60);
        for (const t of towers) if (t.type !== 'buff' && t.empT > 0) { anyZapped = true; maxEmpSeen = Math.max(maxEmpSeen, t.empT); }
        if (buffT.empT > 0) buffZapped = true;
      }
      const buffImmune = !buffZapped;

      // --- DECAY: once the storm clears, offline timers tick back to 0 (towers recover) ---
      waveMod = null;
      for (let i = 0; i < 200; i++) update(1/60);   // >2.2s
      const allCleared = towers.every(t => !(t.empT > 0));

      // --- INERT: nothing is disabled when the mod is off from the start ---
      towers.forEach(t => t.empT = 0);
      empStrikeTimer = 0.05; waveMod = null;
      let zappedWhileOff = false;
      for (let i = 0; i < 300; i++) { update(1/60); if (towers.some(t => t.empT > 0)) zappedWhileOff = true; }
      const inertOff = !zappedWhileOff;

      enemies.length = 0; waveActive = false; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasEmp, offlineNoFire, onlineFires, anyZapped, maxEmpSeen, buffImmune, allCleared, inertOff };
    });
    check('WAVE_MODS includes Static Storm (emp)', r.hasEmp);
    check('offline tower (empT>0) cannot fire with a target in range', r.offlineNoFire);
    check('tower fires again once back online', r.onlineFires);
    check('Static Storm knocks a firing tower offline', r.anyZapped);
    check('disabled timer stays within the 2.2s strike duration', r.maxEmpSeen > 0 && r.maxEmpSeen <= 2.2 + 1e-6, `max=${r.maxEmpSeen}`);
    check('buff towers are immune to Static Storm', r.buffImmune);
    check('offline timers decay to 0 after the storm clears', r.allCleared);
    check('no tower disabled when the mod is off', r.inertOff);
    check('no console errors during Static Storm test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [55] Talent cost rebalance — every talent costs more; OP ones cost a lot more (v1.38.0)
  console.log('\n[55] Talent cost rebalance');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // Pre-v1.38.0 rank-0 costs — the rebalance must raise EVERY talent's entry price.
      const OLD0 = { funding:5, firepower:6, engineering:6, fortitude:5, banking:6, surge:5,
        fortune:5, scholar:8, salvage:5, momentum:6, critlab:7, piercing:7, overdrive:80,
        mastery_gun:4, mastery_sniper:4, mastery_frost:4, mastery_cannon:4, mastery_tesla:4,
        mastery_poison:4, mastery_mortar:4, mastery_buff:4 };
      const allRaised = Object.keys(OLD0).every(k => TALENTS[k].cost(0) > OLD0[k]);

      // Damage/power outliers cost a LOT more (≥ ~1.5× the old entry price).
      const opSteep = TALENTS.firepower.cost(0) >= 11 && TALENTS.critlab.cost(0) >= 11 &&
        TALENTS.overdrive.cost(0) >= 120 && TALENTS.mastery_gun.cost(0) >= 8;

      // Total cost to max each OP talent went up sharply.
      const sumMax = k => { let s = 0; for (let i = 0; i < TALENTS[k].max; i++) s += TALENTS[k].cost(i); return s; };
      const fpTotal = sumMax('firepower');          // 11+20+...+92 = 515 (was 285)
      const masteryTotal = sumMax('mastery_gun');   // 8+16+24+32+40 = 120 (was 60)
      const opTotalUp = fpTotal >= 500 && masteryTotal === 120;

      // No talent was removed by the v1.38.0 cost rebalance — the original 21 keys all survive
      // (each maps to a distinct mechanic). New towers legitimately ADD a mastery_<type> talent
      // (e.g. mastery_rail in v1.83.0 → 22), so assert "none removed" rather than an exact count.
      const keptAll = Object.keys(TALENTS).length >= 21;

      // buyTalent deducts the NEW cost and ranks up.
      localStorage.setItem('cd_meta', JSON.stringify({ chips: 1000, talents: {} }));
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg:0, runs:0, bestCombo:0 } };
      loadMeta();
      const before = meta.chips, cost0 = TALENTS.firepower.cost(0);
      buyTalent('firepower');
      const deductOk = meta.chips === before - cost0 && tRank('firepower') === 1;

      localStorage.removeItem('cd_meta');
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg:0, runs:0, bestCombo:0 } };
      loadMeta();
      return { allRaised, opSteep, fpTotal, masteryTotal, opTotalUp, keptAll, deductOk };
    });
    check('every talent rank-0 cost increased vs pre-v1.38.0', r.allRaised);
    check('OP talents (firepower/critlab/overdrive/mastery) cost a lot more', r.opSteep);
    check('OP max-out totals rose (firepower 285→515, mastery 60→120)', r.opTotalUp, `fp=${r.fpTotal} mastery=${r.masteryTotal}`);
    check('original 21 talents retained (none removed)', r.keptAll);
    check('buyTalent deducts the new cost and ranks up', r.deductOk);
    check('no console errors during talent-cost test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 56: winGame resets Resume + tower-select ghost suppression (v1.38.1 bug fix) ----
  console.log('\n[56] Completing a run resets Resume; no placement-ghost over towers');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const mkTower = (x, y) => ({ type:'gun', x, y, range:120, dmg:10, rate:0.5, cd:0, level:1,
        baseCost:60, invested:60, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0 });

      // (a) Campaign win must clear cd_save so the cleared level isn't endlessly resumable.
      localStorage.removeItem('cd_save');
      gameMode='campaign'; mapKey='classic'; diffKey='easy'; campLevel=1;
      beginGame(); gold=99999; towers.push(mkTower(200,200));
      wave=14; lastSettledWave=14; waveActive=false; saveRun();
      const campSaveBefore = !!localStorage.getItem('cd_save');
      winGame();
      const campSaveAfter = !!localStorage.getItem('cd_save');
      renderStartScreen();
      const campResumeShown = document.getElementById('resumeBtn').style.display !== 'none';

      // (b) Quick-mode victory clears the save too.
      localStorage.removeItem('cd_save');
      gameMode='quick'; mapKey='classic'; diffKey='easy';
      beginGame(); gold=99999; towers.push(mkTower(200,200));
      wave=29; lastSettledWave=29; waveActive=false; saveRun();
      winGame();
      const quickSaveAfter = !!localStorage.getItem('cd_save');

      // (c) A daily win must NOT wipe the player's separate normal save.
      localStorage.removeItem('cd_save');
      gameMode='quick'; mapKey='classic'; diffKey='easy';
      beginGame(); gold=999; towers.push(mkTower(250,250));
      wave=5; lastSettledWave=5; waveActive=false; saveRun();
      const normalBefore = !!localStorage.getItem('cd_save');
      daily = true; winGame(); daily = false;
      const dailyKeptNormal = normalBefore && !!localStorage.getItem('cd_save');

      // (d) An endless-continue save (wave past victoryWave) resumes without re-firing victory.
      localStorage.removeItem('cd_save');
      gameMode='quick'; mapKey='classic'; diffKey='easy';
      beginGame(); gold=99999; towers.push(mkTower(200,200));
      wave=31; lastSettledWave=31; waveActive=false; saveRun();
      const endlessLoad = loadRun();
      const endlessVictory = victory, endlessGameOver = gameOver;

      // (e) towerAt() — shared select/ghost-suppression hit test — finds a tower under the
      //     cursor and nothing on open ground (so the placement ghost is hidden over towers).
      localStorage.removeItem('cd_save');
      gameMode='quick'; mapKey='classic'; diffKey='easy';
      beginGame(); gold=99999;
      const t = mkTower(300,300); towers.push(t);
      const overTower = !!towerAt(t.x+2, t.y-1);
      const emptyGround = !!towerAt(t.x+90, t.y+90);

      localStorage.removeItem('cd_save'); localStorage.removeItem('cd_campaign');
      meta = { chips:0, talents:{}, achievements:{}, stats:{ dmg:0, runs:0, bestCombo:0 } }; loadMeta();
      backToMenu();
      return { campSaveBefore, campSaveAfter, campResumeShown, quickSaveAfter,
        dailyKeptNormal, endlessLoad, endlessVictory, endlessGameOver, overTower, emptyGround };
    });
    check('campaign run had a save before winning', r.campSaveBefore);
    check('campaign win clears cd_save (Resume reset)', !r.campSaveAfter);
    check('resume button hidden after a campaign win', !r.campResumeShown);
    check('quick-mode victory clears cd_save', !r.quickSaveAfter);
    check('daily win leaves the normal save intact', r.dailyKeptNormal);
    check('endless-continue save resumes (loadRun ok)', r.endlessLoad);
    check('resumed endless run is playable, victory pre-set so winGame won\'t re-fire',
      r.endlessVictory === true && r.endlessGameOver === false);
    check('towerAt() finds a tower under the cursor', r.overTower);
    check('towerAt() returns nothing on open ground (ghost shows there)', !r.emptyGround);
    check('no console errors during win-reset test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [57] Bounty Drought wave mod — enemies drop 50% less gold (v1.39.0)
  console.log('\n[57] Bounty Drought (economy-denial wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasDrought = WAVE_MODS.some(m => m.id === 'drought');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod) bounty for a wave-10 normal enemy + the boss.
      setMod(null);
      const plainWave = buildWave(10);
      const plainNorm = plainWave.find(e => e.kind === 'norm');
      const plainBoss = plainWave.find(e => e.kind === 'boss');

      // DROUGHT — every enemy + the boss pays HALF (floored, min 1).
      setMod('drought');
      const droughtWave = buildWave(10);
      const droughtNorm = droughtWave.find(e => e.kind === 'norm');
      const droughtBoss = droughtWave.find(e => e.kind === 'boss');
      const expectNorm = Math.max(1, Math.floor(plainNorm.bounty * 0.5));
      const expectBoss = Math.max(1, Math.floor(plainBoss.bounty * 0.5));
      const normHalved = droughtNorm.bounty === expectNorm && droughtNorm.bounty < plainNorm.bounty;
      const bossHalved = droughtBoss.bounty === expectBoss && droughtBoss.bounty < plainBoss.bounty;
      // Every enemy in the wave is reduced, none drop below 1.
      const allReduced = droughtWave.every((e, i) => e.bounty >= 1 && e.bounty <= Math.max(1, plainWave[i].bounty));

      // Drought leaves enemy HP/speed/armor untouched — it ONLY squeezes the economy.
      const statsUnchanged = droughtNorm.hp === plainNorm.hp && droughtNorm.spd === plainNorm.spd &&
        droughtNorm.armor === plainNorm.armor;

      // Inert when the mod is off (sanity that menu/non-mayhem can't apply it).
      setMod(null);
      const inertOff = buildWave(10).find(e => e.kind === 'norm').bounty === plainNorm.bounty;

      waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasDrought, normHalved, bossHalved, allReduced, statsUnchanged, inertOff,
               plainNorm: plainNorm.bounty, droughtNorm: droughtNorm.bounty };
    });
    check('WAVE_MODS includes Bounty Drought', r.hasDrought);
    check('Bounty Drought halves a normal enemy\'s gold', r.normHalved, `${r.plainNorm}->${r.droughtNorm}`);
    check('Bounty Drought halves the boss bounty too', r.bossHalved);
    check('every enemy reduced, none below 1 gold', r.allReduced);
    check('Bounty Drought leaves HP/speed/armor untouched (economy only)', r.statsUnchanged);
    check('Bounty Drought is inert when the mod is off', r.inertOff);
    check('no console errors during Bounty Drought test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [58] Start-menu button hierarchy — primary play row vs smaller utility toolbar (v1.39.1)
  console.log('\n[58] Start-menu button hierarchy (FEEDBACK menu polish)');
  {
    const { page, consoleErrors } = await newPage(browser);
    // Desktop viewport — the ≤920px mobile !important compacting must NOT apply, so
    // the two-tier hierarchy (big PLAY vs small utility buttons) is visible.
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const fs = sel => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      const playRow = document.querySelector('.startPlay');
      const utilRow = document.querySelector('.startUtil');
      const playBtn = document.querySelector('.startPlay .ctl.play');
      const utilBtn = document.querySelector('.startUtil .ctl');
      const startRight = Math.round(document.getElementById('startScreen').getBoundingClientRect().right);
      // Every id/onclick the rest of the code depends on must survive the restructure.
      const ids = ['resumeBtn','dailyBtn','resetBtn','chipsBtn','achBtn'].every(id => document.getElementById(id));
      const talentOpener = !!document.querySelector('#startScreen [onclick="openTalents()"]');
      return {
        twoRows: !!(playRow && utilRow),
        playBigger: fs('.startPlay .ctl.play') > fs('.startUtil .ctl'),
        playFs: fs('.startPlay .ctl.play'), utilFs: fs('.startUtil .ctl'),
        playAboveUtil: Math.round(playRow.getBoundingClientRect().top) < Math.round(utilRow.getBoundingClientRect().top),
        utilFitsInStart: Math.round(utilRow.getBoundingClientRect().right) <= startRight + 1,
        ids, talentOpener,
      };
    });
    // Phone viewport — restructured rows still fit with no horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await page.evaluate(() => {
      const innerW = window.innerWidth;
      const lastRow = document.querySelector('#startScreen > div:last-child');
      return {
        noOverflow: document.documentElement.scrollWidth <= innerW + 1,
        lastRowFits: Math.round(lastRow.getBoundingClientRect().right) <= innerW,
      };
    });
    check('start screen has a primary play row + a utility toolbar', d.twoRows);
    check('PLAY button is larger than a utility button', d.playBigger, `play=${d.playFs} util=${d.utilFs}`);
    check('utility toolbar sits below the play row', d.playAboveUtil);
    check('utility toolbar fits inside the start screen', d.utilFitsInStart);
    check('load-bearing button ids survived the restructure', d.ids);
    check('Talents opener (onclick) preserved for a11y lookup', d.talentOpener);
    check('phone: no horizontal overflow with the new two-row menu', m.noOverflow);
    check('phone: last menu row fits inside the viewport', m.lastRowFits);
    check('no console errors during start-menu hierarchy test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [59] Idle start-screen sheen — animated glow + light glint on the PLAY button (v1.41.0)
  console.log('\n[59] Idle start-screen PLAY sheen (menu polish)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const play = document.querySelector('.startPlay .ctl.play');
      const cs = getComputedStyle(play);
      const after = getComputedStyle(play, '::after');
      return {
        hasPlay: !!play,
        glowAnim: cs.animationName,                 // 'playGlow'
        clipped: cs.overflow === 'hidden',          // sheen stays inside the button
        positioned: cs.position === 'relative',
        sheenAnim: after.animationName,             // 'playSheen'
        sheenContent: after.content,                // '""' — pseudo exists
      };
    });
    // prefers-reduced-motion: reduce → both animations switched off.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const r = await page.evaluate(() => {
      const play = document.querySelector('.startPlay .ctl.play');
      return {
        glow: getComputedStyle(play).animationName,
        sheen: getComputedStyle(play, '::after').animationName,
        sheenDisplay: getComputedStyle(play, '::after').display,
      };
    });
    check('PLAY button carries the breathing glow animation', d.glowAnim === 'playGlow', d.glowAnim);
    check('PLAY button has a sheen ::after pseudo-element', d.sheenContent === '""' || d.sheenContent === "''", d.sheenContent);
    check('sheen pseudo runs the glint sweep animation', d.sheenAnim === 'playSheen', d.sheenAnim);
    check('PLAY button clips the sheen (overflow:hidden + relative)', d.clipped && d.positioned, `overflow/position`);
    check('reduce-motion disables the PLAY glow', r.glow === 'none', r.glow);
    check('reduce-motion disables the PLAY sheen', r.sheen === 'none' && r.sheenDisplay === 'none', `${r.sheen}/${r.sheenDisplay}`);
    check('no console errors during PLAY sheen test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [60] Start-screen config card — MODE/MAP/DIFFICULTY grouped into one bordered panel (v1.42.0)
  console.log('\n[60] Start-screen config card (menu revamp slice 3)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const card = document.querySelector('#startScreen .startOpts');
      const cs = card ? getComputedStyle(card) : null;
      const lbl = card ? card.querySelector('.optLabel') : null;
      return {
        hasCard: !!card,
        // the three selectors live INSIDE the card (grouped), not loose in #startScreen
        modeInCard: !!(card && card.querySelector('#modeRow')),
        mapInCard: !!(card && card.querySelector('#mapRow')),
        diffInCard: !!(card && card.querySelector('#diffRow')),
        bordered: cs ? cs.borderTopStyle !== 'none' && cs.borderTopWidth !== '0px' : false,
        rounded: cs ? parseFloat(cs.borderTopLeftRadius) > 0 : false,
        column: cs ? cs.flexDirection === 'column' : false,
        labelLeft: lbl ? getComputedStyle(lbl).textAlign : null,
        // test [58] invariant: #startScreen's last child stays the util toolbar
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
      };
    });
    check('config card .startOpts exists on the start screen', d.hasCard);
    check('card groups MODE + MAP + DIFFICULTY rows together', d.modeInCard && d.mapInCard && d.diffInCard,
      `mode=${d.modeInCard} map=${d.mapInCard} diff=${d.diffInCard}`);
    check('card is a bordered, rounded, column panel', d.bordered && d.rounded && d.column,
      `border=${d.bordered} round=${d.rounded} col=${d.column}`);
    check('option labels left-align inside the card', d.labelLeft === 'left', d.labelLeft);
    check('#startScreen last child is still the util toolbar (test [58] invariant)', d.lastChildUtil);
    check('no console errors during config-card test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [61] Gamepad support — controller drives the board cursor + actions (v1.43.0)
  console.log('\n[61] Gamepad support (v1.43.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      gold = 1e9; towers.length = 0; selectedTower = null; selectedShop = null;
      armedAbility = null; abilityCd = { meteor: 0, freeze: 0, rush: 0 };
      mouseX = -100; mouseY = -100;

      const hasFn = typeof pollGamepad === 'function';

      // a fake standard (17-button) pad + an overridable getGamepads
      const pad = { axes: [0, 0, 0, 0], buttons: [], connected: true, index: 0, id: 'mock' };
      for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, value: 0, touched: false });
      const press = i => { pad.buttons[i] = { pressed: true, value: 1, touched: true }; };
      const release = i => { pad.buttons[i] = { pressed: false, value: 0, touched: false }; };
      const allUp = () => { for (let i = 0; i < pad.buttons.length; i++) release(i); };
      navigator.getGamepads = () => [pad];

      // 1. No pad connected → complete no-op (clears gamepadActive, touches nothing).
      navigator.getGamepads = () => [];
      gamepadActive = true;
      pollGamepad(1 / 60);
      const noPadNoop = gamepadActive === false;
      navigator.getGamepads = () => [pad];

      // 2. Left stick moves the cursor (appears at centre, then drifts), and clamps to board.
      mouseX = -100; mouseY = -100;
      pad.axes[0] = 1; pad.axes[1] = 0;
      pollGamepad(1 / 60);
      const cursorAppeared = gamepadActive && mouseX > W / 2 && mouseY >= 0 && mouseY <= H;
      for (let i = 0; i < 600; i++) pollGamepad(1 / 60);     // drive far right
      const clampedX = mouseX <= W && mouseX >= W - 1;
      pad.axes[0] = 0; pad.axes[1] = 0;

      // helper: find a placeable cell
      const findCell = (sx, sy) => {
        for (let yy = sy; yy < H - 80; yy += 10)
          for (let xx = sx; xx < W - 80; xx += 10) {
            const sp = placeCoord(xx, yy);
            if (canPlace(sp.x, sp.y)) return { x: xx, y: yy };
          }
        return null;
      };

      // 3. X cycles to an affordable tower type (none selected → picks the first affordable).
      mouseX = W / 2; mouseY = H / 2; selectedShop = null;
      allUp(); pollGamepad(1 / 60);
      press(2); pollGamepad(1 / 60); release(2);
      const xCycled = !!selectedShop && gold >= costOf(selectedShop);

      // 4. A places the selected tower at the cursor.
      const c1 = findCell(80, 80);
      selectedShop = 'gun'; mouseX = c1.x; mouseY = c1.y;
      const beforePlace = towers.length;
      allUp(); pollGamepad(1 / 60);
      press(0); pollGamepad(1 / 60);
      const aPlaced = towers.length === beforePlace + 1;
      const placedT = towers[towers.length - 1];

      // 5. A HELD does not place again (press-edge), even moved over a fresh placeable cell.
      const c2 = findCell(c1.x + 120, 80) || findCell(80, c1.y + 120);
      mouseX = c2.x; mouseY = c2.y;
      const beforeHold = towers.length;
      pollGamepad(1 / 60);                                   // A still held → no new edge
      const heldNoRepeat = towers.length === beforeHold;
      release(0);

      // 6. A over an existing tower (no shop type) selects it (opens upgrade).
      selectedShop = null; selectedTower = null;
      mouseX = placedT.x; mouseY = placedT.y;
      allUp(); pollGamepad(1 / 60);
      press(0); pollGamepad(1 / 60); release(0);
      const aSelected = selectedTower === placedT;

      // 7. B cancels (deselect shop + un-arm ability + hide upgrade).
      selectedShop = 'gun'; armedAbility = 'meteor';
      allUp(); pollGamepad(1 / 60);
      press(1); pollGamepad(1 / 60); release(1);
      const bCancelled = selectedShop === null && armedAbility === null;

      // 8. LB arms meteor; RB triggers freeze (cooldown set); LT grants rush gold.
      abilityCd = { meteor: 0, freeze: 0, rush: 0 }; armedAbility = null;
      allUp(); pollGamepad(1 / 60);
      press(4); pollGamepad(1 / 60); release(4);
      const lbMeteor = armedAbility === 'meteor';
      armedAbility = null;
      allUp(); pollGamepad(1 / 60);
      press(5); pollGamepad(1 / 60); release(5);
      const rbFreeze = abilityCd.freeze > 0;
      wave = Math.max(wave, 1);   // Gold Rush is gated until waves start (v1.100.1)
      const goldBeforeRush = gold;
      allUp(); pollGamepad(1 / 60);
      press(6); pollGamepad(1 / 60); release(6);
      const ltRush = gold > goldBeforeRush;

      // 9. Start adds a wave; Back pauses then Start/Back resumes.
      const waveBefore = wave;
      allUp(); pollGamepad(1 / 60);
      press(9); pollGamepad(1 / 60); release(9);
      const startWaved = wave > waveBefore;
      allUp(); pollGamepad(1 / 60);
      press(8); pollGamepad(1 / 60); release(8);
      const backPaused = paused === true;
      allUp(); pollGamepad(1 / 60);                          // settle (paused branch, no edge)
      press(9); pollGamepad(1 / 60); release(9);
      const startResumed = paused === false;

      backToMenu(); localStorage.removeItem('cd_save');
      return { hasFn, noPadNoop, cursorAppeared, clampedX, xCycled, aPlaced,
        heldNoRepeat, aSelected, bCancelled, lbMeteor, rbFreeze, ltRush,
        startWaved, backPaused, startResumed };
    });
    check('pollGamepad() function exists', r.hasFn);
    check('no pad connected → poll is a no-op (gamepadActive false)', r.noPadNoop);
    check('left stick moves the board cursor (appears at centre)', r.cursorAppeared);
    check('cursor clamps to the board edge', r.clampedX);
    check('X cycles to an affordable tower type', r.xCycled);
    check('A places the selected tower at the cursor', r.aPlaced);
    check('A held does not place again (press-edge)', r.heldNoRepeat);
    check('A over a tower selects it (opens upgrade)', r.aSelected);
    check('B cancels (deselect + un-arm)', r.bCancelled);
    check('LB arms the meteor', r.lbMeteor);
    check('RB triggers freeze (cooldown set)', r.rbFreeze);
    check('LT grants gold rush', r.ltRush);
    check('Start adds a wave', r.startWaved);
    check('Back pauses', r.backPaused);
    check('Start/Back resumes from pause', r.startResumed);
    check('no console errors during gamepad test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // ---- Test 62: What's New "new since last visit" marker (v1.44.0) ----
  console.log("\n[62] What's New 'new' marker");
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const newest = CHANGELOG_ENTRIES[0].v;
      // A fresh load with no cd_wnseen seeds it to the current version (initWhatsNew on the
      // absent key), so an old save / new player is "caught up" — no wall of NEW badges.
      const seededOnInit = localStorage.getItem('cd_wnseen') === newest;
      const caughtUpCount = unseenWhatsNewCount();   // 0 when seen === newest

      // Simulate having last seen an older version (4th entry back → 3 newer entries).
      const olderVer = CHANGELOG_ENTRIES[3].v;
      localStorage.setItem('cd_wnseen', olderVer);
      const unseenN = unseenWhatsNewCount();
      renderWnList();
      const list = document.getElementById('wnList');
      const freshRows = [...list.children].filter(c => c.classList.contains('wnFresh')).length;
      const firstHasBadge = !!list.children[0].querySelector('.wnNew');
      const seenRowNoBadge = !list.children[unseenN].querySelector('.wnNew');

      // Start-screen cue reflects the count.
      refreshWhatsNewBadge();
      const btnBadge = document.getElementById('wnBtn').querySelector('.wnBadge');
      const btnShowsCount = !!btnBadge && btnBadge.textContent === String(unseenN);
      const verHasDot = document.getElementById('verTag').classList.contains('hasNew');

      // Opening the panel: render shows badges, then mark seen, scroll to top, clear cue.
      openWhatsNew();
      const markedSeen = localStorage.getItem('cd_wnseen') === newest;
      const scrolledTop = document.getElementById('wnList').scrollTop === 0;
      const afterCount = unseenWhatsNewCount();
      const btnCleared = !document.getElementById('wnBtn').querySelector('.wnBadge');
      renderWnList();   // re-render now that we're caught up
      const noFreshAfter = [...document.getElementById('wnList').children]
        .filter(c => c.classList.contains('wnFresh')).length;

      // A stale/unknown seen version must be safe (0 unseen, never a flood).
      localStorage.setItem('cd_wnseen', 'v0.0.0-nonexistent');
      const unknownSafe = unseenWhatsNewCount() === 0;

      document.getElementById('whatsnew').style.display = 'none';
      localStorage.removeItem('cd_wnseen');
      return { seededOnInit, caughtUpCount, unseenN, freshRows, firstHasBadge,
        seenRowNoBadge, btnShowsCount, verHasDot, markedSeen, scrolledTop,
        afterCount, btnCleared, noFreshAfter, unknownSafe };
    });
    check('absent key seeds cd_wnseen to current version on init', r.seededOnInit);
    check('caught-up player has 0 unseen entries', r.caughtUpCount === 0);
    check('stale seen version → unseen = count of newer entries', r.unseenN === 3);
    check('exactly the unseen rows get the wnFresh highlight', r.freshRows === r.unseenN);
    check('newest entry carries a NEW badge when unseen', r.firstHasBadge);
    check('the last-seen entry has no NEW badge', r.seenRowNoBadge);
    check("What's New button shows the unseen count pill", r.btnShowsCount);
    check('version tag gets the new-update dot', r.verHasDot);
    check('opening the panel marks everything seen', r.markedSeen);
    check('list auto-scrolls to the top on open', r.scrolledTop);
    check('unseen count clears to 0 after opening', r.afterCount === 0);
    check('button count pill clears after opening', r.btnCleared);
    check('no NEW highlights remain after catch-up', r.noFreshAfter === 0);
    check('unknown/stale seen version is safe (no flood)', r.unknownSafe);
    check("no console errors during what's-new marker test", consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [63] Start-screen hero header — title/version/tagline grouped block (v1.45.0, menu revamp slice 4)
  console.log('\n[63] Start-screen hero header (menu revamp slice 4)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const hero = document.querySelector('#startScreen .startHero');
      const cs = hero ? getComputedStyle(hero) : null;
      const ver = document.getElementById('verTag');
      const verCs = ver ? getComputedStyle(ver) : null;
      return {
        hasHero: !!hero,
        // title, version badge and tagline all live inside the hero block
        h2InHero: !!(hero && hero.querySelector('h2')),
        verInHero: !!(hero && hero.querySelector('#verTag')),
        pInHero: !!(hero && hero.querySelector('p')),
        column: cs ? cs.flexDirection === 'column' : false,
        // version is now a bordered pill badge
        verBordered: verCs ? verCs.borderTopStyle !== 'none' && verCs.borderTopWidth !== '0px' : false,
        verRounded: verCs ? parseFloat(verCs.borderTopLeftRadius) > 0 : false,
        // hero is the FIRST child, util toolbar still the last (test [58] invariant)
        firstChildHero: document.querySelector('#startScreen > div:first-child').classList.contains('startHero'),
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
        // verTag keeps its id + onclick so renderStartScreen() still wires it
        verHasOnclick: !!(ver && ver.getAttribute('onclick')),
      };
    });
    check('hero header .startHero exists on the start screen', d.hasHero);
    check('hero groups title + version + tagline together', d.h2InHero && d.verInHero && d.pInHero,
      `h2=${d.h2InHero} ver=${d.verInHero} p=${d.pInHero}`);
    check('hero is a column block', d.column);
    check('version tag is a bordered, rounded pill badge', d.verBordered && d.verRounded,
      `border=${d.verBordered} round=${d.verRounded}`);
    check('hero is the start screen\'s first child', d.firstChildHero);
    check('#startScreen last child is still the util toolbar (test [58] invariant)', d.lastChildUtil);
    check('#verTag keeps its onclick wiring', d.verHasOnclick);
    check('no console errors during hero-header test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [64] Mobile tap targets — bigger phone touch targets (v1.46.0)
  console.log('\n[64] Mobile tap targets (table-stakes phone polish)');
  {
    const { page, consoleErrors } = await newPage(browser);
    // Portrait phone — the chunkier tap targets are scoped here.
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await page.evaluate(() => {
      const h = sel => Math.round(document.querySelector(sel).getBoundingClientRect().height);
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame(); gold = 99999;
      const towerBtnH = h('#shop .towerBtn');          // shop tower buttons
      const ctlH = h('#controls .ctl');                // wave controls (Start Wave, ...)
      // Open the floating upgrade/sell panel and measure its smallest button.
      const t = { type:'gun', x: 200, y: 200, range:120, dmg:10, rate:0.5, cd:0, level:1,
                  baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0,
                  buffPower:0, flash:0 };
      towers.push(t); showUpgrade(t);
      const upBtns = Array.prototype.map.call(
        document.querySelectorAll('#upgradePanel button'),
        b => Math.round(b.getBoundingClientRect().height));
      const upMin = upBtns.length ? Math.min.apply(null, upBtns) : 0;
      hideUpgrade();
      backToMenu();
      // Start-screen option buttons (MODE/MAP/DIFFICULTY) — still on a phone viewport.
      const optH = h('.optBtn');
      const lvlEl = document.querySelector('.lvlBtn');
      const lvlH = lvlEl ? Math.round(lvlEl.getBoundingClientRect().height) : 44;
      try { localStorage.removeItem('cd_save'); } catch (e) {}
      return { towerBtnH, ctlH, upMin, upCount: upBtns.length, optH, lvlH };
    });
    // Desktop — the ≤920px enlargements must NOT leak; the floating upgrade-panel
    // buttons keep their original compact height there.
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame(); gold = 99999;
      const t = { type:'gun', x: 200, y: 200, range:120, dmg:10, rate:0.5, cd:0, level:1,
                  baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0,
                  buffPower:0, flash:0 };
      towers.push(t); showUpgrade(t);
      const b = document.querySelector('#upgradePanel button');
      const upH = b ? Math.round(b.getBoundingClientRect().height) : 0;
      hideUpgrade(); backToMenu();
      try { localStorage.removeItem('cd_save'); } catch (e) {}
      return { upH };
    });
    check('phone: shop tower buttons meet the ~44px touch target', m.towerBtnH >= 44, `h=${m.towerBtnH}`);
    check('phone: wave-control buttons meet the ~44px touch target', m.ctlH >= 44, `h=${m.ctlH}`);
    check('phone: upgrade/sell panel buttons meet the ~44px touch target',
          m.upCount > 0 && m.upMin >= 44, `min=${m.upMin} of ${m.upCount}`);
    check('phone: start-screen option buttons meet the ~44px touch target',
          m.optH >= 44 && m.lvlH >= 44, `opt=${m.optH} lvl=${m.lvlH}`);
    check('desktop: upgrade-panel buttons keep their compact size (mobile rule not leaked)',
          d.upH > 0 && d.upH < 44, `h=${d.upH}`);
    check('no console errors during tap-target test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [65] Wildcard legendary perk — resolves to a random legendary effect (v1.48.0)
  console.log('\n[65] Wildcard random-legendary perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      autoWave = false;

      const def = PERKS.find(p => p.id === 'wildcard');
      const inPool = !!def && def.rarity === 'legendary';
      const repeatable = REPEATABLE.includes('wildcard');

      // resolveWildcard() always returns a real, non-wildcard perk (never null/itself).
      let resolvedAlwaysLegendary = true, neverItself = true, neverNull = true;
      for (let i = 0; i < 40; i++) {
        const g = resolveWildcard();
        if (!g) { neverNull = false; break; }
        if (g.id === 'wildcard') neverItself = false;
        if (g.rarity !== 'legendary') resolvedAlwaysLegendary = false;
      }

      // Picking Wildcard pushes the RESOLVED perk to runPerks (a real id, not 'wildcard'),
      // so the perk row + resume re-apply work. Wildcard itself is never stored.
      runPerks.length = 0;
      const before = runPerks.length;
      pickPerk(def);
      const added = runPerks.length - before;
      const stored = runPerks[runPerks.length - 1];
      const storedIsRealPerk = !!PERKS.find(p => p.id === stored.id) && stored.id !== 'wildcard';
      const wildcardNotStored = !runPerks.some(p => p.id === 'wildcard');

      // Save/resume round-trip: the resolved perk persists in runPerks; resolving again on
      // load is NOT triggered (loadRun copies runPerks/perkState verbatim).
      saveRun();
      const savedPerks = JSON.parse(localStorage.getItem('cd_save')).runPerks.map(p => p.id);
      runPerks.length = 0;
      loadRun();
      const restoredSameId = runPerks.length === 1 && runPerks[0].id === stored.id;

      // Fallback: with every legendary already taken, resolveWildcard still returns a perk.
      runPerks.length = 0;
      for (const p of PERKS) if (p.rarity === 'legendary' && p.id !== 'wildcard' && !REPEATABLE.includes(p.id))
        runPerks.push({ id: p.id, icon: p.icon, name: p.name, rarity: p.rarity });
      const fallback = resolveWildcard();
      const fallbackOk = !!fallback && fallback.id !== 'wildcard';

      localStorage.removeItem('cd_save');
      backToMenu();
      return { inPool, repeatable, resolvedAlwaysLegendary, neverItself, neverNull,
        added, storedIsRealPerk, wildcardNotStored, savedPerks, restoredSameId, fallbackOk };
    });
    check('Wildcard is a legendary perk in the pool', r.inPool);
    check('Wildcard is repeatable', r.repeatable);
    check('resolveWildcard() never returns null', r.neverNull);
    check('resolveWildcard() never returns wildcard itself', r.neverItself);
    check('resolveWildcard() resolves to a legendary while some remain', r.resolvedAlwaysLegendary);
    check('picking Wildcard adds exactly one perk to runPerks', r.added === 1, `added=${r.added}`);
    check('the stored perk is a real, non-wildcard perk', r.storedIsRealPerk, JSON.stringify(r.savedPerks));
    check('wildcard itself is never stored in runPerks', r.wildcardNotStored);
    check('save/resume keeps the resolved perk id (no re-roll on load)', r.restoredSameId);
    check('resolveWildcard() still returns a perk when all non-repeatable legendaries are taken', r.fallbackOk);
    check('no console errors during Wildcard test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [66] Support targeting mode — prioritise aura enemies (heal/warden) (v1.49.0)
  console.log('\n[66] Support targeting mode (heal/warden priority)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();

      const inModes = MODES.includes('support');
      const hasIcon = typeof MODE_ICON.support === 'string' && MODE_ICON.support.length > 0;

      const mk = (kind, x, dist, hp) => ({ kind, x, y: 300, dist, hp, maxHp: hp,
        dead: false, blinkInvuln: 0, armor: 0, frozen: 0 });
      const t = { type:'gun', x: 0, y: 300, range: 99999, dmg: 10, rate: 0.5, cd: 0,
        level: 1, baseCost: 50, invested: 50, angle: 0, mode: 'support', spec: null,
        dealt: 0, kills: 0, buffPower: 0, flash: 0 };
      towers = [t];

      // (a) a heal enemy (less far along) is picked over a norm that's further ahead.
      enemies = [ mk('norm', 400, 800, 100), mk('heal', 200, 400, 100) ];
      const picksHealOverNorm = pickTarget(t) === enemies[1];

      // (b) among two support enemies, the furthest-along (higher dist) wins.
      enemies = [ mk('heal', 200, 400, 100), mk('warden', 300, 600, 100) ];
      const picksFurthestSupport = pickTarget(t) === enemies[1];

      // (c) no support in range → falls back to 'first' (furthest-along norm).
      enemies = [ mk('norm', 200, 300, 100), mk('norm', 400, 700, 100) ];
      const fallbackToFirst = pickTarget(t) === enemies[1];

      // (d) cycleMode eventually reaches 'support'.
      selectedTower = t; t.mode = 'first';
      let reachedSupport = false;
      for (let i = 0; i < MODES.length; i++) { cycleMode(); if (t.mode === 'support') reachedSupport = true; }
      hideUpgrade();

      // (e) save/resume round-trips the support mode.
      t.mode = 'support'; enemies = []; projectiles = [];
      saveRun();
      const rt = loadRun();
      const restored = rt === true && towers.length === 1 && towers[0].mode === 'support';

      localStorage.removeItem('cd_save');
      backToMenu();
      return { inModes, hasIcon, picksHealOverNorm, picksFurthestSupport,
        fallbackToFirst, reachedSupport, restored };
    });
    check('support is a valid targeting mode', r.inModes);
    check('support mode has a button label', r.hasIcon);
    check('support mode picks a heal enemy over a further-along norm', r.picksHealOverNorm);
    check('support mode picks the furthest-along support enemy', r.picksFurthestSupport);
    check('support mode falls back to first when no support in range', r.fallbackToFirst);
    check('cycleMode reaches the support mode', r.reachedSupport);
    check('save/resume round-trips the support mode', r.restored);
    check('no console errors during support-mode test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [67] Warden Surge wave mod — extra warden escorts shield the wave (v1.51.0)
  console.log('\n[67] Warden Surge (target-priority wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasWardens = WAVE_MODS.some(m => m.id === 'wardens');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod) warden count for a wave-10 wave (no natural wardens until w15).
      setMod(null);
      const plainWave = buildWave(10);
      const plainWardens = plainWave.filter(e => e.kind === 'warden').length;

      // WARDEN SURGE — a fraction of basic enemies become wardens, so the wave has MORE.
      setMod('wardens');
      const surgeWave = buildWave(10);
      const surgeWardens = surgeWave.filter(e => e.kind === 'warden').length;
      const moreWardens = surgeWardens > plainWardens;
      // Converted wardens carry full warden stats (maxHp set, blue support enemy).
      const conv = surgeWave.find(e => e.kind === 'warden');
      const wellFormed = !!conv && conv.maxHp === conv.hp && conv.color === '#58a6ff' && conv.r === 13;
      // Only norms convert — the special kinds (fast/tank/etc.) are untouched, and the
      // total wave length is unchanged (conversion, not addition).
      const sameLength = surgeWave.length === plainWave.length;
      const fastUntouched = surgeWave.filter(e => e.kind === 'fast').length ===
                            plainWave.filter(e => e.kind === 'fast').length;

      // Inert when the mod is off (sanity that menu / non-mayhem can't apply it).
      setMod(null);
      const inertOff = buildWave(10).filter(e => e.kind === 'warden').length === plainWardens;

      waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasWardens, moreWardens, wellFormed, sameLength, fastUntouched, inertOff,
               plainWardens, surgeWardens };
    });
    check('WAVE_MODS includes Warden Surge', r.hasWardens);
    check('Warden Surge adds wardens to the wave', r.moreWardens, `${r.plainWardens}->${r.surgeWardens}`);
    check('converted wardens are well-formed (maxHp/colour/radius)', r.wellFormed);
    check('Warden Surge converts (does not lengthen) the wave', r.sameLength);
    check('Warden Surge leaves the special kinds untouched', r.fastUntouched);
    check('Warden Surge is inert when the mod is off', r.inertOff);
    check('no console errors during Warden Surge test', consoleErrors.length === 0, consoleErrors.join(' | '));

    // A real Mayhem run still drives to completion with the mod in the pool — no hang.
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 8 });
      const out = { reached: wave >= 7, wave };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Mayhem run with Warden Surge in the pool drives clean', drove.reached, JSON.stringify(drove));
    await page.close();
  }

  // [68] Gauntlet map — 4th quick-play map + Crimson theme (v1.54.0)
  console.log('\n[68] Gauntlet map (kill-box layout + Crimson theme)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Map definition: present, named, with a well-formed axis-aligned path that
    // enters off the left edge and exits off the right.
    const def = await page.evaluate(() => {
      const m = MAPS.gauntlet;
      const pts = m && m.pts;
      let axisAligned = !!pts && pts.length >= 4;
      if (pts) for (let i = 0; i < pts.length - 1; i++) {
        // each segment must share exactly one coordinate (axis-aligned, no diagonals)
        const sameX = pts[i][0] === pts[i + 1][0], sameY = pts[i][1] === pts[i + 1][1];
        if (sameX === sameY) { axisAligned = false; break; }   // both same (zero-len) or neither (diagonal)
      }
      const inBounds = !!pts && pts.every(([x, y]) => x >= -40 && x <= 940 && y >= 0 && y <= 560);
      return {
        exists: !!m, named: !!m && typeof m.name === 'string' && m.name.length > 0,
        hasPath: Array.isArray(pts), axisAligned, inBounds,
        entersLeft: !!pts && pts[0][0] === -30, exitsRight: !!pts && pts[pts.length - 1][0] === 930,
        notLast: Object.keys(MAPS).indexOf('gauntlet') < Object.keys(MAPS).indexOf('mayhem'),
      };
    });
    check('Gauntlet map exists and is named', def.exists && def.named);
    check('Gauntlet has an axis-aligned path (no diagonals/zero-length segs)', def.axisAligned);
    check('Gauntlet path stays within the board', def.inBounds);
    check('Gauntlet path enters off-left (-30) and exits off-right (930)', def.entersLeft && def.exitsRight);
    check('Gauntlet sits before Mayhem in the map order', def.notLast);

    // Theme: Crimson palette exists and is the map's fixed identity.
    const theme = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'gauntlet'; diffKey = 'normal';
      const fixed = MAP_THEME.gauntlet;
      const hasPalette = !!THEMES.crimson && typeof THEMES.crimson.glow === 'string';
      const inCampaignPool = CAMPAIGN_THEMES.includes('crimson');
      const picks = pickMapTheme();              // quick-mode gauntlet -> fixed crimson
      beginGame();
      const resolved = mapTheme;                 // resetState() set it via pickMapTheme()
      const pal = mapPalette();                  // concrete palette for the frame
      const ok = pal && pal.glow === THEMES.crimson.glow;
      backToMenu(); localStorage.removeItem('cd_save');
      return { fixed, hasPalette, inCampaignPool, picks, resolved, ok };
    });
    check('Crimson theme palette exists', theme.hasPalette);
    check('Gauntlet maps to the Crimson theme', theme.fixed === 'crimson' && theme.picks === 'crimson');
    check('Crimson is available to the campaign palette pool', theme.inCampaignPool);
    check('a Gauntlet run resolves to the Crimson palette', theme.resolved === 'crimson' && theme.ok);

    // The map appears as a selectable button on the start screen.
    const btn = await page.evaluate(() => {
      renderStartScreen();
      return /Gauntlet/.test(document.getElementById('mapRow').innerHTML);
    });
    check('Gauntlet appears in the start-screen map selector', btn);

    // A real run drives to completion on the new path (pathing/spawning work, no hang).
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'gauntlet'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const pathOk = pathLen > 1000 && Array.isArray(waypoints) && waypoints === MAPS.gauntlet.pts;
      __cdGodTowers(8);
      __cdDrive({ maxWave: 6 });
      const out = { reached: wave >= 5, wave, pathOk };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Gauntlet buildPath wires the static path', drove.pathOk, JSON.stringify(drove));
    check('a Gauntlet run drives clean to wave 5+', drove.reached, JSON.stringify(drove));

    // Records: a finished quick run logs a per-map best under cd_best_gauntlet_<diff>,
    // and the map validates on save/resume (loadRun accepts MAPS[mapKey]).
    const rec = await page.evaluate(() => {
      localStorage.removeItem('cd_best_gauntlet_hard');
      gameMode = 'quick'; mapKey = 'gauntlet'; diffKey = 'hard';
      beginGame();
      best = 0; wave = 9; lives = 0;
      endGame();
      const mapBest = +(localStorage.getItem('cd_best_gauntlet_hard') || 0);

      // save/resume round-trip on the static map
      gameMode = 'quick'; mapKey = 'gauntlet'; diffKey = 'normal';
      beginGame(); wave = 3;
      saveRun();
      const loaded = loadRun();
      const restored = loaded === true && mapKey === 'gauntlet';

      ['cd_best_gauntlet_hard', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { mapBest, restored };
    });
    check('Gauntlet records a per-map best (hard = 9)', rec.mapBest === 9, JSON.stringify(rec));
    check('Gauntlet save/resume round-trips', rec.restored, JSON.stringify(rec));

    check('no console errors during Gauntlet map test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [69] Adrenaline wave mod — wounded enemies accelerate (v1.58.0)
  console.log('\n[69] Adrenaline (HP-linked acceleration wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const hasMod = WAVE_MODS.some(m => m.id === 'adrenaline');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod): no enemy is tagged.
      setMod(null);
      const plainWave = buildWave(10);
      const plainNorm = plainWave.find(e => e.kind === 'norm');
      const plainTagged = plainWave.some(e => e.adrenaline);

      // ADRENALINE: every enemy + the boss is tagged; base stats are untouched.
      setMod('adrenaline');
      const adrWave = buildWave(10);
      const adrNorm = adrWave.find(e => e.kind === 'norm');
      const allTagged = adrWave.every(e => e.adrenaline === true);
      const statsUnchanged = adrNorm.hp === plainNorm.hp && adrNorm.spd === plainNorm.spd &&
        adrNorm.armor === plainNorm.armor && adrNorm.bounty === plainNorm.bounty;

      // Movement: drive one update() frame on four hand-built enemies (no towers) and
      // compare how far each advanced. A near-dead tagged enemy must outrun a full-HP
      // one; a full-HP tagged enemy must match an untagged one (the ramp starts at 0);
      // freeze must zero all movement.
      const mk = (hpFrac, opts) => Object.assign({
        kind:'norm', spd:1, hp:hpFrac, maxHp:1, dist:200, frozen:0, slow:0, flash:0,
        x:0, y:0, r:11, armor:0, bounty:1, color:'#3fb950', dealt:0
      }, opts || {});
      const full   = mk(1,   { adrenaline:true });
      const hurt   = mk(0.2, { adrenaline:true });   // 80% missing HP -> +40% speed
      const plain  = mk(0.2, {});                    // wounded but untagged -> no speedup
      const frozen = mk(0.2, { adrenaline:true, frozen:5 });
      towers.length = 0; spawners.length = 0; enemies.length = 0;
      enemies.push(full, hurt, plain, frozen);
      const d0 = enemies.map(e => e.dist);
      update(1/60);
      const adv = enemies.map((e, i) => e.dist - d0[i]);
      const [fullAdv, hurtAdv, plainAdv, frozenAdv] = adv;
      const woundedFaster = hurtAdv > fullAdv * 1.3;
      const fullMatchesPlain = Math.abs(fullAdv - plainAdv) < 1e-9;
      const frozenStill = frozenAdv === 0;
      // Bounded: even at 100% missing HP the multiplier is exactly 1.5 (no runaway).
      const peakMul = 1 + 0.5 * Math.max(0, 1 - 0 / 1);
      const bounded = peakMul <= 1.5 + 1e-9;

      // Inert again when the mod is cleared.
      setMod(null);
      const inertOff = buildWave(10).some(e => e.adrenaline) === false;

      enemies.length = 0; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, plainTagged, allTagged, statsUnchanged, woundedFaster,
               fullMatchesPlain, frozenStill, bounded, inertOff, fullAdv, hurtAdv, plainAdv };
    });
    check('WAVE_MODS includes Adrenaline', r.hasMod);
    check('Adrenaline is inert when the mod is off (no enemy tagged)', !r.plainTagged);
    check('Adrenaline tags every enemy + the boss', r.allTagged);
    check('Adrenaline leaves base HP/speed/armor/bounty untouched', r.statsUnchanged);
    check('a wounded adrenaline enemy outruns a full-HP one', r.woundedFaster, `full=${r.fullAdv} hurt=${r.hurtAdv}`);
    check('a full-HP adrenaline enemy matches an untagged enemy (ramps from 0)', r.fullMatchesPlain, `full=${r.fullAdv} plain=${r.plainAdv}`);
    check('freeze stops an adrenaline enemy entirely', r.frozenStill);
    check('adrenaline speedup is bounded to +50% at death', r.bounded);
    check('Adrenaline is inert once the mod is cleared', r.inertOff);
    check('no console errors during Adrenaline test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [70] Overkill legendary perk — slain enemies detonate (25% max-HP splash) (v1.59.0)
  console.log('\n[70] Overkill detonation perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // perk exists in the pool and is a legendary; apply() sets the flag
      const def = PERKS.find(p => p.id === 'overkill');
      const inPool = !!def && def.rarity === 'legendary';
      perkState.overkill = false;
      def.apply(perkState);
      const applies = perkState.overkill === true;

      // freshPerkState default
      const defaultsOk = freshPerkState().overkill === false;

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:200, frozen:0, slow:0, flash:0,
        warded:0, shieldOn:false, blinkInvuln:0, x:0, y:0, r:11, armor:0, bounty:1,
        color:'#3fb950', dealt:0
      }, opts || {});

      // --- splash hits a near neighbour, misses a far one ---
      perkState.overkill = true;
      towers.length = 0; spawners.length = 0; enemies.length = 0;
      const seed = mk({ x:0, y:0, maxHp:100, hp:5 });
      const near = mk({ x:50, y:0, hp:100 });    // 50px < 60 -> hit
      const far  = mk({ x:200, y:0, hp:100 });   // 200px > 60 -> miss
      enemies.push(seed, near, far);
      damage(seed, 999, null);                    // kill the seed -> detonation
      const nearHpAfter = near.hp;                // expect 100 - 25 = 75
      const farHpAfter = far.hp;                  // expect 100 (untouched)

      // --- splash ignores armor (true damage) ---
      enemies.length = 0;
      const seed2 = mk({ x:0, y:0, maxHp:100, hp:5 });
      const armored = mk({ x:40, y:0, hp:100, armor:50 });
      enemies.push(seed2, armored);
      damage(seed2, 999, null);
      const armoredHpAfter = armored.hp;          // 25 splash, armor ignored -> 75

      // --- single layer: a splash-killed enemy does NOT re-detonate ---
      enemies.length = 0;
      const sA = mk({ x:0,  y:0, maxHp:100, hp:5 });   // splash 25
      const sB = mk({ x:50, y:0, maxHp:200, hp:20 });  // dies to the 25 splash; would splash 50 if it chained
      const sC = mk({ x:90, y:0, hp:100 });            // 90px from A (miss), 40px from B (would be hit IF B chained)
      enemies.push(sA, sB, sC);
      damage(sA, 999, null);
      const bDied = sB.dead === true;
      const cUntouched = sC.hp === 100;           // guard held -> B's death didn't chain onto C

      // --- bosses do not detonate ---
      enemies.length = 0;
      const bossSeed = mk({ x:0, y:0, kind:'boss', maxHp:100, hp:5 });
      const bossNbr = mk({ x:40, y:0, hp:100 });
      enemies.push(bossSeed, bossNbr);
      damage(bossSeed, 999, null);
      const bossNbrUntouched = bossNbr.hp === 100;

      // --- off when the perk isn't held ---
      perkState.overkill = false;
      enemies.length = 0;
      const offSeed = mk({ x:0, y:0, maxHp:100, hp:5 });
      const offNbr = mk({ x:40, y:0, hp:100 });
      enemies.push(offSeed, offNbr);
      damage(offSeed, 999, null);
      const offUntouched = offNbr.hp === 100;

      // save -> restore round-trip of the flag
      perkState.overkill = true; saveRun();
      perkState.overkill = false; loadRun();
      const restored = perkState.overkill === true;
      // old save missing the field migrates to default false
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.overkill;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.overkill === false;

      enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inPool, applies, defaultsOk, nearHpAfter, farHpAfter, armoredHpAfter,
               bDied, cUntouched, bossNbrUntouched, offUntouched, restored, migratedOk };
    });
    check('Overkill is a legendary perk in the pool', r.inPool);
    check('Overkill apply() sets the perkState flag', r.applies);
    check('freshPerkState defaults overkill:false', r.defaultsOk);
    check('Overkill splashes 25% max HP to a near enemy', Math.abs(r.nearHpAfter - 75) < 1e-6, `near=${r.nearHpAfter}`);
    check('Overkill does not reach a far enemy', r.farHpAfter === 100, `far=${r.farHpAfter}`);
    check('Overkill splash ignores armor', Math.abs(r.armoredHpAfter - 75) < 1e-6, `armored=${r.armoredHpAfter}`);
    check('a splash-killed enemy does NOT re-detonate (single layer)', r.bDied && r.cUntouched, `bDied=${r.bDied} cUntouched=${r.cUntouched}`);
    check('a boss death does not detonate', r.bossNbrUntouched);
    check('no detonation when Overkill is not held', r.offUntouched);
    check('save/reload round-trips the Overkill flag', r.restored);
    check('old save missing overkill migrates to default', r.migratedOk);
    check('no console errors during Overkill test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [71] Combo board glow — hot streaks light up the board edges (v1.60.0)
  console.log('\n[71] Combo board glow');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // pure tier mapping: 0 below the first milestone, then 1..4 by combo tier
      const tiers = {
        t9: comboGlowTier(9), t10: comboGlowTier(10), t19: comboGlowTier(19),
        t20: comboGlowTier(20), t30: comboGlowTier(30), t49: comboGlowTier(49),
        t50: comboGlowTier(50), t999: comboGlowTier(999),
      };

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; beginGame();
      // hot streak active -> draw() must render the glow path cleanly
      comboCount = 50; comboTimer = COMBO_WINDOW; comboFlash = 0;
      setParticles(1);
      let drewHot = true; try { draw(); } catch (e) { drewHot = 'ERR:' + e.message; }
      // particles Off should suppress (and still render cleanly)
      setParticles(0);
      let drewOff = true; try { draw(); } catch (e) { drewOff = 'ERR:' + e.message; }
      // low streak (below 10) -> no glow tier, still clean
      setParticles(1); comboCount = 4;
      let drewLow = true; try { draw(); } catch (e) { drewLow = 'ERR:' + e.message; }
      setParticles(1);
      backToMenu();
      return { tiers, drewHot, drewOff, drewLow };
    });
    const t = r.tiers;
    check('comboGlowTier: no glow below the 10x milestone', t.t9 === 0, `t9=${t.t9}`);
    check('comboGlowTier: tier 1 at 10x..19x', t.t10 === 1 && t.t19 === 1, `t10=${t.t10} t19=${t.t19}`);
    check('comboGlowTier: tier 2 at 20x', t.t20 === 2, `t20=${t.t20}`);
    check('comboGlowTier: tier 3 at 30x..49x', t.t30 === 3 && t.t49 === 3, `t30=${t.t30} t49=${t.t49}`);
    check('comboGlowTier: tier 4 at 50x+', t.t50 === 4 && t.t999 === 4, `t50=${t.t50} t999=${t.t999}`);
    check('draw() renders cleanly with a hot combo glow', r.drewHot === true, `${r.drewHot}`);
    check('draw() renders cleanly with particles off (glow suppressed)', r.drewOff === true, `${r.drewOff}`);
    check('draw() renders cleanly below the glow threshold', r.drewLow === true, `${r.drewLow}`);
    check('no console errors during combo-glow test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [72] Per-map best SCORES on the Records panel (v1.61.0)
  console.log('\n[72] Records — per-map best scores');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // clean slate for the keys we touch
      ['cd_bestscore', 'cd_bestscore_classic_normal', 'cd_bestscore_classic_hard',
       'cd_best_classic_normal', 'cd_best_classic_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));

      const hasFn = typeof recordScores === 'function';

      // recordScores: first write sets both all-time + per-map; gated to quick & !daily.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; daily = false;
      const e1 = recordScores(2000);
      const allTime1 = +(localStorage.getItem('cd_bestscore') || 0);
      const map1 = +(localStorage.getItem('cd_bestscore_classic_normal') || 0);

      // a lower score must NOT overwrite either key
      const e2 = recordScores(1500);
      const map2 = +(localStorage.getItem('cd_bestscore_classic_normal') || 0);
      const allTime2 = +(localStorage.getItem('cd_bestscore') || 0);

      // a higher score beats both; per-map key is difficulty-specific
      const e3 = recordScores(3200);
      const map3 = +(localStorage.getItem('cd_bestscore_classic_normal') || 0);
      const hardUntouched = localStorage.getItem('cd_bestscore_classic_hard') === null;

      // campaign / daily never write per-map score keys (mirrors best-wave)
      gameMode = 'campaign';
      recordScores(9999);
      const campNoMap = localStorage.getItem('cd_bestscore_classic_normal') === '3200';
      gameMode = 'quick'; daily = true;
      recordScores(8888);
      const dailyNoMap = localStorage.getItem('cd_bestscore_classic_normal') === '3200';
      const allTimeDaily = +(localStorage.getItem('cd_bestscore') || 0);   // all-time still updates
      daily = false; gameMode = 'quick';

      // renderBests() shows two grids + an all-time best-score footer stat
      renderBests();
      const body = document.getElementById('bestBody').innerHTML;
      const subCount = (body.match(/class="bestSub"/g) || []).length;
      const tableCount = (body.match(/class="bestTbl"/g) || []).length;
      const hasBestScoreStat = body.includes('Best score');
      const showsMapScore = body.includes(fmtNum(3200));

      ['cd_bestscore', 'cd_bestscore_classic_normal', 'cd_bestscore_classic_hard'].forEach(k => localStorage.removeItem(k));
      return { hasFn, e1, allTime1, map1, map2, allTime2, e3, map3, hardUntouched,
               campNoMap, dailyNoMap, allTimeDaily, subCount, tableCount, hasBestScoreStat, showsMapScore };
    });
    check('recordScores() exists', r.hasFn);
    check('first run records all-time best score', r.allTime1 === 2000, String(r.allTime1));
    check('first run records per-map best score', r.map1 === 2000, String(r.map1));
    check('recordScores reports the prior all-time + isBest', r.e1 && r.e1.prevAllTime === 0 && r.e1.isAllTimeBest === true);
    check('lower score does not lower the per-map best', r.map2 === 2000, String(r.map2));
    check('lower score does not lower the all-time best', r.allTime2 === 2000, String(r.allTime2));
    check('higher score raises the per-map best', r.map3 === 3200, String(r.map3));
    check('per-map score key is difficulty-specific', r.hardUntouched);
    check('campaign does not write a per-map score key', r.campNoMap);
    check('daily does not write a per-map score key', r.dailyNoMap);
    // all-time best updates in EVERY mode: campaign's 9999 persisted (and the lower daily 8888 can't beat it)
    check('all-time best still updates outside quick (campaign 9999 held)', r.allTimeDaily === 9999, String(r.allTimeDaily));
    check('records panel shows two sub-headers (waves + scores)', r.subCount === 2, String(r.subCount));
    check('records panel shows two grids', r.tableCount === 2, String(r.tableCount));
    check('records footer shows the all-time best score', r.hasBestScoreStat);
    check('records grid renders the per-map best score', r.showsMapScore);
    check('no console errors during records-score test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [73] Collapsible score breakdown on the end screen (v1.62.0)
  console.log('\n[73] End screen — score breakdown');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      ['cd_bestscore', 'cd_save'].forEach(k => localStorage.removeItem(k));
      // Quick-mode defeat with known state so the breakdown rows are deterministic.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; beginGame();
      wave = 12; kills = 100; lives = 5; gold = 200; comboBest = 8; victory = false;
      towers = [];                                  // 0 towers → effMult 1
      const sc = computeScore();
      endGame();
      const det = document.querySelector('#ovDetails .ovBreak');
      const exists = !!det;
      const collapsedByDefault = det ? !det.open : false;     // <details> closed initially
      const summary = det ? det.querySelector('summary').textContent : '';
      const body = det ? det.innerHTML : '';
      // non-zero terms listed; campaign/victory rows absent on a quick defeat
      const hasWaves = body.includes('Waves');
      const hasKills = body.includes('Kills');
      const hasSubtotal = body.includes('Subtotal');
      const hasDiffRow = body.includes('Difficulty') && body.includes('×1.6');   // hard
      const hasEffRow = body.includes('Efficiency');
      const hasFinal = body.includes(fmtNum(sc.score));
      const noCampaignRow = !body.includes('Campaign');   // quick mode → camp part is 0
      const noVictoryRow = !body.includes('Victory');     // defeat → victory part is 0
      backToMenu();
      ['cd_bestscore', 'cd_save', 'cd_best_classic_hard'].forEach(k => localStorage.removeItem(k));
      return { exists, collapsedByDefault, summary, hasWaves, hasKills, hasSubtotal,
               hasDiffRow, hasEffRow, hasFinal, noCampaignRow, noVictoryRow };
    });
    check('score breakdown <details> renders on the end screen', r.exists);
    check('breakdown is collapsed by default', r.collapsedByDefault);
    check('breakdown summary labelled', /breakdown/i.test(r.summary), r.summary);
    check('breakdown lists the Waves term', r.hasWaves);
    check('breakdown lists the Kills term', r.hasKills);
    check('breakdown shows a Subtotal row', r.hasSubtotal);
    check('breakdown shows the difficulty multiplier (Hard ×1.6)', r.hasDiffRow);
    check('breakdown shows the efficiency multiplier', r.hasEffRow);
    check('breakdown shows the final score', r.hasFinal);
    check('quick-mode defeat omits the zero Campaign term', r.noCampaignRow);
    check('defeat omits the zero Victory term', r.noVictoryRow);
    check('no console errors during breakdown test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [74] Breacher enemy — heavy w17+ unit that costs 3 lives if it leaks (v1.63.0; bumped 2→3 v2.0.0)
  console.log('\n[74] Breacher enemy (3-life leak cost)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w17, present from w17
      const w16 = buildWave(16).some(e => e.kind === 'breacher');
      const w17list = buildWave(17).filter(e => e.kind === 'breacher');
      const w17 = w17list.length;
      // (b) the breacher carries the lifeCost:3 field that the leak site reads
      const lifeCost = w17list[0] ? w17list[0].lifeCost : null;

      // (c) leak cost: a breacher at the exit drains 3 lives; a norm drains 1 (control).
      // x/y are seeded from the path point so the first-frame leak check is valid.
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;
      const atEnd = (kind, extra = {}) => { const p = pointAt(pathLen); return ({ kind,
        hp:10, maxHp:10, spd:0, r:13, bounty:1, color:'#fff', armor:0, gap:0, dist:pathLen,
        x:p.x, y:p.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0, ...extra }); };

      lives = 1000;
      enemies.push(atEnd('breacher', { lifeCost: 3 }));
      const beforeB = lives; update(1/60); const breacherCost = beforeB - lives;

      enemies.length = 0;
      lives = 1000;
      enemies.push(atEnd('norm'));
      const beforeN = lives; update(1/60); const normCost = beforeN - lives;
      enemies.length = 0;

      // (d) preview/render plumbing: composition + glyph + colour + HP mult all know it,
      // and the threat number stays in sync with the real buildWave() total.
      const compHasBreacher = waveComposition(17).some(c => c.kind === 'breacher');
      const glyph = enemyGlyph({ kind:'breacher', frozen:0 });
      const hasColor = !!PREVIEW_COLOR.breacher;
      const hpMult = KIND_HP_MULT.breacher;
      const threatOk = Math.abs(waveThreat(17) - buildWave(17).reduce((s,e)=>s+e.maxHp,0)) < 0.01;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (e) integration: a real wave-17+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 18 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w16, w17, lifeCost, breacherCost, normCost, compHasBreacher, glyph,
               hasColor, hpMult, threatOk, run };
    });
    check('no breachers before wave 17', r.w16 === false);
    check('breachers spawn from wave 17', r.w17 >= 1, 'count=' + r.w17);
    check('breacher carries lifeCost:3', r.lifeCost === 3, 'lifeCost=' + r.lifeCost);
    check('a leaked breacher costs 3 lives', r.breacherCost === 3, 'cost=' + r.breacherCost);
    check('a leaked normal still costs 1 life (control)', r.normCost === 1, 'cost=' + r.normCost);
    check('waveComposition includes breacher at wave 17', r.compHasBreacher);
    check('enemyGlyph returns ‼ for breacher', r.glyph === '‼', 'glyph=' + r.glyph);
    check('PREVIEW_COLOR has a breacher colour', r.hasColor);
    check('KIND_HP_MULT.breacher is 2.0 (matches buildWave)', r.hpMult === 2.0, 'mult=' + r.hpMult);
    check('waveThreat stays in sync with buildWave at w17 (breacher counted)', r.threatOk);
    check('wave-17+ run with breachers reaches w>=18 alive', r.run.wave >= 18 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during breacher tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [75] Reaper legendary perk — execute non-boss enemies below 12% HP (v1.65.0)
  console.log('\n[75] Reaper execute perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // perk exists in the pool and is a legendary; apply() sets the flag
      const def = PERKS.find(p => p.id === 'reaper');
      const inPool = !!def && def.rarity === 'legendary';
      perkState.reaper = false;
      def.apply(perkState);
      const applies = perkState.reaper === true;

      // freshPerkState default
      const defaultsOk = freshPerkState().reaper === false;

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:200, frozen:0, slow:0, flash:0,
        warded:0, shieldOn:false, blinkInvuln:0, x:0, y:0, r:11, armor:0, bounty:1,
        color:'#3fb950', dealt:0
      }, opts || {});

      perkState.reaper = true;
      towers.length = 0; spawners.length = 0; enemies.length = 0;

      // --- a small hit that leaves the enemy below 12% executes it ---
      const lowE = mk({ maxHp:100, hp:15 });        // 15-5=10 -> 10 < 12 -> execute
      enemies.push(lowE);
      const src = { dealt:0, kills:0 };
      damage(lowE, 5, src);
      const lowDied = lowE.dead === true && lowE.hp <= 0;
      const credited = src.dealt >= 15;             // 5 applied + 10 executed remainder

      // --- a hit that leaves it at/above 12% does NOT execute ---
      enemies.length = 0;
      const highE = mk({ maxHp:100, hp:20 });       // 20-5=15 -> 15 > 12 -> survives
      enemies.push(highE);
      damage(highE, 5, null);
      const highSurvived = highE.dead !== true && Math.abs(highE.hp - 15) < 1e-6;

      // --- bosses are exempt: a boss left below 12% is NOT executed ---
      enemies.length = 0;
      const bossE = mk({ kind:'boss', maxHp:100, hp:15 });
      enemies.push(bossE);
      damage(bossE, 5, null);
      const bossSurvived = bossE.dead !== true && Math.abs(bossE.hp - 10) < 1e-6;

      // --- off when the perk isn't held: a low hit just chips, no execute ---
      perkState.reaper = false;
      enemies.length = 0;
      const offE = mk({ maxHp:100, hp:15 });
      enemies.push(offE);
      damage(offE, 5, null);
      const offNoExec = offE.dead !== true && Math.abs(offE.hp - 10) < 1e-6;

      // --- Overkill-splash hits (fromOverkill=true) don't execute (single layer) ---
      perkState.reaper = true;
      enemies.length = 0;
      const splashE = mk({ maxHp:100, hp:11 });     // 11-5=6 -> below 12, but fromOverkill skips
      enemies.push(splashE);
      damage(splashE, 5, null, true, true, true);   // silent, ignoreArmor, fromOverkill
      const splashNoExec = splashE.dead !== true && Math.abs(splashE.hp - 6) < 1e-6;

      // save -> restore round-trip of the flag
      perkState.reaper = true; saveRun();
      perkState.reaper = false; loadRun();
      const restored = perkState.reaper === true;
      // old save missing the field migrates to default false
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.reaper;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.reaper === false;

      // resolveWildcard can roll Reaper (un-taken legendary eligible)
      runPerks.length = 0;
      let wildcardCanRoll = false;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'reaper') wildcardCanRoll = true;
      }

      enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inPool, applies, defaultsOk, lowDied, credited, highSurvived,
               bossSurvived, offNoExec, splashNoExec, restored, migratedOk, wildcardCanRoll };
    });
    check('Reaper is a legendary perk in the pool', r.inPool);
    check('Reaper apply() sets the perkState flag', r.applies);
    check('freshPerkState defaults reaper:false', r.defaultsOk);
    check('Reaper executes a non-boss enemy below 12% HP', r.lowDied);
    check('the executed remainder is credited to the firing tower', r.credited);
    check('Reaper does NOT execute an enemy at/above 12% HP', r.highSurvived);
    check('bosses are exempt from Reaper execute', r.bossSurvived);
    check('no execute when Reaper is not held', r.offNoExec);
    check('Overkill-splash hits do not execute (single layer)', r.splashNoExec);
    check('save/reload round-trips the Reaper flag', r.restored);
    check('old save missing reaper migrates to default', r.migratedOk);
    check('resolveWildcard can roll Reaper', r.wildcardCanRoll);
    check('no console errors during Reaper test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [76] Heatwave wave mod — enemies immune to slow & freeze (v1.66.0)
  console.log('\n[76] Heatwave (CC-immune wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const hasMod = WAVE_MODS.some(m => m.id === 'heatwave');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod): no enemy is tagged.
      setMod(null);
      const plainWave = buildWave(20);          // w20 -> includes a boss
      const plainNorm = plainWave.find(e => e.kind === 'norm');
      // (Molten enemies are intrinsically ccImmune in any mode (v1.77.0), so the "mod off"
      // baseline excludes them — the assertion is that no OTHER enemy is tagged.)
      const plainTagged = plainWave.some(e => e.ccImmune && e.kind !== 'molten');

      // HEATWAVE: every enemy + the boss is tagged ccImmune; base stats untouched.
      setMod('heatwave');
      const hwWave = buildWave(20);
      const hwNorm = hwWave.find(e => e.kind === 'norm');
      const hwBoss = hwWave.find(e => e.kind === 'boss');
      const allTagged = hwWave.every(e => e.ccImmune === true);
      const bossTagged = !!(hwBoss && hwBoss.ccImmune);
      const statsUnchanged = hwNorm.hp === plainNorm.hp && hwNorm.spd === plainNorm.spd &&
        hwNorm.armor === plainNorm.armor && hwNorm.bounty === plainNorm.bounty;

      // Movement: drive one update() frame (no towers) on a frozen+slowed tagged enemy vs an
      // untagged one. The tagged enemy must shrug off both and move at full speed; the untagged
      // frozen one must stay put.
      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:1, maxHp:1, dist:200, frozen:0, slow:0, slowF:0.6, flash:0,
        x:0, y:0, r:11, armor:0, bounty:1, color:'#3fb950', dealt:0
      }, opts || {});
      const immFrozen = mk({ ccImmune:true, frozen:5 });   // tagged + frozen -> still moves full
      const immSlowed = mk({ ccImmune:true, slow:5 });      // tagged + slowed -> no slowdown
      const free      = mk({});                             // untagged, no CC -> full speed baseline
      const ccFrozen  = mk({ frozen:5 });                   // untagged + frozen -> frozen still
      towers.length = 0; spawners.length = 0; enemies.length = 0;
      enemies.push(immFrozen, immSlowed, free, ccFrozen);
      const d0 = enemies.map(e => e.dist);
      update(1/60);
      const adv = enemies.map((e, i) => e.dist - d0[i]);
      const [immFrozenAdv, immSlowedAdv, freeAdv, ccFrozenAdv] = adv;
      const immFrozenMoves = Math.abs(immFrozenAdv - freeAdv) < 1e-9;   // matches full-speed baseline
      const immSlowedMoves = Math.abs(immSlowedAdv - freeAdv) < 1e-9;
      const ccFrozenStill = ccFrozenAdv === 0;                          // control: CC still works off-mod
      // The mod also cleared the timers so they don't linger.
      const timersCleared = immFrozen.frozen === 0 && immSlowed.slow === 0;

      // Inert again when the mod is cleared.
      setMod(null);
      const inertOff = buildWave(20).some(e => e.ccImmune && e.kind !== 'molten') === false;

      enemies.length = 0; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, plainTagged, allTagged, bossTagged, statsUnchanged, immFrozenMoves,
               immSlowedMoves, ccFrozenStill, timersCleared, inertOff,
               immFrozenAdv, immSlowedAdv, freeAdv, ccFrozenAdv };
    });
    check('WAVE_MODS includes Heatwave', r.hasMod);
    check('Heatwave is inert when the mod is off (no enemy tagged)', !r.plainTagged);
    check('Heatwave tags every enemy', r.allTagged);
    check('Heatwave tags the boss', r.bossTagged);
    check('Heatwave leaves base HP/speed/armor/bounty untouched', r.statsUnchanged);
    check('a frozen Heatwave enemy still moves at full speed', r.immFrozenMoves, `imm=${r.immFrozenAdv} free=${r.freeAdv}`);
    check('a slowed Heatwave enemy moves at full speed', r.immSlowedMoves, `imm=${r.immSlowedAdv} free=${r.freeAdv}`);
    check('control: an untagged frozen enemy stays put (CC works off-mod)', r.ccFrozenStill, `adv=${r.ccFrozenAdv}`);
    check('Heatwave clears frozen/slow timers each frame', r.timersCleared);
    check('Heatwave is inert once the mod is cleared', r.inertOff);
    check('no console errors during Heatwave test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [77] Shockwave ability — knock all enemies backward along the path (v1.67.0)
  console.log('\n[77] Shockwave ability');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const def = ABILITIES.shock;
      const inBar = !!def && def.key === 'R';
      const cdInit = abilityCd.shock === 0;      // resetState initialised the field

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:300, frozen:0, slow:0, flash:0,
        x:100, y:100, r:11, armor:0, bounty:1, color:'#3fb950', dealt:0
      }, opts || {});

      towers.length = 0; spawners.length = 0; enemies.length = 0;
      const norm    = mk({ dist:300 });
      const nearEnd = mk({ dist:30 });                                      // clamps at 0 (kb 75 > 30)
      const boss    = mk({ kind:'boss', dist:300 });                        // smaller knockback (28)
      const jug     = mk({ kind:'boss', bossType:'juggernaut', dist:300 }); // CC-immune boss
      const heat    = mk({ ccImmune:true, dist:300 });                      // CC-immune enemy
      enemies.push(norm, nearEnd, boss, jug, heat);

      abilityUsedThisRun = false;
      triggerAbility('shock');

      const normKnocked = Math.abs(norm.dist - 225) < 1e-6;       // 300 - 75
      const nearClamped = nearEnd.dist === 0;                     // clamped, not negative
      const bossKnocked = Math.abs(boss.dist - 272) < 1e-6;       // 300 - 28
      const jugImmune   = jug.dist === 300;
      const heatImmune  = heat.dist === 300;
      const noDamage    = norm.hp === 100 && boss.hp === 100;     // pure utility, no damage
      const onCd        = abilityCd.shock > 0;
      const usedFlag    = abilityUsedThisRun === true;            // counts against Pacifist
      const staggered   = norm.frozen >= 0.35 - 1e-9;

      // cooldown gate: a second cast while cooling is a no-op
      const distBefore = norm.dist;
      triggerAbility('shock');
      const cdGated = Math.abs(norm.dist - distBefore) < 1e-6;

      // old save missing shock in abilityCd migrates to 0
      saveRun();
      let migratedOk = false;
      const old = JSON.parse(localStorage.getItem('cd_save'));
      if (old && old.abilityCd) {
        delete old.abilityCd.shock;
        localStorage.setItem('cd_save', JSON.stringify(old));
        loadRun();
        migratedOk = abilityCd.shock === 0;
      }

      enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inBar, cdInit, normKnocked, nearClamped, bossKnocked, jugImmune, heatImmune,
               noDamage, onCd, usedFlag, staggered, cdGated, migratedOk };
    });
    check('Shockwave is a 4th ability bound to R', r.inBar);
    check('abilityCd.shock initialises to 0', r.cdInit);
    check('Shockwave knocks a normal enemy back 75 along the path', r.normKnocked);
    check('knockback clamps at 0 (no negative dist)', r.nearClamped);
    check('a boss is knocked back a smaller distance (28)', r.bossKnocked);
    check('a Juggernaut boss is immune to the knockback', r.jugImmune);
    check('a CC-immune (Heatwave) enemy is immune to the knockback', r.heatImmune);
    check('Shockwave deals no damage (pure utility)', r.noDamage);
    check('Shockwave goes on cooldown after use', r.onCd);
    check('Shockwave sets abilityUsedThisRun (counts vs Pacifist)', r.usedFlag);
    check('Shockwave briefly staggers enemies', r.staggered);
    check('a second cast while cooling is a no-op', r.cdGated);
    check('old save missing abilityCd.shock migrates to 0', r.migratedOk);
    check('no console errors during Shockwave test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [78] Hair Trigger legendary perk — +55% fire rate / −25% damage trade-off (v1.68.0)
  console.log('\n[78] Hair Trigger trade-off perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // perk exists in the pool and is a legendary
      const def = PERKS.find(p => p.id === 'hairtrigger');
      const inPool = !!def && def.rarity === 'legendary';
      const applies = (() => { const s = freshPerkState(); def.apply(s); return s.hairTrigger === true; })();

      // baseline (perk not held)
      perkState.hairTrigger = false;
      const dBase = effDmg(gun), rateBase = effRate(gun), rangeBase = effRange(gun);
      // perk held: −25% damage, +55% fire rate (shorter reload = rate/1.55), range untouched
      perkState.hairTrigger = true;
      const dHT = effDmg(gun), rateHT = effRate(gun), rangeHT = effRange(gun);

      // net DPS gain (damage/rate) is the modest ~+16% trade-off, not pure power creep
      const dpsBase = dBase / rateBase, dpsHT = dHT / rateHT;
      const netGain = dpsHT / dpsBase; // ~1.1625

      // freshPerkState default present & save-safe
      const fresh = freshPerkState();
      const defaultsOk = fresh.hairTrigger === false;

      // save -> restore round-trip
      perkState.hairTrigger = true;
      saveRun();
      perkState.hairTrigger = false; // clobber
      const loaded = loadRun();
      const restored = perkState.hairTrigger === true;

      // old-save migration: a cd_save whose perkState lacks the field defaults it to false
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.hairTrigger;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.hairTrigger === false;
      localStorage.removeItem('cd_save');

      // resolveWildcard can roll Hair Trigger (un-taken legendary eligible)
      runPerks.length = 0;
      let wildcardCanRoll = false;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'hairtrigger') wildcardCanRoll = true;
      }

      backToMenu();
      return { inPool, applies, dBase, dHT, rateBase, rateHT, rangeBase, rangeHT,
               netGain, defaultsOk, loaded, restored, migratedOk, wildcardCanRoll };
    });
    check('Hair Trigger is a legendary perk in the pool', r.inPool);
    check('Hair Trigger apply() sets the perkState flag', r.applies);
    check('Hair Trigger cuts damage by 25%', Math.abs(r.dHT - r.dBase * 0.75) < 1e-6, `base=${r.dBase} ht=${r.dHT}`);
    check('Hair Trigger speeds fire rate by 55% (rate /1.55)', Math.abs(r.rateHT - r.rateBase / 1.55) < 1e-6, `base=${r.rateBase} ht=${r.rateHT}`);
    check('Hair Trigger leaves firing range untouched', Math.abs(r.rangeHT - r.rangeBase) < 1e-6, `base=${r.rangeBase} ht=${r.rangeHT}`);
    check('Hair Trigger net DPS gain is the modest ~+16% (not power creep)', Math.abs(r.netGain - 1.55 * 0.75) < 1e-6 && r.netGain < 1.2, `net=${r.netGain}`);
    check('freshPerkState defaults hairTrigger:false', r.defaultsOk);
    check('save/reload round-trips the Hair Trigger flag', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing hairTrigger migrates to default', r.migratedOk);
    check('resolveWildcard can roll Hair Trigger', r.wildcardCanRoll);
    check('no console errors during Hair Trigger test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [79] Ambient start-screen backdrop — drifting glow behind the menu (v1.69.0)
  console.log('\n[79] Ambient start-screen backdrop (menu revamp slice 5)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const ss = document.getElementById('startScreen');
      const before = getComputedStyle(ss, '::before');
      return {
        startVisible: getComputedStyle(ss).display !== 'none',
        content: before.content,                 // '""' — pseudo exists
        anim: before.animationName,              // 'startAmbient'
        positioned: before.position === 'absolute',
        zindex: before.zIndex,                   // '-1' — behind menu content
        pointer: before.pointerEvents,           // 'none'
        hasGradient: /gradient/.test(before.backgroundImage),
        // it's start-screen-specific, not bleeding onto the other overlays/panels
        overlayBefore: getComputedStyle(document.getElementById('overlay'), '::before').animationName,
        // menu content still on top / reachable (slice invariant)
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
      };
    });
    // prefers-reduced-motion: reduce → drift freezes (gradient stays, animation off)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const r = await page.evaluate(() => {
      const before = getComputedStyle(document.getElementById('startScreen'), '::before');
      return { anim: before.animationName, hasGradient: /gradient/.test(before.backgroundImage) };
    });
    check('start screen is visible at startup', d.startVisible);
    check('start screen has an ambient ::before backdrop', d.content === '""' || d.content === "''", d.content);
    check('backdrop runs the startAmbient drift animation', d.anim === 'startAmbient', d.anim);
    check('backdrop is absolute, behind content (z-index -1), non-interactive',
      d.positioned && d.zindex === '-1' && d.pointer === 'none', `pos=${d.positioned} z=${d.zindex} ptr=${d.pointer}`);
    check('backdrop paints a gradient glow', d.hasGradient);
    check('backdrop is start-screen-specific (no ::before drift on #overlay)', d.overlayBefore === 'none', d.overlayBefore);
    check('menu content still on top — last child is the util toolbar', d.lastChildUtil);
    check('reduce-motion freezes the drift but keeps the gradient', r.anim === 'none' && r.hasGradient, `anim=${r.anim} grad=${r.hasGradient}`);
    check('no console errors during ambient backdrop test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [80] Weak targeting mode — finisher: lowest-HP enemy first (v1.70.0)
  console.log('\n[80] Weak targeting mode (lowest-HP finisher)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame();

      const inModes = MODES.includes('weak');
      const hasIcon = typeof MODE_ICON.weak === 'string' && MODE_ICON.weak.length > 0;

      const mk = (x, dist, hp) => ({ kind:'norm', x, y: 300, dist, hp, maxHp: hp,
        dead: false, blinkInvuln: 0, armor: 0, frozen: 0 });
      const t = { type:'gun', x: 0, y: 300, range: 99999, dmg: 10, rate: 0.5, cd: 0,
        level: 1, baseCost: 50, invested: 50, angle: 0, mode: 'weak', spec: null,
        dealt: 0, kills: 0, buffPower: 0, flash: 0 };
      towers = [t];

      // (a) the lowest-HP enemy is picked even though others are further along / closer.
      enemies = [ mk(400, 900, 100), mk(200, 300, 12), mk(600, 700, 60) ];
      const picksLowestHp = pickTarget(t) === enemies[1];

      // (b) tie on HP → the furthest-along (higher dist) enemy wins (leak priority).
      enemies = [ mk(200, 300, 40), mk(500, 800, 40) ];
      const tieBreaksFurthest = pickTarget(t) === enemies[1];

      // (c) it is genuinely distinct from 'strong' (which targets the HIGHEST HP).
      enemies = [ mk(300, 500, 90), mk(400, 600, 20) ];
      t.mode = 'strong'; const strongPick = pickTarget(t);
      t.mode = 'weak';   const weakPick = pickTarget(t);
      const distinctFromStrong = strongPick === enemies[0] && weakPick === enemies[1];

      // (d) cycleMode eventually reaches 'weak'.
      selectedTower = t; t.mode = 'first';
      let reachedWeak = false;
      for (let i = 0; i < MODES.length; i++) { cycleMode(); if (t.mode === 'weak') reachedWeak = true; }
      hideUpgrade();

      // (e) save/resume round-trips the weak mode.
      t.mode = 'weak'; enemies = []; projectiles = [];
      saveRun();
      const rt = loadRun();
      const restored = rt === true && towers.length === 1 && towers[0].mode === 'weak';

      // (f) an unknown saved mode still falls back to 'first' (save-safe).
      const old = JSON.parse(localStorage.getItem('cd_save'));
      old.towers[0].mode = 'bogus';
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const unknownFallsBack = towers[0].mode === 'first';

      localStorage.removeItem('cd_save');
      backToMenu();
      return { inModes, hasIcon, picksLowestHp, tieBreaksFurthest, distinctFromStrong,
        reachedWeak, restored, unknownFallsBack };
    });
    check('weak is a valid targeting mode', r.inModes);
    check('weak mode has a button label', r.hasIcon);
    check('weak mode picks the lowest-HP enemy in range', r.picksLowestHp);
    check('weak mode tie-breaks toward the furthest-along enemy', r.tieBreaksFurthest);
    check('weak mode is distinct from strong (opposite HP pick)', r.distinctFromStrong);
    check('cycleMode reaches the weak mode', r.reachedWeak);
    check('save/resume round-trips the weak mode', r.restored);
    check('unknown saved mode still falls back to first', r.unknownFallsBack);
    check('no console errors during weak-mode test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [81] Cloaking Field wave mod — wave-wide intermittent intangibility (v1.72.0)
  console.log('\n[81] Cloaking Field (intangibility wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const hasMod = WAVE_MODS.some(m => m.id === 'cloak');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod): no enemy is tagged.
      setMod(null);
      const plainWave = buildWave(20);          // w20 -> includes a boss
      const plainNorm = plainWave.find(e => e.kind === 'norm');
      const plainTagged = plainWave.some(e => e.cloak);

      // CLOAK: every enemy + the boss is tagged; base stats untouched.
      setMod('cloak');
      const cwWave = buildWave(20);
      const cwNorm = cwWave.find(e => e.kind === 'norm');
      const cwBoss = cwWave.find(e => e.kind === 'boss');
      const allTagged = cwWave.every(e => e.cloak === true);
      const bossTagged = !!(cwBoss && cwBoss.cloak);
      const statsUnchanged = cwNorm.hp === plainNorm.hp && cwNorm.spd === plainNorm.spd &&
        cwNorm.armor === plainNorm.armor && cwNorm.bounty === plainNorm.bounty;

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:200, frozen:0, slow:0, slowF:0.6, flash:0,
        x:300, y:300, r:11, armor:0, bounty:1, color:'#3fb950', dealt:0
      }, opts || {});

      // (a) cloak TRIGGERS: a tagged enemy whose cloakCd is about to expire phases out
      // (blinkInvuln set) after one frame.
      towers.length = 0; spawners.length = 0; enemies.length = 0;
      const cloaker = mk({ cloak:true, cloakCd:0.001 });
      enemies.push(cloaker);
      update(1/60);
      const cloaked = cloaker.blinkInvuln > 0;

      // (b) while cloaked it is UNTARGETABLE + IMMUNE (reuses the phantom blinkInvuln checks).
      towers.length = 0; enemies.length = 0;
      const t = { type:'gun', x:300, y:300, range:200, dmg:50, rate:0.5, cd:0, level:1, mode:'first' };
      towers.push(t);
      const phased = mk({ cloak:true, blinkInvuln:0.4, hp:100, maxHp:100, dist:200 });
      enemies.push(phased);
      const targetWhilePhased = pickTarget(t);          // should skip it
      const hpBefore = phased.hp;
      damage(phased, 999, t);                            // should be a no-op
      const untargetable = targetWhilePhased !== phased;
      const immuneWhilePhased = phased.hp === hpBefore;

      // (c) it adds NO speed / does NOT teleport: a cloak enemy that phases out advances exactly
      // as far as an identical plain enemy over the same frames (movement is unaffected).
      towers.length = 0; enemies.length = 0;
      const cd = mk({ cloak:true, cloakCd:0.001, dist:100 });   // will cloak on frame 1
      const plain = mk({ dist:100 });
      enemies.push(cd, plain);
      for (let i = 0; i < 30; i++) update(1/60);
      const sameAdvance = Math.abs(cd.dist - plain.dist) < 1e-6;

      // (d) FREEZE pauses the cloak trigger: a frozen tagged enemy never phases out.
      towers.length = 0; enemies.length = 0;
      const frozenCloaker = mk({ cloak:true, cloakCd:0.001, frozen:5 });
      enemies.push(frozenCloaker);
      update(1/60);
      const freezePauses = !(frozenCloaker.blinkInvuln > 0);

      // (e) blinkInvuln DECAYS so a phased enemy becomes hittable again (cloakCd large so it
      // doesn't re-trigger within the window).
      towers.length = 0; enemies.length = 0;
      const decayer = mk({ cloak:true, blinkInvuln:0.45, cloakCd:99 });
      enemies.push(decayer);
      for (let i = 0; i < 60; i++) update(1/60);          // ~1s > 0.45s window
      const decays = decayer.blinkInvuln === 0;

      // (f) PHANTOMS are excluded from the cloak tick (they own blinkInvuln) — cloakCd stays unset.
      towers.length = 0; enemies.length = 0;
      const pe = mk({ kind:'phantom', cloak:true, dist:200 });
      enemies.push(pe);
      update(1/60);
      const phantomExcluded = pe.cloakCd === undefined;

      // Inert again when the mod is cleared.
      setMod(null);
      const inertOff = buildWave(20).some(e => e.cloak) === false;

      enemies.length = 0; towers.length = 0; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, plainTagged, allTagged, bossTagged, statsUnchanged, cloaked,
               untargetable, immuneWhilePhased, sameAdvance, freezePauses, decays,
               phantomExcluded, inertOff };
    });
    check('WAVE_MODS includes Cloaking Field', r.hasMod);
    check('Cloak is inert when the mod is off (no enemy tagged)', !r.plainTagged);
    check('Cloak tags every enemy', r.allTagged);
    check('Cloak tags the boss', r.bossTagged);
    check('Cloak leaves base HP/speed/armor/bounty untouched', r.statsUnchanged);
    check('a tagged enemy phases out (blinkInvuln set) on cloak', r.cloaked);
    check('a cloaked enemy is untargetable', r.untargetable);
    check('a cloaked enemy is immune to damage', r.immuneWhilePhased);
    check('cloak adds no speed / no teleport (matches plain advance)', r.sameAdvance);
    check('freeze pauses the cloak trigger', r.freezePauses);
    check('cloak intangibility decays (enemy becomes hittable again)', r.decays);
    check('phantoms are excluded from the cloak tick (no double-decay)', r.phantomExcluded);
    check('Cloak is inert once the mod is cleared', r.inertOff);
    check('no console errors during Cloak test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [82] Killing Spree legendary perk — combo-scaling tower damage (v1.73.0)
  console.log('\n[82] Killing Spree combo-damage perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // perk exists in the pool and is a legendary; apply() sets the flag
      const def = PERKS.find(p => p.id === 'spree');
      const inPool = !!def && def.rarity === 'legendary';
      const applies = (() => { const s = freshPerkState(); def.apply(s); return s.comboPower === true; })();

      // comboDmgMult() math + gating (pure helper, unit-testable)
      perkState = freshPerkState();
      // perk NOT held → always 1, no matter how hot the streak
      perkState.comboPower = false; comboCount = 99; comboTimer = 5;
      const offMult = comboDmgMult();
      // perk held but NO active streak (comboTimer 0) → 1 (self-limiting)
      perkState.comboPower = true; comboCount = 25; comboTimer = 0;
      const coldMult = comboDmgMult();
      // perk held + active streak: +1% per combo
      comboTimer = 5;
      comboCount = 0;  const m0  = comboDmgMult();   // 1.00
      comboCount = 10; const m10 = comboDmgMult();   // 1.10
      comboCount = 25; const m25 = comboDmgMult();   // 1.25 (cap reached)
      comboCount = 100;const mCap= comboDmgMult();   // 1.25 (capped)

      // INTEGRATION: drive the real tower-fire loop and confirm a hot combo amplifies the
      // damage actually dealt. Tower + a huge-HP norm enemy share a path point so the shot
      // lands point-blank; ratio (combo / base) cancels out meta/spec, isolating the perk.
      const pt = pointAt(60);
      function fireDelta(comboOn) {
        towers.length = 0; enemies.length = 0; projectiles.length = 0;
        perkState = freshPerkState();
        perkState.comboPower = comboOn;
        comboCount = comboOn ? 25 : 0;
        comboTimer = comboOn ? 5 : 0;
        waveActive = false; autoStartTimer = 0;
        const e = buildWave(1).find(x => x.kind === 'norm') || buildWave(1)[0];
        e.dist = 60; e.x = pt.x; e.y = pt.y; e.spd = 0;
        e.hp = 1e9; e.maxHp = 1e9; e.armor = 0; e.frozen = 0; e.slow = 0; e.dead = false;
        enemies.push(e);
        towers.push({ type:'gun', x:pt.x, y:pt.y, level:1, spec:null, dmg:TOWER_TYPES.gun.dmg,
          rate:TOWER_TYPES.gun.rate, range:400, mode:'first', cd:0, flash:0, angle:0,
          empT:0, dealt:0, kills:0, buffPower:0.25 });
        const before = e.hp;
        for (let i = 0; i < 10; i++) update(1/60);
        return before - e.hp;
      }
      const dBase = fireDelta(false);
      const dCombo = fireDelta(true);
      const ratio = dBase > 0 ? dCombo / dBase : 0;

      // freshPerkState default present & save-safe
      const fresh = freshPerkState();
      const defaultsOk = fresh.comboPower === false;

      // save -> restore round-trip
      perkState = freshPerkState();
      perkState.comboPower = true;
      wave = 2; lives = 20; gold = 100; waveActive = false; towers.length = 0; enemies.length = 0;
      saveRun();
      perkState.comboPower = false; // clobber
      const loaded = loadRun();
      const restored = perkState.comboPower === true;

      // old-save migration: a cd_save whose perkState lacks the field defaults it to false
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.comboPower;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.comboPower === false;
      localStorage.removeItem('cd_save');

      // resolveWildcard can roll Killing Spree (un-taken legendary eligible)
      runPerks.length = 0;
      let wildcardCanRoll = false;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'spree') wildcardCanRoll = true;
      }

      backToMenu();
      return { inPool, applies, offMult, coldMult, m0, m10, m25, mCap,
               dBase, dCombo, ratio, defaultsOk, loaded, restored, migratedOk, wildcardCanRoll };
    });
    check('Killing Spree is a legendary perk in the pool', r.inPool);
    check('Killing Spree apply() sets the comboPower flag', r.applies);
    check('comboDmgMult is 1 when the perk is not held', r.offMult === 1, `off=${r.offMult}`);
    check('comboDmgMult is 1 with no active streak (comboTimer 0)', r.coldMult === 1, `cold=${r.coldMult}`);
    check('comboDmgMult is 1.00 at combo 0', Math.abs(r.m0 - 1) < 1e-9, `m0=${r.m0}`);
    check('comboDmgMult is +1%/combo (1.10 at 10×)', Math.abs(r.m10 - 1.10) < 1e-9, `m10=${r.m10}`);
    check('comboDmgMult reaches the +25% cap at 25×', Math.abs(r.m25 - 1.25) < 1e-9, `m25=${r.m25}`);
    check('comboDmgMult is capped at +25% (no creep past 25×)', Math.abs(r.mCap - 1.25) < 1e-9, `mCap=${r.mCap}`);
    check('a tower actually fired & dealt base damage', r.dBase > 0, `dBase=${r.dBase}`);
    check('a hot 25× combo amplifies dealt damage ~+25% (fire path wired)', Math.abs(r.ratio - 1.25) < 0.02, `ratio=${r.ratio} base=${r.dBase} combo=${r.dCombo}`);
    check('freshPerkState defaults comboPower:false', r.defaultsOk);
    check('save/reload round-trips the comboPower flag', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing comboPower migrates to default', r.migratedOk);
    check('resolveWildcard can roll Killing Spree', r.wildcardCanRoll);
    check('no console errors during Killing Spree test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [83] Run timer + Speed Demon achievement (v1.74.0)
  console.log('\n[83] Run timer + Speed Demon achievement');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // fmtTime formatting (M:SS, H:MM:SS past an hour, clamps negatives)
      const fmt = {
        z: fmtTime(0), five: fmtTime(5), oneoh5: fmtTime(65),
        twooh5: fmtTime(125), hour: fmtTime(3661), neg: fmtTime(-3),
      };

      // gameTime accrues in update() and is gated by pause / draft / menu
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const t0 = gameTime;                 // resetState zeroed it
      update(1/60); update(1/60);
      const t2 = gameTime;                 // +2/60
      paused = true; update(1/60); const tPaused = gameTime; paused = false;
      draftOpen = true; update(1/60); const tDraft = gameTime; draftOpen = false;

      // HUD clock element exists and reflects gameTime after updateHud()
      const timeEl = document.getElementById('time');
      gameTime = 125; updateHud();
      const hudText = timeEl ? timeEl.textContent : null;

      // persist + restore across save/resume (honest timer; closes a resume-near-end exploit)
      gameTime = 123.5; wave = 2; lives = 20; gold = 100;
      waveActive = false; towers.length = 0; enemies.length = 0;
      saveRun();
      const savedTime = JSON.parse(localStorage.getItem('cd_save')).gameTime;
      gameTime = 0;
      loadRun();
      const restoredTime = gameTime;

      // old save lacking gameTime → defaults to 0 (no crash)
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.gameTime;
      localStorage.setItem('cd_save', JSON.stringify(old));
      gameTime = 99;
      loadRun();
      const migratedTime = gameTime;
      localStorage.removeItem('cd_save');

      // achievement roster + grant conditions
      const inRoster = !!ACH_BY_ID.speedrun;
      const fresh = () => { meta.achievements = {}; meta.stats = { dmg: 0, runs: 0 }; };
      daily = false; towers.length = 0; comboBest = 0; wave = 30; lives = 20; gold = 0;

      gameMode = 'quick'; gameTime = 100; fresh();
      grantAchievements(true);  const fastWin = !!meta.achievements.speedrun;

      gameMode = 'quick'; gameTime = 500; fresh();
      grantAchievements(true);  const slowWin = !!meta.achievements.speedrun;

      gameMode = 'quick'; gameTime = 100; fresh();
      grantAchievements(false); const fastLoss = !!meta.achievements.speedrun;

      gameMode = 'campaign'; campLevel = 1; gameTime = 100; fresh();
      grantAchievements(true);  const campFast = !!meta.achievements.speedrun;

      // end screen surfaces a Time cell
      gameMode = 'quick'; gameTime = 100; towers.length = 0; comboBest = 0;
      renderEndScreen(true, 0, []);
      const details = document.getElementById('ovDetails').innerHTML;
      const endShowsTime = details.includes('Time') && details.includes('1:40');

      // cleanup
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0 };
      ['cd_save', 'cd_meta', 'cd_bestscore', 'cd_bestscore_classic_normal'].forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { fmt, t0, t2, tPaused, tDraft, hudText, savedTime, restoredTime, migratedTime,
               inRoster, fastWin, slowWin, fastLoss, campFast, endShowsTime };
    });
    check('fmtTime(0) = 0:00', r.fmt.z === '0:00', r.fmt.z);
    check('fmtTime(5) = 0:05', r.fmt.five === '0:05', r.fmt.five);
    check('fmtTime(65) = 1:05', r.fmt.oneoh5 === '1:05', r.fmt.oneoh5);
    check('fmtTime(125) = 2:05', r.fmt.twooh5 === '2:05', r.fmt.twooh5);
    check('fmtTime(3661) = 1:01:01 (hours)', r.fmt.hour === '1:01:01', r.fmt.hour);
    check('fmtTime clamps negatives to 0:00', r.fmt.neg === '0:00', r.fmt.neg);
    check('gameTime starts at 0 on a fresh run', r.t0 === 0, 't0=' + r.t0);
    check('gameTime accrues in update()', Math.abs(r.t2 - 2/60) < 1e-9, 't2=' + r.t2);
    check('gameTime frozen while paused', r.tPaused === r.t2, `paused=${r.tPaused} t2=${r.t2}`);
    check('gameTime frozen while a draft is open', r.tDraft === r.t2, `draft=${r.tDraft} t2=${r.t2}`);
    check('HUD clock element renders M:SS', r.hudText === '2:05', 'hud=' + r.hudText);
    check('gameTime is written to the save', Math.abs(r.savedTime - 123.5) < 1e-9, 'saved=' + r.savedTime);
    check('gameTime restored on resume', Math.abs(r.restoredTime - 123.5) < 1e-9, 'restored=' + r.restoredTime);
    check('old save without gameTime defaults to 0', r.migratedTime === 0, 'migrated=' + r.migratedTime);
    check('Speed Demon is in the achievement roster', r.inRoster);
    check('Speed Demon granted on a sub-7-min Quick win', r.fastWin);
    check('Speed Demon NOT granted on a slow (>7min) win', !r.slowWin);
    check('Speed Demon NOT granted on a fast loss', !r.fastLoss);
    check('Speed Demon NOT granted on a fast Campaign win (quick-only)', !r.campFast);
    check('end screen shows a Time stat cell', r.endShowsTime, 'details had Time+1:40');
    check('no console errors during run-timer test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [84] Play Again button on the end-of-run overlay (v1.75.0)
  console.log('\n[84] Play Again — one-click replay');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const retry = document.getElementById('ovRetry');
      const hasFn = typeof playAgain === 'function';
      const btnExists = !!retry;

      // ---- Quick defeat: Play Again is offered ----
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      lives = 0; wave = 7; towers.length = 0; enemies.length = 0;
      endGame();
      const lossShows = retry.style.display !== 'none';

      // clicking it (playAgain) hides the overlay + starts a fresh identical run
      playAgain();
      const afterStarted = started;
      const afterGameOver = gameOver;
      const afterWave = wave;                 // resetState() zeroes wave
      const afterMode = gameMode, afterMap = mapKey, afterDiff = diffKey;
      const overlayHidden = document.getElementById('overlay').style.display === 'none';

      // ---- Quick victory: Play Again is offered (score chasing) ----
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame(); wave = 30; lives = 20; towers.length = 0; enemies.length = 0;
      winGame();
      const winShows = retry.style.display !== 'none';
      document.getElementById('overlay').style.display = 'none';

      // ---- Daily: Play Again is hidden (one-off, deterministic per date) ----
      beginDaily();
      lives = 0; wave = 5; towers.length = 0; enemies.length = 0;
      endGame();
      const dailyHidden = retry.style.display === 'none';

      // cleanup
      daily = false;
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0 };
      Object.keys(localStorage).filter(k => k.startsWith('cd_')).forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { hasFn, btnExists, lossShows, afterStarted, afterGameOver, afterWave,
               afterMode, afterMap, afterDiff, overlayHidden, winShows, dailyHidden };
    });
    check('playAgain() function exists', r.hasFn);
    check('#ovRetry button exists in the overlay', r.btnExists);
    check('Play Again shown after a Quick defeat', r.lossShows);
    check('Play Again restarts a fresh run (started=true)', r.afterStarted);
    check('Play Again clears game-over state', r.afterGameOver === false, 'gameOver=' + r.afterGameOver);
    check('Play Again resets the wave counter', r.afterWave === 0, 'wave=' + r.afterWave);
    check('Play Again reuses the same mode/map/difficulty',
          r.afterMode === 'quick' && r.afterMap === 'classic' && r.afterDiff === 'normal',
          `${r.afterMode}/${r.afterMap}/${r.afterDiff}`);
    check('Play Again hides the overlay', r.overlayHidden);
    check('Play Again shown after a Quick victory', r.winShows);
    check('Play Again hidden on a Daily Challenge run', r.dailyHidden);
    check('no console errors during Play Again test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [85] Fission wave mod — slain enemies burst into weak spawnlings (v1.76.0)
  console.log('\n[85] Fission (death-spawn wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const hasMod = WAVE_MODS.some(m => m.id === 'fission');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod): no enemy is tagged.
      setMod(null);
      const plainWave = buildWave(20);
      const plainNorm = plainWave.find(e => e.kind === 'norm');
      const plainTagged = plainWave.some(e => e.fission);

      // FISSION: every NON-boss enemy is tagged; the boss is left clean; base stats untouched.
      setMod('fission');
      const fwWave = buildWave(20);
      const fwNorm = fwWave.find(e => e.kind === 'norm');
      const fwBoss = fwWave.find(e => e.kind === 'boss');
      const allNonBossTagged = fwWave.filter(e => e.kind !== 'boss').every(e => e.fission === true);
      const bossUntagged = !!fwBoss && !fwBoss.fission;
      const statsUnchanged = fwNorm.hp === plainNorm.hp && fwNorm.spd === plainNorm.spd &&
        fwNorm.armor === plainNorm.armor && fwNorm.bounty === plainNorm.bounty;

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:200, frozen:0, slow:0, slowF:0.6, flash:0,
        x:300, y:300, r:11, armor:0, bounty:10, color:'#3fb950', dealt:0
      }, opts || {});

      // (a) a slain tagged enemy spawns exactly 2 weak spawnlings (flushed into `enemies`).
      towers.length = 0; spawners.length = 0; enemies.length = 0; pendingSpawns.length = 0;
      const victim = mk({ fission:true, hp:1, maxHp:100, bounty:10 });
      enemies.push(victim);
      damage(victim, 999, null);            // kill it
      const spawnedCount = pendingSpawns.length;
      const childHp = pendingSpawns[0] ? pendingSpawns[0].maxHp : null;
      const childWeak = childHp !== null && childHp < 100;       // weaker than parent
      const childBounty = pendingSpawns[0] ? pendingSpawns[0].bounty : null;

      // (b) SINGLE LAYER: the spawnlings are NOT tagged (kind 'norm', no `fission`), so killing
      // one spawns nothing — the chaos can't cascade. Use a child built from the real spawn shape.
      enemies.length = 0; pendingSpawns.length = 0;
      const realChild = { kind:'norm', hp:1, maxHp:18, spd:1.25, r:7, bounty:2, color:'#7ee787',
        armor:0, gap:0, dist:100, slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0, x:300, y:300 };
      enemies.push(realChild);
      damage(realChild, 999, null);
      const childNoCascade = pendingSpawns.length === 0;

      // (c) bosses don't fission even if somehow tagged (double-guard in the death handler).
      enemies.length = 0; pendingSpawns.length = 0;
      const boss = mk({ kind:'boss', fission:true, hp:1, maxHp:1000, bounty:100, r:24 });
      enemies.push(boss);
      damage(boss, 9999, null);
      const bossNoFission = pendingSpawns.length === 0;

      // (d) the native splitter doesn't double-burst: a split enemy tagged fission only does its
      // own 2-child split (the fission block excludes kind==='split').
      enemies.length = 0; pendingSpawns.length = 0;
      const sp = mk({ kind:'split', fission:true, hp:1, maxHp:100, bounty:10, r:14 });
      enemies.push(sp);
      damage(sp, 999, null);
      const splitNoDoubleBurst = pendingSpawns.length === 2;

      // Inert again when the mod is cleared.
      setMod(null);
      const inertOff = buildWave(20).some(e => e.fission) === false;

      // (e) BOUNDED clearance: a field of fission enemies + a god tower fully clears in a bounded
      // number of frames (proves the death-spawn terminates — children don't re-fission), and the
      // spawnlings really did appear (total deaths > original count).
      towers.length = 0; spawners.length = 0; enemies.length = 0; pendingSpawns.length = 0;
      projectiles.length = 0; lives = 99999; waveActive = true; autoStartTimer = -1;
      kills = 0;
      const god = { type:'gun', x:300, y:300, range:99999, dmg:99999, rate:0.05, cd:0,
        level:1, mode:'first', dealt:0, flash:0, empT:0 };
      towers.push(god);
      for (let i = 0; i < 6; i++) {
        const p = pointAt((i + 1) * (pathLen / 8));
        enemies.push({ kind:'norm', fission:true, hp:50, maxHp:50, spd:0.2, r:11, bounty:10,
          color:'#3fb950', armor:0, gap:0, dist:(i + 1) * (pathLen / 8), slow:0, slowF:0.6,
          frozen:0, poison:null, flash:0, px:0, py:0, x:p.x, y:p.y });
      }
      let guard = 0;
      while ((enemies.length || pendingSpawns.length) && guard < 5000) { update(1/60); guard++; }
      const cleared = enemies.length === 0 && guard < 5000;
      const multiplied = kills > 6;   // 6 originals + their spawnlings all died

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0; waveMod = null;
      waveActive = false;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, plainTagged, allNonBossTagged, bossUntagged, statsUnchanged,
               spawnedCount, childWeak, childBounty, childNoCascade, bossNoFission,
               splitNoDoubleBurst, inertOff, cleared, multiplied, kills };
    });
    check('WAVE_MODS includes Fission', r.hasMod);
    check('Fission is inert when the mod is off (no enemy tagged)', !r.plainTagged);
    check('Fission tags every non-boss enemy', r.allNonBossTagged);
    check('Fission leaves the boss untagged (bounded)', r.bossUntagged);
    check('Fission leaves base HP/speed/armor/bounty untouched', r.statsUnchanged);
    check('a slain fission enemy spawns 2 spawnlings', r.spawnedCount === 2, 'count=' + r.spawnedCount);
    check('spawnlings are weaker than the parent', r.childWeak, 'childHp');
    check('spawnlings pay only a token bounty (< parent 10)', r.childBounty !== null && r.childBounty < 10, 'b=' + r.childBounty);
    check('spawnlings do NOT fission (single layer, no cascade)', r.childNoCascade);
    check('bosses never fission (double-guard)', r.bossNoFission);
    check('native splitter does not double-burst (still 2 children)', r.splitNoDoubleBurst);
    check('Fission is inert once the mod is cleared', r.inertOff);
    check('a fission field fully clears in bounded frames (no cascade)', r.cleared);
    check('fission spawnlings really appear (total kills > originals)', r.multiplied, 'kills=' + r.kills);
    check('no console errors during Fission test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [86] Molten enemy — CC-immune regular enemy from wave 12+ in all modes (v1.77.0)
  console.log('\n[86] Molten enemy (crowd-control immune)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w12, present from w12; tagged ccImmune; HP ≈ template×1.35
      const w11 = buildWave(11).some(e => e.kind === 'molten');
      const w12list = buildWave(12).filter(e => e.kind === 'molten');
      const w12 = w12list.length;
      const allImmune = w12list.every(e => e.ccImmune === true);
      const t12 = enemyTemplate(12);
      const hpOk = w12list[0] ? Math.abs(w12list[0].maxHp - t12.hp * 1.35) < 0.01 : false;

      // (b) CC immunity: a molten in the live enemy loop has freeze + slow cleared every frame,
      // so it keeps moving even when "frozen". A norm control stays frozen (does not move).
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;
      const mk = (kind, extra = {}) => { const p = pointAt(pathLen * 0.4); return ({ kind,
        hp:100, maxHp:100, spd:1, r:12, bounty:1, color:'#fff', armor:0, gap:0, dist:pathLen*0.4,
        x:p.x, y:p.y, slow:0, slowF:0.6, frozen:5, poison:null, flash:0, px:0, py:0, ...extra }); };

      const molten = mk('molten', { ccImmune:true });
      enemies.push(molten);
      const mBefore = molten.dist; update(1/60);
      const moltenMoved = molten.dist > mBefore && molten.frozen === 0 && molten.slow === 0;

      enemies.length = 0;
      const norm = mk('norm');
      enemies.push(norm);
      const nBefore = norm.dist; update(1/60);
      const normFrozen = norm.dist === nBefore && norm.frozen > 0;   // still frozen, did not move
      enemies.length = 0;

      // (c) preview/render plumbing: composition + glyph + colour + HP mult all know it,
      // and the threat number stays in sync with the real buildWave() total at w12.
      const compHasMolten = waveComposition(12).some(c => c.kind === 'molten');
      const glyph = enemyGlyph({ kind:'molten', frozen:0 });
      const frozenGlyph = enemyGlyph({ kind:'molten', frozen:1 });   // frozen overrides to ❄ (cosmetic)
      const hasColor = !!PREVIEW_COLOR.molten;
      const hpMult = KIND_HP_MULT.molten;
      const threatOk = Math.abs(waveThreat(12) - buildWave(12).reduce((s,e)=>s+e.maxHp,0)) < 0.01;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (d) integration: a real wave-12+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 14 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w11, w12, allImmune, hpOk, moltenMoved, normFrozen, compHasMolten, glyph,
               frozenGlyph, hasColor, hpMult, threatOk, run };
    });
    check('no moltens before wave 12', r.w11 === false);
    check('moltens spawn from wave 12', r.w12 >= 1, 'count=' + r.w12);
    check('every molten is tagged ccImmune', r.allImmune);
    check('molten HP is template×1.35', r.hpOk);
    check('a frozen molten shrugs off CC and keeps moving', r.moltenMoved);
    check('a frozen normal stays frozen (control)', r.normFrozen);
    check('waveComposition includes molten at wave 12', r.compHasMolten);
    check('enemyGlyph returns 🔥 for molten', r.glyph === '🔥', 'glyph=' + r.glyph);
    check('a frozen molten still shows the ❄ glyph (cosmetic)', r.frozenGlyph === '❄');
    check('PREVIEW_COLOR has a molten colour', r.hasColor);
    check('KIND_HP_MULT.molten is 1.35 (matches buildWave)', r.hpMult === 1.35, 'mult=' + r.hpMult);
    check('waveThreat stays in sync with buildWave at w12 (molten counted)', r.threatOk);
    check('wave-12+ run with moltens reaches w>=14 alive', r.run.wave >= 14 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during molten tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [87] Lobbed mortar shell arc — render-only parabola (v1.79.0)
  console.log('\n[87] Lobbed mortar shell arc (v1.79.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // (a) lobLift() is a pure parabola: 0 for a non-lob projectile, 0 at both flight
      //     ends, peak at the middle, symmetric, and capped on very long shots.
      const helperOk = typeof lobLift === 'function';
      const nonLob = lobLift({ lob: false, x: 50, y: 0, x0: 0, y0: 0, target: { x: 200, y: 0 } });
      const mk = (x) => ({ lob: true, x, y: 0, x0: 0, y0: 0, target: { x: 200, y: 0 } });  // 200px flat shot
      const lStart = lobLift(mk(0));     // frac 0   → 0
      const lMid   = lobLift(mk(100));   // frac 0.5 → peak (= min(46, 200*0.2)=40)
      const lEnd   = lobLift(mk(200));   // frac 1   → 0
      const lQ1    = lobLift(mk(50));    // frac 0.25
      const lQ3    = lobLift(mk(150));   // frac 0.75
      const peakOk = Math.abs(lMid - 40) < 0.5;
      const endsZero = lStart === 0 && Math.abs(lEnd) < 1e-9;
      const symmetric = Math.abs(lQ1 - lQ3) < 0.5;
      const risesThenFalls = lQ1 > lStart && lMid > lQ1 && lQ3 < lMid && lEnd < lQ3;
      const capped = lobLift({ lob: true, x: 400, y: 0, x0: 0, y0: 0, target: { x: 800, y: 0 } }); // total 800 → peak capped 46
      const cappedOk = Math.abs(capped - 46) < 0.5;

      // (b) spawn fields: a fired mortar shell is lobbed (lob/x0/y0 set); a gun bullet is not.
      //     Towers are placed at their target's actual on-path position (the enemy loop
      //     repositions e.x/e.y from pointAt() each frame, before towers fire).
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy'; beginGame();
      gold = 1e9; towers.length = 0; enemies.length = 0; projectiles.length = 0;
      const dM = pathLen * 0.3, dG = pathLen * 0.65;
      const pM = pointAt(dM), pG = pointAt(dG);
      const mortar = { type: 'mortar', x: pM.x, y: pM.y - 50, level: 1, spec: null,
        dmg: TOWER_TYPES.mortar.dmg, rate: TOWER_TYPES.mortar.rate, range: 225,
        dealt: 0, kills: 0, buffPower: 0.25, mode: 'first', cd: 0, flash: 0, angle: 0, empT: 0 };
      // gun sits 130px off-path (within its 200 range) so its fast bullet (spd 480 →
      // ~8px/frame) survives the frame it spawns — a point-blank shot resolves & is
      // filtered same-tick (the documented fire-detection gotcha), hiding the projectile.
      const gun = { type: 'gun', x: pG.x, y: pG.y - 130, level: 1, spec: null,
        dmg: TOWER_TYPES.gun.dmg, rate: TOWER_TYPES.gun.rate, range: 200,
        dealt: 0, kills: 0, buffPower: 0.25, mode: 'first', cd: 0, flash: 0, angle: 0, empT: 0 };
      towers.push(mortar, gun);
      const mkE = (dist) => { const p = pointAt(dist); return ({ kind: 'norm', hp: 1e6, maxHp: 1e6,
        spd: 0, r: 11, bounty: 1, color: '#fff', armor: 0, gap: 0, dist, x: p.x, y: p.y,
        slow: 0, slowF: 0.6, frozen: 0, poison: null, flash: 0, px: 0, py: 0, dead: false, blinkInvuln: 0 }); };
      enemies.push(mkE(dM), mkE(dG));
      update(1 / 60);   // enemy loop repositions, then both towers fire
      const mProj = projectiles.find(p => p.kind === 'mortar');
      const gProj = projectiles.find(p => p.kind === 'bullet');
      const mortarLobbed = !!mProj && mProj.lob === true
        && typeof mProj.x0 === 'number' && typeof mProj.y0 === 'number';
      const gunFlat = !!gProj && !gProj.lob;
      const arcsInFlight = mProj ? lobLift(mProj) > 0 : false;   // real positive arc mid-flight

      // (c) hit detection is unaffected — the ground-truth p.x/p.y still homes & lands.
      enemies.length = 0; projectiles.length = 0; towers.length = 0;
      const tp = pointAt(pathLen * 0.4);
      const tgt = { kind: 'norm', hp: 500, maxHp: 500, spd: 0, r: 11, bounty: 1, color: '#fff',
        armor: 0, gap: 0, dist: pathLen * 0.4, x: tp.x, y: tp.y, slow: 0, slowF: 0.6, frozen: 0,
        poison: null, flash: 0, px: 0, py: 0, dead: false, blinkInvuln: 0 };
      enemies.push(tgt);
      projectiles.push({ x: tp.x - 60, y: tp.y, x0: tp.x - 60, y0: tp.y, lob: true, target: tgt,
        dmg: 200, kind: 'mortar', src: { dealt: 0, kills: 0 }, crit: false, ignoreArmor: true,
        color: '#fff', spd: 200 });
      let guard = 0;
      while (projectiles.length && guard++ < 600) update(1 / 60);
      const hitLanded = tgt.hp < 500;

      backToMenu(); localStorage.removeItem('cd_save');
      return { helperOk, nonLob, peakOk, endsZero, symmetric, risesThenFalls, cappedOk,
               mortarLobbed, gunFlat, arcsInFlight, hitLanded };
    });
    check('lobLift() helper exists', r.helperOk);
    check('lobLift returns 0 for a non-lobbed projectile', r.nonLob === 0);
    check('lobLift peaks at mid-flight (≈40 for a 200px shot)', r.peakOk);
    check('lobLift is 0 at launch and impact', r.endsZero);
    check('lobLift arc is symmetric', r.symmetric);
    check('lobLift rises then falls across the flight', r.risesThenFalls);
    check('lobLift peak is capped on long shots (≈46)', r.cappedOk);
    check('a fired mortar shell is lobbed (lob/x0/y0 set)', r.mortarLobbed);
    check('a fired gun bullet flies flat (no lob)', r.gunFlat);
    check('a spawned mortar shell has a positive arc in flight', r.arcsInFlight);
    check('lobbed shell still homes & hits its target (gameplay unaffected)', r.hitLanded);
    check('no console errors during mortar-arc test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [88] Breacher Surge wave mod — heavy breacher escorts, 3-life leak-cost (v1.80.0; cost 2→3 v2.0.0)
  console.log('\n[88] Breacher Surge (leak-cost wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasMod = WAVE_MODS.some(m => m.id === 'breachers');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod) breacher count for a wave-10 wave (no natural breachers until w17).
      setMod(null);
      const plainWave = buildWave(10);
      const plainBreachers = plainWave.filter(e => e.kind === 'breacher').length;

      // BREACHER SURGE — a fraction of basic enemies become breachers, so the wave has MORE.
      setMod('breachers');
      const surgeWave = buildWave(10);
      const surgeBreachers = surgeWave.filter(e => e.kind === 'breacher').length;
      const moreBreachers = surgeBreachers > plainBreachers;
      // Converted breachers carry full breacher stats (maxHp set, rose colour, lifeCost 3 as of v2.0.0).
      const conv = surgeWave.find(e => e.kind === 'breacher');
      const wellFormed = !!conv && conv.maxHp === conv.hp && conv.color === '#d4566b' &&
        conv.r === 15 && conv.lifeCost === 3;
      // Conversion not addition: total wave length unchanged, special kinds untouched.
      const sameLength = surgeWave.length === plainWave.length;
      const fastUntouched = surgeWave.filter(e => e.kind === 'fast').length ===
                            plainWave.filter(e => e.kind === 'fast').length;
      // Inert when the mod is off.
      setMod(null);
      const inertOff = buildWave(10).filter(e => e.kind === 'breacher').length === plainBreachers;

      // A surge breacher that leaks costs 3 lives at the single leak site (e.lifeCost; v2.0.0).
      towers.length = 0; spawners.length = 0; enemies.length = 0; pendingSpawns.length = 0;
      lives = 20; livesLostThisRun = false; perkState.livesLost = 0;
      const leaker = { kind:'breacher', hp:100, maxHp:100, spd:1, r:15, bounty:1, color:'#d4566b',
        armor:0, gap:0, dist:pathLen + 1, lifeCost:3, x:0, y:0, slow:0, slowF:0.6, frozen:0,
        poison:null, flash:0, px:0, py:0, dead:false, blinkInvuln:0 };
      enemies.push(leaker);
      const livesBefore = lives;
      update(1/60);
      const leakCosts2 = (livesBefore - lives) === 3 && perkState.livesLost === 3;

      enemies.length = 0; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, moreBreachers, wellFormed, sameLength, fastUntouched, inertOff,
               leakCosts2, plainBreachers, surgeBreachers };
    });
    check('WAVE_MODS includes Breacher Surge', r.hasMod);
    check('Breacher Surge adds breachers to the wave', r.moreBreachers, `${r.plainBreachers}->${r.surgeBreachers}`);
    check('converted breachers are well-formed (maxHp/colour/radius/lifeCost)', r.wellFormed);
    check('Breacher Surge converts (does not lengthen) the wave', r.sameLength);
    check('Breacher Surge leaves the special kinds untouched', r.fastUntouched);
    check('Breacher Surge is inert when the mod is off', r.inertOff);
    check('a leaked surge breacher costs 3 lives', r.leakCosts2);
    check('no console errors during Breacher Surge test', consoleErrors.length === 0, consoleErrors.join(' | '));

    // A real Mayhem run still drives to completion with the mod in the pool — no hang.
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 8 });
      const out = { reached: wave >= 7, wave };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Mayhem run with Breacher Surge in the pool drives clean', drove.reached, JSON.stringify(drove));
    await page.close();
  }

  // [89] Targeting Array rare perk — +20% firing range, booster aura untouched (v1.81.0)
  console.log('\n[89] Targeting Array range perk');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // perk exists in the pool and is rare
      const def = PERKS.find(p => p.id === 'optics');
      const inPool = !!def && def.rarity === 'rare';

      // baseline (perk not held) -> apply -> +20% firing range
      perkState.rangeMult = 1;
      const rBase = effRange(gun);
      def.apply(perkState);
      const rPerk = effRange(gun);

      // booster aura range (effBuffRange) is NOT affected by the perk
      const booster = { type:'buff', x:400, y:300, level:1, spec:null, range:45, buffPower:0.25 };
      towers.push(booster);
      const buffRange = effBuffRange(booster);
      const buffExpected = booster.range; // mastery_buff rank 0 => ×1, rangeMult must not apply

      // freshPerkState default present & save-safe
      const fresh = freshPerkState();
      const defaultsOk = fresh.rangeMult === 1;

      // save -> restore round-trip of the multiplier
      perkState.rangeMult = 1.2;
      saveRun();
      perkState.rangeMult = 1; // clobber
      const loaded = loadRun();
      const restored = Math.abs(perkState.rangeMult - 1.2) < 1e-9;

      // old-save migration: a cd_save whose perkState lacks the field defaults it to 1
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.rangeMult;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.rangeMult === 1;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, rBase, rPerk, buffRange, buffExpected, defaultsOk, loaded, restored, migratedOk };
    });
    check('Targeting Array is a rare perk in the pool', r.inPool);
    check('Targeting Array gives +20% firing range', Math.abs(r.rPerk - r.rBase * 1.2) < 1e-6, `base=${r.rBase} perk=${r.rPerk}`);
    check('Targeting Array leaves booster aura range untouched', Math.abs(r.buffRange - r.buffExpected) < 1e-6, `buff=${r.buffRange}`);
    check('freshPerkState defaults rangeMult:1', r.defaultsOk);
    check('save/reload round-trips the range multiplier', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing rangeMult migrates to default', r.migratedOk);
    check('no console errors during Targeting Array test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [90] Hydra boss archetype — the 10th: splits into 2 sub-units on death (v1.82.0)
  console.log('\n[90] Hydra boss (death-split archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // it's in the rotation at w65 (10th slot, then wraps at w70).
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(65) === 'hydra';

      // Kill a hydra boss and confirm it spawns exactly 2 sub-units. The spawns are
      // DEFERRED to pendingSpawns (folded into enemies next frame), so tick once after
      // the kill. Use a real path point so movement/render don't throw.
      const sp = pointAt(60);
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
      const boss = { kind:'boss', bossType:'hydra', hp:5000, maxHp:5000, spd:0, r:24, bounty:100,
        color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 };
      enemies.push(boss);
      damage(boss, 1e9, null);                 // overkill the boss → triggers the split
      const pendingAfterKill = pendingSpawns.length;   // 2 heads queued
      update(1/60);                            // fold pendingSpawns into enemies
      const heads = enemies.filter(e => e.kind === 'norm');
      const spawnedTwo = heads.length === 2;
      // heads are bounded: ~10% of boss maxHp each, no bossType, and carry NO 'hydra' tag
      // so they can never re-split (single layer).
      const headHpBounded = heads.every(h => h.maxHp <= boss.maxHp * 0.1 + 1e-6 && h.maxHp > 0);
      const headsNotBosses = heads.every(h => h.kind === 'norm' && !h.bossType);

      // A killed head does NOT spawn more (no cascade): kill both heads and assert their
      // deaths queued NOTHING (the heads carry no hydra/fission tag → no re-split).
      pendingSpawns.length = 0;                // clear the 2 we already folded in
      for (const h of heads) damage(h, 1e9, null);
      const noCascade = pendingSpawns.length === 0;
      update(1/60);                            // dead heads get culled; field empties

      // a NON-hydra boss of the same shape does NOT split (control)
      enemies.length = 0; pendingSpawns.length = 0;
      const ctrl = { kind:'boss', bossType:'regen', hp:10, maxHp:5000, spd:0, r:24, bounty:100,
        color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 };
      enemies.push(ctrl);
      damage(ctrl, 1e9, null);
      const controlNoSplit = pendingSpawns.length === 0;

      // render-side wiring: badge + aura colour resolve for hydra
      const badge = bossMechanicBadge({ kind:'boss', bossType:'hydra' });
      const badgeOk = badge && badge.label === 'HYDRA';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, pendingAfterKill, spawnedTwo, headHpBounded, headsNotBosses, noCascade, controlNoSplit, badgeOk };
    });
    check('hydra is the 10th archetype (w65)', r.inRotation);
    check('hydra queues 2 sub-units on death', r.pendingAfterKill === 2, `pending=${r.pendingAfterKill}`);
    check('the 2 heads spawn into the field', r.spawnedTwo);
    check('heads carry ≤10% of boss max HP (bounded)', r.headHpBounded);
    check('heads are plain norms, not bosses', r.headsNotBosses);
    check('killing a head does NOT spawn more (no cascade)', r.noCascade);
    check('control: a non-hydra boss does not split', r.controlNoSplit);
    check('hydra boss-bar badge resolves to HYDRA', r.badgeOk);
    check('no console errors during Hydra test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [91] Railgun tower — the 9th: an instant piercing beam that hits all enemies in a line (v1.83.0)
  console.log('\n[91] Railgun tower (piercing line beam)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // definitions present & wired
      const def = TOWER_TYPES.rail;
      const defOk = !!def && def.proj === 'rail' && def.range > 150 && def.dmg > 0;
      const specsOk = Array.isArray(SPECS.rail) && SPECS.rail.length === 2
        && SPECS.rail.some(s => s.id === 'railpen') && SPECS.rail.some(s => s.id === 'railwide');
      const masteryOk = !!TALENTS.mastery_rail && TALENTS.mastery_rail.sect === 'TOWER MASTERY';
      const inShopKeys = TYPE_KEYS.includes('rail');
      const sfxOk = typeof SFX.rail === 'function';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      // shop renders a Railgun button (auto-generated from TYPE_KEYS)
      const shopHasRail = !!document.querySelector('#shop') &&
        Array.prototype.some.call(document.querySelectorAll('.towerBtn'), b => /Railgun/.test(b.textContent));

      // Penetrator spec adds +35% damage via effDmg
      const rt0 = { type:'rail', x:100, y:300, level:1, spec:null, dmg:100, rate:1.7, range:200,
                    dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      const dBase = effDmg(rt0);
      rt0.spec = 'railpen';
      const dPen = effDmg(rt0);
      const penOk = Math.abs(dPen - dBase * 1.20) < 1e-6;   // v2.0.0: nerfed 1.35 → 1.20
      rt0.spec = null;

      // PIERCE: a railgun at (100,300) aimed east (+x) should hit EVERY enemy lined up
      // along y≈300, but NOT one well off the line. fireRail uses t.angle for direction.
      towers.length = 0; projectiles.length = 0; beams.length = 0;
      const rg = { type:'rail', x:100, y:300, level:1, spec:null, dmg:40, rate:1.7, range:200,
                   dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0,
                   angle:0 /* east */ };
      towers.push(rg);
      const mk = (x, y) => ({ x, y, r:11, hp:500, maxHp:500, armor:0, dead:false, flash:0,
                              kind:'norm', blinkInvuln:0, bounty:1, dist:0 });
      const onLine = [ mk(160, 300), mk(220, 300), mk(280, 300) ];   // within range, on the beam
      const offLine = mk(220, 360);                                  // 60px off the line → missed
      const behind  = mk(60, 300);                                   // behind the tower → missed
      const tooFar  = mk(360, 300);                                  // past range (200) → missed
      enemies.length = 0;
      [...onLine, offLine, behind, tooFar].forEach(e => enemies.push(e));
      fireRail(rg, onLine[0], 40);
      const lineHits = onLine.filter(e => e.hp < 500).length;        // expect 3
      const offMissed = offLine.hp === 500 && behind.hp === 500 && tooFar.hp === 500;
      const beamDrawn = beams.some(b => b.straight === true);
      // exercise the straight-tracer render branch: clear the minimal mock enemies first
      // (draw() expects fully-formed enemy objects), keeping the live straight beam so the
      // new b.straight branch in draw()'s beam loop actually runs and must not throw.
      enemies.length = 0;
      let drawOk = beams.some(b => b.straight === true);
      try { draw(); } catch (e) { drawOk = false; }

      // Overcharged Coil widens the beam: an enemy 24px off the line is MISSED by a base
      // railgun (half-width 14 + r 11 = 25 → 24<25 actually grazes; use 30px to be safe)
      // but CAUGHT by the wide spec (half-width 26 + 11 = 37).
      enemies.length = 0; beams.length = 0;
      const edge = mk(220, 330);   // 30px off the line
      enemies.push(edge);
      const narrow = { ...rg, spec:null };
      fireRail(narrow, edge, 40);
      const narrowMiss = edge.hp === 500;
      edge.hp = 500;
      const wide = { ...rg, spec:'railwide' };
      fireRail(wide, edge, 40);
      const wideHit = edge.hp < 500;

      // respects armor (kinetic slug — NOT an armor-ignorer): an armored target takes reduced dmg
      enemies.length = 0;
      const armored = { x:160, y:300, r:11, hp:1000, maxHp:1000, armor:50, dead:false, flash:0,
                        kind:'shield', blinkInvuln:0, bounty:1, dist:0 };
      enemies.push(armored);
      fireRail(rg, armored, 100);
      const respectsArmor = (1000 - armored.hp) < 100;   // armor blunted it (not full 100)

      // save/resume round-trips a placed Railgun (rebuilt generically from TOWER_TYPES)
      towers.length = 0; enemies.length = 0; beams.length = 0;
      towers.push({ type:'rail', x:250, y:250, level:3, spec:'railwide', mode:'last',
        invested:300, dealt:42, kills:2, range:def.range*Math.pow(1.08,2), dmg:def.dmg*Math.pow(1.45,2),
        rate:def.rate*Math.pow(0.88,2), cd:0, baseCost:def.cost, angle:0, buffPower:0.25, flash:0 });
      wave = 2; lives = 20; gold = 100; waveActive = false;
      saveRun();
      towers.length = 0;
      const loaded = loadRun();
      const rrt = towers.find(t => t.type === 'rail');
      const roundTrips = loaded === true && !!rrt && rrt.level === 3 && rrt.spec === 'railwide' && rrt.mode === 'last';

      localStorage.removeItem('cd_save');
      backToMenu();
      return { defOk, specsOk, masteryOk, inShopKeys, sfxOk, shopHasRail, penOk,
               lineHits, offMissed, beamDrawn, drawOk, narrowMiss, wideHit, respectsArmor, roundTrips };
    });
    check('Railgun definition wired (proj/range/dmg)', r.defOk);
    check('Railgun has 2 specs (Penetrator + Overcharged Coil)', r.specsOk);
    check('Railgun Mastery talent exists', r.masteryOk);
    check('Railgun is in the shop tower keys', r.inShopKeys);
    check('SFX.rail beam sound exists', r.sfxOk);
    check('Railgun button rendered in the shop', r.shopHasRail);
    check('Penetrator spec = +20% damage', r.penOk);
    check('Railgun pierces ALL enemies in a line', r.lineHits === 3, `lineHits=${r.lineHits}`);
    check('Railgun misses off-line / behind / out-of-range enemies', r.offMissed);
    check('Railgun draws a straight tracer beam', r.beamDrawn);
    check('draw() renders the straight-beam branch without throwing', r.drawOk);
    check('Overcharged Coil widens the beam (catches a 30px-off enemy a narrow beam misses)',
      r.narrowMiss && r.wideHit, `narrowMiss=${r.narrowMiss} wideHit=${r.wideHit}`);
    check('Railgun respects armor (not a boss-melter)', r.respectsArmor);
    check('placed Railgun save/resume round-trips', r.roundTrips);
    check('no console errors during Railgun test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [92] Sharpshooter achievement — hit 5+ enemies with a single Railgun beam (v1.84.0)
  console.log('\n[92] Sharpshooter achievement (railhit5)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // badge defined & wired
      const badgeOk = !!ACH_BY_ID.railhit5 && /Railgun/.test(ACH_BY_ID.railhit5.desc);
      // stale-label fix: Full Arsenal now reads "10 tower types" (Laser added v2.9.0)
      const arsenalOk = /10 tower types/.test(ACH_BY_ID.arsenal.desc);

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      // railBestHit starts at 0 after beginGame()/resetState()
      const startsZero = railBestHit === 0;

      // line up 6 enemies along a railgun's beam → one shot rakes all 6
      towers.length = 0; enemies.length = 0; beams.length = 0;
      const rg = { type:'rail', x:100, y:300, level:1, spec:null, dmg:40, rate:1.7, range:200,
                   dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      towers.push(rg);
      const mk = (x, y) => ({ x, y, r:11, hp:500, maxHp:500, armor:0, dead:false, flash:0,
                              kind:'norm', blinkInvuln:0, bounty:1, dist:0 });
      for (const x of [130, 160, 190, 220, 250, 280]) enemies.push(mk(x, 300));
      fireRail(rg, enemies[0], 40);
      const tracked = railBestHit;   // expect 6

      // a finished run with railBestHit>=5 grants railhit5 (win OR loss)
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0 };
      railBestHit = 6;
      towers.length = 0; towers.push({ type:'rail', dealt: 100, kills: 5 });
      const grantedOnLoss = grantAchievements(false).map(a => a.id).includes('railhit5');

      // a beam that hit only 4 does NOT grant it
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0 };
      railBestHit = 4;
      grantAchievements(false);
      const notUnder5 = !meta.achievements.railhit5;

      localStorage.removeItem('cd_save');
      backToMenu();
      return { badgeOk, arsenalOk, startsZero, tracked, grantedOnLoss, notUnder5 };
    });
    check('Sharpshooter badge defined (railhit5, Railgun desc)', r.badgeOk);
    check('Full Arsenal desc updated to "10 tower types"', r.arsenalOk);
    check('railBestHit resets to 0 on a new run', r.startsZero);
    check('fireRail tracks the peak single-beam rake (6 in a line)', r.tracked === 6, `tracked=${r.tracked}`);
    check('railBestHit>=5 grants Sharpshooter (win or loss)', r.grantedOnLoss);
    check('a 4-enemy beam does NOT grant Sharpshooter', r.notUnder5);
    check('no console errors during Sharpshooter test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [93] Ambush rare perk — +30% damage to enemies above 80% HP (v1.85.0)
  console.log('\n[93] Ambush perk (high-HP opener bonus)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      meta.talents = {}; // zero critlab so crit RNG can't perturb the damage comparison

      const def = PERKS.find(p => p.id === 'ambush');
      const inPool = !!def && def.rarity === 'rare';

      // ambush is keyed to current HP in the fire loop, so it must NOT be in effDmg (no panel churn)
      towers.length = 0;
      const probe = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0, buffPower:0.25 };
      towers.push(probe);
      perkState.ambush = false;
      const effBefore = effDmg(probe);
      perkState.ambush = true;
      const effAfter = effDmg(probe);
      const notInEffDmg = Math.abs(effAfter - effBefore) < 1e-9;

      // fire one instant rail shot and measure raw damage dealt at a given HP fraction
      function shot(ambushOn, hpFrac) {
        perkState.ambush = ambushOn;
        perkState.critChance = 0;
        towers.length = 0; enemies.length = 0; beams.length = 0; projectiles.length = 0;
        const rg = { type:'rail', x:100, y:300, level:1, spec:null, dmg:36, rate:1.7, range:300,
                     dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
        towers.push(rg);
        const maxHp = 100000;
        const e = { x:160, y:300, r:11, hp: maxHp * hpFrac, maxHp, armor:0, dead:false, flash:0,
                    kind:'norm', blinkInvuln:0, bounty:1, dist:0, frozen:0, slow:0 };
        enemies.push(e);
        const before = e.hp;
        update(1/60);          // one tick → exactly one rail shot (reload 1.7s ≫ dt)
        return before - e.hp;
      }
      const base   = shot(false, 1.0);   // fresh enemy, no perk
      const fresh  = shot(true,  1.0);    // fresh enemy (>80% HP), perk → +30%
      const low    = shot(true,  0.5);    // wounded enemy (<80% HP), perk → no bonus
      const bonusOk = Math.abs(fresh - base * 1.3) < 1e-4;
      const noBonusBelow = Math.abs(low - base) < 1e-4;

      // freshPerkState default + save/reload round-trip (boolean via Object.assign)
      const defaultsOk = freshPerkState().ambush === false;
      perkState.ambush = true;
      saveRun();
      perkState.ambush = false;
      const loaded = loadRun();
      const restored = perkState.ambush === true;
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.ambush;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.ambush === false;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, notInEffDmg, base, fresh, low, bonusOk, noBonusBelow, defaultsOk, loaded, restored, migratedOk };
    });
    check('Ambush is a rare perk in the pool', r.inPool);
    check('Ambush is NOT applied in effDmg (no panel churn)', r.notInEffDmg);
    check('Ambush gives +30% damage to a >80% HP enemy', r.bonusOk, `base=${r.base} fresh=${r.fresh}`);
    check('Ambush gives no bonus to a <80% HP enemy', r.noBonusBelow, `base=${r.base} low=${r.low}`);
    check('freshPerkState defaults ambush:false', r.defaultsOk);
    check('save/reload round-trips the ambush flag', r.loaded === true && r.restored, JSON.stringify(r));
    check('old save missing ambush migrates to default false', r.migratedOk);
    check('no console errors during Ambush test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [94] Capacitor rare perk — all abilities recharge 25% faster (v1.86.0)
  console.log('\n[94] Capacitor perk (all-ability cooldown reduction)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      meta.talents = {};            // zero Overdrive so metaCdMult() === 1
      beginGame();

      const def = PERKS.find(p => p.id === 'capacitor');
      const inPool = !!def && def.rarity === 'rare';
      const notLegendary = def && def.rarity !== 'legendary';   // so resolveWildcard() won't roll it

      const base = metaCdMult();    // 1 with no talents

      // apply the perk → abilityCdMult ×0.75
      perkState.abilityCdMult = 1;
      def.apply(perkState);
      const multOk = Math.abs(perkState.abilityCdMult - 0.75) < 1e-9;

      // each ability assignment must fold in abilityCdMult
      enemies.length = 0;
      abilityCd.freeze = 0;
      triggerAbility('freeze');
      const freezeOk = Math.abs(abilityCd.freeze - ABILITIES.freeze.cd * base * 0.75) < 1e-6;

      abilityCd.rush = 0;
      wave = Math.max(wave, 1);   // Gold Rush is gated until waves start (v1.100.1)
      triggerAbility('rush');
      const rushOk = Math.abs(abilityCd.rush - ABILITIES.rush.cd * base * 0.75) < 1e-6;

      abilityCd.shock = 0;
      triggerAbility('shock');
      const shockOk = Math.abs(abilityCd.shock - ABILITIES.shock.cd * base * 0.75) < 1e-6;

      abilityCd.meteor = 0;
      castMeteor(W / 2, H / 2);     // meteor folds meteorCdMult (1) AND abilityCdMult
      const meteorOk = Math.abs(abilityCd.meteor - ABILITIES.meteor.cd * base * perkState.meteorCdMult * 0.75) < 1e-6;

      // freshPerkState default + save/reload round-trip + old-save migration
      const defaultsOk = freshPerkState().abilityCdMult === 1;
      perkState.abilityCdMult = 0.75;
      saveRun();
      perkState.abilityCdMult = 1;
      loadRun();
      const restored = Math.abs(perkState.abilityCdMult - 0.75) < 1e-9;
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.abilityCdMult;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.abilityCdMult === 1;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, notLegendary, multOk, freezeOk, rushOk, shockOk, meteorOk, defaultsOk, restored, migratedOk };
    });
    check('Capacitor is a rare perk in the pool', r.inPool);
    check('Capacitor is not legendary (Wildcard cannot roll it)', r.notLegendary);
    check('Capacitor apply sets abilityCdMult ×0.75', r.multOk);
    check('Time Freeze cooldown folds in abilityCdMult', r.freezeOk);
    check('Gold Rush cooldown folds in abilityCdMult', r.rushOk);
    check('Shockwave cooldown folds in abilityCdMult', r.shockOk);
    check('Meteor cooldown folds in abilityCdMult', r.meteorOk);
    check('freshPerkState defaults abilityCdMult:1', r.defaultsOk);
    check('save/reload round-trips abilityCdMult', r.restored);
    check('old save missing abilityCdMult migrates to default 1', r.migratedOk);
    check('no console errors during Capacitor test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [95] Cascade map — 5th quick-play map + Ice theme identity (v1.87.0)
  console.log('\n[95] Cascade map (stepped descent + Ice theme)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Map definition: present, named, well-formed axis-aligned path enters off-left, exits off-right.
    const def = await page.evaluate(() => {
      const m = MAPS.cascade;
      const pts = m && m.pts;
      let axisAligned = !!pts && pts.length >= 4;
      if (pts) for (let i = 0; i < pts.length - 1; i++) {
        const sameX = pts[i][0] === pts[i + 1][0], sameY = pts[i][1] === pts[i + 1][1];
        if (sameX === sameY) { axisAligned = false; break; }   // both same (zero-len) or neither (diagonal)
      }
      const inBounds = !!pts && pts.every(([x, y]) => x >= -40 && x <= 940 && y >= 0 && y <= 560);
      return {
        exists: !!m, named: !!m && typeof m.name === 'string' && m.name.length > 0,
        hasPath: Array.isArray(pts), axisAligned, inBounds,
        entersLeft: !!pts && pts[0][0] === -30, exitsRight: !!pts && pts[pts.length - 1][0] === 930,
        notLast: Object.keys(MAPS).indexOf('cascade') < Object.keys(MAPS).indexOf('mayhem'),
      };
    });
    check('Cascade map exists and is named', def.exists && def.named);
    check('Cascade has an axis-aligned path (no diagonals/zero-length segs)', def.axisAligned);
    check('Cascade path stays within the board', def.inBounds);
    check('Cascade path enters off-left (-30) and exits off-right (930)', def.entersLeft && def.exitsRight);
    check('Cascade sits before Mayhem in the map order', def.notLast);

    // Theme: Ice palette exists and is the map's fixed identity.
    const theme = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'cascade'; diffKey = 'normal';
      const fixed = MAP_THEME.cascade;
      const hasPalette = !!THEMES.ice && typeof THEMES.ice.glow === 'string';
      const inCampaignPool = CAMPAIGN_THEMES.includes('ice');
      const picks = pickMapTheme();              // quick-mode cascade -> fixed ice
      beginGame();
      const resolved = mapTheme;                 // resetState() set it via pickMapTheme()
      const pal = mapPalette();                  // concrete palette for the frame
      const ok = pal && pal.glow === THEMES.ice.glow;
      backToMenu(); localStorage.removeItem('cd_save');
      return { fixed, hasPalette, inCampaignPool, picks, resolved, ok };
    });
    check('Ice theme palette exists', theme.hasPalette);
    check('Cascade maps to the Ice theme', theme.fixed === 'ice' && theme.picks === 'ice');
    check('Ice is available to the campaign palette pool', theme.inCampaignPool);
    check('a Cascade run resolves to the Ice palette', theme.resolved === 'ice' && theme.ok);

    // The map appears as a selectable button on the start screen.
    const btn = await page.evaluate(() => {
      renderStartScreen();
      return /Cascade/.test(document.getElementById('mapRow').innerHTML);
    });
    check('Cascade appears in the start-screen map selector', btn);

    // A real run drives to completion on the new path (pathing/spawning work, no hang).
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'cascade'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const pathOk = pathLen > 1000 && Array.isArray(waypoints) && waypoints === MAPS.cascade.pts;
      __cdGodTowers(8);
      __cdDrive({ maxWave: 6 });
      const out = { reached: wave >= 5, wave, pathOk };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Cascade buildPath wires the static path', drove.pathOk, JSON.stringify(drove));
    check('a Cascade run drives clean to wave 5+', drove.reached, JSON.stringify(drove));

    // Records: a finished quick run logs a per-map best under cd_best_cascade_<diff>,
    // and the map validates on save/resume (loadRun accepts MAPS[mapKey]).
    const rec = await page.evaluate(() => {
      localStorage.removeItem('cd_best_cascade_hard');
      gameMode = 'quick'; mapKey = 'cascade'; diffKey = 'hard';
      beginGame();
      best = 0; wave = 9; lives = 0;
      endGame();
      const mapBest = +(localStorage.getItem('cd_best_cascade_hard') || 0);

      // save/resume round-trip on the static map
      gameMode = 'quick'; mapKey = 'cascade'; diffKey = 'normal';
      beginGame(); wave = 3;
      saveRun();
      const loaded = loadRun();
      const restored = loaded === true && mapKey === 'cascade';

      ['cd_best_cascade_hard', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { mapBest, restored };
    });
    check('Cascade records a per-map best (hard = 9)', rec.mapBest === 9, JSON.stringify(rec));
    check('Cascade save/resume round-trips', rec.restored, JSON.stringify(rec));

    check('no console errors during Cascade map test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [96] Revenant boss archetype — the 11th: reboots ONCE on death at 35% HP (v1.88.0)
  console.log('\n[96] Revenant boss (death-defiance archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // it's the 11th archetype, in the rotation at w70 (conduit is now the 12th at w75).
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(70) === 'revenant';
      const wrapsAt75 = bt(75) === 'conduit';

      const sp = pointAt(60);
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
      const mk = () => ({ kind:'boss', bossType:'revenant', hp:5000, maxHp:5000, spd:0, r:24, bounty:100,
        color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });

      // First "kill": the Revenant does NOT die — it reboots at 35% max HP, latches `revived`.
      const boss = mk();
      enemies.push(boss);
      const goldBefore = gold; const killsBefore = kills;
      damage(boss, 1e9, null);
      const survivedFirst = !boss.dead && boss.hp > 0;
      const revivedAt35 = Math.abs(boss.hp - boss.maxHp * 0.35) < 1e-6;
      const latched = boss.revived === true;
      const noBountyOnRevive = gold === goldBefore && kills === killsBefore;   // fake death pays nothing

      // Second kill: now it really dies (no second revive).
      damage(boss, 1e9, null);
      const diedSecond = boss.dead === true && boss.hp <= 0;

      // Control: a frozen Revenant still revives (death-trigger ignores freeze, like the hydra split).
      enemies.length = 0; pendingSpawns.length = 0;
      const frozenBoss = mk(); frozenBoss.frozen = 5;
      enemies.push(frozenBoss);
      damage(frozenBoss, 1e9, null);
      const revivesWhileFrozen = !frozenBoss.dead && frozenBoss.revived === true;

      // Control: a non-revenant boss of the same shape dies on the first hit (no revive).
      enemies.length = 0; pendingSpawns.length = 0;
      const ctrl = mk(); ctrl.bossType = 'regen';
      enemies.push(ctrl);
      damage(ctrl, 1e9, null);
      const controlDiesOnce = ctrl.dead === true;

      // render-side wiring: badge resolves to REVENANT, flips to REVIVED once used.
      const badgeFresh = bossMechanicBadge({ kind:'boss', bossType:'revenant' });
      const badgeUsed  = bossMechanicBadge({ kind:'boss', bossType:'revenant', revived:true });
      const badgeOk = badgeFresh && badgeFresh.label === 'REVENANT' && badgeUsed && badgeUsed.label === 'REVIVED';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt75, survivedFirst, revivedAt35, latched, noBountyOnRevive,
               diedSecond, revivesWhileFrozen, controlDiesOnce, badgeOk,
               archCount: BOSS_ARCHETYPES.length };
    });
    check('revenant is the 11th archetype (w70)', r.inRotation && r.archCount === 16);
    check('conduit follows revenant (w75 → conduit)', r.wrapsAt75);
    check('revenant survives the first lethal hit', r.survivedFirst);
    check('revenant reboots at exactly 35% max HP', r.revivedAt35);
    check('revenant latches `revived` (one-time)', r.latched);
    check('the fake death pays no bounty/combo', r.noBountyOnRevive);
    check('revenant dies for real on the second kill', r.diedSecond);
    check('revenant revives even while frozen (death-trigger)', r.revivesWhileFrozen);
    check('control: a non-revenant boss dies on the first hit', r.controlDiesOnce);
    check('boss-bar badge resolves REVENANT → REVIVED', r.badgeOk);
    check('no console errors during Revenant test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [97] Default targeting mode — new towers inherit a chosen Settings default (v1.89.0)
  console.log('\n[97] Default targeting mode (new-tower default)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      try { localStorage.removeItem('cd_defaultmode'); } catch(e) {}
      beginGame();
      gold = 1e9; towers.length = 0; selectedTower = null; selectedShop = null;

      const hasGlobal = typeof defaultTargetMode === 'string';
      const settingFn = typeof setDefaultMode === 'function';

      const rect = cv.getBoundingClientRect();
      const tap = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + x * rect.width / W,
        clientY: rect.top + y * rect.height / H, button: 0, bubbles: true,
      }));
      // a placeable point on the board
      let pX = -1, pY = -1;
      for (let yy = 70; yy < H - 70 && pX < 0; yy += 13)
        for (let xx = 70; xx < W - 70; xx += 13) {
          const sp = placeCoord(xx, yy);
          if (canPlace(sp.x, sp.y)) { pX = xx; pY = yy; break; }
        }

      // Baseline: with no default set, a new tower still starts on 'first'.
      defaultTargetMode = 'first';
      towers.length = 0; selectedShop = 'gun';
      tap(pX, pY);
      const defaultsFirst = towers.length > 0 && towers[towers.length - 1].mode === 'first';

      // Set the default to 'strong' → it persists, and the NEXT placed tower inherits it.
      setDefaultMode('strong');
      const persisted = localStorage.getItem('cd_defaultmode') === 'strong' && defaultTargetMode === 'strong';
      towers.length = 0; selectedShop = 'gun';
      tap(pX, pY);
      const inheritsStrong = towers.length > 0 && towers[towers.length - 1].mode === 'strong';

      // An unknown/old persisted value falls back to 'first' at the setter AND the placement site.
      setDefaultMode('bogus');
      const setterValidates = defaultTargetMode === 'first';
      defaultTargetMode = 'bogus';            // simulate a stale value bypassing the setter
      towers.length = 0; selectedShop = 'gun';
      tap(pX, pY);
      const placeValidates = towers.length > 0 && towers[towers.length - 1].mode === 'first';

      // Every MODES value is a valid default (data-driven, like the in-game cycle button).
      let allModesValid = true;
      for (const m of MODES) { setDefaultMode(m); if (defaultTargetMode !== m) { allModesValid = false; break; } }

      // Settings panel renders the picker row (one button per mode).
      setDefaultMode('weak');
      renderSettings();
      const body = document.getElementById('settingsBody').innerHTML;
      const rowShown = /New-tower target/.test(body) && body.indexOf("setDefaultMode('weak')") >= 0;

      // Per-tower mode still round-trips in saves (no save-schema change): the default only
      // affects fresh placement, a loaded tower keeps its own saved mode.
      defaultTargetMode = 'first';
      towers.length = 0; selectedShop = 'gun'; tap(pX, pY);
      towers[towers.length - 1].mode = 'last';
      saveRun();
      const reloaded = loadRun();
      const savedModeKept = reloaded === true && towers.some(t => t.mode === 'last');

      // resetAllData() restores the default to 'first'.
      setDefaultMode('support');
      resetAllData(); resetAllData();        // two clicks within 3s to commit
      const resetOk = defaultTargetMode === 'first';

      try { localStorage.removeItem('cd_defaultmode'); localStorage.removeItem('cd_save'); } catch(e) {}
      backToMenu();
      return { hasGlobal, settingFn, defaultsFirst, persisted, inheritsStrong,
               setterValidates, placeValidates, allModesValid, rowShown, savedModeKept, resetOk };
    });
    check('defaultTargetMode global + setDefaultMode setter exist', r.hasGlobal && r.settingFn);
    check('with no default set, a new tower starts on First', r.defaultsFirst);
    check('setDefaultMode persists to cd_defaultmode', r.persisted);
    check('a newly placed tower inherits the chosen default (Strong)', r.inheritsStrong);
    check('setter validates an unknown value back to First', r.setterValidates);
    check('placement validates a stale unknown default back to First', r.placeValidates);
    check('every targeting MODE is a valid default', r.allModesValid);
    check('Settings renders the New-tower target picker row', r.rowShown);
    check('a saved tower keeps its own mode (no save-schema change)', r.savedModeKept);
    check('resetAllData restores the default to First', r.resetOk);
    check('no console errors during default-targeting test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [98] Bastion enemy — blast-shell that resists explosive splash from wave 14+ (v1.90.0)
  console.log('\n[98] Bastion enemy (splash-resistant)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w14, present from w14; tagged aoeResist; HP ≈ template×1.6
      const w13 = buildWave(13).some(e => e.kind === 'bastion');
      const w14list = buildWave(14).filter(e => e.kind === 'bastion');
      const w14 = w14list.length;
      const allResist = w14list.every(e => e.aoeResist === true);
      const t14 = enemyTemplate(14);
      const hpOk = w14list[0] ? Math.abs(w14list[0].maxHp - t14.hp * 1.6) < 0.01 : false;

      // (b) splash resistance: a Bastion takes HALF the Cannon/Mortar splash damage of a norm
      // control at the same point, but a direct (single-target) hit deals it FULL damage.
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;
      const pt = pointAt(pathLen * 0.4);
      const mk = (kind, extra = {}) => ({ kind, hp:1000, maxHp:1000, spd:1, r:12, bounty:1,
        color:'#fff', armor:0, gap:0, dist:pathLen*0.4, x:pt.x, y:pt.y, slow:0, slowF:0.6,
        frozen:0, poison:null, flash:0, px:0, py:0, ...extra });

      // Cannon bomb splash over a bastion + a norm sitting on the same tile.
      const bBomb = mk('bastion', { aoeResist:true }), nBomb = mk('norm');
      enemies.push(bBomb, nBomb);
      hitEnemy({ kind:'bomb', target:{ x:pt.x, y:pt.y }, dmg:100, src:null, ignoreArmor:false });
      const bombBastionLoss = 1000 - bBomb.hp, bombNormLoss = 1000 - nBomb.hp;
      const bombHalved = Math.abs(bombBastionLoss - 50) < 0.01 && Math.abs(bombNormLoss - 100) < 0.01;

      // Mortar shell splash — same expectation.
      enemies.length = 0;
      const bMort = mk('bastion', { aoeResist:true }), nMort = mk('norm');
      enemies.push(bMort, nMort);
      hitEnemy({ kind:'mortar', target:{ x:pt.x, y:pt.y }, dmg:100, color:'#fff', src:null, ignoreArmor:true });
      const mortHalved = Math.abs((1000 - bMort.hp) - 50) < 0.01 && Math.abs((1000 - nMort.hp) - 100) < 0.01;

      // Direct single-target hit (not splash) deals a Bastion FULL damage.
      enemies.length = 0;
      const bDirect = mk('bastion', { aoeResist:true });
      enemies.push(bDirect);
      hitEnemy({ kind:'bullet', target:bDirect, dmg:100, color:'#fff', src:null, ignoreArmor:false });
      const directFull = Math.abs((1000 - bDirect.hp) - 100) < 0.01;
      enemies.length = 0;

      // (c) preview/render plumbing: composition + glyph + colour + HP mult all know it,
      // and the threat number stays in sync with the real buildWave() total at w14.
      const compHasBastion = waveComposition(14).some(c => c.kind === 'bastion');
      const glyph = enemyGlyph({ kind:'bastion', frozen:0 });
      const frozenGlyph = enemyGlyph({ kind:'bastion', frozen:1 });   // frozen overrides to ❄
      const hasColor = !!PREVIEW_COLOR.bastion;
      const hpMult = KIND_HP_MULT.bastion;
      const threatOk = Math.abs(waveThreat(14) - buildWave(14).reduce((s,e)=>s+e.maxHp,0)) < 0.01;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (d) integration: a real wave-14+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 16 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w13, w14, allResist, hpOk, bombHalved, mortHalved, directFull, compHasBastion,
               glyph, frozenGlyph, hasColor, hpMult, threatOk, run };
    });
    check('no bastions before wave 14', r.w13 === false);
    check('bastions spawn from wave 14', r.w14 >= 1, 'count=' + r.w14);
    check('every bastion is tagged aoeResist', r.allResist);
    check('bastion HP is template×1.6', r.hpOk);
    check('Cannon bomb splash deals a bastion half (norm full)', r.bombHalved);
    check('Mortar shell splash deals a bastion half (norm full)', r.mortHalved);
    check('a direct single-target hit deals a bastion full damage', r.directFull);
    check('waveComposition includes bastion at wave 14', r.compHasBastion);
    check('enemyGlyph returns ⬢ for bastion', r.glyph === '⬢', 'glyph=' + r.glyph);
    check('a frozen bastion still shows the ❄ glyph (cosmetic)', r.frozenGlyph === '❄');
    check('PREVIEW_COLOR has a bastion colour', r.hasColor);
    check('KIND_HP_MULT.bastion is 1.6 (matches buildWave)', r.hpMult === 1.6, 'mult=' + r.hpMult);
    check('waveThreat stays in sync with buildWave at w14 (bastion counted)', r.threatOk);
    check('wave-14+ run with bastions reaches w>=16 alive', r.run.wave >= 16 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during bastion tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [99] Jammer enemy — tower-disabling regular enemy from wave 16+ (v1.91.0)
  console.log('\n[99] Jammer enemy (tower-disabling)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w16, present from w16; HP ≈ template×1.15
      const w15 = buildWave(15).some(e => e.kind === 'jammer');
      const w16list = buildWave(16).filter(e => e.kind === 'jammer');
      const w16 = w16list.length;
      const t16 = enemyTemplate(16);
      const hpOk = w16list[0] ? Math.abs(w16list[0].maxHp - t16.hp * 1.15) < 0.01 : false;

      // (b) EMP behaviour: a jammer knocks the nearest firing tower offline (sets empT > 0);
      // freeze pauses it; buff towers are immune. Co-locate the tower at the jammer's RESOLVED
      // path point (update() overwrites e.x/e.y from pointAt(dist) every tick — the aura x/y gotcha).
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
      const dp = pointAt(60);
      const jamRun = (frozen, towerType) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        enemies.push({ kind:'jammer', hp:1000, maxHp:1000, spd:0, r:12, bounty:1, color:'#f2e34a',
          armor:0, gap:0.8, dist:60, x:dp.x, y:dp.y, px:dp.x, py:dp.y, slow:0, slowF:0.6,
          frozen: frozen ? 999 : 0, poison:null, flash:0 });
        towers.push({ type:towerType, x:dp.x+20, y:dp.y, range:120, dmg:1, rate:1, cd:0, level:1,
          baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, empT:0 });
        let sawOffline = false;
        for (let i = 0; i < 360; i++) { update(1/60); if (towers[0] && towers[0].empT > 0) sawOffline = true; }
        return sawOffline;
      };
      const jammerEmps = jamRun(false, 'gun');
      const frozenNoEmp = !jamRun(true, 'gun');
      const buffImmune = !jamRun(false, 'buff');

      // (c) out-of-range: a tower far from the jammer is never disabled (105px local reach).
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
      enemies.push({ kind:'jammer', hp:1000, maxHp:1000, spd:0, r:12, bounty:1, color:'#f2e34a',
        armor:0, gap:0.8, dist:60, x:dp.x, y:dp.y, px:dp.x, py:dp.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0 });
      towers.push({ type:'gun', x:dp.x+400, y:dp.y, range:120, dmg:1, rate:1, cd:0, level:1,
        baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, empT:0 });
      let farOffline = false;
      for (let i = 0; i < 360; i++) { update(1/60); if (towers[0] && towers[0].empT > 0) farOffline = true; }
      const outOfRangeSafe = !farOffline;
      enemies.length = 0; towers.length = 0;

      // (d) preview/render plumbing: composition + glyph + colour + HP mult all know it, and the
      // threat number stays in sync with the real buildWave() total at w16.
      const compHasJammer = waveComposition(16).some(c => c.kind === 'jammer');
      const glyph = enemyGlyph({ kind:'jammer', frozen:0 });
      const frozenGlyph = enemyGlyph({ kind:'jammer', frozen:1 });   // frozen overrides to ❄
      const hasColor = !!PREVIEW_COLOR.jammer;
      const hpMult = KIND_HP_MULT.jammer;
      const threatOk = Math.abs(waveThreat(16) - buildWave(16).reduce((s,e)=>s+e.maxHp,0)) < 0.01;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (e) integration: a real wave-16+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 18 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w15, w16, hpOk, jammerEmps, frozenNoEmp, buffImmune, outOfRangeSafe, compHasJammer,
               glyph, frozenGlyph, hasColor, hpMult, threatOk, run };
    });
    check('no jammers before wave 16', r.w15 === false);
    check('jammers spawn from wave 16', r.w16 >= 1, 'count=' + r.w16);
    check('jammer HP is template×1.15', r.hpOk);
    check('jammer knocks the nearest tower offline (empT > 0)', r.jammerEmps);
    check('a frozen jammer does NOT emp (freeze pauses it)', r.frozenNoEmp);
    check('a buff/support tower is immune to the jammer', r.buffImmune);
    check('a tower beyond 105px is never disabled (local reach)', r.outOfRangeSafe);
    check('waveComposition includes jammer at wave 16', r.compHasJammer);
    check('enemyGlyph returns ⚡ for jammer', r.glyph === '⚡', 'glyph=' + r.glyph);
    check('a frozen jammer still shows the ❄ glyph (cosmetic)', r.frozenGlyph === '❄');
    check('PREVIEW_COLOR has a jammer colour', r.hasColor);
    check('KIND_HP_MULT.jammer is 1.15 (matches buildWave)', r.hpMult === 1.15, 'mult=' + r.hpMult);
    check('waveThreat stays in sync with buildWave at w16 (jammer counted)', r.threatOk);
    check('wave-16+ run with jammers reaches w>=18 alive', r.run.wave >= 18 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during jammer tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [100] Farsight meta talent — global +2%/rank firing range, booster aura untouched (v1.92.0)
  console.log('\n[100] Farsight range talent');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // talent exists in the CORE tree, max 5
      const def = TALENTS.farsight;
      const inTree = !!def && def.sect === 'CORE' && def.max === 5;

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // rank 0 -> metaRangeMult is 1 (no effect); rank 5 -> +10% firing range
      meta.talents = {}; // zero everything (incl. mastery_gun) so only farsight moves the number
      perkState.rangeMult = 1;
      const rBase = effRange(gun);
      const mult0 = metaRangeMult();
      meta.talents.farsight = 5;
      const rMax = effRange(gun);
      const mult5 = metaRangeMult();

      // booster aura range (effBuffRange) is NOT affected by the talent
      const booster = { type:'buff', x:400, y:300, level:1, spec:null, range:45, buffPower:0.25 };
      towers.push(booster);
      const buffRange = effBuffRange(booster);
      const buffExpected = booster.range; // mastery_buff rank 0 => ×1, farsight must not apply

      // loadMeta auto-migrates the new key to 0 for an old save that predates it
      localStorage.setItem('cd_meta', JSON.stringify({ chips: 42, talents: { firepower: 2 } }));
      loadMeta();
      const migratedOk = meta.talents.farsight === 0 && meta.talents.firepower === 2 && meta.chips === 42;

      // cleanup
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
      loadMeta();
      localStorage.removeItem('cd_meta'); localStorage.removeItem('cd_save');
      backToMenu();
      return { inTree, rBase, rMax, mult0, mult5, buffRange, buffExpected, migratedOk };
    });
    check('Farsight is a CORE talent (max 5)', r.inTree);
    check('Farsight rank 0 => metaRangeMult 1 (no effect)', Math.abs(r.mult0 - 1) < 1e-9 && Math.abs(r.rMax / r.rBase - 1.10) < 1e-6, JSON.stringify(r));
    check('Farsight rank 5 => +10% firing range', Math.abs(r.mult5 - 1.10) < 1e-9, 'mult5=' + r.mult5);
    check('Farsight leaves booster aura range untouched', Math.abs(r.buffRange - r.buffExpected) < 1e-6, `buff=${r.buffRange}`);
    check('loadMeta migrates a pre-Farsight save (key defaults 0)', r.migratedOk, JSON.stringify(r));
    check('no console errors during Farsight test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [101] Barrier ability — bank leak-blocks: enemies that reach the exit are vaporized
  // for no lives lost, no bounty; purely defensive, run-only/save-safe (v1.93.0)
  console.log('\n[101] Barrier ability');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const def = ABILITIES.barrier;
      const inBar = !!def && def.key === 'T';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const cdInit = abilityCd.barrier === 0 && barrierCharges === 0;   // resetState initialised both

      const mk = (opts) => Object.assign({
        kind:'norm', spd:1, hp:100, maxHp:100, dist:pathLen + 50, frozen:0, slow:0, flash:0,
        x:100, y:100, r:11, armor:0, bounty:7, color:'#3fb950', dealt:0
      }, opts || {});

      // cast Barrier -> 3 charges, on cooldown, counts vs Pacifist
      towers.length = 0; spawners.length = 0; enemies.length = 0;
      abilityUsedThisRun = false;
      triggerAbility('barrier');
      const charged = barrierCharges === 3;
      const onCd    = abilityCd.barrier > 0;
      const usedFlag = abilityUsedThisRun === true;

      // four enemies all reach the exit this frame: first 3 are blocked (no life), 4th costs a life
      lives = 20; const goldBefore = gold;
      enemies.push(mk(), mk(), mk(), mk());
      update(1/60);
      const blockedThree = lives === 19;            // only the 4th leak cost a life
      const chargesSpent = barrierCharges === 0;    // all 3 charges consumed
      const noBounty     = gold === goldBefore;     // blocked leaks pay no gold

      // a boss leak (would cost 5) is blocked by a single charge
      enemies.length = 0;
      barrierCharges = 1; lives = 20;
      enemies.push(mk({ kind:'boss', maxHp:5000, hp:5000 }));
      update(1/60);
      const bossBlocked = lives === 20 && barrierCharges === 0;

      // cooldown gate: a second cast while cooling is a no-op (charges stay 0)
      barrierCharges = 0;
      triggerAbility('barrier');
      const cdGated = barrierCharges === 0;

      // run-only: charges are never persisted — save+load resets them to 0
      barrierCharges = 3; saveRun();
      const savedStr = localStorage.getItem('cd_save');
      const notSaved = savedStr ? !('barrierCharges' in JSON.parse(savedStr)) : true;
      loadRun();
      const resetOnLoad = barrierCharges === 0;

      // old save missing abilityCd.barrier migrates to 0
      saveRun();
      let migratedOk = false;
      const old = JSON.parse(localStorage.getItem('cd_save'));
      if (old && old.abilityCd) {
        delete old.abilityCd.barrier;
        localStorage.setItem('cd_save', JSON.stringify(old));
        loadRun();
        migratedOk = abilityCd.barrier === 0;
      }

      enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inBar, cdInit, charged, onCd, usedFlag, blockedThree, chargesSpent,
               noBounty, bossBlocked, cdGated, notSaved, resetOnLoad, migratedOk };
    });
    check('Barrier is a 5th ability bound to T', r.inBar);
    check('abilityCd.barrier + barrierCharges initialise to 0', r.cdInit);
    check('Barrier banks 3 charges on cast', r.charged);
    check('Barrier goes on cooldown after use', r.onCd);
    check('Barrier sets abilityUsedThisRun (counts vs Pacifist)', r.usedFlag);
    check('3 leaks are blocked, the 4th costs a life', r.blockedThree);
    check('all 3 charges are consumed by the leaks', r.chargesSpent);
    check('a blocked leak pays no bounty/gold', r.noBounty);
    check('a boss leak is blocked by a single charge (no lives lost)', r.bossBlocked);
    check('a second cast while cooling is a no-op', r.cdGated);
    check('barrierCharges is never serialized into cd_save', r.notSaved);
    check('barrierCharges resets to 0 on resume (run-only)', r.resetOnLoad);
    check('old save missing abilityCd.barrier migrates to 0', r.migratedOk);
    check('no console errors during Barrier test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [102] Start-menu hover polish — util toolbar + secondary play-row buttons lift/brighten
  // on hover; primary PLAY button excluded; reduce-motion drops the lift (v1.94.0)
  console.log('\n[102] Start-menu hover polish (menu-revamp slice 6)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });

    // a util button has a transition declared (so hover changes ease, not snap)
    const base = await page.evaluate(() => {
      const u = document.querySelector('.startUtil .ctl');
      const cs = getComputedStyle(u);
      return { hasTransition: cs.transitionProperty.includes('transform'), boundingTop: u.getBoundingClientRect().top };
    });
    check('util button declares a transform transition', base.hasTransition, base.hasTransition);

    // hovering a util button lifts it (transform becomes a non-none matrix)
    await page.hover('.startUtil .ctl');
    const hov = await page.evaluate(() => {
      const u = document.querySelector('.startUtil .ctl');
      const cs = getComputedStyle(u);
      return { transform: cs.transform, brightnessApplied: cs.filter && cs.filter !== 'none' };
    });
    check('util button lifts on hover (transform applied)', hov.transform && hov.transform !== 'none', hov.transform);
    check('util button brightens on hover (filter applied)', hov.brightnessApplied, hov.filter);

    // the primary PLAY button is excluded from the lift treatment (keeps its own glow)
    await page.hover('.startPlay .ctl.play');
    const play = await page.evaluate(() => {
      const p = document.querySelector('.startPlay .ctl.play');
      // PLAY still runs its breathing glow animation, and isn't given the menu lift transform
      return { glow: getComputedStyle(p).animationName };
    });
    check('PLAY button keeps its glow animation (not the menu lift)', play.glow === 'playGlow', play.glow);

    // reduce-motion drops the lift (transform:none on hover) but keeps the button usable
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.hover('.startUtil .ctl');
    const rm = await page.evaluate(() => {
      const u = document.querySelector('.startUtil .ctl');
      return { transform: getComputedStyle(u).transform };
    });
    check('reduce-motion drops the hover lift (transform:none)', rm.transform === 'none', rm.transform);
    check('no console errors during hover-polish test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [103] Jammer Surge wave mod — converts basic enemies into tower-disabling jammers (v1.96.0)
  console.log('\n[103] Jammer Surge (tower-uptime wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasMod = WAVE_MODS.some(m => m.id === 'jammers');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod) jammer count for a wave-10 wave (no natural jammers until w16).
      setMod(null);
      const plainWave = buildWave(10);
      const plainJammers = plainWave.filter(e => e.kind === 'jammer').length;

      // JAMMER SURGE — a fraction of basic enemies become jammers, so the wave has MORE.
      setMod('jammers');
      const surgeWave = buildWave(10);
      const surgeJammers = surgeWave.filter(e => e.kind === 'jammer').length;
      const moreJammers = surgeJammers > plainJammers;
      // Converted jammers carry full jammer stats (maxHp set, electric-yellow colour, radius 12).
      const conv = surgeWave.find(e => e.kind === 'jammer');
      const wellFormed = !!conv && conv.maxHp === conv.hp && conv.color === '#f2e34a' && conv.r === 12;
      // Conversion not addition: total wave length unchanged, special kinds untouched.
      const sameLength = surgeWave.length === plainWave.length;
      const fastUntouched = surgeWave.filter(e => e.kind === 'fast').length ===
                            plainWave.filter(e => e.kind === 'fast').length;
      // Inert when the mod is off.
      setMod(null);
      const inertOff = buildWave(10).filter(e => e.kind === 'jammer').length === plainJammers;

      // A converted jammer disables the nearest tower (its lazy jamCd ticks regardless of wave).
      const dp = pointAt(60);
      towers.length = 0; enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0; projectiles.length = 0;
      enemies.push({ kind:'jammer', hp:1000, maxHp:1000, spd:0, r:12, bounty:1, color:'#f2e34a',
        armor:0, gap:0.8, dist:60, x:dp.x, y:dp.y, px:dp.x, py:dp.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0 });
      towers.push({ type:'gun', x:dp.x+40, y:dp.y, range:120, dmg:1, rate:1, cd:0, level:1,
        baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, empT:0 });
      let jammed = false;
      for (let i = 0; i < 360 && !jammed; i++) { update(1/60); if (towers[0] && towers[0].empT > 0) jammed = true; }

      enemies.length = 0; towers.length = 0; waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, moreJammers, wellFormed, sameLength, fastUntouched, inertOff, jammed,
               plainJammers, surgeJammers };
    });
    check('WAVE_MODS includes Jammer Surge', r.hasMod);
    check('Jammer Surge adds jammers to the wave', r.moreJammers, `${r.plainJammers}->${r.surgeJammers}`);
    check('converted jammers are well-formed (maxHp/colour/radius)', r.wellFormed);
    check('Jammer Surge converts (does not lengthen) the wave', r.sameLength);
    check('Jammer Surge leaves the special kinds untouched', r.fastUntouched);
    check('Jammer Surge is inert when the mod is off', r.inertOff);
    check('a converted jammer disables the nearest tower (empT > 0)', r.jammed);
    check('no console errors during Jammer Surge test', consoleErrors.length === 0, consoleErrors.join(' | '));

    // A real Mayhem run still drives to completion with the mod in the pool — no hang.
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 8 });
      const out = { reached: wave >= 7, wave };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Mayhem run with Jammer Surge in the pool drives without hanging', drove.reached, 'wave=' + drove.wave);
    await page.close();
  }

  // [104] Surge Protector rare perk — towers recover from jamming faster (v1.97.0)
  console.log('\n[104] Surge Protector perk (faster jam recovery)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const def = PERKS.find(p => p.id === 'surgeprot');
      const inPool = !!def && def.rarity === 'rare';
      const notLegendary = def && def.rarity !== 'legendary';   // so resolveWildcard() won't roll it

      // apply the perk → empResist ×3
      perkState.empResist = 1;
      def.apply(perkState);
      const multOk = Math.abs(perkState.empResist - 3) < 1e-9;

      // The empT offline timer decays by dt × empResist in update()'s fire loop, so a protected
      // tower (empResist=3) shrugs off a jam ~3× faster than baseline (empResist=1).
      const mkTower = () => ({ type:'gun', x:700, y:300, level:1, cd:99, range:80, dmg:10, rate:1,
        mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0, angle:0, empT:1.2 });
      enemies.length = 0; pendingSpawns.length = 0; spawners.length = 0;

      // baseline empResist=1: 30 frames (0.5s) of decay → 1.2 − 0.5 = 0.70 still offline
      perkState.empResist = 1;
      towers.length = 0; towers.push(mkTower());
      for (let i = 0; i < 30; i++) update(1/60);
      const baseEmp = towers[0].empT;

      // protected empResist=3: same 0.5s decays 1.5s worth → fully recovered (clamped to 0)
      perkState.empResist = 3;
      towers.length = 0; towers.push(mkTower());
      for (let i = 0; i < 30; i++) update(1/60);
      const protEmp = towers[0].empT;

      const baseStillOff = baseEmp > 0.5;        // baseline barely recovered after 0.5s
      const protRecovered = protEmp <= 0.001;    // protected fully shrugged it off
      const fasterDecay = protEmp < baseEmp - 0.3;

      // freshPerkState default + save/reload round-trip + old-save migration
      const defaultsOk = freshPerkState().empResist === 1;
      perkState.empResist = 3;
      saveRun();
      perkState.empResist = 1;
      loadRun();
      const restored = Math.abs(perkState.empResist - 3) < 1e-9;
      const old = JSON.parse(localStorage.getItem('cd_save'));
      delete old.perkState.empResist;
      localStorage.setItem('cd_save', JSON.stringify(old));
      loadRun();
      const migratedOk = perkState.empResist === 1;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, notLegendary, multOk, baseStillOff, protRecovered, fasterDecay, defaultsOk, restored, migratedOk };
    });
    check('Surge Protector is a rare perk in the pool', r.inPool);
    check('Surge Protector is not legendary (Wildcard cannot roll it)', r.notLegendary);
    check('Surge Protector apply sets empResist ×3', r.multOk);
    check('baseline tower still offline after 0.5s', r.baseStillOff);
    check('protected tower (empResist×3) recovers from jam within 0.5s', r.protRecovered);
    check('empResist decays the empT offline timer faster', r.fasterDecay);
    check('freshPerkState defaults empResist:1', r.defaultsOk);
    check('save/reload round-trips empResist', r.restored);
    check('old save missing empResist migrates to default 1', r.migratedOk);
    check('no console errors during Surge Protector test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [105] Nexus map — 6th quick-play map + Violet theme identity (v1.98.0)
  console.log('\n[105] Nexus map (central crossfire convergence + Violet theme)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Map definition: present, named, well-formed axis-aligned path enters off-left, exits off-right.
    const def = await page.evaluate(() => {
      const m = MAPS.nexus;
      const pts = m && m.pts;
      let axisAligned = !!pts && pts.length >= 4;
      if (pts) for (let i = 0; i < pts.length - 1; i++) {
        const sameX = pts[i][0] === pts[i + 1][0], sameY = pts[i][1] === pts[i + 1][1];
        if (sameX === sameY) { axisAligned = false; break; }   // both same (zero-len) or neither (diagonal)
      }
      const inBounds = !!pts && pts.every(([x, y]) => x >= -40 && x <= 940 && y >= 0 && y <= 560);
      return {
        exists: !!m, named: !!m && typeof m.name === 'string' && m.name.length > 0,
        hasPath: Array.isArray(pts), axisAligned, inBounds,
        entersLeft: !!pts && pts[0][0] === -30, exitsRight: !!pts && pts[pts.length - 1][0] === 930,
        notLast: Object.keys(MAPS).indexOf('nexus') < Object.keys(MAPS).indexOf('mayhem'),
      };
    });
    check('Nexus map exists and is named', def.exists && def.named);
    check('Nexus has an axis-aligned path (no diagonals/zero-length segs)', def.axisAligned);
    check('Nexus path stays within the board', def.inBounds);
    check('Nexus path enters off-left (-30) and exits off-right (930)', def.entersLeft && def.exitsRight);
    check('Nexus sits before Mayhem in the map order', def.notLast);

    // Theme: Violet palette exists and is the map's fixed identity.
    const theme = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'nexus'; diffKey = 'normal';
      const fixed = MAP_THEME.nexus;
      const hasPalette = !!THEMES.violet && typeof THEMES.violet.glow === 'string';
      const inCampaignPool = CAMPAIGN_THEMES.includes('violet');
      const picks = pickMapTheme();              // quick-mode nexus -> fixed violet
      beginGame();
      const resolved = mapTheme;                 // resetState() set it via pickMapTheme()
      const pal = mapPalette();                  // concrete palette for the frame
      const ok = pal && pal.glow === THEMES.violet.glow;
      backToMenu(); localStorage.removeItem('cd_save');
      return { fixed, hasPalette, inCampaignPool, picks, resolved, ok };
    });
    check('Violet theme palette exists', theme.hasPalette);
    check('Nexus maps to the Violet theme', theme.fixed === 'violet' && theme.picks === 'violet');
    check('Violet is available to the campaign palette pool', theme.inCampaignPool);
    check('a Nexus run resolves to the Violet palette', theme.resolved === 'violet' && theme.ok);

    // The map appears as a selectable button on the start screen.
    const btn = await page.evaluate(() => {
      renderStartScreen();
      return /Nexus/.test(document.getElementById('mapRow').innerHTML);
    });
    check('Nexus appears in the start-screen map selector', btn);

    // The path genuinely crosses itself (the convergence identity): the long vertical run at
    // x=450 and the long horizontal run at y=280 intersect at the central point (450,280).
    const crosses = await page.evaluate(() => {
      const pts = MAPS.nexus.pts;
      const onSeg = (a, b, px, py) => {
        if (a[0] === b[0]) return a[0] === px && py >= Math.min(a[1], b[1]) && py <= Math.max(a[1], b[1]);
        return a[1] === py && px >= Math.min(a[0], b[0]) && px <= Math.max(a[0], b[0]);
      };
      let hits = 0;
      for (let i = 0; i < pts.length - 1; i++) if (onSeg(pts[i], pts[i + 1], 450, 280)) hits++;
      return hits;
    });
    check('Nexus path crosses itself at the central convergence (450,280)', crosses >= 2, 'hits=' + crosses);

    // A real run drives to completion on the new path (pathing/spawning work, no hang).
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'nexus'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const pathOk = pathLen > 1000 && Array.isArray(waypoints) && waypoints === MAPS.nexus.pts;
      __cdGodTowers(8);
      __cdDrive({ maxWave: 6 });
      const out = { reached: wave >= 5, wave, pathOk };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Nexus buildPath wires the static path', drove.pathOk, JSON.stringify(drove));
    check('a Nexus run drives clean to wave 5+', drove.reached, JSON.stringify(drove));

    // Records: a finished quick run logs a per-map best under cd_best_nexus_<diff>,
    // and the map validates on save/resume (loadRun accepts MAPS[mapKey]).
    const rec = await page.evaluate(() => {
      localStorage.removeItem('cd_best_nexus_hard');
      gameMode = 'quick'; mapKey = 'nexus'; diffKey = 'hard';
      beginGame();
      best = 0; wave = 9; lives = 0;
      endGame();
      const mapBest = +(localStorage.getItem('cd_best_nexus_hard') || 0);

      // save/resume round-trip on the static map
      gameMode = 'quick'; mapKey = 'nexus'; diffKey = 'normal';
      beginGame(); wave = 3;
      saveRun();
      const loaded = loadRun();
      const restored = loaded === true && mapKey === 'nexus';

      ['cd_best_nexus_hard', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { mapBest, restored };
    });
    check('Nexus records a per-map best (hard = 9)', rec.mapBest === 9, JSON.stringify(rec));
    check('Nexus save/resume round-trips', rec.restored, JSON.stringify(rec));

    check('no console errors during Nexus map test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [106] Bastion Surge wave mod — converts basic enemies into splash-resistant bastions (v1.99.0)
  console.log('\n[106] Bastion Surge (splash-resist wave mod)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      const hasMod = WAVE_MODS.some(m => m.id === 'bastions');
      const setMod = id => { waveMod = WAVE_MODS.find(m => m.id === id) || null; };

      // Baseline (no mod) bastion count for a wave-10 wave (no natural bastions until w14).
      setMod(null);
      const plainWave = buildWave(10);
      const plainBastions = plainWave.filter(e => e.kind === 'bastion').length;

      // BASTION SURGE — a fraction of basic enemies become bastions, so the wave has MORE.
      setMod('bastions');
      const surgeWave = buildWave(10);
      const surgeBastions = surgeWave.filter(e => e.kind === 'bastion').length;
      const moreBastions = surgeBastions > plainBastions;
      // Converted bastions carry full bastion stats (aoeResist, maxHp set, slate colour, radius 14).
      const conv = surgeWave.find(e => e.kind === 'bastion');
      const wellFormed = !!conv && conv.aoeResist === true && conv.maxHp === conv.hp &&
                         conv.color === '#7a86c8' && conv.r === 14;
      // Conversion not addition: total wave length unchanged, special kinds untouched.
      const sameLength = surgeWave.length === plainWave.length;
      const fastUntouched = surgeWave.filter(e => e.kind === 'fast').length ===
                            plainWave.filter(e => e.kind === 'fast').length;
      // Inert when the mod is off.
      setMod(null);
      const inertOff = buildWave(10).filter(e => e.kind === 'bastion').length === plainBastions;

      // A converted bastion takes HALF the Cannon/Mortar splash of a norm at the same point.
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0; projectiles.length = 0;
      autoStartTimer = -1; waveActive = false;
      const pt = pointAt(pathLen * 0.4);
      const mk = (kind, extra = {}) => ({ kind, hp:1000, maxHp:1000, spd:1, r:12, bounty:1,
        color:'#fff', armor:0, gap:0, dist:pathLen*0.4, x:pt.x, y:pt.y, slow:0, slowF:0.6,
        frozen:0, poison:null, flash:0, px:0, py:0, ...extra });
      const bBomb = mk('bastion', { aoeResist:true }), nBomb = mk('norm');
      enemies.push(bBomb, nBomb);
      hitEnemy({ kind:'bomb', target:{ x:pt.x, y:pt.y }, dmg:100, src:null, ignoreArmor:false });
      const splashHalved = Math.abs((1000 - bBomb.hp) - 50) < 0.01 && Math.abs((1000 - nBomb.hp) - 100) < 0.01;
      enemies.length = 0;

      waveMod = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { hasMod, moreBastions, wellFormed, sameLength, fastUntouched, inertOff, splashHalved,
               plainBastions, surgeBastions };
    });
    check('WAVE_MODS includes Bastion Surge', r.hasMod);
    check('Bastion Surge adds bastions to the wave', r.moreBastions, `${r.plainBastions}->${r.surgeBastions}`);
    check('converted bastions are well-formed (aoeResist/maxHp/colour/radius)', r.wellFormed);
    check('Bastion Surge converts (does not lengthen) the wave', r.sameLength);
    check('Bastion Surge leaves the special kinds untouched', r.fastUntouched);
    check('Bastion Surge is inert when the mod is off', r.inertOff);
    check('a converted bastion takes half splash damage (norm full)', r.splashHalved);
    check('no console errors during Bastion Surge test', consoleErrors.length === 0, consoleErrors.join(' | '));

    // A real Mayhem run still drives to completion with the mod in the pool — no hang.
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'mayhem'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      __cdGodTowers(8);
      const res = __cdDrive({ maxWave: 8 });
      const out = { reached: wave >= 7, wave };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Mayhem run with Bastion Surge in the pool drives without hanging', drove.reached, 'wave=' + drove.wave);
    await page.close();
  }

  // [107] Tower veterancy — cosmetic kill-milestone ranks (v1.100.0)
  console.log('\n[107] Tower veterancy (kill-rank cosmetics)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // Helper math: tiers map to the documented thresholds, monotonic, clamps.
      const exists = typeof towerRankTier === 'function' && typeof towerRank === 'function' &&
                     Array.isArray(TOWER_RANKS) && TOWER_RANKS.length === 5;
      const thresholds = towerRankTier(0) === 0 && towerRankTier(14) === 0 && towerRankTier(15) === 1 &&
                         towerRankTier(39) === 1 && towerRankTier(40) === 2 && towerRankTier(89) === 2 &&
                         towerRankTier(90) === 3 && towerRankTier(199) === 3 && towerRankTier(200) === 4 &&
                         towerRankTier(99999) === 4;
      const names = towerRank(0).name === 'Rookie' && towerRank(15).name === 'Veteran' &&
                    towerRank(90).name === 'Ace' && towerRank(200).name === 'Legend';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // A kill that crosses a threshold promotes the tower (rankFlash set) exactly once.
      enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0;
      const tw = { type:'gun', x:100, y:100, range:99999, dmg:1e9, rate:0.05, cd:0, level:1,
        baseCost:50, invested:50, angle:0, mode:'first', spec:null, dealt:0, kills:14, buffPower:0.25, flash:0 };
      towers.length = 0; towers.push(tw);
      const mkE = () => ({ kind:'norm', hp:1, maxHp:50, spd:1, r:12, bounty:1, color:'#fff', armor:0,
        gap:0, dist:50, x:100, y:100, slow:0, slowF:0.6, frozen:0, poison:null, flash:0, px:0, py:0, dead:false });
      const dmgBefore = effDmg(tw);
      const e1 = mkE(); enemies.push(e1);
      damage(e1, 9999, tw);                 // 14 -> 15 kills: promotes to Veteran
      const promoted = tw.kills === 15 && towerRankTier(tw.kills) === 1 && tw.rankFlash > 0;
      // Cosmetic only: the tower's effective damage is unchanged by ranking up.
      const noStatChange = Math.abs(effDmg(tw) - dmgBefore) < 1e-6;
      // A further kill that does NOT cross a threshold doesn't re-fire the promotion flash.
      tw.rankFlash = 0;
      const e2 = mkE(); enemies.push(e2);
      damage(e2, 9999, tw);                 // 15 -> 16: no new tier
      const noRefire = tw.kills === 16 && tw.rankFlash === 0;
      enemies.length = 0;

      backToMenu(); localStorage.removeItem('cd_save');
      return { exists, thresholds, names, promoted, noStatChange, noRefire };
    });
    check('TOWER_RANKS + towerRank helpers exist (5 tiers)', r.exists);
    check('rank thresholds map correctly (0/15/40/90/200)', r.thresholds);
    check('rank names resolve (Rookie/Veteran/Ace/Legend)', r.names);
    check('a milestone kill promotes the tower (rankFlash fires)', r.promoted);
    check('veterancy is cosmetic — effDmg unchanged by rank', r.noStatChange);
    check('a non-milestone kill does not re-fire the promotion', r.noRefire);

    // Ranks derive from saved kill counts → survive a save/resume round-trip.
    const rt = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      towers.push({ type:'gun', x:120, y:120, range:120, dmg:10, rate:0.5, cd:0, level:3,
        baseCost:50, invested:120, angle:0, mode:'first', spec:null, dealt:500, kills:120, buffPower:0.25, flash:0 });
      wave = 4; saveRun();
      resetState();
      const loaded = loadRun();
      const t = towers[0];
      const out = { loaded, kills: t ? t.kills : -1, tier: t ? towerRankTier(t.kills) : -1 };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('tower rank survives save/resume (kills restored → Ace)',
      rt.loaded && rt.kills === 120 && rt.tier === 3, JSON.stringify(rt));
    check('no console errors during veterancy test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [108] Ability bar bug fixes (v1.100.1): Gold Rush locked until waves start (no pre-game
  // gold farming); Barrier charges fade after BARRIER_DURATION instead of lasting forever.
  console.log('\n[108] Ability bar bug fixes (gold-rush gate + barrier fade)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // --- Gold Rush gate: before wave 1 (wave===0) it does nothing ---
      const preWave = wave === 0;
      abilityCd.rush = 0;
      const goldBefore = gold;
      triggerAbility('rush');
      const gatedNoGold = gold === goldBefore;        // no gold injected pre-wave
      const gatedNoCd   = abilityCd.rush === 0;        // didn't even go on cooldown

      // --- once a wave has started it works as before ---
      startWave();                                     // wave -> 1
      const waveStarted = wave >= 1;
      abilityCd.rush = 0;
      const goldBefore2 = gold;
      triggerAbility('rush');
      const worksAfter = gold > goldBefore2 && abilityCd.rush > 0;

      // --- Barrier fade: charges expire after BARRIER_DURATION seconds ---
      // quiesce the sim so nothing spawns / auto-starts and consumes a charge during the loop
      enemies.length = 0; spawners.length = 0; autoWave = false; autoStartTimer = -1; waveActive = false;
      abilityCd.barrier = 0;
      triggerAbility('barrier');
      const banked = barrierCharges === 3 && barrierTimer > 0 && barrierTimer <= BARRIER_DURATION;
      // advance time past the duration (1s ticks); charges should clear at 0
      for (let i = 0; i < BARRIER_DURATION + 2; i++) update(1);
      const faded = barrierCharges === 0 && barrierTimer === 0;

      // --- a fresh cast re-arms the timer; charges persist while it has time left ---
      abilityCd.barrier = 0;
      triggerAbility('barrier');
      update(1);                                       // 1s elapsed, still well within duration
      const survivesShort = barrierCharges === 3 && barrierTimer > 0;

      // --- run-only: barrierTimer is never serialized ---
      barrierCharges = 2; barrierTimer = 10; saveRun();
      const savedStr = localStorage.getItem('cd_save');
      const notSaved = savedStr ? !('barrierTimer' in JSON.parse(savedStr)) : true;
      loadRun();
      const resetOnLoad = barrierTimer === 0 && barrierCharges === 0;

      enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { preWave, gatedNoGold, gatedNoCd, waveStarted, worksAfter,
               banked, faded, survivesShort, notSaved, resetOnLoad };
    });
    check('before wave 1, Gold Rush injects no gold', r.gatedNoGold);
    check('before wave 1, Gold Rush does not go on cooldown', r.gatedNoCd);
    check('after a wave starts, Gold Rush works again', r.waveStarted && r.worksAfter);
    check('Barrier banks 3 charges + arms a fade timer', r.banked);
    check('Barrier charges fade to 0 after BARRIER_DURATION', r.faded);
    check('Barrier charges survive a short interval (timer still > 0)', r.survivesShort);
    check('barrierTimer is never serialized into cd_save', r.notSaved);
    check('barrierTimer + charges reset to 0 on resume (run-only)', r.resetOnLoad);
    check('no console errors during ability-bar bugfix test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [109] v2.0.0 release bundle — Nightmare difficulty, quick-mode late-scale on hard/nightmare,
  // Railgun Penetrator nerf, campaign auto-level-select. (Breacher 2→3 covered by [74]/[88].)
  console.log('\n[109] v2.0.0 release (Nightmare + late-scale + rail nerf + campaign auto-select)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // --- Railgun Penetrator now ×1.20 (was 1.35) ---
    const rail = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const base = { type:'rail', dmg:36, spec:null, buffPower:0, level:1 };
      const pen  = { type:'rail', dmg:36, spec:'railpen', buffPower:0, level:1 };
      const ratio = effDmg(pen) / effDmg(base);
      backToMenu(); localStorage.removeItem('cd_save');
      return { ratio };
    });
    check('Railgun Penetrator is now +20% (×1.20), not +35%', Math.abs(rail.ratio - 1.20) < 1e-6, 'ratio=' + rail.ratio);

    // --- 🌑 Nightmare difficulty entry + ordering ---
    const nm = await page.evaluate(() => {
      const d = DIFFS.nightmare;
      return {
        exists: !!d,
        // v2.12.0 "Nightmare ~2× harder" pass: hp 1.7→2.5, lives 8→7, gold 90→75, bounty 0.85→0.68.
        stats: !!d && d.hp === 2.5 && d.lives === 7 && d.gold === 75 && d.bounty === 0.68 && d.chipMult === 2.2,
        harderThanHard: !!d && d.hp > DIFFS.hard.hp && d.lives < DIFFS.hard.lives,
        topChip: !!d && d.chipMult === Math.max(...Object.values(DIFFS).map(x => x.chipMult)),
      };
    });
    check('Nightmare difficulty entry exists', nm.exists);
    check('Nightmare stats (hp 2.5 / lives 7 / gold 75 / bounty 0.68 / chip 2.2×)', nm.stats);
    check('Nightmare is harder than Hard (more HP, fewer lives)', nm.harderThanHard);
    check('Nightmare pays the top chip multiplier', nm.topChip);

    // --- Quick-mode late-scale: ramps + caps on hard/nightmare, leaves Normal & Campaign alone ---
    const ls = await page.evaluate(() => {
      const base = (w, dh) => (18 + w*7 + 1.25 * Math.pow(w, 1.9)) * 1.80 * dh;
      gameMode = 'quick'; campLevel = 1;
      diffKey = 'normal';
      const normalNoScale = Math.abs(enemyTemplate(30).hp - base(30, DIFFS.normal.hp)) < 1e-6;
      diffKey = 'hard';
      const hardBelow = Math.abs(enemyTemplate(10).hp - base(10, DIFFS.hard.hp)) < 1e-6; // w10 < threshold 15
      const hardW30 = enemyTemplate(30).hp / base(30, DIFFS.hard.hp);   // 1 + min(.25,(30-15)*.015)=1.225
      const hardCap = enemyTemplate(60).hp / base(60, DIFFS.hard.hp);   // capped at 1.25
      diffKey = 'nightmare';
      const nightW30 = enemyTemplate(30).hp / base(30, DIFFS.nightmare.hp); // 1 + min(.80,(30-10)*.03)=1.60
      const nightCap = enemyTemplate(60).hp / base(60, DIFFS.nightmare.hp); // capped at 1.80
      // Campaign is deliberately exempt (gated to gameMode==='quick'); campLevel 1 → campScale 1.
      gameMode = 'campaign'; diffKey = 'hard';
      const campaignExempt = Math.abs(enemyTemplate(30).hp - base(30, DIFFS.hard.hp)) < 1e-6;
      gameMode = 'quick'; diffKey = 'normal';
      return { normalNoScale, hardBelow, hardW30, hardCap, nightW30, nightCap, campaignExempt };
    });
    check('Normal HP is unchanged by late-scale (test-[16] invariant safe)', ls.normalNoScale);
    check('Hard late-scale is inert below the wave threshold (w10)', ls.hardBelow);
    check('Hard ramps to +22.5% at w30', Math.abs(ls.hardW30 - 1.225) < 1e-6, 'r=' + ls.hardW30);
    check('Hard late-scale caps at +25%', Math.abs(ls.hardCap - 1.25) < 1e-6, 'r=' + ls.hardCap);
    check('Nightmare ramps harder (+60% at w30)', Math.abs(ls.nightW30 - 1.60) < 1e-6, 'r=' + ls.nightW30);
    check('Nightmare late-scale caps at +80%', Math.abs(ls.nightCap - 1.80) < 1e-6, 'r=' + ls.nightCap);
    check('Campaign is exempt from the quick late-scale', ls.campaignExempt);

    // --- v2.12.0 "~2× harder" intent: difficulty index (total wave HP / total run income) ---
    // Locks the design goal so a future run can't silently soften Nightmare back toward Hard.
    const idx = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; campLevel = 1;
      const indexOf = (dk) => {
        diffKey = dk;
        let totHP = 0, totBounty = 0;
        for (let w = 1; w <= 30; w++) for (const e of buildWave(w)) { totHP += e.maxHp || e.hp; totBounty += e.bounty || 0; }
        return totHP / (totBounty + DIFFS[dk].gold);
      };
      const nmI = indexOf('nightmare'), hdI = indexOf('hard');
      diffKey = 'normal';
      return { ratio: nmI / hdI, nmI };
    });
    // Nightmare was ~1.55× Hard's index pre-v2.12.0; the ~2× pass lifts it to ≈2.9×.
    check('Nightmare difficulty index is now ≈2.9× Hard (~2× harder pass)', idx.ratio > 2.5,
      'ratio=' + idx.ratio.toFixed(2));

    // --- Nightmare win grants 🌑 Nightmare Walker + counts as a Hard win ---
    const ach = await page.evaluate(() => {
      meta.achievements = {};
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'nightmare'; campLevel = 1;
      beginGame();
      wave = victoryWave();
      towers.push({ type: 'gun', dealt: 500, kills: 10 });
      const got = grantAchievements(true);
      const out = { nm: got.some(a => a.id === 'nightmare_win'), hard: !!meta.achievements.hard_win };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('a Nightmare win grants 🌑 Nightmare Walker', ach.nm);
    check('a Nightmare win also grants No Mercy (hard_win)', ach.hard);

    // --- Campaign auto-level-select: mode-switch + back-to-menu after a win ---
    const camp = await page.evaluate(() => {
      localStorage.setItem('cd_campaign', '3');   // pretend levels 1-3 are cleared
      // (a) clicking the Campaign mode button jumps to the next un-cleared level (4)
      gameMode = 'quick'; campLevel = 1;
      renderStartScreen();
      const modeBtns = document.getElementById('modeRow').children;
      modeBtns[2].click();   // the Campaign mode button (Quick / Endless / Campaign)
      const modeSwitchSelectsNext = campLevel === 4;
      // (b) finishing level 4 and returning to the menu auto-advances to 5
      localStorage.setItem('cd_campaign', '4');
      gameMode = 'campaign'; campLevel = 4; victory = true; started = true;
      backToMenu();
      const backAdvances = campLevel === 5;
      // (c) a DEFEAT (victory false) does NOT advance
      localStorage.setItem('cd_campaign', '4');
      gameMode = 'campaign'; campLevel = 4; victory = false; started = true;
      backToMenu();
      const lossKeepsLevel = campLevel === 4;
      localStorage.removeItem('cd_campaign'); localStorage.removeItem('cd_save');
      return { modeSwitchSelectsNext, backAdvances, lossKeepsLevel };
    });
    check('clicking Campaign selects the next un-cleared level', camp.modeSwitchSelectsNext);
    check('winning a level + back-to-menu auto-advances the selection', camp.backAdvances);
    check('a campaign defeat keeps the current level selected', camp.lossKeepsLevel);

    check('no console errors during v2.0.0 release test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [110] Balance invariants — a difficulty FLOOR (no defense always loses) and a
  // CEILING (a maxed defense can always win), so future balance tweaks can't drift
  // the game into "trivially easy" or "literally impossible". Bounds, not exact
  // outcomes — both scenarios have enormous margins so randomness can't flip them.
  console.log('\n[110] Balance invariants (difficulty floor & ceiling)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // --- FLOOR: with ZERO towers, a quick run must LOSE well before victory. ---
    const floorNormal = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();                       // lives come from the difficulty (small)
      // No towers placed: every enemy leaks. Drive to the end (it ends in defeat).
      const r = __cdDrive({ maxWave: 9999 });
      const out = { gameOver: r.gameOver, victory: r.victory, lives: r.lives, wave: r.wave, vw: victoryWave() };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('difficulty floor: zero-tower normal run loses',
      floorNormal.gameOver && !floorNormal.victory, JSON.stringify(floorNormal));
    check('difficulty floor: zero-tower normal run dies early (well before victory wave)',
      floorNormal.lives <= 0 && floorNormal.wave < 10 && floorNormal.wave < floorNormal.vw,
      JSON.stringify(floorNormal));

    const floorHard = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; campLevel = 1;
      beginGame();
      const r = __cdDrive({ maxWave: 9999 });
      const out = { gameOver: r.gameOver, victory: r.victory, lives: r.lives, wave: r.wave, vw: victoryWave() };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('difficulty floor: zero-tower hard run loses',
      floorHard.gameOver && !floorHard.victory, JSON.stringify(floorHard));
    check('difficulty floor: zero-tower hard run dies early (well before victory wave)',
      floorHard.lives <= 0 && floorHard.wave < 10 && floorHard.wave < floorHard.vw,
      JSON.stringify(floorHard));

    // --- CEILING: a maxed (god-tower) defense must always be able to WIN. ---
    const ceilNormal = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      gold = 1e9; lives = 99999;          // generous: isolate "can the board clear waves?"
      __cdGodTowers(12);
      const r = __cdDrive({ maxWave: 9999 });
      const out = { victory: r.victory, wave: r.wave, hitCap: r.hitCap, vw: victoryWave() };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('difficulty ceiling: god-tower normal run wins',
      ceilNormal.victory === true && ceilNormal.wave === ceilNormal.vw && !ceilNormal.hitCap,
      JSON.stringify(ceilNormal));

    const ceilHard = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; campLevel = 1;
      beginGame();
      gold = 1e9; lives = 99999;
      __cdGodTowers(12);
      const r = __cdDrive({ maxWave: 9999 });
      const out = { victory: r.victory, wave: r.wave, hitCap: r.hitCap, vw: victoryWave() };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('difficulty ceiling: god-tower hard run wins',
      ceilHard.victory === true && ceilHard.wave === ceilHard.vw && !ceilHard.hitCap,
      JSON.stringify(ceilHard));

    check('no console errors during balance-invariants test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [111] Performance guardrail — catch creeping slowness / quadratic blowups /
  // unbounded entity growth as features accumulate. Builds a HEAVY but realistic
  // state (many god towers driven to a deep wave) then runs a measured update+draw
  // loop. Two assertions: a STRUCTURAL bound on the entity arrays (CPU-independent,
  // the robust core) and a GENEROUS wall-clock budget (catches only a true blowup).
  console.log('\n[111] Performance guardrail (frame budget + bounded entities)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const perf = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'hard'; campLevel = 1;
      beginGame();
      gold = 1e9; lives = 99999;
      __cdGodTowers(36);                 // a heavy board (~36 towers)
      // Drive deep so many waves are concurrently in flight (lots of enemies/projectiles/particles).
      __cdDrive({ maxWave: 22 });
      // Keep spawning pressure high during the measured loop: queue several waves.
      autoWave = false;
      for (let i = 0; i < 3 && (wave - lastSettledWave) < (typeof MAX_CONCURRENT_WAVES === 'number' ? MAX_CONCURRENT_WAVES : 3); i++) {
        if (!gameOver) startWave();
      }

      const ITER = 600;
      let maxEnt = 0;
      const t0 = performance.now();
      for (let i = 0; i < ITER; i++) {
        update(1 / 60);
        draw();
        if (draftOpen) {               // auto-dismiss drafts so the loop keeps running
          const card = document.getElementById('draftCards').children[0];
          if (card) card.click(); else draftOpen = false;
        }
        if (!waveActive && !gameOver) startWave();   // keep the field busy
        const ent = enemies.length + projectiles.length + particles.length + beams.length + floaters.length;
        if (ent > maxEnt) maxEnt = ent;
      }
      const t1 = performance.now();
      const avgMs = (t1 - t0) / ITER;

      const out = {
        avgMs, maxEnt,
        enemies: enemies.length, projectiles: projectiles.length,
        particles: particles.length, beams: beams.length, floaters: floaters.length,
        wave,
      };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });

    console.log(`     [111] observed avg frame = ${perf.avgMs.toFixed(3)}ms, max entities = ${perf.maxEnt} (final wave ${perf.wave})`);

    // (a) STRUCTURAL — entity arrays stay bounded (catches leaks/runaway spawning
    //     regardless of CPU speed). A healthy deep wave peaks in the low hundreds;
    //     5000 is a vast, regression-only ceiling.
    check('perf: entity arrays stay bounded under heavy load (max < 5000)',
      perf.maxEnt < 5000, 'maxEnt=' + perf.maxEnt);

    // (b) WALL-CLOCK budget. Real-time is 16.7ms/frame. Observed local avg ≈ a few ms
    //     for update+draw on this heavy board; CI machines are slower. Per the CI lesson,
    //     the ceiling is a generous hard-coded constant (>= ~50ms, and well above 5× the
    //     local observation) so it only ever trips on a true catastrophic blowup.
    const FRAME_BUDGET_MS = 60;          // generous: ~3.6× real-time, >> observed local avg (a few ms)
    check(`perf: avg update+draw frame under budget (${FRAME_BUDGET_MS}ms)`,
      perf.avgMs < FRAME_BUDGET_MS, `avgMs=${perf.avgMs.toFixed(3)} budget=${FRAME_BUDGET_MS}`);

    check('no console errors during performance guardrail test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [112] Utility-toolbar accent tiles — the six secondary buttons are cohesive dark
  // tiles with a per-button accent rail (--acc) instead of clashing solid fills (v2.0.2,
  // menu-revamp slice 8). Asserts: each util button carries an --acc custom property +
  // a uniform dark base (NOT the old purple/amber solid fills) + a left accent border;
  // the .startUtil-last-child invariant survives.
  console.log('\n[112] Utility-toolbar accent tiles (menu-revamp slice 8)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.startUtil .ctl')];
      const accs = btns.map(b => getComputedStyle(b).getPropertyValue('--acc').trim());
      const first = btns[0];
      const cs = getComputedStyle(first);
      return {
        count: btns.length,
        allHaveAcc: accs.length > 0 && accs.every(a => a.length > 0),
        // Talents tile is no longer the old solid purple rgb(110,64,201).
        notOldPurple: cs.backgroundColor !== 'rgb(110, 64, 201)',
        // a left accent rail thicker than the rest of the border
        leftBorder: parseFloat(cs.borderLeftWidth) >= 3,
        // the left border colour resolves to the tile's accent (purple a371f7)
        leftIsAccent: cs.borderLeftColor === 'rgb(163, 113, 247)',
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
        // load-bearing ids still present after the markup tweak
        ids: ['chipsBtn','achBtn','resetBtn','wnBtn'].every(id => document.getElementById(id)),
      };
    });
    check('all six util buttons carry an --acc accent property', d.allHaveAcc && d.count === 6, `count=${d.count}`);
    check('util tiles use a uniform dark base, not the old solid purple fill', d.notOldPurple);
    check('util tiles show a left accent rail (≥3px)', d.leftBorder);
    check('util accent rail is coloured to its --acc (Talents purple)', d.leftIsAccent);
    check('.startUtil is still #startScreen last child (test [58] invariant)', d.lastChildUtil);
    check('load-bearing util ids survived the accent-tile restyle', d.ids);
    check('no console errors during accent-tile test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [113] Start-menu dashboard layout — desktop two-column grid (config card left, a
  // right rail stacking play actions over the utility panel) so the menu fits the board
  // with ▶ PLAY on-screen (v2.1.0, menu-revamp slice 9 / the "full revamp"). Asserts the
  // structural dashboard properties (font-metric-independent — strict no-overflow is NOT
  // asserted, since on different fonts the config card can wrap one extra row and the menu
  // gracefully scrolls): desktop uses CSS grid with a VERTICAL util rail and play above
  // util; the DOM-order invariants (hero first, util last) survive; phones stay non-grid
  // with the util toolbar as a horizontal row (their own fixed/scroll layout, untouched).
  console.log('\n[113] Start-menu dashboard layout (menu-revamp slice 9)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const ss = document.getElementById('startScreen');
      const play = document.querySelector('.startPlay');
      const util = document.querySelector('.startUtil');
      return {
        grid: getComputedStyle(ss).display === 'grid',
        utilColumn: getComputedStyle(util).flexDirection === 'column',
        playAboveUtil: Math.round(play.getBoundingClientRect().top) < Math.round(util.getBoundingClientRect().top),
        firstChildHero: document.querySelector('#startScreen > div:first-child').classList.contains('startHero'),
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
        // the rail stays inside the board horizontally
        utilFits: Math.round(util.getBoundingClientRect().right) <= Math.round(document.getElementById('game').getBoundingClientRect().right) + 1,
        ids: ['resumeBtn','dailyBtn','resetBtn','chipsBtn','achBtn'].every(id => document.getElementById(id)),
        talentOpener: !!document.querySelector('#startScreen [onclick="openTalents()"]'),
      };
    });
    // Phone viewport — desktop grid must NOT apply; util stays a horizontal row in the
    // mobile flow, last child invariant holds, no horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await page.evaluate(() => {
      const ss = document.getElementById('startScreen');
      const util = document.querySelector('.startUtil');
      return {
        notGrid: getComputedStyle(ss).display !== 'grid',
        utilRow: getComputedStyle(util).flexDirection === 'row',
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      };
    });
    check('desktop start menu uses a CSS grid dashboard layout', d.grid);
    check('utility toolbar is a vertical rail on desktop', d.utilColumn);
    check('play actions sit above the utility rail (test [58] invariant)', d.playAboveUtil);
    check('hero is still the first child of #startScreen', d.firstChildHero);
    check('utility toolbar is still #startScreen last child (test [58] invariant)', d.lastChildUtil);
    check('utility rail fits inside the board horizontally', d.utilFits);
    check('load-bearing button ids survived the dashboard layout', d.ids);
    check('Talents opener (onclick) preserved for a11y lookup', d.talentOpener);
    check('phone: start menu does NOT use the desktop grid', m.notGrid);
    check('phone: utility toolbar stays a horizontal row', m.utilRow);
    check('phone: utility toolbar is still the last child', m.lastChildUtil);
    check('phone: no horizontal overflow with the dashboard layout', m.noOverflow);
    check('no console errors during dashboard layout test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [114] Conduit boss archetype — the 12th: shielded by nearby escorts, takes −14% damage
  // per linked add (cap −70% at 5); clear the adds (or freeze it) to break the link (v2.2.0)
  console.log('\n[114] Conduit boss (escort-shield archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // 12th archetype: appears at w75 (after revenant at w70). Warper (13th) follows at w80 and
      // fortifier (14th) at w85, so the rotation now wraps at w90 → regen.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(75) === 'conduit';
      const wrapsAt80 = bt(80) === 'warper' && bt(85) === 'fortifier';
      const archCount = BOSS_ARCHETYPES.length;

      const sp = pointAt(60);
      const farP = pointAt(600);
      const mkBoss = () => ({ kind:'boss', bossType:'conduit', hp:5000, maxHp:5000, spd:0, r:24,
        bounty:100, color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });
      // escorts must carry explicit x/y — update() sets x/y per-enemy mid-loop, so the conduit's
      // frame-1 distance check reads their pre-update coords (aura-test gotcha).
      const mkAdd = (atFar) => ({ kind:'norm', hp:200, maxHp:200, spd:0, r:11, bounty:2, color:'#3fb950',
        armor:0, gap:0.8, dist: atFar ? 600 : 60, x: atFar ? farP.x : sp.x, y: atFar ? farP.y : sp.y,
        px: atFar ? farP.x : sp.x, py: atFar ? farP.y : sp.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0 });

      // (A) damage() math in isolation — reduction = 1 − 0.14·guard.
      const dropFor = (guard) => {
        enemies.length = 0; projectiles.length = 0; towers.length = 0;
        const b = mkBoss(); b.conduitGuard = guard; enemies.push(b);
        const before = b.hp; damage(b, 1000, null); return before - b.hp;
      };
      const dropG0 = dropFor(0);   // 1000
      const dropG3 = dropFor(3);   // 580
      const dropG5 = dropFor(5);   // 300
      const mathOk = Math.abs(dropG0 - 1000) < 1e-6 && Math.abs(dropG3 - 580) < 1e-6 && Math.abs(dropG5 - 300) < 1e-6;

      // (B) update() tick computes guard from nearby alive escorts (3 near + 1 far → guard 3).
      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      const boss = mkBoss(); enemies.push(boss);
      enemies.push(mkAdd(false), mkAdd(false), mkAdd(false), mkAdd(true));
      update(1/60);
      const guardCounts3 = boss.conduitGuard === 3;

      // (C) cap at 5 — 7 near escorts → guard caps at 5.
      enemies.length = 0; pendingSpawns.length = 0;
      const boss2 = mkBoss(); enemies.push(boss2);
      for (let i = 0; i < 7; i++) enemies.push(mkAdd(false));
      update(1/60);
      const guardCaps5 = boss2.conduitGuard === 5;

      // (D) clear the adds → next tick the shield drops to 0 → full damage again.
      enemies.length = 0; enemies.push(boss2);   // keep only the boss
      update(1/60);
      const guardClears = boss2.conduitGuard === 0;

      // (E) a frozen conduit drops its shield even with escorts present (freeze counters it).
      enemies.length = 0; pendingSpawns.length = 0;
      const fb = mkBoss(); fb.frozen = 5; fb.conduitGuard = 4; enemies.push(fb);
      for (let i = 0; i < 5; i++) enemies.push(mkAdd(false));
      update(1/60);
      const frozenDropsShield = fb.conduitGuard === 0;
      const fbBefore = fb.hp; damage(fb, 1000, null);
      const frozenTakesFull = Math.abs((fbBefore - fb.hp) - 1000) < 1e-6;

      // (F) reduction never exceeds −70% (guard is capped at 5).
      const cappedReduction = dropG5 >= 300 - 1e-6;

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt80, archCount, mathOk, guardCounts3, guardCaps5,
               guardClears, frozenDropsShield, frozenTakesFull, cappedReduction };
    });
    check('conduit is the 12th archetype (w75)', r.inRotation && r.archCount === 16);
    check('warper follows conduit (w80), fortifier at w85', r.wrapsAt80);
    check('damage reduction is −14% per escort (guard 0/3/5 → 1000/580/300)', r.mathOk);
    check('update() tick counts nearby escorts as the shield (3 near, 1 far → 3)', r.guardCounts3);
    check('escort shield caps at 5 (7 near → guard 5)', r.guardCaps5);
    check('clearing the escorts drops the shield to 0', r.guardClears);
    check('a frozen conduit drops its shield (freeze counters it)', r.frozenDropsShield);
    check('a frozen conduit then takes full damage', r.frozenTakesFull);
    check('damage reduction never exceeds −70% (guard capped)', r.cappedReduction);
    check('no console errors during Conduit test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [115] Eagle Eye legendary perk — +40% firing range, booster aura untouched (v2.3.0)
  console.log('\n[115] Eagle Eye range legendary');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // perk exists in the pool and is legendary
      const def = PERKS.find(p => p.id === 'eagleeye');
      const inPool = !!def && def.rarity === 'legendary';

      // baseline (perk not held) -> apply -> +40% firing range
      perkState.rangeMult = 1;
      const rBase = effRange(gun);
      def.apply(perkState);
      const rPerk = effRange(gun);

      // damage is NOT affected (range-only, "too easy"-safe)
      perkState.rangeMult = 1;
      const dBase = effDmg(gun);
      def.apply(perkState);
      const dPerk = effDmg(gun);

      // stacks multiplicatively with Targeting Array (×1.4 × ×1.2 = ×1.68)
      perkState.rangeMult = 1;
      PERKS.find(p => p.id === 'optics').apply(perkState);   // ×1.2
      def.apply(perkState);                                  // ×1.4
      const rStacked = effRange(gun);
      const rStackBase = gun.range * metaRangeMult();
      const stacksOk = Math.abs(rStacked - rStackBase * 1.68) < 1e-6;

      // booster aura range (effBuffRange) is NOT affected by the perk
      perkState.rangeMult = 1.4;
      const booster = { type:'buff', x:400, y:300, level:1, spec:null, range:45, buffPower:0.25 };
      towers.push(booster);
      const buffRange = effBuffRange(booster);
      const buffExpected = booster.range; // mastery_buff rank 0 => ×1, rangeMult must not apply

      // resolveWildcard can roll Eagle Eye (un-taken legendary eligible)
      let wildcardCanRoll = false;
      runPerks.length = 0;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'eagleeye') wildcardCanRoll = true;
      }

      // save/restore round-trips the multiplier (reuses rangeMult — save-safe)
      perkState.rangeMult = 1.4;
      saveRun();
      perkState.rangeMult = 1; // clobber
      const loaded = loadRun();
      const restored = Math.abs(perkState.rangeMult - 1.4) < 1e-9;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, rBase, rPerk, dBase, dPerk, stacksOk, buffRange, buffExpected,
               wildcardCanRoll, loaded, restored };
    });
    check('Eagle Eye is a legendary perk in the pool', r.inPool);
    check('Eagle Eye gives +40% firing range', Math.abs(r.rPerk - r.rBase * 1.4) < 1e-6, `base=${r.rBase} perk=${r.rPerk}`);
    check('Eagle Eye leaves tower damage untouched (range-only)', Math.abs(r.dPerk - r.dBase) < 1e-6, `base=${r.dBase} perk=${r.dPerk}`);
    check('Eagle Eye stacks with Targeting Array (×1.68 range)', r.stacksOk);
    check('Eagle Eye leaves booster aura range untouched', Math.abs(r.buffRange - r.buffExpected) < 1e-6, `buff=${r.buffRange}`);
    check('resolveWildcard can roll Eagle Eye', r.wildcardCanRoll);
    check('save/reload round-trips the range multiplier', r.loaded === true && r.restored, JSON.stringify(r));
    check('no console errors during Eagle Eye test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [116] Herald enemy — haste-aura support enemy from wave 18+ (v2.4.0)
  console.log('\n[116] Herald enemy (haste aura)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();
      // (a) wave gating: none before w18, present from w18; HP ≈ template×1.25
      const w17 = buildWave(17).some(e => e.kind === 'herald');
      const w18list = buildWave(18).filter(e => e.kind === 'herald');
      const w18 = w18list.length;
      const t18 = enemyTemplate(18);
      const hpOk = w18list[0] ? Math.abs(w18list[0].maxHp - t18.hp * 1.25) < 0.01 : false;

      // (b) haste-aura behaviour: a herald tags a nearby enemy (sets hasted > 0); freeze pauses
      // it; another herald is NOT hasted (excluded). Co-locate at the herald's RESOLVED path point
      // (update() overwrites e.x/e.y from pointAt(dist) every tick — the aura x/y gotcha).
      const dp = pointAt(60);
      const mkEnemy = (kind, dist, frozen) => {
        const p = pointAt(dist);
        return { kind, hp:1000, maxHp:1000, spd:0, r:12, bounty:1, color:'#ff79c6', armor:0, gap:0.8,
          dist, x:p.x, y:p.y, px:p.x, py:p.y, slow:0, slowF:0.6, frozen: frozen ? 999 : 0,
          poison:null, flash:0, hasted:0 };
      };
      const auraRun = (heraldFrozen, victimKind, victimDist) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        const herald = mkEnemy('herald', 60, heraldFrozen);
        const victim = mkEnemy(victimKind, victimDist, false);
        enemies.push(herald, victim);
        let sawHaste = false;
        for (let i = 0; i < 60; i++) { update(1/60); if (victim.hasted > 0) sawHaste = true; }
        return sawHaste;
      };
      const hastesNearby   = auraRun(false, 'norm', 60);    // a nearby norm gets hasted
      const frozenNoHaste  = !auraRun(true,  'norm', 60);   // a frozen herald hastes nobody
      const heraldExcluded = !auraRun(false, 'herald', 60); // another herald is never hasted
      const outOfRangeSafe = !auraRun(false, 'norm', 600);  // beyond 90px → no haste

      // (c) the haste actually SPEEDS movement: a victim near a herald advances faster than alone.
      const moveRun = (withHerald) => {
        enemies.length = 0; projectiles.length = 0; pendingSpawns.length = 0; towers.length = 0;
        const victim = mkEnemy('norm', 60, false); victim.spd = 10;
        enemies.push(victim);
        if (withHerald) enemies.push(mkEnemy('herald', 60, false));
        for (let i = 0; i < 20; i++) update(1/60);
        return victim.dist;
      };
      const distAlone   = moveRun(false);
      const distHasted  = moveRun(true);
      const hasteSpeeds = distHasted > distAlone + 1e-6;
      enemies.length = 0; towers.length = 0;

      // (d) preview/render plumbing: composition + glyph + colour + HP mult all know it, and the
      // threat number stays in sync with the real buildWave() total at w18.
      const compHasHerald = waveComposition(18).some(c => c.kind === 'herald');
      const glyph = enemyGlyph({ kind:'herald', frozen:0 });
      const frozenGlyph = enemyGlyph({ kind:'herald', frozen:1 });   // frozen overrides to ❄
      const hasColor = !!PREVIEW_COLOR.herald;
      const hpMult = KIND_HP_MULT.herald;
      const threatOk = Math.abs(waveThreat(18) - buildWave(18).reduce((s,e)=>s+e.maxHp,0)) < 0.01;

      backToMenu();
      localStorage.removeItem('cd_save');

      // (e) integration: a real wave-18+ run with god towers still clears cleanly
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 999999; lives = 99999;
      __cdGodTowers(10);
      const run = __cdDrive({ maxWave: 20 });
      backToMenu();
      localStorage.removeItem('cd_save');

      return { w17, w18, hpOk, hastesNearby, frozenNoHaste, heraldExcluded, outOfRangeSafe,
               hasteSpeeds, compHasHerald, glyph, frozenGlyph, hasColor, hpMult, threatOk, run };
    });
    check('no heralds before wave 18', r.w17 === false);
    check('heralds spawn from wave 18', r.w18 >= 1, 'count=' + r.w18);
    check('herald HP is template×1.25', r.hpOk);
    check('a herald hastes a nearby enemy (hasted > 0)', r.hastesNearby);
    check('a frozen herald hastes nobody (freeze pauses it)', r.frozenNoHaste);
    check('a herald does NOT haste another herald (always killable)', r.heraldExcluded);
    check('an enemy beyond 90px is never hasted (local reach)', r.outOfRangeSafe);
    check('haste actually speeds the victim up vs alone', r.hasteSpeeds);
    check('waveComposition includes herald at wave 18', r.compHasHerald);
    check('enemyGlyph returns ⚑ for herald', r.glyph === '⚑', 'glyph=' + r.glyph);
    check('a frozen herald still shows the ❄ glyph (cosmetic)', r.frozenGlyph === '❄');
    check('PREVIEW_COLOR has a herald colour', r.hasColor);
    check('KIND_HP_MULT.herald is 1.25 (matches buildWave)', r.hpMult === 1.25, 'mult=' + r.hpMult);
    check('waveThreat stays in sync with buildWave at w18 (herald counted)', r.threatOk);
    check('wave-18+ run with heralds reaches w>=20 alive', r.run.wave >= 20 && !r.run.gameOver, JSON.stringify(r.run));
    check('no console errors during herald tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [117] Shock-ring effect — expanding cosmetic pulse on Shockwave / Meteor (v2.5.0)
  console.log('\n[117] Shock-ring effect (Shockwave / Meteor juice)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // (a) Shockwave emits rings when particles are on. resetState zeroed `rings`.
      particleDensity = 1;
      const startEmpty = rings.length === 0;
      abilityCd.shock = 0;
      triggerAbility('shock');
      const shockRings = rings.length;                       // two rings pushed
      const shapeOk = rings[0] && rings[0].maxR > 0 && rings[0].life > 0 &&
                      rings[0].maxLife === rings[0].life;     // life seeds maxLife for the fade

      // (b) Meteor emits a ring at its impact point
      rings.length = 0; abilityCd.meteor = 0;
      castMeteor(300, 200);
      const meteorRings = rings.length;
      const meteorAt = rings[0] && Math.abs(rings[0].x - 300) < 1e-6 && Math.abs(rings[0].y - 200) < 1e-6;

      // (c) Particle effects = Off suppresses rings entirely (same gate as the burst)
      rings.length = 0; particleDensity = 0; abilityCd.shock = 0;
      triggerAbility('shock');
      const ringsWhenOff = rings.length;

      // (d) rings decay and clear via update() within their lifetime
      particleDensity = 1; rings.length = 0; abilityCd.shock = 0;
      triggerAbility('shock');
      const beforeDecay = rings.length;
      for (let i = 0; i < 120; i++) update(1/60);            // 2s > max ring life (0.55s)
      const afterDecay = rings.length;

      // (e) save round-trip ignores rings (run-only, never serialized)
      rings.length = 0; abilityCd.shock = 0; triggerAbility('shock');
      saveRun();
      const saved = JSON.parse(localStorage.getItem('cd_save'));
      const notSaved = saved && saved.rings === undefined;

      rings.length = 0; enemies.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { startEmpty, shockRings, shapeOk, meteorRings, meteorAt, ringsWhenOff,
               beforeDecay, afterDecay, notSaved };
    });
    check('rings start empty after resetState', r.startEmpty);
    check('Shockwave pushes expanding rings', r.shockRings >= 2, 'count=' + r.shockRings);
    check('a ring has a valid radius/life shape', r.shapeOk);
    check('Meteor pushes an impact ring', r.meteorRings >= 1, 'count=' + r.meteorRings);
    check('the Meteor ring is centred on the impact point', r.meteorAt);
    check('Particle effects = Off suppresses rings', r.ringsWhenOff === 0, 'count=' + r.ringsWhenOff);
    check('rings exist immediately after a cast', r.beforeDecay >= 2);
    check('rings decay and clear via update()', r.afterDecay === 0, 'left=' + r.afterDecay);
    check('rings are not serialized into the save', r.notSaved);
    check('no console errors during shock-ring tests', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [118] Aegis meta talent — +1 banked Barrier charge per rank (3 base → 5), defensive,
  // save-safe via loadMeta migration (v2.6.0)
  console.log('\n[118] Aegis Barrier-charge talent');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const def = TALENTS.aegis;
      const inTree = !!def && def.sect === 'CORE' && def.max === 2;

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0; spawners.length = 0; enemies.length = 0;

      // rank 0 -> base 3 charges
      meta.talents = {};
      const base0 = barrierMax();
      abilityCd.barrier = 0; triggerAbility('barrier');
      const cast0 = barrierCharges === 3;

      // rank 2 -> 5 charges, reflected by barrierMax() AND the actual cast
      meta.talents.aegis = 2;
      const max2 = barrierMax();
      barrierCharges = 0; abilityCd.barrier = 0; triggerAbility('barrier');
      const cast2 = barrierCharges === 5;

      // loadMeta migrates an old save that predates the talent (key defaults to 0)
      localStorage.setItem('cd_meta', JSON.stringify({ chips: 30, talents: { funding: 3 } }));
      loadMeta();
      const migratedOk = meta.talents.aegis === 0 && meta.talents.funding === 3 && meta.chips === 30;

      // cleanup
      meta = { chips: 0, talents: {}, achievements: {}, stats: { dmg: 0, runs: 0 } };
      loadMeta();
      localStorage.removeItem('cd_meta'); localStorage.removeItem('cd_save');
      barrierCharges = 0; enemies.length = 0;
      backToMenu();
      return { inTree, base0, cast0, max2, cast2, migratedOk };
    });
    check('Aegis is a CORE talent (max 2)', r.inTree);
    check('rank 0 => barrierMax 3 and cast banks 3', r.base0 === 3 && r.cast0, JSON.stringify(r));
    check('rank 2 => barrierMax 5 and cast banks 5', r.max2 === 5 && r.cast2, JSON.stringify(r));
    check('loadMeta migrates a pre-Aegis save (key defaults 0)', r.migratedOk, JSON.stringify(r));
    check('no console errors during Aegis test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [119] Warper boss archetype — the 13th: every ~5s yanks nearby allies 30px forward along the
  // path (offensive inverse of Shockwave); adds no HP/speed; freeze pauses it (v2.7.0)
  console.log('\n[119] Warper boss (forward-pull archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // 13th archetype: appears at w80 (after conduit at w75); fortifier (14th) follows at w85,
      // warlord (15th) at w90, suppressor (16th) at w95, wrapping at w100 → regen.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(80) === 'warper';
      const wrapsAt85 = bt(85) === 'fortifier' && bt(90) === 'warlord';
      const archCount = BOSS_ARCHETYPES.length;

      const sp = pointAt(60);
      const farP = pointAt(600);
      // boss spd 0 so its own dist is fixed; explicit x/y so the frame-1 distance check is exact
      // (update() sets x/y per-enemy mid-loop — aura-test gotcha).
      const mkBoss = () => ({ kind:'boss', bossType:'warper', hp:5000, maxHp:5000, spd:0, r:24,
        bounty:100, color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });
      const mkAdd = (atFar) => ({ kind:'norm', hp:200, maxHp:200, spd:0, r:11, bounty:2, color:'#3fb950',
        armor:0, gap:0.8, dist: atFar ? 600 : 60, x: atFar ? farP.x : sp.x, y: atFar ? farP.y : sp.y,
        px: atFar ? farP.x : sp.x, py: atFar ? farP.y : sp.y, slow:0, slowF:0.6, frozen:0, poison:null, flash:0 });

      // (A) a primed pulse yanks a NEAR ally +30px forward; a FAR ally is untouched.
      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      const boss = mkBoss(); boss.warpCd = 0.001; enemies.push(boss);
      const near = mkAdd(false), far = mkAdd(true);
      enemies.push(near, far);
      update(1/60);
      const nearPulled = Math.abs(near.dist - 90) < 1e-6;   // 60 + 30 (spd 0)
      const farUntouched = Math.abs(far.dist - 600) < 1e-6;
      const bossUnchanged = boss.dist === 60 && boss.spd === 0 && boss.hp === 5000;  // no HP/speed added

      // (B) not yet primed: a fresh warper doesn't pull on the first frame (warpCd ~4s).
      enemies.length = 0;
      const boss2 = mkBoss(); enemies.push(boss2);
      const a2 = mkAdd(false); enemies.push(a2);
      update(1/60);
      const noEarlyPull = Math.abs(a2.dist - 60) < 1e-6;

      // (C) a FROZEN warper doesn't pull even when primed (freeze counters it).
      enemies.length = 0;
      const fb = mkBoss(); fb.frozen = 5; fb.warpCd = 0.001; enemies.push(fb);
      const a3 = mkAdd(false); enemies.push(a3);
      update(1/60);
      const frozenNoPull = Math.abs(a3.dist - 60) < 1e-6;

      // (D) badge names the archetype.
      const badge = bossMechanicBadge(fb);
      const badgeOk = !!badge && badge.label === 'WARPER';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt85, archCount, nearPulled, farUntouched, bossUnchanged,
               noEarlyPull, frozenNoPull, badgeOk };
    });
    check('warper is the 13th archetype (w80)', r.inRotation && r.archCount === 16);
    check('fortifier follows warper (w85), warlord at w90', r.wrapsAt85);
    check('a primed pulse yanks a near ally +30px forward', r.nearPulled, JSON.stringify(r));
    check('a far ally (out of range) is untouched', r.farUntouched);
    check('the warper adds no HP or speed of its own', r.bossUnchanged);
    check('a fresh warper does not pull on frame 1 (warpCd ~4s)', r.noEarlyPull);
    check('a frozen warper does not pull (freeze counters it)', r.frozenNoPull);
    check('boss-bar badge reads WARPER', r.badgeOk);
    check('no console errors during Warper test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [120] Shaped Charges rare perk — explosive towers pierce the Bastion blast-shell (v2.8.0)
  console.log('\n[120] Shaped Charges perk (Bastion pierce)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame();

      // (a) the perk exists, is RARE, and freshPerkState defaults aoePen false (save-safe).
      const def = PERKS.find(p => p.id === 'shaped');
      const isRare = !!def && def.rarity === 'rare';
      const defaultsFalse = freshPerkState().aoePen === false;

      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      autoStartTimer = -1; waveActive = false;
      const pt = pointAt(pathLen * 0.4);
      const mk = (kind, extra = {}) => ({ kind, hp:1000, maxHp:1000, spd:1, r:12, bounty:1,
        color:'#fff', armor:0, gap:0, dist:pathLen*0.4, x:pt.x, y:pt.y, slow:0, slowF:0.6,
        frozen:0, poison:null, flash:0, px:0, py:0, ...extra });

      // (b) WITHOUT the perk: a Bastion still takes HALF the Cannon bomb / Mortar shell splash.
      perkState.aoePen = false;
      let b = mk('bastion', { aoeResist:true }); enemies.length = 0; enemies.push(b);
      hitEnemy({ kind:'bomb', target:{ x:pt.x, y:pt.y }, dmg:100, src:null, ignoreArmor:false });
      const offBombHalf = Math.abs((1000 - b.hp) - 50) < 0.01;
      b = mk('bastion', { aoeResist:true }); enemies.length = 0; enemies.push(b);
      hitEnemy({ kind:'mortar', target:{ x:pt.x, y:pt.y }, dmg:100, color:'#fff', src:null, ignoreArmor:true });
      const offMortHalf = Math.abs((1000 - b.hp) - 50) < 0.01;

      // (c) WITH the perk: a Bastion takes FULL splash from both explosive towers.
      perkState.aoePen = true;
      b = mk('bastion', { aoeResist:true }); enemies.length = 0; enemies.push(b);
      hitEnemy({ kind:'bomb', target:{ x:pt.x, y:pt.y }, dmg:100, src:null, ignoreArmor:false });
      const onBombFull = Math.abs((1000 - b.hp) - 100) < 0.01;
      b = mk('bastion', { aoeResist:true }); enemies.length = 0; enemies.push(b);
      hitEnemy({ kind:'mortar', target:{ x:pt.x, y:pt.y }, dmg:100, color:'#fff', src:null, ignoreArmor:true });
      const onMortFull = Math.abs((1000 - b.hp) - 100) < 0.01;

      // (d) the perk does NOT change a non-Bastion: a norm always takes full splash either way.
      const n = mk('norm'); enemies.length = 0; enemies.push(n);
      hitEnemy({ kind:'bomb', target:{ x:pt.x, y:pt.y }, dmg:100, src:null, ignoreArmor:false });
      const normUnaffected = Math.abs((1000 - n.hp) - 100) < 0.01;
      enemies.length = 0;

      // (e) apply() flips the flag; legendary-only resolveWildcard never rolls this rare.
      const ps = freshPerkState();
      def.apply(ps);
      const applySets = ps.aoePen === true;

      backToMenu();
      localStorage.removeItem('cd_save');
      return { isRare, defaultsFalse, offBombHalf, offMortHalf, onBombFull, onMortFull,
               normUnaffected, applySets };
    });
    check('Shaped Charges exists and is a rare perk', r.isRare);
    check('freshPerkState defaults aoePen=false (save-safe)', r.defaultsFalse);
    check('without the perk a bastion still takes half Cannon bomb splash', r.offBombHalf);
    check('without the perk a bastion still takes half Mortar shell splash', r.offMortHalf);
    check('with the perk a bastion takes FULL Cannon bomb splash', r.onBombFull);
    check('with the perk a bastion takes FULL Mortar shell splash', r.onMortFull);
    check('the perk does not change splash on a non-bastion', r.normUnaffected);
    check('apply() sets perkState.aoePen', r.applySets);
    check('no console errors during Shaped Charges test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [121] Laser tower — the 10th: a sustained beam that RAMPS damage on a held target (v2.9.0)
  console.log('\n[121] Laser tower (ramp-up beam)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // definitions present & wired
      const def = TOWER_TYPES.laser;
      const defOk = !!def && def.proj === 'beam' && def.range > 0 && def.dmg > 0;
      const specsOk = Array.isArray(SPECS.laser) && SPECS.laser.length === 2
        && SPECS.laser.some(s => s.id === 'focus') && SPECS.laser.some(s => s.id === 'rapidcoil');
      const masteryOk = !!TALENTS.mastery_laser && TALENTS.mastery_laser.sect === 'TOWER MASTERY';
      const inShopKeys = TYPE_KEYS.includes('laser') && TYPE_KEYS.length === 11;
      const sfxOk = typeof SFX.laser === 'function';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const shopHasLaser = !!document.querySelector('#shop') &&
        Array.prototype.some.call(document.querySelectorAll('.towerBtn'), b => /Laser/.test(b.textContent));

      // specs: Focusing Array = +35% dmg (effDmg); Pulse Drive = faster fire (effRate ×1.4 → lower interval)
      const lt0 = { type:'laser', x:100, y:300, level:1, spec:null, dmg:100, rate:0.45, range:175,
                    dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      const dBase = effDmg(lt0), rBase = effRate(lt0);
      lt0.spec = 'focus';     const focusOk = Math.abs(effDmg(lt0) - dBase * 1.35) < 1e-6;
      lt0.spec = 'rapidcoil'; const coilOk  = effRate(lt0) < rBase - 1e-6;   // faster (shorter interval)
      lt0.spec = null;

      // hotkey '0' selects the 10th tower (keys 1-9 → towers 1-9, '0' → 10th)
      gold = 500; selectedShop = null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
      const hotkeyOk = selectedShop === 'laser';
      selectedShop = null;

      // fireBeam: deals damage to the single target, draws a straight tracer, respects armor.
      towers.length = 0; enemies.length = 0; beams.length = 0; projectiles.length = 0;
      const lz = { type:'laser', x:100, y:300, level:1, spec:null, dmg:40, rate:0.45, range:175,
                   dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      const tgt = { x:150, y:300, r:12, hp:500, maxHp:500, armor:0, dead:false, flash:0,
                    kind:'norm', blinkInvuln:0, bounty:1, dist:0 };
      enemies.push(tgt);
      fireBeam(lz, tgt, 60);
      const dealtDmg = tgt.hp < 500;
      const beamDrawn = beams.some(b => b.straight === true);
      enemies.length = 0;
      let drawOk = beams.some(b => b.straight === true);
      try { draw(); } catch (e) { drawOk = false; }

      // respects armor (a coherent beam, not an armor-ignorer)
      enemies.length = 0;
      const armored = { x:150, y:300, r:12, hp:1000, maxHp:1000, armor:50, dead:false, flash:0,
                        kind:'shield', blinkInvuln:0, bounty:1, dist:0 };
      enemies.push(armored);
      fireBeam(lz, armored, 100);
      const respectsArmor = (1000 - armored.hp) < 100;

      // BEAM GROWS WITH CHARGE (owner feedback): a fully spun-up beam draws a visibly wider
      // tracer + an outer bloom that's absent at ×1. Fire at ×1 vs the ×2.2 cap and compare.
      enemies.length = 0;
      const gtgt = { x:150, y:300, r:12, hp:1e7, maxHp:1e7, armor:0, dead:false, flash:0,
                     kind:'norm', blinkInvuln:0, bounty:1, dist:0 };
      enemies.push(gtgt);
      beams.length = 0; lz.charge = 1;  fireBeam(lz, gtgt, 1); const wLow  = beams[beams.length-1].w;
      const bloomLow = beams[beams.length-1].bloom;
      beams.length = 0; lz.charge = 2.2; fireBeam(lz, gtgt, 1); const wHigh = beams[beams.length-1].w;
      const bloomHigh = beams[beams.length-1].bloom;
      const beamGrows = wHigh > wLow * 1.5 && bloomLow === 0 && bloomHigh > 0;

      // RAMP: drive the real update() fire loop on a single held target → charge climbs to ×2.2 cap.
      towers.length = 0; enemies.length = 0; beams.length = 0; projectiles.length = 0;
      autoStartTimer = -1; waveActive = false; paused = false;
      const pt = pointAt(pathLen * 0.4);
      const laser = { type:'laser', x:pt.x, y:pt.y, level:1, spec:null, dmg:20, rate:0.45, range:175,
                      dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      towers.push(laser);
      const mkE = (hp) => ({ kind:'norm', hp, maxHp:hp, spd:0, r:12, bounty:1, color:'#fff', armor:0,
        gap:0, dist:pathLen*0.4, x:pt.x, y:pt.y, slow:0, slowF:0.6, frozen:0, hasted:0, warded:0,
        adrenaline:false, ccImmune:false, poison:null, flash:0, px:0, py:0, dead:false, blinkInvuln:0 });
      const A = mkE(1e7); enemies.push(A);
      for (let i = 0; i < 420; i++) update(1/60);          // ~7s → well past the ~11 shots to cap
      const tookDmg = A.hp < A.maxHp;
      const chargeCapped = Math.abs((laser.charge || 1) - 2.2) < 1e-9;   // ramps to the ×2.2 cap
      const heldTarget = laser.beamTarget === A;

      // RESET: switch targets → charge snaps back to ×1 (deliberately poor at swarms)
      enemies.length = 0;
      const B = mkE(1e7); enemies.push(B);
      let switched = false;
      for (let i = 0; i < 120; i++) { update(1/60); if (B.hp < B.maxHp) { switched = true; break; } }
      const resetOnSwitch = switched && laser.beamTarget === B && Math.abs((laser.charge || 1) - 1) < 1e-9;

      // save/resume: laser round-trips; charge is NEVER serialized (resumes re-ramping from ×1)
      towers.length = 0; enemies.length = 0; beams.length = 0;
      towers.push({ type:'laser', x:250, y:250, level:3, spec:'focus', mode:'strong',
        invested:300, dealt:42, kills:2, range:def.range*Math.pow(1.08,2), dmg:def.dmg*Math.pow(1.45,2),
        rate:def.rate*Math.pow(0.88,2), cd:0, baseCost:def.cost, angle:0, buffPower:0.25, flash:0, charge:2.2 });
      wave = 2; lives = 20; gold = 100; waveActive = false;
      saveRun();
      const savedNoCharge = !/\"charge\"/.test(localStorage.getItem('cd_save') || '');
      towers.length = 0;
      const loaded = loadRun();
      const lrt = towers.find(t => t.type === 'laser');
      const roundTrips = loaded === true && !!lrt && lrt.level === 3 && lrt.spec === 'focus' && lrt.charge === undefined;

      localStorage.removeItem('cd_save');
      backToMenu();
      return { defOk, specsOk, masteryOk, inShopKeys, sfxOk, shopHasLaser, focusOk, coilOk, hotkeyOk,
               dealtDmg, beamDrawn, drawOk, respectsArmor, beamGrows, tookDmg, chargeCapped, heldTarget,
               resetOnSwitch, savedNoCharge, roundTrips };
    });
    check('Laser definition wired (proj=beam/range/dmg)', r.defOk);
    check('Laser has 2 specs (Focusing Array + Pulse Drive)', r.specsOk);
    check('Laser Mastery talent exists', r.masteryOk);
    check('Laser is in the shop keys and there are now 11 towers', r.inShopKeys);
    check('SFX.laser beam sound exists', r.sfxOk);
    check('Laser button rendered in the shop', r.shopHasLaser);
    check('Focusing Array spec = +35% damage', r.focusOk);
    check('Pulse Drive spec speeds up fire rate', r.coilOk);
    check("hotkey '0' selects the 10th tower (Laser)", r.hotkeyOk);
    check('fireBeam deals damage to the target', r.dealtDmg);
    check('Laser draws a straight tracer beam', r.beamDrawn);
    check('draw() renders the laser beam branch without throwing', r.drawOk);
    check('Laser respects armor (not an armor-ignorer)', r.respectsArmor);
    check('Laser beam visibly grows (wider + blooms) as charge builds', r.beamGrows);
    check('Laser ramps damage on a held target up to the ×2.2 cap', r.tookDmg && r.chargeCapped && r.heldTarget,
      `charge=${r.chargeCapped} held=${r.heldTarget}`);
    check('Laser charge resets to ×1 when the target switches', r.resetOnSwitch);
    check('Laser charge is NEVER serialized (save-safe)', r.savedNoCharge);
    check('placed Laser save/resume round-trips (charge re-ramps from ×1)', r.roundTrips);
    check('no console errors during Laser test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [122] Fortifier boss archetype — the 14th: ramps its own armor while alive (a DPS race),
  // capped, freeze pauses it, adds no HP/speed; reuses the existing damage() armor path (v2.10.0)
  console.log('\n[122] Fortifier boss (armor-ramp archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // 14th archetype: appears at w85 (after warper at w80); warlord (15th) follows at w90.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(85) === 'fortifier';
      const wrapsAt90 = bt(90) === 'warlord';
      const archCount = BOSS_ARCHETYPES.length;

      const sp = pointAt(60);
      const mkBoss = () => ({ kind:'boss', bossType:'fortifier', hp:5000, maxHp:5000, spd:0, r:24,
        bounty:100, color:'#f85149', armor:10, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 });

      // (A) it ramps armor while alive: snapshot an absolute cap (starting armor 10 + FORTIFY_CAP 40
      // = 50), then grows by FORTIFY_RATE/s.
      enemies.length = 0; projectiles.length = 0; towers.length = 0;
      const boss = mkBoss(); enemies.push(boss);
      update(1); // 1 second
      const capSnapped = boss.fortifyCap === 50;
      const ramped = boss.armor > 10 && Math.abs(boss.armor - 10.5) < 0.05; // +0.5/s
      const noHpOrSpeed = boss.hp === 5000 && boss.spd === 0; // adds neither

      // (B) the ramp CAPS — drive a long time, armor never exceeds the absolute cap (50).
      for (let i = 0; i < 120; i++) update(1); // 120 more seconds
      const capped = Math.abs(boss.armor - 50) < 1e-6;

      // (C) a FROZEN fortifier stops hardening (gated block; freeze pauses it).
      enemies.length = 0;
      const fb = mkBoss(); fb.frozen = 5; fb.fortifyCap = 50; fb.armor = 15; enemies.push(fb);
      update(1);
      const frozenHolds = Math.abs(fb.armor - 15) < 1e-6; // unchanged while frozen

      // (D) the ramped armor flows through damage() (flat subtraction) — a hardened boss takes less.
      enemies.length = 0;
      const hb = mkBoss(); hb.fortifyCap = 50; hb.armor = 50; enemies.push(hb);
      const before = hb.hp; damage(hb, 200, null); const dealt = before - hb.hp;
      const armorBlunts = Math.abs(dealt - 150) < 1e-6; // 200 - 50 armor

      // (E) Poison's −3 armor corrosion PERSISTS (in-place ramp): knock a capped fortifier down to
      // 47, one tick only re-adds +0.5 → 47.5 (still below the cap), so corrosion stays meaningful.
      enemies.length = 0;
      const cb = mkBoss(); cb.fortifyCap = 50; cb.armor = 47; enemies.push(cb); // post-corrosion
      update(1);
      const corrosionPersists = Math.abs(cb.armor - 47.5) < 1e-6;

      // (F) badge names the archetype.
      const badge = bossMechanicBadge({ kind:'boss', bossType:'fortifier' });
      const badgeOk = !!badge && badge.label === 'FORTIFYING';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt90, archCount, capSnapped, ramped, noHpOrSpeed,
               capped, frozenHolds, armorBlunts, corrosionPersists, badgeOk };
    });
    check('fortifier is the 14th archetype (w85)', r.inRotation && r.archCount === 16);
    check('warlord follows fortifier (w90)', r.wrapsAt90);
    check('fortifier snapshots an absolute armor cap (start + FORTIFY_CAP = 50)', r.capSnapped);
    check('fortifier ramps its armor while alive (+0.5/s)', r.ramped, JSON.stringify(r));
    check('fortifier adds no HP or speed of its own', r.noHpOrSpeed);
    check('the armor ramp caps at the absolute cap (50)', r.capped);
    check('a frozen fortifier stops hardening (freeze pauses it)', r.frozenHolds);
    check('ramped armor blunts incoming damage via damage() (200−50=150)', r.armorBlunts);
    check('Poison armor-corrosion persists; the boss re-hardens in place (47 → 47.5)', r.corrosionPersists);
    check('boss-bar badge reads FORTIFYING', r.badgeOk);
    check('no console errors during Fortifier test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [123] Veteran's Edge legendary perk — +5% damage per tower veteran rank (max +20%), wired in
  // effDmg via towerRankTier; conditional/back-loaded/capped (below Diamond Core), save-safe (v2.13.0)
  console.log("\n[123] Veteran's Edge perk (veterancy damage)");
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      const gun = { type:'gun', x:300, y:300, level:1, spec:null, dmg:10, range:120, rate:1, dealt:0, kills:0 };
      towers.push(gun);

      // (a) the perk exists, is legendary, and freshPerkState defaults veteranBonus false (save-safe).
      const def = PERKS.find(p => p.id === 'veteran');
      const inPool = !!def && def.rarity === 'legendary';
      const defaultsFalse = freshPerkState().veteranBonus === false;

      // (b) WITHOUT the perk, a tower's kills never change its damage.
      perkState.veteranBonus = false;
      gun.kills = 0;   const offRookie = effDmg(gun);
      gun.kills = 250; const offLegend = effDmg(gun);
      const killsInertWhenOff = Math.abs(offRookie - offLegend) < 1e-9;

      // (c) apply() sets the flag, then damage scales +5% per veteran TIER (0/15/40/90/200 kills →
      //     tiers 0..4 → ×1.00/1.05/1.10/1.15/1.20). Compare against the off-perk baseline.
      perkState.veteranBonus = false; gun.kills = 0; const base = effDmg(gun);
      def.apply(perkState);
      const mul = k => { gun.kills = k; return effDmg(gun) / base; };
      const rookie = Math.abs(mul(0)   - 1.00) < 1e-9;   // tier 0
      const vet    = Math.abs(mul(15)  - 1.05) < 1e-9;   // tier 1 (Veteran)
      const elite  = Math.abs(mul(40)  - 1.10) < 1e-9;   // tier 2 (Elite)
      const ace    = Math.abs(mul(90)  - 1.15) < 1e-9;   // tier 3 (Ace)
      const legend = Math.abs(mul(200) - 1.20) < 1e-9;   // tier 4 (Legend)
      const capped = Math.abs(mul(99999) - 1.20) < 1e-9; // no further growth past Legend
      const scalesByTier = rookie && vet && elite && ace && legend && capped;

      // (d) it's below the unconditional Diamond Core (+30% flat) even at max — not power creep.
      const belowDiamond = (mul(200) - 1) < 0.30;

      // (e) upgradeKey() hashes towerRankTier (churns on PROMOTION ONLY, not every kill): crossing
      //     14→15 (Rookie→Veteran) changes the key; 15→39 (both Veteran, same tier+dmg) does NOT.
      gun.kills = 14; const k14 = upgradeKey(gun);
      gun.kills = 15; const k15 = upgradeKey(gun);   // crossed into Veteran → key changes
      gun.kills = 39; const k39 = upgradeKey(gun);   // still Veteran → key unchanged (no churn)
      const keyChurnsOnPromotion = k14 !== k15 && k15 === k39;

      // (f) resolveWildcard can roll it (un-taken legendary eligible).
      let wildcardCanRoll = false;
      runPerks.length = 0;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'veteran') wildcardCanRoll = true;
      }

      // (g) save/reload round-trips the flag (lives in perkState → persisted whole).
      perkState.veteranBonus = true;
      saveRun();
      perkState.veteranBonus = false; // clobber
      const loaded = loadRun();
      const restored = perkState.veteranBonus === true;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, defaultsFalse, killsInertWhenOff, scalesByTier, belowDiamond,
               keyChurnsOnPromotion, wildcardCanRoll, loaded, restored };
    });
    check("Veteran's Edge is a legendary perk in the pool", r.inPool);
    check('freshPerkState defaults veteranBonus=false (save-safe)', r.defaultsFalse);
    check('tower kills are inert on damage when the perk is NOT held', r.killsInertWhenOff);
    check('damage scales +5% per veteran tier, capped +20% at Legend', r.scalesByTier);
    check("Veteran's Edge max is below Diamond Core's +30% (not power creep)", r.belowDiamond);
    check('upgradeKey reflects a veteran promotion', r.keyChurnsOnPromotion);
    check("resolveWildcard can roll Veteran's Edge", r.wildcardCanRoll);
    check('save/reload round-trips the veteranBonus flag', r.loaded === true && r.restored);
    check("no console errors during Veteran's Edge test", consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [124] Warlord boss archetype — the 15th: the FIRST GLOBAL aura. While alive it rallies the
  // whole wave with WARLORD_ARMOR flat bonus armor (kill the keystone / freeze it to strip it),
  // adds no HP/speed, and the rally flows through the existing damage() armor path (v2.14.0).
  console.log('\n[124] Warlord boss (global armor-rally archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // 15th archetype: appears at w90 (after fortifier at w85); suppressor (16th) follows at w95.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(90) === 'warlord';
      const wrapsAt95 = bt(95) === 'suppressor';
      const archCount = BOSS_ARCHETYPES.length;

      const sp = pointAt(60);
      const mkBoss = () => ({ kind:'boss', bossType:'warlord', hp:5000, maxHp:5000, spd:0, r:24,
        bounty:100, color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0, rallied:0 });
      const mkNorm = (over = {}) => Object.assign({ kind:'norm', hp:10000, maxHp:10000, spd:0, r:11,
        bounty:5, color:'#3fb950', armor:0, gap:0.8, dist:30, x:200, y:200, px:200, py:200,
        slow:0, slowF:0.6, frozen:0, poison:null, flash:0, rallied:0 }, over);

      // (A)+(F) GLOBAL rally: a living Warlord refreshes `rallied` on every non-boss enemy,
      //         regardless of distance — even one far across the board.
      enemies.length = 0; projectiles.length = 0; towers.length = 0;
      const boss = mkBoss();
      // update() recomputes x/y from `dist`, so place them far apart ON THE PATH — a 75px warden-style
      // aura could never reach both; only a global (no-range) rally hardens both.
      const near = mkNorm({ dist: 70 });    // just behind the warlord (dist 60)
      const far  = mkNorm({ dist: 600 });   // far down the path
      enemies.push(boss, near, far);
      for (let i = 0; i < 12; i++) update(1/60); // tick like real frames (refresh > per-frame decay)
      const apart = Math.hypot(near.x - far.x, near.y - far.y) > 200; // genuinely separated
      const ralliesGlobally = apart && near.rallied > 0 && far.rallied > 0;
      const noHpOrSpeed = boss.hp === 5000 && boss.spd === 0; // adds neither to itself

      // (B) the rally adds WARLORD_ARMOR flat armor via damage()'s existing flat-subtraction path:
      //     a rallied enemy takes exactly WARLORD_ARMOR (10) less from a clean hit than an un-rallied one.
      enemies.length = 0;
      const a = mkNorm({ rallied: 1 }); const la = a.hp; damage(a, 200, null); const lossR = la - a.hp;
      const b = mkNorm({ rallied: 0 }); const lb = b.hp; damage(b, 200, null); const lossU = lb - b.hp;
      const armorAdds = Math.abs((lossU - lossR) - WARLORD_ARMOR) < 1e-6;

      // (C) anti-armor towers ignore the rally (Mortar/AP pass ignoreArmor) — full damage.
      const c = mkNorm({ rallied: 1 }); const lc = c.hp; damage(c, 200, null, false, true); const lossPen = lc - c.hp;
      const piercesRally = Math.abs(lossPen - 200) < 1e-6;

      // (D) the rally LAPSES the instant the Warlord is gone (no refresher → `rallied` decays to 0).
      enemies.length = 0;
      const orphan = mkNorm({ rallied: 0.25 });
      enemies.push(orphan); // no warlord present
      for (let i = 0; i < 30; i++) update(1/60); // ~0.5s, > the 0.25 timer
      const lapsesWithoutWarlord = orphan.rallied === 0;

      // (E) a FROZEN Warlord stops rallying (gated block; freeze pauses it) — the wave un-hardens.
      enemies.length = 0;
      const fb = mkBoss(); fb.frozen = 5; const fn = mkNorm({ x: sp.x + 20, y: sp.y });
      enemies.push(fb, fn);
      for (let i = 0; i < 12; i++) update(1/60);
      const frozenStopsRally = fn.rallied === 0;

      // (G) badge names the archetype.
      const badge = bossMechanicBadge({ kind:'boss', bossType:'warlord' });
      const badgeOk = !!badge && badge.label === 'RALLYING';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt95, archCount, ralliesGlobally, noHpOrSpeed, armorAdds,
               piercesRally, lapsesWithoutWarlord, frozenStopsRally, badgeOk };
    });
    check('warlord is the 15th archetype (w90)', r.inRotation && r.archCount === 16);
    check('suppressor follows warlord (w95)', r.wrapsAt95);
    check('warlord rallies the WHOLE wave globally (near + far)', r.ralliesGlobally);
    check('warlord adds no HP or speed of its own', r.noHpOrSpeed);
    check('the rally adds WARLORD_ARMOR flat armor via damage() (10 less per hit)', r.armorAdds);
    check('anti-armor (ignoreArmor) towers pierce the rally — full damage', r.piercesRally);
    check('the rally lapses the instant the Warlord is gone', r.lapsesWithoutWarlord);
    check('a frozen Warlord stops rallying (freeze counters it)', r.frozenStopsRally);
    check('boss-bar badge reads RALLYING', r.badgeOk);
    check('no console errors during Warlord test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [125] Phoenix legendary perk — the first player-revival mechanic. A fatal leak (lives→0) with
  // Phoenix held instead REVIVES once at PHOENIX_LIVES and hurls the live field back to dist 0; the
  // latch (phoenixUsed) makes it fire exactly once per run; pure knockback (no kills/bounty) (v2.15.0).
  console.log('\n[125] Phoenix perk (once-per-run death-cheat)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // (a) the perk exists, is legendary, and freshPerkState defaults both flags false (save-safe).
      const perk = PERKS.find(p => p.id === 'phoenix');
      const isLegendary = !!perk && perk.rarity === 'legendary';
      const def = freshPerkState();
      const defaultsFalse = def.phoenix === false && def.phoenixUsed === false;
      perk.apply(def);
      const applySets = def.phoenix === true;

      // a norm enemy parked just past the exit → leaks on the next tick (spd 0, so it can't move away).
      const mkLeaker = (over = {}) => Object.assign({ kind:'norm', hp:100, maxHp:100, spd:0, r:11,
        bounty:5, color:'#3fb950', armor:0, gap:0.8, dist: pathLen + 5, x:0, y:0, px:0, py:0,
        slow:0, slowF:0.6, frozen:0, poison:null, flash:0 }, over);

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;

      // (b) WITHOUT Phoenix: a fatal leak ends the run (the unmodified loss path).
      beginGame();
      perkState.phoenix = false; perkState.phoenixUsed = false;
      lives = 1; gameOver = false; victory = false;
      enemies.length = 0; enemies.push(mkLeaker());
      update(1/60);
      const diesWithoutPhoenix = gameOver === true && lives <= 0;

      // (c) WITH Phoenix: the same fatal leak REVIVES — not game over, lives restored to PHOENIX_LIVES,
      //     latch set, and a live mid-field enemy is hurled back to the path start (dist 0).
      beginGame();
      perkState.phoenix = true; perkState.phoenixUsed = false;
      lives = 1; gameOver = false; victory = false;
      enemies.length = 0;
      const midfield = mkLeaker({ dist: Math.floor(pathLen * 0.5) }); // live, mid-path
      enemies.push(mkLeaker(), midfield);
      update(1/60);
      const revived = !gameOver && lives === PHOENIX_LIVES;
      const latched = perkState.phoenixUsed === true;
      const fieldReset = midfield.dist === 0;

      // (d) the latch makes it ONCE-per-run: a second fatal leak now ends the run.
      lives = 1; gameOver = false;
      enemies.length = 0; enemies.push(mkLeaker());
      update(1/60);
      const onlyOnce = gameOver === true && lives <= 0;

      // (e) save-safe: phoenixUsed round-trips via Object.assign(freshPerkState(), saved) — a saved
      //     "already used" run cannot re-trigger on resume.
      const restored = Object.assign(freshPerkState(), { phoenix: true, phoenixUsed: true });
      const usedPersists = restored.phoenix === true && restored.phoenixUsed === true;

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { isLegendary, defaultsFalse, applySets, diesWithoutPhoenix, revived, latched,
               fieldReset, onlyOnce, usedPersists };
    });
    check('phoenix perk exists and is legendary', r.isLegendary);
    check('freshPerkState defaults phoenix/phoenixUsed false (save-safe)', r.defaultsFalse);
    check('apply() sets perkState.phoenix', r.applySets);
    check('without Phoenix, a fatal leak ends the run', r.diesWithoutPhoenix);
    check('with Phoenix, a fatal leak revives at PHOENIX_LIVES (no game over)', r.revived);
    check('the revive latches phoenixUsed', r.latched);
    check('the revive hurls the live field back to the path start (dist 0)', r.fieldReset);
    check('it fires ONCE per run — a second fatal leak ends the run', r.onlyOnce);
    check('phoenixUsed round-trips on resume (no re-trigger)', r.usedPersists);
    check('no console errors during Phoenix test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [126] Suppressor boss archetype — the 16th: a continuous fire-rate DAMPENING aura (the soft,
  // multi-tower counterpart to the Disruptor's hard single-tower EMP). While alive it tags every
  // non-buff tower within SUPPRESS_RANGE with `suppressed`, which effRate reads as +25% reload
  // (×1.25 — the same factor as the brownout wave-mod); buff towers are immune, the tag lapses the
  // instant the boss leaves range or dies, and a frozen suppressor can't suppress (v2.16.0).
  console.log('\n[126] Suppressor boss (fire-rate dampening archetype)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // 16th archetype: appears at w95 (after warlord at w90), rotation wraps at w100 → regen.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const inRotation = bt(95) === 'suppressor';
      const wrapsAt100 = bt(100) === 'regen';
      const archCount = BOSS_ARCHETYPES.length;

      const sp = pointAt(60);
      const mkBoss = (over = {}) => Object.assign({ kind:'boss', bossType:'suppressor', hp:5000, maxHp:5000,
        spd:0, r:24, bounty:100, color:'#f85149', armor:0, gap:1.5, dist:60, x:sp.x, y:sp.y, px:sp.x, py:sp.y,
        slow:0, slowF:0.8, frozen:0, poison:null, flash:0 }, over);
      const mkTower = (over = {}) => Object.assign({ type:'gun', x:sp.x, y:sp.y, rate:TOWER_TYPES.gun.rate,
        spec:null, level:1, kills:0, cd:0, flash:0, rankFlash:0, empT:0, suppressed:0, angle:0,
        invested:0, dealt:0, mode:'first' }, over);

      // (B)+(D)+(I) the aura tags every NON-buff tower within range each frame, but never a buff
      //   tower and never one out of range.
      enemies.length = 0; projectiles.length = 0; towers.length = 0;
      const near = mkTower();                              // on top of the boss → in range
      const far  = mkTower({ x: sp.x + 400, y: sp.y });    // 400px away → out of range
      const buff = mkTower({ type:'buff', x: sp.x, y: sp.y }); // in range but a buff tower → immune
      towers.push(near, far, buff);
      enemies.push(mkBoss());
      for (let i = 0; i < 10; i++) update(1/60);
      const tagsNear = near.suppressed > 0;
      const skipsFar = !(far.suppressed > 0);
      const buffImmune = !(buff.suppressed > 0);

      // (C) a suppressed tower's effRate is exactly +25% reload (×1.25) vs an identical clean one.
      const a = mkTower({ suppressed: 0.3 }); const b = mkTower({ suppressed: 0 });
      const throttle = Math.abs(effRate(a) / effRate(b) - 1.25) < 1e-6;
      const rangeLever = typeof SUPPRESS_RANGE === 'number' && SUPPRESS_RANGE > 0;

      // (G) adds no HP/speed of its own (no towers present, so nothing shoots it).
      enemies.length = 0; towers.length = 0;
      const boss = mkBoss();
      enemies.push(boss);
      for (let i = 0; i < 6; i++) update(1/60);
      const noHpOrSpeed = boss.hp === 5000 && boss.spd === 0;

      // (E) the tag LAPSES once the suppressor is gone (no refresher → decays to 0).
      enemies.length = 0; towers.length = 0;
      const orphan = mkTower({ suppressed: 0.3 });
      towers.push(orphan); // no suppressor present
      for (let i = 0; i < 40; i++) update(1/60); // ~0.66s, > the 0.3 timer
      const lapsesWithoutBoss = orphan.suppressed === 0;

      // (F) a FROZEN suppressor stops suppressing (gated block; freeze counters it).
      enemies.length = 0; towers.length = 0;
      const fb = mkBoss({ frozen: 5 }); const ft = mkTower();
      towers.push(ft); enemies.push(fb);
      for (let i = 0; i < 10; i++) update(1/60);
      const frozenStops = ft.suppressed === 0;

      // (H) badge names the archetype.
      const badge = bossMechanicBadge({ kind:'boss', bossType:'suppressor' });
      const badgeOk = !!badge && badge.label === 'SUPPRESSING';

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { inRotation, wrapsAt100, archCount, tagsNear, skipsFar, buffImmune, throttle,
               rangeLever, noHpOrSpeed, lapsesWithoutBoss, frozenStops, badgeOk };
    });
    check('suppressor is the 16th archetype (w95)', r.inRotation && r.archCount === 16);
    check('rotation wraps after suppressor (w100 → regen)', r.wrapsAt100);
    check('a living suppressor tags nearby non-buff towers', r.tagsNear);
    check('out-of-range towers are not suppressed', r.skipsFar);
    check('buff/support towers are immune to suppression', r.buffImmune);
    check('a suppressed tower reloads +25% slower (effRate ×1.25)', r.throttle);
    check('SUPPRESS_RANGE lever exists', r.rangeLever);
    check('suppressor adds no HP or speed of its own', r.noHpOrSpeed);
    check('suppression lapses the instant the suppressor is gone', r.lapsesWithoutBoss);
    check('a frozen suppressor stops suppressing (freeze counters it)', r.frozenStops);
    check('boss-bar badge reads SUPPRESSING', r.badgeOk);
    check('no console errors during Suppressor test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [127] Endless mode — menu-selectable Quick variant that never stops at wave 30 (v2.17.0)
  console.log('\n[127] Endless mode (menu-selectable, banks wave-30 win then continues)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const mkTower = (x, y) => ({ type:'gun', x, y, range:120, dmg:10, rate:0.5, cd:0, level:1,
        baseCost:60, invested:60, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0 });

      // (A) the menu offers a 3rd mode tile and selecting it sets endless (still gameMode==='quick').
      endless = false; gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      backToMenu(); renderStartScreen();
      const threeTiles = document.getElementById('modeRow').children.length === 3;
      document.getElementById('modeRow').children[1].click();   // ♾️ Endless tile
      const tileSelectsEndless = endless === true && gameMode === 'quick';
      // clicking Quick clears it; clicking Campaign clears it too.
      document.getElementById('modeRow').children[0].click();   // Quick Play
      const quickClearsEndless = endless === false;
      document.getElementById('modeRow').children[2].click();   // Campaign
      const campClearsEndless = endless === false && gameMode === 'campaign';

      // (B) an Endless run that reaches the victory wave BANKS the win but KEEPS PLAYING.
      localStorage.removeItem('cd_save');
      endless = true; gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 99999; towers.push(mkTower(200, 200));
      meta.chips = 0;
      wave = 30; lastSettledWave = 29; waveActive = true;
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      endWave();   // crosses victoryWave() (30): banks the win, then settles normally
      const banked = meta.chips > 0;
      const continues = victory === true && gameOver === false;
      const bonusPaid = gold > 99999;                 // fall-through settled the wave-clear bonus
      const stillResumable = !!localStorage.getItem('cd_save');  // endless run is NOT cleared

      // …and it keeps going past 30 without ever ending (victory already set → no re-fire).
      wave = 35; lastSettledWave = 34; waveActive = true;
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      endWave();
      const continuesPast30 = gameOver === false && victory === true;

      // (C) a NON-endless Quick run at wave 30 still ENDS (contrast).
      localStorage.removeItem('cd_save');
      endless = false; gameMode = 'quick'; mapKey = 'classic'; diffKey = 'easy';
      beginGame(); gold = 99999; towers.push(mkTower(200, 200));
      wave = 30; lastSettledWave = 29; waveActive = true;
      enemies.length = 0; spawners.length = 0; pendingSpawns.length = 0;
      endWave();
      const quickStillEnds = gameOver === true && victory === true;

      // (D) the endless flag round-trips through save/resume.
      localStorage.removeItem('cd_save');
      endless = true; gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal';
      beginGame(); gold = 500; towers.push(mkTower(220, 220));
      wave = 12; lastSettledWave = 12; waveActive = false; saveRun();
      const savedEndless = (JSON.parse(localStorage.getItem('cd_save')).endless === true);
      endless = false; loadRun();
      const resumedEndless = endless === true;

      // (E) an OLD save with no `endless` field loads as a normal (non-endless) run.
      localStorage.setItem('cd_save', JSON.stringify({ mapKey:'classic', diffKey:'easy',
        gameMode:'quick', campLevel:1, gold:100, lives:10, kills:0, wave:5, towers:[] }));
      endless = true; loadRun();
      const oldSaveNotEndless = endless === false;

      endless = false; localStorage.removeItem('cd_save'); localStorage.removeItem('cd_campaign');
      meta = { chips:0, talents:{}, achievements:{}, stats:{ dmg:0, runs:0, bestCombo:0 } }; loadMeta();
      backToMenu();
      return { threeTiles, tileSelectsEndless, quickClearsEndless, campClearsEndless,
        banked, continues, bonusPaid, stillResumable, continuesPast30, quickStillEnds,
        savedEndless, resumedEndless, oldSaveNotEndless };
    });
    check('menu shows 3 mode tiles (Quick / Endless / Campaign)', r.threeTiles);
    check('the Endless tile sets endless=true (still gameMode quick)', r.tileSelectsEndless);
    check('selecting Quick clears endless', r.quickClearsEndless);
    check('selecting Campaign clears endless', r.campClearsEndless);
    check('endless run banks the wave-30 win (chips awarded)', r.banked);
    check('endless run keeps playing past victory (victory set, not gameOver)', r.continues);
    check('endless wave-30 clear still pays the wave-clear bonus', r.bonusPaid);
    check('endless run stays resumable (save not cleared at the milestone)', r.stillResumable);
    check('endless run continues past wave 30 without ending', r.continuesPast30);
    check('a non-endless Quick run at wave 30 still ends (contrast)', r.quickStillEnds);
    check('endless flag is serialized to cd_save', r.savedEndless);
    check('endless flag round-trips through resume', r.resumedEndless);
    check('old save without the endless field loads as non-endless', r.oldSaveNotEndless);
    check('no console errors during Endless mode test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [128] Start menu spans the full game column (v2.18.0, owner FEEDBACK "the menu has a
  // scroll bar — it should use the entire game size minus the What's New panel"). The menu
  // moved out of #gameWrap (the 900×560 canvas box) to be #gameCol's last child, anchored to
  // #gameCol (position:relative), so it covers the full column height (title→hint) and the
  // tall Campaign 40-level grid no longer overflows into a scrollbar. Concentric with the
  // canvas, so the centered dashboard still fits horizontally. Mobile keeps its fixed layout.
  console.log('\n[128] Start menu uses the full game-column height (no scrollbar)');
  {
    const { page, consoleErrors } = await newPage(browser);
    await page.setViewportSize({ width: 1280, height: 800 });
    const d = await page.evaluate(() => {
      const ss = document.getElementById('startScreen');
      const col = document.getElementById('gameCol');
      const wrap = document.getElementById('gameWrap');
      const h1 = document.querySelector('h1');
      // select Campaign (the tall 40-level grid) to stress the height
      const camp = [...document.querySelectorAll('#modeRow .optBtn')].find(t => /Campaign/.test(t.textContent));
      camp && camp.click();
      const r = e => e.getBoundingClientRect();
      const ssH = r(ss).height, wrapH = r(wrap).height;
      const util = document.querySelector('.startUtil');
      return {
        parentIsCol: ss.parentElement.id === 'gameCol',
        colRelative: getComputedStyle(col).position === 'relative',
        // the menu is taller than the canvas box — it spans the whole column
        tallerThanCanvas: ssH > wrapH + 50,
        coversTitle: Math.round(r(ss).top) <= Math.round(r(h1).top) + 1,
        // Campaign content no longer overflows → no scrollbar
        campaignNoOverflow: ss.scrollHeight <= ss.clientHeight + 1,
        // dashboard still fits horizontally inside the canvas (concentric centering)
        utilFits: Math.round(r(util).right) <= Math.round(r(document.getElementById('game')).right) + 1,
      };
    });
    // quick mode also fits with no scroll
    const quick = await page.evaluate(() => {
      const q = [...document.querySelectorAll('#modeRow .optBtn')].find(t => /Quick/.test(t.textContent));
      q && q.click();
      const ss = document.getElementById('startScreen');
      return { noOverflow: ss.scrollHeight <= ss.clientHeight + 1 };
    });
    // returning to the menu after a game restores the CSS-governed grid (not an inline 'flex')
    const cycle = await page.evaluate(() => {
      beginGame(); backToMenu();
      const ss = document.getElementById('startScreen');
      return {
        display: getComputedStyle(ss).display,
        inlineCleared: ss.style.display === '',
        noOverflow: ss.scrollHeight <= ss.clientHeight + 1,
      };
    });
    // phone layout untouched: startScreen stays position:fixed, no horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await page.evaluate(() => {
      const ss = document.getElementById('startScreen');
      return {
        fixed: getComputedStyle(ss).position === 'fixed',
        notGrid: getComputedStyle(ss).display !== 'grid',
        noHorizOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        lastChildUtil: document.querySelector('#startScreen > div:last-child').classList.contains('startUtil'),
      };
    });
    check('start menu is a child of #gameCol (not #gameWrap)', d.parentIsCol);
    check('#gameCol is a positioning context (position:relative)', d.colRelative);
    check('menu spans the full column, taller than the canvas box', d.tallerThanCanvas);
    check('menu covers the page title (full-height overlay)', d.coversTitle);
    check('Campaign 40-level grid no longer overflows (no scrollbar)', d.campaignNoOverflow);
    check('dashboard still fits horizontally inside the board', d.utilFits);
    check('Quick mode menu fits with no scroll', quick.noOverflow);
    check('back-to-menu restores the CSS grid layout (inline display cleared)', cycle.display === 'grid' && cycle.inlineCleared, JSON.stringify(cycle));
    check('menu after a game still fits with no scroll', cycle.noOverflow);
    check('phone: start menu stays position:fixed (mobile layout untouched)', m.fixed && m.notGrid);
    check('phone: no horizontal overflow after the move', m.noHorizOverflow);
    check('phone: util toolbar is still the last child (test [58] invariant)', m.lastChildUtil);
    check('no console errors during full-height menu test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [129] Living Legend achievement + lifetime tower-kills stat (v2.19.0)
  console.log('\n[129] Living Legend achievement + lifetime tower-kills stat');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // badge defined & wired
      const badgeOk = !!ACH_BY_ID.legend_tower && /Legend rank/.test(ACH_BY_ID.legend_tower.desc);
      // roster grew by one (18 → 19)
      const rosterOk = ACHIEVEMENTS.length === 19;
      // a fresh meta carries the migrated lifetime tower-kills stat
      loadMeta();
      const migrated = typeof meta.stats.towerKills === 'number';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // a finished run with a Legend-rank tower (>=200 kills) grants legend_tower, win OR loss
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0, towerKills: 0 };
      towers.length = 0;
      towers.push({ type: 'gun', dealt: 5000, kills: 210 });   // Legend (tier 4)
      towers.push({ type: 'frost', dealt: 100, kills: 30 });   // Veteran
      const grantedOnLoss = grantAchievements(false).map(a => a.id).includes('legend_tower');
      // lifetime tower-kills accumulated the run total (210 + 30)
      const kAfter1 = meta.stats.towerKills;
      // a second run accumulates on top
      towers.length = 0; towers.push({ type: 'gun', dealt: 50, kills: 12 });
      grantAchievements(false);
      const kAfter2 = meta.stats.towerKills;

      // a run whose best tower is below Legend (Ace, 199 kills) does NOT grant it
      meta.achievements = {}; meta.stats = { dmg: 0, runs: 0, bestCombo: 0, towerKills: 0 };
      towers.length = 0; towers.push({ type: 'gun', dealt: 100, kills: 199 });
      grantAchievements(true);
      const notUnder200 = !meta.achievements.legend_tower;

      // Records panel renders the lifetime tower-kills row
      meta.stats.towerKills = 12345;
      openBests();
      const recordsShowsKills = /Tower kills/.test(document.getElementById('bestBody').innerHTML);
      closeBests();

      localStorage.removeItem('cd_save');
      meta = { chips: 0, talents: {} }; loadMeta();
      backToMenu();
      return { badgeOk, rosterOk, migrated, grantedOnLoss, kAfter1, kAfter2, notUnder200, recordsShowsKills };
    });
    check('Living Legend badge defined (legend_tower, "Legend rank" desc)', r.badgeOk);
    check('achievement roster grew to 19', r.rosterOk);
    check('loadMeta migrates meta.stats.towerKills (defaults to a number)', r.migrated);
    check('a Legend-rank tower (>=200 kills) grants Living Legend (win or loss)', r.grantedOnLoss);
    check('lifetime tower-kills accumulates the run total (210+30=240)', r.kAfter1 === 240, `kAfter1=${r.kAfter1}`);
    check('lifetime tower-kills keeps accumulating (240+12=252)', r.kAfter2 === 252, `kAfter2=${r.kAfter2}`);
    check('a below-Legend tower (199 kills) does NOT grant Living Legend', r.notUnder200);
    check('Records panel shows the lifetime tower-kills row', r.recordsShowsKills);
    check('no console errors during Living Legend test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [130] Critical Mass legendary perk — the FIRST perk on the crit-DAMAGE axis: +10% crit chance AND
  // every crit hits ×1.5 harder (perkState.critMult). Wired in the fire-loop crit branch (not effDmg);
  // save-safe via perkState (default critMult=1); the legendary-only resolveWildcard rolls it. (v2.20.0)
  console.log('\n[130] Critical Mass perk (crit-damage amplifier)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // (a) perk exists, legendary, freshPerkState defaults critMult=1 (save-safe).
      const def = PERKS.find(p => p.id === 'critmass');
      const inPool = !!def && def.rarity === 'legendary';
      const defaultsOne = freshPerkState().critMult === 1;

      // (b) apply() bumps crit CHANCE +0.10 AND crit MULTIPLIER ×1.5.
      const ps = freshPerkState();
      const chBefore = ps.critChance, mBefore = ps.critMult;
      def.apply(ps);
      const applyOk = Math.abs(ps.critChance - (chBefore + 0.10)) < 1e-9 &&
                      Math.abs(ps.critMult - mBefore * 1.5) < 1e-9;

      // (c) the crit branch in the fire loop actually multiplies per-crit damage by critMult. Drive a
      //     point-blank gun shot and measure the single hit's damage. Force/deny a crit by stubbing
      //     Math.random (critChance 0.5 → 0<0.5 crits, 0.999<0.5 doesn't). Base-agnostic: compare a
      //     crit hit against the SAME-build non-crit hit, so we never assume effDmg(gun)==10.
      const origRandom = Math.random;
      const measure = (critMult, forceCrit) => {
        Math.random = () => (forceCrit ? 0 : 0.999);
        enemies.length = 0; projectiles.length = 0; towers.length = 0;
        perkState = freshPerkState();
        perkState.critChance = 0.5; perkState.critMult = critMult;
        // NOTE: update() recomputes each enemy's x/y from its `dist` along the path every frame, so
        // we can't hardcode the enemy's position — let it settle one tick, then place the tower ON it.
        const e = { kind:'norm', x:0, y:0, dist:40, spd:0, r:10, hp:1e7, maxHp:1e7,
                    armor:0, frozen:0, slow:0, dead:false };
        enemies.push(e);
        update(1/60);                       // enemy x/y now = pointAt(40); no tower yet → 0 damage
        const gun = { type:'gun', x:e.x, y:e.y, level:1, spec:null, dmg:10, range:140,
                      rate:0.05, cd:0, dealt:0, kills:0, flash:0, angle:0 };
        towers.push(gun);
        const before = e.hp;
        for (let i = 0; i < 30 && e.hp === before; i++) update(1/60);  // one point-blank shot lands
        return before - e.hp;
      };
      const dmgNoCrit = measure(1, false);    // no crit → base damage
      const dmg1      = measure(1, true);      // crit, critMult 1   → base ×2.5
      const dmg15     = measure(1.5, true);    // crit, critMult 1.5 → base ×3.75
      const dmgNonCritAmp = measure(1.5, false); // critMult must NOT touch a non-crit hit
      Math.random = origRandom;
      const baseCritOk   = dmgNoCrit > 0 && Math.abs(dmg1 - dmgNoCrit * 2.5) < 1e-4;
      const ampCritOk    = Math.abs(dmg15 - dmgNoCrit * 2.5 * 1.5) < 1e-4;
      const ratioOk      = Math.abs(dmg15 / dmg1 - 1.5) < 1e-6;
      const nonCritInert = Math.abs(dmgNonCritAmp - dmgNoCrit) < 1e-4;

      // (d) resolveWildcard can roll it (un-taken legendary eligible).
      perkState = freshPerkState(); runPerks.length = 0;
      let wildcardCanRoll = false;
      for (let i = 0; i < 400 && !wildcardCanRoll; i++) {
        if (resolveWildcard().id === 'critmass') wildcardCanRoll = true;
      }

      // (e) save/reload round-trips critMult (lives in perkState → persisted whole; old saves default 1).
      perkState = freshPerkState(); perkState.critMult = 1.5;
      saveRun();
      perkState.critMult = 1; // clobber
      const loaded = loadRun();
      const restored = Math.abs(perkState.critMult - 1.5) < 1e-9;
      localStorage.removeItem('cd_save');

      backToMenu();
      return { inPool, defaultsOne, applyOk, dmgNoCrit, dmg1, dmg15, baseCritOk, ampCritOk,
               ratioOk, nonCritInert, wildcardCanRoll, loaded, restored };
    });
    check('Critical Mass is a legendary perk in the pool', r.inPool);
    check('freshPerkState defaults critMult=1 (save-safe)', r.defaultsOne);
    check('apply() adds +10% crit chance and ×1.5 crit multiplier', r.applyOk);
    check('a crit hit deals base ×2.5 with critMult=1', r.baseCritOk, `noCrit=${r.dmgNoCrit} crit=${r.dmg1}`);
    check('Critical Mass amplifies a crit to ×3.75 (base ×2.5 ×1.5)', r.ampCritOk, `dmg15=${r.dmg15}`);
    check('crit damage scales exactly ×1.5 with the perk', r.ratioOk, `ratio=${r.dmg15 / r.dmg1}`);
    check('critMult does NOT change a non-crit hit', r.nonCritInert, `nonCritAmp vs base`);
    check('resolveWildcard can roll Critical Mass', r.wildcardCanRoll);
    check('save/reload round-trips critMult', r.loaded === true && r.restored);
    check('no console errors during Critical Mass test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [131] Rank-tinted tower barrels (v2.21.0): cosmetic veterancy follow-up. towerBarrelTint(t)
  // returns the rank colour for a veteran+ tower (null for Rookie / buff towers); draw() uses it
  // to tint the barrel. No stat effect; derived from saved kills so ranks survive a resume.
  console.log('\n[131] Rank-tinted tower barrels (veterancy cosmetic)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const exists = typeof towerBarrelTint === 'function';
      // null below the first veteran milestone; rank colour at/above each threshold.
      const rookieNull = towerBarrelTint({ type:'gun', kills:0 }) === null &&
                         towerBarrelTint({ type:'gun', kills:14 }) === null;
      const vet = towerBarrelTint({ type:'gun', kills:15 })  === TOWER_RANKS[1].color;
      const elite = towerBarrelTint({ type:'gun', kills:40 }) === TOWER_RANKS[2].color;
      const ace = towerBarrelTint({ type:'gun', kills:90 })   === TOWER_RANKS[3].color;
      const legend = towerBarrelTint({ type:'gun', kills:200 }) === TOWER_RANKS[4].color;
      // colours are real, non-null strings for veteran+ tiers.
      const colorsOk = [1,2,3,4].every(i => typeof TOWER_RANKS[i].color === 'string' && TOWER_RANKS[i].color);
      // buff towers never rank → always null even with a (nonsensical) kill count.
      const buffNull = towerBarrelTint({ type:'buff', kills:500 }) === null;
      const nullSafe = towerBarrelTint(null) === null;

      // draw() must render cleanly with ranked towers (incl. a Legend mid-promotion flash) on the board.
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0;
      towers.push({ type:'gun', x:140, y:140, range:120, dmg:10, rate:0.5, cd:0, level:3,
        baseCost:50, invested:120, angle:0.4, mode:'first', spec:null, dealt:9000, kills:200, buffPower:0.25, flash:0, rankFlash:1 });
      towers.push({ type:'sniper', x:240, y:180, range:200, dmg:30, rate:1.2, cd:0, level:2,
        baseCost:80, invested:80, angle:1.2, mode:'first', spec:null, dealt:3000, kills:40, buffPower:0.25, flash:0 });
      towers.push({ type:'buff', x:300, y:300, range:45, dmg:0, rate:1, cd:0, level:1,
        baseCost:60, invested:60, angle:0, mode:'first', spec:null, dealt:0, kills:0, buffPower:0.25, flash:0 });
      let drew = true; try { draw(); } catch (e) { drew = 'ERR:' + e.message; }

      backToMenu(); localStorage.removeItem('cd_save');
      return { exists, rookieNull, vet, elite, ace, legend, colorsOk, buffNull, nullSafe, drew };
    });
    check('towerBarrelTint helper exists', r.exists);
    check('Rookie / sub-milestone tower has no barrel tint (null)', r.rookieNull);
    check('Veteran tower tints to its rank colour (15 kills)', r.vet);
    check('Elite tower tints to its rank colour (40 kills)', r.elite);
    check('Ace tower tints to its rank colour (90 kills)', r.ace);
    check('Legend tower tints to its rank colour (200 kills)', r.legend);
    check('veteran+ rank colours are real non-null strings', r.colorsOk);
    check('buff towers never get a barrel tint (always null)', r.buffNull);
    check('towerBarrelTint(null) is null-safe', r.nullSafe);
    check('draw() renders ranked towers cleanly', r.drew === true, `${r.drew}`);
    check('no console errors during barrel-tint test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [132] Records "latest personal best" spotlight (v2.22.0)
  console.log('\n[132] Records — latest-PB spotlight');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      ['cd_lastbest_wave', 'cd_lastbest_score',
       'cd_best_classic_normal', 'cd_best_spiral_hard',
       'cd_bestscore_classic_normal', 'cd_bestscore_spiral_hard', 'cd_save']
        .forEach(k => localStorage.removeItem(k));

      // recordBest() stamps the latest beaten WAVE cell (quick, non-daily, first-ever too).
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; daily = false; wave = 11; best = 0;
      recordBest();
      const stampedWave = localStorage.getItem('cd_lastbest_wave') === 'classic_normal';

      // recordScores() stamps the latest beaten SCORE cell independently.
      recordScores(2500);
      const stampedScore = localStorage.getItem('cd_lastbest_score') === 'classic_normal';

      // A second, different cell takes over the stamp.
      mapKey = 'spiral'; diffKey = 'hard'; wave = 7; best = 0;
      recordBest();
      const movedWave = localStorage.getItem('cd_lastbest_wave') === 'spiral_hard';

      // daily / campaign never stamp (mirrors the per-map key gating).
      localStorage.setItem('cd_lastbest_wave', 'classic_normal');
      gameMode = 'campaign'; mapKey = 'classic'; diffKey = 'normal'; wave = 99; best = 0;
      recordBest();
      const campNoStamp = localStorage.getItem('cd_lastbest_wave') === 'classic_normal';
      gameMode = 'quick'; daily = true; wave = 99; best = 0;
      recordBest();
      const dailyNoStamp = localStorage.getItem('cd_lastbest_wave') === 'classic_normal';
      daily = false;

      // renderBests() highlights exactly the stamped cells (★ marker + .justbeat class),
      // and only when that cell actually has a value.
      localStorage.setItem('cd_best_classic_normal', '11');
      localStorage.setItem('cd_bestscore_classic_normal', '2500');
      localStorage.setItem('cd_lastbest_wave', 'classic_normal');
      localStorage.setItem('cd_lastbest_score', 'classic_normal');
      renderBests();
      const body = document.getElementById('bestBody').innerHTML;
      const justbeatCount = (body.match(/class="justbeat"/g) || []).length;   // one per grid
      const hasStar = body.includes('★ 11') && body.includes('★ ' + fmtNum(2500));

      // A stamp pointing at an empty cell must NOT highlight anything.
      localStorage.setItem('cd_lastbest_wave', 'serpent_easy');
      localStorage.setItem('cd_lastbest_score', 'serpent_easy');
      renderBests();
      const emptyNoHl = !document.getElementById('bestBody').innerHTML.includes('class="justbeat"');

      // No stamp at all → no highlight (old saves without the keys).
      localStorage.removeItem('cd_lastbest_wave'); localStorage.removeItem('cd_lastbest_score');
      renderBests();
      const absentNoHl = !document.getElementById('bestBody').innerHTML.includes('class="justbeat"');

      ['cd_lastbest_wave', 'cd_lastbest_score',
       'cd_best_classic_normal', 'cd_best_spiral_hard',
       'cd_bestscore_classic_normal', 'cd_bestscore_spiral_hard']
        .forEach(k => localStorage.removeItem(k));
      return { stampedWave, stampedScore, movedWave, campNoStamp, dailyNoStamp,
               justbeatCount, hasStar, emptyNoHl, absentNoHl };
    });
    check('recordBest() stamps the latest beaten wave cell', r.stampedWave);
    check('recordScores() stamps the latest beaten score cell', r.stampedScore);
    check('a newer beaten cell takes over the wave stamp', r.movedWave);
    check('campaign never stamps a latest-PB cell', r.campNoStamp);
    check('daily never stamps a latest-PB cell', r.dailyNoStamp);
    check('renderBests highlights the stamped cell in both grids', r.justbeatCount === 2, String(r.justbeatCount));
    check('highlighted cells carry a ★ marker', r.hasStar);
    check('a stamp on an empty cell highlights nothing', r.emptyNoHl);
    check('no stamp (old save) highlights nothing', r.absentNoHl);
    check('no console errors during latest-PB spotlight test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [133] Pulsar tower — the 11th: a self-centred radial AoE pulse that hits ALL enemies in range (v2.23.0)
  console.log('\n[133] Pulsar tower (radial AoE pulse)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      // definitions present & wired
      const def = TOWER_TYPES.pulsar;
      const defOk = !!def && def.proj === 'nova' && def.range > 0 && def.dmg > 0;
      const specsOk = Array.isArray(SPECS.pulsar) && SPECS.pulsar.length === 2
        && SPECS.pulsar.some(s => s.id === 'pulsepower') && SPECS.pulsar.some(s => s.id === 'pulsewide');
      const masteryOk = !!TALENTS.mastery_pulsar && TALENTS.mastery_pulsar.sect === 'TOWER MASTERY';
      const inShopKeys = TYPE_KEYS.includes('pulsar') && TYPE_KEYS.length === 11;
      const sfxOk = typeof SFX.pulsar === 'function';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const shopHasPulsar = !!document.querySelector('#shop') &&
        Array.prototype.some.call(document.querySelectorAll('.towerBtn'), b => /Pulsar/.test(b.textContent));

      // specs: Overload = +40% dmg (effDmg); Resonance = +30% radius (effRange)
      const pt0 = { type:'pulsar', x:100, y:300, level:1, spec:null, dmg:100, rate:0.8, range:85,
                    dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      const dBase = effDmg(pt0), rgBase = effRange(pt0);
      pt0.spec = 'pulsepower'; const powerOk = Math.abs(effDmg(pt0) - dBase * 1.4) < 1e-6;
      pt0.spec = 'pulsewide';  const wideOk  = Math.abs(effRange(pt0) - rgBase * 1.3) < 1e-6;
      pt0.spec = null;

      // firePulse: hits EVERY enemy within range at once, but NOT one beyond range.
      towers.length = 0; enemies.length = 0; rings.length = 0;
      const pz = { type:'pulsar', x:100, y:300, level:1, spec:null, dmg:6, rate:0.8, range:85,
                   dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      const mk = (x, y, extra) => Object.assign({ x, y, r:12, hp:500, maxHp:500, armor:0, dead:false,
        flash:0, kind:'norm', blinkInvuln:0, bounty:1, dist:0 }, extra || {});
      const near1 = mk(120, 300);            // 20px away — inside
      const near2 = mk(100, 360);            // 60px away — inside
      const farE  = mk(100, 500);            // 200px away — outside
      enemies.push(near1, near2, farE);
      firePulse(pz, 6);
      const hitAllInRange = near1.hp < 500 && near2.hp < 500;
      const missedFar     = farE.hp === 500;
      const ringDrawn     = rings.length > 0;

      // respects armor (a coherent pulse, not an armor-ignorer)
      enemies.length = 0;
      const armored = mk(110, 300, { hp:1000, maxHp:1000, armor:50, kind:'shield' });
      enemies.push(armored);
      firePulse(pz, 100);
      const respectsArmor = (1000 - armored.hp) < 100 && armored.hp < 1000;

      // skips intangible (phantom/cloak) enemies mid-blink
      enemies.length = 0;
      const ghost = mk(110, 300, { blinkInvuln: 0.3 });
      enemies.push(ghost);
      firePulse(pz, 50);
      const skipsIntangible = ghost.hp === 500;

      // drive the real update() fire loop: a pulsar clears a small bunched swarm around it.
      towers.length = 0; enemies.length = 0; rings.length = 0; projectiles.length = 0;
      autoStartTimer = -1; waveActive = false; paused = false;
      const cpt = pointAt(pathLen * 0.4);
      const pulsar = { type:'pulsar', x:cpt.x, y:cpt.y, level:1, spec:null, dmg:30, rate:0.8, range:85,
                       dealt:0, kills:0, buffPower:0.25, mode:'first', cd:0, flash:0, angle:0 };
      towers.push(pulsar);
      for (let i = 0; i < 4; i++) {
        enemies.push({ kind:'norm', hp:40, maxHp:40, spd:0, r:12, bounty:1, color:'#fff', armor:0,
          gap:0, dist:pathLen*0.4, x:cpt.x + (i-2)*10, y:cpt.y, slow:0, slowF:0.6, frozen:0, hasted:0,
          warded:0, adrenaline:false, ccImmune:false, poison:null, flash:0, px:0, py:0, dead:false, blinkInvuln:0 });
      }
      let cleared = false;
      for (let i = 0; i < 600; i++) { update(1/60); if (enemies.length === 0) { cleared = true; break; } }
      const swarmCleared = cleared && pulsar.kills > 0;

      // save/resume: pulsar round-trips (rebuilt generically from base × level mults)
      towers.length = 0; enemies.length = 0; rings.length = 0;
      towers.push({ type:'pulsar', x:250, y:250, level:3, spec:'pulsepower', mode:'strong',
        invested:260, dealt:88, kills:9, range:def.range*Math.pow(1.08,2), dmg:def.dmg*Math.pow(1.45,2),
        rate:def.rate*Math.pow(0.88,2), cd:0, baseCost:def.cost, angle:0, buffPower:0.25, flash:0 });
      wave = 2; lives = 20; gold = 100; waveActive = false;
      saveRun();
      towers.length = 0;
      const loaded = loadRun();
      const prt = towers.find(t => t.type === 'pulsar');
      const roundTrips = loaded === true && !!prt && prt.level === 3 && prt.spec === 'pulsepower' && prt.kills === 9;

      localStorage.removeItem('cd_save');
      backToMenu();
      return { defOk, specsOk, masteryOk, inShopKeys, sfxOk, shopHasPulsar, powerOk, wideOk,
               hitAllInRange, missedFar, ringDrawn, respectsArmor, skipsIntangible, swarmCleared, roundTrips };
    });
    check('Pulsar definition wired (proj=nova/range/dmg)', r.defOk);
    check('Pulsar has 2 specs (Overload + Resonance)', r.specsOk);
    check('Pulsar Mastery talent exists', r.masteryOk);
    check('Pulsar is in the shop keys and there are now 11 towers', r.inShopKeys);
    check('SFX.pulsar sound exists', r.sfxOk);
    check('Pulsar button rendered in the shop', r.shopHasPulsar);
    check('Overload spec = +40% damage', r.powerOk);
    check('Resonance spec = +30% pulse radius', r.wideOk);
    check('firePulse hits ALL enemies within range at once', r.hitAllInRange);
    check('firePulse does NOT hit an enemy beyond range', r.missedFar);
    check('firePulse emits a ring effect', r.ringDrawn);
    check('Pulsar respects armor', r.respectsArmor);
    check('firePulse skips intangible (blinking) enemies', r.skipsIntangible);
    check('a Pulsar clears a bunched swarm via the real update loop', r.swarmCleared);
    check('Pulsar save/resume round-trips', r.roundTrips);
    check('no console errors during Pulsar test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  // [134] Grid placement readability — visible grid lines + snap "tick" SFX on cell change (v2.24.0)
  console.log('\n[134] Grid placement lines + snap tick (v2.24.0)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      const sfxOk = typeof SFX.tick === 'function';

      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      towers.length = 0; gameOver = false; paused = false; armedAbility = null;
      selectedTower = null; selectedShop = 'gun';

      // spy on the snap tick
      let ticks = 0; const realTick = SFX.tick; SFX.tick = () => { ticks++; };

      // grid snap ON: draw with the ghost in cell A, then cell B → one tick on the crossing.
      gridSnap = true;
      mouseX = 200; mouseY = 200; draw();
      const cellA = _placeSnapCell;                      // set on first frame, no tick yet
      const noTickFirstFrame = ticks === 0 && typeof cellA === 'string' && /^\d+,\d+$/.test(cellA);

      mouseX = 200 + PLACE_GRID * 2; mouseY = 200; draw(); // crosses into a new cell
      const cellB = _placeSnapCell;
      const tickedOnCross = ticks === 1 && cellB !== cellA;

      draw(); // same cell again → no extra tick
      const noTickSameCell = ticks === 1;

      // not placing (no shop tower selected) → cell resets, no spurious tick on re-entry
      selectedShop = null; draw();
      const resetWhenIdle = _placeSnapCell === null;
      selectedShop = 'gun'; mouseX = 200; mouseY = 200; draw(); // re-enter: first frame, still no tick
      const noTickOnReentry = ticks === 1;

      // grid snap OFF: no tick, cell stays null even while placing
      gridSnap = false; ticks = 0; mouseX = 400; mouseY = 250; draw();
      mouseX = 460; draw();
      const noTickWhenSnapOff = ticks === 0 && _placeSnapCell === null;

      SFX.tick = realTick;
      gridSnap = true;
      selectedShop = null; _placeSnapCell = null;
      backToMenu(); localStorage.removeItem('cd_save');
      return { sfxOk, noTickFirstFrame, tickedOnCross, noTickSameCell, resetWhenIdle,
               noTickOnReentry, noTickWhenSnapOff };
    });
    check('SFX.tick snap sound exists', r.sfxOk);
    check('placing: first frame sets the snapped cell with no tick', r.noTickFirstFrame);
    check('snap tick fires exactly once when the ghost crosses into a new cell', r.tickedOnCross);
    check('no extra tick while the ghost stays in the same cell', r.noTickSameCell);
    check('snapped cell resets to null when not placing', r.resetWhenIdle);
    check('no spurious tick on re-entering placement', r.noTickOnReentry);
    check('grid-snap OFF: no tick and snapped cell stays null', r.noTickWhenSnapOff);
    check('no console errors during grid-line/snap-tick test', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.close();
  }

  console.log('\n[135] Vortex map (inward-spiral kill-funnel + Neon theme)');
  {
    const { page, consoleErrors } = await newPage(browser);

    // Map definition: present, named, well-formed axis-aligned path enters off-left, exits off-right.
    const def = await page.evaluate(() => {
      const m = MAPS.vortex;
      const pts = m && m.pts;
      let axisAligned = !!pts && pts.length >= 4;
      if (pts) for (let i = 0; i < pts.length - 1; i++) {
        const sameX = pts[i][0] === pts[i + 1][0], sameY = pts[i][1] === pts[i + 1][1];
        if (sameX === sameY) { axisAligned = false; break; }   // both same (zero-len) or neither (diagonal)
      }
      const inBounds = !!pts && pts.every(([x, y]) => x >= -40 && x <= 940 && y >= 0 && y <= 560);
      return {
        exists: !!m, named: !!m && typeof m.name === 'string' && m.name.length > 0,
        hasPath: Array.isArray(pts), axisAligned, inBounds,
        entersLeft: !!pts && pts[0][0] === -30, exitsRight: !!pts && pts[pts.length - 1][0] === 930,
        notLast: Object.keys(MAPS).indexOf('vortex') < Object.keys(MAPS).indexOf('mayhem'),
      };
    });
    check('Vortex map exists and is named', def.exists && def.named);
    check('Vortex has an axis-aligned path (no diagonals/zero-length segs)', def.axisAligned);
    check('Vortex path stays within the board', def.inBounds);
    check('Vortex path enters off-left (-30) and exits off-right (930)', def.entersLeft && def.exitsRight);
    check('Vortex sits before Mayhem in the map order', def.notLast);

    // Theme: Neon palette exists and is the map's fixed identity.
    const theme = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'vortex'; diffKey = 'normal';
      const fixed = MAP_THEME.vortex;
      const hasPalette = !!THEMES.neon && typeof THEMES.neon.glow === 'string';
      const inCampaignPool = CAMPAIGN_THEMES.includes('neon');
      const picks = pickMapTheme();              // quick-mode vortex -> fixed neon
      beginGame();
      const resolved = mapTheme;                 // resetState() set it via pickMapTheme()
      const pal = mapPalette();                  // concrete palette for the frame
      const ok = pal && pal.glow === THEMES.neon.glow;
      backToMenu(); localStorage.removeItem('cd_save');
      return { fixed, hasPalette, inCampaignPool, picks, resolved, ok };
    });
    check('Neon theme palette exists', theme.hasPalette);
    check('Vortex maps to the Neon theme', theme.fixed === 'neon' && theme.picks === 'neon');
    check('Neon is available to the campaign palette pool', theme.inCampaignPool);
    check('a Vortex run resolves to the Neon palette', theme.resolved === 'neon' && theme.ok);

    // The map appears as a selectable button on the start screen.
    const btn = await page.evaluate(() => {
      renderStartScreen();
      return /Vortex/.test(document.getElementById('mapRow').innerHTML);
    });
    check('Vortex appears in the start-screen map selector', btn);

    // The path genuinely crosses itself (the spiral/funnel identity): the inner vertical
    // descent at x=490 and the inner horizontal run at y=380 intersect at (490,380).
    const crosses = await page.evaluate(() => {
      const pts = MAPS.vortex.pts;
      const onSeg = (a, b, px, py) => {
        if (a[0] === b[0]) return a[0] === px && py >= Math.min(a[1], b[1]) && py <= Math.max(a[1], b[1]);
        return a[1] === py && px >= Math.min(a[0], b[0]) && px <= Math.max(a[0], b[0]);
      };
      let hits = 0;
      for (let i = 0; i < pts.length - 1; i++) if (onSeg(pts[i], pts[i + 1], 490, 380)) hits++;
      return hits;
    });
    check('Vortex path crosses itself at the inner funnel (490,380)', crosses >= 2, 'hits=' + crosses);

    // A real run drives to completion on the new path (pathing/spawning work, no hang).
    const drove = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'vortex'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const pathOk = pathLen > 1000 && Array.isArray(waypoints) && waypoints === MAPS.vortex.pts;
      __cdGodTowers(8);
      __cdDrive({ maxWave: 6 });
      const out = { reached: wave >= 5, wave, pathOk };
      backToMenu(); localStorage.removeItem('cd_save');
      return out;
    });
    check('Vortex buildPath wires the static path', drove.pathOk, JSON.stringify(drove));
    check('a Vortex run drives clean to wave 5+', drove.reached, JSON.stringify(drove));

    // Records: a finished quick run logs a per-map best under cd_best_vortex_<diff>,
    // and the map validates on save/resume (loadRun accepts MAPS[mapKey]).
    const rec = await page.evaluate(() => {
      localStorage.removeItem('cd_best_vortex_hard');
      gameMode = 'quick'; mapKey = 'vortex'; diffKey = 'hard';
      beginGame();
      best = 0; wave = 9; lives = 0;
      endGame();
      const mapBest = +(localStorage.getItem('cd_best_vortex_hard') || 0);

      // save/resume round-trip on the static map
      gameMode = 'quick'; mapKey = 'vortex'; diffKey = 'normal';
      beginGame(); wave = 3;
      saveRun();
      const loaded = loadRun();
      const restored = loaded === true && mapKey === 'vortex';

      ['cd_best_vortex_hard', 'cd_best_hard', 'cd_save'].forEach(k => localStorage.removeItem(k));
      backToMenu();
      return { mapBest, restored };
    });
    check('Vortex records a per-map best (hard = 9)', rec.mapBest === 9, JSON.stringify(rec));
    check('Vortex save/resume round-trips', rec.restored, JSON.stringify(rec));

    check('no console errors during Vortex map test', consoleErrors.length === 0, consoleErrors.join(' | '));
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
