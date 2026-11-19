import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import {
  createStage,
  followHistory,
  readStageSnapshot,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxSnapshot,
  Stage,
  StageRouting,
} from "../../lib/core/stage/index.ts";
import { FakeHistory } from "../../test/fake_history.ts";
import { createMemorySiteDecisions } from "../../test/memory_site_decisions.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../test/sample_files.ts";
import {
  ALIASED_MOSAIC_SOURCE,
  APP_ORIGIN,
  NAMED_BOOKS_SOURCE,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_REFERENCE,
  SAMPLE_MOSAIC_SOURCE,
  serveAliasedMosaic,
  serveUntypedMod,
  TEST_NPM_HOST,
  UNTYPED_MOD_SOURCE,
} from "../../test/sample_mods.ts";
import { fetchTestFile, testTexts } from "../../test/test_files.ts";
import {
  buildTestCombinations,
  EXPLORER_LINK,
  settleStage,
} from "../../test/test_stages.ts";
import {
  createRecentlyUsed,
  readRecentlyUsedSnapshot,
  recordRecentlyUsed,
} from "../settings/recently_used.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import { createPlayerSites } from "../settings/player_sites.ts";
import { StageView } from "./StageView.tsx";
import { createTheaterSetting } from "./theater_setting.ts";

afterEach(function clearTexts(): void {
  testTexts.clear();
});

/** Tiles and Mods have explorers; no section explores the mosaics. */
const LIST_ROUTING: StageRouting = {
  pageSections: ["home", "settings"],
  home: { kind: "page", section: "home" },
  sectionLinks: [
    {
      section: "tiles",
      link: { mod: "collection_explorer", collection: null, params: {} },
    },
    { section: "mods", link: EXPLORER_LINK },
  ],
};

/** Two mods, two collections and a mosaic of each collection with the book list. */
const LIST_CATALOG = {
  mods: [SAMPLE_MOD_SOURCE, UNTYPED_MOD_SOURCE],
  collections: [SAMPLE_COLLECTION_SOURCE, NAMED_BOOKS_SOURCE],
  mosaics: [SAMPLE_MOSAIC_SOURCE, ALIASED_MOSAIC_SOURCE],
};

const OTHER_MOD_SOURCE =
  "https://example.org/fixtures/mods/other/mod_conf.yaml";

interface ListFixture {
  stage: Stage;
  recentlyUsed: RecentlyUsed;
}

/** A stage on the list catalog, recording recently used as `main.tsx` does, at `hash`. */
async function startListStage(hash: string): Promise<ListFixture> {
  serveUntypedMod();
  serveAliasedMosaic();
  const storage = createMemoryStorage();
  const recentlyUsed = createRecentlyUsed({ storage });
  const siteDecisions = createMemorySiteDecisions();
  const history = new FakeHistory(hash);
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff: [] },
    routing: LIST_ROUTING,
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    npmHost: TEST_NPM_HOST,
    storage,
    fetch: fetchTestFile,
    colorScheme: "light",
    loadsTileLinkedMedia: true,
    catalog: LIST_CATALOG,
    catalogDefaultMosaics: false,
    theaterMode: false,
    readSiteDecisions: siteDecisions.read,
    rememberSiteDecisions: siteDecisions.remember,
    onFilesLoaded: recordRecentlyUsed.bind(undefined, recentlyUsed),
  });
  followHistory(stage, history.hash, history.state);
  await settleStage(stage);
  const fixture = { stage, recentlyUsed };
  return fixture;
}

function renderLists(fixture: ListFixture): RenderResult {
  const storage = createMemoryStorage();
  return render(
    <TooltipProvider>
      <StageView
        stage={fixture.stage}
        combinations={buildTestCombinations(fixture.stage)}
        recentlyUsed={fixture.recentlyUsed}
        playerSites={createPlayerSites({ storage })}
        theater={createTheaterSetting({ storage, stage: fixture.stage })}
      />
    </TooltipProvider>,
  );
}

function readVisible(stage: Stage): SandboxSnapshot {
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    if (sandbox.isVisible) {
      return sandbox;
    }
  }
  throw new Error("Expected a visible sandbox");
}

/** Opens the list of the capsule whose name starts with `kind`. */
async function openList(kind: string): Promise<HTMLElement> {
  const capsule = screen.getByRole("button", {
    name: new RegExp(`^${kind}: `),
  });
  await act(async function clickCapsule(): Promise<void> {
    fireEvent.click(capsule);
    await settleLoads();
  });
  return screen.getByRole("dialog");
}

/** Lets the list's loads settle: each fetch and parse takes a few turns. */
async function settleLoads(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await new Promise<void>(waitForTimers);
  }
}

function waitForTimers(resolve: () => void): void {
  setTimeout(resolve, 0);
}

function findOption(list: HTMLElement, value: string): HTMLElement {
  const option = list.querySelector<HTMLElement>(
    `[cmdk-item][data-value="${value}"]`,
  );
  if (option === null) {
    throw new Error(`Expected an entry "${value}" in the list`);
  }
  return option;
}

function listOptionValues(list: HTMLElement): string[] {
  const values: string[] = [];
  for (const option of within(list).getAllByRole("option")) {
    values.push(option.getAttribute("data-value") ?? "");
  }
  return values;
}

async function choose(option: HTMLElement): Promise<void> {
  await act(async function clickOption(): Promise<void> {
    fireEvent.click(option);
    await settleLoads();
  });
}

const BOOKS_RUN_HASH = `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`;
const MOSAIC_HASH = `#/run?mosaic=${SAMPLE_MOSAIC_REFERENCE}`;

describe("mod list", function describeModList(): void {
  it("Vanilla mod list: the catalog's mods in order, the current one marked, with counts", async function listsMods(): Promise<void> {
    renderLists(await startListStage(BOOKS_RUN_HASH));

    const list = await openList("Mod");

    expect(listOptionValues(list)).toEqual([
      SAMPLE_MOD_SOURCE,
      UNTYPED_MOD_SOURCE,
    ]);
    const bookList = findOption(list, SAMPLE_MOD_SOURCE);
    expect(bookList).toHaveTextContent("Book List");
    expect(bookList).toHaveTextContent("Current");
    expect(bookList).toHaveTextContent("3/3");
    expect(bookList).toHaveTextContent("1 mosaic");
    expect(findOption(list, UNTYPED_MOD_SOURCE)).toHaveTextContent("any");
  });

  it("Mod outside the catalog: listed as current and Recent", async function listsOutsideMod(): Promise<void> {
    testTexts.set(
      OTHER_MOD_SOURCE,
      'mod:\n  title: "Other"\n  version: "2.0.0"\n  api: "^0.1.0"\n  entrypoint: "./main.js"\n',
    );
    testTexts.set("https://example.org/fixtures/mods/other/main.js", "");
    const fixture = await startListStage(
      `#/run?mod=${encodeURIComponent(OTHER_MOD_SOURCE)}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderLists(fixture);

    const list = await openList("Mod");

    const other = findOption(list, OTHER_MOD_SOURCE);
    expect(other).toHaveTextContent("Current");
    expect(other).toHaveTextContent("Recent");
    expect(readRecentlyUsedSnapshot(fixture.recentlyUsed).mods).toContain(
      OTHER_MOD_SOURCE,
    );
  });

  it("choosing a mod of a mosaic opens it with the collection and the mosaic as sites", async function choosesMod(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    renderLists(fixture);
    const list = await openList("Mod");

    await choose(findOption(list, UNTYPED_MOD_SOURCE));

    expect(readVisible(fixture.stage).link).toMatchObject({
      mod: UNTYPED_MOD_SOURCE,
      collection: SAMPLE_COLLECTION_SOURCE,
      mosaic: null,
      sites: SAMPLE_MOSAIC_SOURCE,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("choosing the current mod closes the list and opens nothing", async function choosesCurrent(): Promise<void> {
    const fixture = await startListStage(BOOKS_RUN_HASH);
    renderLists(fixture);
    const before = readVisible(fixture.stage).id;
    const list = await openList("Mod");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    expect(readVisible(fixture.stage).id).toBe(before);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Details footer: the current mod's source", async function showsModDetails(): Promise<void> {
    renderLists(await startListStage(BOOKS_RUN_HASH));

    const list = await openList("Mod");

    const details = list.querySelector("dl[aria-label=Details]");
    expect(details).toHaveTextContent(SAMPLE_MOD_SOURCE);
    expect(details).toHaveTextContent("1.0.0");
  });
});

describe("collection list", function describeCollectionList(): void {
  it("Collection list of a mosaic: None first, then the collections, the current one marked", async function listsCollections(): Promise<void> {
    renderLists(await startListStage(MOSAIC_HASH));

    const list = await openList("Collection");

    expect(listOptionValues(list)).toEqual([
      "none",
      SAMPLE_COLLECTION_SOURCE,
      NAMED_BOOKS_SOURCE,
    ]);
    expect(findOption(list, SAMPLE_COLLECTION_SOURCE)).toHaveTextContent(
      "Current",
    );
    expect(findOption(list, "none")).not.toHaveTextContent("Current");
  });

  it("Tile link: the tile first, current and not selectable, then None", async function listsTile(): Promise<void> {
    renderLists(
      await startListStage(
        `#/run?mod=${SAMPLE_MOD_REFERENCE}&tile=./fixtures/tiles/books/kallocain.md`,
      ),
    );

    const list = await openList("Collection");

    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveTextContent("kallocain.md");
    expect(options[0]).toHaveTextContent("Current");
    expect(options[0]).toHaveAttribute("aria-disabled", "true");
    expect(options[1]).toHaveAttribute("data-value", "none");
  });

  it("Laureates have a mosaic with the country map: each collection marks its mosaics with the mod", async function marksMosaics(): Promise<void> {
    renderLists(await startListStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`));

    const list = await openList("Collection");

    expect(findOption(list, "none")).toHaveTextContent("Current");
    expect(findOption(list, SAMPLE_COLLECTION_SOURCE)).toHaveTextContent(
      "1 mosaic",
    );
    expect(findOption(list, NAMED_BOOKS_SOURCE)).toHaveTextContent("1 mosaic");
  });

  it("Books first: sorted by the counts known when the list opens again", async function sortsCollections(): Promise<void> {
    renderLists(
      await startListStage(
        `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${encodeURIComponent(NAMED_BOOKS_SOURCE)}`,
      ),
    );
    const firstOpening = await openList("Collection");
    expect(findOption(firstOpening, NAMED_BOOKS_SOURCE)).toHaveTextContent(
      "no match0/1",
    );
    fireEvent.keyDown(within(firstOpening).getByRole("combobox"), {
      key: "Escape",
    });

    const list = await openList("Collection");

    expect(listOptionValues(list)).toEqual([
      "none",
      SAMPLE_COLLECTION_SOURCE,
      NAMED_BOOKS_SOURCE,
    ]);
    expect(
      within(list).getByRole("group", { name: "Not compatible" }),
    ).toHaveTextContent("Named books");
  });

  it("Removed recent collection: listed last with 404, and Remove drops it", async function removesRecent(): Promise<void> {
    const goneSource = "https://example.org/fixtures/tiles/gone.yaml";
    const fixture = await startListStage(BOOKS_RUN_HASH);
    recordRecentlyUsed(fixture.recentlyUsed, {
      kind: "collection",
      source: goneSource,
    });
    renderLists(fixture);
    const list = await openList("Collection");
    const failed = within(list).getByRole("list", { name: "Cannot be loaded" });
    expect(failed).toHaveTextContent("404");

    await act(async function clickRemove(): Promise<void> {
      fireEvent.click(within(failed).getByRole("button", { name: "Remove" }));
      await settleLoads();
    });

    expect(
      readRecentlyUsedSnapshot(fixture.recentlyUsed).collections,
    ).not.toContain(goneSource);
    expect(list).not.toHaveTextContent(goneSource);
  });

  it("None: the same mod without a collection", async function choosesNone(): Promise<void> {
    const fixture = await startListStage(BOOKS_RUN_HASH);
    renderLists(fixture);
    const list = await openList("Collection");

    await choose(findOption(list, "none"));

    expect(readVisible(fixture.stage).link).toMatchObject({
      mod: SAMPLE_MOD_SOURCE,
      collection: null,
      tile: null,
    });
  });

  it("Open the collection explorer: shows the Tiles section", async function opensExplorer(): Promise<void> {
    const fixture = await startListStage(BOOKS_RUN_HASH);
    renderLists(fixture);
    const list = await openList("Collection");

    await act(async function clickExplorer(): Promise<void> {
      fireEvent.click(
        within(list).getByRole("button", {
          name: "Open the collection explorer",
        }),
      );
      await settleLoads();
    });

    expect(readStageSnapshot(fixture.stage).activeSection).toBe("tiles");
  });
});

describe("mosaic list", function describeMosaicList(): void {
  it("Map mosaic first: the mosaics of the pair, then the other combinations", async function groupsMosaics(): Promise<void> {
    renderLists(await startListStage(MOSAIC_HASH));

    const list = await openList("Mosaic");

    const pair = within(list).getByRole("group", {
      name: "For Book List + Science fiction books",
    });
    const current = findOption(pair, SAMPLE_MOSAIC_SOURCE);
    expect(current).toHaveTextContent("Books on the shelf");
    expect(current).toHaveTextContent("Current");
    expect(current).toHaveTextContent("No aliases");
    const others = within(list).getByRole("group", {
      name: "Other combinations",
    });
    expect(findOption(others, ALIASED_MOSAIC_SOURCE)).toHaveTextContent(
      "Book List + Named books",
    );
  });

  it("Alias summary: a mosaic of the current pair shows its aliases", async function showsAliases(): Promise<void> {
    renderLists(
      await startListStage(
        `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${encodeURIComponent(NAMED_BOOKS_SOURCE)}`,
      ),
    );

    const list = await openList("Mosaic");

    const aliased = findOption(list, ALIASED_MOSAIC_SOURCE);
    expect(aliased).toHaveTextContent("title <- name");
    expect(aliased).toHaveTextContent("country <- origin");
  });

  it("No mosaic for the pair", async function saysNoMosaic(): Promise<void> {
    renderLists(
      await startListStage(
        `#/run?mod=${encodeURIComponent(UNTYPED_MOD_SOURCE)}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
      ),
    );

    const list = await openList("Mosaic");

    expect(
      within(list).getByText("No mosaic for this combination yet."),
    ).toBeInTheDocument();
  });

  it("Mosaic details: the mosaic file's address and the run link, and no switched-off explorer", async function showsMosaicDetails(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    renderLists(fixture);

    const list = await openList("Mosaic");

    expect(list).toHaveTextContent(SAMPLE_MOSAIC_SOURCE);
    expect(list).toHaveTextContent(readVisible(fixture.stage).hash);
    expect(
      within(list).queryByRole("button", { name: "Open the mosaic explorer" }),
    ).toBeNull();
  });

  it("Other combination: opens that mosaic", async function choosesMosaic(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    renderLists(fixture);
    const list = await openList("Mosaic");

    await choose(findOption(list, ALIASED_MOSAIC_SOURCE));

    expect(readVisible(fixture.stage).link).toMatchObject({
      mosaic: ALIASED_MOSAIC_SOURCE,
      mod: SAMPLE_MOD_SOURCE,
      collection: NAMED_BOOKS_SOURCE,
      params: {},
    });
    expect(
      screen.getByRole("button", { name: "Mosaic: Named books on the shelf" }),
    ).toBeInTheDocument();
  });
});
