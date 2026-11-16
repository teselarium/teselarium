import { readDocumentBaseUrl, resolveFileReference } from "../files/index.ts";

/** The collection file of a collection folder. */
const COLLECTION_FILE_NAME = "collection.yaml";

/**
 * Resolves a collection reference to the URL of its collection file, the
 * collection's source. A location whose path ends in `.yaml` or `.yml` is the
 * collection file itself, any other location is the collection's folder,
 * holding `collection.yaml`. A relative location is resolved against
 * `baseUrl`, or the page's document base URL when there is none. Raises
 * `FileFetchError` when it cannot be resolved.
 */
export function resolveCollectionReference(
  reference: string,
  baseUrl: string | undefined,
): string {
  return resolveFileReference(
    reference,
    COLLECTION_FILE_NAME,
    baseUrl ?? readDocumentBaseUrl(),
  );
}
