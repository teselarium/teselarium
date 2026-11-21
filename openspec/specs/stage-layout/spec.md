# stage-layout Specification

## Purpose

Decides how wide each running mod lays out its content: centered at a readable width by default, across the whole stage area in theater mode, or across the whole screen in fullscreen. Tells every mod its layout, so its content can follow, while the mod keeps the last word on its own width.

## Requirements

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

### Requirement: Theater mode applies to every running mod
Turning theater mode on or off SHALL change the layout of every running mod that is not fullscreen, visible or hidden, at once and without reloading any frame.

#### Scenario: Hidden mod follows
- **WHEN** the mod explorer opened the mod viewer, so the explorer's sandbox is hidden, and the user turns theater mode on
- **THEN** the layout of both mods is `theater`
- **AND** neither frame was reloaded

#### Scenario: New sandboxes start in the current mode
- **WHEN** theater mode is on and the user opens a run link
- **THEN** the new mod's layout is `theater`

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

### Requirement: Layout attribute
The `<html>` element of every mod frame SHALL have the attribute `data-ot-layout` set to the frame's layout before the mod's `mount` is called. When the layout changes, the attribute SHALL be updated before the mod's `layout.changed` handlers are called. This SHALL hold also for mods that opt out of the theme styles.

#### Scenario: Attribute at mount
- **WHEN** theater mode is on and a mod reads `document.documentElement.dataset.otLayout` inside `mount`
- **THEN** it reads `"theater"`

#### Scenario: Attribute before the handlers
- **WHEN** the user turns theater mode off and a mod's `layout.changed` handler reads the attribute
- **THEN** it reads `"contained"`

#### Scenario: Opted-out mod gets the attribute
- **WHEN** theater mode is on and a mod with `theme: "none"` is running
- **THEN** its `<html>` attribute `data-ot-layout` is `"theater"`

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

### Requirement: Content width in the contained layout
In the frame of a mod that does not opt out of the theme styles, the base stylesheet SHALL keep the `<body>` at most `--ot-content-width` wide and centered while the layout is `contained`, and SHALL set no width limit in the `theater` and `fullscreen` layouts. The limit SHALL be in the cascade layer `opentesela`, so a mod's own style overrides it.

#### Scenario: Wide stage area
- **WHEN** theater mode is off and a mod that adds no styles runs in a 2560×1080 viewport
- **THEN** its `<body>`'s width is the value of `--ot-content-width`, and the space left of it and the space right of it differ by at most 1 pixel

#### Scenario: Narrow stage area
- **WHEN** theater mode is off and a mod that adds no styles runs in a 1024×768 viewport
- **THEN** its `<body>`'s width is its frame's inner width

#### Scenario: Theater fills the frame
- **WHEN** theater mode is on and a mod that adds no styles runs in a 2560×1080 viewport
- **THEN** its `<body>`'s width is its frame's inner width

#### Scenario: Mod keeps the full width
- **WHEN** theater mode is off and a mod that adds the style `body { max-width: none; }` runs in a 2560×1080 viewport
- **THEN** its `<body>`'s width is its frame's inner width

#### Scenario: Opted-out mod has no limit
- **WHEN** theater mode is off and a mod with `theme: "none"` runs in a 2560×1080 viewport
- **THEN** its `<body>` is not limited to `--ot-content-width`

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
