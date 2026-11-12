## MODIFIED Requirements

### Requirement: Each mod runs in its own sandboxed frame
The system SHALL run each mod in its own frame whose sandbox allows scripts and nothing else. The frame document SHALL be built in memory, so running a mod needs no extra hosted file. The frame SHALL have an opaque origin. The app SHALL create every mod frame in its own page, also for a mod opened by another mod, so a mod frame is never inside another mod's frame.

#### Scenario: Frame sandbox
- **WHEN** a mod is running
- **THEN** its frame has the sandbox value `allow-scripts` and no `src` attribute
- **AND** the frame's origin, read inside the frame, is `"null"`

#### Scenario: No storage access
- **WHEN** code inside a running mod's frame reads `localStorage`
- **THEN** the read fails with a security error and the app's storage is unchanged

#### Scenario: No access to the app page
- **WHEN** code inside a running mod's frame reads `parent.document`
- **THEN** the read fails with a security error

#### Scenario: Mod opened by another mod
- **WHEN** the mod explorer opens the mod viewer
- **THEN** the mod viewer's frame is in the app page, next to the explorer's frame, and the explorer's frame has no child frame

### Requirement: The engine delivers the mod code
The app SHALL fetch the mod's entrypoint and hand its code to the frame. The frame SHALL NOT request the entrypoint itself, so mods load with the same fetch rules as tiles.

#### Scenario: Entrypoint requested by the app
- **WHEN** a mod is opened
- **THEN** `main.js` is requested once, by the app page and not by the mod's frame

### Requirement: The mod entrypoint is mounted
The entrypoint SHALL run as an ES module inside the frame. When its default export is a function, the system SHALL call it once with the engine API object and the mount context. Otherwise, or when the call throws or returns a rejected promise, the system SHALL report an error issue whose source is the mod's source.

#### Scenario: Sample mod mounts
- **WHEN** a mod is opened with a collection of three tiles of its type
- **THEN** its default export is called once in the frame, with the engine API object and a mount context that holds the three tiles

#### Scenario: No default export function
- **WHEN** a mod whose entrypoint has no default export is opened
- **THEN** an error issue is reported whose message says that the entrypoint has no default export function

#### Scenario: Mount throws
- **WHEN** a mod whose `mount` throws `new Error("map failed")` is opened
- **THEN** an error issue is reported whose message includes `map failed`

### Requirement: Content hosts
The content hosts SHALL be the `http:` and `https:` origins of the files the engine read to start the mod: the mod file, its entrypoint, its tile type file, the collection file and each tile. A mod's content hosts SHALL be fixed when its frame starts.

#### Scenario: Sample content hosts
- **WHEN** a mod is opened with a collection, with every file it reads from the app's own origin
- **THEN** the only content host is the app's origin

#### Scenario: Tile from another host
- **WHEN** the collection lists a tile at `https://tiles.example.net/books/kallocain.md`
- **THEN** `https://tiles.example.net` is a content host and images from it load

### Requirement: Grant declared permissions to mods from the app's origin
When the mod file is served from the same origin as the app, the system SHALL grant every permission the mod declares: each host SHALL be allowed for the requests of its category. `show` covers images, video, audio, fonts and stylesheets. `connect` covers fetch, XMLHttpRequest, WebSocket and EventSource. `embed` covers frames. `code` covers scripts. `open` covers the mods the mod may inspect and open through the engine.

#### Scenario: Sample covers are shown
- **WHEN** a mod served from the app's origin declares `show` for `https://upload.wikimedia.org` and shows images from it
- **THEN** the images load

#### Scenario: Declared connection
- **WHEN** a mod served from the app's origin declares `connect` for `https://api.example.net` and calls `fetch` on it
- **THEN** the request is sent
