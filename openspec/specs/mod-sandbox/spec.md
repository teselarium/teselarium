# mod-sandbox Specification

## Purpose

Runs a loaded mod isolated from the app: in its own sandboxed frame with an opaque origin and no access to the app's storage or page, with a content policy that decides which web hosts the mod can reach, and with clear reports when the policy denies a permission or blocks a request.

## Requirements

### Requirement: Each mod runs in its own sandboxed frame
The system SHALL run each mod in its own frame whose sandbox allows scripts and nothing else. The frame document SHALL be built in memory, so running a mod needs no extra hosted file. The frame SHALL have an opaque origin. The app SHALL create every mod frame in its own page, also for a mod opened by another mod, so a mod frame is never inside another mod's frame.

#### Scenario: Frame sandbox
- **WHEN** the sample book list mod is running
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

### Requirement: A mod cannot navigate the app or open windows
A running mod SHALL NOT be able to change the app's address or open new windows.

#### Scenario: Top navigation is blocked
- **WHEN** code inside a running mod's frame sets `top.location.href` to `https://example.org/`
- **THEN** the app's address does not change

#### Scenario: Popups are blocked
- **WHEN** code inside a running mod's frame calls `window.open("https://example.org/")`
- **THEN** the call returns `null` and no window opens

### Requirement: The engine delivers the mod code
The app SHALL fetch the mod's entrypoint and hand its code to the frame. The frame SHALL NOT request the entrypoint itself, so mods load with the same fetch rules as tiles.

#### Scenario: Entrypoint requested by the app
- **WHEN** the sample book list mod is opened
- **THEN** `main.js` is requested once, by the app page and not by the mod's frame

### Requirement: The mod entrypoint is mounted
The entrypoint SHALL run as an ES module inside the frame. When its default export is a function, the system SHALL call it once with the engine API object and the mount context. Otherwise, or when the call throws or returns a rejected promise, the system SHALL report an error issue whose source is the mod's source.

#### Scenario: Sample mod mounts
- **WHEN** the sample book list mod is opened with the sample collection
- **THEN** the frame shows the titles of the three sample books

#### Scenario: No default export function
- **WHEN** a mod whose entrypoint has no default export is opened
- **THEN** an error issue is reported whose message says that the entrypoint has no default export function

#### Scenario: Mount throws
- **WHEN** a mod whose `mount` throws `new Error("map failed")` is opened
- **THEN** an error issue is reported whose message includes `map failed`

### Requirement: Default content policy
Without granted permissions, a mod SHALL be able to run its own code and inline styles. It SHALL load images, video, audio, fonts and stylesheets only from `data:` and `blob:` URLs and from the content hosts. Every other web request SHALL be blocked: connections, frames and scripts from any host.

#### Scenario: Image from a content host
- **WHEN** a running mod shows an image from the origin its tiles were loaded from
- **THEN** the image loads

#### Scenario: Image from another host
- **WHEN** a mod without permissions shows an image from `https://images.example.net`
- **THEN** the request is blocked before it is sent

#### Scenario: Connections are blocked
- **WHEN** a mod without permissions calls `fetch` on the origin of its own collection
- **THEN** the request is blocked before it is sent

#### Scenario: Remote scripts are blocked
- **WHEN** a mod without permissions imports a module from `https://cdn.example.net/library.js`
- **THEN** the request is blocked before it is sent

### Requirement: Content hosts
The content hosts SHALL be the `http:` and `https:` origins of the files the engine read to start the mod: the mod file, its entrypoint, its tile type file, the collection file and each tile. A mod's content hosts SHALL be fixed when its frame starts.

#### Scenario: Sample content hosts
- **WHEN** the sample book list mod is opened with the sample collection from the app's own origin
- **THEN** the only content host is the app's origin

#### Scenario: Tile from another host
- **WHEN** the collection lists a tile at `https://tiles.example.net/books/kallocain.md`
- **THEN** `https://tiles.example.net` is a content host and images from it load

### Requirement: Grant declared permissions to mods from the app's origin
When the mod file is served from the same origin as the app, the system SHALL grant every permission the mod declares: each host SHALL be allowed for the requests of its category. `show` covers images, video, audio, fonts and stylesheets. `connect` covers fetch, XMLHttpRequest, WebSocket and EventSource. `embed` covers frames. `code` covers scripts. `open` covers the mods the mod may inspect and open through the engine.

#### Scenario: Sample covers are shown
- **WHEN** the sample book list mod, served from the app's origin, shows the book covers from `https://upload.wikimedia.org`
- **THEN** the covers load

#### Scenario: Declared connection
- **WHEN** a mod served from the app's origin declares `connect` for `https://api.example.net` and calls `fetch` on it
- **THEN** the request is sent

### Requirement: Mods from other origins run with the default policy
When the mod file is served from another origin, the system SHALL grant none of its declared permissions and SHALL run it with the default content policy. For each declared permission, it SHALL report a warning issue naming the category, the host and the reason, and saying that mods from other sites run without extra permissions for now.

#### Scenario: Foreign mod with a show permission
- **WHEN** a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares `show` for `https://upload.wikimedia.org` is opened
- **THEN** a warning issue is reported that names `show`, `https://upload.wikimedia.org` and the declared reason
- **AND** images from `https://upload.wikimedia.org` are blocked

#### Scenario: Foreign mod without permissions
- **WHEN** a mod from another origin declares no permissions
- **THEN** no permission issue is reported

### Requirement: Report blocked requests with the fix
When the content policy blocks a request from a running mod, the system SHALL report a warning issue whose source is the mod's source. It SHALL name the blocked origin and its category. If the host is not declared, it SHALL say to add the origin to `permissions.<category>` in `mod_conf.yaml`. If it is declared but not granted, it SHALL say so.

#### Scenario: Undeclared image host
- **WHEN** a mod without permissions shows an image from `https://images.example.net/cover.jpg`
- **THEN** a warning issue is reported that names `https://images.example.net` and says to add it to `permissions.show` in `mod_conf.yaml`

#### Scenario: Undeclared connection
- **WHEN** a mod without permissions calls `fetch("https://api.example.net/data")`
- **THEN** a warning issue is reported that names `https://api.example.net` and says to add it to `permissions.connect` in `mod_conf.yaml`

#### Scenario: Declared but not granted
- **WHEN** a foreign mod that declares `show` for `https://upload.wikimedia.org` shows an image from it
- **THEN** a warning issue is reported that names `https://upload.wikimedia.org` and says that the declared permission was not granted

#### Scenario: Request blocked by another rule
- **WHEN** a running mod is blocked by a policy rule outside the four categories, such as an `<object>` element that loads `https://example.org/file.pdf`
- **THEN** a warning issue is reported that names the rule and suggests no permission entry

#### Scenario: Repeated block is reported once
- **WHEN** a running mod requests three images from `https://images.example.net`
- **THEN** exactly one issue is reported for `https://images.example.net` and `show`

### Requirement: Stop a mod that navigates its frame
When a running mod's frame loads another document, because the mod navigated or reloaded its frame, the system SHALL stop the mod: close its channel, remove its frame and report an error issue whose message says that the mod left its page and was stopped.

#### Scenario: Mod navigates its frame
- **WHEN** code inside a running mod's frame sets `location.href` to `https://example.org/`
- **THEN** the mod's frame is removed and an error issue is reported that says the mod left its page and was stopped
