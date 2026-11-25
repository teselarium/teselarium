import { useSyncExternalStore } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/vendor/shadcn/ui/tooltip.tsx";

/** Matches while the primary pointer can hover: a mouse or a trackpad, not a finger. */
const HOVER_QUERY = "(hover: hover)";

interface HoverTooltipProps {
  /** The trigger, an element that takes the trigger's props (`asChild`). */
  children: ReactElement;
  /** The tooltip's text. It must also be in the trigger's accessible name or visible text. */
  content: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  /** Controls the hover and focus tooltip, where the pointer can hover. */
  open?: boolean;
  /** Told when the hover and focus tooltip opens or closes, where the pointer can hover. */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Holds the tooltip open while `true`, on every device: the app's own
   * feedback, such as "Link copied", which no hover or tap opened.
   */
  isPinnedOpen?: boolean;
}

function subscribeHoverQuery(listener: () => void): () => void {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", listener);
  return query.removeEventListener.bind(query, "change", listener);
}

function readCanHover(): boolean {
  return window.matchMedia(HOVER_QUERY).matches;
}

/** Whether the primary pointer can hover, followed as it changes, such as when a tablet is docked. */
function useCanHover(): boolean {
  return useSyncExternalStore(subscribeHoverQuery, readCanHover);
}

/** The tooltip's state: pinned open, hover and focus where the pointer can hover, or closed. */
function readOpenState(
  canHover: boolean,
  open: boolean | undefined,
  isPinnedOpen: boolean,
): boolean | undefined {
  if (isPinnedOpen) {
    return true;
  }
  return canHover ? open : false;
}

/**
 * shadcn's tooltip, only where the primary pointer can hover. On a touch
 * device a tap focuses the trigger, which would open the tooltip and leave
 * it on screen, so there the tooltip stays closed, and only the trigger is
 * rendered, unless the app pins the tooltip open. The trigger stays the same
 * element in both cases, so a change of device or a pinned tooltip never
 * remounts it. The tooltip's text is never the only source of information:
 * the trigger's name or text holds it too.
 */
export function HoverTooltip({
  children,
  content,
  side,
  open,
  onOpenChange,
  isPinnedOpen = false,
}: HoverTooltipProps): ReactElement {
  const canHover = useCanHover();
  return (
    <Tooltip
      open={readOpenState(canHover, open, isPinnedOpen)}
      onOpenChange={canHover ? onOpenChange : undefined}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
