import type { ModEngine } from "../../mod_api.d.ts";

/** What edit mode edits: a stored mosaic, a copy of a mosaic, or a new mosaic. */
export type DraftKind = "edit" | "copy" | "new";

/** The prefix of the viewer's storage keys of kept drafts. */
const DRAFT_KEY_PREFIX = "draft:";

/**
 * The storage key of a kept draft: `draft:<target>` for a stored mosaic,
 * `draft:copy:<target>` for a copy, and `draft:new:<mod>|<collection>` for a
 * new mosaic, so each mosaic keeps its own draft.
 */
export function buildDraftKey(
  kind: DraftKind,
  target: string,
  collection: string | null = null,
): string {
  if (kind === "edit") {
    return `${DRAFT_KEY_PREFIX}${target}`;
  }
  if (kind === "copy") {
    return `${DRAFT_KEY_PREFIX}copy:${target}`;
  }
  return `${DRAFT_KEY_PREFIX}new:${target}|${collection ?? ""}`;
}

/** The kept draft's text, or `null` when none is kept. A storage that fails keeps none. */
export async function readKeptDraft(
  engine: ModEngine,
  key: string,
): Promise<string | null> {
  try {
    const value = await engine.request("storage.get", { key });
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the draft's text, so leaving the page loses nothing. A failed write is ignored: the draft is still on the page. */
export async function keepDraft(
  engine: ModEngine,
  key: string,
  content: string,
): Promise<void> {
  try {
    await engine.request("storage.set", { key, value: content });
  } catch {
    // The draft stays on the page.
  }
}

/** Drops the kept draft, after a save, a discard or a cancel, or when its mosaic is gone. */
export async function dropDraft(engine: ModEngine, key: string): Promise<void> {
  try {
    await engine.request("storage.set", { key, value: null });
  } catch {
    // Nothing more to drop.
  }
}
