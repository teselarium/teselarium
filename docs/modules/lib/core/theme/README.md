# Theme Module

## Introduction

The app and its mods share one look: a set of design tokens with a light and a dark value each, a classless base stylesheet built on them, and the user's choice of theme (System, Light or Dark), resolved to a color scheme, `light` or `dark`. The app's own interface and every mod frame follow the same color scheme, and switch together without reloading.

A mod gets all of it by default and needs to learn nothing: plain HTML in its frame already looks right in light and dark. Any CSS the mod writes wins over the theme, so it stays free to look however its author wants.

### Theme tokens

Each token is a CSS custom property. The color tokens are roles, named like shadcn/ui's under the `--ot-` prefix, and have a different value in each color scheme. The other tokens are the same in both. The app's own interface uses the same tokens: shadcn's variables in the app are aliases of them.

| Token | Light | Dark | For |
|---|---|---|---|
| `--ot-background` | `#f6f1e7` | `#0f141d` | the page |
| `--ot-foreground` | `#1d2433` | `#f2ede3` | text on the page |
| `--ot-card` | `#ffffff` | `#18202c` | cards (`<article>`), alerts, form fields |
| `--ot-card-foreground` | `#1d2433` | `#f2ede3` | text on `card` |
| `--ot-popover` | `#ffffff` | `#18202c` | dialogs |
| `--ot-popover-foreground` | `#1d2433` | `#f2ede3` | text on `popover` |
| `--ot-primary` | `#1f4e9c` | `#78a6f2` | selection, pressed buttons, the primary button |
| `--ot-primary-foreground` | `#ffffff` | `#0f141d` | text on `primary` |
| `--ot-secondary` | `#0b6f6c` | `#4fc3bb` | links, secondary buttons (as outlines) |
| `--ot-secondary-foreground` | `#ffffff` | `#0f141d` | text on a filled `secondary` (the app's shadcn variant) |
| `--ot-muted` | `#f9f5ee` | `#141a25` | quiet fills: code, `pre`, table row hover |
| `--ot-muted-foreground` | `#5b6170` | `#a4abb9` | secondary text, table headers, placeholders |
| `--ot-accent` | `#f2c14e` | `#e9b949` | the hover fill of buttons, always behind dark text |
| `--ot-accent-foreground` | `#1d2433` | `#0f141d` | text on `accent` |
| `--ot-highlight` | `#9cc46f` | `#8fbb62` | tag badges (`data-ot-variant="secondary"` on a `<span>`) |
| `--ot-highlight-foreground` | `#1d2433` | `#0f141d` | text on `highlight` |
| `--ot-destructive` | `#b3261e` | `#f08a7a` | errors, alerts, invalid fields, destructive buttons |
| `--ot-destructive-foreground` | `#ffffff` | `#0f141d` | text on a filled destructive button |
| `--ot-warning` | `#8a5a00` | `#f5b04a` | warnings |
| `--ot-success` | `#3a6f22` | `#8fd18a` | success |
| `--ot-border` | `#e3d9c6` | `#283245` | borders and separators |
| `--ot-input` | `#cbbfa8` | `#3a465c` | field borders, the switch's track |
| `--ot-ring` | `#1f4e9c` | `#78a6f2` | focus rings |
| `--ot-font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | same | text |
| `--ot-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | same | code |
| `--ot-font-size` | `1rem` | same | |
| `--ot-line-height` | `1.5` | same | |
| `--ot-space-1` / `-2` / `-3` / `-4` / `-6` | `0.25rem` / `0.5rem` / `0.75rem` / `1rem` / `1.5rem` | same | spacing |
| `--ot-radius` | `0.625rem` | same | corners |
| `--ot-shadow` | `0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.12)` | same | dialogs, player placeholders on hover |

The palette comes from Gaudí's trencadís mosaics: cobalt and turquoise glazes, saffron and leaf-green shards, on stone and white ceramic, or on night blue in dark. `accent` follows shadcn's meaning, the hover fill, not a brand color. Links are `secondary`; selection and the main action are `primary`.

**Contrast.** In each color scheme, every text role (`foreground`, `muted-foreground`, `primary`, `secondary`, `destructive`, `warning`, `success`) has a contrast of at least 4.5:1 on `background`, `card` and `muted`. Each `-foreground` has at least 4.5:1 on its role: `card-foreground` on `card`, `popover-foreground` on `popover`, `primary-foreground` on `primary`, `secondary-foreground` on `secondary`, `accent-foreground` on `accent`, `highlight-foreground` on `highlight`, `destructive-foreground` on `destructive`, and `muted-foreground` on `muted`. A unit test checks every pair, so a mod can rely on these pairs reading well.

**Renamed tokens.** The tokens used to have other names. The old names are gone, with no aliases: a mod that still uses one gets no value.

| Old name | New name |
|---|---|
| `--ot-color-background` | `--ot-background` |
| `--ot-color-surface` | `--ot-card` for cards and fields, `--ot-muted` for quiet fills, `--ot-popover` for dialogs |
| `--ot-color-text` | `--ot-foreground` |
| `--ot-color-text-muted` | `--ot-muted-foreground` |
| `--ot-color-border` | `--ot-border` (fields: `--ot-input`) |
| `--ot-color-accent` | `--ot-primary` (for links: `--ot-secondary`) |
| `--ot-color-accent-text` | `--ot-primary-foreground` |
| `--ot-color-focus` | `--ot-ring` |
| `--ot-color-danger` | `--ot-destructive` |
| `--ot-color-warning` | `--ot-warning` |
| `--ot-color-success` | `--ot-success` |
| `--ot-font-body` | `--ot-font-sans` |

### The base stylesheet

Unless the mod opts out, its frame gets the tokens and a base stylesheet before the mod runs. The base stylesheet styles plain HTML elements, with no classes to learn, and gives them the look of the app's components:

- the page: background, text color, font, size and line height; `<body>` has no margin, padding `--ot-space-4` and fills the frame;
- headings (`h1` and `h2` slightly tightened), paragraphs, links (`secondary`, underlined), `hr`, `small`, `blockquote`, `code`, `kbd`, `samp`, `pre`;
- buttons: a plain `<button>` is an outline button, a `<button type="submit">` a primary button; hover (an `accent` fill, with everything inside the button in its text color) and `:disabled`;
- form fields (`input`, `select`, `textarea`): the `card` surface, `input` border, radius, padding, the page's font, a placeholder in `muted-foreground`;
- focus rings: a solid 3px `ring` outline on buttons and fields, a 2px one with a small offset on anything else (links, `[tabindex]`);
- pressed buttons (`button[aria-pressed="true"]`) and current items (`[aria-current]`): a 3px outline in `--ot-primary`;
- lists, description lists, tables (full width, row separators, headers in `muted-foreground`, a `muted` row on hover);
- `img`, `video`, `canvas`, `svg`: never wider than their container;
- `<dialog>` (`popover`, border, radius, shadow, padding) and its backdrop;
- `[hidden]`: still hidden, whatever else styles the element;
- short color transitions, none when the user prefers reduced motion.

It sets no layout beyond spacing. Checkboxes, radio buttons and range inputs take the primary color through `accent-color`, and the browser's own controls and scrollbars follow the color scheme through `color-scheme`.

### Write HTML, get the app's look

Mods don't get Tailwind or shadcn/ui, and need no classes. Well-written, accessible HTML already looks like OpenTesela: the base stylesheet styles elements by their meaning. The [default mods](../../../mods/README.md) are short examples of it.

**Plain elements**

```html
<button type="button">Cancel</button>   <!-- outline button -->
<button type="submit">Save</button>     <!-- primary button -->
<label>Address <input type="url"></label>
<select><option>Light</option><option>Dark</option></select>
<table>
  <tr><th>Name</th><th>Status</th></tr>
  <tr><td>covers</td><td>granted</td></tr>
</table>
<dialog>…</dialog>                     <!-- popover colors, shadow -->
```

**Semantic patterns.** These map to the app's components:

```html
<article>                               <!-- a card -->
  <h2>Book List</h2>
  <p>A very simple list of books.</p>
</article>

<div role="alert">Could not load the mod: 404</div>  <!-- destructive alert -->
<p role="status">Saved.</p>                           <!-- default alert -->

<label><input type="checkbox" role="switch"> Show covers</label>  <!-- switch -->

<input type="url" aria-invalid="true">   <!-- invalid field: destructive border and ring -->

<details>                                <!-- accordion item -->
  <summary>Config</summary>
  <pre>show_covers: true</pre>
</details>

<ul aria-busy="true">…</ul>              <!-- loading: a slow pulse -->
```

An empty `role="status"` or `role="alert"` element draws nothing, so a live region can wait for its text without showing an empty box.

**Variant attributes.** For the app's variants that have no semantic HTML, the attribute `data-ot-variant` picks one:

- on a `<button>`: `primary`, `secondary`, `outline`, `ghost` or `destructive`. `secondary` is a secondary action, drawn as an outline in `secondary`. `outline` also turns a submit button back into an outline button, so a page can keep one primary action;
- on a `<span>`, which makes it a badge: `primary`, `secondary`, `outline`, `destructive`, `success` or `warning`. `primary` is filled with `primary`, `secondary` is a tag filled with `highlight`, and the others are statuses, drawn as outlines in their role.

```html
<button type="button" data-ot-variant="primary">Run</button>
<button type="button" data-ot-variant="destructive">Delete</button>
<button type="button" data-ot-variant="ghost" aria-label="Close">×</button>
<button type="submit" data-ot-variant="outline">Run with this collection</button>

<span data-ot-variant="success">granted</span>
<span data-ot-variant="outline">not granted</span>
<span data-ot-variant="secondary">1.0.0</span>
```

Any other value leaves the element's plain look, and so does an unprefixed `data-variant`, which shadcn/ui and other libraries use for their own components.

**Rendered tile bodies.** A tile body the engine renders (see [Tile bodies](../engine/README.md#tile-bodies)) is plain HTML, styled like any other, plus two elements of its own, which the stylesheet selects by attribute, and the diagrams the tile body element draws:

- A player placeholder, `button[data-ot-player]`, is a slot of fixed size, the same whatever its title: at most 20rem wide (never wider than its container) and three lines high. Its `<span>` is the visible box, with the outline button's look: a play mark, then the player's title (its first inner `<span>`) on two lines, cut with "…" when it is longer, the second line left empty for a short title, then the player's site (its last inner `<span>`) on one line in `muted-foreground`. On hover and keyboard focus, the box takes the accent colors and a shadow and grows to show the whole title, over the content below, so the page does not move; the focus ring goes around the box.
- An alert, `aside[data-ot-alert]`, has a left border and a bold title, its first `<p>`, both in its kind's color: `note` in `primary`, `tip` in `success`, `important` in `secondary`, `warning` in `warning` and `caution` in `destructive`.

```html
<button type="button" class="ot-player" data-ot-player="https://www.youtube.com/embed/aqz-KE-bpKQ"><span class="ot-player-box"><span class="ot-player-title">Big Buck Bunny</span><span class="ot-player-host">youtube.com</span></span></button>

<aside class="ot-alert" data-ot-alert="warning">
  <p class="ot-alert-title">Warning</p>
  <p>Spoilers below.</p>
</aside>
```

A diagram the `<ot-tile-body>` element drew, `figure[data-mermaid-source]` (see [Diagrams](../tile_bodies/README.md#diagrams)), is centered and never wider than its container: a diagram wider than that scrolls sideways. Its colors come from the theme tokens when it is drawn, not from the stylesheet.

Math kept as code (`code.language-math`) looks like code. The classes are for the mod's own CSS: the stylesheet never uses them.

**Undoing a pattern.** When an element means something else in a mod, for example an `<article>` that should not look like a card, one unlayered rule undoes the pattern (see the next section):

```css
article {
  padding: 0;
  border: none;
  background: none;
}
```

### The layer: your CSS always wins

The tokens and the base stylesheet are in the cascade layer `opentesela`. Any style a mod adds outside a layer takes precedence over them, whatever its specificity:

```css
/* Wins over the base stylesheet's button rule. */
button {
  color: rgb(0, 0, 255);
}
```

A mod overrides a token the same way, for the whole frame or for one part of it. Everything that uses the token follows, including the base stylesheet:

```css
:root {
  --ot-primary: #db2777;
}
```

A mod that puts its own styles in a layer must declare its layer after `opentesela` to win, for example with `@layer opentesela, mod;` at the top of its style.

### The color scheme attribute

The frame's `<html>` element has `data-ot-color-scheme="light"` or `"dark"`. The frame loader sets it before `mount` is called and updates it on every `theme.changed`, before the mod's handlers run. Mods that opt out of the theme styles get it too.

The tokens follow the attribute, so a mod's own CSS can use it for anything the tokens do not cover:

```css
[data-ot-color-scheme="dark"] .map {
  filter: brightness(0.8);
}
```

### Color scheme sections

The attribute works on any element, not only `<html>`. An element with `data-ot-color-scheme="light"` or `"dark"` uses that color scheme's tokens for itself and its contents, whatever the frame's color scheme, and the base stylesheet gives it that color scheme's background and text colors. It keeps its color scheme when the frame's changes:

```html
<section data-ot-color-scheme="dark">
  <h2>Always dark</h2>
  <p>Even when the app is light.</p>
</section>
```

### Reading token values from JavaScript

Mods that draw with JavaScript (canvas, maps, charts) get the resolved values in the mount context as `context.theme`:

```js
export default function mount(engine, context) {
  drawChart(context.theme.tokens["--ot-primary"]);
  engine.on("theme.changed", function redraw(theme) {
    drawChart(theme.tokens["--ot-primary"]);
  });
}
```

`context.theme` is `{ colorScheme, tokens }`: `colorScheme` is `"light"` or `"dark"`, and `tokens` maps each token name to its value for that color scheme. It is the theme current when the mod's frame connects, so it is right even when the user switched while the mod was loading. Mods that opt out get it too.

When the color scheme changes, every running mod, visible or hidden, receives `theme.changed` once, with the same `{ colorScheme, tokens }`. A new choice that resolves to the same color scheme sends nothing. The frame's colors switch by themselves; the event is for what the mod draws itself.

The value in effect for an element, including the mod's own overrides, can also be read from the computed style:

```js
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--ot-primary")
  .trim();
```

### Opting out

A mod that wants a blank frame sets `theme: "none"` in its mod file (see the [mod module](../../mod/README.md)):

```yaml
mod:
  name: "my_mod"
  version: "0.1.0"
  entrypoint: "./main.js"
  theme: "none"
```

Its frame has neither the tokens nor the base stylesheet: the browser's defaults apply. Player placeholders of rendered tile bodies are then plain buttons, which still open their player when clicked. It still receives `context.theme`, `theme.changed` and the color scheme attribute, so it can follow the app with its own styles. `theme: "default"` is the default.

### Do not use `prefers-color-scheme`

Inside a frame, `@media (prefers-color-scheme: dark)` and `matchMedia("(prefers-color-scheme: dark)")` follow the operating system, not the app: a user who chose Light on a dark system would get the dark rules. Use the color scheme attribute, the tokens or `context.theme` instead:

```css
/* Instead of @media (prefers-color-scheme: dark) { … } */
[data-ot-color-scheme="dark"] .photo {
  opacity: 0.85;
}
```

### The theme choice

The Settings page has a Theme control with System, Light and Dark (see [Settings](../../../main/settings/README.md)). System, the default, follows the operating system and changes with it while the app is open. The choice is kept in the app's storage under the key `opentesela.theme-choice`, outside the `opentesela.mod-storage:` keys, so no mod can read or change it. A missing or unknown stored value counts as System. When the storage cannot be read or written, the choice still applies until the page is closed.

The app's own interface (header, sidebar, Settings page, stage bar, issue list, load errors, action dialog) uses the same tokens, through Tailwind CSS and shadcn/ui, so it always matches the mods. Markdown pages get the frames' own base stylesheet in a shadow root (see [Pages](../../../main/homepage/README.md#pages-look-like-mods)). The sidebar's colors are the app-only aliases `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border` and `--sidebar-ring` in `src/main/app.css`, from `--ot-card`, `--ot-card-foreground`, `--ot-accent`, `--ot-accent-foreground`, `--ot-border` and `--ot-ring`; mods do not get them.

## Module Details

Implemented in `src/lib/core/theme/`. Other modules import only from the public entry point `src/lib/core/theme/index.ts`. The module imports nothing from the rest of the app.

### Tokens and styles

- `THEME_TOKENS`: the frozen token table, a list of `ThemeToken` (`name`, `light`, `dark`).
- `buildTheme(colorScheme)`: the `Theme` (`colorScheme`, `tokens`) for a color scheme. Plain data.
- `buildThemeTokenStyles()`: the tokens as CSS in the layer `opentesela`: the light values on `:root` and `[data-ot-color-scheme="light"]`, then the dark values on `[data-ot-color-scheme="dark"]`, each block with its `color-scheme`. The app adds it to its page.
- `THEME_FRAME_STYLES`: the token styles followed by the base stylesheet (`base_stylesheet.css`), the text the frame document puts in a `<style>`. It never contains a closing style tag.
- Types: `ColorScheme` (`"light" | "dark"`), `ThemeToken`, `ThemeTokens`, `Theme`.

Example:

```ts
import { buildTheme, buildThemeTokenStyles } from "./lib/core/theme/index.ts";

const theme = buildTheme("dark");
// theme.tokens["--ot-background"] is "#1c1917"

const style = document.createElement("style");
style.textContent = buildThemeTokenStyles();
document.head.append(style);
document.documentElement.dataset.otColorScheme = theme.colorScheme;
```

### Theme choice

- `resolveColorScheme(choice, systemPrefersDark)`: the `ColorScheme` of a `ThemeChoice` (`"system" | "light" | "dark"`).
- `readThemeChoice(storage)`: the stored choice, or `"system"` when it is missing, unknown or cannot be read.
- `writeThemeChoice(storage, choice)`: stores the choice and ignores a storage that cannot be written.
- `THEME_CHOICE_KEY`: `"opentesela.theme-choice"`.
- Types: `ThemeChoice`, `ThemeStorage` (the `getItem` and `setItem` of `Storage`; the app passes `localStorage`).

Example:

```ts
import { readThemeChoice, resolveColorScheme } from "./lib/core/theme/index.ts";

const choice = readThemeChoice(window.localStorage);
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const colorScheme = resolveColorScheme(choice, systemPrefersDark);
```

The app keeps its theme in `src/main/theme/app_theme.ts`: it reads the choice, follows the operating system, sets the attribute on the page and tells the [stage](../stage/README.md), which pushes `theme.changed` to the running mods (see the [engine module](../engine/README.md)).
