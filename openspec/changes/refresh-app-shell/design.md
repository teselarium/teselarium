# Design

## Context

See proposal.md for the motivation. Current state the approach depends on:

- `App.tsx` renders `AppHeader` (hamburger + `<h1>`) as the first row of the `.app-layout` grid in `src/main/app.css`, with the sidebar's column set from the layout store through `--sidebar-column` (`0px` when hidden, `--sidebar-rail-width` (48px) when collapsed or narrow, the width when expanded).
- The hidden sidebar is the `<aside>` with `hidden`. The hamburger's `aria-controls` points to the aside's id.
- Icons shift between states: expanded items have `px-2` on the list plus `px-3` on the item, the rail centers them, and the collapse toggle is right-aligned expanded and centered in the rail.
- The `footer` group is pushed down with `mt-auto`.
- The stage view has `px-4 pt-2 pb-4` padding. The stage bar is already a `bg-card` bordered, rounded row (`py-1`, `icon-sm` buttons), and the frame is `rounded-lg border`.
- Pages render in a shadow root whose `.page-body` paints `--ot-background` on a centered reading-width column (`MarkdownPage.tsx`).
- `ThemeControl` (Settings) is a `NativeSelect` over the `AppTheme` store (`chooseTheme`, `subscribeAppTheme`, `readAppThemeSnapshot`). shadcn's `dropdown-menu` is already vendored.
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

`app.css` adds an app-only alias `--app-canvas`: `var(--ot-card)` by default and `var(--ot-background)` under the `dark` variant's selector. `body` paints `--app-canvas` instead of `--background`. The sidebar, the hamburger chip, the stage bar and the sandbox frame get `rounded-lg border` and Tailwind's `shadow-sm`. The sidebar keeps `bg-sidebar` (`--ot-card`). `--ot-shadow` stays for popovers and menus.

*Alternative:* a new shadow token. Rejected: it would change the token list, which mods see (theme and mod-theme specs, mod API). The conventions don't require shadows to come from tokens, and `shadow-sm` is soft enough for white on white with the border carrying the edge. In dark mode the panels' lighter surface shows the depth, and the shadow is nearly invisible.

### Pages on the canvas

`.page-body` in `MarkdownPage.tsx` stops setting `background-color`, so the canvas shows through. Everything else the base stylesheet gives inside the page (cards, code, buttons) is unchanged.

**Trade-off:** in light mode a page now has a white background with `--ot-card` (white) articles that keep only their border, while a mod shows them on cream. "Pages look like mods" still holds for typography and components, but not for the page's background. This is the cost of putting pages on the canvas rather than in a panel, which was the explored choice.

### Theme control in the sidebar

A new `SidebarThemeControl` in `src/main/sidebar/` renders a ghost button in the icon cell (`Monitor`, `Sun` or `Moon` for the current *choice*, not the resolved scheme), labelled `Theme` when expanded and named `Theme: <choice>`. It opens shadcn's `DropdownMenu` with a `DropdownMenuRadioGroup` of System, Light and Dark, and calls `chooseTheme`. The choices' ids and labels move from `ThemeControl.tsx` into a shared `theme_options.ts` in `src/main/theme/`, used by both controls. `Sidebar` gets the `AppTheme` as a new prop from `App`. The button sits in its own list after the footer list, so it is not part of the sections' links.

*Alternative:* a button that cycles the three choices. Rejected in exploration: the next state is not visible, and a menu matches the Settings control's model.

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

- The final icon paths, checked at 20px in the rail and in the stage bar's capsules. This doesn't change any spec: the specs describe the shapes, not the paths.
