import { Bell, CircleAlert, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  MessageLevel,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";

/** How the stage bar shows one message level: its button, capsule and popover. */
export interface MessageLevelView {
  level: MessageLevel;
  /** The button's and the popover's name: `Errors`, `Warnings` or `Notifications`. */
  label: string;
  /** What the popover says without messages. */
  emptyText: string;
  /** The messages button's name for one message of the level, such as `1 error`. */
  singularNoun: string;
  /** The messages button's name for any other count, such as `2 errors`. */
  pluralNoun: string;
  icon: LucideIcon;
  /** The icon's color while the level has messages. */
  iconClassName: string;
  /** The capsule's colors while the level has unread messages. */
  unreadCapsuleClassName: string;
  /** The light background of an item marked unread in the level's popover. */
  unreadItemClassName: string;
  /** The color of the dot of an item marked unread. */
  unreadDotClassName: string;
}

/** The levels in the order of the stage bar's buttons. There is no info color in the theme, so info uses `primary`. */
export const MESSAGE_LEVEL_VIEWS: readonly MessageLevelView[] = Object.freeze([
  {
    level: "error",
    label: "Errors",
    emptyText: "No errors.",
    singularNoun: "error",
    pluralNoun: "errors",
    icon: CircleAlert,
    iconClassName: "text-destructive",
    unreadCapsuleClassName: "bg-destructive text-destructive-foreground",
    unreadItemClassName: "bg-destructive/10",
    unreadDotClassName: "bg-destructive",
  },
  {
    level: "warning",
    label: "Warnings",
    emptyText: "No warnings.",
    singularNoun: "warning",
    pluralNoun: "warnings",
    icon: TriangleAlert,
    iconClassName: "text-warning",
    unreadCapsuleClassName: "bg-warning text-background",
    unreadItemClassName: "bg-warning/10",
    unreadDotClassName: "bg-warning",
  },
  {
    level: "info",
    label: "Notifications",
    emptyText: "No notifications.",
    singularNoun: "notification",
    pluralNoun: "notifications",
    icon: Bell,
    iconClassName: "text-primary",
    unreadCapsuleClassName: "bg-primary text-primary-foreground",
    unreadItemClassName: "bg-primary/10",
    unreadDotClassName: "bg-primary",
  },
]);

/** The capsule's colors once every message of the level was read. */
export const READ_CAPSULE_CLASS_NAME = "bg-muted text-muted-foreground";

/** Above this count, the capsule shows `99+`. */
const MAX_SHOWN_COUNT = 99;

/** The messages of one level, in their order. */
export function listLevelMessages(
  messages: readonly MessageSnapshot[],
  level: MessageLevel,
): MessageSnapshot[] {
  const levelMessages: MessageSnapshot[] = [];
  for (const message of messages) {
    if (message.level === level) {
      levelMessages.push(message);
    }
  }
  return levelMessages;
}

function compareNewestFirst(
  first: MessageSnapshot,
  second: MessageSnapshot,
): number {
  return second.id - first.id;
}

/**
 * The messages newest first, as a popover lists them. Ids grow as messages
 * are added to the sandbox, and a reload gives its issues new ids, so the
 * highest id is the newest message. The stage keeps the order they were found in.
 */
export function listNewestFirst(
  messages: readonly MessageSnapshot[],
): MessageSnapshot[] {
  const newestFirst = [...messages].sort(compareNewestFirst);
  return newestFirst;
}

export function countUnreadMessages(
  messages: readonly MessageSnapshot[],
): number {
  let count = 0;
  for (const message of messages) {
    if (!message.isRead) {
      count += 1;
    }
  }
  return count;
}

/** The count in a capsule: the number, or `99+` above 99. */
export function describeCapsuleCount(count: number): string {
  if (count > MAX_SHOWN_COUNT) {
    return `${MAX_SHOWN_COUNT}+`;
  }
  return String(count);
}

/** The accessible name and tooltip of a level's button: the level, the exact count and the unread count. */
export function describeLevelButton(
  view: MessageLevelView,
  count: number,
  unreadCount: number,
): string {
  const description = `${view.label}: ${count}, ${unreadCount} unread`;
  return description;
}

/** The note at the end of a level's popover when the cap dropped messages from the mod. */
export function describeDroppedMessages(count: number): string {
  if (count === 1) {
    return "1 older message from the mod was dropped.";
  }
  const description = `${count} older messages from the mod were dropped.`;
  return description;
}

/** The messages button of a narrow bar: the level whose icon it shows, and whether the sandbox has no messages. */
export interface MessagesButtonView {
  view: MessageLevelView;
  /** No messages at all: the button is dimmed and shows the notifications icon. */
  isEmpty: boolean;
}

/** Whether `messages` hold a message of `level` that passes `isKept`. */
function hasLevelMessage(
  messages: readonly MessageSnapshot[],
  level: MessageLevel,
  isKept: (message: MessageSnapshot) => boolean,
): boolean {
  for (const message of messages) {
    if (message.level === level && isKept(message)) {
      return true;
    }
  }
  return false;
}

function isAnyMessage(): boolean {
  return true;
}

function isUnreadMessage(message: MessageSnapshot): boolean {
  return !message.isRead;
}

/** The most severe level with a message that passes `isKept`, or `null`. */
function findMostSevereView(
  messages: readonly MessageSnapshot[],
  isKept: (message: MessageSnapshot) => boolean,
): MessageLevelView | null {
  for (const view of MESSAGE_LEVEL_VIEWS) {
    if (hasLevelMessage(messages, view.level, isKept)) {
      return view;
    }
  }
  return null;
}

/** The notifications' view: the last of `MESSAGE_LEVEL_VIEWS`. */
function readNotificationsView(): MessageLevelView {
  const view = MESSAGE_LEVEL_VIEWS[MESSAGE_LEVEL_VIEWS.length - 1];
  if (view === undefined) {
    throw new Error("Expected the notifications' level view, the last one");
  }
  return view;
}

/**
 * The messages button's icon: the most severe level that has messages
 * (errors, then warnings, then notifications), or the notifications,
 * dimmed, when the sandbox has none.
 */
export function pickMessagesView(
  messages: readonly MessageSnapshot[],
): MessagesButtonView {
  const view = findMostSevereView(messages, isAnyMessage);
  const buttonView: MessagesButtonView = {
    view: view ?? readNotificationsView(),
    isEmpty: view === null,
  };
  return buttonView;
}

/** The color of the messages button's capsule: the most severe level with unread messages, or `null` once all are read. */
export function pickUnreadView(
  messages: readonly MessageSnapshot[],
): MessageLevelView | null {
  return findMostSevereView(messages, isUnreadMessage);
}

function describeLevelCount(view: MessageLevelView, count: number): string {
  const noun = count === 1 ? view.singularNoun : view.pluralNoun;
  const description = `${count} ${noun}`;
  return description;
}

/**
 * The accessible name and tooltip of the messages button: each level's
 * count, then the unread total, such as
 * `Messages: 1 error, 0 warnings, 2 notifications, 1 unread`.
 */
export function describeMessagesButton(
  messages: readonly MessageSnapshot[],
): string {
  const parts: string[] = [];
  for (const view of MESSAGE_LEVEL_VIEWS) {
    const count = listLevelMessages(messages, view.level).length;
    parts.push(describeLevelCount(view, count));
  }
  const description = `Messages: ${parts.join(", ")}, ${countUnreadMessages(messages)} unread`;
  return description;
}
