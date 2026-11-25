## MODIFIED Requirements

### Requirement: Theme tokens
The system SHALL define a fixed set of theme tokens. Each token SHALL be a CSS custom property whose name starts with `--tes-`, with one value for the light color scheme and one for the dark color scheme. The color tokens SHALL be the role colors listed below, and each SHALL have different light and dark values. Tokens that are not colors SHALL have the same value in both color schemes.

#### Scenario: Token names
- **WHEN** the tokens are listed
- **THEN** their names are exactly `--tes-background`, `--tes-foreground`, `--tes-card`, `--tes-card-foreground`, `--tes-popover`, `--tes-popover-foreground`, `--tes-primary`, `--tes-primary-foreground`, `--tes-secondary`, `--tes-secondary-foreground`, `--tes-muted`, `--tes-muted-foreground`, `--tes-accent`, `--tes-accent-foreground`, `--tes-highlight`, `--tes-highlight-foreground`, `--tes-destructive`, `--tes-destructive-foreground`, `--tes-warning`, `--tes-success`, `--tes-border`, `--tes-input`, `--tes-ring`, `--tes-font-sans`, `--tes-font-mono`, `--tes-font-size`, `--tes-line-height`, `--tes-space-1`, `--tes-space-2`, `--tes-space-3`, `--tes-space-4`, `--tes-space-6`, `--tes-radius`, `--tes-shadow`, `--tes-content-width` and `--tes-reading-width`

#### Scenario: Color tokens differ between color schemes
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each of the twenty-three tokens from `--tes-background` to `--tes-ring` in the list above has a different value in each, and every other token has the same value in both

#### Scenario: Old token names are gone
- **WHEN** the tokens are resolved for the light color scheme
- **THEN** no token name starts with `--tes-color-`, and there is no `--tes-font-body`

#### Scenario: Resolved tokens are plain data
- **WHEN** the tokens are resolved for the dark color scheme
- **THEN** the result is a mapping from each token name to a string, and a structured clone of it deep-equals it

### Requirement: The app follows the color scheme
The app's own interface (the sidebar, the Settings page, the stage bar, the issue list, the loading and load error messages and the action dialog) SHALL take its colors, fonts and spacing from the theme tokens of the current color scheme, so it matches the mods.

#### Scenario: Dark app
- **WHEN** the color scheme is `dark`
- **THEN** the page's background color is the dark value of `--tes-background` and the stage bar's text color is the dark value of `--tes-foreground`

#### Scenario: Back to light
- **WHEN** the color scheme changes from `dark` to `light`
- **THEN** the page's background color becomes the light value of `--tes-card` without reloading the page

#### Scenario: Action dialog follows the color scheme
- **WHEN** the color scheme is `dark` and a mod's action dialog is shown
- **THEN** the dialog's background color is the dark value of `--tes-popover` and its text color is the dark value of `--tes-popover-foreground`

#### Scenario: Dark sidebar
- **WHEN** the color scheme is `dark`
- **THEN** the sidebar's background color is the dark value of `--tes-card` and the current item's text color is the dark value of `--tes-accent-foreground`

### Requirement: Token contrast
In each color scheme, every text role SHALL have a contrast ratio of at least 4.5:1, as WCAG defines it, on each surface it is drawn on. The text roles `--tes-foreground`, `--tes-muted-foreground`, `--tes-primary`, `--tes-secondary`, `--tes-destructive`, `--tes-warning` and `--tes-success` are drawn on `--tes-background`, `--tes-card` and `--tes-muted`. Each role's `-foreground` token is drawn on that role.

#### Scenario: Text roles on the surfaces
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each of `--tes-foreground`, `--tes-muted-foreground`, `--tes-primary`, `--tes-secondary`, `--tes-destructive`, `--tes-warning` and `--tes-success` has a contrast ratio of at least 4.5 on each of `--tes-background`, `--tes-card` and `--tes-muted`

#### Scenario: Foreground on its role
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** `--tes-card-foreground` on `--tes-card`, `--tes-popover-foreground` on `--tes-popover`, `--tes-primary-foreground` on `--tes-primary`, `--tes-secondary-foreground` on `--tes-secondary`, `--tes-accent-foreground` on `--tes-accent`, `--tes-highlight-foreground` on `--tes-highlight`, `--tes-destructive-foreground` on `--tes-destructive` and `--tes-muted-foreground` on `--tes-muted` each have a contrast ratio of at least 4.5

### Requirement: App canvas and panels
The app's canvas, behind its panels and pages, SHALL be `--tes-card` in the light color scheme and `--tes-background` in the dark one. The sidebar, the stage bar and the visible sandbox's frame SHALL be panels apart from each other and from the viewport's edges, each with a `--tes-border` border and a shadow. Pages SHALL be drawn on the canvas, not in a panel. No theme token SHALL change for this.

#### Scenario: White canvas in light
- **WHEN** the color scheme is `light` and a mod is visible
- **THEN** the app page's background color is the light value of `--tes-card`, and the sidebar, the stage bar and the mod's frame each have a non-empty computed box shadow and do not touch each other

#### Scenario: Canvas in dark
- **WHEN** the color scheme is `dark`
- **THEN** the app page's background color is the dark value of `--tes-background`

#### Scenario: Mods keep their background
- **WHEN** the color scheme is `light` and a mod that adds no styles runs
- **THEN** its frame's `<body>` background color is the light value of `--tes-background`
