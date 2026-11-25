# Tasks

## 1. Shell geometry and canvas

- [x] 1.1 In `src/main/app.css`, define `--shell-gap`, `--shell-row-height` and `--chip-inset` on `.app-layout` beside `--sidebar-rail-width`, and add the app-only `--app-canvas` alias (`--ot-card`, `--ot-background` under the dark variant). Make `body` paint `--app-canvas`. Drop the header row from the grid, pad the layout by `--shell-gap`, and make the grid a single column when `.app-layout[data-sidebar-state="hidden"]`. Verify with a unit test of `App` that `.app-layout` carries `data-sidebar-state` for each state, and with the theme e2e checks of "White canvas in light", "Canvas in dark" and "Back to light" in `e2e/app_theme.spec.ts`.
- [x] 1.2 Give the stage bar and the sandbox frame the panel look (`rounded-lg border shadow-sm`), drop the stage view's top and side padding, give the stage bar `min-height: var(--shell-row-height)`, and apply `--chip-inset` as its left margin only while the sidebar is hidden. Verify with e2e checks in `e2e/app_layout.ts`-based specs for "Bar after the chip", "One row with the sidebar's heading row", "Folding follows the space left", "Frame beside the sidebar" and "Hidden sidebar widens the frame", and with the existing "Frame reaches the bottom of the viewport" checks still passing.
- [x] 1.3 In `MarkdownPage.tsx`, remove `.page-body`'s `background-color`, and in `PageView` apply `--chip-inset` as the page area's left padding while the sidebar is hidden. Verify with e2e checks of "Light page on the canvas", "Card in a light page", "Narrow page with a hidden sidebar" and "Wide page with a hidden sidebar" in `e2e/app_pages.spec.ts`, and that "Mods keep their background" holds for a mod frame.

## 2. Sidebar heading row and hidden chip

- [x] 2.1 Remove `AppHeader.tsx`. Render the hamburger button and the `OpenTesela` `<h1>` as the sidebar's first row, at `--shell-row-height`, with the heading `sr-only` when collapsed or hidden. Point the hamburger's `aria-controls` at the navigation's id. Verify with `Sidebar.test.tsx` cases for "No app header" and "Heading in the rail", and update `App.test.tsx` for the missing header.
- [x] 2.2 In the hidden state, keep the `<aside>` rendered as the chip: only the hamburger cell, placed at `--shell-gap` with the panel look, and no navigation, theme control, collapse toggle or resize handle. Give the expanded and collapsed sidebar the panel look (`rounded-lg border shadow-sm`, no `border-r`). Verify with a `Sidebar.test.tsx` case that the hidden aside holds exactly one button and no link or separator, and with the "Hide and restore" and "Hamburger state" e2e checks.
- [x] 2.3 Update `e2e/app_layout.ts` `hamburgerButton` to find the button in the sidebar's first row, and the `banner` look comparison in `e2e/app_pages.spec.ts` ("Page styles stay inside") to use the sidebar's heading row. Verify with `npm run test:e2e -- app_sidebar app_pages`.

## 3. Fixed icon axis and footer placement

- [x] 3.1 Rework `SidebarItem` and the section lists so each row starts with a rail-wide icon cell, labels follow it when expanded, and the current item's highlight spans the row expanded and the cell in the rail. Move the collapse toggle into the same cell at the bottom (left when expanded). Verify with e2e checks of "Collapse does not move the icons" and "Hiding does not move the hamburger", and with the existing "Tooltip on hover" and "Tooltip on focus" checks.
- [x] 3.2 Render the `footer` group right after the `main` group, after the divider, without `mt-auto`. Verify with the "Footer follows the main group" e2e check and the existing "Vanilla sidebar" check.
- [x] 3.3 Render the narrow drawer's content with the same first row as the rail (no `pt-10`). Verify with the "Open sidebar keeps the first row" e2e check on a 375×700 viewport, and that "Escape closes the drawer" still passes.

## 4. Theme control in the sidebar

- [x] 4.1 Move the System, Light and Dark ids and labels out of `ThemeControl.tsx` into `src/main/theme/theme_options.ts`, used by `ThemeControl`. Verify `ThemeControl.test.tsx` passes unchanged.
- [x] 4.2 Add `SidebarThemeControl` in `src/main/sidebar/`: a ghost button in the icon cell with `Monitor`, `Sun` or `Moon` for the current choice, the label `Theme` when expanded, the accessible name and rail tooltip `Theme: <choice>`, and a `DropdownMenu` radio group calling `chooseTheme`. Pass the `AppTheme` from `App` to `Sidebar` and render the control in its own list after the footer items, in the rail, expanded and in the drawer. Verify with component tests for "Below About", "Tooltip in the rail", "Sidebar menu shows the choice" and that the control is never `aria-current`.
- [x] 4.3 Verify with e2e checks in `e2e/app_theme.spec.ts` of "Choose from the sidebar" (frame not reloaded, Settings shows Dark) and "No Theme control in the header".

## 5. Catalog icons

- [x] 5.1 In `catalog_icons.ts`, set `COLLECTION_ICON` to `Shapes` and build `MOD_ICON` and `MOSAIC_ICON` with `createLucideIcon`, from the drawings in design.md. Check them at 20px in the rail and in the stage bar's capsules next to `Shapes`, and adjust the paths until the mosaic icon reads differently from `Shapes`. Verify with a unit test that the three are distinct `LucideIcon`s, and with an e2e check of "Same icon in the sidebar and the stage bar" and "Icons follow the text color".

## 6. Docs and release

- [x] 6.1 Update `docs/modules/main/README.md`: the layout diagram and the description without a header, the sidebar's heading row, the hidden chip, the fixed icon axis, the footer placement, the sidebar's theme control, the canvas and panels, and the catalog icons. Update `docs/modules/lib/core/stage/README.md` where it mentions the header. Verify that no doc under `docs/` still describes an app header (`grep -ri "header" docs/modules/main docs/modules/lib/core/stage` shows only unrelated uses).
- [x] 6.2 Add `.changeset/refresh-app-shell.md` with a `patch` bump (no breaking change for users or instantiations, and no mod API bump) and a one-line summary: the app's header moves into the sidebar, a hidden sidebar keeps its hamburger, the sidebar gets a theme menu, the app's canvas is white with floating panels, and Mods, Tiles and Mosaics get new icons.

## 7. Verification

- [x] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify each passes.

## 8. Cycling theme button

- [x] 8.1 Add `readNextThemeChoice` to `src/main/theme/theme_options.ts` (System → Light → Dark → System), with a unit test. Rework `SidebarThemeControl` without the menu: a press chooses the next choice, the icons are `SunMoon`, `Sun` and `Moon`, a tooltip says `Theme: <choice>` in the rail and expanded, and a visually hidden polite live region announces the new choice.
- [x] 8.2 In `Sidebar.test.tsx`, replace the menu tests with "Each press moves to the next choice" and "Tooltip when expanded", keeping "Below About", "Tooltip in the rail" and the `aria-current` check. Update "Choose from the sidebar" in `e2e/app_theme.spec.ts` to press the control until the choice is Dark.
- [x] 8.3 Update `docs/modules/main/README.md` (the Theme control cycles, its icons, tooltip and live region) and the changeset's wording (a theme button instead of a theme menu).
- [x] 8.4 Run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify each passes.

## 9. Colored mosaic icon

- [x] 9.1 Redraw `MOSAIC_ICON` in `catalog_icons.ts` as the soft tile with four filled shapes (design.md), and define `--mosaic-shape-1` to `--mosaic-shape-4` with the dark accent rule in `src/main/app.css`. Update the unit test of the drawing.
- [x] 9.2 Add e2e checks of "Mosaic icon follows the color scheme" and "Mosaic icon on the current item" in `e2e/app_sidebar.spec.ts`, and verify "Same icon in the sidebar and the stage bar" and "Icons follow the text color" still pass.
- [x] 9.3 Update `docs/modules/main/README.md` ("Catalog icons") for the colored mosaic icon.
- [x] 9.4 Run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify each passes.
- [x] 9.5 Fill the mosaic icon's tile at 10% and keep its outline at 25%: update `catalog_icons.ts`, its unit test, design.md and `docs/modules/main/README.md`, and rerun the mosaic icon e2e checks and the full verification.
