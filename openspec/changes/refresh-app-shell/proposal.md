# Proposal

## Why

The app spends a full row on a header that only holds the hamburger button and the app's name, and the stage area loses that height. The sidebar's buttons shift between expanded and collapsed, the footer group sits far from the rest on tall screens, changing the theme needs a trip to Settings, the flat cream canvas gives the shell's panels no depth, and two catalog icons (the puzzle for mods, the grid for collections) do not say what their concept is.

## What Changes

- **Remove the app header.** The hamburger button and the `OpenTesela` heading become the sidebar's first row.
- **Hidden sidebar keeps the hamburger.** Hiding the sidebar shrinks it to a small floating chip holding only the hamburger button, in the same place. The first row of the main area (the stage bar) starts after the chip, and the rest of the main area, sandbox included, uses the full width. A page keeps its content clear of the chip.
- **Fixed icon axis.** Every sidebar button (hamburger, section items, theme control, collapse toggle) keeps its position across expanded, collapsed and hidden: icons sit on the center of the rail, and the expanded sidebar adds labels to their right. The collapse toggle stays at the bottom, on that axis.
- **Footer group follows the main group**, after the divider, instead of being pushed to the bottom.
- **Theme control in the sidebar**, below About: a button that opens a menu with System, Light and Dark, in sync with the Settings page's Theme control.
- **White canvas with floating panels.** In light, the app's canvas is white (`--ot-card`); in dark, it stays `--ot-background`. The sidebar, the stage bar and the sandbox are panels with a gap around them, a hairline border and a soft app-only shadow. Pages sit on the canvas. No theme token changes, so mods look the same.
- **New catalog icons**, shared by the sidebar and the stage bar: Tiles uses lucide's `Shapes`; Mods and Mosaics get custom icons drawn on lucide's grid (a dashed square with an arrow entering it towards the bottom right; a frame holding arranged shapes).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-sidebar`: the sidebar holds the hamburger and the app's name; the hidden state becomes the hamburger chip; buttons keep a fixed icon axis; the footer group follows the main group; the sidebar has a theme control; the vanilla icons of Tiles, Mods and Mosaics change.
- `theme`: the theme choice is also offered in the sidebar; the header is gone; the app's canvas is white in light.
- `app-pages`: the "page styles stay inside" scenario no longer names the header; a page keeps its content clear of the hamburger chip.
- `stage-bar`: the stage bar starts after the hamburger chip while the sidebar is hidden.
- `mod-stage`: the visible frame fills the height left under the stage bar (no app header), and its width follows the hidden sidebar's chip.

## Impact

- Code: `src/App.tsx`, `src/main/app.css` (grid, canvas and panel aliases), `src/main/AppHeader.tsx` (removed), `src/main/sidebar/` (Sidebar, SidebarItem, HamburgerButton, a new theme control), `src/main/theme/` (shared choice menu next to `ThemeControl`), `src/main/catalog_icons.ts` (custom icons), `src/main/stage/StageView.tsx` and `StageBar.tsx` (inset beside the chip, panel look), `src/main/pages/PageView.tsx` (inset beside the chip).
- Tests: unit tests of the sidebar, the app and the theme control; the e2e helpers that find the hamburger in the `banner` landmark (`e2e/app_layout.ts`, `e2e/app_pages.spec.ts`), and the sidebar, theme and layout e2e specs.
- No new dependencies: the custom icons use lucide-react's `createLucideIcon`, so they keep the `LucideIcon` type sections already accept.
- Mod API: no version bump. No theme token, mount context, event or mod-facing style changes; mods render the same.
- Instantiations: the section registry is unchanged. The `footer` group now renders right after the `main` group instead of at the bottom.
