import type {
  MessageLevel,
  MessageSnapshot,
  SandboxSnapshot,
} from "../../lib/core/stage/index.ts";

/** An id per level: `0` for none. */
type LevelIds = Readonly<Record<MessageLevel, number>>;

/**
 * What the stage bar has seen of the visible sandbox's messages, and what
 * draws the user's attention to the new ones. It is view state: whether a
 * message is new depends on what the user saw.
 */
export interface MessageAttention {
  sandboxId: string;
  /** The highest message id seen per level. */
  latestIds: LevelIds;
  /** Per level, the id of the newest message that flashed. A new id restarts its button's flash. */
  flashIds: LevelIds;
  /** The text announced for the newest error that arrived, or `""`. */
  announcement: string;
}

const NO_IDS: LevelIds = Object.freeze({ error: 0, warning: 0, info: 0 });

const PRODUCER_LABELS = Object.freeze({ app: "App", mod: "Mod" });

function readLatestIds(messages: readonly MessageSnapshot[]): LevelIds {
  const latestIds = { ...NO_IDS };
  for (const message of messages) {
    latestIds[message.level] = Math.max(latestIds[message.level], message.id);
  }
  return Object.freeze(latestIds);
}

function haveSameIds(first: LevelIds, second: LevelIds): boolean {
  return (
    first.error === second.error &&
    first.warning === second.warning &&
    first.info === second.info
  );
}

function findMessage(
  messages: readonly MessageSnapshot[],
  id: number,
): MessageSnapshot | null {
  for (const message of messages) {
    if (message.id === id) {
      return message;
    }
  }
  return null;
}

function describeNewError(message: MessageSnapshot | null): string {
  if (message === null) {
    return "";
  }
  const announcement = `New error from ${PRODUCER_LABELS[message.producer]}: ${message.text}`;
  return announcement;
}

/** The attention of a sandbox just shown: what it has is seen, and nothing flashes. */
export function startAttention(sandbox: SandboxSnapshot): MessageAttention {
  const attention: MessageAttention = {
    sandboxId: sandbox.id,
    latestIds: readLatestIds(sandbox.messages),
    flashIds: NO_IDS,
    announcement: "",
  };
  return Object.freeze(attention);
}

function readFlashId(
  previous: MessageAttention,
  latestIds: LevelIds,
  level: MessageLevel,
): number {
  if (latestIds[level] > previous.latestIds[level]) {
    return latestIds[level];
  }
  return previous.flashIds[level];
}

/**
 * Follows the visible sandbox: a level whose newest message is newer than
 * the one seen flashes, and a new error is announced. Another sandbox starts
 * again without flashing, so messages that arrived while it was hidden do
 * not flash. Returns `previous` itself when nothing changed.
 */
export function followAttention(
  previous: MessageAttention,
  sandbox: SandboxSnapshot,
): MessageAttention {
  if (previous.sandboxId !== sandbox.id) {
    return startAttention(sandbox);
  }
  const latestIds = readLatestIds(sandbox.messages);
  if (haveSameIds(latestIds, previous.latestIds)) {
    return previous;
  }
  const hasNewError = latestIds.error > previous.latestIds.error;
  const attention: MessageAttention = {
    sandboxId: sandbox.id,
    latestIds,
    flashIds: Object.freeze({
      error: readFlashId(previous, latestIds, "error"),
      warning: readFlashId(previous, latestIds, "warning"),
      info: readFlashId(previous, latestIds, "info"),
    }),
    announcement: hasNewError
      ? describeNewError(findMessage(sandbox.messages, latestIds.error))
      : previous.announcement,
  };
  return Object.freeze(attention);
}
