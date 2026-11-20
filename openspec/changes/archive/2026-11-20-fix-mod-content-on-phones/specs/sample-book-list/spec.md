# Spec Delta

## ADDED Requirements

### Requirement: Card in a narrow frame
When the mod's frame is narrower than 30rem, the card SHALL show the book's cover above its title, centered, and its labeled values below the title across the card's width, so that each value has room for its text. No word of a value that fits the card's width SHALL be split across lines. In a frame 30rem or wider, the cover SHALL stay beside the title.

#### Scenario: Kallocain's card on a phone
- **WHEN** the user opens Kallocain's card on a 412×915 viewport
- **THEN** the cover is above the heading "Kallocain"
- **AND** "1940", "Sweden" and "Swedish" are each on one line

#### Scenario: Card without a cover on a phone
- **WHEN** the mod is mounted with the config `show_covers: false` and the user opens Kallocain's card on a 412×915 viewport
- **THEN** the heading "Kallocain" is at the top of the card, and "Sweden" is on one line

#### Scenario: Wide frame keeps the cover beside the title
- **WHEN** the user opens Kallocain's card on a 1280×800 viewport
- **THEN** the cover is beside the heading "Kallocain"
