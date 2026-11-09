import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import { describeDroppedMessages } from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { MessageItem } from "./MessageItem.tsx";

interface MessagePopoverProps {
  view: MessageLevelView;
  /** The visible sandbox's messages of the level, in their order. */
  messages: readonly MessageSnapshot[];
  /** How many older messages of the level from the mod were dropped. */
  droppedCount: number;
  onDismiss: (messageId: number) => void;
  onClearAll: () => void;
}

function renderItems(
  messages: readonly MessageSnapshot[],
  onDismiss: ((messageId: number) => void) | null,
): ReactElement[] {
  const items: ReactElement[] = [];
  for (const message of messages) {
    items.push(
      <MessageItem key={message.id} message={message} onDismiss={onDismiss} />,
    );
  }
  return items;
}

/**
 * The content of one level's popover: its messages in the order they were
 * found, or "No errors." and the like. Notifications can be dismissed one by
 * one, and with two or more, all at once. The list ends with the note of
 * the mod's dropped messages, if any.
 */
export function MessagePopover({
  view,
  messages,
  droppedCount,
  onDismiss,
  onClearAll,
}: MessagePopoverProps): ReactElement {
  const canDismiss = view.level === "info";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{view.label}</h2>
        {canDismiss && messages.length >= 2 ? (
          <Button type="button" variant="ghost" size="xs" onClick={onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{view.emptyText}</p>
      ) : (
        <ul
          aria-label={view.label}
          className="max-h-[60vh] divide-y overflow-y-auto"
        >
          {renderItems(messages, canDismiss ? onDismiss : null)}
        </ul>
      )}
      {droppedCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {describeDroppedMessages(droppedCount)}
        </p>
      ) : null}
    </div>
  );
}
