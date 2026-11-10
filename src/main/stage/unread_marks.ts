import type { MessageSnapshot } from "../../lib/core/stage/index.ts";

/**
 * Which items of an open level's popover are marked unread. Recorded when the
 * popover opens, because opening marks the level read in the stage at once,
 * so the snapshot's `isRead` cannot tell which items were new to the user.
 * It is view state, and it is dropped when the popover closes.
 */
export interface UnreadMarks {
  /** The ids of the level's messages that were unread when the popover opened. */
  unreadIds: ReadonlySet<number>;
  /** The highest id of the level when the popover opened, `0` for none. A higher id arrived while it was open. */
  latestId: number;
}

/** The marks of a popover opening on `messages`, the messages of its level. */
export function recordUnreadMarks(
  messages: readonly MessageSnapshot[],
): UnreadMarks {
  const unreadIds = new Set<number>();
  let latestId = 0;
  for (const message of messages) {
    if (!message.isRead) {
      unreadIds.add(message.id);
    }
    latestId = Math.max(latestId, message.id);
  }
  const marks: UnreadMarks = Object.freeze({ unreadIds, latestId });
  return marks;
}

/** Whether the item `messageId` is marked: unread when the popover opened, or arrived since. */
export function isMarkedUnread(
  marks: UnreadMarks | null,
  messageId: number,
): boolean {
  if (marks === null) {
    return false;
  }
  const isMarked = marks.unreadIds.has(messageId) || messageId > marks.latestId;
  return isMarked;
}
