/** Scheme of the files the app stores in the browser. */
export const BROWSER_FILE_PROTOCOL = "opentesela-browser:";

const BROWSER_FILES_ORIGIN = `${BROWSER_FILE_PROTOCOL}///`;

/**
 * Reads the text of stored files. `readText` resolves with `null` when the
 * store does not hold the address.
 */
export interface BrowserFileReader {
  readText(address: string): Promise<string | null>;
}

/** Whether `source` is an absolute `opentesela-browser:` address. */
export function isBrowserFileAddress(source: string): boolean {
  if (!URL.canParse(source)) {
    return false;
  }
  const isBrowserFile = new URL(source).protocol === BROWSER_FILE_PROTOCOL;
  return isBrowserFile;
}

/**
 * Encodes one path segment as the URL parser encodes a picked file's path,
 * plus `#` and `?`, which would otherwise end the path.
 */
function encodePathSegment(segment: string): string {
  const escapedDelimiters = segment
    .replaceAll("#", "%23")
    .replaceAll("?", "%3F");
  const segmentUrl = new URL(escapedDelimiters, BROWSER_FILES_ORIGIN);
  const encodedSegment = segmentUrl.pathname.slice(1);
  return encodedSegment;
}

/**
 * The address of a stored file: `opentesela-browser:///<root>/<path>`, where
 * `root` stands for the imported folder or single file, and `path` is the
 * file's path inside it.
 */
export function buildBrowserFileAddress(root: string, path: string): string {
  const encodedSegments: string[] = [encodePathSegment(root)];
  for (const segment of path.split("/")) {
    if (segment !== "") {
      encodedSegments.push(encodePathSegment(segment));
    }
  }
  const address = `${BROWSER_FILES_ORIGIN}${encodedSegments.join("/")}`;
  return address;
}
