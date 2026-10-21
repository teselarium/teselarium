# Design

## Context

See proposal.md (Why) for motivation. The required behavior is in specs/theme, specs/mod-theme, specs/mod-loading and specs/mod-stage.

Current state:

- The frame document is built once per launch by `buildSandboxDocument(policy)` (`src/lib/core/sandbox/sandbox_document.ts`): the policy `<meta>`, then the frame loader as an inline module script. The stage keeps it in the sandbox snapshot, and `SandboxFrame` sets it as `srcdoc`. **Changing `srcdoc` reloads the frame, and a second `load` means "the mod navigated" (`frameLoadedAgain`), which stops the mod.** So nothing that changes while a mod runs can be part of the frame document.
- The mount context is built in `prepareModLaunch` (`src/lib/core/engine/mod_launch.ts`) when the mod starts loading, and sent by `connectModSession` when the frame first loads (`attachSandboxFrame` in `stage_sandboxes.ts`). Engine events are pushed by `pushTilesChanged`, through `sendToMod`, which does nothing once the session stopped.
- The frame loader (`sandbox_loader.js`) dispatches every notification it receives to the mod's handlers. It calls `mount` after `import()` of the mod code resolves, so there is a window between connecting and mounting.
- The content policy already allows inline styles (`style-src 'unsafe-inline' data: blob: …`), so a `<style>` element in the frame document needs no policy change.
- The app is light only: `stage.css` hard-codes zinc grays and red/amber issue colors, `.sandbox-frame` is `height: 75vh`, and `App.tsx` renders an `<h1>` above the stage. There is no global stylesheet and no settings page. The sample and default mods each add a `<style>` with `font-family: system-ui`, `margin: 1rem` and hard-coded colors (`#b91c1c` for errors, `#2563eb` for the selected book).
- `mod_format.ts` ignores unknown keys under `mod`, so no existing mod file has a `theme` key.
- No existing test checks computed styles or the frame size.

Browser behavior, checked while preparing this design in the installed Playwright Chromium (1.64) with a sandboxed `srcdoc` frame under the default content policy, the page emulating light and then dark:

- First with `light-dark()`: a `<style>` in the frame document with `@layer opentesela { :root { color-scheme: light; --ot-color-text: light-dark(#18181b, #fafafa) } :root[data-ot-color-scheme="dark"] { color-scheme: dark } body { color: var(--ot-color-text) } }` gives `<body>` the light color, and setting `document.documentElement.dataset.otColorScheme = "dark"` switches it to the dark color at once. But `getComputedStyle(document.documentElement).getPropertyValue("--ot-color-text")` returns the text `light-dark(#18181b, #fafafa)`, not a color.
- Then with the two blocks of D3 (`:root, [data-ot-color-scheme="light"] { … }` followed by `[data-ot-color-scheme="dark"] { … }`, plain values, in the layer): setting the attribute on `<html>` switches every token, and `getPropertyValue` returns the value itself (`#18181b`, then `#fafafa`). A `<section data-ot-color-scheme="dark">` inside a light frame gets the dark tokens for itself and its contents, and a section keeps its own color scheme when the attribute on `<html>` changes. On a dark `<html>`, the dark block wins over `:root` because it comes later with the same specificity.
- A later unlayered `<style>` wins over the layer, both for a rule (`button { color: blue }`) and for a token (`:root { --ot-color-text: #00ff00 }`).
- Inside the frame, `matchMedia("(prefers-color-scheme: dark)")` follows the emulated operating system preference, also when the app sets `color-scheme` on the `<iframe>` element and on its own root. The app cannot steer it.

## Goals / Non-Goals

**Goals:**

- Keep the frame document fixed for the life of the mod: the theme reaches a running frame only through the channel.
- One source for every token value, used by the app's styles, the frame's styles and the mount context.
- Theme styles that a mod can ignore without knowing they exist: classless, in a layer, and with no class names or globals to learn.
- Keep the theme decision in the app. The frame loader only applies the color scheme it is told.

**Non-Goals:**

- Following the operating system inside the frame by itself (`prefers-color-scheme`): the app decides the color scheme.
- Custom or user-made palettes. The token table has exactly two columns, light and dark.
- Restyling the app's layout beyond the header, the stage bar, the issue list and the full-height frame. The page layout of `docs/modules/main/README.md` (sidebar, status bar, footer) is a later change.

## Decisions

### D1. Module layout

```
src/lib/core/theme/
  theme_tokens.ts        # ColorScheme, ThemeTokens, Theme, THEME_TOKENS, buildTheme (D2)
  theme_styles.ts        # buildThemeTokenStyles, THEME_FRAME_STYLES (D3, D4)
  base_stylesheet.css    # the classless base stylesheet, imported as text (D4)
  theme_choice.ts        # ThemeChoice, resolveColorScheme, readThemeChoice, writeThemeChoice (D7)
  index.ts
src/main/
  app.css                # page, header and full-height layout (D10)
  AppHeader.tsx          # app name and the Theme control
  theme/
    ThemeControl.tsx     # the System / Light / Dark select (D8)
    app_theme.ts         # AppTheme: choice, system preference, document attribute, stage (D8)
```

Imports go one way, extending the order of `add-mod-sandbox` (its design D1):

- `src/main` → `src/lib/core/theme` and `src/lib/core/stage`;
- `src/lib/core/stage` → `src/lib/core/theme` (to build a theme from a color scheme);
- `src/lib/core/engine` → `src/lib/core/theme` (type `Theme` only);
- `src/lib/core/sandbox` → `src/lib/core/theme` (the frame styles);
- `src/lib/core/theme` imports nothing from the app.

- Alternative considered: the tokens in `lib/core/sandbox`. Rejected: the app uses them too, and the app must not reach into the sandbox module for its own look.
- Alternative considered: the theme in `src/main`. Rejected: the sandbox document and the engine need the tokens, and `lib` must not import `src/main`.

### D2. Tokens: one table, resolved per color scheme

`THEME_TOKENS` is a frozen list of `{ name, light, dark }`. `buildTheme(colorScheme)` returns `{ colorScheme, tokens }`, where `tokens` maps each name to its value for that color scheme. This is what `context.theme` and `theme.changed` carry. `Theme` is plain data.

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
| `--ot-color-warning` | `#a16207` | `#facc15` |
| `--ot-color-success` | `#15803d` | `#4ade80` |
| `--ot-font-body` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | same |
| `--ot-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | same |
| `--ot-font-size` | `1rem` | same |
| `--ot-line-height` | `1.5` | same |
| `--ot-space-1` / `-2` / `-3` / `-4` / `-6` | `0.25rem` / `0.5rem` / `0.75rem` / `1rem` / `1.5rem` | same |
| `--ot-radius` | `0.375rem` | same |
| `--ot-shadow` | `0 1px 3px rgb(0 0 0 / 0.25)` | same |

The light grays, the issue red and amber and the selection blue are the ones the app and the sample mod use today, so the light theme looks like the current app. Every text color (`text`, `text-muted`, `accent`, `danger`, `warning`, `success`) has a contrast of at least 4.5:1 on `background` and on `surface` in its color scheme, and `accent-text` on `accent` too. A unit test computes the ratios, so a later palette edit cannot break them silently.

The names stay close to common conventions (Open Props, shadcn/ui: background, surface, text, muted, border, accent), so authors can guess them and a later Tailwind or shadcn adoption (`docs/stack.md`) can map them one to one.

- Alternative considered: a static `.css` file as the source, read by the engine. Rejected: the engine would have to parse CSS to fill `context.theme`.
- Alternative considered: only `colorScheme` in the context, with mods reading the values from the CSS variables (D3 makes that possible). Rejected: the variables exist only in a frame with the theme styles, never with `theme: "none"`, and only once the styles apply. Mods usually configure a canvas, map or chart library in `mount`, and plain values in the context work in every case.

### D3. Token styles: two blocks switched by an attribute

`buildThemeTokenStyles()` builds this text from `THEME_TOKENS`:

```css
@layer opentesela {
  :root,
  [data-ot-color-scheme="light"] {
    color-scheme: light;
    --ot-color-background: #ffffff;
    /* … one line per token, light values … */
  }
  [data-ot-color-scheme="dark"] {
    color-scheme: dark;
    --ot-color-background: #18181b;
    /* … one line per token, dark values … */
  }
}
```

The text never changes, so it can sit in the frame document (D5) and in the app page. Switching the color scheme only changes the `data-ot-color-scheme` attribute of `<html>`. `:root` gives the light values before the attribute is set. On a dark `<html>`, both blocks match with the same specificity, so the dark block must come last to win. Each block also sets `color-scheme`, which gives matching scrollbars and form controls.

What this gives mod authors:

- **One mechanism.** The attribute selects the tokens. The `color-scheme` property only affects the browser's own controls, so a mod or a third-party widget that sets `color-scheme` for another reason never changes the tokens by accident.
- **Color scheme sections.** The selectors match the attribute on any element, not only `<html>`, so `<section data-ot-color-scheme="dark">` gets the dark tokens for itself and its contents in a light frame, and keeps them when the frame's color scheme changes (spec "Color scheme sections"). The base stylesheet gives such an element its background and text colors (D4).
- **Values readable from JavaScript.** `getComputedStyle(element).getPropertyValue("--ot-color-accent")` returns the value in effect for that element, including the mod's own overrides.
- **Any browser with custom properties.** No newer CSS function is needed for the tokens.

The repetition only exists in the generated text. The source stays one table row per token.

- Alternative considered: `light-dark()` in one `:root` block, with the attribute only setting `color-scheme`. One line per token, but `getPropertyValue` returns the unresolved `light-dark(…)` text (Context), `color-scheme` set anywhere in a mod silently flips the tokens inside that element, and the function is only available in browsers from 2024. If the two blocks cause side effects, the switch is contained in `buildThemeTokenStyles`.
- Alternative considered: sending a new token `<style>` over the channel on every change. Rejected: more frame loader code and a style element the mod could remove, for what an attribute already does.

### D4. The base stylesheet

`base_stylesheet.css` is plain CSS imported as text (`?raw`, like the frame loader), wrapped entirely in `@layer opentesela { … }`, using only `var(--ot-…)` values and element and attribute selectors. It covers:

- `html`: background, text color, font, size and line height; `body`: `margin: 0`, padding `--ot-space-4`, `min-height: 100%` with `box-sizing: border-box`, so the background fills the frame (the stage fixes the frame's size, D10).
- Headings (sizes and margins), paragraphs, `a` (accent, underline), `hr`, `small`, `code`, `pre`, `kbd` (mono font, surface background).
- `button` and `input`, `select`, `textarea`: border, radius, padding, surface background, inherited font; `button:hover`; `:disabled`; `button[aria-pressed="true"]` and `[aria-current]`: a 3px outline in `--ot-color-accent`.
- `:focus-visible`: a 2px outline in `--ot-color-focus` with an offset.
- `ul`, `ol`, `dl`, `dt`, `dd`; `table`, `th`, `td` (borders, padding); `img`, `video`, `canvas`, `svg`: `max-width: 100%`, `height: auto` for `img` and `video`.
- `dialog` (surface background, border, radius, shadow, padding) and `dialog::backdrop`.
- `[data-ot-color-scheme]`: background `--ot-color-background` and color `--ot-color-text`, so a color scheme section (D3) looks right with no extra CSS.
- `[hidden]`: `display: none`, so styled elements still hide.

It has no class selectors, no layout opinions beyond spacing, and no `!important`. `THEME_FRAME_STYLES` is the token styles followed by the base stylesheet, built once at module load.

- Alternative considered: an existing classless library (Pico, Water.css, Simple.css). Rejected: each brings its own variable names and opinions, needs editing to sit in a layer, and is a dependency for about 150 lines of CSS.
- Alternative considered: no base stylesheet, tokens only. Rejected: authors would still start from browser defaults. The point is that plain HTML looks right.

### D5. The frame document

`buildSandboxDocument(policy, theme)` takes the mod's theme setting (`"default"` or `"none"`). For `"default"` it adds `<style>THEME_FRAME_STYLES</style>` after the policy `<meta>` and before the frame loader. For `"none"` the document is as today. The styles are static text with no `</style>` (a unit test checks it, like the frame loader's `</script>` check), so nothing needs escaping, and the document stays the same for the same mod. `prepareModLaunch` passes `mod.theme`.

The styles come before the mod's code runs, so a mod's own `<style>` (appended to `<head>`) or stylesheet always comes later in the document, which does not matter for layers but keeps the order predictable.

### D6. The theme in the mount context and the `theme.changed` push

- `ModContext` gains `theme: Theme`. `prepareModLaunch` builds the context without it (type `LaunchContext`, which is `ModContext` without `theme`): when the mod starts loading, the theme it will mount with is not known yet.
- `ModSessionOptions` gains `theme: Theme`. `connectModSession` sends `{ ...launch.context, theme: options.theme }`, so the context holds the theme current when the frame connects (spec "Color scheme changed while the mod loads").
- `pushThemeChanged(session, theme)` in `mod_session.ts` sends the notification `theme.changed` with the theme, through `sendToMod`, next to `pushTilesChanged`.

### D7. The theme choice and its storage

- `ThemeChoice` is `"system" | "light" | "dark"`. `resolveColorScheme(choice, systemPrefersDark)` returns the `ColorScheme`.
- `readThemeChoice(storage)` reads the key `opentesela.theme-choice`. A missing value, any value other than the three choices, or a read that throws gives `"system"`. `writeThemeChoice(storage, choice)` writes it and swallows a write error. The choice is kept by the caller anyway (D8).
- Mod storage slots use keys starting with `opentesela.mod-storage:` (`mod_storage.ts`), so no slot can read or overwrite the theme choice, and mods have no request that reaches other keys.
- `ThemeStorage` is `Pick<Storage, "getItem" | "setItem">`, defined in the theme module. The app passes `window.localStorage`, as it does for the stage.

### D8. The app theme and the stage

`app_theme.ts` (in `src/main/theme/`) holds the app's theme state: the choice, whether the system prefers dark (a `MediaQueryList` for `(prefers-color-scheme: dark)`), the storage and the stage. It is created once in `main.tsx`, like the stage, and the `ThemeControl` reads it with `useSyncExternalStore`, following the stage's subscribe pattern.

- On creation it reads the stored choice, resolves the color scheme, sets `data-ot-color-scheme` on `document.documentElement`, and listens to the media query's `change` event.
- `chooseTheme(appTheme, choice)` writes the choice, then re-resolves. A system preference change re-resolves too.
- Re-resolving updates the document attribute and calls `changeStageColorScheme(stage, colorScheme)`.

In the stage (`stage_controller.ts`):

- `StageOptions` gains `colorScheme`, and the `Stage` keeps `theme: Theme`, built with `buildTheme`.
- `changeStageColorScheme(stage, colorScheme)` does nothing when the color scheme is the current one (spec "Same color scheme, no event"). Otherwise it stores the new theme and calls `pushThemeChanged` for every runtime that is `running` and has a session, visible or hidden.
- `SandboxServices` gains `readTheme: () => Theme`, bound to the stage, so `attachSandboxFrame` passes the current theme when it connects a session.
- Runtimes still loading get the new theme when their frame connects, so nothing is pushed to them.

The token styles are added to the app page once in `main.tsx`, as a `<style>` built from `buildThemeTokenStyles()` and appended to `<head>` before rendering. The app uses the tokens, not the base stylesheet: its components have their own classes in `app.css` and `stage.css`.

`ThemeControl` is a labeled `<select>` ("Theme") with System, Light and Dark. A native select is accessible and keyboard-ready, and the settings page can reuse it.

- Alternative considered: the theme choice inside the stage. Rejected: the stage keeps sandboxes and history. Where the choice comes from (storage, the system, later the settings page) is app wiring, and the stage only needs the resolved color scheme.
- Alternative considered: a React context for the theme. Rejected: `main.tsx` already creates the stage outside React (so StrictMode does not run it twice), and the theme has the same lifetime.

### D9. The frame loader

`sandbox_loader.js` gains the name `THEME_CHANGED_METHOD = "theme.changed"`, checked against the engine's name by the existing name test in `sandbox_messages.test.ts`:

- On connect, before importing the mod, it sets `document.documentElement.dataset.otColorScheme` from `params.context.theme.colorScheme`.
- On a `theme.changed` notification, before dispatching to the mod's handlers, it sets the attribute from the params. If `mount` has not been called yet, it also replaces `context.theme` with the params, so a change that arrives while the mod's code is being imported is not lost: the mod mounts with the newest theme and has no handler yet to miss.
- It checks only that `colorScheme` is `"light"` or `"dark"` before setting the attribute, and ignores anything else.

### D10. The full-height layout

- `app.css`: `html`, `body` and `#root` take the full height. `body` has no margin and takes its background, text color and font from the tokens. `#root` is a grid with rows `auto 1fr` (the header, then the stage), `height: 100dvh`.
- `stage.css`: `.stage` is a flex column with `min-height: 0`. The stage bar keeps its natural height, and `.stage-sandboxes` and the visible `.sandbox` take the rest (`flex: 1`). `.sandbox-frame` is `height: 100%` with `min-height: 16rem` instead of `75vh`. When the header, the stage bar and 16rem do not fit, the content overflows `#root` and the page scrolls (spec "Small viewport").
- `.sandbox[hidden]` stays `display: none`, since a `display` rule on `.sandbox` would otherwise override the `hidden` attribute and show hidden sandboxes.
- Colors in `stage.css` become tokens: borders `--ot-color-border`, error and warning labels `--ot-color-danger` and `--ot-color-warning`, empty-list text `--ot-color-text-muted`.
- `App.tsx` renders `AppHeader` (the `<h1>` and the `ThemeControl`) instead of the bare `<h1>`.

The frame's size depends only on the page layout, never on the mod's content, and the frame's own document scrolls. Frames that grow to fit their content would need a size message from the frame and are out of scope (proposal).

### D11. The mod file

`readModFormat` reads `theme` with a new `readModTheme(mod, source)`: missing gives `"default"`, `"default"` and `"none"` are kept, and anything else raises `ModFormatError(source, '"theme" must be "default" or "none"')`. `ModFormat` and `LoadedMod` gain `theme: ModThemeSetting`. `ModInspection` is unchanged: no mod needs another mod's theme setting.

### D12. Sample and default mods

- `book_list`: the style keeps the list grid, the button's flex layout and the cover size. It drops `font-family`, `margin` and the `aria-pressed` outline, which the base stylesheet now gives in `--ot-color-accent`.
- `mod_explorer`: keeps the list grid and the full-width left-aligned buttons. It drops `font-family` and `margin`, and `.mod-error` uses `var(--ot-color-danger)`.
- `mod_viewer`: keeps the `dt`/`dd` layout, the flex rows and the URL field's width. It drops `font-family` and `margin`, and `.viewer-error` uses `var(--ot-color-danger)`.

None of them sets a color value of its own, so all three follow light and dark.

### D13. Tests

Each scenario of the four spec files has a test named after it, as in `add-mod-sandbox`:

- `lib` (Node): tokens (names, light and dark values, contrast ratios, plain data), token styles (one line per token, no `</style>`), the theme choice (resolve, read, write, unknown and failing storage), the mod format (`theme`), the sandbox document (with and without styles), the session (`theme` in the sent context, `pushThemeChanged`), and the stage (`changeStageColorScheme` pushes to running sessions, visible and hidden, and skips a same-scheme change; a session connected after a change gets the new theme). Fake frames come from `src/test/fake_frames.ts`.
- `app` (jsdom): `ThemeControl` (default System, choosing writes the storage) and `app_theme` with a fake `MediaQueryList`.
- Playwright, on the built app: computed colors in the frame for light and dark, switching without a frame reload (with the existing `markFrame`/`isFrameMarked` helpers), the attribute at mount and before handlers, token values read from JavaScript, color scheme sections, layer precedence, the opt-out, the sample and default mods, the remembered choice after a reload, and the frame sizes. `page.emulateMedia({ colorScheme })` changes the operating system preference. Probe mods with `theme: "none"` or tall content are served by the existing `mod_routes.ts` helpers.

### D14. Docs

- Add `docs/modules/lib/core/theme/README.md`: the token table, the base stylesheet's coverage, the layer, the color scheme attribute and color scheme sections, reading token values from JavaScript, `context.theme` and `theme.changed`, overriding a token, `theme: "none"`, and why `prefers-color-scheme` is not the way inside a frame.
- Update `docs/modules/lib/core/sandbox/README.md` (the frame document's styles, the frame loader's attribute and `theme.changed` handling), `docs/modules/lib/core/engine/README.md` (`theme` in the context, the event), `docs/modules/lib/core/stage/README.md` (the theme and the frame size) and `docs/modules/lib/mod/README.md` (`theme` in the mod file).
- `docs/mod_plugin_spec.md` and `docs/opentesela_spec.md` stay unchanged (author-owned drafts).

## Risks / Trade-offs

- [A dark app may show a light frame for a moment before the frame connects, because the frame document starts without the attribute and the browser may paint it first] → The attribute is set in the connect handler, before the mod's code is imported, so the gap is one message after `load`. Task 7.3 checks it in Playwright with a dark color scheme. If a light flash shows, the fallback is to give the `<iframe>` element `visibility: hidden` until the stage attaches the frame. That is a change in `SandboxFrame` only.
- [Only Chromium was checked] → Custom properties, cascade layers and `color-scheme` are supported in current Firefox and Safari. Task 9.2 checks the theme switch in Firefox and, if available, WebKit, as `add-mod-sandbox` did for the frame.
- [A mod can remove the theme styles or change the attribute] → It only changes its own frame. The app's colors and the other mods are not affected.
- [Mods that use `@media (prefers-color-scheme)` follow the operating system, not the app] → Documented in the theme README with the attribute selector to use instead. The sample and default mods use neither.
- [The base stylesheet changes the look of existing third-party mods] → No mod exists outside this repository yet. A mod that wants the old blank frame sets `theme: "none"`.
- [The Theme control sits in the header until the settings page exists] → The control and `app_theme` are separate, so the settings page can render the same control and the header can drop it.

## Migration Plan

No data migration. The theme choice key is new, and an absent key means System. Mod files without `theme` keep working and get the base stylesheet.
