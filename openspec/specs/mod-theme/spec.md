# mod-theme Specification

## Purpose

Gives every running mod the app's theme: the color scheme and the resolved tokens in its mount context, a `theme.changed` event, and, unless the mod opts out, the tokens and a classless base stylesheet in its frame that its own CSS always overrides, so a mod looks right in light and dark with no extra work.

## Requirements

### Requirement: Theme in the mount context
The mount context SHALL have `theme` with `colorScheme` (`"light"` or `"dark"`) and `tokens`, a mapping from each theme token name to its value for that color scheme. The theme SHALL be the one current when the mod's frame connects, not when the mod started loading.

#### Scenario: Dark mount context
- **WHEN** the color scheme is `dark` and the sample book list mod is opened
- **THEN** the context's `theme.colorScheme` is `"dark"` and `theme.tokens["--ot-background"]` is the dark value of `--ot-background`

#### Scenario: Color scheme changed while the mod loads
- **WHEN** a mod is opened while the color scheme is `light`, and the color scheme changes to `dark` before the mod's frame connects
- **THEN** the context's `theme.colorScheme` is `"dark"`

#### Scenario: Structured clone of the theme
- **WHEN** the mount context of the sample book list mod is built and a structured clone of its `theme` is made
- **THEN** the clone deep-equals the context's `theme`

### Requirement: Theme changed event
When the resolved color scheme changes, the engine SHALL push `theme.changed` with `{ colorScheme, tokens }` to every running mod, visible or hidden, once per change. A new theme choice that resolves to the same color scheme SHALL push nothing.

#### Scenario: Visible and hidden mods are told
- **WHEN** the mod explorer opened the mod viewer, so the explorer's sandbox is hidden, and the color scheme changes from `light` to `dark`
- **THEN** the `theme.changed` handlers of both mods receive `colorScheme` `"dark"` once

#### Scenario: Same color scheme, no event
- **WHEN** the operating system prefers dark, the choice is System, and the user chooses Dark
- **THEN** no running mod receives `theme.changed`

### Requirement: Color scheme attribute
The `<html>` element of every mod frame SHALL have the attribute `data-ot-color-scheme` set to the current color scheme before the mod's `mount` is called. On `theme.changed`, the attribute SHALL be updated before the mod's handlers are called. This SHALL hold also for mods that opt out of the theme styles.

#### Scenario: Attribute at mount
- **WHEN** the color scheme is `dark` and a mod reads `document.documentElement.dataset.otColorScheme` inside `mount`
- **THEN** it reads `"dark"`

#### Scenario: Attribute before the handlers
- **WHEN** the color scheme changes to `light` and a mod's `theme.changed` handler reads the attribute
- **THEN** it reads `"light"`

### Requirement: Base stylesheet by default
The frame of a mod that does not opt out SHALL have the theme tokens and a base stylesheet before the mod runs. The base stylesheet SHALL style plain HTML elements, without classes, from the tokens of the frame's color scheme: the page, text, headings, links, buttons, form fields, lists, tables, images, code, `<dialog>`, focus rings and pressed buttons (`aria-pressed="true"`).

#### Scenario: Page follows the color scheme
- **WHEN** the color scheme is `dark` and a mod that adds no styles is running
- **THEN** the computed background color of its frame's `<body>` is the dark value of `--ot-background` and its computed text color is the dark value of `--ot-foreground`

#### Scenario: Colors switch without a reload
- **WHEN** the color scheme changes from `dark` to `light` while that mod is running
- **THEN** the computed background color of its `<body>` becomes the light value of `--ot-background`
- **AND** the frame was not reloaded

#### Scenario: Pressed button
- **WHEN** a mod that adds no styles shows a `<button aria-pressed="true">`
- **THEN** the button's computed outline color is the value of `--ot-primary`

#### Scenario: Tokens are readable as CSS variables
- **WHEN** a mod that adds no styles sets an element's color to `var(--ot-primary)`
- **THEN** the element's computed color is the value of `--ot-primary` for the current color scheme

#### Scenario: Token values readable from JavaScript
- **WHEN** the color scheme is `dark` and a mod that adds no styles reads `getComputedStyle(document.documentElement).getPropertyValue("--ot-primary")`
- **THEN** the trimmed result is the dark value of `--ot-primary`

#### Scenario: Old token names are not defined
- **WHEN** a mod that adds no styles reads `--ot-color-accent` from its frame's `<html>` computed style
- **THEN** it gets an empty string

### Requirement: Color scheme sections
An element in the frame of a mod that does not opt out, whose `data-ot-color-scheme` attribute is `"light"` or `"dark"`, SHALL use that color scheme's tokens for itself and its contents, whatever the frame's color scheme, and SHALL get that color scheme's background and text colors from the base stylesheet.

#### Scenario: Dark section in a light frame
- **WHEN** the color scheme is `light` and a mod shows a `<section data-ot-color-scheme="dark">` holding a paragraph whose color is `var(--ot-foreground)`
- **THEN** the section's computed background color is the dark value of `--ot-background` and the paragraph's computed color is the dark value of `--ot-foreground`

#### Scenario: Section keeps its color scheme
- **WHEN** a mod shows a `<section data-ot-color-scheme="light">` and the color scheme changes from `light` to `dark`
- **THEN** the section's computed background color is still the light value of `--ot-background`

### Requirement: Mod styles override the base stylesheet
The tokens and the base stylesheet SHALL be in the cascade layer `opentesela`, so any style a mod adds outside a layer SHALL take precedence over them whatever its specificity, including a new value for a token.

#### Scenario: Mod rule wins
- **WHEN** a mod adds the style `button { color: rgb(0, 0, 255); }`
- **THEN** its buttons' computed color is `rgb(0, 0, 255)`

#### Scenario: Mod overrides a token
- **WHEN** a mod adds the style `:root { --ot-primary: rgb(255, 0, 0); }` and shows a `<button aria-pressed="true">`
- **THEN** the button's computed outline color is `rgb(255, 0, 0)`

### Requirement: Opt out of the theme styles
The frame of a mod whose file sets `theme: "none"` SHALL have neither the theme tokens nor the base stylesheet. The mod SHALL still receive `theme` in its mount context, the `theme.changed` event and the color scheme attribute.

#### Scenario: Blank frame
- **WHEN** a mod with `theme: "none"` is running
- **THEN** reading `--ot-primary` from its frame's `<html>` computed style gives an empty string, and its `<body>` has the browser's default margin

#### Scenario: Opted-out mod still gets the theme
- **WHEN** the color scheme changes to `dark` while a mod with `theme: "none"` is running
- **THEN** its `theme.changed` handlers receive `colorScheme` `"dark"` and its `<html>` attribute `data-ot-color-scheme` is `"dark"`

### Requirement: Default mods take the theme's look
The default mods `mod_explorer` and `mod_viewer` SHALL take their colors and fonts from the theme, and SHALL only add styles for layout, which the base stylesheet does not cover.

#### Scenario: Dark default mods
- **WHEN** the color scheme is `dark` and the mod explorer and the mod viewer are opened
- **THEN** the computed background color of each frame's `<body>` is the dark value of `--ot-background`

### Requirement: Semantic HTML looks like the app
The base stylesheet SHALL give semantic HTML the look of the app's matching components, without classes: a plain `<button>` is an outline button, `<button type="submit">` a primary button, `<article>` a card, `role="alert"` a destructive alert, `role="status"` an informational alert, a checkbox with `role="switch"` a switch, a field with `aria-invalid="true"` an invalid field, `<details>` an accordion, and `aria-busy="true"` a loading state.

#### Scenario: Buttons look like the app's buttons
- **WHEN** a mod that adds no styles shows a plain `<button>` and a `<button type="submit">`
- **THEN** the plain button's computed background color is the value of `--ot-background` and its border color is the value of `--ot-border`
- **AND** the submit button's computed background color is the value of `--ot-primary` and its text color is the value of `--ot-primary-foreground`

#### Scenario: Article is a card
- **WHEN** a mod that adds no styles shows an `<article>`
- **THEN** its computed background color is the value of `--ot-card`, its border color is the value of `--ot-border` and its border radius is the value of `--ot-radius`

#### Scenario: Alerts
- **WHEN** a mod that adds no styles shows a `<div role="alert">` and a `<div role="status">`, each holding text
- **THEN** the alert's computed border color and text color are the value of `--ot-destructive`
- **AND** the status's computed border color is the value of `--ot-border` and its text color is the value of `--ot-foreground`

#### Scenario: Switch
- **WHEN** a mod that adds no styles shows an `<input type="checkbox" role="switch">` that is checked
- **THEN** its computed `appearance` is `none` and its computed background color is the value of `--ot-primary`

#### Scenario: Invalid field
- **WHEN** a mod that adds no styles shows an `<input aria-invalid="true">`
- **THEN** its computed border color is the value of `--ot-destructive`

#### Scenario: A mod undoes a pattern
- **WHEN** a mod adds the style `article { background: none; border: none; }` and shows an `<article>`
- **THEN** the article's computed background color is transparent and its border width is `0px`

### Requirement: Variant attributes
The base stylesheet SHALL read the attribute `data-ot-variant` for app variants that have no semantic HTML. On a `<button>`, the values `primary`, `secondary`, `outline`, `ghost` and `destructive` SHALL give the app's button of that variant. A `<span>` with the attribute SHALL be a badge, with the values `primary`, `secondary`, `outline`, `destructive`, `success` and `warning`. Any other value SHALL leave the element's plain look.

#### Scenario: Destructive button
- **WHEN** a mod that adds no styles shows a `<button data-ot-variant="destructive">`
- **THEN** its computed background color is the value of `--ot-destructive`

#### Scenario: Primary button that does not submit
- **WHEN** a mod that adds no styles shows a `<button type="button" data-ot-variant="primary">`
- **THEN** its computed background color is the value of `--ot-primary` and its text color is the value of `--ot-primary-foreground`

#### Scenario: Outline submit button
- **WHEN** a mod that adds no styles shows a `<button type="submit" data-ot-variant="outline">`
- **THEN** its computed background color is the value of `--ot-background` and its border color is the value of `--ot-border`

#### Scenario: Success badge
- **WHEN** a mod that adds no styles shows a `<span data-ot-variant="success">granted</span>`
- **THEN** its computed text color is the value of `--ot-success`, its border color is the value of `--ot-success`, and its border radius is larger than `0px`

#### Scenario: Unknown variant
- **WHEN** a mod that adds no styles shows a `<button data-ot-variant="sparkly">` and a `<span data-ot-variant="sparkly">`
- **THEN** the button looks like a plain button and the span has no border and no background color

#### Scenario: Unprefixed attribute is ignored
- **WHEN** a mod that adds no styles shows a `<button data-variant="destructive">`
- **THEN** the button looks like a plain button
