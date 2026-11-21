import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { Mock } from "vitest";
import type { CatalogAction } from "../lib/core/stage/index.ts";
import { createMemoryBrowserDatabase } from "../lib/core/storage/index.ts";
import type { UserCatalogEntry } from "../lib/user_catalog/index.ts";
import { createRecentlyUsed } from "../main/settings/recently_used.ts";
import { UserCatalogDialog } from "../main/user_catalog/UserCatalogDialog.tsx";
import type {
  UserCatalogDatabase,
  UserCatalogStore,
} from "../main/user_catalog/user_catalog_store.ts";
import { FakeHistory } from "./fake_history.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import { SAMPLE_MOD_SOURCE } from "./sample_mods.ts";
import { buildTestStage } from "./test_stages.ts";
import { createTestUserCatalog } from "./test_user_catalog.ts";

/** The mod that asks in the dialogs' tests. */
export const ASKING_MOD = { title: "Mosaics", source: SAMPLE_MOD_SOURCE };

/** The id of the shown action in the dialogs' tests. */
export const SHOWN_ID = 7;

/** A mosaic file's text, with absolute mod and collection addresses, so loading it requests nothing. */
export function writeTestMosaic(title: string, collection: string): string {
  const text = [
    "mosaic:",
    `  title: "${title}"`,
    '  mod: "https://mods.example.net/book_list/"',
    `  collection: "${collection}"`,
    "",
  ].join("\n");
  return text;
}

export interface DialogFixture {
  store: UserCatalogStore;
  database: UserCatalogDatabase;
  onAnswer: Mock<(id: number, accepted: boolean) => void>;
}

/** A user catalog store on a memory database holding `entries` and `files`, on a test stage. */
export async function buildDialogFixture(
  entries: readonly UserCatalogEntry[] = [],
  files: ReadonlyMap<string, string> = new Map(),
  database: UserCatalogDatabase | null = createMemoryBrowserDatabase(),
): Promise<DialogFixture> {
  const filled = database ?? createMemoryBrowserDatabase<UserCatalogEntry>();
  const putFiles: { address: string; text: string }[] = [];
  for (const [address, text] of files) {
    putFiles.push({ address, text });
  }
  await filled.apply({
    putFiles,
    putEntries: [...entries],
    deleteAddresses: [],
  });
  const stage = buildTestStage(new FakeHistory(""));
  const store = createTestUserCatalog(
    stage,
    createRecentlyUsed({ storage: createMemoryStorage() }),
    { database, entries: await filled.readEntries() },
  );
  const fixture: DialogFixture = {
    store,
    database: filled,
    onAnswer: vi.fn<(id: number, accepted: boolean) => void>(),
  };
  return fixture;
}

/** Renders the dialog of `action`, and returns its `<dialog>`. */
export function renderCatalogDialog(
  fixture: DialogFixture,
  action: CatalogAction,
): HTMLDialogElement {
  render(
    <UserCatalogDialog
      shown={{ id: SHOWN_ID, mod: ASKING_MOD, action }}
      userCatalog={fixture.store}
      onAnswer={fixture.onAnswer}
    />,
  );
  const dialog = document.querySelector("dialog");
  if (dialog === null) {
    throw new Error("Expected a dialog element");
  }
  return dialog;
}

/** A picked file, with its path inside a picked folder when `relativePath` is given. */
export function buildPickedFile(
  name: string,
  text: string,
  relativePath = "",
): File {
  const file = new File([text], name, { type: "application/yaml" });
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

/** Picks files with the input labeled `label`. */
export function pickWithInput(label: string, files: File[]): void {
  fireEvent.change(screen.getByLabelText(label), { target: { files } });
}

/** Presses Escape on the dialog, as the browser's `cancel` event. */
export function pressEscape(dialog: HTMLDialogElement): Event {
  const cancelEvent = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancelEvent);
  return cancelEvent;
}
