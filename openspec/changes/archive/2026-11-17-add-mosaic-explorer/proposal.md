# Proposal

## Why

After `add-mosaics` and `rework-mod-file-format`, mosaics open from links, declare the media hosts their data needs, and can be checked. But nothing in the app shows which mosaics exist, and the Mosaics section of the sidebar still says "Coming soon".

Tiles and Mods each have an explorer and a viewer, shipped as default mods. Mosaics need the same pair, and samples that show what a mosaic adds to a run link: a config override, and aliases that let a collection meet a mod's tile type.

## What Changes

- **New default mod `mosaic_explorer`.** It lists the mosaics of its config's `mosaics`, each as a card with its title and description from `mosaics.inspect`. Each card has:
  - an "Open" button, which opens the mosaic with `mosaics.open`;
  - a "View" button, which opens the viewer of its config with the mosaic's source as `target`.

  A location that cannot be inspected is listed as an alert. The explorer requests no mod, collection or tile.
- **New default mod `mosaic_viewer`.** It shows the mosaic named by its `target` parameter:
  - its title, description and source;
  - its mod, inspected with `mods.inspect`: the mod's title, version and whether its API range matches;
  - its collection, inspected with `collections.inspect`: the collection's title and number of tiles;
  - its config overrides, its aliases, and its `show` permissions with whether each would be granted.

  It has three actions:
  - "Open mosaic" (`mosaics.open`), its primary action;
  - "Check mosaic" (`mosaics.check`), which shows the report as the mod viewer shows a mod's;
  - the mod's and the collection's titles, which open the mod viewer and the collection viewer.
- **Two sample mosaics in `public/samples/mosaics/`**, listed by the vanilla mosaic explorer:
  - `nobel_books_list.yaml`: `book_list` with the Nobel laureates' books. It overrides `columns` and declares the covers' `show` hosts.
  - `nobel_laureates_map.yaml`: `country_map` with the Nobel laureates. Its aliases rename `name` to `title` and `birth_country` to `country`, so all 17 laureates reach the map. It declares `show` for the portraits' host.
- **The Mosaics section becomes available.** Its target is the mod link `mosaic_explorer` and it is no longer coming soon. Switching off `mosaic_explorer` removes it, as for Tiles and Mods. The coming-soon mechanism stays for instantiations, but the vanilla app no longer has a coming-soon section.
- **Docs.** The `# TODO` stubs of `docs/modules/mosaics/explorer/` and `docs/modules/mosaics/viewer/` get their content. The section registry, the Settings page docs, `docs/modules/README.md` and `default_mods/README.md` list the new mods.

Out of scope:
- A mosaic maker.
- Listing the mods' default mosaics in the explorer.
- Mosaics as section targets.

## Mod API version bump

**None.** The new mods use only existing methods: `mosaics.inspect`, `mosaics.open` and `mosaics.check` from the previous changes, plus `mods.inspect`, `collections.inspect` and `mods.open`. They declare `api: "^0.1.0"`, as every default mod does. Following the bump rule, the app takes a **patch** bump for the new section and mods.

## Capabilities

### New Capabilities
- `sample-mosaics`: the two shipped sample mosaics: their files, what each shows, and that the laureates reach the map through aliases.

### Modified Capabilities
- `default-mods`:
  - the mosaic explorer, its vanilla config and its cases;
  - the mosaic viewer, its actions, its check report and its cases;
  - the list of default mods that ship their tests;
  - the rule that fixtures are not listed by the vanilla explorers.
- `app-sidebar`: the vanilla registry gives Mosaics the target `mosaic_explorer`, and the coming-soon behavior is shown with an instantiation's section instead of Mosaics.
- `app-settings`: the vanilla Settings page no longer shows Mosaics as coming soon, and the switch scenarios name their example sections `removed_section` and `new_section` instead of `atlas`.
- `mod-tests`: a case can answer `mosaics.open` with `null`, as `rework-mod-file-format` already implemented, and a case's `mosaics.check` is answered with `-32002`. This records existing behavior; the mod API does not change.

## Impact

- **New default mods:**
  - `default_mods/mosaic_explorer/` and `default_mods/mosaic_viewer/`, each with `mod_conf.yaml`, `src/`, `test/` and `fixtures/`;
  - the shared types they use are already in `default_mods/mod_api.d.ts`.
- **App:**
  - the `mosaics` entry of `src/main/sections/vanilla_sections.ts`;
  - the sidebar and Settings tests that used Mosaics as their coming-soon example move to a test registry.
- **Samples:** `public/samples/mosaics/`.
- **Tests:**
  - `e2e/default_mods.spec.ts`;
  - a new `e2e/sample_mosaics.spec.ts`, tagged `@sample`;
  - `e2e/app_sidebar.spec.ts` and `e2e/app_settings.spec.ts`.
- **Docs:**
  - `docs/modules/mosaics/explorer/README.md` and `docs/modules/mosaics/viewer/README.md`;
  - `docs/modules/main/README.md`, `docs/modules/main/settings/README.md` and `docs/modules/README.md`;
  - `default_mods/README.md`.
- **Depends on `add-mosaics` and `rework-mod-file-format`,** archived on 2026-11-16 and 2026-11-17. Their specs are the base of this change's deltas.
