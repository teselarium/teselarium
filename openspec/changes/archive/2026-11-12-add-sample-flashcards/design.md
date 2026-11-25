# Design

## Context

See proposal.md for the motivation, and specs/sample-flashcards/spec.md for the behavior.

Constraints that shape the approach:

- `tiles.renderBody` takes only `{ source }` and renders a tile's **whole** body. The mod API has no method that renders an arbitrary markdown string.
- `<ot-tile-body>` renders into the light DOM and fires a bubbling `ot-rendered` event synchronously, right after it sets its HTML and before it starts watching its mermaid blocks. A mermaid block is drawn only when it comes into the frame's view.
- The book list (`public/samples/mods/book_list/main.js`) is the shipped example of a sample mod. It is one self-contained plain JavaScript module that builds the DOM by hand, keeps its state in one `view` object, uses a native `<dialog>` card with a close button, backdrop detection and focus return, and gets the app's look from the classless base stylesheet. The base stylesheet already styles tables, `button[aria-pressed="true"]` and dialogs.
- The samples in `public/` are served as they are, without a build. A mod's tests run through `mods.check`, and `test.js` cases can mount the mod with their own tiles and config.

## Goals / Non-Goals

**Goals:**

- One source of truth for a tile's first heading and its section, shared by the Explore name, the card count and the study card, so the three never disagree.
- Rich answers (math, code, alerts, diagrams) shown by the engine's renderer, never by markdown parsing in the mod.
- Code a mod author can read top to bottom as a second example, after the book list.
- A study card that reads as a flashcard: the question and answer sides told apart by label, icon and color, and a progress that says how far the round is.
- A score within a session: how many cards you knew, and a round over the missed ones.

**Non-Goals:**

- Rendering frontmatter values as markdown (that needs a new engine method).
- Spaced repetition, or remembering scores and progress across starts.
- One card per heading: a tile makes at most one card.
- Supporting headings nested inside blockquotes, lists or alerts as "First heading".

## Decisions

### One plain JavaScript file, like the book list

`main.js` is one self-contained ES module in plain JavaScript, organized in commented sections: fields and values, outline, Explore, tile card, setup, session, mount. It follows the project's code conventions: named functions, explicit loops, no nested functions, and results stored in a variable before they are returned.

*Alternative:* TypeScript under `default_mods/` with the build. Rejected because the samples live in `public/` and are served as written, and the book list sets that pattern for samples.

### The outline comes from the rendered HTML

At mount, and after each `tiles.changed`, the mod sends `tiles.renderBody` for every tile in parallel. It parses each answer into the content of an inert `<template>`, which runs no script and loads no image. From that it reads the tile's **outline**: the text of its first heading, and whether that heading's section has content. The outlines are kept in a map from source to outline. A request counter, as in `<ot-tile-body>`, drops the answers of an older round when the tiles change again.

A failed render gives the tile an empty outline: no heading, so it is no "First heading" card, and its name falls back to "No title". The mod logs a warning that names the tile's source.

The table and the setup dialog are drawn once the outlines of the current round are in. Until then `<main>` shows a status "Loading tiles…" with `aria-busy="true"`.

*Alternative:* scan `tile.body` for `#` lines. Rejected: setext headings, `#` inside code fences and HTML headings would make the scan disagree with what the card shows.

### The heading and its section: one function, two uses

The function `findHeadingSection(container)` takes a container's **top-level children**. It returns the first top-level `h1`–`h6`, the children before it, and the children after it up to the next top-level heading of the same or a higher level. The rest are the children after the section. It reads the DOM and changes nothing.

- The outline calls it on the template's content.
- A study card with "First heading" has two `<ot-tile-body>` elements of the same tile, each with an `ot-rendered` listener that calls it on the element's children and sets `hidden` on what the side does not show. The question side's body shows only the heading. "Show answer" adds the answer side, whose body shows only the section. So each side is a panel of its own, labeled and colored like the sides of any other card. The engine keeps a body once it is rendered, so the second element costs no second render.

Only top-level headings count, in both uses. A heading inside a blockquote, a list or an alert is part of the content around it, not an outline heading.

Since the listener runs before the element starts watching its mermaid blocks, a diagram outside what a side shows is never in view, so the question side never draws the section's diagrams, and the answer side, built at the flip, draws them then. The same holds for lazy images.

*Alternatives:* move the section's nodes into a second container. Rejected: the element's diagram watcher keeps references to its own blocks, and moved or detached blocks would break its drawing. Reveal the section inside the question's body. Rejected: the answer would then have no panel of its own to label and tint, and a label put among the element's children would be replaced on each render.

### Fields as small descriptors, encoded as strings

A field is one of these:

| Field | Select value |
| --- | --- |
| a metadata key | `key:<name>` |
| First heading (question) | `first-heading` |
| Body (answer) | `body` |
| Section under the heading (answer) | `section` |

The prefix keeps a metadata key named `body` apart from "Body". The same strings are the option values of the two selects and what `study_fields` stores: `{ question: "key:question", answer: "key:answer" }`. When the stored strings are read back, any string that no select offers is ignored, and the default is used for it.

`readFieldValue(tile, outline, field)` returns either the side's text or a marker for a rendered side (`body`, `section`), or `null` when the tile has no value. "Which tiles are cards" is then one loop over the tiles with that function, used by both the count and the session.

The defaults resolve in order. Question is `question` when some tile has that key, else First heading. Answer is `answer` only when Question is a key and some tile has `answer`, else Body. When Question is First heading, the answer is always the section. So a collection with an `answer` key and no `question` key starts on First heading with its section, because the lock wins.

### Session state

`view.session` is `null` when there is no session. Otherwise it holds `{ fields, order, index, side, round, results, done }`:

- `order` is the list of the round's card sources, shuffled with Fisher–Yates over `Math.random` when the round starts.
- `side` is `"question"` or `"answer"`.
- `round` starts at 1. `results` is a `Map` from a card's source to `"known"` or `"missed"`, filled as the cards of the round are graded.
- `done` means the round is done: Study shows its end in the card.

"Study these M again" starts the next round in the same session: `order` becomes the shuffled sources whose result is `"missed"`, taken in the order they were shown, `round` goes up by one, `results` is emptied and `index` goes back to 0. Restart or Start again followed by Start, and `tiles.changed`, replace or discard the whole session, so they discard its results too. Nothing of the session is stored.

`shuffleSources(sources, random)` returns a new array and leaves its input as it was. Rendering Study is a function of `view.mode`, `view.session` and `view.notice`. Switching modes redraws `<main>` from that state, which is how a session pauses in Explore.

When the tiles change, the mod discards the session and sets `view.notice`. In Study, it opens the setup dialog once the new outlines are in. The tile card, if it was opened from a study card, is closed first.

### The study card's look from theme tokens

The book list's own CSS is layout only. This sample also shows how a mod sets its own look from the theme's tokens: the card's background, shadow and radius (`--ot-card`, `--ot-shadow`, twice `--ot-radius`), the question side's top border (`--ot-primary`), the answer side's tint and divider (`--ot-muted`, `--ot-border`), and the session bar's text (`--ot-muted-foreground`). It uses no literal colors, so the card follows light and dark. The module comment of `main.js` says so.

The card's buttons sit on the question side, below the question and above the answer side's divider, in one row that "Show answer", then "I knew it", "Not yet" and "Open full tile", take in turn. The question is a heading or a metadata value, never a whole body, so it is short, and the row stays nearly in one place from card to card: the user grades without scrolling past a long answer. The answer side is added after the question side, so showing it moves nothing above it. Focus goes to "I knew it", and the answer comes right after it in reading order. The end of a round has no answer side and keeps its buttons at the bottom.

The row is centered, so after a click on "Show answer" the pointer rests on "Not yet". For 500ms after the flip, the grading buttons ignore pointer clicks (`event.detail` above 0), so a double-click or a late second click does not grade the card. `showAnswer` records `performance.now()`, and the grading handlers compare it with the click's `timeStamp`. Clicks from the keyboard have `detail` 0 and work at once, so Enter or Space still steps through the deck. *Alternative:* put "I knew it" under the pointer. Rejected: a double-click would then mark a card known that the user did not check.

*Alternative:* a sticky row pinned to the bottom of the frame while a long answer scrolls. Rejected: its place follows the card's height, and it covers the answer's last lines.

The study card is an `<article>` at most 32rem wide and centered, at least 16rem tall, growing with its content. The session bar above it holds the position, a native `<progress>` (value: the cards graded in the round, maximum: the round's cards), "Round r" from the second round on, and "Restart". The answer side stays below the question, which keeps showing, and fades in over 150ms unless the user prefers reduced motion.

The end of a round keeps one term, "Not yet", the name of the grade the user pressed: the cards to study again sit under a "Not yet · M cards" label with the same `rotate-ccw` icon as that button, on the answer side's tint, in a list named by the label, and the button under it says "Study these M again". A score line alone followed by a list read as if the list held the known cards. A round with no "Not yet" says "Every card known" with the `circle-check` icon of "I knew it".

Color is never the only cue. Each side has a visible label, "Question" or "Answer", after an icon (Lucide's `circle-question-mark` and `lightbulb`), and the grading buttons show Lucide's `circle-check` and `rotate-ccw`. Every icon is `aria-hidden`, so the buttons are named "I knew it" and "Not yet".

The icons are Lucide's, the icon set of the app's own interface, drawn as inline SVGs in `currentColor`, so they take the label's or the button's color in light and dark. `lucide-react` cannot be used here: the sample is plain JavaScript served as written, with no React and no bundler, and loading code from another site would need a `code` permission. So `main.js` keeps the path data of the five icons it draws (`x` for the close buttons, which the book list already draws the same way, and the four above) in one table, read by one `buildIcon(name)`. The path data comes from `lucide-react` 1.61.0, and a comment credits Lucide under its ISC license.

*Alternatives:* a 3D flip that hides the question, rejected because the spec keeps the question shown so the two can be compared. A fixed card ratio, rejected because answers hold tables, code and diagrams. Emojis for the labels and the grades, rejected because they look different on each system and cannot take the theme's colors. A clickable card and a keyboard hint, left out of this change.

### Dialogs: one tile card, one setup dialog, never stacked

Two `<dialog>` elements sit outside `<main>`. The setup dialog opens only from buttons in `<main>` (Study, New session, Restart, Start again) or after a reload. The tile card opens from a row's button or from "Open full tile". Both openers are in `<main>`, which a modal makes inert, so two modals never stack.

The tile card remembers the element that opened it, and gives it focus when it closes. Closing with Escape, the close button or the backdrop follows the book list's handlers. The book list's focus-ring rule (a ring only after a keyboard close) is not part of this spec. The mod calls `focus()` and leaves the ring to the browser.

The card's `aria-expanded` is set only on the rows' buttons. "Open full tile" has `aria-haspopup="dialog"` too.

### A click on the row presses the button

Each row has a click listener that calls the row button's `click()` when the target is not the button itself. The button stays the one focusable element of the row.

*Alternative:* stretch the button with `::after` over a `position: relative` row. Rejected because positioning on table rows behaves differently from one browser to another.

### "No title" styling

The name is a `<span data-untitled>`, which the mod's CSS sets to `font-style: italic; color: var(--ot-muted-foreground)`. The token keeps it right in both color schemes, and the italic means it doesn't rely on color alone.

### Tile type and API range

`flashcard_type.md` declares `title: { type: string }`, and `question: {}` and `answer: {}`, which is JTD's empty form and accepts any value. All three are in `optionalProperties`, with `additionalProperties: true`. Its body documents the defaults and the First heading rule.

The mod file declares `api: "^0.1.9"`, the current mod API version, since the hide-until-flip behavior depends on the diagram drawing of recent versions.

### Tests: what goes where

- `test.js` (run by `mods.check`) covers the logic through the DOM: field choices and defaults, the card count, which tiles are cards, the session flow (each card once, "Card i of N"), the grading, the end of a round, the missed cards round, results discarded on restart, restart and end, and remembered fields through the case storage. `tiles.renderBody` answers only for the check collection's tiles, so cases keep a sample tile's source and body with other metadata, and tiles with a source of their own have no body. Some browsers do not move the focus in a check's hidden frames, and a case cannot push `tiles.changed`, so focus and "Reload tiles" are tested in e2e only.
- `e2e/sample_flashcards.spec.ts` covers what needs the real app and browser: computed styles ("No title", `aria-pressed`, the flashcard, both sides and the session bar in light and in dark, reduced motion), focus after closing and the Enter flow through "Show answer" and "I knew it", Escape and backdrop, the diagram drawn only after the flip, math in the heading, "Reload tiles" during a session, the fields kept across opening the mod again, and the explorer listing.
- `src/lib/mod/sample_mod.test.ts` covers the shipped files: the sample collection matches the `flashcard` type with no issues, the declared API range and test file, and the Nobel laureates collection matching the type.

## Risks / Trade-offs

- [A collection with many tiles sends one render per tile before the table shows] → Accepted for a sample. The renders run in parallel, the engine keeps successful renders so the cards reuse them, and the "Loading tiles…" status says what is happening.
- [The hide-until-flip behavior relies on `ot-rendered` firing before the diagram watcher starts] → That order is part of `tile-bodies` ("`ot-rendered` SHALL keep firing when the body's HTML is shown, before any diagram is drawn"). An e2e scenario checks that no diagram is drawn before the flip.
- [Only top-level headings count] → Stated in the tile type's documentation. Headings in GFM output are top-level unless nested on purpose.
- [The random order makes tests nondeterministic] → Tests assert that each card is shown once and that the count runs from 1 to N, never a particular order.
- [The explorer's tests and e2e specs may assume one listed mod] → The tasks update them along with the vanilla config.

## Migration Plan

None. The change adds files and one config entry. To roll it back, remove the folder and the entry.
