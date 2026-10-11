import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

/** Base URL under which `fetchSample` serves the files of `samples/`. */
export const SAMPLES_BASE_URL = "https://example.org/samples/";

const SAMPLES_DIRECTORY_URL = new URL("../../samples/", import.meta.url);

/** Reads a file under `samples/` from disk, e.g. `tiles/books/kallocain.md`. */
export function readSampleText(relativePath: string): string {
  const sampleUrl = new URL(relativePath, SAMPLES_DIRECTORY_URL);
  const sampleText = readFileSync(sampleUrl, "utf8");
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

async function readSampleResponse(relativePath: string): Promise<Response> {
  const sampleUrl = new URL(relativePath, SAMPLES_DIRECTORY_URL);
  try {
    const sampleText = await readFile(sampleUrl, "utf8");
    const sampleResponse = new Response(sampleText, { status: 200 });
    return sampleResponse;
  } catch {
    return buildNotFoundResponse();
  }
}

/**
 * Test-only fetch: serves the file under `samples/` for URLs below
 * `SAMPLES_BASE_URL`, and answers `404 Not Found` for anything else.
 */
export async function fetchSample(input: RequestInfo | URL): Promise<Response> {
  const requestedUrl = readRequestedUrl(input);
  if (!requestedUrl.startsWith(SAMPLES_BASE_URL)) {
    return buildNotFoundResponse();
  }
  const relativePath = requestedUrl.slice(SAMPLES_BASE_URL.length);
  const sampleResponse = await readSampleResponse(relativePath);
  return sampleResponse;
}
