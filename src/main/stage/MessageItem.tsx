import { Puzzle, X } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type {
  MessageProducer,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";

interface MessageItemProps {
  message: MessageSnapshot;
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
 * One message in a popover: the producer's label, which a mod cannot change,
 * then the source and the text as plain text.
 */
export function MessageItem({
  message,
  onDismiss,
}: MessageItemProps): ReactElement {
  function handleDismissClick(): void {
    onDismiss?.(message.id);
  }

  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
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
