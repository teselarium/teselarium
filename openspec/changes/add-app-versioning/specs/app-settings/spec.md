## ADDED Requirements

### Requirement: Versions on the Settings page
The Settings page SHALL have a Version group, after the Appearance and Sidebar groups, that shows the app's version, as written in the app's `package.json` when the app was built, and the app's mod API version. Each SHALL be labeled, as `OpenTesela` and `Mod API`, and shown as plain text that the user can select and copy.

#### Scenario: Vanilla versions
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the Version group shows `OpenTesela` with the version of the app's `package.json` and `Mod API` with the app's mod API version

#### Scenario: Version follows the build
- **WHEN** the app's `package.json` version is changed to `0.2.0` and the app is built again
- **THEN** the Version group shows `OpenTesela` `0.2.0`

#### Scenario: Copy the versions
- **WHEN** the user selects the text of the Version group and copies it
- **THEN** the copied text includes both versions
