# Star Lattice — the specification

A starfield on a triangular lattice that maps what you're working on, from broad to detailed. Each star is made of six kites; each kite holds four **star-dots**. Everything a star-dot holds is a star-dot: its **children**, which sit in the slots of its own star (Computer Science → Languages and syntax → R, Python…), down to **terminal** star-dots, the tasks you tick off. A star-dot's star is planned the moment it gets its first child and shows on the map when it's **deployed** from a kite's Zenith. Progress rolls up: a star-dot is ignited once its children are, so the map shows what's done at every level.

Its first use is a **life organizer** (six life categories, your own tasks). The same mechanics could later run a **game** with different content. To keep both possible, the code holds only the mechanics (the **engine**); everything specific to a use lives in data: a **content set** (categories, attributes, marks, retrain periods, rules) and **saves** (a board with its star-dots).

Its second use (round 9) is a **quiz**: every star-dot is a multiple-choice question, answered on PLAY; a correct answer ignites it, and the answers spread the board outward. Quiz mode isn't a separate program but **settings** of the content set (GOVERN › Stars and Questions; see Quiz mode), so the life organizer keeps working exactly as before.

One program (`app/`) has two modes, switched by the green **▶ PLAY** button at the right end of the tab bar:

- **Editing**, in three tabs, where the board is **built**: **MATERIALS** (the hierarchy as a tree, where children are added and anything moves, with the shelf, conflict cards and a card for what's selected), **SCHEDULE** (a calendar for planning hours on star-dots, beside the star-dots as a hierarchy) and **GOVERN** (the rules, the categories and their palette). Star-dot screens open **editable** here, the central star's included.
- **PLAY**, the working game built from those edits: the starfield map, completing and assessing star-dots, Ignite and Lapse, **Deploy** and **Withdraw** stars, the moves the save's **board rule** allows (animated), **retiring** star-dots, **kite designs**, and the constellation layer. Star-dot screens open **fixed** here. While playing, the editing tabs are hidden and the button reads **■ Back to editing**.

Every change is saved as you make it ("Saving…", then "Saved 16:23" beside the save's name; "Not saved — retry" if a write fails), and every change can be undone (↶ Undo / Ctrl+Z). **☾ Dark / ☀ Light** in the save bar shows the program on a dark background or a light one (kept in this browser; until chosen, it follows the system's setting); the starfield map is a dark sky in both. Screens that open on top (a star-dot's, the kite designer) sit a shade off the page, lighter than it in dark mode and darker in light mode, so they read as pop-outs.

This file is the current specification; `CHANGELOG.md` has the history.

---

## Running

**From a desktop icon (Windows):** double-click **`Make desktop shortcut.vbs`** once. A **Star Lattice** shortcut with the app's icon appears on your desktop; double-clicking it starts Star Lattice in a minimized window and opens it in your browser. Close that window to stop it. Starting it again while it runs just opens the browser. If Python isn't installed, it says so and opens python.org (tick "Add python.exe to PATH" in the installer). Run the shortcut maker again if you move this folder. On macOS or Linux: `chmod +x start-star-lattice.sh` once, then run it.

**Without Python (stage 2):** the app also runs from any static web server (VS Code's Live Server, GitHub Pages…) and from **one file**: `python tools/single_file.py` writes `dist/Star Lattice.html`, which opens by double-click. Either way, saves are kept **in that browser** (IndexedDB; the save bar says "Kept in this browser"), filled the first time from the packs (`packs/index.json`). **States ▾ › Download…** saves the open save with its content set as one `.json` file (a backup, or to move it to another browser), and **Upload…** opens one. On a web server, the browser also offers **Install app** (its own icon; it opens offline afterwards). With `serve.py` running, saves are files in `saves/` as before (serve.py marks its responses `X-Star-Lattice: files`, which is how the app tells).

**From a terminal:**

```bash
python serve.py            # from this folder; then open:
python serve.py --open     # …or let it open the browser (and skip a port that's taken)
```

| URL | What |
|---|---|
| http://localhost:8000/app/ | Star Lattice (`/` and the old `/dashboard/` lead here) |
| http://localhost:8000/test/ | all tests |
| http://localhost:8000/test/ui/star-dot-screen.html | the star-dot screen on sample data, in both modes |
| http://localhost:8000/tools/kite-designer.html | Kite Designer, standalone: draw a pattern for each category's kite and export them (the same editor is PLAY's Design…, where designs belong to the content set) |

No build step, nothing to install beyond Python 3 and a browser. Don't open the same save in two browser tabs at once: each writes the whole file, so the last one to save wins. To experiment, duplicate a save (States ▾ › Duplicate…); saves on the same content set share its rules. To start over, **States ▾ › New empty map…** makes a save with only the central star, on this content set or a new one (named, with six categories of your own; its attributes and rules start as a copy of this one's).

---

## Concepts

| Term | Meaning |
|---|---|
| **Lattice** | Positions `[q, r]` in axial coordinates. Six directions, also the six **slots** of a star: 0 NW `(0,−1)`, 1 NE `(+1,−1)`, 2 E `(+1,0)`, 3 SE `(0,+1)`, 4 SW `(−1,+1)`, 5 W `(−1,0)`. Slot *i* of a star points at its neighbor in direction *i*. The **ring** of a position is its lattice distance from the center. |
| **Star** | Six kites at one position. The **central star** sits at the origin and is always on the map; every other star belongs to a star-dot, its **source**, and holds that star-dot's children. It is **planned** (made when its star-dot got its first child, or with Plan its star, and not on the map) until it's **deployed**; a deployed star is **shown** (on the map) while its star-dot is at an open kite's Zenith, else **stored** (hidden, and not drawn). The central star's **notes** are the general notes; it has a star-dot screen of its own. |
| **Kite** | One of a star's six regions, with a **category** (its color), a description, slot labels and four star-dot slots. With the content set's **locks** on, kites are **open** or **locked** in play; with them off (the life organizer) every kite is open. A kite keeps its category wherever it moves, so a star can be multicolored. |
| **Star-dot** | A task on a kite, in one of four slots: **Nadir** (near the star's center), **Port**, **Zenith** (the tip), **Starboard**. It has a name, description, a **role** (○ clicked complete, □ assessed), attributes, free marks, **notes**, relations, a history of where it came from, and children. |
| **Children** | A star-dot's contents: the star-dots in the slots of its own star, in slot order (up to 24). Everything a star-dot holds is a star-dot; its **parent** is the star-dot whose star it sits on (the central star's have none). A **terminal** star-dot has no children: it is completed itself. |
| **Category** | One of six, defined by the content set (name and color). The central star has one kite of each; a new star takes its source kite's category. |
| **Branch** | A star and everything deployed or planned from it. |
| **Shelf** | Star-dots, kites and stars with no place for now, with all their content and branches. |
| **Retired** | Star-dots taken off the map with their stars and children (PLAY's Retired bank), until restored. |
| **Hour block** | An hour planned on a star-dot on a day, in SCHEDULE's calendar. |
| **Kite-less star** | Round 9, with **Kites in: Central star only**: every star but the central one has its star-dots on six hidden kites ("spokes"), where a kite's star-dots would be (round 11), drawn on a faint six-pointed star shape in its category's color (round 10), with no kites. |
| **Item, list** | Round 9, with **Star-dots: Independent**: each category is one ordered **list** of **items** (star-dots in no kite slot); where an item sits is worked out from its place in the list. |
| **Independent star** | A star deployed by an item, holding its category's **next** items (not children). |
| **Question** | Round 9: a star-dot's multiple-choice assessment (question, 4–5 choices, the correct one, an explanation, an image), answered in a popout on PLAY. |
| **Goal, session** | A category's **goal** is one star-dot picked to complete it; a **session** is the progress since the last **Start a new session…** (answers, waits, goals, completed categories). |

---

## Rules

### Checklist and status

- A star-dot's **checklist** lists its children, in slot order. Each child's **bullet** has its role's shape: a **box** (□, completed by the **assessor**) or a **circle** (○, clicked complete). Its border shows **Difficulty**: thin Easy, thick Medium, double Hard, thin gray unset. A small letter beside it shows its **Retrain** period (D W M Q A; nothing for Never or unset). **Marks** sit together in one pair of parentheses, e.g. ($⏱☺): $ ✈ ⏱ come from its attributes (see Attributes), ☺ (involves others) and any other free marks of the content set are set by hand.
- **A □ star-dot is completed by its questions** (round 15), whatever GOVERN's questions setting: its **question set** (one question or many) is answered in its screen's Assessor, and answering every graded one right completes it (see Question sets). A □ without questions keeps **Mark assessed** (dated, like a check) while questions are off. With questions on (round 9), every star-dot is □, and its questions are also answered on PLAY (see Quiz mode).
- A star-dot is **empty** (no task: a faint ring), **open** (not started), **in training** (half-filled) or **ignited** (filled). On the map (round 11) a star-dot that **can deploy a star** (at an open kite's Zenith whose faced position is free, or with its star on the map) is a small six-pointed star, turned like the big stars (long points east and west); **every other star-dot** (inner slots, and Zeniths whose faced position is blocked) is a **circle**. Both fill the same way: in training, the left half. A terminal star-dot is **ignited** while its completion is fresh; once it has ever been completed it is **in training** at least, and never drops below that.
- **Staleness:** a completed star-dot stays fresh for its **Retrain** period (its own, else its parent's, and so on up), then counts as incomplete until it's done again. Levels: Daily (1 day), Weekly (7), Monthly (30), Quarterly (91), Annually (365), Never. Periods are part of the content set (GOVERN › Rules).
- **Ignite** (the override) completes a terminal star-dot now; **Lapse** undoes its completion. Neither is offered once a star-dot has children: they decide.

### Children and roll-ups

- A star-dot with **children** takes its status from them: **ignited** once the save's **share** of them are (**100%** by default, set in GOVERN › Board rules), **in training** while any is under way, else open. It rolls up through every level: igniting R and Python can ignite Languages and syntax, and with it Computer Science.
- In its parent's checklist, such a star-dot's bullet keeps its own shape, is **filled by its children's progress** (empty, half, full) and **bordered by their highest Difficulty** (a Hard grandchild makes it double, at every level); clicking it opens the star-dot. Its screen, card and tree box show the count ("7 of 10 complete").
- **Adding children:** **Add a child…** on its screen (the next free slot, or **Choose a slot…**), or typing a name into an empty slot under it in MATERIALS. The first child plans its star. Slots fill from the kite facing back at it, then outward, Nadir to Starboard on each kite; the checklist follows that order, so reordering a checklist moves children between slots (drag a row onto another, ↑ ↓, **Move to a slot…**, or a move in the tree).
- **Notes** (on its screen, under the checklist) are free lines kept on the star-dot, never completed or counted.
- Nothing caps a star-dot from above: the star-dots its star was deployed from don't limit it.

### Kites and progress

- **Locks** are a content-set rule (GOVERN › Rules, **Kites lock: Off · On**; Off for the life organizer and new content sets). **Off:** every kite is open; nothing blocks completing, assessing, Ignite or deploying, and nothing is drawn locked. **On** (for a game): the central star's kites are all open; in a deployed star only the kite facing back at its source starts open; an open kite with **two** ignited star-dots opens its two neighbors. Opening follows the current statuses, so a kite whose openers lapse locks again (its contents are kept). A star-dot on a locked kite can't be completed, from any screen (its own or its parent's). Locked kites can still be authored.
- A kite's **progress** is the sum of its star-dots' weights (ignited 1, in training ½), 0–4. Its stage: Nebula, Collapse, Protostar, Fusion, Main. How a kite shades is the content set's **fade rule** (GOVERN › Rules › Kite colors by progress): **Darken as they complete** (the default: its category's full color with no progress, darkening toward gray as its star-dots ignite, so the most complete kites, the ones that might be retired, are the darkest), **Brighten as they complete** (the other way, gray to full color) or **No fade** (full color always). It applies on PLAY, in the kite designer's preview.

### Deploying and the layout

- A star-dot at an open kite's **Zenith**, ignited or not, can **deploy its star** (**Deploy its star**, on PLAY's star-dot card, its screen and MATERIALS's card) at the position its kite faces, **only while that position is free** (no star there, not the center, not a reserved ring-1 position): its planned star as authored, or a new empty one. Elsewhere Deploy its star isn't offered, and the card says what's in the way. With **Deploy: By hand** (the default) nothing deploys on its own: igniting or planning doesn't; with **Deploy: Automatically** (round 9), completing a Zenith star-dot deploys its star (see Quiz mode). A new star takes the category of the kite its star-dot sits on, all six kites (round 8: nothing is contested). On PLAY's map it **grows into place from its star-dot**; withdrawing shrinks it back.
- **Withdraw its star** (same places) takes a deployed star off the map with its branch; it stays planned, and deploying it again brings the branch back as it was (each star keeps its own deployed flag). Both are undoable. Saves from before round 7 load with only the central star deployed.
- **A star sits only where its kite faces** (round 8; stars no longer move outward). Deployed stars are placed oldest first. A change that leaves a deployed star facing a taken position (a rotate, swap or move bringing its star-dot to such a Zenith) **withdraws** it in the same change, and the message says so (one Undo brings both back); its branch leaves the map with it and comes back when it's redeployed. Of two deployed stars wanting one position, the one already there keeps it (else the older). A save opens the same way: a deployed star whose position is taken is withdrawn (written with the next change).
- A deployed star is **shown** whenever its star-dot is at an open kite's Zenith.
- **Planned stars:** a star-dot's star is planned when it gets its first child (or with **Plan its star** on MATERIALS's card), at any depth. It stays off the map, and isn't drawn at all (round 8), until it's deployed, then appears as authored. A planned star keeps its source kite's category.
- **Ring-1 positions are reserved** for their central kites: ring-1 stars come only from central kites' Zenith star-dots, so each category keeps its own star (never contested).
- **Each star-dot owns its own star.** Rotating a kite brings a different star-dot to the Zenith: the previous one's star is **stored** (off the map, not drawn) and comes back unchanged when its star-dot returns; the new one shows its own star (if it has one). Stored and planned stars are authored from their star-dot's screen and in MATERIALS's tree.
- **Lineage is placement:** a star-dot depends on the star it sits on now, wherever it was authored.
- The central star always holds the origin; a kite facing back at its source (or the center) can't deploy.

### Colors of new stars

- A new star's six kites take the **category of the kite its star-dot sits on**, like a planned star's, whatever it borders (round 8 removed the contested-color rules, the waiting "pick a color" star and the Unlock lab).

### Moves

- **Rotate a kite** (↻ Rotate on PLAY's and MATERIALS's kite cards; R on PLAY): each star-dot moves one place clockwise (Nadir → Port → Zenith → Starboard → Nadir). Slot labels stay.
- **Swap star-dots:** any two slots on any stars (one may be empty). Each star-dot takes its branch along, turned to its new direction. One moved to another star notes where it came from ("Moved from Career › central star", on its screen; no effect on rules).
- **Swap kites:** any two kites, with their star-dots and branches; central kites swap only among themselves.
- **In MATERIALS** every swap is possible, whatever the board rule, with **one gesture** in the tree: **double-click** (double-tap) a star-dot, kite or shelved circle to pick it up; **click** your way to where it goes (boxes it can't go to are dimmed); **double-click** there. The **shelf** (above the tree) is a place too: set something aside there, or pick a shelved one up and place it. Double-click the picked-up box again, or Esc, to put it down. A deployed star moves and shelves with its star-dot. **Conflict card:** a move that would put a star-dot inside its own branch asks first: **Shelve** (its branch goes to the shelf and the star-dot moves alone, in the slot you chose) or **Cancel**. (A deployed star that a move turns toward a taken position is withdrawn; see Deploying.)
- **On PLAY**, moves follow the save's **Movement** setting (GOVERN › Board; each save has its own):
  - **Free** (the default): MATERIALS's moves, swapping star-dots and kites anywhere with their branches, minus the shelf; moving a star-dot into its own branch is refused, with the reason ("Resolve it in MATERIALS").
  - **Fixed (rotate only):** only ↻ Rotate.
  - **Locked** (round 9): nothing moves on PLAY, not even ↻ Rotate (R does nothing; the kite card has no move buttons).

  Only allowed targets light up while dragging; any other drop changes nothing and says why. PLAY has no shelf and no conflict cards. Older saves: Rotate only became Fixed board; Within stars and Anywhere became Free.
- **On PLAY's map, moves animate** (about 300 ms): star-dots slide to their new slots, a carried branch turns and slides with its kites and designs, stars that are deployed fade in and stars that leave fade out; the map takes no taps until it ends. Nothing animates with the system's reduce-motion setting; the tree and every other view change at once.
- **Merge** (on the star-dot screen, see below) also moves things; it's undoable. Moving a star-dot onto another star makes it a child of that star's source.

### Retiring

- **Retire** (on PLAY, on a selected star-dot's card; round 14: also on its screen, unless PLAY is locked) takes any star-dot off the map with its star and everything on it; its slot frees up. Its parent then counts only the children still on its star (retiring 2 of 7 complete children leaves 5 of 8), and its hour blocks still ahead go. It's undoable.
- The **Retired bank** (PLAY's sidebar, below the overview; round 14: also MATERIALS' side card) is a row of **dots**, one per retired star-dot, newest first, in the color of the kite it left and filled by its status. **Clicking a dot** shows its details under the row (clicking it again hides them): its name, where it came from and when, **Open ↗** (its screen, read-only), **Restore** brings it back to its old slot if that's free, else its old parent's next free slot, else MATERIALS's shelf (and says which), and **Delete…** deletes it for good.

### Deleting

- **Delete…** (a star-dot's screen in the editing tabs, a checklist row's ×, a shelved star-dot's card in MATERIALS, the Retired bank) deletes a star-dot **with its whole branch**: its star, every star-dot on it and further out, their hour blocks, and others' relations to them. It always asks first, naming what goes ("Delete Computer Science, its star and the 18 star-dots on it? Undo brings it back."), and one Undo brings everything back. The central star can't be deleted. (Retiring takes things off the map to restore later; deleting is for mistakes and things that are done with.)

### Attributes

- Every star-dot has attributes: **Environment** (a place; Local and Distant need travel), **Financial Influence** (a signed dollar amount, + earns, − costs, with a period: one-time, per week, month or year), **Retrain** (the period above), **Difficulty** (Easy, Medium, Hard) and **Due** (a date). The choices come from the content set.
- A star-dot without a value of its own **inherits** its parent's (and so on up the lineage). **Financial Influence is the exception:** it is a star-dot's own only (so a wage sits on the one star-dot that earns it). $0 counts as none.
- **Derived marks:** $ appears when a star-dot has an amount other than $0 (green earns, red costs); ✈ when its Environment needs travel; ⏱ when it has a Due date (red when overdue). Old hand-set $ ✈ ⏱ marks show gray until the attribute is set.
- A star-dot's **summary**: a terminal one shows its own values; one with children **rolls theirs up**: Financial Influence as totals ("−$40/mo · +$400 one-time", recurring amounts as a monthly rate: weekly × 52/12, so $200/week is +$866.67/mo); Difficulty as the **highest** ("Hard", no counts); Environment by use ("Office ×3 · Kitchen · ✈ Distant"); Retrain as the most frequent level and the next to go stale; Due as the nearest date and how many are overdue. It names whose value it is: "Mar 1 (plots)". Read-only: values are set on the children.

### Relations and relevance

- A star-dot can have **relations**: one-way, to any other star-dot, each with a **score** 1–5 and a **How?** note. The other star-dot lists it under "Relevant to me".
- A star-dot's **relevance to a category** is the average score of its relations to star-dots in that category ("—" when it has none); a star-dot with children averages its own relations with all of theirs.
- Relations never affect status or deployment. Real dependency is **lineage**: a star-dot that builds on an earlier one belongs on a star deployed from it.

### Question sets (round 15)

A □ star-dot's **assessment is a question set**. It's written in the star-dot's Assessor (**Edit questions**: a form, round 17), or imported in bulk (**MATERIALS › Import questions…**), as plain typed-up questions or the Markdown format (`question-format.md` has both; `test/fixtures/problem-set.md` is a full Markdown example).

- **The form** (round 17): a card per question with its kind (Multiple choice, Fill in the blank, Number, Typed answer, Step), its text and what that kind needs: choices (Right checkboxes, feedback, + Add a choice, Shuffle choices), blanks (Insert a blank, accepted answers one per line, Ignore case), the number (decimals, ±, units), the typed answer (also accept); an explanation, a hint and an image for each; ↑ ↓, Duplicate, Delete. What a card still needs is said on it, and Save waits until nothing is. **Paste questions…** turns typed-up questions into cards. **Edit as Markdown** shows the same draft as Markdown (chains are made there) and **Back to the form** returns.
- **Shuffling** (rounds 17–18): GOVERN › Questions has two switches, both Off by default.
  - **Shuffle choices:** a choice question shows its choices in a new order each attempt (each question can say As GOVERN says, Shuffle or Don't shuffle). An attempt keeps its order; a new one is drawn when the star-dot comes back for retraining, and with each new session. “All / None / Both / Neither of the above” keep their place; a question whose choices name others by letter isn't shuffled.
  - **Shuffle the questions** (round 18, Star-dots: Independent only; greyed out under Hierarchical): each session, each category's star-dots fill the field in a new order. MATERIALS keeps your list's order, with a note in place of its Central kite / Star 2 lines. Changing it asks first and starts a new session (one undoable step).
  - A star-dot's own set of questions is always asked in the order written.
- **Import without targets** (round 17): plain questions go **Into one star-dot** (picked in the preview) or **A new star-dot per question** (each a new □ child of a picked star-dot, named by its first line; under Independent, new items at the end of a category's list).

- **Kinds:** **choice** (2–8 options, one or several right: "choose all that apply"; per-option feedback; optional shuffle), **blank** (one or more `____` in text or code, each typed), **number** (a value to its written decimals, or a tolerance, with optional units: a number read off your own console), **recall** (a line or block of code typed from memory) and **step** (instructions with code to Copy, confirmed with Done, not graded).
- **Typed answers** compare token by token: spacing, line breaks, quote style, a trailing `;` and comments don't matter. Accepted alternatives can be listed, or written as a regular expression. A wrong recall says where it first differs, with **Count it as right** for a self-grade.
- **Shared context:** a set's (and a chain's) context shows above its questions: a scenario, a data table, setup code.
- **Hints** are revealed one at a time, on request. The **explanation** shows after an answer, right or wrong. The right answer itself is never shown after a wrong one.
- **Order:** questions are independent, answered in any order (pick one in the list above the question, or **Next ›**). A **chain** groups questions that build on each other (load the data, then fit the model…): they're answered in order, each opening once the ones before it are right.
- **Completion:** each right answer is kept in the save, and a star-dot with some right is **in training** (its □ half-filled). The last right answer **ignites** it, and its progress clears, so a Retrain period or a new session asks the whole set again.
- **Wrong answers** follow GOVERN › Questions › After a wrong answer, **per question**: under Wait N minutes only the missed question waits (in a chain, the rest of the chain with it); the others stay open.
- **Import:** each set's `target:` names its star-dot (names joined by `>`, e.g. `Statistics > Problem set > 1.`; under Independent, `Category > Item`). The preview lists the file's errors by line, and where each set goes:
  - an existing star-dot (**Replace** its questions, or **Append** to them);
  - a new □ child, when the last name is missing;
  - or why it can't, and a picker for a set with no target.
- **Importing** is one undoable step, and makes its star-dots □. **Export questions…** writes every set in the save as one file, each with its target. `node tools/check_questions.mjs <file.md>` checks a file from the command line.

### Quiz mode (round 9)

Each part is a setting of the content set (GOVERN › Stars and Questions), so the four combinations of the two models below all work; the life organizer keeps the defaults (All stars, Hierarchical, By hand, questions off). A quiz content set (the Statistics essentials and Trivia night packs) has the quiz's: Central star only, Independent, Automatically, questions on.

- **Kites in: All stars · Central star only.** With Central star only, the central star keeps its six kites; every other star is **kite-less**: six hidden kites ("spokes"), each holding its star-dots where a kite's would be (round 11: Zenith at the tip, Port and Starboard beside it, Nadir near the center, as on the central star). Round 10: it's drawn as a **faint six-pointed star shape** in its category's color (an outline and a faint fill, no kite lines; it takes no taps) with its star-dots on top, so a Zenith's answer visibly deploys a new star housing the next star-dots; it grows out of its star-dot and shrinks back when withdrawn. Its star-dots and the empty slots its count offers show at any zoom. A spoke's Zenith deploys toward the neighbor in its direction, as a kite's does; spokes are always open (Kites lock doesn't apply).
- **Star-dots per star: 6 · 12 · 18 · 24**, on every star, **the central star included** (round 11): each kite (or spoke) uses its Zenith (6), then its Port (12), its Starboard (18) and its Nadir (24). They fill the other way, Nadir, Port, Starboard, then the Zenith (among those in use), around a star's kites from the back one, so the Zeniths come last. Lowering the count hides nothing: star-dots already in other slots stay and count; only the empty slots offered shrink (on the map and in the tree). It applies with Kites in: Central star only; with All stars every kite keeps its four.
- **The Zenith last** (with Central star only): a Zenith, on a spoke or a central kite, can be completed (ticked, assessed, ignited, answered) only once every other star-dot on its spoke or kite is ignited; its screen and its question say so.
- **Star-dots: Hierarchical · Independent.**
  - **Hierarchical** (today's): a star-dot's star holds its children (on kites, or on spokes), with roll-ups.
  - **Independent:** each category is **one ordered list** of items (MATERIALS). The first items fill its central kite, as many as the per-star count offers (24: four, Nadir, Port, Starboard, then the Zenith; 12: Port, then the Zenith; 6: its Zenith only); each **independent star** the category deploys takes the **next** items (a kite-less star its per-star count, inner rings first, Zeniths last; a kited star its 24 slots, Zeniths last), oldest star first; when the list runs out the last star holds what's left. Stars still deploy after that (round 12: a Zenith deploys whenever its faced position is free), empty. On the map, under Independent, a star-dot's symbol is drawn only where there is an item: no empty slots (round 12). Every item is its own status: no children, no roll-ups, nothing inherited. The item that opened a star only sets where it goes. A withdrawn independent star holds no items until it's redeployed. Nothing moves on PLAY, and there's no Retire: the list order places the items.
  - **One set of star-dots, two arrangements** (round 16): every star-dot has a place in the tree (kite slots, children, stars) *and* in its category's list, kept in step on every change and as a save opens. A star-dot added under Independent gets the first free tree slot in tree order (the central kite, then breadth-first through its stars; a star is planned on a Zenith when none is free); one added under Hierarchical joins the end of its list. Moving or reordering in one arrangement leaves the other alone, so switching shows each as you left it. Deleting deletes from both; a shelved or retired star-dot leaves its list and rejoins at the end when it's back. Under Hierarchical a star-dot with children is decided by them, so a question set on one with children can't be answered until they are.
- **Deploy: By hand · Automatically.** Automatically: completing (or answering correctly) a Zenith star-dot whose faced position is free deploys its star in the same change (one Undo takes back both), growing out of it; PLAY then offers no Deploy (MATERIALS and the star-dot screen still do).
- **Every star-dot is a question: Off · On.** On: every star-dot is □, and its **question set** (round 15; round 9's was one multiple-choice question, and loads as a set of one) is answered on PLAY. Questions are written with the **assessor** on the star-dot's screen in the editing tabs (Edit questions), or imported (see Question sets). A question can have an **image** (shrunk on upload to 800 px on its long side, kept in the save).
  - **Answering:** tapping a star-dot on PLAY opens its questions in a small **popout** (the image to the right of the text; with several questions, their list and progress above, and Next ›). The first choice is **final** until the popout closes (×, a click outside, Esc). Right: "Correct." with the explanation, and the star-dot **ignites** (with Automatically, a Zenith deploys). Wrong: "Not quite." with the explanation, **never showing the correct choice**. A Zenith waiting for the star-dots inside it has a small **padlock** over it on the map (round 14). A star-dot that can't be answered yet says why ("Answer the star-dots inside it first", a wait's countdown, its kite locked, its category complete). A correct answer is the star-dot's completion: under a Retrain period it can go stale and open again.
  - **On the map:** an unanswered star-dot is drawn **faded**; an answered one in **full color**.
- **After a wrong answer: Retry now · Wait N minutes** (1–1440). With a wait, that question (round 15: per question; a star-dot of one question, as before) is closed until its time passes (kept in the save, counting down in the popout and the player's panel); the others stay open. Switching to Retry now lifts the waits running; back to Wait, those not yet over return.
- **Goal after N correct** (per category; 0 = no goal). Once a category has N correct answers, one **unanswered star-dot already on the map** is picked at random as its **goal** (kept in the save); its **fill slowly fades in and out** between a dim and the full tone of its color, with no ring around it (round 11), and the panel says "Goal: find the twinkling star-dot". If none is on the map, it's picked when one appears (for example as the answer that reached N deploys the next star). A goal that leaves the map is picked again.
- **Completing a category** (for the session): answering its goal; or, under Independent, answering every item of its list (goal or not; under Hierarchical, only the goal completes one, since more star-dots can appear as stars deploy). Its star-dots disappear, and its central kite and its stars are drawn **filled** solid in its color (a kite-less star's faint shape becomes a filled star), each **twinkling** between its color and clear (round 12: fading into the background, not to gray), **in phases**: three, spread over the lattice, so neighboring stars are never in step (one fading out while the next comes back to full color); the panel says "★ Complete". It's a **closed branch**: nothing in it can be answered or deploy any more. Neither the twinkle nor the goal's fading runs with the system's reduce-motion setting.
- **Sessions:** answers, waits, goals and completed categories are kept in the save. **Start a new session…** (GOVERN › Board; asks for the PIN, then to confirm; undoable) clears them all, takes every star but the central one off the map (independent stars are removed, hierarchical ones withdrawn) and keeps the questions and the lists (round 15: and clears each set's progress).

---

## The tabs

### PLAY (▶, the working game)

The whole map (drag to pan, scroll or pinch to zoom; **Fit**, **−**, **+**; F fits, R rotates the selected kite, Esc cancels). The toolbar shows the save's board rule, the layer (**Off · Constellation**) and **Kites: Solid · Designs**. The lattice is drawn around the stars on the map (and a selected star-dot's star), every point alike.

- **Star-dots are hidden until you tap a kite:** then its four show, at any zoom (during a Swap… or a drag, the slots the move may go to show too; the Relations and Constellation layers show star-dots as before). **Except due ones** (round 14): a star-dot with a **Due date** that isn't complete (open or in training) is always drawn, whatever's selected or the zoom, and its symbol **fades to clear and back**, faster the sooner it's due: **Fast** (1.3 s) due within a day or overdue, **Normal** (2.6 s) within 3 days, **Slow** (5.2 s) within a week, **Very slow** (10.4 s) beyond (counted to the end of its due day; GOVERN's Twinkle speed doesn't change these). Not with reduce-motion.
- **Symbols** (round 14): an **empty slot** is a very small filled dot. A kite with **no star-dots** is a **dashed outline** in its category's color, unfilled, and can't be tapped; while a kite is being swapped (Swap kite… or a drag, under Free) the empty kites it may go to light up as targets.
- **Tap** a star-dot to **select** it: small **pills** appear beside it on the map, **↗** (round 14; its screen, fixed) and **Deploy** where it can deploy (**Withdraw** for a deployed star), and its card shows its status, kite, where its star is (and why it can't deploy, if it can't), relations, **Deploy its star** or **Withdraw its star**, **Open ↗** and **Retire**. Tapping it again keeps it selected. A □ star-dot with questions (Every star-dot is a question off) also gets an **Answer** pill and card button: a popout with only its questions, the same one quiz mode uses, while ↗ still opens its full screen. Nothing is drawn for a star that isn't on the map: no outline of a planned or stored star, no what-if.
- A **white dot at the center of the central star** opens the central star's screen (fixed).

- Tap a kite, slot or empty position to see its **card**. A kite's card has its description, ↻ Rotate, Swap… per star-dot and Swap kite… (under Free) and **🖌** (Design…, round 14). A selected kite also has **pills** beside it on the map (round 14): **↻ Rotate** (where the board rule rotates), **Swap kite…** (Free) and **🖌**. An empty position's card says where it is. PLAY shows nothing of the editing tabs except **■ Back to editing**.
- **Kite designs:** with **Designs**, every open kite that has a design is painted with it, in its progress color. **🖌** (Design…) opens the designer over the map, for the kite's **category** (in this save, round 8: each state has its own; every kite of the category without one of its own shows it, and follows its changes) or **this kite only** (it starts from the category's; **Use the category's design** drops it). Fill paints regions, and Lines paints guide segments, with the same tones (Ink, Light, Dark, Clear: a Clear line cuts a gap through the design; stroking a line in its own tone takes it away), with symmetry; each stroke is one undo step; the preview shows the design in all six directions, from no progress to complete. **Import…** takes the standalone Kite Designer's Export file (by category name).
- The overview card (nothing selected): the board's counts, anything waiting for a decision, and the **Retired bank** (see Retiring).
- **Drag** a star-dot onto another star-dot or an empty slot, or select a kite and drag it onto another kite, as the board rule allows.
- **Layer** (Off · Constellation; round 8 removed Relations). **Constellation:** a dark sky where kites and stars fade and each star-dot glows by its strongest relation; tapping one shows only its relations.
- On a phone the card becomes a bottom sheet.

**The player's PLAY** (round 9: whenever questions are on, for the assessor too). The map shows **every star-dot** at any zoom (faded until answered, then in full color), except a Zenith still waiting for the star-dots inside it, which appears once it can be answered (round 18), and **tapping one opens its question** (see Quiz mode); nothing else is selected. A star-dot waiting after a wrong answer opens only a small pill with its name and countdown (round 18). The toolbar has only **Fit, − and +**; the card is the **player's panel**: each category's **“n of m right”** (under Independent its whole list; under Hierarchical its star-dots on the map), its goal ("Goal: find the twinkling star-dot") or "★ Complete", and any **waits** counting down. Left out: kite cards, pills, Retire, Design…, the layer and Designs switches, the Retired bank and the central star's dot. Moves still follow Movement (Locked suits a quiz; under Independent nothing moves).

### MATERIALS

(Called PLAN & REARRANGE until round 14; `#materials` and `#rearrange` both open it.) The board as a **hierarchy tree**, with a **side card** for what's selected (`rearrange` in the code). At the top, beside "Central star", a **box named after the content set** ("Life Organizer ↗", with a dot: dark gray in light mode, white in dark) opens the central star's screen. Levels alternate kites and star-dots: the central star's six kites (in compass order E, NE, NW, W, SW, SE), then the open kite's four star-dots (Zenith, Port, Nadir, Starboard), then the six kites of that star-dot's star, and so on. A star has no box of its own: its star-dot's box stands for it. One path is open: opening a box closes its open siblings, and lines join it to its children.

- **The shelf** sits above the tree, as a wooden ledge: each shelved star-dot, kite or star is a small circle in its category's color, filled by its status (a star ringed). **Click** one to select it (its name shows, and the side card); **double-click** (double-tap) to pick it up and place it in the tree, and again to put it down. With something picked up in the tree, double-click the shelf to set it aside there. Shelved things don't unfold on the shelf.

- **A box** shows where it is, its name and status (a star-dot whose children decide shows its count, "In training · 7/10"); **marks** under it are its children: a kite's four star-dots by status (empty / half / filled), a star-dot's star's six kites by **how much of each is done** (empty, half, full; faint for a kite with nothing in it). Clicking a mark goes straight to that child. A star-dot's box has a small **↗** at its bottom right (round 14): its screen. Every box can be clicked, named or not. A kite with nothing in it, and its unnamed name (its category's, gray and italic), stay quiet until selected; it's still fully usable.
- **Click** a box to select and open it. A star-dot opens its star's kites **and the kite holding its next free slot**; a star-dot with no star shows the six kites of the star it would plan, **dashed** (nothing is created by looking).
- **Adding children:** under a star-dot, every empty slot is a name field straight away (**Add a child…**). **Enter** adds the child there (planning the star first if needed) and puts the cursor in the next free slot; leaving the field or Esc adds nothing. Elsewhere (the central star, the shelf) the selected box's name is a field: type to rename, or on an empty slot to name a new star-dot (a central kite's name is its category's).
- **Moving:** see Moves (double-click, click, double-click).
- **The card:** for a star-dot, its place, status and star, its relations and lineage, ↗ Open, **Deploy its star** / **Withdraw its star** where it can, **Plan its star** (one without a star: an empty star, for children to go in) and; for a kite, its **description** and **slot labels** (double-click to edit; an empty label shows the slot's name), its slots and **↻ Rotate**; for a shelved thing, ↗ Open and (a star-dot) **Delete…**. Every other move is the tree's gesture.
- **The Retired bank** (round 14) sits in the side card, below what's selected, as on PLAY (see Retiring).
- **Import questions… · Export questions…** (round 15) sit at the top right, under the tree or the lists alike (see Question sets).
- On a phone (≤ 760px), rows go two across, the lines become a colored left edge, and the card sits below.
- **Under Star-dots: Independent** (round 9), MATERIALS is instead **a list per category** (central kite), with no tree or shelf (they stay dormant). Each item shows its place (1, 2, …), its status, its name (**double-click to rename**), "no question" when questions are on and it has none, a colored **band on its left** to drag it by (onto another item, to move it there; round 14, in place of ↑ ↓; by finger too), **↗** (its screen, where its question is written, on the map or not yet) and a small **×** (delete; asks first; it takes the star the item opened, and the items it held move on). **Add an item…** at the end of each list. A line marks where each star's items begin: "Central kite" (the first four), "Star 2", "Star 3"… (the category's independent stars on the map, oldest first) and "Not on the map yet". Reordering moves items between places (an item that opened a star moved off its Zenith takes that star off the map until it's back at one). The six lists sit **side by side, in order** (round 14: not wrapped), scrolled a column at a time with **◀ ▶** at the top right. Everything is undoable.

### SCHEDULE

A calendar for planning hours on star-dots, with the list of star-dots beside it.

- **The calendar:** five day columns (today and the next four; ← → move five days, **Today** comes back), with a row for each hour from 6 a.m. to 10 p.m. A star-dot's own Due date is marked in its day's header. **Gap between blocks** (15, 30 or 60 minutes, the save's) sets the least time between blocks.
- **The list**, as **By star-dot** (the default) or **All**; complete star-dots only with **Show complete** (in By star-dot a complete one hides with its branch). No prompts to retrain: when to do it is yours.
  - **By star-dot:** the central star's star-dots, each rolling up its branch: the soonest **own** Due date among it and its incomplete descendants ("Due Nov 1 (Problem set)" when it's a descendant's; red when overdue, "+2 overdue" when more are), or its parent's Due in gray, "(inherited)", when it has none of its own (an inherited Due never counts toward a roll-up); the most frequent Retrain level in its branch; n of m complete; when it was last addressed. **▸ / ▾** shows or hides its children, one level at a time, indented right under it, each with its own ▸. Each level is ordered like All, on the rolled-up values.
  - **All:** every star-dot on the map, parents included (not on the shelf or retired): by **Due date** (its own or inherited; soonest first), then **how often it recurs** (its Retrain period, most frequent first), then the one **addressed longest ago** (its, or a child's, last completion, or its last hour block that has passed; never addressed first), with its parent (in its kite's color).
  - Every row: its bullet, name, Due, Retrain level, when it was last addressed, **Plan time…** and ↗.
  - Under Independent (round 9) **By star-dot** lists every item on the map at the top (none has children), and **All** names each item's category where a parent would be.
- **Planning:** Plan time… on a row, then a day's column, then how many hours, then **Place**: that many 1-hour blocks, spread as evenly as possible over the day's free time (equal time before, between and after them), at least the gap from any other block, on the quarter hour (it says so if they don't all fit).
- **Blocks:** drag one up or down within its day (it snaps to 15 minutes; an overlap is refused, with the reason); **×** removes it; a **click** opens its star-dot's screen, where its children can be ticked. When a star-dot becomes complete, wherever that happens, its blocks still ahead disappear; earlier ones stay. All of it is undoable.

### GOVERN

Four subtabs (round 9), each saying whose settings they are (the address follows: `#govern/board`, `#govern/stars`, `#govern/questions`, `#govern/look`; `#govern` opens Board).

**Stage 3:** the content set's rules are declared once (`shared/engine/rules.js`: each rule's label, values and short names, what each does, its subtab, whether it's Advanced, when it applies, whether changing it starts a new session, whether the engine reads it), and GOVERN is generated from that list. Each rule shows its label, a **?** (what it and each choice does, on request) and its control; a rule that doesn't apply is greyed out and says why; **Advanced** folds the rarer ones (Board: the share and the assessor PIN; Stars: Kites lock; Look: twinkle speed and the background lattice). **Look › Words** sets this content set's word for a star-dot ("task", "question", "skill"…; plural too), which the app then uses everywhere it writes the word (names you wrote are left alone, unless they contain "star-dot" itself).

- **Board** (this save): **Movement** (Free · Fixed (rotate only) · Locked, see Moves) and the **share** (the percent of a star-dot's children that must be ignited to ignite it, default 100, see Children); the **assessor PIN**; **Start a new session…**.
- **Stars** (the content set): **Kites in** (All stars · Central star only), **Star-dots per star** (6 · 12 · 18 · 24; greyed out under Kites in: All stars, where each star holds 24; a star-dot beyond the count keeps its slot and is marked “over the per-star count”, round 16), **Star-dots** (Hierarchical · Independent), **Deploy** (By hand · Automatically), **Kites lock** (Off · On), and how positions work.
- **Questions** (the content set): **Every star-dot is a question** (Off · On), **After a wrong answer** (Retry now · Wait N minutes; the correct choice is never shown), the **goal question** (after N correct answers in a category; 0 for none) and the retrain periods.
- **Look** (the content set): **Categories** (the six categories and the **palette menu**: the five built-in palettes and your own named ones) and **Kite colors by progress** (Darken · Brighten · No fade); **The map** (round 13): **Twinkle speed** (Very slow · Slow · Normal · Fast: one fade out and back takes 10.4, 5.2, 2.6 or 1.3 s for a completed category's twinkle, and a quarter longer for the goal question's fade; the three twinkle phases stay a third of a cycle apart) and **Background lattice** (Shown · Hidden: hidden, no lines are drawn, and an empty position's point shows only under the pointer or when selected; positions stay clickable).

The content set's settings apply to every save on it. The Stars and Questions settings are quiz mode's (see Quiz mode).

- **The assessor PIN** (4–12 digits or letters, stored hashed in the save; it keeps a player on PLAY, it isn't security, since anyone with the files can edit them). While one is set, the app opens on PLAY and PLAY is **locked**: the player has no Undo, Redo (Ctrl+Z does nothing) or States menu, an editing address opens PLAY instead, and **■ Back to editing** asks for the PIN. Once it's entered, editing is open until PLAY is opened again. Setting, changing or clearing the PIN, and starting a new session, ask for the current one.
- **Start a new session…** (asks for the PIN, then to confirm; undoable): every star but the central one leaves the map (independent stars removed, hierarchical ones withdrawn, still planned), and every answer, wait, goal and completed category is cleared; the questions and lists stay. While PLAY is locked, no Undo reaches the save, not even a message's Undo button.

---

## The star-dot screen

One screen for everything about a star-dot (`shared/ui/starDotScreen.js`), opened from any tab: fixed on PLAY, editable elsewhere. It opens **on top of the page it came from**, a panel over most of the window with that page still showing, dimmed, around its edges (almost the whole screen on a phone); clicking that edge, × or Esc closes it.

| Area | Content | PLAY (fixed) | Editing tabs (editable) |
|---|---|---|---|
| Header | Status star and name; status, place, children complete, retrain and next stale date, its star (**Deploy its star** / **Withdraw its star** where it can); where it came from; description | fixed (Deploy and Withdraw work) | name and description editable; **Merge into…**, **Delete…** |
| Left sidebar | Filter the children by □, ○, Easy / Medium / Hard border, $ earns, $ costs, ✈, ⏱, ☺ (one at a time) | works | works |
| Checklist · Table | **Checklist:** its children in slot order: bullets (their own shape; one with children filled by their progress and bordered by their highest Difficulty), Retrain letters, marks, Open ›; "n of m complete" once it has children; Ignite, Lapse (star-dots without children only). **Table:** the same children as rows, with a column set: **Status** (status, children done, Retrain, Due), **Attributes** (Difficulty, Financial Influence, Environment) or **Relevance** (a tinted cell per category); a name opens that child | click ○ to complete, □ to select it, a bullet with children to open it; click text to select | plus **Add a child…** (next free slot, or **Choose a slot…**), double-click to rename, drag a row onto another (or ↑ ↓) to swap places, × (Delete…, with its confirmation) |
| Notes | Free lines kept on the star-dot, under the checklist; never counted | fixed | **Add a note…**, double-click to edit, × |
| Attributes | Selected child: its own values (inherited ones shown for the rest, except Financial Influence), kind □/○, free marks. Nothing selected: the summary of its children (a star-dot without children: its own values) | fixed | click a value to cycle it (Shift-click back; hover lists them all); amount and date inputs; **Edit its own**; **Move to a slot…** |
| Assessor | Round 15: for the selected □ child, else this star-dot: its **question set**, answered here (progress, the list of questions with chains grouped, the context, one question at a time, Next ›). Answers count everywhere it's shown. A □ with no questions has **Mark assessed** / Undo (questions off). On the editing tabs, **Edit questions** (**Write questions…** for none): round 17's form (a card per question; Paste questions…; Preview, Save, Cancel; Edit as Markdown for round 15's Markdown box with Check, Preview, Save, images and Back to the form) and **Remove the questions** | answering | answering, and Edit questions |
| Relevance Information | Category averages, relations (score, How?), "Relevant to me" | fixed | scores cycle by click; + Add relation |

Opening a child or a related star-dot shows its screen in the same panel; ← Back (or Esc) retraces the trail, then closes. A retired star-dot's screen (from the Retired bank) says so and where it came from. With questions on, every bullet is □ and Kind reads "□ A question"; a Zenith waiting for the star-dots inside it (Central star only) has Ignite off and says why. Under Independent an item's screen has no Add a child…, slot picker or Move to a slot… ("each star-dot stands alone"), and opens for an item not on the map yet.

- **The central star's screen** (the white dot on PLAY's map, the "Life Organizer ↗" box in MATERIALS's tree) is the same screen as if the central star were a star-dot: named after the content set; its children are the central star's star-dots (**Add a child…** fills its free slots); its status, Difficulty and attribute summary roll up from them; its **Notes** are the general notes; its relevance averages its star-dots'. It has nothing of its own to merge, delete, complete, deploy or move.

- **Merge into…** picks another star-dot (not one in its own branch), shows what moves, then merges: notes appended, relations combined (higher score, notes joined; others' relations re-pointed), its star with its children moved to the target (or the shelf, if the target has one), its name and description added to the target's description; the source is deleted and the target's screen shows.

---

## Data

| File | Holds | Format code |
|---|---|---|
| `content/<id>.json` | A **content set**: title, 6 categories (name, color), the 5 attributes (choices for Environment, Retrain and Difficulty, with `travel` and `days` flags; a signed amount for Financial Influence; a date for Due), free marks, relevance and stage names, slot names, the central star's starting arrangement, rules (fade, locks, and round 9's quiz settings: `kites` all · central, `stardots` hierarchical · independent, `perStar` 6–24, `deploy` hand · auto, `questions` off · on, `wrong` { mode retry · wait, minutes }, `goalAfter`; an older file's ownership and color rules are dropped as it loads, and its kite designs handed to a save without its own, once) | `shared/engine/formats.js` |
| `saves/<name>.json` | A **save**: the content set's ID, title, the engine state (stars with their deployed flag, the central star with the general notes, kites with their descriptions, slot labels and own designs, star-dots by ID with their role, marks, attributes, notes, completion, relations and history, the shelf, the **retired** star-dots and where they came from, the **hour blocks**; round 9: star-dots' **assessments**, the **lists** (category items by central kite), **independent stars** (marked, with their category), **waits**, **goals** and **completed categories**; positions are never stored), the **board rule** (Movement: `free` · `fixed` · `locked`, default `free`), the hashed **assessor PIN** (or none), the **share** (1–100, default 100), the **gap** between hour blocks (15 · 30 · 60 minutes, default 30), the categories' **kite designs** (round 8; Duplicate… copies them, New empty map… starts with none) | `shared/engine/formats.js`, `model.js` |

Files are format version 8 (round 15: assessments are question sets, with each star-dot's progress through its set (`answered`) and waits by question (`dotId#questionId`); a round 9 assessment loads as a set of one choice question, an older wait goes to its first question. Version 7: Locked, the assessor PIN, the content set's quiz settings, and the save's assessments, lists, independent stars, waits, goals and completions in round 9; older files load with none; the board rule was added in round 3, the share in round 4, one record type in round 5, kite designs, retired star-dots, hour blocks and the gap in round 6; deployed stars, the two board rules, the locks rule in round 7; the fade rule and the categories' designs in the save, with lines in tones (design version 2; older lines load as Light) in round 8). A version-4 file loads with only the central star deployed, its board rule mapped (rotate → fixed, within and anywhere → free), other stars' notes appended to their source star-dot's Notes, and the urgent flags and table order dropped; the content set gets locks off. A star-dot's children are the star-dots on its star; nothing lists them separately. Older saves upgrade as they load: each checklist line, then each "- " line of the description (a heading ending in ":" with lines under it becomes a child holding them), becomes a child on its star (planned then); a line's guidance becomes its children (complete if the line was); each notes where it came from. `tools/import_quiz.js` (round 9) imports a bank of numbered multiple-choice questions with an answer key (the format of `test/fixtures/quiz-bank.md`) into a save's category lists: its categories in order, each question an item named by its number (Q001) with its choices and the key's correct letter, and the quiz settings; it refuses a second run. Settings that belong to a browser rather than a save (the last save opened, your own color palettes, the track label, Solid or Designs, light or dark) are kept in its localStorage. The five built-in palettes (fizzbolt, coastglow, gladetrail, cloudblush, mothchalk) are part of the app (`app/js/model.js`), so every browser has them; the palette in use is simply the content set's category colors. Every loaded file passes through one normalizing gate (`normalizeContent`, `normalizeSave`), which fills defaults and upgrades older files.

---

## Code

```text
serve.py         local server; JSON file stores for saves/ and content/
shared/          everything below app/: knows nothing of tabs or pages
  lattice.js, star.js, camera.js, color.js (the progress fade), dom.js, store.js, files.js,
                 kiteDesign.js (kite patterns: the grid, the format, placing a design on a kite)
  engine/        the mechanics: model.js (state, children's slots), derive.js (status and roll-ups
                 from children, inherited attributes, the schedule, kites, layout, relevance), actions.js
                 (every change, adding children, deploying and withdrawing, board rules, Bring to the
                 Zenith, retiring and restoring, deleting a branch),
                 blocks.js (hour blocks, SCHEDULE's lists: flat and by star-dot), formats.js (files),
                 round 9: questions.js (assessments, answering, waits, progress by category; round 15: by question),
                 round 15: qset.js (question sets: the Markdown format, its errors, grading), qimport.js (import
                 by target paths, export),
                 independent.js (the lists, their derived placement `project()`, independent stars),
                 goals.js (goals and completed categories); model.js has kite-less stars' spokes
  ui/            visible components: starDotScreen.js (any star-dot's screen, and the central
                 star's), map.js (the starfield map; its animated moves), kiteDesigner.js
                 (the kite design editor; + .css each), summaryText.js (attribute summaries),
                 question.js (countdowns); round 15: questionSet.js (a question set as the player answers it: the
                 assessor and PLAY's popout), richText.js (question text: the little Markdown of question files)
app/             the program: index.html, css/app.css, js/
  js/            main (boot, layout, keys), model (the working file, lineage lookups), actions
                 (every change, moves, board rules, conflicts, saving), history (undo/redo), storage,
                 tabs (the tab bar and the PLAY switch)
  js/panels/     play, rearrange (the card) and tree (MATERIALS's tree), schedule, conflict,
                 rules (GOVERN), lists (MATERIALS under Independent), pin (the PIN dialog),
                 palette (the palette menu), stateBar (the save bar), and
                 small helpers
saves/           the saves
content/         content sets
test/            test page and tests (test/shared/); test/ui/ previews; test/headless/ (run-node.sh:
                 the tests, a module check and click-throughs of the tabs, the tree, palettes, PLAY,
                 kite designs, SCHEDULE, the screens, quiz mode, Independent and an import, on a
                 fake DOM, on a throwaway copy); test/fixtures/ (their boards, built by
                 tools/build_fixtures.mjs); test/browser/ (headless Chrome)
tools/           check_questions.mjs (round 15: checks a question file from the command line, `node tools/check_questions.mjs <file.md>`);
                 kite-designer.html (the Kite Designer, standalone, on shared/ui/kiteDesigner.js);
                 import_quiz.js (a question bank into a save's lists); build_packs.mjs and
                 build_fixtures.mjs (the showcase packs and the test boards); single_file.py
archive/         earlier versions and plans (kept locally, not in the repository)
```

- Imports go one way: `app → shared`. Shared code never imports from `app/`.
- The engine is plain data and pure functions: a state is never changed in place; every action returns a new one. Nothing that can be worked out is stored (`derive()`).
- Shared visible components get data, an `edit` switch and a `change(fn)` callback from the host, and apply engine actions themselves.
- Under Star-dots: Independent every view reads the lists' derived placement (`E.viewState`, the panels' `state`), never the stored hierarchy; changes go to the save's own state.
- Panels address star-dots, kites and stars by engine ID. MATERIALS's moves (from the tree) use one set of drop rules (`canMove` / `moveTo`, with conflict cards); PLAY's add the save's board rule on top (`playCanMove` / `playMoveTo`, built on the engine's `boardMove`, which also takes `{ kind: 'zenith' }`).
- No category or task names in code: they come from the content set and the saves.

---

## History

What changed when is in `CHANGELOG.md`.
