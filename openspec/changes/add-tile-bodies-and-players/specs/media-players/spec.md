# Spec Delta

## Purpose

Lets a mod show a video or audio player from a site such as YouTube, which cannot play inside the mod's sandbox: the app shows the player in its own dialog, only for addresses the mod's tiles hold, and asks the reader before the site is contacted.

## ADDED Requirements

### Requirement: Player addresses come from the tiles
An address SHALL be a player address of a mod when it is the `src` of an `<iframe>` in the body of a tile the mod currently receives, uses `https:` and is allowed by the private network guard of media linked by tiles; or when it is a page link or player address of a known site and is a metadata string of such a tile or an image address in its body. No other address SHALL be one.

#### Scenario: Iframe of any site
- **WHEN** a tile's body holds `<iframe src="https://maps.example.net/embed?id=7"></iframe>`
- **THEN** `https://maps.example.net/embed?id=7` is a player address of the mods that receive the tile

#### Scenario: Page link in metadata
- **WHEN** a tile has `video: "https://www.youtube.com/watch?v=aqz-KE-bpKQ"`
- **THEN** that address is a player address of the mods that receive the tile

#### Scenario: Unknown page in metadata
- **WHEN** a tile has `homepage: "https://example.org/about"`
- **THEN** that address is not a player address

### Requirement: Known sites
The app SHALL know YouTube, Vimeo and SoundCloud. A YouTube page link (`youtube.com/watch?v=<id>`, `youtu.be/<id>`) or player address (`youtube.com/embed/<id>`) SHALL play from `https://www.youtube-nocookie.com/embed/<id>`. A Vimeo link (`vimeo.com/<id>`, `player.vimeo.com/video/<id>`) SHALL play from `https://player.vimeo.com/video/<id>`. A SoundCloud track or playlist page SHALL play in the SoundCloud widget, `https://w.soundcloud.com/player/` with the page as its `url`.

#### Scenario: YouTube in privacy-enhanced mode
- **WHEN** the player of `https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30` is shown
- **THEN** its frame's address is `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ`

#### Scenario: Pasted YouTube iframe
- **WHEN** the player of `https://www.youtube.com/embed/aqz-KE-bpKQ` is shown
- **THEN** its frame's address is `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ`

#### Scenario: SoundCloud page
- **WHEN** the player of `https://soundcloud.com/artist/track` is shown
- **THEN** its frame's address is the SoundCloud widget with `url` `https://soundcloud.com/artist/track`

### Requirement: Open a player
`players.open` with `{ url }`, where `url` is a player address of the mod, SHALL show the player dialog. The request SHALL resolve with `true` when the dialog closes after the player was shown, and with `false` when the user closed it before. A `url` that is not a string holding an absolute `https:` address SHALL be answered with error code `-32602`, and a `url` that is not a player address of the mod with `-32002`, both without a dialog and with a message naming `players.open`.

#### Scenario: Played and closed
- **WHEN** the visible mod sends `players.open` with a player address of its tiles, the user presses Play and then Close
- **THEN** the request resolves with `true`

#### Scenario: Address not from the tiles
- **WHEN** a mod sends `players.open` with `{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }`, which none of its tiles holds
- **THEN** the response has an error with code `-32002` whose message names `players.open` and says that the address is not a player of the mod's tiles

### Requirement: Ask before contacting the site
Until the user presses Play, the player dialog SHALL request nothing from the player's site. It SHALL name the asking mod by its title and source, show the host of the address the player will load (and the site's name for a known site), and say that this site will see that the user played this. It SHALL have the buttons Play and Cancel, with Cancel focused, and an **Always play from** checkbox naming the host, unchecked.

#### Scenario: Question before the player
- **WHEN** the visible mod sends `players.open` for a YouTube page link
- **THEN** the dialog names the mod, shows `YouTube` and `www.youtube-nocookie.com`, and no request has been sent to `www.youtube-nocookie.com`

#### Scenario: Cancel
- **WHEN** the user presses Cancel or Escape in the question
- **THEN** the dialog closes, nothing was requested from the site, and the request resolves with `false`

### Requirement: The player frame belongs to the app
After Play, the dialog SHALL show the player in a frame of the app's page, not of the mod's frame, sized for the site (16:9 for YouTube and Vimeo, the widget's height for SoundCloud, the iframe's `width` and `height` as a ratio for other sites). The app SHALL set the frame's sandbox, permissions and referrer policy itself, SHALL NOT take any attribute from the tile, and SHALL send the app's origin, and no more, as the referrer.

#### Scenario: Tile asks for the camera
- **WHEN** a body holds `<iframe src="https://maps.example.net/embed" allow="camera; microphone"></iframe>` and its player is shown
- **THEN** the player frame's `allow` holds neither `camera` nor `microphone`

#### Scenario: Referrer
- **WHEN** the player of a YouTube page link is shown by the app at `https://example.org/app/`
- **THEN** the player's request carries the referrer `https://example.org/`

### Requirement: Close the player
The player dialog SHALL have a Close button, and Escape SHALL close it too. Closing SHALL remove the player frame, so playback stops.

#### Scenario: Escape while playing
- **WHEN** a player is playing and the user presses Escape
- **THEN** the dialog closes and the player frame is no longer in the page

### Requirement: Always play from a site
With **Always play from** checked, Play SHALL remember the host for every mod, kept with the remembered site decisions of `site-consent`. A later `players.open`, from any mod, of an address on a remembered host SHALL show the player without the question.

#### Scenario: Remembered site
- **WHEN** the user checked Always play from `www.youtube-nocookie.com` and pressed Play, and another mod then sends `players.open` for a YouTube address of its tiles
- **THEN** the dialog shows the player at once, without the question

#### Scenario: Not checked
- **WHEN** the user pressed Play without checking it, and the same mod opens the same player again
- **THEN** the question is shown again
