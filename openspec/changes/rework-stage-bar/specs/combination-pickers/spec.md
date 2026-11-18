# Spec Delta

## Purpose

Lets the user try other combinations from the stage bar: a list per capsule to choose another mod for the same data, other data for the same mod, or another mosaic, with what fits shown first.

## ADDED Requirements

### Requirement: Each capsule opens a list
Pressing the mod, collection or mosaic capsule SHALL open its list, drawn by the app outside every mod frame, with a search field focused. Typing SHALL show only the entries whose title holds the typed text, ignoring letter case. Arrow keys SHALL move between entries, Enter SHALL choose one, and Escape SHALL close the list and give the focus back to its capsule.

#### Scenario: Search the mods
- **WHEN** the user opens the mod list of a combination sandbox and types `map`
- **THEN** the list shows `Country Map` and no other sample mod

#### Scenario: Escape
- **WHEN** the mod list is open and the user presses Escape
- **THEN** the list closes and the mod capsule has the focus

### Requirement: Mod list entries
The mod list SHALL hold the catalog's mods, in catalog order, then the recently used mods that the catalog does not list, newest first, each marked "Recent". The current mod SHALL be marked as the current entry, and SHALL be listed even when neither the catalog nor recently used holds it.

#### Scenario: Vanilla mod list
- **WHEN** the country map runs from "Nobel laureates on the map" and the user opens the mod list
- **THEN** the list holds Book List, Flashcards and Country Map, and Country Map is marked as the current entry

#### Scenario: Mod outside the catalog
- **WHEN** a run link opened a mod that the catalog does not list, with a collection, and the user opens the mod list
- **THEN** the list holds that mod, marked as the current entry and "Recent"

### Requirement: Collection list entries
The collection list SHALL start with a "None" row, then hold the catalog's collections, in catalog order, then the recently used collections that the catalog does not list, newest first, each marked "Recent". The current collection, or "None" without one, SHALL be marked as the current entry. For a tile link, the first row SHALL be the tile, labeled by its decoded file name, marked as current and not selectable.

#### Scenario: Collection list of a mosaic
- **WHEN** the user opens the collection list of "Nobel laureates on the map"
- **THEN** the list starts with "None", then holds the laureates and their books, and the laureates are marked as the current entry

#### Scenario: Tile link
- **WHEN** the tile viewer runs with the tile `2016__bob_dylan.md` and the user opens the collection list
- **THEN** the first row is `2016__bob_dylan.md`, marked as current and not selectable, followed by "None" and the collections

### Requirement: Tile-match counts
Each mod entry SHALL show how many tiles of the current collection or tile match that mod's tile type, as `<matching>/<total>`, without any mosaic's aliases, or `any` for a mod without a tile type. Each collection entry SHALL show the same for the current mod and that collection. "None" and entries of an empty pairing SHALL show no count. A count SHALL show a loading mark until it is known.

#### Scenario: Laureates without aliases
- **WHEN** the country map runs from "Nobel laureates on the map" and the user opens the mod list
- **THEN** the Country Map entry shows `0/17`, since the laureates' tiles have `name` and `birth_country` and no aliases apply

#### Scenario: Mod without a tile type
- **WHEN** the catalog lists `tile_viewer` and the user opens the mod list of a sandbox with the laureates' collection
- **THEN** the `tile_viewer` entry shows `any`

### Requirement: Compatible entries come first
The entries of the mod and collection lists, after "None" and the tile row, SHALL be sorted, when the list opens, into three groups: entries whose every tile matches or that show `any`, then those with some matching tiles, then those with none. Within a group they SHALL keep their list order. An entry with no count known yet SHALL go in the first group. A count that becomes known while the list is open SHALL NOT move its entry.

#### Scenario: Books first
- **WHEN** a sandbox runs Book List with the laureates' books, whose 51 tiles are books, and the user opens the collection list a second time
- **THEN** "Nobel Prize in Literature laureates books" comes before "Nobel Prize in Literature laureates"

#### Scenario: Count arrives while open
- **WHEN** the user opens a list for the first time and a count becomes known
- **THEN** that entry shows its count and stays at its place

### Requirement: Incompatible entries are muted
Entries with no matching tile SHALL be listed under a heading "Not compatible", in muted text, and SHALL stay selectable. Each SHALL say `no match` next to its count, so color is not the only cue.

#### Scenario: Flashcards on the laureates
- **WHEN** the user opens the mod list of a sandbox with the laureates' collection, and Flashcards shows `0/17`
- **THEN** Flashcards is listed under "Not compatible", says `no match`, and choosing it opens Flashcards with the laureates

### Requirement: Entries that cannot be loaded
A mod, collection or mosaic entry whose file cannot be loaded SHALL be listed at the end of its list with the reason, and SHALL NOT be selectable. A recently used entry in that state SHALL have a "Remove" button that drops it from recently used.

#### Scenario: Removed recent collection
- **WHEN** a recently used collection now answers HTTP 404 and the user opens the collection list
- **THEN** the entry is at the end with a message that names `404`, and pressing "Remove" takes it out of the list and of recently used

### Requirement: Mosaics of a pair are marked
A mod entry SHALL show `<n> mosaics`, or `1 mosaic`, when that many listed mosaics pair that mod with the current collection, or with no collection when "None" is current. A collection entry SHALL show the same for the current mod and that collection. Pairs SHALL be compared by resolved sources.

#### Scenario: Laureates have a mosaic with the country map
- **WHEN** a sandbox runs Country Map with no collection and the user opens the collection list
- **THEN** the laureates' entry shows `1 mosaic`

### Requirement: Mosaic list entries
The mosaic list SHALL hold the catalog's mosaics, in catalog order, then the recently used mosaics that the catalog does not list, newest first, each marked "Recent". It SHALL group them under "For <mod title> + <collection title>" (or "+ None"), the mosaics of the current pair, then under "Other combinations". The current mosaic SHALL be marked as the current entry.

#### Scenario: Map mosaic first
- **WHEN** the country map runs with the laureates' collection and the user opens the mosaic list
- **THEN** "Nobel laureates on the map" is under "For Country Map + Nobel Prize in Literature laureates", and "Books by Nobel laureates" is under "Other combinations"

#### Scenario: No mosaic for the pair
- **WHEN** the current pair has no listed mosaic
- **THEN** the first group says "No mosaic for this combination yet."

### Requirement: Mosaic entries say what makes them differ
Each mosaic entry of the current pair SHALL show, under its title, its aliases as `<field> <- <names>` items, or "No aliases" when it has none. Each entry under "Other combinations" SHALL show its mod's title and its collection's title, as `<mod> + <collection>`, or `+ None`.

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
Choosing another mod SHALL open that mod with the current collection or tile (see "Open a combination" in `mod-stage`). From a sandbox opened from a mosaic, the link SHALL keep that mosaic as `sites`. From a sandbox with `sites`, it SHALL keep `sites`. The link's other params SHALL be dropped. Choosing the current mod SHALL close the list and open nothing.

#### Scenario: Book List on the laureates' map data
- **WHEN** the user chooses Book List in the mod list of "Nobel laureates on the map"
- **THEN** a sandbox runs Book List with the laureates' collection, from a run link whose `sites` is the address of `nobel_laureates_map.yaml`, and with no `mosaic`

### Requirement: Choosing a collection
Choosing another collection, or "None", SHALL open the current mod with it, without `tile` and without `sites`. The link's other params SHALL be kept. Choosing the current collection SHALL close the list and open nothing.

#### Scenario: Other collection for the same mod
- **WHEN** a sandbox runs Book List with `sites` and the user chooses the laureates' books
- **THEN** a sandbox runs Book List with the books, from a run link with no `sites`

#### Scenario: None
- **WHEN** the user chooses "None" in the collection list of a sandbox with a collection
- **THEN** a sandbox runs the same mod without a collection

### Requirement: Choosing a mosaic
Choosing another mosaic SHALL open that mosaic's run link, with no other params. Choosing the current mosaic SHALL close the list and open nothing.

#### Scenario: Other combination
- **WHEN** the user chooses "Books by Nobel laureates" in the mosaic list of "Nobel laureates on the map"
- **THEN** a sandbox runs Book List from that mosaic, and the stage bar's capsules show Book List, the laureates' books and "Books by Nobel laureates"

### Requirement: Counts are kept for the page
A tile-match count SHALL be measured once per mod and collection, or mod and tile, and kept until the app page is closed. "Reload tiles" SHALL drop the counts of the reloaded collection or tile. Measuring SHALL request each listed mod's mod file and tile type file, and the collection's file and tiles, but no entrypoint, library or mosaic file, and SHALL show nothing to the user.

#### Scenario: Second opening
- **WHEN** the user opens the mod list, closes it and opens it again
- **THEN** no file is requested again for counts already known
