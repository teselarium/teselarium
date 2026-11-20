import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/vendor/shadcn/ui/tooltip.tsx";

/** How a capsule shrinks when the capsules do not fit: the higher the weight, the sooner. */
export type CapsuleShrink = 1 | 2 | 3;

type CombinationCapsuleProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "aria-label" | "children"
> & {
  /** The capsule's kind, such as "Mod", which starts its accessible name. */
  kind: string;
  icon: ReactNode;
  title: string;
  /** Shown after the title from 960px of bar width, and part of the accessible name. */
  version?: string;
  shrink: CapsuleShrink;
  /** The title is hidden under 720px of bar width, leaving the icon. */
  hidesTitleWhenNarrow?: boolean;
  /** The dashed border of an unsaved combination. */
  isDashed?: boolean;
  /**
   * Called when the tooltip opens: after the pointer rests on the capsule,
   * or when the keyboard focuses it. The capsule's list starts its loads.
   */
  onIntent?: () => void;
};

const SHRINK_CLASSES: Readonly<Record<CapsuleShrink, string>> = Object.freeze({
  1: "shrink",
  2: "shrink-[2]",
  3: "shrink-[3]",
});

function joinClasses(classes: readonly (string | false)[]): string {
  const kept: string[] = [];
  for (const className of classes) {
    if (className !== false) {
      kept.push(className);
    }
  }
  return kept.join(" ");
}

/** "Mod: Country Map 1.0.1": the kind, the full title and the version. */
function buildCapsuleName(
  kind: string,
  title: string,
  version?: string,
): string {
  const name =
    version === undefined
      ? `${kind}: ${title}`
      : `${kind}: ${title} ${version}`;
  return name;
}

/**
 * A capsule of the stage bar's recipe: shadcn's outline Button with the
 * kind's icon, the title, the version for the mod, and a chevron. It is at
 * most 16rem wide, its title ends with an ellipsis when it does not fit, and
 * its tooltip and accessible name give the kind and the full title. The
 * other props, and the ones a `PopoverTrigger` or `DropdownMenuTrigger`
 * passes with `asChild`, go to the button. Its tooltip opening tells
 * `onIntent`, so its list measures ahead.
 */
export function CombinationCapsule({
  kind,
  icon,
  title,
  version,
  shrink,
  hidesTitleWhenNarrow = false,
  isDashed = false,
  onIntent,
  className,
  ...buttonProps
}: CombinationCapsuleProps): ReactElement {
  const name = buildCapsuleName(kind, title, version);

  function handleTooltipOpenChange(isOpen: boolean): void {
    if (isOpen) {
      onIntent?.();
    }
  }

  return (
    <Tooltip onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={name}
          className={joinClasses([
            "h-7 min-w-0 max-w-[16rem] gap-1.5 px-2 font-normal",
            SHRINK_CLASSES[shrink],
            isDashed && "border-dashed",
            className ?? false,
          ])}
          {...buttonProps}
        >
          {icon}
          <span
            className={joinClasses([
              "min-w-0 truncate",
              hidesTitleWhenNarrow && "@max-[719px]:hidden",
            ])}
          >
            {title}
          </span>
          {version === undefined ? null : (
            <Badge
              variant="outline"
              className="tabular-nums @max-[959px]:hidden"
            >
              {version}
            </Badge>
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
