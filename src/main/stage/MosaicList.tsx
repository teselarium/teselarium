import { useEffect, useMemo } from "react";
import type { ReactElement } from "react";
import {
  readCombinationSnapshot,
  refreshCatalog,
  requestSummaries,
  subscribeCombinations,
} from "../../lib/core/combinations/index.ts";
import type {
  CombinationSnapshot,
  MosaicSummary,
  SummaryRequest,
} from "../../lib/core/combinations/index.ts";
import { buildMosaicChoice } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import {
  readRecentlyUsedSnapshot,
  removeRecentlyUsed,
  subscribeRecentlyUsed,
} from "../settings/recently_used.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { CombinationList } from "./CombinationList.tsx";
import type {
  CombinationRow,
  CombinationSection,
  ListDetail,
} from "./CombinationList.tsx";
import {
  buildExplorerLink,
  openChoice,
  readCatalogSources,
} from "./combination_list_inputs.ts";
import type { CapsuleListProps } from "./combination_list_inputs.ts";
import {
  CURRENT_MARK,
  describeAliases,
  listSources,
  readLoadedValues,
  readSources,
  RECENT_MARK,
  readTileName,
} from "./combination_rows.ts";
import type { CombinationMark, ListedSource } from "./combination_rows.ts";

/** What building a row needs. */
interface MosaicRowInputs {
  props: CapsuleListProps;
  snapshot: CombinationSnapshot;
}

function readSummaryTitle(
  entries: CombinationSnapshot["mods"] | CombinationSnapshot["collections"],
  source: string,
): string {
  const entry = entries[source];
  return entry?.state === "loaded" ? entry.value.title : source;
}

/** "<mod title> + <collection title>", or "+ None" without a collection. */
function describeOtherPair(
  snapshot: CombinationSnapshot,
  mosaic: MosaicSummary,
): string {
  const modTitle = readSummaryTitle(snapshot.mods, mosaic.mod);
  const collectionTitle =
    mosaic.collection === null
      ? "None"
      : readSummaryTitle(snapshot.collections, mosaic.collection);
  const pair = `${modTitle} + ${collectionTitle}`;
  return pair;
}

/** Whether a mosaic pairs the sandbox's mod and collection, compared by resolved sources. */
function isCurrentPair(
  sandbox: SandboxSnapshot,
  mosaic: MosaicSummary,
): boolean {
  const link = sandbox.link;
  return (
    link.tile === null &&
    mosaic.mod === link.mod &&
    mosaic.collection === link.collection
  );
}

function removeRecentMosaic(recentlyUsed: RecentlyUsed, source: string): void {
  removeRecentlyUsed(recentlyUsed, { kind: "mosaic", source });
}

function buildMosaicMarks(
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
  return marks;
}

/** Under its title: a mosaic of the current pair says its aliases, any other its mod and collection. */
function buildMosaicDetails(
  inputs: MosaicRowInputs,
  mosaic: MosaicSummary | null,
): string[] {
  if (mosaic === null) {
    return [];
  }
  if (!isCurrentPair(inputs.props.sandbox, mosaic)) {
    return [describeOtherPair(inputs.snapshot, mosaic)];
  }
  const aliases = describeAliases(mosaic.aliases);
  return aliases.length === 0 ? ["No aliases"] : aliases;
}

function buildMosaicRow(
  inputs: MosaicRowInputs,
  entry: ListedSource,
): CombinationRow {
  const { stage, sandbox, onOpenChange, recentlyUsed } = inputs.props;
  const summary = inputs.snapshot.mosaics[entry.source];
  const mosaic = summary?.state === "loaded" ? summary.value : null;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const isCurrent = entry.source === sandbox.link.mosaic;
  const row: CombinationRow = {
    id: entry.source,
    title: mosaic?.title ?? sandbox.mosaic?.title ?? entry.source,
    details: buildMosaicDetails(inputs, mosaic),
    count: null,
    marks: buildMosaicMarks(entry, isCurrent),
    isSelectable: failure === null,
    failure,
    onChoose: openChoice.bind(
      undefined,
      stage,
      sandbox,
      onOpenChange,
      buildMosaicChoice(sandbox.link, entry.source),
    ),
    onRemove: entry.isRecent
      ? removeRecentMosaic.bind(undefined, recentlyUsed, entry.source)
      : null,
  };
  return row;
}

/** The current pair's titles, as the capsules show them. */
function describeCurrentPair(sandbox: SandboxSnapshot): string {
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

/** The mosaics of the current pair first, then the other combinations, keeping the list order in each. */
function buildMosaicSections(
  inputs: MosaicRowInputs,
  listed: readonly ListedSource[],
): CombinationSection[] {
  const pairRows: CombinationRow[] = [];
  const otherRows: CombinationRow[] = [];
  for (const entry of listed) {
    const summary = inputs.snapshot.mosaics[entry.source];
    const row = buildMosaicRow(inputs, entry);
    const isPair =
      summary?.state === "loaded" &&
      isCurrentPair(inputs.props.sandbox, summary.value);
    if (isPair) {
      pairRows.push(row);
    } else {
      otherRows.push(row);
    }
  }
  const sections: CombinationSection[] = [
    {
      heading: `For ${describeCurrentPair(inputs.props.sandbox)}`,
      rows: pairRows,
      emptyText: "No mosaic for this combination yet.",
    },
    { heading: "Other combinations", rows: otherRows },
  ];
  return sections;
}

function buildMosaicListDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const details: ListDetail[] = [
    {
      term: "Mosaic",
      value:
        sandbox.mosaic?.source ??
        sandbox.mosaicReference ??
        "Unsaved combination",
    },
    { term: "Run link", value: sandbox.hash },
  ];
  return details;
}

/** The mods and collections of the loaded mosaics, for the other combinations' titles. */
function listPairSources(mosaics: readonly MosaicSummary[]): {
  mods: string[];
  collections: string[];
} {
  const mods: string[] = [];
  const collections: string[] = [];
  for (const mosaic of mosaics) {
    mods.push(mosaic.mod);
    if (mosaic.collection !== null) {
      collections.push(mosaic.collection);
    }
  }
  const sources = { mods, collections };
  return sources;
}

/**
 * The mosaic capsule's list: the catalog's mosaics, then the recently used
 * ones it does not list, marked "Recent", grouped under "For <mod> +
 * <collection>", the mosaics of the current pair with their aliases, then
 * under "Other combinations", each with its mod and collection. Choosing one
 * opens it (`buildMosaicChoice`).
 */
export function MosaicList(props: CapsuleListProps): ReactElement {
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
  const currentMosaic = sandbox.link.mosaic;
  const listed = useMemo(
    function listMosaics(): ListedSource[] {
      const catalog = readCatalogSources(stage, listing);
      return listSources(catalog.mosaics, recent.mosaics, currentMosaic);
    },
    [stage, listing, recent, currentMosaic],
  );
  const loadedMosaics = snapshot.mosaics;
  const request = useMemo(
    function buildRequest(): SummaryRequest {
      const mosaicSources = readSources(listed);
      const pairSources = listPairSources(
        readLoadedValues(loadedMosaics, mosaicSources),
      );
      const summaries: SummaryRequest = {
        mosaics: mosaicSources,
        mods: pairSources.mods,
        collections: pairSources.collections,
      };
      return summaries;
    },
    [listed, loadedMosaics],
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
    function loadOnOpen(): void {
      if (isOpen) {
        void requestSummaries(combinations, request);
      }
    },
    [isOpen, combinations, request],
  );

  const inputs: MosaicRowInputs = { props, snapshot };
  return (
    <CombinationList
      label="Mosaic list"
      isOpen={isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      leadRows={[]}
      sections={buildMosaicSections(inputs, listed)}
      sortsByCount={false}
      details={buildMosaicListDetails(sandbox)}
      explorer={buildExplorerLink(stage, "mosaics", "Open the mosaic explorer")}
    >
      {props.children}
    </CombinationList>
  );
}
