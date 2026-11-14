# Spec Delta

## MODIFIED Requirements

### Requirement: Bundle check
The check SHALL load the mod file, its entrypoint, the files of its declared libraries, its tile type and the collection, and validate the collection's tiles against the type. A file that cannot be loaded or has the wrong format SHALL be an error finding whose source is that file and whose message is the load error's message. The collection's issues SHALL be findings with their own level and source. A failure to load the mod file SHALL be a report, not an error response.

#### Scenario: Fixture mod
- **WHEN** the bundle check runs on the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` with its sample collection
- **THEN** it has no findings and gives the three books of the sample collection as the tiles to mount

#### Scenario: Missing mod file
- **WHEN** the visible mod, with `open` granted for the app's origin, sends `mods.check` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the result is a report with status `"fail"`, `mountChecked` `false` and one `bundle` error whose source is `https://example.org/fixtures/mods/missing/mod_conf.yaml` and whose message names `404`

#### Scenario: Missing entrypoint
- **WHEN** a mod whose entrypoint answers HTTP 404 is checked
- **THEN** the report has status `"fail"` and a `bundle` error whose source is the entrypoint's address

#### Scenario: Missing library file
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/missing.js"]` is checked, and the npm host answers that file with HTTP 404 and the text `Couldn't find the requested file /dist/missing.js in leaflet.`
- **THEN** the report has status `"fail"`, `mountChecked` `false` and a `bundle` error whose source is `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/missing.js` and whose message names `leaflet`, `404` and that text

#### Scenario: Sample tile that does not match
- **WHEN** a mod whose sample collection has a tile without a field its type requires is checked
- **THEN** the report has a `bundle` warning whose source is that tile's source, and the other tiles are given to the mod
