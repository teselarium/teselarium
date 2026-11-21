import { useEffect, useMemo } from "react";
import {
  readCombinationSnapshot,
  refreshCatalog,
  subscribeCombinations,
} from "../../lib/core/combinations/index.ts";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import {
  readRecentlyUsedSnapshot,
  removeRecentlyUsed,
  subscribeRecentlyUsed,
} from "../settings/recently_used.ts";
import type { RecentlyUsedSnapshot } from "../settings/recently_used.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { openChoice, readCatalogSources } from "./combination_list_inputs.ts";
import type {
  CapsuleListProps,
  ListInputs,
} from "./combination_list_inputs.ts";
import type { RowActions } from "./combination_rows.ts";

/** A list's loads, the same the capsule starts when its tooltip opens. */
export type ListLoads = (
  combinations: CombinationCatalog,
  stage: Stage,
  sandbox: SandboxSnapshot,
  recent: RecentlyUsedSnapshot,
) => Promise<void>;

function buildRowActions(props: CapsuleListProps): RowActions {
  const actions: RowActions = {
    choose: openChoice.bind(
      undefined,
      props.stage,
      props.sandbox,
      props.onOpenChange,
    ),
    remove: removeRecentlyUsed.bind(undefined, props.recentlyUsed),
  };
  return actions;
}

/**
 * What a list's row builder reads, from the combination catalog and recently
 * used, re-rendered after every change. Opening the list reads the catalog
 * anew and starts `loads`.
 */
export function useListInputs(
  props: CapsuleListProps,
  loads: ListLoads,
): ListInputs {
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
  const snapshotCatalog = snapshot.catalog;

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
        void loads(combinations, stage, sandbox, recent);
      }
    },
    [isOpen, combinations, stage, sandbox, recent, snapshotCatalog, loads],
  );

  const catalog = useMemo(
    function readCatalog(): ListInputs["catalog"] {
      return readCatalogSources(stage, snapshotCatalog);
    },
    [stage, snapshotCatalog],
  );
  const inputs: ListInputs = {
    catalog,
    sandbox,
    snapshot,
    recent,
    actions: buildRowActions(props),
  };
  return inputs;
}
