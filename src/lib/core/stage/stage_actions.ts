import type { ActionAnswer, AppAction } from "../engine/index.ts";

/** The mod that asked, as the action dialog names it. */
export interface ActionMod {
  title: string;
  source: string;
}

/** An action a sandbox asked for, waiting for the user's answer. */
export interface StageActionEntry {
  /** Given by the stage, so the page answers the action it shows and not a later one. */
  id: number;
  sandboxId: string;
  mod: ActionMod;
  action: AppAction;
  /** Whether the user pressed Play on a player action: dropping it then answers `true`. */
  isPlaying: boolean;
  resolve: (answer: ActionAnswer) => void;
}

/** The stage's queue of actions, oldest first. Only the first one is shown. Mutable. */
export interface StageActions {
  entries: StageActionEntry[];
  nextId: number;
}

export function createStageActions(): StageActions {
  const actions: StageActions = { entries: [], nextId: 1 };
  return actions;
}

function placeEntry(
  actions: StageActions,
  sandboxId: string,
  mod: ActionMod,
  action: AppAction,
  resolve: (answer: ActionAnswer) => void,
): void {
  actions.entries.push({
    id: actions.nextId,
    sandboxId,
    mod,
    action,
    isPlaying: false,
    resolve,
  });
  actions.nextId += 1;
}

/** Adds an action at the end of the queue. Resolves with the user's answer. */
export function addStageAction(
  actions: StageActions,
  sandboxId: string,
  mod: ActionMod,
  action: AppAction,
): Promise<ActionAnswer> {
  return new Promise(
    placeEntry.bind(undefined, actions, sandboxId, mod, action),
  );
}

/** The action to show: the oldest one, or `null`. */
export function readShownAction(
  actions: StageActions,
): StageActionEntry | null {
  return actions.entries[0] ?? null;
}

/**
 * Resolves the action `id` with the answer and removes it. Returns `false`,
 * and does nothing, for an unknown id: a double click, or an action dropped
 * meanwhile.
 */
export function answerAction(
  actions: StageActions,
  id: number,
  answer: ActionAnswer,
): boolean {
  for (const [index, entry] of actions.entries.entries()) {
    if (entry.id === id) {
      actions.entries.splice(index, 1);
      entry.resolve(answer);
      return true;
    }
  }
  return false;
}

/**
 * Records that the player of action `id` is playing, so dropping it answers
 * `true`. Returns `false`, and does nothing, for an unknown id or an action
 * that is not a player.
 */
export function markActionPlaying(actions: StageActions, id: number): boolean {
  for (const entry of actions.entries) {
    if (entry.id === id && entry.action.kind === "player") {
      entry.isPlaying = true;
      return true;
    }
  }
  return false;
}

/**
 * Removes every action whose sandbox `canAsk` refuses, and resolves it with
 * `false`, or `true` for a player that was playing. Returns whether any
 * action was dropped.
 */
export function dropActions(
  actions: StageActions,
  canAsk: (sandboxId: string) => boolean,
): boolean {
  const kept: StageActionEntry[] = [];
  const dropped: StageActionEntry[] = [];
  for (const entry of actions.entries) {
    if (canAsk(entry.sandboxId)) {
      kept.push(entry);
    } else {
      dropped.push(entry);
    }
  }
  actions.entries = kept;
  for (const entry of dropped) {
    entry.resolve(entry.isPlaying);
  }
  return dropped.length > 0;
}
