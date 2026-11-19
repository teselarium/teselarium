import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { readTileName } from "./combination_rows.ts";

/** What a capsule shows: its title, and the mod's version once its file is loaded. */
export interface CapsuleTitle {
  title: string;
  version?: string;
}

/** Still loading, or asking before its frame exists. */
export function isSandboxLoading(sandbox: SandboxSnapshot): boolean {
  return sandbox.status === "loading" || sandbox.status === "asking";
}

/**
 * The mod's name and version once its mod file is loaded, even when the
 * sandbox failed later. Before that, "Loading mod…", or "Mod not loaded"
 * when it failed or stopped first.
 */
export function readModCapsuleTitle(sandbox: SandboxSnapshot): CapsuleTitle {
  if (sandbox.mod !== null) {
    const loaded: CapsuleTitle = {
      title: sandbox.mod.title,
      version: sandbox.mod.version,
    };
    return loaded;
  }
  const missing: CapsuleTitle = {
    title: isSandboxLoading(sandbox) ? "Loading mod…" : "Mod not loaded",
  };
  return missing;
}

/**
 * The tile's decoded file name for a tile link, "None" without a collection,
 * the collection's title once its file is loaded, "Loading collection…"
 * before, or "Collection not loaded" when the sandbox failed or stopped first.
 */
export function readCollectionCapsuleTitle(sandbox: SandboxSnapshot): string {
  const link = sandbox.link;
  if (link.tile !== null) {
    return readTileName(link.tile);
  }
  if (link.collection === null) {
    return "None";
  }
  if (sandbox.collectionTitle !== null) {
    return sandbox.collectionTitle;
  }
  return isSandboxLoading(sandbox)
    ? "Loading collection…"
    : "Collection not loaded";
}

/** The mosaic's title, or "Unsaved combination" for a sandbox not opened from a mosaic. */
export function readMosaicCapsuleTitle(sandbox: SandboxSnapshot): string {
  return sandbox.mosaic?.title ?? "Unsaved combination";
}

/** Whether a mosaic link waits for its mosaic file, or failed before it was loaded. */
export function isMosaicPending(sandbox: SandboxSnapshot): boolean {
  return sandbox.mosaicReference !== null && sandbox.mosaic === null;
}
