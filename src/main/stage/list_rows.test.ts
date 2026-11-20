import { describe, expect, it, vi } from "vitest";
import {
  buildCountKey,
  buildMosaicCountKey,
} from "../../lib/core/combinations/index.ts";
import type {
  CollectionSummary,
  CombinationSnapshot,
  Loadable,
  ModSummary,
  MosaicSummary,
  TileCount,
} from "../../lib/core/combinations/index.ts";
import type { RunLink } from "../../lib/core/engine/index.ts";
import { NO_COLLECTION } from "../../lib/core/stage/index.ts";
import type { SandboxLink } from "../../lib/core/stage/index.ts";
import type { RecentlyUsedSnapshot } from "../settings/recently_used.ts";
import { buildCollectionListRows } from "./collection_list.ts";
import type {
  CatalogSources,
  ListInputs,
  ListSandbox,
} from "./combination_list_inputs.ts";
import type { CombinationRow, RowActions } from "./combination_rows.ts";
import { buildModListRows } from "./mod_list.ts";
import {
  buildMosaicListRows,
  buildPairHeading,
  CURRENT_PAIR_ID,
} from "./mosaic_list.ts";
import { buildTestScore, listRowTitles } from "./test_rows.ts";

const BASE = "https://example.org/lists/";
const BOOK_LIST = `${BASE}mods/book_list/mod_conf.yaml`;
const FLASHCARDS = `${BASE}mods/flashcards/mod_conf.yaml`;
const COUNTRY_MAP = `${BASE}mods/country_map/mod_conf.yaml`;
const LINKED_MOD = `${BASE}links/atlas/mod_conf.yaml`;
const LAUREATES = `${BASE}tiles/laureates/collection.yaml`;
const BOOKS = `${BASE}tiles/laureate_books/collection.yaml`;
const MAP_MOSAIC = `${BASE}mosaics/nobel_map.yaml`;
const BOOKS_MOSAIC = `${BASE}mosaics/nobel_books.yaml`;
const TILE = `${BASE}tiles/laureates/2016__bob_dylan.md`;

const CATALOG: CatalogSources = {
  mods: [BOOK_LIST, FLASHCARDS, COUNTRY_MAP],
  collections: [LAUREATES, BOOKS],
  mosaics: [MAP_MOSAIC, BOOKS_MOSAIC],
};

function buildLoaded<Value>(value: Value): Loadable<Value> {
  const loaded: Loadable<Value> = { state: "loaded", value };
  return loaded;
}

function buildMod(source: string, title: string): Loadable<ModSummary> {
  return buildLoaded({ source, title, version: "1.0.0", typeSource: null });
}

function buildCollection(
  source: string,
  title: string,
): Loadable<CollectionSummary> {
  return buildLoaded({ source, title, tileCount: 17 });
}

function buildMosaic(
  source: string,
  title: string,
  mod: string,
  collection: string | null,
  aliases: Record<string, string[]>,
): Loadable<MosaicSummary> {
  return buildLoaded({ source, title, mod, collection, aliases });
}

function buildCount(matching: number, total: number): Loadable<TileCount> {
  return buildLoaded({ matching, total, isUntyped: false });
}

/** The catalog's summaries and some scores, as after the lists' loads. */
function buildSnapshot(
  counts: Record<string, Loadable<TileCount>> = {},
): CombinationSnapshot {
  const snapshot: CombinationSnapshot = {
    listing: null,
    mods: {
      [BOOK_LIST]: buildMod(BOOK_LIST, "Book List"),
      [FLASHCARDS]: buildMod(FLASHCARDS, "Flashcards"),
      [COUNTRY_MAP]: buildMod(COUNTRY_MAP, "Country Map"),
      [LINKED_MOD]: { state: "failed", reason: "HTTP 404" },
    },
    collections: {
      [LAUREATES]: buildCollection(
        LAUREATES,
        "Nobel Prize in Literature laureates",
      ),
      [BOOKS]: buildCollection(
        BOOKS,
        "Nobel Prize in Literature laureates books",
      ),
    },
    mosaics: {
      [MAP_MOSAIC]: buildMosaic(
        MAP_MOSAIC,
        "Nobel laureates on the map",
        COUNTRY_MAP,
        LAUREATES,
        { title: ["name"], country: ["birth_country"] },
      ),
      [BOOKS_MOSAIC]: buildMosaic(
        BOOKS_MOSAIC,
        "Books by Nobel laureates",
        BOOK_LIST,
        BOOKS,
        {},
      ),
    },
    counts,
  };
  return snapshot;
}

function buildRecent(
  overrides: Partial<RecentlyUsedSnapshot> = {},
): RecentlyUsedSnapshot {
  const recent: RecentlyUsedSnapshot = {
    mods: [],
    collections: [],
    mosaics: [],
    combinations: [],
    ...overrides,
  };
  return recent;
}

function buildLink(overrides: Partial<SandboxLink>): SandboxLink {
  const link: SandboxLink = {
    mod: FLASHCARDS,
    collection: LAUREATES,
    tile: null,
    mosaic: null,
    sites: null,
    params: {},
    ...overrides,
  };
  return link;
}

function buildSandbox(link: SandboxLink, modTitle: string): ListSandbox {
  const sandbox: ListSandbox = {
    link,
    mod: { source: link.mod, title: modTitle, version: "1.0.0" },
    collectionTitle:
      link.collection === LAUREATES
        ? "Nobel Prize in Literature laureates"
        : null,
    mosaic: null,
  } as ListSandbox;
  return sandbox;
}

interface BuiltInputs {
  inputs: ListInputs;
  choose: ReturnType<typeof vi.fn<(link: RunLink | null) => void>>;
}

function buildInputs(
  sandbox: ListSandbox,
  snapshot: CombinationSnapshot = buildSnapshot(),
  recent: RecentlyUsedSnapshot = buildRecent(),
): BuiltInputs {
  const choose = vi.fn<(link: RunLink | null) => void>();
  const actions: RowActions = { choose, remove: vi.fn<RowActions["remove"]>() };
  const inputs: ListInputs = {
    catalog: CATALOG,
    sandbox,
    snapshot,
    recent,
    actions,
  };
  const built = { inputs, choose };
  return built;
}

function findRow(rows: readonly CombinationRow[], id: string): CombinationRow {
  for (const row of rows) {
    if (row.id === id) {
      return row;
    }
  }
  throw new Error(`Expected a row with the id ${id}`);
}

/** A Flashcards sandbox on the laureates, from a run link. */
function buildFlashcardsSandbox(): ListSandbox {
  return buildSandbox(buildLink({}), "Flashcards");
}

/** The country map run from "Nobel laureates on the map". */
function buildMapMosaicSandbox(): ListSandbox {
  const sandbox = buildSandbox(
    buildLink({ mod: COUNTRY_MAP, mosaic: MAP_MOSAIC }),
    "Country Map",
  );
  return {
    ...sandbox,
    mosaic: { title: "Nobel laureates on the map" },
  } as ListSandbox;
}

describe("buildModListRows", function describeBuildModListRows(): void {
  it("Vanilla mod list: the catalog's mods, the current one with the dot, and scores without aliases", function listsMods(): void {
    const { inputs } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({
        [buildCountKey(FLASHCARDS, LAUREATES)]: buildCount(0, 17),
      }),
    );

    const rows = buildModListRows(inputs);

    expect(listRowTitles(rows.entries)).toEqual([
      "Book List",
      "Flashcards",
      "Country Map",
    ]);
    expect(rows.pinnedRows).toEqual([]);
    const flashcards = findRow(rows.entries, FLASHCARDS);
    expect(flashcards.mark).toBe("current");
    expect(flashcards.score).toEqual(buildTestScore(0, 17));
    expect(findRow(rows.entries, BOOK_LIST).score).toEqual({
      state: "loading",
    });
    expect(findRow(rows.entries, BOOK_LIST).mark).toBeNull();
  });

  it("Open Country Map's page: its mosaic with aliases, then Without a mosaic without them", function buildsPage(): void {
    const { inputs, choose } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({
        [buildCountKey(COUNTRY_MAP, LAUREATES)]: buildCount(0, 17),
        [buildMosaicCountKey(MAP_MOSAIC)]: buildCount(17, 17),
      }),
    );

    const countryMap = findRow(buildModListRows(inputs).entries, COUNTRY_MAP);

    expect(countryMap.mosaics).toEqual({ count: 1, matching: null });
    const options = countryMap.options ?? [];
    expect(listRowTitles(options)).toEqual([
      "Nobel laureates on the map",
      "Without a mosaic",
    ]);
    expect(options[0].mosaics).toBe("icon");
    expect(options[0].score).toEqual(buildTestScore(17, 17));
    expect(options[0].details).toEqual([
      "title <- name",
      "country <- birth_country",
    ]);
    expect(options[1].score).toEqual(buildTestScore(0, 17));
    expect(options[1].searchText).toBe("Country Map");
    options[1].onChoose();
    expect(choose).toHaveBeenLastCalledWith({
      mod: COUNTRY_MAP,
      collection: LAUREATES,
      tile: null,
      sites: null,
      params: {},
    });
    options[0].onChoose();
    expect(choose).toHaveBeenLastCalledWith(
      expect.objectContaining({ mosaic: MAP_MOSAIC }),
    );
  });

  it("Entry without mosaics: chosen directly, with no page", function choosesDirectly(): void {
    const { inputs, choose } = buildInputs(buildFlashcardsSandbox());

    const bookList = findRow(buildModListRows(inputs).entries, BOOK_LIST);
    bookList.onChoose();

    expect(bookList.options).toBeNull();
    expect(bookList.mosaics).toBeNull();
    expect(choose).toHaveBeenCalledWith(
      expect.objectContaining({ mod: BOOK_LIST, collection: LAUREATES }),
    );
  });

  it("Current mosaic's page: the mosaic marked current, and no Without a mosaic", function leavesOutWithout(): void {
    const { inputs } = buildInputs(buildMapMosaicSandbox());

    const countryMap = findRow(buildModListRows(inputs).entries, COUNTRY_MAP);

    expect(countryMap.mark).toBe("current");
    expect(listRowTitles(countryMap.options ?? [])).toEqual([
      "Nobel laureates on the map",
    ]);
    expect(countryMap.options?.[0].mark).toBe("current");
  });

  it("Mod from a link: listed with the ring, and a failed one apart with Remove", function marksTried(): void {
    const tried = `${BASE}links/globe/mod_conf.yaml`;
    const { inputs } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot(),
      buildRecent({ mods: [tried, LINKED_MOD, BOOK_LIST] }),
    );

    const rows = buildModListRows(inputs);

    expect(findRow(rows.entries, tried).mark).toBe("tried");
    expect(findRow(rows.entries, BOOK_LIST).mark).toBeNull();
    expect(listRowTitles(rows.failedRows)).toEqual([LINKED_MOD]);
    expect(rows.failedRows[0].onRemove).not.toBeNull();
  });

  it("Mod outside the catalog: the current mod is listed with the dot", function listsCurrent(): void {
    const sandbox = buildSandbox(
      buildLink({ mod: `${BASE}x/mod_conf.yaml` }),
      "X",
    );
    const { inputs } = buildInputs(sandbox);

    const rows = buildModListRows(inputs);

    expect(rows.entries.at(-1)?.title).toBe("X");
    expect(rows.entries.at(-1)?.mark).toBe("current");
  });

  it("gives no score and no mosaics without a collection or with a tile", function skipsScores(): void {
    const none = buildInputs(
      buildSandbox(buildLink({ collection: null }), "Flashcards"),
    );
    const tile = buildInputs(
      buildSandbox(buildLink({ collection: null, tile: TILE }), "Flashcards"),
    );

    expect(
      findRow(buildModListRows(none.inputs).entries, BOOK_LIST).score,
    ).toBeNull();
    expect(
      findRow(buildModListRows(tile.inputs).entries, COUNTRY_MAP).options,
    ).toBeNull();
  });
});

describe("buildCollectionListRows", function describeBuildCollectionListRows(): void {
  it("Badge in the collection list: a sandbox of Country Map without a collection", function marksMosaics(): void {
    const sandbox = buildSandbox(
      buildLink({ mod: COUNTRY_MAP, collection: null }),
      "Country Map",
    );
    const { inputs } = buildInputs(sandbox);

    const rows = buildCollectionListRows(inputs);

    expect(listRowTitles(rows.pinnedRows)).toEqual(["None"]);
    expect(rows.pinnedRows[0].mark).toBe("current");
    const laureates = findRow(rows.entries, LAUREATES);
    expect(laureates.mosaics).toEqual({ count: 1, matching: null });
    expect(listRowTitles(laureates.options ?? [])).toEqual([
      "Nobel laureates on the map",
      "Without a mosaic",
    ]);
    expect(findRow(rows.entries, BOOKS).options).toBeNull();
  });

  it("Tile link: the tile, current and not selectable, then None", function pinsTile(): void {
    const sandbox = buildSandbox(
      buildLink({ collection: null, tile: TILE }),
      "Flashcards",
    );
    const { inputs } = buildInputs(sandbox);

    const rows = buildCollectionListRows(inputs);

    expect(listRowTitles(rows.pinnedRows)).toEqual([
      "2016__bob_dylan.md",
      "None",
    ]);
    expect(rows.pinnedRows[0]).toMatchObject({
      mark: "current",
      isSelectable: false,
    });
    expect(rows.pinnedRows[1].mark).toBeNull();
  });

  it("None: opens the current mod without a collection", function choosesNone(): void {
    const { inputs, choose } = buildInputs(buildFlashcardsSandbox());

    const none = findRow(
      buildCollectionListRows(inputs).pinnedRows,
      NO_COLLECTION,
    );
    none.onChoose();

    expect(choose).toHaveBeenCalledWith(
      expect.objectContaining({ mod: FLASHCARDS, collection: null }),
    );
  });

  it("scores the current mod on each collection", function scoresCollections(): void {
    const { inputs } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({ [buildCountKey(FLASHCARDS, BOOKS)]: buildCount(3, 3) }),
    );

    const rows = buildCollectionListRows(inputs);

    expect(findRow(rows.entries, BOOKS).score).toEqual(buildTestScore(3, 3));
    expect(findRow(rows.entries, LAUREATES).mark).toBe("current");
  });
});

describe("buildMosaicListRows", function describeBuildMosaicListRows(): void {
  it("Current unsaved pair: pinned first, current, with its pair and its score without aliases", function pinsCurrentPair(): void {
    const { inputs, choose } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({
        [buildCountKey(FLASHCARDS, LAUREATES)]: buildCount(0, 17),
      }),
    );

    const rows = buildMosaicListRows(inputs);

    expect(rows.pinnedRows).toHaveLength(1);
    const pinned = rows.pinnedRows[0];
    expect(pinned).toMatchObject({
      id: CURRENT_PAIR_ID,
      title: "Unsaved combination",
      details: ["Flashcards + Nobel Prize in Literature laureates"],
      mark: "current",
      mosaics: null,
      score: buildTestScore(0, 17),
    });
    pinned.onChoose();
    expect(choose).toHaveBeenCalledWith(null);
  });

  it("Badge in the mosaic list: each mosaic has the icon, and its score with aliases", function marksMosaics(): void {
    const { inputs } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({ [buildMosaicCountKey(MAP_MOSAIC)]: buildCount(17, 17) }),
    );

    const rows = buildMosaicListRows(inputs);

    const map = findRow(rows.entries, MAP_MOSAIC);
    expect(map.mosaics).toBe("icon");
    expect(map.score).toEqual(buildTestScore(17, 17));
    expect(map.details).toEqual([
      "Country Map + Nobel Prize in Literature laureates",
    ]);
    expect(map.pair).toEqual({
      isCurrentPair: false,
      hasCurrentMod: false,
      hasCurrentCollection: true,
    });
  });

  it("Alias summary: a mosaic of the current pair says its aliases, and no row is pinned", function describesAliases(): void {
    const { inputs } = buildInputs(buildMapMosaicSandbox());

    const rows = buildMosaicListRows(inputs);

    expect(rows.pinnedRows).toEqual([]);
    const map = findRow(rows.entries, MAP_MOSAIC);
    expect(map.mark).toBe("current");
    expect(map.pair?.isCurrentPair).toBe(true);
    expect(map.details).toEqual(["title <- name", "country <- birth_country"]);
    expect(findRow(rows.entries, BOOKS_MOSAIC).details).toEqual([
      "Book List + Nobel Prize in Literature laureates books",
    ]);
  });

  it("Tried pair: an Unsaved combination with the ring, chosen as its pair, and not the pinned one twice", function listsTriedPairs(): void {
    const { inputs, choose } = buildInputs(
      buildFlashcardsSandbox(),
      buildSnapshot({ [buildCountKey(BOOK_LIST, BOOKS)]: buildCount(3, 3) }),
      buildRecent({
        combinations: [
          { mod: FLASHCARDS, collection: LAUREATES },
          { mod: BOOK_LIST, collection: BOOKS },
        ],
      }),
    );

    const rows = buildMosaicListRows(inputs);
    const tried = rows.entries.filter(isUnsavedCombination);

    expect(tried).toHaveLength(1);
    expect(tried[0]).toMatchObject({
      details: ["Book List + Nobel Prize in Literature laureates books"],
      searchText: "Book List + Nobel Prize in Literature laureates books",
      mark: "tried",
      mosaics: null,
      score: buildTestScore(3, 3),
    });
    tried[0].onChoose();
    expect(choose).toHaveBeenCalledWith({
      mod: BOOK_LIST,
      collection: BOOKS,
      tile: null,
      params: {},
    });
  });

  it("names the pair group after the sandbox's mod and collection, or None", function buildsHeading(): void {
    expect(buildPairHeading(buildFlashcardsSandbox())).toBe(
      "For Flashcards + Nobel Prize in Literature laureates",
    );
    expect(
      buildPairHeading(
        buildSandbox(buildLink({ collection: null }), "Flashcards"),
      ),
    ).toBe("For Flashcards + None");
  });
});

function isUnsavedCombination(row: CombinationRow): boolean {
  return row.title === "Unsaved combination";
}
