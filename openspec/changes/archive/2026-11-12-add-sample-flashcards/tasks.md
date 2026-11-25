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

## 7. Study card look and scoring

- [x] 7.1 Move "Card i of N" and "Restart" out of the card into a session bar above it, with the `<progress>` (value: cards graded in the round, maximum: the round's cards) and "Round r" from the second round on. Style the study card from theme tokens (spec "Flashcard shape", "Question and answer sides", "Side text", "Answer reveal", "Session bar", "Card buttons"): the labeled sides with `aria-hidden` Lucide icons drawn by one `buildIcon(name)` from a table of path data, shared with the close buttons, and a comment crediting Lucide (ISC), text sides centered at 1.25rem, rendered bodies left-aligned, the 150ms fade with no animation under reduced motion, and the button variants. Update the module comment of `main.js` (its own look from theme tokens). Update the `test.js` selectors that read the position and the sides, and verify with "Check mod".
- [x] 7.2 Replace "Next" with "I knew it" (Lucide `circle-check`) and "Not yet" (Lucide `rotate-ccw`), record the grade in `results`, move focus from "Show answer" to "I knew it" and, after a grade, to the next card's "Show answer". Update the `test.js` helpers and cases that press "Next" (going through the deck, stepping to the third card, "shows the answer", "shows each card once") and the e2e "Step with Enter". Verify with "Check mod".
- [x] 7.3 Show the end of a round in the card: "You knew K of N cards." with "card" when N is 1, the missed cards' names, "Study the M missed cards" with "card" when M is 1 and only when M is at least 1, "Start again", and focus on the first of the two. Start the missed cards round (spec "Missed cards round") and discard the results on Restart or Start again followed by Start and on `tiles.changed` (spec "Results last for the session"). Add `test.js` cases for "Last card", "Two missed cards", "All known", "Missed cards again", "Results paused in Explore" and "Restart discards the results". Verify with "Check mod".
- [x] 7.4 Add e2e scenarios in `e2e/sample_flashcards.spec.ts` for "A flashcard", "The two sides" and "The position" in light and in dark, "Reduced motion", and the focus on "Study the M missed cards" or "Start again" at the end of a round. Verify with `npx playwright test e2e/sample_flashcards.spec.ts`.
- [x] 7.5 Update the changeset summary to "A sample flashcards mod lets you explore any collection and study it as question and answer cards, and see how many you knew." and the flashcards description in `docs/modules/lib/mod/README.md` (its own look from theme tokens, scores within a session). Verify that the docs match `mod_conf.yaml` and the spec.
- [x] 7.6 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify that all pass.

## 8. Clearer end of a round

- [x] 8.1 In the end of a round, put the missed cards under a "Not yet · M cards" label ("card" when M is 1) with Lucide's `rotate-ccw` icon, styled like a side's label on the `--ot-muted` tint, in a list named by that label (`aria-labelledby`). Rename the button to "Study these M again" ("Study this card again" when M is 1). When every card was known, show "Every card known" with Lucide's `circle-check` icon instead of the list (spec "Not yet list", "Every card known", "Missed cards round").
- [x] 8.2 Update the `test.js` cases and helpers for the list, its label, the button names and "Every card known", adding "One missed card", and the e2e "Focus at the end of a round". Verify with "Check mod" in Chromium, Firefox and WebKit, and with `npx playwright test e2e/sample_flashcards.spec.ts`.
- [x] 8.3 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify that all pass.

## 9. Buttons between the question and the answer

- [x] 9.1 Move the study card's button row into the question side, below the question and above the answer side, so the grades take the row of "Show answer", at the same height, and a long answer does not move them. Keep the end of a round's buttons at the bottom of the card (spec "Button place").
- [x] 9.2 Update `test.js` to check the order (question, buttons, answer) and the selectors of the button row, and add e2e scenarios "Same place after the flip" and "A long answer" in `e2e/sample_flashcards.spec.ts`. Verify with "Check mod" in Chromium, Firefox and WebKit, and with `npx playwright test e2e/sample_flashcards.spec.ts`.
- [x] 9.3 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify that all pass.

## 10. Double-click guard

- [x] 10.1 Ignore pointer clicks on "I knew it" and "Not yet" for 500ms after "Show answer", and keep keyboard presses working at once (spec "Double-click guard").
- [x] 10.2 Add a `test.js` case that sends a pointer click right after "Show answer" and another after the pause, and e2e scenarios "Double-click on Show answer" and "Click after the pause". Verify with "Check mod" in Chromium, Firefox and WebKit, and with `npx playwright test e2e/sample_flashcards.spec.ts`.
- [x] 10.3 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify that all pass.
