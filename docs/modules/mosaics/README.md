# Mosaics

A mosaic is the third object of OpenTesela, next to tiles and mods. It is a shareable file that opens a mod with a tile collection the way the data's author wants it shown: the mod and the collection can each live on another site, and the mosaic file holds only what this pairing needs. The case that drives mosaics is the Nobel laureates on the country map: the laureate tiles have `name` and `birth_country`, the country map requires `title` and `country`, and the mosaic renames one to the other.

## The mosaic file

A mosaic is a YAML file with a `mosaic` mapping, by convention `mosaic.yaml` in a folder of its own:

```yaml
mosaic:
  title: "Laureates on the map"
  description: "Where each laureate was born."
  mod: "../mods/country_map"
  collection: "../tiles/literature_nobel_laureates"
  config:
    map:
      zoom: 3
  aliases:
    title: ["name"]
    country: ["birth_country"]
  permissions:
    show:
      - host: "https://upload.wikimedia.org"
        reason: "Shows the laureates' portraits"
```

- `title` is required, `description` optional.
- `mod` is a mod reference and `collection` an optional collection reference, both resolved against the mosaic file's location.
- `config` is merged into the mod's config: mappings key by key, any other value replacing the mod's.
- `aliases` maps a field of the mod's tile type to the names the collection uses for it, in order of preference.
- `permissions` holds only `show`: the hosts the collection's media need.

A reference to a mosaic is the file itself, or its folder, which means the `mosaic.yaml` in it. Mods and collections follow the same rule with `mod_conf.yaml` and `collection.yaml`. The format, the merge and the alias rules are in the [mosaic module](../lib/mosaic/README.md).

## A mod's default mosaic

A mod can name a mosaic of its own with `default_mosaic` in its mod file, resolved against the mod file and never fetched when the mod is loaded or inspected (see the [mod file format](../lib/mod/README.md#mod-file-format)). By convention it is a `mosaic.yaml` next to the mod file, whose `mod` is `"./"`, the mod's own folder (see [Mosaic references](../lib/mosaic/README.md#mosaic-references)):

```yaml
mosaic:
  title: "Science fiction books"
  description: "The book list with its sample books and their covers."
  mod: "./"
  collection: "./book_collection.yaml"
  permissions:
    show:
      - host: "https://covers.openlibrary.org"
        reason: "Shows the book covers"
```

- The default mosaic pairs the mod with the data it comes with, its example tiles, and declares the `show` hosts that data needs, so the mod file declares only what its own code reaches.
- The mod viewer's "Open default mosaic" opens it with `mosaics.open { mosaic: inspection.defaultMosaic }` (see the [mod viewer](../mods/viewer/README.md)).
- `mods.check` without a collection checks the mod as its default mosaic opens it. A default mosaic whose `mod` is not the mod it belongs to is a check error.

## Checking a mosaic

`mosaics.check { mosaic }` checks a mosaic's mod as the mosaic opens it: the mosaic file, the mod's files, the collection with the aliases applied, then a mount with the merged config and the mosaic's `show` lines. It does not run the mod's tests, which belong to the mod. Two warnings are specific to mosaics: an alias for a field the mod's tile type does not declare, and a config key, at any depth, that the mod's config does not have, such as a misspelt `config.colums`. The report names the mosaic file as `mosaic` (see [Checking a mosaic](../lib/core/engine/README.md#checking-a-mosaic) in the engine module).

## How a mosaic opens

- **From a link**: `#/run?mosaic=<reference>&<params>` opens the mosaic's mod with its collection, in a new sandbox, as a run link with that `mod` and `collection` would. The address stays the mosaic link. A link to a mosaic has no `mod`, `collection` or `tile` (see [Run links](../lib/core/stage/README.md#run-links) in the stage module).
- **From a mod**: `mosaics.inspect` reads a mosaic file without opening it, and `mosaics.open` opens it as if the user had followed its link. Both need the requester's `open` permission for the mosaic file's origin (see [Inspecting and opening mosaics](../lib/core/engine/README.md#inspecting-and-opening-mosaics) in the engine module).
- **What the mod gets**: `context.mosaic` (`source`, `title`, `description`), the merged `context.config`, and its tiles renamed by the aliases before they are validated against its tile type. "Reload tiles" renames the reloaded tiles the same way, without reading the mosaic file again (see [Launch](../lib/core/engine/README.md#launch) in the engine module).
- **Its storage**: a mod opened from a mosaic has a storage slot for that mosaic file, apart from the slot it has with the same collection from a run link and from the slots of other mosaics, so a mod remembers its state per mosaic (see [Storage slots](../lib/core/engine/README.md#storage-slots) in the engine module).
- **In the stage bar**: the mosaic capsule shows the mosaic's title after the mod and collection capsules, and its list holds the other mosaics, those of the same pair first, with the mosaic file's address in its details. Choosing another mod in the mod list keeps the mosaic's `show` lines through `sites`, which the Sites chip shows (see [The stage bar](../main/README.md#the-stage-bar)).

## Trust

- A mosaic declares `show` lines only, never `connect`, `embed`, `code` or `open`: it chooses data, not what the mod's code may reach.
- A mosaic file served from the app's origin is granted its lines. For a mosaic from another origin, the site consent dialog asks about its lines in a group of their own, next to the mod's, and the answers are remembered per mosaic file and listed in Settings.
- The grants last only for the sandbox opened from that mosaic, or one whose run link names it as `sites`, and the mosaic file's origin is a content host of the sandbox opened from it (see [Permissions of a mosaic](../lib/core/sandbox/README.md#permissions-of-a-mosaic) in the sandbox module).
- The mod a mosaic opens keeps its own trust: its mod API question and its own site consent, whatever mosaic opened it.
- A mosaic of the user catalog is trusted like a mosaic from another site. A stored mosaic's address, `opentesela-browser:///…`, is not from the app's origin and adds no content host, and a mosaic added by URL is on its own site, so the site consent dialog asks about their `show` lines, and the answers are remembered per mosaic address. A stored mosaic keeps its address when it is updated, so its answers and the mod's storage slot stay. Only the app's dialogs write the user catalog: a mod cannot add a mosaic whose `show` lines widen its own reach (see [The user catalog](../main/README.md#the-user-catalog)).
- **Consent at save**: when the user presses "Save" in the save confirmation ("Save mosaic"), which lists each added `show` line's host as a warning badge, the app remembers Allow for each `show` line of the saved mosaic under its address, as if the user had allowed it in the site consent dialog with Remember checked, so opening it asks nothing more for them. A remembered Deny of a saved line becomes Allow, and the lines a saved version no longer has keep their decisions. The decisions are written by the app from the text the dialog showed, never trusted from the mod, which sends only text. Lines that come from an import or an update from a file are not allowed this way: they are asked when the mosaic opens, as for any other mosaic. Settings lists the allowed lines under the mosaic, where they can be removed.

## Components

The [mosaic explorer](explorer/README.md), opened by the Mosaics section, lists mosaics and opens them, and the [mosaic viewer](viewer/README.md) shows a mosaic with its mod, collection, config, aliases and permissions, and checks it. Both ship as default mods. The viewer's edit mode makes and changes mosaics, the role planned for a mosaic maker (see [maker](maker/README.md)).

The app ships two sample mosaics in `samples/mosaics/`, which the vanilla mosaic explorer lists: `nobel_books_list.yaml`, the book list with the laureates' books eight per row, and `nobel_laureates_map.yaml`, the laureates on the country map through the aliases of the example above.
