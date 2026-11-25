# Spec Delta

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold the sandbox's title, as capsules for a combination sandbox (see "Combination capsules") or as a plain title otherwise, then the "More actions" button. Its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod capsule, the collection capsule, the mosaic capsule, the "More actions" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the mod viewer, which the catalog does not list, runs from a run link without a collection
- **THEN** the stage bar shows the mod's name and version as a plain title, then the "More actions" button, and its other items keep their order

#### Scenario: Close button last
- **WHEN** a mod opened from a run link runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

#### Scenario: Home mod without a close button
- **WHEN** a home mod is shown at `#/`
- **THEN** the fullscreen button is the stage bar's rightmost item, and no separator follows it

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the mod's name and version, in the mod capsule of a combination sandbox. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name and version, even when the sandbox failed later.

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows "Mod not loaded" and no version

#### Scenario: Missing collection
- **WHEN** a mod is opened with a collection that answers HTTP 404
- **THEN** the stage bar shows the mod's name and version

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the stage bar shows the mod's name and version

### Requirement: Popovers and menus close on a click outside
An open popover, menu or list of the stage bar SHALL close when the user clicks outside it, including inside the visible mod's frame. A click inside the mod's frame SHALL still reach the mod. When it closes because of a click in the mod's frame, the focus SHALL stay in the frame.

#### Scenario: Click in the mod's frame
- **WHEN** the notifications popover is open over a running mod and the user clicks inside the mod's frame
- **THEN** the popover closes and the mod receives the click

#### Scenario: Share menu
- **WHEN** the "More actions" menu, which now holds "Copy link", is open and the user clicks inside the mod's frame
- **THEN** the menu closes and the mod receives the click

#### Scenario: Mod list
- **WHEN** the mod list is open and the user clicks inside the mod's frame
- **THEN** the list closes and the mod receives the click

#### Scenario: The mod keeps the keyboard
- **WHEN** the notifications popover is open over a running mod and the user clicks inside the mod's frame
- **THEN** the popover closes and the focus stays in the mod's frame

### Requirement: Mosaic name while loading or after a failure
For a run link with a `mosaic`, until the mosaic file is loaded the stage bar SHALL show one capsule "Loading mosaic…" in place of the three capsules, and when the sandbox failed before the mosaic file was loaded, "Mosaic not loaded". Once the mosaic file is loaded, the mosaic capsule SHALL show the mosaic's title, and the mod and collection capsules follow their own rules.

#### Scenario: Missing mosaic file
- **WHEN** a run link names a mosaic file that answers HTTP 404
- **THEN** the stage bar shows "Mosaic not loaded" and no version

#### Scenario: Missing mod of a mosaic
- **WHEN** a mosaic names a mod folder whose mod file answers HTTP 404
- **THEN** the mosaic capsule shows the mosaic's title and the mod capsule shows "Mod not loaded"

## ADDED Requirements

### Requirement: Combination sandboxes
A combination sandbox SHALL be one opened from a mosaic, from a link with a collection or a tile, or from a link whose mod the catalog or recently used holds. Any other sandbox, such as an explorer or a viewer opened without a collection or tile, SHALL show its mod's name and version as a plain title, with no capsule and no list.

#### Scenario: Catalog mod without a collection
- **WHEN** the user chose "None" in the collection list of a Book List sandbox
- **THEN** the new sandbox is a combination sandbox, and its collection capsule shows "None"

#### Scenario: Mod viewer
- **WHEN** the mod viewer runs with a `target` and no collection
- **THEN** the stage bar shows the mod viewer's title and version plainly and has no capsule

### Requirement: Combination capsules
A combination sandbox's title SHALL be three capsules, in order: the mod capsule, a `+`, the collection capsule, an arrow, and the mosaic capsule. Each SHALL have an icon of its kind, its title and a chevron, and SHALL open its list (see `combination-pickers`). The `+` and the arrow SHALL be hidden from assistive technologies. Each capsule's accessible name SHALL be its kind and its full title, such as "Mod: Country Map 1.0.1".

#### Scenario: Laureates on the map
- **WHEN** the mosaic "Nobel laureates on the map" runs
- **THEN** the capsules show `Country Map` with `1.0.1`, `Nobel Prize in Literature laureates` and `Nobel laureates on the map`
- **AND** the collection capsule's accessible name is "Collection: Nobel Prize in Literature laureates"

### Requirement: Capsule contents
The mod capsule SHALL show the mod's title and version. The collection capsule SHALL show the collection's title once its file is loaded, "Loading collection…" before, "Collection not loaded" after a failure, the decoded file name of the tile for a tile link, or "None". The mosaic capsule SHALL show the mosaic's title, or, for a sandbox not opened from a mosaic, "Unsaved combination" with a dashed border.

#### Scenario: Unsaved combination
- **WHEN** a run link opens Book List with the laureates' collection
- **THEN** the mosaic capsule says "Unsaved combination" and has a dashed border

#### Scenario: Missing collection file
- **WHEN** a run link names a collection that answers HTTP 404
- **THEN** the collection capsule shows "Collection not loaded"

### Requirement: Sites chip
For a sandbox opened with `sites`, the stage bar SHALL show a chip after the mosaic capsule with a shield icon and the number of `show` lines of that mosaic, named "Sites from <mosaic title>". Pressing it SHALL open a popover that lists each line's host, reason and whether it was granted, and has a button "Stop using these sites" that opens the same combination without `sites`.

#### Scenario: Kept covers
- **WHEN** the user chose Flashcards in the mod list of "Books by Nobel laureates"
- **THEN** a chip named "Sites from Books by Nobel laureates" shows `4`, and its popover lists `https://covers.openlibrary.org` as granted

#### Scenario: Stop using them
- **WHEN** the user presses "Stop using these sites"
- **THEN** a sandbox runs Flashcards with the laureates' books from a run link with no `sites`, and the stage bar has no chip

### Requirement: More actions menu
The "More actions" button (`…`) SHALL open a menu that holds "Copy link" and, for a sandbox opened with a collection or a tile, "Reload tiles". "Copy link" SHALL copy the full address of the app with the sandbox's run link as its hash, close the menu, and show "Link copied" at the button for a moment, also announced to assistive technologies, or "Cannot copy the link" when the clipboard refuses.

#### Scenario: Copy the link
- **WHEN** the user opens the "More actions" menu of the app at `https://example.org/` and chooses "Copy link"
- **THEN** the clipboard holds `https://example.org/` followed by the sandbox's run link hash, the menu closes, and "Link copied" shows at the button

#### Scenario: Copy refused
- **WHEN** the user chooses "Copy link" and the clipboard refuses the text
- **THEN** "Cannot copy the link" shows at the button

#### Scenario: No collection
- **WHEN** the user opens the "More actions" menu of a sandbox without a collection or a tile
- **THEN** the menu holds "Copy link" and no "Reload tiles"

#### Scenario: Keyboard
- **WHEN** the user moves the focus to the "More actions" button and presses Enter
- **THEN** the menu opens with "Copy link" focused

### Requirement: Long titles
No capsule SHALL be wider than 16rem. A title that does not fit SHALL end with an ellipsis, and its capsule's tooltip SHALL give the full title. When the capsules do not fit, the collection capsule SHALL shrink first, then the mod capsule, then the mosaic capsule. For a sandbox not opened from a mosaic, the mosaic capsule SHALL shrink before the mod capsule.

#### Scenario: Long collection title
- **WHEN** the bar is too narrow for the three titles of "Nobel laureates on the map"
- **THEN** the collection capsule's title is cut with an ellipsis first, and hovering it shows the full title

### Requirement: The bar folds as it narrows
The left side SHALL follow the stage bar's width:
- at least 960px: everything shown;
- 720px to 959px: no version in the mod capsule, which moves to the mod list's details;
- 480px to 719px: the mod and collection capsules show only their icons;
- under 480px: one capsule with the mosaic's title, or the mod's for an unsaved combination, whose menu has "Mosaic", "Mod" and "Collection" rows that open their lists.

A change of width SHALL NOT move any item of the bar's right side.

#### Scenario: Narrow bar
- **WHEN** the stage bar of "Nobel laureates on the map" is 600px wide
- **THEN** the mod and collection capsules show only their icons, with their full titles in their accessible names, and the mosaic capsule shows its title

#### Scenario: Phone width
- **WHEN** the stage bar is 400px wide
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and its menu's "Collection" row opens the collection list

## REMOVED Requirements

### Requirement: Information popover
**Reason**: The information button is removed to make room for the capsules. What it showed moves to the lists' details footers (`combination-pickers`), next to the item it describes.
**Migration**: The mod's source is in the mod list's details, the collection's location in the collection list's, and the run link in the mosaic list's. "Copy link" is in the "More actions" menu.

### Requirement: Share menu
**Reason**: Its only item, "Copy link", moves into the "More actions" menu with "Reload tiles".
**Migration**: Use "More actions" → "Copy link" (see "More actions menu").

### Requirement: Mosaic title in the stage bar
**Reason**: The mosaic's title is now the mosaic capsule (see "Combination capsules").
**Migration**: None for users: the title is still shown, in its capsule.

### Requirement: Information popover of a mosaic
**Reason**: Removed with the information popover.
**Migration**: The mosaic file's address is in the mosaic list's details footer.
