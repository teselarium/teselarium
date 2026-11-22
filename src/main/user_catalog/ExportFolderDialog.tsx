import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { MAX_SAVE_BYTES } from "../../lib/core/engine/index.ts";
import type { ActionAnswer } from "../../lib/core/engine/index.ts";
import type { BrowserDatabaseChanges } from "../../lib/core/storage/index.ts";
import type { ActionMod, SaveFileAction } from "../../lib/core/stage/index.ts";
import { buildFolderArchive } from "../../lib/user_catalog/index.ts";
import type {
  ArchivedEntry,
  UserCatalogEntry,
} from "../../lib/user_catalog/index.ts";
import { ActionDialog } from "../stage/ActionDialog.tsx";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import { applyExportSync } from "./export_syncs.ts";
import {
  cancelTicket,
  createReadTicket,
  keepIfCurrent,
} from "./read_tickets.ts";
import {
  readUserCatalogText,
  readUserCatalogVersions,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The type of an exported folder. */
const FOLDER_ARCHIVE_TYPE = "application/zip";

/** The message of an export whose folder has no stored mosaic left. */
export const GONE_FOLDER_MESSAGE =
  "No mosaic of this folder is stored in this browser any more.";

/** The message of a folder whose `.zip` is above the limit of `files.save`. */
export const LARGE_FOLDER_MESSAGE =
  "The folder's .zip is larger than 20 MB, so it cannot be saved.";

interface ExportFolderDialogProps {
  shownId: number;
  mod: ActionMod;
  folder: string;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, answer: ActionAnswer) => void;
}

/** What the export shows: the files being read, the save question, or why there is none. */
type ExportState =
  | { kind: "reading" }
  | {
      kind: "ready";
      action: SaveFileAction;
      changes: BrowserDatabaseChanges<UserCatalogEntry>;
    }
  | { kind: "failed"; message: string };

async function readArchivedEntries(
  store: UserCatalogStore,
  folder: string,
): Promise<ArchivedEntry[]> {
  const archived: ArchivedEntry[] = [];
  for (const entry of store.snapshot.entries) {
    if (entry.place !== "browser" || entry.provenance.folder !== folder) {
      continue;
    }
    const text = await readUserCatalogText(store, entry.address);
    if (text === null) {
      continue;
    }
    const versions = await readUserCatalogVersions(store, entry.address);
    archived.push({
      entry,
      text,
      currentVersion: versions[0]?.savedAt ?? null,
    });
  }
  return archived;
}

async function readExportState(
  store: UserCatalogStore,
  folder: string,
): Promise<ExportState> {
  await waitForUserCatalogStart(store);
  const archived = await readArchivedEntries(store, folder);
  if (archived.length === 0) {
    const gone: ExportState = { kind: "failed", message: GONE_FOLDER_MESSAGE };
    return gone;
  }
  const folderArchive = buildFolderArchive(archived, folder);
  if (folderArchive.bytes.byteLength > MAX_SAVE_BYTES) {
    const tooLarge: ExportState = {
      kind: "failed",
      message: LARGE_FOLDER_MESSAGE,
    };
    return tooLarge;
  }
  const ready: ExportState = {
    kind: "ready",
    action: {
      kind: "save",
      name: `${folder}.zip`,
      type: FOLDER_ARCHIVE_TYPE,
      bytes: new Uint8Array(folderArchive.bytes),
    },
    changes: folderArchive.changes,
  };
  return ready;
}

/**
 * `userCatalog.exportFolder`: the save dialog of `files.save` for
 * `<folder>.zip`, which holds each stored mosaic of the folder at its path,
 * once their texts are read. Save downloads it, makes each of them unchanged
 * since export, and answers `true`. Cancel and Escape answer `false`.
 */
export function ExportFolderDialog({
  shownId,
  mod,
  folder,
  userCatalog,
  onAnswer,
}: ExportFolderDialogProps): ReactElement {
  const [state, setState] = useState<ExportState>({ kind: "reading" });

  useEffect(
    function readFolder(): () => void {
      const ticket = createReadTicket();
      void readExportState(userCatalog, folder).then(
        (keepIfCurrent<ExportState>).bind(undefined, ticket, setState),
      );
      return cancelTicket.bind(undefined, ticket);
    },
    [userCatalog, folder],
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
      title="Export a folder"
      mod={mod}
      error={state.kind === "failed" ? state.message : null}
      acceptLabel={null}
      isAcceptDisabled
      onAccept={handleCancel}
      onCancel={handleCancel}
    >
      {state.kind === "reading" ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the files…
        </p>
      ) : null}
    </CatalogDialogFrame>
  );
}
