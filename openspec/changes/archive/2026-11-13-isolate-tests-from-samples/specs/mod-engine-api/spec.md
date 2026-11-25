## MODIFIED Requirements

### Requirement: Private channel per mod
The engine SHALL talk to each running mod only through a message channel created for that mod when its frame starts. The engine SHALL ignore messages that a frame posts to the app's window.

#### Scenario: Requests on the private channel are answered
- **WHEN** a running mod sends a `storage.get` request through its engine API object
- **THEN** it receives the answer

#### Scenario: Window messages are ignored
- **WHEN** code inside a running mod's frame posts a `storage.set` request to `parent` with `postMessage`
- **THEN** nothing is stored and no answer is sent

### Requirement: Inspecting and opening need the open permission
The engine SHALL answer `mods.inspect` and `mods.open` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the target mod file. The message SHALL name the origin and say to add it to `permissions.open` in `mod_conf.yaml`, or that the declared permission was not granted.

#### Scenario: Mod without the open permission
- **WHEN** a mod without a granted `open` permission sends `mods.inspect` with `{ "mod": "https://mods.example.net/clock/" }`
- **THEN** the response has an error with code `-32002` whose message names `https://mods.example.net` and `permissions.open`
- **AND** nothing is requested from `https://mods.example.net`

#### Scenario: Any site
- **WHEN** a mod with `open` granted for `"*"` sends `mods.inspect` for a mod at `https://mods.example.net/clock/mod_conf.yaml`
- **THEN** the mod file is requested and its metadata is returned

#### Scenario: Foreign mod declares open
- **WHEN** a mod from another origin that declares `open` for `"*"` sends `mods.open`
- **THEN** the response has an error with code `-32002` whose message says that the declared permission was not granted
