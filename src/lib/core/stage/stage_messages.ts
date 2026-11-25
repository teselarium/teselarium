import type { ModIssue } from "../../mod/index.ts";
import type { IssueLevel } from "../../tile/index.ts";

/**
 * A message's level: the issue levels, and `info` for notifications. Only
 * the stage has `info`: mods, the engine's issues and the check never see it.
 */
export type MessageLevel = IssueLevel | "info";

/** Who produced a message: the app, or the sandbox's mod with `ui.notify`. */
export type MessageProducer = "app" | "mod";

/** What a message says, before it gets its id. */
export interface MessageContent {
  level: MessageLevel;
  producer: MessageProducer;
  /** What the message is about: a file, a tile or the mod's source. */
  source: string;
  /** Plain text. */
  text: string;
}

/** One message of a sandbox's stage bar. */
export interface SandboxMessage extends MessageContent {
  /** Increases within its sandbox, so a newer message has a higher id. */
  id: number;
}

/** How many messages from the mod were dropped, per level. */
export type DroppedMessageCounts = Record<MessageLevel, number>;

/** A sandbox's arrival list and the mod's dropped counts, which the cap changes together. */
export interface ArrivedMessages {
  messages: SandboxMessage[];
  droppedModMessages: DroppedMessageCounts;
}

/** A sandbox keeps at most this many messages from its mod for each level. */
export const MAX_MOD_MESSAGES = 100;

/** The levels in the order of the stage bar's buttons. */
export const MESSAGE_LEVELS: readonly MessageLevel[] = Object.freeze([
  "error",
  "warning",
  "info",
]);

export function buildSandboxMessage(
  id: number,
  content: MessageContent,
): SandboxMessage {
  const message: SandboxMessage = {
    id,
    level: content.level,
    producer: content.producer,
    source: content.source,
    text: content.text,
  };
  return message;
}

/** One message per content, numbered from `firstId` in order. */
export function buildSandboxMessages(
  firstId: number,
  contents: readonly MessageContent[],
): SandboxMessage[] {
  const messages: SandboxMessage[] = [];
  for (const [index, content] of contents.entries()) {
    messages.push(buildSandboxMessage(firstId + index, content));
  }
  return messages;
}

/** An issue the app found, as a message from the app. */
export function buildAppIssueContent(issue: ModIssue): MessageContent {
  const content: MessageContent = {
    level: issue.level,
    producer: "app",
    source: issue.source,
    text: issue.message,
  };
  return content;
}

/** A notification from the app. */
export function buildAppNotification(
  source: string,
  text: string,
): MessageContent {
  const content: MessageContent = {
    level: "info",
    producer: "app",
    source,
    text,
  };
  return content;
}

export function buildNoDroppedMessages(): DroppedMessageCounts {
  const counts: DroppedMessageCounts = { error: 0, warning: 0, info: 0 };
  return counts;
}

/** The read ids, with every message of `level` added. */
export function markLevelRead(
  messages: readonly SandboxMessage[],
  readIds: ReadonlySet<number>,
  level: MessageLevel,
): Set<number> {
  const newReadIds = new Set(readIds);
  for (const message of messages) {
    if (message.level === level) {
      newReadIds.add(message.id);
    }
  }
  return newReadIds;
}

/** The messages without the notification `messageId`. Errors and warnings cannot be dismissed, so they stay. */
export function dismissNotification(
  messages: readonly SandboxMessage[],
  messageId: number,
): SandboxMessage[] {
  const keptMessages: SandboxMessage[] = [];
  for (const message of messages) {
    if (message.id !== messageId || message.level !== "info") {
      keptMessages.push(message);
    }
  }
  return keptMessages;
}

/** The messages without any notification: "Clear all" leaves the errors and warnings. */
export function removeNotifications(
  messages: readonly SandboxMessage[],
): SandboxMessage[] {
  const keptMessages: SandboxMessage[] = [];
  for (const message of messages) {
    if (message.level !== "info") {
      keptMessages.push(message);
    }
  }
  return keptMessages;
}

function countModMessagesOfLevel(
  messages: readonly SandboxMessage[],
  level: MessageLevel,
): number {
  let count = 0;
  for (const message of messages) {
    if (message.producer === "mod" && message.level === level) {
      count += 1;
    }
  }
  return count;
}

function findOldestModMessageOfLevel(
  messages: readonly SandboxMessage[],
  level: MessageLevel,
): SandboxMessage | null {
  for (const message of messages) {
    if (message.producer === "mod" && message.level === level) {
      return message;
    }
  }
  return null;
}

/**
 * Adds a message from the mod at the end of the arrival list. Past
 * `MAX_MOD_MESSAGES` messages from the mod of the new message's level, the
 * oldest one of that level is removed and counted in that level's dropped
 * count. Messages of the other levels and messages from the app are never
 * removed.
 */
export function addModMessage(
  arrived: ArrivedMessages,
  message: SandboxMessage,
): ArrivedMessages {
  const messages = [...arrived.messages, message];
  const droppedModMessages = { ...arrived.droppedModMessages };
  const oldest =
    countModMessagesOfLevel(messages, message.level) > MAX_MOD_MESSAGES
      ? findOldestModMessageOfLevel(messages, message.level)
      : null;
  if (oldest !== null) {
    messages.splice(messages.indexOf(oldest), 1);
    droppedModMessages[message.level] += 1;
  }
  const newArrived: ArrivedMessages = { messages, droppedModMessages };
  return newArrived;
}
