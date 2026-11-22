import type { ReactElement } from "react";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { findStoredEntry, planUpdate } from "../../lib/user_catalog/index.ts";
import type {
  ImportReview,
  UserCatalogEntry,
} from "../../lib/user_catalog/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import { FilePickers } from "./FilePickers.tsx";
import type { PickedSelection } from "./picked_selection.ts";
import { ReviewList } from "./ReviewList.tsx";
import { useCatalogReview } from "./use_catalog_review.ts";
import { buildReviewSources } from "./user_catalog_reads.ts";
import {
  readUserCatalogSnapshot,
  subscribeUserCatalog,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The message of an update whose entry left the user catalog after the request. */
export const GONE_ENTRY_MESSAGE =
  "This mosaic is no longer stored in this browser.";

interface UpdateDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The stored entry's address. */
  address: string;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, accepted: boolean) => void;
}

async function planPickedUpdate(
  store: UserCatalogStore,
  entry: UserCatalogEntry,
  selection: PickedSelection,
): Promise<ImportReview> {
  await waitForUserCatalogStart(store);
  const [picked] = selection.files;
  return planUpdate(picked, entry, buildReviewSources(store));
}

function describeEntry(entry: UserCatalogEntry): string {
  const { folder, path } = entry.provenance;
  if (folder === null) {
    return path ?? entry.address;
  }
  return `${folder}/${path ?? ""}`;
}

/**
 * `userCatalog.update`: "Update a mosaic", with "Choose file…" and a drop
 * zone. The picked file, whatever its name, is reviewed as the entry's
 * update. "Update" replaces the stored file at the same address and answers
 * `true`. Cancel and Escape answer `false`.
 */
export function UpdateDialog({
  shownId,
  mod,
  address,
  userCatalog,
  onAnswer,
}: UpdateDialogProps): ReactElement {
  const snapshot = useStoreSnapshot(
    userCatalog,
    subscribeUserCatalog,
    readUserCatalogSnapshot,
  );
  const review = useCatalogReview(userCatalog);
  const entry = findStoredEntry(snapshot.entries, address);

  function handlePick(selection: PickedSelection): void {
    if (entry === null || selection.files.length === 0) {
      return;
    }
    review.startReview(
      planPickedUpdate.bind(undefined, userCatalog, entry, selection),
    );
  }

  async function applyUpdate(): Promise<void> {
    if (await review.apply()) {
      onAnswer(shownId, true);
    }
  }

  function handleUpdate(): void {
    void applyUpdate();
  }

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  const isBusy = review.phase === "reading" || review.phase === "applying";
  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Update a mosaic"
      mod={mod}
      error={
        entry === null && snapshot.isStarted ? GONE_ENTRY_MESSAGE : review.error
      }
      acceptLabel="Update"
      isAcceptDisabled={!review.canApply}
      onAccept={handleUpdate}
      onCancel={handleCancel}
    >
      {entry === null ? null : (
        <p className="m-0 text-sm [overflow-wrap:anywhere]">
          Choose the file that replaces <code>{describeEntry(entry)}</code>. Its
          address stays the same.
        </p>
      )}
      <FilePickers
        mode="update"
        isDisabled={isBusy || entry === null}
        onPick={handlePick}
        onPickError={review.showError}
      />
      {review.phase === "reading" ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the file…
        </p>
      ) : null}
      {review.review === null ? null : (
        <ReviewList
          review={review.review}
          checked={review.checked}
          choices={review.choices}
          isDisabled={isBusy}
          onToggle={review.toggle}
          onChoose={review.choose}
        />
      )}
    </CatalogDialogFrame>
  );
}
