## MODIFIED Requirements

### Requirement: Each mod frame has a layout
Each mod frame SHALL have exactly one layout: `fullscreen` while the frame is the app page's fullscreen element, whether the app or the mod asked for fullscreen; otherwise `theater` while theater mode is on; otherwise `contained`. The frames of mod checks and mod test cases SHALL always be `contained`.

#### Scenario: Default layout
- **WHEN** theater mode is off and a mod runs
- **THEN** its layout is `contained`

#### Scenario: Theater layout
- **WHEN** theater mode is on and a mod runs
- **THEN** its layout is `theater`

#### Scenario: Fullscreen from the stage bar
- **WHEN** theater mode is off and the user presses the stage bar's fullscreen button for a mod
- **THEN** its layout is `fullscreen`

#### Scenario: Fullscreen asked by the mod
- **WHEN** the user clicks a button in a running mod whose handler calls `document.body.requestFullscreen()`
- **THEN** that mod's layout is `fullscreen`

#### Scenario: Leaving fullscreen
- **WHEN** theater mode is on, the visible mod is fullscreen and the user presses Escape
- **THEN** that mod's layout is `theater`

#### Scenario: Check frames are contained
- **WHEN** theater mode is on and the mod viewer runs a check of a mod
- **THEN** the checked mod's mount context has `layout` `"contained"`

### Requirement: Theater mode is remembered
The system SHALL keep the theater choice in the app's storage, under a key that no mod storage slot can use, and SHALL restore it when the app is opened again. A missing or unknown stored value SHALL count as off. When the storage cannot be read or written, the choice SHALL still apply until the page is closed.

#### Scenario: Choice kept after a reload
- **WHEN** the user turns theater mode on and the app page is reloaded
- **THEN** theater mode is on and the mod's layout is `theater`

#### Scenario: Unknown stored value
- **WHEN** the stored theater choice is `"maybe"`
- **THEN** theater mode is off

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user turns theater mode on
- **THEN** the visible mod's layout is `theater` and no error is shown

#### Scenario: Mods cannot reach the choice
- **WHEN** theater mode is on and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored theater choice

### Requirement: Layout in the mount context
The mount context SHALL have `layout`, the frame's layout as a string. It SHALL be the layout current when the mod's frame connects.

#### Scenario: Default mount context
- **WHEN** theater mode is off and a mod is mounted
- **THEN** its mount context's `layout` is `"contained"`

#### Scenario: Theater turned on while the mod loads
- **WHEN** a mod is opened while theater mode is off, and the user turns it on before the mod's frame connects
- **THEN** the mod's mount context's `layout` is `"theater"`

### Requirement: Layout changed event
When a running mod's layout changes, the engine SHALL push `layout.changed` with `{ layout }` to that mod, visible or hidden, once per change. A change of theater mode that leaves a mod's layout the same SHALL push nothing to that mod.

#### Scenario: Theater turned on
- **WHEN** a mod runs and the user turns theater mode on
- **THEN** its `layout.changed` handlers receive `{ layout: "theater" }` once

#### Scenario: Fullscreen mod keeps its layout
- **WHEN** the visible mod is fullscreen and theater mode is turned on
- **THEN** the visible mod receives no `layout.changed` event

#### Scenario: Plain data
- **WHEN** the params of a `layout.changed` event are structured cloned
- **THEN** the clone deep-equals them

### Requirement: The frame keeps its size in every layout
The frame of the visible mod SHALL fill the stage area in the `contained` and `theater` layouts alike, so the width limit leaves the space beside the content inside the frame, where it scrolls the mod's document.

#### Scenario: Same frame in both layouts
- **WHEN** a mod runs in a 2560×1080 viewport and the user turns theater mode on
- **THEN** its frame's width and height are the same as before
- **AND** the frame was not reloaded

#### Scenario: Wheel beside the content
- **WHEN** theater mode is off, a mod that adds no styles and whose content is 3000 pixels tall runs in a 2560×1080 viewport, and the user turns the mouse wheel with the pointer inside the frame, left of the `<body>`
- **THEN** the mod's document scrolls

### Requirement: Fullscreen the visible mod
Pressing the stage bar's fullscreen button SHALL show the visible sandbox's frame fullscreen, without its border and corner rounding, and without reloading it. Leaving fullscreen SHALL show the frame under the stage bar again. When the browser refuses fullscreen, the sandbox SHALL get a `warning` message from the app that says fullscreen is not available, with the browser's reason.

#### Scenario: Frame fills the screen
- **WHEN** the user presses the fullscreen button while a mod runs
- **THEN** the app's `document.fullscreenElement` is the mod's frame and the frame was not reloaded

#### Scenario: Escape leaves fullscreen
- **WHEN** a mod is fullscreen and the user presses Escape
- **THEN** the app's `document.fullscreenElement` is `null` and the stage bar is shown above the frame

#### Scenario: Fullscreen refused
- **WHEN** the browser rejects the request for fullscreen and the user presses the fullscreen button
- **THEN** the visible sandbox gets a `warning` message from the app saying that fullscreen is not available
