import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactElement } from "react";
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
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  collapseSidebar,
  expandSidebar,
  readSidebarSnapshot,
  subscribeSidebar,
} from "./sidebar_layout.ts";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";
import { SidebarItem } from "./SidebarItem.tsx";
import { SidebarResizeHandle } from "./SidebarResizeHandle.tsx";
import { useSidebarShortcut } from "./use_sidebar_shortcut.ts";

/** The id the hamburger button's `aria-controls` points to. */
export const SIDEBAR_ID = "app-sidebar";

interface SidebarProps {
  stage: Stage;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  layout: SidebarLayoutStore;
}

interface SectionListProps {
  stage: Stage;
  sections: readonly SectionDefinition[];
  currentSection: string | null;
  isExpanded: boolean;
  onActivate: (sectionId: string) => void;
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

/** The `main` items at the top, then the `footer` items at the bottom. */
function SectionList(props: SectionListProps): ReactElement {
  const listClass = props.isExpanded
    ? "flex flex-col gap-1 px-2"
    : "flex flex-col gap-1 px-1.5";
  return (
    <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col py-2">
      <ul className={listClass}>{renderItems(props, "main")}</ul>
      <div className="mt-auto">
        <Separator className="my-2" />
        <ul className={listClass}>{renderItems(props, "footer")}</ul>
      </div>
    </nav>
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
 * The left sidebar: one item per shown section, expanded with labels,
 * collapsed to an icon rail, or hidden. On a narrow viewport it stays a rail,
 * and expanding it opens the same items in a drawer over the content.
 */
export function Sidebar({
  stage,
  sections,
  switches,
  layout,
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

  function handleCollapseClick(): void {
    collapseSidebar(layout);
  }

  function handleExpandClick(): void {
    expandSidebar(layout);
  }

  function handleDrawerOpenChange(isOpen: boolean): void {
    if (!isOpen) {
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
  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className="relative flex min-h-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      data-state={layoutSnapshot.state}
      hidden={layoutSnapshot.state === "hidden"}
    >
      <SectionList {...listProps} />
      <div
        className={
          listProps.isExpanded
            ? "flex justify-end p-2"
            : "flex justify-center p-2"
        }
      >
        {listProps.isExpanded ? (
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
        )}
      </div>
      {layoutSnapshot.isNarrow ? null : (
        <SidebarResizeHandle
          layout={layout}
          width={layoutSnapshot.width}
          maxWidth={layoutSnapshot.maxWidth}
          isCollapsed={layoutSnapshot.state === "collapsed"}
        />
      )}
      <Sheet open={isDrawerOpen} onOpenChange={handleDrawerOpenChange}>
        <SheetContent
          side="left"
          className="w-64 gap-0 bg-sidebar p-0 pt-10 text-sidebar-foreground"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Sections</SheetTitle>
          <SectionList {...listProps} isExpanded={true} />
        </SheetContent>
      </Sheet>
    </aside>
  );
}
