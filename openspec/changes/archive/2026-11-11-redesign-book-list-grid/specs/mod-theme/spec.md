# Spec Delta

## REMOVED Requirements

### Requirement: Sample and default mods follow the theme
**Reason**: Replaced by "Sample and default mods take the theme's look", which also lets the sample set its books' corner shape and shadow from theme tokens, and checks the sample's raised book instead of a selected book, which the sample no longer has.
**Migration**: None. The default mods keep the same rules, and the sample still takes its colors and fonts from the theme.

## ADDED Requirements

### Requirement: Sample and default mods take the theme's look
The sample mod `book_list` and the default mods `mod_explorer` and `mod_viewer` SHALL take their colors and fonts from the theme, and SHALL only add styles for what the base stylesheet does not cover: layout and, in the sample mod only, the corner shape of its books, taken from `--ot-radius`, and their shadow, taken from `--ot-shadow`.

#### Scenario: Dark sample mod
- **WHEN** the color scheme is `dark` and the sample book list mod runs with the sample collection
- **THEN** the computed background color of its frame's `<body>` is the dark value of `--ot-background`

#### Scenario: Raised book uses the theme's shadow
- **WHEN** the pointer is over Kallocain's book in the sample book list mod
- **THEN** Kallocain's button has the computed `box-shadow` of `--ot-shadow`

#### Scenario: Sample mod's own styles
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the rules of its own styles set no background, color or font property, no shadow other than `var(--ot-shadow)`, and no border property other than corner radii

#### Scenario: Dark default mods
- **WHEN** the color scheme is `dark` and the mod explorer and the mod viewer are opened
- **THEN** the computed background color of each frame's `<body>` is the dark value of `--ot-background`
