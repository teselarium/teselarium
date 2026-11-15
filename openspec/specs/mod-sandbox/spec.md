# mod-sandbox Specification

## Purpose

Runs a loaded mod isolated from the app: in its own sandboxed frame with an opaque origin and no access to the app's storage or page, with a content policy that decides which web hosts the mod can reach, and with clear reports when the policy denies a permission or blocks a request.

## Requirements

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

### Requirement: Default content policy
Without granted permissions, a mod SHALL be able to run its own code and inline styles. It SHALL load images, video, audio, fonts and stylesheets only from `data:` and `blob:` URLs and from the content hosts, and images, video and audio also from the files its tiles link (see "Media linked by tiles"). Every other web request SHALL be blocked: connections, frames and scripts from any host.

#### Scenario: Image from a content host
- **WHEN** a running mod shows an image from the origin its tiles were loaded from
- **THEN** the image loads

#### Scenario: Image from another host
- **WHEN** a mod without permissions shows an image from `https://images.example.net` that none of its tiles links
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
- **WHEN** a mod is opened with a collection, with every file it reads from the app's own origin
- **THEN** the only content host is the app's origin

#### Scenario: Tile from another host
- **WHEN** the collection lists a tile at `https://tiles.example.net/books/kallocain.md`
- **THEN** `https://tiles.example.net` is a content host and images from it load

### Requirement: Grant declared permissions to mods from the app's origin
When the mod file is served from the same origin as the app, the system SHALL grant every permission the mod declares: each host SHALL be allowed for the requests of its category. `show` covers images, video, audio, fonts and stylesheets. `connect` covers fetch, XMLHttpRequest, WebSocket and EventSource. `embed` covers frames. `code` covers scripts. `open` covers the mods the mod may inspect and open, and the collections it may inspect, through the engine.

#### Scenario: Sample covers are shown
- **WHEN** a mod served from the app's origin declares `show` for `https://upload.wikimedia.org` and shows images from it
- **THEN** the images load

#### Scenario: Declared connection
- **WHEN** a mod served from the app's origin declares `connect` for `https://api.example.net` and calls `fetch` on it
- **THEN** the request is sent

#### Scenario: Declared open covers collections
- **WHEN** a mod served from the app's origin declares `open` for `https://tiles.example.net` and sends `collections.inspect` for `https://tiles.example.net/books.yaml`
- **THEN** the collection file is requested and its index is returned

### Requirement: Mods from other origins get the permissions the user allows
When the mod file is served from another origin, the system SHALL grant the declared permissions the user allowed (see `site-consent`), as it grants those of a mod from the app's origin, and none of the others. With none allowed, it SHALL run the mod with the default content policy. For each declared permission not granted, it SHALL report a warning issue naming the category, the host and the reason, and saying that mods from other sites get only the permissions the user allows.

#### Scenario: Foreign mod with a show permission
- **WHEN** a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares `show` for `https://upload.wikimedia.org` is opened and the user chooses Show without them
- **THEN** a warning issue is reported that names `show`, `https://upload.wikimedia.org` and the declared reason, and says that mods from other sites get only the permissions the user allows
- **AND** images from `https://upload.wikimedia.org` are blocked

#### Scenario: Foreign mod with an allowed show permission
- **WHEN** the same mod is opened and the user allows `show` for `https://upload.wikimedia.org`
- **THEN** images from `https://upload.wikimedia.org` load and no permission issue is reported for it

#### Scenario: Foreign mod with an allowed open permission
- **WHEN** a foreign mod whose `open` permission for `"*"` the user allowed sends `mods.inspect` for a mod at `https://other.example.net/clock/mod_conf.yaml`
- **THEN** the request is answered with the inspection, not with error code `-32002`

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

### Requirement: Mods can go fullscreen
Every mod frame SHALL allow fullscreen, so a mod can show an element of its frame fullscreen after a user action inside the mod. When the visible sandbox changes while an element is fullscreen, the app SHALL leave fullscreen.

#### Scenario: Fullscreen after a click
- **WHEN** the user clicks a button in a running mod whose handler calls `document.body.requestFullscreen()`
- **THEN** the promise resolves and the mod's `document.fullscreenElement` is its `<body>`

#### Scenario: Opening another mod leaves fullscreen
- **WHEN** a mod with `open` granted for `"*"` is fullscreen and sends `mods.open` for the mod viewer
- **THEN** the app's `document.fullscreenElement` is `null` and the mod viewer is visible

### Requirement: Blocked browser dialogs are reported
Inside a mod frame, `alert`, `confirm`, `prompt` and `print` SHALL show nothing and return what the browser returns for a blocked dialog: `undefined`, `false`, `null` and `undefined`. The first call of each function in a running mod SHALL report a warning issue whose source is the mod's source, naming the function and what to use instead. Later calls of the same function SHALL report nothing more.

#### Scenario: Confirm
- **WHEN** a running mod calls `confirm("Delete?")`
- **THEN** the call returns `false`, no dialog appears, and a warning issue is reported whose message says that `confirm()` is not available in mods and names `<dialog>` and `ui.confirm`

#### Scenario: Reported once
- **WHEN** a running mod calls `alert("a")` three times
- **THEN** exactly one warning issue names `alert()`

#### Scenario: Each function is named
- **WHEN** a running mod calls `prompt("Name?")` and `print()`
- **THEN** `prompt` returns `null`, and one warning issue names `prompt()` and another names `print()`

### Requirement: Assets next to the mod
A mod SHALL be able to load images, media, fonts and stylesheets from its own folder by resolving their paths against `context.mod.source`, without declaring a permission, wherever the mod is served from.

#### Scenario: Asset of a mod from the app's origin
- **WHEN** a mod served from the app's origin shows an image at `new URL("./icon.svg", context.mod.source)`
- **THEN** the image loads and no issue is reported

#### Scenario: Asset of a mod from another origin
- **WHEN** the mod at `https://mods.example.net/probe/mod_conf.yaml` shows an image at `new URL("./icon.svg", context.mod.source)`
- **THEN** the image loads from `https://mods.example.net/probe/icon.svg` and no issue is reported

### Requirement: Wildcard hosts cover subdomains
A permission whose host is a wildcard host, such as `https://*.us.archive.org`, SHALL cover every origin with the same scheme and port whose host name ends with the wildcard's host name after one or more extra labels. It SHALL NOT cover the wildcard's host name itself. Granting it SHALL allow the requests of its category to every covered origin, and a blocked request to a covered origin SHALL be reported as for an exact host.

#### Scenario: Image from a subdomain of a granted wildcard host
- **WHEN** a mod served from the app's origin declares `show` for `https://*.us.archive.org` and shows an image from `https://ia800100.us.archive.org/cover.jpg`
- **THEN** the image loads

#### Scenario: Deeper subdomain
- **WHEN** a mod served from the app's origin declares `connect` for `https://*.example.net` and calls `fetch("https://a.b.example.net/data")`
- **THEN** the request is sent

#### Scenario: The wildcard's own host name is not covered
- **WHEN** a mod served from the app's origin declares `show` for `https://*.us.archive.org` and shows an image from `https://us.archive.org/cover.jpg`
- **THEN** the request is blocked before it is sent
- **AND** a warning issue is reported that names `https://us.archive.org` and says to add it to `permissions.show` in `mod_conf.yaml`

#### Scenario: Other scheme is not covered
- **WHEN** a mod served from the app's origin declares `show` for `https://*.example.net` and shows an image from `http://images.example.net/cover.jpg`
- **THEN** the request is blocked before it is sent

#### Scenario: Wildcard host declared but not granted
- **WHEN** a foreign mod that declares `show` for `https://*.us.archive.org` shows an image from `https://ia800100.us.archive.org/cover.jpg`
- **THEN** a warning issue is reported that names `https://ia800100.us.archive.org` and says that the declared permission was not granted

### Requirement: Media linked by tiles
When "Load media linked by tiles" is on as a mod starts, the system SHALL let the mod load, as images, video and audio, each file whose `http:` or `https:` URL is a metadata string of a tile the mod receives, inside lists and nested mappings too, or the address of an image, video, audio, `<source>`, poster or `srcset` candidate in that tile's rendered body (see `tile-bodies`). Mods from the app's origin and from other origins SHALL get them alike. Tiles the mod does not receive, and the other addresses of a body, SHALL allow nothing.

#### Scenario: Image linked by a tile
- **WHEN** a mod from the app's origin without permissions is opened with a collection whose tile has `image: "https://media.example.net/covers/kallocain.jpg"`, and shows that URL as an image
- **THEN** the image loads and no issue is reported

#### Scenario: Audio linked by a tile
- **WHEN** a mod without permissions is opened with a tile that has `audio: "https://media.example.net/sound/theme.mp3"`, and plays that URL in an `<audio>` element
- **THEN** the request for `https://media.example.net/sound/theme.mp3` is sent and no issue is reported

#### Scenario: URL inside a nested value
- **WHEN** a mod is opened with a tile that has `gallery: [{ src: "https://media.example.net/a.jpg" }]`, and shows `https://media.example.net/a.jpg`
- **THEN** the image loads

#### Scenario: URL with a query
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg?size=large#top"`, and shows that URL
- **THEN** the image loads

#### Scenario: Mod from another origin
- **WHEN** the mod at `https://mods.example.net/probe/mod_conf.yaml`, which declares no permissions, is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, and shows that URL
- **THEN** the image loads

#### Scenario: Tile of another type
- **WHEN** a mod with a tile type is opened with a collection in which only a tile of another type has `image: "https://media.example.net/other.jpg"`, and the mod shows that URL
- **THEN** the request is blocked before it is sent

#### Scenario: Image in the body
- **WHEN** a mod is opened with a tile whose body holds `![Still](https://media.example.net/body.jpg)`, and shows the tile's rendered body
- **THEN** the image loads

#### Scenario: Video and poster in the body
- **WHEN** a mod is opened with a tile whose body holds `<video src="https://media.example.net/trailer.mp4" poster="https://media.example.net/still.jpg"></video>`, and shows the rendered body
- **THEN** the requests for `https://media.example.net/still.jpg` and `https://media.example.net/trailer.mp4` are sent and not blocked

#### Scenario: URL in the body
- **WHEN** a mod is opened with a tile whose body holds the text `See https://media.example.net/text.jpg` and no image of it, and the mod shows that URL as an image
- **THEN** the request is blocked before it is sent

#### Scenario: Setting switched off
- **WHEN** "Load media linked by tiles" is off and a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, and shows that URL
- **THEN** the request is blocked before it is sent
- **AND** no issue names the tile

### Requirement: A tile link allows only the linked file
Each linked file SHALL be allowed by its address without query and fragment, and SHALL NOT allow any other file of its host. A path with `,`, `;`, `[`, `]` or `|` SHALL be allowed too, with each written as `%2C`, `%3B`, `%5B`, `%5D` and `%7C` in the policy, so the file loads at the address the tile wrote and no other file of its host does. A URL whose path ends with `/` names a folder or a page: it SHALL allow nothing and SHALL NOT be reported.

#### Scenario: Other file of the same host
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/covers/kallocain.jpg"`, and shows `https://media.example.net/covers/other.jpg`
- **THEN** the request is blocked before it is sent
- **AND** a warning issue is reported that names `https://media.example.net`

#### Scenario: Link to a folder
- **WHEN** a mod is opened with a tile that has `homepage: "https://media.example.net/covers/"`, and shows `https://media.example.net/covers/kallocain.jpg`
- **THEN** the request is blocked before it is sent
- **AND** no issue names the tile

#### Scenario: Comma in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/covers/chronicles,_volume_1.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Brackets and vertical bar in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/a[1]|b.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Other file next to a link with a comma
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/covers/chronicles,_volume_1.jpg"`, and shows `https://media.example.net/covers/chronicles.jpg`
- **THEN** the request is blocked before it is sent

### Requirement: Tile links allow only images, video and audio
A tile link SHALL NOT let a mod load fonts or stylesheets, send connections, embed pages or load scripts, whatever the linked file is.

#### Scenario: Linked stylesheet
- **WHEN** a mod is opened with a tile that has `theme: "https://media.example.net/theme.css"`, and adds a `<link rel="stylesheet">` with that URL
- **THEN** the request is blocked before it is sent

#### Scenario: Linked file fetched
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, and calls `fetch` on that URL
- **THEN** the request is blocked before it is sent

#### Scenario: Linked script
- **WHEN** a mod is opened with a tile that has `code: "https://media.example.net/library.js"`, and imports that URL
- **THEN** the request is blocked before it is sent

### Requirement: Tile links the sandbox cannot express
A linked URL that a sandbox policy cannot express SHALL allow nothing: one with a user name or password, an IPv6 address as host, a host name with a character other than letters, digits, `-` and `.`, or a path character other than letters, digits and `-._~!$&'()*+=:@%/,;[]|`. Each SHALL be reported once per tile as a warning issue whose source is the tile, naming the URL and saying that the sandbox cannot allow this address.

#### Scenario: Link with a password
- **WHEN** a mod is opened with the tile `https://tiles.example.net/books/kallocain.md` that has `image: "https://user:secret@media.example.net/cover.jpg"`
- **THEN** a warning issue whose source is `https://tiles.example.net/books/kallocain.md` names the URL and says that the sandbox cannot allow this address

#### Scenario: Link with an IPv6 address
- **WHEN** a mod is opened with a tile that has `image: "https://[2001:db8::1]/cover.jpg"`
- **THEN** a warning issue whose source is the tile says that the sandbox cannot allow this address

#### Scenario: Semicolon in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/a;b.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Same link twice in one tile
- **WHEN** a mod is opened with a tile that has `image` and `thumbnail` both set to `"https://[2001:db8::1]/cover.jpg"`
- **THEN** exactly one issue names that URL

### Requirement: Private network guard
A linked URL whose host is on the user's computer or network SHALL allow nothing, unless the tile was loaded over `http:` or `https:` from such a host. A tile picked from the user's computer SHALL get the guard. Each left-out URL SHALL be reported once per tile as a warning issue whose source is the tile, naming the URL and saying that tiles from other sites cannot link addresses on the user's computer or network.

#### Scenario: Router address in a tile from the web
- **WHEN** a mod is opened with the tile `https://tiles.example.net/books/kallocain.md` that has `image: "http://192.168.1.1/logo.png"`, and shows that URL
- **THEN** the request is blocked before it is sent
- **AND** a warning issue whose source is `https://tiles.example.net/books/kallocain.md` names `http://192.168.1.1/logo.png` and says that tiles from other sites cannot link addresses on the user's computer or network

#### Scenario: Tile from a private host
- **WHEN** a mod is opened with the tile `http://localhost:8080/books/kallocain.md` that has `image: "http://192.168.1.20/cover.png"`, and shows that URL
- **THEN** the image loads and no issue names the tile

#### Scenario: Tile picked from the user's computer
- **WHEN** a mod is opened with a picked tile at `file:///books/kallocain.md` that has `image: "http://localhost:3000/cover.png"`
- **THEN** a warning issue whose source is `file:///books/kallocain.md` says that tiles from other sites cannot link addresses on the user's computer or network

### Requirement: Hosts on the user's computer or network
A host SHALL count as on the user's computer or network when, after dropping a trailing `.`, it is `localhost`, a name without a dot, a name ending with `.localhost`, `.local`, `.internal`, `.lan` or `.home.arpa`, or an IPv4 address in `0.0.0.0/8`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` or `100.64.0.0/10`, written in any form the browser reads as one.

#### Scenario: Names
- **WHEN** tiles from `https://tiles.example.net` link `http://localhost/a.png`, `http://printer.localhost/a.png`, `http://router/a.png`, `http://nas.local./a.png`, `http://db.internal/a.png`, `http://pc.lan/a.png` and `http://hub.home.arpa/a.png`
- **THEN** each is left out by the private network guard

#### Scenario: Addresses
- **WHEN** tiles from `https://tiles.example.net` link `http://0.0.0.0/a.png`, `http://127.0.0.1/a.png`, `http://10.1.2.3/a.png`, `http://172.31.0.1/a.png`, `http://192.168.0.1/a.png`, `http://169.254.169.254/a.png` and `http://100.64.0.1/a.png`
- **THEN** each is left out by the private network guard

#### Scenario: Other forms of an address
- **WHEN** a tile from `https://tiles.example.net` links `http://2130706433/a.png` or `http://0x7f.1/a.png`
- **THEN** each is left out by the private network guard

#### Scenario: Public hosts
- **WHEN** tiles from `https://tiles.example.net` link `http://172.32.0.1/a.png`, `http://8.8.8.8/a.png` and `https://localhost.example.net/a.png`
- **THEN** none is left out by the private network guard

### Requirement: Tile links are fixed when the mod starts
The files allowed by tile links SHALL be fixed when the mod's frame starts. After "Reload tiles", the left-out URL reports SHALL be replaced by those of the reloaded tiles, and when the reloaded tiles link files the frame does not allow, one warning issue whose source is the collection SHALL give their number and say that the mod must be opened again to show them.

#### Scenario: New link after reloading the tiles
- **WHEN** a mod runs with a collection, a tile now has `image: "https://media.example.net/new.jpg"`, and the user presses "Reload tiles"
- **THEN** the stage bar shows a warning whose source is the collection and that says `The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.`
- **AND** an image from `https://media.example.net/new.jpg` is blocked in the running mod

#### Scenario: Opened again
- **WHEN** after that reload the user closes the mod and opens the same link again
- **THEN** the image from `https://media.example.net/new.jpg` loads and the warning is gone

#### Scenario: Nothing new
- **WHEN** a mod runs with a collection and the user presses "Reload tiles" without the tiles linking any new file
- **THEN** no warning says that the mod must be opened again

#### Scenario: Left-out link removed
- **WHEN** a tile that linked `http://192.168.1.1/logo.png` no longer links it and the user presses "Reload tiles"
- **THEN** the issue naming `http://192.168.1.1/logo.png` is gone

### Requirement: Redirect hint for tile authors
When "Load media linked by tiles" was on as the mod started, the report of a blocked image or media request whose host is not declared SHALL end with a sentence for tile authors that says to link the file's final address, because a link that redirects to another site is blocked.

#### Scenario: Tile link that redirects
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, which redirects to `https://cdn.example.org/cover.jpg`, and shows that URL
- **THEN** the image does not load
- **AND** a warning issue is reported that says to add the blocked origin to `permissions.show` in `mod_conf.yaml` and ends with `If a tile links this file, link its final address: links that redirect to another site are blocked.`

#### Scenario: No hint for other categories
- **WHEN** a mod without permissions calls `fetch("https://api.example.net/data")`
- **THEN** the warning issue has no sentence for tile authors

#### Scenario: No hint with the setting off
- **WHEN** "Load media linked by tiles" is off and a mod without permissions shows an image from `https://images.example.net/cover.jpg`
- **THEN** the warning issue is `Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.`
