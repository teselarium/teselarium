/**
 * The look of a sidebar row, shared by the section items and the theme
 * control: an icon cell, then the label when expanded. The highlight spans
 * the row when expanded, and only the icon cell in the rail.
 */
const ROW_CLASS = [
  "flex items-center rounded-md text-sm text-sidebar-foreground",
  // Hover is a lighter accent than the current item's, so the two never look alike.
  "hover:bg-sidebar-accent/40",
  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:hover:bg-sidebar-accent",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent",
].join(" ");

/** The classes of a row: the whole width with room after the label, or just the icon cell. */
export function readSidebarRowClass(isExpanded: boolean): string {
  return isExpanded
    ? `${ROW_CLASS} w-full gap-1 pr-3`
    : `${ROW_CLASS} w-(--sidebar-cell-size)`;
}

/** The classes of the app's name in the heading row; `sr-only` when only the rail is shown. */
export function readHeadingClass(isShown: boolean): string {
  return isShown
    ? "min-w-0 truncate text-xl font-semibold tracking-tight"
    : "sr-only";
}
