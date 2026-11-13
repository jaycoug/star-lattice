# Star Lattice

A fun-forward visual planner and self-assessment engine where you set the structure, categories, rules and question banks. Your work becomes a starfield: each star has six kites, each kite four **star-dots** (tasks, lessons, skills, questions… whatever you call them), and finishing them lights the map and opens new stars outward.

The same program can be a **life organizer**, a **course map**, a **study aid**, a **skill tree**, a **campaign notebook** or a **trivia game**. Six showcase packs, one of each, come with it.

## Start

**Easiest, no install:** open `dist/Star Lattice.html` (build it with `python tools/single_file.py`). It runs from the file; your boards are kept in that browser.

**From this folder, with Python 3:**

- Windows: double-click **`Make desktop shortcut.vbs`** once, then use the **Star Lattice** icon it puts on your desktop.
- macOS / Linux: `chmod +x start-star-lattice.sh` once, then run it.
- Or in a terminal: `python serve.py --open`.

Your boards are then files in `saves/` and `content/` (neither is part of the repository). The first time, they're filled from the packs.

**On any static web host** (GitHub Pages…): the app runs without Python, keeps boards in the browser, and the browser offers *Install app*.

## The showcase packs

**States ▾ › New from a blueprint…** starts a board from one:

| Pack | What it shows |
|---|---|
| Organizer demo | Six areas of a life; due dates, routines that come back, goals broken into steps, an hour plan |
| Statistics essentials | A study aid: 36 questions answered on the map; shuffled choices and order; a goal question |
| Intro to data analysis | A course map: units, lessons, a project at each unit's tip, short checks, kites that unlock |
| Home cooking skill tree | Basics first; each signature skill unlocks a star of advanced ones |
| The Lantern Coast | A campaign notebook: factions, people and places, notes, and how they relate |
| Trivia night | A game: six rounds, goal questions, a new order every session |

Their content is original; `packs/<id>/` holds each one, and `node tools/build_packs.mjs` rebuilds them.

## Make your own

- **Two modes, four views.** **Edit** builds the board; **Play** is a test run as a first-time player (nothing done there is saved; ↺ Restart the test). The views: **Star** (the map), **Tree** (the hierarchy, or ordered lists), **Deck** (flip cards, one deck per category) and **Schedule** (hours on a calendar, in 15-minute slots).
- **⚙ Design** sets the rules, each with a **?** saying what it does. **Board** is this save. **Stars**: a hierarchy or ordered lists, kites on every star or only the center, deploying by hand or automatically. **Questions**: every star-dot a question or not, waits after a wrong answer, shuffling, a goal question. **Look**: categories, colors, the word for "star-dot", the kite finish (Flat, Crystal, Glass), schedule hours. **Player**: which views, tools and editing the player gets, and a welcome line. **Fun**: the extras below. Every save keeps its own design.
- **A star-dot's screen** has five widgets (Checklist, Notes, Assessor, Attributes, Relevance Information), arranged by dragging, one layout for the set or one for each star-dot.
- **Questions:** the Assessor has a form for them (multiple choice, fill in the blank, number, typed answer, steps). **Import questions…** (Tree view) takes plain typed-up questions:

  ```text
  1. Which organelle makes ATP?
  A) Ribosome
  B) Mitochondrion
  Answer: B
  ```

  or the fuller Markdown format of [`question-format.md`](question-format.md).
- **Saves and content sets.** A content set is a library of items and questions; each save on it starts from a copy and then keeps its own items and design. **⚙ Design › Board › Update content set…** copies the open save's items back to the set, for saves started from then on.
- **States ▾** holds every save: New from a blueprint…, New empty map…, Duplicate…, and **Download… / Upload…**, which carry a board with its content set as one file.
- **Tutorials and ? Help.** A guided tour for the designer and one for the player (it skips what the player isn't given), and a searchable manual.
- **States ▾ › Make a repo…** (under `serve.py`) writes a **play version** of one board beside this folder: it opens straight into that board as a first-time player (progress cleared), in Play mode only, with the views and permissions set in ⚙ Design › Player; the design tools aren't in its files. It has its own README, license and GitHub Pages workflow: push it and it's a site. Or from a terminal: `python tools/derive.py my-quiz --save "Trivia night" --title "My quiz"`.

## Fun (⚙ Design › Fun)

Each one is a switch; all are off by default except bursts. Animations respect reduce-motion.

- **Bursts and supernovas:** a burst in the category's color when a star-dot ignites, and a supernova when a whole star does.
- **The bonus ladder:** the player's tools, in your order, locked until earned (one for every N star-dots ignited, 3 by default). Prizes include the map's tools, the kite designer (cut out shapes, paint on kites), palettes, your own palette, a spin of the star and comets.
- **Spin the star:** the star turns like a pinwheel, and the kite that stops at the top decides the outcome: a hint (one wrong choice crossed out), the next prize early, spin again, or nothing.
- **Comets:** your messages fly across the sky after N ignites, when a category is complete, now and then, or as a prize; the player can win a comet of their own to write.
- **Constellation reveal:** two related star-dots, once both are ignited, are joined by a line that draws itself.
- **Nebula fog:** the sky past the outermost star is hidden in fog, which clears ring by ring as stars deploy.
- **Streaks and marks:** right answers in a row make the lit star-dots glow; five marks per session (First light, Five in a row, A whole star, Halfway, Every star lit).
- **Starry background:** two depths of twinkling stars behind the board (designer only).

## Inside

No build step and no dependencies: plain JavaScript modules in `app/` and `shared/` (the engine is `shared/engine/`), Python's standard library for `serve.py` and the tools. The full specification is [`docs/spec.md`](docs/spec.md); what changed when is in [`CHANGELOG.md`](CHANGELOG.md).

Checks: `sh test/headless/run-node.sh` (unit tests and click-throughs, Node 16+, on the boards in `test/fixtures/`, built by `node tools/build_fixtures.mjs`), `python test/browser/browser_test.py` (in headless Chrome or Edge; build the single file first), `python test/launch_test.py .`. `.github/workflows/checks.yml` runs all of them on GitHub.

## License

The code is MIT ([`LICENSE`](LICENSE)); the showcase packs and test fixtures are CC0; the IBM Plex fonts are under the SIL Open Font License. Details in [`NOTICE.md`](NOTICE.md).
