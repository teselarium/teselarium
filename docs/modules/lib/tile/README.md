# Tile Module

## Introduction

This library implements the following components based on [tesela_spec.md](../../../tesela_spec.md):

- A file fetcher. It will load in memory any file (path or URL). Output object properties:
  - Source path of the input file as a string.
  - Content of the file
- A md parser. It takes as input the output of the file fetcher. It will read a markdown with frontmatter and transform it in an object with properties. Output object properties:
  - Source path of the input as a string.
  - Metadata for the yaml parsed from the frontmatter as an object.
  - Body parsed as a simple string that contains the markdown original text.
- A yaml parser. It takes as input the output of the file fetcher. It will read a yaml and transform it in an object with properties. Output object properties:
  - Source path of the input as a string.
  - Content is the yaml parsed as an object.
- A tile loader that takes as input a path or URL and chains the file fetcher and the md parser. The output is called a tile. It has additional properties:
  - Types. A list of types for which the tile has been validated against. When first loaded this list is empty.
- A tile validator builder that takes as input a path or URL and chains the file fetcher and the md parser, then uses the schema inside the metadata (yaml frontmatter) as reference schema for validation. It produces as output a tile validator. Raises an error if schema is missing or isn't valid JTD. In order to follow structural typing, it adds `additionalProperties: true` when it is omitted, an explicit `additionalProperties: false` is kept.
- A tile validator. It will validate a tile object based on its metadata and a reference schema. It will return the tile type if valid (i.e. schema.ref property), if not it will raise an error.
- A collection loader that takes as input a path or URL and chains the file fetcher and the yaml parser, for generating the tile path list, and then calls the tile loader for each path. Relative paths for tile are resolved against the collection file's location. Tile related errors are captured, so it traverses the whole tile list. Tiles that fail to load are excluded from tiles and reported as issues. Output properties:
  - Tiles is a list of tile objects.
  - Issues, containing warnings and errors.
- A collection validator. It takes a tile collection and a tile validator as input, and produces a tile collection with the types assigned to each tile and the collection's issues property updated if validation issues were found. Tiles that are not validated are still kept in the collection but without the type updated. This validator should follow idempotency so validating the same collection twice does not create duplicates.
- An issue is an object containing the properties:
  - Level: warning, error
  - Source: tile path
  - Message

### Examples in pseudo-code (not real code):

Single tile creation:

```
tile = load_tile(tile_path)
```

Tile validator creation:

```
tile_validator = build_tile_validator(tile_type_path)
```

Single tile validation:

```
tile_type = tile_validator(tile)
```

Tile collection creation

```
tile_collection = load_tile_collection(tile_collection_path)
```

Tile collection validation:

```
validated_tile_collection = validate_tile_collection(tile_collection, tile_validator)
```

## Module Details

TODO
