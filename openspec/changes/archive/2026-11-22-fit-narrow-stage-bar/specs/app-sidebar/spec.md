# Spec Delta

## MODIFIED Requirements

### Requirement: Resize the sidebar
On viewports at least 768px wide, the expanded sidebar SHALL have a resize handle on its right edge. Dragging it SHALL set the width between 200px and the smaller of 400px and the viewport's width minus 784px, so the main area keeps at least 784px beside it. Dragging it narrower than 160px SHALL collapse the sidebar at once, without waiting for the release. The handle SHALL be a focusable separator whose arrow keys change the width by 16px. The visible frame SHALL follow the width without reloading.

#### Scenario: Drag wider
- **WHEN** the expanded sidebar is 240px wide on a 1280×800 viewport and the user drags its handle 100px to the right
- **THEN** the sidebar is 340px wide and the visible mod's frame is 100px narrower and was not reloaded

#### Scenario: Width is clamped
- **WHEN** the user drags the handle to 600px on a 1280×800 viewport
- **THEN** the sidebar is 400px wide

#### Scenario: The main area keeps 784px
- **WHEN** the stored sidebar is expanded at 400px and the app is opened on a 1100×800 viewport
- **THEN** the sidebar is 316px wide, and widening the viewport to 1280px makes it 400px wide

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

### Requirement: Sidebar layout is remembered
On viewports at least 984px wide, the sidebar's state (expanded, collapsed or hidden), the state hidden came from, and its width SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A missing or invalid stored value SHALL give an expanded sidebar of 240px. When the storage cannot be read or written, the layout SHALL still apply until the page is closed.

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

## ADDED Requirements

### Requirement: Compact viewports
On viewports from 768px to 983px wide, where a 200px sidebar would leave the main area less than 784px, a sidebar stored as expanded SHALL show its icon rail, as when collapsed, without reloading any frame. A sidebar stored as collapsed or hidden SHALL keep its state. Widening the viewport to at least 984px SHALL restore the stored layout, and narrowing it under 768px SHALL apply the narrow viewports' rules.

#### Scenario: Narrowing the window
- **WHEN** "Nobel laureates on the map" is visible with the sidebar expanded at 240px, and the window narrows from 1280px to 860px wide
- **THEN** the sidebar shows its icon rail, the mod's frame was not reloaded, the stage bar shows the mod, collection and mosaic capsules, and its folded capsule was never shown while the window narrowed

#### Scenario: Widening the window from a narrow viewport
- **WHEN** the stored sidebar is expanded at 240px, "Nobel laureates on the map" is visible on a 767px wide window, and the window widens to 1024px
- **THEN** the sidebar is never expanded while the window is narrower than 984px, it is expanded at 984px, and it is 240px wide at 1024px

#### Scenario: Opening the app on a compact viewport
- **WHEN** the stored sidebar is expanded at 240px and a link to "Nobel laureates on the map" opens the app on an 860×800 viewport
- **THEN** the sidebar shows its icon rail and the stage bar shows the three capsules

#### Scenario: Collapsed or hidden sidebar
- **WHEN** the stored sidebar is collapsed or hidden and the window narrows from 1280px to 860px
- **THEN** the sidebar keeps its state

#### Scenario: Phone viewport
- **WHEN** the stored sidebar is expanded and the app is opened on a 360×740 viewport
- **THEN** the narrow viewports' rules apply: the sidebar is collapsed, has no resize handle, and expanding it opens it over the content

### Requirement: Expanding on a compact viewport
On a compact viewport, the user SHALL still be able to expand the sidebar inline, 200px wide, with its button, `Ctrl+B` or its handle, without reloading any frame. Nothing done on a compact viewport SHALL be stored.

#### Scenario: The user expands it
- **WHEN** the sidebar shows its rail on an 860×800 viewport and the user presses `Ctrl+B`
- **THEN** the sidebar is expanded inline at 200px, the visible frame was not reloaded, and reloading the app page shows the rail again
