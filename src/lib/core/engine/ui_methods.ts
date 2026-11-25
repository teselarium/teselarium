import type { YamlMapping } from "../../files/index.ts";
import type { ConfirmAction } from "./app_actions.ts";
import {
  askUser,
  readRequiredText,
  throwInvalidParams,
} from "./mod_methods.ts";
import type {
  ModMethodContext,
  ModMethodTable,
  UserNotification,
  UserNotificationLevel,
} from "./mod_methods.ts";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_LABEL_LENGTH = 40;

const NOTIFICATION_LEVELS: readonly UserNotificationLevel[] = [
  "info",
  "warning",
  "error",
];

function checkLength(
  method: string,
  text: string,
  fieldName: string,
  maxLength: number,
): void {
  if (text.length > maxLength) {
    throwInvalidParams(
      method,
      `"${fieldName}" must be at most ${maxLength} characters long`,
    );
  }
}

/** Reads a param that must be a non-empty string of at most `MAX_MESSAGE_LENGTH` characters. */
function readMessageText(
  params: YamlMapping,
  fieldName: string,
  method: string,
): string {
  const text = readRequiredText(params, fieldName, method);
  checkLength(method, text, fieldName, MAX_MESSAGE_LENGTH);
  return text;
}

function readLabel(
  params: YamlMapping,
  fieldName: string,
  defaultLabel: string,
): string {
  if (params[fieldName] === undefined) {
    return defaultLabel;
  }
  const label = readRequiredText(params, fieldName, "ui.confirm");
  checkLength("ui.confirm", label, fieldName, MAX_LABEL_LENGTH);
  return label;
}

/**
 * Reads the params of `ui.confirm { message, confirmLabel?, cancelLabel? }`
 * into a confirm action. The labels default to `OK` and `Cancel`. Raises
 * `INVALID_PARAMS`.
 */
export function readConfirm(params: YamlMapping): ConfirmAction {
  const message = readMessageText(params, "message", "ui.confirm");
  const action: ConfirmAction = {
    kind: "confirm",
    message,
    confirmLabel: readLabel(params, "confirmLabel", "OK"),
    cancelLabel: readLabel(params, "cancelLabel", "Cancel"),
  };
  return action;
}

/**
 * `ui.confirm { message, confirmLabel?, cancelLabel? }`: asks the user in a
 * dialog the app draws, and answers whether the user confirmed.
 */
async function confirmWithUser(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  return askUser(context, "ui.confirm", readConfirm(params));
}

function isNotificationLevel(value: unknown): value is UserNotificationLevel {
  return NOTIFICATION_LEVELS.includes(value as UserNotificationLevel);
}

function readNotificationLevel(params: YamlMapping): UserNotificationLevel {
  const level = params.level;
  if (level === undefined) {
    return "info";
  }
  if (!isNotificationLevel(level)) {
    throwInvalidParams(
      "ui.notify",
      '"level" must be "info", "warning" or "error"',
    );
  }
  return level;
}

/**
 * Reads the params of `ui.notify { message, level?, source? }` into a
 * notification. `level` defaults to `info`, and `source` to `modSource`.
 * Raises `INVALID_PARAMS`.
 */
export function readNotification(
  params: YamlMapping,
  modSource: string,
): UserNotification {
  const text = readMessageText(params, "message", "ui.notify");
  const level = readNotificationLevel(params);
  const source =
    params.source === undefined
      ? modSource
      : readMessageText(params, "source", "ui.notify");
  const notification: UserNotification = { level, source, text };
  return notification;
}

/**
 * `ui.notify { message, level?, source? }`: adds a message from the mod to
 * its sandbox's stage bar, without a dialog and without any permission, from
 * visible and hidden mods alike. Each request is a new message: nothing is
 * deduped. Answers `null`.
 */
async function notifyUser(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<null> {
  context.onNotify(readNotification(params, context.mod.source));
  return null;
}

/** The `ui.*` requests: the app's UI for the mod, its dialogs and its stage bar. */
export const UI_METHODS: ModMethodTable = {
  "ui.confirm": confirmWithUser,
  "ui.notify": notifyUser,
};
