## MODIFIED Requirements

### Requirement: Check a mod
`mods.check` with `{ mod, collection }`, where `mod` is a mod reference and `collection` an optional collection location, SHALL check the mod and return a report once the check is done. Relative references and locations SHALL be resolved against the app's address. The tiles SHALL come from `collection` when it is given, from the mod's sample collection otherwise, and there SHALL be none when the mod declares no sample collection.

#### Scenario: Check the sample mod
- **WHEN** the visible mod viewer of the app at `https://example.org/` sends `mods.check` with the relative reference of a mod that passes every check
- **THEN** the result is a report whose source is the mod file's address resolved against `https://example.org/`, with status `"pass"`, `mountChecked` `true` and no findings

#### Scenario: Check with another collection
- **WHEN** the visible mod viewer sends `mods.check` for a mod that declares a sample collection, with a collection of two books
- **THEN** the mount check gives the mod those two books, and the mod's sample collection is not requested

#### Scenario: Mod without a sample collection
- **WHEN** the visible mod viewer checks a mod that declares no `sample_collection`, without `collection`
- **THEN** the mod is mounted with no tiles and no collection file is requested

### Requirement: Mount check
When the bundle check found no error, the check SHALL mount the mod in a hidden frame, with the content policy and permissions it would get if it were opened and with the tiles that match its type. The check SHALL end 1 second after the mod's `mount` call finished, and the frame SHALL then be removed. When the bundle check found an error, the mount check SHALL NOT run and the entrypoint SHALL NOT be run.

#### Scenario: Bundle error skips the mount
- **WHEN** a mod whose tile type file answers HTTP 404 is checked
- **THEN** the report has `mountChecked` `false` and the mod's code is not run

#### Scenario: Frame removed after the check
- **WHEN** a mod has been checked
- **THEN** no frame of the check is left in the page

### Requirement: Throwaway storage slot
During the mount check, the mod SHALL have a storage slot that starts empty and is discarded when the check ends. The mod's real slot SHALL be neither read nor written.

#### Scenario: Real slot untouched
- **WHEN** a running mod stored a value under a key of its storage slot, and the mod is then checked
- **THEN** during the check the mod's `storage.get` for that key returns `null`
- **AND** after the check, the mod's `storage.get` for that key returns the stored value
