## MODIFIED Requirements

### Requirement: Theme choice
The Settings page SHALL have a Theme control with the choices System, Light and Dark. The app header SHALL NOT have one. Changing the choice SHALL apply it to the app and to every running mod at once, visible or hidden, without reloading the page or any mod's frame.

#### Scenario: Default choice
- **WHEN** the app is opened for the first time at `#/settings`
- **THEN** the Theme control shows System

#### Scenario: Choose Dark
- **WHEN** the operating system prefers light, a mod is running, and the user opens Settings and chooses Dark
- **THEN** the app switches to the dark color scheme, and going back shows the mod's frame in the dark color scheme
- **AND** the mod's frame was not reloaded

#### Scenario: No Theme control in the header
- **WHEN** the app is opened
- **THEN** the header holds the hamburger button and the `OpenTesela` heading, and no Theme control
