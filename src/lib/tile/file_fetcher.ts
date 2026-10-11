import { readLocalFile } from "./local_files.ts";
import type { LocalFiles } from "./local_files.ts";
import { describeErrorCause, FileFetchError } from "./tile_errors.ts";

const LOCAL_FILE_PROTOCOL = "file:";

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

function readDefaultBaseUrl(): string | undefined {
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
      `the request failed: ${describeErrorCause(error)}`,
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

function readFileContent(url: URL, options: FileFetchOptions): Promise<string> {
  if (url.protocol === LOCAL_FILE_PROTOCOL) {
    return readLocalFile(url, options.localFiles);
  }
  const fetchFunction = options.fetch ?? globalThis.fetch;
  return readRemoteFile(url, fetchFunction);
}

/**
 * Loads the text of a file from a path or URL. `file:` URLs are read from the
 * picked local files, any other URL is fetched.
 */
export async function fetchFile(
  location: string,
  options: FileFetchOptions = {},
): Promise<FetchedFile> {
  const baseUrl = options.baseUrl ?? readDefaultBaseUrl();
  const url = resolveLocation(location, baseUrl);
  const content = await readFileContent(url, options);
  const fetchedFile: FetchedFile = { source: url.href, content };
  return fetchedFile;
}
