## MODIFIED Requirements

### Requirement: Layout attribute
The `<html>` element of every mod frame SHALL have the attribute `data-tes-layout` set to the frame's layout before the mod's `mount` is called. When the layout changes, the attribute SHALL be updated before the mod's `layout.changed` handlers are called. This SHALL hold also for mods that opt out of the theme styles.

#### Scenario: Attribute at mount
- **WHEN** theater mode is on and a mod reads `document.documentElement.dataset.tesLayout` inside `mount`
- **THEN** it reads `"theater"`

#### Scenario: Attribute before the handlers
- **WHEN** the user turns theater mode off and a mod's `layout.changed` handler reads the attribute
- **THEN** it reads `"contained"`

#### Scenario: Opted-out mod gets the attribute
- **WHEN** theater mode is on and a mod with `theme: "none"` is running
- **THEN** its `<html>` attribute `data-tes-layout` is `"theater"`

### Requirement: Content width in the contained layout
In the frame of a mod that does not opt out of the theme styles, the base stylesheet SHALL keep the `<body>` at most `--tes-content-width` wide and centered while the layout is `contained`, and SHALL set no width limit in the `theater` and `fullscreen` layouts. The limit SHALL be in the cascade layer `teselarium`, so a mod's own style overrides it.

#### Scenario: Wide stage area
- **WHEN** theater mode is off and a mod that adds no styles runs in a 2560×1080 viewport
- **THEN** its `<body>`'s width is the value of `--tes-content-width`, and the space left of it and the space right of it differ by at most 1 pixel

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
- **THEN** its `<body>` is not limited to `--tes-content-width`
