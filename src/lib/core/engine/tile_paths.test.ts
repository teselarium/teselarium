import { describe, expect, it } from "vitest";
import type { YamlMapping } from "../../files/index.ts";
import type { Tile } from "../../tile/index.ts";
import { resolveTilePaths } from "./tile_paths.ts";

const TILE_SOURCE = "https://example.org/books/kallocain.md";

function buildTile(
  metadata: YamlMapping,
  source: string = TILE_SOURCE,
  body: string = "",
): Tile {
  const tile: Tile = { source, metadata, body, types: ["book"] };
  return tile;
}

describe("resolveTilePaths", function describeResolveTilePaths(): void {
  it("Image next to the tile", function resolvesSiblingPath(): void {
    const resolved = resolveTilePaths(buildTile({ image: "./cover.jpg" }));

    expect(resolved.metadata.image).toBe("https://example.org/books/cover.jpg");
  });

  it("Path to a parent folder", function resolvesParentPath(): void {
    const resolved = resolveTilePaths(
      buildTile({ image: "../covers/kallocain.jpg" }),
    );

    expect(resolved.metadata.image).toBe(
      "https://example.org/covers/kallocain.jpg",
    );
  });

  it("Strings in lists and nested mappings", function resolvesNestedStrings(): void {
    const resolved = resolveTilePaths(
      buildTile({
        gallery: ["./front.jpg", "./back.jpg"],
        editions: [{ year: 1940, cover: "./first.jpg" }],
      }),
    );

    expect(resolved.metadata.gallery).toEqual([
      "https://example.org/books/front.jpg",
      "https://example.org/books/back.jpg",
    ]);
    expect(resolved.metadata.editions).toEqual([
      { year: 1940, cover: "https://example.org/books/first.jpg" },
    ]);
  });

  it("Strings without the marker are left as written", function keepsUnmarkedStrings(): void {
    const metadata: YamlMapping = {
      link: "/r/books",
      file: "cover.jpg",
      image:
        "https://upload.wikimedia.org/wikipedia/en/a/ab/KallocainCover.jpg",
      title: "Kallocain",
    };

    const resolved = resolveTilePaths(buildTile(metadata));

    expect(resolved.metadata).toEqual(metadata);
  });

  it("Values that are not strings and keys are left as written", function keepsOtherValuesAndKeys(): void {
    const resolved = resolveTilePaths(
      buildTile({
        pages: 156,
        read: true,
        series: null,
        covers: { "./front.jpg": "./front.jpg" },
      }),
    );

    expect(resolved.metadata.pages).toBe(156);
    expect(resolved.metadata.read).toBe(true);
    expect(resolved.metadata.series).toBeNull();
    expect(resolved.metadata.covers).toEqual({
      "./front.jpg": "https://example.org/books/front.jpg",
    });
  });

  it("Tile picked from the user's computer", function resolvesAgainstFileSource(): void {
    const resolved = resolveTilePaths(
      buildTile({ image: "./cover.jpg" }, "file:///library/books/kallocain.md"),
    );

    expect(resolved.metadata.image).toBe("file:///library/books/cover.jpg");
  });

  it("Body is not resolved", function keepsBody(): void {
    const tile = buildTile(
      { image: "./cover.jpg" },
      TILE_SOURCE,
      "![Cover](./cover.jpg)",
    );

    const resolved = resolveTilePaths(tile);

    expect(resolved.body).toBe("![Cover](./cover.jpg)");
    expect(resolved.source).toBe(TILE_SOURCE);
    expect(resolved.types).toEqual(["book"]);
  });

  it("resolves the marker alone to the tile's folder", function resolvesMarkerAlone(): void {
    const resolved = resolveTilePaths(buildTile({ folder: "./" }));

    expect(resolved.metadata.folder).toBe("https://example.org/books/");
  });

  it("leaves a marker after a leading space as written", function keepsLeadingSpace(): void {
    const resolved = resolveTilePaths(buildTile({ note: " ./x" }));

    expect(resolved.metadata.note).toBe(" ./x");
  });

  it("leaves a path as written when the source cannot be a base", function keepsPathWithoutBase(): void {
    const resolved = resolveTilePaths(
      buildTile({ image: "./cover.jpg" }, "data:text/markdown,kallocain"),
    );

    expect(resolved.metadata.image).toBe("./cover.jpg");
  });

  it("leaves the input tile unchanged", function keepsInputTile(): void {
    const tile = buildTile({
      image: "./cover.jpg",
      gallery: ["./front.jpg"],
      editions: [{ cover: "./first.jpg" }],
    });
    const before = structuredClone(tile);

    const resolved = resolveTilePaths(tile);

    expect(tile).toEqual(before);
    expect(resolved.types).not.toBe(tile.types);
  });

  it("returns plain data that survives a structured clone", function returnsPlainData(): void {
    const resolved = resolveTilePaths(
      buildTile({
        image: "./cover.jpg",
        editions: [{ year: 1940, cover: "./first.jpg" }],
      }),
    );

    expect(structuredClone(resolved)).toEqual(resolved);
  });
});
