import { StrictMode } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import {
  resolveAppCatalog,
  resolveDefaultModSettings,
} from "./lib/core/engine/index.ts";
import type { ResolvedAppCatalog } from "./lib/core/engine/index.ts";
import { createCombinationCatalog } from "./lib/core/combinations/index.ts";
import {
  createStage,
  followHistory,
  readStageCatalog,
} from "./lib/core/stage/index.ts";
import type { Stage } from "./lib/core/stage/index.ts";
import { buildThemeTokenStyles } from "./lib/core/theme/index.ts";
import { APP_CATALOG } from "./main/app_catalog.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";
import { NPM_HOST } from "./main/library_host.ts";
import {
  availableSections,
  buildStageRouting,
  validateRegistry,
} from "./main/sections/section_registry.ts";
import type { SectionDefinition } from "./main/sections/section_registry.ts";
import { createSectionSwitches } from "./main/sections/section_switches.ts";
import { VANILLA_SECTIONS } from "./main/sections/vanilla_sections.ts";
import {
  createCatalogSetting,
  readStartCatalogDefaultMosaics,
} from "./main/settings/catalog_setting.ts";
import { createPlayerSites } from "./main/settings/player_sites.ts";
import {
  createRecentlyUsed,
  recordRecentlyUsed,
} from "./main/settings/recently_used.ts";
import {
  createSiteDecisions,
  readSiteDecisionsSnapshot,
  rememberSiteDecisions,
} from "./main/settings/site_decisions.ts";
import {
  createTileMediaSetting,
  readStartTileLinkedMedia,
} from "./main/settings/tile_media_setting.ts";
import {
  createTheaterSetting,
  readStartTheaterMode,
} from "./main/stage/theater_setting.ts";
import {
  changeSidebarViewport,
  createSidebarLayout,
  NARROW_VIEWPORT_QUERY,
} from "./main/sidebar/sidebar_layout.ts";
import type { SidebarLayoutStore } from "./main/sidebar/sidebar_layout.ts";
import { createListChoices } from "./main/stage/list_choices.ts";
import { StartErrorScreen } from "./main/StartErrorScreen.tsx";
import {
  createAppTheme,
  readStartColorScheme,
} from "./main/theme/app_theme.ts";

// The tokens the app's own styles use, before anything renders.
const tokenStyle = document.createElement("style");
tokenStyle.textContent = buildThemeTokenStyles();
document.head.append(tokenStyle);

function followCurrentEntry(stage: Stage): void {
  followHistory(stage, window.location.hash, window.history.state);
}

function followViewportWidth(layout: SidebarLayoutStore): void {
  changeSidebarViewport(layout, window.innerWidth);
}

function listOptionalIds(sections: readonly SectionDefinition[]): string[] {
  const optionalIds: string[] = [];
  for (const section of sections) {
    if (section.optional) {
      optionalIds.push(section.id);
    }
  }
  return optionalIds;
}

/**
 * Builds the site decisions, the player sites, the stage, the app theme, the
 * sidebar layout, the section switches, the tile media setting and the catalog setting once,
 * outside React, so StrictMode's double effect run in dev does not launch mods twice.
 */
function startApp(
  sections: readonly SectionDefinition[],
  catalog: ResolvedAppCatalog,
): ReactElement {
  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
  // Before the stage, which reads and remembers the decisions through it.
  const siteDecisions = createSiteDecisions({ storage: window.localStorage });
  const playerSites = createPlayerSites({ storage: window.localStorage });
  // Before the stage, which records the files of combination sandboxes in it.
  const recentlyUsed = createRecentlyUsed({ storage: window.localStorage });
  const stage = createStage({
    history: window.history,
    defaults: DEFAULT_MODS,
    routing: buildStageRouting(sections),
    appOrigin: window.location.origin,
    baseUrl: document.baseURI,
    storage: window.localStorage,
    npmHost: NPM_HOST,
    colorScheme: readStartColorScheme(window.localStorage, systemQuery),
    loadsTileLinkedMedia: readStartTileLinkedMedia(window.localStorage),
    catalog,
    catalogDefaultMosaics: readStartCatalogDefaultMosaics(window.localStorage),
    theaterMode: readStartTheaterMode(window.localStorage),
    readSiteDecisions: readSiteDecisionsSnapshot.bind(undefined, siteDecisions),
    rememberSiteDecisions: rememberSiteDecisions.bind(undefined, siteDecisions),
    onFilesLoaded: recordRecentlyUsed.bind(undefined, recentlyUsed),
  });
  // The stage bar's lists measure what they show, cached for the page.
  const combinations = createCombinationCatalog({
    fetchOptions: {
      baseUrl: document.baseURI,
      npmHost: NPM_HOST,
      defaultModsFolder: stage.defaults.folder,
    },
    readCatalog: readStageCatalog.bind(undefined, stage),
  });
  // The lists' sort and filter choices, kept in memory until the page is reloaded.
  const listChoices = createListChoices();
  // Same lifetime as the stage: it tells the stage when the color scheme changes.
  const appTheme = createAppTheme({
    storage: window.localStorage,
    systemQuery,
    stage,
    root: document.documentElement,
  });
  const layout = createSidebarLayout({
    storage: window.localStorage,
    narrowQuery: window.matchMedia(NARROW_VIEWPORT_QUERY),
    viewportWidth: window.innerWidth,
  });
  window.addEventListener(
    "resize",
    followViewportWidth.bind(undefined, layout),
  );
  const switches = createSectionSwitches({
    storage: window.localStorage,
    optionalIds: listOptionalIds(sections),
  });
  // Same lifetime as the stage: it tells the stage when it is switched.
  const tileMedia = createTileMediaSetting({
    storage: window.localStorage,
    stage,
  });
  // Same lifetime as the stage: it tells the stage when it is switched.
  const catalogSetting = createCatalogSetting({
    storage: window.localStorage,
    stage,
  });
  // Same lifetime as the stage: it tells the stage when theater mode is turned on or off.
  const theater = createTheaterSetting({
    storage: window.localStorage,
    stage,
  });
  followCurrentEntry(stage);
  // Fragment navigations fire `popstate` too, so `hashchange` is not needed.
  window.addEventListener(
    "popstate",
    followCurrentEntry.bind(undefined, stage),
  );
  return (
    <App
      stage={stage}
      combinations={combinations}
      listChoices={listChoices}
      recentlyUsed={recentlyUsed}
      appTheme={appTheme}
      sections={sections}
      switches={switches}
      tileMedia={tileMedia}
      catalogSetting={catalogSetting}
      theater={theater}
      siteDecisions={siteDecisions}
      playerSites={playerSites}
      layout={layout}
    />
  );
}

/**
 * The app, or the errors of the registry and the catalog when either breaks
 * a rule: then no stage is created.
 */
function buildRootElement(): ReactElement {
  const defaults = resolveDefaultModSettings(DEFAULT_MODS, document.baseURI);
  const registryErrors = validateRegistry(VANILLA_SECTIONS);
  const catalogResolution = resolveAppCatalog(
    APP_CATALOG,
    document.baseURI,
    defaults,
  );
  if (registryErrors.length > 0 || catalogResolution.errors.length > 0) {
    return (
      <StartErrorScreen
        registryErrors={registryErrors}
        catalogErrors={catalogResolution.errors}
      />
    );
  }
  const sections = availableSections(
    VANILLA_SECTIONS,
    defaults,
    document.baseURI,
  );
  return startApp(sections, catalogResolution.catalog);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{buildRootElement()}</StrictMode>,
);
