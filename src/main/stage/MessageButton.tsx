import type { ComponentProps, ReactElement } from "react";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import {
  countUnreadMessages,
  describeCapsuleCount,
  describeLevelButton,
  READ_CAPSULE_CLASS_NAME,
} from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

type MessageButtonProps = Omit<
  ComponentProps<typeof StageBarIconButton>,
  "label" | "children" | "className"
> & {
  view: MessageLevelView;
  /** The visible sandbox's messages of the button's level. */
  messages: readonly MessageSnapshot[];
  /** The id of the newest message that flashed the button, `0` for none. A new id flashes it again. */
  flashId: number;
};

const CAPSULE_CLASSES =
  "pointer-events-none absolute -right-1.5 -bottom-1 h-4 min-w-6 rounded-full px-1 text-center text-[0.625rem] leading-4 font-semibold tabular-nums";

/** One flash of the icon, from `stage.css`. `motion-safe:` leaves it out when the user asked for reduced motion. */
const FLASH_CLASSES =
  "inline-flex motion-safe:animate-[stage-bar-flash_700ms_ease-out]";

function renderCapsule(
  view: MessageLevelView,
  count: number,
  unreadCount: number,
): ReactElement | null {
  if (count === 0) {
    return null;
  }
  const isUnread = unreadCount > 0;
  // Absolutely placed, with room for `99+`, so a count never changes the button's box.
  return (
    <span
      aria-hidden="true"
      data-capsule={isUnread ? "unread" : "read"}
      className={`${CAPSULE_CLASSES} ${isUnread ? view.unreadCapsuleClassName : READ_CAPSULE_CLASS_NAME}`}
    >
      {describeCapsuleCount(count)}
    </span>
  );
}

/**
 * The button of one message level: its icon, with the count in a capsule
 * over the bottom-right corner, filled while the level has unread messages
 * and muted once they were read. A level without messages is dimmed but
 * stays focusable. A new `flashId` flashes the icon once, unless the user
 * asked for reduced motion. Rendered inside a `PopoverTrigger` with
 * `asChild`, which passes its props.
 */
export function MessageButton({
  view,
  messages,
  flashId,
  ...triggerProps
}: MessageButtonProps): ReactElement {
  const count = messages.length;
  const unreadCount = countUnreadMessages(messages);
  const Icon = view.icon;
  const isEmpty = count === 0;
  return (
    <StageBarIconButton
      label={describeLevelButton(view, count, unreadCount)}
      data-level={view.level}
      data-empty={isEmpty ? "" : undefined}
      className="relative"
      {...triggerProps}
    >
      <span
        // A new key remounts the span, which starts its animation again.
        key={flashId}
        aria-hidden="true"
        data-flash={flashId === 0 ? undefined : ""}
        className={flashId === 0 ? "inline-flex" : FLASH_CLASSES}
      >
        <Icon
          className={
            isEmpty ? "text-muted-foreground opacity-50" : view.iconClassName
          }
        />
      </span>
      {renderCapsule(view, count, unreadCount)}
    </StageBarIconButton>
  );
}
