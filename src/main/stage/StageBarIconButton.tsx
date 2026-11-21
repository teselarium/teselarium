import type { ComponentProps, ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { HoverTooltip } from "../HoverTooltip.tsx";

type StageBarIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "aria-label"
> & {
  /** The accessible name, which is also the tooltip unless `tooltip` is given. */
  label: string;
  /** What the tooltip says instead of `label`, such as how an action went. */
  tooltip?: string;
  /**
   * Holds the tooltip open while `true`, on every device, for feedback such
   * as "Link copied". Without it, the tooltip opens on hover and focus, where
   * the pointer can hover.
   */
  isTooltipOpen?: boolean;
};

/**
 * An icon button of the stage bar: shadcn's `icon-sm` ghost Button, with
 * `label` as its accessible name and tooltip. The other props, and the ones a
 * `PopoverTrigger` or `DropdownMenuTrigger` passes with `asChild`, go to the
 * button.
 */
export function StageBarIconButton({
  label,
  tooltip,
  isTooltipOpen,
  children,
  ...buttonProps
}: StageBarIconButtonProps): ReactElement {
  return (
    <HoverTooltip content={tooltip ?? label} isPinnedOpen={isTooltipOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        {...buttonProps}
      >
        {children}
      </Button>
    </HoverTooltip>
  );
}
