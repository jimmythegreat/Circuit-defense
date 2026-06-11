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

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_URL = pathToFileURL(resolve(__dirname, '..', 'tower-defense.html')).href;

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

    await page.evaluate(() => { localStorage.removeItem('cd_save'); });
    check('no console errors during combo tests', consoleErrors.length === 0, consoleErrors.join(' | '));
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
