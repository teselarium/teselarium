import { Info, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  markMessagesRead,
  reloadTiles,
} from "../../lib/core/stage/index.ts";
import type {
  MessageLevel,
  SandboxSnapshot,
  Stage,
} from "../../lib/core/stage/index.ts";
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
import { ModInfoPopover } from "./ModInfoPopover.tsx";
import { ShareMenu } from "./ShareMenu.tsx";
import { StageBarIconButton } from "./StageBarIconButton.tsx";
import { recordUnreadMarks } from "./unread_marks.ts";
import type { UnreadMarks } from "./unread_marks.ts";

interface StageBarProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
}

/** The stage bar's popovers and menus: one per message level, the information popover and the Share menu. */
type StageBarPanel = MessageLevel | "mod-info" | "share";

/** The open popover or menu, and the sandbox it was opened for, so it closes when another sandbox is shown. */
interface OpenPanel {
  sandboxId: string;
  panel: StageBarPanel;
  /** For a level's popover, its items to mark unread, recorded when it opened. Otherwise `null`. */
  unreadMarks: UnreadMarks | null;
}

/** The popovers line up under the bar's right side, and stay within the viewport. */
const POPOVER_CLASSES = "w-96 max-w-[calc(100vw-2rem)]";

function isMessageLevelPanel(panel: StageBarPanel): panel is MessageLevel {
  return panel !== "mod-info" && panel !== "share";
}

/**
 * Marks read the level of a popover that closes, for the messages that
 * arrived while it was open. Run by the effect of the open popover when it
 * closes, however it closes.
 */
function markClosedLevelRead(stage: Stage, openPanel: OpenPanel): void {
  if (isMessageLevelPanel(openPanel.panel)) {
    markMessagesRead(stage, openPanel.sandboxId, openPanel.panel);
  }
}

/**
 * The mod's name and version once its mod file is loaded, even when the
 * sandbox failed later. Before that, "Loading mod…", or "Mod not loaded"
 * when it failed or stopped first.
 */
function renderModName(sandbox: SandboxSnapshot): ReactElement {
  if (sandbox.mod !== null) {
    return (
      <>
        <strong className="truncate font-semibold">{sandbox.mod.title}</strong>
        <Badge variant="outline" className="tabular-nums">
          {sandbox.mod.version}
        </Badge>
      </>
    );
  }
  const isLoading = sandbox.status === "loading" || sandbox.status === "asking";
  return (
    <span className="truncate text-muted-foreground">
      {isLoading ? "Loading mod…" : "Mod not loaded"}
    </span>
  );
}

/**
 * The visible sandbox's bar, in one row above its frame. On the left: the
 * mod's name and version, the information button, the Share button and
 * "Reload tiles". On the right: the errors, warnings and notifications
 * buttons, then a separator and the close button (×). Each button opens its
 * popover or menu, drawn by the app outside every mod frame, which closes on
 * a click outside it, in the mod's frame too. Opening a level marks it read,
 * marks its unread items while it is open, and closing it marks read what
 * arrived meanwhile. A level whose newest message arrives while it is
 * shown flashes, and a new error, like the Share menu's "Link copied", is
 * announced politely.
 */
export function StageBar({ stage, sandbox }: StageBarProps): ReactElement {
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
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

  function handlePanelOpenChange(panel: StageBarPanel, isOpen: boolean): void {
    if (!isOpen) {
      setOpenPanel(null);
      return;
    }
    if (!isMessageLevelPanel(panel)) {
      setOpenPanel({ sandboxId: sandbox.id, panel, unreadMarks: null });
      return;
    }
    const unreadMarks = recordUnreadMarks(
      listLevelMessages(sandbox.messages, panel),
    );
    markMessagesRead(stage, sandbox.id, panel);
    setOpenPanel({ sandboxId: sandbox.id, panel, unreadMarks });
  }

  function handleReloadClick(): void {
    void reloadTiles(stage, sandbox.id);
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

  const levelButtons: ReactElement[] = [];
  for (const view of MESSAGE_LEVEL_VIEWS) {
    levelButtons.push(renderLevel(view));
  }

  return (
    <section
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1 text-card-foreground"
      aria-label="Stage bar"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {renderModName(sandbox)}
        <Popover
          open={isPanelOpen("mod-info")}
          onOpenChange={handlePanelOpenChange.bind(undefined, "mod-info")}
        >
          <PopoverTrigger asChild>
            <StageBarIconButton label="Mod information">
              <Info />
            </StageBarIconButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={POPOVER_CLASSES}
            onCloseAutoFocus={keepFocusInFrame}
          >
            <ModInfoPopover sandbox={sandbox} />
          </PopoverContent>
        </Popover>
        <ShareMenu
          hash={sandbox.hash}
          isOpen={isPanelOpen("share")}
          onOpenChange={handlePanelOpenChange.bind(undefined, "share")}
          onFeedbackChange={setShareFeedback}
        />
        {sandbox.canReloadTiles ? (
          <StageBarIconButton label="Reload tiles" onClick={handleReloadClick}>
            <RotateCw />
          </StageBarIconButton>
        ) : null}
      </div>
      {/* The gap leaves room for a `99+` capsule, which sticks out of its button's corner. */}
      <div className="flex shrink-0 items-center gap-3">
        {levelButtons}
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
        <span>{shareFeedback}</span>
      </p>
    </section>
  );
}
