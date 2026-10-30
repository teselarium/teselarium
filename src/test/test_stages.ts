import type { RunLink } from "../lib/core/engine/index.ts";
import { createStage, followHistory } from "../lib/core/stage/index.ts";
import type { Stage, StageRouting } from "../lib/core/stage/index.ts";
import { FakeHistory } from "./fake_history.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import { APP_ORIGIN, SAMPLE_MOD_REFERENCE } from "./sample_mods.ts";
import { fetchTestFile } from "./test_files.ts";

export const EXPLORER_LINK: RunLink = Object.freeze({
  mod: "mod_explorer",
  collection: null,
  params: Object.freeze({}),
});

export const SAMPLE_LINK: RunLink = Object.freeze({
  mod: SAMPLE_MOD_REFERENCE,
  collection: null,
  params: Object.freeze({}),
});

/** The vanilla sections as the stage sees them: Home is a page, Mods is the mod explorer. */
export const PAGE_HOME_ROUTING: StageRouting = Object.freeze({
  pageSections: Object.freeze(["home", "guides", "settings", "about"]),
  home: Object.freeze({ kind: "page", section: "home" }),
  sectionLinks: Object.freeze([
    Object.freeze({ section: "mods", link: EXPLORER_LINK }),
  ]),
});

/** An instantiation whose Home is the sample mod, so `#/` runs a mod. */
export const MOD_HOME_ROUTING: StageRouting = Object.freeze({
  pageSections: Object.freeze(["guides", "settings", "about"]),
  home: Object.freeze({ kind: "mod", section: "home", link: SAMPLE_LINK }),
  sectionLinks: Object.freeze([
    Object.freeze({ section: "home", link: SAMPLE_LINK }),
    Object.freeze({ section: "mods", link: EXPLORER_LINK }),
  ]),
});

/**
 * A stage on a fake history, serving `public/` at `APP_BASE_URL`. Home is the
 * sample mod unless `routing` says otherwise.
 */
export function buildTestStage(
  history: FakeHistory,
  routing: StageRouting = MOD_HOME_ROUTING,
): Stage {
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff: [] },
    routing,
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    storage: createMemoryStorage(),
    fetch: fetchTestFile,
    colorScheme: "light",
    loadsTileLinkedMedia: true,
  });
  return stage;
}

/** Waits until every sandbox launch of the stage settled. */
export async function settleStage(stage: Stage): Promise<void> {
  const launches: Promise<void>[] = [];
  for (const runtime of stage.runtimes.values()) {
    launches.push(runtime.settled);
  }
  await Promise.all(launches);
}

/** Starts a test stage at `hash` and waits for its first launch. */
export async function startTestStage(
  hash: string,
  routing: StageRouting = MOD_HOME_ROUTING,
): Promise<Stage> {
  const history = new FakeHistory(hash);
  const stage = buildTestStage(history, routing);
  followHistory(stage, history.hash, history.state);
  await settleStage(stage);
  return stage;
}
