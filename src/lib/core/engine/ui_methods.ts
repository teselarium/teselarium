import type { YamlMapping } from "../../files/index.ts";
import type { ConfirmAction } from "./app_actions.ts";
import {
  askUser,
  readRequiredText,
  throwInvalidParams,
} from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_LABEL_LENGTH = 40;

function checkLength(text: string, fieldName: string, maxLength: number): void {
  if (text.length > maxLength) {
    throwInvalidParams(
      "ui.confirm",
      `"${fieldName}" must be at most ${maxLength} characters long`,
    );
  }
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
  checkLength(label, fieldName, MAX_LABEL_LENGTH);
  return label;
}

/**
 * Reads the params of `ui.confirm { message, confirmLabel?, cancelLabel? }`
 * into a confirm action. The labels default to `OK` and `Cancel`. Raises
 * `INVALID_PARAMS`.
 */
export function readConfirm(params: YamlMapping): ConfirmAction {
  const message = readRequiredText(params, "message", "ui.confirm");
  checkLength(message, "message", MAX_MESSAGE_LENGTH);
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

/** The `ui.*` requests: questions the app asks the user. */
export const UI_METHODS: ModMethodTable = {
  "ui.confirm": confirmWithUser,
};
