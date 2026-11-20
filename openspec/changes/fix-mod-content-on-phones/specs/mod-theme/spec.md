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
