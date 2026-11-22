/** A mosaic file does not have the mosaic file format. `source` is the mosaic file that failed. */
export class MosaicFormatError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid mosaic "${source}": ${reason}`, options);
    this.name = "MosaicFormatError";
    this.source = source;
  }
}

/**
 * The form's edits cannot be applied to a draft. `reason` names the edit
 * key that is wrong, or says why the draft or the result cannot be read.
 */
export class MosaicEditError extends Error {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Cannot edit mosaic draft: ${reason}`, options);
    this.name = "MosaicEditError";
    this.reason = reason;
  }
}
