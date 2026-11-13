## MODIFIED Requirements

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
