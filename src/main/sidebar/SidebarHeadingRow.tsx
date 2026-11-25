import type { ReactElement } from "react";
import { HamburgerButton } from "./HamburgerButton.tsx";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";
import { SidebarIconCell } from "./SidebarIconCell.tsx";

interface SidebarHeadingRowProps {
  layout: SidebarLayoutStore;
  /** The id of the navigation the hamburger button shows and hides. */
  navigationId: string;
  /** The app's name, after the hamburger button: the page's heading, or the drawer's title. */
  heading: ReactElement;
}

/**
 * The sidebar's first row: the hamburger button, then the app's name. It is
 * one row tall and starts at the sidebar's top edge, over its border, so it
 * lines up with the stage bar (see app.css).
 */
export function SidebarHeadingRow({
  layout,
  navigationId,
  heading,
}: SidebarHeadingRowProps): ReactElement {
  return (
    <div
      className="-mt-px flex h-(--shell-row-height) shrink-0 items-center"
      data-sidebar-heading-row=""
    >
      <SidebarIconCell>
        <HamburgerButton layout={layout} navigationId={navigationId} />
      </SidebarIconCell>
      {heading}
    </div>
  );
}
