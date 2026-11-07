# Proposal

## Why

Tile authors write markdown as they do on GitHub: formulas between dollars, code blocks labeled with their language, and emoji shortcodes such as `:tada:`. After `add-tile-bodies-and-players`, a rendered body keeps formulas exact but shows them as LaTeX source, shows code without colors, and shows `:tada:` as text. Readers of math or code notes get the source, not the result.

All three can be rendered in the engine as plain text transforms, with no DOM and no code running from the tile, so mods get finished HTML from `tiles.renderBody` and `<ot-tile-body>` without writing anything.

## What Changes

- **Math as MathML**: inline math, display math and ```` ```math ```` blocks become MathML, which all three browsers lay out themselves, rendered by Temml in the engine. Each formula keeps its LaTeX source in an `<annotation>`, so it can still be copied. A formula Temml cannot read stays as written, as code. Commands that could link or style (`\href`, `\url`, `\htmlClass` and the like) are never trusted.
- **Highlighted code**: a fenced block labeled with one of the 37 common languages of highlight.js (`js`, `python`, `rust`, `yaml`…) gets syntax colors from the theme, in both color schemes. Unlabeled blocks and other languages stay plain; mermaid blocks stay for `add-tile-body-diagrams`.
- **Emoji shortcodes**: `:tada:` and the other names GitHub uses become their emoji, outside code. Unknown names stay text.
- **Loaded only when needed**: each library loads in the app's page the first time a body needs it, so the app's first load and bodies without extras do not grow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tile-bodies`: rendered bodies hold MathML, highlighted code and emoji; the safe HTML allows the MathML that formulas need; highlighted code follows the theme.
- `mod-api-version`: the mod API version becomes `0.1.7`.

## Impact

- **Code**: `temml`, `rehype-highlight` (which brings `lowlight`'s common languages) and `remark-gemoji` become dependencies, each imported lazily by the tile body renderer in `src/lib/core/tile_bodies/`; the engine keeps scanning bodies for media and players at launch, but renders their HTML only when a mod asks for it (`src/lib/core/engine/mod_tile_bodies.ts`); the tile schema allows MathML and the highlight classes; the base stylesheet gets the highlight colors, the display math layout, and the common math fonts for formulas, ahead of the generic `math` family, which Chromium on Linux resolves to a text font.
- **Sizes**, measured minified: Temml 201 KB (58 KB gzip), the common languages 160 KB (50 KB gzip), emoji names 42 KB (17 KB gzip). Speed: about 0.06 ms per formula and 0.4 ms per 30-line code block. Temml was chosen over KaTeX's MathML output, which lost `\mathbb`, `\mathcal` and stretched brackets in Chromium.
- **Tests**: unit tests of the renderer for formulas, failing formulas, untrusted commands, highlighted and plain code, and emoji; e2e tests that a formula shows as MathML, that code colors follow the color scheme, and that bodies without extras load none of the libraries.
- **Docs**: the tile bodies README (what is rendered and how), the engine README (bodies rendered on request, the `-32603` answer), the theme README (highlight colors), and the mod plugin spec (what a body can hold).
- **Mod API version**: patch, `0.1.6` to `0.1.7`. `tiles.renderBody` returns richer HTML for the same bodies and adds no method, event or key. A mod that read formulas from `code.language-math` finds them in each `<math>`'s `<annotation>`, and code keeps its text. A body that fails to render, such as when a library cannot be loaded, is answered with `-32603`, which `ot-tile-body` shows as it shows any failed request. Existing mods keep working; the "Mod API version" section of the engine's README counts this as a fix or addition.
- **App version**: patch bump while the app is `0.x`, as much as the mod API.
- **Depends on**: `add-tile-bodies-and-players`, whose renderer and `tile-bodies` requirements this change extends, and `add-tile-body-diagrams`, which took mod API `0.1.6`. Both are applied and archived.
- **Out of scope**: highlighting unlabeled blocks by guessing their language; math in the app's own pages; custom emoji; a math font shipped with the app (browsers use their own math fonts).
