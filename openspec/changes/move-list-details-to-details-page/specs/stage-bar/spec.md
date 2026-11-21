# Spec Delta

## MODIFIED Requirements

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the mod's name, in the mod capsule of a combination sandbox. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name, even when the sandbox failed later. The mod capsule SHALL NOT show the version, which the mod list's details page shows (see "Details page" in `combination-pickers`).

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows "Mod not loaded" and no version

#### Scenario: Missing collection
- **WHEN** a mod is opened with a collection that answers HTTP 404
- **THEN** the mod capsule shows the mod's name and no version

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the mod capsule shows the mod's name and no version

### Requirement: Combination capsules
A combination sandbox's title SHALL be three capsules, in order: the mod capsule, a `+`, the collection capsule, an arrow, and the mosaic capsule. Each SHALL have an icon of its kind, its title and a chevron, and SHALL open its list (see `combination-pickers`). The `+` and the arrow SHALL be hidden from assistive technologies. Each capsule's accessible name SHALL be its kind and its full title, as the capsule shows it, such as "Mod: Country Map".

#### Scenario: Laureates on the map
- **WHEN** the mosaic "Nobel laureates on the map" runs
- **THEN** the capsules show `Country Map`, `Nobel Prize in Literature laureates` and `Nobel laureates on the map`, and no version
- **AND** the collection capsule's accessible name is "Collection: Nobel Prize in Literature laureates"
- **AND** the mod capsule's accessible name is "Mod: Country Map"

#### Scenario: Tooltip of a cut title
- **WHEN** the mod capsule's title of "Nobel laureates on the map" is cut with an ellipsis and the pointer rests on it
- **THEN** its tooltip says "Mod: Country Map", with no version

### Requirement: Capsule contents
The mod capsule SHALL show the mod's title, without its version. The collection capsule SHALL show the collection's title once its file is loaded, "Loading collection…" before, "Collection not loaded" after a failure, the decoded file name of the tile for a tile link, or "None". The mosaic capsule SHALL show the mosaic's title, or, for a sandbox not opened from a mosaic, "Unsaved combination" with a dashed border. A sandbox shown with a plain title (see "Combination sandboxes") SHALL keep the mod's name and version in that title.

#### Scenario: Unsaved combination
- **WHEN** a run link opens Book List with the laureates' collection
- **THEN** the mosaic capsule says "Unsaved combination" and has a dashed border

#### Scenario: Missing collection file
- **WHEN** a run link names a collection that answers HTTP 404
- **THEN** the collection capsule shows "Collection not loaded"

#### Scenario: Wide bar
- **WHEN** "Nobel laureates on the map" runs on a 2560×1080 viewport
- **THEN** the mod capsule shows `Country Map` and no version

#### Scenario: Plain title keeps its version
- **WHEN** the mod viewer runs from a run link without a collection
- **THEN** the stage bar shows the mod viewer's title and its version

### Requirement: The bar folds as it narrows
The stage bar SHALL be narrow when it is under 480px wide, or when its capsules, at their minimum width, do not fit beside the bar's other items; otherwise it SHALL be wide. A bar that is narrow because its capsules did not fit SHALL become wide again once they fit. The left side SHALL follow the stage bar's width:
- at least 720px: everything shown;
- 480px to 719px: the mod and collection capsules show only their icons;
- on a narrow bar: one capsule with the mosaic's title, or the mod's for an unsaved combination, whose menu has "Mosaic", "Mod" and "Collection" rows that open their lists.

No capsule SHALL be narrower than its padding, its icon, its chevron and the gaps between them, so its icons always stay inside it. The right side SHALL fold on a narrow bar as "One-row stage bar" says. A change of width while the bar stays wide, or stays narrow, SHALL NOT move any item of the bar's right side.

#### Scenario: Narrow bar
- **WHEN** the stage bar of "Nobel laureates on the map" is 600px wide
- **THEN** the mod and collection capsules show only their icons, with their full titles in their accessible names, and the mosaic capsule shows its title

#### Scenario: Titles from 720px
- **WHEN** the stage bar of "Nobel laureates on the map" is 800px wide
- **THEN** the three capsules show their titles

#### Scenario: Phone width
- **WHEN** the stage bar is 400px wide
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and its menu's "Collection" row opens the collection list

#### Scenario: Capsules never break
- **WHEN** the stage bar of "Nobel laureates on the map" is 575px wide, as on a landscape phone with the sidebar expanded, where its capsules have to shrink
- **THEN** every capsule's icon and chevron are inside the capsule's box, and every item of the stage bar is inside the bar

#### Scenario: Folds when the capsules do not fit
- **WHEN** the stage bar of "Nobel laureates on the map" is at least 480px wide but too narrow for its capsules at their minimum width
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and the right side holds the messages button
- **AND** once the bar is wide enough for the capsules, it shows the mod, collection and mosaic capsules and the errors, warnings and notifications buttons again

#### Scenario: The title is readable on a phone
- **WHEN** "Nobel laureates on the map" runs on a 360×740 viewport
- **THEN** its capsule is at least 120px wide and shows the start of the mosaic's title
