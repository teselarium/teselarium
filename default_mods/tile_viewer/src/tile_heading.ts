// Pure: a tile in, its heading out. The heading is the tile's `title` when
// it is a non-empty string, and otherwise the file name of its source,
// decoded. The same few lines of decoding as the collection viewer's labels:
// each default mod is one bundle (design.md of add-collection-explorer,
// decision 6).

import type { ModTile } from "../../mod_api.d.ts";

/** The last non-empty path segment of an address, still encoded, or the address without one. */
function readFileName(address: string): string {
  const path = URL.canParse(address) ? new URL(address).pathname : address;
  let fileName = address;
  for (const segment of path.split("/")) {
    if (segment !== "") {
      fileName = segment;
    }
  }
  return fileName;
}

/** A path segment decoded, or as it is when it is not valid percent-encoding. */
function decodeSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded;
  } catch {
    return segment;
  }
}

/** The tile's heading: its `title`, or the decoded file name of its source. */
export function readTileHeading(tile: ModTile): string {
  const title = tile.metadata.title;
  if (typeof title === "string" && title !== "") {
    return title;
  }
  return decodeSegment(readFileName(tile.source));
}
