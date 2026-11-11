# Spec Delta

## ADDED Requirements

### Requirement: Pages keep a reading width
A page's content SHALL be at most `--ot-reading-width` wide and centered in the page area. When the page area is narrower, the content SHALL fill it. Pages SHALL have no theater mode.

#### Scenario: Wide page area
- **WHEN** the Home page is shown in a 2560×1080 viewport
- **THEN** the page's content is as wide as the value of `--ot-reading-width`, and the space left of it and the space right of it differ by at most 1 pixel

#### Scenario: Narrow page area
- **WHEN** the Home page is shown in a 600×800 viewport
- **THEN** the page's content fills the page area's width

#### Scenario: Theater mode does not widen pages
- **WHEN** theater mode is on and the Home page is shown in a 2560×1080 viewport
- **THEN** the page's content is as wide as the value of `--ot-reading-width`
