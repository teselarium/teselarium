/** The part of `History` the stage uses. The page passes `window.history`. */
export type StageHistory = Pick<
  History,
  "state" | "pushState" | "replaceState"
>;

/** What the stage writes for a history entry: its position, its section and its address. */
export interface HistoryEntryWrite {
  position: number;
  section: string | null;
  hash: string;
}

function readStageHistoryState(
  historyState: unknown,
): { position?: unknown; section?: unknown } | null {
  if (typeof historyState !== "object" || historyState === null) {
    return null;
  }
  const stageState: unknown = (historyState as { teselarium?: unknown })
    .teselarium;
  if (typeof stageState !== "object" || stageState === null) {
    return null;
  }
  return stageState;
}

/**
 * The history position the stage stored in an entry's state, or `null` for
 * an entry the stage did not write (first load, a link followed in the page,
 * another app's state).
 */
export function readHistoryPosition(historyState: unknown): number | null {
  const position = readStageHistoryState(historyState)?.position;
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    return null;
  }
  return position;
}

/**
 * The section the stage stored in an entry's state, or `null` when the entry
 * belongs to no section. Anything but a non-empty string counts as `null`.
 */
export function readHistorySection(historyState: unknown): string | null {
  const section = readStageHistoryState(historyState)?.section;
  if (typeof section !== "string" || section === "") {
    return null;
  }
  return section;
}

/**
 * Writes a history entry with the stage's position and section in its state,
 * so both stay after a reload. `push` adds an entry, `replace` changes the
 * current one.
 */
export function writeStageEntry(
  history: StageHistory,
  mode: "push" | "replace",
  entry: HistoryEntryWrite,
): void {
  const historyState = {
    teselarium: { position: entry.position, section: entry.section },
  };
  if (mode === "push") {
    history.pushState(historyState, "", entry.hash);
    return;
  }
  history.replaceState(historyState, "", entry.hash);
}
