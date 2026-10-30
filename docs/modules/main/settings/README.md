# Settings

The Settings section is always shown at the bottom of the sidebar. Its page, at `#/settings`, is the app's own page (`src/main/settings/SettingsPage.tsx`), not a markdown file. It is the one place where the user adjusts the app.

## What the page holds

- **Appearance**: the Theme control, with System, Light and Dark. Changing it applies the choice to the app, to the pages and to every running mod at once, visible or hidden, without reloading the page or any mod's frame. System follows the operating system's preference. (The Theme control used to sit in the header.)
- **Sidebar**: every section of the app, in the sidebar's order. Home, Settings and About say "Always shown". Each optional section, coming-soon ones included, has a switch labeled with its name, and a coming-soon section also says "Coming soon". A section whose mod the instantiation switched off is not listed (see the [section registry](../README.md#sections-of-switched-off-mods)).
- **Privacy**: the "Load media linked by tiles" switch, on by default. On, mods can show the images, audio and video their tiles link to, from any public site, without a permission (see [Media linked by tiles](../../lib/core/sandbox/README.md#media-linked-by-tiles)); the group says that the linked sites can see that the user viewed the tile. Off, mods show only media from where their files and tiles were loaded and from the hosts of their granted `show` permissions. A change applies to mods opened after it: running mods keep what they were started with, and no frame reloads. The store (`src/main/settings/tile_media_setting.ts`) gives the stage its start value (`readStartTileLinkedMedia`) and tells it of each change (`changeStageTileLinkedMedia`).
- **Version**: the app's version, labeled `OpenTesela`, and the app's mod API version, labeled `Mod API`. The app's version is the one in `package.json` when the app was built (`src/main/app_version.ts`, see the [release guide](../../../releasing.md)), and the mod API version is `MOD_API_VERSION` (see [the engine](../../lib/core/engine/README.md#mod-api-version)). Both are plain text, so the user can select them and copy them into a problem report.

## Stored keys

The app keeps the user's choices in `localStorage`, under keys that start with `opentesela.` but not with `opentesela.mod-storage:`, so no mod storage slot can read or write them:

| Key | Value |
|---|---|
| `opentesela.theme-choice` | `system`, `light` or `dark`. A missing or unknown value is System. |
| `opentesela.sidebar-sections` | The section switches, `{ "<section id>": false }` for a section switched off. A section with no stored switch is on, so a section an instantiation adds starts shown. A switch of a section the registry no longer has is dropped on the next start. |
| `opentesela.tile-linked-media` | "Load media linked by tiles": `true` or `false`, as JSON. A missing or other value is on. |
| `opentesela.sidebar` | The sidebar's layout on viewports at least 768px wide: `{ state, from, width }`, the state (`expanded`, `collapsed` or `hidden`), the state a hidden sidebar comes back to, and the expanded width. An invalid value gives an expanded sidebar of 240px. Nothing done on a narrow viewport is stored. |

When the storage cannot be read or written (a private window, a full or blocked storage), the choices still apply until the page is closed, and no error is shown.

## What hiding a section does, and does not do

Switching a section off only removes its item from the sidebar, at once and without reloading anything. Switching it on brings the item back at its place.

- Its links still work: `#/run?mod=mod_explorer` still runs the explorer while Mods is hidden, and `#/guides` still shows the Guides page while Guides is hidden. A link from a page or a mod still opens it.
- While a section is hidden, nothing it shows makes a sidebar item current. Once it is switched on again, its item is current when what it holds is shown: the stage keeps each entry's section whether or not its item is shown.
- It does not switch a mod off, close a sandbox or remove a page. Switching a default mod off is the instantiation's choice, in the default mod settings.
