import { expect, test } from "@playwright/test";
import type {
  FrameLocator,
  Locator,
  Page,
  Request,
  Route,
} from "@playwright/test";
import type { ModFiles } from "./mod_routes.ts";
import {
  buildMissingEntrypointFiles,
  buildSlowMountFiles,
  buildTestedProbeFiles,
  coverPermissionRow,
  expectMessageCount,
  FAILING_CASE_TEST_CODE,
  findModFrame,
  followLink,
  LINKED_TILE_URL,
  MEDIA_HOST,
  readMessages,
  readParentDocumentError,
  recordHost,
  routeImages,
  serveAppOriginMod,
  serveLinkedTiles,
  stageBar,
  visibleSandbox,
} from "./mod_routes.ts";
import {
  readTilesModSource,
  readTilesMosaicSource,
  serveExplorerOfTilesMod,
  serveTilesMod,
  TILES_CASE_NAMES,
  TILES_COLLECTION_GLOB,
  TILES_MOD_REFERENCE,
  TILES_MOSAIC_PATH,
  TILES_TITLE,
} from "./test_mods.ts";
import {
  currentItem,
  openModsSection,
  openSection,
  pageBody,
} from "./app_layout.ts";
import { EXPLORER_OFF_PREVIEW_URL } from "./app_servers.ts";
import { listOwnLookDeclarations, readTokenAs } from "./theme_probes.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

/** Serves the tiles mod, with `extraFiles` under `/test-mods/`, and opens the mod viewer on it. */
async function openViewerForTilesMod(
  page: Page,
  extraFiles: ModFiles = {},
): Promise<void> {
  await serveTilesMod(page, extraFiles);
  await page.goto(`/#/run?mod=mod_viewer&target=${TILES_MOD_REFERENCE}`);
  await expect(
    coverPermissionRow(page.frameLocator('iframe[title="Mod Viewer"]')),
  ).toBeVisible();
}

/**
 * Selects the mod titled `title` in the mod explorer, and expects the mod viewer to be the
 * visible mod, showing that mod, with `source` as the run link's `target`.
 */
async function expectExplorerOpensMod(
  page: Page,
  title: string,
  source: string,
): Promise<void> {
  const explorer = page.frameLocator('iframe[title="Mods"]');

  await explorer.getByRole("button", { name: title }).click();

  await expect(stageBar(page)).toContainText("Mod Viewer");
  await expect(
    page.frameLocator('iframe[title="Mod Viewer"]').getByRole("heading", {
      name: title,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe(
    `#/run?mod=mod_viewer&target=${encodeURIComponent(source)}`,
  );
}

test.describe(
  "Default mod settings",
  { tag: "@frames" },
  function describeSettings(): void {
    test("Vanilla settings", async function opensViewer({
      page,
    }): Promise<void> {
      await serveExplorerOfTilesMod(page);
      await page.goto("/");
      await openModsSection(page);
      const explorer = await findModFrame(page, "Mods");

      await explorer.getByRole("button", { name: /Tiles/ }).click();

      await expect(stageBar(page)).toContainText("Mod Viewer");
    });

    test("Vanilla home is not a mod", async function showsHomePage({
      page,
    }): Promise<void> {
      await page.goto("/");

      await expect(
        pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
      ).toBeVisible();
      await expect(page.locator("[data-sandbox-id]")).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(0);
    });
  },
);

test.describe(
  "Default mods are ordinary mods",
  { tag: "@frames" },
  function describeOrdinary(): void {
    test("Explorer sandbox", async function sandboxesExplorer({
      page,
    }): Promise<void> {
      await page.goto(EXPLORER_RUN_LINK);

      await expect(page.locator('iframe[title="Mods"]')).toHaveAttribute(
        "sandbox",
        "allow-scripts",
      );
      const explorer = await findModFrame(page, "Mods");
      expect(await explorer.evaluate(readParentDocumentError)).toBe(
        "SecurityError",
      );
    });
  },
);

/** The cards of the mod explorer opened with its vanilla config. */
function vanillaExplorerCards(page: Page): Locator {
  return page.frameLocator('iframe[title="Mods"]').getByRole("article");
}

// The tests tagged `@sample` check how the app ships the samples, so they
// need them (design.md of isolate-tests-from-samples, decision 4).
test.describe(
  "Mod explorer",
  { tag: "@frames" },
  function describeExplorer(): void {
    test("Select a mod", async function selectsMod({ page }): Promise<void> {
      await serveExplorerOfTilesMod(page);
      await page.goto(EXPLORER_RUN_LINK);

      await expectExplorerOpensMod(page, TILES_TITLE, readTilesModSource(page));
    });

    test(
      "Vanilla explorer lists the sample",
      { tag: "@sample" },
      async function listsBookListSample({ page }): Promise<void> {
        await page.goto(EXPLORER_RUN_LINK);
        const cards = vanillaExplorerCards(page);

        await expect(cards.nth(0).getByRole("heading")).toHaveText("Book List");
        await expect(cards.nth(0)).toContainText(
          "A grid of book covers, with a card for each book that shows its details and text.",
        );
      },
    );

    test(
      "Vanilla explorer lists the flashcards sample",
      { tag: "@sample" },
      async function listsFlashcardsSample({ page }): Promise<void> {
        await page.goto(EXPLORER_RUN_LINK);
        const cards = vanillaExplorerCards(page);

        await expect(cards.getByRole("heading")).toHaveText([
          "Book List",
          "Flashcards",
          "Country Map",
        ]);
        await expect(cards.nth(1)).toContainText(
          "Explore any collection as a table, and study it as question and answer cards.",
        );
      },
    );

    test(
      "Vanilla explorer lists the country map sample",
      { tag: "@sample" },
      async function listsCountryMapSample({ page }): Promise<void> {
        await page.goto(EXPLORER_RUN_LINK);
        const cards = vanillaExplorerCards(page);

        await expect(cards.getByRole("heading")).toHaveText([
          "Book List",
          "Flashcards",
          "Country Map",
        ]);
        await expect(cards.nth(2)).toContainText(
          "Shows any collection on a world map, with a marker per country, a list of its tiles and a card for each one.",
        );
      },
    );
  },
);

test.describe(
  "Mod explorer vanilla config",
  { tag: "@frames" },
  function describeExplorerVanillaConfig(): void {
    test(
      "Select the flashcards sample",
      {
        tag: "@sample",
      },
      async function selectsFlashcards({ page }): Promise<void> {
        await page.goto(EXPLORER_RUN_LINK);

        await expectExplorerOpensMod(
          page,
          "Flashcards",
          new URL("/samples/mods/flashcards/mod_conf.yaml", page.url()).href,
        );
      },
    );
  },
);

/** `two_books.yaml`: a collection of two books, served under `/test-mods/`. */
function buildTwoBooksFiles(): ModFiles {
  const files = {
    "two_books.yaml": [
      "collection:",
      '  title: "Two books"',
      "  tiles:",
      '    - path: "./books/kallocain.md"',
      '    - path: "./books/fictions.md"',
    ].join("\n"),
    "books/kallocain.md": '---\ntitle: "Kallocain"\n---\n\nA book.\n',
    "books/fictions.md": '---\ntitle: "The Library of Babel"\n---\n\nA book.\n',
  };
  return files;
}

function collectionField(viewer: FrameLocator): Locator {
  return viewer.getByRole("textbox", { name: "Collection address" });
}

/** Types `address` in the viewer's collection field and presses "Run with this collection". */
async function runWithTypedCollection(
  viewer: FrameLocator,
  address: string,
): Promise<void> {
  await collectionField(viewer).fill(address);
  await viewer
    .getByRole("button", { name: "Run with this collection" })
    .click();
}

/** Expects the tiles mod to list the two books of `two_books.yaml`. */
async function expectTwoBooks(page: Page): Promise<void> {
  const tilesMod = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
  await expect(tilesMod.getByRole("listitem")).toHaveText([
    "Kallocain",
    "The Library of Babel",
  ]);
}

/** A parameter of the run link in the page's address, e.g. `collection`. */
function readRunLinkParam(page: Page, name: string): string | null {
  const hash = new URL(page.url()).hash;
  const query = hash.slice(hash.indexOf("?") + 1);
  const value = new URLSearchParams(query).get(name);
  return value;
}

test.describe(
  "Mod viewer runs the mod",
  { tag: "@frames" },
  function describeViewerRuns(): void {
    test("Run with the sample tiles", async function opensDefaultMosaic({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page);
      const viewerFrame = await findModFrame(page, "Mod Viewer");

      await viewerFrame
        .getByRole("button", { name: "Open default mosaic" })
        .click();

      await expect(stageBar(page)).toContainText(TILES_TITLE);
      const tilesMod = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
      await expect(tilesMod.getByRole("listitem")).toHaveCount(3);
      expect(readRunLinkParam(page, "mosaic")).toBe(
        readTilesMosaicSource(page),
      );
      expect(readRunLinkParam(page, "mod")).toBeNull();
      await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
      await expect(
        viewerFrame.getByRole("heading", {
          name: TILES_TITLE,
          includeHidden: true,
        }),
      ).toBeAttached();
    });

    test("Run with a typed collection", async function runsWithTypedCollection({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page, buildTwoBooksFiles());
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await runWithTypedCollection(
        viewer,
        new URL("/test-mods/two_books.yaml", page.url()).href,
      );

      await expectTwoBooks(page);
    });

    test("Run with a relative collection address", async function runsWithRelativeCollection({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page, buildTwoBooksFiles());
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await runWithTypedCollection(viewer, "./test-mods/two_books.yaml");

      await expect(
        viewer.getByRole("alert", { includeHidden: true }),
      ).toHaveCount(0);
      await expectTwoBooks(page);
      expect(readRunLinkParam(page, "collection")).toBe(
        "./test-mods/two_books.yaml",
      );
    });

    test("Run with a bare relative path", async function runsWithBareRelativePath({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page, buildTwoBooksFiles());
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await runWithTypedCollection(viewer, "test-mods/two_books.yaml");

      await expectTwoBooks(page);
    });

    test("Run without tiles", async function runsWithoutTiles({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page);
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await viewer.getByRole("button", { name: "Run without tiles" }).click();

      await expect(stageBar(page)).toContainText(TILES_TITLE);
      await expect(
        page
          .frameLocator(`iframe[title="${TILES_TITLE}"]`)
          .getByText("There are no tiles to show."),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=${encodeURIComponent(readTilesModSource(page))}`,
      );
    });
  },
);

/** The viewer's "Check report" section. */
function checkReport(viewer: FrameLocator): Locator {
  return viewer.getByRole("region", { name: "Check report" });
}

test.describe(
  "Mod viewer checks the mod",
  { tag: "@frames" },
  function describeViewerChecks(): void {
    test("Checking in progress", async function showsCheckInProgress({
      page,
    }): Promise<void> {
      await serveAppOriginMod(page, buildSlowMountFiles());
      await page.goto("/#/run?mod=mod_viewer&target=./test-mods/slow_mount/");
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
      const checkButton = viewer.getByRole("button", { name: "Check mod" });

      await checkButton.click();

      await expect(checkButton).toBeDisabled();
      await expect(viewer.getByRole("status")).toContainText("Checking");
      await expect(checkReport(viewer)).toHaveCount(0);
      await expect(checkReport(viewer)).toBeVisible({ timeout: 10000 });
      await expect(checkButton).toBeEnabled();
      await expect(viewer.getByRole("status")).toHaveCount(0);
    });

    test("No button without a mod", async function hidesCheckWithoutMod({
      page,
    }): Promise<void> {
      await page.goto("/#/run?mod=mod_viewer");
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await expect(viewer.getByText("No mod was given.")).toBeVisible();
      await expect(
        viewer.getByRole("button", { name: "Check mod" }),
      ).toHaveCount(0);
    });

    test("Check with a relative collection address", async function checksWithRelativeCollection({
      page,
    }): Promise<void> {
      // Every file under `/test-mods/` but the tiles mod's answers `404 Not Found`.
      await openViewerForTilesMod(page);
      const sampleCollectionUrls = await recordHost(
        page,
        TILES_COLLECTION_GLOB,
      );
      const defaultMosaicUrls = await recordHost(
        page,
        `**${TILES_MOSAIC_PATH}`,
      );
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
      const missingCollection = new URL("/test-mods/missing.yaml", page.url())
        .href;

      await collectionField(viewer).fill("./test-mods/missing.yaml");
      await viewer.getByRole("button", { name: "Check mod" }).click();

      const finding = checkReport(viewer)
        .getByRole("listitem")
        .filter({ hasText: missingCollection });
      await expect(finding).toContainText("error");
      await expect(finding).toContainText("404");
      expect(sampleCollectionUrls).toEqual([]);
      expect(defaultMosaicUrls).toEqual([]);
    });
  },
);

/** The text of each passed case in the viewer's report: its status badge, then its name. */
function listPassedCaseTexts(names: string[]): string[] {
  const texts: string[] = [];
  for (const name of names) {
    texts.push(`pass ${name}`);
  }
  return texts;
}

test.describe(
  "Mod viewer shows the check report",
  { tag: "@frames" },
  function describeViewerReport(): void {
    test("Sample mod passes", async function showsPassingReport({
      page,
    }): Promise<void> {
      await openViewerForTilesMod(page);
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await viewer.getByRole("button", { name: "Check mod" }).click();

      const report = checkReport(viewer);
      await expect(report.getByRole("heading")).toContainText("Check passed");
      await expect(
        report.getByRole("heading").locator("span[data-ot-variant]"),
      ).toHaveAttribute("data-ot-variant", "success");
      await expect(report.getByText("No findings.")).toBeVisible();
      await expect(report.getByRole("list", { name: "Findings" })).toHaveCount(
        0,
      );
      const cases = report
        .getByRole("list", { name: "Tests" })
        .getByRole("listitem");
      await expect(cases).toHaveText(listPassedCaseTexts(TILES_CASE_NAMES));
      for (const caseItem of await cases.all()) {
        await expect(caseItem.locator("span[data-ot-variant]")).toHaveAttribute(
          "data-ot-variant",
          "success",
        );
      }
      await expect(
        visibleSandbox(page).locator('iframe[title="Mod Viewer"]'),
      ).toBeVisible();
      await expect(stageBar(page)).toContainText("Mod Viewer");
    });

    test("Failing mod", async function showsFailingReport({
      page,
    }): Promise<void> {
      await serveAppOriginMod(page, buildMissingEntrypointFiles());
      await page.goto("/#/run?mod=mod_viewer&target=./test-mods/missing_code/");
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
      const entrypoint = new URL("/test-mods/missing_code/main.js", page.url())
        .href;

      await viewer.getByRole("button", { name: "Check mod" }).click();

      const report = checkReport(viewer);
      await expect(report.getByRole("heading")).toContainText("Check failed");
      await expect(
        report.getByRole("heading").locator("span[data-ot-variant]"),
      ).toHaveAttribute("data-ot-variant", "destructive");
      const finding = report.getByRole("listitem");
      await expect(finding).toHaveCount(1);
      await expect(finding).toContainText("bundle");
      await expect(finding).toContainText("error");
      await expect(finding).toContainText(entrypoint);
      await expect(finding).toContainText("404");
    });

    test("Failing case", async function showsFailingCase({
      page,
    }): Promise<void> {
      await serveAppOriginMod(
        page,
        buildTestedProbeFiles("failing_case", FAILING_CASE_TEST_CODE),
      );
      await page.goto("/#/run?mod=mod_viewer&target=./test-mods/failing_case/");
      const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

      await viewer.getByRole("button", { name: "Check mod" }).click();

      const report = checkReport(viewer);
      await expect(report.getByRole("heading")).toContainText("Check failed");
      await expect(
        report.getByRole("heading").locator("span[data-ot-variant]"),
      ).toHaveAttribute("data-ot-variant", "destructive");
      const caseItem = report
        .getByRole("list", { name: "Tests" })
        .getByRole("listitem");
      await expect(caseItem).toHaveText("fail lists books: no books");
      await expect(caseItem.locator("span[data-ot-variant]")).toHaveAttribute(
        "data-ot-variant",
        "destructive",
      );
    });
  },
);

// The default mods' look is tested by their own cases (default_mods/README.md).
/** The cases of the explorer's test file (default_mods/mod_explorer/test/test.ts), in order. */
const EXPLORER_CASES = [
  "lists the mods of its config as cards",
  "lists a mod that cannot be inspected as an alert",
  "opens the viewer for the selected mod",
  "keeps its own styles to layout",
  "draws each mod on the card background",
];

/** The cases of the viewer's test file (default_mods/mod_viewer/test/test.ts), in order. */
const VIEWER_CASES = [
  "shows the metadata of its target",
  "marks an API range that matches",
  "marks an API range that does not match",
  "says when the mod declares no API range",
  "says no mod was given without a target",
  "says no mod was given for an empty target",
  "shows why a missing target cannot be loaded",
  "shows the format error of its target",
  "opens the default mosaic",
  "runs with the typed collection, sent as typed",
  "runs nothing with an empty collection field",
  "runs without tiles",
  "offers no default mosaic without one",
  "shows permission statuses as badges",
  "makes opening the default mosaic the primary action",
  "keeps its own styles to layout",
];

/** The cases of the collection explorer's test file (default_mods/collection_explorer/test/test.ts), in order. */
const COLLECTION_EXPLORER_CASES = [
  "lists the collections of its config as cards",
  "lists a collection that cannot be inspected as an alert",
  "opens the viewer for the selected collection",
  "keeps its own styles to layout",
  "draws each collection on the card background",
  "draws a failure with the destructive border",
];

/** The cases of the collection viewer's test file (default_mods/collection_viewer/test/test.ts), in order. */
const COLLECTION_VIEWER_CASES = [
  "labels tiles by file name",
  "decodes file names",
  "keeps a file name that cannot be decoded",
  "adds the parent folder to shared file names",
  "keeps labels that still clash",
  "filters labels ignoring letter case",
  "keeps every tile for an empty filter",
  "shows the collection of its target",
  "shows each tile's address",
  "labels tiles that share a file name",
  "labels an encoded file name decoded",
  "shows the entry issues",
  "shows no issue list without issues",
  "labels its filter field",
  "filters the tiles and says how many are shown",
  "shows every tile once the filter is empty",
  "opens the selected tile in the tile viewer",
  "shows a refused open",
  "says no collection was given without a target",
  "says no collection was given for an empty target",
  "shows why a missing target cannot be inspected",
  "shows the format error of its target",
  "keeps its own styles to layout",
  "draws the collection on the card background",
  "draws issue levels as badges",
  "draws the tiles in a card, with the count under the filter",
  "keeps the filter field to a readable width",
];

/** The cases of the tile viewer's test file (default_mods/tile_viewer/test/test.ts), in order. */
const TILE_VIEWER_CASES = [
  "heads a tile with its title",
  "heads a tile without a title with its file name",
  "heads with the file name when the title is empty or not text",
  "heads with the decoded file name",
  "tells web addresses",
  "tells image addresses by their path",
  "tells tile addresses by their path",
  "counts the lines of each value",
  "keeps short metadata whole",
  "keeps metadata of six lines whole",
  "cuts the list that does not fit",
  "hides the fields after the first that does not fit",
  "hides a list with no room for an item",
  "cuts a long first list",
  "shows a large first mapping whole",
  "shows the tile's heading, source and body",
  "puts the body in the card, after a separator",
  "heads a fixture without a title with its file name",
  "shows nested metadata in frontmatter order",
  "lays a value beside its key and list items one per line",
  "links the web addresses of the metadata",
  "shows a thumbnail for an image address",
  "draws thumbnails two lines high",
  "starts long metadata collapsed",
  "shows all the fields, then fewer again",
  "draws the metadata button as a button no taller than its heading",
  "shows short metadata without a button",
  "cuts a long first list in the view",
  "hides a thumbnail that fails to load",
  "says that a file has no metadata",
  "renders no empty body",
  "says no tile was given without tiles",
  "shows the tile's place in its collection",
  "disables Previous on the first tile",
  "disables Next on the last tile",
  "replaces itself with the next tile",
  "replaces itself with the previous tile",
  "opens the collection from its name",
  "shows a refused open",
  "shows no place for a tile not in from",
  "warns about a from it cannot read",
  "opens a linked tile of from with from",
  "opens a linked tile outside from without from",
  "opens a linked tile without from when it has none",
  "opens a tile linked by the metadata",
  "leaves the other links to the app",
  "keeps its own styles to layout",
  "draws the tile as a card, with Next primary",
];

/** Answers like a site that ships no `samples/`. */
async function answerNotFound(route: Route): Promise<void> {
  await route.fulfill({ status: 404, body: "Not Found" });
}

/**
 * How long a default mod's check may take, in milliseconds. A check runs
 * each case in a fresh frame, one after another, so it grows with the
 * cases: the tile viewer's take several seconds in a busy run.
 */
const DEFAULT_MOD_CHECK_TIMEOUT = 15000;

/**
 * Checks a default mod in the visible mod viewer, as a user would, and gives
 * the report once its status heading is shown.
 */
async function checkDefaultMod(page: Page, modName: string): Promise<Locator> {
  await page.goto(`/#/run?mod=mod_viewer&target=${modName}`);
  // The visible one: a viewer opened before stays behind it, hidden.
  const viewer = visibleSandbox(page).frameLocator(
    'iframe[title="Mod Viewer"]',
  );
  await viewer.getByRole("button", { name: "Check mod" }).click();
  const report = checkReport(viewer);
  await expect(report.getByRole("heading")).toBeVisible({
    timeout: DEFAULT_MOD_CHECK_TIMEOUT,
  });
  return report;
}

/** Expects a report that passed with every case passed, the cases listed by name. */
async function expectEveryCasePassed(
  report: Locator,
  caseNames: string[],
): Promise<void> {
  const passedCases: string[] = [];
  for (const caseName of caseNames) {
    passedCases.push(`pass ${caseName}`);
  }
  await expect(report.getByRole("heading")).toHaveText("Check passed pass");
  await expect(
    report.getByRole("list", { name: "Tests" }).getByRole("listitem"),
  ).toHaveText(passedCases);
  await expect(report.getByText("No findings.")).toBeVisible();
}

test.describe(
  "Default mods ship their tests",
  { tag: "@frames" },
  function describeShippedTests(): void {
    test("Explorer passes its check", async function checksExplorer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "mod_explorer");

      await expectEveryCasePassed(report, EXPLORER_CASES);
    });

    test("Viewer passes its check", async function checksViewer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "mod_viewer");

      await expectEveryCasePassed(report, VIEWER_CASES);
    });

    test("Collection explorer passes its check", async function checksCollectionExplorer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "collection_explorer");

      await expectEveryCasePassed(report, COLLECTION_EXPLORER_CASES);
    });

    test("Collection viewer passes its check", async function checksCollectionViewer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "collection_viewer");

      await expectEveryCasePassed(report, COLLECTION_VIEWER_CASES);
    });

    test("Tile viewer passes its check", async function checksTileViewer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "tile_viewer");

      await expectEveryCasePassed(report, TILE_VIEWER_CASES);
    });

    test("Cases without the samples", async function checksWithoutSamples({
      page,
    }): Promise<void> {
      await page.route("**/samples/**", answerNotFound);

      const viewerReport = await checkDefaultMod(page, "mod_viewer");
      await expectEveryCasePassed(viewerReport, VIEWER_CASES);
      const explorerReport = await checkDefaultMod(page, "mod_explorer");
      await expectEveryCasePassed(explorerReport, EXPLORER_CASES);
      const collectionViewerReport = await checkDefaultMod(
        page,
        "collection_viewer",
      );
      await expectEveryCasePassed(
        collectionViewerReport,
        COLLECTION_VIEWER_CASES,
      );
      const collectionExplorerReport = await checkDefaultMod(
        page,
        "collection_explorer",
      );
      await expectEveryCasePassed(
        collectionExplorerReport,
        COLLECTION_EXPLORER_CASES,
      );
      const tileViewerReport = await checkDefaultMod(page, "tile_viewer");
      await expectEveryCasePassed(tileViewerReport, TILE_VIEWER_CASES);
    });
  },
);

/** The sample collection of Nobel laureates, as the vanilla collection explorer lists it. */
const LAUREATES_COLLECTION_REFERENCE =
  "./samples/tiles/literature_nobel_laureates/collection.yaml";

/** A collection on a site that does not allow the app's origin. */
const REFUSING_COLLECTION_SOURCE = "https://tiles.example.net/books.yaml";

function recordTileRequest(tileUrls: string[], request: Request): void {
  if (new URL(request.url()).pathname.endsWith(".md")) {
    tileUrls.push(request.url());
  }
}

/** The tile files the page requests from now on, by address. */
function recordTileRequests(page: Page): string[] {
  const tileUrls: string[] = [];
  page.on("request", recordTileRequest.bind(undefined, tileUrls));
  return tileUrls;
}

function buildCollectionViewerLink(target: string): string {
  const link = `/#/run?mod=collection_viewer&target=${encodeURIComponent(target)}`;
  return link;
}

function collectionViewerFrame(page: Page): FrameLocator {
  return visibleSandbox(page).frameLocator('iframe[title="Collection Viewer"]');
}

async function refuseRequest(route: Route): Promise<void> {
  await route.abort("failed");
}

test.describe(
  "Collection viewer",
  { tag: "@frames" },
  function describeCollectionViewer(): void {
    test(
      "View a sample collection",
      { tag: "@sample" },
      async function viewsSampleCollection({ page }): Promise<void> {
        const tileUrls = recordTileRequests(page);
        await page.goto(
          buildCollectionViewerLink(LAUREATES_COLLECTION_REFERENCE),
        );
        const viewer = collectionViewerFrame(page);

        await expect(
          viewer.getByRole("heading", {
            name: "Nobel Prize in Literature laureates",
          }),
        ).toBeVisible();
        await expect(viewer.locator("article").first()).toContainText(
          "Nobel Prize in Literature laureates from 2010 to 2026, ordered by award year.",
        );
        await expect(viewer.locator("article dd")).toHaveText(
          new URL(LAUREATES_COLLECTION_REFERENCE, page.url()).href,
        );
        await expect(
          viewer.getByRole("region", { name: "Tiles" }).locator("tbody tr"),
        ).toHaveCount(17);
        expect(tileUrls).toEqual([]);
      },
    );

    test("Collection whose site refuses the app", async function showsRefusedSite({
      page,
    }): Promise<void> {
      await page.route(REFUSING_COLLECTION_SOURCE, refuseRequest);
      await page.goto(buildCollectionViewerLink(REFUSING_COLLECTION_SOURCE));

      const alert = collectionViewerFrame(page).getByRole("alert");
      await expect(alert).toContainText(REFUSING_COLLECTION_SOURCE);
      await expect(alert).toContainText(
        "The site may be unreachable or may not allow this app to read its files.",
      );
    });
  },
);

const COLLECTION_EXPLORER_RUN_LINK = "/#/run?mod=collection_explorer";

/** The first collection of the vanilla explorer's config, wherever the app is served. */
const LAUREATES_COLLECTION_GLOB =
  "**/samples/tiles/literature_nobel_laureates/collection.yaml";

/** What the tests serve at the first collection of the vanilla config, so they need no samples. */
const ROUTED_COLLECTION_TEXT = `collection:
  title: "Routed collection"
  description: "A collection the e2e tests serve."
  tiles:
    - path: "./first.md"
    - path: "./second.md"
`;

const LAUREATES_TITLE = "Nobel Prize in Literature laureates";

/** A fixture collection of the collection viewer, which every built app serves. */
const VIEWER_FIXTURE_REFERENCE =
  "./default_mods/collection_viewer/fixtures/issues_collection.yaml";

async function serveRoutedCollection(route: Route): Promise<void> {
  await route.fulfill({ status: 200, body: ROUTED_COLLECTION_TEXT });
}

function collectionExplorerFrame(page: Page): FrameLocator {
  return visibleSandbox(page).frameLocator('iframe[title="Tiles"]');
}

function vanillaCollectionCards(page: Page): Locator {
  return collectionExplorerFrame(page).locator("li > article");
}

/** Waits until the explorer listed its collections. */
async function waitForCollectionList(page: Page): Promise<void> {
  const list = collectionExplorerFrame(page).getByRole("region", {
    name: "Collections",
  });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  await expect(list).not.toHaveAttribute("aria-busy");
}

test.describe(
  "Collection explorer",
  { tag: "@frames" },
  function describeCollectionExplorer(): void {
    test(
      "Vanilla explorer lists the Nobel laureates",
      { tag: "@sample" },
      async function listsLaureates({ page }): Promise<void> {
        await page.goto(COLLECTION_EXPLORER_RUN_LINK);
        const cards = vanillaCollectionCards(page);

        await expect(cards.nth(0).getByRole("heading")).toHaveText(
          LAUREATES_TITLE,
        );
        await expect(cards.nth(0)).toContainText(
          "Nobel Prize in Literature laureates from 2010 to 2026, ordered by award year.",
        );
        await expect(cards.nth(0)).toContainText("17 tiles");
      },
    );

    test(
      "Vanilla explorer lists the books after the laureates",
      { tag: "@sample" },
      async function listsBooksAfterLaureates({ page }): Promise<void> {
        await page.goto(COLLECTION_EXPLORER_RUN_LINK);

        await expect(
          vanillaCollectionCards(page).getByRole("heading"),
        ).toHaveText([
          LAUREATES_TITLE,
          "Nobel Prize in Literature laureates books",
        ]);
      },
    );

    test("Explorer requests no tile", async function requestsNoTile({
      page,
    }): Promise<void> {
      const tileUrls = recordTileRequests(page);

      await page.goto(COLLECTION_EXPLORER_RUN_LINK);
      await waitForCollectionList(page);

      expect(tileUrls).toEqual([]);
    });

    test("Select a collection", async function selectsCollection({
      page,
    }): Promise<void> {
      await page.route(LAUREATES_COLLECTION_GLOB, serveRoutedCollection);
      await page.goto("/");
      await openSection(page, "Tiles");

      await collectionExplorerFrame(page)
        .getByRole("button", { name: "View Routed collection" })
        .click();

      await expect(stageBar(page)).toContainText("Collection Viewer");
      await expect(
        collectionViewerFrame(page).getByRole("heading", {
          name: "Routed collection",
        }),
      ).toBeVisible();
      const source = new URL(
        "./samples/tiles/literature_nobel_laureates/collection.yaml",
        page.url(),
      ).href;
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=collection_viewer&target=${encodeURIComponent(source)}`,
      );
      await expect(currentItem(page)).toHaveText("Tiles");
    });

    test(
      "Collection explorer lists collections as cards",
      { tag: "@sample" },
      async function drawsCollectionCards({ page }): Promise<void> {
        await page.goto(COLLECTION_EXPLORER_RUN_LINK);
        const card = vanillaCollectionCards(page).nth(0);
        await expect(card.getByRole("heading")).toHaveText(LAUREATES_TITLE);
        const explorer = await findModFrame(page, "Tiles");

        await expect(card).toHaveCSS(
          "background-color",
          await explorer.evaluate(readTokenAs, ["--ot-card", "color"]),
        );
        await expect(
          card.getByRole("button", { name: new RegExp(LAUREATES_TITLE) }),
        ).toBeVisible();
      },
    );

    test("Collection explorer shows a failure as an alert", async function drawsFailureAlert({
      page,
    }): Promise<void> {
      await page.route(LAUREATES_COLLECTION_GLOB, answerNotFound);
      await page.goto(COLLECTION_EXPLORER_RUN_LINK);
      const alert = collectionExplorerFrame(page).getByRole("alert").first();

      await expect(alert).toContainText(
        "./samples/tiles/literature_nobel_laureates/collection.yaml",
      );
      await expect(alert).toContainText("404");
      const explorer = await findModFrame(page, "Tiles");
      await expect(alert).toHaveCSS(
        "border-top-color",
        await explorer.evaluate(readTokenAs, [
          "--ot-destructive",
          "border-top-color",
        ]),
      );
    });

    test("Own styles are layout only", async function keepsLayoutOnly({
      page,
    }): Promise<void> {
      await page.goto(COLLECTION_EXPLORER_RUN_LINK);
      await waitForCollectionList(page);
      const explorer = await findModFrame(page, "Tiles");
      expect(await explorer.evaluate(listOwnLookDeclarations)).toEqual([]);

      await page.goto(buildCollectionViewerLink(VIEWER_FIXTURE_REFERENCE));
      await expect(
        collectionViewerFrame(page).getByRole("region", { name: "Tiles" }),
      ).toBeVisible();
      const viewer = await findModFrame(page, "Collection Viewer");
      expect(await viewer.evaluate(listOwnLookDeclarations)).toEqual([]);

      await openFixtureTile(page, "tiles/kallocain.md");
      await expect(
        tileViewerFrame(page).getByRole("navigation", { name: "Collection" }),
      ).toBeVisible();
      const tileViewer = await findModFrame(page, "Tile Viewer");
      expect(await tileViewer.evaluate(listOwnLookDeclarations)).toEqual([]);
    });

    test("Viewer switched off", async function showsSwitchedOffViewer({
      page,
    }): Promise<void> {
      await page.route(LAUREATES_COLLECTION_GLOB, serveRoutedCollection);
      await page.goto(
        `${EXPLORER_OFF_PREVIEW_URL}${COLLECTION_EXPLORER_RUN_LINK}`,
      );
      const explorer = collectionExplorerFrame(page);

      await explorer
        .getByRole("button", { name: "View Routed collection" })
        .click();

      await expect(explorer.getByRole("status")).toContainText(
        "collection_viewer",
      );
      await expect(stageBar(page)).toContainText("Tiles");
      await expect(
        page.locator('iframe[title="Collection Viewer"]'),
      ).toHaveCount(0);
    });
  },
);

/** The tile viewer's fixtures, which every built app serves with it. */
const TILE_FIXTURES_PATH = "/default_mods/tile_viewer/fixtures/";

/** A fixture of the tile viewer, by its path under its fixtures folder, on the page's origin. */
function readTileFixtureUrl(page: Page, path: string): string {
  const url = new URL(`${TILE_FIXTURES_PATH}${path}`, page.url()).href;
  return url;
}

/** The run link of the tile viewer for `tile`, with `from` when it is given. */
function buildTileViewerLink(tile: string, from: string | null = null): string {
  let link = `#/run?mod=tile_viewer&tile=${encodeURIComponent(tile)}`;
  if (from !== null) {
    link += `&from=${encodeURIComponent(from)}`;
  }
  return link;
}

function tileViewerFrame(page: Page): FrameLocator {
  return visibleSandbox(page).frameLocator('iframe[title="Tile Viewer"]');
}

/** Opens Home, then follows the tile viewer's link for a fixture tile, with the fixture collection as `from` unless `withFrom` is false. */
async function openFixtureTile(
  page: Page,
  tilePath: string,
  withFrom: boolean = true,
): Promise<void> {
  await page.goto("/");
  const tile = readTileFixtureUrl(page, tilePath);
  const from = withFrom
    ? readTileFixtureUrl(page, "tiles_collection.yaml")
    : null;
  await followLink(page, buildTileViewerLink(tile, from));
}

async function answerTileViewerNotFound(route: Route): Promise<void> {
  await route.fulfill({ status: 404, body: "Not Found" });
}

/** Runs in the tile viewer's frame: whether the thumbnail of the `image` value loaded. */
function isThumbnailLoaded(): boolean {
  const thumbnail = document.querySelector("dd a > img");
  return (
    thumbnail instanceof HTMLImageElement &&
    thumbnail.complete &&
    thumbnail.naturalWidth > 0
  );
}

/** The cover the routed tile of the thumbnail tests links, with a query and upper-case extension. */
const ROUTED_COVER_URL = `${MEDIA_HOST}/covers/Kallocain.JPG?w=200`;

test.describe(
  "Tile viewer",
  { tag: "@frames" },
  function describeTileViewer(): void {
    test("View a tile", async function viewsTile({ page }): Promise<void> {
      await page.goto("/");
      const tile = readTileFixtureUrl(page, "tiles/kallocain.md");

      await followLink(page, buildTileViewerLink(tile));

      const viewer = tileViewerFrame(page);
      await expect(viewer.getByRole("heading", { level: 1 })).toHaveText(
        "Kallocain",
      );
      await expect(viewer.locator("article > small")).toHaveText(tile);
      await expect(viewer.locator("ot-tile-body")).toContainText(
        "A fixture tile of the tile viewer's tests.",
      );
      await expect(stageBar(page)).toContainText("Tile Viewer");
    });

    test("Image thumbnail", async function showsThumbnail({
      page,
    }): Promise<void> {
      await serveLinkedTiles(page, [`image: "${ROUTED_COVER_URL}"`]);
      const seenUrls = await routeImages(page, `${MEDIA_HOST}/**`);
      await page.goto(`/${buildTileViewerLink(LINKED_TILE_URL)}`);
      const viewer = tileViewerFrame(page);

      const link = viewer.getByRole("link", { name: ROUTED_COVER_URL });
      await expect(link).toBeVisible();
      await expect(link.locator("img")).toBeVisible();
      const frame = await findModFrame(page, "Tile Viewer");
      await expect
        .poll(frame.evaluate.bind(frame, isThumbnailLoaded))
        .toBe(true);
      expect(seenUrls).toEqual([ROUTED_COVER_URL]);
    });

    test("Image that fails", async function hidesBrokenThumbnail({
      page,
    }): Promise<void> {
      const missingCover = `${MEDIA_HOST}/covers/missing.jpg`;
      await serveLinkedTiles(page, [`image: "${missingCover}"`]);
      await page.route(`${MEDIA_HOST}/**`, answerTileViewerNotFound);
      await page.goto(`/${buildTileViewerLink(LINKED_TILE_URL)}`);
      const viewer = tileViewerFrame(page);

      const link = viewer.getByRole("link", { name: missingCover });
      await expect(link).toBeVisible();
      await expect(link.locator("img")).toBeHidden();
      await expect(link.locator("img")).toHaveAttribute("hidden");
    });

    test("Link to another tile in the body", async function opensLinkedTile({
      page,
    }): Promise<void> {
      await openFixtureTile(page, "tiles/kallocain.md", false);
      const viewer = tileViewerFrame(page);

      await viewer
        .locator("ot-tile-body")
        .getByRole("link", { name: "Fahrenheit 451" })
        .click();

      await expect(
        tileViewerFrame(page).getByRole("heading", { level: 1 }),
      ).toHaveText("Fahrenheit 451");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator('iframe[title="Tile Viewer"]')).toHaveCount(2);

      await page.goBack();

      await expect(
        tileViewerFrame(page).getByRole("heading", { level: 1 }),
      ).toHaveText("Kallocain");
    });

    test("Next tile", async function turnsToNextTile({ page }): Promise<void> {
      await openFixtureTile(page, "tiles/kallocain.md");
      const viewer = tileViewerFrame(page);
      await expect(
        viewer.getByRole("navigation", { name: "Collection" }),
      ).toContainText("1 of 3");

      await viewer.getByRole("button", { name: "Next" }).click();

      const nextViewer = tileViewerFrame(page);
      await expect(nextViewer.getByRole("heading", { level: 1 })).toHaveText(
        "Fahrenheit 451",
      );
      await expect(
        nextViewer.getByRole("navigation", { name: "Collection" }),
      ).toContainText("2 of 3");
      await expect(page.locator('iframe[title="Tile Viewer"]')).toHaveCount(1);
      expect(new URL(page.url()).hash).toBe(
        buildTileViewerLink(
          readTileFixtureUrl(page, "tiles/fahrenheit_451.md"),
          readTileFixtureUrl(page, "tiles_collection.yaml"),
        ),
      );

      await page.goBack();

      await expect(page.locator("[data-sandbox-id]:not([hidden])")).toHaveCount(
        0,
      );
      await expect(currentItem(page)).toHaveText("Home");
    });

    test("Missing from collection", async function warnsMissingFrom({
      page,
    }): Promise<void> {
      await page.goto("/");
      const missingFrom = readTileFixtureUrl(page, "missing_collection.yaml");
      await followLink(
        page,
        buildTileViewerLink(
          readTileFixtureUrl(page, "tiles/kallocain.md"),
          missingFrom,
        ),
      );

      await expect(
        tileViewerFrame(page).getByRole("heading", { level: 1 }),
      ).toHaveText("Kallocain");
      await expectMessageCount(page, "Warnings", 1);
      const warnings = await readMessages(page, "Warnings");
      expect(warnings[0].producer).toBe("Mod");
      expect(warnings[0].source).toBe(missingFrom);
      expect(warnings[0].text).toContain("404");
    });
  },
);

/** The name of the collection the tile tests serve in place of the laureates. */
const ROUTED_TILES_NAME = "Routed tiles";

/** Serves, at the laureates' collection, a collection of the tile viewer's first two fixture tiles, by address. */
async function serveRoutedTiles(route: Route): Promise<void> {
  const origin = new URL(route.request().url()).origin;
  const body = [
    "collection:",
    `  title: "${ROUTED_TILES_NAME}"`,
    "  tiles:",
    `    - url: "${origin}${TILE_FIXTURES_PATH}tiles/kallocain.md"`,
    `    - url: "${origin}${TILE_FIXTURES_PATH}tiles/fahrenheit_451.md"`,
  ].join("\n");
  await route.fulfill({ status: 200, body });
}

test.describe(
  "Collection viewer opens tiles",
  { tag: "@frames" },
  function describeCollectionViewerTiles(): void {
    test("Open a tile from the list", async function opensTileFromList({
      page,
    }): Promise<void> {
      await page.route(LAUREATES_COLLECTION_GLOB, serveRoutedTiles);
      await page.goto("/");
      await openSection(page, "Tiles");
      await collectionExplorerFrame(page)
        .getByRole("button", { name: `View ${ROUTED_TILES_NAME}` })
        .click();

      await collectionViewerFrame(page)
        .getByRole("button", { name: "kallocain.md" })
        .click();

      const viewer = tileViewerFrame(page);
      await expect(viewer.getByRole("heading", { level: 1 })).toHaveText(
        "Kallocain",
      );
      await expect(
        viewer.getByRole("navigation", { name: "Collection" }),
      ).toContainText("1 of 2");
      const collectionSource = new URL(
        "./samples/tiles/literature_nobel_laureates/collection.yaml",
        page.url(),
      ).href;
      expect(new URL(page.url()).hash).toBe(
        buildTileViewerLink(
          readTileFixtureUrl(page, "tiles/kallocain.md"),
          collectionSource,
        ),
      );
      await expect(currentItem(page)).toHaveText("Tiles");
    });

    test("Open the collection", async function opensCollectionFromBreadcrumb({
      page,
    }): Promise<void> {
      await openFixtureTile(page, "tiles/fahrenheit_451.md");
      const viewer = tileViewerFrame(page);

      await viewer
        .getByRole("navigation", { name: "Collection" })
        .getByRole("button", { name: "Viewer tiles" })
        .click();

      await expect(stageBar(page)).toContainText("Collection Viewer");
      await expect(
        collectionViewerFrame(page).getByRole("heading", {
          name: "Viewer tiles",
        }),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=collection_viewer&target=${encodeURIComponent(readTileFixtureUrl(page, "tiles_collection.yaml"))}`,
      );
    });
  },
);
