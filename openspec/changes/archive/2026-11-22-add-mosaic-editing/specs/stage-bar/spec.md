# Spec Delta

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold the sandbox's title, as capsules for a combination sandbox (see "Combination capsules") or as a plain title otherwise, then the sites chip when the sandbox has one (see "Sites chip"), then the edit button when the sandbox has one (see "Edit button"), then the "More actions" button. On a wide bar (see "The bar folds as it narrows"), its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. On a narrow bar, its right side SHALL hold the messages button and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod capsule, the collection capsule, the mosaic capsule, the edit button, the "More actions" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
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

#### Scenario: Phone
- **WHEN** a mod opened from a run link runs on a 360×740 viewport
- **THEN** the stage bar's right side holds the messages button, a separator and the close button, in that order
- **AND** the page cannot scroll sideways and the close button is fully inside the viewport

### Requirement: More actions menu
The "More actions" button (`…`) SHALL open a menu that holds "Copy link" and, for a sandbox opened with a collection or a tile, "Reload tiles". On a stage bar under 288px wide, it SHALL also hold the edit button's action, when the sandbox has one (see "Edit button"). On a narrow stage bar (see "The bar folds as it narrows"), it SHALL also hold "Theater mode" and, while the sandbox has a running mod frame, "Fullscreen" (see "Theater mode button" and "Fullscreen button"). Every item's icon and label SHALL start at the same distance from the menu's left edge; "Theater mode" SHALL show its check, while theater mode is on, at the item's end. "Copy link" SHALL copy the full address of the app with the sandbox's run link as its hash, close the menu, and show "Link copied" at the button for a moment, also announced to assistive technologies, or "Cannot copy the link" when the clipboard refuses.

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

#### Scenario: Wide bar keeps the menu short
- **WHEN** a mod runs on a 1280×800 viewport and the user opens the "More actions" menu
- **THEN** the menu holds no "Theater mode", no "Fullscreen" and no edit item

#### Scenario: Items line up on a phone
- **WHEN** a mod with a collection runs on a 360×740 viewport, theater mode is on, and the user opens the "More actions" menu
- **THEN** the icons of "Copy link", "Reload tiles" and "Theater mode" share their left edge, within 1 pixel, and the check of "Theater mode" is right of its label

### Requirement: The bar folds as it narrows
The stage bar SHALL be narrow when it is under 480px wide, or when its capsules, at their minimum width, do not fit beside the bar's other items; otherwise it SHALL be wide. A bar that is narrow because its capsules did not fit SHALL become wide again once they fit. The left side SHALL follow the stage bar's width:
- at least 720px: everything shown;
- 480px to 719px: the mod and collection capsules show only their icons;
- on a narrow bar: one capsule that looks like the mosaic capsule, with its icon and its title (see "Capsule contents"), so "Unsaved combination" with a dashed border for a sandbox not opened from a mosaic. Its accessible name SHALL be "Combination: <that title>". Its menu SHALL have "Mosaic: <mosaic capsule's title>", "Mod: <mod capsule's title>" and "Collection: <collection capsule's title>" rows that open their lists.

No capsule SHALL be narrower than its padding, its icon, its chevron and the gaps between them, so its icons always stay inside it. The right side SHALL fold on a narrow bar as "One-row stage bar" says. A change of width while the bar stays wide, or stays narrow, SHALL NOT move any item of the bar's right side.

#### Scenario: Narrow bar
- **WHEN** the stage bar of "Nobel laureates on the map" is 660px wide
- **THEN** the mod and collection capsules show only their icons, with their full titles in their accessible names, and the mosaic capsule shows its title

#### Scenario: Titles from 720px
- **WHEN** the stage bar of "Nobel laureates on the map" is 800px wide
- **THEN** the three capsules show their titles

#### Scenario: Phone width
- **WHEN** the stage bar is 400px wide
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and its menu's "Collection: Nobel Prize in Literature laureates" row opens the collection list

#### Scenario: Folded unsaved combination keeps the mosaic's look
- **WHEN** the stage bar of "Nobel laureates on the map" is 400px wide and the user chooses Flashcards in the mod list
- **THEN** the folded capsule has the mosaic icon, says "Unsaved combination" with a dashed border, and is named "Combination: Unsaved combination"
- **AND** its menu's rows say "Mosaic: Unsaved combination" and "Mod: Flashcards"

#### Scenario: Capsules never break
- **WHEN** the stage bar of "Nobel laureates on the map" is 630px wide, where its capsules have to shrink beside the edit button
- **THEN** every capsule's icon and chevron are inside the capsule's box, and every item of the stage bar is inside the bar

#### Scenario: Folds when the capsules do not fit
- **WHEN** the stage bar of "Nobel laureates on the map" is at least 480px wide but too narrow for its capsules at their minimum width
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and the right side holds the messages button
- **AND** once the bar is wide enough for the capsules, it shows the mod, collection and mosaic capsules and the errors, warnings and notifications buttons again

#### Scenario: The title is readable on a phone
- **WHEN** "Nobel laureates on the map" runs on a 360×740 viewport
- **THEN** its capsule is at least 80px wide and shows the start of the mosaic's title

### Requirement: Stage bar beside the hamburger chip
While the sidebar is hidden, the stage bar SHALL start after the hamburger chip and a gap, so the chip never covers it. The stage bar and the sidebar's first row SHALL share the same top edge and height in every sidebar state, so the hamburger button and the stage bar are one row. The frame under the stage bar SHALL keep the full width left of the chip.

#### Scenario: Bar after the chip
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is hidden
- **THEN** the stage bar's left edge is right of the hamburger button's right edge, and the mod's frame's left edge is left of the hamburger button's right edge

#### Scenario: One row with the sidebar's heading row
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is expanded
- **THEN** the stage bar's top edge and height are those of the sidebar's first row, within 1 pixel

#### Scenario: Folding follows the space left
- **WHEN** the sidebar is hidden and the stage bar of "Nobel laureates on the map" is 660px wide after the chip
- **THEN** the mod and collection capsules show only their icons

## ADDED Requirements

### Requirement: Edit button
A combination sandbox SHALL have an edit button with a pencil icon, whose accessible name and tooltip say what it does:
- "Edit mosaic", for a sandbox opened from a stored mosaic;
- "Edit a copy", for one opened from any other mosaic;
- "Edit as a new mosaic", for a sandbox not opened from a mosaic, with a collection or "None".

#### Scenario: Unsaved combination
- **WHEN** a run link opens Flashcards with the laureates' collection
- **THEN** the stage bar has a button named "Edit as a new mosaic" between the mosaic capsule and the "More actions" button

#### Scenario: Sample mosaic
- **WHEN** "Nobel laureates on the map" runs
- **THEN** the stage bar has a button named "Edit a copy"

### Requirement: Sandboxes without an edit button
A sandbox opened with a tile, and a sandbox shown with a plain title (see "Combination sandboxes"), SHALL have no edit button.

#### Scenario: Tile link
- **WHEN** a run link opens the tile viewer with a tile
- **THEN** the stage bar has no edit button

#### Scenario: Plain title
- **WHEN** the mod viewer runs from a run link without a collection
- **THEN** the stage bar has no edit button

### Requirement: Edit button on a narrow bar
The edit button SHALL be on the bar while the stage bar is at least 288px wide, its width on a 360px wide viewport. On a narrower bar, the "More actions" menu SHALL hold the same action instead, with the same name and the pencil icon (see "More actions menu").

#### Scenario: Edit button on a phone
- **WHEN** an unsaved combination runs on a 360×740 viewport
- **THEN** the edit button is at least 32px, fully inside the stage bar, and the capsule is at least 80px wide and shows the start of its title
- **AND** choosing the button with a tap opens the viewer

#### Scenario: Smaller than a phone
- **WHEN** "Nobel laureates on the map" runs on a 320×640 viewport
- **THEN** the stage bar has no edit button, and the "More actions" menu holds "Edit a copy", which opens the viewer
- **AND** the page cannot scroll sideways

### Requirement: Choosing the edit button
Choosing the edit button, or its item in the "More actions" menu, SHALL open the mosaic viewer in a new sandbox, in the mode its name says (see "Mosaic viewer modes from the link" in `default-mods`), and leave the current sandbox behind it, so back returns to it.

#### Scenario: Back to the mosaic
- **WHEN** "Nobel laureates on the map" runs and the user chooses "Edit a copy", then goes back
- **THEN** the country map runs "Nobel laureates on the map" again

### Requirement: Edit button links
The edit button SHALL open `#/run?mod=mosaic_viewer&target=<mosaic>&mode=edit` for "Edit mosaic", the same with `mode=copy` for "Edit a copy", and `#/run?mod=mosaic_viewer&mode=new&draft_mod=<mod>` for "Edit as a new mosaic", with `draft_collection=<collection>` when the sandbox has one and `draft_sites=<sites>` when it was opened with `sites`. Each address SHALL be the resolved one.

#### Scenario: Edit the combination
- **WHEN** the user chooses "Edit as a new mosaic" in the stage bar of Flashcards with the laureates' collection
- **THEN** the mosaic viewer runs in edit mode with `mode=new`, `draft_mod` the flashcards mod file's address and `draft_collection` the collection file's address, and nothing is stored until the user saves
- **AND** back returns to Flashcards
