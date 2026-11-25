import { fetchFile, parseMarkdown } from "../files/index.ts";
import type { FileFetchOptions, ParsedMarkdown } from "../files/index.ts";

/** A loaded tile: parsed markdown plus the names of the tile types it was validated against. */
export interface Tile extends ParsedMarkdown {
  types: string[];
}

/**
 * Loads a tile from a path or URL: fetches the file and parses its markdown.
 * A new tile has no types. Raises `FileFetchError` or `MarkdownParseError`.
 */
export async function loadTile(
  location: string,
  options?: FileFetchOptions,
): Promise<Tile> {
  const fetchedFile = await fetchFile(location, options);
  const parsedMarkdown = parseMarkdown(fetchedFile);
  const tile: Tile = {
    source: parsedMarkdown.source,
    metadata: parsedMarkdown.metadata,
    body: parsedMarkdown.body,
    types: [],
  };
  return tile;
}
