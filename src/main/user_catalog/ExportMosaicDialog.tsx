import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ActionMod, SaveFileAction } from "../../lib/core/stage/index.ts";
import type { ActionAnswer } from "../../lib/core/engine/index.ts";
import type { BrowserDatabaseChanges } from "../../lib/core/storage/index.ts";
import {
  findStoredEntry,
  planExportSync,
  readExportFileName,
} from "../../lib/user_catalog/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { ActionDialog } from "../stage/ActionDialog.tsx";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import { applyExportSync } from "./export_syncs.ts";
import {
  cancelTicket,
  createReadTicket,
  keepIfCurrent,
} from "./read_tickets.ts";
import { GONE_ENTRY_MESSAGE } from "./UpdateDialog.tsx";
import {
  readUserCatalogText,
  readUserCatalogVersions,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The type of an exported mosaic file. */
const MOSAIC_FILE_TYPE = "application/yaml";

interface ExportMosaicDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The stored entry's address. */
  address: string;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, answer: ActionAnswer) => void;
}

/** What the export shows: the file being read, the save question with the sync it makes, or the entry gone. */
type ExportState =
  | { kind: "reading" }
  | {
      kind: "ready";
      action: SaveFileAction;
      changes: BrowserDatabaseChanges<UserCatalogEntry>;
    }
  | { kind: "gone" };

/** The save action of a stored entry's file: its exact text, under its provenance file name. */
function buildExportAction(
  entry: UserCatalogEntry,
  text: string,
): SaveFileAction {
  const action: SaveFileAction = {
    kind: "save",
    name: readExportFileName(entry),
    type: MOSAIC_FILE_TYPE,
    bytes: new TextEncoder().encode(text),
  };
  return action;
}

async function readExportState(
  store: UserCatalogStore,
  address: string,
): Promise<ExportState> {
  await waitForUserCatalogStart(store);
  const entry = findStoredEntry(store.snapshot.entries, address);
  const text =
    entry === null ? null : await readUserCatalogText(store, address);
  if (entry === null || text === null) {
    const gone: ExportState = { kind: "gone" };
    return gone;
  }
  const versions = await readUserCatalogVersions(store, address);
  const ready: ExportState = {
    kind: "ready",
    action: buildExportAction(entry, text),
    changes: planExportSync(entry, versions[0]?.savedAt ?? null),
  };
  return ready;
}

/**
 * `userCatalog.export`: the save dialog of `files.save` for a stored entry's
 * file, once its text is read. Save downloads exactly the stored text, makes
 * the entry unchanged since export, and answers `true`. Cancel and Escape
 * answer `false`.
 */
export function ExportMosaicDialog({
  shownId,
  mod,
  address,
  userCatalog,
  onAnswer,
}: ExportMosaicDialogProps): ReactElement {
  const [state, setState] = useState<ExportState>({ kind: "reading" });

  useEffect(
    function readStoredFile(): () => void {
      const ticket = createReadTicket();
      void readExportState(userCatalog, address).then(
        (keepIfCurrent<ExportState>).bind(undefined, ticket, setState),
      );
      return cancelTicket.bind(undefined, ticket);
    },
    [userCatalog, address],
  );

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  if (state.kind === "ready") {
    return (
      <ActionDialog
        shown={{ id: shownId, mod, action: state.action }}
        onAnswer={applyExportSync.bind(
          undefined,
          userCatalog,
          state.changes,
          onAnswer,
        )}
      />
    );
  }
  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Export a mosaic"
      mod={mod}
      error={state.kind === "gone" ? GONE_ENTRY_MESSAGE : null}
      acceptLabel={null}
      isAcceptDisabled
      onAccept={handleCancel}
      onCancel={handleCancel}
    >
      {state.kind === "reading" ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the file…
        </p>
      ) : null}
    </CatalogDialogFrame>
  );
}
