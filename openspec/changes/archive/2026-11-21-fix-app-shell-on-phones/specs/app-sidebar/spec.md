# Spec Delta

## ADDED Requirements

### Requirement: Sidebar tooltips need a pointer that can hover
The sidebar's tooltips (its items' labels in the rail, the theme control's choice) SHALL open only on a device whose primary pointer can hover. On a device that cannot, tapping an item or the theme control SHALL NOT leave a tooltip on screen. Each tooltip's text SHALL also be in its element's accessible name.

#### Scenario: Tap a rail icon on a phone
- **WHEN** on a touch-only phone, with the sidebar collapsed, the user taps the Mods icon
- **THEN** the Mods section is shown and no tooltip is shown

#### Scenario: Tooltip on a desktop
- **WHEN** on a desktop, with the sidebar collapsed, the pointer rests on the Guides icon
- **THEN** a tooltip with the text `Guides` is shown

### Requirement: Sidebar fits short viewports
When the sidebar is taller than the space it has, its section items and the theme control SHALL scroll inside it, while its first row (the hamburger button and the heading) and the button that collapses or expands it stay visible and usable. This SHALL hold in the expanded and collapsed states.

#### Scenario: Landscape phone
- **WHEN** the sidebar is expanded on a 915×412 viewport
- **THEN** the "Collapse sidebar" button is fully inside the viewport, and pressing it collapses the sidebar
- **AND** scrolling the sidebar's items brings the theme control into view

#### Scenario: Tall viewport does not scroll
- **WHEN** the sidebar is expanded on a 1280×800 viewport
- **THEN** the sidebar's items cannot scroll

### Requirement: Drawer has no extra close button
The sidebar opened over the content on a narrow viewport SHALL have no close button of its own. Its hamburger button (see "Sidebar states"), its backdrop and the Escape key (see "Narrow viewports") SHALL close it.

#### Scenario: Only the hamburger button
- **WHEN** the user expands the sidebar on a 375×700 viewport
- **THEN** the open sidebar has no button named "Close", and pressing its hamburger button closes the drawer
