import { Info, RotateCw, X } from "lucide-react";
import { useState } from "react";
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
import { StageBarIconButton } from "./StageBarIconButton.tsx";

interface StageBarProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
}

/** The stage bar's popovers: one per message level, and the information popover. */
type StageBarPanel = MessageLevel | "mod-info";

/** The open popover, and the sandbox it was opened for, so it closes when another sandbox is shown. */
interface OpenPanel {
  sandboxId: string;
  panel: StageBarPanel;
}

/** The popovers line up under the bar's right side, and stay within the viewport. */
const POPOVER_CLASSES = "w-96 max-w-[calc(100vw-2rem)]";

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
 * mod's name and version, the information button and "Reload tiles". On the
 * right: the errors, warnings and notifications buttons, then a separator
 * and the close button (×). Each button opens its popover, drawn by the app
 * outside every mod frame, and opening a level marks it read. A level whose
 * newest message arrives while it is shown flashes, and a new error is
 * announced politely.
 */
export function StageBar({ stage, sandbox }: StageBarProps): ReactElement {
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [seenAttention, setSeenAttention] = useState<MessageAttention>(
    startAttention.bind(undefined, sandbox),
  );
  // Follows the snapshot while rendering, React's way of adjusting state to new props.
  const attention = followAttention(seenAttention, sandbox);
  if (attention !== seenAttention) {
    setSeenAttention(attention);
  }

  function isPanelOpen(panel: StageBarPanel): boolean {
    return openPanel?.sandboxId === sandbox.id && openPanel.panel === panel;
  }

  function handlePanelOpenChange(panel: StageBarPanel, isOpen: boolean): void {
    if (!isOpen) {
      setOpenPanel(null);
      return;
    }
    if (panel !== "mod-info") {
      markMessagesRead(stage, sandbox.id, panel);
    }
    setOpenPanel({ sandboxId: sandbox.id, panel });
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
    return (
      <Popover
        key={view.level}
        open={isPanelOpen(view.level)}
        onOpenChange={handlePanelOpenChange.bind(undefined, view.level)}
      >
        <PopoverTrigger asChild>
          <MessageButton
            view={view}
            messages={messages}
            flashId={attention.flashIds[view.level]}
          />
        </PopoverTrigger>
        <PopoverContent align="end" className={POPOVER_CLASSES}>
          <MessagePopover
            view={view}
            messages={messages}
            droppedCount={sandbox.droppedModMessages[view.level]}
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
          <PopoverContent align="start" className={POPOVER_CLASSES}>
            <ModInfoPopover sandbox={sandbox} />
          </PopoverContent>
        </Popover>
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
        {attention.announcement}
      </p>
    </section>
  );
}
