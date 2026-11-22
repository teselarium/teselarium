import {
  Check,
  Ellipsis,
  Link,
  Maximize,
  Pencil,
  RectangleHorizontal,
  RotateCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/vendor/shadcn/ui/dropdown-menu.tsx";
import { keepFocusInFrame } from "./frame_focus.ts";
import {
  buildRunLinkAddress,
  copyText,
  scheduleFeedbackEnd,
} from "./run_link_copy.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

/**
 * Theater mode and fullscreen, which the stage bar's buttons offer from
 * 480px wide and the "More actions" menu under it. The buttons and the menu
 * items call the same handlers.
 */
export interface ViewActions {
  isTheaterMode: boolean;
  /** Turns theater mode on when it is off, off when it is on. */
  onTheaterToggle: () => void;
  /** Shows the visible mod fullscreen. Called during the click. `null` without a running mod frame. */
  onFullscreen: (() => void) | null;
}

interface MoreActionsMenuProps {
  /** The sandbox's run link, such as `#/run?mod=…`. */
  hash: string;
  /** Whether the menu holds "Reload tiles": the sandbox was opened with a collection or a tile. */
  canReloadTiles: boolean;
  onReloadTiles: () => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Gets what the button says after a copy, then `""` once it stops
   * saying it. A stable function, such as a state setter: a new one reports
   * the feedback again and restarts its 2 seconds.
   */
  onFeedbackChange: (feedback: string) => void;
  /** Whether the stage bar is under 480px wide: the menu then holds the view actions. */
  isNarrow: boolean;
  /** The edit button's action, which the menu holds on a bar under phone width, or `null`. */
  editItem: MenuEditItem | null;
  viewActions: ViewActions;
}

/** The edit button's action as a menu item: its name and what choosing it does. */
export interface MenuEditItem {
  label: string;
  onSelect: () => void;
}

/**
 * The theater item gets the other items' left padding, and shadcn's check
 * slot, its first `span`, on the left, is hidden: its own check follows the
 * label at the item's end, so every item's icon starts at the same place.
 */
const THEATER_ITEM_CLASSES = "pl-2 [&>span:first-child]:hidden";

/** How the last "Copy link" went, while the button says so. */
type CopyState = "idle" | "copied" | "failed";

const MORE_ACTIONS_LABEL = "More actions";

const COPY_FEEDBACK: Readonly<Record<CopyState, string>> = Object.freeze({
  idle: "",
  copied: "Link copied",
  failed: "Cannot copy the link",
});

/** The view actions a narrow bar moves into the menu, after a separator. */
function renderViewItems(viewActions: ViewActions): ReactElement {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        className={THEATER_ITEM_CLASSES}
        checked={viewActions.isTheaterMode}
        onCheckedChange={viewActions.onTheaterToggle}
      >
        <RectangleHorizontal />
        Theater mode
        {viewActions.isTheaterMode ? (
          <Check aria-hidden="true" className="ml-auto" data-theater-check="" />
        ) : null}
      </DropdownMenuCheckboxItem>
      {viewActions.onFullscreen === null ? null : (
        <DropdownMenuItem onSelect={viewActions.onFullscreen}>
          <Maximize />
          Fullscreen
        </DropdownMenuItem>
      )}
    </>
  );
}

/**
 * The "More actions" button (`…`) and its menu: "Copy link", which copies
 * the app's full address with the run link, and, for a sandbox opened with a
 * collection or a tile, "Reload tiles", then, on a bar under phone width,
 * the edit button's action. On a narrow bar it also holds
 * "Theater mode", checked while it is on, and, while the mod runs in its
 * frame, "Fullscreen". After a copy the menu closes, and the
 * button's tooltip says "Link copied", or "Cannot copy the link", for 2
 * seconds. The menu is not modal, so a click in the mod's frame still
 * reaches the mod.
 */
export function MoreActionsMenu({
  hash,
  canReloadTiles,
  onReloadTiles,
  isOpen,
  onOpenChange,
  onFeedbackChange,
  isNarrow,
  editItem,
  viewActions,
}: MoreActionsMenuProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(
    function reportCopyFeedback(): (() => void) | undefined {
      onFeedbackChange(COPY_FEEDBACK[copyState]);
      if (copyState === "idle") {
        return undefined;
      }
      return scheduleFeedbackEnd(setCopyState.bind(undefined, "idle"));
    },
    [copyState, onFeedbackChange],
  );

  function handleCopySelect(): void {
    void copyText(buildRunLinkAddress(hash)).then(
      setCopyState.bind(undefined, "copied"),
      setCopyState.bind(undefined, "failed"),
    );
  }

  const isShowingFeedback = copyState !== "idle";
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <StageBarIconButton
          label={MORE_ACTIONS_LABEL}
          tooltip={
            isShowingFeedback ? COPY_FEEDBACK[copyState] : MORE_ACTIONS_LABEL
          }
          isTooltipOpen={isShowingFeedback ? true : undefined}
        >
          <Ellipsis />
        </StageBarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={keepFocusInFrame}>
        <DropdownMenuItem onSelect={handleCopySelect}>
          <Link />
          Copy link
        </DropdownMenuItem>
        {canReloadTiles ? (
          <DropdownMenuItem onSelect={onReloadTiles}>
            <RotateCw />
            Reload tiles
          </DropdownMenuItem>
        ) : null}
        {editItem === null ? null : (
          <DropdownMenuItem onSelect={editItem.onSelect}>
            <Pencil />
            {editItem.label}
          </DropdownMenuItem>
        )}
        {isNarrow ? renderViewItems(viewActions) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
