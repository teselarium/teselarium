## MODIFIED Requirements

### Requirement: API range in the check
The bundle check SHALL compare the mod's `api` range with the app's mod API version. A missing range SHALL be a `bundle` warning that names `api`. A range that does not match SHALL be a `bundle` warning that names the range and the app's mod API version. This finding SHALL come right after the mod file's, before the findings of the entrypoint, the tile type and the collection, as in the stage bar. No dialog SHALL be shown, and the mount check SHALL still run.

#### Scenario: Mod for another API
- **WHEN** a mod with `api: "^0.3.0"` and a valid bundle is checked
- **THEN** no dialog is shown, the report has a `bundle` warning that names `^0.3.0` and the app's mod API version, and `mountChecked` is `true`

#### Scenario: Range finding comes first
- **WHEN** a mod without `api`, whose default mosaic's collection has a tile that does not match its type, is checked
- **THEN** the first finding is the `bundle` warning about the missing `api` range, followed by the tile's warning
