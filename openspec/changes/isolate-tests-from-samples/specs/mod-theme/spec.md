## REMOVED Requirements

### Requirement: Sample and default mods take the theme's look
**Reason**: It mixes the shipped sample with the default mods. The sample's look belongs to `sample-book-list`.
**Migration**:
- "Default mods take the theme's look" keeps the default mods' part and its "Dark default mods" scenario.
- `sample-book-list` › "Theme look" keeps the sample's part and its "Dark sample mod" and "Sample mod's own styles" scenarios.
- "Raised book uses the theme's shadow" was the same check as `sample-book-list` › "Raised book" › "Raised on hover", which stays.

## ADDED Requirements

### Requirement: Default mods take the theme's look
The default mods `mod_explorer` and `mod_viewer` SHALL take their colors and fonts from the theme, and SHALL only add styles for layout, which the base stylesheet does not cover.

#### Scenario: Dark default mods
- **WHEN** the color scheme is `dark` and the mod explorer and the mod viewer are opened
- **THEN** the computed background color of each frame's `<body>` is the dark value of `--ot-background`
