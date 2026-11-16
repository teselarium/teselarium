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

## How a mosaic opens

- **From a link**: `#/run?mosaic=<reference>&<params>` opens the mosaic's mod with its collection, in a new sandbox, as a run link with that `mod` and `collection` would. The address stays the mosaic link. A link to a mosaic has no `mod`, `collection` or `tile` (see [Run links](../lib/core/stage/README.md#run-links) in the stage module).
- **From a mod**: `mosaics.inspect` reads a mosaic file without opening it, and `mosaics.open` opens it as if the user had followed its link. Both need the requester's `open` permission for the mosaic file's origin (see [Inspecting and opening mosaics](../lib/core/engine/README.md#inspecting-and-opening-mosaics) in the engine module).
- **What the mod gets**: `context.mosaic` (`source`, `title`, `description`), the merged `context.config`, and its tiles renamed by the aliases before they are validated against its tile type. "Reload tiles" renames the reloaded tiles the same way, without reading the mosaic file again (see [Launch](../lib/core/engine/README.md#launch) in the engine module).
- **In the stage bar**: the mosaic's title before the mod's name, which is muted, and the mosaic file's address first in the information popover (see [The stage bar](../main/README.md#the-stage-bar)).

## Trust

- A mosaic declares `show` lines only, never `connect`, `embed`, `code` or `open`: it chooses data, not what the mod's code may reach.
- A mosaic file served from the app's origin is granted its lines. For a mosaic from another origin, the site consent dialog asks about its lines in a group of their own, next to the mod's, and the answers are remembered per mosaic file and listed in Settings.
- The grants last only for the sandbox opened from that mosaic, and the mosaic file's origin is a content host of that sandbox (see [Permissions of a mosaic](../lib/core/sandbox/README.md#permissions-of-a-mosaic) in the sandbox module).
- The mod a mosaic opens keeps its own trust: its mod API question and its own site consent, whatever mosaic opened it.

## Components

The mosaic explorer, the mosaic viewer and the mosaic maker, the default mods that list, show and make mosaics, come later: see [explorer](explorer/README.md), [viewer](viewer/README.md) and [maker](maker/README.md).
