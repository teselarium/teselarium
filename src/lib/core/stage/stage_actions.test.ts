import { describe, expect, it } from "vitest";
import type { AppAction } from "../engine/index.ts";
import {
  addStageAction,
  answerAction,
  createStageActions,
  dropActions,
  readShownAction,
} from "./stage_actions.ts";

const MOD = { title: "Book List", source: "https://example.org/mod_conf.yaml" };

function buildConfirm(message: string): AppAction {
  const action: AppAction = {
    kind: "confirm",
    message,
    confirmLabel: "OK",
    cancelLabel: "Cancel",
  };
  return action;
}

function isSandboxOne(sandboxId: string): boolean {
  return sandboxId === "sandbox-1";
}

describe("stage actions", function describeStageActions(): void {
  it("shows the oldest action, then the next once it is answered", async function showsInOrder(): Promise<void> {
    const actions = createStageActions();

    const first = addStageAction(
      actions,
      "sandbox-1",
      MOD,
      buildConfirm("First"),
    );
    addStageAction(actions, "sandbox-1", MOD, buildConfirm("Second"));

    expect(readShownAction(actions)).toMatchObject({
      id: 1,
      sandboxId: "sandbox-1",
      mod: MOD,
      action: { message: "First" },
    });
    expect(answerAction(actions, 1, true)).toBe(true);
    await expect(first).resolves.toBe(true);
    expect(readShownAction(actions)).toMatchObject({
      id: 2,
      action: { message: "Second" },
    });
  });

  it("ignores an unknown id", function ignoresUnknownId(): void {
    const actions = createStageActions();
    addStageAction(actions, "sandbox-1", MOD, buildConfirm("First"));

    expect(answerAction(actions, 7, true)).toBe(false);
    expect(readShownAction(actions)?.id).toBe(1);
  });

  it("shows nothing when the queue is empty", function showsNothing(): void {
    expect(readShownAction(createStageActions())).toBeNull();
  });

  it("drops the actions of other sandboxes with false", async function dropsOthers(): Promise<void> {
    const actions = createStageActions();
    const kept = addStageAction(
      actions,
      "sandbox-1",
      MOD,
      buildConfirm("Kept"),
    );
    const dropped = addStageAction(
      actions,
      "sandbox-2",
      MOD,
      buildConfirm("Dropped"),
    );

    expect(dropActions(actions, isSandboxOne)).toBe(true);
    await expect(dropped).resolves.toBe(false);
    expect(actions.entries).toHaveLength(1);
    expect(readShownAction(actions)?.action).toMatchObject({ message: "Kept" });
    answerAction(actions, 1, false);
    await expect(kept).resolves.toBe(false);
  });

  it("tells when it dropped nothing", function dropsNothing(): void {
    const actions = createStageActions();
    addStageAction(actions, "sandbox-1", MOD, buildConfirm("Kept"));

    expect(dropActions(actions, isSandboxOne)).toBe(false);
  });
});
