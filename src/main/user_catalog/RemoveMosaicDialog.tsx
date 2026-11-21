import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { findUserEntry } from "../../lib/user_catalog/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import {
  cancelTicket,
  createReadTicket,
  keepIfCurrent,
} from "./read_tickets.ts";
import { loadUserMosaic } from "./user_catalog_reads.ts";
import {
  applyUserCatalogChanges,
  readUserCatalogSnapshot,
  subscribeUserCatalog,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The message of a removal whose entry left the user catalog after the request. */
export const GONE_USER_ENTRY_MESSAGE =
  "This mosaic is no longer in your catalog.";

interface RemoveMosaicDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The user entry's address. */
  address: string;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, accepted: boolean) => void;
}

/** The name a mosaic goes by before its title is read: its file name, or its address. */
function readFallbackTitle(address: string): string {
  const segments = new URL(address).pathname.split("/");
  const fileName = decodeURIComponent(segments[segments.length - 1]);
  return fileName === "" ? address : fileName;
}

async function readMosaicTitle(
  store: UserCatalogStore,
  address: string,
): Promise<string> {
  try {
    const mosaic = await loadUserMosaic(store, address);
    return mosaic.title;
  } catch {
    return readFallbackTitle(address);
  }
}

function describeRemoval(entry: UserCatalogEntry, title: string): string {
  if (entry.place === "browser") {
    return `Remove "${title}" from your catalog? Its file is deleted from this browser.`;
  }
  return `Remove "${title}" from your catalog? The mosaic stays on its site.`;
}

/**
 * `userCatalog.remove`: "Remove a mosaic", a confirmation that names the
 * mosaic's title and says whether its file is deleted from this browser.
 * "Remove" removes the entry and, for a stored one, its file, then answers
 * `true`. Cancel and Escape answer `false`.
 */
export function RemoveMosaicDialog({
  shownId,
  mod,
  address,
  userCatalog,
  onAnswer,
}: RemoveMosaicDialogProps): ReactElement {
  const snapshot = useStoreSnapshot(
    userCatalog,
    subscribeUserCatalog,
    readUserCatalogSnapshot,
  );
  const entry = findUserEntry(snapshot.entries, address);
  const [title, setTitle] = useState(readFallbackTitle(address));
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(
    function readTitle(): () => void {
      const ticket = createReadTicket();
      void readMosaicTitle(userCatalog, address).then(
        (keepIfCurrent<string>).bind(undefined, ticket, setTitle),
      );
      return cancelTicket.bind(undefined, ticket);
    },
    [userCatalog, address],
  );

  async function removeEntry(): Promise<void> {
    setIsRemoving(true);
    setError(null);
    try {
      await applyUserCatalogChanges(userCatalog, {
        putFiles: [],
        putEntries: [],
        deleteAddresses: [address],
      });
      onAnswer(shownId, true);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : String(removeError),
      );
      setIsRemoving(false);
    }
  }

  function handleRemove(): void {
    void removeEntry();
  }

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Remove a mosaic"
      mod={mod}
      error={
        entry === null && snapshot.isStarted ? GONE_USER_ENTRY_MESSAGE : error
      }
      acceptLabel="Remove"
      isAcceptDestructive
      isAcceptDisabled={entry === null || isRemoving}
      onAccept={handleRemove}
      onCancel={handleCancel}
    >
      {entry === null ? null : (
        <p className="m-0 [overflow-wrap:anywhere]" data-remove-message="">
          {describeRemoval(entry, title)}
        </p>
      )}
    </CatalogDialogFrame>
  );
}
