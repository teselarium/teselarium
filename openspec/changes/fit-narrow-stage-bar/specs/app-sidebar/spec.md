# Spec Delta

## ADDED Requirements

### Requirement: The sidebar steps aside for the stage bar
On a viewport at least 768px wide, when the sidebar is expanded and the stage bar asks for room (see "Room before the capsules fold" in `stage-bar`), the sidebar SHALL show its icon rail, as when collapsed, without reloading any frame.

#### Scenario: Narrowing the window
- **WHEN** "Nobel laureates on the map" is visible with the sidebar expanded at 240px, and the window narrows from 1280px to 860px wide
- **THEN** the sidebar shows its icon rail, the mod's frame was not reloaded, and the stage bar shows the mod, collection and mosaic capsules, not the folded capsule

#### Scenario: Collapsed or hidden sidebar
- **WHEN** the sidebar is collapsed or hidden and the window narrows until the capsules do not fit
- **THEN** the sidebar keeps its state, and the stage bar folds its capsules

### Requirement: When the sidebar steps aside
It SHALL step aside only for the sandbox shown when the app opened, until the user opens another sandbox, and for the shown sandbox right after the window narrowed. A sidebar action by the user, a drag of its resize handle, or opening another sandbox SHALL NOT make it step aside.

#### Scenario: Opening another mosaic
- **WHEN** the app opened on a 900×800 viewport with the sidebar expanded and a mosaic whose capsules fit, and the user opens a mosaic whose capsules do not fit
- **THEN** the sidebar stays expanded, and the stage bar folds its capsules

#### Scenario: Opening the app on a narrower window
- **WHEN** the stored sidebar is expanded at 240px and a link to "Nobel laureates on the map" opens the app on an 860×800 viewport
- **THEN** the sidebar shows its icon rail and the stage bar shows the three capsules

### Requirement: Stepping aside is not stored
While the sidebar has stepped aside, the stored layout SHALL keep the expanded state and its width, so reloading the app page starts from them. The rail's button SHALL say it expands the sidebar, as for a collapsed one.

#### Scenario: Reload while stepped aside
- **WHEN** the sidebar stepped aside on an 860px wide window and the user reloads the app page on a 1280px wide window
- **THEN** the sidebar is expanded at 240px

### Requirement: The sidebar comes back
A sidebar that stepped aside SHALL be expanded again once the window has widened, since it stepped aside, by at least the room the rail gave: the expanded width minus the rail's width, so the stage bar is no narrower than it was beside the rail. Expanding it with its button, `Ctrl+B` or a drag of the handle SHALL expand it at once and end the step aside, and it SHALL NOT step aside again until the window narrows again.

#### Scenario: Not back too early
- **WHEN** the 240px sidebar stepped aside when the window narrowed to 860px, and the window widens to 900px
- **THEN** the sidebar still shows its icon rail

#### Scenario: Widening the window
- **WHEN** the sidebar stepped aside when the window narrowed to 860px, and the window widens to 1280px
- **THEN** the sidebar is expanded at 240px, and the stage bar shows the three capsules with their titles

#### Scenario: The user expands it
- **WHEN** the sidebar stepped aside on an 860px wide window and the user presses `Ctrl+B`
- **THEN** the sidebar is expanded and stays expanded, and the stage bar folds its capsules

#### Scenario: Narrow viewports are unchanged
- **WHEN** the sidebar stepped aside on an 860px wide window and the window narrows to 700px
- **THEN** the sidebar is collapsed, as on any viewport narrower than 768px, and widening the window back to 1280px expands it at 240px
