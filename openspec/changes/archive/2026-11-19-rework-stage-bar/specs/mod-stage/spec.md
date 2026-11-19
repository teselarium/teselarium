# Spec Delta

## ADDED Requirements

### Requirement: Open a combination
Choosing an entry in a stage bar list, or "Stop using these sites", SHALL open the chosen run link in a new sandbox that becomes visible, takes the visible sandbox's opener and section, and gets a new history entry with that run link. The previous sandbox SHALL then be closed and its mod stopped. Forward entries SHALL be dropped as for any opened link.

#### Scenario: Back to the previous combination
- **WHEN** the user chose Book List in the mod list of "Nobel laureates on the map" and presses the browser's back button
- **THEN** "Nobel laureates on the map" runs again, in a new sandbox, and the Book List sandbox is still open behind the forward entry

#### Scenario: Close after a swap
- **WHEN** the mosaic explorer opened "Nobel laureates on the map", the user chose another mod in the stage bar, and presses ×
- **THEN** the mosaic explorer is visible in the state it was left in

#### Scenario: Section after a swap
- **WHEN** the user swapped the mod of a mosaic opened from Mosaics, then opens Home and Mosaics again
- **THEN** the swapped sandbox is visible and the Mosaics item is the current one

### Requirement: A home mod is not replaced by a combination
When the visible sandbox is the home mod shown at `#/`, choosing an entry in a stage bar list SHALL open the chosen run link as a followed link does: in a new sandbox whose opener is the home mod, with a new history entry. The home mod SHALL keep running.

#### Scenario: Swap from a home mod
- **WHEN** an instantiation's Home targets Country Map with the laureates' books, and the user chooses Book List in its mod list
- **THEN** Book List is the visible mod, and closing it shows the home mod again
