import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { Separator } from "@/vendor/shadcn/ui/separator.tsx";
import { Sheet, SheetContent, SheetTitle } from "@/vendor/shadcn/ui/sheet.tsx";
import {
  buildSectionHash,
  openStageSection,
  readStageSnapshot,
  subscribeStage,
} from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import type { SectionDefinition } from "../sections/section_registry.ts";
import {
  isSectionShown,
  readSectionSwitchesSnapshot,
  subscribeSectionSwitches,
} from "../sections/section_switches.ts";
import type { SectionSwitches } from "../sections/section_switches.ts";
import type { AppTheme } from "../theme/app_theme.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  collapseSidebar,
  expandSidebar,
  readSidebarSnapshot,
  subscribeSidebar,
} from "./sidebar_layout.ts";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";
import { SidebarHeadingRow } from "./SidebarHeadingRow.tsx";
import { SidebarIconCell } from "./SidebarIconCell.tsx";
import { SidebarItem } from "./SidebarItem.tsx";
import { SidebarResizeHandle } from "./SidebarResizeHandle.tsx";
import { SidebarThemeControl } from "./SidebarThemeControl.tsx";
import { readHeadingClass } from "./sidebar_rows.ts";
import { useSidebarShortcut } from "./use_sidebar_shortcut.ts";

/** The sidebar's `<aside>`. */
export const SIDEBAR_ID = "app-sidebar";

/** The id the hamburger button's `aria-controls` points to: the rail's navigation. */
export const SIDEBAR_NAV_ID = "app-sidebar-nav";

const APP_NAME = "OpenTesela";

/** The list classes: no padding of their own, so every row starts at the rail's icon axis. */
const LIST_CLASS = "flex flex-col gap-1";

interface SidebarProps {
  stage: Stage;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  layout: SidebarLayoutStore;
  /** The theme the sidebar's Theme control chooses. */
  appTheme: AppTheme;
}

interface SectionListProps {
  stage: Stage;
  sections: readonly SectionDefinition[];
  currentSection: string | null;
  isExpanded: boolean;
  onActivate: (sectionId: string) => void;
  /** The rail's navigation has the id the hamburger button points to; the drawer's has none. */
  navigationId?: string;
}

function renderItems(
  props: SectionListProps,
  group: SectionDefinition["group"],
): ReactElement[] {
  const items: ReactElement[] = [];
  for (const section of props.sections) {
    if (section.group !== group) {
      continue;
    }
    items.push(
      <SidebarItem
        key={section.id}
        section={section}
        href={
          section.comingSoon
            ? null
            : buildSectionHash(props.stage.routing, section.id)
        }
        isCurrent={section.id === props.currentSection}
        isExpanded={props.isExpanded}
        onActivate={props.onActivate}
      />,
    );
  }
  return items;
}

/** The `main` items, then a divider and the `footer` items right after them. */
function SectionList(props: SectionListProps): ReactElement {
  return (
    <nav
      id={props.navigationId}
      aria-label="Sections"
      className="flex flex-col pt-2"
    >
      <ul className={LIST_CLASS}>{renderItems(props, "main")}</ul>
      <Separator className="my-2" />
      <ul className={LIST_CLASS}>{renderItems(props, "footer")}</ul>
    </nav>
  );
}

interface ThemeListProps {
  appTheme: AppTheme;
  isExpanded: boolean;
}

/** The Theme control, in its own list after the `footer` items: it is not a section. */
function ThemeList({ appTheme, isExpanded }: ThemeListProps): ReactElement {
  return (
    <ul className={`${LIST_CLASS} pt-1 pb-2`}>
      <SidebarThemeControl appTheme={appTheme} isExpanded={isExpanded} />
    </ul>
  );
}

interface SidebarItemsProps {
  children: ReactNode;
}

/**
 * The section items and the Theme control, between the heading row and the
 * toggle row, which stay in place: when they do not fit, as on a landscape
 * phone, only they scroll. It spans the sidebar's inset, so the rows' focus
 * outlines are not cut at its edges.
 */
function SidebarItems({ children }: SidebarItemsProps): ReactElement {
  return (
    <div
      data-sidebar-items=""
      className="-mx-(--sidebar-inset) flex min-h-0 flex-1 flex-col overflow-y-auto px-(--sidebar-inset)"
    >
      {children}
    </div>
  );
}

interface SidebarToggleProps {
  layout: SidebarLayoutStore;
  isExpanded: boolean;
  /** On a narrow viewport, Expand opens the drawer. */
  isDrawerOpen: boolean;
}

/** At the sidebar's bottom, in the icon cell: Collapse when expanded, Expand in the rail. */
function SidebarToggle({
  layout,
  isExpanded,
  isDrawerOpen,
}: SidebarToggleProps): ReactElement {
  function handleCollapseClick(): void {
    collapseSidebar(layout);
  }

  function handleExpandClick(): void {
    expandSidebar(layout);
  }

  const button = isExpanded ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Collapse sidebar"
      onClick={handleCollapseClick}
    >
      <PanelLeftClose />
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Expand sidebar"
      aria-expanded={isDrawerOpen}
      onClick={handleExpandClick}
    >
      <PanelLeftOpen />
    </Button>
  );
  return (
    <div className="flex shrink-0 py-2">
      <SidebarIconCell>{button}</SidebarIconCell>
    </div>
  );
}

interface SidebarDrawerProps {
  layout: SidebarLayoutStore;
  appTheme: AppTheme;
  listProps: SectionListProps;
  isOpen: boolean;
}

/**
 * The expanded sidebar of a narrow viewport, over the content. Its content
 * has the rail's geometry (app.css), so its first row is where the rail's is.
 */
function SidebarDrawer({
  layout,
  appTheme,
  listProps,
  isOpen,
}: SidebarDrawerProps): ReactElement {
  function handleOpenChange(isOpenNow: boolean): void {
    if (!isOpenNow) {
      collapseSidebar(layout);
    }
  }

  const heading = (
    <SheetTitle className={readHeadingClass(true)}>{APP_NAME}</SheetTitle>
  );
  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {/* The hamburger button, the backdrop and Escape close it: no close button of its own. */}
      <SheetContent
        side="left"
        showCloseButton={false}
        className="sidebar-drawer w-64 gap-0 bg-sidebar p-0 text-sidebar-foreground"
        aria-describedby={undefined}
      >
        <div className="m-(--shell-gap) flex min-h-0 flex-1 flex-col border border-transparent px-(--sidebar-inset)">
          <SidebarHeadingRow
            layout={layout}
            navigationId={SIDEBAR_NAV_ID}
            heading={heading}
          />
          <SidebarItems>
            <SectionList {...listProps} isExpanded={true} />
            <ThemeList appTheme={appTheme} isExpanded={true} />
          </SidebarItems>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The sections the user did not switch off. */
function filterShownSections(
  sections: readonly SectionDefinition[],
  switchesSnapshot: ReturnType<typeof readSectionSwitchesSnapshot>,
): SectionDefinition[] {
  const shown: SectionDefinition[] = [];
  for (const section of sections) {
    if (isSectionShown(switchesSnapshot, section.id)) {
      shown.push(section);
    }
  }
  return shown;
}

/** The active section, when its item is shown: a hidden section makes no item current. */
function findCurrentSection(
  shownSections: readonly SectionDefinition[],
  activeSection: string | null,
): string | null {
  for (const section of shownSections) {
    if (section.id === activeSection) {
      return activeSection;
    }
  }
  return null;
}

/**
 * The left sidebar: the hamburger button and the app's name, then one item
 * per shown section and the Theme control, expanded with labels or collapsed
 * to an icon rail. Hidden, it shrinks to the chip of its hamburger button,
 * and renders nothing else. On a narrow viewport it stays a rail, and
 * expanding it opens the same rows in a drawer over the content. Every row
 * starts with the same icon cell, so no button moves between the states.
 * While it has stepped aside for the stage bar, it is the rail, and says so
 * in `data-stepped-aside`.
 */
export function Sidebar({
  stage,
  sections,
  switches,
  layout,
  appTheme,
}: SidebarProps): ReactElement {
  const layoutSnapshot = useStoreSnapshot(
    layout,
    subscribeSidebar,
    readSidebarSnapshot,
  );
  const stageSnapshot = useStoreSnapshot(
    stage,
    subscribeStage,
    readStageSnapshot,
  );
  const switchesSnapshot = useStoreSnapshot(
    switches,
    subscribeSectionSwitches,
    readSectionSwitchesSnapshot,
  );
  useSidebarShortcut(layout);

  function handleActivate(sectionId: string): void {
    openStageSection(stage, sectionId);
    if (layoutSnapshot.isNarrow) {
      collapseSidebar(layout);
    }
  }

  const shownSections = filterShownSections(sections, switchesSnapshot);
  const listProps: SectionListProps = {
    stage,
    sections: shownSections,
    currentSection: findCurrentSection(
      shownSections,
      stageSnapshot.activeSection,
    ),
    isExpanded: !layoutSnapshot.isNarrow && layoutSnapshot.state === "expanded",
    onActivate: handleActivate,
  };
  const isDrawerOpen =
    layoutSnapshot.isNarrow && layoutSnapshot.state === "expanded";
  const isHidden = layoutSnapshot.state === "hidden";
  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-sidebar-border bg-sidebar px-(--sidebar-inset) text-sidebar-foreground shadow-panel"
      data-state={layoutSnapshot.state}
      data-stepped-aside={layoutSnapshot.isSteppedAside ? "" : undefined}
    >
      <SidebarHeadingRow
        layout={layout}
        navigationId={SIDEBAR_NAV_ID}
        heading={
          <h1 className={readHeadingClass(listProps.isExpanded)}>{APP_NAME}</h1>
        }
      />
      {isHidden ? null : (
        <>
          <SidebarItems>
            <SectionList {...listProps} navigationId={SIDEBAR_NAV_ID} />
            <ThemeList appTheme={appTheme} isExpanded={listProps.isExpanded} />
          </SidebarItems>
          <SidebarToggle
            layout={layout}
            isExpanded={listProps.isExpanded}
            isDrawerOpen={isDrawerOpen}
          />
          {layoutSnapshot.isNarrow ? null : (
            <SidebarResizeHandle
              layout={layout}
              width={layoutSnapshot.width}
              maxWidth={layoutSnapshot.maxWidth}
              isCollapsed={layoutSnapshot.state === "collapsed"}
            />
          )}
          <SidebarDrawer
            layout={layout}
            appTheme={appTheme}
            listProps={listProps}
            isOpen={isDrawerOpen}
          />
        </>
      )}
    </aside>
  );
}
