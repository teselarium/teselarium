## MODIFIED Requirements

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod reference in its config's `mods` with the title and description it gets from `mods.inspect`. A reference that cannot be inspected SHALL be listed with the reference and the error message. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Book List` with the description `A grid of book covers, with a card for each book that shows its details and text.`

#### Scenario: Vanilla explorer lists the flashcards sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Flashcards` after `Book List`, with the flashcards mod's description

#### Scenario: Select a mod
- **WHEN** the mod explorer lists a mod and the user selects it
- **THEN** the mod viewer is the visible mod and shows the selected mod's title
- **AND** the app's address is a run link with `mod=mod_viewer` and the selected mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame lists `./samples/mods/missing` with a message that names `404`

### Requirement: Mod viewer runs the mod
The mod viewer SHALL offer to run the viewed mod with its sample collection (only when the mod declares one), with a collection whose address the user types, or without tiles. Each choice SHALL send `mods.open` with the mod's source as `mod` and, when there is one, the chosen collection as `collection`. A typed address SHALL be sent as typed, without surrounding spaces, whether it is a full address or a relative path, which is resolved against the app's address.

#### Scenario: Run with the sample tiles
- **WHEN** the viewer shows a mod whose sample collection has three tiles of its type, and the user chooses to run it with its sample tiles
- **THEN** the viewed mod is the visible mod and receives the three tiles of its sample collection
- **AND** the mod viewer is hidden and still running

#### Scenario: Run with a typed collection
- **WHEN** the user types the address of a collection with two books and chooses to run the mod with it
- **THEN** the viewed mod receives the two books

#### Scenario: Run with a relative collection address
- **WHEN** the app's address is `https://example.org/`, a collection with two books is at `https://example.org/test-mods/two_books.yaml`, and the user types `./test-mods/two_books.yaml` and chooses to run the mod with it
- **THEN** the opened run link's `collection` is `./test-mods/two_books.yaml`
- **AND** the viewed mod receives the two books, and the viewer shows no alert

#### Scenario: Run with a bare relative path
- **WHEN** the app's address is `https://example.org/`, a collection with two books is at `https://example.org/test-mods/two_books.yaml`, and the user types `test-mods/two_books.yaml` and chooses to run the mod with it
- **THEN** the viewed mod receives the two books

#### Scenario: Run without tiles
- **WHEN** the user chooses to run the viewed mod without tiles
- **THEN** the opened link has no `collection` and the mod runs with no tiles

#### Scenario: Mod without a sample collection
- **WHEN** the viewer shows a mod that declares no `sample_collection`
- **THEN** the viewer offers no choice to run it with sample tiles

### Requirement: Mod viewer checks the mod
While the mod viewer shows a mod, it SHALL have a "Check mod" button that sends `mods.check` with the viewed mod's source, and the typed collection whenever the collection field is not empty, sent as typed, without surrounding spaces, as "Run with this collection" sends it. Without a mod to show, it SHALL have no such button. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mod is being checked.

#### Scenario: Checking in progress
- **WHEN** the user presses "Check mod" for a mod whose `mount` takes 3 seconds
- **THEN** until the report arrives, the button is disabled and the viewer says that the mod is being checked

#### Scenario: No button without a mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame has no "Check mod" button

#### Scenario: Check with a relative collection address
- **WHEN** the app's address is `https://example.org/`, the viewer shows a mod that declares a sample collection, and the user types `./test-mods/missing.yaml`, which answers HTTP 404, and presses "Check mod"
- **THEN** the report shows an error finding whose source is `https://example.org/test-mods/missing.yaml` and whose message names `404`
- **AND** the mod's sample collection is not requested

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-ot-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, each test case with its status and message, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows a mod whose check passes, with a test file of two cases, and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed, with a `success` badge and no findings
- **AND** it lists the mod's two cases, both passed
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a `destructive` badge and a bundle error that names the entrypoint's address and `404`

#### Scenario: Failing case
- **WHEN** the viewer checks a mod whose case `lists books` fails with `no books`
- **THEN** the viewer's frame shows a `destructive` badge and lists `lists books` as failed with the message `no books`
