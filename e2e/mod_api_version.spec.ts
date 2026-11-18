import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
  APP_MOD_API_VERSION,
  buildModConf,
  buildProbeFiles,
  expectMessageCount,
  expectNoIssues,
  EXPLORER_CODE,
  findModFrame,
  followLink,
  OTHER_API_RANGE,
  PROBE_MOD_CODE,
  readMessages,
  readProbeContext,
  serveAppOriginMod,
  stageBar,
  TEST_MOD_API_RANGE,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  buildNoteTile,
  buildTilesModFiles,
  NOTE_TYPE,
  openTilesMod,
  TILES_TITLE,
} from "./test_mods.ts";
import { TEST_CATALOG_PREVIEW_URL } from "./app_servers.ts";

/** A probe mod titled "Later API", written for `OTHER_API_RANGE`. */
const LATER_API_HASH = "#/run?mod=./test-mods/later/";
const LATER_API_TITLE = "Later API";

function buildLaterApiFiles(): ModFiles {
  return buildProbeFiles(
    "later",
    [`  title: "${LATER_API_TITLE}"`],
    OTHER_API_RANGE,
  );
}

/** A probe mod of the typed probe's `note` type that declares no `api` range. */
function buildBareNoteFiles(): ModFiles {
  const files: ModFiles = {
    "bare_notes/mod_conf.yaml": buildModConf(
      "bare_notes",
      ['  type_path: "./note_type.md"'],
      null,
    ),
    "bare_notes/main.js": PROBE_MOD_CODE,
    "bare_notes/note_type.md": NOTE_TYPE,
  };
  return files;
}

/** A collection with a note and a tile without `title`, which is not a note. */
function buildMixedCollectionFiles(): ModFiles {
  const files: ModFiles = {
    "mixed.yaml": [
      "collection:",
      '  title: "Mixed"',
      "  tiles:",
      '    - path: "./first.md"',
      '    - path: "./untitled.md"',
    ].join("\n"),
    "first.md": buildNoteTile("First note"),
    "untitled.md": '---\nauthor: "Anonymous"\n---\n',
  };
  return files;
}

/**
 * A copy of the explorer whose viewer is the later-API mod, so picking a mod
 * opens it. It lists the catalog, so it lists the tiles mod on the
 * `e2e-test-catalog` build.
 */
function buildLaterExplorerFiles(): ModFiles {
  const files: ModFiles = {
    "explorer/mod_conf.yaml": [
      "mod:",
      `  api: "${TEST_MOD_API_RANGE}"`,
      '  title: "Later explorer"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      "  config:",
      '    viewer: "./test-mods/later/"',
      "  permissions:",
      "    open:",
      '      - host: "*"',
      '        reason: "Opens the mods you pick"',
    ].join("\n"),
    "explorer/main.js": EXPLORER_CODE,
  };
  return files;
}

function apiMismatchDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: LATER_API_TITLE });
}

function readTestModSource(page: Page, folder: string): string {
  const source = new URL(`/test-mods/${folder}/mod_conf.yaml`, page.url()).href;
  return source;
}

/** Opens the later-API mod from its run link, and waits for the question. */
async function openLaterApiMod(page: Page): Promise<Locator> {
  await serveAppOriginMod(page, buildLaterApiFiles());
  await page.goto(`/${LATER_API_HASH}`);
  const dialog = apiMismatchDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Runs the later-API mod anyway, and waits for its probe to mount. */
async function runLaterApiModAnyway(page: Page): Promise<void> {
  await apiMismatchDialog(page)
    .getByRole("button", { name: "Run anyway" })
    .click();
  await waitForProbe(await findModFrame(page, LATER_API_TITLE));
}

async function expectCancelError(page: Page): Promise<void> {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(OTHER_API_RANGE);
  await expect(page.getByRole("alert")).toContainText(APP_MOD_API_VERSION);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(
    stageBar(page).getByRole("button", { name: "Close" }),
  ).toBeVisible();
  await expect(stageBar(page)).toContainText(LATER_API_TITLE);
  await expect(stageBar(page)).toContainText("0.1.0");
  await expectMessageCount(page, "Errors", 1);
  const errors = await readMessages(page, "Errors");
  expect(errors[0].producer).toBe("App");
  expect(errors[0].text).toContain(OTHER_API_RANGE);
  expect(errors[0].text).toContain(APP_MOD_API_VERSION);
}

test.describe("Matching mods start without asking", function describeMatching(): void {
  test("Sample mod", async function startsMatchingMod({ page }): Promise<void> {
    await openTilesMod(page);

    await expect(stageBar(page)).toContainText(TILES_TITLE);
    await expectNoIssues(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Default mods declare the API range", function describeDefaultMods(): void {
  test("Default mods match", async function startsDefaultMods({
    page,
  }): Promise<void> {
    await page.goto("/#/run?mod=mod_explorer");
    await expect(stageBar(page)).toContainText("Mods");
    await expectNoIssues(page);
    await followLink(page, "#/run?mod=mod_viewer");
    await expect(stageBar(page)).toContainText("Mod Viewer");

    await expectNoIssues(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Ask before starting a mod for another API", function describeAsk(): void {
  test("Run anyway", async function runsAnyway({ page }): Promise<void> {
    const dialog = await openLaterApiMod(page);

    await expect(dialog).toContainText(readTestModSource(page, "later"));
    await expect(dialog).toContainText("Version 0.1.0");
    await expect(dialog.getByRole("definition")).toHaveText([
      OTHER_API_RANGE,
      APP_MOD_API_VERSION,
    ]);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(visibleSandbox(page)).toContainText(
      "Waiting for your answer…",
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    await runLaterApiModAnyway(page);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const frame = await findModFrame(page, LATER_API_TITLE);
    const context = await frame.evaluate(readProbeContext);
    expect(context.api).toEqual({ version: APP_MOD_API_VERSION });
  });

  test("Asked at each launch", async function asksAgainAfterClose({
    page,
  }): Promise<void> {
    await openLaterApiMod(page);
    await runLaterApiModAnyway(page);

    await stageBar(page).getByRole("button", { name: "Close" }).click();
    await expect(
      page.locator(`iframe[title="${LATER_API_TITLE}"]`),
    ).toHaveCount(0);
    await followLink(page, LATER_API_HASH);

    await expect(apiMismatchDialog(page)).toBeVisible();
    await expect(
      page.locator(`iframe[title="${LATER_API_TITLE}"]`),
    ).toHaveCount(0);
  });

  test("Asked after a page reload", async function asksAgainAfterReload({
    page,
  }): Promise<void> {
    await openLaterApiMod(page);
    await runLaterApiModAnyway(page);

    await page.reload();

    await expect(apiMismatchDialog(page)).toBeVisible();
    await expect(
      page.locator(`iframe[title="${LATER_API_TITLE}"]`),
    ).toHaveCount(0);
  });
});

test.describe("Cancelled mods do not start", function describeCancel(): void {
  test("Escape", async function cancelsOnEscape({ page }): Promise<void> {
    await openLaterApiMod(page);

    await page.keyboard.press("Escape");

    await expectCancelError(page);
  });

  test("Back while asking", async function hidesOnBack({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      ...buildLaterApiFiles(),
      ...buildLaterExplorerFiles(),
      ...buildTilesModFiles(),
    });
    await page.goto(
      `${TEST_CATALOG_PREVIEW_URL}/#/run?mod=./test-mods/explorer/`,
    );
    const explorer = await findModFrame(page, "Later explorer");
    await explorer.getByRole("button", { name: /Tiles/ }).click();
    await expect(apiMismatchDialog(page)).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(stageBar(page)).toContainText("Later explorer");
    await expect(
      page.locator(`iframe[title="${LATER_API_TITLE}"]`),
    ).toHaveCount(0);
  });
});

test.describe("Show the mod issues", function describeIssues(): void {
  test("Missing range found first", async function listsMissingRangeLast({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      ...buildBareNoteFiles(),
      ...buildMixedCollectionFiles(),
    });

    await page.goto(
      "/#/run?mod=./test-mods/bare_notes/&collection=./test-mods/mixed.yaml",
    );

    await expectMessageCount(page, "Warnings", 2);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0].source).toContain("/test-mods/untitled.md");
    expect(warnings[1].source).toBe(readTestModSource(page, "bare_notes"));
    expect(warnings[1].text).toContain('"api"');
  });
});
