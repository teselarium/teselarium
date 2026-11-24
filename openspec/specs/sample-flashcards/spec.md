# sample-flashcards Specification

## Purpose

Describes what the shipped sample flashcards mod (`public/samples/mods/flashcards/`) shows and how the user works with it. Explore lists the tiles and opens each one. Study turns the tiles into a deck of question and answer cards, goes through it once in random order, and says how many cards you knew.

## Requirements

### Requirement: Mod file
The mod file SHALL give the mod the title "Flashcards", and SHALL declare `api: "^0.2.0"`, its tile type `./flashcard_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, whose mosaic names the mod's own folder and the sample deck `./flashcard_collection.yaml` as its collection. Neither the mod file nor its default mosaic SHALL declare permissions. The sample deck's collection file SHALL use `title`.

#### Scenario: Inspect the sample
- **WHEN** `mods.inspect` is sent for `./samples/mods/flashcards`
- **THEN** the answer has the title "Flashcards", a tile type and a default mosaic, and its permissions have no granted and no denied entry

### Requirement: Explore and Study modes
The mod SHALL show its title as a heading, then two buttons, "Explore" and "Study". The button of the current mode SHALL have `aria-pressed="true"` and the other `aria-pressed="false"`. The mod SHALL start in Explore. Pressing a button SHALL switch to its mode without reloading the mod's frame.

#### Scenario: Start in Explore
- **WHEN** the mod runs with the sample collection
- **THEN** "Explore" has `aria-pressed="true"`, "Study" has `aria-pressed="false"`, and the tile table is shown

#### Scenario: Switch to Study
- **WHEN** the user presses "Study"
- **THEN** "Study" has `aria-pressed="true"`, "Explore" has `aria-pressed="false"`, and the tile table is not shown

### Requirement: No tiles
When the mod receives no tiles, it SHALL show the heading and a status "There are no tiles to show.", with no mode buttons, no table and no dialog.

#### Scenario: Run without a collection
- **WHEN** the mod runs without a collection
- **THEN** it shows the status "There are no tiles to show." and no "Explore" or "Study" button

### Requirement: Tile table
In Explore, the mod SHALL show a table with the column headers "Title" and "File", and one row per tile, in the tiles' order. The first cell of each row SHALL hold a button showing the tile's name, with `aria-haspopup="dialog"` and an accessible name holding the tile's name and its file. A click anywhere on the row SHALL press that button.

#### Scenario: The sample tiles
- **WHEN** the mod runs with the sample collection
- **THEN** the table has 8 rows, the first named "Emphasis" with the file `emphasis.md` and the last named "Alerts" with the file `alerts.md`

#### Scenario: Name of a row's button
- **WHEN** the mod runs with the sample collection
- **THEN** the button of the Tables row has an accessible name that contains "Tables" and "tables.md"

#### Scenario: Click on the file cell
- **WHEN** the user clicks the file cell of the Tables row
- **THEN** the card of Tables is open

### Requirement: Tile name
A tile's name SHALL be its metadata `title` when that is a non-blank string, otherwise the text of the first heading of its rendered body, at any level. A tile with neither SHALL show "No title" in italic, in the theme's muted foreground color (`--tes-muted-foreground`).

#### Scenario: Name from the first heading
- **WHEN** the mod receives a tile with no `title` whose body starts with `## What is a monad?`
- **THEN** its row shows "What is a monad?"

#### Scenario: No title and no heading
- **WHEN** the mod receives a tile `notes_03.md` with no `title` and a body without headings
- **THEN** its row shows "No title", with a computed `font-style` of `italic` and the computed color of `--tes-muted-foreground`
- **AND** its button has an accessible name that contains "No title" and "notes_03.md"

#### Scenario: Title that is not a string
- **WHEN** the mod receives a tile with `title: 1984` whose body starts with `# Orwell`
- **THEN** its row shows "Orwell"

### Requirement: File column
The File column SHALL show the last path segment of the tile's `source`, percent-decoded.

#### Scenario: Encoded file name
- **WHEN** the mod receives a tile whose `source` is `https://example.org/cards/my%20notes.md`
- **THEN** its File cell shows `my notes.md`

### Requirement: Tile card
Pressing a row's button SHALL open a modal dialog, the tile card. Its heading SHALL be the tile's name, or the tile's file when the tile has no title and no heading, and the dialog SHALL be labeled by that heading. The card SHALL show the tile's metadata, then its full body as the engine renders it (see `tile-bodies`). The rest of the mod SHALL NOT be usable while it is open.

#### Scenario: Open the card of Tables
- **WHEN** the user presses the Tables row's button
- **THEN** a modal dialog named "Tables" is open, and it shows the body's "See also" section as well as its table

#### Scenario: Card of a tile without a name
- **WHEN** the user opens the card of the tile `notes_03.md`, which has no title and no heading
- **THEN** a modal dialog named "notes_03.md" is open

#### Scenario: State while the card is open
- **WHEN** the card of Tables is open
- **THEN** the Tables row's button has `aria-expanded="true"` and every other row's button has `aria-expanded="false"`

### Requirement: Card metadata
The card SHALL show each key of the tile's metadata as a labeled value, in the metadata's order. The label SHALL be the key. A string, number or boolean SHALL be written as text, and a list of them joined with `, `. Any other value SHALL be written as JSON.

#### Scenario: Metadata of Tables
- **WHEN** the user opens the card of Tables
- **THEN** it shows the labels `title`, `question` and `answer`, with the values "Tables", "Which character separates the cells of a table?" and "The pipe, |"

#### Scenario: A list and a mapping
- **WHEN** the user opens the card of a tile with `tags: ["md", "gfm"]` and `source_info: { page: 3 }`
- **THEN** it shows `tags` with "md, gfm" and `source_info` with `{"page":3}`

### Requirement: Closing the tile card
The tile card SHALL close when the user presses Escape, presses its close button (accessible name "Close"), or clicks the backdrop outside it. A click inside the card SHALL NOT close it. After it closes, focus SHALL be on the button that opened it.

#### Scenario: Escape
- **WHEN** the card of Tables is open and the user presses Escape
- **THEN** no dialog is open and the Tables row's button has focus

#### Scenario: Backdrop
- **WHEN** the card of Tables is open and the user clicks the backdrop outside it
- **THEN** no dialog is open

#### Scenario: Click inside
- **WHEN** the card of Tables is open and the user clicks its body text
- **THEN** the card stays open

### Requirement: Tile card follows the tiles
While the tile card is open in Explore, it SHALL stay open when the tiles change and its tile is still among them, and SHALL then show that tile's new metadata and body. It SHALL close when its tile is no longer among them.

#### Scenario: Reloaded with the tile
- **WHEN** the card of Tables is open and the user presses "Reload tiles" with a collection where Tables has a new `answer`
- **THEN** the card is still open and shows the new `answer`

#### Scenario: Reloaded without the tile
- **WHEN** the card of Tables is open and the user presses "Reload tiles" with a collection that no longer lists Tables
- **THEN** no dialog is open

### Requirement: Study setup dialog
Switching to Study with no study session SHALL open a modal dialog labeled "Study setup", holding a select labeled "Question", a select labeled "Answer", a count of cards, and a button "Start". Closing it without starting SHALL leave Study showing "No study session." and a button "New session" that opens it again.

#### Scenario: First visit to Study
- **WHEN** the mod runs with the sample collection and the user presses "Study"
- **THEN** a modal dialog named "Study setup" is open with the selects "Question" and "Answer" and the button "Start"

#### Scenario: Closed without starting
- **WHEN** the setup dialog is open with no session and the user presses Escape
- **THEN** no dialog is open, and Study shows "No study session." and a "New session" button

### Requirement: Field choices
The Question select SHALL offer "First heading", then each metadata key found in any tile, in the order the keys first appear across the tiles. The Answer select SHALL offer "Body", then the same keys. While Question is "First heading", the Answer select SHALL be disabled and show "Section under the heading".

#### Scenario: Choices of the sample deck
- **WHEN** the setup dialog is open with the sample collection
- **THEN** Question offers "First heading", `title`, `question` and `answer`, and Answer offers "Body", `title`, `question` and `answer`

#### Scenario: First heading locks the answer
- **WHEN** the user chooses "First heading" in Question
- **THEN** the Answer select is disabled and shows "Section under the heading"

### Requirement: Default fields
When the setup dialog opens with no remembered fields, Question SHALL be `question` when at least one tile has that key, and "First heading" otherwise. When Question is a key, Answer SHALL be `answer` when at least one tile has that key, and "Body" otherwise.

#### Scenario: Sample deck defaults
- **WHEN** the setup dialog opens for the first time with the sample collection
- **THEN** Question shows `question` and Answer shows `answer`

#### Scenario: Collection without question and answer keys
- **WHEN** the setup dialog opens for the first time with tiles that have only `title` and a body
- **THEN** Question shows "First heading" and Answer shows "Section under the heading"

#### Scenario: Question key without an answer key
- **WHEN** the setup dialog opens for the first time with tiles that have `question` and no `answer`
- **THEN** Question shows `question` and Answer shows "Body"

### Requirement: Remembered fields
Pressing "Start" SHALL store the chosen Question and Answer in the mod's storage under the key `study_fields`. When the setup dialog opens with no session, it SHALL show the stored fields, each one only when its select still offers it, and the default otherwise. The stored fields SHALL be those of the deck the mod was opened with: they come back when the mod is opened again from the same mosaic or with the same collection, and not with another one.

#### Scenario: Fields kept across starts
- **WHEN** the user starts a session with Question `title` and Answer "Body" while the mod is opened from its default mosaic, and the mod is opened again from its default mosaic and the user presses "Study"
- **THEN** Question shows `title` and Answer shows "Body"

#### Scenario: Stored key no longer offered
- **WHEN** the storage holds Question `term` and no tile has the key `term`
- **THEN** the setup dialog shows the default Question

#### Scenario: Study fields per deck
- **WHEN** the user chooses study fields while the mod is opened from its default mosaic, and then opens the mod with another collection
- **THEN** the setup does not start from the fields chosen for the sample deck

### Requirement: Which tiles are cards
A tile SHALL be a card when both its question and its answer have a value. A metadata key has a value when the value is a non-blank string, a number, a boolean, or a non-empty list of those. "Body" has a value when the body is not blank. "First heading" has a value when the rendered body has a heading with text and its section is not empty.

#### Scenario: Missing key
- **WHEN** the deck uses Question `question` and Answer `answer`, and one of 3 tiles has no `answer`
- **THEN** the session has 2 cards and never shows that tile

#### Scenario: Empty value
- **WHEN** the deck uses Question `question` and a tile has `question: "  "`
- **THEN** that tile is not a card

#### Scenario: A mapping is not a value
- **WHEN** the deck uses Answer `answer` and a tile has `answer: { text: "x" }`
- **THEN** that tile is not a card

### Requirement: Card count
The setup dialog SHALL show "N of M tiles have these fields.", where N is the number of cards for the chosen fields and M the number of tiles, and SHALL update it when a select changes. "Start" SHALL be disabled when N is 0.

#### Scenario: Count of the sample deck
- **WHEN** the setup dialog opens with the sample collection and the default fields
- **THEN** it shows "8 of 8 tiles have these fields." and "Start" is enabled

#### Scenario: No cards
- **WHEN** the user chooses a Question key that no tile has a value for
- **THEN** it shows "0 of 8 tiles have these fields." and "Start" is disabled

### Requirement: Section under the heading
With "First heading", the question SHALL be the first heading of the rendered body, as rendered. The answer SHALL be what follows it up to the next heading of the same or a higher level, or to the end of the body. What comes before the first heading SHALL NOT be shown on either side of the card.

#### Scenario: Section stops at the next heading of the same level
- **WHEN** the card of Tables is shown with "First heading" and the user presses "Show answer"
- **THEN** the answer shows the table and its "Alignment" subsection, and does not show "See also"

#### Scenario: Text before the heading
- **WHEN** the card of Diagrams is shown with "First heading", before and after "Show answer"
- **THEN** the text before its first heading is not shown

#### Scenario: Math in the heading
- **WHEN** the card of Math is shown with "First heading"
- **THEN** the question holds a `<math>` element

### Requirement: Field values as text
A metadata key on a card SHALL be shown as plain text, not rendered as markdown, with a list's items joined with `, `. "Body" SHALL show the full body as the engine renders it.

#### Scenario: Markdown in a field stays as written
- **WHEN** the card of Emphasis is shown with Answer `answer` and the user presses "Show answer"
- **THEN** the answer shows `~~text~~` as written, with no `<del>` element

### Requirement: Study session
Pressing "Start" SHALL close the setup dialog and start a session over the cards of the chosen fields. Each card SHALL show its question and a "Show answer" button. Pressing "Show answer" SHALL show the answer below the question, which stays shown, and replace "Show answer" with "I knew it", "Not yet" and "Open full tile". A "Restart" button SHALL be shown during the session, outside the card.

#### Scenario: First card
- **WHEN** the user starts a session with the sample collection and the default fields
- **THEN** Study shows "Card 1 of 8", a question of the sample deck and "Show answer", and no answer

#### Scenario: Show the answer
- **WHEN** a card shows its question and the user presses "Show answer"
- **THEN** the card shows the question and its answer, "I knew it", "Not yet" and "Open full tile", and no "Show answer"

#### Scenario: A diagram waits for the answer
- **WHEN** the card of Diagrams is shown with "First heading" and its answer is not shown yet
- **THEN** no diagram has been drawn, and after "Show answer" the answer shows the drawn diagram

### Requirement: Flashcard shape
In Study, the card SHALL look like a flashcard, with its look set from the theme's tokens only, so it holds in light and dark. It SHALL be at most 32rem wide and centered, at least 16rem tall, and SHALL grow with its content. Its background SHALL be `--tes-card`, its shadow `--tes-shadow`, and its corner radius twice `--tes-radius`. The end of a round SHALL be shown in the same card.

#### Scenario: A flashcard
- **WHEN** a session shows a card, in light and in dark
- **THEN** the card's computed background, shadow and corner radius are those of `--tes-card`, `--tes-shadow` and twice `--tes-radius`, and its width is at most 32rem

### Requirement: Question and answer sides
The question side SHALL have a visible label "Question", after Lucide's `circle-question-mark` icon, and a top border in `--tes-primary`. The answer side SHALL have a visible label "Answer", after Lucide's `lightbulb` icon, a `--tes-muted` background, and a top border in `--tes-border` that divides it from the question. The icons SHALL be drawn in the label's color and hidden from assistive technology.

#### Scenario: The two sides
- **WHEN** a card shows its answer, in light and in dark
- **THEN** the question side's computed top border color is `--tes-primary`, the answer side's computed background is `--tes-muted`, and the labels "Question" and "Answer" are shown

### Requirement: Side text
A side shown as text SHALL be centered, with a font size of 1.25rem. A side shown as a rendered body SHALL be left-aligned.

#### Scenario: Text and rendered sides
- **WHEN** a card with Question `question` and Answer "Body" shows its answer
- **THEN** the question side's text is centered with a computed font size of 20px, and the answer side's rendered body is left-aligned

### Requirement: Answer reveal
The answer side SHALL fade in over 150ms when it is shown, with no animation when the user prefers reduced motion.

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and presses "Show answer"
- **THEN** the answer side has no animation

### Requirement: Session bar
A session bar above the card SHALL hold "Card i of N", with a font size of 0.875rem in `--tes-muted-foreground`, and a `<progress>` whose value is the number of cards graded in the round and whose maximum is N. It SHALL also hold "Round r" from the second round on, and "Restart" as a plain button.

#### Scenario: The position
- **WHEN** a session of the sample deck shows "Card 3 of 8"
- **THEN** "Card 3 of 8" is shown above the card in `--tes-muted-foreground`, the progress has the value 2 and the maximum 8, and "Restart" is not inside the card

### Requirement: Button place
On a study card, the buttons SHALL be on the question side, below the question and above the answer side, so that the grades take the row of "Show answer", at the same height, when the answer is shown, and a long answer does not move them. The end of a round, which has no answer side, SHALL keep its buttons at the bottom of the card.

#### Scenario: Same place after the flip
- **WHEN** a card shows its question and the user presses "Show answer"
- **THEN** "I knew it" is at the height where "Show answer" was, and the buttons come before the answer side

#### Scenario: A long answer
- **WHEN** the card of Tables is shown with "First heading" in a frame shorter than the card with its answer, and the user presses "Show answer"
- **THEN** "I knew it" is in view without scrolling

### Requirement: Double-click guard
For 500ms after "Show answer" is pressed, a pointer click on "I knew it" or "Not yet" SHALL do nothing, so a double-click on "Show answer" does not grade the card under the pointer. Pressing either button with the keyboard SHALL work at once.

#### Scenario: Double-click on Show answer
- **WHEN** a session shows "Card 1 of 8" and the user double-clicks "Show answer"
- **THEN** the card shows its answer and Study still shows "Card 1 of 8"

#### Scenario: Click after the pause
- **WHEN** the answer has been shown for more than 500ms and the user clicks "Not yet"
- **THEN** Study shows "Card 2 of 8"

### Requirement: Card buttons
"Show answer" and "I knew it" SHALL be primary buttons, "Not yet" a plain button, and "Open full tile" a ghost button. "I knew it" SHALL show Lucide's `circle-check` icon and "Not yet" Lucide's `rotate-ccw` icon, each icon hidden from assistive technology.

#### Scenario: Names of the grading buttons
- **WHEN** a card shows its answer
- **THEN** its buttons are named "I knew it", "Not yet" and "Open full tile", and "I knew it" is a primary button

### Requirement: Random order, each card once
A session SHALL show the cards of each round in a random order, and SHALL show each card of a round exactly once.

#### Scenario: Each card once
- **WHEN** the user goes through a session of the sample deck, pressing "Show answer" and then "I knew it" or "Not yet" on each card
- **THEN** 8 cards are shown, one per sample tile, and "Card i of 8" counts from 1 to 8

### Requirement: Keyboard flow
Pressing "Show answer" SHALL move focus to "I knew it", and grading a card SHALL move focus to the next card's "Show answer", so Enter or Space steps through the deck.

#### Scenario: Step with Enter
- **WHEN** "Show answer" has focus and the user presses Enter twice
- **THEN** the next card is shown and its "Show answer" has focus

### Requirement: Open full tile
On the answer side, "Open full tile" SHALL open the tile card of the card's tile, as in Explore. The question side SHALL NOT offer it. After the tile card closes, focus SHALL be on "Open full tile" and the session SHALL be where it was.

#### Scenario: Read the full tile
- **WHEN** the card of Tables shows its answer and the user presses "Open full tile"
- **THEN** a modal dialog named "Tables" is open and shows its "See also" section

#### Scenario: Back to the session
- **WHEN** the tile card opened from a study card is closed with Escape
- **THEN** the study card still shows the same card with its answer, and "Open full tile" has focus

### Requirement: Restart
Pressing "Restart" SHALL open the setup dialog showing the fields of the current session. Pressing "Start" SHALL replace the session, and its results, with a new one. Closing the dialog without starting SHALL keep the current session where it was.

#### Scenario: Change fields
- **WHEN** a session with Question `question` is at "Card 3 of 8" and the user presses "Restart", chooses "First heading" and presses "Start"
- **THEN** Study shows "Card 1 of 8" with a heading as the question

#### Scenario: Cancel the restart
- **WHEN** a session is at "Card 3 of 8" and the user presses "Restart" and then Escape
- **THEN** Study shows "Card 3 of 8" as before

### Requirement: End of a round
Grading the last card of a round SHALL end the round and show "You knew K of N cards.", where K is the number of cards graded "I knew it" and N the number of cards in the round, with "card" instead of "cards" when N is 1. Pressing "Start again" SHALL open the setup dialog.

#### Scenario: Last card
- **WHEN** the user grades "Card 8 of 8", after grading 2 of the cards "Not yet"
- **THEN** Study shows "You knew 6 of 8 cards." and "Start again", and no card

#### Scenario: Start again
- **WHEN** the round is done and the user presses "Start again"
- **THEN** the setup dialog is open

### Requirement: Not yet list
When M cards of a round were graded "Not yet", the end of the round SHALL show, below the message and on the `--tes-muted` tint, a label "Not yet · M cards" ("card" when M is 1) after Lucide's `rotate-ccw` icon, styled like a side's label. Below it SHALL be a list named by that label, holding the names of those cards (a tile's name, or its file when it has none) in the order they were shown. Then SHALL come the button that studies them again, which has focus, and "Start again".

#### Scenario: Two missed cards
- **WHEN** a round of 8 cards ends with 2 cards graded "Not yet"
- **THEN** Study shows "Not yet · 2 cards", a list named "Not yet · 2 cards" with the names of those 2 cards, then "Study these 2 again", which has focus, and "Start again"

#### Scenario: One missed card
- **WHEN** a round ends with 1 card graded "Not yet"
- **THEN** Study shows "Not yet · 1 card" and "Study this card again"

### Requirement: Every card known
When every card of a round was graded "I knew it", the end of the round SHALL show, below the message, "Every card known" after Lucide's `circle-check` icon, styled like a side's label, then only "Start again", which has focus.

#### Scenario: All known
- **WHEN** every card of the round was graded "I knew it"
- **THEN** Study shows "You knew 8 of 8 cards.", "Every card known" and "Start again", which has focus, and no "Not yet" list and no button to study cards again

### Requirement: Missed cards round
The button "Study these M again" ("Study this card again" when M is 1) SHALL start a new round over only the cards graded "Not yet" in the round that ended, in a new random order, with the same fields, without opening the setup dialog. From the second round on, the session bar SHALL show "Round r".

#### Scenario: Missed cards again
- **WHEN** a round of 8 cards ends with 2 cards graded "Not yet" and the user presses "Study these 2 again"
- **THEN** Study shows "Round 2" and "Card 1 of 2", and the round shows exactly those 2 cards

### Requirement: Results last for the session
Each round SHALL record whether each card was graded "I knew it" or "Not yet". The results SHALL be kept while the session lasts, also while it is paused in Explore. "Restart" followed by "Start", "Start again" followed by "Start", and tiles that change SHALL discard them. The results SHALL NOT be stored.

#### Scenario: Results paused in Explore
- **WHEN** 3 cards of a round were graded, the user presses "Explore" and then "Study", and goes through the rest of the round
- **THEN** the end message counts all 8 cards

#### Scenario: Restart discards the results
- **WHEN** cards were graded "Not yet" and the user presses "Restart" and then "Start"
- **THEN** the new session shows "Card 1 of 8" and no "Round", and its end message counts only its own grades

### Requirement: Session paused in Explore
Switching to Explore during a session SHALL keep the session and its results. Switching back to Study SHALL show the same card, on the same side, without opening the setup dialog.

#### Scenario: Back to Study
- **WHEN** a session shows the answer of "Card 3 of 8", the user presses "Explore" and then "Study"
- **THEN** Study shows "Card 3 of 8" with its answer, the grades of the first two cards are kept, and no dialog is open

### Requirement: Tiles changed during a session
When the tiles change during a session, the session SHALL end. The next time the setup dialog opens, it SHALL show "The tiles changed, so the session ended." and SHALL offer the choices and count of the new tiles, with the fields of the ended session when they are still offered. When the user is in Study, the setup dialog SHALL open at once.

#### Scenario: Reload while studying
- **WHEN** a session is at "Card 3 of 8" in Study and the user presses "Reload tiles"
- **THEN** the setup dialog is open and shows "The tiles changed, so the session ended."

#### Scenario: Reload while the full tile is open
- **WHEN** the tile card opened from a study card is open and the user presses "Reload tiles"
- **THEN** the tile card is closed and the setup dialog is open

#### Scenario: Reload while the setup dialog is open
- **WHEN** the setup dialog is open with no session and the user presses "Reload tiles" with a collection of 5 tiles
- **THEN** the count shows "of 5 tiles"

### Requirement: Flashcard tile type
The mod's tile type SHALL be named `flashcard`, with the optional properties `title` (a string), `question` and `answer` (any value), and any other properties. Its body SHALL explain the default fields and the First heading choice.

#### Scenario: A collection without the fields
- **WHEN** the Nobel laureates sample collection is validated with the flashcard tile type
- **THEN** every tile matches and no issue is reported

#### Scenario: A number as the answer
- **WHEN** a tile with `answer: 1953` is validated with the flashcard tile type
- **THEN** the tile matches

#### Scenario: A title that is not a string
- **WHEN** a tile with `title: 1984` is validated with the flashcard tile type
- **THEN** the tile does not match and the warning mentions `title`

### Requirement: Sample deck
The sample collection SHALL list 8 tiles about markdown, in this order: Emphasis, Links, Task lists, Tables, Code blocks, Math, Diagrams and Alerts. Each SHALL have a `title`, a `question` and an `answer`, and a body with a level-2 heading and its section. Every tile SHALL match the flashcard tile type.

#### Scenario: Both decks are full
- **WHEN** the setup dialog is open with the sample collection
- **THEN** it shows "8 of 8 tiles have these fields." with the default fields and with "First heading"

#### Scenario: Sample matches its type
- **WHEN** the sample collection is validated with the flashcard tile type
- **THEN** every tile has the type `flashcard` and no issue is reported
