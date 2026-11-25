import { useId, useState } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { Input } from "@/vendor/shadcn/ui/input.tsx";
import { Label } from "@/vendor/shadcn/ui/label.tsx";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { resolveMosaicReference } from "../../lib/mosaic/index.ts";
import { buildRemoteEntry } from "../../lib/user_catalog/index.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import { isListedMosaic, loadUserMosaic } from "./user_catalog_reads.ts";
import {
  applyUserCatalogChanges,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** The message of an address that is not `http:` or `https:`. */
export const WRONG_SCHEME_MESSAGE =
  "The address must start with http:// or https://.";

/** The message of a mosaic the catalog already lists. */
export const ALREADY_LISTED_MESSAGE = "The catalog already lists this mosaic.";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

interface AddMosaicDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The resolved address the field starts with, or `null`. */
  suggested: string | null;
  userCatalog: UserCatalogStore;
  onAnswer: (id: number, accepted: boolean) => void;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The typed address as a mosaic file's address, or `null` when it is not `http:` or `https:`. */
function readWebMosaicAddress(typed: string): string | null {
  const trimmed = typed.trim();
  if (!URL.canParse(trimmed) || !WEB_PROTOCOLS.has(new URL(trimmed).protocol)) {
    return null;
  }
  return resolveMosaicReference(trimmed, undefined);
}

/**
 * Adds the mosaic at the typed address as a remote entry, after reading its
 * file, without its mod or collection. Resolves with the reason it was not
 * added, or `null` once it is.
 */
async function addRemoteMosaic(
  store: UserCatalogStore,
  typed: string,
): Promise<string | null> {
  const address = readWebMosaicAddress(typed);
  if (address === null) {
    return WRONG_SCHEME_MESSAGE;
  }
  // The stage lists the user's mosaics once the store has read them.
  await waitForUserCatalogStart(store);
  if (await isListedMosaic(store, address)) {
    return ALREADY_LISTED_MESSAGE;
  }
  try {
    await loadUserMosaic(store, address);
    await applyUserCatalogChanges(store, {
      putFiles: [],
      putEntries: [buildRemoteEntry(address, new Date())],
      deleteAddresses: [],
    });
    return null;
  } catch (error) {
    return describeError(error);
  }
}

/**
 * `userCatalog.add`: "Add a mosaic", with a field for the mosaic's address,
 * filled with the suggested one. "Add" reads the mosaic file and adds it as a
 * remote entry, then answers `true`. A wrong address, a file that cannot be
 * read or is not a mosaic, and a mosaic the catalog already lists are shown,
 * and nothing is added. Cancel and Escape answer `false`.
 */
export function AddMosaicDialog({
  shownId,
  mod,
  suggested,
  userCatalog,
  onAnswer,
}: AddMosaicDialogProps): ReactElement {
  const fieldId = useId();
  const [typed, setTyped] = useState(suggested ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  async function addTyped(): Promise<void> {
    setIsAdding(true);
    setError(null);
    const reason = await addRemoteMosaic(userCatalog, typed);
    setIsAdding(false);
    if (reason === null) {
      onAnswer(shownId, true);
      return;
    }
    setError(reason);
  }

  function handleAdd(): void {
    void addTyped();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (typed.trim() !== "" && !isAdding) {
      handleAdd();
    }
  }

  function handleTypedChange(event: ChangeEvent<HTMLInputElement>): void {
    setTyped(event.target.value);
  }

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Add a mosaic"
      mod={mod}
      error={error}
      acceptLabel="Add"
      isAcceptDisabled={typed.trim() === "" || isAdding}
      onAccept={handleAdd}
      onCancel={handleCancel}
    >
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Label htmlFor={fieldId}>Mosaic address</Label>
        <Input
          id={fieldId}
          type="url"
          className="min-h-8"
          placeholder="https://example.org/mosaics/map.yaml"
          value={typed}
          disabled={isAdding}
          onChange={handleTypedChange}
        />
        <p className="m-0 text-sm text-muted-foreground">
          The mosaic stays on its site: your catalog keeps its address.
        </p>
      </form>
      {isAdding ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Reading the mosaic…
        </p>
      ) : null}
    </CatalogDialogFrame>
  );
}
