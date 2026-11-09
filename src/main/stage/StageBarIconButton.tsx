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
  /** The accessible name, which is also the tooltip. */
  label: string;
};

/**
 * An icon button of the stage bar: shadcn's `icon-sm` ghost Button, with
 * `label` as its accessible name and tooltip. The other props, and the ones a
 * `PopoverTrigger` passes with `asChild`, go to the button.
 */
export function StageBarIconButton({
  label,
  children,
  ...buttonProps
}: StageBarIconButtonProps): ReactElement {
  return (
    <Tooltip>
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
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
