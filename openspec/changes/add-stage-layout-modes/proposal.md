# Proposal

## Why

A mod's content runs across the whole stage area, so on a wide screen a cover grid has huge covers and lines of text get too long to read. Mods that need the room, such as media, maps or games, must keep the full width, and the user has no way to give a mod the whole screen from outside it.

## What Changes

- **A content width for mods**: in a mod frame, the base stylesheet keeps `<body>` at most `--ot-content-width` wide (about 80rem), centered. The frame itself still fills the stage area, so the gutters belong to the frame: the wheel scrolls there, and the scrollbar stays at the stage's edge. A mod that wants the full width overrides the rule with one unlayered style. A mod with `theme: "none"` gets no limit.
- **Three layouts**: each mod frame has a layout, `contained`, `theater` or `fullscreen`. The width limit applies only in `contained`. The frame gets its layout before `mount` in three ways: the attribute `data-ot-layout` on its `<html>`, also for `theme: "none"` mods; `layout` in the mount context; and a new event, `layout.changed { layout }`. This follows the way the color scheme already reaches mods.
- **Theater mode**: a toggle button in the stage bar removes the width limit for every running mod. The choice is global, and the app remembers it across reloads, like the theme choice.
- **Fullscreen**: a stage bar button shows the visible mod's frame fullscreen. The stage bar is hidden there, and Esc leaves fullscreen. A frame that is fullscreen, whether the app or the mod started it, has the `fullscreen` layout.
- **Stage bar order**: the right side becomes the message buttons, a separator, the theater and fullscreen buttons, then a separator and × when the sandbox has a close button.
- **A reading width for pages**: Markdown pages are kept at most `--ot-reading-width` wide (about 45rem), centered. Mods can use the same token for long text.
- **Two new theme tokens**: `--ot-content-width` and `--ot-reading-width`, with the same value in both color schemes.

## Capabilities

### New Capabilities

- `stage-layout`: the layout of each mod frame (`contained`, `theater`, `fullscreen`), what decides it, the remembered theater choice, and how a mod learns it: the attribute, the mount context key, the `layout.changed` event and the base stylesheet's width limit.

### Modified Capabilities

- `stage-bar`: "One-row stage bar" gains the theater and fullscreen buttons and their place. New requirements cover the theater button and the fullscreen button.
- `theme`: "Theme tokens" lists `--ot-content-width` and `--ot-reading-width`.
- `app-pages`: a new requirement keeps a page's content at the reading width.
- `mod-api-version`: the mod API version becomes `0.1.9`.

## Impact

- **Code**:
  - `src/lib/core/theme/`: the two tokens, plus the base stylesheet's `body` limit under `[data-ot-layout="contained"]`.
  - `src/lib/core/stage/`: the stage keeps the theater choice and which sandbox is fullscreen, builds each frame's layout, puts it in the mount context, and pushes `layout.changed`. Check frames are always `contained`.
  - `src/lib/core/sandbox/sandbox_loader.js`: it sets `data-ot-layout` before `mount` and before the `layout.changed` handlers run.
  - `src/main/stage/`: `StageBar` gets the two buttons. `SandboxFrame` gets fullscreen, the end of its rounded border in fullscreen, and the tracking of `fullscreenchange`.
  - `src/main/`: the theater choice is read from and written to `localStorage`, under a key outside the mod storage slots.
  - `src/main/pages/MarkdownPage.tsx`: `.page-body` uses the reading width.
  - `default_mods/mod_api.d.ts`: `layout` in the context, and the event.
- **Tests**:
  - Unit: tests for the tokens, the stage's layout state and events, the loader's attribute and the stage bar.
  - e2e: specs for the width limit, theater, fullscreen and the remembered choice. `stage_bar.spec.ts` gets the new order.
  - The surface guard records `0.1.9`, with the new event and the new context key.
- **Docs**:
  - The theme README: the tokens, the layouts, and how to opt out of the width.
  - The engine README: the event, the mount context and the version.
  - The stage README and the main README: the stage bar layout.
  - `docs/mod_plugin_spec.md`.
- **Mod API version**: patch, `0.1.8` to `0.1.9`. `layout.changed` is a new event and `layout` a new mount context key. The "Mod API version" section of the engine's README counts both as additions. No method, event or key is removed or changes meaning. Existing mods keep working, and `^0.1.0` ranges still match. Their content gets narrower on wide screens until the user picks theater mode, and a mod can undo that with one style. The rule counts it as a change of look, not a break.
- **App version**: patch while the app is `0.x`, the same bump as the mod API.
- **Out of scope**:
  - Keyboard shortcuts for theater or fullscreen: keys pressed inside a mod's frame never reach the app.
  - A `mod_conf.yaml` key for a mod to ask for a layout.
  - A theater mode for pages.
  - A Settings control for the theater choice.
  - Letting the user tune the widths, other than an instantiation changing the token values.
