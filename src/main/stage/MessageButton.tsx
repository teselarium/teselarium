import type { ComponentProps, ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import {
  countUnreadMessages,
  describeCapsuleCount,
  describeLevelButton,
  READ_CAPSULE_CLASS_NAME,
} from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

/** The props a `PopoverTrigger` passes with `asChild`, and the ones the bar adds. */
type TriggerProps = Omit<
  ComponentProps<typeof StageBarIconButton>,
  "label" | "children" | "className"
>;

type MessageButtonProps = TriggerProps & {
  view: MessageLevelView;
  /** The visible sandbox's messages of the button's level. */
  messages: readonly MessageSnapshot[];
  /** The id of the newest message that flashed the button, `0` for none. A new id flashes it again. */
  flashId: number;
};

/** What a message button shows: the icon, the count in its capsule, and the flash. */
type MessageIconButtonProps = TriggerProps & {
  label: string;
  /** The level whose icon the button shows. */
  view: MessageLevelView;
  /** The number in the capsule. `0` shows no capsule and dims the icon. */
  count: number;
  /** The capsule's colors while a message is unread, or `null` once every one was read. */
  unreadCapsuleClassName: string | null;
  flashId: number;
};

const CAPSULE_CLASSES =
  "pointer-events-none absolute -right-1.5 -bottom-1 h-4 min-w-6 rounded-full px-1 text-center text-[0.625rem] leading-4 font-semibold tabular-nums";

/** One flash of the icon, from `stage.css`. `motion-safe:` leaves it out when the user asked for reduced motion. */
const FLASH_CLASSES =
  "inline-flex motion-safe:animate-[stage-bar-flash_700ms_ease-out]";

function renderCapsule(
  count: number,
  unreadCapsuleClassName: string | null,
): ReactElement | null {
  if (count === 0) {
    return null;
  }
  const isUnread = unreadCapsuleClassName !== null;
  // Absolutely placed, with room for `99+`, so a count never changes the button's box.
  return (
    <span
      aria-hidden="true"
      data-capsule={isUnread ? "unread" : "read"}
      className={`${CAPSULE_CLASSES} ${unreadCapsuleClassName ?? READ_CAPSULE_CLASS_NAME}`}
    >
      {describeCapsuleCount(count)}
    </span>
  );
}

function renderIcon(
  Icon: LucideIcon,
  view: MessageLevelView,
  isEmpty: boolean,
): ReactElement {
  return (
    <Icon
      className={
        isEmpty ? "text-muted-foreground opacity-50" : view.iconClassName
      }
    />
  );
}

/**
 * A message button's face, shared by the level buttons and the messages
 * button of a narrow bar: the level's icon, with a count in a capsule over
 * the bottom-right corner, filled while a message is unread and muted once
 * all were read. Without messages it is dimmed but stays focusable. A new
 * `flashId` flashes the icon once, unless the user asked for reduced motion.
 */
export function MessageIconButton({
  label,
  view,
  count,
  unreadCapsuleClassName,
  flashId,
  ...triggerProps
}: MessageIconButtonProps): ReactElement {
  const isEmpty = count === 0;
  return (
    <StageBarIconButton
      label={label}
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
        {renderIcon(view.icon, view, isEmpty)}
      </span>
      {renderCapsule(count, unreadCapsuleClassName)}
    </StageBarIconButton>
  );
}

/**
 * The button of one message level: its icon, with the level's count in a
 * capsule, filled in the level's color while the level has unread messages.
 * Rendered inside a `PopoverTrigger` with `asChild`, which passes its props.
 */
export function MessageButton({
  view,
  messages,
  flashId,
  ...triggerProps
}: MessageButtonProps): ReactElement {
  const count = messages.length;
  const unreadCount = countUnreadMessages(messages);
  return (
    <MessageIconButton
      label={describeLevelButton(view, count, unreadCount)}
      view={view}
      count={count}
      unreadCapsuleClassName={
        unreadCount > 0 ? view.unreadCapsuleClassName : null
      }
      flashId={flashId}
      {...triggerProps}
    />
  );
}
