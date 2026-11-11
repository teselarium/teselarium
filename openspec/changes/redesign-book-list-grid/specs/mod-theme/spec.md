# Spec Delta

## MODIFIED Requirements

### Requirement: Base stylesheet by default
The frame of a mod that does not opt out SHALL have the theme tokens and a base stylesheet before the mod runs. The base stylesheet SHALL style plain HTML elements, without classes, from the tokens of the frame's color scheme: the page, text, headings, links, buttons, form fields, lists, tables, images, code, `<dialog>`, focus rings, pressed buttons (`aria-pressed="true"`) and current items (`aria-current` with any value other than `"false"`).

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

#### Scenario: Current item
- **WHEN** a mod that adds no styles shows a `<button aria-current="true">`, an `<a aria-current="page">` and a `<button aria-current="false">`
- **THEN** the computed outline color of the first button and of the link is the value of `--ot-primary`
- **AND** the button with `aria-current="false"` has no outline

#### Scenario: Current item keeps its outline when focused
- **WHEN** a mod that adds no styles shows a `<button aria-current="true">` and the button has keyboard focus
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

### Requirement: Sample and default mods follow the theme
The sample mod `book_list` and the default mods `mod_explorer` and `mod_viewer` SHALL take their colors and fonts from the theme, and SHALL only add styles for what the base stylesheet does not cover: layout and, in the sample mod only, the corner shape of its books, taken from `--ot-radius`.

#### Scenario: Dark sample mod
- **WHEN** the color scheme is `dark` and the sample book list mod runs with the sample collection
- **THEN** the computed background color of its frame's `<body>` is the dark value of `--ot-background`

#### Scenario: Selection uses the accent
- **WHEN** the user opens and closes the card of "Kallocain" in the sample book list mod
- **THEN** Kallocain's button has the computed outline color of `--ot-primary`

#### Scenario: Sample mod's own styles
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the rules of its own styles set no background, color, font or shadow property, and no border property other than corner radii

#### Scenario: Dark default mods
- **WHEN** the color scheme is `dark` and the mod explorer and the mod viewer are opened
- **THEN** the computed background color of each frame's `<body>` is the dark value of `--ot-background`
