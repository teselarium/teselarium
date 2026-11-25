import { useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  readUserCatalogSnapshot,
  removeAllUserMosaics,
  STORE_REFUSED_MESSAGE,
  subscribeUserCatalog,
  USER_CATALOG_NOTICE_MESSAGES,
} from "../user_catalog/user_catalog_store.ts";
import type {
  UserCatalogSnapshot,
  UserCatalogStore,
} from "../user_catalog/user_catalog_store.ts";

/** Touch-friendly buttons: at least 32px tall, as on a phone. */
const BUTTON_CLASSES = "min-h-8";

interface UserCatalogRowProps {
  userCatalog: UserCatalogStore;
}

function countStored(entries: readonly UserCatalogEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.place === "browser") {
      count += 1;
    }
  }
  return count;
}

function describeMosaics(count: number): string {
  return `${count} ${count === 1 ? "mosaic" : "mosaics"}`;
}

function describePersistence(persisted: boolean | null): string {
  if (persisted === true) {
    return " This browser keeps them.";
  }
  if (persisted === false) {
    return " This browser may clear the stored mosaics when space runs low: export them to keep a copy.";
  }
  return "";
}

/** "You added 3 mosaics, 2 of them stored in this browser.", and whether the browser keeps them. */
function describeUserMosaics(snapshot: UserCatalogSnapshot): string {
  const total = snapshot.entries.length;
  if (total === 0) {
    return "You have added no mosaic.";
  }
  const stored = countStored(snapshot.entries);
  const counts = `You added ${describeMosaics(total)}, ${stored} of them stored in this browser.`;
  if (stored === 0) {
    return counts;
  }
  return counts + describePersistence(snapshot.persisted);
}

function describeRemoval(snapshot: UserCatalogSnapshot): string {
  const total = snapshot.entries.length;
  const stored = countStored(snapshot.entries);
  const question = `Remove all ${describeMosaics(total)} from your catalog?`;
  if (stored === 0) {
    return question;
  }
  return `${question} The ${stored} stored in this browser ${stored === 1 ? "is" : "are"} deleted.`;
}

/**
 * The user's mosaics in the Catalog group: how many were added, how many are
 * stored in this browser, whether the browser keeps them, and, while any is
 * added, "Remove all", which asks first and removes them without reloading
 * any frame.
 */
export function UserCatalogRow({
  userCatalog,
}: UserCatalogRowProps): ReactElement {
  const snapshot = useStoreSnapshot(
    userCatalog,
    subscribeUserCatalog,
    readUserCatalogSnapshot,
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRemoveAllClick(): void {
    setError(null);
    setIsConfirming(true);
  }

  function handleCancelClick(): void {
    setIsConfirming(false);
  }

  async function removeAll(): Promise<void> {
    try {
      await removeAllUserMosaics(userCatalog);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : String(removeError),
      );
    }
    setIsConfirming(false);
  }

  function handleConfirmClick(): void {
    void removeAll();
  }

  const hasMosaics = snapshot.entries.length > 0;
  return (
    <div className="flex flex-col gap-2 py-2" data-user-mosaics="">
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
          {describeUserMosaics(snapshot)}
          {snapshot.isAvailable ? null : ` ${STORE_REFUSED_MESSAGE}`}
          {snapshot.notice === null
            ? null
            : ` ${USER_CATALOG_NOTICE_MESSAGES[snapshot.notice]}`}
        </p>
        {hasMosaics && !isConfirming ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={BUTTON_CLASSES}
            onClick={handleRemoveAllClick}
          >
            Remove all
          </Button>
        ) : null}
      </div>
      {hasMosaics && isConfirming ? (
        <div
          role="group"
          aria-label="Remove all your mosaics"
          className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2"
        >
          <p className="m-0 min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
            {describeRemoval(snapshot)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={BUTTON_CLASSES}
            onClick={handleCancelClick}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className={BUTTON_CLASSES}
            onClick={handleConfirmClick}
          >
            Remove {describeMosaics(snapshot.entries.length)}
          </Button>
        </div>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
