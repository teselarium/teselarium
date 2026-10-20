/** A mod file does not have the mod file format. `source` is the mod file that failed. */
export class ModFormatError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid mod "${source}": ${reason}`, options);
    this.name = "ModFormatError";
    this.source = source;
  }
}
