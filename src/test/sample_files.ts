import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Base URL under which `fetchSample` serves the files of `public/samples/`. */
export const SAMPLES_BASE_URL = "https://example.org/samples/";

/**
 * `public/` on disk. Built from a path rather than `new URL("…", import.meta.url)`,
 * which Vite rewrites into a served URL for files under `public/`.
 */
const PUBLIC_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "public",
);

const SAMPLES_DIRECTORY = join(PUBLIC_DIRECTORY, "samples");

/** Reads a file under `public/samples/` from disk, e.g. `tiles/books/kallocain.md`. */
export function readSampleText(relativePath: string): string {
  const sampleText = readFileSync(
    join(SAMPLES_DIRECTORY, relativePath),
    "utf8",
  );
  return sampleText;
}

function readRequestedUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

function buildNotFoundResponse(): Response {
  const notFoundResponse = new Response("Not Found", {
    status: 404,
    statusText: "Not Found",
  });
  return notFoundResponse;
}

/** Answers with the text of a file on disk, or `404 Not Found` when it cannot be read. */
async function readFileResponse(filePath: string): Promise<Response> {
  try {
    const fileText = await readFile(filePath, "utf8");
    const fileResponse = new Response(fileText, { status: 200 });
    return fileResponse;
  } catch {
    return buildNotFoundResponse();
  }
}

/**
 * Test-only fetch: serves the file under `public/samples/` for URLs below
 * `SAMPLES_BASE_URL`, and answers `404 Not Found` for anything else.
 */
export async function fetchSample(input: RequestInfo | URL): Promise<Response> {
  const requestedUrl = readRequestedUrl(input);
  if (!requestedUrl.startsWith(SAMPLES_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const relativePath = requestedUrl.slice(SAMPLES_BASE_URL.length);
  const sampleResponse = await readFileResponse(
    join(SAMPLES_DIRECTORY, decodeURIComponent(relativePath)),
  );
  return sampleResponse;
}

/** Base URL under which `fetchAppFile` serves the files of `public/`: the app's address in tests. */
export const APP_BASE_URL = "https://example.org/";

/**
 * Test-only fetch: serves the file under `public/` for URLs below
 * `APP_BASE_URL`, like the built app does, and answers `404 Not Found` for
 * anything else. Samples are served at the same URLs as `fetchSample`.
 */
export async function fetchAppFile(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = new URL(readRequestedUrl(input));
  if (!requestedUrl.href.startsWith(APP_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const publicResponse = await readFileResponse(
    join(PUBLIC_DIRECTORY, decodeURIComponent(requestedUrl.pathname)),
  );
  return publicResponse;
}
