import { resolveLocation } from "./file_fetcher.ts";

/** A path ending in one of these names a file, any other path a folder. */
const FILE_REFERENCE_EXTENSIONS = [".yaml", ".yml"];

function isFileUrl(url: URL): boolean {
  for (const extension of FILE_REFERENCE_EXTENSIONS) {
    if (url.pathname.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

/** The file of a folder. The folder's query and fragment are dropped. */
function resolveFolderFile(folderUrl: URL, folderFileName: string): string {
  const folder = new URL(folderUrl.href);
  folder.search = "";
  folder.hash = "";
  if (!folder.pathname.endsWith("/")) {
    folder.pathname = `${folder.pathname}/`;
  }
  const fileUrl = new URL(folderFileName, folder);
  return fileUrl.href;
}

/**
 * Resolves a reference to a file that a folder holds by convention, such as
 * `collection.yaml`, to the file's absolute URL. A location whose path ends in
 * `.yaml` or `.yml` is the file itself, any other location is the folder.
 * Raises `FileFetchError` when the location cannot be resolved.
 */
export function resolveFileReference(
  reference: string,
  folderFileName: string,
  baseUrl: string | undefined,
): string {
  const url = resolveLocation(reference, baseUrl);
  if (isFileUrl(url)) {
    return url.href;
  }
  return resolveFolderFile(url, folderFileName);
}
