# tile-bodies Specification

## Purpose

Lets a mod show a tile's markdown body with little code: the engine renders it to safe HTML that works inside the mod's sandbox, with resolved paths, links that open through the app and placeholders for players, and the frame loader offers an element that shows it.

## Requirements

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
The rendered HTML SHALL keep only the HTML GitHub allows in markdown, plus `<video>`, `<audio>`, `<source>`, the MathML elements and attributes that formulas use, and the elements the engine adds. It SHALL hold no script, `style` element or attribute, event handler attribute, form or `<iframe>`, no `href` on MathML, and no `javascript:`, `data:` or `vbscript:` address.

#### Scenario: Script in a body
- **WHEN** a body holds `<script>alert(1)</script>` and `<img src="x.jpg" onerror="alert(1)">`
- **THEN** the rendered HTML has no `<script>` element and no `onerror` attribute

#### Scenario: Script address in a link
- **WHEN** a body holds `[Click](javascript:alert(1))`
- **THEN** the rendered link has no `href` holding `javascript:`

#### Scenario: Link command in a formula
- **WHEN** a body holds `$\href{javascript:alert(1)}{x}$`
- **THEN** the rendered HTML has no link and no `javascript:` address

#### Scenario: MathML written in a body
- **WHEN** a body holds `<math><mi href="https://example.org">x</mi></math>`
- **THEN** the rendered `<mi>` has no `href`

### Requirement: Paths in bodies are resolved against the tile
Each relative address of an image, video, audio, poster, `srcset` candidate or link in a body SHALL be rendered as the absolute address it names, resolved against the tile's `source`. A link to a fragment of the same body (`#heading`) SHALL NOT be resolved (see "Heading anchors"). The tile's `body` SHALL stay as written.

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

### Requirement: Code blocks and emoji
Fenced code blocks other than `math` SHALL be rendered as `<pre><code>` with the class `language-<name>` of their info string, holding the block's text exactly. When the info string names one of the common languages of highlight.js, the code SHALL also be split into `<span>` elements whose classes start with `hljs-`, leaving its text unchanged. Emoji shortcodes outside code, with GitHub's names, SHALL be rendered as their emoji; unknown names SHALL stay text.

#### Scenario: Mermaid block
- **WHEN** a body holds a fenced block whose info string is `mermaid`
- **THEN** the rendered HTML has `<pre><code class="language-mermaid">` holding the block's text

#### Scenario: Labeled JavaScript
- **WHEN** a body holds a fenced block labeled `js` with `const answer = 42;`
- **THEN** the rendered `code.language-js` holds `const` in a `span.hljs-keyword` and `42` in a `span.hljs-number`, and its text is `const answer = 42;`

#### Scenario: Unlabeled block
- **WHEN** a body holds a fenced block with no info string
- **THEN** the rendered code has no `<span>` elements

#### Scenario: Shortcodes
- **WHEN** a body holds `Done :tada:, :not_an_emoji:` and `` `:tada:` ``
- **THEN** the rendered text is `Done 🎉, :not_an_emoji:`, and the inline code still holds `:tada:`

### Requirement: Math is rendered as MathML
Inline math (`$…$`), display math (`$$…$$`) and fenced blocks labeled `math` in a body SHALL be rendered as `<math>` elements, inline or with `display="block"`, from the formula exactly as written, untouched by markdown. Each SHALL hold the formula's text in an `<annotation encoding="application/x-tex">`. Inline math SHALL need an opening `$` followed by a non-space character and a closing `$` preceded by a non-space character and not followed by a digit; other dollars and `\$` SHALL stay text.

#### Scenario: Asterisks in a formula
- **WHEN** a body holds `Inline $x*y*z$.`
- **THEN** the rendered HTML has an inline `<math>` whose annotation holds `x*y*z`, and no `<em>`

#### Scenario: Backslashes in display math
- **WHEN** a body holds `$$` on a line, then `\{x \mid x > 0\} \\ y`, then `$$`
- **THEN** the rendered HTML has a `<math display="block">` whose annotation holds `\{x \mid x > 0\} \\ y`, with every backslash

#### Scenario: Prices are not math
- **WHEN** a body holds `It costs $5 and $10.`
- **THEN** the rendered paragraph's text is `It costs $5 and $10.` and has no `<math>`

#### Scenario: Escaped dollars
- **WHEN** a body holds `It costs \$5 and \$10.`
- **THEN** the rendered paragraph's text is `It costs $5 and $10.` and has no `<math>`

#### Scenario: Fraction
- **WHEN** a body holds `$\frac{a}{b}$`
- **THEN** the rendered `<math>` holds an `<mfrac>` with `a` and `b`

#### Scenario: Math block
- **WHEN** a body holds a fenced block labeled `math` with `E = mc^2`
- **THEN** the rendered HTML has a `<math display="block">` whose annotation holds `E = mc^2`, and no `<pre>` for it

#### Scenario: Formula beside an image
- **WHEN** a mod sends `tiles.renderBody` for a tile whose body holds `![Cover](./cover.jpg)` and `$\frac{a}{b}$`
- **THEN** the result's `html` holds the image and a `<math>` with an `<mfrac>`

### Requirement: Alerts
A blockquote whose first line is only `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`, in any letter case, SHALL be rendered as `<aside class="ot-alert">` with `data-ot-alert` holding the kind in lower case, a first `<p class="ot-alert-title">` holding the kind's name (`Note`, `Tip`, `Important`, `Warning`, `Caution`), then the rest of the quote. Any other blockquote SHALL stay a blockquote.

#### Scenario: Note
- **WHEN** a body holds `> [!NOTE]` then `> Tiles are markdown files.`
- **THEN** the rendered HTML has an `aside.ot-alert` with `data-ot-alert="note"`, a title `Note`, and a paragraph `Tiles are markdown files.`, and no text `[!NOTE]`

#### Scenario: Unknown kind
- **WHEN** a body holds `> [!TODO]` then `> Later.`
- **THEN** the rendered HTML has a `<blockquote>` showing `[!TODO]`

### Requirement: Heading anchors
Each heading of a rendered body SHALL have an `id` made of `user-content-` and the heading's slug, as GitHub makes them: lower case, spaces as `-`, punctuation other than `-` and `_` removed, and `-1`, `-2` added to repeated slugs. A link to `#<slug>` SHALL carry `data-ot-fragment`. In a mod's frame, a click on it that the mod did not cancel SHALL scroll to the heading `user-content-<slug>` nearest to the link, and SHALL NOT navigate the frame.

#### Scenario: Heading ids
- **WHEN** a body holds `## Install it!` twice
- **THEN** the rendered headings have the ids `user-content-install-it` and `user-content-install-it-1`

#### Scenario: Link to a heading
- **WHEN** a mod shows two rendered bodies that both have `## Notes`, and the user clicks `[See notes](#notes)` in the second one
- **THEN** the frame scrolls to the `Notes` heading of the second body, and the mod keeps running

### Requirement: Pictures in bodies
A body's `<picture>` elements SHALL be kept with their `<source>` children's `srcset` and `media`, and the `<img>` inside. Each address of a `srcset` SHALL be resolved against the tile, and SHALL count as an image of the body for media linked by tiles.

#### Scenario: Dark-mode picture
- **WHEN** a body holds a `<picture>` with `<source srcset="https://media.example.net/dark.png" media="(prefers-color-scheme: dark)">` and `<img src="https://media.example.net/light.png">`, and the frame's color scheme is dark
- **THEN** the image shown is `https://media.example.net/dark.png`, and it loads

### Requirement: The tile body element
Every mod frame, including the frames of a check, SHALL define the element `ot-tile-body`. Setting its `tile` property to a tile of the mod SHALL send `tiles.renderBody` with the tile's `source` and show the result as the element's children, then fire a bubbling `ot-rendered` event. When the request fails, the element SHALL show the error's message as text with `role="alert"`.

#### Scenario: Show a body with no code
- **WHEN** a mod appends an `ot-tile-body` element and sets its `tile` to a tile whose body holds `# Notes`
- **THEN** the element holds an `<h1>` with `Notes`, and an `ot-rendered` event reached the mod's listener on `document`

#### Scenario: Tile that is not the mod's
- **WHEN** a mod sets an `ot-tile-body` element's `tile` to `{ "source": "https://example.org/other.md" }`
- **THEN** the element shows the message of the `-32602` error with `role="alert"`

### Requirement: Rendered bodies follow the theme
The base stylesheet SHALL style the elements of a rendered body as it styles plain HTML, SHALL style `button.ot-player` as described in "Placeholder box", and SHALL give each kind of `aside.ot-alert` a border in its own theme color. A mod that opts out of the theme styles SHALL get the placeholders as plain buttons that still work.

#### Scenario: Warning color
- **WHEN** a mod that adds no styles shows a rendered `[!WARNING]` alert
- **THEN** the alert's computed left border color is the value of `--ot-warning`

### Requirement: Placeholder box
The base stylesheet SHALL draw `button.ot-player` as a box of the same size whatever its title, with a play mark, two lines for the title, cut with "…" when it is longer, and one line for the site. On hover and keyboard focus, the box SHALL show the whole title over the content below, without moving the page.

#### Scenario: Placeholder shape
- **WHEN** a mod that adds no styles shows a player placeholder with a short title and one with a title too long for two lines
- **THEN** both placeholders have the same width and height, and are narrower than the body

#### Scenario: Long title on hover
- **WHEN** the user hovers the placeholder with the long title
- **THEN** its box grows to show the whole title, and the placeholder keeps its place and size in the page

### Requirement: The tile body element draws diagrams
After showing a body, the `ot-tile-body` element SHALL replace each `<pre>` whose `<code>` has the class `language-mermaid` with the diagram mermaid draws from the code's text, in a `<figure>` that keeps the text in `data-mermaid-source`. It SHALL draw with mermaid's strict security level, so labels are text and diagrams hold no click handlers. The rest of the body SHALL be shown before any diagram is drawn.

#### Scenario: Body with a diagram
- **WHEN** a mod shows, in an `ot-tile-body` element, a body with a paragraph and a mermaid block `flowchart LR` with `Tile --> Mod`
- **THEN** the paragraph is shown while the block is still code, and then the block is replaced by a `<figure>` holding an SVG with the labels `Tile` and `Mod`

#### Scenario: Markup in a label
- **WHEN** a mermaid block has a node labeled `<img src=x onerror=alert(1)>`
- **THEN** the drawn diagram holds no `<img>` element and no `onerror` attribute

### Requirement: A diagram's own configuration
The element SHALL draw with mermaid's default layout and look, which a diagram MAY change in its own configuration (front matter or an `%%{init}%%` directive). A diagram's own configuration SHALL NOT turn HTML labels on.

#### Scenario: HTML labels in the diagram's configuration
- **WHEN** a mermaid block turns `htmlLabels` on in its front matter or in an `%%{init}%%` directive, and has a node labeled `<img src=x>`
- **THEN** the drawn diagram holds no `<img>` element and no `<foreignObject>`

### Requirement: Diagrams are drawn when they come into view
The element SHALL request the library and draw a block only when the block comes into the frame's view, one block at a time, letting the frame paint between two blocks. A body whose blocks never come into view SHALL never request the library.

#### Scenario: Block below the fold
- **WHEN** a mod shows a long body whose only mermaid block is out of view
- **THEN** no `libs.load` request is sent until the user scrolls the block into view

### Requirement: Blocks being drawn are marked busy
While a mermaid block in view waits to be drawn or is being drawn, the element SHALL set `aria-busy="true"` on it, so that the base stylesheet pulses it. A block that fails SHALL lose the mark. After a color scheme change, a diagram in view SHALL carry the mark until its new drawing replaces it. A block out of view, and every block when `diagrams` is `"source"`, SHALL NOT be marked.

#### Scenario: Busy while drawing
- **WHEN** a body with a mermaid block in view is shown
- **THEN** the block has `aria-busy="true"` until the `<figure>` replaces it, and the `<figure>` has no `aria-busy`

#### Scenario: Failed block is not busy
- **WHEN** a mermaid block in view fails to draw
- **THEN** it stays as code with no `aria-busy` attribute

#### Scenario: Busy while redrawn
- **WHEN** a diagram in view is drawn and the user switches the app to dark
- **THEN** its `<figure>` has `aria-busy="true"` until the new drawing replaces it

#### Scenario: Not busy out of view or as code
- **WHEN** a body has a mermaid block out of view, or `diagrams` is `"source"`
- **THEN** the block has no `aria-busy` attribute

### Requirement: A block that fails stays as code
When mermaid cannot draw a block, the block SHALL stay as written, as code, and the element SHALL go on with the other blocks.

#### Scenario: Syntax error
- **WHEN** a body holds a mermaid block `flowchart LR` with `A -->` and a valid block after it
- **THEN** the first block stays as code and the second is drawn

### Requirement: Diagrams follow the color scheme
Diagrams SHALL be drawn with the theme's colors for the frame's current color scheme. When the color scheme changes, the element SHALL draw its diagrams again, from their kept text, with the new colors.

#### Scenario: Switch to dark
- **WHEN** a diagram is drawn in the light color scheme and the user switches the app to dark
- **THEN** the diagram is drawn again with the dark theme's colors, and the frame was not reloaded

### Requirement: Diagrams drawn event
The element SHALL fire a bubbling `ot-diagrams-drawn` event each time every mermaid block in view has been drawn or has failed. `ot-rendered` SHALL keep firing when the body's HTML is shown, before any diagram is drawn. A body without mermaid blocks SHALL fire no `ot-diagrams-drawn` event. When the element shows another body, or leaves the document, before the diagrams of its body are drawn, it SHALL draw none of them and SHALL fire no `ot-diagrams-drawn` event for that body.

#### Scenario: Events in order
- **WHEN** a mod listens for both events and shows a body with one mermaid block in view
- **THEN** `ot-rendered` reaches the listener first, while the block is code, and `ot-diagrams-drawn` after the diagram is shown

#### Scenario: New tile while drawing
- **WHEN** a mod shows a body with a mermaid block in view, and sets the element's `tile` to a tile whose body has no mermaid block before that diagram is drawn
- **THEN** the element shows the second body with no diagram in it, and no `ot-diagrams-drawn` event is fired

### Requirement: Keep diagrams as code
Setting the element's `diagrams` property to `"source"` SHALL keep every mermaid block as code and SHALL never request the library. Its default value SHALL be `"draw"`.

#### Scenario: Source only
- **WHEN** a mod sets `diagrams` to `"source"` on an element and shows a body with a mermaid block in view
- **THEN** the block stays as code and no `libs.load` request is sent

### Requirement: Formulas that fail stay as written
A formula that cannot be rendered SHALL be rendered as the code of `add-tile-bodies-and-players`, holding the formula exactly as written: `<code class="language-math math-inline">` inline, `<pre><code class="language-math math-display">` for display math, and `<pre><code class="language-math">` for a fenced `math` block, with `data-ot-math-error` holding the reason. The rest of the body SHALL be rendered as usual.

#### Scenario: Unclosed brace
- **WHEN** a body holds `Before $\frac{a}{$ after.`
- **THEN** the rendered paragraph holds `Before `, a `code.language-math` with `\frac{a}{` and a `data-ot-math-error`, and ` after.`

#### Scenario: Failing math block
- **WHEN** a body holds a fenced block labeled `math` with `\frac{a}{`
- **THEN** the rendered HTML has a `pre > code.language-math` holding `\frac{a}{` with a `data-ot-math-error`

### Requirement: Bodies that fail to render
When a body cannot be rendered, such as when a library it needs cannot be loaded, `tiles.renderBody` SHALL be answered with error code `-32603` and a message starting with `tiles.renderBody`. The failed render SHALL NOT be kept, so a later request renders the body again.

#### Scenario: Library that cannot load
- **WHEN** a mod sends `tiles.renderBody` for a body with a formula while the math library cannot be loaded
- **THEN** the response has an error with code `-32603` whose message starts with `tiles.renderBody`

#### Scenario: Next request after a failure
- **WHEN** the mod sends the same request once the library can be loaded
- **THEN** the result's `html` holds a `<math>`

### Requirement: Highlighted code follows the theme
The base stylesheet SHALL color the `hljs-` classes from the theme tokens, so highlighted code follows the frame's color scheme and changes with it without a reload. A mod that opts out of the theme styles SHALL get the code uncolored.

#### Scenario: Keyword color
- **WHEN** a mod that adds no styles shows highlighted JavaScript in the dark color scheme
- **THEN** a `span.hljs-keyword`'s computed color is the dark value of `--ot-primary`

### Requirement: Formulas use a math font the system has
The base stylesheet SHALL give `<math>` elements the font family `"STIX Two Math", "STIX Math", "Cambria Math", "Latin Modern Math", math`, so a browser uses one of these math fonts when the system has it, and the browser's own math font otherwise. A mod that opts out of the theme styles SHALL get the browser's default.

#### Scenario: Math font
- **WHEN** a mod that adds no styles shows a body with a formula
- **THEN** the `<math>` element's computed font family is `"STIX Two Math", "STIX Math", "Cambria Math", "Latin Modern Math", math`

### Requirement: Extras load only when a body needs them
Rendering a body SHALL load the math support only for a formula, the highlighting only for a fenced code block labeled other than `math` or `mermaid`, and the emoji support only for `:name:` outside code, `name` being lowercase letters, digits, `_`, `+` or `-`; each at most once per page. Dollars that stay text SHALL NOT count as formulas. Bodies without them SHALL load none of them.

#### Scenario: Name that is not an emoji
- **WHEN** a body holds `It starts at 10:30:45.`
- **THEN** the emoji support is loaded, and the rendered text is `It starts at 10:30:45.`

#### Scenario: Plain body
- **WHEN** the app runs a mod that shows only bodies without formulas, labeled code or shortcodes, one of them holding `It costs $5 and $10.`
- **THEN** none of the three was downloaded
