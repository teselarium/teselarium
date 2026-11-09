import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";

interface ModInfoPopoverProps {
  sandbox: SandboxSnapshot;
}

/** What "Copy link" says: its label, or for a moment after a press, how it went. */
type CopyState = "idle" | "copied" | "failed";

/** How long "Copied" stays. */
const COPY_FEEDBACK_MS = 2000;

const COPY_LABELS: Readonly<Record<CopyState, string>> = {
  idle: "Copy link",
  copied: "Copied",
  failed: "Cannot copy",
};

/** The app's full address with the sandbox's run link as its hash. */
function buildRunLinkAddress(hash: string): string {
  const { origin, pathname, search } = window.location;
  const address = `${origin}${pathname}${search}${hash}`;
  return address;
}

function clearCopyTimer(timer: ReturnType<typeof setTimeout>): void {
  clearTimeout(timer);
}

/** Shows "Copy link" again after `COPY_FEEDBACK_MS`. Returns the function that cancels it. */
function scheduleCopyLabel(
  setCopyState: (copyState: CopyState) => void,
): () => void {
  const timer = setTimeout(
    setCopyState.bind(undefined, "idle"),
    COPY_FEEDBACK_MS,
  );
  return clearCopyTimer.bind(undefined, timer);
}

function renderDetail(term: string, value: string): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="[overflow-wrap:anywhere]">
        <code className="text-xs">{value}</code>
      </dd>
    </div>
  );
}

/**
 * The content of the information popover: the mod's source, or the resolved
 * mod reference before the mod file loaded, the collection's location when
 * the sandbox has one, and the run link with "Copy link", which copies the
 * app's full address with the run link and says "Copied" for a moment.
 */
export function ModInfoPopover({ sandbox }: ModInfoPopoverProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(
    function resetCopyLabel(): (() => void) | undefined {
      if (copyState === "idle") {
        return undefined;
      }
      return scheduleCopyLabel(setCopyState);
    },
    [copyState],
  );

  function showCopied(): void {
    setCopyState("copied");
  }

  function showCopyFailed(): void {
    setCopyState("failed");
  }

  function handleCopyClick(): void {
    navigator.clipboard
      .writeText(buildRunLinkAddress(sandbox.hash))
      .then(showCopied, showCopyFailed);
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="font-medium">{sandbox.mod?.title ?? "Mod"}</h2>
      <dl className="flex flex-col gap-2">
        {renderDetail("Mod", sandbox.mod?.source ?? sandbox.modReference)}
        {sandbox.collection === null
          ? null
          : renderDetail("Collection", sandbox.collection)}
        {renderDetail("Run link", sandbox.hash)}
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={handleCopyClick}
      >
        {copyState === "copied" ? <Check /> : <Copy />}
        {COPY_LABELS[copyState]}
      </Button>
    </div>
  );
}
