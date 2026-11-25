import type { ReactElement } from "react";
import type {
  ActionAnswer,
  ActionMod,
  CatalogAction,
} from "../../lib/core/stage/index.ts";
import { AddMosaicDialog } from "./AddMosaicDialog.tsx";
import { ExportFolderDialog } from "./ExportFolderDialog.tsx";
import { ExportMosaicDialog } from "./ExportMosaicDialog.tsx";
import { HistoryDialog } from "./HistoryDialog.tsx";
import { ImportDialog } from "./ImportDialog.tsx";
import { RemoveMosaicDialog } from "./RemoveMosaicDialog.tsx";
import { SaveMosaicDialog } from "./SaveMosaicDialog.tsx";
import { UpdateDialog } from "./UpdateDialog.tsx";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The shown action when it is one of the `userCatalog.*` requests'. */
export interface CatalogActionSnapshot {
  id: number;
  mod: ActionMod;
  action: CatalogAction;
}

interface UserCatalogDialogProps {
  shown: CatalogActionSnapshot;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, answer: ActionAnswer) => void;
}

/**
 * The dialog of a `userCatalog.*` request: import, update, add, export,
 * remove, save, history or folder export. Each is a `StageDialog`, modal and out of every frame's reach, and
 * the app, not the mod, performs the change. Keyed by the action, so a new
 * request starts with a fresh dialog.
 */
export function UserCatalogDialog({
  shown,
  userCatalog,
  onAnswer,
}: UserCatalogDialogProps): ReactElement {
  const { id, mod, action } = shown;
  if (action.kind === "catalogImport") {
    return (
      <ImportDialog
        key={id}
        shownId={id}
        mod={mod}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogUpdate") {
    return (
      <UpdateDialog
        key={id}
        shownId={id}
        mod={mod}
        address={action.address}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogAdd") {
    return (
      <AddMosaicDialog
        key={id}
        shownId={id}
        mod={mod}
        suggested={action.suggested}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogExport") {
    return (
      <ExportMosaicDialog
        key={id}
        shownId={id}
        mod={mod}
        address={action.address}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogSave") {
    return (
      <SaveMosaicDialog
        key={id}
        shownId={id}
        mod={mod}
        content={action.content}
        address={action.address}
        copiedFrom={action.copiedFrom}
        kind="saved"
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogHistory") {
    return (
      <HistoryDialog
        key={id}
        shownId={id}
        mod={mod}
        address={action.address}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  if (action.kind === "catalogExportFolder") {
    return (
      <ExportFolderDialog
        key={id}
        shownId={id}
        mod={mod}
        folder={action.folder}
        userCatalog={userCatalog}
        onAnswer={onAnswer}
      />
    );
  }
  return (
    <RemoveMosaicDialog
      key={id}
      shownId={id}
      mod={mod}
      address={action.address}
      userCatalog={userCatalog}
      onAnswer={onAnswer}
    />
  );
}
