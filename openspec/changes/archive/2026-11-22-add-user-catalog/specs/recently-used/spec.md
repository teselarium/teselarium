# Spec Delta

## ADDED Requirements

### Requirement: Removed user mosaics are forgotten
When a user mosaic is removed, one at a time or with "Remove all", the app SHALL drop it from the recently used mosaics, from the app's storage too, so the stage bar's lists don't offer a mosaic that is gone. Recently used mods, collections and combinations SHALL be kept.

#### Scenario: Opened, then removed
- **WHEN** the user opened a stored mosaic, removed it in the mosaic viewer, and opens the mosaic list of another sandbox
- **THEN** the list does not hold that mosaic, and its mod and collection are still recently used
