import type {
  CombinationSnapshot,
  CountTarget,
} from "../../lib/core/combinations/index.ts";
import {
  openStageCombination,
  openStageLink,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxLink,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
import type { RunLink } from "../../lib/core/engine/index.ts";
import type { ReactElement, RefObject } from "react";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import type {
  RecentlyUsed,
  RecentlyUsedSnapshot,
} from "../settings/recently_used.ts";
import type { RowActions } from "./combination_rows.ts";
import type { ListChoices } from "./list_choices.ts";

/** What each capsule's list gets. */
export interface CapsuleListProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
  combinations: CombinationCatalog;
  recentlyUsed: RecentlyUsed;
  listChoices: ListChoices;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The capsule that opens the list. */
  children: ReactElement;
  /** What the list opens under (see `CombinationList`). */
  anchorRef: RefObject<HTMLElement | null>;
}

/** What the row builders read of a sandbox. */
export type ListSandbox = Pick<
  SandboxSnapshot,
  "link" | "mod" | "collectionTitle" | "mosaic"
>;

/** What a list's row builder reads: the catalog, the sandbox, both stores' snapshots and the rows' actions. */
export interface ListInputs {
  catalog: CatalogSources;
  sandbox: ListSandbox;
  snapshot: CombinationSnapshot;
  recent: RecentlyUsedSnapshot;
  actions: RowActions;
}

/** The catalog's sources of each kind, in catalog order. */
export interface CatalogSources {
  mods: string[];
  collections: string[];
  mosaics: string[];
}

function listEntrySources(entries: readonly { source: string }[]): string[] {
  const sources: string[] = [];
  for (const entry of entries) {
    sources.push(entry.source);
  }
  return sources;
}

/**
 * The catalog as the combination catalog last read it, or the stage's instance
 * catalog before its first read, without the default mosaics.
 */
export function readCatalogSources(
  stage: Stage,
  catalog: CombinationSnapshot["catalog"],
): CatalogSources {
  if (catalog === null) {
    const startSources: CatalogSources = {
      mods: [...stage.instanceCatalog.mods],
      collections: [...stage.instanceCatalog.collections],
      mosaics: [...stage.instanceCatalog.mosaics],
    };
    return startSources;
  }
  const sources: CatalogSources = {
    mods: listEntrySources(catalog.mods),
    collections: listEntrySources(catalog.collections),
    mosaics: listEntrySources(catalog.mosaics),
  };
  return sources;
}

/** What the mod list counts on: the sandbox's collection or tile, or `null` without either. */
export function readCountTarget(link: SandboxLink): CountTarget | null {
  if (link.collection !== null) {
    const collectionTarget: CountTarget = {
      kind: "collection",
      source: link.collection,
    };
    return collectionTarget;
  }
  if (link.tile !== null) {
    const tileTarget: CountTarget = { kind: "tile", source: link.tile };
    return tileTarget;
  }
  return null;
}

/**
 * Closes the list, then opens `link` in place of the sandbox (see
 * `openStageCombination`). A `null` link, the current entry, opens nothing.
 */
/** Closes the list, then opens `link` in a new sandbox whose opener is the list's sandbox, so back returns to it. */
export function openFromList(
  stage: Stage,
  sandbox: SandboxSnapshot,
  onOpenChange: (isOpen: boolean) => void,
  link: RunLink,
): void {
  onOpenChange(false);
  openStageLink(stage, link, sandbox.id);
}

export function openChoice(
  stage: Stage,
  sandbox: SandboxSnapshot,
  onOpenChange: (isOpen: boolean) => void,
  link: RunLink | null,
): void {
  onOpenChange(false);
  if (link !== null) {
    openStageCombination(stage, sandbox.id, link);
  }
}
