# combination-pickers Specification

## Purpose

Lets the user try other combinations from the stage bar: a list per capsule to choose another mod for the same data, other data for the same mod, or another mosaic, with what fits shown first.

## Requirements

### Requirement: Each capsule opens a list
Pressing the mod, collection or mosaic capsule SHALL open its list, drawn by the app outside every mod frame, with a search field focused (see "Search"). Arrow keys SHALL move between entries, Enter SHALL choose one, and Escape SHALL close the list and give the focus back to its capsule.

#### Scenario: Search the mods
- **WHEN** the user opens the mod list of a combination sandbox and types `map`
- **THEN** the list shows `Country Map` and no other sample mod

#### Scenario: Escape
- **WHEN** the mod list is open and the user presses Escape
- **THEN** the list closes and the mod capsule has the focus

### Requirement: Mod list entries
The mod list SHALL hold the catalog's mods and the recently used mods that the catalog does not list, those marked with the ring (see "Current and tried marks"). The current mod SHALL be marked as the current entry, and SHALL be listed even when neither the catalog nor recently used holds it.

#### Scenario: Vanilla mod list
- **WHEN** the country map runs from "Nobel laureates on the map" and the user opens the mod list
- **THEN** the list holds Book List, Flashcards and Country Map, and Country Map is marked as the current entry

#### Scenario: Mod outside the catalog
- **WHEN** a run link opened a mod that the catalog does not list, with a collection, and the user opens the mod list
- **THEN** the list holds that mod, marked as the current entry

### Requirement: Collection list entries
The collection list SHALL start with a "None" row, then hold the catalog's collections and the recently used collections that the catalog does not list, those marked with the ring. The current collection, or "None" without one, SHALL be marked as the current entry. For a tile link, the first row SHALL be the tile, labeled by its decoded file name, marked as current and not selectable. The tile and "None" rows SHALL be pinned at the top, outside every sort.

#### Scenario: Collection list of a mosaic
- **WHEN** the user opens the collection list of "Nobel laureates on the map"
- **THEN** the list starts with "None", then holds the laureates and their books, and the laureates are marked as the current entry

#### Scenario: Tile link
- **WHEN** the tile viewer runs with the tile `2016__bob_dylan.md` and the user opens the collection list
- **THEN** the first row is `2016__bob_dylan.md`, marked as current and not selectable, followed by "None" and the collections

### Requirement: Tile-match counts
Each mod entry SHALL show as its score how many tiles of the current collection or tile match that mod's tile type, as `<matching>/<total>`, without any mosaic's aliases. A mod without a tile type SHALL score `<total>/<total>`, with the tooltip "Accepts any tile: this mod has no tile type". Each collection entry SHALL show the same for the current mod and that collection. "None" and entries of an empty pairing SHALL show no score. Until a score is known, it SHALL show a spinner named "Counting", which does not turn when the user's system asks for reduced motion. A score with no matching tile SHALL be muted.

#### Scenario: Laureates without aliases
- **WHEN** a Flashcards sandbox runs with the laureates' collection and the user opens Country Map's page in the mod list
- **THEN** "Without a mosaic" shows `0/17`, since the laureates' tiles have `name` and `birth_country` and no aliases apply

#### Scenario: Mod without a tile type
- **WHEN** the catalog lists `tile_viewer` and the user opens the mod list of a sandbox with the laureates' collection
- **THEN** the `tile_viewer` entry shows `17/17`, and its tooltip says "Accepts any tile: this mod has no tile type"

#### Scenario: Muted score
- **WHEN** Flashcards shows `0/17` in the mod list
- **THEN** its score is muted, and Flashcards stays selectable

### Requirement: Entries that cannot be loaded
A mod, collection or mosaic entry whose file cannot be loaded SHALL be listed at the end of its list with the reason, and SHALL NOT be selectable. A recently used entry in that state SHALL have a "Remove" button that drops it from recently used.

#### Scenario: Removed recent collection
- **WHEN** a recently used collection now answers HTTP 404 and the user opens the collection list
- **THEN** the entry is at the end with a message that names `404`, and pressing "Remove" takes it out of the list and of recently used

### Requirement: Mosaics of a pair are marked
A mod entry SHALL have mosaics when listed mosaics pair that mod with the current collection, or with no collection when "None" is current. A collection entry SHALL have the mosaics that pair the current mod with that collection. Pairs SHALL be compared by resolved sources. The number SHALL show in the entry's mosaic badge (see "Mosaic badge").

#### Scenario: Laureates have a mosaic with the country map
- **WHEN** a sandbox runs Country Map with no collection and the user opens the collection list
- **THEN** the laureates' entry has 1 mosaic

### Requirement: Mosaic list entries
The mosaic list SHALL hold the catalog's mosaics, the recently used mosaics that the catalog does not list, those marked with the ring, and the tried combinations (see "Tried combinations in the mosaic list"). The current mosaic SHALL be marked as the current entry.

#### Scenario: Map mosaic first
- **WHEN** the country map runs with the laureates' collection and the user opens the mosaic list
- **THEN** "Nobel laureates on the map" is under "For Country Map + Nobel Prize in Literature laureates", and "Books by Nobel laureates" is under "Other combinations"

#### Scenario: No mosaic for the pair
- **WHEN** a run link opens Flashcards with the laureates' collection and the user opens the mosaic list
- **THEN** the "For Flashcards + Nobel Prize in Literature laureates" group holds only the pinned "Unsaved combination" row

#### Scenario: Mosaic from a link
- **WHEN** a run link opened a mosaic file that the catalog does not list, and the user then opens the mosaic list of another sandbox
- **THEN** the list holds that mosaic, with the mosaic icon and the ring

### Requirement: Mosaic entries say what makes them differ
Each mosaic entry of the current pair SHALL show, under its title, its aliases as `<field> <- <names>` items, or "No aliases" when it has none. Each other mosaic and each tried combination not of the current pair SHALL show its mod's title and its collection's title, as `<mod> + <collection>`, or `+ None`.

#### Scenario: Alias summary
- **WHEN** the mosaic list shows "Nobel laureates on the map" for its own pair
- **THEN** its entry shows `title <- name` and `country <- birth_country`

#### Scenario: Other combination
- **WHEN** the mosaic list shows "Books by Nobel laureates" under "Other combinations"
- **THEN** its entry shows `Book List + Nobel Prize in Literature laureates books`

### Requirement: Details footer
Each list SHALL end with a details section, as text the user can select. For the mod list, it SHALL show the current mod's source. For the collection list, the current collection's or tile's location. For the mosaic list, the current mosaic file's address or "Unsaved combination", then the sandbox's run link.

#### Scenario: Mosaic details
- **WHEN** the user opens the mosaic list of "Nobel laureates on the map"
- **THEN** its details section shows the mosaic file's address and the run link

### Requirement: Explorer links
Each list SHALL end, after the details, with a link to its explorer, "Open the mod explorer", "Open the collection explorer" or "Open the mosaic explorer", which shows that section as the sidebar item does. A link whose explorer is switched off SHALL NOT be shown.

#### Scenario: Open the collection explorer
- **WHEN** the user chooses "Open the collection explorer" in the collection list
- **THEN** the Tiles section is shown and its item is the current one

### Requirement: Choosing a mod
Choosing another mod without mosaics, or the "Without a mosaic" option of its page, SHALL open that mod with the current collection or tile (see "Open a combination" in `mod-stage`). From a sandbox opened from a mosaic, the link SHALL keep that mosaic as `sites`. From a sandbox with `sites`, it SHALL keep `sites`. The link's other params SHALL be dropped. Choosing the current mod SHALL close the list and open nothing.

#### Scenario: Book List on the laureates' map data
- **WHEN** the user chooses Book List in the mod list of "Nobel laureates on the map"
- **THEN** a sandbox runs Book List with the laureates' collection, from a run link whose `sites` is the address of `nobel_laureates_map.yaml`, and with no `mosaic`

### Requirement: Choosing a collection
Choosing another collection without mosaics, or "None", or the "Without a mosaic" option of a collection's page, SHALL open the current mod with it, without `tile` and without `sites`. The link's other params SHALL be kept. Choosing the current collection SHALL close the list and open nothing.

#### Scenario: Other collection for the same mod
- **WHEN** a sandbox runs Flashcards with `sites` and the user chooses the laureates' books
- **THEN** a sandbox runs Flashcards with the books, from a run link with no `sites`

#### Scenario: None
- **WHEN** the user chooses "None" in the collection list of a sandbox with a collection
- **THEN** a sandbox runs the same mod without a collection

### Requirement: Choosing a mosaic
Choosing another mosaic, in the mosaic list or on a page, SHALL open that mosaic's run link, with no other params. Choosing the current mosaic SHALL close the list and open nothing.

#### Scenario: Other combination
- **WHEN** the user chooses "Books by Nobel laureates" in the mosaic list of "Nobel laureates on the map"
- **THEN** a sandbox runs Book List from that mosaic, and the stage bar's capsules show Book List, the laureates' books and "Books by Nobel laureates"

#### Scenario: From a page
- **WHEN** the user chooses "Nobel laureates on the map" on Country Map's page in the mod list of a Flashcards sandbox
- **THEN** a sandbox runs the country map from that mosaic

### Requirement: Counts are kept for the page
A score SHALL be measured once per mod and collection, mod and tile, or mosaic, and kept until the app page is closed. "Reload tiles" SHALL drop the scores of the reloaded collection or tile, those of its mosaics too. Measuring SHALL request each listed mod's mod file and tile type file, and the collection's file and tiles, but no entrypoint or library, and SHALL show nothing to the user. A mod without a tile type SHALL be scored from the collection's file, without loading its tiles.

#### Scenario: Second opening
- **WHEN** the user opens the mod list, closes it and opens it again
- **THEN** no file is requested again for scores already known

#### Scenario: Mod without a tile type
- **WHEN** only `tile_viewer` is scored on the laureates' collection
- **THEN** no tile file of the collection is requested

### Requirement: Four columns
Every row of the three lists SHALL have four columns, in order: a mark column (see "Current and tried marks"), the title with its details lines, a mosaic badge column and a score column. The mark, badge and score columns SHALL keep one width in every row of a list, so each column lines up whatever a row holds. No other badge SHALL follow a title.

#### Scenario: Columns line up
- **WHEN** the mod list shows Country Map, current and with one mosaic, and Flashcards, with neither
- **THEN** the titles of both rows start at the same place, and so do their scores

### Requirement: Current and tried marks
The current entry SHALL be marked with a filled dot. An entry tried recently and not saved in the app (see "What is recorded" in `recently-used`) SHALL be marked with a ring. The current mark SHALL win when an entry is both. Each mark SHALL have a tooltip and an accessible text, "Current" or "Tried recently, not saved in the app", and the current row SHALL be marked as current to assistive technologies.

#### Scenario: Current mod
- **WHEN** the country map runs from "Nobel laureates on the map" and the user opens the mod list
- **THEN** Country Map has the filled dot, whose accessible text is "Current", and the other mods have no mark

#### Scenario: Mod from a link
- **WHEN** the user opened a run link with a mod outside the catalog and the laureates' collection, then opened "Books by Nobel laureates", and opens the mod list
- **THEN** that mod is listed with the ring, whose accessible text is "Tried recently, not saved in the app"

### Requirement: Mosaic badge
In the mod and collection lists, an entry with mosaics (see "Mosaics of a pair are marked") SHALL show the mosaic icon and their number in the badge column, whose accessible name and tooltip are `1 mosaic` or `<n> mosaics`. In the mosaic list, each mosaic SHALL show the mosaic icon alone, named "Mosaic", and an unsaved combination SHALL show none.

#### Scenario: Badge in the collection list
- **WHEN** a sandbox runs Country Map with no collection and the user opens the collection list
- **THEN** the laureates' entry shows the mosaic icon and `1`, named `1 mosaic`

#### Scenario: Badge in the mosaic list
- **WHEN** the user opens the mosaic list of a Flashcards sandbox with the laureates' collection
- **THEN** "Nobel laureates on the map" shows the mosaic icon without a number, and the "Unsaved combination" row shows no icon

### Requirement: Default order
Sorted by "Mosaics first", the mod and collection lists SHALL show the entries with mosaics first, then the others, each group by title A-Z, ignoring letter case. Sorted by "This pair first", the mosaic list SHALL show the current pair's entries under "For <mod title> + <collection title>" (or "+ None"), then the others under "Other combinations", each group by title A-Z after the pinned row. These are the lists' default sorts.

#### Scenario: Mod with a mosaic first
- **WHEN** a sandbox runs Flashcards with the laureates' collection and the user opens the mod list
- **THEN** the list holds Country Map, then Book List, then Flashcards

### Requirement: Sort choices
Each list SHALL have a sort button after its search field, behind a divider, named "Sort", whose menu offers one choice at a time. The mod and collection lists SHALL offer "Mosaics first", "Name", "Match ratio" and "Matching tiles". The mosaic list SHALL offer "This pair first", "Name", "Match ratio" and "Matching tiles". "Name", "Match ratio" and "Matching tiles" SHALL show the entries in one group with no heading.

#### Scenario: Sort by name
- **WHEN** the user chooses "Name" in the mod list's sort menu of a Flashcards sandbox with the laureates' collection
- **THEN** the list holds Book List, Country Map and Flashcards, in that order

#### Scenario: Keyboard
- **WHEN** the mod list is open, the user moves the focus to the sort button and presses Enter, then Escape
- **THEN** the sort menu opens, then closes with the focus back on the sort button, and the mod list stays open

### Requirement: Comparing scores
"Match ratio" SHALL order entries by `matching / total`, highest first, then by matching tiles, most first, then by title A-Z. "Matching tiles" SHALL order them by matching tiles, most first, then by `matching / total`, then by title A-Z. Equal ratios SHALL compare exactly, so `12/17` and `24/34` are equal. Entries with no score known yet, and entries with no score, SHALL come last, by title A-Z.

#### Scenario: Ratio, then tiles
- **WHEN** the mosaic list is sorted by "Match ratio" and three entries score `5/10`, `50/100` and `9/10`
- **THEN** they are in the order `9/10`, `50/100`, `5/10`

#### Scenario: Tiles first
- **WHEN** the same entries are sorted by "Matching tiles"
- **THEN** they are in the order `50/100`, `9/10`, `5/10`

#### Scenario: Equal ratios by name
- **WHEN** Book List scores `17/17` and a mod without a tile type scores `17/17` in a list sorted by "Match ratio"
- **THEN** they are ordered by title A-Z

### Requirement: Filter choices
Each list SHALL have a filter button after its sort button, named "Filter", whose menu offers choices that can be checked together, and the list SHALL show only the entries that meet every checked choice. The mod and collection lists SHALL offer "Compatible only", "Has mosaics" and "Unsaved". The mosaic list SHALL offer "This pair only", "Same mod", "Same collection", "Compatible only" and "Unsaved". While a choice is checked, the filter button SHALL be shown pressed.

#### Scenario: Compatible only
- **WHEN** a Flashcards sandbox runs with the laureates' collection, Flashcards scores `0/17`, and the user checks "Compatible only" in the mod list's filter menu
- **THEN** the list does not hold Flashcards

#### Scenario: Same mod
- **WHEN** the default mosaics are listed, the country map runs from "Nobel laureates on the map", and the user checks "Same mod" in the mosaic list
- **THEN** the list holds "Nobel laureates on the map" and "UNESCO World Heritage Sites Example", and no other mosaic

### Requirement: What the filters keep
"Compatible only" SHALL keep the entries whose score has a matching tile, those with no score known yet and those with no score. "Has mosaics" SHALL keep the entries with mosaics. "Unsaved" SHALL keep the entries marked with the ring. "This pair only" SHALL keep the current pair's mosaics. "Same mod" and "Same collection" SHALL keep the mosaics that name the current mod, or the current collection or none when "None" is current. Rows pinned at the top SHALL be kept by every filter.

#### Scenario: Counting rows are kept
- **WHEN** "Compatible only" is checked and an entry's score is still counting
- **THEN** the entry is listed until its score shows no matching tile

#### Scenario: None stays
- **WHEN** the user checks "Has mosaics" in the collection list of a Book List sandbox
- **THEN** the list still starts with "None"

### Requirement: Choices kept for the page
Each list SHALL keep its sort and filter choices until the app page is reloaded, also for other sandboxes. A reload SHALL bring back the default sort and no filter.

#### Scenario: Kept for another sandbox
- **WHEN** the user sorts the mod list by "Name", chooses Book List, and opens the mod list of the new sandbox
- **THEN** the list is sorted by "Name"

#### Scenario: Reload
- **WHEN** the user sorts the mod list by "Name" and reloads the app page
- **THEN** the mod list is sorted by "Mosaics first"

### Requirement: Rows settle, then stay
While a list is settling, its rows SHALL be sorted again as titles, mosaics and scores become known, at most every 300ms. The list SHALL stop settling when the pointer moves inside it or an arrow key is pressed in it. Once it stopped, a title or score becoming known SHALL show in its row without moving any row.

#### Scenario: Score arrives while settling
- **WHEN** the user opens the mod list sorted by "Match ratio" before any score is known, and does not touch the list
- **THEN** each mod moves to its place as its score arrives

#### Scenario: Score arrives after the pointer moved
- **WHEN** the user opens the same list and moves the pointer over it before the scores arrive
- **THEN** each score shows in its row and no row moves

### Requirement: Rows are sorted again
A list SHALL be sorted again with what is known, and settle again, when it opens, when the user goes back from a page to the main list, when the search text changes and when the user chooses a sort, also the one already chosen.

#### Scenario: Back from a page
- **WHEN** the pointer stopped the mod list, scores arrived since, and the user opens Country Map's page and goes back
- **THEN** the main list is sorted with those scores, and Country Map is highlighted and in view

### Requirement: Opening highlights the current entry
When a list opens, its highlighted row SHALL be the current entry, scrolled into view. When the current entry cannot be chosen, as the tile of a tile link, the next row that can be chosen SHALL be highlighted. When the list shows no current entry, as when a filter hides it, the first row SHALL be highlighted. Typing in the search field SHALL highlight the first row that matches.

#### Scenario: Current mod highlighted
- **WHEN** a sandbox runs Flashcards with the laureates' collection and the user opens the mod list
- **THEN** Flashcards is highlighted, although Country Map and Book List come first

#### Scenario: Tile link
- **WHEN** the tile viewer runs with the tile `2016__bob_dylan.md` and the user opens the collection list
- **THEN** "None" is highlighted

#### Scenario: Current entry filtered out
- **WHEN** "Unsaved" is checked in the mod list's filter menu and the current mod is in the catalog, and the user opens the mod list again
- **THEN** the first row is highlighted

#### Scenario: Typing
- **WHEN** the mod list is open with Flashcards highlighted and the user types `map`
- **THEN** Country Map, the first row that matches, is highlighted

### Requirement: Rows with mosaics open a page
In the mod and collection lists, choosing an entry with mosaics, with a click or Enter, SHALL open its page in place of the main list instead of opening a combination. The page SHALL start with a "Back" row named after the entry, then its options (see "Page options"). "Back", and Backspace in an empty search field, SHALL return to the main list. An entry without mosaics SHALL be chosen directly.

#### Scenario: Open Country Map's page
- **WHEN** the user chooses Country Map in the mod list of a sandbox with the laureates' collection
- **THEN** the list shows "Back" named after Country Map, then "Nobel laureates on the map", then "Without a mosaic", and no sandbox was opened

#### Scenario: Entry without mosaics
- **WHEN** the user chooses Flashcards in the same list
- **THEN** a sandbox runs Flashcards with the laureates' collection

### Requirement: Page options
A page SHALL list its entry's mosaics sorted by "Match ratio", each with the mosaic icon and its score with aliases, then "Without a mosaic", with the entry's score without aliases and no icon. Choosing a mosaic SHALL be choosing it in the mosaic list. Choosing "Without a mosaic" SHALL be choosing the entry. When the page's entry is the current one and the sandbox is opened from a mosaic, the page SHALL NOT list "Without a mosaic".

#### Scenario: Scores of the options
- **WHEN** the user opens Country Map's page in the mod list of a Flashcards sandbox with the laureates' collection
- **THEN** "Nobel laureates on the map" shows `17/17` and "Without a mosaic" shows `0/17`

#### Scenario: Without a mosaic
- **WHEN** the user chooses "Without a mosaic" on that page
- **THEN** a sandbox runs Country Map with the laureates' collection, with no `mosaic`

#### Scenario: Current mosaic's page
- **WHEN** the country map runs from "Nobel laureates on the map" and the user opens Country Map's page in the mod list
- **THEN** the page lists "Nobel laureates on the map" marked current, and no "Without a mosaic"

### Requirement: An entry's best score
An entry with mosaics SHALL show, in the main list, the best score among the options its page would show for the current search, as "Match ratio" orders them, and SHALL sort and filter by it. Until every one of those options has its score, it SHALL show the loading mark.

#### Scenario: Best of the options
- **WHEN** a Flashcards sandbox runs with the laureates' collection and the user opens the mod list
- **THEN** Country Map shows `17/17`, its mosaic's score, and not `0/17`

### Requirement: Search
Typing in the search field SHALL show only the entries whose title holds the typed text, ignoring letter case, and, in the mod and collection lists, the entries with a mosaic whose title holds it. In the mosaic list, an unsaved combination SHALL be found by its mod's and collection's titles. While the search field has text, the rows pinned at the top SHALL be hidden. Each page SHALL be searched the same way, "Without a mosaic" being found by its entry's title.

#### Scenario: Search the mods
- **WHEN** the user opens the mod list of a combination sandbox and types `map`
- **THEN** the list shows `Country Map` and no other sample mod

#### Scenario: None hidden
- **WHEN** the user opens the collection list and types `nobel`
- **THEN** the list does not show "None"

### Requirement: Entries found through their mosaics
An entry shown only because some of its mosaics match the search SHALL show, in its badge, the number of matching mosaics, named "<m> of <n> mosaics match", and, under its title, the first matching mosaic's title with the mosaic icon, followed by "+<k> more" for the others. Its page SHALL open with the same search text, so it lists only the matching mosaics, and not "Without a mosaic". Back SHALL bring back the main list's search text.

#### Scenario: Found by its mosaic
- **WHEN** the user types `laureates on` in the mod list of a sandbox with the laureates' collection
- **THEN** the list shows Country Map with `Nobel laureates on the map` under its title, and its badge is named `1 of 1 mosaics match`

#### Scenario: Page with the search
- **WHEN** the user then chooses Country Map
- **THEN** the page's search field holds `laureates on`, and the page lists "Nobel laureates on the map" and no "Without a mosaic"

#### Scenario: Found by its own title
- **WHEN** the user types `country` in the same list and chooses Country Map
- **THEN** the page's search field is empty, and the page lists "Nobel laureates on the map" and "Without a mosaic"

### Requirement: Tried combinations in the mosaic list
The mosaic list SHALL also hold the recently used combinations (see `recently-used`), each titled "Unsaved combination", with its `<mod> + <collection>` under its title, the ring, no mosaic icon and its score without aliases. When the sandbox is not opened from a mosaic, the mosaic list SHALL start with its own pair as a pinned "Unsaved combination" row, marked current, also when no file of it is recently used.

#### Scenario: Current unsaved pair
- **WHEN** a run link opens Flashcards with the laureates' collection and the user opens the mosaic list
- **THEN** the first row is "Unsaved combination", marked current, with `Flashcards + Nobel Prize in Literature laureates` and `0/17`

#### Scenario: Tried pair
- **WHEN** the user tried Flashcards with the laureates' collection, then opened "Books by Nobel laureates", and opens the mosaic list
- **THEN** the list holds an "Unsaved combination" with `Flashcards + Nobel Prize in Literature laureates` and the ring

### Requirement: Choosing a tried combination
Choosing a tried combination SHALL open its mod with its collection (see "Open a combination" in `mod-stage`), with no `mosaic`, no `sites` and no other params. Choosing the current pinned row SHALL close the list and open nothing.

#### Scenario: Back to a tried pair
- **WHEN** the user chooses the tried "Unsaved combination" of Flashcards and the laureates' collection
- **THEN** a sandbox runs Flashcards with the laureates' collection, from a run link with no `sites`

### Requirement: Scores with aliases
A mosaic's score SHALL count the tiles of its collection that match its mod's tile type after the mosaic's aliases rename their fields, as the mod receives them when the mosaic runs. Scores of mod and collection entries, of "Without a mosaic" and of unsaved combinations SHALL count without aliases.

#### Scenario: Laureates on the map
- **WHEN** the user opens the mosaic list of any combination sandbox
- **THEN** "Nobel laureates on the map" shows `17/17`

### Requirement: Measured ahead
When a combination sandbox is shown and its mod file is loaded, the app SHALL load the files that give the lists' titles and mosaics, but no tile. When the pointer rests on a capsule or the keyboard focuses it, and when its list opens, the app SHALL start measuring the scores that list shows. The stage bar's measures SHALL make at most 6 requests at a time, all lists together.

#### Scenario: Refused link
- **WHEN** the app is opened at a run link with both a `collection` and a `tile`
- **THEN** no file of the lists is requested, since the mod file is not loaded and the link requests no file (see `mod-stage`)

#### Scenario: Hovering the mod capsule
- **WHEN** a sandbox runs Country Map with the laureates' collection and the pointer rests on the mod capsule
- **THEN** the tile type files of the listed mods are requested, before the mod list is opened

#### Scenario: Opened after hovering
- **WHEN** the pointer rested on the mod capsule until the scores were measured, and the user opens the mod list
- **THEN** every mod shows its score at once, with no loading mark

#### Scenario: Hovering the mosaic capsule
- **WHEN** the pointer rests on the mosaic capsule
- **THEN** the scores of the listed mosaics are measured, loading each mosaic's collection tiles once

### Requirement: Highlighted rows stay readable
In the mod, collection and mosaic lists, the row the pointer or the keyboard highlights SHALL draw all its text, including its secondary text (details, aliases, the score and the muted score), in the accent's foreground color on the accent background. That pair meets 4.5:1 in both color schemes (see `theme`, "Token contrast"). Rows that are not highlighted SHALL keep their colors.

#### Scenario: Aliases of a highlighted mosaic
- **WHEN** the mosaic list of "Nobel laureates on the map" is open in the light color scheme and the row of that mosaic is highlighted
- **THEN** its aliases `title ← name` and `country ← birth_country` have the computed color of `--ot-accent-foreground`, and a contrast of at least 4.5:1 with the row's background

#### Scenario: Dark color scheme
- **WHEN** the same row is highlighted in the dark color scheme
- **THEN** its aliases have a contrast of at least 4.5:1 with the row's background

### Requirement: Explorer links are easy to tap
Each list's link to its explorer (see "Explorer links") SHALL be at least 32px tall.

#### Scenario: Collection explorer link
- **WHEN** the user opens the collection list of "Nobel laureates on the map"
- **THEN** the "Open the collection explorer" link is at least 32px tall
