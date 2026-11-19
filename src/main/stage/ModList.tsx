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
  CountTarget,
  MosaicSummary,
} from "../../lib/core/combinations/index.ts";
import { buildModChoice } from "../../lib/core/stage/index.ts";
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
  readCountTarget,
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
} from "./combination_rows.ts";
import type { CombinationMark, ListedSource } from "./combination_rows.ts";

/** What the list shows and measures, from the catalog, recently used and the link. */
interface ModListRequest {
  listed: ListedSource[];
  modSources: string[];
  mosaicSources: string[];
  target: CountTarget | null;
}

function buildModListRequest(
  stage: Stage,
  listing: CombinationSnapshot["listing"],
  recent: RecentlyUsedSnapshot,
  link: SandboxLink,
): ModListRequest {
  const catalog = readCatalogSources(stage, listing);
  const listed = listSources(catalog.mods, recent.mods, link.mod);
  const request: ModListRequest = {
    listed,
    modSources: readSources(listed),
    mosaicSources: readSources(
      listSources(catalog.mosaics, recent.mosaics, null),
    ),
    target: readCountTarget(link),
  };
  return request;
}

/** Loads the summaries and counts the list shows, those not requested yet. */
function startModListLoads(
  combinations: CombinationCatalog,
  request: ModListRequest,
): void {
  void requestSummaries(combinations, {
    mods: request.modSources,
    mosaics: request.mosaicSources,
  });
  if (request.target !== null) {
    void requestCounts(combinations, request.modSources, request.target);
  }
}

/** What building a row needs. */
interface ModRowInputs {
  props: CapsuleListProps;
  snapshot: CombinationSnapshot;
  target: CountTarget | null;
  mosaics: readonly MosaicSummary[];
}

function buildModMarks(
  inputs: ModRowInputs,
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
  const link = inputs.props.sandbox.link;
  if (link.tile === null) {
    const mosaicMark = buildMosaicCountMark(
      countPairMosaics(inputs.mosaics, entry.source, link.collection),
    );
    if (mosaicMark !== null) {
      marks.push(mosaicMark);
    }
  }
  return marks;
}

/** The mod's title once its file is loaded, the sandbox's own mod title, or its source. */
function readModTitle(inputs: ModRowInputs, source: string): string {
  const summary = inputs.snapshot.mods[source];
  if (summary?.state === "loaded") {
    return summary.value.title;
  }
  const mod = inputs.props.sandbox.mod;
  return mod !== null && mod.source === source ? mod.title : source;
}

function removeRecentMod(recentlyUsed: RecentlyUsed, source: string): void {
  removeRecentlyUsed(recentlyUsed, { kind: "mod", source });
}

function buildModRow(
  inputs: ModRowInputs,
  entry: ListedSource,
): CombinationRow {
  const { stage, sandbox, onOpenChange, recentlyUsed } = inputs.props;
  const summary = inputs.snapshot.mods[entry.source];
  const isCurrent = entry.source === sandbox.link.mod;
  const failure = summary?.state === "failed" ? summary.reason : null;
  const count =
    inputs.target === null
      ? null
      : (inputs.snapshot.counts[
          buildCountKey(entry.source, inputs.target.source)
        ] ?? { state: "loading" });
  const row: CombinationRow = {
    id: entry.source,
    title: readModTitle(inputs, entry.source),
    details: [],
    count,
    marks: buildModMarks(inputs, entry, isCurrent),
    isSelectable: failure === null,
    failure,
    onChoose: openChoice.bind(
      undefined,
      stage,
      sandbox,
      onOpenChange,
      buildModChoice(sandbox.link, entry.source),
    ),
    onRemove: entry.isRecent
      ? removeRecentMod.bind(undefined, recentlyUsed, entry.source)
      : null,
  };
  return row;
}

function buildModDetails(sandbox: SandboxSnapshot): ListDetail[] {
  const details: ListDetail[] = [
    { term: "Mod", value: sandbox.mod?.source ?? sandbox.link.mod },
  ];
  if (sandbox.mod !== null) {
    details.push({ term: "Version", value: sandbox.mod.version });
  }
  return details;
}

/**
 * The mod capsule's list: the catalog's mods, then the recently used ones it
 * does not list, marked "Recent", and the current mod, marked "Current",
 * even when neither holds it. Each shows its tile-match count on the
 * sandbox's collection or tile, and how many listed mosaics pair it with the
 * current collection. Choosing one opens it with the current collection or
 * tile (`buildModChoice`).
 */
export function ModList(props: CapsuleListProps): ReactElement {
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
    function buildRequest(): ModListRequest {
      return buildModListRequest(stage, listing, recent, link);
    },
    [stage, listing, recent, link],
  );
  const target = request.target;

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
        startModListLoads(combinations, request);
      }
    },
    [isOpen, combinations, request],
  );

  const inputs: ModRowInputs = {
    props,
    snapshot,
    target,
    mosaics: readLoadedValues(snapshot.mosaics, request.mosaicSources),
  };
  const rows: CombinationRow[] = [];
  for (const entry of request.listed) {
    rows.push(buildModRow(inputs, entry));
  }
  return (
    <CombinationList
      label="Mod list"
      isOpen={isOpen}
      onOpenChange={props.onOpenChange}
      anchorRef={props.anchorRef}
      leadRows={[]}
      sections={[{ heading: null, rows }]}
      sortsByCount={target !== null}
      details={buildModDetails(sandbox)}
      explorer={buildExplorerLink(stage, "mods", "Open the mod explorer")}
    >
      {props.children}
    </CombinationList>
  );
}
