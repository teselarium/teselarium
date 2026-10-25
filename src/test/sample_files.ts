import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Base URL under which `fetchAppFile` serves the files of `public/`: the app's address in tests. */
export const APP_BASE_URL = "https://example.org/";

/**
 * Base URL under which `fetchFixture` and `fetchAppFile` serve the files of
 * `src/test/fixtures/`. It is on the app's origin, so fixture mods get the
 * permissions of mods from the app's origin.
 */
export const FIXTURES_BASE_URL = `${APP_BASE_URL}fixtures/`;

/**
 * `./fixtures/`: the app-relative form of the fixtures root, as run links and
 * mod references write it. It resolves to `FIXTURES_BASE_URL` against `APP_BASE_URL`.
 */
export const FIXTURES_REFERENCE = "./fixtures/";

const PROJECT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/**
 * `public/` on disk. Built from a path rather than `new URL("…", import.meta.url)`,
 * which Vite rewrites into a served URL for files under `public/`.
 */
const PUBLIC_DIRECTORY = join(PROJECT_DIRECTORY, "public");

/** `src/test/fixtures/` on disk: the files unit tests read, apart from the shipped sample. */
const FIXTURES_DIRECTORY = join(PROJECT_DIRECTORY, "src", "test", "fixtures");

/** Reads a file under `src/test/fixtures/` from disk, e.g. `tiles/books/kallocain.md`. */
export function readFixtureText(relativePath: string): string {
  const fixtureText = readFileSync(
    join(FIXTURES_DIRECTORY, relativePath),
    "utf8",
  );
  return fixtureText;
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

/** Answers with the fixture file for a URL below `FIXTURES_BASE_URL`. */
async function readFixtureResponse(requestedUrl: string): Promise<Response> {
  const relativePath = requestedUrl.slice(FIXTURES_BASE_URL.length);
  const fixtureResponse = await readFileResponse(
    join(FIXTURES_DIRECTORY, decodeURIComponent(relativePath)),
  );
  return fixtureResponse;
}

/**
 * Test-only fetch: serves the file under `src/test/fixtures/` for URLs below
 * `FIXTURES_BASE_URL`, and answers `404 Not Found` for anything else.
 */
export async function fetchFixture(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = readRequestedUrl(input);
  if (!requestedUrl.startsWith(FIXTURES_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const fixtureResponse = await readFixtureResponse(requestedUrl);
  return fixtureResponse;
}

/**
 * Test-only fetch: serves the file under `public/` for URLs below
 * `APP_BASE_URL`, like the built app does, and answers `404 Not Found` for
 * anything else. The one exception is the fixtures: URLs below
 * `FIXTURES_BASE_URL` are served from `src/test/fixtures/`, at the same URLs
 * as `fetchFixture`. `public/` has no `fixtures/` folder, so no file is hidden.
 * Only the sample smoke test reads the shipped sample, at `${APP_BASE_URL}samples/`.
 */
export async function fetchAppFile(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = new URL(readRequestedUrl(input));
  if (requestedUrl.href.startsWith(FIXTURES_BASE_URL)) {
    const fixtureResponse = await readFixtureResponse(requestedUrl.href);
    return fixtureResponse;
  }
  if (!requestedUrl.href.startsWith(APP_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const publicResponse = await readFileResponse(
    join(PUBLIC_DIRECTORY, decodeURIComponent(requestedUrl.pathname)),
  );
  return publicResponse;
}
