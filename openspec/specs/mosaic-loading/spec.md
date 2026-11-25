# mosaic-loading Specification

## Purpose

Reads mosaic files: the bundles that pair a mod with a tile collection, override the mod's config, map the collection's field names to the mod's tile type and declare the media hosts the data needs, as plain data the engine opens.

## Requirements

### Requirement: Load a mosaic file from a reference
The system SHALL load a mosaic file from a mosaic reference and return a loaded mosaic with `source`, `title`, `description`, `mod`, `collection`, `config`, `aliases` and `permissions`. Loading SHALL request the mosaic file only: neither its mod nor its collection.

#### Scenario: Sample mosaic
- **WHEN** `./mosaics/nobel_map.yaml` is loaded with base URL `https://example.org/`, and the file has `title`, `mod` and `collection`
- **THEN** the loaded mosaic's `source` is `https://example.org/mosaics/nobel_map.yaml`
- **AND** only that file is requested

### Requirement: Mosaic references
A mosaic reference whose resolved path ends in `.yaml` or `.yml` SHALL be the mosaic file. Any other reference SHALL be a folder, read as the file `mosaic.yaml` in it: a `/` SHALL be added when the path does not end with one, and the folder's query and fragment SHALL be dropped. Relative references SHALL be resolved against the base URL, as tile locations are.

#### Scenario: Folder
- **WHEN** the reference `./mosaics/nobel_map` is loaded with base URL `https://example.org/`
- **THEN** the file `https://example.org/mosaics/nobel_map/mosaic.yaml` is requested

#### Scenario: Folder with a trailing slash
- **WHEN** the reference `./mosaics/nobel_map/` is loaded with base URL `https://example.org/`
- **THEN** the file `https://example.org/mosaics/nobel_map/mosaic.yaml` is requested

#### Scenario: File with another name
- **WHEN** the reference `https://mosaics.example.net/maps/laureates.yml` is loaded
- **THEN** that file is requested

### Requirement: One source per mosaic file
All the references to one mosaic file SHALL give the same `source`, the resolved address of the file.

#### Scenario: Folder and file
- **WHEN** `./mosaics/nobel_map` and `./mosaics/nobel_map/mosaic.yaml` are loaded with base URL `https://example.org/`
- **THEN** both loaded mosaics have the source `https://example.org/mosaics/nobel_map/mosaic.yaml`

### Requirement: Mosaic file format
A mosaic file SHALL have a `mosaic` mapping. `title` SHALL be a non-empty string and `mod` a non-empty string. `description` SHALL be an optional string, defaulting to `""`. `collection` SHALL be absent, `null` or a non-empty string. `config` SHALL be an optional mapping, defaulting to `{}`. Other keys SHALL be ignored.

#### Scenario: Minimal mosaic
- **WHEN** a mosaic file holds only `title: "Clock"` and `mod: "./clock"`
- **THEN** the loaded mosaic has `description` `""`, `collection` `null`, `config` `{}`, `aliases` `{}` and `permissions` `[]`

#### Scenario: Unknown key
- **WHEN** a mosaic file also has `layout: "wide"` under `mosaic`
- **THEN** the mosaic loads, and the loaded mosaic has no `layout`

### Requirement: Mosaic format errors
The system SHALL fail with a mosaic format error when the mosaic file does not follow the mosaic file format. The error SHALL carry the mosaic file's source, and its message SHALL name the key that is wrong.

#### Scenario: Missing title
- **WHEN** a mosaic file has `mod` but no `title`
- **THEN** loading fails with a mosaic format error whose source is the file's address and whose message says that `title` must be a non-empty string

#### Scenario: Config that is not a mapping
- **WHEN** a mosaic file has `config: [1, 2]`
- **THEN** loading fails with a mosaic format error whose message says that `config` must be a mapping

#### Scenario: No mosaic mapping
- **WHEN** a mosaic file's top level is a mapping without `mosaic`
- **THEN** loading fails with a mosaic format error whose message names `mosaic`

### Requirement: Mod and collection resolve against the mosaic file
The system SHALL resolve the mosaic's `mod` and `collection` against the mosaic file's location, not against the base URL. `mod` SHALL follow the mod reference rules, so a default mod name stays a default mod name. `collection` SHALL follow the collection reference rules. The loaded mosaic SHALL carry `mod` as the resolved address of the mod file and `collection` as the resolved address of the collection file, or `null`.

#### Scenario: Paths next to the mosaic
- **WHEN** the mosaic `https://example.org/samples/mosaics/nobel_map.yaml` has `mod: "../mods/country_map"` and `collection: "../tiles/literature_nobel_laureates"`
- **THEN** its `mod` is `https://example.org/samples/mods/country_map/mod_conf.yaml`
- **AND** its `collection` is `https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml`

#### Scenario: Default mod name
- **WHEN** a mosaic has `mod: "collection_viewer"` and the default mods folder is `https://example.org/default_mods/`
- **THEN** its `mod` is `https://example.org/default_mods/collection_viewer/mod_conf.yaml`

### Requirement: Alias format
`aliases` SHALL be an optional mapping from a field name of the tile type to a non-empty list of non-empty strings, the names a collection may use for that field, in order of preference. Its keys SHALL be non-empty strings. A name listed under two fields, or a name that is also a key of `aliases`, SHALL fail with a mosaic format error that names it.

#### Scenario: Aliases of the laureates
- **WHEN** a mosaic has `aliases: { title: ["name"], country: ["birth_country"] }`
- **THEN** the loaded mosaic's `aliases` is `{ "title": ["name"], "country": ["birth_country"] }`

#### Scenario: Empty list
- **WHEN** a mosaic has `aliases: { title: [] }`
- **THEN** loading fails with a mosaic format error whose message names `aliases.title`

#### Scenario: A name listed twice
- **WHEN** a mosaic has `aliases: { title: ["name"], label: ["name"] }`
- **THEN** loading fails with a mosaic format error whose message names `name`

#### Scenario: A name that is also a field
- **WHEN** a mosaic has `aliases: { title: ["name"], name: ["full_name"] }`
- **THEN** loading fails with a mosaic format error whose message names `name`

### Requirement: A mosaic declares only show permissions
`permissions` SHALL be an optional mapping whose only key is `show`, holding a list of mappings with a non-empty string `host` and a non-empty string `reason`. Each host SHALL follow the mod file's rules for `show` hosts, wildcard hosts included. Any other category, such as `connect` or `open`, SHALL fail with a mosaic format error that says a mosaic can only declare `show` permissions.

#### Scenario: Cover hosts
- **WHEN** a mosaic declares `show` for `https://covers.openlibrary.org` and `https://*.archive.org`, each with a reason
- **THEN** the loaded mosaic's `permissions` lists both, each as `{ category: "show", host, reason }`, in file order

#### Scenario: Connect in a mosaic
- **WHEN** a mosaic declares `connect` for `https://api.example.net`
- **THEN** loading fails with a mosaic format error that says a mosaic can only declare `show` permissions

#### Scenario: Host with a path
- **WHEN** a mosaic declares `show` for `https://images.example.net/covers`
- **THEN** loading fails with a mosaic format error that names the host

### Requirement: Mosaic files are plain YAML
The mosaic file SHALL follow the same plain YAML rules as a collection file. A mosaic file that is not plain YAML, or has no mapping at its top level, SHALL fail with a YAML parse error whose source is the mosaic file. A mosaic file that cannot be fetched SHALL fail with a fetch error whose source is the mosaic file.

#### Scenario: Missing mosaic file
- **WHEN** a mosaic reference names a file that answers HTTP 404
- **THEN** loading fails with a fetch error whose source is the file's address and whose message names `404`

#### Scenario: Not YAML
- **WHEN** a mosaic file holds `mosaic: [`
- **THEN** loading fails with a YAML parse error whose source is the file's address

### Requirement: Loaded mosaics are plain data
A loaded mosaic SHALL contain only plain data (strings, numbers, booleans, null, lists and mappings), and two loads of the same mosaic SHALL NOT share objects.

#### Scenario: Two loads
- **WHEN** the same mosaic is loaded twice and the first result's `config` is changed
- **THEN** the second result's `config` is unchanged
