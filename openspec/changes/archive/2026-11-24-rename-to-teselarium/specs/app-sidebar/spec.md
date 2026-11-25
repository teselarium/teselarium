## MODIFIED Requirements

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
- **THEN** the open sidebar shows a hamburger button and the `Teselarium` heading, and that hamburger button is where the rail's was, within 1 pixel

#### Scenario: Escape closes the drawer
- **WHEN** the expanded sidebar is open over the content on a 375×700 viewport and the user presses Escape
- **THEN** the sidebar is collapsed

### Requirement: Sidebar heading row
The sidebar's first row SHALL hold the hamburger button and then the `Teselarium` level 1 heading. The app SHALL have no header above the sidebar and the main area. The heading SHALL be visible only while the sidebar is expanded, and SHALL stay the page's accessible heading in every state.

#### Scenario: No app header
- **WHEN** the vanilla app is opened on a 1280×800 viewport
- **THEN** the page has no `banner` landmark, and the sidebar's first row holds the hamburger button followed by the `Teselarium` heading

#### Scenario: Heading in the rail
- **WHEN** the sidebar is collapsed
- **THEN** the `Teselarium` text is not visible, and the page still has a level 1 heading named `Teselarium`
