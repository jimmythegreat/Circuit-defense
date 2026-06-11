# Owner Feedback Queue

Drop requests, bug reports, balance complaints, or ideas here — one per line under PENDING.
When it completes an item it moves it to DONE below with the date and version.

## PENDING

[refactor follow-up] The html/css/js split is done (v1.8.1), but tower-defense.js is still ~2118 lines (over the ~1500/file guideline). Next slice: split it by domain into classic `<script src>` files with explicit load order (audio → maps/paths → towers/enemies → perks/talents → rendering → ui → save). Must be its own zero-behavior-change run with full test passes; NEVER use ES modules (breaks file://).

[Low priority] I should be able to start a new wave even if the current wave is going. This would let me spawn more than one wave AT THE SAME TIME.

[Low priority] The victory screen is getting a bit overwhelming. I think it just needs to be restyled.

[Low priority] Mayhem should be a random map every time.

[bug] The newly added combo meter overlaps the round completion bonuses display and the bar overlaps the word 'combo'

## DONE

- **2026-06-11 · v1.8.1** — "[refactor] tower-defense.html is now over 2k lines. We need to split it out into its own files (html, css, js, etc.)." → Split the ~2480-line monolith into three files: `tower-defense.html` (109 lines, markup), `tower-defense.css` (255 lines, styles) and `tower-defense.js` (2118 lines, code), wired with classic `<link>`/`<script src>` tags (NOT ES modules — those break double-click `file://` play). Pure zero-behaviour-change refactor: CSS/JS bodies byte-identical to the old inline blocks; tests went 87/0 green before → identical 87/0 after, plus a new [12] split-wiring test (now 97/0). Still plays by double-clicking the HTML. The "etc." remainder — domain-splitting the still-large `tower-defense.js` — is queued as a follow-up at the top of PENDING.

- **2026-06-11 · v1.5.2** — "What's new should not grow past the game. It should instead convert to a scrollable window." → The panel's height is now capped to the game column's actual height via a new `syncWhatsNewHeight()` helper (called on open and on window resize), so on tall viewports it no longer overhangs the bottom of the game — overflowing entries scroll inside the panel instead. Previously `max-height:88vh` let the panel exceed the game's ~836px and drag `#appRow` taller than the game; now it tracks the game exactly. Added a tall-viewport regression test.

- **2026-06-11 · v1.5.1** — "The stats bar (bar below the game name) and the tower, wave options, and hotkeys should not be shown or maybe the are dark like the current level is if you're not currently in an active game" → Took the "dark/dimmed" option (keeps layout stable). When no game is active, the stats HUD, tower shop, wave controls and hotkey hint now dim to 30% opacity with a grayscale tint and go non-interactive via an `.idle` class on `#gameCol`, toggled by a new `setActiveUI()` helper. They light back up the instant you hit Play or Resume, and re-dim on return to the menu.
- **2026-06-10 · v1.4.1** — "Opening the change log pushes the middle of the game over but the top panel (game title and status) and the bottom panel (towers, options, hotkeys) doesn't shift over. Really the change log should float next to the entire game." → Restructured the layout: the whole game (title, HUD, canvas, towers, controls, hotkeys) now lives in a `#gameCol` column, and the What's New panel floats beside that entire column inside a new `#appRow` flex row. Opening it shifts the whole game together instead of sliding only the canvas. Still tucks below on narrow screens.
