## ADDED Requirements

### Requirement: Pages keep clear of the hamburger chip
While the sidebar is hidden, a page's content SHALL NOT be drawn under the hamburger chip: the page area SHALL keep the chip's width and the gap after it free on its left. While the sidebar is expanded or collapsed, the page area SHALL start after the sidebar.

#### Scenario: Narrow page with a hidden sidebar
- **WHEN** the sidebar is hidden and the Home page is shown in a 600×800 viewport
- **THEN** the left edge of the page's content is right of the hamburger button's right edge

#### Scenario: Wide page with a hidden sidebar
- **WHEN** the sidebar is hidden and the Home page is shown in a 2560×1080 viewport
- **THEN** the page's content is as wide as the value of `--ot-reading-width`

### Requirement: Pages are drawn on the canvas
A page's content SHALL have no background of its own: the app's canvas (see `theme`) SHALL show behind it, edge to edge, in both color schemes. Elements inside the page that the base stylesheet gives a background, such as `<article>`, SHALL keep it.

#### Scenario: Light page on the canvas
- **WHEN** the color scheme is `light` and the Home page is shown in a 2560×1080 viewport
- **THEN** the page's content has a transparent computed background, and the color behind it and beside it is the light value of `--ot-card`

#### Scenario: Card in a light page
- **WHEN** the color scheme is `light` and a page holds an `<article>`
- **THEN** the article keeps its `--ot-border` border

## MODIFIED Requirements

### Requirement: Pages look like mods
A page's content SHALL be rendered in an isolated root that holds the theme tokens and the same base stylesheet as a mod frame. The app's own styles SHALL NOT apply inside it, and its styles SHALL NOT apply outside it. The page SHALL follow the color scheme without reloading.

#### Scenario: Same heading as a mod
- **WHEN** a page and a mod that adds no styles both show a level 1 heading
- **THEN** both headings have the same computed font size, font weight and color

#### Scenario: Card in a page
- **WHEN** a page holds an `<article>`
- **THEN** its computed background color is the value of `--ot-card` and its border color is the value of `--ot-border`

#### Scenario: Page styles stay inside
- **WHEN** a page with a table is shown
- **THEN** the sidebar's and its heading row's computed styles are the same as on a page without a table

#### Scenario: Dark page
- **WHEN** the Home page is shown and the color scheme changes from `light` to `dark`
- **THEN** the page's computed text color becomes the dark value of `--ot-foreground` without reloading the app page
