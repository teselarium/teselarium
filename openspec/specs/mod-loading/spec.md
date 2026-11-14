# mod-loading Specification

## Purpose

Reads a mod configuration file (`mod_conf.yaml`), named by a default mod name, a folder or the file itself, into a plain loaded mod: its metadata, its default config, the tile type it needs, the sample tiles it comes with, the web hosts and mods it declares it needs, and the code of its entrypoint, ready to be run in a sandbox.

## Requirements

### Requirement: Load a mod from a location
The system SHALL load a mod configuration file from a relative path or an absolute URL, with the same location rules as a tile. It SHALL return a loaded mod with `source` (resolved URL of the mod file), `name`, `title`, `version`, `description`, `entrypoint` (resolved URL), `code` (entrypoint text), `typeSource` (resolved URL or `null`), `sampleCollection` (resolved URL or `null`), `config` and `permissions`.

#### Scenario: Load the sample book list mod
- **WHEN** the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` is loaded and the server returns the files under `fixtures/`
- **THEN** the loaded mod has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, name `"book_list"`, title `"Book List"` and version `"1.0.0"`
- **AND** its `code` is the text of `fixtures/mods/book_list/main.js`

#### Scenario: Relative mod path with a base URL
- **WHEN** `./mods/book_list/mod_conf.yaml` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the mod file is requested from `https://example.org/fixtures/mods/book_list/mod_conf.yaml` and that is the loaded mod's source

### Requirement: Default mod names
A mod reference without `/` that matches `^[a-z][a-z0-9_]*$` SHALL be a default mod name, and SHALL mean the file `<name>/mod_conf.yaml` in the default mods folder.

#### Scenario: Default mod name
- **WHEN** the reference `mod_viewer` is resolved with the default mods folder `https://example.org/default_mods/`
- **THEN** the mod file is `https://example.org/default_mods/mod_viewer/mod_conf.yaml`

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

### Requirement: Permission host format
Each permission `host` SHALL be an origin: an `http:` or `https:` scheme, a host name and an optional port, with no path, query or fragment, unless it is a wildcard host outside `open` or `"*"` in `open`, as the requirements "Wildcard hosts outside open" and "Any site in open" allow. Any other value SHALL fail with a mod format error that names the host.

#### Scenario: Host with a port
- **WHEN** a `connect` entry has host `"http://localhost:8080"`
- **THEN** the mod loads and the permission's host is `"http://localhost:8080"`

#### Scenario: Host with a path
- **WHEN** a `show` entry has host `"https://example.org/images"`
- **THEN** loading fails with a mod format error whose message names `https://example.org/images` and says that a host must be an origin

#### Scenario: Other scheme
- **WHEN** a `connect` entry has host `"wss://example.org"`
- **THEN** loading fails with a mod format error whose message names `wss://example.org`

### Requirement: Wildcard hosts outside open
In `show`, `connect`, `embed` and `code`, a permission `host` SHALL also be allowed to be a wildcard host: an origin whose host name starts with `*.` as its whole leftmost label, followed by at least two labels, such as `https://*.us.archive.org`. A `*` anywhere else SHALL be rejected, and a wildcard host in `open` SHALL be rejected, each with a mod format error that names the host.

#### Scenario: Wildcard host
- **WHEN** a `show` entry has host `"https://*.us.archive.org"`
- **THEN** the mod loads and the permission's host is `"https://*.us.archive.org"`

#### Scenario: Wildcard host with a port
- **WHEN** a `connect` entry has host `"http://*.example.test:8080"`
- **THEN** the mod loads and the permission's host is `"http://*.example.test:8080"`

#### Scenario: Wildcard inside a label
- **WHEN** a `show` entry has host `"https://cdn*.example.org"`
- **THEN** loading fails with a mod format error whose message names `https://cdn*.example.org`

#### Scenario: Wildcard after the first label
- **WHEN** a `show` entry has host `"https://a.*.example.org"`
- **THEN** loading fails with a mod format error whose message names `https://a.*.example.org`

#### Scenario: Wildcard over a single label
- **WHEN** a `code` entry has host `"https://*.org"`
- **THEN** loading fails with a mod format error whose message names `https://*.org`

#### Scenario: Wildcard host in open
- **WHEN** an `open` entry has host `"https://*.example.org"`
- **THEN** loading fails with a mod format error whose message names `https://*.example.org` and says that wildcard hosts are not allowed in `permissions.open`

### Requirement: Any site in open
In `open` only, a permission `host` SHALL also be allowed to be exactly `"*"`, meaning any site. In `show`, `connect`, `embed` and `code`, `"*"` SHALL fail with a mod format error.

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

### Requirement: Theme setting in the mod file
The `mod` mapping SHALL accept an optional `theme` key whose value is `"default"` or `"none"`, defaulting to `"default"`. The loaded mod SHALL carry the value as `theme`. Any other value SHALL fail with a mod format error whose message says that `theme` must be `"default"` or `"none"`.

#### Scenario: No theme key
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `theme` is `"default"`

#### Scenario: Opt out
- **WHEN** a mod file has `theme: "none"` under `mod`
- **THEN** the loaded mod's `theme` is `"none"`

#### Scenario: Unknown theme value
- **WHEN** a mod file has `theme: "dark"` under `mod`
- **THEN** loading fails with a mod format error whose message says that `theme` must be `"default"` or `"none"`

### Requirement: API range in the mod file
The `mod` mapping SHALL accept an optional `api` key whose value is a semver range in npm's syntax. The loaded mod SHALL carry the range as `api`, or `null` when the key is missing. A value that is not a non-empty string, or not a valid range, SHALL fail with a mod format error whose message says that `api` must be a semver range.

#### Scenario: Caret range
- **WHEN** a mod file has `api: "^0.1.0"` under `mod`
- **THEN** the loaded mod's `api` is `"^0.1.0"`

#### Scenario: No api key
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `api` is `null`

#### Scenario: Not a range
- **WHEN** a mod file has `api: "latest"` under `mod`
- **THEN** loading fails with a mod format error whose message says that `api` must be a semver range

#### Scenario: Range written as a number
- **WHEN** a mod file has `api: 0.1` under `mod`
- **THEN** loading fails with a mod format error whose message says that `api` must be a semver range

### Requirement: Test file in the mod file
The `mod` mapping SHALL accept an optional `test_path` key, a non-empty string resolved against the mod file's location. The loaded mod SHALL carry the resolved address as `testSource`, or `null` when the key is missing. Loading a mod SHALL NOT request the test file. A `test_path` that is not a non-empty string SHALL fail with a mod format error whose message says that `test_path` must be a non-empty string.

#### Scenario: Test file next to the mod file
- **WHEN** the mod at `https://example.org/mods/clock/mod_conf.yaml` declares `test_path: "./test.js"`
- **THEN** the loaded mod's `testSource` is `https://example.org/mods/clock/test.js`
- **AND** the test file is not requested

#### Scenario: No test file
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `testSource` is `null`

#### Scenario: Empty test path
- **WHEN** a mod file has `test_path: ""`
- **THEN** loading fails with a mod format error whose message says that `test_path` must be a non-empty string

### Requirement: Library declarations in the mod file
The `mod` mapping SHALL accept an optional `libraries` mapping. Each key SHALL be a library name matching `^[a-z][a-z0-9_]*$` that is not a library the app ships, and each value a mapping with a `files` key, an optional `npm` key and no other key. The loaded mod SHALL carry `libraries`, a list of `{ name, package, version, files }` in the order of the file, empty when the key is missing.

#### Scenario: No libraries key
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `libraries` is an empty list

#### Scenario: Declared library
- **WHEN** a mod file declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js", "dist/leaflet.css"]`
- **THEN** the loaded mod's `libraries` has one entry with name `"leaflet"`, package `"leaflet"`, version `"1.9.4"` and two files

#### Scenario: Unknown key in a library
- **WHEN** a library entry has `integrity: "sha384-abc"`
- **THEN** loading fails with a mod format error whose message names `integrity` and the library, and says that a library has only `npm` and `files`

#### Scenario: Name of a library the app ships
- **WHEN** a mod file declares a library named `mermaid`
- **THEN** loading fails with a mod format error whose message says that `mermaid` is a library the app ships

#### Scenario: Name with capitals
- **WHEN** a mod file declares a library named `Leaflet`
- **THEN** loading fails with a mod format error whose message names `Leaflet` and the allowed characters

#### Scenario: Libraries is a list
- **WHEN** a mod file has `libraries` as a list
- **THEN** loading fails with a mod format error whose message says that `libraries` must be a mapping

### Requirement: npm libraries name an exact version
A library's `npm` SHALL be a string `<package>@<version>`, where `<package>` is an npm package name, scoped or not, and `<version>` is an exact semver version. The loaded library SHALL carry the package and the version, or `null` for both without `npm`. A range, a tag, a missing version or any other value SHALL fail with a mod format error that names the library and says that `npm` needs an exact version.

#### Scenario: Scoped package
- **WHEN** a library has `npm: "@turf/helpers@7.2.0"`
- **THEN** the loaded library's package is `"@turf/helpers"` and its version `"7.2.0"`

#### Scenario: Range
- **WHEN** a library has `npm: "leaflet@^1.9.4"`
- **THEN** loading fails with a mod format error whose message names the library and says that `npm` needs an exact version, such as `leaflet@1.9.4`

#### Scenario: Tag
- **WHEN** a library has `npm: "leaflet@latest"`
- **THEN** loading fails with a mod format error whose message says that `npm` needs an exact version

#### Scenario: No version
- **WHEN** a library has `npm: "leaflet"`
- **THEN** loading fails with a mod format error whose message says that `npm` needs an exact version

### Requirement: Library files
A library's `files` SHALL be a non-empty list of non-empty strings. For an npm library, each SHALL be a path inside the package, without a leading `/` or `./`, a `..` segment, `\`, `?` or `#`, and its address SHALL be `<npm host><package>@<version>/<path>` (see `mod-libraries`). For a library without `npm`, each SHALL be resolved against the mod file's location, as `entrypoint` is. Each loaded file SHALL carry `path`, as declared, `source`, its address, and `kind`.

#### Scenario: npm file
- **WHEN** a library has `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js"]`, in the vanilla app
- **THEN** the loaded file has path `"dist/leaflet.js"` and source `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js`

#### Scenario: File next to the mod
- **WHEN** the mod at `https://example.org/mods/probe/mod_conf.yaml` has a library without `npm` and `files: ["./vendor/helper.js"]`
- **THEN** the loaded file's source is `https://example.org/mods/probe/vendor/helper.js`

#### Scenario: Path leaving the package
- **WHEN** an npm library has `files: ["../other/index.js"]`
- **THEN** loading fails with a mod format error whose message names `../other/index.js` and the library

#### Scenario: No files
- **WHEN** a library has `files: []`
- **THEN** loading fails with a mod format error whose message says that `files` must be a non-empty list

### Requirement: Kind of a library file
A library file's `kind` SHALL follow the extension of its path, ignoring case: `"script"` for `.js`, `"style"` for `.css`, and `"data"` for any other extension or none. A path ending in `.mjs` SHALL fail with a mod format error that names the file and says that ES module libraries are not supported.

#### Scenario: Kinds
- **WHEN** a library lists `dist/leaflet.js`, `dist/leaflet.css` and `countries-110m.json`
- **THEN** their kinds are `"script"`, `"style"` and `"data"`

#### Scenario: ES module
- **WHEN** a library lists `dist/index.mjs`
- **THEN** loading fails with a mod format error whose message names `dist/index.mjs` and says that ES module libraries are not supported
