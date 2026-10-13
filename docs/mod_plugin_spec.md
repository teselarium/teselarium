# Mosaic Design (Mod) Specification

Mosaic Designs (or mods) are javascript plugins that allow to visualize and interact with a collection tiles of a given type.

Mods are loaded inside an isolated iframe (sandbox) where it can display their UI. The Mod module inside `src/lib` is in charge of loading/unloading a mod.

Mods can communicates with the main app via the core engine API, like requesting data and receiving data, storing and modifying data, redirecting to another mod. Once a mod is loaded, they can interact with the core engine and request data like the opentesela version, tiles, tile collections, mods, mosaics, settings, etc. Each mod can display the data in a customized way inside the sandbox. 

A loaded mod doesn't have direct access to localStorage or indexedDB, it must use the core engine API for operations like requesting, writing or redirecting the user. Mods only have access to their own data and the common (shared) data from the main app via the core engine API. Data from each mod is stored in separated slots.

Mods need a Mosaic for defining the configuration. Mods come with a default mosaic.

As mods are created by the community and they need to follow principles of privacy and security.

Each mod has a required tile type (JTD schema) and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

A Mod can use a generic tile type in order to be compatible with any tile, for example defining only optional parameter like title or name. Furthermore, a mod may not need any tile to work, for example a mod for an alternative visualization of the home or the settings page

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. For example for a mod called "country_markers_map" that shows input tiles organized by country in a map:

```yaml
mod:
  name: "country_markers_map"
  title: "Country Markers Map"
  version: "1.0.0"
  description: "An interactive world map that display tiles as markers organized by country."
  entrypoint: "./main.js"
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
