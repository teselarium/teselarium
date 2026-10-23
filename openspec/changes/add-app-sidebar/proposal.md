# Proposal

## Why

Today the app has one page: whatever is at `#/` is the mod explorer, and every other place is a mod opened by a link. Users have no way to move between the parts of the app, the theme choice sits in the header for lack of a settings page, and an instantiation cannot offer its own welcome, guides or about text. `docs/modules/main/README.md` already plans a left sidebar with Home, Tiles, Mods, Mosaics, Settings and About. The list of sections will keep changing (the tile and mosaic explorers are coming), so the sidebar must be built from data and easy to extend, both by cloning the repo and later by initializing the app from an HTML page.

This change builds on `adopt-ui-stack`. It needs Tailwind, the shadcn components, the renamed tokens and the semantic base stylesheet, so it is applied after that change is archived.

## What Changes

- **Sidebar** on the left, built from a **section registry**: Home, Tiles, Mods, Mosaics and Guides, then Settings and About at the bottom. Each section has an icon (a lucide icon, or an image tinted with the text color unless the image opts out) and a target, which is a page or a mod link. Home, Settings and About are always shown. The others are optional.
- **Mods** opens the mod explorer. **Tiles** and **Mosaics** are shown as disabled "Coming soon" items.
- **Sidebar states**: expanded, which is resizable (about 200–400px) and stored; collapsed to an icon rail where hovering or focusing an icon shows the section's name; or hidden by the **hamburger** button at the top left, which stays visible and restores the previous state. It collapses with a button or by dragging the edge below a threshold. `Ctrl/Cmd+B` toggles collapsed and expanded. On viewports narrower than 768px, the sidebar always starts collapsed and expands as an overlay drawer.
- **Section navigation, tab-bar style**: switching to a section shows the last thing seen in it, in the state it was left in. Clicking the section the user is already in returns to its start. A mod section keeps one root sandbox instead of opening a new one on every click. The active section stays highlighted while its mod opens other mods, including after a reload.
- **Pages**: Home, Guides and About are **markdown pages**, files the instantiation replaces (`pages/<section>/index.md`, plus sibling pages at `#/<section>/<page>`). They render with the **same base stylesheet as mods**, in an isolated shadow root, so a page looks exactly like a mod. Markdown may hold a safe subset of HTML (cards, alerts, details, badges) and no scripts. The vanilla pages say the section is a work in progress.
- **Settings page**: an Appearance card with the Theme control (**moved from the header**) and a Sidebar card with a switch per optional section, coming-soon ones included. The switches only hide sidebar items: links to their mods keep working.
- **BREAKING (app routes)**: `#/` shows the **Home page** instead of the mod explorer. The explorer is reached through Mods (`#/run?mod=mod_explorer`). Old shared `#/` links land on Home. `#/<section>[/<page>]` are new app routes, and every other unknown hash shows Home.
- **Stage**: pages become history entries of the stage next to sandboxes, so back, forward and reload move between pages and mods with every mod kept in its state. At most one sandbox is visible, and none while a page shows. Every sandbox gets the close button (×). Closing shows its opener or, failing that, Home.
- **Default mod settings**: the home mod moves out of the default mod settings into the registry's Home section, whose target can be a page (vanilla) or a mod. A section whose mod is switched off by the instantiation is not shown at all.
- **Header**: the hamburger and the `OpenTesela` heading. The Theme control leaves it.
- **Docs**: the page layout, the section registry (how to add, remove or change a section when cloning), the markdown pages (files, sub-pages, allowed HTML) and the settings.

## Capabilities

### New Capabilities

- `app-sidebar`: the section registry and its rules, the sidebar's items, icons and coming-soon state, the active section, tab-bar section navigation, the expanded, collapsed and hidden states with resizing and storage, the narrow-viewport drawer, and keyboard use.
- `app-settings`: the Settings page, the switches of optional sections and how they are kept, and what hiding a section does and does not do.
- `app-pages`: markdown pages: their routes and files, sub-pages and name checks, rendering with the mods' theme styles in an isolated root, the allowed HTML, links and images, and load errors.

### Modified Capabilities

- `mod-stage`: "Home mod" becomes Home (a page, or a mod chosen by the instantiation). "Several sandboxes, one visible" becomes at most one visible, with pages in between and section clicks reusing sandboxes. "Close a sandbox" puts a close button on every sandbox except a home mod, with a fallback to Home. "The visible frame fills the stage area" now means the area beside the sidebar. A new requirement covers pages in the history.
- `default-mods`: "Default mod settings" loses the home mod. "Default mods folder" no longer reaches the explorer through home.
- `theme`: "Theme choice" moves from the header to the Settings page. "The app follows the color scheme" now also covers the sidebar, the Settings page and the pages.

## Impact

- **Changed code**:
  - `src/lib/core/stage/`: entries point to a sandbox or a page, sandboxes and entries carry their section, section navigation (`openStageSection`), the history state stores the section, routes read `#/<section>[/<page>]`, the snapshot says what is visible, and the close button and its fallback change. `StageOptions` takes the page ids and the Home target instead of `defaults.home`.
  - `src/lib/core/engine/default_mod_settings.ts`: no `home`.
  - `src/main/`: a new section registry with its validation, sidebar layout state, sidebar view, settings page, page view with markdown in a shadow root, and section switches in storage. `App.tsx` gets the new layout. `AppHeader` gets the hamburger. `default_mods.ts` loses `home`.
  - `public/pages/{home,guides,about}/index.md`: new vanilla content.
  - Tests: stage unit tests (entries, sections, close), `src/test/test_stages.ts`, component tests for the sidebar, settings and pages, and e2e tests. Tests that opened `/` to reach the explorer now open `#/run?mod=mod_explorer` (`app.spec.ts`, `mod_stage.spec.ts`, `default_mods.spec.ts` and the theme specs).
- **Dependencies added**: `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`. shadcn components added to the vendored zone: `card`, `switch`, `label`, `separator`, `tooltip`, `sheet`.
- **Storage**: new keys `opentesela.sidebar` (state and width) and `opentesela.sidebar-sections` (switches), outside the mods' storage slots.
- **Mods**: no API change. Mods still open mods with `mods.open`, and never see pages or sections.
- **Out of scope**: initializing the app from an HTML page (it will fill in the same registry), a generated guide index or sub-lists in the sidebar, the tile and mosaic explorers, Tailwind typography for pages, a quick-settings overlay, and turning a hidden coming-soon section back on when it becomes available.
