import { Puzzle, X } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type {
  MessageProducer,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";
import type { MessageLevelView } from "./message_level_views.ts";

interface MessageItemProps {
  /** The view of the message's level, for the colors of the unread mark. */
  view: MessageLevelView;
  message: MessageSnapshot;
  /** Marks the item unread: a light background in the level's color and a dot. */
  isUnread: boolean;
  /** Dismisses the message. `null` for messages that cannot be dismissed. */
  onDismiss: ((messageId: number) => void) | null;
}

/**
 * The producer's fixed label. "App" is an outline Badge, and "Mod" a
 * secondary Badge with the mods' icon, so they differ without relying on color.
 */
function renderProducer(producer: MessageProducer): ReactElement {
  if (producer === "app") {
    return (
      <Badge variant="outline" data-producer="app">
        App
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-producer="mod">
      <Puzzle aria-hidden="true" />
      Mod
    </Badge>
  );
}

/**
 * The place of the unread dot, kept on every item so an item does not move
 * when its mark comes or goes. A marked item fills it with a dot in its
 * level's color, with "Unread" for assistive technologies, so color is not
 * the only cue.
 */
function renderUnreadDot(
  view: MessageLevelView,
  isUnread: boolean,
): ReactElement {
  return (
    <span className="flex shrink-0 pt-2" data-unread-dot="">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${isUnread ? view.unreadDotClassName : ""}`}
      />
      {isUnread ? <span className="sr-only">Unread</span> : null}
    </span>
  );
}

/**
 * One message in a popover: the producer's label, which a mod cannot change,
 * then the source and the text as plain text. An item marked unread has a
 * light background in its level's color and a dot.
 */
export function MessageItem({
  view,
  message,
  isUnread,
  onDismiss,
}: MessageItemProps): ReactElement {
  function handleDismissClick(): void {
    onDismiss?.(message.id);
  }

  return (
    <li
      data-unread={isUnread ? "" : undefined}
      className={`flex items-start gap-2 px-1.5 py-1.5 text-sm ${isUnread ? view.unreadItemClassName : ""}`}
    >
      {renderUnreadDot(view, isUnread)}
      <span className="shrink-0 pt-0.5">
        {renderProducer(message.producer)}
      </span>
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <code className="block text-xs text-muted-foreground">
          {message.source}
        </code>
        <span className="whitespace-pre-wrap">{message.text}</span>
      </div>
      {onDismiss === null ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Dismiss: ${message.text}`}
          onClick={handleDismissClick}
        >
          <X />
        </Button>
      )}
    </li>
  );
}
