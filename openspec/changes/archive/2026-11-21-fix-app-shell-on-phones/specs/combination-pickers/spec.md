# Spec Delta

## ADDED Requirements

### Requirement: Highlighted rows stay readable
In the mod, collection and mosaic lists, the row the pointer or the keyboard highlights SHALL draw all its text, including its secondary text (details, aliases, the score and the muted score), in the accent's foreground color on the accent background. That pair meets 4.5:1 in both color schemes (see `theme`, "Token contrast"). Rows that are not highlighted SHALL keep their colors.

#### Scenario: Aliases of a highlighted mosaic
- **WHEN** the mosaic list of "Nobel laureates on the map" is open in the light color scheme and the row of that mosaic is highlighted
- **THEN** its aliases `title ← name` and `country ← birth_country` have the computed color of `--ot-accent-foreground`, and a contrast of at least 4.5:1 with the row's background

#### Scenario: Dark color scheme
- **WHEN** the same row is highlighted in the dark color scheme
- **THEN** its aliases have a contrast of at least 4.5:1 with the row's background

### Requirement: Explorer links are easy to tap
Each list's link to its explorer (see "Explorer links") SHALL be at least 32px tall.

#### Scenario: Collection explorer link
- **WHEN** the user opens the collection list of "Nobel laureates on the map"
- **THEN** the "Open the collection explorer" link is at least 32px tall
