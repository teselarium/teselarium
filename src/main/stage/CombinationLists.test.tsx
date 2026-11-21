import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import {
  buildMosaicCountKey,
  createCombinationCatalog,
  readCombinationSnapshot,
} from "../../lib/core/combinations/index.ts";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import { readStageCatalog } from "../../lib/core/stage/index.ts";
import { FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import { createListChoices } from "./list_choices.ts";
import { SETTLE_INTERVAL_MS } from "./list_settling.ts";
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

/** A stage on the list catalog, recording recently used as `main.tsx` does, at `hash`, with the default mods `switchedOff`. */
async function startListStage(
  hash: string,
  switchedOff: string[] = [],
): Promise<ListFixture> {
  serveUntypedMod();
  serveAliasedMosaic();
  const storage = createMemoryStorage();
  const recentlyUsed = createRecentlyUsed({ storage });
  const siteDecisions = createMemorySiteDecisions();
  const history = new FakeHistory(hash);
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff },
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

function renderLists(
  fixture: ListFixture,
  combinations: CombinationCatalog = buildTestCombinations(fixture.stage),
): RenderResult {
  const storage = createMemoryStorage();
  return render(
    <TooltipProvider>
      <StageView
        stage={fixture.stage}
        combinations={combinations}
        listChoices={createListChoices()}
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
  const list = screen.getByRole("dialog");
  await waitFor(expectNoCounting.bind(undefined, list));
  return list;
}

/** Every score of the fixtures is measured in the end: the list's loads settled. */
function expectNoCounting(list: HTMLElement): void {
  expect(within(list).queryAllByRole("img", { name: "Counting" })).toEqual([]);
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

function waitForSettleInterval(resolve: () => void): void {
  setTimeout(resolve, SETTLE_INTERVAL_MS);
}

/** Lets a settling list sort again with what arrived since it opened. */
async function waitForSettling(): Promise<void> {
  await act(async function waitForSort(): Promise<void> {
    await new Promise<void>(waitForSettleInterval);
    await settleLoads();
  });
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

/** The option's mark, its badge or its score, by their accessible names. */
function hasNamed(option: HTMLElement, name: string): boolean {
  return within(option).queryByRole("img", { name }) !== null;
}

function readScore(option: HTMLElement): string {
  return option.querySelector("[data-column=score]")?.textContent ?? "";
}

async function typeSearch(list: HTMLElement, text: string): Promise<void> {
  await act(async function typeText(): Promise<void> {
    fireEvent.change(within(list).getByRole("combobox"), {
      target: { value: text },
    });
    await settleLoads();
  });
}

function readSearch(list: HTMLElement): string {
  return (within(list).getByRole("combobox") as HTMLInputElement).value;
}

async function choose(option: HTMLElement): Promise<void> {
  await act(async function clickOption(): Promise<void> {
    fireEvent.click(option);
    await settleLoads();
  });
}

/** Opens the list of the capsule whose name starts with `kind`, then its details page. */
async function openDetails(kind: string): Promise<HTMLElement> {
  const list = await openList(kind);
  await act(async function clickDetails(): Promise<void> {
    fireEvent.click(within(list).getByRole("button", { name: "Details" }));
    await settleLoads();
  });
  return list;
}

/** The details the list shows, as `term: value` lines. */
function readDetails(list: HTMLElement): string[] {
  const details = list.querySelector("dl[aria-label=Details]");
  if (details === null) {
    throw new Error("Expected the list to show its details");
  }
  const lines: string[] = [];
  for (const term of details.querySelectorAll("dt")) {
    const value = term.nextElementSibling?.querySelector("code");
    lines.push(`${term.textContent}: ${value?.textContent ?? ""}`);
  }
  return lines;
}

/** The Open links of the list's details, as `name: href` lines. */
function readOpenLinks(list: HTMLElement): string[] {
  const details = list.querySelector<HTMLElement>("dl[aria-label=Details]");
  if (details === null) {
    throw new Error("Expected the list to show its details");
  }
  const lines: string[] = [];
  for (const link of within(details).queryAllByRole("link")) {
    lines.push(
      `${link.getAttribute("aria-label")}: ${link.getAttribute("href")}`,
    );
  }
  return lines;
}

/** The app's full address with `hash`, as the test page is served. */
function buildAppAddress(hash: string): string {
  const { origin, pathname, search } = window.location;
  const address = `${origin}${pathname}${search}${hash}`;
  return address;
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
    expect(hasNamed(bookList, "Current")).toBe(true);
    expect(bookList).toHaveAttribute("aria-current", "true");
    expect(readScore(bookList)).toBe("3/3");
    expect(hasNamed(bookList, "1 mosaic")).toBe(true);
    const untyped = findOption(list, UNTYPED_MOD_SOURCE);
    expect(readScore(untyped)).toBe("3/3");
    expect(hasNamed(untyped, "Current")).toBe(false);
    expect(untyped).not.toHaveAttribute("aria-current");
  });

  it("Mod outside the catalog: listed with the dot, which wins over the ring", async function listsOutsideMod(): Promise<void> {
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
    expect(hasNamed(other, "Current")).toBe(true);
    expect(hasNamed(other, "Tried recently, not saved in the app")).toBe(false);
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

  it("choosing Without a mosaic of the current mod closes the list and opens nothing", async function choosesCurrent(): Promise<void> {
    const fixture = await startListStage(BOOKS_RUN_HASH);
    renderLists(fixture);
    const before = readVisible(fixture.stage).id;
    const list = await openList("Mod");
    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    await choose(findOption(list, `${SAMPLE_MOD_SOURCE}#without-mosaic`));

    expect(readVisible(fixture.stage).id).toBe(before);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Mod details: the resolved mod file's address and the version", async function showsModDetails(): Promise<void> {
    renderLists(await startListStage(BOOKS_RUN_HASH));

    const list = await openDetails("Mod");

    expect(readDetails(list)).toEqual([
      `Mod: ${SAMPLE_MOD_SOURCE}`,
      "Version: 1.0.0",
    ]);
    expect(readOpenLinks(list)).toEqual([
      `Open mod in the mod viewer: ${buildAppAddress(`#/run?mod=mod_viewer&target=${encodeURIComponent(SAMPLE_MOD_SOURCE)}`)}`,
    ]);
  });
});

describe("collection list", function describeCollectionList(): void {
  it("Collection list of a mosaic: None first, then the collections, the current one marked", async function listsCollections(): Promise<void> {
    renderLists(await startListStage(MOSAIC_HASH));

    const list = await openList("Collection");

    expect(listOptionValues(list)).toEqual([
      "none",
      NAMED_BOOKS_SOURCE,
      SAMPLE_COLLECTION_SOURCE,
    ]);
    expect(
      hasNamed(findOption(list, SAMPLE_COLLECTION_SOURCE), "Current"),
    ).toBe(true);
    expect(hasNamed(findOption(list, "none"), "Current")).toBe(false);
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
    expect(hasNamed(options[0], "Current")).toBe(true);
    expect(options[0]).toHaveAttribute("aria-disabled", "true");
    expect(options[1]).toHaveAttribute("data-value", "none");
  });

  it("Laureates have a mosaic with the country map: each collection marks its mosaics with the mod", async function marksMosaics(): Promise<void> {
    renderLists(await startListStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`));

    const list = await openList("Collection");

    expect(hasNamed(findOption(list, "none"), "Current")).toBe(true);
    expect(
      hasNamed(findOption(list, SAMPLE_COLLECTION_SOURCE), "1 mosaic"),
    ).toBe(true);
    expect(hasNamed(findOption(list, NAMED_BOOKS_SOURCE), "1 mosaic")).toBe(
      true,
    );
  });

  it("None hidden: searching hides the pinned None row", async function hidesNone(): Promise<void> {
    renderLists(await startListStage(BOOKS_RUN_HASH));
    const list = await openList("Collection");

    await typeSearch(list, "named");

    expect(listOptionValues(list)).toEqual([NAMED_BOOKS_SOURCE]);
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

  it("No collection: the details say None", async function showsNoCollection(): Promise<void> {
    renderLists(await startListStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`));

    const list = await openDetails("Collection");

    expect(readDetails(list)).toEqual(["Collection: None"]);
  });

  it("Tile details: the tile's resolved address", async function showsTileDetails(): Promise<void> {
    renderLists(
      await startListStage(
        `#/run?mod=${SAMPLE_MOD_REFERENCE}&tile=./fixtures/tiles/books/kallocain.md`,
      ),
    );

    const list = await openDetails("Collection");

    const tile = `${FIXTURES_BASE_URL}tiles/books/kallocain.md`;
    expect(readDetails(list)).toEqual([`Tile: ${tile}`]);
    expect(readOpenLinks(list)).toEqual([
      `Open tile in the tile viewer: ${buildAppAddress(`#/run?mod=tile_viewer&tile=${encodeURIComponent(tile)}`)}`,
    ]);
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
});

describe("mosaic list", function describeMosaicList(): void {
  it("Map mosaic first: the mosaics of the pair, then the other combinations", async function groupsMosaics(): Promise<void> {
    renderLists(await startListStage(MOSAIC_HASH));

    const list = await openList("Mosaic");
    await waitForSettling();

    const pair = within(list).getByRole("group", {
      name: "For Book List + Science fiction books",
    });
    const current = findOption(pair, SAMPLE_MOSAIC_SOURCE);
    expect(current).toHaveTextContent("Books on the shelf");
    expect(hasNamed(current, "Current")).toBe(true);
    expect(hasNamed(current, "Mosaic")).toBe(true);
    expect(current).toHaveTextContent("No aliases");
    expect(readScore(current)).toBe("3/3");
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

    const pair = within(list).getByRole("group", {
      name: "For untyped + Science fiction books",
    });
    const options = within(pair).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Unsaved combination");
    expect(options[0]).toHaveTextContent("untyped + Science fiction books");
    expect(hasNamed(options[0], "Current")).toBe(true);
    expect(hasNamed(options[0], "Mosaic")).toBe(false);
    expect(readScore(options[0])).toBe("3/3");
  });

  it("Mosaic details: the mosaic file's address and the run link as the app's full address", async function showsMosaicDetails(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    renderLists(fixture);

    const list = await openDetails("Mosaic");

    const { origin, pathname, search } = window.location;
    expect(readDetails(list)).toEqual([
      `Mosaic: ${SAMPLE_MOSAIC_SOURCE}`,
      `Run link: ${origin}${pathname}${search}${readVisible(fixture.stage).hash}`,
    ]);
  });

  it("Open links: the mosaic in the mosaic viewer, and the run link itself", async function opensInViewers(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    renderLists(fixture);

    const list = await openDetails("Mosaic");

    const viewerHash = `#/run?mod=mosaic_viewer&target=${encodeURIComponent(SAMPLE_MOSAIC_SOURCE)}`;
    expect(readOpenLinks(list)).toEqual([
      `Open mosaic in the mosaic viewer: ${buildAppAddress(viewerHash)}`,
      `Open run link in a new tab: ${buildAppAddress(readVisible(fixture.stage).hash)}`,
    ]);
  });

  it("Viewer switched off: the mosaic has no Open link, and the run link keeps its own", async function leavesOutSwitchedOffViewer(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH, ["mosaic_viewer"]);
    renderLists(fixture);

    const list = await openDetails("Mosaic");

    expect(
      within(list).getByRole("button", { name: "Copy mosaic" }),
    ).toBeInTheDocument();
    expect(readOpenLinks(list)).toEqual([
      `Open run link in a new tab: ${buildAppAddress(readVisible(fixture.stage).hash)}`,
    ]);
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

/** Untyped on the named books: Book List's mosaic of them renames their fields. */
const UNTYPED_NAMED_HASH = `#/run?mod=${encodeURIComponent(UNTYPED_MOD_SOURCE)}&collection=${encodeURIComponent(NAMED_BOOKS_SOURCE)}`;

describe("pages", function describePages(): void {
  it("Open Book List's page: Back named after it, then its mosaic, then Without a mosaic, and nothing opened", async function opensPage(): Promise<void> {
    const fixture = await startListStage(UNTYPED_NAMED_HASH);
    renderLists(fixture);
    const before = readVisible(fixture.stage).id;
    const list = await openList("Mod");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveAccessibleName("Back to Book List");
    expect(options[1]).toHaveTextContent("Named books on the shelf");
    expect(options[2]).toHaveTextContent("Without a mosaic");
    expect(options).toHaveLength(3);
    expect(readVisible(fixture.stage).id).toBe(before);
  });

  it("Scores of the options: the mosaic with its aliases, Without a mosaic without them, and the entry shows the best", async function scoresOptions(): Promise<void> {
    renderLists(await startListStage(UNTYPED_NAMED_HASH));
    const list = await openList("Mod");
    expect(readScore(findOption(list, SAMPLE_MOD_SOURCE))).toBe("1/1");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    expect(readScore(findOption(list, ALIASED_MOSAIC_SOURCE))).toBe("1/1");
    const without = findOption(list, `${SAMPLE_MOD_SOURCE}#without-mosaic`);
    expect(readScore(without)).toBe("0/1");
    expect(without.querySelector("[data-column=score]")).toHaveAttribute(
      "data-muted",
      "true",
    );
  });

  it("Without a mosaic: opens the mod with the collection, with no mosaic", async function choosesWithout(): Promise<void> {
    const fixture = await startListStage(UNTYPED_NAMED_HASH);
    renderLists(fixture);
    const list = await openList("Mod");
    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    await choose(findOption(list, `${SAMPLE_MOD_SOURCE}#without-mosaic`));

    expect(readVisible(fixture.stage).link).toMatchObject({
      mod: SAMPLE_MOD_SOURCE,
      collection: NAMED_BOOKS_SOURCE,
      mosaic: null,
    });
  });

  it("From a page: choosing the mosaic opens it", async function choosesPageMosaic(): Promise<void> {
    const fixture = await startListStage(UNTYPED_NAMED_HASH);
    renderLists(fixture);
    const list = await openList("Mod");
    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    await choose(findOption(list, ALIASED_MOSAIC_SOURCE));

    expect(readVisible(fixture.stage).link).toMatchObject({
      mosaic: ALIASED_MOSAIC_SOURCE,
    });
  });

  it("Current mosaic's page: the mosaic marked current, and no Without a mosaic", async function leavesOutWithout(): Promise<void> {
    renderLists(await startListStage(MOSAIC_HASH));
    const list = await openList("Mod");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    expect(listOptionValues(list)).toEqual(["back", SAMPLE_MOSAIC_SOURCE]);
    expect(hasNamed(findOption(list, SAMPLE_MOSAIC_SOURCE), "Current")).toBe(
      true,
    );
  });

  it("Back from a page: Back and Backspace in an empty search return, with the entry highlighted", async function goesBack(): Promise<void> {
    renderLists(await startListStage(UNTYPED_NAMED_HASH));
    const list = await openList("Mod");
    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    await choose(findOption(list, "back"));
    expect(listOptionValues(list)).toEqual([
      SAMPLE_MOD_SOURCE,
      UNTYPED_MOD_SOURCE,
    ]);
    expect(findOption(list, SAMPLE_MOD_SOURCE)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await choose(findOption(list, SAMPLE_MOD_SOURCE));
    await act(async function pressBackspace(): Promise<void> {
      fireEvent.keyDown(within(list).getByRole("combobox"), {
        key: "Backspace",
      });
      await settleLoads();
    });
    expect(listOptionValues(list)).toEqual([
      SAMPLE_MOD_SOURCE,
      UNTYPED_MOD_SOURCE,
    ]);
  });
});

describe("search through mosaics", function describeSearchThroughMosaics(): void {
  it("Found by its mosaic: the mosaic named under the title, and the badge counts the matches", async function findsThroughMosaic(): Promise<void> {
    renderLists(await startListStage(UNTYPED_NAMED_HASH));
    const list = await openList("Mod");

    await typeSearch(list, "on the shelf");

    expect(listOptionValues(list)).toEqual([SAMPLE_MOD_SOURCE]);
    const bookList = findOption(list, SAMPLE_MOD_SOURCE);
    expect(bookList).toHaveTextContent("Named books on the shelf");
    expect(hasNamed(bookList, "1 of 1 mosaics match")).toBe(true);
  });

  it("Page with the search: the search carried over, only the matching mosaic, and Back restores the main search", async function carriesSearch(): Promise<void> {
    renderLists(await startListStage(UNTYPED_NAMED_HASH));
    const list = await openList("Mod");
    await typeSearch(list, "on the shelf");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    expect(readSearch(list)).toBe("on the shelf");
    expect(listOptionValues(list)).toEqual(["back", ALIASED_MOSAIC_SOURCE]);

    await choose(findOption(list, "back"));
    expect(readSearch(list)).toBe("on the shelf");
  });

  it("Found by its own title: the page opens with an empty search and lists every option", async function opensWithoutSearch(): Promise<void> {
    renderLists(await startListStage(UNTYPED_NAMED_HASH));
    const list = await openList("Mod");
    await typeSearch(list, "book");

    await choose(findOption(list, SAMPLE_MOD_SOURCE));

    expect(readSearch(list)).toBe("");
    expect(listOptionValues(list)).toEqual([
      "back",
      ALIASED_MOSAIC_SOURCE,
      `${SAMPLE_MOD_SOURCE}#without-mosaic`,
    ]);
  });
});

describe("tried combinations", function describeTriedCombinations(): void {
  it("Tried pair: an Unsaved combination with the ring, and choosing it opens its pair with no sites", async function listsTriedPair(): Promise<void> {
    const fixture = await startListStage(MOSAIC_HASH);
    recordRecentlyUsed(fixture.recentlyUsed, {
      kind: "combination",
      mod: UNTYPED_MOD_SOURCE,
      collection: NAMED_BOOKS_SOURCE,
    });
    renderLists(fixture);
    const list = await openList("Mosaic");

    const tried = within(list).getByRole("option", {
      name: /Unsaved combination/,
    });
    expect(tried).toHaveTextContent("untyped + Named books");
    expect(hasNamed(tried, "Tried recently, not saved in the app")).toBe(true);
    await choose(tried);

    expect(readVisible(fixture.stage).link).toMatchObject({
      mod: UNTYPED_MOD_SOURCE,
      collection: NAMED_BOOKS_SOURCE,
      mosaic: null,
      sites: null,
    });
  });

  it("records a run link's pair, shown as the pinned current row and not twice", async function pinsCurrentPair(): Promise<void> {
    const fixture = await startListStage(BOOKS_RUN_HASH);
    renderLists(fixture);

    const list = await openList("Mosaic");

    expect(readRecentlyUsedSnapshot(fixture.recentlyUsed).combinations).toEqual(
      [{ mod: SAMPLE_MOD_SOURCE, collection: SAMPLE_COLLECTION_SOURCE }],
    );
    const unsaved = within(list).getAllByRole("option", {
      name: /Unsaved combination/,
    });
    expect(unsaved).toHaveLength(1);
    expect(hasNamed(unsaved[0], "Current")).toBe(true);
  });
});

const BOOK_TYPE_SOURCE = `${FIXTURES_BASE_URL}types/book.md`;
const BOOK_TILES_FOLDER = `${FIXTURES_BASE_URL}tiles/books/`;
const NAMED_BOOK_TILE = `${FIXTURES_BASE_URL}tiles/named_books/named_book.md`;

function fetchRecorded(
  requested: string[],
  input: RequestInfo | URL,
): Promise<Response> {
  requested.push(String(input instanceof Request ? input.url : input));
  return fetchTestFile(input);
}

/** The lists' combination catalog, keeping each URL it requests. */
function buildRecordingCombinations(
  stage: Stage,
  requested: string[],
): CombinationCatalog {
  return createCombinationCatalog({
    fetchOptions: {
      baseUrl: APP_BASE_URL,
      fetch: fetchRecorded.bind(undefined, requested),
      npmHost: TEST_NPM_HOST,
      defaultModsFolder: "./default_mods/",
    },
    readCatalog: readStageCatalog.bind(undefined, stage),
  });
}

function countRequests(requested: readonly string[], url: string): number {
  let count = 0;
  for (const request of requested) {
    if (request === url) {
      count += 1;
    }
  }
  return count;
}

function hasTileRequest(requested: readonly string[]): boolean {
  for (const request of requested) {
    if (request.endsWith(".md")) {
      return true;
    }
  }
  return false;
}

function findCapsule(kind: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${kind}: `) });
}

async function hoverCapsule(kind: string): Promise<void> {
  await act(async function hover(): Promise<void> {
    fireEvent.pointerMove(findCapsule(kind));
    await settleLoads();
  });
}

async function focusCapsule(kind: string): Promise<void> {
  await act(async function focus(): Promise<void> {
    fireEvent.focus(findCapsule(kind));
    await settleLoads();
  });
}

async function renderRecording(
  hash: string,
): Promise<{ requested: string[]; combinations: CombinationCatalog }> {
  const fixture = await startListStage(hash);
  const requested: string[] = [];
  const combinations = buildRecordingCombinations(fixture.stage, requested);
  renderLists(fixture, combinations);
  await act(async function settleSummaries(): Promise<void> {
    await settleLoads();
  });
  const recording = { requested, combinations };
  return recording;
}

describe("measured ahead", function describeMeasuredAhead(): void {
  it("Shown sandbox: the lists' mod, collection and mosaic files load, but no tile and no tile type", async function loadsSummaries(): Promise<void> {
    const { requested } = await renderRecording(BOOKS_RUN_HASH);

    expect(requested).toContain(SAMPLE_MOD_SOURCE);
    expect(requested).toContain(UNTYPED_MOD_SOURCE);
    expect(requested).toContain(SAMPLE_COLLECTION_SOURCE);
    expect(requested).toContain(NAMED_BOOKS_SOURCE);
    expect(requested).toContain(SAMPLE_MOSAIC_SOURCE);
    expect(requested).toContain(ALIASED_MOSAIC_SOURCE);
    expect(requested).not.toContain(BOOK_TYPE_SOURCE);
    expect(hasTileRequest(requested)).toBe(false);
  });

  it("Refused link: a link with both a collection and a tile requests no list file", async function skipsRefusedLink(): Promise<void> {
    const { requested } = await renderRecording(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}&tile=./fixtures/tiles/books/kallocain.md`,
    );

    expect(requested).toEqual([]);
  });

  it("Hovering the mod capsule: the tile type files are requested before the list opens, once", async function measuresOnHover(): Promise<void> {
    const { requested } = await renderRecording(BOOKS_RUN_HASH);

    await hoverCapsule("Mod");
    await hoverCapsule("Mod");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(countRequests(requested, BOOK_TYPE_SOURCE)).toBe(1);
    expect(countRequests(requested, `${BOOK_TILES_FOLDER}kallocain.md`)).toBe(
      1,
    );
  });

  it("Opened after hovering: every mod shows its score at once", async function showsScoresAtOnce(): Promise<void> {
    await renderRecording(BOOKS_RUN_HASH);
    await hoverCapsule("Mod");

    fireEvent.click(findCapsule("Mod"));

    const list = screen.getByRole("dialog");
    expect(within(list).queryByRole("img", { name: "Counting" })).toBeNull();
    expect(readScore(findOption(list, UNTYPED_MOD_SOURCE))).toBe("3/3");
  });

  it("Focusing the collection capsule: the mod's scores on the collections are measured", async function measuresOnFocus(): Promise<void> {
    const { requested } = await renderRecording(BOOKS_RUN_HASH);

    await focusCapsule("Collection");
    await focusCapsule("Collection");

    expect(countRequests(requested, NAMED_BOOK_TILE)).toBe(1);
    expect(countRequests(requested, BOOK_TYPE_SOURCE)).toBe(1);
  });

  it("Hovering the mosaic capsule: the mosaics' scores are measured with their aliases", async function measuresMosaics(): Promise<void> {
    const { requested, combinations } = await renderRecording(BOOKS_RUN_HASH);

    await hoverCapsule("Mosaic");

    const counts = readCombinationSnapshot(combinations).counts;
    expect(counts[buildMosaicCountKey(ALIASED_MOSAIC_SOURCE)]).toEqual({
      state: "loaded",
      value: { matching: 1, total: 1, isUntyped: false },
    });
    expect(countRequests(requested, NAMED_BOOK_TILE)).toBe(1);
  });

  it("Opening the folded capsule's menu measures for all three lists", async function measuresFromFoldedMenu(): Promise<void> {
    const { requested } = await renderRecording(BOOKS_RUN_HASH);

    await act(async function openFoldedMenu(): Promise<void> {
      fireEvent.pointerDown(findCapsule("Combination"), {
        button: 0,
        ctrlKey: false,
      });
      await settleLoads();
    });

    expect(countRequests(requested, BOOK_TYPE_SOURCE)).toBe(1);
    expect(countRequests(requested, NAMED_BOOK_TILE)).toBe(1);
  });
});
