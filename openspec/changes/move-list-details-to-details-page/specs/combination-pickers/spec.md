# Spec Delta

## ADDED Requirements

### Requirement: Details button
Each list SHALL have a button after its filter button, behind a divider, named "Details", with the tooltip "Details". Pressing it SHALL show the list's details page (see "Details page") in place of the rows, and while that page is shown the button SHALL be shown pressed, as the filter button is, and pressing it again SHALL go back.

#### Scenario: Open the details
- **WHEN** the user opens the mosaic list of "Nobel laureates on the map" and presses "Details"
- **THEN** the list shows the details page, and the "Details" button is shown pressed

#### Scenario: Press again
- **WHEN** the details page of the mod list is shown and the user presses "Details"
- **THEN** the main list is shown, and the "Details" button is not pressed

#### Scenario: Pressed in both color schemes
- **WHEN** the details page is shown, in the light and in the dark color scheme
- **THEN** the "Details" button has the accent background and the accent foreground, as a pressed filter button has, which meet 4.5:1 in both schemes (see `theme`, "Token contrast")

#### Scenario: Toolbar on a phone
- **WHEN** the user opens the mod list on a 360×740 viewport
- **THEN** the search field, the sort, filter and "Details" buttons are on one row, inside the list

### Requirement: Details page
The details page SHALL start with a "Back" row, highlighted, then hold the current entry's details (see "Details of each list") as text the user can select, each as a term and its value. Addresses SHALL be shown resolved against the app's address.

#### Scenario: Back row first
- **WHEN** the user opens the mod list and presses "Details"
- **THEN** the page starts with a "Back" row, which is highlighted

#### Scenario: Values wrap on a phone
- **WHEN** the user opens the details page of the mosaic list on a 360×740 viewport
- **THEN** the run link wraps inside the list, and the list does not scroll sideways

### Requirement: Details of each list
The mod list's details page SHALL hold "Mod" and the mod's address, then "Version" once its file is loaded. The collection list's SHALL hold "Collection" and its address, "Tile" and the tile's address for a tile link, or "Collection" and "None". The mosaic list's SHALL hold "Mosaic" and the mosaic file's address, or "Unsaved combination", then "Run link" and the app's full address with the sandbox's run link as its hash.

#### Scenario: Mosaic details
- **WHEN** the user opens the details page of the mosaic list of "Nobel laureates on the map", with the app at `https://example.org/`
- **THEN** the page shows "Mosaic" with the mosaic file's address, and "Run link" with `https://example.org/` followed by the sandbox's run link hash

#### Scenario: Mod details
- **WHEN** the country map runs and the user opens the details page of the mod list
- **THEN** the page shows "Mod" with the country map's mod file address, and "Version" with `1.0.1`

#### Scenario: No collection
- **WHEN** a sandbox runs Country Map without a collection and the user opens the details page of the collection list
- **THEN** the page shows "Collection" with "None"

### Requirement: Leaving the details page
"Back", Backspace in an empty search field and the "Details" button SHALL go back to what the list showed before the details page, the main list or an entry's page, with its search text and its highlighted row. Typing in the search field SHALL also go back, with the typed text as the search. Choosing a sort or checking a filter SHALL go back too. Escape SHALL close the list, and the list SHALL open again on its main list.

#### Scenario: Back
- **WHEN** the user highlights Flashcards in the mod list, opens the details page and chooses "Back"
- **THEN** the main list is shown with Flashcards highlighted

#### Scenario: Typing
- **WHEN** the details page of the mod list is shown and the user types `map`
- **THEN** the main list shows `Country Map` and no other sample mod

#### Scenario: From an entry's page
- **WHEN** the user opens Country Map's page in the mod list, then the details page, then presses Backspace with the search field empty
- **THEN** Country Map's page is shown again

#### Scenario: Opened again
- **WHEN** the user closes the mod list with Escape while its details page is shown, and opens it again
- **THEN** the list shows its main list

### Requirement: Copy and open buttons
Each detail whose value is an `http:` or `https:` address SHALL have, after its value, a "Copy" button and an "Open in a new tab" link, named after the term, such as "Copy run link" and "Open run link in a new tab". Other values, such as the version, "None", "Unsaved combination" or a local file's address, SHALL have neither.

#### Scenario: No buttons
- **WHEN** the user opens the details page of an unsaved combination's mosaic list, and of the mod list
- **THEN** "Unsaved combination" and the version have no "Copy" button and no "Open in a new tab" link

#### Scenario: Not a web address
- **WHEN** the current mod was opened from a local file and the user opens the details page of the mod list
- **THEN** the mod's address has no "Copy" button and no "Open in a new tab" link

### Requirement: Copying a detail
A "Copy" button SHALL put its value on the clipboard and show "Copied" at the button for a moment, or "Cannot copy" when the clipboard refuses, also announced to assistive technologies.

#### Scenario: Copy the run link
- **WHEN** the user presses "Copy run link" on the mosaic list's details page
- **THEN** the clipboard holds the run link's full address, and "Copied" shows at the button

#### Scenario: Copy refused
- **WHEN** the user presses "Copy mod" and the clipboard refuses the text
- **THEN** "Cannot copy" shows at the button

### Requirement: Opening a detail in a new tab
An "Open in a new tab" link SHALL open its value in a new tab, without giving that tab the app's window or the app's address.

#### Scenario: Open the mosaic file
- **WHEN** the user follows "Open mosaic in a new tab" on the mosaic list's details page of "Nobel laureates on the map"
- **THEN** a new tab opens the mosaic file's address, with no opener and no referrer

### Requirement: Details buttons are easy to tap
The "Details" button and each "Copy" button and "Open in a new tab" link SHALL be at least 32px wide and tall.

#### Scenario: Buttons on a phone
- **WHEN** the user opens the details page of the mosaic list on a 360×740 viewport
- **THEN** "Copy run link" and "Open run link in a new tab" are each at least 32px wide and tall

## MODIFIED Requirements

### Requirement: Rows are sorted again
A list SHALL be sorted again with what is known, and settle again, when it opens, when the user goes back from a page or from the details page to the main list, when the search text changes and when the user chooses a sort, also the one already chosen.

#### Scenario: Back from a page
- **WHEN** the pointer stopped the mod list, scores arrived since, and the user opens Country Map's page and goes back
- **THEN** the main list is sorted with those scores, and Country Map is highlighted and in view

#### Scenario: Back from the details page
- **WHEN** the pointer stopped the mod list, scores arrived since, and the user opens the details page and goes back
- **THEN** the main list is sorted with those scores, and the row highlighted before is highlighted and in view

## REMOVED Requirements

### Requirement: Details footer
**Reason**: The footer takes room under the rows in every list, worst for the mosaic list's run link on a phone. The details move to a page opened from the toolbar.
**Migration**: Press the "Details" button after the list's filter button (see "Details button" and "Details page").

### Requirement: Explorer links
**Reason**: The sidebar already has an item for each explorer, so the links repeated it and took room in each list.
**Migration**: Open the Mods, Tiles or Mosaics section from the sidebar.

### Requirement: Explorer links are easy to tap
**Reason**: The explorer links are removed (see "Explorer links").
**Migration**: None. The sidebar items follow `app-sidebar`.
