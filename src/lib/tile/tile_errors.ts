/** Describes a caught value for an error message: its message when it is an Error. */
export function describeErrorCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

/** A file could not be fetched or read. `source` is the location that failed. */
export class FileFetchError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Cannot load file "${source}": ${reason}`, options);
    this.name = "FileFetchError";
    this.source = source;
  }
}

/** A fetched file is not valid markdown with YAML frontmatter. `source` is the file that failed. */
export class MarkdownParseError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Cannot parse markdown "${source}": ${reason}`, options);
    this.name = "MarkdownParseError";
    this.source = source;
  }
}

/** A fetched file is not valid plain YAML with a mapping at its top level. `source` is the file that failed. */
export class YamlParseError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Cannot parse YAML "${source}": ${reason}`, options);
    this.name = "YamlParseError";
    this.source = source;
  }
}

/** A collection file does not have the tile collection structure. `source` is the collection that failed. */
export class CollectionFormatError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid tile collection "${source}": ${reason}`, options);
    this.name = "CollectionFormatError";
    this.source = source;
  }
}
