# Theme Module

## Introduction

The app and its mods share one look: a set of design tokens with a light and a dark value each, a classless base stylesheet built on them, and the user's choice of theme (System, Light or Dark), resolved to a color scheme, `light` or `dark`. The app's own interface and every mod frame follow the same color scheme, and switch together without reloading.

A mod gets all of it by default and needs to learn nothing: plain HTML in its frame already looks right in light and dark. Any CSS the mod writes wins over the theme, so it stays free to look however its author wants.

### Theme tokens

Each token is a CSS custom property. Color tokens have a different value in each color scheme; the others are the same in both.

| Token | Light | Dark |
|---|---|---|
| `--ot-color-background` | `#ffffff` | `#18181b` |
| `--ot-color-surface` | `#f4f4f5` | `#27272a` |
| `--ot-color-text` | `#18181b` | `#fafafa` |
| `--ot-color-text-muted` | `#52525b` | `#a1a1aa` |
| `--ot-color-border` | `#d4d4d8` | `#3f3f46` |
| `--ot-color-accent` | `#2563eb` | `#60a5fa` |
| `--ot-color-accent-text` | `#ffffff` | `#18181b` |
| `--ot-color-focus` | `#1d4ed8` | `#93c5fd` |
| `--ot-color-danger` | `#b91c1c` | `#f87171` |
| `--ot-color-warning` | `#854d0e` | `#facc15` |
| `--ot-color-success` | `#15803d` | `#4ade80` |
| `--ot-font-body` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | same |
| `--ot-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | same |
| `--ot-font-size` | `1rem` | same |
| `--ot-line-height` | `1.5` | same |
| `--ot-space-1` / `-2` / `-3` / `-4` / `-6` | `0.25rem` / `0.5rem` / `0.75rem` / `1rem` / `1.5rem` | same |
| `--ot-radius` | `0.375rem` | same |
| `--ot-shadow` | `0 1px 3px rgb(0 0 0 / 0.25)` | same |

- `background` is the page, `surface` sits on it (buttons, fields, code, dialogs), `border` separates them.
- `accent` is for links, selection and pressed buttons, with `accent-text` for text on an accent background. `focus` is the focus ring.
- `danger`, `warning` and `success` are for messages and states.
- Every text color (`text`, `text-muted`, `accent`, `danger`, `warning`, `success`) has a contrast of at least 4.5:1 on `background` and on `surface` in its color scheme, and `accent-text` on `accent` too. A unit test checks it.

The names follow common conventions (Open Props, shadcn/ui), so they are easy to guess.

### The base stylesheet

Unless the mod opts out, its frame gets the tokens and a base stylesheet before the mod runs. The base stylesheet styles plain HTML elements, with no classes to learn:

- the page: background, text color, font, size and line height; `<body>` has no margin, padding `--ot-space-4` and fills the frame;
- headings, paragraphs, links (accent, underlined), `hr`, `small`, `blockquote`, `code`, `kbd`, `samp`, `pre`;
- buttons and form fields (`input`, `select`, `textarea`): border, radius, padding, surface background, the page's font; hover and `:disabled`;
- pressed buttons (`button[aria-pressed="true"]`) and current items (`[aria-current]`): a 3px outline in `--ot-color-accent`;
- focus rings (`:focus-visible`): a 2px outline in `--ot-color-focus`;
- lists, description lists, tables (borders, padding, header background);
- `img`, `video`, `canvas`, `svg`: never wider than their container;
- `<dialog>` (surface, border, radius, shadow, padding) and its backdrop;
- `[hidden]`: still hidden, whatever else styles the element.

It sets no layout beyond spacing. Checkboxes, radio buttons and range inputs take the accent color through `accent-color`, and the browser's own controls and scrollbars follow the color scheme through `color-scheme`.

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
  --ot-color-accent: #db2777;
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
  drawChart(context.theme.tokens["--ot-color-accent"]);
  engine.on("theme.changed", function redraw(theme) {
    drawChart(theme.tokens["--ot-color-accent"]);
  });
}
```

`context.theme` is `{ colorScheme, tokens }`: `colorScheme` is `"light"` or `"dark"`, and `tokens` maps each token name to its value for that color scheme. It is the theme current when the mod's frame connects, so it is right even when the user switched while the mod was loading. Mods that opt out get it too.

When the color scheme changes, every running mod, visible or hidden, receives `theme.changed` once, with the same `{ colorScheme, tokens }`. A new choice that resolves to the same color scheme sends nothing. The frame's colors switch by themselves; the event is for what the mod draws itself.

The value in effect for an element, including the mod's own overrides, can also be read from the computed style:

```js
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--ot-color-accent")
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

Its frame has neither the tokens nor the base stylesheet: the browser's defaults apply. It still receives `context.theme`, `theme.changed` and the color scheme attribute, so it can follow the app with its own styles. `theme: "default"` is the default.

### Do not use `prefers-color-scheme`

Inside a frame, `@media (prefers-color-scheme: dark)` and `matchMedia("(prefers-color-scheme: dark)")` follow the operating system, not the app: a user who chose Light on a dark system would get the dark rules. Use the color scheme attribute, the tokens or `context.theme` instead:

```css
/* Instead of @media (prefers-color-scheme: dark) { … } */
[data-ot-color-scheme="dark"] .photo {
  opacity: 0.85;
}
```

### The theme choice

The app header has a Theme control with System, Light and Dark. System, the default, follows the operating system and changes with it while the app is open. The choice is kept in the app's storage under the key `opentesela.theme-choice`, outside the `opentesela.mod-storage:` keys, so no mod can read or change it. A missing or unknown stored value counts as System. When the storage cannot be read or written, the choice still applies until the page is closed.

The app's own interface (header, stage bar, issue list, load errors) uses the same tokens, so it always matches the mods.

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
// theme.tokens["--ot-color-background"] is "#18181b"

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
