# Spec Delta

## MODIFIED Requirements

### Requirement: Load a mod from a location
The system SHALL load a mod configuration file from a relative path or an absolute URL, with the same location rules as a tile. It SHALL return a loaded mod with `source` (resolved URL of the mod file), `title`, `version`, `description`, `entrypoint` (resolved URL), `code` (entrypoint text), `typeSource` (resolved URL or `null`), `defaultMosaic` (resolved URL or `null`), `config` and `permissions`.

#### Scenario: Load the sample book list mod
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` is loaded and the server returns the files under `fixtures/`
- **THEN** the loaded mod has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, title `"Book List"` and version `"1.0.0"`, and no `name`
- **AND** its `code` is the text of `fixtures/mods/book_list/main.js`

#### Scenario: Relative mod path with a base URL
- **WHEN** `./mods/book_list/mod_conf.yaml` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the mod file is requested from `https://example.org/fixtures/mods/book_list/mod_conf.yaml` and that is the loaded mod's source

### Requirement: Resolve mod paths against the mod file
The system SHALL resolve `entrypoint`, `type_path` and `default_mosaic` against the location of the mod file, not against the base URL.

#### Scenario: Entrypoint next to the mod file
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` declares `entrypoint: "./main.js"`
- **THEN** the entrypoint is requested from `https://example.org/fixtures/mods/book_list/main.js` and that is the loaded mod's `entrypoint`

#### Scenario: Tile type outside the mod folder
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` declares `type_path: "../../types/book.md"`
- **THEN** the loaded mod's `typeSource` is `https://example.org/fixtures/types/book.md`

#### Scenario: Mod without a tile type
- **WHEN** a mod file has no `type_path`
- **THEN** the loaded mod's `typeSource` is `null`

#### Scenario: Sample collection outside the mod folder
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` declares `sample_collection: "../../tiles/books_collection.yaml"`
- **THEN** the key is ignored: the loaded mod has no `sampleCollection` and its `defaultMosaic` is `null`
- **AND** the collection file is not requested

#### Scenario: Default mosaic next to the mod file
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` declares `default_mosaic: "./mosaic.yaml"`
- **THEN** the loaded mod's `defaultMosaic` is `https://example.org/fixtures/mods/book_list/mosaic.yaml`
- **AND** the mosaic file is not requested

### Requirement: Mod file format
A mod file SHALL have a `mod` mapping with non-empty string `title`, `version` and `entrypoint`. `description` SHALL be an optional string, defaulting to `""`. `type_path` and `default_mosaic` SHALL be optional non-empty strings. `config` SHALL be an optional mapping, defaulting to an empty mapping. Other keys SHALL be ignored, `name` and `sample_collection` included.

#### Scenario: Minimal mod file
- **WHEN** a mod file has only `title: "Minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod has title `"Minimal"`, description `""`, `typeSource` `null`, `defaultMosaic` `null`, config `{}` and no permissions

#### Scenario: Unknown keys are ignored
- **WHEN** a mod file has an extra key `author: "Alice"` under `mod`
- **THEN** the mod loads and the loaded mod has no `author` property

#### Scenario: Former keys are ignored
- **WHEN** a mod file has `name: "book_list"` and `sample_collection: "./books.yaml"` besides its `title`
- **THEN** the mod loads, the loaded mod has no `name`, its `defaultMosaic` is `null`, and `./books.yaml` is not requested

#### Scenario: Config is kept as plain data
- **WHEN** the sample book list mod is loaded
- **THEN** the loaded mod's `config` deep-equals the `config` mapping of its mod file

### Requirement: Reject mod files with the wrong structure
The system SHALL fail with a mod format error when the mod file does not follow the mod file format. The error SHALL carry the mod file's source, and its message SHALL include the source and the reason.

#### Scenario: No mod mapping
- **WHEN** a mod file at `https://example.org/mods/broken/mod_conf.yaml` has no `mod` mapping
- **THEN** loading fails with a mod format error whose source is `https://example.org/mods/broken/mod_conf.yaml` and whose message says that a `mod` mapping is required

#### Scenario: Missing entrypoint
- **WHEN** a mod file has no `entrypoint`
- **THEN** loading fails with a mod format error whose message says that `entrypoint` must be a non-empty string

#### Scenario: Missing title
- **WHEN** a mod file has `name: "clock"` and no `title`
- **THEN** loading fails with a mod format error whose message says that `title` must be a non-empty string

#### Scenario: Version written as a number
- **WHEN** a mod file has `version: 1`
- **THEN** loading fails with a mod format error whose message says that `version` must be a non-empty string

#### Scenario: Config is not a mapping
- **WHEN** a mod file has `config` as a list
- **THEN** loading fails with a mod format error whose message says that `config` must be a mapping

#### Scenario: Empty sample collection
- **WHEN** a mod file has `sample_collection: ""`
- **THEN** the mod loads, since `sample_collection` is no longer read

#### Scenario: Empty default mosaic
- **WHEN** a mod file has `default_mosaic: ""`
- **THEN** loading fails with a mod format error whose message says that `default_mosaic` must be a non-empty string
