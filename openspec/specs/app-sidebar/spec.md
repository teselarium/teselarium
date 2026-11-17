# app-sidebar Specification

## Purpose

Lets users move between the parts of the app from a left sidebar built from a section registry that instantiations can change: which sections exist, their icons and targets, which one is active, how switching between them keeps each section's place, and how the sidebar expands, collapses, hides and resizes.

## Requirements

### Requirement: Section registry
The sidebar SHALL be built from a section registry. Each section SHALL have an id, a label, an icon, a target (a page, or a mod link), a group (`main` or `footer`), whether it is optional, and whether it is coming soon. Ids SHALL match `[a-z][a-z0-9_-]*`, SHALL be unique, and SHALL NOT be `run`. When the registry breaks a rule, the app SHALL NOT start and SHALL report an error that names the section.

#### Scenario: Reserved id
- **WHEN** the app starts with a registry holding a section with the id `run`
- **THEN** the app does not render the sidebar or the stage, and reports an error that names the section `run` and says the id is reserved

#### Scenario: Duplicate id
- **WHEN** the app starts with a registry holding two sections with the id `guides`
- **THEN** the app reports an error that names `guides` as a duplicate

#### Scenario: Invalid id
- **WHEN** the app starts with a registry holding a section with the id `My Guides`
- **THEN** the app reports an error that names `My Guides` and the allowed pattern

### Requirement: Vanilla sections
The vanilla registry SHALL hold, in the `main` group and in this order: Home (a page, always shown), Tiles (the mod link `collection_explorer`, optional), Mods (the mod link `mod_explorer`, optional), Mosaics (the mod link `mosaic_explorer`, optional) and Guides (a page, optional); and in the `footer` group: Settings (a page, always shown) and About (a page, always shown). The `footer` group SHALL be shown at the bottom of the sidebar.

#### Scenario: Vanilla sidebar
- **WHEN** the vanilla app is opened for the first time on a 1280×800 viewport
- **THEN** the sidebar's navigation lists Home, Tiles, Mods, Mosaics and Guides, then Settings and About below them

#### Scenario: Tiles opens the collection explorer
- **WHEN** the user clicks the Tiles item in the vanilla sidebar
- **THEN** the collection explorer is the visible mod, the address is `#/run?mod=collection_explorer` and the Tiles item is the current one

#### Scenario: Mosaics opens the mosaic explorer
- **WHEN** the user clicks the Mosaics item in the vanilla sidebar
- **THEN** the mosaic explorer is the visible mod, the address is `#/run?mod=mosaic_explorer` and the Mosaics item is the current one

### Requirement: Section icons
Each sidebar item SHALL show its section's icon before its label. An icon SHALL be a lucide icon or an image. An image SHALL be drawn in the item's text color, following the color scheme, unless the section sets it not to be tinted, in which case it SHALL be drawn with its own colors. Icons SHALL be decorative: the item's accessible name SHALL be the label.

#### Scenario: Lucide icon
- **WHEN** the vanilla sidebar is shown
- **THEN** each item holds an icon element before its label, and the Mods item's accessible name is `Mods`

#### Scenario: Tinted image follows the color scheme
- **WHEN** a section's icon is a monochrome SVG image without the no-tint setting, and the color scheme changes from `light` to `dark`
- **THEN** the icon is drawn in the dark value of the item's text color

#### Scenario: Full-color image
- **WHEN** a section's icon is an image with the no-tint setting
- **THEN** the icon is an `<img>` showing the image's own colors

### Requirement: Sections of switched-off mods
A section whose target is a default mod that the instantiation switched off SHALL NOT be part of the app: it SHALL be shown neither in the sidebar nor on the Settings page.

#### Scenario: Explorer switched off
- **WHEN** `mod_explorer` is switched off in the default mod settings
- **THEN** the sidebar has no Mods item and the Settings page has no Mods switch

#### Scenario: Collection explorer switched off
- **WHEN** `collection_explorer` is switched off in the default mod settings
- **THEN** the sidebar has no Tiles item and the Settings page has no Tiles switch

#### Scenario: Mosaic explorer switched off
- **WHEN** `mosaic_explorer` is switched off in the default mod settings
- **THEN** the sidebar has no Mosaics item and the Settings page has no Mosaics switch

### Requirement: Section navigation
Activating a section's item SHALL add a history entry and show, in the state it was left in: the last sandbox or page seen in that section, when the user comes from another section and it is still open; otherwise the section's start. Activating the item of the section already shown SHALL show its start. A mod section's start SHALL be its root sandbox while it is open, or a new one. A page section's start SHALL be its index page. No frame SHALL be reloaded.

#### Scenario: Back where you left off
- **WHEN** the user opens Mods, selects a mod in the explorer so the mod viewer is shown, opens Home, and then opens Mods again
- **THEN** the mod viewer is visible in the state it was left in, and its frame was not reloaded

#### Scenario: Activating the current section returns to its start
- **WHEN** the mod viewer opened from the explorer is visible and the user activates Mods
- **THEN** the mod explorer that was opened from Mods is visible in the state it was left in

#### Scenario: One explorer for repeated visits
- **WHEN** the user opens Mods, Home, Mods, Home and Mods again
- **THEN** the page holds exactly one mod explorer frame

#### Scenario: Closed root opens a new one
- **WHEN** the user closes the mod explorer opened from Mods and then opens Mods again
- **THEN** a new mod explorer sandbox is visible

#### Scenario: Last page of a page section
- **WHEN** the user is on `#/guides/first_steps`, opens Home, and opens Guides again
- **THEN** the address is `#/guides/first_steps` and that page is shown

#### Scenario: Back after switching sections
- **WHEN** the user opens Mods, then Home, then Mods, and presses the browser's back button
- **THEN** the Home page is shown, and pressing back again shows the mod explorer

### Requirement: Active section
The item of the section that the shown page or sandbox belongs to SHALL be marked as the current one (`aria-current="page"`). A page belongs to its section. A sandbox SHALL belong to the section whose item opened it, or to its opener's section when a mod opened it, or, for a link typed or followed in the page, to the section whose mod link it exactly equals, or to none. The section SHALL be kept with the history entry and restored after a reload.

#### Scenario: Viewer keeps Mods active
- **WHEN** the mod explorer opened from Mods opens the mod viewer
- **THEN** the Mods item is the current one

#### Scenario: Kept after a reload
- **WHEN** the mod viewer opened from the explorer is visible and the app page is reloaded
- **THEN** the Mods item is the current one

#### Scenario: Link to another mod
- **WHEN** the app is opened at the run link of a mod
- **THEN** no sidebar item is the current one

#### Scenario: Typed link to a section's mod
- **WHEN** the app is opened at `#/run?mod=mod_explorer`
- **THEN** the Mods item is the current one

### Requirement: Sidebar states
The sidebar SHALL be expanded, collapsed or hidden. The header SHALL have a hamburger button at its left that is always visible. It SHALL hide the sidebar from either other state, and SHALL show it again in the state it was in before. The expanded sidebar SHALL have a button that collapses it, and the collapsed sidebar a button that expands it. Changing the state SHALL NOT reload any frame.

#### Scenario: Hide and restore
- **WHEN** the sidebar is collapsed and the user presses the hamburger button twice
- **THEN** after the first press no sidebar item is visible and the hamburger button is visible, and after the second press the sidebar is collapsed again

#### Scenario: Hamburger state
- **WHEN** the sidebar is hidden
- **THEN** the hamburger button has `aria-expanded="false"` and the accessible name `Show sidebar`

#### Scenario: Collapse keeps mods running
- **WHEN** a mod is visible and the user collapses the sidebar
- **THEN** the mod's frame was not reloaded and is wider than before

### Requirement: Collapsed icon rail
The collapsed sidebar SHALL show each item's icon only, in a rail wide enough for square icons. Hovering or focusing an item in the rail SHALL show a tooltip with the section's label.

#### Scenario: Tooltip on hover
- **WHEN** the sidebar is collapsed and the pointer rests on the Guides icon
- **THEN** a tooltip with the text `Guides` is shown

#### Scenario: Tooltip on focus
- **WHEN** the sidebar is collapsed and the Guides item receives keyboard focus
- **THEN** a tooltip with the text `Guides` is shown

### Requirement: Resize the sidebar
On viewports at least 768px wide, the expanded sidebar SHALL have a resize handle on its right edge. Dragging it SHALL set the width between 200px and the smaller of 400px and 40% of the viewport's width. Dragging it narrower than 160px SHALL collapse the sidebar at once, without waiting for the release. The handle SHALL be a focusable separator whose arrow keys change the width by 16px. The visible frame SHALL follow the width without reloading.

#### Scenario: Drag wider
- **WHEN** the expanded sidebar is 240px wide on a 1280×800 viewport and the user drags its handle 100px to the right
- **THEN** the sidebar is 340px wide and the visible mod's frame is 100px narrower and was not reloaded

#### Scenario: Width is clamped
- **WHEN** the user drags the handle to 600px on a 1280×800 viewport
- **THEN** the sidebar is 400px wide

#### Scenario: Drag to collapse
- **WHEN** the user drags the handle to 120px, still holding it
- **THEN** the sidebar is collapsed, and it stays collapsed once the handle is released

#### Scenario: Drag back before releasing
- **WHEN** the user drags the handle to 120px and, still holding it, back to 300px, and releases it
- **THEN** the sidebar is expanded and 300px wide

#### Scenario: Resize with the keyboard
- **WHEN** the handle has focus and the user presses the right arrow key
- **THEN** the sidebar is 16px wider and the handle's `aria-valuenow` says the new width

#### Scenario: Drag over a mod's frame
- **WHEN** the user drags the handle to the right across the visible mod's frame
- **THEN** the sidebar keeps following the pointer until it is released

### Requirement: Expand the rail by dragging
On viewports at least 768px wide, the collapsed sidebar SHALL have the same resize handle on the rail's right edge. Dragging it to 160px or wider SHALL expand the sidebar at once, which then follows the pointer as when resizing. Releasing it narrower than 160px SHALL leave the sidebar collapsed. The handle's right arrow key SHALL expand the sidebar.

#### Scenario: Drag to expand
- **WHEN** the sidebar is collapsed and the user drags its handle to 300px and releases it
- **THEN** the sidebar is expanded and 300px wide

#### Scenario: Short drag stays collapsed
- **WHEN** the sidebar is collapsed and the user drags its handle to 120px and releases it
- **THEN** the sidebar is collapsed

#### Scenario: Expand with the keyboard
- **WHEN** the sidebar is collapsed, its handle has focus and the user presses the right arrow key
- **THEN** the sidebar is expanded

### Requirement: Sidebar layout is remembered
On viewports at least 768px wide, the sidebar's state (expanded, collapsed or hidden), the state hidden came from, and its width SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A missing or invalid stored value SHALL give an expanded sidebar of 240px. When the storage cannot be read or written, the layout SHALL still apply until the page is closed.

#### Scenario: Collapsed after a reload
- **WHEN** the user collapses the sidebar and reloads the app page
- **THEN** the sidebar is collapsed

#### Scenario: Width after a reload
- **WHEN** the user resizes the sidebar to 320px and reloads the app page
- **THEN** the sidebar is 320px wide

#### Scenario: Invalid stored layout
- **WHEN** the stored sidebar layout is `"wide"`
- **THEN** the sidebar is expanded and 240px wide

#### Scenario: Mods cannot reach the layout
- **WHEN** the user collapsed the sidebar and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored sidebar layout

### Requirement: Narrow viewports
On viewports narrower than 768px, the sidebar SHALL start collapsed whatever is stored, and SHALL have no resize handle. Expanding it SHALL open it over the content with a backdrop, without changing the visible frame's size. Choosing a section, activating the backdrop or pressing Escape SHALL collapse it again. Nothing done on a narrow viewport SHALL be stored.

#### Scenario: Starts collapsed
- **WHEN** the stored layout is expanded and the app is opened on a 375×700 viewport
- **THEN** the sidebar is collapsed and has no resize handle

#### Scenario: Expand over the content
- **WHEN** the user expands the sidebar on a 375×700 viewport while a mod is visible
- **THEN** the sidebar's labels are shown over the mod's frame, and the frame's width is unchanged

#### Scenario: Escape closes the drawer
- **WHEN** the expanded sidebar is open over the content on a 375×700 viewport and the user presses Escape
- **THEN** the sidebar is collapsed

### Requirement: Keyboard shortcut
Pressing `Ctrl+B`, or `Cmd+B` on macOS, while the app's page has focus SHALL toggle the sidebar between expanded and collapsed, and SHALL show a hidden sidebar in the state it was in before.

#### Scenario: Toggle with the keyboard
- **WHEN** the sidebar is expanded, the app's page has focus and the user presses `Ctrl+B`
- **THEN** the sidebar is collapsed

### Requirement: Coming-soon sections are disabled
A coming-soon section SHALL be shown in the sidebar as a disabled item that says it is coming soon, and SHALL NOT navigate when activated. The vanilla registry SHALL have no coming-soon section.

#### Scenario: An instantiation's coming-soon section
- **WHEN** an instantiation's registry has an optional section `Example Section` marked as coming soon, and the user clicks its item
- **THEN** the item has `aria-disabled="true"`, its tooltip or label says `Coming soon`, and the visible page or sandbox does not change

#### Scenario: No coming-soon item in the vanilla app
- **WHEN** the vanilla sidebar is shown
- **THEN** no item says `Coming soon`
