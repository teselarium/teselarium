# Spec Delta

## ADDED Requirements

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
