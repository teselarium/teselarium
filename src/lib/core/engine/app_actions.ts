import type { PlayerShape } from "../players/index.ts";

/** The largest file `files.save` accepts, in bytes: 20 MB. */
export const MAX_SAVE_BYTES = 20 * 1024 * 1024;

/** `links.open`: open a web address in a new tab. */
export interface LinkAction {
  kind: "link";
  /** The normalized `href`, which the dialog shows and opens. */
  url: string;
}

/** `files.save`: download a file. */
export interface SaveFileAction {
  kind: "save";
  name: string;
  type: string;
  /** The file's content: text encoded as UTF-8, or decoded base64. */
  bytes: Uint8Array<ArrayBuffer>;
}

/** `ui.confirm`: ask the user a question with two buttons. */
export interface ConfirmAction {
  kind: "confirm";
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

/** `players.open`: show a player of the mod's tiles in the app's dialog, after asking. */
export interface PlayerAction {
  kind: "player";
  /** The title the tile gives the player, which the dialog shows as plain text, or `null`. */
  title: string | null;
  /** The address the player frame loads. */
  frameUrl: string;
  /** The host of `frameUrl`, which the dialog asks about. */
  host: string;
  /** The name of a known site, or `null`. */
  siteName: string | null;
  shape: PlayerShape;
}

/** `userCatalog.import`: the import dialog, to choose files or a folder and review them. */
export interface CatalogImportAction {
  kind: "catalogImport";
}

/** `userCatalog.update`: the update dialog of one stored entry. */
export interface CatalogUpdateAction {
  kind: "catalogUpdate";
  /** The stored entry's `opentesela-browser:` address. */
  address: string;
}

/** `userCatalog.add`: the "Add a mosaic" dialog. */
export interface CatalogAddAction {
  kind: "catalogAdd";
  /** The resolved address the field starts with, or `null` for an empty field. */
  suggested: string | null;
}

/** `userCatalog.export`: the save dialog of one stored entry's file. */
export interface CatalogExportAction {
  kind: "catalogExport";
  /** The stored entry's `opentesela-browser:` address. */
  address: string;
}

/** `userCatalog.remove`: the confirmation that removes one user entry. */
export interface CatalogRemoveAction {
  kind: "catalogRemove";
  /** The user entry's address, stored or remote. */
  address: string;
}

/** `userCatalog.save`: the save confirmation of a draft. Answered with the saved mosaic's address, or `false`. */
export interface CatalogSaveAction {
  kind: "catalogSave";
  /** The draft's text. */
  content: string;
  /** The stored entry it replaces, or `null` for a new mosaic. */
  address: string | null;
  /** For a new mosaic, the address it is a copy of, or `null`. */
  copiedFrom: string | null;
}

/** `userCatalog.history`: the history dialog of one stored entry. */
export interface CatalogHistoryAction {
  kind: "catalogHistory";
  /** The stored entry's `opentesela-browser:` address. */
  address: string;
}

/** `userCatalog.exportFolder`: the save dialog of the `.zip` of one imported folder. */
export interface CatalogExportFolderAction {
  kind: "catalogExportFolder";
  /** The imported folder's name, which at least one stored entry has. */
  folder: string;
}

/** The actions of the `userCatalog.*` requests, which the app's user catalog store applies. */
export type CatalogAction =
  | CatalogImportAction
  | CatalogUpdateAction
  | CatalogAddAction
  | CatalogExportAction
  | CatalogRemoveAction
  | CatalogSaveAction
  | CatalogHistoryAction
  | CatalogExportFolderAction;

const CATALOG_ACTION_KINDS: ReadonlySet<string> = new Set<
  CatalogAction["kind"]
>([
  "catalogImport",
  "catalogUpdate",
  "catalogAdd",
  "catalogExport",
  "catalogRemove",
  "catalogSave",
  "catalogHistory",
  "catalogExportFolder",
]);

/** Whether the action is one of the `userCatalog.*` requests'. */
export function isCatalogAction(action: AppAction): action is CatalogAction {
  return CATALOG_ACTION_KINDS.has(action.kind);
}

/**
 * The user's answer to an action: whether they accepted it, or, for a save
 * confirmation that saved, the saved mosaic's address.
 */
export type ActionAnswer = boolean | string;

/**
 * Something a mod asks the app to do for the user, checked and decoded, so
 * the app can perform it without more checks. Actions never cross
 * `postMessage`: they go from the session to the stage and the page.
 */
export type AppAction =
  LinkAction | SaveFileAction | ConfirmAction | PlayerAction | CatalogAction;
