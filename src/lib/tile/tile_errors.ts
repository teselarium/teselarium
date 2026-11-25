/** A collection file does not have the tile collection structure. `source` is the collection that failed. */
export class CollectionFormatError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid tile collection "${source}": ${reason}`, options);
    this.name = "CollectionFormatError";
    this.source = source;
  }
}

/** A tile type file has no usable JSON Type Definition schema. `source` is the type file that failed. */
export class TileTypeError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid tile type "${source}": ${reason}`, options);
    this.name = "TileTypeError";
    this.source = source;
  }
}

/**
 * A tile's metadata does not match a tile type. `source` is the tile that
 * failed. The reason starts with the type name and the type file's source.
 */
export class TileValidationError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Tile "${source}" is not of tile type ${reason}`, options);
    this.name = "TileValidationError";
    this.source = source;
  }
}
