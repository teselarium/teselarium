import type { ModTile } from "../../mod_api.d.ts";
import { buildMetadataSection } from "./metadata_section.ts";
import { buildTileBody } from "./tile_body.ts";
import { readTileHeading } from "./tile_heading.ts";

/**
 * The tile as one card: an `<article>` with its heading and its source in
 * muted text, then, after the theme's separator, its metadata and, after
 * another separator, its body. An empty body gives neither the second
 * separator nor a body.
 */
export function buildTileCard(tile: ModTile): HTMLElement {
  const card = document.createElement("article");
  const heading = document.createElement("h1");
  heading.textContent = readTileHeading(tile);
  const source = document.createElement("small");
  source.textContent = tile.source;
  card.append(
    heading,
    source,
    document.createElement("hr"),
    buildMetadataSection(tile.metadata),
  );
  const body = buildTileBody(tile);
  if (body !== null) {
    card.append(document.createElement("hr"), body);
  }
  return card;
}
