'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
// Logical board size — captured from the HTML attributes (900×560) BEFORE any
// high-DPI resize below, so all game logic (paths, coords, clicks) stays in this
// fixed logical space no matter the device pixel ratio.
const W = cv.width, H = cv.height;

// High-DPI canvas (v1.17.0): the backing store defaults to the logical W×H, so on
// Retina / 4K / 150%-scaled Windows displays the browser upsamples it and towers /
// text render slightly soft. Size the backing store to W·dpr × H·dpr and scale the
// context once, so every draw call keeps using logical 0..W / 0..H coords while the
// pixels are crisp. The CSS pins the display box to the logical size (canvas rule
// `width:900px; height:auto`), so this never changes layout. dpr is capped at 2 to
// bound the fill cost on huge ratios, and skipped entirely at dpr=1 (standard
// displays + the headless test harness → byte-identical behaviour). Input is
// unaffected: pointer/click coords are derived from getBoundingClientRect().
const DPR = Math.max(1, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
if (DPR > 1) {
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ctx.scale(DPR, DPR);   // persists across frames — draw() never resets the transform
}

// Accessibility: honour the OS "reduce motion" setting — when on, the render loop
// skips screen-shake (the most motion-sensitive effect). Read live so toggling the
// OS setting takes effect without a reload; guarded for environments w/o matchMedia.
let _rmQuery = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function reduceMotion() { return !!(_rmQuery && _rmQuery.matches); }

// Touch ergonomics (v1.16.3): detect a coarse pointer (finger) so the canvas tap
// handler can use a more generous tower-tap radius — on a phone the board scales to
// ~374px (logical 900), so an 18px logical hit radius is only ~7px on screen, making
// towers hard to select. Read live (a 2-in-1 can switch), guarded for no-matchMedia.
let _cpQuery = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(pointer: coarse)') : null;
function coarsePointer() { return !!(_cpQuery && _cpQuery.matches); }

// User render/performance prefs (Settings panel, v1.13.0) — persisted on this device,
// independent of the OS reduce-motion gate. shakeEnabled gates screen-shake;
// particleDensity (1=Full, 0.5=Reduced, 0=Off) scales burst particle counts.
let shakeEnabled = localStorage.getItem('cd_shake') !== '0';   // default ON
let particleDensity = (() => {
  const v = localStorage.getItem('cd_particles');
  return v === null ? 1 : Math.max(0, Math.min(1, +v || 0));
})();
// Colorblind aid (Settings panel, v1.18.0) — when ON, the enemy kinds that are
// currently distinguished by HUE ONLY (fast=purple, tank=orange) also render a
// distinct symbol, so every kind reads as a unique glyph rather than a colour.
// Persisted on this device, default OFF. See enemyGlyph() in cd-render.js.
let colorblindAid = localStorage.getItem('cd_colorblind') === '1';

// Grid placement (Settings panel, v1.24.0 — owner FEEDBACK "the spaces to place the
// turrets were more of a grid so you could line them up cleaner"). When ON, a tower's
// placement point snaps to the centre of a PLACE_GRID cell, so towers align into tidy
// rows/columns. PLACE_GRID === the 32px minimum placement gap, so cells in adjacent rows/
// columns are exactly 32 apart and stay placeable (canPlace forbids < 32). Persisted on
// this device, default ON (the owner asked for it). Selection still uses the raw cursor;
// only the placement target snaps. Cosmetic/UX only — no economy/save impact.
let gridSnap = localStorage.getItem('cd_gridsnap') !== '0';   // default ON
const PLACE_GRID = 32;
function snapGridCoord(v) { return Math.floor(v / PLACE_GRID) * PLACE_GRID + PLACE_GRID / 2; }
function placeCoord(x, y) { return gridSnap ? { x: snapGridCoord(x), y: snapGridCoord(y) } : { x, y }; }

// ================= Version & What's New =================
const GAME_VERSION = 'v1.34.0';
// Most recent first. Show the FULL history (owner preference, v1.13.5 — do not trim
// to a recent-N window; the panel scrolls). Mirrors CHANGELOG.md headings.
const CHANGELOG_ENTRIES = [
  { v: 'v1.34.0', date: '2026-06-13', time: '18:05 EDT', body: "New content — a fourth boss archetype: 😡 the Enrager. From wave 20 onward, the every-5th-wave boss carries a special mechanic (it used to cycle through three — self-Regen, Summoner, and the damage-soaking Bulwark shield — and now there are four). The Enrager projects a haste aura: every enemy near it moves 35% faster, marked by a faint orange ring, and the boss itself glows orange so you can spot it coming. A pack escorted by an Enrager rushes your towers and reaches the exit sooner, so it pressures your damage and timing without simply adding more health — and a fast escort can overwhelm a defense that was comfortable a moment ago. Counters: freezing the boss pauses its aura entirely (a frozen Enrager can't speed anyone up), and Frost slows still apply on top of the haste, so crowd-control answers it directly. Like the other archetypes it only appears on deep (wave 20+) bosses — early/tutorial bosses are unchanged — and it's pure run-time behavior, so there's no effect on your saves, gold, or the rest of the game. Hardens the late game through behavior rather than raw HP." },
  { v: 'v1.33.0', date: '2026-06-13', time: '16:40 EDT', body: "New content — a tenth Mayhem wave modifier: 💚 Regeneration. When it rolls on a wave, every enemy in that wave (the boss included) slowly heals itself — 2% of its maximum health per second — for as long as it's alive on the path. A small green halo marks the regenerating enemies so you can see who's healing. It won't matter if your towers are already shredding the wave, but if your damage is marginal those stragglers will keep patching themselves up and start leaking through — so it rewards burst and sustained DPS and punishes an under-built defense, without simply piling on more raw health. Counters: freezing an enemy pauses its regen (Frost towers, the Freeze ability), and anything that bursts a target down fast beats the heal outright. Like all Mayhem twists it's per-wave and Mayhem-only — it never touches Classic or Campaign play, your saves, or the economy. (It also shows up in the seeded Daily Challenge's modifier rotation.)" },
  { v: 'v1.32.1', date: '2026-06-13', time: '15:30 EDT', body: "🩺 Health check (the every-6th-run maintenance pass — no new feature, just keeping things solid) plus one small fix. The full automated test suite is green (465 checks across 51 groups, zero failures) with zero console errors, the game still loads and plays by double-clicking the file (classic script tags in order, no ES modules, inline favicon, no build step, all paths relative — offline play intact), and old saves still migrate cleanly. Checked the maintainer docs against the actual code — every number still matches (8 towers, 21 talents, 9 Mayhem wave modifiers, 13 achievements, booster aura range 45, boss HP slope ×0.6/wave, Glass Cannon +50% dmg / −30% range). The fix: the installable-PWA's offline cache version was still stamped 'v1.30.0' even though the game had moved on to v1.32.0 — so a player who'd installed the hosted web-app could have kept getting the older cached version offline instead of the latest. Bumped it to match (v1.32.1) and added a test that fails if it ever falls out of sync again, so future updates can't silently ship a stale offline cache. This only affects the hosted/installed web-app; double-click-the-file play and your saves are completely unaffected. Remaining polish on the list: gamepad support and splitting the (dev-only) test file, now ~2900 lines." },
  { v: 'v1.32.0', date: '2026-06-13', time: '14:40 EDT', body: "New content — 🔮 Glass Cannon, a new legendary perk for the every-5-waves draft. It's a true high-risk / high-reward trade: ALL your towers hit 50% harder, but their firing range shrinks by 30%. That extra punch can melt tanks and bosses, but the shorter reach means each tower covers far less of the path, so you'll want to place them tightly along the action and lean on slows or chokepoints to keep enemies in range. Unlike most upgrades it's a genuine choice rather than a free win — the lost coverage is a real cost, so it rewards smart placement instead of just snowballing an already-comfortable run. (The range cut applies to attacking towers only; booster auras are unaffected, since boosters don't deal damage.) Save-safe and offline like everything else — it slots into the existing perk system, persists across save/resume, and has no effect on older saves, gold, chips, or your other progress." },
  { v: 'v1.31.0', date: '2026-06-13', time: '13:05 EDT', body: "New content — a 🔥 Daily streak! The Daily Challenge now rewards showing up every day. Each calendar day you finish today's daily run (win, lose, or play on into endless — any finish counts), your streak grows by one; miss a day and it resets. Your current streak appears right on the 🗓 Daily Challenge button (e.g. '🔥5d' once you're two days deep) and in the 🏆 Records panel, with a tooltip nudging you to play and keep it alive. Playing the daily more than once in a day won't pad the count — it's one per calendar day — and the streak is purely a 'keep your run going' loop: it has no effect on gameplay, difficulty, gold, chips, or any of your other progress. Like the rest of the Daily Challenge it's fully offline (the day is read from your device's local clock, no network), and it lives in its own new save field, so existing saves are untouched and simply start at zero. A natural follow-up to the v1.28.0 Daily Challenge for anyone who likes a reason to come back tomorrow." },
  { v: 'v1.30.0', date: '2026-06-13', time: '11:30 EDT', body: "Install it like an app — Circuit Defense is now a PWA (progressive web app). When you play the online (hosted) version, your browser will offer to install/add it to your home screen or desktop, after which it opens in its own clean window with no address bar — and, thanks to a small offline cache, it keeps working even with no connection. This is especially handy on phones: tap your browser's 'Add to Home Screen' and you get a proper app icon (the gold ⚡ bolt) that launches straight into the game. Under the hood this adds a web-app manifest, an app icon, and a service worker that caches the game's files on first visit so return visits load instantly and offline. Important: none of this changes the double-click-the-file experience — opening the game from a local file is still a pure, no-network, no-install static page (service workers simply don't apply there), and there's still no build step. No effect on gameplay, balance, or your saves — this is pure packaging/polish." },
  { v: 'v1.29.0', date: '2026-06-12', time: '23:30 EDT', body: "New content — four fresh achievement badges to chase (the trophy collection grows from 9 to 13)! 🕊️ Pacifist — win a game without ever casting an ability (no Meteor, Freeze, or Gold Rush): a pure-towers challenge. 🧩 Specialist — win using only ONE type of tower (an all-cannon or all-frost run, say), rewarding a committed mono-build. ⚖️ Minimalist — win with 5 or fewer towers placed, for the efficient defenders who'd rather upgrade than sprawl. 🗓️ Daily Devotee — reach wave 20 in the Daily Challenge, giving the new daily run something extra to play for. They all show up in the 🏅 Achievements panel and pop the usual unlock toast on the end screen. Save-safe and purely additive — no effect on balance, gold, or your existing progress; the new badges just start locked and unlock the first time you pull them off. (Two notes: the mono-tower and minimalist checks read your final board at the moment of victory, and Pacifist can only be earned on a run played start-to-finish — resuming a saved game can't verify you went ability-free earlier, just like the existing Flawless badge.)" },
  { v: 'v1.28.0', date: '2026-06-12', time: '22:30 EDT', body: "New mode — 🗓 Daily Challenge! A fresh button on the start screen launches today's seeded run: the map path, the difficulty, and the whole sequence of Mayhem wave-modifiers are all decided by today's date, so every player faces the exact SAME challenge today — a built-in way to compare scores day to day (and against yourself). It plays like a Mayhem run (animated 'world on fire' theme, wild per-wave twists) but with one key difference: the map is FIXED for the day — it never re-shuffles every 5 waves — so the run is fully comparable. The difficulty is locked to Normal or Hard by the seed (a daily is meant to be a test, never Easy). Your best wave for each day is tracked under its own record (shown on the Daily button and in the 🏆 Records panel), completely separate from your normal map records. A daily is a one-off: it isn't saved or resumable, and — importantly — starting one does NOT disturb your normal saved run, so you can hop into today's challenge and still Resume your campaign afterwards. Comes back fresh at local midnight. Offline-safe like everything else (the seed is derived from your device's date, no network). No effect on your saves, chips, or any existing balance." },
  { v: 'v1.27.1', date: '2026-06-12', time: '21:35 EDT', body: "🩺 Health check (the every-6th-run maintenance pass — no new feature this time, just making sure everything is still solid). The whole automated test suite passes (393 checks across 47 groups, zero failures) with zero console errors, and the game still loads and plays by double-clicking the file — classic script tags in the right order, no ES modules, inline favicon, no build step, all paths relative, so offline play is intact. Old saves still migrate cleanly (a minimal pre-update save loads via the additive defaults: achievements/stats, perk state, map theme). Checked the maintainer docs against the actual code — every number still matches: 8 towers, 21 talents, 9 Mayhem wave modifiers, booster aura range 45, the boss HP slope (×0.6/wave), and the enemy-HP curve. Versions are consistent everywhere (v1.27.1). All game source files stay well under the size cap (largest ~713 lines) with no dead code, leftover debug logging, or TODOs, and the online deploy is still a correct static copy of the raw files. Nothing to fix — logged that the dev-only test file is now the biggest file in the repo (2559 lines) and worth splitting soon, and that gamepad + installable-PWA support remain the next polish items." },
  { v: 'v1.27.0', date: '2026-06-12', time: '20:30 EDT', body: "New content — two fresh Mayhem wave modifiers! In Mayhem mode each wave can roll a random twist (Frenzy, Swarm, Titans, Power Surge, Fog, …). Two new ones join the pool: 🛡️ Armored Surge — every enemy in the wave, the boss included, gains a chunk of armor that soaks part of each hit, so your fast low-damage towers suddenly struggle; lean on the Mortar (its shells ignore armor entirely), Poison (corrodes armor on every tick) or the Sniper's armor-piercing path to punch through. 🔌 Brownout — a power dip that makes ALL your towers fire 25% slower for that wave, so the enemies you'd normally shred get more time to advance; bring extra firepower or a Booster to compensate. These round out the tower-stat twists (Power Surge boosts damage, Fog cuts range, and now Brownout cuts fire-rate) and add the first wave modifier that plays with enemy armor. Mayhem-only and per-wave — they never touch the normal/campaign modes, your saves, or the economy." },
  { v: 'v1.26.0', date: '2026-06-12', time: '19:30 EDT', body: "Balance — the Sniper's Executioner specialization gets a real reason to exist. At level 5 a Sniper picks one of two upgrades: Deadeye (20% chance to crit for ×4 damage) or Executioner (bonus damage vs tanks & bosses). The problem: Deadeye's crits work out to about +60% damage on average against EVERYTHING, while Executioner only gave +60% against tanks and bosses and nothing against regular enemies — so Deadeye matched it on the big targets and beat it everywhere else, making Executioner a trap pick. Executioner's bonus is now boosted from +60% to +90% vs tanks & bosses, turning it into the dedicated boss-killer: against the targets that actually matter it now out-damages Deadeye, with no crit-RNG (guaranteed every shot), which is exactly what you want for bursting down a boss before it leaks. Deadeye stays the consistent all-rounder (and still scales with crit talents/perks). With bosses recently getting tankier and gaining special mechanics, a true anti-boss spec finally has a home. No effect on saves, gold, or other towers." },
  { v: 'v1.25.0', date: '2026-06-12', time: '18:40 EDT', body: "New content — boss archetypes! Bosses (every 5th wave) used to be just big health bars. From wave 20 onward, each boss now also carries a special MECHANIC, cycling through three types so deep waves and late campaign levels stay interesting instead of melting to the same army that cleared wave 10. 🟢 Regenerator — slowly heals itself, so if your damage isn't keeping up it'll out-heal you and break through (freezing it pauses the healing). 🔵 Bulwark — periodically raises a shield that soaks 60% of incoming damage for a couple of seconds; its aura ring flares bright while the shield is up, so time your big hits (or just keep the pressure on) for when it drops. 🔴 Summoner — spawns waves of weak minions behind it, splitting your towers' attention and threatening extra leaks if you tunnel-vision the boss. A coloured aura around the boss tells you which kind you're facing, and a short ominous sound plays when a boss uses its power. This hardens the LATE game specifically — the early/tutorial bosses (waves 5/10/15 and the campaign level 1–5 finals) are completely unchanged — and it does so through behaviour rather than yet more health, which the regular difficulty curve is already maxed out on. No effect on your saves, gold, or any tower." },
  { v: 'v1.24.4', date: '2026-06-12', time: '17:25 EDT', body: "Balance: tougher late-game bosses (chipping away at the recurring 'game is too easy' feedback). Every 5th wave is a boss, and a boss's health is the normal enemy's health times a multiplier that grows each wave. That multiplier's per-wave growth is steepened from 0.5 to 0.6, so bosses get relatively tankier the deeper you go — about +3% health at wave 5, +5% at wave 10, +8% at wave 20, +10% at wave 30, up to a hard ceiling of +20% in extreme endless. Early waves are barely touched (the fix targets the documented mid-/late-game plateau, not the opening, which already feels right), and the change is bounded so no single number moves more than the project's per-run balance limit. Why bosses specifically: the regular enemy HP curve is already pushed to its design ceiling, so the boss multiplier is the open lever for making deep waves and late campaign levels demand a real, upgraded defense instead of coasting on an early-built army. No effect on your saves, gold, or any other tower/enemy." },
  { v: 'v1.24.3', date: '2026-06-12', time: '16:10 EDT', body: "Balance: final slice of your 'cut booster range in half' request — the Booster's aura radius drops from 52 to 45. That completes the full halving: across three small steps the base aura range has gone 90 → 68 → 52 → 45 (exactly −50% of where it started), so a single booster now covers only about a quarter of the area it originally did (45²/90²). One booster can no longer blanket a sprawling defense — you'll place it right beside your key towers, build a second for spread-out layouts, or take the Network spec (+50% range), which now matters a lot more off the smaller base. As always the Network spec and Booster Mastery talent widen the aura from this new base, and saves are unaffected — a resumed run's boosters just use the new radius. This closes out the booster-range feedback item." },
  { v: 'v1.24.2', date: '2026-06-12', time: '15:05 EDT', body: "🩺 Health check (every-6th-run maintenance pass — no new feature this time). Verified the whole game is still healthy: full automated test suite passing (356/0 across 43 test groups), zero console errors, and the game still loads and plays by double-clicking the file (classic script tags, inline favicon, no build step). Confirmed old saves still load — a save from before the achievements/stats system, and a minimal pre-update run save, both migrate cleanly and resume. Checked the project docs against the actual code: every formula and number in the maintainer notes still matches (8 towers, booster aura range 52, the enemy-HP curve, the perk rarity odds, 21 talents) — no drift. All game source files remain well under the size cap (largest ~676 lines), with no dead code, leftover debug logging, or stale references. The deploy that publishes the game online is still a correct static copy of the raw files. Nothing to fix — logged a couple of minor follow-ups (the dev-only test file is getting long; gamepad + installable-PWA support remain the next polish items) for future runs." },
  { v: 'v1.24.1', date: '2026-06-12', time: '14:05 EDT', body: "Balance: shrank the Booster's aura range again (second slice of your 'cut booster range in half' request). The booster buffs every tower inside a circle around it; this update drops that radius from 68 to 52 (about −24%, roughly −41% of the area it now covers). On top of the earlier 90→68 cut, a single booster's coverage is now well under half of what it was originally, so one booster can no longer blanket a whole sprawling defense — you'll place it deliberately near your key towers, build a second for spread-out layouts, or lean on the Network spec (+50% range) which matters more off the smaller base. As before, the Network spec and Booster Mastery talent still widen the aura from this new base. Kept to ~a quarter this run per the project's gradual-balance rule; one more small step (52→~45) finishes the full −50%. Saves are unaffected — resumed boosters just use the new radius." },
  { v: 'v1.24.0', date: '2026-06-12', time: '13:20 EDT', body: "Grid placement — line your towers up cleanly! When you go to place a tower, its spot now snaps to a tidy grid so rows and columns stay neat instead of scattered wherever the cursor happened to be. A faint grid of dots fades in while you're placing to show where the slots are, and the placement preview ring sits exactly where the tower will land. The grid is sized to the minimum tower spacing, so neighbouring slots are still buildable — you can pack a clean wall of towers. Prefer free-hand placement? There's a new ▦ Grid snap toggle in ⚙ Settings (default on) to switch it off. Purely a placement-feel change — no effect on damage, economy, or existing saves." },
  { v: 'v1.23.0', date: '2026-06-12', time: '12:15 EDT', body: "New tower — 🎇 Mortar! An eighth tower joins the shop (hotkey 8): a long-range, slow-firing siege piece that lobs an explosive shell which detonates in an area AND completely ignores enemy armor. That makes it a dedicated counter to the heavily-armored crowd — shield enemies, tanks and bosses — which normally shrug off a chunk of every hit; the Mortar's blast lands its full damage on them from clear across the board. The trade-off is a slow reload, so it's about heavy single shots rather than rapid fire, and against ordinary unarmored enemies a Cannon still out-damages it — it's a specialist, not an upgrade. At max level pick a specialization: Demolisher (+35% damage) for raw punch, or Saturation (+55% blast radius) to blanket a bigger group. There's also a new Mortar Mastery talent (+6% damage & +2% range per rank) so you can invest in it permanently like the other towers. No effect on existing saves — a resumed run that never built a Mortar plays exactly as before." },
  { v: 'v1.22.0', date: '2026-06-12', time: '12:30 EDT', body: "New legendary perk — 🩸 Last Stand. A comeback power-up that gets stronger the more lives you've lost in the run: ALL your towers deal +3% damage for every life that has leaked past your defenses, up to a maximum of +60% (reached at 20 lives lost). If you're cruising through a run without losing a single life it does nothing at all — it only kicks in when you're under pressure, turning a near-loss into a dramatic rally. Rolls in the every-5-waves upgrade draft at the rare legendary tier, alongside Diamond Core, Midas Touch and the rest. Designed deliberately so it can't make an already-easy run any easier (a flawless player gets zero benefit) — it's purely a rubber-band for when the boss waves start breaking through. No effect on saves; an in-progress run that picks it up keeps its life-loss tally." },
  { v: 'v1.21.0', date: '2026-06-12', time: '11:05 EDT', body: "Wave preview, upgraded: the between-waves 'Next:' line at the bottom-left of the board now shows the EXACT make-up of the wave you're about to start — a little coloured dot for each enemy kind with how many of them are coming (e.g. ● ×13, » ×3 fast, ◆ ×4 tanks, 🛡 shield, 👻 phantom, ☠ ×1 boss), instead of just listing the kinds by name. Now you can see at a glance whether the next wave is a tank-heavy push or has a boss, and buy/upgrade towers accordingly. The dots use each enemy's own colour and carry the same shape symbols the colourblind aid uses, so it's readable by shape too. Purely a display improvement — no effect on gameplay, balance or saves." },
  { v: 'v1.20.2', date: '2026-06-12', time: '09:15 EDT', body: "🩺 Health check (every-6th-update maintenance pass — no gameplay changes). Full test suite green (zero console errors), all eight code files comfortably within the size limit (largest ~637 lines vs the ~1500 cap), and every documented formula re-verified against the actual code (scoring, enemy-HP scaling, the economy trim, the booster aura power & range, the poison DoT) — all matched. Old saves confirmed to still load via the migration defaults (an old profile with no achievements/stats and an old run with no map-theme both loaded cleanly with full tower stats rebuilt), and double-click/offline play re-verified. Also fixed a flaky test: the economy-trim check measured the gold bank AFTER the random 5-/10-wave perk picks, so a gold perk could push it over the limit and fail by chance — it now checks the deterministic pre-draft economy instead, which is exactly what the trim affects. The remaining 'polished-browser-game' gaps still on the roadmap: gamepad support and an installable/offline web-app manifest (the game is already offline by double-click)." },
  { v: 'v1.20.1', date: '2026-06-12', time: '22:45 EDT', body: "Balance: shrank the Booster's aura range (your request to cut booster range in half). The booster buffs every tower inside a circle around it; that circle was quite large, so one booster could blanket most of your defenses — part of why a single gunner + booster could carry a run. This update is the first half of the cut: the base aura radius drops from 90 to 68 (about −24%, which is ~−43% of the area it covers), so a booster now reaches fewer towers and you'll want to place it more deliberately (or build a second one for spread-out defenses). The Network spec still widens it by +50% and the Booster Mastery talent still adds range, just from the smaller base. Kept to ~a quarter this run per the project's gradual-balance rule; the remaining reduction toward the full −50% will follow over the next couple of updates. Saves are unaffected — a resumed run's boosters simply use the new radius." },
  { v: 'v1.20.0', date: '2026-06-12', time: '21:30 EDT', body: "Accessibility: the mid-game upgrade picker (the 'Choose an upgrade' screen that pops up every 5 waves) is now keyboard-operable — the last menu in the game that was mouse-only. When it opens, your keyboard focus lands on the first perk card; Tab and Shift+Tab cycle through the three choices (and stay trapped inside the picker so you can't tab away to the paused board behind it); and Enter or Space picks the highlighted perk. The focused card lifts and shows a blue ring just like a mouse hover. Esc is intentionally still disabled here — you have to pick one. It's also tagged as a dialog for screen readers. Pure interface polish — no effect on gameplay, balance, the perks themselves or saves." },
  { v: 'v1.19.0', date: '2026-06-12', time: '06:13 EDT', body: "Accessibility: the start-screen menus (Talents, Achievements, Records, Settings, What's New) are now fully keyboard-navigable. Before, they could only be opened and closed with the mouse. Now: pressing Esc closes whichever panel is open; opening a panel moves your keyboard focus into it and Tab cycles through its buttons without escaping to the dimmed page behind; and closing a panel returns focus to the button you opened it from. Buttons and controls also show a clear blue focus ring when you're navigating by keyboard (it stays hidden for mouse clicks). Panels are tagged as dialogs for screen readers too. Pure interface polish — no effect on gameplay, balance or saves." },
  { v: 'v1.18.0', date: '2026-06-12', time: '19:40 EDT', body: "Accessibility: a new ♿ Colorblind aid toggle in ⚙ Settings. Most enemy types already show a symbol (+ heal, 🛡 shield, ✂ split, 👻 phantom, ☠ boss), but the fast and tank enemies were told apart by COLOUR alone (purple vs orange), which is hard if you're colourblind. Turn the aid on and every enemy kind gets its own symbol too — » for the quick ones, ◆ for the heavy tanks — so you can read the board by shape, not just hue. Off by default, saves on your device, and zero effect on gameplay or balance." },
  { v: 'v1.17.0', date: '2026-06-12', time: '18:15 EDT', body: "Sharper graphics on high-resolution screens (Retina, 4K, and Windows display scaling like 125%/150%). The game board was drawn at a fixed resolution and then stretched to fit your screen, so on a high-DPI display the towers, enemies and text looked a little soft. It now draws at your screen's true pixel density (up to 2×), so everything is crisp — while staying exactly the same size and playing identically. No effect on gameplay, balance, controls or saves; on a standard 1× display nothing changes at all." },
  { v: 'v1.16.4', date: '2026-06-12', time: '16:45 EDT', body: "🩺 Health check (every-6th-run maintenance pass — no gameplay changes). Full test suite green (272/0, zero console errors); all eight code files comfortably within the size limit (largest is ~656 lines vs the ~1500 cap); every documented formula re-verified against the actual code (scoring, enemy-HP scaling, the economy trim, the booster-aura taper, the touch radius) — all matched. Old saves confirmed to still load via the migration defaults (an old meta with no achievements/stats and an old run with no map-theme both loaded cleanly), and double-click/offline play re-verified. Tidied the docs: the project's root redirect page (index.html → tower-defense.html, used by the hosted version) is now documented. The remaining 'polished-browser-game' gaps — colourblind-safe palette, gamepad support, high-DPI crispness and menu keyboard navigation — are still on the roadmap for future updates." },
  { v: 'v1.16.3', date: '2026-06-12', time: '15:30 EDT', body: "Touch controls: tapping the board on a phone is now reliable. Two things were fighting you. First, the spot you tap to select a tower was sized for a mouse — on a phone the board is shrunk to fit, so an on-screen tower was only about a 7-pixel target, easy to miss. On touch devices the tap area around each tower is now much more forgiving (it still can't accidentally grab a tower when you meant to place a new one beside it). Second, the board now reacts the instant you press instead of waiting for the browser's tap-release (which some mobile browsers delay by a fraction of a second), so placing towers, aiming the meteor and opening the upgrade menu all feel snappier — on mouse and touch alike. The board also no longer scrolls or pinch-zooms the page out from under you while you're tapping on it. Desktop play is unchanged." },
  { v: 'v1.16.2', date: '2026-06-12', time: '14:05 EDT', body: "Balance: cooled the 'one maxed booster carries the whole run' problem (your campaign-6-on-hard note — beaten with a single gunner + a maxed booster). A booster's aura used to grow +10% damage per level (up to +75% at max); it now grows +8% per level instead. A low-level booster is completely unchanged — the trim only kicks in as you pour money into one, where a maxed booster now gives +65% instead of +75%, so a buffed tower does about 6% less at max. Small and deliberate (it shouldn't gut a real multi-tower build), just enough to make a single super-booster a bit less of an auto-win. A resumed run keeps the exact same booster power. More tower-power tuning to come if the solo-carry is still too strong." },
  { v: 'v1.16.1', date: '2026-06-12', time: '13:20 EDT', body: "Balance: trimmed the early gold snowball (your note that you can clear classic-normal on the money from just the first 10 rounds). Kills were paying ~70% of your early income, so per-kill bounty is now a touch lower — about 20% less on wave 1, fading to ~10% by wave 10 and barely anything in deep endless, so it bites where you over-build but doesn't starve long runs. The between-wave clear bonus was also cut ~20%. Net effect: your war chest after 10 clean waves drops ~13% (measured), so you can't quite afford a full army from the opening rounds. A modest, simulated step — more to come if it's still too easy." },
  { v: 'v1.16.0', date: '2026-06-11', time: '23:55 EDT', body: "The victory/defeat screen now has a SCORE and a letter grade (your request), and it's been restyled so it's no longer an overwhelming wall of text. Every run is scored on how far you got (waves + campaign depth), how clean it was (lives kept, big combos, and using FEWER towers), and how much gold you banked — all scaled by difficulty. You get a grade from F up to S (S = a flawless win with no lives lost), and the game tracks your all-time best score with a ★ celebration when you beat it. The old run-on summary is gone: now there's a big score + grade up top, a tidy stats grid (waves / kills / lives / gold / combo / towers), and your MVP towers, perks and any new achievements as their own clean lines." },
  { v: 'v1.15.0', date: '2026-06-11', time: '23:30 EDT', body: "Mobile deep-dive #2 (your request — 'when you start a game it's tiny' and 'What's New is shown behind the game'). Two fixes: (1) On phones & tablets the What's New rail no longer opens by default — it used to stack full-width BELOW the board and bury it, so now it starts collapsed on small screens and only appears if you tap ✨ What's New (your choice is remembered). (2) The board is a wide landscape shape, so holding the phone upright squeezes it small — there's now a proper LANDSCAPE layout: rotate your phone sideways and the board grows to fill the screen height (much bigger), with the top bar and buttons compacted to give it room. A '↻ Rotate for a bigger board' hint shows in portrait so you know. Desktop is unchanged." },
  { v: 'v1.14.1', date: '2026-06-11', time: '22:40 EDT', body: "🩺 Health check (every-6th-run maintenance pass): full test suite green (230/0, zero console errors), all code files comfortably within the size limit, every documented formula re-verified against the code, no dead code, and old saves confirmed to still load via the migration defaults. New this time — at your request, the health check now also verifies the game VISUALLY on both a large display and a phone, not just via tests: every menu was opened at 1280px and 390px and confirmed on-screen, scrollable and playable. That pass surfaced the concrete phone problems behind your 'tiny game / What's New behind the game' note (measured: the board shrinks to 374×233px and the What's New rail dumps full-width below the fold) — logged in detail for the next update to fix. No gameplay changes." },
  { v: 'v1.14.0', date: '2026-06-11', time: '21:30 EDT', body: "Phones & tablets are now properly supported (your request — it 'looked terrible on phones'). The menu, talents, achievements, records, settings and every-5-waves draft used to be crammed into the small scaled-down game board with no way to scroll or reach them, and rows of buttons ran off the screen. On narrow screens (≤920px, covering phones and iPad-size tablets) those panels now fill the whole screen and scroll, button rows wrap, and the talent/achievement grids reflow to 2 columns (1 on small phones) — no more sideways scrolling or cut-off content. The game board itself already scaled to fit. (First slice — start screen, all overlays and in-game chrome. Fine-tuning of in-game touch ergonomics can follow.)" },
  { v: 'v1.13.8', date: '2026-06-11', time: '20:08 EDT', body: "The maps no longer all look the same (your request). Each Classic-mode map now has its own colour theme — Classic stays the blue circuit, Spiral runs emerald green, Serpent glows warm amber. Campaign rolls a different (but calm) colour scheme each attempt, and Mayhem now burns: its palette sweeps through wild, fiery hues that shift as you play. Purely visual — no effect on gameplay, and a resumed run keeps the colours it started with." },
  { v: 'v1.13.7', date: '2026-06-11', time: '18:51 EDT', body: "What's New entries now show the TIME alongside the date (your request) — so when several updates land on the same day you can see the order at a glance. New entries are timestamped going forward; older entries (before this change) just show their date, since no time was recorded for them." },
  { v: 'v1.13.6', date: '2026-06-11', body: "A few fixes you asked for: the ✨ What's New button now also CLOSES the panel if it's already open (it toggles), and the ⚙ Settings button toggles the same way. And difficulty got rebalanced for fresh runs — Easy is now genuinely very easy (lots of gold & lives, much weaker enemies), and Normal is a little gentler too, so the early waves aren't a wall." },
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
    const when = e.time ? `${e.date} · ${e.time}` : e.date;
    d.innerHTML = `<span class="wnver">${e.v}</span><span class="wndate">${when}</span><div class="wnbody">${e.body}</div>`;
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
  localStorage.setItem('cd_wnopen', '1');   // explicit opt-in (drives the small-screen default below)
  document.getElementById('whatsnew').style.display = 'flex';
  syncWhatsNewHeight();
}
function closeWhatsNew() {
  wnClosed = true;
  localStorage.setItem('cd_wnclosed', '1');
  localStorage.removeItem('cd_wnopen');
  document.getElementById('whatsnew').style.display = 'none';
}
// Show it on first load (and every load) unless the player closed it before.
// On phones/small tablets (≤920px) the rail stacks full-width BELOW the board and
// buries it ("What's New shown behind the game" — owner FEEDBACK), so there it
// defaults to CLOSED unless the player has explicitly opened it (cd_wnopen). On
// desktop `small` is false, so this is byte-identical to the old open-by-default.
function initWhatsNew() {
  const small = typeof matchMedia === 'function' && matchMedia('(max-width: 920px)').matches;
  const optedIn = localStorage.getItem('cd_wnopen') === '1';
  if (wnClosed || (small && !optedIn)) document.getElementById('whatsnew').style.display = 'none';
  else openWhatsNew();
}
// Keep the cap in sync as the viewport (and thus the game's height) changes.
window.addEventListener('resize', syncWhatsNewHeight);

// ===== Menu keyboard accessibility (v1.19.0) =====
// The start-screen panels were mouse-only. This makes them keyboard-navigable:
// Esc closes the open panel, Tab is trapped inside the open MODAL panels (so a
// keyboard/screen-reader user can't tab out into the dimmed page behind), and
// focus returns to the button that opened it on close. Pure DOM/UX — no
// gameplay/economy/save impact. The close functions referenced here live in
// later files but resolve at call time (classic scripts share one scope).
// Priority order: modal overlays first, then the non-modal What's New side rail.
const A11Y_PANELS = [
  { id: 'talentPanel',   close: () => closeTalents() },
  { id: 'achPanel',      close: () => closeAchievements() },
  { id: 'bestPanel',     close: () => closeBests() },
  { id: 'settingsPanel', close: () => closeSettings() },
  { id: 'whatsnew',      close: () => closeWhatsNew(), nontrap: true },
];
const FOCUSABLE_SEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
// Visible via computed display — NOT offsetParent, which is null for the
// position:fixed panels of the mobile (≤920px) layout, so Esc would silently
// no-op on phones if we keyed off offsetParent here.
function panelOpen(el) { return !!el && getComputedStyle(el).display !== 'none'; }
function focusablesIn(el) {
  return Array.prototype.slice.call(el.querySelectorAll(FOCUSABLE_SEL))
    .filter(n => n.offsetParent !== null && !n.disabled);
}
let _panelOpener = null;
// Move focus into a just-opened modal panel, remembering the opener to restore later.
function focusPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const a = document.activeElement;
  _panelOpener = (a && a !== document.body) ? a : null;
  const f = focusablesIn(el);
  if (f.length) f[0].focus();
}
function _topTrapPanel() {          // highest-priority open panel that traps Tab (excludes the rail)
  // The mid-game perk draft (v1.20.0) traps Tab too, but is deliberately absent
  // from A11Y_PANELS so Esc can't close it (a pick is required). It's a forced
  // modal during gameplay, so it outranks any start-screen panel when open.
  const draft = document.getElementById('draftModal');
  if (panelOpen(draft)) return draft;
  for (const p of A11Y_PANELS) { if (p.nontrap) continue; const el = document.getElementById(p.id); if (panelOpen(el)) return el; }
  return null;
}
function _topAnyPanel() {           // highest-priority open panel incl. the rail (for Esc)
  for (const p of A11Y_PANELS) { const el = document.getElementById(p.id); if (panelOpen(el)) return p; }
  return null;
}
function _restoreOpenerFocus() {
  if (_panelOpener && _panelOpener.offsetParent !== null) { try { _panelOpener.focus(); } catch (e) {} }
  _panelOpener = null;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const top = _topAnyPanel();
    if (top) { e.preventDefault(); e.stopPropagation(); top.close(); _restoreOpenerFocus(); }
    return;
  }
  if (e.key === 'Tab') {
    const panel = _topTrapPanel();
    if (!panel) return;
    const f = focusablesIn(panel);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!panel.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
});

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
  // Mortar launch: a hollow tube "thunk" + the rising whistle of a lobbed shell
  // (the BOOM on impact reuses bomb()), so the artillery arc reads as launch→land.
  mortar()  { tone(150, 0.12, 'sine', 0.12, -70); noise(0.08, 0.06, 'bandpass', 700, 0, 2);
              tone(520, 0.28, 'sine', 0.03, 700); },
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
  // Boss archetype mechanic firing (shield raise / minion summon): a short ominous
  // metallic swell so the player notices the boss "doing something" (v1.25.0).
  bossSkill(){ tone(110, 0.22, 'sawtooth', 0.07, -50); tone(220, 0.18, 'square', 0.04, 120);
               noise(0.12, 0.05, 'bandpass', 1400, 600, 3); },
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

