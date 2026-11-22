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
import type { RunLink } from "../../lib/core/engine/index.ts";
import { isBrowserFileAddress } from "../../lib/files/index.ts";
import {
  buildMosaicChoice,
  buildPairChoice,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxLink,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
import type {
  RecentCombination,
  RecentlyUsedSnapshot,
} from "../settings/recently_used.ts";
import {
  readCatalogSources,
  readCountTarget,
} from "./combination_list_inputs.ts";
import type {
  CatalogSources,
  ListInputs,
  ListSandbox,
} from "./combination_list_inputs.ts";
import {
  describeMosaicAliases,
  listSources,
  readCountScore,
  readLoadedValues,
  readMosaicScore,
  readRowMark,
  readSources,
  readTileName,
} from "./combination_rows.ts";
import type {
  CombinationRow,
  ListedSource,
  ListRows,
  MosaicPairFacts,
} from "./combination_rows.ts";

/** The title of the mosaic list's rows for mod + collection pairs without a mosaic. */
export const UNSAVED_COMBINATION_TITLE = "Unsaved combination";

/** The id of the pinned row of the sandbox's own unsaved pair. */
export const CURRENT_PAIR_ID = "unsaved-combination";

/** The id of the pinned edit row, above the other pinned rows. */
export const EDIT_ROW_ID = "edit-mosaic";

/** The default mod that edits mosaics. */
const MOSAIC_VIEWER_NAME = "mosaic_viewer";

/** What the edit row does, from the sandbox's link, its label, and what it edits, under the label. */
interface EditRowTarget {
  title: string;
  detail: string;
  params: Record<string, string>;
}

/**
 * The edit row's target (`combination-pickers`, "Edit row links"): "Edit
 * mosaic" for a mosaic stored in this browser, "Edit a copy" for any other
 * mosaic, "Save as mosaic" for a combination with a collection or none, and
 * `null` for a tile link. Every address is the link's resolved one.
 */
function readEditRowTarget(sandbox: ListSandbox): EditRowTarget | null {
  const link = sandbox.link;
  if (link.mosaic !== null) {
    const isStored = isBrowserFileAddress(link.mosaic);
    const mosaicTarget: EditRowTarget = {
      title: isStored ? "Edit mosaic" : "Edit a copy",
      detail: sandbox.mosaic?.title ?? link.mosaic,
      params: { target: link.mosaic, mode: isStored ? "edit" : "copy" },
    };
    return mosaicTarget;
  }
  if (link.tile !== null) {
    return null;
  }
  const params: Record<string, string> = { mode: "new", draft_mod: link.mod };
  if (link.collection !== null) {
    params.draft_collection = link.collection;
  }
  if (link.sites !== null) {
    params.draft_sites = link.sites;
  }
  const newTarget: EditRowTarget = {
    title: "Save as mosaic",
    detail: describeCurrentPair(sandbox),
    params,
  };
  return newTarget;
}

/**
 * The pinned edit row, with the pencil, which opens the mosaic viewer in its
 * mode, or `null` for a tile link. Under its label, what it edits: the
 * mosaic's title, or the pair, so it is as tall as the list's other rows.
 */
function buildEditRow(inputs: ListInputs): CombinationRow | null {
  const target = readEditRowTarget(inputs.sandbox);
  if (target === null) {
    return null;
  }
  const viewerLink: RunLink = {
    mod: MOSAIC_VIEWER_NAME,
    collection: null,
    params: target.params,
  };
  const row: CombinationRow = {
    id: EDIT_ROW_ID,
    title: target.title,
    details: [target.detail],
    foundMosaics: null,
    mark: null,
    mosaics: "edit",
    score: null,
    options: null,
    searchText: target.title,
    pair: null,
    isSelectable: true,
    failure: null,
    onChoose: inputs.actions.openViewer.bind(undefined, viewerLink),
    onRemove: null,
  };
  return row;
}

function readMosaicListSources(
  catalog: CatalogSources,
  recent: RecentlyUsedSnapshot,
  link: SandboxLink,
): ListedSource[] {
  return listSources(catalog.mosaics, recent.mosaics, link.mosaic);
}

/** Whether the sandbox is a pair without a mosaic, shown as the pinned "Unsaved combination". */
function isUnsavedPair(link: SandboxLink): boolean {
  return link.mosaic === null;
}

/** Whether a tried combination is the sandbox's own unsaved pair, which the pinned row shows. */
function isPinnedPair(
  link: SandboxLink,
  combination: RecentCombination,
): boolean {
  return (
    isUnsavedPair(link) &&
    link.tile === null &&
    combination.mod === link.mod &&
    combination.collection === link.collection
  );
}

/** The tried combinations the list shows, without the pinned pair. */
function listTriedCombinations(
  link: SandboxLink,
  recent: RecentlyUsedSnapshot,
): RecentCombination[] {
  const combinations: RecentCombination[] = [];
  for (const combination of recent.combinations) {
    if (!isPinnedPair(link, combination)) {
      combinations.push(combination);
    }
  }
  return combinations;
}

/** The mods and collections whose titles the rows show: those of the loaded mosaics and of the tried combinations. */
function listPairSources(
  mosaics: readonly MosaicSummary[],
  combinations: readonly RecentCombination[],
): { mods: string[]; collections: string[] } {
  const mods: string[] = [];
  const collections: string[] = [];
  for (const mosaic of mosaics) {
    mods.push(mosaic.mod);
    if (mosaic.collection !== null) {
      collections.push(mosaic.collection);
    }
  }
  for (const combination of combinations) {
    mods.push(combination.mod);
    collections.push(combination.collection);
  }
  const sources = { mods, collections };
  return sources;
}

function requestCombinationCounts(
  combinations: CombinationCatalog,
  tried: readonly RecentCombination[],
): Promise<void>[] {
  const loads: Promise<void>[] = [];
  for (const combination of tried) {
    loads.push(
      requestCounts(combinations, [combination.mod], {
        kind: "collection",
        source: combination.collection,
      }),
    );
  }
  return loads;
}

/**
 * Starts the loads the mosaic list shows, those not requested yet: the
 * mosaic files, then the mods' and collections' files for their titles, and
 * the scores: each mosaic's with its aliases, each tried combination's, and
 * the sandbox's own pair's without aliases. Resolves once they settled.
 */
export async function startMosaicListLoads(
  combinations: CombinationCatalog,
  stage: Stage,
  sandbox: SandboxSnapshot,
  recent: RecentlyUsedSnapshot,
): Promise<void> {
  const link = sandbox.link;
  const mosaicSources = readSources(
    readMosaicListSources(
      readCatalogSources(stage, readCombinationSnapshot(combinations).catalog),
      recent,
      link,
    ),
  );
  const tried = listTriedCombinations(link, recent);
  const loads = requestCombinationCounts(combinations, tried);
  const target = readCountTarget(link);
  if (isUnsavedPair(link) && target !== null) {
    loads.push(requestCounts(combinations, [link.mod], target));
  }
  await requestSummaries(combinations, { mosaics: mosaicSources });
  const mosaics = readLoadedValues(
    readCombinationSnapshot(combinations).mosaics,
    mosaicSources,
  );
  loads.push(
    requestSummaries(combinations, listPairSources(mosaics, tried)),
    requestMosaicCounts(combinations, mosaicSources),
  );
  await Promise.all(loads);
}

function readSummaryTitle(
  entries: CombinationSnapshot["mods"] | CombinationSnapshot["collections"],
  source: string,
): string {
  const entry = entries[source];
  return entry?.state === "loaded" ? entry.value.title : source;
}

/** "<mod title> + <collection title>", or "+ None" without a collection. */
function describePair(
  snapshot: CombinationSnapshot,
  mod: string,
  collection: string | null,
): string {
  const modTitle = readSummaryTitle(snapshot.mods, mod);
  const collectionTitle =
    collection === null
      ? "None"
      : readSummaryTitle(snapshot.collections, collection);
  const pair = `${modTitle} + ${collectionTitle}`;
  return pair;
}

/** The sandbox's own pair, as the capsules show it. */
export function describeCurrentPair(sandbox: ListSandbox): string {
  const link = sandbox.link;
  const modTitle = sandbox.mod?.title ?? link.mod;
  let collectionTitle = "None";
  if (link.tile !== null) {
    collectionTitle = readTileName(link.tile);
  } else if (link.collection !== null) {
    collectionTitle = sandbox.collectionTitle ?? link.collection;
  }
  const pair = `${modTitle} + ${collectionTitle}`;
  return pair;
}

/** How a mod + collection pair relates to the sandbox's, compared by resolved sources. */
function readPairFacts(
  link: SandboxLink,
  mod: string,
  collection: string | null,
): MosaicPairFacts {
  const hasCurrentMod = mod === link.mod;
  const hasCurrentCollection =
    link.tile === null && collection === link.collection;
  const facts: MosaicPairFacts = {
    isCurrentPair: hasCurrentMod && hasCurrentCollection,
    hasCurrentMod,
    hasCurrentCollection,
  };
  return facts;
}

const UNKNOWN_PAIR: MosaicPairFacts = Object.freeze({
  isCurrentPair: false,
  hasCurrentMod: false,
  hasCurrentCollection: false,
});

/** Under its title: a mosaic of the current pair says its aliases, any other its mod and collection. */
function buildMosaicDetails(
  inputs: ListInputs,
  mosaic: MosaicSummary | null,
  pair: MosaicPairFacts,
): string[] {
  if (mosaic === null) {
    const none: string[] = [];
    return none;
  }
  if (pair.isCurrentPair) {
    return describeMosaicAliases(mosaic);
  }
  const details = [
    describePair(inputs.snapshot, mosaic.mod, mosaic.collection),
  ];
  return details;
}

const LOADING_SCORE: EntryScore = Object.freeze({ state: "loading" });

function buildMosaicRow(
  inputs: ListInputs,
  entry: ListedSource,
): CombinationRow {
  const link = inputs.sandbox.link;
  const summary = inputs.snapshot.mosaics[entry.source];
  const mosaic = summary?.state === "loaded" ? summary.value : null;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const pair =
    mosaic === null
      ? UNKNOWN_PAIR
      : readPairFacts(link, mosaic.mod, mosaic.collection);
  const title = mosaic?.title ?? inputs.sandbox.mosaic?.title ?? entry.source;
  const row: CombinationRow = {
    id: entry.source,
    title,
    details: buildMosaicDetails(inputs, mosaic, pair),
    foundMosaics: null,
    mark: readRowMark(entry.source === link.mosaic, entry.isRecent),
    mosaics: "icon",
    score:
      mosaic === null
        ? LOADING_SCORE
        : readMosaicScore(inputs.snapshot, mosaic),
    options: null,
    searchText: title,
    pair,
    isSelectable: failure === null,
    failure,
    onChoose: inputs.actions.choose.bind(
      undefined,
      buildMosaicChoice(link, entry.source),
    ),
    onRemove: entry.isRecent
      ? inputs.actions.remove.bind(undefined, {
          kind: "mosaic",
          source: entry.source,
        })
      : null,
  };
  return row;
}

/** A tried combination: "Unsaved combination" with its pair, the ring and its score without aliases. */
function buildTriedRow(
  inputs: ListInputs,
  combination: RecentCombination,
): CombinationRow {
  const link = inputs.sandbox.link;
  const pairText = describePair(
    inputs.snapshot,
    combination.mod,
    combination.collection,
  );
  const row: CombinationRow = {
    id: `combination ${combination.mod} ${combination.collection}`,
    title: UNSAVED_COMBINATION_TITLE,
    details: [pairText],
    foundMosaics: null,
    mark: "tried",
    mosaics: null,
    score: readCountScore(
      inputs.snapshot,
      buildCountKey(combination.mod, combination.collection),
    ),
    options: null,
    searchText: pairText,
    pair: readPairFacts(link, combination.mod, combination.collection),
    isSelectable: true,
    failure: null,
    onChoose: inputs.actions.choose.bind(
      undefined,
      buildPairChoice(combination.mod, combination.collection),
    ),
    onRemove: null,
  };
  return row;
}

/**
 * The pinned rows: the edit row, then the sandbox's own pair, when it is
 * not opened from a mosaic: current, and choosing it opens nothing.
 */
function buildPinnedRows(inputs: ListInputs): CombinationRow[] {
  const sandbox = inputs.sandbox;
  const link = sandbox.link;
  const rows: CombinationRow[] = [];
  const editRow = buildEditRow(inputs);
  if (editRow !== null) {
    rows.push(editRow);
  }
  if (!isUnsavedPair(link)) {
    return rows;
  }
  const target = readCountTarget(link);
  const pairText = describeCurrentPair(sandbox);
  rows.push({
    id: CURRENT_PAIR_ID,
    title: UNSAVED_COMBINATION_TITLE,
    details: [pairText],
    foundMosaics: null,
    mark: "current",
    mosaics: null,
    score:
      target === null
        ? null
        : readCountScore(
            inputs.snapshot,
            buildCountKey(link.mod, target.source),
          ),
    options: null,
    searchText: pairText,
    pair: readPairFacts(link, link.mod, link.collection),
    isSelectable: true,
    failure: null,
    onChoose: inputs.actions.choose.bind(undefined, null),
    onRemove: null,
  });
  return rows;
}

/**
 * The heading of the mosaic list's first group, sorted by "This pair
 * first": "For <mod> + <collection>", or "+ None".
 */
export function buildPairHeading(sandbox: ListSandbox): string {
  const heading = `For ${describeCurrentPair(sandbox)}`;
  return heading;
}

/**
 * The mosaic list's rows: pinned, the edit row and the sandbox's own pair
 * when it is not opened from a mosaic; then the catalog's mosaics, the recently used ones
 * it does not list (the ring), the current mosaic (the dot), and the tried
 * combinations, each an "Unsaved combination" with the ring. A mosaic scores
 * with its aliases, a combination without. Choosing a mosaic opens it
 * (`buildMosaicChoice`), a tried combination its pair (`buildPairChoice`).
 */
export function buildMosaicListRows(inputs: ListInputs): ListRows {
  const link = inputs.sandbox.link;
  const listed = readMosaicListSources(inputs.catalog, inputs.recent, link);
  const entries: CombinationRow[] = [];
  const failedRows: CombinationRow[] = [];
  for (const entry of listed) {
    const row = buildMosaicRow(inputs, entry);
    if (row.failure === null) {
      entries.push(row);
    } else {
      failedRows.push(row);
    }
  }
  for (const combination of listTriedCombinations(link, inputs.recent)) {
    entries.push(buildTriedRow(inputs, combination));
  }
  const rows: ListRows = {
    pinnedRows: buildPinnedRows(inputs),
    entries,
    failedRows,
  };
  return rows;
}
