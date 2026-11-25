import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
  REQUESTING_MOD_SOURCE,
} from "../../../test/method_contexts.ts";
import type { ConfirmAction } from "./app_actions.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ModMethodContext, UserNotification } from "./mod_methods.ts";
import { readConfirm, UI_METHODS } from "./ui_methods.ts";

function confirm(context: ModMethodContext, params: object): Promise<unknown> {
  return UI_METHODS["ui.confirm"](context, params as never);
}

function readParams(params: object): ConfirmAction {
  return readConfirm(params as never);
}

function catchConfirmError(
  params: object,
): ReturnType<typeof catchMethodError> {
  return catchMethodError(readParams.bind(undefined, params));
}

describe("readConfirm", function describeReadConfirm(): void {
  it("Message too long", async function rejectsLongMessage(): Promise<void> {
    const error = await catchConfirmError({ message: "a".repeat(1001) });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'ui.confirm: "message" must be at most 1000 characters long',
    );
  });

  it("Message too long (label)", async function rejectsLongLabel(): Promise<void> {
    for (const fieldName of ["confirmLabel", "cancelLabel"]) {
      const error = await catchConfirmError({
        message: "Delete this list?",
        [fieldName]: "a".repeat(41),
      });

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        `ui.confirm: "${fieldName}" must be at most 40 characters long`,
      );
    }
  });

  it("accepts a message of 1000 characters and labels of 40", function acceptsLimits(): void {
    const action = readParams({
      message: "a".repeat(1000),
      confirmLabel: "b".repeat(40),
      cancelLabel: "c".repeat(40),
    });

    expect(action.message).toHaveLength(1000);
    expect(action.confirmLabel).toHaveLength(40);
    expect(action.cancelLabel).toHaveLength(40);
  });

  it("rejects a missing or empty message", async function rejectsEmptyMessage(): Promise<void> {
    for (const params of [{}, { message: "" }, { message: 3 }]) {
      const error = await catchConfirmError(params);

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'ui.confirm: "message" must be a non-empty string',
      );
    }
  });

  it("rejects an empty label or one that is not a string", async function rejectsEmptyLabel(): Promise<void> {
    for (const label of ["", 3, null]) {
      const error = await catchConfirmError({
        message: "Delete this list?",
        confirmLabel: label,
      });

      expect(error.message).toBe(
        'ui.confirm: "confirmLabel" must be a non-empty string',
      );
    }
  });

  it("defaults the labels to OK and Cancel", function defaultsLabels(): void {
    expect(readParams({ message: "Delete this list?" })).toEqual({
      kind: "confirm",
      message: "Delete this list?",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
    });
  });

  it("keeps the given labels", function keepsLabels(): void {
    const action = readParams({
      message: "Delete this list?",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });

    expect(action.confirmLabel).toBe("Delete");
    expect(action.cancelLabel).toBe("Keep");
  });
});

describe("ui.confirm", function describeUiConfirm(): void {
  it("asks the user and answers true when confirmed", async function asksUser(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    const result = await confirm(context, {
      message: "Delete this list?",
      confirmLabel: "Delete",
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "confirm",
      message: "Delete this list?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
  });

  it("answers false when the user cancels", async function answersCancel(): Promise<void> {
    const { context } = buildAskingContext(false);

    const result = await confirm(context, { message: "Delete this list?" });

    expect(result).toBe(false);
  });

  it("Hidden mod asks for a confirmation", async function refusesHidden(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(null);

    const error = await catchMethodError(
      confirm.bind(undefined, context, { message: "Delete this list?" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "ui.confirm: only the visible mod can ask the user",
    );
    expect(requestSpy).toHaveBeenCalledOnce();
  });

  it("shows no dialog for a message too long", async function asksNothing(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    await catchMethodError(
      confirm.bind(undefined, context, { message: "a".repeat(1001) }),
    );

    expect(requestSpy).not.toHaveBeenCalled();
  });
});

const KALLOCAIN_SOURCE = "https://example.org/books/kallocain.md";

/** A hidden mod's context (it cannot ask the user) whose `onNotify` is a spy. */
function buildNotifyingContext(): {
  context: ModMethodContext;
  notifySpy: Mock<(notification: UserNotification) => void>;
} {
  const { context } = buildAskingContext(null);
  const notifySpy = vi.fn<(notification: UserNotification) => void>();
  context.onNotify = notifySpy;
  const notifyingContext = { context, notifySpy };
  return notifyingContext;
}

function notify(context: ModMethodContext, params: object): Promise<unknown> {
  return UI_METHODS["ui.notify"](context, params as never);
}

describe("ui.notify", function describeNotify(): void {
  it("Notification with the defaults", async function notifiesWithDefaults(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);
    const notifySpy = vi.fn<(notification: UserNotification) => void>();
    context.onNotify = notifySpy;

    const result = await notify(context, { message: "Saved" });

    expect(result).toBeNull();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalledExactlyOnceWith({
      level: "info",
      source: REQUESTING_MOD_SOURCE,
      text: "Saved",
    });
  });

  it("Error about a tile", async function notifiesTileError(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    await notify(context, {
      message: "Cannot read the rating",
      level: "error",
      source: KALLOCAIN_SOURCE,
    });

    expect(notifySpy).toHaveBeenCalledExactlyOnceWith({
      level: "error",
      source: KALLOCAIN_SOURCE,
      text: "Cannot read the rating",
    });
  });

  it("Hidden mod", async function acceptsHiddenMod(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    const result = await notify(context, { message: "Done", level: "warning" });

    expect(result).toBeNull();
    expect(notifySpy).toHaveBeenCalledOnce();
  });

  it("Same message twice", async function notifiesTwice(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    await notify(context, { message: "Saved" });
    await notify(context, { message: "Saved" });

    expect(notifySpy).toHaveBeenCalledTimes(2);
  });

  it("accepts a message and a source of 1000 characters", async function acceptsLimits(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    await notify(context, {
      message: "a".repeat(1000),
      source: "b".repeat(1000),
    });

    expect(notifySpy).toHaveBeenCalledOnce();
  });

  it("Message too long", async function rejectsLongMessage(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    const error = await catchMethodError(
      notify.bind(undefined, context, { message: "a".repeat(1001) }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'ui.notify: "message" must be at most 1000 characters long',
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it("Unknown level", async function rejectsUnknownLevel(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    const error = await catchMethodError(
      notify.bind(undefined, context, { message: "Saved", level: "success" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'ui.notify: "level" must be "info", "warning" or "error"',
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it("Missing message", async function rejectsMissingMessage(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    const error = await catchMethodError(notify.bind(undefined, context, {}));

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'ui.notify: "message" must be a non-empty string',
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it("rejects a source of 1001 characters or an empty one", async function rejectsBadSource(): Promise<void> {
    const { context, notifySpy } = buildNotifyingContext();

    const longError = await catchMethodError(
      notify.bind(undefined, context, {
        message: "Saved",
        source: "a".repeat(1001),
      }),
    );
    const emptyError = await catchMethodError(
      notify.bind(undefined, context, { message: "Saved", source: "" }),
    );

    expect(longError.code).toBe(INVALID_PARAMS);
    expect(longError.message).toBe(
      'ui.notify: "source" must be at most 1000 characters long',
    );
    expect(emptyError.message).toBe(
      'ui.notify: "source" must be a non-empty string',
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
