# Spec Delta

## ADDED Requirements

### Requirement: Room before the capsules fold
When the stage bar is at least 480px wide and its capsules, at their minimum width, do not fit beside its other items, it SHALL ask the sidebar for room before it folds (see "The sidebar steps aside for the stage bar" in `app-sidebar`). The bar SHALL fold its capsules only when they still do not fit once the sidebar has answered, so the user never sees the folded capsule before the wider bar.

#### Scenario: Room is made
- **WHEN** "Nobel laureates on the map" is visible with the sidebar expanded at 240px, and the window narrows from 1280px to 860px wide
- **THEN** the stage bar shows the mod, collection and mosaic capsules, and the folded capsule was never shown while the window narrowed

#### Scenario: No room to make
- **WHEN** the sidebar is hidden and the stage bar is too narrow for the capsules at their minimum width
- **THEN** the stage bar folds its capsules, as "The bar folds as it narrows" says
