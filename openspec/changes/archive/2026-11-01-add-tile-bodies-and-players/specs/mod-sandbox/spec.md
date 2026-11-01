# Spec Delta

## MODIFIED Requirements

### Requirement: Media linked by tiles
When "Load media linked by tiles" is on as a mod starts, the system SHALL let the mod load, as images, video and audio, each file whose `http:` or `https:` URL is a metadata string of a tile the mod receives, inside lists and nested mappings too, or the address of an image, video, audio, `<source>`, poster or `srcset` candidate in that tile's rendered body (see `tile-bodies`). Mods from the app's origin and from other origins SHALL get them alike. Tiles the mod does not receive, and the other addresses of a body, SHALL allow nothing.

#### Scenario: Image linked by a tile
- **WHEN** a mod from the app's origin without permissions is opened with a collection whose tile has `image: "https://media.example.net/covers/kallocain.jpg"`, and shows that URL as an image
- **THEN** the image loads and no issue is reported

#### Scenario: Audio linked by a tile
- **WHEN** a mod without permissions is opened with a tile that has `audio: "https://media.example.net/sound/theme.mp3"`, and plays that URL in an `<audio>` element
- **THEN** the request for `https://media.example.net/sound/theme.mp3` is sent and no issue is reported

#### Scenario: URL inside a nested value
- **WHEN** a mod is opened with a tile that has `gallery: [{ src: "https://media.example.net/a.jpg" }]`, and shows `https://media.example.net/a.jpg`
- **THEN** the image loads

#### Scenario: URL with a query
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg?size=large#top"`, and shows that URL
- **THEN** the image loads

#### Scenario: Mod from another origin
- **WHEN** the mod at `https://mods.example.net/probe/mod_conf.yaml`, which declares no permissions, is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, and shows that URL
- **THEN** the image loads

#### Scenario: Tile of another type
- **WHEN** a mod with a tile type is opened with a collection in which only a tile of another type has `image: "https://media.example.net/other.jpg"`, and the mod shows that URL
- **THEN** the request is blocked before it is sent

#### Scenario: Image in the body
- **WHEN** a mod is opened with a tile whose body holds `![Still](https://media.example.net/body.jpg)`, and shows the tile's rendered body
- **THEN** the image loads

#### Scenario: Video and poster in the body
- **WHEN** a mod is opened with a tile whose body holds `<video src="https://media.example.net/trailer.mp4" poster="https://media.example.net/still.jpg"></video>`, and shows the rendered body
- **THEN** the requests for `https://media.example.net/still.jpg` and `https://media.example.net/trailer.mp4` are sent and not blocked

#### Scenario: URL in the body
- **WHEN** a mod is opened with a tile whose body holds the text `See https://media.example.net/text.jpg` and no image of it, and the mod shows that URL as an image
- **THEN** the request is blocked before it is sent

#### Scenario: Setting switched off
- **WHEN** "Load media linked by tiles" is off and a mod is opened with a tile that has `image: "https://media.example.net/cover.jpg"`, and shows that URL
- **THEN** the request is blocked before it is sent
- **AND** no issue names the tile
