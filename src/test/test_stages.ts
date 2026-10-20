import { createStage, followHistory } from "../lib/core/stage/index.ts";
import type { Stage } from "../lib/core/stage/index.ts";
import { FakeHistory } from "./fake_history.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import { APP_ORIGIN } from "./sample_mods.ts";
import { fetchTestFile } from "./test_files.ts";

/** A stage on a fake history, serving `public/` at `APP_BASE_URL`, with the sample mod as home mod. */
export function buildTestStage(history: FakeHistory): Stage {
  const stage = createStage({
    history,
    defaults: {
      folder: "./default_mods/",
      home: "./samples/mods/book_list",
      switchedOff: [],
    },
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    storage: createMemoryStorage(),
    fetch: fetchTestFile,
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
export async function startTestStage(hash: string): Promise<Stage> {
  const history = new FakeHistory(hash);
  const stage = buildTestStage(history);
  followHistory(stage, history.hash, history.state);
  await settleStage(stage);
  return stage;
}
