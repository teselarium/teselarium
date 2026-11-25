import type { ReactElement } from "react";
import type {
  MessageLevel,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";
import {
  listLevelMessages,
  MESSAGE_LEVEL_VIEWS,
} from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { MessagePopover } from "./MessagePopover.tsx";
import type { UnreadMarks } from "./unread_marks.ts";

interface MessagesPopoverProps {
  /** The visible sandbox's messages, of every level, in the order they were found. */
  messages: readonly MessageSnapshot[];
  /** Per level, how many older messages from the mod were dropped. */
  droppedCounts: Readonly<Record<MessageLevel, number>>;
  /** The items to mark unread, recorded when the popover opened. `null` marks none. */
  unreadMarks: UnreadMarks | null;
  onDismiss: (messageId: number) => void;
  onClearAll: () => void;
}

function renderGroup(
  props: MessagesPopoverProps,
  view: MessageLevelView,
  levelMessages: readonly MessageSnapshot[],
): ReactElement {
  return (
    <MessagePopover
      key={view.level}
      view={view}
      messages={levelMessages}
      droppedCount={props.droppedCounts[view.level]}
      unreadMarks={props.unreadMarks}
      onDismiss={props.onDismiss}
      onClearAll={props.onClearAll}
    />
  );
}

/**
 * The content of the messages popover of a narrow bar: the messages grouped
 * by level, errors, then warnings, then notifications, each group as the
 * level's popover draws it (its heading, its items newest first, their
 * unread marks, the dismiss buttons and "Clear all"). A level without
 * messages is left out, and a sandbox without messages says "No messages.".
 */
export function MessagesPopover(props: MessagesPopoverProps): ReactElement {
  const groups: ReactElement[] = [];
  for (const view of MESSAGE_LEVEL_VIEWS) {
    const levelMessages = listLevelMessages(props.messages, view.level);
    if (levelMessages.length > 0) {
      groups.push(renderGroup(props, view, levelMessages));
    }
  }
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages.</p>;
  }
  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      {groups}
    </div>
  );
}
