import { readDocumentBaseUrl, resolveFileReference } from "../files/index.ts";

/** The mosaic file of a mosaic folder. */
const MOSAIC_FILE_NAME = "mosaic.yaml";

/**
 * Resolves a mosaic reference to the URL of its mosaic file, the mosaic's
 * source. A location whose path ends in `.yaml` or `.yml` is the mosaic file
 * itself, any other location is the mosaic's folder, holding `mosaic.yaml`.
 * A relative location is resolved against `baseUrl`, or the page's document
 * base URL when there is none. Every reference to one mosaic file gives the
 * same source. Raises `FileFetchError` when it cannot be resolved.
 */
export function resolveMosaicReference(
  reference: string,
  baseUrl: string | undefined,
): string {
  return resolveFileReference(
    reference,
    MOSAIC_FILE_NAME,
    baseUrl ?? readDocumentBaseUrl(),
  );
}
