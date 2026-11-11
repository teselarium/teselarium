# Design

## Context

See proposal.md for the motivation, and the `stage-layout`, `stage-bar`, `theme` and `app-pages` deltas for the behavior.

How the code works today:
- **The frame**:
  - `StageView` (`src/main/stage/StageView.tsx`) lays the stage area out with `px-4`.
  - `.sandbox-frame` (`src/main/stage/stage.css`) is `width: 100%`.
  - `SandboxFrame` renders the iframe with `rounded-lg border`, and keeps it hidden until one animation frame after it is connected.
- **The base stylesheet**: `src/lib/core/theme/base_stylesheet.css` gives the frame's `body` padding and no width limit. It sits in the `opentesela` layer.
- **The color scheme reaching a frame**. This is the pattern this change copies:
  - The stage keeps `stage.theme`.
  - `changeStageColorScheme` (`stage_controller.ts`) pushes `theme.changed` to every runtime through `pushSandboxTheme` (`stage_sandboxes.ts`).
  - The session's connect hands the frame its mount context, which holds `theme`.
  - The frame loader (`sandbox_loader.js`) sets `data-ot-color-scheme` from the context before `mount`, and from the event before the handlers run.
  - Check frames build their context with `services.readTheme()` (`stage_checks.ts`). Test case contexts copy the check's context (`sandbox_test_runner.js`), so they inherit every key.
- **Tokens**: `THEME_TOKENS` in `theme_tokens.ts`, with `defineSharedToken` for the tokens that are not colors.
- **Pages**: `MarkdownPage` renders into a shadow root whose `.page-body` gets the frame's `body` rules (`PAGE_HOST_RULES`).
- **Remembered settings**: the media setting lives in `src/main/settings/tile_media_setting.ts`. It is a JSON value in `localStorage` under an `opentesela.` key outside the mod storage slots. `main.tsx` reads its start value for `createStage`, and `changeStageTileLinkedMedia` tells the stage when it changes.
- **Fullscreen today**: every frame has `allow="fullscreen *"`. `StageView` leaves fullscreen when the visible sandbox changes.

## Goals / Non-Goals

**Goals:**
- One source of truth for a frame's layout, in the stage domain, so the layout of every frame, the events and the check contexts follow from the same rule and can be unit-tested without React.
- The width limit is plain CSS in the base stylesheet, so it needs no code in mods and mods can override it.

**Non-Goals:**
- Changing the frame's size or position in any layout other than fullscreen.
- Changing `allow="fullscreen *"`, or how a mod fullscreens its own elements.
- A layout control on the Settings page.

## Decisions

### D1. The width limit lives inside the frame, not around it

The frame keeps filling the stage area. The base stylesheet limits `body` while `<html data-ot-layout="contained">` is set.
- *Alternative: give the iframe a `max-width` in `stage.css`.* This is simpler and needs no mod API change. But the gutters would belong to the app page, so the wheel would not scroll the mod there, and every mod, games and maps included, would be boxed in with no way out except the theater button. A `mod_conf.yaml` key to opt out would be a mod API change anyway.
- *Alternative: limit `main` instead of `body`.* That would make mods use a `<main>` element to benefit. Limiting `body` works for any structure, and one rule (`body { max-width: none; }`) opts out.

### D2. The layout is derived, not stored per sandbox

The stage keeps two facts:
- `theaterMode`, a boolean;
- `fullscreenSandboxId`, a string or `null`.

A pure function in a new module, `src/lib/core/stage/stage_layout.ts`, reads a sandbox's layout from those two facts: `fullscreen` when its id is the fullscreen one, otherwise `theater` or `contained`. Two functions change the facts and push `layout.changed`, the way `changeStageColorScheme` pushes `theme.changed`:
- `changeStageTheaterMode(stage, isOn)`;
- `changeStageFullscreen(stage, sandboxId | null)`.

Each one reads every runtime's layout before and after the change, and pushes only to the runtimes whose layout changed. That gives "once per change" and "nothing when the layout stays the same" (a fullscreen mod while theater is toggled) without special cases.

Other parts of the stage use the same rule:
- The snapshot gets `isTheaterMode`, for the stage bar.
- A session's mount context gets `layout` from the same function when its frame connects. A mod opened before a toggle therefore mounts with the current layout, the same as the theme.
- Check frames always use `"contained"`, and case contexts inherit it.
- *Alternative: keep a `layout` field on each runtime.* That would be three copies of the same rule to keep in sync, and hidden sandboxes would be easy to miss.

### D3. Fullscreen is read from the app page's `fullscreenchange`, whoever started it

`StageView` listens for `fullscreenchange` on the app document. It finds the sandbox whose frame is `document.fullscreenElement`, through the `data-sandbox-id` of the frame's parent, and calls `changeStageFullscreen` with that id, or with `null`.

When a mod fullscreens an element inside its frame, the app document's `fullscreenElement` is the iframe. So a mod's own fullscreen also gets the `fullscreen` layout, and the rule needs no record of who asked for it.

Esc and the browser's own exit come through the same event, so the app needs no code of its own for Escape.
- *Alternative: set the layout when the button is pressed.* That would miss Esc, a mod's own fullscreen, and a refused request.

### D4. The fullscreen button fullscreens the iframe element

The button calls `requestFullscreen()` on the visible sandbox's iframe, during the click, so the user activation is the app's.
- **Finding the iframe**: `StageView` finds it inside its own root by `data-sandbox-id`, so `StageBar` does not need a ref to a sibling component.
- **After fullscreen starts**: the bar's open popover or menu closes, since nothing outside the frame is visible, and the frame gets focus, so the keyboard reaches the mod.
- **When the promise rejects**: the stage adds a `warning` message from the app, whose source is the mod's source and whose text has the error's message.
- **Styling**: `stage.css` gives `.sandbox-frame:fullscreen` no border and no rounding.
- *Alternative: fullscreen the whole stage view, bar included.* The bar's popovers are drawn outside it, and a bar on top of the content is not what "fullscreen" means for video or games. The bar returns when fullscreen ends.

### D5. The frame loader applies the layout like the color scheme

`sandbox_loader.js` gets a `layout.changed` handler that runs before the mod's handlers, like `applyThemeChanged`:
- **The attribute**: it sets `document.documentElement.dataset.otLayout` from the context at connect, and from each event.
- **Values**: it ignores anything but the three layouts.
- **Before mount**: while the mod is still importing, it updates `loader.context.layout`.

The frame is shown only after connect (see `SandboxFrame`), and the attribute is set at connect. So the content never paints at the wrong width first.

### D6. The base stylesheet rule and the tokens

```css
@layer opentesela {
  html[data-ot-layout="contained"] body {
    max-width: var(--ot-content-width);
    margin-inline: auto;
  }
}
```

The rule sits in the base stylesheet, so `theme: "none"` frames never get it. `body` already has `box-sizing: border-box`, so its padding counts in the width.

Two new shared tokens hold the widths:
- `--ot-content-width: 80rem`, for mod frames;
- `--ot-reading-width: 45rem`, for pages.

They have the same value in both color schemes. `PAGE_HOST_RULES` gives `.page-body` `max-width: var(--ot-reading-width)` and `margin-inline: auto`, with no layout attribute, since pages have no theater mode.
- *Alternative: one width for frames and pages.* It was rejected because lines of text at 80rem are too long to read.

### D7. The theater choice is a remembered setting in `src/main/stage/`

`theater_setting.ts` follows `tile_media_setting.ts`:
- **Storage**: a JSON boolean under `opentesela.theater-mode`, read and written through `stored_json.ts`. It is on only when the stored value is `true`, so a missing or unknown value is off.
- **Start value**: `readStartTheaterMode` gives the start value to `createStage`.
- **Changing it**: `changeTheaterMode` writes the value when the storage allows, then calls `changeStageTheaterMode`.

It lives next to the stage bar, which is its only control, rather than in `settings/`.

### D8. Stage bar buttons

The buttons are two `StageBarIconButton`s, in the right group after the message buttons and a separator. The second separator and × stay conditional on `canClose`, as they are today.
- **Theater mode**: lucide's `RectangleHorizontal` icon, with `aria-pressed` from the snapshot's `isTheaterMode`. A toggle keeps one label, so the name stays "Theater mode" in both states.
- **Fullscreen**: lucide's `Maximize` icon. It is rendered only when the sandbox status is running and the sandbox has a frame document.

## Risks / Trade-offs

- **A mod's layout gets narrower** without the mod asking: on wide screens, a mod that relied on the full width now gets 80rem until theater mode is on. → It is a look change, not a break. The theme README documents the one-line opt-out, and the proposal records it as a patch.
- **Pages at 45rem are tight for wide content.** → Images, video and SVG are already limited to `max-width: 100%`, and diagrams and block formulas scroll sideways. Tables are `width: 100%`, and their cells wrap, but a table whose cells cannot wrap, such as long code or URLs, would overflow. The vanilla pages have no such table. If one appears, a later change can let tables scroll in pages without changing the frames' width.
- **Existing e2e tests** measure the frame at 1280×800. → The stage area there is narrower than 80rem, so `contained` changes nothing at that size. Only the new wide-viewport tests see the limit.
- **Browsers that refuse fullscreen**, such as an app embedded without `allow="fullscreen"`, or iOS Safari on iPhone for non-video elements. → The request's rejection becomes a warning in the stage bar (D4), and the mod keeps running.
- **A message popover is open when fullscreen starts.** → The bar closes it when fullscreen starts (D4), so no popover is left open behind the fullscreen frame.
- **A theater toggle sends one `layout.changed` to every running mod, hidden ones too.** → It is the same cost as `theme.changed`, and it is once per press.

## Migration Plan

Nothing to migrate. The stored key is new, and a missing value means theater mode is off. Rolling back leaves an unused `opentesela.theater-mode` key in `localStorage`, which nothing reads.

## Open Questions

- **The exact token values** (80rem and 45rem). The specs refer to the tokens, not to their values, so they can be tuned after the e2e screenshots are reviewed.
- **The theater icon.** `RectangleHorizontal` is the default, and any lucide icon works without changing the specs.
