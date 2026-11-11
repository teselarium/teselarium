# Spec Delta

## MODIFIED Requirements

### Requirement: Throwaway storage slot
During the mount check, the mod SHALL have a storage slot that starts empty and is discarded when the check ends. The mod's real slot SHALL be neither read nor written.

#### Scenario: Real slot untouched
- **WHEN** the user chose 10 books per row in the sample mod, and the sample mod is then checked
- **THEN** during the check the mod's `storage.get` for `columns` returns `null`
- **AND** after the check, opening the sample mod shows 10 books per row
