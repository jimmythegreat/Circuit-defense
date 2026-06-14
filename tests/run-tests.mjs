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

  // ---- Test 44: boss HP slope steepened 0.5 -> 0.6 (v1.24.4, "too easy" FEEDBACK) ----
  console.log('\n[44] Boss HP slope (late-game difficulty)');
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
                 pct: (boss.hp / (tmpl * oldMult) - 1) * 100 };  // swing vs the old 0.5 slope
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

  // [45] Boss archetypes — regen / summoner / bulwark / enrager / teleporter / berserker / disruptor (v1.25.0+)
  console.log('\n[45] Boss archetypes (regen/summoner/bulwark/enrager/teleporter/berserker/disruptor)');
  {
    const { page, consoleErrors } = await newPage(browser);
    const r = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();

      // Archetypes only attach from wave 20+; earlier (tutorial) bosses stay vanilla.
      const bt = w => (buildWave(w).find(e => e.kind === 'boss') || {}).bossType;
      const vanillaEarly = bt(5) === undefined && bt(10) === undefined && bt(15) === undefined;
      // Rotation by boss number: (w/5 - 4) % 7 → regen, summoner, bulwark, enrager, teleporter,
      // berserker, disruptor, then wraps (w55 → regen again).
      const rotation = bt(20) === 'regen' && bt(25) === 'summoner'
                    && bt(30) === 'bulwark' && bt(35) === 'enrager'
                    && bt(40) === 'teleporter' && bt(45) === 'berserker'
                    && bt(50) === 'disruptor' && bt(55) === 'regen';

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

      enemies.length = 0; pendingSpawns.length = 0; towers.length = 0;
      backToMenu(); localStorage.removeItem('cd_save');
      return { vanillaEarly, rotation, regenHeals, frozenNoHeal, shieldSoaks, shieldRaised, adds, summonerCapped, enrageHastes, frozenNoHaste, blinked, sawInvuln, frozenNoBlink, frozenInvulnDecays, berserkerAccelerates, frozenNoRush, disruptorEmps, frozenNoEmp, buffImmune };
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

    // Each archetype boss is still KILLABLE — inject one of each at modest HP, co-located
    // with a god tower at a real path point (pointAt(d) returns proper {x,y}; raw
    // waypoints are [x,y] arrays), then confirm it dies within a bounded sim (no immortal
    // mechanic / hang). Even the bulwark's damage-soak only delays, never blocks, a kill.
    const killable = await page.evaluate(() => {
      gameMode = 'quick'; mapKey = 'classic'; diffKey = 'normal'; campLevel = 1;
      beginGame();
      const sp = pointAt(60);
      const results = {};
      for (const bt of ['regen', 'bulwark', 'summoner', 'enrager', 'teleporter', 'berserker', 'disruptor']) {
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
      const bossArmorAdds = armoredBoss.armor === (10 * 0.4) + 8;

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
    check('achievement roster grew to 15 badges', r.total === 15, `total=${r.total}`);
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

      // No talent was removed — all 21 keys survive (each maps to a distinct mechanic).
      const keptAll = Object.keys(TALENTS).length === 21;

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
    check('all 21 talents retained (none removed)', r.keptAll);
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
