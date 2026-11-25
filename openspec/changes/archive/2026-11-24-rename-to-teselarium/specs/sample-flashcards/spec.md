## MODIFIED Requirements

### Requirement: Mod file
The mod file SHALL give the mod the title "Flashcards", and SHALL declare `api: "^0.2.0"`, its tile type `./flashcard_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, whose mosaic names the mod's own folder and the sample deck `./flashcard_collection.yaml` as its collection. Neither the mod file nor its default mosaic SHALL declare permissions. The sample deck's collection file SHALL use `title`.

#### Scenario: Inspect the sample
- **WHEN** `mods.inspect` is sent for `./samples/mods/flashcards`
- **THEN** the answer has the title "Flashcards", a tile type and a default mosaic, and its permissions have no granted and no denied entry

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

### Requirement: Session bar
A session bar above the card SHALL hold "Card i of N", with a font size of 0.875rem in `--tes-muted-foreground`, and a `<progress>` whose value is the number of cards graded in the round and whose maximum is N. It SHALL also hold "Round r" from the second round on, and "Restart" as a plain button.

#### Scenario: The position
- **WHEN** a session of the sample deck shows "Card 3 of 8"
- **THEN** "Card 3 of 8" is shown above the card in `--tes-muted-foreground`, the progress has the value 2 and the maximum 8, and "Restart" is not inside the card

### Requirement: Not yet list
When M cards of a round were graded "Not yet", the end of the round SHALL show, below the message and on the `--tes-muted` tint, a label "Not yet · M cards" ("card" when M is 1) after Lucide's `rotate-ccw` icon, styled like a side's label. Below it SHALL be a list named by that label, holding the names of those cards (a tile's name, or its file when it has none) in the order they were shown. Then SHALL come the button that studies them again, which has focus, and "Start again".

#### Scenario: Two missed cards
- **WHEN** a round of 8 cards ends with 2 cards graded "Not yet"
- **THEN** Study shows "Not yet · 2 cards", a list named "Not yet · 2 cards" with the names of those 2 cards, then "Study these 2 again", which has focus, and "Start again"

#### Scenario: One missed card
- **WHEN** a round ends with 1 card graded "Not yet"
- **THEN** Study shows "Not yet · 1 card" and "Study this card again"
