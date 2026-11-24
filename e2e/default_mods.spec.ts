import { readFile } from "node:fs/promises";
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
  APP_ORIGIN_MOD_PATH,
  buildMissingEntrypointFiles,
  buildSlowMountFiles,
  buildTestedProbeFiles,
  coverPermissionRow,
  expectMessageCount,
  FAILING_CASE_TEST_CODE,
  findModFrame,
  followLink,
  isFrameMarked,
  LINKED_TILE_URL,
  markFrame,
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
  buildLabelsMosaicFiles,
  LABELS_COLLECTION_FILE,
  LABELS_MOSAIC_PATH,
  LABELS_MOSAIC_REFERENCE,
  LABELS_MOSAIC_TITLE,
  readTilesModSource,
  readTilesMosaicSource,
  serveExplorerOfTilesMod,
  serveMosaicExplorerOfLabels,
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
import {
  EXPLORER_OFF_PREVIEW_URL,
  TEST_CATALOG_PREVIEW_URL,
} from "./app_servers.ts";
import { buildStoredSeedEntry, seedUserCatalog } from "./user_catalog_seeds.ts";
import type { UserCatalogSeed } from "./user_catalog_seeds.ts";
import {
  canFrameScrollSideways,
  listOwnLookDeclarations,
  MINIMUM_TEXT_CONTRAST,
  readContrastRatio,
  readRowSeparators,
  readTokenAs,
} from "./theme_probes.ts";
import type { RowSeparators } from "./theme_probes.ts";
import {
  countLines,
  DESKTOP_VIEWPORT,
  isFullyShown,
  PHONE_VIEWPORT,
  readDocumentWidth,
  readExtraWidth,
  readElementBox,
  SMALL_PHONE_VIEWPORT,
} from "./layout_probes.ts";
import type { ElementBox } from "./layout_probes.ts";

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
      await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
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
        pageBody(page).getByRole("heading", { level: 1, name: "Teselarium" }),
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
      await page.goto(`${TEST_CATALOG_PREVIEW_URL}${EXPLORER_RUN_LINK}`);

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
        report.getByRole("heading").locator("span[data-tes-variant]"),
      ).toHaveAttribute("data-tes-variant", "success");
      await expect(report.getByText("No findings.")).toBeVisible();
      await expect(report.getByRole("list", { name: "Findings" })).toHaveCount(
        0,
      );
      const cases = report
        .getByRole("list", { name: "Tests" })
        .getByRole("listitem");
      await expect(cases).toHaveText(listPassedCaseTexts(TILES_CASE_NAMES));
      for (const caseItem of await cases.all()) {
        await expect(
          caseItem.locator("span[data-tes-variant]"),
        ).toHaveAttribute("data-tes-variant", "success");
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
        report.getByRole("heading").locator("span[data-tes-variant]"),
      ).toHaveAttribute("data-tes-variant", "destructive");
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
        report.getByRole("heading").locator("span[data-tes-variant]"),
      ).toHaveAttribute("data-tes-variant", "destructive");
      const caseItem = report
        .getByRole("list", { name: "Tests" })
        .getByRole("listitem");
      await expect(caseItem).toHaveText("fail lists books: no books");
      await expect(caseItem.locator("span[data-tes-variant]")).toHaveAttribute(
        "data-tes-variant",
        "destructive",
      );
    });
  },
);

// The default mods' look is tested by their own cases (default_mods/README.md).
/** The cases of the explorer's test file (default_mods/mod_explorer/test/test.ts), in order. */
const EXPLORER_CASES = [
  "lists the mods of the catalog as cards",
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
  "gives its permission table explicit table roles",
  "makes opening the default mosaic the primary action",
  "keeps its own styles to layout",
];

/** The cases of the collection explorer's test file (default_mods/collection_explorer/test/test.ts), in order. */
const COLLECTION_EXPLORER_CASES = [
  "lists the collections of the catalog as cards",
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
  "gives its tile table explicit table roles",
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

/** The cases of the mosaic explorer's test file (default_mods/mosaic_explorer/test/test.ts), in order. */
const MOSAIC_EXPLORER_CASES = [
  "lists the mosaics of the catalog as cards",
  "marks a mod's default mosaic",
  "lists a mosaic that cannot be inspected as an alert",
  "opens the selected mosaic",
  "opens the viewer for the selected mosaic",
  "shows a refused open",
  "shows where each mosaic lives and marks the user's",
  "marks a mosaic with unexported changes",
  "exports a stored mosaic from its card",
  "downloads a remote mosaic from its card",
  "shows nothing for a cancelled download",
  "names downloaded files after their address",
  "imports mosaics when asked",
  "adds a mosaic by URL when asked",
  "says the list is busy while it loads",
  "keeps its own styles to layout",
  "draws each mosaic on the card background",
  "draws a failure with the destructive border",
  "makes Open the primary action",
];

/** The cases of the mosaic viewer's test file (default_mods/mosaic_viewer/test/test.ts), in order. */
const MOSAIC_VIEWER_CASES = [
  "shows the mosaic of its target",
  "shows permission statuses as badges",
  "gives its permission table explicit table roles",
  "shows the mosaic's mod",
  "shows the mosaic's collection",
  "says when the mosaic has no collection",
  "shows a collection that cannot be inspected as an alert",
  "says no mosaic was given without a target",
  "says no mosaic was given for an empty target",
  "shows why a missing target cannot be inspected",
  "shows the format error of its target",
  "opens the mod viewer from the mod's title",
  "opens the collection viewer from the collection's title",
  "opens the mosaic",
  "downloads a mosaic that is not stored",
  "shows nothing for a cancelled download",
  "names downloaded files after their address",
  "shows a refused check and enables it again",
  "shows where a stored mosaic comes from",
  "shows where a remote mosaic comes from",
  "shows no provenance for a mosaic the user did not add",
  "removes a stored mosaic",
  "exports a stored mosaic",
  "updates a stored mosaic from a file",
  "says a stored mosaic has unexported changes",
  "exports the folder of a stored mosaic",
  "shows the history of a stored mosaic",
  "offers no folder export for a single file",
  "edits a copy of the viewed mosaic",
  "starts a copy from its link",
  "refuses to edit a mosaic not stored in this browser",
  "says a mode it cannot use",
  "starts a new mosaic from a combination",
  "titles a new mosaic without a collection after its mod",
  "keeps a new mosaic untitled when a title cannot be read",
  "shows the hints of a draft",
  "adds an alias from a suggestion",
  "shows broken YAML and disables the form",
  "ignores a stale validation answer",
  "restores a kept draft",
  "asks before cancelling changes",
  "leaves edit mode without changes",
  "saves a copy",
  "keeps edit mode when nothing is saved",
  "makes opening the mosaic the primary action",
  "draws the mosaic on the card background",
  "draws a failure with the destructive border",
  "keeps its own styles to layout",
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
  "shows its place in the collection it was opened with",
  "ignores a stale from for its opening collection",
  "replaces itself with the next tile of its opening collection",
  "opens a linked tile of from with from",
  "opens a linked tile outside from without from",
  "opens a linked tile without from when it has none",
  "opens a linked tile of its opening collection with it as from",
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

    test("Mosaic explorer passes its check", async function checksMosaicExplorer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "mosaic_explorer");

      await expectEveryCasePassed(report, MOSAIC_EXPLORER_CASES);
    });

    test("Mosaic viewer passes its check", async function checksMosaicViewer({
      page,
    }): Promise<void> {
      const report = await checkDefaultMod(page, "mosaic_viewer");

      await expectEveryCasePassed(report, MOSAIC_VIEWER_CASES);
    });

    test("Cases without the samples", async function checksWithoutSamples({
      page,
    }): Promise<void> {
      // Checks every default mod in turn, each running all its cases.
      test.slow();
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
      const mosaicExplorerReport = await checkDefaultMod(
        page,
        "mosaic_explorer",
      );
      await expectEveryCasePassed(mosaicExplorerReport, MOSAIC_EXPLORER_CASES);
      const mosaicViewerReport = await checkDefaultMod(page, "mosaic_viewer");
      await expectEveryCasePassed(mosaicViewerReport, MOSAIC_VIEWER_CASES);
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
          await explorer.evaluate(readTokenAs, ["--tes-card", "color"]),
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
        new URL(
          "./samples/tiles/literature_nobel_laureates/collection.yaml",
          page.url(),
        ).href,
      );
      await expect(alert).toContainText("404");
      const explorer = await findModFrame(page, "Tiles");
      await expect(alert).toHaveCSS(
        "border-top-color",
        await explorer.evaluate(readTokenAs, [
          "--tes-destructive",
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
      await expect(viewer.locator("tes-tile-body")).toContainText(
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
        .locator("tes-tile-body")
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

/** The name of the collection the stage bar switch test serves in place of the laureates' books. */
const ROUTED_BOOKS_NAME = "Routed books";

/** Serves, at the laureates' books collection, a collection of the tile viewer's three fixture tiles, by address. */
async function serveRoutedBooks(route: Route): Promise<void> {
  const origin = new URL(route.request().url()).origin;
  const body = [
    "collection:",
    `  title: "${ROUTED_BOOKS_NAME}"`,
    "  tiles:",
    `    - url: "${origin}${TILE_FIXTURES_PATH}tiles/reading_list.md"`,
    `    - url: "${origin}${TILE_FIXTURES_PATH}tiles/kallocain.md"`,
    `    - url: "${origin}${TILE_FIXTURES_PATH}tiles/fahrenheit_451.md"`,
  ].join("\n");
  await route.fulfill({ status: 200, body });
}

const LAUREATES_BOOKS_COLLECTION_GLOB =
  "**/samples/tiles/literature_nobel_laureates_books/collection.yaml";

/** Opens the stage bar's collection list, from its capsule named `name`, and chooses the entry that says `text`. */
async function chooseStageCollection(
  page: Page,
  name: string,
  text: string,
): Promise<void> {
  await stageBar(page).getByRole("button", { name }).click();
  const list = page.locator("[data-slot=popover-content]");
  await list.getByRole("option").filter({ hasText: text }).click();
  await expect(list).toHaveCount(0);
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

    test("Another collection chosen in the stage bar", async function switchesCollection({
      page,
    }): Promise<void> {
      await page.route(LAUREATES_COLLECTION_GLOB, serveRoutedTiles);
      await page.route(LAUREATES_BOOKS_COLLECTION_GLOB, serveRoutedBooks);
      await page.goto("/");
      await openSection(page, "Tiles");
      await collectionExplorerFrame(page)
        .getByRole("button", { name: `View ${ROUTED_TILES_NAME}` })
        .click();
      await collectionViewerFrame(page)
        .getByRole("button", { name: "fahrenheit_451.md" })
        .click();
      await expect(
        tileViewerFrame(page).getByRole("navigation", { name: "Collection" }),
      ).toContainText("2 of 2");

      await chooseStageCollection(
        page,
        "Collection: fahrenheit_451.md",
        ROUTED_BOOKS_NAME,
      );

      const viewer = tileViewerFrame(page);
      await expect(viewer.getByRole("heading", { level: 1 })).toHaveText(
        "reading_list.md",
      );
      const nav = viewer.getByRole("navigation", { name: "Collection" });
      await expect(
        nav.getByRole("button", { name: ROUTED_BOOKS_NAME }),
      ).toBeVisible();
      await expect(nav).toContainText("1 of 3");
      await expect(
        nav.getByRole("button", { name: "Previous" }),
      ).toBeDisabled();
      await expect(nav.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    test("Opened from its default mosaic", async function showsDefaultMosaicPlace({
      page,
    }): Promise<void> {
      await page.goto("/#/run?mosaic=./default_mods/tile_viewer/mosaic.yaml");

      const nav = tileViewerFrame(page).getByRole("navigation", {
        name: "Collection",
      });
      await expect(
        nav.getByRole("button", { name: "Viewer tiles" }),
      ).toBeVisible();
      await expect(nav).toContainText("1 of 3");
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

const MOSAIC_EXPLORER_RUN_LINK = "/#/run?mod=mosaic_explorer";

/** The sample mosaics of the vanilla mosaic explorer's config, in order. */
const BOOKS_MOSAIC_REFERENCE = "./samples/mosaics/nobel_books_list.yaml";
const BOOKS_MOSAIC_TITLE = "Books by Nobel laureates";
const MAP_MOSAIC_TITLE = "Nobel laureates on the map";
const FLASHCARDS_MOSAIC_TITLE =
  "Flashcards: Nobel Prize in Literature laureates";

/** The default mosaics of the vanilla catalog's mods, in mod order: Book List, Flashcards, Country Map. */
const DEFAULT_MOSAIC_TITLES = [
  "Science fiction books",
  "Markdown flashcards",
  "UNESCO World Heritage Sites Example",
];

const CATALOG_SWITCH_LABEL = "List the default mosaics of mods";

/** Opens Settings and turns "List the default mosaics of mods" to `isOn`, as a user clicks it. */
async function switchDefaultMosaics(page: Page, isOn: boolean): Promise<void> {
  await openSection(page, "Settings");
  const catalogSwitch = page.getByRole("switch", {
    name: CATALOG_SWITCH_LABEL,
  });
  await catalogSwitch.click();
  await expect(catalogSwitch).toHaveAttribute("aria-checked", String(isOn));
}

/** The card headings of the mosaic explorer, once it listed its mosaics. */
async function readMosaicTitles(page: Page): Promise<string[]> {
  await waitForMosaicList(page);
  const titles = await mosaicExplorerCards(page)
    .getByRole("heading")
    .allTextContents();
  return titles;
}

/** What a test serves at the first mosaic of the vanilla catalog, so it needs no samples. The mosaic is only inspected. */
const ROUTED_MOSAIC_TEXT = `mosaic:
  title: "Routed mosaic"
  description: "A mosaic the e2e tests serve."
  mod: "./routed_mod"
`;

async function serveRoutedMosaic(route: Route): Promise<void> {
  await route.fulfill({ status: 200, body: ROUTED_MOSAIC_TEXT });
}

function mosaicExplorerFrame(page: Page): FrameLocator {
  return visibleSandbox(page).frameLocator('iframe[title="Mosaics"]');
}

function mosaicExplorerCards(page: Page): Locator {
  return mosaicExplorerFrame(page).locator("li > article");
}

function mosaicViewerFrame(page: Page): FrameLocator {
  return visibleSandbox(page).frameLocator('iframe[title="Mosaic Viewer"]');
}

/** Waits until the mosaic explorer listed its mosaics. */
async function waitForMosaicList(page: Page): Promise<void> {
  const list = mosaicExplorerFrame(page).getByRole("region", {
    name: "Mosaics",
  });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  await expect(list).not.toHaveAttribute("aria-busy");
}

function recordBundleRequest(bundleUrls: string[], request: Request): void {
  const path = new URL(request.url()).pathname;
  const isOwnFile = path.startsWith("/default_mods/mosaic_explorer/");
  const isBundleFile =
    path.endsWith("mod_conf.yaml") ||
    path.endsWith("collection.yaml") ||
    path.endsWith(".md");
  if (isBundleFile && !isOwnFile) {
    bundleUrls.push(request.url());
  }
}

/** The mod files, collection files and tile files the page requests from now on, but the mosaic explorer's own. */
function recordBundleRequests(page: Page): string[] {
  const bundleUrls: string[] = [];
  page.on("request", recordBundleRequest.bind(undefined, bundleUrls));
  return bundleUrls;
}

test.describe(
  "Mosaic explorer",
  { tag: "@frames" },
  function describeMosaicExplorer(): void {
    test(
      "Vanilla explorer lists the sample mosaics",
      { tag: "@sample" },
      async function listsSampleMosaics({ page }): Promise<void> {
        const bundleUrls = recordBundleRequests(page);
        await page.goto(MOSAIC_EXPLORER_RUN_LINK);
        const cards = mosaicExplorerCards(page);

        await expect(cards.getByRole("heading")).toHaveText([
          BOOKS_MOSAIC_TITLE,
          MAP_MOSAIC_TITLE,
          FLASHCARDS_MOSAIC_TITLE,
        ]);
        await expect(cards.nth(0)).toContainText(
          "The book list with the books of the Nobel Prize in Literature laureates, eight per row.",
        );
        await expect(cards.nth(1)).toContainText(
          "The Nobel Prize in Literature laureates on the country map, by their country of birth.",
        );
        await waitForMosaicList(page);
        expect(bundleUrls).toEqual([]);
      },
    );

    test(
      "Only the sample mosaics",
      { tag: "@sample" },
      async function listsOnlySampleMosaics({ page }): Promise<void> {
        await page.goto(MOSAIC_EXPLORER_RUN_LINK);
        await waitForMosaicList(page);

        const titles = await mosaicExplorerCards(page)
          .getByRole("heading")
          .allTextContents();
        expect(titles).toEqual([
          BOOKS_MOSAIC_TITLE,
          MAP_MOSAIC_TITLE,
          FLASHCARDS_MOSAIC_TITLE,
        ]);
        for (const defaultMosaicTitle of DEFAULT_MOSAIC_TITLES) {
          expect(titles).not.toContain(defaultMosaicTitle);
        }
      },
    );

    test(
      "Vanilla default mosaics",
      { tag: "@sample" },
      async function listsDefaultMosaics({ page }): Promise<void> {
        await page.goto("/#/settings");
        await switchDefaultMosaics(page, true);
        await openSection(page, "Mosaics");

        await expect(mosaicExplorerCards(page).getByRole("heading")).toHaveText(
          [
            BOOKS_MOSAIC_TITLE,
            MAP_MOSAIC_TITLE,
            FLASHCARDS_MOSAIC_TITLE,
            ...DEFAULT_MOSAIC_TITLES,
          ],
        );
        const cards = mosaicExplorerCards(page);
        await expect(cards.nth(3).locator("small")).toHaveText(
          "Default mosaic of Book List",
        );
        await expect(cards.nth(0).locator("small")).toHaveCount(0);
        await expect(cards.nth(1).locator("small")).toHaveCount(0);
        await expect(cards.nth(2).locator("small")).toHaveCount(0);
      },
    );

    test(
      "Switch turned on behind the explorer",
      { tag: "@sample" },
      async function followsSwitch({ page }): Promise<void> {
        await page.goto("/");
        await openSection(page, "Mosaics");
        expect(await readMosaicTitles(page)).toEqual([
          BOOKS_MOSAIC_TITLE,
          MAP_MOSAIC_TITLE,
          FLASHCARDS_MOSAIC_TITLE,
        ]);
        const explorer = await findModFrame(page, "Mosaics");
        await markFrame(explorer);

        await switchDefaultMosaics(page, true);
        await openSection(page, "Mosaics");

        await expect(mosaicExplorerCards(page).getByRole("heading")).toHaveText(
          [
            BOOKS_MOSAIC_TITLE,
            MAP_MOSAIC_TITLE,
            FLASHCARDS_MOSAIC_TITLE,
            ...DEFAULT_MOSAIC_TITLES,
          ],
        );
        expect(await isFrameMarked(explorer)).toBe(true);

        await switchDefaultMosaics(page, false);
        await openSection(page, "Mosaics");

        await expect(mosaicExplorerCards(page).getByRole("heading")).toHaveText(
          [BOOKS_MOSAIC_TITLE, MAP_MOSAIC_TITLE, FLASHCARDS_MOSAIC_TITLE],
        );
        expect(await isFrameMarked(explorer)).toBe(true);
      },
    );

    test("Explorer requests no mod, collection or tile", async function requestsNoBundleFile({
      page,
    }): Promise<void> {
      const bundleUrls = recordBundleRequests(page);

      await page.goto(MOSAIC_EXPLORER_RUN_LINK);
      await waitForMosaicList(page);

      expect(bundleUrls).toEqual([]);
    });

    test("Mosaic that cannot be inspected", async function drawsMosaicFailure({
      page,
    }): Promise<void> {
      await page.route(`**${BOOKS_MOSAIC_REFERENCE.slice(1)}`, answerNotFound);
      await page.goto(MOSAIC_EXPLORER_RUN_LINK);
      const alert = mosaicExplorerFrame(page).getByRole("alert").first();

      await expect(alert).toContainText(
        new URL(BOOKS_MOSAIC_REFERENCE, page.url()).href,
      );
      await expect(alert).toContainText("404");
    });

    test("Open a mosaic", async function opensMosaic({ page }): Promise<void> {
      await serveMosaicExplorerOfLabels(page);
      await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
      await openSection(page, "Mosaics");

      await mosaicExplorerFrame(page)
        .getByRole("button", { name: `Open ${LABELS_MOSAIC_TITLE}` })
        .click();

      const tilesMod = visibleSandbox(page).frameLocator(
        `iframe[title="${TILES_TITLE}"]`,
      );
      await expect(tilesMod.getByRole("listitem")).toHaveText(["First label"]);
      expect(readRunLinkParam(page, "mosaic")).toBe(
        new URL(LABELS_MOSAIC_PATH, page.url()).href,
      );
      expect(readRunLinkParam(page, "mod")).toBeNull();
      await expect(currentItem(page)).toHaveText("Mosaics");
      await expect(page.locator('iframe[title="Mosaics"]')).toBeHidden();
    });

    test("View a mosaic", async function viewsMosaic({ page }): Promise<void> {
      await serveMosaicExplorerOfLabels(page);
      await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
      await openSection(page, "Mosaics");

      await mosaicExplorerFrame(page)
        .getByRole("button", { name: `View ${LABELS_MOSAIC_TITLE}` })
        .click();

      await expect(stageBar(page)).toContainText("Mosaic Viewer");
      await expect(
        mosaicViewerFrame(page).getByRole("heading", {
          level: 1,
          name: LABELS_MOSAIC_TITLE,
        }),
      ).toBeVisible();
      const source = new URL(LABELS_MOSAIC_PATH, page.url()).href;
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=mosaic_viewer&target=${encodeURIComponent(source)}`,
      );
      await expect(currentItem(page)).toHaveText("Mosaics");
    });

    test("Mosaic viewer switched off", async function showsSwitchedOffMosaicViewer({
      page,
    }): Promise<void> {
      await page.route(
        `**${BOOKS_MOSAIC_REFERENCE.slice(1)}`,
        serveRoutedMosaic,
      );
      await page.goto(`${EXPLORER_OFF_PREVIEW_URL}${MOSAIC_EXPLORER_RUN_LINK}`);
      const explorer = mosaicExplorerFrame(page);

      await explorer
        .getByRole("button", { name: "View Routed mosaic" })
        .click();

      await expect(explorer.getByRole("status")).toContainText("mosaic_viewer");
      await expect(stageBar(page)).toContainText("Mosaics");
      await expect(page.locator('iframe[title="Mosaic Viewer"]')).toHaveCount(
        0,
      );
    });
  },
);

const MAP_MOSAIC_REFERENCE = "./samples/mosaics/nobel_laureates_map.yaml";

function buildMosaicViewerLink(target: string): string {
  const link = `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(target)}`;
  return link;
}

/** A section of the mosaic viewer, by its heading. */
function mosaicViewerSection(page: Page, name: string): Locator {
  return mosaicViewerFrame(page).getByRole("region", { name });
}

/** Opens the mosaic viewer on `target` and waits until its mod and collection are shown. */
async function openMosaicViewer(page: Page, target: string): Promise<void> {
  await page.goto(buildMosaicViewerLink(target));
  await expect(mosaicViewerSection(page, "Mod")).not.toHaveAttribute(
    "aria-busy",
  );
  await expect(mosaicViewerSection(page, "Collection")).not.toHaveAttribute(
    "aria-busy",
  );
}

/** `/test-mods/mosaics/unknown_alias.yaml`: the labels mosaic with an alias for a field the item type does not declare. */
const UNKNOWN_ALIAS_MOSAIC_FILE = "mosaics/unknown_alias.yaml";

function buildUnknownAliasMosaicFiles(): ModFiles {
  const files: ModFiles = {
    [UNKNOWN_ALIAS_MOSAIC_FILE]: [
      "mosaic:",
      '  title: "Unknown alias"',
      '  mod: "../tiles/"',
      '  collection: "./labels"',
      "  aliases:",
      '    title: ["label"]',
      '    colour: ["tint"]',
    ].join("\n"),
  };
  return files;
}

test.describe(
  "Mosaic viewer",
  { tag: "@frames" },
  function describeMosaicViewer(): void {
    test(
      "View the laureates' map",
      { tag: "@sample" },
      async function viewsLaureatesMap({ page }): Promise<void> {
        const tileUrls = recordTileRequests(page);

        await openMosaicViewer(page, MAP_MOSAIC_REFERENCE);

        const viewer = mosaicViewerFrame(page);
        const card = viewer.getByRole("article");
        await expect(card.getByRole("heading", { level: 1 })).toHaveText(
          MAP_MOSAIC_TITLE,
        );
        await expect(card).toContainText(
          "The Nobel Prize in Literature laureates on the country map, by their country of birth.",
        );
        await expect(card).toContainText(
          new URL(MAP_MOSAIC_REFERENCE, page.url()).href,
        );
        await expect(
          mosaicViewerSection(page, "Aliases").getByRole("listitem"),
        ).toHaveText(["title ← name", "country ← birth_country"]);
        const permission = mosaicViewerSection(page, "Permissions")
          .getByRole("row")
          .filter({ hasText: "https://upload.wikimedia.org" });
        await expect(permission).toContainText(
          "Shows the laureates' portraits",
        );
        await expect(permission).toContainText("granted");
        await expect(permission).not.toContainText("not granted");
        expect(tileUrls).toEqual([]);
      },
    );

    test(
      "Mod and collection of the laureates' map",
      { tag: "@sample" },
      async function showsLaureatesBundle({ page }): Promise<void> {
        await openMosaicViewer(page, MAP_MOSAIC_REFERENCE);

        const modSection = mosaicViewerSection(page, "Mod");
        await expect(
          modSection.getByRole("button", { name: "Country Map" }),
        ).toBeVisible();
        await expect(modSection).toContainText("1.0.1");
        await expect(modSection).toContainText("^0.2.0");
        await expect(modSection).toContainText("matches");
        await expect(modSection).not.toContainText("does not match");
        const collectionSection = mosaicViewerSection(page, "Collection");
        await expect(
          collectionSection.getByRole("button", { name: LAUREATES_TITLE }),
        ).toBeVisible();
        await expect(collectionSection).toContainText("17 tiles");
      },
    );

    test(
      "View the books mosaic",
      { tag: "@sample" },
      async function viewsBooksMosaic({ page }): Promise<void> {
        await openMosaicViewer(page, BOOKS_MOSAIC_REFERENCE);

        await expect(mosaicViewerSection(page, "Config")).toContainText(
          "columns: 8",
        );
        await expect(mosaicViewerSection(page, "Aliases")).toContainText(
          "(none)",
        );
      },
    );

    test("Missing collection", async function showsMissingCollection({
      page,
    }): Promise<void> {
      await openMosaicViewer(
        page,
        "./default_mods/mosaic_viewer/fixtures/missing_collection.yaml",
      );

      const viewer = mosaicViewerFrame(page);
      await expect(
        viewer.getByRole("heading", { level: 1, name: "Missing collection" }),
      ).toBeVisible();
      await expect(mosaicViewerSection(page, "Mod")).toContainText(
        "Fixture Mod",
      );
      const alert = mosaicViewerSection(page, "Collection").getByRole("alert");
      await expect(alert).toContainText(
        "/default_mods/mosaic_viewer/fixtures/no_such_collection.yaml",
      );
      await expect(alert).toContainText("404");
    });

    test("No target", async function saysNoMosaicGiven({
      page,
    }): Promise<void> {
      await page.goto("/#/run?mod=mosaic_viewer");

      const viewer = mosaicViewerFrame(page);
      await expect(viewer.getByRole("status")).toHaveText(
        "No mosaic was given.",
      );
      await expect(viewer.getByRole("button")).toHaveCount(0);
    });

    test("Mosaic with a format error", async function showsFormatError({
      page,
    }): Promise<void> {
      await page.goto(
        buildMosaicViewerLink(
          "./default_mods/mosaic_viewer/fixtures/untitled_mosaic.yaml",
        ),
      );

      await expect(mosaicViewerFrame(page).getByRole("alert")).toContainText(
        '"title" must be a non-empty string',
      );
    });

    test("Open the mosaic", async function opensLabelsMosaic({
      page,
    }): Promise<void> {
      await serveTilesMod(page, buildLabelsMosaicFiles());
      await openMosaicViewer(page, LABELS_MOSAIC_REFERENCE);

      await mosaicViewerFrame(page)
        .getByRole("button", { name: "Open mosaic" })
        .click();

      // The labelled tiles reach the tiles mod renamed by the mosaic's aliases.
      const tilesMod = visibleSandbox(page).frameLocator(
        `iframe[title="${TILES_TITLE}"]`,
      );
      await expect(tilesMod.getByRole("listitem")).toHaveText(["First label"]);
      expect(readRunLinkParam(page, "mosaic")).toBe(
        new URL(LABELS_MOSAIC_PATH, page.url()).href,
      );
      await expect(page.locator('iframe[title="Mosaic Viewer"]')).toBeHidden();
      await expect(
        page.locator('iframe[title="Mosaic Viewer"]'),
      ).toBeAttached();
    });

    test("Open the mod viewer", async function opensModViewerFromTitle({
      page,
    }): Promise<void> {
      await serveTilesMod(page, buildLabelsMosaicFiles());
      await openMosaicViewer(page, LABELS_MOSAIC_REFERENCE);

      await mosaicViewerSection(page, "Mod")
        .getByRole("button", { name: TILES_TITLE })
        .click();

      await expect(stageBar(page)).toContainText("Mod Viewer");
      await expect(
        visibleSandbox(page)
          .frameLocator('iframe[title="Mod Viewer"]')
          .getByRole("heading", { level: 1, name: TILES_TITLE }),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=mod_viewer&target=${encodeURIComponent(readTilesModSource(page))}`,
      );
    });

    test("Open the collection viewer", async function opensCollectionViewerFromTitle({
      page,
    }): Promise<void> {
      await serveTilesMod(page, buildLabelsMosaicFiles());
      await openMosaicViewer(page, LABELS_MOSAIC_REFERENCE);

      await mosaicViewerSection(page, "Collection")
        .getByRole("button", { name: "Labelled tiles" })
        .click();

      await expect(stageBar(page)).toContainText("Collection Viewer");
      await expect(
        collectionViewerFrame(page).getByRole("heading", {
          name: "Labelled tiles",
        }),
      ).toBeVisible();
      const collectionSource = new URL(
        `${APP_ORIGIN_MOD_PATH}${LABELS_COLLECTION_FILE}`,
        page.url(),
      ).href;
      expect(new URL(page.url()).hash).toBe(
        `#/run?mod=collection_viewer&target=${encodeURIComponent(collectionSource)}`,
      );
    });

    test("Check with a mosaic finding", async function showsMosaicFinding({
      page,
    }): Promise<void> {
      await serveTilesMod(page, {
        ...buildLabelsMosaicFiles(),
        ...buildUnknownAliasMosaicFiles(),
      });
      await openMosaicViewer(
        page,
        `.${APP_ORIGIN_MOD_PATH}${UNKNOWN_ALIAS_MOSAIC_FILE}`,
      );
      const viewer = mosaicViewerFrame(page);
      const checkButton = viewer.getByRole("button", { name: "Check mosaic" });

      await checkButton.click();

      const report = checkReport(viewer);
      await expect(report.getByRole("heading")).toHaveText(
        "Check passed with warnings warn",
        { timeout: DEFAULT_MOD_CHECK_TIMEOUT },
      );
      const finding = report
        .getByRole("list", { name: "Findings" })
        .getByRole("listitem");
      await expect(finding).toHaveCount(1);
      await expect(finding).toContainText("warning bundle:");
      await expect(finding).toContainText('"colour"');
      await expect(report.getByRole("list", { name: "Tests" })).toHaveCount(0);
      await expect(checkButton).toBeEnabled();
    });
  },
);

/** The mosaic viewer's fixture mosaic that declares a permission, which every built app serves. */
const SHOWN_MOSAIC_REFERENCE =
  "./default_mods/mosaic_viewer/fixtures/shown_mosaic.yaml";

/** The collection viewer's fixture collection with laureate-like file names, which every built app serves. */
const SHOWN_COLLECTION_REFERENCE =
  "./default_mods/collection_viewer/fixtures/shown_collection.yaml";

/** The column headings of the permission tables. */
const PERMISSION_COLUMNS = ["Category", "Host", "Reason", "Status"];

/** The rows of a table that hold cells, without its header row. */
function listValueRows(frame: FrameLocator, table: Locator): Locator {
  return table.getByRole("row").filter({ has: frame.getByRole("cell") });
}

/** Expects every cell of `rows` inside the frame's width. */
async function expectCellsInsideFrame(
  rows: Locator,
  frameWidth: number,
): Promise<void> {
  const cells = rows.getByRole("cell");
  await expect(cells.first()).toBeVisible();
  for (const cell of await cells.all()) {
    const box = await cell.evaluate(readElementBox);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(frameWidth);
  }
}

/** Expects the boxes to sit side by side, in order, on one line. */
function expectSideBySide(boxes: ElementBox[]): void {
  for (let index = 1; index < boxes.length; index++) {
    expect(boxes[index].top).toBeCloseTo(boxes[0].top, 0);
    expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
  }
}

async function readCellBoxes(row: Locator): Promise<ElementBox[]> {
  const boxes: ElementBox[] = [];
  for (const cell of await row.getByRole("cell").all()) {
    boxes.push(await cell.evaluate(readElementBox));
  }
  return boxes;
}

test.describe("Viewer tables stack in a narrow frame", function describeNarrowTables(): void {
  test("Collection viewer on a phone", async function stacksTileRows({
    page,
  }): Promise<void> {
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(buildCollectionViewerLink(SHOWN_COLLECTION_REFERENCE));
    const viewer = collectionViewerFrame(page);

    const row = viewer
      .getByRole("row")
      .filter({ hasText: "2021__abdulrazak_gurnah.md" });
    const label = row.getByRole("cell").nth(0);
    const address = row.getByRole("cell").nth(1);
    await expect(label).toBeVisible();

    expect(await label.getByRole("button").evaluate(countLines)).toBe(1);
    const labelBox = await label.evaluate(readElementBox);
    const addressBox = await address.evaluate(readElementBox);
    expect(addressBox.top).toBeGreaterThanOrEqual(labelBox.bottom - 1);
    const frame = await findModFrame(page, "Collection Viewer");
    expect(await frame.evaluate(canFrameScrollSideways)).toBe(false);
  });

  test("Mosaic viewer permissions on a small phone", async function stacksMosaicPermissions({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openMosaicViewer(page, SHOWN_MOSAIC_REFERENCE);
    const viewer = mosaicViewerFrame(page);
    const frame = await findModFrame(page, "Mosaic Viewer");

    const table = mosaicViewerSection(page, "Permissions").getByRole("table");

    await expectCellsInsideFrame(
      listValueRows(viewer, table),
      await frame.evaluate(readDocumentWidth),
    );
    expect(await frame.evaluate(canFrameScrollSideways)).toBe(false);
  });

  test("Mod viewer permissions on a phone", async function stacksModPermissions({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openViewerForTilesMod(page);
    const frame = await findModFrame(page, "Mod Viewer");

    const badge = coverPermissionRow(frame).getByText("granted", {
      exact: true,
    });

    const box = await badge.evaluate(readElementBox);
    expect(box.right).toBeLessThanOrEqual(
      await frame.evaluate(readDocumentWidth),
    );
  });

  test("Wide frame keeps the columns", async function keepsColumns({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openMosaicViewer(page, SHOWN_MOSAIC_REFERENCE);
    const viewer = mosaicViewerFrame(page);

    const table = mosaicViewerSection(page, "Permissions").getByRole("table");

    const headers = table.getByRole("columnheader");
    await expect(headers).toHaveText(PERMISSION_COLUMNS);
    const headerBoxes: ElementBox[] = [];
    for (const header of await headers.all()) {
      headerBoxes.push(await header.evaluate(readElementBox));
    }
    expectSideBySide(headerBoxes);
    expectSideBySide(await readCellBoxes(listValueRows(viewer, table).first()));
  });

  test("Cells keep their column headings", async function keepsTableRoles({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openMosaicViewer(page, SHOWN_MOSAIC_REFERENCE);
    const viewer = mosaicViewerFrame(page);

    const table = mosaicViewerSection(page, "Permissions").getByRole("table");

    await expect(table).toHaveCount(1);
    await expect(table.getByRole("columnheader")).toHaveText(
      PERMISSION_COLUMNS,
    );
    const rows = listValueRows(viewer, table);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole("cell")).toHaveCount(4);
  });
});

/** Where the separator test serves a mosaic of the tiles mod with two permissions. */
const TWO_PERMISSIONS_MOSAIC_FILE = "mosaics/two_permissions.yaml";

/** A mosaic of the tiles mod that declares two `show` permissions, so its table has a row that is not the last. */
function buildTwoPermissionsMosaicFiles(): ModFiles {
  const files: ModFiles = {
    [TWO_PERMISSIONS_MOSAIC_FILE]: [
      "mosaic:",
      '  title: "Two permissions"',
      '  mod: "../tiles/"',
      '  collection: "../tiles/item_collection.yaml"',
      "  permissions:",
      "    show:",
      '      - host: "https://upload.wikimedia.org"',
      '        reason: "Shows the item images"',
      '      - host: "https://covers.openlibrary.org"',
      '        reason: "Shows the item covers"',
    ].join("\n"),
  };
  return files;
}

/** Expects each row of the table body to have one line under it but the last, and none between its values. */
function expectOneSeparatorPerRow(rows: RowSeparators[]): void {
  const bodyRows: RowSeparators[] = [];
  for (const row of rows) {
    if (!row.isHeader) {
      bodyRows.push(row);
    }
  }
  expect(bodyRows.length).toBeGreaterThan(1);
  for (const [index, row] of bodyRows.entries()) {
    expect(row.linesBetweenCells).toBe(0);
    expect(row.hasLineUnder).toBe(index < bodyRows.length - 1);
  }
}

test.describe("Stacked rows keep one separator each", function describeStackedSeparators(): void {
  test("Permission rows on a small phone", async function separatesPermissions({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await serveTilesMod(page, buildTwoPermissionsMosaicFiles());
    await openMosaicViewer(
      page,
      `.${APP_ORIGIN_MOD_PATH}${TWO_PERMISSIONS_MOSAIC_FILE}`,
    );
    await expect(
      mosaicViewerSection(page, "Permissions").getByRole("row"),
    ).toHaveCount(3);
    const frame = await findModFrame(page, "Mosaic Viewer");

    expectOneSeparatorPerRow(await frame.evaluate(readRowSeparators));
  });

  test("Tile rows on a phone", async function separatesTiles({
    page,
  }): Promise<void> {
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(buildCollectionViewerLink(SHOWN_COLLECTION_REFERENCE));
    await expect(
      collectionViewerFrame(page).getByRole("row").first(),
    ).toBeAttached();
    const frame = await findModFrame(page, "Collection Viewer");

    expectOneSeparatorPerRow(await frame.evaluate(readRowSeparators));
  });
});

/** The title of the collection the place test serves: as long as the laureates' collection's. */
const LONG_TITLE = "Nobel Prize in Literature laureates";

/** Where the place test serves its collection, on the app's origin. */
const LONG_TITLE_COLLECTION_PATH = `${APP_ORIGIN_MOD_PATH}long_title/collection.yaml`;

/** How many tiles the place test's collection lists, and where in it the shown tile is. */
const LONG_TITLE_TILE_COUNT = 17;
const LONG_TITLE_TILE_POSITION = 7;

/**
 * Serves a collection titled `LONG_TITLE` of 17 tiles, by address, whose
 * seventh is the tile viewer's fixture `tiles/kallocain.md`. The tile viewer
 * only inspects it, so the other tiles are never requested.
 */
async function serveLongTitleCollection(route: Route): Promise<void> {
  const origin = new URL(route.request().url()).origin;
  const lines = ["collection:", `  title: "${LONG_TITLE}"`, "  tiles:"];
  for (let position = 1; position <= LONG_TITLE_TILE_COUNT; position++) {
    const address =
      position === LONG_TITLE_TILE_POSITION
        ? `${origin}${TILE_FIXTURES_PATH}tiles/kallocain.md`
        : `${origin}${APP_ORIGIN_MOD_PATH}long_title/tile_${position}.md`;
    lines.push(`    - url: "${address}"`);
  }
  await route.fulfill({ status: 200, body: lines.join("\n") });
}

test.describe("Tile viewer keeps its position on one line", function describePlaceOnPhones(): void {
  test("Title on a wide frame", async function fitsTitleToText({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFixtureTile(page, "tiles/kallocain.md");
    const place = tileViewerFrame(page).getByRole("navigation", {
      name: "Collection",
    });
    await expect(place).toContainText("1 of 3");

    const title = place.getByRole("button").first();
    const next = place.getByRole("button", { name: "Next" });

    expect(await title.evaluate(readExtraWidth)).toBeLessThanOrEqual(1);
    const placeBox = await place.evaluate(readElementBox);
    expect((await title.evaluate(readElementBox)).left).toBeCloseTo(
      placeBox.left,
      0,
    );
    expect((await next.evaluate(readElementBox)).right).toBeCloseTo(
      placeBox.right,
      0,
    );
  });

  test("Position on a phone", async function keepsPositionOnOneLine({
    page,
  }): Promise<void> {
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.route(
      `**${LONG_TITLE_COLLECTION_PATH}`,
      serveLongTitleCollection,
    );
    await page.goto("/");
    const tile = readTileFixtureUrl(page, "tiles/kallocain.md");
    const from = new URL(LONG_TITLE_COLLECTION_PATH, page.url()).href;
    await followLink(page, buildTileViewerLink(tile, from));
    const place = tileViewerFrame(page).getByRole("navigation", {
      name: "Collection",
    });

    const position = place.getByText(
      `${LONG_TITLE_TILE_POSITION} of ${LONG_TITLE_TILE_COUNT}`,
      { exact: true },
    );
    await expect(position).toBeVisible();

    expect(await position.evaluate(countLines)).toBe(1);
    const title = place.getByRole("button", { name: LONG_TITLE });
    await expect(title).toHaveText(LONG_TITLE);
    expect(await title.evaluate(isFullyShown)).toBe(true);
  });
});

/** A mosaic of the sample book list, on the app's origin, so opening and inspecting it asks nothing. */
function writeBookListMosaic(page: Page, title: string): string {
  const modAddress = new URL("/samples/mods/book_list/", page.url()).href;
  const text = ["mosaic:", `  title: "${title}"`, `  mod: "${modAddress}"`, ""];
  return text.join("\n");
}

/** A stored mosaic of the sample book list, seeded under `path` of `my-mosaics`. */
function buildStoredBookListSeed(
  page: Page,
  title: string,
  path: string,
): UserCatalogSeed {
  const entry = buildStoredSeedEntry(path);
  const seed: UserCatalogSeed = {
    entries: [entry],
    files: { [entry.address]: writeBookListMosaic(page, title) },
  };
  return seed;
}

function mosaicCard(page: Page, title: string): Locator {
  return mosaicExplorerCards(page).filter({
    has: page.getByRole("heading", { name: title }),
  });
}

interface BadgeContrast {
  text: string;
  variant: string | null;
  contrast: number;
}

/** Runs in the explorer's frame: each place badge's text color and the fill behind it. */
function readPlaceBadgeColors(): {
  text: string;
  variant: string | null;
  color: string;
  fill: string;
}[] {
  const badges: {
    text: string;
    variant: string | null;
    color: string;
    fill: string;
  }[] = [];
  for (const badge of document.querySelectorAll("article header > h2 + span")) {
    const card = badge.closest("article") as Element;
    const badgeFill = getComputedStyle(badge).backgroundColor;
    const isTransparent = badgeFill === "rgba(0, 0, 0, 0)";
    badges.push({
      text: badge.textContent ?? "",
      variant: badge.getAttribute("data-tes-variant"),
      color: getComputedStyle(badge).color,
      fill: isTransparent ? getComputedStyle(card).backgroundColor : badgeFill,
    });
  }
  return badges;
}

async function readPlaceBadgeContrasts(page: Page): Promise<BadgeContrast[]> {
  const frame = await findModFrame(page, "Mosaics");
  const contrasts: BadgeContrast[] = [];
  for (const badge of await frame.evaluate(readPlaceBadgeColors)) {
    contrasts.push({
      text: badge.text,
      variant: badge.variant,
      contrast: readContrastRatio(badge.color, badge.fill),
    });
  }
  return contrasts;
}

async function readLowestPlaceBadgeContrast(page: Page): Promise<number> {
  let lowest = Number.POSITIVE_INFINITY;
  for (const badge of await readPlaceBadgeContrasts(page)) {
    lowest = Math.min(lowest, badge.contrast);
  }
  return lowest;
}

test.describe("Mosaic explorer and viewer of user mosaics", function describeUserMosaics(): void {
  test("Import from the explorer", async function importsFromExplorer({
    page,
  }): Promise<void> {
    await page.goto("/#/");
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);
    const explorer = await findModFrame(page, "Mosaics");
    await markFrame(explorer);

    await mosaicExplorerFrame(page)
      .getByRole("button", { name: "Import…" })
      .click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Mosaic files").setInputFiles({
      name: "nobel_map.yaml",
      mimeType: "application/yaml",
      buffer: Buffer.from(writeBookListMosaic(page, "Imported books")),
    });
    await expect(dialog.getByText("New")).toBeVisible();
    await dialog.getByRole("button", { name: "Import" }).click();

    const card = mosaicCard(page, "Imported books");
    await expect(card.getByText("Browser", { exact: true })).toBeVisible();
    await expect(card.getByText("Added by you")).toBeVisible();
    expect(await isFrameMarked(explorer)).toBe(true);
  });

  test("Removed from the viewer", async function removesInViewer({
    page,
  }): Promise<void> {
    await page.goto("/#/");
    const seed = buildStoredBookListSeed(
      page,
      "Stored books",
      "maps/stored_books.yaml",
    );
    await seedUserCatalog(page, seed);
    const address = seed.entries[0].address;

    await page.goto(
      `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(address)}`,
    );

    const viewer = mosaicViewerFrame(page);
    const section = viewer.getByRole("region", { name: "Where it comes from" });
    await expect(section).toContainText("maps/stored_books.yaml");
    await expect(section).toContainText("kept only in this browser");
    await section.getByRole("button", { name: "Remove" }).click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toContainText(
      'Remove "Stored books" from your catalog?',
    );
    await dialog.getByRole("button", { name: "Remove" }).click();
    await expect(viewer.getByRole("status")).toHaveText(
      "The mosaic was removed from your catalog.",
    );
    await expect(viewer.getByRole("button", { name: "Remove" })).toHaveCount(0);
    await expect(viewer.getByRole("button", { name: "Export" })).toHaveCount(0);
  });

  test("Badges, buttons and the section on a phone", async function laysOutOnPhone({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await page.goto("/#/");
    const seed = buildStoredBookListSeed(
      page,
      "A stored mosaic with a rather long title that wraps on a phone",
      "maps/a/rather/long/path/to/a/stored_mosaic_with_a_long_name.yaml",
    );
    await seedUserCatalog(page, seed);

    await openSection(page, "Mosaics");
    await waitForMosaicList(page);
    const explorer = await findModFrame(page, "Mosaics");
    expect(await explorer.evaluate(canFrameScrollSideways)).toBe(false);
    for (const name of ["Import…", "Add by URL…"]) {
      const box = await mosaicExplorerFrame(page)
        .getByRole("button", { name })
        .boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(32);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        SMALL_PHONE_VIEWPORT.width,
      );
    }
    await page.goto(
      `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(seed.entries[0].address)}`,
    );
    const viewer = await findModFrame(page, "Mosaic Viewer");
    await expect(
      mosaicViewerFrame(page).getByRole("region", {
        name: "Where it comes from",
      }),
    ).toBeVisible();
    expect(await viewer.evaluate(canFrameScrollSideways)).toBe(false);
  });

  test("Place badges in both schemes", async function checksBadgeColors({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/#/");
    await seedUserCatalog(
      page,
      buildStoredBookListSeed(page, "Stored books", "stored_books.yaml"),
    );
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);

    const badges = await readPlaceBadgeContrasts(page);
    expect(badges).toContainEqual(
      expect.objectContaining({ text: "Browser", variant: "secondary" }),
    );
    expect(badges).toContainEqual(
      expect.objectContaining({ text: "Remote", variant: "outline" }),
    );
    await expect
      .poll(readLowestPlaceBadgeContrast.bind(undefined, page))
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect
      .poll(readLowestPlaceBadgeContrast.bind(undefined, page))
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });
});

/** Opens the mosaic viewer in edit mode for a copy of the sample map, and waits for its form. */
async function openMapCopy(page: Page): Promise<FrameLocator> {
  await page.goto(
    `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(MAP_MOSAIC_REFERENCE)}&mode=copy`,
  );
  const viewer = mosaicViewerFrame(page);
  await expect(viewer.getByRole("heading", { level: 1 })).toHaveText(
    `Copy of "${MAP_MOSAIC_TITLE}"`,
  );
  await expect(viewer.locator('input[name="alias-country"]')).toBeVisible();
  return viewer;
}

/** Runs in the explorer's frame: the "Unexported changes" badges' text color and the fill behind them. */
function readChangedBadgeColors(): { color: string; fill: string }[] {
  const badges: { color: string; fill: string }[] = [];
  for (const badge of document.querySelectorAll(
    "article header > small + span",
  )) {
    const card = badge.closest("article") as Element;
    const badgeFill = getComputedStyle(badge).backgroundColor;
    badges.push({
      color: getComputedStyle(badge).color,
      fill:
        badgeFill === "rgba(0, 0, 0, 0)"
          ? getComputedStyle(card).backgroundColor
          : badgeFill,
    });
  }
  return badges;
}

async function readChangedBadgeContrast(page: Page): Promise<number> {
  const frame = await findModFrame(page, "Mosaics");
  let lowest = Number.POSITIVE_INFINITY;
  for (const badge of await frame.evaluate(readChangedBadgeColors)) {
    lowest = Math.min(lowest, readContrastRatio(badge.color, badge.fill));
  }
  return lowest;
}

test.describe("Editing mosaics in the viewer", function describeEditing(): void {
  test("Edit a copy of a sample", async function savesEditedCopy({
    page,
  }): Promise<void> {
    const viewer = await openMapCopy(page);
    const aliasRow = viewer.locator('input[name="alias-country"]');

    await aliasRow.fill("birth_country, country_of_birth");
    await aliasRow.blur();
    await expect(viewer.locator('textarea[name="content"]')).toHaveValue(
      /country: \["birth_country", "country_of_birth"\]/,
    );
    await viewer.getByRole("button", { name: "Save", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await expect(
      dialog.getByRole("heading", { name: "Save mosaic" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(
      mosaicViewerFrame(page).getByRole("region", {
        name: "Where it comes from",
      }),
    ).toContainText("Unexported changes");
    await expect(
      mosaicViewerFrame(page).getByRole("button", {
        name: "Download",
        exact: true,
      }),
    ).toHaveCount(0);
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);
    const copy = mosaicExplorerCards(page).filter({
      hasText: "Unexported changes",
    });
    await expect(copy.getByRole("heading")).toHaveText(MAP_MOSAIC_TITLE);
    await expect(copy.getByText("Added by you")).toBeVisible();
    await expect(copy.getByText("Browser", { exact: true })).toBeVisible();
    await expect(copy.getByRole("button", { name: /^Download / })).toHaveCount(
      0,
    );

    // Export from the list: the app's confirmation, the download, and no badge after it.
    await copy
      .getByRole("button", { name: `Export ${MAP_MOSAIC_TITLE}` })
      .click();
    const exportDialog = page.locator("dialog[open]");
    const downloading = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Save" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.yaml$/);
    const exported = mosaicCard(page, MAP_MOSAIC_TITLE).filter({
      hasText: "Added by you",
    });
    await expect(exported).not.toContainText("Unexported changes");
  });

  test("Form on a phone", async function laysOutFormOnPhone({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const viewer = await openMapCopy(page);
    await viewer.getByRole("button", { name: "Add a site" }).click();

    const frame = await findModFrame(page, "Mosaic Viewer");
    expect(await frame.evaluate(canFrameScrollSideways)).toBe(false);
    const titleLabel = viewer.locator("label", {
      has: viewer.locator('input[name="title"]'),
    });
    const labelText = await titleLabel.locator("span").boundingBox();
    const titleInput = await viewer
      .locator('input[name="title"]')
      .boundingBox();
    expect((labelText?.y ?? 0) + (labelText?.height ?? 0)).toBeLessThanOrEqual(
      titleInput?.y ?? 0,
    );
    expect((titleInput?.x ?? 0) + (titleInput?.width ?? 0)).toBeLessThanOrEqual(
      SMALL_PHONE_VIEWPORT.width,
    );
    for (const name of ["Save", "Cancel", "Form", "YAML"]) {
      const box = await viewer
        .getByRole(name === "Form" || name === "YAML" ? "tab" : "button", {
          name,
          exact: true,
        })
        .boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(32);
    }
    await viewer.getByRole("tab", { name: "YAML" }).click();
    const textarea = await viewer
      .locator('textarea[name="content"]')
      .boundingBox();
    expect((textarea?.x ?? 0) + (textarea?.width ?? 0)).toBeLessThanOrEqual(
      SMALL_PHONE_VIEWPORT.width,
    );
    expect(await frame.evaluate(canFrameScrollSideways)).toBe(false);
  });

  test("Saved mosaic in both schemes", async function checksChangedBadge({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/#/");
    const seed = buildStoredBookListSeed(
      page,
      "Edited books",
      "edited_books.yaml",
    );
    seed.entries[0].provenance.changedSinceExport = true;
    await seedUserCatalog(page, seed);
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);

    const card = mosaicCard(page, "Edited books");
    const badge = card.getByText("Unexported changes");
    await expect(badge).toHaveAttribute("data-tes-variant", "warning");
    await expect
      .poll(readChangedBadgeContrast.bind(undefined, page))
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect
      .poll(readChangedBadgeContrast.bind(undefined, page))
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });
});

/** Expects each of the card's buttons inside it, and at least 32px tall. */
async function expectButtonsInsideCard(card: Locator): Promise<void> {
  const cardBox = await card.evaluate(readElementBox);
  for (const button of await card.getByRole("button").all()) {
    const box = await button.evaluate(readElementBox);
    expect(box.height).toBeGreaterThanOrEqual(32);
    expect(box.left).toBeGreaterThanOrEqual(cardBox.left);
    expect(box.right).toBeLessThanOrEqual(cardBox.right);
  }
}

/** The text the app serves at the sample map's address. */
async function readServedMapText(page: Page): Promise<string> {
  const response = await page.request.get(
    new URL(MAP_MOSAIC_REFERENCE, page.url()).href,
  );
  return response.text();
}

/** Presses Save in the app's save confirmation, and reads the downloaded file. */
async function saveDownload(
  page: Page,
): Promise<{ name: string; text: string }> {
  const downloading = page.waitForEvent("download");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Save" })
    .click();
  const download = await downloading;
  const saved = {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf8"),
  };
  return saved;
}

test.describe("Exporting and downloading mosaics", function describeExplorerExport(): void {
  test("Download a sample from the explorer", async function downloadsFromCard({
    page,
  }): Promise<void> {
    await page.goto("/#/");
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);
    const card = mosaicCard(page, MAP_MOSAIC_TITLE);
    await expect(card.getByRole("button")).toHaveText([
      "Open",
      "View",
      "Download",
    ]);

    await card
      .getByRole("button", { name: `Download ${MAP_MOSAIC_TITLE}` })
      .click();

    const saved = await saveDownload(page);
    expect(saved.name).toBe("nobel_laureates_map.yaml");
    expect(saved.text).toBe(await readServedMapText(page));
  });

  test("Download from the viewer", async function downloadsFromViewer({
    page,
  }): Promise<void> {
    await page.goto(
      `/#/run?mod=mosaic_viewer&target=${encodeURIComponent(MAP_MOSAIC_REFERENCE)}`,
    );
    const viewer = mosaicViewerFrame(page);

    await viewer.getByRole("button", { name: "Download", exact: true }).click();

    const saved = await saveDownload(page);
    expect(saved.name).toBe("nobel_laureates_map.yaml");
    expect(saved.text).toBe(await readServedMapText(page));
  });

  test("Card buttons on a phone", async function laysOutCardButtons({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await page.goto("/#/");
    await seedUserCatalog(
      page,
      buildStoredBookListSeed(page, "Edited books", "edited_books.yaml"),
    );
    await openSection(page, "Mosaics");
    await waitForMosaicList(page);

    const stored = mosaicCard(page, "Edited books");
    const sample = mosaicCard(page, MAP_MOSAIC_TITLE);
    await expect(stored.getByRole("button")).toHaveText([
      "Open",
      "View",
      "Export",
    ]);
    await expect(sample.getByRole("button")).toHaveText([
      "Open",
      "View",
      "Download",
    ]);
    await expectButtonsInsideCard(stored);
    await expectButtonsInsideCard(sample);
    expect(
      await mosaicExplorerFrame(page)
        .locator("body")
        .evaluate(canFrameScrollSideways),
    ).toBe(false);
  });
});
