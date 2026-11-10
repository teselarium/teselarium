import type { ComponentProps, ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/vendor/shadcn/ui/tooltip.tsx";

type StageBarIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "aria-label"
> & {
  /** The accessible name, which is also the tooltip unless `tooltip` is given. */
  label: string;
  /** What the tooltip says instead of `label`, such as how an action went. */
  tooltip?: string;
  /** Holds the tooltip open while `true`. Without it, the tooltip opens on hover and focus. */
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
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          {...buttonProps}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}
