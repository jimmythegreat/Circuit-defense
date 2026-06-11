# Owner Feedback Queue

Drop requests, bug reports, balance complaints, or ideas here — one per line under PENDING.
The routine always does the **first pending item** before anything of its own invention.
When it completes an item it moves it to DONE below with the date and version.

## PENDING

The stats bar (bar below the game name) and the tower, wave options, and hotkeys should not be shown or maybe the are dark like the current level is if you're not currently in an active game

What's new should not grow past the game. It should instead convert to a scrollable window.

## DONE

- **2026-06-10 · v1.4.1** — "Opening the change log pushes the middle of the game over but the top panel (game title and status) and the bottom panel (towers, options, hotkeys) doesn't shift over. Really the change log should float next to the entire game." → Restructured the layout: the whole game (title, HUD, canvas, towers, controls, hotkeys) now lives in a `#gameCol` column, and the What's New panel floats beside that entire column inside a new `#appRow` flex row. Opening it shifts the whole game together instead of sliding only the canvas. Still tucks below on narrow screens.
