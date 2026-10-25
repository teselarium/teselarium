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
        params: {},
      },
    });
  });

  it("Link without a collection", function readsModOnly(): void {
    const route = readAppRoute(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);

    expect(route).toEqual({
      page: "run",
      link: { mod: SAMPLE_MOD_REFERENCE, collection: null, params: {} },
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
        params: { target: SAMPLE_MOD_SOURCE },
      },
    });
  });

  it("reads an empty collection as no collection", function readsEmptyCollection(): void {
    const route = readAppRoute("#/run?mod=mod_viewer&collection=");

    expect(route).toEqual({
      page: "run",
      link: { mod: "mod_viewer", collection: null, params: {} },
    });
  });

  it("gives home for an empty mod", function readsEmptyMod(): void {
    expect(readAppRoute("#/run?mod=&collection=./c.yaml")).toEqual({
      page: "home",
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

  it("gives the link back when read", function roundTrips(): void {
    const links: RunLink[] = [
      { mod: "mod_viewer", collection: null, params: {} },
      {
        mod: SAMPLE_MOD_SOURCE,
        collection: "https://example.org/a b&c.yaml",
        params: { target: "x=y&z", "odd key": "é" },
      },
    ];

    for (const link of links) {
      expect(readAppRoute(buildRunLink(link))).toEqual({ page: "run", link });
    }
  });
});
