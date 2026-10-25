# Mosaic Design (Mod) Specification

Mosaic Designs (or mods) are javascript plugins that allow to visualize and interact with a collection tiles of a given type.

Mods are loaded inside an isolated iframe (sandbox) where it can display their UI. The Mod module inside `src/lib` is in charge of loading/unloading a mod.

Mods can communicates with the main app via the core engine API, like requesting data and receiving data, storing and modifying data, redirecting to another mod. Once a mod is loaded, they can interact with the core engine and request data like the mod API version, tiles, tile collections, mods, mosaics, settings, etc. Each mod can display the data in a customized way inside the sandbox. 

A loaded mod doesn't have direct access to localStorage or indexedDB, it must use the core engine API for operations like requesting, writing or redirecting the user. Mods only have access to their own data and the common (shared) data from the main app via the core engine API. Data from each mod is stored in separated slots.

Mods need a Mosaic for defining the configuration. Mods come with a default mosaic.

As mods are created by the community and they need to follow principles of privacy and security.

Each mod has a required tile type (JTD schema) and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

A Mod can use a generic tile type in order to be compatible with any tile, for example defining only optional parameter like title or name. Furthermore, a mod may not need any tile to work, for example a mod for an alternative visualization of the home or the settings page

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. By default, a mod is a folder that bundles its mod_conf.yaml, its code, its tile type file and a sample collection, so it can be copied or shared as one folder. `type_path` and `sample_collection` are resolved against the mod_conf.yaml location, and they may also point outside the mod folder or to another site, for example to share one tile type between several mods. For example for a mod called "country_markers_map" that shows input tiles organized by country in a map:

```yaml
mod:
  name: "country_markers_map"
  title: "Country Markers Map"
  version: "1.0.0"
  api: "^0.1.0"
  description: "An interactive world map that display tiles as markers organized by country."
  entrypoint: "./main.js"
  type_path: "./country_location.md"
  sample_collection: "./sample_collection.yaml"
  config:
    map:
      center: [0, 0.0] # [latitude, longitude]
      zoom: 2
      base_layer: "openstreetmap"
    markers:
      color: "#3366cc"
      size: 12
    popup:
      show_image: true
      show_body: false
```

`api` is the range of mod API versions the mod was written for, in npm's semver range syntax. The mod API version is separate from the app's own version and covers what a mod relies on: the engine methods and events, the mount context and the mod file format. When the range does not match the app's mod API version, the app asks the user before starting the mod; a mod without `api` runs with a warning. A mod reads the version it runs on in its mount context, as `context.api.version`.

The tile type is a markdown file whose frontmatter has a `schema` mapping, here `country_location.md` next to mod_conf.yaml:

```markdown
---
schema:
  definitions:
    country_location:
      properties:
        title:
          type: string
        country:
          type: string
      optionalProperties:
        image:
          type: string
        date:
          type: string
      additionalProperties: true
  ref: country_location
---

# Country Location

Tiles with a title and the country they are located in.
```

## Checking a mod

A mod can be checked before anyone runs it, with no code from its author. Open the mod in the mod viewer (`#/run?mod=mod_viewer&target=<mod reference>`) and press "Check mod". The viewer sends `mods.check` with the mod's source, and with the collection field's address when it holds one; otherwise the mod's sample collection is used. Any visible mod with an `open` permission for the mod's site can send `mods.check` the same way.

The check has two steps:

- **Bundle check**: the mod file, the entrypoint, the tile type and the collection must load, and the collection's tiles are validated against the tile type. A file that cannot be loaded or has the wrong format is an error naming that file. A tile that does not match the type is a warning naming the tile. A missing `api` range, or one that does not match the app's mod API version, is a warning: the check asks nothing.
- **Mount check**: when the bundle check found no error, the mod is mounted in a hidden frame, with the permissions it would get if it were opened, the tiles of its type and an empty storage slot that is thrown away afterwards; the mod's real slot is never read nor written. The check records a `mount` that throws or rejects, a mod that left its page, blocked requests and blocked browser dialogs, every request answered with `-32600`, `-32601` or `-32602` (a message that is not a request, an unknown method, bad params), and the requests that would need the user (`links.open`, `files.save` and `ui.confirm` answer `false`, `mods.open` and `mods.check` are refused), without showing any dialog. A `mount` that has not finished after 10 seconds is an error.

Only the start of the mod is watched: the check ends 1 second after `mount` finished, so timers and requests that start later are not recorded.

The report's status is `pass` when there are no findings, `warn` when there are only warnings and `fail` when a finding is an error. Each finding names its step (`bundle` or `mount`), its level, the file or mod it is about and a message. The check leaves the app as it was: no new sandbox, history entry or stage bar item.
