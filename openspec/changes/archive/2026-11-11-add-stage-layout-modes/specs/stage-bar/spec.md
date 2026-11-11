# Spec Delta

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold, in order, the mod's name, its version in a capsule, an information button, a Share button and, for a sandbox opened with a collection, the "Reload tiles" button. Its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the stage bar shows, from left to right, `Book List`, `1.1.0` in a capsule, the information button, the Share button, the "Reload tiles" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the sample book list mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button and its other items keep their order

#### Scenario: Close button last
- **WHEN** the sample book list mod runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

#### Scenario: Home mod without a close button
- **WHEN** a home mod is shown at `#/`
- **THEN** the fullscreen button is the stage bar's rightmost item, and no separator follows it

## ADDED Requirements

### Requirement: Theater mode button
The stage bar SHALL have a theater mode toggle button whose accessible name and tooltip are "Theater mode", and which is pressed (`aria-pressed="true"`) while theater mode is on. Pressing it SHALL turn theater mode on or off (see `stage-layout`). It SHALL be shown for every visible sandbox, also while its mod loads or after it failed.

#### Scenario: Turn theater mode on
- **WHEN** theater mode is off and the user presses the theater mode button
- **THEN** theater mode is on and the button's `aria-pressed` is `"true"`

#### Scenario: Turn theater mode off
- **WHEN** theater mode is on and the user presses the theater mode button
- **THEN** theater mode is off and the button's `aria-pressed` is `"false"`

#### Scenario: Shown for a failed sandbox
- **WHEN** a run link names a mod file that cannot be loaded
- **THEN** the stage bar has the theater mode button

### Requirement: Fullscreen button
The stage bar SHALL have an icon button whose accessible name and tooltip are "Fullscreen" while the visible sandbox has a running mod frame, and none while its mod loads, waits for an answer or failed. Pressing it SHALL show the visible mod fullscreen (see `stage-layout`).

#### Scenario: Running mod
- **WHEN** the sample book list mod runs
- **THEN** the stage bar has a button named "Fullscreen"

#### Scenario: Failed sandbox
- **WHEN** a run link names a mod file that cannot be loaded
- **THEN** the stage bar has no button named "Fullscreen"

#### Scenario: Waiting for an answer
- **WHEN** a mod whose `api` range does not match is opened and the API question is shown
- **THEN** the stage bar has no button named "Fullscreen"
