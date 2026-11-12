# Tasks

## 1. Mod files, tile type and sample deck

- [x] 1.1 Create `public/samples/mods/flashcards/mod_conf.yaml` (name `flashcards`, title "Flashcards", version `1.0.0`, `api: "^0.1.9"`, description, `entrypoint`, `type_path`, `sample_collection`, `test_path`, no permissions), and verify that `mods.inspect` for `./samples/mods/flashcards` answers with no granted and no denied permissions (spec "Mod file").
- [x] 1.2 Write `flashcard_type.md`: `ref: flashcard`, with `title: { type: string }`, `question: {}` and `answer: {}` as optional properties and `additionalProperties: true`, and a body documenting the default fields, the First heading choice, the top-level heading rule and which values make a card. Verify that `src/lib/mod/sample_mod.test.ts` has cases showing that `answer: 1953` matches and `title: 1984` gives a warning naming `title`.
- [x] 1.3 Write the 8 tiles in `cards/` (`emphasis.md`, `links.md`, `task_lists.md`, `tables.md`, `code_blocks.md`, `math.md`, `diagrams.md`, `alerts.md`), each with `title`, `question`, `answer` and a `##` heading with its section:
  - `tables.md` has a `### Alignment` subsection and a following `## See also`.
  - `diagrams.md` has text before its heading and a mermaid flowchart.
  - `math.md` has math in its heading.
  - `emphasis.md` has `~~text~~` in its `answer`.

  Verify by reading them against spec "Sample deck".
- [x] 1.4 Write `flashcard_collection.yaml` listing the 8 tiles in the spec's order. Extend `src/lib/mod/sample_mod.test.ts` to the flashcards mod: the sample collection matches `flashcard` with no issues, the API range is `^0.1.9`, it declares its test file, and the Nobel laureates collection matches with no issues. Verify with `npm test`.

## 2. Fields, values and outline

- [x] 2.1 In `main.js`, write the field descriptors and their string encoding (`key:<name>`, `first-heading`, `body`, `section`), `readFieldValue` with the value rules (non-blank string, number, boolean, non-empty list of those, lists joined with `, `), and the list of cards for given fields. Add `test.js` cases for "Which tiles are cards" (missing key, blank string, mapping) and "Field values as text", and verify them with the mod viewer's "Check mod".
- [x] 2.2 Write `findHeadingSection(container)` over top-level children, and the outline round: `tiles.renderBody` for every tile, parsing into a `<template>`, a request counter, and an empty outline plus a warning on a failed render. Add `test.js` cases for a heading section that stops at a heading of the same level, keeps a deeper subsection, and ignores a heading inside a blockquote. Verify with "Check mod".

## 3. Explore and the tile card

- [x] 3.1 Draw the heading, the "Explore"/"Study" buttons with `aria-pressed`, the "Loading tiles…" status, the empty status "There are no tiles to show.", and the Title/File table: the name rule, "No title" as `<span data-untitled>` with italic and muted CSS, the decoded file name, the row click listener, and the accessible name holding name and file. Add `test.js` cases for the sample rows, the name from the heading, no title, a non-string title, an encoded file name and no tiles. Verify with "Check mod".
- [x] 3.2 Build the shared tile card: a modal `<dialog>` labeled by its heading (the file name when the tile is unnamed), its metadata as labeled values (text, lists joined, other values as JSON), the full `<ot-tile-body>`, the Close button, Escape and the backdrop, focus back to the opener, `aria-expanded` on the rows, and following "Reload tiles" in Explore. Add `test.js` cases for the metadata of Tables and for a list and a mapping. Verify with "Check mod".

## 4. Study setup

- [x] 4.1 Build the setup dialog: the Question and Answer selects with the choices in first-appearance order, Answer locked to "Section under the heading" under First heading, the defaults, "N of M tiles have these fields." updating on change, Start disabled at 0, and "No study session." with "New session" after closing without a session. Add `test.js` cases for each "Default fields", "Field choices" and "Card count" scenario. Verify with "Check mod".
- [x] 4.2 Store the chosen fields under `study_fields` at Start, and read them back when the dialog opens with no session, ignoring values no select offers. Add `test.js` cases using the case storage for a kept choice and for a stored key that is no longer offered. Verify with "Check mod".

## 5. Study session

- [x] 5.1 Write `shuffleSources` (Fisher–Yates, returns a new array) and the session state. Draw "Card i of N", the question, "Show answer", then the answer with "Next" and "Open full tile", plus "Restart". Hide everything but the heading in the `ot-rendered` listener for a First heading card, and reveal the section on the flip. Add `test.js` cases for the first card, showing the answer, and a full pass that sees each sample card exactly once. Verify with "Check mod".
- [x] 5.2 Add the focus flow (Show answer to Next, Next to the next Show answer), "Open full tile" opening the shared card with focus return, Restart (keep the session on cancel, replace it on Start), the end message "You studied all N cards." with "Start again", and the pause when switching to Explore. Add `test.js` cases for restart, cancel, end and pause. Verify with "Check mod".
- [x] 5.3 Handle `tiles.changed` during a session: end it, close a tile card that was opened from Study, set the notice "The tiles changed, so the session ended.", and in Study open the setup dialog with the new choices and count once the outlines are in. Add `test.js` cases where the case mounts new tiles. Verify with "Check mod".

## 6. App integration, e2e and docs

- [x] 6.1 Add `./samples/mods/flashcards` after the book list in `default_mods/mod_explorer/mod_conf.yaml`, and update the explorer's tests in `default_mods/mod_explorer/test/` and `e2e/default_mods.spec.ts` for the second entry (spec delta of `default-mods`, "Vanilla explorer lists the flashcards sample"). Verify with `npm test` and `npx playwright test e2e/default_mods.spec.ts`.
- [x] 6.2 Add the flashcards paths and run hashes to `e2e/sample_mod.ts`, and write `e2e/sample_flashcards.spec.ts` for the browser-level scenarios:
  - mode buttons and `aria-pressed`
  - the computed style of "No title"
  - the row click
  - Escape and backdrop focus return
  - the Enter flow
  - math in the heading
  - no diagram drawn before the flip and one drawn after
  - "Open full tile" focus return
  - "Reload tiles" during a session and with a full tile open
  - fields kept across opening the mod again

  Verify with `npx playwright test e2e/sample_flashcards.spec.ts`.
- [x] 6.3 Mention the flashcards sample in `docs/modules/lib/mod/README.md` (the shipped samples) and `docs/modules/mods/explorer/README.md` (the vanilla `mods` list). Write the module comment of `main.js` so it describes what the mod shows as an example (outline from `tiles.renderBody`, hiding the content around the heading after `ot-rendered`, dialogs, storage). Verify that the documented config matches `mod_conf.yaml`.
- [x] 6.4 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify that all pass.
- [x] 6.5 Add `.changeset/add-sample-flashcards.md` with a `patch` bump for `opentesela`: a new sample and no breaking change for users or instantiations, and no mod API bump. Write a one-line summary such as "A sample flashcards mod lets you explore any collection and study it as question and answer cards." Verify that the file follows the format of the existing changesets.
