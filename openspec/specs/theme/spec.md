# theme Specification

## Purpose

Gives the app and its mods one shared look: a set of design tokens with light and dark values, the user's choice of theme (System, Light or Dark) and how it resolves to a color scheme, and the app's own interface following that color scheme.

## Requirements

### Requirement: Theme tokens
The system SHALL define a fixed set of theme tokens. Each token SHALL be a CSS custom property whose name starts with `--ot-`, with one value for the light color scheme and one for the dark color scheme. Color tokens SHALL have different light and dark values. Tokens that are not colors SHALL have the same value in both color schemes.

#### Scenario: Token names
- **WHEN** the tokens are listed
- **THEN** their names are exactly `--ot-color-background`, `--ot-color-surface`, `--ot-color-text`, `--ot-color-text-muted`, `--ot-color-border`, `--ot-color-accent`, `--ot-color-accent-text`, `--ot-color-focus`, `--ot-color-danger`, `--ot-color-warning`, `--ot-color-success`, `--ot-font-body`, `--ot-font-mono`, `--ot-font-size`, `--ot-line-height`, `--ot-space-1`, `--ot-space-2`, `--ot-space-3`, `--ot-space-4`, `--ot-space-6`, `--ot-radius` and `--ot-shadow`

#### Scenario: Color tokens differ between color schemes
- **WHEN** the tokens are resolved for the light and for the dark color scheme
- **THEN** each token whose name starts with `--ot-color-` has a different value in each, and every other token has the same value in both

#### Scenario: Resolved tokens are plain data
- **WHEN** the tokens are resolved for the dark color scheme
- **THEN** the result is a mapping from each token name to a string, and a structured clone of it deep-equals it

### Requirement: Theme choice
The app header SHALL have a Theme control with the choices System, Light and Dark. Changing the choice SHALL apply it to the app and to every running mod at once, without reloading the page or any mod's frame.

#### Scenario: Default choice
- **WHEN** the app is opened for the first time
- **THEN** the Theme control shows System

#### Scenario: Choose Dark
- **WHEN** the operating system prefers light and the user chooses Dark while the sample book list mod is running
- **THEN** the app and the mod's frame switch to the dark color scheme
- **AND** the mod's frame was not reloaded

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
The app's own interface (the header, the stage bar, the issue list and the load error messages) SHALL take its colors, fonts and spacing from the theme tokens of the current color scheme, so it matches the mods.

#### Scenario: Dark app
- **WHEN** the color scheme is `dark`
- **THEN** the page's background color is the dark value of `--ot-color-background` and the stage bar's text color is the dark value of `--ot-color-text`

#### Scenario: Back to light
- **WHEN** the color scheme changes from `dark` to `light`
- **THEN** the page's background color becomes the light value of `--ot-color-background` without reloading the page
