import {
  buildCountKey,
  readCombinationSnapshot,
  requestCounts,
  requestMosaicCounts,
  requestSummaries,
} from "../../lib/core/combinations/index.ts";
import type {
  CombinationCatalog,
  CombinationSnapshot,
  EntryScore,
  MosaicSummary,
} from "../../lib/core/combinations/index.ts";
import {
  buildCollectionChoice,
  NO_COLLECTION,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxLink,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
import type { RecentlyUsedSnapshot } from "../settings/recently_used.ts";
import { readCatalogSources } from "./combination_list_inputs.ts";
import type { CatalogSources, ListInputs } from "./combination_list_inputs.ts";
import {
  buildMosaicBadge,
  buildPageOptions,
  listPairMosaics,
  listSources,
  listTriedSources,
  readCountScore,
  readLoadedValues,
  readRowMark,
  readSources,
  readTileName,
} from "./combination_rows.ts";
import type {
  CombinationRow,
  ListedSource,
  ListRows,
  PageInputs,
} from "./combination_rows.ts";

/** What the collection list shows: its collections, and the mosaics that may pair them. */
interface CollectionListSources {
  collections: ListedSource[];
  mosaics: ListedSource[];
}

function readCollectionListSources(
  catalog: CatalogSources,
  recent: RecentlyUsedSnapshot,
  link: SandboxLink,
): CollectionListSources {
  const sources: CollectionListSources = {
    collections: listSources(
      catalog.collections,
      recent.collections,
      link.collection,
    ),
    mosaics: listSources(catalog.mosaics, recent.mosaics, null),
  };
  return sources;
}

/** The loaded mosaics of the current mod with a collection. */
function listModMosaics(
  snapshot: CombinationSnapshot,
  mosaicSources: readonly string[],
  modSource: string,
): MosaicSummary[] {
  const mosaics: MosaicSummary[] = [];
  for (const mosaic of readLoadedValues(snapshot.mosaics, mosaicSources)) {
    if (mosaic.mod === modSource && mosaic.collection !== null) {
      mosaics.push(mosaic);
    }
  }
  return mosaics;
}

function listMosaicSources(mosaics: readonly MosaicSummary[]): string[] {
  const sources: string[] = [];
  for (const mosaic of mosaics) {
    sources.push(mosaic.source);
  }
  return sources;
}

function requestModCounts(
  combinations: CombinationCatalog,
  modSource: string,
  collectionSources: readonly string[],
): Promise<void>[] {
  const loads: Promise<void>[] = [];
  for (const source of collectionSources) {
    loads.push(
      requestCounts(combinations, [modSource], { kind: "collection", source }),
    );
  }
  return loads;
}

/**
 * Starts the loads the collection list shows, those not requested yet: the
 * collection files and mosaic files, the current mod's score on each
 * collection, and, once the mosaic files are loaded, the scores with aliases
 * of the current mod's mosaics, for the collections' pages. Resolves once
 * they settled. Before a mosaic's file gives the mod, nothing is scored.
 */
export async function startCollectionListLoads(
  combinations: CombinationCatalog,
  stage: Stage,
  sandbox: SandboxSnapshot,
  recent: RecentlyUsedSnapshot,
): Promise<void> {
  const link = sandbox.link;
  const sources = readCollectionListSources(
    readCatalogSources(stage, readCombinationSnapshot(combinations).listing),
    recent,
    link,
  );
  const collectionSources = readSources(sources.collections);
  const mosaicSources = readSources(sources.mosaics);
  const loads: Promise<void>[] = [];
  if (link.mod !== "") {
    loads.push(...requestModCounts(combinations, link.mod, collectionSources));
  }
  await requestSummaries(combinations, {
    collections: collectionSources,
    mosaics: mosaicSources,
  });
  if (link.mod !== "") {
    const modMosaics = listModMosaics(
      readCombinationSnapshot(combinations),
      mosaicSources,
      link.mod,
    );
    loads.push(
      requestMosaicCounts(combinations, listMosaicSources(modMosaics)),
    );
  }
  await Promise.all(loads);
}

/** The collection's title once its file is loaded, the sandbox's own collection title, or its source. */
function readCollectionTitle(inputs: ListInputs, source: string): string {
  const summary = inputs.snapshot.collections[source];
  if (summary?.state === "loaded") {
    return summary.value.title;
  }
  const sandbox = inputs.sandbox;
  if (sandbox.link.collection === source && sandbox.collectionTitle !== null) {
    return sandbox.collectionTitle;
  }
  return source;
}

/** What building the collection list's rows reads, once per list. */
interface CollectionRowInputs {
  inputs: ListInputs;
  page: PageInputs;
  /** The loaded mosaics of the current mod. */
  mosaics: readonly MosaicSummary[];
}

function readCollectionScore(inputs: ListInputs, source: string): EntryScore {
  const modSource = inputs.sandbox.link.mod;
  if (modSource === "") {
    return null;
  }
  return readCountScore(inputs.snapshot, buildCountKey(modSource, source));
}

function buildCollectionRow(
  rowInputs: CollectionRowInputs,
  entry: ListedSource,
): CombinationRow {
  const { inputs } = rowInputs;
  const link = inputs.sandbox.link;
  const summary = inputs.snapshot.collections[entry.source];
  const isCurrent = entry.source === link.collection;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const title = readCollectionTitle(inputs, entry.source);
  const score = readCollectionScore(inputs, entry.source);
  const onChoose = inputs.actions.choose.bind(
    undefined,
    buildCollectionChoice(link, entry.source),
  );
  const mosaics = listPairMosaics(rowInputs.mosaics, link.mod, entry.source);
  const row: CombinationRow = {
    id: entry.source,
    title,
    details: [],
    foundMosaics: null,
    mark: readRowMark(isCurrent, entry.isRecent),
    mosaics: buildMosaicBadge(mosaics.length),
    score,
    options: buildPageOptions(
      rowInputs.page,
      { id: entry.source, title, isCurrent, score, onChoose },
      mosaics,
    ),
    searchText: title,
    pair: null,
    isSelectable: failure === null,
    failure,
    onChoose,
    onRemove: entry.isRecent
      ? inputs.actions.remove.bind(undefined, {
          kind: "collection",
          source: entry.source,
        })
      : null,
  };
  return row;
}

function ignoreChoice(): void {
  // The tile row is the current entry, and cannot be chosen.
}

function buildPinnedRow(
  id: string,
  title: string,
  overrides: Pick<CombinationRow, "mark" | "isSelectable" | "onChoose">,
): CombinationRow {
  const row: CombinationRow = {
    id,
    title,
    details: [],
    foundMosaics: null,
    mosaics: null,
    score: null,
    options: null,
    searchText: title,
    pair: null,
    failure: null,
    onRemove: null,
    ...overrides,
  };
  return row;
}

/** For a tile link, the tile, current and not selectable, then "None". */
function buildPinnedRows(inputs: ListInputs): CombinationRow[] {
  const link = inputs.sandbox.link;
  const rows: CombinationRow[] = [];
  if (link.tile !== null) {
    rows.push(
      buildPinnedRow(link.tile, readTileName(link.tile), {
        mark: "current",
        isSelectable: false,
        onChoose: ignoreChoice,
      }),
    );
  }
  const isNoneCurrent = link.collection === null && link.tile === null;
  rows.push(
    buildPinnedRow(NO_COLLECTION, "None", {
      mark: readRowMark(isNoneCurrent, false),
      isSelectable: true,
      onChoose: inputs.actions.choose.bind(
        undefined,
        buildCollectionChoice(link, NO_COLLECTION),
      ),
    }),
  );
  return rows;
}

/**
 * The collection list's rows: pinned, "None", or for a tile link the tile
 * and then "None"; then the catalog's collections, the recently used ones it
 * does not list (the ring), and the current collection (the dot). Each
 * scores the current mod on it, without aliases. A collection with mosaics
 * of the current mod has a page of them, then "Without a mosaic", which
 * opens the current mod with it (`buildCollectionChoice`), as choosing a
 * collection without mosaics does.
 */
export function buildCollectionListRows(inputs: ListInputs): ListRows {
  const link = inputs.sandbox.link;
  const sources = readCollectionListSources(
    inputs.catalog,
    inputs.recent,
    link,
  );
  const rowInputs: CollectionRowInputs = {
    inputs,
    page: {
      link,
      snapshot: inputs.snapshot,
      triedMosaics: listTriedSources(sources.mosaics),
      actions: inputs.actions,
    },
    mosaics: listModMosaics(
      inputs.snapshot,
      readSources(sources.mosaics),
      link.mod,
    ),
  };
  const entries: CombinationRow[] = [];
  const failedRows: CombinationRow[] = [];
  for (const entry of sources.collections) {
    const row = buildCollectionRow(rowInputs, entry);
    if (row.failure === null) {
      entries.push(row);
    } else {
      failedRows.push(row);
    }
  }
  const rows: ListRows = {
    pinnedRows: buildPinnedRows(inputs),
    entries,
    failedRows,
  };
  return rows;
}
