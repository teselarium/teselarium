import { expect, test } from "@playwright/test";
import type { Frame, FrameLocator, Locator, Page } from "@playwright/test";
import type { ModFiles } from "./mod_routes.ts";
import {
  APP_MOD_API_VERSION,
  buildMissingEntrypointFiles,
  buildProbeFiles,
  buildSlowMountFiles,
  buildTestedProbeFiles,
  coverPermissionRow,
  EXPLORER_CODE,
  FAILING_CASE_TEST_CODE,
  findModFrame,
  OTHER_API_RANGE,
  readParentDocumentError,
  recordHost,
  routeCovers,
  serveAppOriginMod,
  stageBar,
  TEST_MOD_API_RANGE,
  visibleSandbox,
} from "./mod_routes.ts";
import {
  MISSING_MOD_REFERENCE,
  readSampleModSource,
  SAMPLE_BOOKS_FOLDER_PATH,
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_MOD_REFERENCE,
} from "./sample_mod.ts";
import { listOwnLookDeclarations, readTokenAs } from "./theme_probes.ts";
import { openModsSection, pageBody } from "./app_layout.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

/** The explorer with `MISSING_MOD_REFERENCE` in its `mods` list, served on the app's origin. */
async function openBrokenExplorer(page: Page): Promise<Frame> {
  await serveAppOriginMod(page, {
    "explorer/mod_conf.yaml": [
      "mod:",
      `  api: "${TEST_MOD_API_RANGE}"`,
      '  name: "mod_explorer"',
      '  title: "Broken explorer"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      "  config:",
      '    viewer: "mod_viewer"',
      "    mods:",
      `      - "${MISSING_MOD_REFERENCE}"`,
      "  permissions:",
      "    open:",
      '      - host: "*"',
      '        reason: "Opens the mods you pick"',
    ].join("\n"),
    "explorer/main.js": EXPLORER_CODE,
  });
  await page.goto("/#/run?mod=./test-mods/explorer/");
  return findModFrame(page, "Broken explorer");
}

function readBackgroundColor(element: Element): string {
  return getComputedStyle(element).backgroundColor;
}

/** The top border's color: Firefox gives no computed value for the shorthand. */
function readBorderColor(element: Element): string {
  return getComputedStyle(element).borderTopColor;
}

/** The value of a color token in the frame, as `getComputedStyle` gives a color. */
async function readTokenColor(frame: Frame, token: string): Promise<string> {
  return frame.evaluate(readTokenAs, [token, "color"]);
}

/** The description of the "API range" term in the viewer's metadata list. */
function apiRangeDefinition(viewer: FrameLocator): Locator {
  return viewer.locator('dt:text-is("API range") + dd');
}

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
    await expect(stageBar(page)).toContainText(explorerSource);
    await expect(stageBar(page)).toContainText("No issues.");
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
  test("Vanilla explorer lists the sample", async function listsSample({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = page.frameLocator('iframe[title="Mods"]');

    const card = explorer.getByRole("article").filter({
      has: explorer.getByRole("button", { name: /Book List/ }),
    });
    await expect(card).toContainText(
      "A very simple list of books with their covers.",
    );
  });

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

  test("Mod that cannot be inspected", async function listsFailure({
    page,
  }): Promise<void> {
    const explorer = await openBrokenExplorer(page);

    await expect(explorer.getByText(MISSING_MOD_REFERENCE)).toBeVisible();
    await expect(explorer.getByRole("alert")).toContainText("404");
  });
});

test.describe("Mod viewer", function describeViewer(): void {
  test("View the sample mod", async function viewsSample({
    page,
  }): Promise<void> {
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    await expect(
      viewer.getByRole("heading", { name: "Book List" }),
    ).toBeVisible();
    await expect(viewer.getByText("1.0.0")).toBeVisible();
    await expect(
      viewer.getByText("A very simple list of books with their covers."),
    ).toBeVisible();
    await expect(viewer.getByText("show_covers: true")).toBeVisible();
    const permission = coverPermissionRow(viewer);
    await expect(permission.getByRole("cell")).toHaveText([
      "show",
      "https://upload.wikimedia.org",
      "Shows the book covers",
      "granted",
    ]);
    const apiRange = apiRangeDefinition(viewer);
    await expect(apiRange).toContainText(TEST_MOD_API_RANGE);
    await expect(apiRange).toContainText("matches");
    await expect(apiRange).not.toContainText("does not match");
  });

  test("View a mod for another API", async function viewsOtherApiMod({
    page,
  }): Promise<void> {
    await serveAppOriginMod(
      page,
      buildProbeFiles("later", ['  title: "Later API"'], OTHER_API_RANGE),
    );

    await page.goto("/#/run?mod=mod_viewer&target=./test-mods/later/");

    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
    await expect(
      viewer.getByRole("heading", { name: "Later API" }),
    ).toBeVisible();
    const apiRange = apiRangeDefinition(viewer);
    await expect(apiRange).toContainText(OTHER_API_RANGE);
    await expect(apiRange).toContainText("does not match");
    await expect(apiRange).toContainText(
      `This app has mod API ${APP_MOD_API_VERSION}.`,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("View a mod without a range", async function viewsModWithoutRange({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("bare", [], null));

    await page.goto("/#/run?mod=mod_viewer&target=./test-mods/bare/");

    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
    await expect(apiRangeDefinition(viewer)).toHaveText(
      "The mod declares no API range.",
    );
  });

  test("No target", async function saysNoTarget({ page }): Promise<void> {
    await page.goto("/#/run?mod=mod_viewer");

    await expect(
      page
        .frameLocator('iframe[title="Mod Viewer"]')
        .getByText("No mod was given."),
    ).toBeVisible();
  });

  test("Missing target", async function showsTargetError({
    page,
  }): Promise<void> {
    await page.goto(`/#/run?mod=mod_viewer&target=${MISSING_MOD_REFERENCE}`);

    await expect(
      page.frameLocator('iframe[title="Mod Viewer"]').getByRole("alert"),
    ).toContainText("404");
  });
});

test.describe("Mod viewer reports a missing or failing target", function describeViewerTargetFailures(): void {
  test("Empty target", async function saysEmptyTarget({ page }): Promise<void> {
    await page.goto("/#/run?mod=mod_viewer&target=");

    await expect(
      page
        .frameLocator('iframe[title="Mod Viewer"]')
        .getByText("No mod was given."),
    ).toBeVisible();
  });

  test("Target with a format error", async function showsFormatError({
    page,
  }): Promise<void> {
    await serveAppOriginMod(
      page,
      buildProbeFiles("bad_theme", ['  theme: "dark"']),
    );

    await page.goto("/#/run?mod=mod_viewer&target=./test-mods/bad_theme/");

    const alert = page
      .frameLocator('iframe[title="Mod Viewer"]')
      .getByRole("alert");
    await expect(alert).toContainText('"theme" must be "default" or "none"');
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

  test("Mod without a sample collection", async function offersNoSampleRun({
    page,
  }): Promise<void> {
    await page.goto("/#/run?mod=mod_viewer&target=mod_explorer");
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');
    await expect(viewer.getByRole("heading", { name: "Mods" })).toBeVisible();

    await expect(
      viewer.getByRole("button", { name: "Run without tiles" }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: "Run with sample tiles" }),
    ).toHaveCount(0);
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
    await expect(cases).toHaveText([
      "pass lists the sample books",
      "pass highlights the remembered book",
    ]);
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

test.describe("Default mods show how to get the app's look", function describeExamples(): void {
  test("Own styles are layout only", async function checksOwnStyles({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = await findModFrame(page, "Mods");
    await expect(
      explorer.getByRole("button", { name: /Book List/ }),
    ).toBeVisible();
    await openViewerForSample(page);
    const viewer = await findModFrame(page, "Mod Viewer");
    await routeCovers(page);
    await viewer.getByRole("button", { name: "Run with sample tiles" }).click();
    const bookList = await findModFrame(page, "Book List");
    await expect(
      bookList.getByRole("button", { name: /Kallocain/ }),
    ).toBeVisible();

    expect(await explorer.evaluate(listOwnLookDeclarations)).toEqual([]);
    expect(await viewer.evaluate(listOwnLookDeclarations)).toEqual([]);
    expect(await bookList.evaluate(listOwnLookDeclarations)).toEqual([]);
  });

  test("Explorer lists mods as cards", async function listsCards({
    page,
  }): Promise<void> {
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = await findModFrame(page, "Mods");

    const card = explorer.getByRole("article").filter({ hasText: "Book List" });
    await expect(card.getByRole("button", { name: /Book List/ })).toBeVisible();
    expect(await card.evaluate(readBackgroundColor)).toBe(
      await readTokenColor(explorer, "--ot-card"),
    );
  });

  test("Viewer's main action is primary", async function drawsPrimaryAction({
    page,
  }): Promise<void> {
    await openViewerForSample(page);
    const viewer = await findModFrame(page, "Mod Viewer");

    const runWithSample = viewer.getByRole("button", {
      name: "Run with sample tiles",
    });
    const runWithout = viewer.getByRole("button", {
      name: "Run without tiles",
    });
    expect(await runWithSample.evaluate(readBackgroundColor)).toBe(
      await readTokenColor(viewer, "--ot-primary"),
    );
    expect(await runWithout.evaluate(readBackgroundColor)).toBe(
      await readTokenColor(viewer, "--ot-background"),
    );
  });

  test("Viewer shows permission statuses as badges", async function drawsBadges({
    page,
  }): Promise<void> {
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    const badge = coverPermissionRow(viewer).locator("span[data-ot-variant]");
    await expect(badge).toHaveText("granted");
    await expect(badge).toHaveAttribute("data-ot-variant", "success");
  });

  test("Explorer shows a failure as an alert", async function showsAlert({
    page,
  }): Promise<void> {
    const explorer = await openBrokenExplorer(page);

    const alert = explorer.getByRole("alert");
    await expect(alert).toContainText(MISSING_MOD_REFERENCE);
    await expect(alert).toContainText("404");
    expect(await alert.evaluate(readBorderColor)).toBe(
      await readTokenColor(explorer, "--ot-destructive"),
    );
  });
});
