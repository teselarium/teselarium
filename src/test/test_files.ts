import type { Metadata } from "../lib/files/index.ts";
import type { Tile } from "../lib/tile/index.ts";
import { fetchAppFile } from "./sample_files.ts";

/** Texts served by `fetchTestFile`, keyed by URL. Each test file clears it after each test. */
export const testTexts = new Map<string, string>();

export function readRequestedUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
}

/** Serves the test texts, and falls back to the fixtures and the files under `public/` (see `fetchAppFile`). */
export async function fetchTestFile(
  input: RequestInfo | URL,
): Promise<Response> {
  const requestedUrl = readRequestedUrl(input);
  const testText = testTexts.get(requestedUrl);
  if (testText === undefined) {
    const publicResponse = await fetchAppFile(requestedUrl);
    return publicResponse;
  }
  const testResponse = new Response(testText, { status: 200 });
  return testResponse;
}

/** Builds the text of a tile type file from its frontmatter lines. */
export function buildTypeText(frontmatterLines: string[]): string {
  const typeText = `---\n${frontmatterLines.join("\n")}\n---\n\n# Test type\n`;
  return typeText;
}

/** The `simple_event` type of `docs/teselarium_spec.md`, without `additionalProperties`. */
export const SIMPLE_EVENT_TYPE_TEXT = buildTypeText([
  "schema:",
  "  definitions:",
  "    simple_event:",
  "      properties:",
  "        title:",
  "          type: string",
  "        date:",
  "          type: string",
  "  ref: simple_event",
]);

/** A tile as `loadTile` would return it, with an empty body and no types. */
export function buildTestTile(source: string, metadata: Metadata): Tile {
  const tile: Tile = { source, metadata, body: "", types: [] };
  return tile;
}

/** Metadata with every required field of the sample book type, and no optional one. */
export function buildBookMetadata(): Metadata {
  const bookMetadata: Metadata = {
    title: "Fahrenheit 451",
    date: "1953-10-19",
    authors: ["Ray Bradbury"],
    country: "United States",
    genres: ["Dystopian", "Science fiction"],
  };
  return bookMetadata;
}

/** A book tile without one of its required fields. */
export function buildBookTileWithout(source: string, fieldName: string): Tile {
  const metadata = buildBookMetadata();
  delete metadata[fieldName];
  return buildTestTile(source, metadata);
}
