# Spec Delta

## ADDED Requirements

### Requirement: Long words wrap
In the frame of a mod that does not opt out of the theme styles, the base stylesheet SHALL let the page's text break inside a word that does not fit on a line, such as a bare URL, so that text alone never makes the frame's document scroll sideways. It SHALL NOT break words that fit, and SHALL NOT make a table's or a flex item's content narrower than its longest word. The rule SHALL be in the cascade layer `opentesela`, so a mod's own style overrides it.

#### Scenario: Bare URL in a narrow frame
- **WHEN** a mod that adds no styles shows a paragraph holding the link text `https://en.wikipedia.org/wiki/Bob_Dylan` in a frame 338px wide
- **THEN** the link wraps inside the paragraph, and the frame's document cannot scroll sideways

#### Scenario: Words that fit are not broken
- **WHEN** a mod that adds no styles shows the paragraph "The Nobel Prize in Literature" in a frame 338px wide
- **THEN** no word of the paragraph is split across two lines

#### Scenario: A mod's own style wins
- **WHEN** a mod sets `body { overflow-wrap: normal; }` outside a layer
- **THEN** the computed `overflow-wrap` of its `<body>` is `normal`

#### Scenario: Opted-out mods are not changed
- **WHEN** a mod whose file sets `theme: "none"` is running
- **THEN** the computed `overflow-wrap` of its `<body>` is the browser's default, `normal`

### Requirement: Table rows have one separator each
In the frame of a mod that does not opt out of the theme styles, the base stylesheet SHALL draw the line between table rows once per row, under the row, not under each cell. A row that a mod lays out as a block or a grid SHALL keep one line under the whole row. A table with columns SHALL show one line under its header row and under each row but the last.

#### Scenario: Stacked row
- **WHEN** a mod that sets only `display: block` on a table's parts shows a table of two rows of two cells in a frame 338px wide
- **THEN** the first row has one line, under its second cell, and none between its two cells

#### Scenario: Table with columns
- **WHEN** a mod that adds no styles shows a table with a header row and two rows
- **THEN** a line runs under the header row and under the first row, across the table's width, and none under the last row
