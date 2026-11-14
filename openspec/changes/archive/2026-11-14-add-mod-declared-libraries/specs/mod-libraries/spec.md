# Spec Delta

## ADDED Requirements

### Requirement: Load a declared library
`libs.load` with `{ name }`, where `name` is a library the requesting mod declares (see `mod-loading`), SHALL install the library's `.js` files as classic scripts, in the order of its `files`, and its `.css` files as stylesheets, in the requesting mod's frame. It SHALL then resolve with `{ name, version, files }`, where `version` is the declared npm version or `null`, and `files` maps the path of each of its other files, as declared, to that file's text.

#### Scenario: Load a declared npm library
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js", "dist/leaflet.css"]` sends `libs.load` with `{ "name": "leaflet" }`
- **THEN** the request resolves with `name` `"leaflet"`, `version` `"1.9.4"` and `files` `{}`
- **AND** `globalThis.L.map` is a function in the mod's frame, and the rules of `dist/leaflet.css` apply in the frame

#### Scenario: Data file
- **WHEN** a mod that declares `world_atlas` with `npm: "world-atlas@2.0.2"` and `files: ["countries-110m.json"]` sends `libs.load` with `{ "name": "world_atlas" }`
- **THEN** the result's `files` has `countries-110m.json` with the text of that file, and nothing is installed in the frame

#### Scenario: Files next to the mod
- **WHEN** a mod at `https://example.org/mods/probe/mod_conf.yaml` that declares `helper` with `files: ["./vendor/helper.js"]` sends `libs.load` with `{ "name": "helper" }`
- **THEN** the script at `https://example.org/mods/probe/vendor/helper.js` runs in the mod's frame, and the request resolves with `version` `null`

#### Scenario: Scripts run in order
- **WHEN** a declared library lists `a.js` and then `b.js`, and `b.js` reads a global that `a.js` sets
- **THEN** the request resolves and `b.js` found the global

### Requirement: Version of a declared library
A `libs.load` for a declared library SHALL accept `version` absent, `null`, or equal to the declared npm version. Any other `version` SHALL be answered with error code `-32602`, without installing anything, with a message that names `libs.load`, the library and its declared version, or says that the library has no npm version.

#### Scenario: Declared version
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` sends `libs.load` with `{ "name": "leaflet", "version": "1.9.4" }`
- **THEN** the request resolves with `version` `"1.9.4"`

#### Scenario: Other version
- **WHEN** the same mod sends `libs.load` with `{ "name": "leaflet", "version": "1" }`
- **THEN** the response has an error with code `-32602` whose message names `libs.load`, `leaflet` and `1.9.4`

### Requirement: Where declared library files come from
The app SHALL fetch each file of an npm library from its npm host, at `<npm host><package>@<version>/<path>`, and each other declared file from its address resolved against the mod file. The npm host of the vanilla app SHALL be `https://cdn.jsdelivr.net/npm/`. The requests SHALL be made by the app's page, and the mod's frame SHALL send none.

#### Scenario: npm file address
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js"]` loads it in the vanilla app
- **THEN** the app requests `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js`, and the mod's frame sends no request for it

### Requirement: Declared files are fetched once per page and only when needed
The app SHALL request a declared library's files on the first `libs.load` for it in the page, and SHALL NOT request them before. It SHALL request each file address at most once per page, also when several mods declare the same file.

#### Scenario: Not downloaded before a request
- **WHEN** a mod that declares `leaflet` but never sends `libs.load` is opened
- **THEN** no file of `leaflet` is requested

#### Scenario: Two mods, one download
- **WHEN** two running mods each declare `leaflet` with `npm: "leaflet@1.9.4"` and the same files, and each loads it
- **THEN** each file is requested once, and the library is installed in both frames

### Requirement: Declared files that cannot be fetched
When a file of a declared library cannot be fetched, `libs.load` SHALL be answered with error code `-32001` and SHALL install none of the library's files. The message SHALL name `libs.load`, the library, the file's address and the HTTP status or the fetch error, and SHALL include the text the host answered with when it is short plain text.

#### Scenario: Version that does not exist
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@9.9.9"` loads it, and the npm host answers HTTP 404 with the text `Couldn't find the requested release version 9.9.9.`
- **THEN** the response has an error with code `-32001` whose message names `libs.load`, `leaflet`, `https://cdn.jsdelivr.net/npm/leaflet@9.9.9/dist/leaflet.js`, `404` and that text
- **AND** `globalThis.L` is undefined in the mod's frame

#### Scenario: Later request after a failure
- **WHEN** a `libs.load` for a declared library failed because the host could not be reached, and the mod sends it again once the host answers
- **THEN** the files are requested again and the second request resolves

### Requirement: A mod's styles win over its libraries'
A declared library's stylesheets SHALL be added to the frame before every stylesheet the mod added, so that at equal specificity the mod's rules win over the library's, whatever the order in which the mod added its styles and loaded the library.

#### Scenario: Mod style added first
- **WHEN** a mod adds a style that sets `.probe { color: rgb(255, 0, 0) }` and then loads a declared library whose stylesheet sets `.probe { color: rgb(0, 0, 255) }`
- **THEN** an element of class `probe` in the mod's frame has color `rgb(255, 0, 0)`

### Requirement: Declared libraries need no permission
Loading a declared library SHALL need no permission, SHALL add no line to the site consent dialog, and SHALL NOT change the content policy of the mod's frame, for mods from the app's origin and from other origins alike.

#### Scenario: Foreign mod with an npm library
- **WHEN** the user opens a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares an npm library and no permission, and the mod loads the library
- **THEN** no site consent dialog is shown, the request resolves, and no permission issue is reported

## MODIFIED Requirements

### Requirement: Unknown libraries and versions
The engine SHALL answer `libs.load` with error code `-32602`, without installing anything, when `name` is neither a library the app ships nor one the requesting mod declares, or, for a library the app ships, when `version` is not a string naming a major version the app ships. The message SHALL name `libs.load` and the problem, and for a library the app ships, the major versions the app has.

#### Scenario: Unknown library
- **WHEN** a mod that declares no library sends `libs.load` with `{ "name": "katex", "version": "0" }`
- **THEN** the response has an error with code `-32602` whose message names `libs.load` and says that the app has no library `katex` and that the mod declares none of that name

#### Scenario: Library declared by another mod
- **WHEN** one running mod declares `leaflet`, and another mod that does not declare it sends `libs.load` with `{ "name": "leaflet" }`
- **THEN** the response to the other mod has an error with code `-32602` whose message names `leaflet`

#### Scenario: Other major version
- **WHEN** a mod sends `libs.load` with `{ "name": "mermaid", "version": "11" }`
- **THEN** the response has an error with code `-32602` whose message says that the app has mermaid `12`

### Requirement: Libraries come from the app
The code of a library the app ships SHALL come from the app's own host. Loading it SHALL send no request to another host. The app SHALL download a library it ships only when a frame first requests it, and a frame that never requests it SHALL NOT receive it.

#### Scenario: No third-party request
- **WHEN** a mod loads mermaid
- **THEN** every request made for it goes to the app's origin

#### Scenario: Not downloaded before a request
- **WHEN** the app is opened and runs a mod that does not load a library
- **THEN** the mermaid code was not downloaded
