import { Maximize, RectangleHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/vendor/shadcn/ui/popover.tsx";
import { Separator } from "@/vendor/shadcn/ui/separator.tsx";
import {
  clearNotifications,
  closeSandbox,
  dismissMessage,
  isCombinationSandbox,
  markMessagesRead,
} from "../../lib/core/stage/index.ts";
import type {
  MessageLevel,
  MessageSnapshot,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import {
  readRecentlyUsedSnapshot,
  subscribeRecentlyUsed,
} from "../settings/recently_used.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import type { ListChoices } from "./list_choices.ts";
import { requestListSummaries } from "./list_summaries.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { readModCapsuleTitle } from "./capsule_titles.ts";
import { CombinationTitle } from "./CombinationTitle.tsx";
import { keepFocusInFrame, listenForFrameFocus } from "./frame_focus.ts";
import { followAttention, startAttention } from "./message_attention.ts";
import type { MessageAttention } from "./message_attention.ts";
import {
  listLevelMessages,
  MESSAGE_LEVEL_VIEWS,
} from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { MessageButton } from "./MessageButton.tsx";
import { MessagePopover } from "./MessagePopover.tsx";
import { MessagesButton } from "./MessagesButton.tsx";
import { MessagesPopover } from "./MessagesPopover.tsx";
import { MoreActionsMenu } from "./MoreActionsMenu.tsx";
import type { ViewActions } from "./MoreActionsMenu.tsx";
import { SitesChip } from "./SitesChip.tsx";
import { isMessageLevelPanel, isMessagesPanel } from "./stage_bar_panels.ts";
import type { StageBarPanel } from "./stage_bar_panels.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";
import { changeTheaterMode } from "./theater_setting.ts";
import { reloadSandboxTiles } from "./tile_reload.ts";
import type { TheaterSetting } from "./theater_setting.ts";
import { recordUnreadMarks } from "./unread_marks.ts";
import type { UnreadMarks } from "./unread_marks.ts";
import { useNarrowStageBar } from "./use_narrow_stage_bar.ts";

interface StageBarProps {
  stage: Stage;
  /** The summaries and counts of the stage bar's lists. */
  combinations: CombinationCatalog;
  /** The sort and filter choices of the stage bar's lists. */
  listChoices: ListChoices;
  /** The mods, collections and mosaics tried in combination sandboxes. */
  recentlyUsed: RecentlyUsed;
  sandbox: SandboxSnapshot;
  /** Whether theater mode is on: the stage snapshot's `isTheaterMode`. */
  isTheaterMode: boolean;
  /** Theater mode, which the theater mode button turns on and off. */
  theater: TheaterSetting;
  /** Shows the sandbox's frame fullscreen. Called during the click. */
  onFullscreen: (sandboxId: string) => void;
}

/** The open popover or menu, and the sandbox it was opened for, so it closes when another sandbox is shown. */
interface OpenPanel {
  sandboxId: string;
  panel: StageBarPanel;
  /** For a popover of messages, its items to mark unread, recorded when it opened. Otherwise `null`. */
  unreadMarks: UnreadMarks | null;
}

/** The popovers line up under the bar's right side, and stay within the viewport. */
const POPOVER_CLASSES = "w-96 max-w-[calc(100vw-2rem)]";

/** The levels a popover of messages shows: its own, or every level for the messages popover. */
function listPanelLevels(panel: StageBarPanel): MessageLevel[] {
  const levels: MessageLevel[] = [];
  if (isMessageLevelPanel(panel)) {
    levels.push(panel);
  } else if (panel === "messages") {
    for (const view of MESSAGE_LEVEL_VIEWS) {
      levels.push(view.level);
    }
  }
  return levels;
}

/** Marks read every level of `panel`, which is a popover of messages or nothing to mark. */
function markPanelRead(
  stage: Stage,
  sandboxId: string,
  panel: StageBarPanel,
): void {
  for (const level of listPanelLevels(panel)) {
    markMessagesRead(stage, sandboxId, level);
  }
}

/**
 * Marks read the levels of a popover of messages that closes, for the
 * messages that arrived while it was open. Run by the effect of the open
 * popover when it closes, however it closes.
 */
function markClosedLevelRead(stage: Stage, openPanel: OpenPanel): void {
  markPanelRead(stage, openPanel.sandboxId, openPanel.panel);
}

/** The messages a popover of messages lists: its level's, or all of them for the messages popover. */
function listPanelMessages(
  sandbox: SandboxSnapshot,
  panel: StageBarPanel,
): readonly MessageSnapshot[] {
  if (isMessageLevelPanel(panel)) {
    return listLevelMessages(sandbox.messages, panel);
  }
  return sandbox.messages;
}

/** The messages button flashes with the newest flash of any level. */
function readNewestFlashId(attention: MessageAttention): number {
  let newest = 0;
  for (const view of MESSAGE_LEVEL_VIEWS) {
    newest = Math.max(newest, attention.flashIds[view.level]);
  }
  return newest;
}

/** The open panel after `panel` closed: `null` when it was the open one, the open one otherwise. */
function closePanel(
  panel: StageBarPanel,
  current: OpenPanel | null,
): OpenPanel | null {
  return current?.panel === panel ? null : current;
}

/** The fullscreen button needs a frame: only a running mod has one. */
function hasModFrame(sandbox: SandboxSnapshot): boolean {
  return sandbox.status === "running" && sandbox.sandboxDocument !== null;
}

/**
 * What the bar holds besides its titles, which decides whether its capsules
 * fit: a change drops the width at which they did not (`useNarrowStageBar`).
 */
function readBarContentKey(
  sandbox: SandboxSnapshot,
  isCombination: boolean,
): string {
  const parts = [
    sandbox.id,
    isCombination ? "capsules" : "title",
    sandbox.sites === null ? "" : "sites",
    hasModFrame(sandbox) ? "fullscreen" : "",
    sandbox.canClose ? "close" : "",
  ];
  return parts.join("|");
}

/**
 * The plain title of a sandbox that is not a combination, such as an
 * explorer or a viewer: the mod's name and version once its mod file is
 * loaded, "Loading mod…" before, or "Mod not loaded" when it failed first.
 */
function renderPlainTitle(sandbox: SandboxSnapshot): ReactElement {
  const modTitle = readModCapsuleTitle(sandbox);
  if (modTitle.version === undefined) {
    return (
      <span className="truncate text-muted-foreground">{modTitle.title}</span>
    );
  }
  return (
    <>
      <strong className="truncate font-semibold">{modTitle.title}</strong>
      <Badge variant="outline" className="tabular-nums">
        {modTitle.version}
      </Badge>
    </>
  );
}

/**
 * The visible sandbox's bar, in one row above its frame, a container whose
 * width folds its left side. On the left: for a combination sandbox, the
 * capsules mod + collection -> mosaic, each opening its list, then the Sites
 * chip for a sandbox with `sites`; for any other sandbox, the mod's name and
 * version; then the "More actions" menu. On the right, from 480px of bar
 * width: the errors, warnings and notifications buttons, a separator, the
 * theater mode toggle, the fullscreen button while the mod runs in its
 * frame, then, when the sandbox has a close button, a separator and the
 * close button (×). Under 480px, the right side holds one messages button,
 * whose popover groups the levels, then the separator and the close button,
 * and "More actions" holds theater mode and fullscreen. The bar is narrow
 * under 480px, or when its capsules at their minimum width do not fit
 * (`useNarrowStageBar`), and says so in `data-narrow`, which the left
 * side's fold follows. Folding or unfolding closes an open popover of
 * messages, whose button is replaced. Each button
 * opens its popover, menu or list, drawn by the app outside every mod frame,
 * which closes on a click outside it, in the mod's frame too. Opening a
 * level marks it read, marks its unread items while it is open, and closing
 * it marks read what arrived meanwhile. A level whose newest message arrives
 * while it is shown flashes, and a new error, like "Link copied", is
 * announced politely.
 */
export function StageBar({
  stage,
  combinations,
  listChoices,
  recentlyUsed,
  sandbox,
  isTheaterMode,
  theater,
  onFullscreen,
}: StageBarProps): ReactElement {
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const barRef = useRef<HTMLElement>(null);
  const leftSideRef = useRef<HTMLDivElement>(null);
  const recent = useStoreSnapshot(
    recentlyUsed,
    subscribeRecentlyUsed,
    readRecentlyUsedSnapshot,
  );
  const isCombination = isCombinationSandbox(sandbox.link, [
    ...stage.catalog.mods,
    ...recent.mods,
  ]);
  const isNarrow = useNarrowStageBar(
    barRef,
    leftSideRef,
    readBarContentKey(sandbox, isCombination),
  );
  const [shownNarrow, setShownNarrow] = useState(isNarrow);
  // Folding or unfolding replaces the buttons of messages, so their open popover closes.
  if (shownNarrow !== isNarrow) {
    setShownNarrow(isNarrow);
    if (openPanel !== null && isMessagesPanel(openPanel.panel)) {
      setOpenPanel(null);
    }
  }
  // Another sandbox shown closes the open popover or menu, while rendering as for the attention.
  if (openPanel !== null && openPanel.sandboxId !== sandbox.id) {
    setOpenPanel(null);
  }
  const [seenAttention, setSeenAttention] = useState<MessageAttention>(
    startAttention.bind(undefined, sandbox),
  );
  // Follows the snapshot while rendering, React's way of adjusting state to new props.
  const attention = followAttention(seenAttention, sandbox);
  if (attention !== seenAttention) {
    setSeenAttention(attention);
  }

  useEffect(
    function markReadOnClose(): (() => void) | undefined {
      if (openPanel === null) {
        return undefined;
      }
      return markClosedLevelRead.bind(undefined, stage, openPanel);
    },
    [stage, openPanel],
  );

  useEffect(function closeOnFrameFocus(): () => void {
    return listenForFrameFocus(setOpenPanel.bind(undefined, null));
  }, []);

  function isPanelOpen(panel: StageBarPanel): boolean {
    return openPanel?.sandboxId === sandbox.id && openPanel.panel === panel;
  }

  const visiblePanel =
    openPanel?.sandboxId === sandbox.id ? openPanel.panel : null;

  // Once the mod file is loaded: a refused link or a failed mosaic requests no other file.
  const hasModFile = sandbox.mod !== null;
  useEffect(
    function loadListSummaries(): void {
      if (isCombination && hasModFile) {
        void requestListSummaries(combinations, stage, sandbox, recent);
      }
    },
    [isCombination, hasModFile, combinations, stage, sandbox, recent],
  );

  function handlePanelOpenChange(panel: StageBarPanel, isOpen: boolean): void {
    if (!isOpen) {
      // Only that panel closes: the folded menu closes after its row opened a list.
      setOpenPanel(closePanel.bind(undefined, panel));
      return;
    }
    if (!isMessagesPanel(panel)) {
      setOpenPanel({ sandboxId: sandbox.id, panel, unreadMarks: null });
      return;
    }
    const unreadMarks = recordUnreadMarks(listPanelMessages(sandbox, panel));
    markPanelRead(stage, sandbox.id, panel);
    setOpenPanel({ sandboxId: sandbox.id, panel, unreadMarks });
  }

  function handleReloadTiles(): void {
    void reloadSandboxTiles(stage, combinations, sandbox);
  }

  function handleTheaterClick(): void {
    changeTheaterMode(theater, !isTheaterMode);
  }

  /** Nothing outside the frame is visible in fullscreen, so the open popover or menu closes. */
  function handleFullscreenClick(): void {
    setOpenPanel(null);
    onFullscreen(sandbox.id);
  }

  function handleCloseClick(): void {
    closeSandbox(stage, sandbox.id);
  }

  function handleDismiss(messageId: number): void {
    dismissMessage(stage, sandbox.id, messageId);
  }

  function handleClearAll(): void {
    clearNotifications(stage, sandbox.id);
  }

  function renderLevel(view: MessageLevelView): ReactElement {
    const messages = listLevelMessages(sandbox.messages, view.level);
    const isOpen = isPanelOpen(view.level);
    return (
      <Popover
        key={view.level}
        open={isOpen}
        onOpenChange={handlePanelOpenChange.bind(undefined, view.level)}
      >
        <PopoverTrigger asChild>
          <MessageButton
            view={view}
            messages={messages}
            flashId={attention.flashIds[view.level]}
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={POPOVER_CLASSES}
          onCloseAutoFocus={keepFocusInFrame}
        >
          <MessagePopover
            view={view}
            messages={messages}
            droppedCount={sandbox.droppedModMessages[view.level]}
            unreadMarks={isOpen ? (openPanel?.unreadMarks ?? null) : null}
            onDismiss={handleDismiss}
            onClearAll={handleClearAll}
          />
        </PopoverContent>
      </Popover>
    );
  }

  function renderMessagesButton(): ReactElement {
    const isOpen = isPanelOpen("messages");
    return (
      <Popover
        open={isOpen}
        onOpenChange={handlePanelOpenChange.bind(undefined, "messages")}
      >
        <PopoverTrigger asChild>
          <MessagesButton
            messages={sandbox.messages}
            flashId={readNewestFlashId(attention)}
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={POPOVER_CLASSES}
          onCloseAutoFocus={keepFocusInFrame}
        >
          <MessagesPopover
            messages={sandbox.messages}
            droppedCounts={sandbox.droppedModMessages}
            unreadMarks={isOpen ? (openPanel?.unreadMarks ?? null) : null}
            onDismiss={handleDismiss}
            onClearAll={handleClearAll}
          />
        </PopoverContent>
      </Popover>
    );
  }

  /** From 480px: the level buttons, a separator, theater mode and fullscreen. */
  function renderWideActions(): ReactElement {
    const levelButtons: ReactElement[] = [];
    for (const view of MESSAGE_LEVEL_VIEWS) {
      levelButtons.push(renderLevel(view));
    }
    return (
      <>
        {levelButtons}
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-5"
        />
        {/* A toggle keeps one name in both states: `aria-pressed` tells which. */}
        <StageBarIconButton
          label="Theater mode"
          aria-pressed={isTheaterMode}
          onClick={viewActions.onTheaterToggle}
        >
          <RectangleHorizontal />
        </StageBarIconButton>
        {viewActions.onFullscreen === null ? null : (
          <StageBarIconButton
            label="Fullscreen"
            onClick={viewActions.onFullscreen}
          >
            <Maximize />
          </StageBarIconButton>
        )}
      </>
    );
  }

  const viewActions: ViewActions = {
    isTheaterMode,
    onTheaterToggle: handleTheaterClick,
    onFullscreen: hasModFrame(sandbox) ? handleFullscreenClick : null,
  };

  return (
    <section
      ref={barRef}
      data-narrow={isNarrow ? "" : undefined}
      className="stage-bar group/stage-bar @container flex min-h-(--shell-row-height) items-center gap-2 rounded-lg border bg-card px-3 text-card-foreground shadow-panel"
      aria-label="Stage bar"
    >
      <div ref={leftSideRef} className="flex min-w-0 flex-1 items-center gap-2">
        {isCombination ? (
          <CombinationTitle
            stage={stage}
            sandbox={sandbox}
            combinations={combinations}
            listChoices={listChoices}
            recentlyUsed={recentlyUsed}
            openPanel={visiblePanel}
            onPanelOpenChange={handlePanelOpenChange}
            anchorRef={leftSideRef}
          />
        ) : (
          renderPlainTitle(sandbox)
        )}
        {sandbox.sites === null ? null : (
          <SitesChip
            stage={stage}
            sandbox={sandbox}
            sites={sandbox.sites}
            isOpen={isPanelOpen("sites")}
            onOpenChange={handlePanelOpenChange.bind(undefined, "sites")}
          />
        )}
        <MoreActionsMenu
          hash={sandbox.hash}
          canReloadTiles={sandbox.canReloadTiles}
          onReloadTiles={handleReloadTiles}
          isOpen={isPanelOpen("more")}
          onOpenChange={handlePanelOpenChange.bind(undefined, "more")}
          onFeedbackChange={setCopyFeedback}
          isNarrow={isNarrow}
          viewActions={viewActions}
        />
      </div>
      {/* The gap leaves room for a `99+` capsule, which sticks out of its button's corner. */}
      <div className="flex shrink-0 items-center gap-3">
        {isNarrow ? renderMessagesButton() : renderWideActions()}
        {sandbox.canClose ? (
          <>
            <Separator
              orientation="vertical"
              className="data-[orientation=vertical]:h-5"
            />
            <StageBarIconButton label="Close" onClick={handleCloseClick}>
              <X />
            </StageBarIconButton>
          </>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        <span>{attention.announcement}</span>
        <span>{copyFeedback}</span>
      </p>
    </section>
  );
}
