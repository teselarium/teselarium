## ADDED Requirements

### Requirement: Stage bar beside the hamburger chip
While the sidebar is hidden, the stage bar SHALL start after the hamburger chip and a gap, so the chip never covers it. The stage bar and the sidebar's first row SHALL share the same top edge and height in every sidebar state, so the hamburger button and the stage bar are one row. The frame under the stage bar SHALL keep the full width left of the chip.

#### Scenario: Bar after the chip
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is hidden
- **THEN** the stage bar's left edge is right of the hamburger button's right edge, and the mod's frame's left edge is left of the hamburger button's right edge

#### Scenario: One row with the sidebar's heading row
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is expanded
- **THEN** the stage bar's top edge and height are those of the sidebar's first row, within 1 pixel

#### Scenario: Folding follows the space left
- **WHEN** the sidebar is hidden and the stage bar of "Nobel laureates on the map" is 600px wide after the chip
- **THEN** the mod and collection capsules show only their icons
