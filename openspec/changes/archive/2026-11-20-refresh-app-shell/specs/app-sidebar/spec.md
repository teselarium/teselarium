## ADDED Requirements

### Requirement: Sidebar heading row
The sidebar's first row SHALL hold the hamburger button and then the `OpenTesela` level 1 heading. The app SHALL have no header above the sidebar and the main area. The heading SHALL be visible only while the sidebar is expanded, and SHALL stay the page's accessible heading in every state.

#### Scenario: No app header
- **WHEN** the vanilla app is opened on a 1280×800 viewport
- **THEN** the page has no `banner` landmark, and the sidebar's first row holds the hamburger button followed by the `OpenTesela` heading

#### Scenario: Heading in the rail
- **WHEN** the sidebar is collapsed
- **THEN** the `OpenTesela` text is not visible, and the page still has a level 1 heading named `OpenTesela`

### Requirement: Sidebar buttons keep their place
The hamburger button, every section item's icon, the theme control and the collapse toggle SHALL each keep the same horizontal position when the sidebar changes between expanded and collapsed, and the hamburger button SHALL also keep its position when the sidebar is hidden or shown again. In the expanded sidebar, labels SHALL be shown to the right of the icons.

#### Scenario: Collapse does not move the icons
- **WHEN** the sidebar is expanded on a 1280×800 viewport and the user collapses it
- **THEN** the hamburger button's, the Mods icon's, the theme control's and the collapse toggle's left edges are where they were before, within 1 pixel

#### Scenario: Hiding does not move the hamburger
- **WHEN** the sidebar is expanded and the user presses the hamburger button
- **THEN** the hamburger button's bounding box is where it was before, within 1 pixel

### Requirement: Theme control in the sidebar
The sidebar SHALL show the theme control (see `theme`) after the `footer` items. It SHALL be a button, not a section item: it SHALL never be marked as the current item. Its icon SHALL show the current choice: a sun and moon for System, a sun for Light, a moon for Dark. Expanded, it SHALL show the label `Theme`. In every state a tooltip SHALL name it and the current choice, and each change SHALL be announced to assistive technologies.

#### Scenario: Below About
- **WHEN** the vanilla sidebar is expanded
- **THEN** the item after About is a button whose accessible name says `Theme` and the current choice

#### Scenario: Tooltip in the rail
- **WHEN** the sidebar is collapsed, the choice is Dark and the pointer rests on the theme control
- **THEN** a tooltip with the text `Theme: Dark` is shown

#### Scenario: Tooltip when expanded
- **WHEN** the sidebar is expanded, the choice is Light and the pointer rests on the theme control
- **THEN** a tooltip with the text `Theme: Light` is shown

### Requirement: Catalog kind icons
The Tiles, Mods and Mosaics items SHALL each show the icon of their catalog kind, the same one the stage bar and its lists show (see `stage-bar` and `combination-pickers`): loose shapes for collections, a dashed square with an arrow entering it towards its bottom right for mods, and a tile holding arranged shapes for mosaics. The collection and mod icons SHALL be drawn with lines in the item's text color; the mosaic icon has its own colors (below). All three SHALL be the size of the other icons.

#### Scenario: Same icon in the sidebar and the stage bar
- **WHEN** a combination sandbox is visible
- **THEN** the mod capsule's icon has the same drawing as the Mods item's icon, the collection capsule's as the Tiles item's, and the mosaic capsule's as the Mosaics item's

#### Scenario: Icons follow the text color
- **WHEN** the color scheme changes from `light` to `dark`
- **THEN** the Mods item's icon is drawn in the dark value of the item's text color

### Requirement: Colored mosaic icon
The mosaic icon SHALL be a tile outlined in the item's text color at a quarter of its opacity and filled with it at a tenth, holding four filled shapes in the theme's primary, secondary, destructive and warning colors, made more saturated. Where it sits on the accent background in the dark color scheme, its shapes SHALL be darkened towards the accent's text color, so they keep their contrast.

#### Scenario: Mosaic icon follows the color scheme
- **WHEN** the color scheme changes from `light` to `dark`
- **THEN** the Mosaics item's shapes are drawn from the dark values of their theme colors

#### Scenario: Mosaic icon on the current item
- **WHEN** the color scheme is `dark` and the Mosaics item is the current one
- **THEN** its shapes are darker than on a Mosaics item that is not current

## MODIFIED Requirements

### Requirement: Vanilla sections
The vanilla registry SHALL hold, in the `main` group and in this order: Home (a page, always shown), Tiles (the mod link `collection_explorer`, optional), Mods (the mod link `mod_explorer`, optional), Mosaics (the mod link `mosaic_explorer`, optional) and Guides (a page, optional); and in the `footer` group: Settings (a page, always shown) and About (a page, always shown). The `footer` group SHALL be shown right after the `main` group, with a divider between them.

#### Scenario: Vanilla sidebar
- **WHEN** the vanilla app is opened for the first time on a 1280×800 viewport
- **THEN** the sidebar's navigation lists Home, Tiles, Mods, Mosaics and Guides, then Settings and About below them

#### Scenario: Footer follows the main group
- **WHEN** the vanilla sidebar is shown on a 1280×1200 viewport
- **THEN** a divider is between Guides and Settings, and the space between Guides' item and Settings' item is less than twice the height of an item

#### Scenario: Tiles opens the collection explorer
- **WHEN** the user clicks the Tiles item in the vanilla sidebar
- **THEN** the collection explorer is the visible mod, the address is `#/run?mod=collection_explorer` and the Tiles item is the current one

#### Scenario: Mosaics opens the mosaic explorer
- **WHEN** the user clicks the Mosaics item in the vanilla sidebar
- **THEN** the mosaic explorer is the visible mod, the address is `#/run?mod=mosaic_explorer` and the Mosaics item is the current one

### Requirement: Sidebar states
The sidebar SHALL be expanded, collapsed or hidden. Its first row SHALL have a hamburger button at its left that is always visible. It SHALL hide the sidebar from either other state, and SHALL show it again in the state it was in before. The hidden sidebar SHALL shrink to a chip that holds only the hamburger button, in the same place. The expanded sidebar SHALL have a button that collapses it, and the collapsed sidebar a button that expands it. Changing the state SHALL NOT reload any frame.

#### Scenario: Hide and restore
- **WHEN** the sidebar is collapsed and the user presses the hamburger button twice
- **THEN** after the first press no sidebar item is visible and the hamburger button is visible, and after the second press the sidebar is collapsed again

#### Scenario: Hamburger state
- **WHEN** the sidebar is hidden
- **THEN** the hamburger button has `aria-expanded="false"` and the accessible name `Show sidebar`

#### Scenario: Hidden sidebar leaves the width to the frame
- **WHEN** a mod is visible on a 1280×800 viewport and the user hides the sidebar
- **THEN** the mod's frame was not reloaded, and its left edge is left of the hamburger button's right edge

#### Scenario: Collapse keeps mods running
- **WHEN** a mod is visible and the user collapses the sidebar
- **THEN** the mod's frame was not reloaded and is wider than before

### Requirement: Narrow viewports
On viewports narrower than 768px, the sidebar SHALL start collapsed whatever is stored, and SHALL have no resize handle. Expanding it SHALL open it over the content with a backdrop, without changing the visible frame's size. The open sidebar SHALL start with the same first row, its hamburger button where the rail's is. Choosing a section, activating the backdrop or pressing Escape SHALL collapse it again. Nothing done on a narrow viewport SHALL be stored.

#### Scenario: Starts collapsed
- **WHEN** the stored layout is expanded and the app is opened on a 375×700 viewport
- **THEN** the sidebar is collapsed and has no resize handle

#### Scenario: Expand over the content
- **WHEN** the user expands the sidebar on a 375×700 viewport while a mod is visible
- **THEN** the sidebar's labels are shown over the mod's frame, and the frame's width is unchanged

#### Scenario: Open sidebar keeps the first row
- **WHEN** the user expands the sidebar on a 375×700 viewport
- **THEN** the open sidebar shows a hamburger button and the `OpenTesela` heading, and that hamburger button is where the rail's was, within 1 pixel

#### Scenario: Escape closes the drawer
- **WHEN** the expanded sidebar is open over the content on a 375×700 viewport and the user presses Escape
- **THEN** the sidebar is collapsed
