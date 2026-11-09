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
  icon: LucideIcon;
  /** The icon's color while the level has messages. */
  iconClassName: string;
  /** The capsule's colors while the level has unread messages. */
  unreadCapsuleClassName: string;
}

/** The levels in the order of the stage bar's buttons. There is no info color in the theme, so info uses `primary`. */
export const MESSAGE_LEVEL_VIEWS: readonly MessageLevelView[] = Object.freeze([
  {
    level: "error",
    label: "Errors",
    emptyText: "No errors.",
    icon: CircleAlert,
    iconClassName: "text-destructive",
    unreadCapsuleClassName: "bg-destructive text-destructive-foreground",
  },
  {
    level: "warning",
    label: "Warnings",
    emptyText: "No warnings.",
    icon: TriangleAlert,
    iconClassName: "text-warning",
    unreadCapsuleClassName: "bg-warning text-background",
  },
  {
    level: "info",
    label: "Notifications",
    emptyText: "No notifications.",
    icon: Bell,
    iconClassName: "text-primary",
    unreadCapsuleClassName: "bg-primary text-primary-foreground",
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
