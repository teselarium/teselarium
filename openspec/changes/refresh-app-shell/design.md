# Design

## Context

See proposal.md for the motivation. Current state the approach depends on:

- `App.tsx` renders `AppHeader` (hamburger + `<h1>`) as the first row of the `.app-layout` grid in `src/main/app.css`, with the sidebar's column set from the layout store through `--sidebar-column` (`0px` when hidden, `--sidebar-rail-width` (48px) when collapsed or narrow, the width when expanded).
- The hidden sidebar is the `<aside>` with `hidden`. The hamburger's `aria-controls` points to the aside's id.
- Icons shift between states: expanded items have `px-2` on the list plus `px-3` on the item, the rail centers them, and the collapse toggle is right-aligned expanded and centered in the rail.
- The `footer` group is pushed down with `mt-auto`.
- The stage view has `px-4 pt-2 pb-4` padding. The stage bar is already a `bg-card` bordered, rounded row (`py-1`, `icon-sm` buttons), and the frame is `rounded-lg border`.
- Pages render in a shadow root whose `.page-body` paints `--ot-background` on a centered reading-width column (`MarkdownPage.tsx`).
- `ThemeControl` (Settings) is a `NativeSelect` over the `AppTheme` store (`chooseTheme`, `subscribeAppTheme`, `readAppThemeSnapshot`).
- Section icons are `LucideIcon`s. The catalog icons are shared through `catalog_icons.ts` by the vanilla sections, `CombinationTitle`, `CombinationList` and `MessageItem`.
- The docs' conventions require colors, fonts, radius and spacing from the `--ot-*` tokens. Shadows are not in that list. `app.css` maps Tailwind's `--shadow-lg` to `--ot-shadow`.

## Goals / Non-Goals

**Goals:**
- One set of shell geometry values (gap, rail width, row height), used by the sidebar, the chip, the stage view and the page area, so the alignment the specs require cannot drift.
- One theme choice list shared by both theme controls.
- No change to theme tokens, the base stylesheet of mod frames, the stored sidebar layout or the section registry's shape.

**Non-Goals:**
- No new sidebar state: hidden stays hidden, only its rendering changes. `SidebarLayout`, `hideOrShowLayout`, `toggleLayout`, dragging and storage stay as they are.
- No change to mods' look, mount context or events (no mod API bump).
- No redesign of the stage bar's contents or of the Settings page.

## Decisions

### Shell geometry as CSS custom properties on `.app-layout`

`.app-layout` defines `--shell-gap` (`--ot-space-2`), `--sidebar-rail-width` (already 12 × `--ot-space-1`) and `--shell-row-height` (10 × `--ot-space-1`, the stage bar's current height). The layout pads itself by `--shell-gap` and separates its columns by `--shell-gap`. The sidebar's first row and the stage bar both use `min-height: var(--shell-row-height)`, and the stage view drops its own top and side padding so its top edge is the sidebar's.

*Alternative:* matching Tailwind classes in each component. Rejected: four components would repeat the same numbers, which is exactly how the current 4px icon shift happened.

### The fixed icon axis

Every sidebar row is laid out as a rail-wide icon cell followed by the label: the list has no horizontal padding beyond the panel's, and each item starts with a box of `--sidebar-rail-width` minus the panel's padding, with the icon centered in it. Expanded, the label follows; collapsed, the label is `sr-only` and the item is just the cell. The hamburger row, the theme control and the collapse toggle use the same cell, so the toggle sits bottom-left when expanded. The current item's highlight spans the whole row expanded and the cell in the rail.

### Hidden state: the aside stays, shrunk to the chip

When the state is `hidden`, the `<aside>` keeps rendering, loses `hidden`, and shows only its first row's hamburger cell. It leaves the grid flow (absolutely placed at `--shell-gap`, `--shell-gap`, one rail wide and one row tall, with the panel look), and the grid becomes a single column. Everything else the aside holds (navigation, theme control, toggle, resize handle) is not rendered, so nothing hidden can take focus. `.app-layout` gets `data-sidebar-state` from `App.tsx`, and a `--chip-inset` (`--sidebar-rail-width` + `--shell-gap`) applies, only while hidden, as the stage bar's left margin and the page area's left padding. The frame keeps the full width.

The hamburger's `aria-controls` moves from the aside to the navigation's id, since the aside now contains the button.

*Alternatives:* a floating hamburger outside the aside (rejected: two hamburgers, or a button that moves between parents and loses focus when pressed); a zero-width column plus an overlay (rejected: same result with more special cases in the grid).

### Narrow drawer

The `Sheet` content drops `pt-10` and renders the same first row (hamburger + heading) at the same inset as the rail's, so the drawer's hamburger is where the rail's was. Its hamburger hides the sidebar, just as on wide viewports.

### Canvas and panels

`app.css` adds an app-only alias `--app-canvas`: `var(--ot-card)` by default and `var(--ot-background)` under the `dark` variant's selector. `body` paints `--app-canvas` instead of `--background`. The sidebar, the hamburger chip, the stage bar and the sandbox frame get `rounded-lg border` and `shadow-panel`, an app-only Tailwind theme shadow in `app.css`: `2px 2px 0 rgb(0 0 0 / 0.06)`, offset down and right without blur. The sidebar keeps `bg-sidebar` (`--ot-card`). `--ot-shadow` stays for popovers and menus.

*Alternative:* a new shadow token. Rejected: it would change the token list, which mods see (theme and mod-theme specs, mod API). The conventions don't require shadows to come from tokens, and a faint offset is enough for white on white with the border carrying the edge. In dark mode the panels' lighter surface shows the depth, and the shadow is nearly invisible.

*Alternative:* Tailwind's `shadow-sm`, on the frame or on a wrapper around it. Rejected after measuring: a blurred shadow next to a running mod's frame made the default mods' checks about 10% slower in WebKit (17.0s → 18.9s for "Cases without the samples", 18.7s with the shadow on a wrapper), enough to time that e2e test out in the full run. Without blur, the time is the same as with no shadow.

### Pages on the canvas

`.page-body` in `MarkdownPage.tsx` stops setting `background-color`, so the canvas shows through. Everything else the base stylesheet gives inside the page (cards, code, buttons) is unchanged.

**Trade-off:** in light mode a page now has a white background with `--ot-card` (white) articles that keep only their border, while a mod shows them on cream. "Pages look like mods" still holds for typography and components, but not for the page's background. This is the cost of putting pages on the canvas rather than in a panel, which was the explored choice.

### Theme control in the sidebar

A new `SidebarThemeControl` in `src/main/sidebar/` renders a ghost button in the icon cell (`SunMoon`, `Sun` or `Moon` for the current *choice*, not the resolved scheme), labelled `Theme` when expanded and named `Theme: <choice>`. Each press calls `chooseTheme` with the next choice in `THEME_OPTIONS`' order (System, Light, Dark, then System again), from a pure `readNextThemeChoice` in `theme_options.ts`. A tooltip says `Theme: <choice>` in every state, since the `Theme` label alone does not say which mode is on, and a visually hidden polite live region announces the new choice, because screen readers do not always announce a focused button's new name. The choices' ids and labels move from `ThemeControl.tsx` into a shared `theme_options.ts` in `src/main/theme/`, used by both controls. `Sidebar` gets the `AppTheme` as a new prop from `App`. The button sits in its own list after the footer list, so it is not part of the sections' links.

*Alternative:* a button that opens a menu of the three choices (shadcn's `DropdownMenu` with a radio group), like the Settings control's model. Replaced after the first implementation: the common switch, between light and dark, takes one press instead of two, and the tooltip names the current mode. The cost is that the next choice is not shown before the press.

### Custom catalog icons with `createLucideIcon`

`catalog_icons.ts` builds `MOD_ICON` and `MOSAIC_ICON` with lucide-react's `createLucideIcon(name, iconNode)` on lucide's 24×24 grid (2px stroke, round caps and joins, `currentColor`), and sets `COLLECTION_ICON` to `Shapes`. They stay `LucideIcon`s, so `SectionIcon`, the capsules and the lists need no change. Starting drawings:

```
  MOD_ICON (dashed square + entering arrow)    MOSAIC_ICON (frame holding arranged shapes)

   \                                            +-----------------+
    \                                           | +--+        _   |
     \  .  .  .  .  .                           | |  |      ( )   |   frame:   rect 3,3 18x18 rx 2
     .\_|          .                            | +--+            |   square:  rect 6.5,6.5 4.5x4.5
     .  ---+       .                            |                 |   circle:  cx 15.5 cy 8.75 r 2.25
     .     |       .                            |    /\  /\  /\   |   triangles along the bottom,
     .             .                            |   /__\/__\/__\  |   touching each other
     .  .  .  .  .                              +-----------------+

   dashed square: x 8..21, y 8..21 (lucide square-dashed style corner and dash paths, scaled)
   arrow: M3 3 L14 14, head M14 8 V14 H8
```

The mosaic's shapes sit on a grid and touch each other, which distinguishes it from `Shapes`' loose pieces at 20px. The drawings are a starting point; the task checks them at the rail's size next to `Shapes`.

Final drawings, after checking them at 20px:

- `MOD_ICON`: lucide's `square-arrow-right-enter` turned towards the bottom right, on `square-dashed`'s square (3..21): the dashed square's top-left corner is open, and the arrow enters through it (`M3 3l11 11`, head `M14 8v6H8`).
- `MOSAIC_ICON`: a tile, `rx 2`, half a unit larger than the mod's square on each side (2.5..21.5), outlined in `currentColor` at 25% and filled with it at 10%, so it reads as a framed tile that weighs about as much as the outlined icons around it, holding a triangle, a circle, a square and a triangle on a 2×2 grid, filled without stroke (0.75 larger than outlined ones, to keep their visible size). The shapes are filled through classes from `app.css`: `--mosaic-shape-1` to `--mosaic-shape-4` are `hsl(from var(--ot-primary | --ot-secondary | --ot-destructive | --ot-warning) h calc(s * 1.2) l)`, the theme's colors 20% more saturated, so they follow the color scheme through the tokens: deep colors in light, pastels in dark. In dark, on the accent background (`[aria-current="page"]` in the sidebar, `[data-selected="true"]` in the stage bar's lists, `[data-highlighted]` in its menus), the pastels lose their contrast, so there each shape keeps its hue and gets darker: `oklch(from var(...) calc(l * 0.62) calc(c * 1.2) h)`, about the lightness of the light scheme's colors, with `color-mix()` towards `--ot-accent-foreground` as the fallback. Mixing towards that near-black alone dulled the colors (the red turned maroon), so it is only the fallback. No literal colors. It stays a `LucideIcon`; the shapes' fills come from the app's stylesheet, so they show the theme colors only in the app, which is the only place the icon is used. Chosen over outlined shapes, a solid tile and fixed colors after comparing them in the sidebar and the stage bar in both schemes: the faint tile keeps the shapes in front, and the saturated colors stay readable on white, on the dark sidebar and on the accent.
- *Risk:* relative color syntax (`hsl(from ...)`) needs Chrome 119, Firefox 128 or Safari 18. Each variable falls back to the plain token color, so an older browser shows the unsaturated colors.

*Alternative:* the closest existing lucide icons. Rejected in exploration.

## Risks / Trade-offs

- [The chip covers content of a mod that renders under it] → The chip only overlaps the frame's area when the frame is under the stage bar's row, and the stage bar occupies that row. The chip is beside the bar, never over the frame.
- [Removing `hidden` from the aside could leave hidden controls focusable] → In the hidden state the aside renders only the hamburger. A unit test asserts that no link, separator or other button is in it.
- [e2e helpers find the hamburger through the `banner` landmark] → `hamburgerButton` in `e2e/app_layout.ts` and the look comparison in `e2e/app_pages.spec.ts` move to the sidebar's first row.
- [White on white panels are faint on low-contrast screens] → Every panel keeps an `--ot-border` border, and the shadow only adds to it.
- [Pages lose their cream background in light] → Accepted (see "Pages on the canvas").
- [Custom icons drift from lucide's style over lucide upgrades] → They follow lucide's grid and stroke settings through `createLucideIcon`, which applies lucide's defaults, so only the paths are ours.

## Migration Plan

None. The stored sidebar layout and theme choice keep their keys and values. Instantiations' registries need no change. Rollback is reverting the change.

## Open Questions

- ~~The final icon paths~~: settled, see "Custom catalog icons with `createLucideIcon`". The specs describe the shapes, not the paths.
