import { followHistory } from "../lib/core/stage/index.ts";
import type { Stage, StageRouting } from "../lib/core/stage/index.ts";
import { buildStageRouting } from "../main/sections/section_registry.ts";
import type { SectionDefinition } from "../main/sections/section_registry.ts";
import { createSectionSwitches } from "../main/sections/section_switches.ts";
import type { SectionSwitches } from "../main/sections/section_switches.ts";
import { VANILLA_SECTIONS } from "../main/sections/vanilla_sections.ts";
import { createPlayerSites } from "../main/settings/player_sites.ts";
import {
  createRecentlyUsed,
  recordRecentlyUsed,
} from "../main/settings/recently_used.ts";
import type { RecentlyUsed } from "../main/settings/recently_used.ts";
import type { PlayerSites } from "../main/settings/player_sites.ts";
import {
  createSiteDecisions,
  readSiteDecisionsSnapshot,
  rememberSiteDecisions,
} from "../main/settings/site_decisions.ts";
import type { SiteDecisions } from "../main/settings/site_decisions.ts";
import { createCatalogSetting } from "../main/settings/catalog_setting.ts";
import type { CatalogSetting } from "../main/settings/catalog_setting.ts";
import { createTileMediaSetting } from "../main/settings/tile_media_setting.ts";
import type { TileMediaSetting } from "../main/settings/tile_media_setting.ts";
import { createTheaterSetting } from "../main/stage/theater_setting.ts";
import type { TheaterSetting } from "../main/stage/theater_setting.ts";
import { createSidebarLayout } from "../main/sidebar/sidebar_layout.ts";
import type { SidebarLayoutStore } from "../main/sidebar/sidebar_layout.ts";
import { createAppTheme } from "../main/theme/app_theme.ts";
import type { AppTheme } from "../main/theme/app_theme.ts";
import { createFakeColorSchemeQuery } from "./fake_color_scheme_queries.ts";
import type { FakeColorSchemeQuery } from "./fake_color_scheme_queries.ts";
import { FakeHistory } from "./fake_history.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import type { MemoryStorage } from "./memory_storage.ts";
import {
  buildTestCombinations,
  buildTestStage,
  settleStage,
} from "./test_stages.ts";
import type { CombinationCatalog } from "../lib/core/combinations/index.ts";
import { createListChoices } from "../main/stage/list_choices.ts";
import type { UserCatalogStore } from "../main/user_catalog/user_catalog_store.ts";
import { createTestUserCatalog } from "./test_user_catalog.ts";
import type { TestUserCatalogOptions } from "./test_user_catalog.ts";
import type { ListChoices } from "../main/stage/list_choices.ts";

/** Everything `App` gets, built as `main.tsx` builds it, on fakes. The site decisions and player sites use `storage`. */
export interface AppFixture {
  history: FakeHistory;
  stage: Stage;
  combinations: CombinationCatalog;
  listChoices: ListChoices;
  recentlyUsed: RecentlyUsed;
  userCatalog: UserCatalogStore;
  appTheme: AppTheme;
  sections: readonly SectionDefinition[];
  switches: SectionSwitches;
  tileMedia: TileMediaSetting;
  catalogSetting: CatalogSetting;
  theater: TheaterSetting;
  siteDecisions: SiteDecisions;
  playerSites: PlayerSites;
  layout: SidebarLayoutStore;
  storage: MemoryStorage;
  narrowQuery: FakeColorSchemeQuery;
  /** Never matches: the fixture's viewport is narrow or wide, never compact. */
  compactQuery: FakeColorSchemeQuery;
}

export interface AppFixtureOptions {
  sections?: readonly SectionDefinition[];
  /** Defaults to the routing of `sections`. */
  routing?: StageRouting;
  storage?: MemoryStorage;
  isNarrow?: boolean;
  /** The user catalog's database, entries and persistence. A memory database by default. */
  userCatalog?: TestUserCatalogOptions;
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

/** The vanilla app at `hash`, on a 1280px viewport unless `isNarrow`, after its first launch settled. */
export async function startTestApp(
  hash: string = "",
  options: AppFixtureOptions = {},
): Promise<AppFixture> {
  const sections = options.sections ?? VANILLA_SECTIONS;
  const storage = options.storage ?? createMemoryStorage();
  const isNarrow = options.isNarrow ?? false;
  const history = new FakeHistory(hash);
  const siteDecisions = createSiteDecisions({ storage });
  const recentlyUsed = createRecentlyUsed({ storage });
  const stage = buildTestStage(
    history,
    options.routing ?? buildStageRouting(sections),
    {
      read: readSiteDecisionsSnapshot.bind(undefined, siteDecisions),
      remember: rememberSiteDecisions.bind(undefined, siteDecisions),
    },
    recordRecentlyUsed.bind(undefined, recentlyUsed),
  );
  const narrowQuery = createFakeColorSchemeQuery(isNarrow);
  const compactQuery = createFakeColorSchemeQuery(false);
  const fixture: AppFixture = {
    history,
    stage,
    combinations: buildTestCombinations(stage),
    listChoices: createListChoices(),
    recentlyUsed,
    userCatalog: createTestUserCatalog(
      stage,
      recentlyUsed,
      options.userCatalog,
    ),
    appTheme: createAppTheme({
      storage,
      systemQuery: createFakeColorSchemeQuery(false),
      stage,
      root: document.createElement("div"),
    }),
    sections,
    switches: createSectionSwitches({
      storage,
      optionalIds: listOptionalIds(sections),
    }),
    tileMedia: createTileMediaSetting({ storage, stage }),
    catalogSetting: createCatalogSetting({ storage, stage }),
    theater: createTheaterSetting({ storage, stage }),
    siteDecisions,
    playerSites: createPlayerSites({ storage }),
    layout: createSidebarLayout({
      storage,
      narrowQuery,
      compactQuery,
      viewportWidth: isNarrow ? 375 : 1280,
    }),
    storage,
    narrowQuery,
    compactQuery,
  };
  followHistory(stage, history.hash, history.state);
  await settleStage(stage);
  return fixture;
}
