import type { ReactElement } from "react";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { planImport } from "../../lib/user_catalog/index.ts";
import type { ImportReview } from "../../lib/user_catalog/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import { FilePickers } from "./FilePickers.tsx";
import type { PickedSelection } from "./picked_selection.ts";
import { ReviewList } from "./ReviewList.tsx";
import { useCatalogReview } from "./use_catalog_review.ts";
import { buildReviewSources } from "./user_catalog_reads.ts";
import {
  readUserCatalogSnapshot,
  STORE_REFUSED_MESSAGE,
  subscribeUserCatalog,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

interface ImportDialogProps {
  shownId: number;
  mod: ActionMod;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, accepted: boolean) => void;
}

async function planPickedImport(
  store: UserCatalogStore,
  selection: PickedSelection,
): Promise<ImportReview> {
  await waitForUserCatalogStart(store);
  return planImport(
    selection.files,
    selection.folder,
    buildReviewSources(store),
  );
}

/**
 * `userCatalog.import`: "Import mosaics", with "Choose files…", "Choose
 * folder…" and a drop zone, then the review of the picked files. "Import"
 * applies the checked rows and answers `true`. Cancel and Escape answer
 * `false`. When the browser refused the store, it says so and picks nothing.
 */
export function ImportDialog({
  shownId,
  mod,
  userCatalog,
  onAnswer,
}: ImportDialogProps): ReactElement {
  const snapshot = useStoreSnapshot(
    userCatalog,
    subscribeUserCatalog,
    readUserCatalogSnapshot,
  );
  const review = useCatalogReview(userCatalog);

  function handlePick(selection: PickedSelection): void {
    review.startReview(
      planPickedImport.bind(undefined, userCatalog, selection),
    );
  }

  async function applyImport(): Promise<void> {
    if (await review.apply()) {
      onAnswer(shownId, true);
    }
  }

  function handleImport(): void {
    void applyImport();
  }

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  const isBusy = review.phase === "reading" || review.phase === "applying";
  const error = snapshot.isAvailable ? review.error : STORE_REFUSED_MESSAGE;
  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Import mosaics"
      mod={mod}
      error={error}
      acceptLabel="Import"
      isAcceptDisabled={!review.canApply}
      onAccept={handleImport}
      onCancel={handleCancel}
    >
      <p className="m-0 text-sm">
        Mosaic files are kept in this browser. Only files ending in .yaml or
        .yml are read.
      </p>
      <FilePickers
        mode="import"
        isDisabled={isBusy || !snapshot.isAvailable}
        onPick={handlePick}
        onPickError={review.showError}
      />
      {review.phase === "reading" ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the files…
        </p>
      ) : null}
      {review.review === null ? null : (
        <ReviewList
          review={review.review}
          checked={review.checked}
          isDisabled={isBusy}
          onToggle={review.toggle}
        />
      )}
    </CatalogDialogFrame>
  );
}
