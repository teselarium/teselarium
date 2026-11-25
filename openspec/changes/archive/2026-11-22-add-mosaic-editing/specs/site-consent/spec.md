# Spec Delta

## ADDED Requirements

### Requirement: Lines confirmed at save are remembered
When the user saves a mosaic through the save confirmation (see `mosaic-editing`), the app SHALL remember Allow for each of its `show` lines for that mosaic's address, as if the user had allowed them in the site consent dialog with Remember checked. A remembered Deny of a line the user saved SHALL become Allow. Lines a saved version no longer has SHALL keep their remembered decisions.

#### Scenario: Denied, then saved
- **WHEN** the user denied and remembered `show` `https://covers.openlibrary.org` for a stored mosaic, then saves a version that keeps that line
- **THEN** the remembered decision for that line is Allow, and opening the mosaic shows the covers without asking

#### Scenario: Seen in Settings
- **WHEN** the user saves a new mosaic with two `show` lines and opens `#/settings`
- **THEN** the Mod permissions group lists that mosaic with `2 allowed`
