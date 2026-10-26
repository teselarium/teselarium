## MODIFIED Requirements

### Requirement: Permission hosts are origins
Each permission `host` SHALL be an origin: an `http:` or `https:` scheme, a host name and an optional port, with no path, query or fragment. In `show`, `connect`, `embed` and `code`, the host SHALL also be allowed to be a wildcard host: an origin whose host name starts with `*.` as its whole leftmost label, followed by at least two labels, such as `https://*.us.archive.org`. A `*` anywhere else SHALL be rejected. In `open` only, the host SHALL also be allowed to be exactly `"*"`, meaning any site, and a wildcard host SHALL be rejected. Any other value SHALL fail with a mod format error that names the host.

#### Scenario: Host with a port
- **WHEN** a `connect` entry has host `"http://localhost:8080"`
- **THEN** the mod loads and the permission's host is `"http://localhost:8080"`

#### Scenario: Host with a path
- **WHEN** a `show` entry has host `"https://example.org/images"`
- **THEN** loading fails with a mod format error whose message names `https://example.org/images` and says that a host must be an origin

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

#### Scenario: Other scheme
- **WHEN** a `connect` entry has host `"wss://example.org"`
- **THEN** loading fails with a mod format error whose message names `wss://example.org`

#### Scenario: Any site for open
- **WHEN** an `open` entry has host `"*"`
- **THEN** the mod loads and the permission's host is `"*"`

#### Scenario: Any site outside open
- **WHEN** a `show` entry has host `"*"`
- **THEN** loading fails with a mod format error whose message says that `"*"` is only allowed in `permissions.open`
