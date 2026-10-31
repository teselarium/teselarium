# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Math is kept exactly`
- TO: `### Requirement: Math is rendered as MathML`

- FROM: `### Requirement: Code blocks stay as written`
- TO: `### Requirement: Code blocks and emoji`

## MODIFIED Requirements

### Requirement: Math is rendered as MathML
Inline math (`$…$`), display math (`$$…$$`) and fenced blocks labeled `math` in a body SHALL be rendered as `<math>` elements, inline or with `display="block"`, from the formula exactly as written, untouched by markdown. Each SHALL hold the formula's text in an `<annotation encoding="application/x-tex">`. Inline math SHALL need an opening `$` followed by a non-space character and a closing `$` preceded by a non-space character and not followed by a digit; other dollars, and `\$`, SHALL stay text.

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

### Requirement: Code blocks and emoji
Fenced code blocks other than `math` SHALL be rendered as `<pre><code>` with the class `language-<name>` of their info string, holding the block's text exactly. When the info string names one of the common languages of highlight.js, the code SHALL also be split into `<span>` elements whose classes start with `hljs-`, leaving its text unchanged. Emoji shortcodes outside code, with GitHub's names, SHALL be rendered as their emoji; unknown names SHALL stay text.

#### Scenario: Mermaid block
- **WHEN** a body holds a fenced block whose info string is `mermaid`
- **THEN** the rendered HTML has `<pre><code class="language-mermaid">` holding the block's text

#### Scenario: Labeled JavaScript
- **WHEN** a body holds a fenced block labeled `js` with `const answer = 42;`
- **THEN** the rendered `<code class="language-js">` holds `const` in a `span.hljs-keyword` and `42` in a `span.hljs-number`, and its text is `const answer = 42;`

#### Scenario: Unlabeled block
- **WHEN** a body holds a fenced block with no info string
- **THEN** the rendered code has no `<span>` elements

#### Scenario: Shortcodes
- **WHEN** a body holds `Done :tada:, :not_an_emoji:` and `` `:tada:` ``
- **THEN** the rendered text is `Done 🎉, :not_an_emoji:`, and the inline code still holds `:tada:`

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

## ADDED Requirements

### Requirement: Formulas that fail stay as written
A formula that cannot be rendered SHALL be rendered as the code of `add-tile-bodies-and-players`, holding the formula exactly as written: `<code class="language-math math-inline">` inline, `<pre><code class="language-math math-display">` for display, with `data-ot-math-error` holding the reason. The rest of the body SHALL be rendered as usual.

#### Scenario: Unclosed brace
- **WHEN** a body holds `Before $\frac{a}{$ after.`
- **THEN** the rendered paragraph holds `Before `, a `code.language-math` with `\frac{a}{` and a `data-ot-math-error`, and ` after.`

### Requirement: Highlighted code follows the theme
The base stylesheet SHALL color the `hljs-` classes from the theme tokens, so highlighted code follows the frame's color scheme and changes with it without a reload. A mod that opts out of the theme styles SHALL get the code uncolored.

#### Scenario: Keyword color
- **WHEN** a mod that adds no styles shows highlighted JavaScript in the dark color scheme
- **THEN** a `span.hljs-keyword`'s computed color is the dark value of `--ot-primary`

### Requirement: Extras load only when a body needs them
Rendering a body SHALL load the math, highlighting or emoji support only when the body holds a formula, a labeled code block or a shortcode, and each at most once per page. Bodies without them SHALL be rendered without loading any of them.

#### Scenario: Plain body
- **WHEN** the app runs a mod that shows only bodies without formulas, labeled code or shortcodes
- **THEN** none of the three was downloaded
