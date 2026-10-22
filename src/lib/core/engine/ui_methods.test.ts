import { describe, expect, it } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import type { ConfirmAction } from "./app_actions.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";
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
