import type { ActionAnswer } from "../../lib/core/engine/index.ts";
import type { BrowserDatabaseChanges } from "../../lib/core/storage/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { applyUserCatalogChanges } from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/**
 * Answers the save question of an export: once saved, the exported entries
 * are synced with their current version, so they are unchanged since
 * export. The file is already downloaded, so a failed sync still answers
 * `true`, and the entries stay changed since export.
 */
export async function applyExportSync(
  store: UserCatalogStore,
  changes: BrowserDatabaseChanges<UserCatalogEntry>,
  onAnswer: (id: number, answer: ActionAnswer) => void,
  id: number,
  accepted: boolean,
): Promise<void> {
  if (!accepted) {
    onAnswer(id, false);
    return;
  }
  try {
    await applyUserCatalogChanges(store, changes);
  } catch {
    // Saved anyway: the entries stay changed since export.
  }
  onAnswer(id, true);
}
