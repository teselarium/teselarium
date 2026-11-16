/** A mosaic file does not have the mosaic file format. `source` is the mosaic file that failed. */
export class MosaicFormatError extends Error {
  readonly source: string;

  constructor(source: string, reason: string, options?: ErrorOptions) {
    super(`Invalid mosaic "${source}": ${reason}`, options);
    this.name = "MosaicFormatError";
    this.source = source;
  }
}
