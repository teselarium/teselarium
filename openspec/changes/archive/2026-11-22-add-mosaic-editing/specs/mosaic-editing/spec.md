# Spec Delta

## Purpose

Lets users make and change mosaics of their own: a draft edited as a form or as YAML, checked as it is typed, saved through a confirmation where the user also allows the draft's `show` lines, with a history of versions to go back to.

## ADDED Requirements

### Requirement: A draft is the mosaic file's text
A draft SHALL be the full text of a mosaic file, with the address it will be saved at, or none for a new mosaic. Relative references in a draft SHALL resolve against that address. In a new mosaic, a relative `mod` or `collection` SHALL be an error that asks for an absolute address.

#### Scenario: Relative collection in a new mosaic
- **WHEN** a new draft has `collection: "../tiles/laureates"`
- **THEN** validating it reports an error that says `collection` must be an absolute address in a new mosaic

### Requirement: Validating a draft
Validating a draft SHALL report, without asking the user or opening anything, the YAML and format errors of the mosaic loader, each with its line when it has one, and the check's mosaic warnings: an alias for a field the mod's tile type does not declare, and a config key the mod's config does not have. A mod or collection that cannot be loaded SHALL be an error naming its address, and the rest SHALL still be reported.

#### Scenario: Missing collection
- **WHEN** a draft's collection answers HTTP 404
- **THEN** validating it reports an error that names the collection's address and `404`, and the tile type's fields

#### Scenario: Unknown alias field
- **WHEN** a draft's aliases name the field `colour`, which the tile type does not declare
- **THEN** validating it reports a warning that names `colour`

#### Scenario: YAML that does not parse
- **WHEN** a draft's line 4 has a tab where YAML needs spaces
- **THEN** validating it reports one error at line 4, and no hints

### Requirement: Fields of a draft
Validating a draft SHALL also report the fields it holds as written, so a form can show them without reading YAML: its title, description, mod and collection as text, its aliases, and its `show` lines. A value that is missing or has the wrong type SHALL be reported as none, and the fields of a draft that cannot be read SHALL be none at all.

#### Scenario: After a YAML edit
- **WHEN** the user changes the title in the YAML tab and the draft is validated
- **THEN** the validation reports the new title, and the form shows it

### Requirement: Hints of a draft
Validating a draft SHALL also report the hints for its aliases: the tile type's fields, each marked required or optional, the field names the collection's tiles use, and how many of the collection's tiles match the tile type after the draft's aliases, out of how many. Without a collection, or when the draft does not parse, there SHALL be no count.

#### Scenario: Laureates on the map
- **WHEN** a draft pairs the country map with the laureates' collection and has the aliases `title ← name` and `country ← birth_country`
- **THEN** validating it reports no error, the tile type's fields `title` and `country` as required, the collection's field names including `name` and `birth_country`, and every tile matching

### Requirement: Form edits keep the YAML
Applying the form's edits to a draft SHALL change only the keys they set (`title`, `description`, `mod`, `collection`, `aliases`, `permissions.show`), and SHALL keep the other keys, their order, the comments and the quoting of the untouched values. Removing a value SHALL remove its key. A draft that does not parse SHALL be refused, with the parse error.

#### Scenario: Title changed in the form
- **WHEN** the draft has a comment above `config` and the user changes the title in the form
- **THEN** the new text differs from the old one only on the `title` line, and the comment is still there

#### Scenario: Alias added
- **WHEN** the user adds `country ← birth_country` in the form to a draft without aliases
- **THEN** the text gains an `aliases` mapping with `country: ["birth_country"]` inside `mosaic`, and the rest is unchanged

### Requirement: The save confirmation
Saving a draft SHALL show an app dialog titled "Save mosaic" that lists what changes from the saved version, or the whole mosaic for a new one: the title, description, mod, collection, aliases, config keys, and each `show` line added or removed. Each added line's host SHALL be highlighted. "Save" SHALL save, and "Cancel" or Escape SHALL save nothing. A draft with errors SHALL NOT be saved: the dialog SHALL list the errors and offer only "Close".

#### Scenario: New host
- **WHEN** the user saves a draft that adds the `show` line `https://upload.wikimedia.org` with the reason "Shows the portraits"
- **THEN** the dialog lists that line as added, with its host highlighted, and "Save" saves the draft

#### Scenario: Draft with errors
- **WHEN** the user saves a draft without a title
- **THEN** the dialog lists the error, offers only "Close", and nothing is saved

### Requirement: Consent at save
When the user presses "Save", each `show` line of the saved mosaic SHALL be remembered as allowed for the mosaic's address (see `site-consent`), so opening it asks nothing for those lines. Lines that come from an import or an update from a file SHALL NOT be remembered this way, and SHALL be asked as for any other mosaic.

#### Scenario: Saved, then opened
- **WHEN** the user saves a mosaic with the `show` line `https://upload.wikimedia.org` and opens it
- **THEN** no site consent dialog is shown for that line, and the line is granted
- **AND** Settings lists Allow for that line under the mosaic

#### Scenario: Imported, then opened
- **WHEN** the user imports a mosaic file with a `show` line and opens it
- **THEN** the site consent dialog asks about that line

### Requirement: Saving a stored mosaic
Saving a draft of a stored mosaic SHALL replace its file at the same address with the draft's text, add a version, and set its update time.

#### Scenario: Saved again
- **WHEN** the user edits a stored mosaic's aliases and saves
- **THEN** the mosaic opens with the new aliases from the same address, and its history holds the previous version

### Requirement: Saving a new mosaic
Saving a new draft SHALL store it as a new user catalog entry with a root of its own (see `browser-files`), as a single file named after its title in lower case, with letters, digits and underscores, followed by `.yaml`, or `mosaic.yaml` when nothing is left. Its provenance SHALL have no folder, that path, and the address it was copied from, if any.

#### Scenario: Saved from a copy
- **WHEN** the user edits a copy of `https://example.org/samples/mosaics/nobel_laureates_map.yaml`, titled "Laureates, my way", and saves
- **THEN** the catalog lists a stored mosaic at `opentesela-browser:///<root>/laureates_my_way.yaml`, listed by the user, copied from that address

### Requirement: Copies have absolute references
Starting a copy of a mosaic SHALL rewrite its relative `mod` and `collection` as the absolute addresses they resolve to from the original, with the form's comment-keeping edits, and keep everything else.

#### Scenario: Copy of a sample mosaic
- **WHEN** the user starts a copy of `nobel_books_list.yaml`, whose `mod` is `../mods/book_list`
- **THEN** the draft's `mod` is `https://example.org/samples/mods/book_list`, and its `config` and `permissions` are as in the original

### Requirement: A mosaic from a combination
Starting a mosaic from an unsaved combination SHALL make a new draft titled after the combination (see "Title of a mosaic from a combination"), with the combination's mod and collection as absolute addresses, or no collection for "None", and the `show` lines of its `sites` mosaic, if it has one. A combination opened with a tile SHALL NOT start one.

#### Scenario: Flashcards with the laureates' books
- **WHEN** the user starts a mosaic from Flashcards with the laureates' books, opened with the `sites` of "Books by Nobel laureates"
- **THEN** the draft names those mod and collection addresses, and holds the four `show` lines of "Books by Nobel laureates"

### Requirement: Title of a mosaic from a combination
A draft started from a combination SHALL be titled with its mod's title and its collection's title as `<mod> + <collection>`, or the mod's title alone for "None". When either title cannot be read, it SHALL be titled "Untitled mosaic".

#### Scenario: Titled after the laureates' books
- **WHEN** the user starts a mosaic from Flashcards with the laureates' books
- **THEN** the draft is titled "Flashcards + Nobel Prize in Literature laureates books"

#### Scenario: Title that cannot be read
- **WHEN** the user starts a mosaic from a combination whose collection answers HTTP 404
- **THEN** the draft is titled "Untitled mosaic"

### Requirement: Version history
Each stored mosaic SHALL keep its versions: the imported text, each update from a file, each save and each restore, each with its time and kind. It SHALL keep the 20 newest, and SHALL always keep the version last imported or exported. Removing the entry SHALL remove its versions.

#### Scenario: Twenty-second save
- **WHEN** a mosaic was imported and then saved 21 times
- **THEN** its history holds 21 versions: the 20 newest saves and the imported one, kept since it is the version last imported

### Requirement: History dialog
The history dialog SHALL be titled "History of <title>" and list the versions newest first, each with its time, its kind ("Imported", "Updated from file", "Saved" or "Restored") and a "Restore" button, except the current one. Restoring SHALL open the save confirmation for that version's text, and saving it SHALL add a "Restored" version.

#### Scenario: Restore the imported text
- **WHEN** the user opens the history of an edited mosaic and presses "Restore" on the "Imported" version, then "Save"
- **THEN** the mosaic's text is the imported text again, and its history starts with a "Restored" version

### Requirement: Editing dialogs on a phone
On a 360×740 viewport, the save confirmation and the history dialog SHALL fit the viewport's width without scrolling sideways, their lists SHALL scroll inside them, and their buttons SHALL be at least 32px wide and tall.

#### Scenario: Long change list on a phone
- **WHEN** the save confirmation lists eight changes on a 360×740 viewport
- **THEN** the dialog is no wider than the viewport, its list scrolls inside it, and "Save" and "Cancel" stay visible

### Requirement: Highlighted hosts in both color schemes
An added `show` line's host in the save confirmation SHALL be shown as a warning badge, and a removed line as an outline badge, each with text at a contrast of at least 4.5:1 with its fill, in the light and in the dark color scheme.

#### Scenario: Added host in both schemes
- **WHEN** the save confirmation lists an added host, in the light color scheme and then in the dark one
- **THEN** the host is a warning badge whose text has a contrast of at least 4.5:1 with its fill
