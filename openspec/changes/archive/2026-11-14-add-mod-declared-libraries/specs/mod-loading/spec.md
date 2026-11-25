# Spec Delta

## ADDED Requirements

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
