import type { CaseContext, ModTile } from "../../mod_api.d.ts";
import {
  isImageAddress,
  isTileAddress,
  isWebAddress,
} from "../src/metadata_addresses.ts";
import { readTileHeading } from "../src/tile_heading.ts";

// The pure modules, called directly: a tile in, its heading out, and an
// address in, what it is out.

function buildTile(source: string, metadata: ModTile["metadata"]): ModTile {
  const tile: ModTile = { source, metadata, body: "", types: [] };
  return tile;
}

export function headsWithTitle(context: CaseContext): void {
  const tile = buildTile("https://example.org/books/kallocain.md", {
    title: "Kallocain",
  });

  context.expect(readTileHeading(tile)).toBe("Kallocain");
}

export function headsWithFileName(context: CaseContext): void {
  const tile = buildTile("https://example.org/notes/reading_list.md", {});

  context.expect(readTileHeading(tile)).toBe("reading_list.md");
}

export function headsWithFileNameForOtherTitles(context: CaseContext): void {
  const source = "https://example.org/notes/reading_list.md";

  context
    .expect(readTileHeading(buildTile(source, { title: "" })))
    .toBe("reading_list.md");
  context
    .expect(readTileHeading(buildTile(source, { title: 1984 })))
    .toBe("reading_list.md");
}

export function headsWithDecodedFileName(context: CaseContext): void {
  const tile = buildTile("https://example.org/notes/caf%C3%A9.md", {});

  context.expect(readTileHeading(tile)).toBe("café.md");
}

export function tellsWebAddresses(context: CaseContext): void {
  context
    .expect(isWebAddress("https://example.org/books/kallocain"))
    .toBe(true);
  context.expect(isWebAddress("http://example.org/")).toBe(true);
  context.expect(isWebAddress("ftp://example.org/a.md")).toBe(false);
  context.expect(isWebAddress("mailto:someone@example.org")).toBe(false);
  context.expect(isWebAddress("./kallocain.md")).toBe(false);
  context.expect(isWebAddress("Karin Boye")).toBe(false);
}

export function tellsImageAddresses(context: CaseContext): void {
  context
    .expect(
      isImageAddress("https://media.example.net/covers/Kallocain.JPG?w=200"),
    )
    .toBe(true);
  context
    .expect(isImageAddress("https://media.example.net/covers/a.webp#top"))
    .toBe(true);
  context.expect(isImageAddress("https://example.org/a.svg")).toBe(true);
  context.expect(isImageAddress("https://example.org/a.png.html")).toBe(false);
  context
    .expect(isImageAddress("https://example.org/?image=a.png"))
    .toBe(false);
  context.expect(isImageAddress("./cover.jpg")).toBe(false);
}

export function tellsTileAddresses(context: CaseContext): void {
  context.expect(isTileAddress("https://example.org/a.md?raw=1")).toBe(true);
  context.expect(isTileAddress("https://example.org/NOTES/A.MD")).toBe(true);
  context
    .expect(isTileAddress("https://example.org/readme.md.html"))
    .toBe(false);
  context.expect(isTileAddress("https://example.org/a.markdown")).toBe(false);
  context.expect(isTileAddress("./a.md")).toBe(false);
}
