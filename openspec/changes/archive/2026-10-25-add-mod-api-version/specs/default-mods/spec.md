## MODIFIED Requirements

### Requirement: Mod viewer
The mod viewer `mod_viewer` SHALL declare `open` for `"*"`, and SHALL show the mod named by its `target` parameter, using `mods.inspect`: title, version, description, name, source, API range and whether it matches the app's mod API version, tile type, sample collection, config, and each declared permission with its reason and whether it would be granted. It SHALL NOT need a collection. Without `target`, it SHALL say that no mod was given. When the mod cannot be inspected, it SHALL show the error message.

#### Scenario: View the sample mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/book_list`
- **THEN** the viewer's frame shows `Book List`, `1.0.0`, its description, the config value `show_covers`, and the `show` permission for `https://upload.wikimedia.org` with the reason `Shows the book covers`, marked as granted
- **AND** it shows the API range `^0.1.0`, marked as matching

#### Scenario: View a mod for another API
- **WHEN** the viewer shows a mod with `api: "^0.2.0"`
- **THEN** the viewer's frame shows `^0.2.0` and the app's mod API version, marked as not matching

#### Scenario: View a mod without a range
- **WHEN** the viewer shows a mod file without `api`
- **THEN** the viewer's frame says that the mod declares no API range

#### Scenario: No target
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame says that no mod was given

#### Scenario: Missing target
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/missing`
- **THEN** the viewer's frame shows an error that names `404`
