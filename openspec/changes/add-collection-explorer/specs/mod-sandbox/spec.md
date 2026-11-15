# Spec Delta

## MODIFIED Requirements

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
