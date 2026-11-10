import { Link, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/vendor/shadcn/ui/dropdown-menu.tsx";
import { keepFocusInFrame } from "./frame_focus.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

interface ShareMenuProps {
  /** The sandbox's run link, such as `#/run?mod=…`. */
  hash: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Gets what the Share button says after a copy, then `""` once it stops
   * saying it. A stable function, such as a state setter: a new one reports
   * the feedback again and restarts its 2 seconds.
   */
  onFeedbackChange: (feedback: string) => void;
}

/** How the last "Copy link" went, while the Share button says so. */
type CopyState = "idle" | "copied" | "failed";

/** How long the Share button says how the copy went. */
const COPY_FEEDBACK_MS = 2000;

const SHARE_LABEL = "Share";

const COPY_FEEDBACK: Readonly<Record<CopyState, string>> = Object.freeze({
  idle: "",
  copied: "Link copied",
  failed: "Cannot copy the link",
});

/** The app's full address with the sandbox's run link as its hash. */
function buildRunLinkAddress(hash: string): string {
  const { origin, pathname, search } = window.location;
  const address = `${origin}${pathname}${search}${hash}`;
  return address;
}

function writeToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/** Writes `text` to the clipboard. Rejects when the clipboard refuses it or the browser has none. */
function copyText(text: string): Promise<void> {
  // Starting from a resolved promise turns a missing clipboard's TypeError into a rejection.
  return Promise.resolve(text).then(writeToClipboard);
}

function clearCopyTimer(timer: ReturnType<typeof setTimeout>): void {
  clearTimeout(timer);
}

/** Calls `endFeedback` after `COPY_FEEDBACK_MS`. Returns the function that cancels it. */
function scheduleFeedbackEnd(endFeedback: () => void): () => void {
  const timer = setTimeout(endFeedback, COPY_FEEDBACK_MS);
  return clearCopyTimer.bind(undefined, timer);
}

/**
 * The Share button and its menu of the ways to share the sandbox. For now
 * the menu has "Copy link", which copies the app's full address with the run
 * link. The menu then closes, and the button's tooltip says "Link copied",
 * or "Cannot copy the link", for 2 seconds. The menu is not modal, so a
 * click in the mod's frame still reaches the mod.
 */
export function ShareMenu({
  hash,
  isOpen,
  onOpenChange,
  onFeedbackChange,
}: ShareMenuProps): ReactElement {
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
          label={SHARE_LABEL}
          tooltip={isShowingFeedback ? COPY_FEEDBACK[copyState] : SHARE_LABEL}
          isTooltipOpen={isShowingFeedback ? true : undefined}
        >
          <Share2 />
        </StageBarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={keepFocusInFrame}>
        <DropdownMenuItem onSelect={handleCopySelect}>
          <Link />
          Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
