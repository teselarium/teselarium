import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { buttonVariants } from "@/vendor/shadcn/ui/button.tsx";
import { HoverTooltip } from "../HoverTooltip.tsx";
import type { DetailOpen } from "./detail_viewers.ts";
import { copyText, scheduleFeedbackEnd } from "./run_link_copy.ts";
import { StageBarIconButton } from "./StageBarIconButton.tsx";

interface DetailActionsProps {
  /** The detail's term, such as "Run link", which names both controls. */
  term: string;
  /** The detail's value, a web address (see `isWebAddress`), which Copy copies. */
  value: string;
  /** Where the Open link goes, or `null` for no Open link. */
  open: DetailOpen | null;
  /**
   * Gets what the Copy button says after a copy, then `""` once it stops
   * saying it. A stable function, such as a state setter.
   */
  onFeedbackChange: (feedback: string) => void;
}

/** How the last copy went, while the button says so. */
type CopyState = "idle" | "copied" | "failed";

const COPY_FEEDBACK: Readonly<Record<CopyState, string>> = Object.freeze({
  idle: "",
  copied: "Copied",
  failed: "Cannot copy",
});

/** The Open link looks like the stage bar's icon buttons. */
const OPEN_LINK_CLASSES = buttonVariants({ variant: "ghost", size: "icon-sm" });

/** The Open link: `Open <term> in <place>`, to a new tab with no opener and no referrer. */
function renderOpenLink(name: string, open: DetailOpen): ReactElement {
  const label = `Open ${name} in ${open.place}`;
  return (
    <HoverTooltip content={label}>
      <a
        href={open.address}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={OPEN_LINK_CLASSES}
      >
        <ExternalLink />
      </a>
    </HoverTooltip>
  );
}

/**
 * A detail's controls: "Copy <term>", which puts the value on the clipboard
 * and says "Copied", or "Cannot copy", in its tooltip for 2 seconds, and,
 * unless `open` is `null`, "Open <term> in <place>", a link to a new tab,
 * such as the entry's viewer, with no opener and no referrer, so the opened
 * tab gets neither the app's window nor its address with the run link.
 */
export function DetailActions({
  term,
  value,
  open,
  onFeedbackChange,
}: DetailActionsProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const name = term.toLowerCase();
  const copyLabel = `Copy ${name}`;

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

  function handleCopyClick(): void {
    void copyText(value).then(
      setCopyState.bind(undefined, "copied"),
      setCopyState.bind(undefined, "failed"),
    );
  }

  const isShowingFeedback = copyState !== "idle";
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <StageBarIconButton
        label={copyLabel}
        tooltip={isShowingFeedback ? COPY_FEEDBACK[copyState] : copyLabel}
        isTooltipOpen={isShowingFeedback ? true : undefined}
        onClick={handleCopyClick}
      >
        <Copy />
      </StageBarIconButton>
      {open === null ? null : renderOpenLink(name, open)}
    </span>
  );
}
