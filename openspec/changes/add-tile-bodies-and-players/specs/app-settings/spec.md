# Spec Delta

## ADDED Requirements

### Requirement: Sites always played from in Settings
The Mod permissions group SHALL also list each host the user chose to always play from (see `media-players`), as `play media from <host>` for every mod, with a Remove button. Removing it SHALL apply to the next player of that host, which SHALL ask again. A player already shown SHALL keep playing.

#### Scenario: Remembered player site
- **WHEN** the user checked Always play from `www.youtube-nocookie.com`, pressed Play, and opens `#/settings`
- **THEN** the Mod permissions group lists `play media from www.youtube-nocookie.com` for every mod, with a Remove button

#### Scenario: Asked again after removing
- **WHEN** the user removes it and a mod then opens a YouTube player of its tiles
- **THEN** the player dialog asks before contacting the site
