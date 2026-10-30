import type { CSSProperties, ReactElement } from "react";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import type { Stage } from "./lib/core/stage/index.ts";
import { AppHeader } from "./main/AppHeader.tsx";
import { PageView } from "./main/pages/PageView.tsx";
import type { SectionDefinition } from "./main/sections/section_registry.ts";
import type { SectionSwitches } from "./main/sections/section_switches.ts";
import type { TileMediaSetting } from "./main/settings/tile_media_setting.ts";
import { Sidebar } from "./main/sidebar/Sidebar.tsx";
import {
  readSidebarSnapshot,
  subscribeSidebar,
} from "./main/sidebar/sidebar_layout.ts";
import type {
  SidebarLayoutStore,
  SidebarSnapshot,
} from "./main/sidebar/sidebar_layout.ts";
import { StageView } from "./main/stage/StageView.tsx";
import type { AppTheme } from "./main/theme/app_theme.ts";
import { useStoreSnapshot } from "./main/use_store_snapshot.ts";
import "./main/app.css";

interface AppProps {
  stage: Stage;
  appTheme: AppTheme;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  tileMedia: TileMediaSetting;
  layout: SidebarLayoutStore;
}

/** The sidebar's column: its width, the rail, or nothing. The narrow drawer never changes it. */
function readSidebarColumn(snapshot: SidebarSnapshot): string {
  if (snapshot.state === "hidden") {
    return "0px";
  }
  if (snapshot.isNarrow || snapshot.state === "collapsed") {
    return "var(--sidebar-rail-width)";
  }
  return `${snapshot.width}px`;
}

/**
 * The header above the sidebar and the main area. The main area shows the
 * page the stage shows, if any, before the stage view. The stage view stays
 * mounted in the same place whatever is shown, so no frame moves or reloads.
 */
function App({
  stage,
  appTheme,
  sections,
  switches,
  tileMedia,
  layout,
}: AppProps): ReactElement {
  const layoutSnapshot = useStoreSnapshot(
    layout,
    subscribeSidebar,
    readSidebarSnapshot,
  );
  const layoutStyle = {
    "--sidebar-column": readSidebarColumn(layoutSnapshot),
  } as CSSProperties;
  return (
    <TooltipProvider>
      <div className="app-layout" style={layoutStyle}>
        <AppHeader layout={layout} />
        <Sidebar
          stage={stage}
          sections={sections}
          switches={switches}
          layout={layout}
        />
        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 overflow-y-auto empty:hidden">
            <PageView
              stage={stage}
              appTheme={appTheme}
              sections={sections}
              switches={switches}
              tileMedia={tileMedia}
            />
          </div>
          <StageView stage={stage} />
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
