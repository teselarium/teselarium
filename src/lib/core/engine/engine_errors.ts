/** A link or a request names a default mod that is switched off. `source` is the mod's resolved source. */
export class ModSwitchedOffError extends Error {
  readonly source: string;
  readonly modName: string;

  constructor(modName: string, source: string, options?: ErrorOptions) {
    super(`The default mod "${modName}" is switched off.`, options);
    this.name = "ModSwitchedOffError";
    this.source = source;
    this.modName = modName;
  }
}

/**
 * A run link names both a collection and a tile. `source` is the link's mod
 * reference, resolved. It is thrown before any file is requested.
 */
export class RunLinkConflictError extends Error {
  readonly source: string;

  constructor(source: string, options?: ErrorOptions) {
    super("A link cannot have both a collection and a tile.", options);
    this.name = "RunLinkConflictError";
    this.source = source;
  }
}

/**
 * A run link names a mosaic and also a mod, a collection or a tile. `source`
 * is the link's mosaic reference, resolved. It is thrown before any file is
 * requested.
 */
export class MosaicLinkConflictError extends Error {
  readonly source: string;

  constructor(source: string, options?: ErrorOptions) {
    super(
      "A link to a mosaic cannot also have a mod, a collection or a tile.",
      options,
    );
    this.name = "MosaicLinkConflictError";
    this.source = source;
  }
}

/** A request handler failed. The session sends `code` and `message` as the error response. */
export class ModMethodError extends Error {
  readonly code: number;

  constructor(code: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ModMethodError";
    this.code = code;
  }
}

/** Describes a caught value for an error message: its message when it is an Error. */
export function describeEngineError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
