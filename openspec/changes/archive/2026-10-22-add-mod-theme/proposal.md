# Proposal

## Why

Mods are how OpenTesela shows tiles, so how they look is how the app looks. Right now every mod starts from a blank, unstyled frame. The sample and default mods each carry their own small stylesheet with hard-coded light colors, the app around them is light only, and the frame is a fixed `75vh` box. A community author who wants a polished, accessible mod has to design everything from scratch, and the result never matches the app or the user's light or dark choice. Mods should look good by default, with almost nothing to learn, and stay free to look however their author wants.

The sandbox is now in place (`add-mod-sandbox` is archived), so this is the moment to define the shared look before more mods are written, and before `add-mod-ui-capabilities` builds on the frame.

## What Changes

- **Theme tokens**: one set of about twenty design tokens (colors, fonts, spacing, radius, shadow) named `--ot-*`, each with a light and a dark value. They are the only source of the app's and the mods' colors.
- **Theme choice in the app**: a small Theme control in the app header with the choices System, Light and Dark. System follows the operating system's light or dark preference and changes with it. The choice is kept in the app's storage, separate from the mods' storage slots. The future settings page will take over this control.
- **The app follows the theme**: the header, the stage bar and the issue list use the tokens, so the app and its mods always match.
- **Theme in the mount context**: `context.theme` holds `colorScheme` (`"light"` or `"dark"`) and the resolved token values, for mods that draw with JavaScript (canvas, maps, charts).
- **`theme.changed` event**: when the resolved color scheme changes, the engine pushes `theme.changed` with the new theme to every running mod, visible or not, and the frame switches its colors without reloading.
- **Base stylesheet by default**: every frame gets the tokens and a classless stylesheet that styles plain HTML (text, headings, links, buttons, form fields, lists, tables, images, code, `<dialog>`, focus rings, pressed buttons). It lives in the cascade layer `opentesela`, so any CSS the mod writes wins without specificity tricks, including overriding a token.
- **Color scheme attribute**: the frame's `<html>` element carries `data-ot-color-scheme="light"` or `"dark"`, which the frame loader keeps up to date. Mods use it, the tokens or `context.theme` instead of `prefers-color-scheme`, which inside a frame follows the operating system and not the app's choice. A mod can set the same attribute on any element to make a light or dark section, and can read the current token values from JavaScript with `getComputedStyle`.
- **Opt-out**: `theme: "none"` in `mod_conf.yaml` gives the mod a frame without the base stylesheet and the tokens. The mod still receives `context.theme` and `theme.changed`. `theme: "default"` is the default.
- **Frame sizing**: the visible mod's frame fills the stage area, the page width and the viewport height left under the app header and the stage bar, and follows the window's size. The frame's size never depends on the mod's content: content taller than the frame scrolls inside it.
- **Sample and default mods rely on the theme**: `book_list`, `mod_explorer` and `mod_viewer` drop the styles the base stylesheet now covers and keep only what is specific to them, so they follow light and dark.
- Add `docs/modules/lib/core/theme/README.md` with the token list, the base stylesheet's coverage and how to override or opt out, and update the sandbox, engine and stage module docs.

## Capabilities

### New Capabilities

- `theme`: the shared design tokens, the user's theme choice (System, Light, Dark), how it is kept and resolved to a color scheme, and the app's own interface following it.
- `mod-theme`: what a running mod gets from the theme: the theme in the mount context, the `theme.changed` event, the base stylesheet and the tokens in its frame and their precedence, the color scheme attribute and color scheme sections, the `theme: "none"` opt-out, and the sample and default mods following the theme.

### Modified Capabilities

- `mod-loading`: adds a requirement for the optional `theme` setting in the mod file (`"default"` or `"none"`). Existing requirements are unchanged.
- `mod-stage`: adds a requirement for the visible frame filling the stage area. Existing requirements are unchanged.

## Impact

- **New code**: `src/lib/core/theme/` (tokens, color scheme resolution, the token and base stylesheet text, the theme choice in storage); a Theme control and the app's stylesheet in `src/main/`.
- **Changed code**:
  - `src/lib/mod/`: the mod format reads `theme`, and the loaded mod carries it.
  - `src/lib/core/sandbox/`: the frame document includes the theme styles unless the mod opts out, and the frame loader sets the color scheme attribute on connect and on `theme.changed`.
  - `src/lib/core/engine/`: the mount context gets `theme` when the session connects, and a new push for `theme.changed`.
  - `src/lib/core/stage/`: the stage keeps the current theme, hands it to new sessions and pushes changes to running ones.
  - `src/main/`, `src/App.tsx`, `src/main.tsx`: the header with the Theme control, the full-height layout and the themed stage stylesheet.
  - `public/samples/mods/book_list/main.js` and `public/default_mods/*/main.js`: smaller stylesheets.
  - `vite.config.ts`: Vitest loads the base stylesheet as text (`test.css.include`), since it empties CSS imports by default.
  - Tests: `src/test/` helpers (a fake `prefers-color-scheme` query, the theme in test stages), and `e2e/app_theme.spec.ts`, `e2e/mod_theme.spec.ts` and `e2e/theme_probes.ts`.
- **Unchanged**: the content policy (`style-src` already allows inline styles), the sandbox flags, the frame document's position in the trust model, and every existing requirement.
- **Dependencies**: none added. Tailwind CSS and shadcn/ui from `docs/stack.md` are not adopted here. The token names stay close to common conventions, so a later adoption can map them.
- **Browsers**: the tokens use CSS custom properties and cascade layers, available in current Chromium, Firefox and Safari.
- **Out of scope**:
  - the settings page (it will take over the Theme control) and themes beyond light and dark (custom palettes, high contrast);
  - web components or a component library for mods, a starter template, an SDK and a dev harness;
  - the capabilities planned for `add-mod-ui-capabilities`: fullscreen, opening external links, saving files, `ui.confirm`, warnings for `alert`, `confirm` and `prompt`, and asset URLs;
  - frames that grow to fit their content.
