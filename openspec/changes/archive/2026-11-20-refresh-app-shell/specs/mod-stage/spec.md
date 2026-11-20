## MODIFIED Requirements

### Requirement: The visible frame fills the stage area
The visible sandbox's frame SHALL fill the stage area: the page's width left beside the sidebar, or the whole width when the sidebar is hidden, and the viewport height left under the stage bar, following the window's size and the sidebar's width. The frame's size SHALL NOT depend on the mod's content: content taller than the frame SHALL scroll inside the frame, not the page. The frame SHALL be at least 16rem tall; when less room is left, the page scrolls.

#### Scenario: Frame reaches the bottom of the viewport
- **WHEN** a mod runs in a 1280×800 viewport
- **THEN** the page does not scroll and the frame's bottom edge is within 24 pixels of the viewport's bottom edge

#### Scenario: Window resized
- **WHEN** the viewport is resized from 1280×800 to 1024×600 while a mod runs
- **THEN** the frame's bottom edge is within 24 pixels of the new viewport's bottom edge

#### Scenario: Hidden sidebar widens the frame
- **WHEN** a mod runs in a 1280×800 viewport with the sidebar collapsed, and the user hides the sidebar
- **THEN** the frame is wider than before, its left edge is within 24 pixels of the viewport's left edge, and it was not reloaded

#### Scenario: Tall content scrolls inside the frame
- **WHEN** a mod whose content is 3000 pixels tall runs in a 1280×800 viewport
- **THEN** the frame's height is the same as for a mod with short content, the frame's document can scroll, and the page does not scroll

#### Scenario: Small viewport
- **WHEN** a mod runs in a 1280×300 viewport
- **THEN** the frame is 16rem tall and the page can scroll

#### Scenario: Frame beside the sidebar
- **WHEN** a mod runs in a 1280×800 viewport with the sidebar expanded
- **THEN** the frame's left edge is right of the sidebar's right edge, and its right edge is within 24 pixels of the viewport's right edge
