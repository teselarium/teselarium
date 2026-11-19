import type { CSSProperties, ReactElement } from "react";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import type { CombinationCatalog } from "./lib/core/combinations/index.ts";
import type { Stage } from "./lib/core/stage/index.ts";
import { AppHeader } from "./main/AppHeader.tsx";
import { PageView } from "./main/pages/PageView.tsx";
import type { SectionDefinition } from "./main/sections/section_registry.ts";
import type { SectionSwitches } from "./main/sections/section_switches.ts";
import type { PlayerSites } from "./main/settings/player_sites.ts";
import type { RecentlyUsed } from "./main/settings/recently_used.ts";
import type { SiteDecisions } from "./main/settings/site_decisions.ts";
import type { CatalogSetting } from "./main/settings/catalog_setting.ts";
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
import type { TheaterSetting } from "./main/stage/theater_setting.ts";
import type { AppTheme } from "./main/theme/app_theme.ts";
import { useStoreSnapshot } from "./main/use_store_snapshot.ts";
import "./main/app.css";

interface AppProps {
  stage: Stage;
  /** The summaries and counts of the stage bar's lists. */
  combinations: CombinationCatalog;
  /** The mods, collections and mosaics tried in combination sandboxes. */
  recentlyUsed: RecentlyUsed;
  appTheme: AppTheme;
  /** The available sections, in registry order. */
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  tileMedia: TileMediaSetting;
  catalogSetting: CatalogSetting;
  theater: TheaterSetting;
  siteDecisions: SiteDecisions;
  playerSites: PlayerSites;
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
  combinations,
  recentlyUsed,
  appTheme,
  sections,
  switches,
  tileMedia,
  catalogSetting,
  theater,
  siteDecisions,
  playerSites,
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
              catalogSetting={catalogSetting}
              recentlyUsed={recentlyUsed}
              siteDecisions={siteDecisions}
              playerSites={playerSites}
            />
          </div>
          <StageView
            stage={stage}
            combinations={combinations}
            recentlyUsed={recentlyUsed}
            playerSites={playerSites}
            theater={theater}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
