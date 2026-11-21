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
  CountTarget,
  EntryScore,
  MosaicSummary,
} from "../../lib/core/combinations/index.ts";
import { buildModChoice } from "../../lib/core/stage/index.ts";
import type {
  SandboxLink,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
import type { RecentlyUsedSnapshot } from "../settings/recently_used.ts";
import {
  readCatalogSources,
  readCountTarget,
} from "./combination_list_inputs.ts";
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
} from "./combination_rows.ts";
import type {
  CombinationRow,
  ListedSource,
  ListRows,
  PageInputs,
} from "./combination_rows.ts";

/** What the mod list shows: its mods, the mosaics that may pair them, and what it counts on. */
interface ModListSources {
  mods: ListedSource[];
  mosaics: ListedSource[];
  target: CountTarget | null;
}

function readModListSources(
  catalog: CatalogSources,
  recent: RecentlyUsedSnapshot,
  link: SandboxLink,
): ModListSources {
  const sources: ModListSources = {
    mods: listSources(catalog.mods, recent.mods, link.mod),
    mosaics: listSources(catalog.mosaics, recent.mosaics, null),
    target: readCountTarget(link),
  };
  return sources;
}

/** The loaded mosaics that pair a mod with the sandbox's collection, or none for a tile link. */
function listCollectionMosaics(
  snapshot: CombinationSnapshot,
  mosaicSources: readonly string[],
  link: SandboxLink,
): MosaicSummary[] {
  const mosaics: MosaicSummary[] = [];
  if (link.tile !== null) {
    return mosaics;
  }
  for (const mosaic of readLoadedValues(snapshot.mosaics, mosaicSources)) {
    if (mosaic.collection === link.collection) {
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

/**
 * Starts the loads the mod list shows, those not requested yet: the mod
 * files and mosaic files, each mod's score on the sandbox's collection or
 * tile, and, once the mosaic files are loaded, the scores with aliases of
 * the mosaics on that collection, for the mods' pages. Resolves once they
 * settled. The capsule calls it when its tooltip opens, and the list when
 * it opens.
 */
export async function startModListLoads(
  combinations: CombinationCatalog,
  stage: Stage,
  sandbox: SandboxSnapshot,
  recent: RecentlyUsedSnapshot,
): Promise<void> {
  const link = sandbox.link;
  const sources = readModListSources(
    readCatalogSources(stage, readCombinationSnapshot(combinations).catalog),
    recent,
    link,
  );
  const mosaicSources = readSources(sources.mosaics);
  const loads: Promise<void>[] = [];
  if (sources.target !== null) {
    loads.push(
      requestCounts(combinations, readSources(sources.mods), sources.target),
    );
  }
  await requestSummaries(combinations, {
    mods: readSources(sources.mods),
    mosaics: mosaicSources,
  });
  const pairMosaics = listCollectionMosaics(
    readCombinationSnapshot(combinations),
    mosaicSources,
    link,
  );
  loads.push(requestMosaicCounts(combinations, listMosaicSources(pairMosaics)));
  await Promise.all(loads);
}

/** The mod's title once its file is loaded, the sandbox's own mod title, or its source. */
function readModTitle(inputs: ListInputs, source: string): string {
  const summary = inputs.snapshot.mods[source];
  if (summary?.state === "loaded") {
    return summary.value.title;
  }
  const mod = inputs.sandbox.mod;
  return mod !== null && mod.source === source ? mod.title : source;
}

/** What building the mod list's rows reads, once per list. */
interface ModRowInputs {
  inputs: ListInputs;
  page: PageInputs;
  target: CountTarget | null;
  /** The loaded mosaics on the sandbox's collection. */
  mosaics: readonly MosaicSummary[];
}

function readModScore(rowInputs: ModRowInputs, source: string): EntryScore {
  const target = rowInputs.target;
  if (target === null) {
    return null;
  }
  return readCountScore(
    rowInputs.inputs.snapshot,
    buildCountKey(source, target.source),
  );
}

function buildModRow(
  rowInputs: ModRowInputs,
  entry: ListedSource,
): CombinationRow {
  const { inputs } = rowInputs;
  const link = inputs.sandbox.link;
  const summary = inputs.snapshot.mods[entry.source];
  const isCurrent = entry.source === link.mod;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const title = readModTitle(inputs, entry.source);
  const score = readModScore(rowInputs, entry.source);
  const onChoose = inputs.actions.choose.bind(
    undefined,
    buildModChoice(link, entry.source),
  );
  const mosaics = listPairMosaics(
    rowInputs.mosaics,
    entry.source,
    link.collection,
  );
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
          kind: "mod",
          source: entry.source,
        })
      : null,
  };
  return row;
}

/**
 * The mod list's rows: the catalog's mods, the recently used ones it does
 * not list (the ring), and the current mod (the dot), even when neither
 * holds it. Each scores on the sandbox's collection or tile, without
 * aliases. A mod with mosaics on the sandbox's collection has a page of
 * them, then "Without a mosaic", which opens it with the current collection
 * or tile (`buildModChoice`), as choosing a mod without mosaics does.
 */
export function buildModListRows(inputs: ListInputs): ListRows {
  const link = inputs.sandbox.link;
  const sources = readModListSources(inputs.catalog, inputs.recent, link);
  const rowInputs: ModRowInputs = {
    inputs,
    page: {
      link,
      snapshot: inputs.snapshot,
      triedMosaics: listTriedSources(sources.mosaics),
      actions: inputs.actions,
    },
    target: sources.target,
    mosaics: listCollectionMosaics(
      inputs.snapshot,
      readSources(sources.mosaics),
      link,
    ),
  };
  const entries: CombinationRow[] = [];
  const failedRows: CombinationRow[] = [];
  for (const entry of sources.mods) {
    const row = buildModRow(rowInputs, entry);
    if (row.failure === null) {
      entries.push(row);
    } else {
      failedRows.push(row);
    }
  }
  const rows: ListRows = { pinnedRows: [], entries, failedRows };
  return rows;
}
