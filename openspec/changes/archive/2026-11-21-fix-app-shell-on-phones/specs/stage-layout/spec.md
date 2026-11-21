# Spec Delta

## MODIFIED Requirements

### Requirement: Fullscreen the visible mod
Pressing the stage bar's fullscreen button, or choosing the "Fullscreen" item of its "More actions" menu on a narrow stage bar, SHALL show the visible sandbox's frame fullscreen, without its border and corner rounding, and without reloading it. Leaving fullscreen SHALL show the frame under the stage bar again. When the browser refuses fullscreen, the sandbox SHALL get a `warning` message from the app that says fullscreen is not available, with the browser's reason.

#### Scenario: Frame fills the screen
- **WHEN** the user presses the fullscreen button while a mod runs
- **THEN** the app's `document.fullscreenElement` is the mod's frame and the frame was not reloaded

#### Scenario: Escape leaves fullscreen
- **WHEN** a mod is fullscreen and the user presses Escape
- **THEN** the app's `document.fullscreenElement` is `null` and the stage bar is shown above the frame

#### Scenario: Fullscreen refused
- **WHEN** the browser rejects the request for fullscreen and the user presses the fullscreen button
- **THEN** the visible sandbox gets a `warning` message from the app saying that fullscreen is not available

#### Scenario: Fullscreen from the menu
- **WHEN** a mod runs on a 360×740 viewport and the user chooses "Fullscreen" in the "More actions" menu
- **THEN** the app's `document.fullscreenElement` is the mod's frame and the frame was not reloaded
