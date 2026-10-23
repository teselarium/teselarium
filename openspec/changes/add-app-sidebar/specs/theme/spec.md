# Spec Delta

## MODIFIED Requirements

### Requirement: Theme choice
The Settings page SHALL have a Theme control with the choices System, Light and Dark. The app header SHALL NOT have one. Changing the choice SHALL apply it to the app and to every running mod at once, visible or hidden, without reloading the page or any mod's frame.

#### Scenario: Default choice
- **WHEN** the app is opened for the first time at `#/settings`
- **THEN** the Theme control shows System

#### Scenario: Choose Dark
- **WHEN** the operating system prefers light, the sample book list mod is running, and the user opens Settings and chooses Dark
- **THEN** the app switches to the dark color scheme, and going back shows the mod's frame in the dark color scheme
- **AND** the mod's frame was not reloaded

#### Scenario: No Theme control in the header
- **WHEN** the app is opened
- **THEN** the header holds the hamburger button and the `OpenTesela` heading, and no Theme control

### Requirement: The app follows the color scheme
The app's own interface (the header, the sidebar, the Settings page, the stage bar, the issue list, the loading and load error messages and the action dialog) SHALL take its colors, fonts and spacing from the theme tokens of the current color scheme, so it matches the mods.

#### Scenario: Dark app
- **WHEN** the color scheme is `dark`
- **THEN** the page's background color is the dark value of `--ot-background` and the stage bar's text color is the dark value of `--ot-foreground`

#### Scenario: Back to light
- **WHEN** the color scheme changes from `dark` to `light`
- **THEN** the page's background color becomes the light value of `--ot-background` without reloading the page

#### Scenario: Action dialog follows the color scheme
- **WHEN** the color scheme is `dark` and a mod's action dialog is shown
- **THEN** the dialog's background color is the dark value of `--ot-popover` and its text color is the dark value of `--ot-popover-foreground`

#### Scenario: Dark sidebar
- **WHEN** the color scheme is `dark`
- **THEN** the sidebar's background color is the dark value of `--ot-card` and the current item's text color is the dark value of `--ot-accent-foreground`
