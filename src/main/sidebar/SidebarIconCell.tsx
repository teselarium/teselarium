import type { ReactElement, ReactNode } from "react";

interface SidebarIconCellProps {
  children: ReactNode;
}

/**
 * The box every sidebar row starts with, as wide as the rail inside its
 * padding, with its content centered. The hamburger button, the section
 * icons, the theme control and the collapse toggle all sit in one, so they
 * keep their place whether the sidebar is expanded, collapsed or hidden.
 */
export function SidebarIconCell({
  children,
}: SidebarIconCellProps): ReactElement {
  return (
    <span className="flex h-9 w-(--sidebar-cell-size) shrink-0 items-center justify-center">
      {children}
    </span>
  );
}
