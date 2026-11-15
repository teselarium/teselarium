# Spec Delta

## MODIFIED Requirements

### Requirement: Mod file
The mod file SHALL give the mod the title "Flashcards", and SHALL declare `api: "^0.1.14"`, the first mod API version with `default_mosaic`, its tile type `./flashcard_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, whose mosaic names the mod's own folder and the sample deck `./flashcard_collection.yaml` as its collection. Neither the mod file nor its default mosaic SHALL declare permissions. The sample deck's collection file SHALL use `title`.

#### Scenario: Inspect the sample
- **WHEN** `mods.inspect` is sent for `./samples/mods/flashcards`
- **THEN** the answer has the title "Flashcards", a tile type and a default mosaic, and its permissions have no granted and no denied entry

#### Scenario: Study fields per deck
- **WHEN** the user chooses study fields while the mod is opened from its default mosaic, and then opens the mod with another collection
- **THEN** the setup does not start from the fields chosen for the sample deck
