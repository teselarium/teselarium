import { Moon, Sun, SunMoon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { HoverTooltip } from "../HoverTooltip.tsx";
import type { ThemeChoice } from "../../lib/core/theme/index.ts";
import {
  chooseTheme,
  readAppThemeSnapshot,
  subscribeAppTheme,
} from "../theme/app_theme.ts";
import type { AppTheme } from "../theme/app_theme.ts";
import { readNextThemeChoice, readThemeLabel } from "../theme/theme_options.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { readSidebarRowClass } from "./sidebar_rows.ts";
import { SidebarIconCell } from "./SidebarIconCell.tsx";

interface SidebarThemeControlProps {
  appTheme: AppTheme;
  /** Expanded, the control shows its label; in every state, a tooltip names the choice. */
  isExpanded: boolean;
}

const THEME_LABEL = "Theme";

/** The icon of each choice: the choice, not the color scheme it resolves to. */
const CHOICE_ICONS: Readonly<Record<ThemeChoice, LucideIcon>> = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
};

/** Undoes the button's own sizes, so the control has the look of a sidebar row. */
const BUTTON_RESET_CLASS = "h-auto justify-start p-0 font-normal";

function readControlName(choice: ThemeChoice): string {
  return `${THEME_LABEL}: ${readThemeLabel(choice)}`;
}

/**
 * The sidebar's Theme control, after the `footer` items: a button showing
 * the current choice's icon. Each press moves to the next choice (System,
 * Light, Dark, then System again), the same choice as the Settings page's
 * Theme control. Where the pointer can hover, a tooltip names the current
 * choice in every state, and stays open after a press so it shows the new
 * one; the accessible name always holds it, and a polite live region
 * announces it. It is a button, not a section item, so it is never the
 * current item.
 */
export function SidebarThemeControl({
  appTheme,
  isExpanded,
}: SidebarThemeControlProps): ReactElement {
  const snapshot = useStoreSnapshot(
    appTheme,
    subscribeAppTheme,
    readAppThemeSnapshot,
  );
  const [isTooltipOpen, setTooltipOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  function openTooltip(): void {
    setTooltipOpen(true);
  }

  function handleClick(): void {
    const next = readNextThemeChoice(snapshot.choice);
    chooseTheme(appTheme, next);
    setAnnouncement(readControlName(next));
    // Radix closes a tooltip when its trigger is pressed: it opens again
    // after that, so it shows the new choice.
    window.setTimeout(openTooltip, 0);
  }

  const name = readControlName(snapshot.choice);
  const ChoiceIcon = CHOICE_ICONS[snapshot.choice];
  return (
    <li>
      <HoverTooltip
        content={name}
        side="right"
        open={isTooltipOpen}
        onOpenChange={setTooltipOpen}
      >
        <Button
          type="button"
          variant="ghost"
          className={`${BUTTON_RESET_CLASS} ${readSidebarRowClass(isExpanded)}`}
          aria-label={name}
          onClick={handleClick}
        >
          <SidebarIconCell>
            <ChoiceIcon className="size-5" aria-hidden="true" />
          </SidebarIconCell>
          {isExpanded ? (
            <span className="min-w-0 flex-1 truncate text-left">
              {THEME_LABEL}
            </span>
          ) : null}
        </Button>
      </HoverTooltip>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </li>
  );
}
