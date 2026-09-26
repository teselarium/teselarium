# OpenTesela Format Specification

## Glossary

- **Tile**: Markdown document containing a piece of information and metadata in its frontmatter.
- **Tile Type**: Schema in yaml format that allow to valid a Tile as belonging to a certain type based on its metadata. It follows structural typing principles.
- **Tile Collection**: List of tiles paths or urls in yaml format.
- **Mosaic Design (Mod)**: Javascript plugin that allows to visualize and interact with a collection of tiles of a given tile type. 
- **Mosaic**: Bundle configuration in yaml that ties together a tile collection, a mosaic design and its configuration.

## Tiles and Tile Collections

A Tile is a markdown file with frontmatter containing metadata. 

Tile example:
```
---
title: "Fahrenheit 451"
date: "1953-10-19"
authors:
  - "Ray Bradbury"
country: "United States"
language: "English"
genres:
  - "Dystopian fiction"
  - "Science fiction"
pages: 156
image: "./fahrenheit_451.jpg"
---

Fahrenheit 451 is a 1953 dystopian novel by American writer Ray Bradbury. It presents a future American society where books have been outlawed and "firemen" burn any that are found...

Source: https://en.wikipedia.org/wiki/Fahrenheit_451
```

Tiles are organized in collections inside a yaml file. They are used as indexes of paths or urls, for example a collection of tiles named `science_fictions_books.yaml`:
```yaml
tile_collection:
  - url: "https://.../books/the_martian_chronicles.md"
  - url: "https://.../books/farenheit_451.md"
  - url: "https://.../books/foundation.md"
  - path: "./books/brave_new_world.md"
  - path: "./books/1984.md"
  - path: "./books/kallocain.md"
  - path: "./short_stories/the_library_of_babel.md"
```

## Tile Types

A tile represents a piece of multidimensional information thanks to its metadata that allows to assign different types. Tile Types are yaml schemas that define interfaces via structural typing (i.e. define the minimum properties to be present in order to validate its belonging to a type), for example a definition for a type named book:
```yaml
tile_type:
  - book:
      title: string
      date: string
      authors: list[string]
      country: string
      language: optional:string
      genres: list[string]
```

More generic types can be defined. For example a simple event type can be define for any metadata containing a title and a date:
```yaml
tile_type:
  - simple_event:
      title: string
      date: string
```

Or a country location type for any metadata containing a title and a country:
```yaml
tile_type:
  - country_location:
      title: string
      country: string
```

## Mosaic Designs (mod)

Mosaic Designs (Mod) are javascript plugins that allow to visualize and interact with a collection tiles of a given type. Each mod has a required tile type and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. For example for a mod called "country_markers_map" that shows input tiles organized by country in a map:
```yaml
mod:
  name: "country_markers_map"
  title: "Country Markers Map"
  version: "1.0.0"
  description: "An interactive world map that display tiles as markers organized by country."
  entry_point: "./main.js"
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

## Mosaic

A mosaic is the final product presented to the users where they can interact with tiles using the mod UI. A mosaic is built dynamically by OpenTesela based on a mosaic yaml file. This yaml is a bundle configuration that ties together a tile collection, a mod and its configuration. For example it can change default values or add aliases for the metadata for increasing compatibility.

```yaml
mosaic:
  name: "science_fiction_books_by_country"
  title: "Science Fiction Books Around the World"
  description: "Classic science fiction novels placed on a map by country of origin."

  # Tile collection to display (path or url).
  tile_collection:
    path: "./science_fiction_books.yaml"

  # Mod used to render the collection (path or url), with a compatible version range.
  mod:
    name: "country_markers_map"
    path: "./mods/country_markers_map"
    version: "^1.0.0"

  aliases:
    title:
      - "name"
      - "book_name"
    country:
      - "origin"
      - "pub_country"
    date:
      - "pub_date"
      - "published"

  config:
    map:
      center: [-34.6085, -58.3722]
      zoom: 3
    markers:
      color: "#aa3333"
    popup:
      show_body: true
```
