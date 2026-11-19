import { ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/vendor/shadcn/ui/popover.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/vendor/shadcn/ui/tooltip.tsx";
import {
  buildSitesDrop,
  openStageCombination,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxSnapshot,
  SitesLine,
  Stage,
} from "../../lib/core/stage/index.ts";
import { keepFocusInFrame } from "./frame_focus.ts";

interface SitesChipProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
  /** The `sites` mosaic, once its file is loaded. */
  sites: NonNullable<SandboxSnapshot["sites"]>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function renderLine(line: SitesLine): ReactElement {
  return (
    <li key={line.host} className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <code className="text-xs [overflow-wrap:anywhere]">{line.host}</code>
        <span className="text-xs text-muted-foreground">
          {line.granted ? "Granted" : "Not granted"}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">{line.reason}</span>
    </li>
  );
}

/**
 * For a sandbox opened with `sites`: a chip with a shield and the number of
 * `show` lines of that mosaic, named "Sites from <mosaic title>". Its popover
 * lists each line's host, reason and whether it was granted, and "Stop using
 * these sites" opens the same combination without `sites`.
 */
export function SitesChip({
  stage,
  sandbox,
  sites,
  isOpen,
  onOpenChange,
}: SitesChipProps): ReactElement {
  const name = `Sites from ${sites.title}`;

  function handleStopClick(): void {
    onOpenChange(false);
    openStageCombination(stage, sandbox.id, buildSitesDrop(sandbox.link));
  }

  const lines: ReactElement[] = [];
  for (const line of sites.lines) {
    lines.push(renderLine(line));
  }
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={name}
              className="h-7 shrink-0 gap-1 px-2 tabular-nums"
            >
              <ShieldCheck />
              {sites.lines.length}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 text-sm"
        onCloseAutoFocus={keepFocusInFrame}
      >
        <h2 className="font-medium">{name}</h2>
        <p className="text-xs text-muted-foreground">
          This combination keeps the sites of{" "}
          <code className="[overflow-wrap:anywhere]">{sites.source}</code>.
        </p>
        <ul className="flex flex-col gap-2">{lines}</ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={handleStopClick}
        >
          Stop using these sites
        </Button>
      </PopoverContent>
    </Popover>
  );
}
