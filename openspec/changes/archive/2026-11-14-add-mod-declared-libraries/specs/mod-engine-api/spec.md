# Spec Delta

## MODIFIED Requirements

### Requirement: Inspect a mod
`mods.inspect` with `{ mod }`, where `mod` is a mod reference, SHALL load the mod file without fetching its entrypoint and return `source`, `name`, `title`, `version`, `description`, `typeSource`, `sampleCollection`, `config`, `libraries`, the mod's declared libraries as the loaded mod carries them, and `permissions`, with the `granted` and `denied` lists that mod would get if it were opened. Inspecting SHALL NOT fetch any library file. When the mod file cannot be loaded, the engine SHALL answer with error code `-32001` and the load error's message.

#### Scenario: Inspect the sample mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/book_list" }`
- **THEN** the result has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, title `"Book List"`, `sampleCollection` `https://example.org/fixtures/tiles/books_collection.yaml`, and the `show` permission in `permissions.granted`
- **AND** `main.js` is not requested

#### Scenario: Inspect a mod with a library
- **WHEN** a mod with `open` granted for the app's origin inspects a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js"]`
- **THEN** the result's `libraries` has one entry with name `"leaflet"`, package `"leaflet"`, version `"1.9.4"` and the file whose source is `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js`
- **AND** that file is not requested

#### Scenario: Inspect a missing mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the response has an error with code `-32001` whose message names `https://example.org/fixtures/mods/missing/mod_conf.yaml` and `404`
