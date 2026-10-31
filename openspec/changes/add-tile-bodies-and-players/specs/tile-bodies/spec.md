# Spec Delta

## Purpose

Lets a mod show a tile's markdown body with little code: the engine renders it to safe HTML that works inside the mod's sandbox, with resolved paths, links that open through the app and placeholders for players, and the frame loader offers an element that shows it.

## ADDED Requirements

### Requirement: Render a tile's body
`tiles.renderBody` with `{ source }` SHALL answer `{ html }`: the body of the mod's tile whose `source` is `source`, rendered from GitHub-flavored markdown to HTML. The tiles SHALL be those the mod currently receives, after "Reload tiles" too. An empty body SHALL give `""`. A `source` that is not a string, or names no tile of the mod, SHALL be answered with error code `-32602` and a message naming `tiles.renderBody` and the problem.

#### Scenario: Body of a tile
- **WHEN** the sample book list mod sends `tiles.renderBody` with the source of the tile `kallocain.md`
- **THEN** the result's `html` holds the tile's paragraphs as `<p>` elements and its emphasis as `<em>`

#### Scenario: Not a tile of the mod
- **WHEN** a mod sends `tiles.renderBody` with `{ "source": "https://example.org/other.md" }`, which is not one of its tiles
- **THEN** the response has an error with code `-32602` whose message names `tiles.renderBody` and says that the source is not one of the mod's tiles

#### Scenario: After reloading the tiles
- **WHEN** a tile's body changes on its host, the user presses "Reload tiles", and the mod sends `tiles.renderBody` for that tile
- **THEN** the result is the new body, rendered

### Requirement: Rendered bodies hold only safe HTML
The rendered HTML SHALL keep only the HTML GitHub allows in markdown, plus `<video>`, `<audio>`, `<source>` and the elements the engine adds. It SHALL hold no script, `style` element or attribute, event handler attribute, form or `<iframe>`, and no `javascript:`, `data:` or `vbscript:` address.

#### Scenario: Script in a body
- **WHEN** a body holds `<script>alert(1)</script>` and `<img src="x.jpg" onerror="alert(1)">`
- **THEN** the rendered HTML has no `<script>` element and no `onerror` attribute

#### Scenario: Script address in a link
- **WHEN** a body holds `[Click](javascript:alert(1))`
- **THEN** the rendered link has no `href` holding `javascript:`

### Requirement: Paths in bodies are resolved against the tile
Each relative address of an image, video, audio, poster or link in a body SHALL be rendered as the absolute address it names, resolved against the tile's `source`. A link to a fragment of the same body (`#heading`) SHALL stay as written. The tile's `body` SHALL stay as written.

#### Scenario: Relative image
- **WHEN** the body of `https://example.org/books/kallocain.md` holds `![Cover](./cover.jpg)`
- **THEN** the rendered image's `src` is `https://example.org/books/cover.jpg`

#### Scenario: Relative link
- **WHEN** the same body holds `[Next](../films/stalker.md)`
- **THEN** the rendered link's `href` is `https://example.org/films/stalker.md`

### Requirement: Images in bodies load lazily
Each rendered image SHALL have `loading="lazy"` and `decoding="async"`, and SHALL keep the `width` and `height` the body gives it.

#### Scenario: Image attributes
- **WHEN** a body holds `<img src="https://media.example.net/a.jpg" width="320" height="200" alt="A">`
- **THEN** the rendered image has `loading="lazy"`, `decoding="async"`, `width="320"` and `height="200"`

### Requirement: Video and audio in bodies
A body's `<video>` and `<audio>` elements, with their `<source>` children, SHALL be kept with their `http:` or `https:` addresses, `width`, `height` and `poster`, and rendered with `controls` and `preload="metadata"`, without `autoplay`, whatever the body says.

#### Scenario: Video with autoplay
- **WHEN** a body holds `<video src="./trailer.mp4" autoplay></video>`
- **THEN** the rendered element is `<video>` with `src` resolved against the tile, `controls`, `preload="metadata"` and no `autoplay`

### Requirement: Links in bodies open through the app
Each rendered link to an `http:` or `https:` address SHALL carry `data-ot-link`. In a mod's frame, a click on an element with `data-ot-link` that the mod did not cancel SHALL send `links.open` with the link's address, and SHALL NOT navigate the frame.

#### Scenario: Click on a body link
- **WHEN** a mod shows a rendered body and the user clicks its link to `https://peach.blender.org`
- **THEN** the action dialog asks to open `https://peach.blender.org`, and the mod keeps running

#### Scenario: Mod handles the click itself
- **WHEN** the mod calls `preventDefault()` on that click in its own listener
- **THEN** no `links.open` request is sent

### Requirement: Players in bodies become placeholders
An `<iframe>` in a body whose `src` is a player address (see `media-players`), and an image whose address is a page link of a known site, SHALL be rendered as a `<button type="button" class="ot-player">` with `data-ot-player` holding the player address, showing the iframe's `title` or the image's alt text, and the player's site. Rendering SHALL request nothing from that site.

#### Scenario: Pasted YouTube iframe
- **WHEN** a body holds `<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny"></iframe>`
- **THEN** the rendered HTML has a `button.ot-player` whose `data-ot-player` is `https://www.youtube.com/embed/aqz-KE-bpKQ`, showing `Big Buck Bunny` and `youtube.com`, and no `<iframe>`

#### Scenario: Image syntax with a page link
- **WHEN** a body holds `![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)`
- **THEN** the rendered HTML has a `button.ot-player` showing `Trailer`

#### Scenario: Nothing requested before a click
- **WHEN** a mod shows a body with a player placeholder for `https://www.youtube.com/embed/aqz-KE-bpKQ`
- **THEN** no request is sent to `www.youtube.com` or `www.youtube-nocookie.com`

### Requirement: Iframes that are not players
An `<iframe>` in a body whose `src` is not a player address SHALL be rendered as a link to it, with `data-ot-link`, when its address is `http:` or `https:` and allowed by the private network guard of media linked by tiles. Otherwise it SHALL be left out.

#### Scenario: Plain http page
- **WHEN** a body holds `<iframe src="http://example.org/widget" title="Widget"></iframe>`
- **THEN** the rendered HTML has a link to `http://example.org/widget` with the text `Widget` and `data-ot-link`

#### Scenario: Router address
- **WHEN** a body of a tile from `https://example.org` holds `<iframe src="https://192.168.1.1/"></iframe>`
- **THEN** the rendered HTML has neither an iframe, a placeholder nor a link for it

### Requirement: Clicks on player placeholders
In a mod's frame, a click on an element with `data-ot-player` that the mod did not cancel SHALL send `players.open` with the attribute's value.

#### Scenario: Click on a placeholder
- **WHEN** a mod shows a rendered body and the user clicks its player placeholder
- **THEN** the player dialog of `media-players` is shown for that address

### Requirement: Extras stay as written
Fenced code blocks SHALL be rendered as `<pre><code>` with the class `language-<name>` of their info string, including `mermaid`. Math, alerts and emoji shortcodes SHALL be rendered as their text.

#### Scenario: Mermaid block
- **WHEN** a body holds a fenced block whose info string is `mermaid`
- **THEN** the rendered HTML has `<pre><code class="language-mermaid">` holding the block's text

### Requirement: The tile body element
Every mod frame, including the frames of a check, SHALL define the element `ot-tile-body`. Setting its `tile` property to a tile of the mod SHALL send `tiles.renderBody` with the tile's `source` and show the result as the element's children, then fire a bubbling `ot-rendered` event. When the request fails, the element SHALL show the error's message as text with `role="alert"`.

#### Scenario: Show a body with no code
- **WHEN** a mod appends an `ot-tile-body` element and sets its `tile` to a tile whose body holds `# Notes`
- **THEN** the element holds an `<h1>` with `Notes`, and an `ot-rendered` event reached the mod's listener on `document`

#### Scenario: Tile that is not the mod's
- **WHEN** a mod sets an `ot-tile-body` element's `tile` to `{ "source": "https://example.org/other.md" }`
- **THEN** the element shows the message of the `-32602` error with `role="alert"`

### Requirement: Rendered bodies follow the theme
The base stylesheet SHALL style the elements of a rendered body as it styles plain HTML, and SHALL style `button.ot-player` as a box that shows its title and site. A mod that opts out of the theme styles SHALL get the placeholders as plain buttons that still work.

#### Scenario: Placeholder shape
- **WHEN** a mod that adds no styles shows a player placeholder
- **THEN** the placeholder's computed `aspect-ratio` is `16 / 9`
