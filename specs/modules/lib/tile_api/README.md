# Tile API

This library implements:
- A tile parser. It will read a markdown with frontmatter and transform it in an object with properties: metadata for the yaml parsed from the frontmatter and a body parsed as a simple string that contains the markdown original text. The tile parser is also capable of parse a tile type file.
- A tile validator. It will validate a metadata object based on a schema. The schema can be obtained from the metadata object of a tile type.
- A collection loader. It will parser a tile collection yaml file and then load all the path and url directing to tiles markdown files as a list of objects. It will use the tile parser for loading.
