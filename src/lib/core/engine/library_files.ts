import { fetchFile } from "../../files/index.ts";
import type { FileFetchOptions } from "../../files/index.ts";
import type { LibraryFileKind, LoadedLibrary } from "../../mod/index.ts";
import { describeEngineError } from "./engine_errors.ts";

/** A fetched file of a declared library, as the frame loader receives it. */
export interface LibraryFileText {
  path: string;
  kind: LibraryFileKind;
  text: string;
}

/** The text of each declared library file already requested, by address. */
export type LibraryFileCache = Map<string, Promise<string>>;

/** The longest answer of a host that a library error quotes. */
const MAX_HOST_TEXT_LENGTH = 200;

const PLAIN_TEXT_TYPE = "text/plain";

/** A file of a declared library could not be fetched. `source` is the file's address. */
export class LibraryFileError extends Error {
  readonly source: string;

  constructor(
    libraryName: string,
    source: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(
      `the library "${libraryName}" could not be loaded: ${reason}`,
      options,
    );
    this.name = "LibraryFileError";
    this.source = source;
  }
}

/** What a host answered to a failed request, when it is short plain text. */
interface HostAnswer {
  text: string | null;
}

export function createLibraryFileCache(): LibraryFileCache {
  const cache: LibraryFileCache = new Map();
  return cache;
}

/**
 * The library files of this page, shared by every mod's `libs.load` and by
 * the bundle check of `mods.check`, so a file is fetched once per page.
 */
export const PAGE_LIBRARY_FILES: LibraryFileCache = createLibraryFileCache();

function isShortPlainText(response: Response, text: string): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return (
    contentType.startsWith(PLAIN_TEXT_TYPE) &&
    text !== "" &&
    text.length <= MAX_HOST_TEXT_LENGTH
  );
}

/** Reads a failed answer's body, which the shared fetcher leaves unread. */
async function readHostText(response: Response): Promise<string | null> {
  try {
    const text = (await response.text()).trim();
    return isShortPlainText(response, text) ? text : null;
  } catch {
    return null;
  }
}

/** A `fetch` that keeps the short plain-text body of a failed answer, such as jsDelivr's reason for a 404. */
async function fetchKeepingHostText(
  fetchFunction: typeof globalThis.fetch,
  answer: HostAnswer,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetchFunction(input, init);
  if (!response.ok) {
    answer.text = await readHostText(response);
  }
  return response;
}

/** The fetcher's error, with the host's text after its message when there is one. */
function addHostText(error: unknown, answer: HostAnswer): unknown {
  if (answer.text === null) {
    return error;
  }
  const errorWithText = new Error(
    `${describeEngineError(error)}: ${answer.text}`,
    { cause: error },
  );
  return errorWithText;
}

/**
 * Fetches a library file with the shared fetcher. On a failed answer whose
 * body is short plain text, the error's message ends with that text.
 */
async function fetchLibraryFileText(
  source: string,
  options: FileFetchOptions,
): Promise<string> {
  const answer: HostAnswer = { text: null };
  const fetchFunction = options.fetch ?? globalThis.fetch;
  const fetchOptions: FileFetchOptions = {
    ...options,
    fetch: fetchKeepingHostText.bind(undefined, fetchFunction, answer),
  };
  try {
    const fetchedFile = await fetchFile(source, fetchOptions);
    return fetchedFile.content;
  } catch (error) {
    throw addHostText(error, answer);
  }
}

/** A failed fetch leaves the cache, so a later request fetches the file again. */
function forgetFailedFile(
  cache: LibraryFileCache,
  source: string,
  error: unknown,
): never {
  cache.delete(source);
  throw error;
}

/** Fetches a library file once per cache: later requests share the first request's promise. */
export function fetchLibraryFileOnce(
  cache: LibraryFileCache,
  source: string,
  options: FileFetchOptions,
): Promise<string> {
  const cachedText = cache.get(source);
  if (cachedText !== undefined) {
    return cachedText;
  }
  const text = fetchLibraryFileText(source, options).catch(
    forgetFailedFile.bind(undefined, cache, source),
  );
  cache.set(source, text);
  return text;
}

/**
 * Fetches the file at `fileIndex` of a declared library through `cache`.
 * Rejects with a `LibraryFileError` naming the library and the file. The
 * bundle check uses it to report each failing file.
 */
export async function fetchLibraryFile(
  cache: LibraryFileCache,
  library: LoadedLibrary,
  fileIndex: number,
  options: FileFetchOptions,
): Promise<LibraryFileText> {
  const file = library.files[fileIndex];
  try {
    const text = await fetchLibraryFileOnce(cache, file.source, options);
    const fileText: LibraryFileText = {
      path: file.path,
      kind: file.kind,
      text,
    };
    return fileText;
  } catch (error) {
    throw new LibraryFileError(
      library.name,
      file.source,
      describeEngineError(error),
      { cause: error },
    );
  }
}

/**
 * Fetches every file of a declared library through `cache`, in parallel,
 * and resolves with their texts in the order of the declaration once all of
 * them arrived. Rejects with the `LibraryFileError` of the first file that
 * failed.
 */
export function fetchLibraryFiles(
  cache: LibraryFileCache,
  library: LoadedLibrary,
  options: FileFetchOptions,
): Promise<LibraryFileText[]> {
  const fetches: Promise<LibraryFileText>[] = [];
  for (let fileIndex = 0; fileIndex < library.files.length; fileIndex++) {
    fetches.push(fetchLibraryFile(cache, library, fileIndex, options));
  }
  return Promise.all(fetches);
}
