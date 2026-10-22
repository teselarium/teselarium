# Spec Delta

## ADDED Requirements

### Requirement: The visible frame fills the stage area
The visible sandbox's frame SHALL fill the stage area: the page's width, and the viewport height left under the app header and the stage bar, following the window's size. The frame's size SHALL NOT depend on the mod's content: content taller than the frame SHALL scroll inside the frame, not the page. The frame SHALL be at least 16rem tall; when less room is left, the page scrolls.

#### Scenario: Frame reaches the bottom of the viewport
- **WHEN** the sample book list mod runs in a 1280×800 viewport
- **THEN** the page does not scroll and the frame's bottom edge is within 24 pixels of the viewport's bottom edge

#### Scenario: Window resized
- **WHEN** the viewport is resized from 1280×800 to 1024×600 while the sample book list mod runs
- **THEN** the frame's bottom edge is within 24 pixels of the new viewport's bottom edge

#### Scenario: Tall content scrolls inside the frame
- **WHEN** a mod whose content is 3000 pixels tall runs in a 1280×800 viewport
- **THEN** the frame's height is the same as for the sample book list mod, the frame's document can scroll, and the page does not scroll

#### Scenario: Small viewport
- **WHEN** the sample book list mod runs in a 1280×300 viewport
- **THEN** the frame is 16rem tall and the page can scroll
