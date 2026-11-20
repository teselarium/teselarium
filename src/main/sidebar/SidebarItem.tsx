import type { MouseEvent, ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/vendor/shadcn/ui/tooltip.tsx";
import type { SectionDefinition } from "../sections/section_registry.ts";
import { SectionIcon } from "./SectionIcon.tsx";
import { readSidebarRowClass } from "./sidebar_rows.ts";
import { SidebarIconCell } from "./SidebarIconCell.tsx";

interface SidebarItemProps {
  section: SectionDefinition;
  /** The section's start address, or `null` for a coming-soon section. */
  href: string | null;
  isCurrent: boolean;
  /** Expanded items show their label; in the rail it is only the accessible name and the tooltip. */
  isExpanded: boolean;
  onActivate: (sectionId: string) => void;
}

const COMING_SOON = "Coming soon";

/** A plain left click gets tab-bar navigation; a modified click opens the address as the browser does. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function renderLabel(
  section: SectionDefinition,
  isExpanded: boolean,
): ReactElement {
  if (!isExpanded) {
    return <span className="sr-only">{section.label}</span>;
  }
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
      {section.comingSoon ? (
        <span className="text-xs text-muted-foreground">{COMING_SOON}</span>
      ) : null}
    </>
  );
}

function readTooltipText(
  section: SectionDefinition,
  isExpanded: boolean,
): string {
  if (!section.comingSoon) {
    return section.label;
  }
  return isExpanded ? COMING_SOON : `${section.label}: ${COMING_SOON}`;
}

/**
 * One section of the sidebar: a link to the section's start address. A plain
 * click activates the section in the stage, so middle-click and "open in new
 * tab" still work. A coming-soon section is a disabled link that does not
 * navigate. In the rail, and for coming-soon sections, a tooltip names it.
 */
export function SidebarItem({
  section,
  href,
  isCurrent,
  isExpanded,
  onActivate,
}: SidebarItemProps): ReactElement {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (section.comingSoon) {
      event.preventDefault();
      return;
    }
    if (isPlainClick(event)) {
      event.preventDefault();
      onActivate(section.id);
    }
  }

  const className = readSidebarRowClass(isExpanded);
  const link = section.comingSoon ? (
    <a
      role="link"
      aria-disabled="true"
      tabIndex={0}
      className={className}
      onClick={handleClick}
    >
      <SidebarIconCell>
        <SectionIcon icon={section.icon} />
      </SidebarIconCell>
      {renderLabel(section, isExpanded)}
    </a>
  ) : (
    <a
      href={href ?? undefined}
      aria-current={isCurrent ? "page" : undefined}
      className={className}
      onClick={handleClick}
    >
      <SidebarIconCell>
        <SectionIcon icon={section.icon} />
      </SidebarIconCell>
      {renderLabel(section, isExpanded)}
    </a>
  );
  if (isExpanded && !section.comingSoon) {
    return <li>{link}</li>;
  }
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">
          {readTooltipText(section, isExpanded)}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
