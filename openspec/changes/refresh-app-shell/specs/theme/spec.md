## ADDED Requirements

### Requirement: App canvas and panels
The app's canvas, behind its panels and pages, SHALL be `--ot-card` in the light color scheme and `--ot-background` in the dark one. The sidebar, the stage bar and the visible sandbox's frame SHALL be panels apart from each other and from the viewport's edges, each with an `--ot-border` border and a shadow. Pages SHALL be drawn on the canvas, not in a panel. No theme token SHALL change for this.

#### Scenario: White canvas in light
- **WHEN** the color scheme is `light` and a mod is visible
- **THEN** the app page's background color is the light value of `--ot-card`, and the sidebar, the stage bar and the mod's frame each have a non-empty computed box shadow and do not touch each other

#### Scenario: Canvas in dark
- **WHEN** the color scheme is `dark`
- **THEN** the app page's background color is the dark value of `--ot-background`

#### Scenario: Mods keep their background
- **WHEN** the color scheme is `light` and a mod that adds no styles runs
- **THEN** its frame's `<body>` background color is the light value of `--ot-background`

## MODIFIED Requirements

### Requirement: Theme choice
The Settings page and the sidebar SHALL each have a Theme control with the choices System, Light and Dark, showing the current choice. The sidebar's control SHALL be a button that opens a menu of the three choices. Changing the choice in either control SHALL update the other and apply it to the app and to every running mod at once, visible or hidden, without reloading the page or any mod's frame.

#### Scenario: Default choice
- **WHEN** the app is opened for the first time at `#/settings`
- **THEN** the Theme control shows System

#### Scenario: Choose Dark
- **WHEN** the operating system prefers light, a mod is running, and the user opens Settings and chooses Dark
- **THEN** the app switches to the dark color scheme, and going back shows the mod's frame in the dark color scheme
- **AND** the mod's frame was not reloaded

#### Scenario: Choose from the sidebar
- **WHEN** the operating system prefers light, a mod is visible, and the user presses the sidebar's theme control and chooses Dark in its menu
- **THEN** the app and the mod's frame switch to the dark color scheme without reloading the frame, and the Settings page's Theme control shows Dark

#### Scenario: No Theme control in the header
- **WHEN** the app is opened
- **THEN** the page has no header, and the only Theme controls are the sidebar's and, at `#/settings`, the Settings page's

#### Scenario: Sidebar menu shows the choice
- **WHEN** the choice is Light and the user opens the sidebar's theme control
- **THEN** its menu lists System, Light and Dark, and Light is marked as chosen

### Requirement: The app follows the color scheme
The app's own interface (the sidebar, the Settings page, the stage bar, the issue list, the loading and load error messages and the action dialog) SHALL take its colors, fonts and spacing from the theme tokens of the current color scheme, so it matches the mods.

#### Scenario: Dark app
- **WHEN** the color scheme is `dark`
- **THEN** the page's background color is the dark value of `--ot-background` and the stage bar's text color is the dark value of `--ot-foreground`

#### Scenario: Back to light
- **WHEN** the color scheme changes from `dark` to `light`
- **THEN** the page's background color becomes the light value of `--ot-card` without reloading the page

#### Scenario: Action dialog follows the color scheme
- **WHEN** the color scheme is `dark` and a mod's action dialog is shown
- **THEN** the dialog's background color is the dark value of `--ot-popover` and its text color is the dark value of `--ot-popover-foreground`

#### Scenario: Dark sidebar
- **WHEN** the color scheme is `dark`
- **THEN** the sidebar's background color is the dark value of `--ot-card` and the current item's text color is the dark value of `--ot-accent-foreground`
