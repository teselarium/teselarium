import { describe, expect, it } from "vitest";
import {
  buildCollectionChoice,
  buildModChoice,
  buildMosaicChoice,
  buildPairChoice,
  buildSitesDrop,
  isCombinationSandbox,
  NO_COLLECTION,
} from "./combination_links.ts";
import type { SandboxLink } from "./stage_controller.ts";

const MAP_MOD = "https://example.org/mods/country_map/mod_conf.yaml";
const BOOK_MOD = "https://example.org/mods/book_list/mod_conf.yaml";
const LAUREATES = "https://example.org/tiles/laureates/collection.yaml";
const BOOKS = "https://example.org/tiles/books/collection.yaml";
const TILE = "https://example.org/tiles/laureates/2016__bob_dylan.md";
const MAP_MOSAIC = "https://example.org/mosaics/nobel_laureates_map.yaml";
const BOOKS_MOSAIC = "https://example.org/mosaics/nobel_books.yaml";

function buildLink(fields: Partial<SandboxLink>): SandboxLink {
  const link: SandboxLink = {
    mod: MAP_MOD,
    collection: null,
    tile: null,
    mosaic: null,
    sites: null,
    params: {},
    ...fields,
  };
  return link;
}

const MOSAIC_LINK = buildLink({
  collection: LAUREATES,
  mosaic: MAP_MOSAIC,
  params: { zoom: "2" },
});

describe("buildModChoice", function describeBuildModChoice(): void {
  it("keeps the collection and drops the other params", function keepsCollection(): void {
    const link = buildLink({ collection: LAUREATES, params: { zoom: "2" } });

    expect(buildModChoice(link, BOOK_MOD)).toEqual({
      mod: BOOK_MOD,
      collection: LAUREATES,
      tile: null,
      sites: null,
      params: {},
    });
  });

  it("keeps the tile", function keepsTile(): void {
    const link = buildLink({ tile: TILE });

    expect(buildModChoice(link, BOOK_MOD)).toMatchObject({
      collection: null,
      tile: TILE,
    });
  });

  it("Book List on the laureates' map data: the mosaic becomes sites", function keepsMosaicAsSites(): void {
    expect(buildModChoice(MOSAIC_LINK, BOOK_MOD)).toEqual({
      mod: BOOK_MOD,
      collection: LAUREATES,
      tile: null,
      sites: MAP_MOSAIC,
      params: {},
    });
  });

  it("keeps the sites of a sites link", function keepsSites(): void {
    const link = buildLink({
      mod: BOOK_MOD,
      collection: LAUREATES,
      sites: MAP_MOSAIC,
    });

    expect(buildModChoice(link, MAP_MOD)).toMatchObject({ sites: MAP_MOSAIC });
  });

  it("gives null for the current mod", function ignoresCurrent(): void {
    expect(buildModChoice(MOSAIC_LINK, MAP_MOD)).toBeNull();
  });
});

describe("buildCollectionChoice", function describeBuildCollectionChoice(): void {
  it("Other collection for the same mod: keeps the mod and params, drops sites", function dropsSites(): void {
    const link = buildLink({
      mod: BOOK_MOD,
      collection: LAUREATES,
      sites: MAP_MOSAIC,
      params: { sort: "year" },
    });

    expect(buildCollectionChoice(link, BOOKS)).toEqual({
      mod: BOOK_MOD,
      collection: BOOKS,
      tile: null,
      params: { sort: "year" },
    });
  });

  it("opens a mosaic's mod with another collection, without the mosaic", function leavesMosaic(): void {
    expect(buildCollectionChoice(MOSAIC_LINK, BOOKS)).toEqual({
      mod: MAP_MOD,
      collection: BOOKS,
      tile: null,
      params: { zoom: "2" },
    });
  });

  it("None: the same mod without a collection", function choosesNone(): void {
    const link = buildLink({ collection: LAUREATES });

    expect(buildCollectionChoice(link, NO_COLLECTION)).toEqual({
      mod: MAP_MOD,
      collection: null,
      tile: null,
      params: {},
    });
  });

  it("replaces a tile with a collection or None", function replacesTile(): void {
    const link = buildLink({ tile: TILE });

    expect(buildCollectionChoice(link, LAUREATES)).toMatchObject({
      collection: LAUREATES,
      tile: null,
    });
    expect(buildCollectionChoice(link, NO_COLLECTION)).toMatchObject({
      collection: null,
      tile: null,
    });
  });

  it("gives null for the current collection, or None without one", function ignoresCurrent(): void {
    expect(buildCollectionChoice(MOSAIC_LINK, LAUREATES)).toBeNull();
    expect(buildCollectionChoice(buildLink({}), NO_COLLECTION)).toBeNull();
  });
});

describe("buildMosaicChoice", function describeBuildMosaicChoice(): void {
  it("Other combination: that mosaic, with no other params", function opensMosaic(): void {
    expect(buildMosaicChoice(MOSAIC_LINK, BOOKS_MOSAIC)).toEqual({
      mod: "",
      collection: null,
      tile: null,
      mosaic: BOOKS_MOSAIC,
      params: {},
    });
  });

  it("gives null for the current mosaic", function ignoresCurrent(): void {
    expect(buildMosaicChoice(MOSAIC_LINK, MAP_MOSAIC)).toBeNull();
  });
});

describe("buildPairChoice", function describeBuildPairChoice(): void {
  it("Back to a tried pair: its mod with its collection, with no mosaic, sites or params", function opensPair(): void {
    const choice = buildPairChoice(BOOK_MOD, BOOKS);

    expect(choice).toEqual({
      mod: BOOK_MOD,
      collection: BOOKS,
      tile: null,
      params: {},
    });
    expect(choice).not.toHaveProperty("mosaic");
    expect(choice).not.toHaveProperty("sites");
  });
});

describe("buildSitesDrop", function describeBuildSitesDrop(): void {
  it("Stop using them: the same combination and params, without sites", function dropsSites(): void {
    const link = buildLink({
      mod: BOOK_MOD,
      collection: BOOKS,
      sites: BOOKS_MOSAIC,
      params: { sort: "year" },
    });

    expect(buildSitesDrop(link)).toEqual({
      mod: BOOK_MOD,
      collection: BOOKS,
      tile: null,
      params: { sort: "year" },
    });
  });
});

describe("isCombinationSandbox", function describeIsCombinationSandbox(): void {
  it("holds a mosaic, a collection or a tile link", function acceptsCombinations(): void {
    expect(isCombinationSandbox(MOSAIC_LINK, [])).toBe(true);
    expect(isCombinationSandbox(buildLink({ collection: BOOKS }), [])).toBe(
      true,
    );
    expect(isCombinationSandbox(buildLink({ tile: TILE }), [])).toBe(true);
  });

  it("Catalog mod without a collection", function acceptsKnownMod(): void {
    expect(isCombinationSandbox(buildLink({}), [BOOK_MOD, MAP_MOD])).toBe(true);
  });

  it("Mod viewer: a mod no list holds, without a collection", function rejectsOthers(): void {
    const link = buildLink({ params: { target: BOOK_MOD } });

    expect(isCombinationSandbox(link, [BOOK_MOD])).toBe(false);
  });
});
