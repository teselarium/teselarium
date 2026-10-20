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
