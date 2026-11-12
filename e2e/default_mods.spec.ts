import { expect, test } from "@playwright/test";
import type { FrameLocator, Locator, Page, Route } from "@playwright/test";
import type { ModFiles } from "./mod_routes.ts";
import {
  buildMissingEntrypointFiles,
  buildSlowMountFiles,
  buildTestedProbeFiles,
  coverPermissionRow,
  expectModInfo,
  expectNoIssues,
  FAILING_CASE_TEST_CODE,
  findModFrame,
  readParentDocumentError,
  recordHost,
  routeCovers,
  SAMPLE_CASE_NAMES,
  serveAppOriginMod,
  stageBar,
  visibleSandbox,
} from "./mod_routes.ts";
import {
  readSampleModSource,
  SAMPLE_BOOKS_FOLDER_PATH,
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_MOD_REFERENCE,
} from "./sample_mod.ts";
import { listOwnLookDeclarations } from "./theme_probes.ts";
import { openModsSection, pageBody } from "./app_layout.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

async function openViewerForSample(page: Page): Promise<void> {
  await page.goto(`/#/run?mod=mod_viewer&target=${SAMPLE_MOD_REFERENCE}`);
  await expect(
    coverPermissionRow(page.frameLocator('iframe[title="Mod Viewer"]')),
  ).toBeVisible();
}

test.describe("Default mods folder", function describeFolder(): void {
  test("Explorer from the default folder", async function opensExplorer({
    page,
  }): Promise<void> {
    await page.goto("/");
    await openModsSection(page);

    const explorerSource = new URL(
      "/default_mods/mod_explorer/mod_conf.yaml",
      page.url(),
    ).href;
    await expectNoIssues(page);
    await expectModInfo(page, explorerSource);
  });
});

test.describe("Default mod settings", function describeSettings(): void {
  test("Vanilla settings", async function opensViewer({ page }): Promise<void> {
    await page.goto("/");
    await openModsSection(page);
    const explorer = await findModFrame(page, "Mods");

    await explorer.getByRole("button", { name: /Book List/ }).click();

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
});

test.describe("Default mods are ordinary mods", function describeOrdinary(): void {
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
});

test.describe("Mod explorer", function describeExplorer(): void {
  test("Select a mod", async function selectsMod({ page }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = page.frameLocator('iframe[title="Mods"]');

    await explorer.getByRole("button", { name: /Book List/ }).click();

    await expect(stageBar(page)).toContainText("Mod Viewer");
    await expect(
      page.frameLocator('iframe[title="Mod Viewer"]').getByRole("heading", {
        name: "Book List",
      }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe(
      `#/run?mod=mod_viewer&target=${encodeURIComponent(readSampleModSource(page))}`,
    );
  });

  test("Vanilla explorer lists the samples", async function listsSamples({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = page.frameLocator('iframe[title="Mods"]');
    const cards = explorer.getByRole("article");

    await expect(cards.getByRole("heading")).toHaveText([
      "Book List",
      "Flashcards",
    ]);
    await expect(cards.nth(0)).toContainText(
      "A grid of book covers, with a card for each book that shows its details and text.",
    );
    await expect(cards.nth(1)).toContainText(
      "Explore any collection as a table, and study it as question and answer cards.",
    );
  });
});

/** `two_books.yaml`: a collection of two sample books, served under `/test-mods/`. */
function buildTwoBooksFiles(): ModFiles {
  const files = {
    "two_books.yaml": [
      "collection:",
      '  name: "Two books"',
      "  tiles:",
      `    - path: "..${SAMPLE_BOOKS_FOLDER_PATH}/kallocain.md"`,
      `    - path: "..${SAMPLE_BOOKS_FOLDER_PATH}/fictions.md"`,
    ].join("\n"),
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

/** Expects the sample book list mod to list the two books of `two_books.yaml`. */
async function expectTwoBooks(page: Page): Promise<void> {
  const sample = page.frameLocator('iframe[title="Book List"]');
  await expect(sample.getByRole("listitem")).toHaveCount(2);
  await expect(sample.getByText("The Library of Babel")).toBeVisible();
}

/** A parameter of the run link in the page's address, e.g. `collection`. */
function readRunLinkParam(page: Page, name: string): string | null {
  const hash = new URL(page.url()).hash;
  const query = hash.slice(hash.indexOf("?") + 1);
  const value = new URLSearchParams(query).get(name);
  return value;
}

test.describe("Mod viewer runs the mod", function describeViewerRuns(): void {
  test("Run with the sample tiles", async function runsWithSampleTiles({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await openViewerForSample(page);
    const viewerFrame = await findModFrame(page, "Mod Viewer");

    await viewerFrame
      .getByRole("button", { name: "Run with sample tiles" })
      .click();

    await expect(stageBar(page)).toContainText("Book List");
    const sample = page.frameLocator('iframe[title="Book List"]');
    await expect(sample.getByText("Kallocain")).toBeVisible();
    await expect(sample.getByRole("listitem")).toHaveCount(3);
    await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
    await expect(
      viewerFrame.getByRole("heading", {
        name: "Book List",
        includeHidden: true,
      }),
    ).toBeAttached();
  });

  test("Run with a typed collection", async function runsWithTypedCollection({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await serveAppOriginMod(page, buildTwoBooksFiles());
    await openViewerForSample(page);
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
    await routeCovers(page);
    await serveAppOriginMod(page, buildTwoBooksFiles());
    await openViewerForSample(page);
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
    await routeCovers(page);
    await serveAppOriginMod(page, buildTwoBooksFiles());
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    await runWithTypedCollection(viewer, "test-mods/two_books.yaml");

    await expectTwoBooks(page);
  });

  test("Run without tiles", async function runsWithoutTiles({
    page,
  }): Promise<void> {
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    await viewer.getByRole("button", { name: "Run without tiles" }).click();

    await expect(stageBar(page)).toContainText("Book List");
    await expect(
      page
        .frameLocator('iframe[title="Book List"]')
        .getByText("There are no books to show."),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe(
      `#/run?mod=${encodeURIComponent(readSampleModSource(page))}`,
    );
  });
});

/** The viewer's "Check report" section. */
function checkReport(viewer: FrameLocator): Locator {
  return viewer.getByRole("region", { name: "Check report" });
}

test.describe("Mod viewer checks the mod", function describeViewerChecks(): void {
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
    await expect(viewer.getByRole("button", { name: "Check mod" })).toHaveCount(
      0,
    );
  });

  test("Check with a relative collection address", async function checksWithRelativeCollection({
    page,
  }): Promise<void> {
    // Every file under `/test-mods/` answers `404 Not Found`.
    await serveAppOriginMod(page, {});
    await openViewerForSample(page);
    const sampleCollectionUrls = await recordHost(page, SAMPLE_COLLECTION_GLOB);
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
  });
});

/** The text of each passed case in the viewer's report: its status badge, then its name. */
function listPassedCaseTexts(names: string[]): string[] {
  const texts: string[] = [];
  for (const name of names) {
    texts.push(`pass ${name}`);
  }
  return texts;
}

test.describe("Mod viewer shows the check report", function describeViewerReport(): void {
  test("Sample mod passes", async function showsPassingReport({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    await viewer.getByRole("button", { name: "Check mod" }).click();

    const report = checkReport(viewer);
    await expect(report.getByRole("heading")).toContainText("Check passed");
    await expect(
      report.getByRole("heading").locator("span[data-ot-variant]"),
    ).toHaveAttribute("data-ot-variant", "success");
    await expect(report.getByText("No findings.")).toBeVisible();
    await expect(report.getByRole("list", { name: "Findings" })).toHaveCount(0);
    const cases = report
      .getByRole("list", { name: "Tests" })
      .getByRole("listitem");
    await expect(cases).toHaveText(listPassedCaseTexts(SAMPLE_CASE_NAMES));
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
});

// The default mods' look is tested by their own cases (default_mods/README.md).
test.describe("The sample mod shows how to get the app's look", function describeExamples(): void {
  test("Own styles are layout only", async function checksOwnStyles({
    page,
  }): Promise<void> {
    await openViewerForSample(page);
    const viewer = await findModFrame(page, "Mod Viewer");
    await routeCovers(page);
    await viewer.getByRole("button", { name: "Run with sample tiles" }).click();
    const bookList = await findModFrame(page, "Book List");
    await expect(
      bookList.getByRole("button", { name: /Kallocain/ }),
    ).toBeVisible();

    expect(await bookList.evaluate(listOwnLookDeclarations)).toEqual([]);
  });
});

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
  "runs with the sample tiles",
  "runs with the typed collection, sent as typed",
  "runs nothing with an empty collection field",
  "runs without tiles",
  "offers no sample run without a sample collection",
  "shows permission statuses as badges",
  "makes running with the sample tiles the primary action",
  "keeps its own styles to layout",
];

/** Answers like a site that ships no `samples/`. */
async function answerNotFound(route: Route): Promise<void> {
  await route.fulfill({ status: 404, body: "Not Found" });
}

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
  await expect(report.getByRole("heading")).toBeVisible();
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

test.describe("Default mods ship their tests", function describeShippedTests(): void {
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

  test("Cases without the samples", async function checksWithoutSamples({
    page,
  }): Promise<void> {
    await page.route("**/samples/**", answerNotFound);

    const viewerReport = await checkDefaultMod(page, "mod_viewer");
    await expectEveryCasePassed(viewerReport, VIEWER_CASES);
    const explorerReport = await checkDefaultMod(page, "mod_explorer");
    await expectEveryCasePassed(explorerReport, EXPLORER_CASES);
  });
});
