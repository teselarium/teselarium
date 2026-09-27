# Mosaic Design (Mod) Specification

Mosaic Designs (or mods) are javascript plugins that allow to visualize and interact with a collection tiles of a given type. 

Mod are loaded inside an isolated (sandboxed) iframe where it can display their UI. When a mod is run, they recieve as input an object containing a list of tiles (metadata + body). Each mod can display the tiles in a customized way. Mods can comunicates with bidirectionally with the main app, like sending data to he mod, sending back data to the main app, communicating warning/error messages, requesting data from the mod to  the main, etc. A simple example is to make changes in the configuration parameters in the main app that impacts the mod UI.
Mod API is the library in charge of loading/unloading a mod and the bidirectional communication.

A loaded mod doesn't have direct access to localStorage or indexedDB, it must use the main app API for requesting or writting data. Mods only have access to their own data, or common data from the main app. Data from each mod is stored in separated slots.

As mods are created by the community and they need to follow principles of privacy and security.

Each mod has a required tile type and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. For example for a mod called "country_markers_map" that shows input tiles organized by country in a map:
```yaml
mod:
  name: "country_markers_map"
  title: "Country Markers Map"
  version: "1.0.0"
  description: "An interactive world map that display tiles as markers organized by country."
  entrypoint: "./main.js"
  tile_type:
    - country_location:
        title: string
        country: string
        image: optional:string  
        date: optional:string
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