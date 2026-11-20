# theme Specification

## Purpose

Gives the app and its mods one shared look: a set of design tokens with light and dark values, the user's choice of theme (System, Light or Dark) and how it resolves to a color scheme, and the app's own interface following that color scheme.

## Requirements

### Requirement: Theme tokens
The system SHALL define a fixed set of theme tokens. Each token SHALL be a CSS custom property whose name starts with `--ot-`, with one value for the light color scheme and one for the dark color scheme. The color tokens SHALL be the role colors listed below, and each SHALL have different light and dark values. Tokens that are not colors SHALL have the same value in both color schemes.

#### Scenario: Token names
- **WHEN** the tokens are listed
- **THEN** their names are exactly `--ot-background`, `--ot-foreground`, `--ot-card`, `--ot-card-foreground`, `--ot-popover`, `--ot-popover-foreground`, `--ot-primary`, `--ot-primary-foreground`, `--ot-secondary`, `--ot-secondary-foreground`, `--ot-muted`, `--ot-muted-foreground`, `--ot-accent`, `--ot-accent-foreground`, `--ot-highlight`, `--ot-highlight-foreground`, `--ot-destructive`, `--ot-destructive-foreground`, `--ot-warning`, `--ot-success`, `--ot-border`, `--ot-input`, `--ot-ring`, `--ot-font-sans`, `--ot-font-mono`, `--ot-font-size`, `--ot-line-height`, `--ot-space-1`, `--ot-space-2`, `--ot-space-3`, `--ot-space-4`, `--ot-space-6`, `--ot-radius`, `--ot-shadow`, `--ot-content-width` and `--ot-reading-width`

#### Scenario: Color tokens differ between color schemes
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each of the twenty-three tokens from `--ot-background` to `--ot-ring` in the list above has a different value in each, and every other token has the same value in both

#### Scenario: Old token names are gone
- **WHEN** the tokens are resolved for the light color scheme
- **THEN** no token name starts with `--ot-color-`, and there is no `--ot-font-body`

#### Scenario: Resolved tokens are plain data
- **WHEN** the tokens are resolved for the dark color scheme
- **THEN** the result is a mapping from each token name to a string, and a structured clone of it deep-equals it

### Requirement: Theme choice
The Settings page and the sidebar SHALL each have a Theme control with the choices System, Light and Dark, showing the current choice. The sidebar's control SHALL be a button that, on each press, moves to the next choice in the order System, Light, Dark and back to System. Changing the choice in either control SHALL update the other and apply it to the app and to every running mod at once, visible or hidden, without reloading the page or any mod's frame.

#### Scenario: Default choice
- **WHEN** the app is opened for the first time at `#/settings`
- **THEN** the Theme control shows System

#### Scenario: Choose Dark
- **WHEN** the operating system prefers light, a mod is running, and the user opens Settings and chooses Dark
- **THEN** the app switches to the dark color scheme, and going back shows the mod's frame in the dark color scheme
- **AND** the mod's frame was not reloaded

#### Scenario: Choose from the sidebar
- **WHEN** the operating system prefers light, a mod is visible, and the user presses the sidebar's theme control until the choice is Dark
- **THEN** the app and the mod's frame switch to the dark color scheme without reloading the frame, and the Settings page's Theme control shows Dark

#### Scenario: No Theme control in the header
- **WHEN** the app is opened
- **THEN** the page has no header, and the only Theme controls are the sidebar's and, at `#/settings`, the Settings page's

#### Scenario: Each press moves to the next choice
- **WHEN** the choice is System and the user presses the sidebar's theme control three times
- **THEN** the choice is Light, then Dark, then System again, and after each press the control's tooltip and accessible name say `Theme: <choice>`

### Requirement: Resolve the color scheme
The system SHALL resolve the theme choice to a color scheme, `light` or `dark`. Light and Dark SHALL resolve to themselves. System SHALL resolve to the operating system's preference, and SHALL follow it when it changes while the app is open.

#### Scenario: System follows the operating system
- **WHEN** the choice is System and the operating system prefers dark
- **THEN** the color scheme is `dark`

#### Scenario: Operating system changes while the app is open
- **WHEN** the choice is System and the operating system's preference changes from light to dark
- **THEN** the color scheme becomes `dark` without reloading the page

#### Scenario: An explicit choice ignores the operating system
- **WHEN** the choice is Light and the operating system prefers dark
- **THEN** the color scheme is `light`

### Requirement: The theme choice is remembered
The system SHALL keep the theme choice in the app's storage, under a key that no mod storage slot can use, and SHALL restore it when the app is opened again. A missing or unknown stored value SHALL count as System. When the storage cannot be read or written, the choice SHALL still apply until the page is closed.

#### Scenario: Choice kept after a reload
- **WHEN** the user chooses Dark and the app page is reloaded
- **THEN** the Theme control shows Dark and the color scheme is `dark`

#### Scenario: Unknown stored value
- **WHEN** the stored theme choice is `"purple"`
- **THEN** the Theme control shows System

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user chooses Dark
- **THEN** the color scheme is `dark` and no error is shown

#### Scenario: Mods cannot reach the choice
- **WHEN** the user chose Dark and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored theme choice

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

### Requirement: Token contrast
In each color scheme, every text role SHALL have a contrast ratio of at least 4.5:1, as WCAG defines it, on each surface it is drawn on. The text roles `--ot-foreground`, `--ot-muted-foreground`, `--ot-primary`, `--ot-secondary`, `--ot-destructive`, `--ot-warning` and `--ot-success` are drawn on `--ot-background`, `--ot-card` and `--ot-muted`. Each role's `-foreground` token is drawn on that role.

#### Scenario: Text roles on the surfaces
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each of `--ot-foreground`, `--ot-muted-foreground`, `--ot-primary`, `--ot-secondary`, `--ot-destructive`, `--ot-warning` and `--ot-success` has a contrast ratio of at least 4.5 on each of `--ot-background`, `--ot-card` and `--ot-muted`

#### Scenario: Foreground on its role
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** `--ot-card-foreground` on `--ot-card`, `--ot-popover-foreground` on `--ot-popover`, `--ot-primary-foreground` on `--ot-primary`, `--ot-secondary-foreground` on `--ot-secondary`, `--ot-accent-foreground` on `--ot-accent`, `--ot-highlight-foreground` on `--ot-highlight`, `--ot-destructive-foreground` on `--ot-destructive` and `--ot-muted-foreground` on `--ot-muted` each have a contrast ratio of at least 4.5

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
