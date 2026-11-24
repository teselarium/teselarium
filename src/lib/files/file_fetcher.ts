import { BROWSER_FILE_PROTOCOL } from "./browser_files.ts";
import type { BrowserFileReader } from "./browser_files.ts";
import { describeErrorCause, FileFetchError } from "./file_errors.ts";
import { readLocalFile } from "./local_files.ts";
import type { LocalFiles } from "./local_files.ts";

const LOCAL_FILE_PROTOCOL = "file:";

/**
 * Added to the message of a rejected request: the browser rejects a request
 * to a site that is down and to one that does not allow the app's origin
 * (CORS) alike, and tells the page nothing more.
 */
const REJECTED_REQUEST_HINT =
  "The site may be unreachable or may not allow this app to read its files.";

/** A file loaded in memory. `source` is the resolved absolute URL it was read from. */
export interface FetchedFile {
  source: string;
  content: string;
}

export interface FileFetchOptions {
  /** Base for relative locations. In a browser page it defaults to the document base URL. */
  baseUrl?: string;
  /** Reader for non-`file:` URLs. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Files the user picked, needed for `file:` locations. */
  localFiles?: LocalFiles;
  /** Files stored in the browser, needed for `teselarium-browser:` locations. */
  browserFiles?: BrowserFileReader;
}

function describeUnresolvedLocation(baseUrl: string | undefined): string {
  if (baseUrl === undefined) {
    return "it is not a valid absolute URL, and a base URL is required to resolve a relative location";
  }
  const reason = `it cannot be resolved against the base URL "${baseUrl}"`;
  return reason;
}

/** Resolves a path or URL to an absolute URL. Raises `FileFetchError` when it cannot. */
export function resolveLocation(
  location: string,
  baseUrl: string | undefined,
): URL {
  try {
    const url = new URL(location, baseUrl);
    return url;
  } catch (error) {
    throw new FileFetchError(location, describeUnresolvedLocation(baseUrl), {
      cause: error,
    });
  }
}

/** The page's document base URL, or `undefined` outside a browser page. */
export function readDocumentBaseUrl(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  return document.baseURI;
}

function describeHttpStatus(response: Response): string {
  if (response.statusText === "") {
    return `HTTP ${response.status}`;
  }
  const httpStatus = `HTTP ${response.status} ${response.statusText}`;
  return httpStatus;
}

async function requestRemoteFile(
  url: URL,
  fetchFunction: typeof globalThis.fetch,
): Promise<Response> {
  try {
    const response = await fetchFunction(url.href);
    return response;
  } catch (error) {
    throw new FileFetchError(
      url.href,
      `the request failed: ${describeErrorCause(error)}. ${REJECTED_REQUEST_HINT}`,
      { cause: error },
    );
  }
}

async function readRemoteFile(
  url: URL,
  fetchFunction: typeof globalThis.fetch,
): Promise<string> {
  const response = await requestRemoteFile(url, fetchFunction);
  if (!response.ok) {
    throw new FileFetchError(url.href, describeHttpStatus(response));
  }
  try {
    const text = await response.text();
    return text;
  } catch (error) {
    throw new FileFetchError(
      url.href,
      `the response body cannot be read: ${describeErrorCause(error)}`,
      { cause: error },
    );
  }
}

async function readStoredFile(
  url: URL,
  browserFiles: BrowserFileReader | undefined,
): Promise<string> {
  const text = (await browserFiles?.readText(url.href)) ?? null;
  if (text === null) {
    throw new FileFetchError(url.href, "it is not stored in this browser");
  }
  return text;
}

function readFileContent(url: URL, options: FileFetchOptions): Promise<string> {
  if (url.protocol === LOCAL_FILE_PROTOCOL) {
    return readLocalFile(url, options.localFiles);
  }
  if (url.protocol === BROWSER_FILE_PROTOCOL) {
    return readStoredFile(url, options.browserFiles);
  }
  const fetchFunction = options.fetch ?? globalThis.fetch;
  return readRemoteFile(url, fetchFunction);
}

/**
 * Loads the text of a file from a path or URL. `file:` URLs are read from the
 * picked local files, `teselarium-browser:` URLs from the files stored in the
 * browser, and any other URL is fetched.
 */
export async function fetchFile(
  location: string,
  options: FileFetchOptions = {},
): Promise<FetchedFile> {
  const baseUrl = options.baseUrl ?? readDocumentBaseUrl();
  const url = resolveLocation(location, baseUrl);
  const content = await readFileContent(url, options);
  const fetchedFile: FetchedFile = { source: url.href, content };
  return fetchedFile;
}
