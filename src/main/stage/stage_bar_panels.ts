import type { MessageLevel } from "../../lib/core/stage/index.ts";

/** A capsule's list, or the menu of the single capsule of a narrow bar. */
export type CapsulePanel =
  "mod-list" | "collection-list" | "mosaic-list" | "folded";

/**
 * The stage bar's popovers, menus and lists: one per message level, the
 * messages popover of a narrow bar, which groups every level, the capsules'
 * lists and the folded capsule's menu, the "More actions" menu and the Sites
 * chip's popover. One is open at a time.
 */
export type StageBarPanel =
  MessageLevel | "messages" | CapsulePanel | "more" | "sites";

const OTHER_PANELS: readonly StageBarPanel[] = [
  "messages",
  "mod-list",
  "collection-list",
  "mosaic-list",
  "folded",
  "more",
  "sites",
];

export function isMessageLevelPanel(
  panel: StageBarPanel,
): panel is MessageLevel {
  return !OTHER_PANELS.includes(panel);
}

/** Whether `panel` is one of the capsules' lists. */
export function isListPanel(panel: StageBarPanel | null): boolean {
  return (
    panel === "mod-list" ||
    panel === "collection-list" ||
    panel === "mosaic-list"
  );
}

/** Whether `panel` shows messages: a level's popover, or the messages popover that groups them. */
export function isMessagesPanel(panel: StageBarPanel): boolean {
  return panel === "messages" || isMessageLevelPanel(panel);
}
