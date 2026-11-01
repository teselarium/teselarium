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

/**
 * Something a mod asks the app to do for the user, checked and decoded, so
 * the app can perform it without more checks. Actions never cross
 * `postMessage`: they go from the session to the stage and the page.
 */
export type AppAction =
  LinkAction | SaveFileAction | ConfirmAction | PlayerAction;
