import type { ComponentProps, ReactElement } from "react";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import {
  describeMessagesButton,
  pickMessagesView,
  pickUnreadView,
} from "./message_level_views.ts";
import { MessageIconButton } from "./MessageButton.tsx";

type MessagesButtonProps = Omit<
  ComponentProps<typeof MessageIconButton>,
  "label" | "view" | "count" | "unreadCapsuleClassName"
> & {
  /** The visible sandbox's messages, of every level. */
  messages: readonly MessageSnapshot[];
};

/**
 * The messages button of a narrow stage bar, in place of the three level
 * buttons: the icon of the most severe level that has messages, with the
 * total count in a capsule filled in the color of the most severe level
 * with unread messages, and muted once all were read. Without messages it
 * shows the notifications icon, dimmed. `flashId` is the newest flash of
 * any level. Rendered inside a `PopoverTrigger` with `asChild`.
 */
export function MessagesButton({
  messages,
  ...buttonProps
}: MessagesButtonProps): ReactElement {
  const shown = pickMessagesView(messages);
  const unreadView = pickUnreadView(messages);
  return (
    <MessageIconButton
      label={describeMessagesButton(messages)}
      view={shown.view}
      count={messages.length}
      unreadCapsuleClassName={unreadView?.unreadCapsuleClassName ?? null}
      data-messages=""
      {...buttonProps}
    />
  );
}
