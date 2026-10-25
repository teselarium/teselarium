## MODIFIED Requirements

### Requirement: Load a mod from a location
The system SHALL load a mod configuration file from a relative path or an absolute URL, with the same location rules as a tile. It SHALL return a loaded mod with `source` (resolved URL of the mod file), `name`, `title`, `version`, `description`, `entrypoint` (resolved URL), `code` (entrypoint text), `typeSource` (resolved URL or `null`), `sampleCollection` (resolved URL or `null`), `config` and `permissions`.

#### Scenario: Load the sample book list mod
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` is loaded and the server returns the files under `fixtures/`
- **THEN** the loaded mod has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, name `"book_list"`, title `"Book List"` and version `"1.0.0"`
- **AND** its `code` is the text of `fixtures/mods/book_list/main.js`

#### Scenario: Relative mod path with a base URL
- **WHEN** `./mods/book_list/mod_conf.yaml` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the mod file is requested from `https://example.org/fixtures/mods/book_list/mod_conf.yaml` and that is the loaded mod's source

### Requirement: Mod files and folders
Any other mod reference SHALL be a location, resolved against the base URL as for a tile. When its resolved path ends in `.yaml` or `.yml`, it SHALL be the mod file itself. Otherwise it SHALL be the mod's folder and mean the file `mod_conf.yaml` in it, with a `/` added after the folder when it is missing.

#### Scenario: Folder without a trailing slash
- **WHEN** the reference `./fixtures/mods/book_list` is resolved with base URL `https://example.org/`
- **THEN** the mod file is `https://example.org/fixtures/mods/book_list/mod_conf.yaml`

#### Scenario: Folder with a trailing slash
- **WHEN** the reference `https://mods.example.net/clock/` is resolved
- **THEN** the mod file is `https://mods.example.net/clock/mod_conf.yaml`

#### Scenario: Mod file with another name
- **WHEN** the reference `https://mods.example.net/clock/clock.yml` is resolved
- **THEN** the mod file is `https://mods.example.net/clock/clock.yml`

#### Scenario: Relative path without a slash
- **WHEN** the reference `Book-List` is resolved with base URL `https://example.org/`
- **THEN** it is read as a folder and the mod file is `https://example.org/Book-List/mod_conf.yaml`

### Requirement: One mod, one source
All the references to one mod file SHALL give the same `source`, so the mod keeps one identity whatever reference names it.

#### Scenario: One mod, one source
- **WHEN** the sample book list mod is loaded once as `./fixtures/mods/book_list`, once as `./fixtures/mods/book_list/` and once as `./fixtures/mods/book_list/mod_conf.yaml`, with base URL `https://example.org/`
- **THEN** the three loaded mods have the same source

### Requirement: Resolve mod paths against the mod file
The system SHALL resolve `entrypoint`, `type_path` and `sample_collection` against the location of the mod file, not against the base URL.

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
- **THEN** the loaded mod's `sampleCollection` is `https://example.org/fixtures/tiles/books_collection.yaml`
- **AND** the collection file is not requested

