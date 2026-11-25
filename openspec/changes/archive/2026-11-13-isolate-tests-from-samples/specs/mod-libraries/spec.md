## MODIFIED Requirements

### Requirement: Libraries come from the app
The library's code SHALL come from the app's own host. Loading it SHALL send no request to another host. The app SHALL download a library only when a frame first requests it, and a frame that never requests it SHALL NOT receive it.

#### Scenario: No third-party request
- **WHEN** a mod loads mermaid
- **THEN** every request made for it goes to the app's origin

#### Scenario: Not downloaded before a request
- **WHEN** the app is opened and runs a mod that does not load a library
- **THEN** the mermaid code was not downloaded
