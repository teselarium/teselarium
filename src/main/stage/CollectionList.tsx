import { useEffect, useMemo } from "react";
import type { ReactElement } from "react";
import {
  buildCountKey,
  readCombinationSnapshot,
  refreshCatalog,
  requestCounts,
  requestSummaries,
  subscribeCombinations,
} from "../../lib/core/combinations/index.ts";
import type {
  CombinationCatalog,
  CombinationSnapshot,
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
import {
  readRecentlyUsedSnapshot,
  removeRecentlyUsed,
  subscribeRecentlyUsed,
} from "../settings/recently_used.ts";
import type {
  RecentlyUsed,
  RecentlyUsedSnapshot,
} from "../settings/recently_used.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CombinationRow, ListDetail } from "./CombinationList.tsx";
import {
  buildExplorerLink,
  openChoice,
  readCatalogSources,
} from "./combination_list_inputs.ts";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import {
  countPairMosaics,
  buildMosaicCountMark,
  CURRENT_MARK,
  listSources,
  readLoadedValues,
  readSources,
  RECENT_MARK,
  readTileName,
} from "./combination_rows.ts";
import type { CombinationMark, ListedSource } from "./combination_rows.ts";

/** What the list shows and measures, from the catalog, recently used and the link. */
interface CollectionListRequest {
  listed: ListedSource[];
  collectionSources: string[];
  mosaicSources: string[];
  /** The current mod, whose counts the list shows, or `""` before a mosaic's file is loaded. */
  modSource: string;
}

function buildCollectionListRequest(
  stage: Stage,
  listing: CombinationSnapshot["listing"],
  recent: RecentlyUsedSnapshot,
  link: SandboxLink,
): CollectionListRequest {
  const catalog = readCatalogSources(stage, listing);
  const listed = listSources(
    catalog.collections,
    recent.collections,
    link.collection,
  );
  const request: CollectionListRequest = {
    listed,
    collectionSources: readSources(listed),
    mosaicSources: readSources(
      listSources(catalog.mosaics, recent.mosaics, null),
    ),
    modSource: link.mod,
  };
  return request;
}

/** Loads the summaries and counts the list shows, those not requested yet. */
function startCollectionListLoads(
  combinations: CombinationCatalog,
  request: CollectionListRequest,
): void {
  void requestSummaries(combinations, {
    collections: request.collectionSources,
    mosaics: request.mosaicSources,
  });
  if (request.modSource === "") {
    return;
  }
  for (const source of request.collectionSources) {
    void requestCounts(combinations, [request.modSource], {
      kind: "collection",
      source,
    });
  }
}

/** What building a row needs. */
interface CollectionRowInputs {
  props: CapsuleListProps;
  snapshot: CombinationSnapshot;
  mosaics: readonly MosaicSummary[];
}

function buildCollectionMarks(
  inputs: CollectionRowInputs,
  entry: ListedSource,
  isCurrent: boolean,
): CombinationMark[] {
  const marks: CombinationMark[] = [];
  if (isCurrent) {
    marks.push(CURRENT_MARK);
  }
  if (entry.isRecent) {
    marks.push(RECENT_MARK);
  }
  const mosaicMark = buildMosaicCountMark(
    countPairMosaics(
      inputs.mosaics,
      inputs.props.sandbox.link.mod,
      entry.source,
    ),
  );
  if (mosaicMark !== null) {
    marks.push(mosaicMark);
  }
  return marks;
}

/** The collection's title once its file is loaded, the sandbox's own collection title, or its source. */
function readCollectionTitle(
  inputs: CollectionRowInputs,
  source: string,
): string {
  const summary = inputs.snapshot.collections[source];
  if (summary?.state === "loaded") {
    return summary.value.title;
  }
  const sandbox = inputs.props.sandbox;
  if (sandbox.link.collection === source && sandbox.collectionTitle !== null) {
    return sandbox.collectionTitle;
  }
  return source;
}

function removeRecentCollection(
  recentlyUsed: RecentlyUsed,
  source: string,
): void {
  removeRecentlyUsed(recentlyUsed, { kind: "collection", source });
}

function buildCollectionRow(
  inputs: CollectionRowInputs,
  entry: ListedSource,
): CombinationRow {
  const { stage, sandbox, onOpenChange, recentlyUsed } = inputs.props;
  const summary = inputs.snapshot.collections[entry.source];
  const isCurrent = entry.source === sandbox.link.collection;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const modSource = sandbox.link.mod;
  const row: CombinationRow = {
    id: entry.source,
    title: readCollectionTitle(inputs, entry.source),
    details: [],
    count:
      modSource === ""
        ? null
        : (inputs.snapshot.counts[buildCountKey(modSource, entry.source)] ?? {
            state: "loading",
          }),
    marks: buildCollectionMarks(inputs, entry, isCurrent),
    isSelectable: failure === null,
    failure,
    onChoose: openChoice.bind(
      undefined,
      stage,
      sandbox,
      onOpenChange,
      buildCollectionChoice(sandbox.link, entry.source),
    ),
    onRemove: entry.isRecent
      ? removeRecentCollection.bind(undefined, recentlyUsed, entry.source)
      : null,
  };
  return row;
}

function ignoreChoice(): void {
  // The tile row is the current entry, and cannot be chosen.
}

/** For a tile link, the tile, then "None". */
function buildLeadRows(props: CapsuleListProps): CombinationRow[] {
  const { stage, sandbox, onOpenChange } = props;
  const link = sandbox.link;
  const rows: CombinationRow[] = [];
  if (link.tile !== null) {
    rows.push({
      id: link.tile,
      title: readTileName(link.tile),
      details: [],
      count: null,
      marks: [CURRENT_MARK],
      isSelectable: false,
      failure: null,
      onChoose: ignoreChoice,
      onRemove: null,
    });
  }
  const isNoneCurrent = link.collection === null && link.tile === null;
  rows.push({
    id: NO_COLLECTION,
    title: "None",
    details: [],
    count: null,
    marks: isNoneCurrent ? [CURRENT_MARK] : [],
    isSelectable: true,
    failure: null,
    onChoose: openChoice.bind(
      undefined,
      stage,
      sandbox,
      onOpenChange,
      buildCollectionChoice(link, NO_COLLECTION),
    ),
    onRemove: null,
  });
  return rows;
}

function buildCollectionDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const link = sandbox.link;
  if (link.tile !== null) {
    const tileDetails: ListDetail[] = [{ term: "Tile", value: link.tile }];
    return tileDetails;
  }
  const details: ListDetail[] = [
    { term: "Collection", value: link.collection ?? "None" },
  ];
  return details;
}

/**
 * The collection capsule's list: "None", or for a tile link the tile and
 * then "None", then the catalog's collections, then the recently used ones it
 * does not list, marked "Recent", and the current collection, marked
 * "Current". Each shows the tile-match count of the current mod on it, and
 * how many listed mosaics pair the current mod with it. Choosing one opens
 * the current mod with it (`buildCollectionChoice`).
 */
export function CollectionList(props: CapsuleListProps): ReactElement {
  const { stage, sandbox, combinations, recentlyUsed, isOpen } = props;
  const snapshot = useStoreSnapshot(
    combinations,
    subscribeCombinations,
    readCombinationSnapshot,
  );
  const recent = useStoreSnapshot(
    recentlyUsed,
    subscribeRecentlyUsed,
    readRecentlyUsedSnapshot,
  );
  const listing = snapshot.listing;
  const link = sandbox.link;
  const request = useMemo(
    function buildRequest(): CollectionListRequest {
      return buildCollectionListRequest(stage, listing, recent, link);
    },
    [stage, listing, recent, link],
  );

  useEffect(
    function readCatalogOnOpen(): void {
      if (isOpen) {
        void refreshCatalog(combinations);
      }
    },
    [isOpen, combinations],
  );
  useEffect(
    function measureOnOpen(): void {
      if (isOpen) {
        startCollectionListLoads(combinations, request);
      }
    },
    [isOpen, combinations, request],
  );

  const inputs: CollectionRowInputs = {
    props,
    snapshot,
    mosaics: readLoadedValues(snapshot.mosaics, request.mosaicSources),
  };
  const rows: CombinationRow[] = [];
  for (const entry of request.listed) {
    rows.push(buildCollectionRow(inputs, entry));
  }
  return (
    <CombinationList
      label="Collection list"
      isOpen={isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      leadRows={buildLeadRows(props)}
      sections={[{ heading: null, rows }]}
      sortsByCount={request.modSource !== ""}
      details={buildCollectionDetails(sandbox)}
      explorer={buildExplorerLink(
        stage,
        "tiles",
        "Open the collection explorer",
      )}
    >
      {props.children}
    </CombinationList>
  );
}
