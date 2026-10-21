# mod-loading Specification

## Purpose

Reads a mod configuration file (`mod_conf.yaml`), named by a default mod name, a folder or the file itself, into a plain loaded mod: its metadata, its default config, the tile type it needs, the sample tiles it comes with, the web hosts and mods it declares it needs, and the code of its entrypoint, ready to be run in a sandbox.

## Requirements

### Requirement: Load a mod from a location
The system SHALL load a mod configuration file from a relative path or an absolute URL, with the same location rules as a tile. It SHALL return a loaded mod with `source` (resolved URL of the mod file), `name`, `title`, `version`, `description`, `entrypoint` (resolved URL), `code` (entrypoint text), `typeSource` (resolved URL or `null`), `sampleCollection` (resolved URL or `null`), `config` and `permissions`.

#### Scenario: Load the sample book list mod
- **WHEN** the mod at `https://example.org/samples/mods/book_list/mod_conf.yaml` is loaded and the server returns the files under `public/samples/`
- **THEN** the loaded mod has source `https://example.org/samples/mods/book_list/mod_conf.yaml`, name `"book_list"`, title `"Book List"` and version `"1.0.0"`
- **AND** its `code` is the text of `public/samples/mods/book_list/main.js`

#### Scenario: Relative mod path with a base URL
- **WHEN** `./mods/book_list/mod_conf.yaml` is loaded with base URL `https://example.org/samples/`
- **THEN** the mod file is requested from `https://example.org/samples/mods/book_list/mod_conf.yaml` and that is the loaded mod's source

### Requirement: Default mod names
A mod reference without `/` that matches `^[a-z][a-z0-9_]*$` SHALL be a default mod name, and SHALL mean the file `<name>/mod_conf.yaml` in the default mods folder.

#### Scenario: Default mod name
- **WHEN** the reference `mod_viewer` is resolved with the default mods folder `https://example.org/default_mods/`
- **THEN** the mod file is `https://example.org/default_mods/mod_viewer/mod_conf.yaml`

### Requirement: Mod files and folders
Any other mod reference SHALL be a location, resolved against the base URL as for a tile. When its resolved path ends in `.yaml` or `.yml`, it SHALL be the mod file itself. Otherwise it SHALL be the mod's folder and mean the file `mod_conf.yaml` in it, with a `/` added after the folder when it is missing.

#### Scenario: Folder without a trailing slash
- **WHEN** the reference `./samples/mods/book_list` is resolved with base URL `https://example.org/`
- **THEN** the mod file is `https://example.org/samples/mods/book_list/mod_conf.yaml`

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
- **WHEN** the sample book list mod is loaded once as `./samples/mods/book_list`, once as `./samples/mods/book_list/` and once as `./samples/mods/book_list/mod_conf.yaml`, with base URL `https://example.org/`
- **THEN** the three loaded mods have the same source

### Requirement: Resolve mod paths against the mod file
The system SHALL resolve `entrypoint`, `type_path` and `sample_collection` against the location of the mod file, not against the base URL.

#### Scenario: Entrypoint next to the mod file
- **WHEN** the mod at `https://example.org/samples/mods/book_list/mod_conf.yaml` declares `entrypoint: "./main.js"`
- **THEN** the entrypoint is requested from `https://example.org/samples/mods/book_list/main.js` and that is the loaded mod's `entrypoint`

#### Scenario: Tile type outside the mod folder
- **WHEN** the mod at `https://example.org/samples/mods/book_list/mod_conf.yaml` declares `type_path: "../../types/book.md"`
- **THEN** the loaded mod's `typeSource` is `https://example.org/samples/types/book.md`

#### Scenario: Mod without a tile type
- **WHEN** a mod file has no `type_path`
- **THEN** the loaded mod's `typeSource` is `null`

#### Scenario: Sample collection outside the mod folder
- **WHEN** the mod at `https://example.org/samples/mods/book_list/mod_conf.yaml` declares `sample_collection: "../../tiles/books_collection.yaml"`
- **THEN** the loaded mod's `sampleCollection` is `https://example.org/samples/tiles/books_collection.yaml`
- **AND** the collection file is not requested

### Requirement: Mod file format
A mod file SHALL have a `mod` mapping with non-empty string `name`, `version` and `entrypoint`. `title` and `description` SHALL be optional strings, defaulting to `name` and `""`. `type_path` and `sample_collection` SHALL be optional non-empty strings. `config` SHALL be an optional mapping, defaulting to an empty mapping. Other keys SHALL be ignored.

#### Scenario: Minimal mod file
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod has title `"minimal"`, description `""`, `typeSource` `null`, `sampleCollection` `null`, config `{}` and no permissions

#### Scenario: Unknown keys are ignored
- **WHEN** a mod file has an extra key `author: "Alice"` under `mod`
- **THEN** the mod loads and the loaded mod has no `author` property

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

#### Scenario: Version written as a number
- **WHEN** a mod file has `version: 1`
- **THEN** loading fails with a mod format error whose message says that `version` must be a non-empty string

#### Scenario: Config is not a mapping
- **WHEN** a mod file has `config` as a list
- **THEN** loading fails with a mod format error whose message says that `config` must be a mapping

#### Scenario: Empty sample collection
- **WHEN** a mod file has `sample_collection: ""`
- **THEN** loading fails with a mod format error whose message says that `sample_collection` must be a non-empty string

### Requirement: Tile type by path only
The system SHALL reject a mod file that has a `schema` key under `mod` with a mod format error whose message says that inline schemas are not supported yet and that `type_path` must be used.

#### Scenario: Inline schema
- **WHEN** a mod file has a `schema` mapping under `mod`
- **THEN** loading fails with a mod format error whose message mentions `schema` and `type_path`

### Requirement: Permission declarations
`permissions` SHALL be an optional mapping whose keys are among `show`, `connect`, `embed`, `code` and `open`. Each SHALL be a list of mappings with a non-empty string `host` and a non-empty string `reason`. The loaded mod's `permissions` SHALL be a list of `{ category, host, reason }`, in the order `show`, `connect`, `embed`, `code`, `open`, then in the order of the entries.

#### Scenario: Sample show permission
- **WHEN** the sample book list mod is loaded
- **THEN** its permissions are exactly one entry with category `"show"`, host `"https://upload.wikimedia.org"` and reason `"Shows the book covers"`

#### Scenario: Several categories keep their order
- **WHEN** a mod file declares one `code` entry and then one `show` entry
- **THEN** the loaded mod's permissions list the `show` entry first and the `code` entry second

#### Scenario: Unknown category
- **WHEN** a mod file declares `permissions: { shows: [...] }`
- **THEN** loading fails with a mod format error whose message names `shows` and the five allowed categories

#### Scenario: Missing reason
- **WHEN** a `connect` entry has a `host` and no `reason`
- **THEN** loading fails with a mod format error whose message says that `reason` must be a non-empty string

### Requirement: Permission hosts are origins
Each permission `host` SHALL be an origin: an `http:` or `https:` scheme, a host name and an optional port, with no path, query, fragment or wildcard. In `open` only, the host SHALL also be allowed to be exactly `"*"`, meaning any site. Any other value SHALL fail with a mod format error that names the host.

#### Scenario: Host with a port
- **WHEN** a `connect` entry has host `"http://localhost:8080"`
- **THEN** the mod loads and the permission's host is `"http://localhost:8080"`

#### Scenario: Host with a path
- **WHEN** a `show` entry has host `"https://example.org/images"`
- **THEN** loading fails with a mod format error whose message names `https://example.org/images` and says that a host must be an origin

#### Scenario: Wildcard host
- **WHEN** a `show` entry has host `"https://*.example.org"`
- **THEN** loading fails with a mod format error whose message names `https://*.example.org`

#### Scenario: Other scheme
- **WHEN** a `connect` entry has host `"wss://example.org"`
- **THEN** loading fails with a mod format error whose message names `wss://example.org`

#### Scenario: Any site for open
- **WHEN** an `open` entry has host `"*"`
- **THEN** the mod loads and the permission's host is `"*"`

#### Scenario: Any site outside open
- **WHEN** a `show` entry has host `"*"`
- **THEN** loading fails with a mod format error whose message says that `"*"` is only allowed in `permissions.open`

### Requirement: Mod file is plain YAML
The mod file SHALL follow the same plain YAML rules as a collection file. A mod file that is not plain YAML, or has no mapping at its top level, SHALL fail with a YAML parse error that carries its source.

#### Scenario: Invalid YAML
- **WHEN** the mod file is not valid YAML
- **THEN** loading fails with a YAML parse error whose source is the mod file's source

### Requirement: Report mod files and entrypoints that cannot be fetched
The system SHALL fail with a fetch error when the mod file or its entrypoint cannot be fetched or read. The error SHALL carry the source of the file that failed.

#### Scenario: Mod file HTTP 404
- **WHEN** the mod at `https://example.org/mods/missing/mod_conf.yaml` is loaded and the server answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/mods/missing/mod_conf.yaml` and whose message includes `404`

#### Scenario: Entrypoint HTTP 404
- **WHEN** the mod file loads and its entrypoint `https://example.org/mods/broken/main.js` answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/mods/broken/main.js`

#### Scenario: Failure kinds are told apart
- **WHEN** one mod fails because its file is missing, one because its format is wrong and one because its YAML is invalid
- **THEN** the three errors are respectively a fetch error, a mod format error and a YAML parse error

### Requirement: Loaded mods are plain data
A loaded mod SHALL contain only plain data (strings, numbers, booleans, null, lists and mappings), and two loads of the same mod SHALL not share objects.

#### Scenario: Structured clone of a loaded mod
- **WHEN** the sample book list mod is loaded and a structured clone of it is made
- **THEN** the clone deep-equals the loaded mod

#### Scenario: Independent loads
- **WHEN** the sample book list mod is loaded twice and the first result's `config` is changed
- **THEN** the second result's `config` is unchanged
