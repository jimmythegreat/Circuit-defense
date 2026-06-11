# Circuit Defense

A browser tower defense game. **Everything lives in one self-contained file: `tower-defense.html`** — no build step, no dependencies, no assets. Open it in any browser to play. All graphics are canvas-drawn, all sound is synthesized via WebAudio (oscillators + filtered white noise).

## Running / testing

- Dev server: `.claude/launch.json` defines a `game` config (`python -m http.server 8123`). Use the preview tools and navigate to `/tower-defense.html`.
- **The game loop runs on `requestAnimationFrame`, so it pauses when the tab is hidden.** Headless testing through preview_eval must drive the simulation manually: call `update(1/60)` in a loop instead of waiting wall-clock time.
- Standard test recipe (via preview_eval):
  1. `beginGame()` (set `gameMode`/`mapKey`/`diffKey` first), give `gold`, push tower objects directly into `towers`
  2. `startWave()`, then `while (!done) update(1/60)`
  3. If `draftOpen`, click a card: `document.getElementById('draftCards').children[0].click()`
  4. Check `preview_console_logs` for errors afterwards
- Synthetic canvas clicks must set real `clientX/clientY` relative to `cv.getBoundingClientRect()` — the click handler recomputes coords from the event.
- **Always clean up test data afterwards**: remove localStorage keys `cd_save`, `cd_meta`, `cd_campaign`, `cd_best_easy/normal/hard`, reset `meta = {chips:0, talents:{}}; loadMeta()`, and call `backToMenu()` so the user starts fresh.

## Architecture (single `<script>` in tower-defense.html)

Rough section order in the file:

- **Audio**: `tone()` (oscillator), `noise()` (filtered white noise buffer), `SFX` object — every tower type has a distinct sound (tesla = lightning crackle, cannon = sub-bass boom, etc.)
- **Maps & paths**: `MAPS` (classic/spiral/serpent/mayhem), `genPathWith(rnd)` generates random axis-aligned serpentine paths, `buildPath()` fills `waypoints/segs/pathLen`, `pointAt(dist)`, `distToPath(x,y)`
- **Modes**: `gameMode` = `'quick'` | `'campaign'`; `campLevel` 1–40, `CAMPAIGN_LEVELS = 40`. Campaign maps are **freshly random each attempt** (deliberate design choice). `victoryWave()` = `14 + campLevel` for campaign (L1=15 … L40=54), 30 for quick. Campaign enemy HP scales `1 + (campLevel-1)*0.04`. Progress = localStorage `cd_campaign` (highest completed level). Mayhem (quick-mode map) shifts the path + relocates towers every 5 waves and rolls per-wave `WAVE_MODS`.
- **Meta / talents**: `TALENTS` (20 talents in CORE + TOWER MASTERY sections, ~2290 chips to max), `meta = {chips, talents}` in localStorage `cd_meta`. Chips earned per run via `chipsForRun()`. `maxTowerLevel()` = 5 + overdrive rank.
- **Towers**: `TOWER_TYPES` (gun/sniper/frost/cannon/tesla/poison/buff), `SPECS` (2 specializations per type, chosen free at level 5+), targeting `MODES` (first/last/strong/close)
- **Abilities**: `ABILITIES` (meteor Q / freeze W / gold rush E), `abilityCd`, meteor is click-to-target via `armedAbility`
- **Run perks**: `PERKS` with rarity tiers (common/rare/legendary), drafted 1-of-3 every 5 waves (`openDraft`, weighted by `rollRarity()` ≈ 78/14/8 common/rare/legendary). Legendary = "super grades" (Diamond Core, Midas, Orbital Support, Ascension…). `perkState` (from `freshPerkState()`) holds all run-modifier numbers; `REPEATABLE` perks can be offered again.
- **Effective stats**: `effDmg/effRate/effRange/effBuffPower/effBuffRange` combine base stats × talents × perks × specs × buffs × wave mods. **Booster auras do NOT stack — `buffMultFor` takes the max** (deliberate; UI says so).
- **Save/resume**: `saveRun()` after each wave + on quit (mid-wave quit saves `wave-1`); `loadRun()` rebuilds tower stats from base × level multipliers (dmg ×1.45, range ×1.08, rate ×0.88 per level). Random-path modes (mayhem/campaign) call `relocateTowers()` on resume.
- **Game flow**: `startWave → endWave` (interest, draft every 5 waves, auto-start timer) → `winGame`/`endGame` (chips awarded, MVP/perk lines) → `continueEndless`/`nextLevel`/`backToMenu`. `quitRun()` needs two clicks within 3s.
- **Rendering**: pseudo-3D canvas — shaded cylinder towers, radial-gradient sphere enemies, ground shadows, path depth bevel, projectile trails, starfield, vignette, boss HP bar, screen `shake`.
- **Upgrade panel**: rebuilds itself when `upgradeKey(t)` changes (gold affordability, level, spec, *effective* stats) — this is how it live-updates when boosters/perks land while open. Keep new stat sources reflected in `upgradeKey`.

## Conventions & gotchas

- localStorage keys all prefixed `cd_`: `cd_save`, `cd_meta`, `cd_campaign`, `cd_best_<diff>`, `cd_mute`
- Speed toggle just runs `update()` 1–3× per frame; pause/draft/menu gate at the top of `update()`
- `damage()` handles armor (reduced by piercing talent), kill credit (`src.dealt/kills`), bounty (fortune talent, midas perk, bountyAdd), splitter children via `pendingSpawns`
- Enemy kinds: norm, fast (w3+), tank (w5+), heal (w7+), shield/armored (w9+), split (w11+), boss every 5th wave
- When adding a perk/talent that changes a stat, wire it into the corresponding `eff*()` helper AND `upgradeKey()` if it shows in the panel
- User's stated preferences so far: loves additive/addictive loops, wanted talents expensive/grindy (~50 runs to max), campaign maps random per attempt, booster non-stacking is fine but must be labeled

## History / state of play

Built incrementally in one long session (June 2026): v1 basic TD → v2 sound/maps/difficulties/specs/save → v3 talents/abilities/rarity drafts/mayhem → graphics overhaul + campaign + quit. All features verified by driving `update()` headlessly; no known bugs at last check, zero console errors.
