# Owner Feedback Queue

Drop requests, bug reports, balance complaints, or ideas here — one per line under PENDING.
When it completes an item it moves it to DONE below with the date and version.

> **DONE is a condensed log** (summarized v2.0.0, owner request "feedback is getting huge —
> summarize with enough detail so future runs don't re-implement the same thing"). Each line is
> one shipped request: `date · version — request → what shipped (test group)`. Full prose lives
> in CHANGELOG.md / the in-game What's New panel; design rationale lives in CLAUDE.md.

## PENDING

_(empty — drop new requests here, one per line)_



## DONE

- **2026-06-16 · v2.1.0** — "[high] The main interface is getting clunky; the bottom-row buttons are huge; revamp the whole starting menu" → **COMPLETE** after nine slices. The full revamp landed: a desktop two-column **dashboard** — run-setup card on the left, a right **rail** stacking play actions (PLAY/Resume/Daily) over a vertical utility panel — so the menu fits the board with ▶ PLAY on-screen (it had grown so tall PLAY sat below the fold). Earlier slices: button hierarchy v1.39.1, PLAY sheen v1.41.0, config card v1.42.0, hero header v1.45.0, ambient backdrop v1.69.0, hover polish v1.94.0, grouped toolbar v2.0.0, accent tiles v2.0.2. CSS-only, save-safe; phones keep their stacked scrollable menu. Test [113].

- **2026-06-16 · v2.0.0** — "[highest] push out a big change, bump to v2, do as many as possible, include a special change not in feedback/roadmap" → **Major release bundling 5 items + a headline.** ★ Special headline (not listed): 🌑 **Nightmare difficulty** — a 4th tier above Hard (hp 1.7 / 8 lives / 90 gold / top 2.2× chips) with a steeper quick-mode late-scale, a 🌑 Nightmare Walker achievement (roster 17→18), data-driven & save-safe (Daily never rolls it). Also: progressive late-game hardness on Hard/Nightmare (quick only); Railgun Penetrator +35%→+20%; Breacher leak-cost 2→3; campaign auto-level-select; grouped-toolbar menu slice. Test [109]; suite 1179/0 green. See CHANGELOG v2.0.0.
- **2026-06-16 · v2.0.0** — "[medium] Railgun does too much at L5 with Penetrator — more than snipers" → Penetrator spec damage `+35% → +20%` (effDmg `railpen` 1.35→1.20), so the piercing Railgun is a positioning side-grade again, not a Sniper-beater. Test [109]/[91].
- **2026-06-16 · v2.0.0** — "[medium] Scale the hardness on hard more as the waves progress (good early, easier mid, super easy late; campaign is good)" → New `lateScale` HP multiplier in `enemyTemplate`, gated to **quick-mode hard/nightmare** (Normal/Easy + all campaign untouched, so the test-[16] invariant holds). Ramps from a wave threshold and caps (hard +22.5% w30 / cap +25%; nightmare cap +40%), so each later wave is a bigger jump. Bosses derive from the template so late bosses harden too. Test [109].
- **2026-06-16 · v2.0.0** — "Bosses should take more lives (from 1 to 3); the increase-life-taking enemies should be upped" → **PARTIAL.** ‼ Breacher (and Breacher Surge) leak-cost **2 → 3** (the "increase-life-taking enemy upped"). **Bosses left at 5** — they already cost 5 lives, *more* than the requested 3; lowering to 3 would be a nerf (opposite to "should take more lives"). Re-add this item if you actually want bosses changed to a specific number. Test [74]/[88].
- **2026-06-16 · v2.0.0** — "On campaign, auto-select the next level on back-to-menu instead of clicking Next; select the last-completed level when clicking Campaign" → Clicking the Campaign mode button selects `campaignDone()+1`; `backToMenu()` after a campaign win auto-advances `campLevel`. A defeat keeps the level. Test [109].
- **2026-06-16 · v2.0.0** — "The feedback and roadmap are getting huge — clean it up, summarize with enough detail so future runs don't re-implement the same thing" → Condensed this DONE log and ROADMAP.md to compact one-line-per-item summaries (PENDING items kept verbatim; the Vetoed section preserved). Full prose stays in CHANGELOG.md / What's New.

### Earlier (condensed)

- **2026-06-16 · v1.100.1** — "[bug] Gold Rush usable repeatedly before round 1; Barrier should fade" → Gold Rush gated until Wave 1 starts (closes a pre-game gold-farm exploit); Barrier charges expire 20s after cast (run-only `barrierTimer`, ring dims in its last 5s). Test [108].
- **2026-06-13 · v1.38.1** — "[bug] Completing a level doesn't reset Resume (re-resumable forever); selecting a tower blinks it" → `winGame()` now `clearRun()`s (guarded `!daily`); shared `towerAt()` hit-test hides the placement ghost over a selectable tower (no more snap-flicker). Test [56].
- **2026-06-13 · v1.38.0** — "[medium] Talents are OP and way too easy to get — game becomes easy/boring; raise costs ~25%, double the worst offenders, remove dead ones" → Cost-only rework (power untouched): general +25% on CORE, damage/power outliers ~doubled, eight masteries doubled, Overdrive +50%; nothing removed (each is a distinct mechanic; removal is save-unsafe). Maxing ≈2,350→3,550 chips. Owner waived the swing rule. Test [55].
- **2026-06-12 · v1.24.3** — "[low] Reduce booster base range by 50% (makes Network better)" → Done over three slices (v1.20.1/v1.24.1/v1.24.3) to respect the ≤25%/run cap: booster base range 90→45 (area = 25% of original). Test [39].
- **2026-06-12 · v1.24.0** — "[low][external] Grid for placing turrets so they line up cleaner" → Placement snaps to a 32px grid (cell centres) with a faint slot-dot overlay; ▦ Grid snap Settings toggle (default On, `cd_gridsnap`). Selection uses the raw cursor. Test [43].
- **2026-06-11 · v1.16.0** — "[low] A scoring system for the end screen (kill time, remaining gold, fewer towers)" + "[low] Restyle the overwhelming victory screen" → `computeScore()`/grade F→S, efficiency (fewer towers) + gold + difficulty mults, all-time best (`cd_bestscore`); restyled end screen (score hero + stats grid + MVP/perks/ach). (Speed/time component later added v1.78.0.) Test [31].
- **2026-06-11 · v1.15.0** — "[high] Mobile deep-dive #2: What's New shown behind the game; board tiny when you start" → What's New defaults collapsed ≤920px (`cd_wnopen`); a real landscape layout sizes the board off viewport height + a rotate hint. Test [30].
- **2026-06-11 · v1.14.1** — "[high] Health check should verify all features work visually on desktop + phones" → Performed a visual verification pass at 1280×860 + 390×844 (all menus on-screen/scrollable, no overflow). Codifying it permanently needs editing the agent's own task file (blocked) → filed under ROADMAP "Prompt suggestions for the owner."
- **2026-06-11 · v1.14.0** — "[important] Game looks terrible on phones — make popular screen sizes work" → First responsive CSS block (no markup/JS change): overlays detach to a fixed scrollable layer ≤920px, button rows wrap, grids reflow. Test [29].
- **2026-06-11 · v1.13.8** — "[low] All maps look the same — add random colors/textures; classic fixed, mayhem wild, campaign random-but-tame; mayhem random map each time" → `THEMES` palette system; fixed per-map identities, tame campaign roll, animated chaos mayhem (static under reduce-motion). Test [28].
- **2026-06-11 · v1.13.7** — "[high] List the time as well as the date for What's New" → `CHANGELOG_ENTRIES` gained an optional `time` field; panel shows `date · time`. Test [27].
- **2026-06-11 · v1.12.1** — "[low] Milestone bonuses (run perks) need a hover tooltip" → Render-loop hover detection draws `drawPerkTooltip()` (name/rarity/desc). Test [21].
- **2026-06-11 · v1.12.0** — "[low] Let me start a new wave while one is running (spawn multiple waves at once)" → Parallel `spawners` array (up to 3 in-flight waves); Start button reads ➕ Add Wave; `endWave()` settles all bundled waves (bonuses/drafts preserved). Test [20].
- **2026-06-11 · v1.11.0** — "[low] A reset feature that deletes everything and starts fresh" → 🗑 Reset All start-screen button (`resetAllData()` clears every `cd_`-prefixed key); two-click confirm. Test [19].
- **2026-06-11 · v1.10.0** — "[bug] After refresh+continue, towers shoot at original speed" → Root cause was the unpersisted game-speed pref; now persisted in `cd_speed`. Test [18].
- **2026-06-11 · v1.10.0** — "[balance] Frost Mastery + Shatter is OP (frost doing 764 dmg)" → Shatter ×6→×4.5 (−25%, owner sim). Test [17].
- **2026-06-11 · v1.10.0** — "[balance] Booster/cannon final upgrades are no-choice; Poison underpowered (should reduce defense + more DoT)" → Network +10% power, Mega Blast +15% dmg; Poison base 6→7, DoT ×2.2→×2.6, −3 armor corrosion/hit. Test [17].
- **2026-06-11 · v1.9.1** — "[low] Tower upgrade menu overlaps combat — move it to the lower-left corner" → Upgrade panel pinned bottom-left (`left:10px`, bottom-anchored). Test [15].
- **2026-06-11 · v1.8.3–v1.8.5** — "[low] Combo meter overlaps the round-bonus text / the word COMBO / the milestone pop" → Relaid out: persistent meter moved to bottom-right, milestone pop center-board below the HUD band. Test [11].
- **2026-06-11 · v1.8.1–v1.8.2** — "[refactor] tower-defense.html is over 2k lines — split into html/css/js/etc." → Split the monolith into `tower-defense.html` + `.css` + seven ordered classic-script `cd-*.js` files (NOT ES modules); zero behaviour change. Test [12].
- **2026-06-11 · v1.4.1–v1.5.2** — Layout/UX of the What's New panel + idle chrome dimming: panel floats beside the whole game (`#appRow`), height-capped & scrollable; in-game chrome dims when no game is active (`.idle`).
