import type { ReactElement } from "react";
import type { ActionMod, CatalogAction } from "../../lib/core/stage/index.ts";
import { AddMosaicDialog } from "./AddMosaicDialog.tsx";
import { ExportMosaicDialog } from "./ExportMosaicDialog.tsx";
import { ImportDialog } from "./ImportDialog.tsx";
import { RemoveMosaicDialog } from "./RemoveMosaicDialog.tsx";
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
  onAnswer: (id: number, accepted: boolean) => void;
}

/**
 * The dialog of a `userCatalog.*` request: import, update, add, export or
 * remove. Each is a `StageDialog`, modal and out of every frame's reach, and
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
