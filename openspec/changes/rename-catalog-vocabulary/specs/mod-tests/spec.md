# Spec Delta

## MODIFIED Requirements

### Requirement: Unanswered catalog
A `catalog.list` without a queued answer, in a case or in the mount check, SHALL be answered with the live catalog: the catalog, as the app answers it.

#### Scenario: Case without a scripted catalog
- **WHEN** the mod sends `catalog.list` in a case that queued no answer for it
- **THEN** the request resolves with the live catalog, and the report has no finding about `catalog.list`
