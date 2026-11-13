# Star Lattice question files

**Round 17: you don't need this format to write questions.** The Assessor's **Edit questions** is a form (a card per question), and **Paste questions…** there, and **MATERIALS › Import questions…**, also read questions typed up as plain text:

```text
1. Which organelle makes ATP?
A) Ribosome
B) Mitochondrion
Answer: B
Explanation: Cellular respiration happens there.   (optional; Hint: too)

2. The function that loads a data set is ____.
Answer: data; data()                               (one blank: each is accepted; several: one each, in order)

3. What is the hazard ratio for race?
Answer: 0.716                                      (a number: checked to its written decimals)

4. Write the line that fits the Cox model.
Answer: coxph(Surv(time, status) ~ age)            (anything else: a typed answer)
```

Number the questions (`1.`, `1)`, `Q1.`, `Question 1:`) or leave a blank line between them. Choices are `A)`, `A.` or `(A)` lines; `Answer: B and D` marks several right. Imported without targets, the questions go into one star-dot you pick, or one new star-dot per question under one you pick. This page's Markdown is the exact format, for chains, contexts, steps and files that say where each set goes.

A question file is plain Markdown that holds any number of **question sets**. Each set goes to one □ (needs assessment) star-dot, and answering every graded question in it right completes that star-dot. The same format is used in three places:

- **MATERIALS › Import questions…** reads a file (or pasted text), previews it and imports it.
- **Edit questions**, in a star-dot's Assessor (on the editing tabs), shows one set as this Markdown.
- **MATERIALS › Export questions…** writes every set in the save as one file, ready to import again.

`test/fixtures/problem-set.md` is a full example: five sets, 34 questions, of every kind.

## A set

```markdown
# Set: Part 1 · the data and a first model
target: Statistics > Problem set > 1.
context:
Text shown above every question of the set: a scenario, a data table, setup code.
```

- `# Set:` starts a set and gives its title. Anything before the first `# Set:` (the file's own title and introduction) is ignored.
- `target:` names the set's star-dot: star-dot names from the top, joined by `>`. Names match ignoring case and extra spaces. A path may start at any star-dot whose name is unique.
  - If the **last** name is missing, import creates it as a new □ child of the one before it.
  - Under **Star-dots: Independent**, a target is `Category > Item`. A missing item is added at the end of that category's list.
  - A set with no target gets its star-dot picked in the import preview.
- A set's questions are asked in the order written. (A set-level `order:` or `shuffle:` line from rounds 15–17 still reads, and is ignored. GOVERN › Questions › Shuffle the questions orders star-dots on the field instead.)
- `context:` is optional. It runs until the next `##` heading.

## Questions

```markdown
## Q events [number]
How many reinfections (events) are in the data?
answer: 347
hint: The `number of events` line, near the top.
explain: Shown after it's answered.
```

- `## Q <id> [<kind>]` starts a question. The id is optional but recommended: progress is kept by id, so an id that stays put keeps your progress when the set is edited. Ids must be unique within a set.
- The question's text comes next, up to its first key line. It can hold paragraphs, code blocks, lists, `| tables |`, `` `code` ``, `**bold**` and `*italic*`.
- **Keys** start a line: `answer:`, `accept:`, `decimals:`, `tolerance:`, `units:`, `case:`, `shuffle:`, `hint:`, `explain:`, `image:`. A key's value can run onto the following lines, up to the next key, option or heading. Inside a code block nothing is read as a key.
- `hint:` can be given several times. Hints are revealed one at a time, on request.
- `explain:` is shown after an answer, right or wrong. The right answer itself is never shown after a wrong one.
- A line of `---` is ignored: use it to separate sets and questions for reading.

### The kinds

**choice:** 2–8 options. `- [x]` marks a right one and `- [ ]` a wrong one. With several `[x]` options, the player chooses all that apply and presses Check. An indented `> …` line under an option is shown when it's picked wrongly. `shuffle: yes` or `no` says whether its options are shuffled; without it, GOVERN › Questions › Shuffle choices decides. A new order is drawn each attempt (when it comes back for retraining, and each session). Options such as “All of the above” keep their place, and a question whose options name others by letter (“Both A and C”) isn't shuffled.

```markdown
## Q refs [choice]
What are the reference levels of `race` and `iinfct`?
- [x] Black for `race`, and gonorrhea for `iinfct`
- [ ] White for `race`, and both infections for `iinfct`
  > Levels sort as stored: B before W, code 1 first.
```

**blank:** the text has one or more `____` (four or more underscores), in prose or inside a code block. Each blank is a field to type in.
- With one blank: `answer:`, plus `accept:` lines for other right answers.
- With several: `answer 1:`, `answer 2:` (and `accept 1:`…).

````markdown
## Q cs-fun [blank]
Complete the plot of the cumulative hazard.
```r
plot(cs.fit, fun=____, conf.int=F)
```
answer: "cumhaz"
````

**number:** `answer:` is the value. It accepts anything within half a unit of the answer's last written decimal, so `answer: 0.716` takes 0.7155 to 0.7165, and `0.880` means three decimals.
- `decimals: 3` sets the decimals; `tolerance: 0.01` sets the allowance outright.
- `units: days` lets the player type the units after the number.
- Commas and spaces in what they type don't matter.

**recall:** the player types a line or a block of code from memory. `answer:` is the code, on its line or as a code block on the lines after it. `accept:` lines give other right answers. A wrong answer says where it first differs, and the player can press **Count it as right** when theirs means the same.

**step:** instructions, not graded. It can hold code to copy (a **Copy** button) and an image, and it's confirmed with **Done**. Use steps for setup and for the workspace: "Open RStudio and save a script", "Run this setup code", "Look at the plot in the Plots pane".

### Checking typed answers

Blanks and recall compare **token by token**. These don't matter:
- spacing and line breaks;
- `'single'` or `"double"` quotes;
- a trailing `;`;
- comments (`#` to the end of the line, or `-- `).

Everything else counts: names, numbers (by value: `0.50` is `0.5`) and operators. `case: ignore` ignores capitals (for SQL keywords, say).

An accepted answer written `/like this/` is a regular expression, tested against the typed text (with flags: `/select\s+\*/i`).

## Chains

```markdown
## Chain: Data and model
context:
Shown above each question of the chain.

### Q load [blank]
…
### Q factor [blank]
…
```

Questions are independent by default: they can be answered in any order (pick one from the list, or press Next ›). A **chain** groups adjacent questions that build on each other. Its questions are `###` headings, answered in order: each opens once the ones before it are right. A `##` heading ends the chain.

## Wrong answers

GOVERN › Questions › After a wrong answer applies to each question:
- **Retry now:** try again at once.
- **Wait N minutes:** only that question waits (in a chain, so does the rest of the chain); the star-dot's other questions stay open.

Answers already given right are kept. The star-dot is **in training** (its □ half-filled) until the last one is answered, and then it ignites.

## Images

An image belongs to a question. Add it in Edit questions (its Images list): it's shrunk to 800 px on its long side and kept in the save. In the Markdown it shows as `image: attached`. A file can also carry one inline as `image: data:image/png;base64,…`.

## Writing long lists

1. **One file per source** (a homework, a question bank, a practice exam). Give each `# Set:` the `target:` of the star-dot it belongs to. Plan the targets first: one set per star-dot, and the star-dots under a parent named for the topic, so the tree reads like the source.
2. **Split by what you'll practice together.**
   - A homework: a set per part, its steps as chains.
   - A bank of a few hundred questions: a set per subtopic (8–20 questions), each under its category's star-dot, rather than 48 in one.
   - A practice exam: a set per project. Put its setup code in a **step** or the chain's `context:`, and its result questions as **number** or **blank**.
3. **Convert existing banks mechanically.**
   - Multiple choice `A) …` lines become `- [ ]` and `- [x]` (the answer key tells which).
   - Fill-in-the-blank items keep their `____` and get an `answer:`.
   - "Run this and report the value" becomes a **step** (the code) and a **number**.
   - Code to memorize becomes **recall**.

   Any editor, a script or an LLM can do this from the spec above: it's plain text, with no ids or files to keep in sync.
4. **Check before importing.**
   - From the command line: `node tools/check_questions.mjs <file.md>` lists every error with its line number, and counts the sets, questions and kinds.
   - In the app: Import questions… shows the same errors and won't import a file until they're fixed. Its preview says where each set goes before anything changes.
5. **Import**: one undoable step. Importing the same file again offers **Replace** (a star-dot's questions become the file's) or **Append** (the file's are added after them).
