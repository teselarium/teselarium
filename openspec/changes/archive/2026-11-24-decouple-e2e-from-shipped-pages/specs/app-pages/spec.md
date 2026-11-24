## MODIFIED Requirements

### Requirement: Vanilla pages
The vanilla app SHALL ship an index page for Home, Guides and About, each with a level 1 heading and listed in the sidebar, and each loading without browser errors. The requirement says nothing about the pages' wording, which the instance owner may change freely.

#### Scenario: Vanilla Home
- **WHEN** the vanilla app is opened with no hash
- **THEN** the Home page shows a level 1 heading and no browser error occurs

#### Scenario: Vanilla Guides and About
- **WHEN** the vanilla app is opened at `#/guides` and at `#/about`
- **THEN** each page shows a level 1 heading and its sidebar item is the current one
