## MODIFIED Requirements

### Requirement: Who listed an entry and where it lives
Each entry of the catalog SHALL tell who listed it: `"instance"` for an entry of the instance catalog, `"default"` for a default mosaic, or `"user"` for a user catalog entry. It SHALL also tell where its file lives: `"browser"` for a `teselarium-browser:` address, or `"remote"` for any other address.

#### Scenario: Marks of the vanilla catalog with a user mosaic
- **WHEN** the switch is on and the user imported a mosaic
- **THEN** the sample mosaics are listed by the instance and remote, the default mosaics by default and remote, and the imported mosaic by the user and in the browser
