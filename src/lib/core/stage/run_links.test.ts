import { describe, expect, it } from "vitest";
import {
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_VIEWER_RUN_HASH,
} from "../../../test/sample_mods.ts";
import type { RunLink } from "../engine/index.ts";
import { buildRunLink, readAppRoute } from "./run_links.ts";

const TILE_SOURCE = "https://example.org/fixtures/tiles/books/kallocain.md";

describe("readAppRoute", function describeReadAppRoute(): void {
  it("Link with a mod and a collection", function readsModAndCollection(): void {
    const route = readAppRoute(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );

    expect(route).toEqual({
      page: "run",
      link: {
        mod: SAMPLE_MOD_REFERENCE,
        collection: SAMPLE_COLLECTION_REFERENCE,
        tile: null,
        params: {},
      },
    });
  });

  it("Link without a collection", function readsModOnly(): void {
    const route = readAppRoute(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);

    expect(route).toEqual({
      page: "run",
      link: {
        mod: SAMPLE_MOD_REFERENCE,
        collection: null,
        tile: null,
        params: {},
      },
    });
  });

  it("Link with a tile", function readsTile(): void {
    const route = readAppRoute(
      `#/run?mod=tile_viewer&tile=${encodeURIComponent(TILE_SOURCE)}`,
    );

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "tile_viewer",
        collection: null,
        tile: TILE_SOURCE,
        params: {},
      },
    });
  });

  it("Tile is not a parameter of the mod", function reservesTile(): void {
    const route = readAppRoute("#/run?mod=tile_viewer&tile=./a.md&from=x");

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "tile_viewer",
        collection: null,
        tile: "./a.md",
        params: { from: "x" },
      },
    });
  });

  it("reads a link with both a collection and a tile as written", function readsBoth(): void {
    const route = readAppRoute(
      "#/run?mod=tile_viewer&collection=./c.yaml&tile=./a.md",
    );

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "tile_viewer",
        collection: "./c.yaml",
        tile: "./a.md",
        params: {},
      },
    });
  });

  it("reads the other params in link order with the first value of a key", function readsParams(): void {
    const route = readAppRoute(
      "#/run?zeta=1&mod=mod_viewer&alpha=2&zeta=3&collection=./c.yaml",
    );

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "mod_viewer",
        collection: "./c.yaml",
        tile: null,
        params: { zeta: "1", alpha: "2" },
      },
    });
    if (route.page === "run") {
      expect(Object.keys(route.link.params)).toEqual(["zeta", "alpha"]);
    }
  });

  it("Encoded values", function readsEncodedValues(): void {
    const route = readAppRoute(
      `#/run?mod=mod_viewer&target=${encodeURIComponent(SAMPLE_MOD_SOURCE)}`,
    );

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "mod_viewer",
        collection: null,
        tile: null,
        params: { target: SAMPLE_MOD_SOURCE },
      },
    });
  });

  it("reads an empty collection or tile as none", function readsEmptyCollection(): void {
    const route = readAppRoute("#/run?mod=mod_viewer&collection=&tile=");

    expect(route).toEqual({
      page: "run",
      link: { mod: "mod_viewer", collection: null, tile: null, params: {} },
    });
  });

  it("gives home for an empty mod", function readsEmptyMod(): void {
    expect(readAppRoute("#/run?mod=&collection=./c.yaml")).toEqual({
      page: "home",
    });
  });

  it("Mosaic link with a parameter", function readsMosaicLink(): void {
    const route = readAppRoute("#/run?mosaic=x&from=y");

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "",
        collection: null,
        tile: null,
        mosaic: "x",
        params: { from: "y" },
      },
    });
  });

  it("Run link with an empty mosaic", function readsEmptyMosaic(): void {
    expect(readAppRoute("#/run?mosaic=")).toEqual({ page: "home" });
  });

  it("Mosaic is not a parameter of the mod", function reservesMosaic(): void {
    const route = readAppRoute("#/run?mod=mod_viewer&mosaic=&from=y");

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "mod_viewer",
        collection: null,
        tile: null,
        params: { from: "y" },
      },
    });
  });

  it("reads a mosaic link with a mod as written", function readsMosaicWithMod(): void {
    const route = readAppRoute("#/run?mosaic=./m.yaml&mod=mod_viewer");

    expect(route).toEqual({
      page: "run",
      link: {
        mod: "mod_viewer",
        collection: null,
        tile: null,
        mosaic: "./m.yaml",
        params: {},
      },
    });
  });

  it("No hash", function readsNoHash(): void {
    expect(readAppRoute("")).toEqual({ page: "home" });
    expect(readAppRoute("#/")).toEqual({ page: "home" });
  });

  it("Unknown hash", function readsUnknownHash(): void {
    expect(readAppRoute("#/mods/view")).toEqual({ page: "home" });
    expect(readAppRoute("#/run")).toEqual({ page: "home" });
    expect(readAppRoute("#/running?mod=mod_viewer")).toEqual({ page: "home" });
  });
});

describe("buildRunLink", function describeBuildRunLink(): void {
  it("writes mod, then collection, then the params, encoded", function buildsLink(): void {
    const runLink = buildRunLink({
      mod: "mod_viewer",
      collection: null,
      params: { target: SAMPLE_MOD_SOURCE },
    });

    expect(runLink).toBe(SAMPLE_VIEWER_RUN_HASH);
  });

  it("writes the collection after the mod", function buildsCollection(): void {
    const runLink = buildRunLink({
      mod: SAMPLE_MOD_REFERENCE,
      collection: SAMPLE_COLLECTION_REFERENCE,
      params: {},
    });

    expect(runLink).toBe(SAMPLE_COLLECTION_RUN_HASH);
  });

  it("writes the tile after the collection, before the params", function buildsTile(): void {
    const runLink = buildRunLink({
      mod: "tile_viewer",
      collection: "./c.yaml",
      tile: "./a.md",
      params: { from: "x" },
    });

    expect(runLink).toBe(
      "#/run?mod=tile_viewer&collection=.%2Fc.yaml&tile=.%2Fa.md&from=x",
    );
  });

  it("writes no tile for a null tile", function buildsNullTile(): void {
    const runLink = buildRunLink({
      mod: "mod_viewer",
      collection: null,
      tile: null,
      params: { target: SAMPLE_MOD_SOURCE },
    });

    expect(runLink).toBe(SAMPLE_VIEWER_RUN_HASH);
  });

  it("writes the mosaic first and no empty mod", function buildsMosaicLink(): void {
    const runLink = buildRunLink({
      mod: "",
      collection: null,
      mosaic: "./samples/mosaics/nobel_map.yaml",
      params: { from: "x" },
    });

    expect(runLink).toBe(
      "#/run?mosaic=.%2Fsamples%2Fmosaics%2Fnobel_map.yaml&from=x",
    );
  });

  it("gives the link back when read", function roundTrips(): void {
    const links: RunLink[] = [
      { mod: "mod_viewer", collection: null, tile: null, params: {} },
      {
        mod: SAMPLE_MOD_SOURCE,
        collection: "https://example.org/a b&c.yaml",
        tile: null,
        params: { target: "x=y&z", "odd key": "é" },
      },
      {
        mod: "tile_viewer",
        collection: null,
        tile: "https://example.org/a b&c.md",
        params: { from: "https://example.org/c.yaml" },
      },
      {
        mod: "",
        collection: null,
        tile: null,
        mosaic: "https://example.org/a b&c/mosaic.yaml",
        params: { from: "y" },
      },
    ];

    for (const link of links) {
      expect(readAppRoute(buildRunLink(link))).toEqual({ page: "run", link });
    }
  });
});
