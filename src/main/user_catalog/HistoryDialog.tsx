import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { ActionAnswer } from "../../lib/core/engine/index.ts";
import type {
  StoredVersion,
  StoredVersionKind,
} from "../../lib/core/storage/index.ts";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { findStoredEntry } from "../../lib/user_catalog/index.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import {
  cancelTicket,
  createReadTicket,
  keepIfCurrent,
} from "./read_tickets.ts";
import { SaveMosaicDialog } from "./SaveMosaicDialog.tsx";
import { GONE_ENTRY_MESSAGE } from "./UpdateDialog.tsx";
import { loadUserMosaic } from "./user_catalog_reads.ts";
import {
  readUserCatalogVersions,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** Touch-friendly buttons: at least 32px tall, as on a phone. */
const BUTTON_CLASSES = "min-h-8 min-w-8";

/** How the history names each kind of version. */
const VERSION_KIND_LABELS: Record<StoredVersionKind, string> = {
  imported: "Imported",
  updated: "Updated from file",
  saved: "Saved",
  restored: "Restored",
};

interface HistoryDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The stored entry's address. */
  address: string;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, answer: ActionAnswer) => void;
}

/** What the history shows: the versions being read, the list, or the entry gone. */
type HistoryState =
  | { kind: "reading" }
  | { kind: "gone" }
  | { kind: "ready"; title: string; versions: StoredVersion[] };

/** The name a mosaic goes by when its text cannot be read: its file name. */
function readFileName(address: string): string {
  const segments = new URL(address).pathname.split("/");
  return decodeURIComponent(segments[segments.length - 1]);
}

async function readMosaicTitle(
  store: UserCatalogStore,
  address: string,
): Promise<string> {
  try {
    const mosaic = await loadUserMosaic(store, address);
    return mosaic.title;
  } catch {
    return readFileName(address);
  }
}

async function readHistoryState(
  store: UserCatalogStore,
  address: string,
): Promise<HistoryState> {
  await waitForUserCatalogStart(store);
  if (findStoredEntry(store.snapshot.entries, address) === null) {
    const gone: HistoryState = { kind: "gone" };
    return gone;
  }
  const ready: HistoryState = {
    kind: "ready",
    title: await readMosaicTitle(store, address),
    versions: await readUserCatalogVersions(store, address),
  };
  return ready;
}

/** A version's time in the user's own format, such as "22/11/2026, 10:00:00". */
function describeTime(savedAt: string): string {
  return new Date(savedAt).toLocaleString();
}

function renderVersion(
  version: StoredVersion,
  index: number,
  onRestore: (version: StoredVersion) => void,
): ReactElement {
  return (
    <li
      key={version.savedAt}
      className="flex flex-wrap items-center gap-2 py-2"
      data-version-kind={version.kind}
    >
      <span className="min-w-0 flex-1">
        <span className="font-medium">{VERSION_KIND_LABELS[version.kind]}</span>{" "}
        <time dateTime={version.savedAt} className="text-muted-foreground">
          {describeTime(version.savedAt)}
        </time>
      </span>
      {index === 0 ? (
        <span className="text-sm text-muted-foreground">Current</span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={BUTTON_CLASSES}
          aria-label={`Restore the version ${VERSION_KIND_LABELS[version.kind]} ${describeTime(version.savedAt)}`}
          onClick={onRestore.bind(undefined, version)}
        >
          Restore
        </Button>
      )}
    </li>
  );
}

/**
 * `userCatalog.history`: "History of <title>", the stored mosaic's versions
 * newest first, each with its time and kind, and "Restore" for all but the
 * current one. Restoring opens the save confirmation for that version's text,
 * as a "Restored" version: saving it answers `true`, and its Cancel comes
 * back to the list. "Close" and Escape answer `false`.
 */
export function HistoryDialog({
  shownId,
  mod,
  address,
  userCatalog,
  onAnswer,
}: HistoryDialogProps): ReactElement {
  const [state, setState] = useState<HistoryState>({ kind: "reading" });
  const [restoring, setRestoring] = useState<StoredVersion | null>(null);

  useEffect(
    function readHistory(): () => void {
      const ticket = createReadTicket();
      void readHistoryState(userCatalog, address).then(
        (keepIfCurrent<HistoryState>).bind(undefined, ticket, setState),
      );
      return cancelTicket.bind(undefined, ticket);
    },
    [userCatalog, address],
  );

  function handleRestoreAnswer(id: number, answer: ActionAnswer): void {
    if (typeof answer === "string") {
      onAnswer(id, true);
      return;
    }
    setRestoring(null);
  }

  function handleClose(): void {
    onAnswer(shownId, false);
  }

  if (restoring !== null) {
    return (
      <SaveMosaicDialog
        key={restoring.savedAt}
        shownId={shownId}
        mod={mod}
        content={restoring.text}
        address={address}
        copiedFrom={null}
        kind="restored"
        userCatalog={userCatalog}
        onAnswer={handleRestoreAnswer}
      />
    );
  }

  const items: ReactElement[] = [];
  if (state.kind === "ready") {
    for (const [index, version] of state.versions.entries()) {
      items.push(renderVersion(version, index, setRestoring));
    }
  }
  return (
    <CatalogDialogFrame
      shownId={shownId}
      title={state.kind === "ready" ? `History of ${state.title}` : "History"}
      mod={mod}
      error={state.kind === "gone" ? GONE_ENTRY_MESSAGE : null}
      acceptLabel={null}
      cancelLabel="Close"
      isAcceptDisabled
      onAccept={handleClose}
      onCancel={handleClose}
    >
      {state.kind === "reading" ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the history…
        </p>
      ) : null}
      {items.length === 0 ? null : (
        <ul
          aria-label="Versions"
          data-history-list=""
          className="m-0 max-h-[50vh] min-h-0 list-none divide-y overflow-y-auto p-0 text-sm [overflow-wrap:anywhere]"
        >
          {items}
        </ul>
      )}
    </CatalogDialogFrame>
  );
}
