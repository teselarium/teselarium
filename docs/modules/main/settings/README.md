# Settings

The Settings section is always shown at the bottom of the sidebar. Its page, at `#/settings`, is the app's own page (`src/main/settings/SettingsPage.tsx`), not a markdown file. It is the one place where the user adjusts the app.

## What the page holds

- **Appearance**: the Theme control, with System, Light and Dark. Changing it applies the choice to the app, to the pages and to every running mod at once, visible or hidden, without reloading the page or any mod's frame. System follows the operating system's preference. (The Theme control used to sit in the header.)
- **Sidebar**: every section of the app, in the sidebar's order. Home, Settings and About say "Always shown". Each optional section, coming-soon ones included, has a switch labeled with its name, and a coming-soon section also says "Coming soon". A section whose mod the instantiation switched off is not listed (see the [section registry](../README.md#sections-of-switched-off-mods)).

## Stored keys

The app keeps the user's choices in `localStorage`, under keys that start with `opentesela.` but not with `opentesela.mod-storage:`, so no mod storage slot can read or write them:

| Key | Value |
|---|---|
| `opentesela.theme-choice` | `system`, `light` or `dark`. A missing or unknown value is System. |
| `opentesela.sidebar-sections` | The section switches, `{ "<section id>": false }` for a section switched off. A section with no stored switch is on, so a section an instantiation adds starts shown. A switch of a section the registry no longer has is dropped on the next start. |
| `opentesela.sidebar` | The sidebar's layout on viewports at least 768px wide: `{ state, from, width }`, the state (`expanded`, `collapsed` or `hidden`), the state a hidden sidebar comes back to, and the expanded width. An invalid value gives an expanded sidebar of 240px. Nothing done on a narrow viewport is stored. |

When the storage cannot be read or written (a private window, a full or blocked storage), the choices still apply until the page is closed, and no error is shown.

## What hiding a section does, and does not do

Switching a section off only removes its item from the sidebar, at once and without reloading anything. Switching it on brings the item back at its place.

- Its links still work: `#/run?mod=mod_explorer` still runs the explorer while Mods is hidden, and `#/guides` still shows the Guides page while Guides is hidden. A link from a page or a mod still opens it.
- While a section is hidden, nothing it shows makes a sidebar item current. Once it is switched on again, its item is current when what it holds is shown: the stage keeps each entry's section whether or not its item is shown.
- It does not switch a mod off, close a sandbox or remove a page. Switching a default mod off is the instantiation's choice, in the default mod settings.
