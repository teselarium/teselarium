# Tesela Format Specification

## Glossary

- Tile:
- Tile Type:
- Tile Collection: 
- Design:
- Design Configuration:
- Mosaic:

# Tiles and Tile Collections

A Tile is a markdown file with frontmatter containing metadata.


Tiles are organized in collections inside a folder with a `collection.yaml`, for example:
```yaml
collection:
  - tile:
    - "markdown_filename_1.md"
    - "markdown_filename_2.md"
  ...
    
```
Tiles have types that correspond to interfaces (structural typing, i.e. minimun properties to be present), for example a definition for a type named `event_card`:
```yaml
types:
  - event_card:
      title: string
      description: string
      date_label: string
      sort_date: date
      tags:
        - deck: string
  - ...
```

Decks are organized in collections inside a yaml file, here a generic collections of decks that can be stored in a file named `my_decks.yaml`, for example:
```yaml
collection:
  - type: deck
    interface: event_card
    title: "Title text"
    description: "Description text"
    some_field: some_value
    include:
      - deck: "Deck name"
      - some_key: some_value
    exclude:
      - some_other_key: some_other_value
    tags:
      - keyA: valueA
      - keyB: valueB
  - ...
```
Decks use selectors (include or exclude) to filter a collections based on tags "key:value". Include selector is additive. 

Decks use interface for selecting only elements in collections that respect a specific interface.

Cards may have multiples tags and properties and they may be compatibles with differents types. Interactive UI like games will require specific types (interfaces) in order to be compatible, for example a game based on dates will require a sort_date property.

## Deck files location

Deck, card collection and type YAML files live under `public/decks/`, where they are served as static
assets and fetched at runtime. A generated `public/decks/index.json` lists the available files so the
app can discover them without a server; it is rebuilt by `scripts/generate-deck-index.mjs` on `npm run
dev` and `npm run build`.

Loading goes through a `DeckSource` abstraction (an identifier, a label and a base URL), so future
sources such as a custom URL or a local folder plug in without changing the loader.
