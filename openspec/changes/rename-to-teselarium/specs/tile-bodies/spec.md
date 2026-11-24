## MODIFIED Requirements

### Requirement: Links in bodies open through the app
Each rendered link to an `http:` or `https:` address SHALL carry `data-tes-link`. In a mod's frame, a click on an element with `data-tes-link` that the mod did not cancel SHALL send `links.open` with the link's address, and SHALL NOT navigate the frame.

#### Scenario: Click on a body link
- **WHEN** a mod shows a rendered body and the user clicks its link to `https://peach.blender.org`
- **THEN** the action dialog asks to open `https://peach.blender.org`, and the mod keeps running

#### Scenario: Mod handles the click itself
- **WHEN** the mod calls `preventDefault()` on that click in its own listener
- **THEN** no `links.open` request is sent

### Requirement: Players in bodies become placeholders
An `<iframe>` in a body whose `src` is a player address (see `media-players`), and an image whose address is a page link of a known site, SHALL be rendered as a `<button type="button" class="tes-player">` with `data-tes-player` holding the player address, showing the iframe's `title` or the image's alt text, and the player's site. Rendering SHALL request nothing from that site.

#### Scenario: Pasted YouTube iframe
- **WHEN** a body holds `<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny"></iframe>`
- **THEN** the rendered HTML has a `button.tes-player` whose `data-tes-player` is `https://www.youtube.com/embed/aqz-KE-bpKQ`, showing `Big Buck Bunny` and `youtube.com`, and no `<iframe>`

#### Scenario: Image syntax with a page link
- **WHEN** a body holds `![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)`
- **THEN** the rendered HTML has a `button.tes-player` showing `Trailer`

#### Scenario: Nothing requested before a click
- **WHEN** a mod shows a body with a player placeholder for `https://www.youtube.com/embed/aqz-KE-bpKQ`
- **THEN** no request is sent to `www.youtube.com` or `www.youtube-nocookie.com`

### Requirement: Iframes that are not players
An `<iframe>` in a body whose `src` is not a player address SHALL be rendered as a link to it, with `data-tes-link`, when its address is `http:` or `https:` and allowed by the private network guard of media linked by tiles. Otherwise it SHALL be left out.

#### Scenario: Plain http page
- **WHEN** a body holds `<iframe src="http://example.org/widget" title="Widget"></iframe>`
- **THEN** the rendered HTML has a link to `http://example.org/widget` with the text `Widget` and `data-tes-link`

#### Scenario: Router address
- **WHEN** a body of a tile from `https://example.org` holds `<iframe src="https://192.168.1.1/"></iframe>`
- **THEN** the rendered HTML has neither an iframe, a placeholder nor a link for it

### Requirement: Clicks on player placeholders
In a mod's frame, a click on an element with `data-tes-player` that the mod did not cancel SHALL send `players.open` with the attribute's value.

#### Scenario: Click on a placeholder
- **WHEN** a mod shows a rendered body and the user clicks its player placeholder
- **THEN** the player dialog of `media-players` is shown for that address

### Requirement: Alerts
A blockquote whose first line is only `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`, in any letter case, SHALL be rendered as `<aside class="tes-alert">` with `data-tes-alert` holding the kind in lower case, a first `<p class="tes-alert-title">` holding the kind's name (`Note`, `Tip`, `Important`, `Warning`, `Caution`), then the rest of the quote. Any other blockquote SHALL stay a blockquote.

#### Scenario: Note
- **WHEN** a body holds `> [!NOTE]` then `> Tiles are markdown files.`
- **THEN** the rendered HTML has an `aside.tes-alert` with `data-tes-alert="note"`, a title `Note`, and a paragraph `Tiles are markdown files.`, and no text `[!NOTE]`

#### Scenario: Unknown kind
- **WHEN** a body holds `> [!TODO]` then `> Later.`
- **THEN** the rendered HTML has a `<blockquote>` showing `[!TODO]`

### Requirement: Heading anchors
Each heading of a rendered body SHALL have an `id` made of `user-content-` and the heading's slug, as GitHub makes them: lower case, spaces as `-`, punctuation other than `-` and `_` removed, and `-1`, `-2` added to repeated slugs. A link to `#<slug>` SHALL carry `data-tes-fragment`. In a mod's frame, a click on it that the mod did not cancel SHALL scroll to the heading `user-content-<slug>` nearest to the link, and SHALL NOT navigate the frame.

#### Scenario: Heading ids
- **WHEN** a body holds `## Install it!` twice
- **THEN** the rendered headings have the ids `user-content-install-it` and `user-content-install-it-1`

#### Scenario: Link to a heading
- **WHEN** a mod shows two rendered bodies that both have `## Notes`, and the user clicks `[See notes](#notes)` in the second one
- **THEN** the frame scrolls to the `Notes` heading of the second body, and the mod keeps running

### Requirement: The tile body element
Every mod frame, including the frames of a check, SHALL define the element `tes-tile-body`. Setting its `tile` property to a tile of the mod SHALL send `tiles.renderBody` with the tile's `source` and show the result as the element's children, then fire a bubbling `tes-rendered` event. When the request fails, the element SHALL show the error's message as text with `role="alert"`.

#### Scenario: Show a body with no code
- **WHEN** a mod appends a `tes-tile-body` element and sets its `tile` to a tile whose body holds `# Notes`
- **THEN** the element holds an `<h1>` with `Notes`, and a `tes-rendered` event reached the mod's listener on `document`

#### Scenario: Tile that is not the mod's
- **WHEN** a mod sets a `tes-tile-body` element's `tile` to `{ "source": "https://example.org/other.md" }`
- **THEN** the element shows the message of the `-32602` error with `role="alert"`

### Requirement: Rendered bodies follow the theme
The base stylesheet SHALL style the elements of a rendered body as it styles plain HTML, SHALL style `button.tes-player` as described in "Placeholder box", and SHALL give each kind of `aside.tes-alert` a border in its own theme color. A mod that opts out of the theme styles SHALL get the placeholders as plain buttons that still work.

#### Scenario: Warning color
- **WHEN** a mod that adds no styles shows a rendered `[!WARNING]` alert
- **THEN** the alert's computed left border color is the value of `--tes-warning`

### Requirement: Placeholder box
The base stylesheet SHALL draw `button.tes-player` as a box of the same size whatever its title, with a play mark, two lines for the title, cut with "…" when it is longer, and one line for the site. On hover and keyboard focus, the box SHALL show the whole title over the content below, without moving the page.

#### Scenario: Placeholder shape
- **WHEN** a mod that adds no styles shows a player placeholder with a short title and one with a title too long for two lines
- **THEN** both placeholders have the same width and height, and are narrower than the body

#### Scenario: Long title on hover
- **WHEN** the user hovers the placeholder with the long title
- **THEN** its box grows to show the whole title, and the placeholder keeps its place and size in the page

### Requirement: The tile body element draws diagrams
After showing a body, the `tes-tile-body` element SHALL replace each `<pre>` whose `<code>` has the class `language-mermaid` with the diagram mermaid draws from the code's text, in a `<figure>` that keeps the text in `data-mermaid-source`. It SHALL draw with mermaid's strict security level, so labels are text and diagrams hold no click handlers. The rest of the body SHALL be shown before any diagram is drawn.

#### Scenario: Body with a diagram
- **WHEN** a mod shows, in a `tes-tile-body` element, a body with a paragraph and a mermaid block `flowchart LR` with `Tile --> Mod`
- **THEN** the paragraph is shown while the block is still code, and then the block is replaced by a `<figure>` holding an SVG with the labels `Tile` and `Mod`

#### Scenario: Markup in a label
- **WHEN** a mermaid block has a node labeled `<img src=x onerror=alert(1)>`
- **THEN** the drawn diagram holds no `<img>` element and no `onerror` attribute

### Requirement: Diagrams drawn event
The element SHALL fire a bubbling `tes-diagrams-drawn` event each time every mermaid block in view has been drawn or has failed. `tes-rendered` SHALL keep firing when the body's HTML is shown, before any diagram is drawn. A body without mermaid blocks SHALL fire no `tes-diagrams-drawn` event. When the element shows another body, or leaves the document, before the diagrams of its body are drawn, it SHALL draw none of them and SHALL fire no `tes-diagrams-drawn` event for that body.

#### Scenario: Events in order
- **WHEN** a mod listens for both events and shows a body with one mermaid block in view
- **THEN** `tes-rendered` reaches the listener first, while the block is code, and `tes-diagrams-drawn` after the diagram is shown

#### Scenario: New tile while drawing
- **WHEN** a mod shows a body with a mermaid block in view, and sets the element's `tile` to a tile whose body has no mermaid block before that diagram is drawn
- **THEN** the element shows the second body with no diagram in it, and no `tes-diagrams-drawn` event is fired

### Requirement: Formulas that fail stay as written
A formula that cannot be rendered SHALL be rendered as the code of `add-tile-bodies-and-players`, holding the formula exactly as written: `<code class="language-math math-inline">` inline, `<pre><code class="language-math math-display">` for display math, and `<pre><code class="language-math">` for a fenced `math` block, with `data-tes-math-error` holding the reason. The rest of the body SHALL be rendered as usual.

#### Scenario: Unclosed brace
- **WHEN** a body holds `Before $\frac{a}{$ after.`
- **THEN** the rendered paragraph holds `Before `, a `code.language-math` with `\frac{a}{` and a `data-tes-math-error`, and ` after.`

#### Scenario: Failing math block
- **WHEN** a body holds a fenced block labeled `math` with `\frac{a}{`
- **THEN** the rendered HTML has a `pre > code.language-math` holding `\frac{a}{` with a `data-tes-math-error`

### Requirement: Highlighted code follows the theme
The base stylesheet SHALL color the `hljs-` classes from the theme tokens, so highlighted code follows the frame's color scheme and changes with it without a reload. A mod that opts out of the theme styles SHALL get the code uncolored.

#### Scenario: Keyword color
- **WHEN** a mod that adds no styles shows highlighted JavaScript in the dark color scheme
- **THEN** a `span.hljs-keyword`'s computed color is the dark value of `--tes-primary`
