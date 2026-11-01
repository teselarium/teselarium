# mod-libraries Specification

## Purpose

Lets mods use large libraries the app ships and vets, such as mermaid, without bundling them or loading code from other sites: the app installs a library in the frame of the mod that asks for it, from its own copy, only when it is needed.

## Requirements

### Requirement: Load a library
`libs.load` with `{ name, version }` SHALL install the library `name`, at the major version `version`, in the requesting mod's frame, and resolve with `{ name, version }`, where `version` is the full version installed, once the library is ready to use. The app SHALL ship one library, `mermaid` at major version `12`, which SHALL be ready as `globalThis.mermaid`.

#### Scenario: Load mermaid
- **WHEN** a mod sends `libs.load` with `{ "name": "mermaid", "version": "12" }`
- **THEN** the request resolves with `name` `"mermaid"` and a `version` starting with `12.`, and `globalThis.mermaid.render` is a function in the mod's frame

### Requirement: Unknown libraries and versions
The engine SHALL answer `libs.load` with error code `-32602`, without installing anything, when `name` is not a library the app ships, or `version` is not a string naming a major version the app ships. The message SHALL name `libs.load` and the problem, and for a known library, the major versions the app has.

#### Scenario: Unknown library
- **WHEN** a mod sends `libs.load` with `{ "name": "katex", "version": "0" }`
- **THEN** the response has an error with code `-32602` whose message names `libs.load` and says that the app has no library `katex`

#### Scenario: Other major version
- **WHEN** a mod sends `libs.load` with `{ "name": "mermaid", "version": "11" }`
- **THEN** the response has an error with code `-32602` whose message says that the app has mermaid `12`

### Requirement: A frame receives a library once
A second `libs.load` for the same library from the same frame SHALL resolve with the same result without sending the library to the frame again, and SHALL leave the library's object as it was.

#### Scenario: Two requests
- **WHEN** a mod sends `libs.load` for mermaid twice, and sets `globalThis.mermaid.marker = 1` between them
- **THEN** both requests resolve with the same version, and `globalThis.mermaid.marker` is still `1`

### Requirement: Libraries come from the app
The library's code SHALL come from the app's own host. Loading it SHALL send no request to another host. The app SHALL download a library only when a frame first requests it, and a frame that never requests it SHALL NOT receive it.

#### Scenario: No third-party request
- **WHEN** a mod loads mermaid
- **THEN** every request made for it goes to the app's origin

#### Scenario: Not downloaded before a request
- **WHEN** the app is opened and runs the sample book list mod, which does not load a library
- **THEN** the mermaid code was not downloaded

### Requirement: Libraries run in the mod's frame
A library SHALL run only in the frame that requested it, under that frame's sandbox and content policy, and SHALL NOT run in the app's page or in another mod's frame. It SHALL work in the frames of a mod check too.

#### Scenario: Other frames
- **WHEN** one of two running mods loads mermaid
- **THEN** `globalThis.mermaid` is undefined in the other mod's frame and in the app's page

#### Scenario: In a test case
- **WHEN** a case of a mod's tests mounts the mod, which loads mermaid and draws a diagram
- **THEN** the diagram is drawn and the report has no finding about it
