import { expect, test } from "@playwright/test";
import type { Page, Request } from "@playwright/test";
import {
  answerSiteConsent,
  buildProbeFiles,
  COVER_HOST,
  expectMessageCount,
  expectMessages,
  expectModInfo,
  expectNoIssues,
  findModFrame,
  findSandboxFrame,
  followLink,
  FOREIGN_HOST,
  isFrameMarked,
  LINKED_COVER_URL,
  LINKED_TILE_URL,
  markFrame,
  MEDIA_HOST,
  readMessages,
  routeImages,
  serveAppOriginMod,
  serveForeignMod,
  serveLinkedTiles,
  showImage,
  stageBar,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import {
  buildNoteCollection,
  buildNoteTile,
  buildTypedProbeFiles,
  MISSING_TEST_MOD_FILE_PATH,
  MISSING_TEST_MOD_REFERENCE,
  openProbe,
  openTypedProbe,
  PROBE_LINK,
  readTilesModSource,
  serveExplorerOfTilesMod,
  serveTilesMod,
  TILES_COLLECTION_RUN_HASH,
  TILES_ITEM_TITLES,
  TILES_RUN_HASH,
  TILES_TITLE,
  TILES_VERSION,
} from "./test_mods.ts";
import { openModsSection, openSection, pageBody } from "./app_layout.ts";

const VIEWER_LINK = "#/run?mod=mod_viewer";
const EXPLORER_LINK = "#/run?mod=mod_explorer";
/** `#/run?mod=./test-mods/probe/`: the probe's run link, as a hash to follow. */
const PROBE_HASH = PROBE_LINK.slice(1);

/** `./test-mods/tiles/items/second.md`: the second item of the tiles mod, as a run link names it. */
const SECOND_ITEM_REFERENCE = "./test-mods/tiles/items/second.md";

/** The tiles mod opened with its second item as the link's `tile`. */
const TILES_TILE_RUN_HASH = `${TILES_RUN_HASH}&tile=${SECOND_ITEM_REFERENCE}`;

/** `#/run?mod=./test-mods/other/`: the run link of a second probe, `other`. */
const OTHER_PROBE_HASH = "#/run?mod=./test-mods/other/";

function collectRequestedUrls(page: Page): string[] {
  const requestedUrls: string[] = [];
  page.on("request", recordRequestUrl.bind(undefined, requestedUrls));
  return requestedUrls;
}

function recordRequestUrl(requestedUrls: string[], request: Request): void {
  requestedUrls.push(request.url());
}

/** Serves the probe and a second probe, `other`, on the app's origin. */
async function serveTwoProbes(page: Page): Promise<void> {
  await serveAppOriginMod(page, {
    ...buildProbeFiles("probe"),
    ...buildProbeFiles("other"),
  });
}

function readVisibleId(page: Page): Promise<string | null> {
  return visibleSandbox(page).getAttribute("data-sandbox-id");
}

/** Stores a value in the frame's memory, so a test can tell that the frame kept its state. */
function rememberValue(): void {
  (globalThis as { remembered?: number }).remembered = 42;
}

function readRememberedValue(): number | undefined {
  return (globalThis as { remembered?: number }).remembered;
}

test.describe("Open a mod from a run link", function describeRunLinks(): void {
  test("Link with a mod and a collection", async function opensWithCollection({
    page,
  }): Promise<void> {
    await serveTilesMod(page);

    await page.goto(`/${TILES_COLLECTION_RUN_HASH}`);

    await expect(stageBar(page)).toContainText(TILES_TITLE);
    await expect(stageBar(page)).toContainText(TILES_VERSION);
    const frame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
    await expect(frame.getByRole("listitem")).toHaveText(TILES_ITEM_TITLES);
  });

  test("Link without a collection", async function opensWithoutCollection({
    page,
  }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);
    await serveTilesMod(page);

    await page.goto(`/${TILES_RUN_HASH}`);

    await expect(
      page
        .frameLocator(`iframe[title="${TILES_TITLE}"]`)
        .getByText("There are no tiles to show."),
    ).toBeVisible();
    for (const url of requestedUrls) {
      expect(url).not.toContain("item_collection.yaml");
    }
  });

  test("Encoded values", async function opensEncodedLink({
    page,
  }): Promise<void> {
    await serveTilesMod(page);
    await page.goto(`/${EXPLORER_LINK}`);
    const source = readTilesModSource(page);

    await followLink(page, `#/run?mod=${encodeURIComponent(source)}`);

    await expect(stageBar(page)).toContainText(TILES_TITLE);
    await expectModInfo(page, source);
  });
});

test.describe("Open a single tile", function describeSingleTile(): void {
  test("Link with a tile", async function opensWithTile({
    page,
  }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);
    await serveTilesMod(page);

    await page.goto(`/${TILES_TILE_RUN_HASH}`);

    const frame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
    await expect(frame.getByRole("listitem")).toHaveText(["Second item"]);
    for (const url of requestedUrls) {
      expect(url).not.toContain("item_collection.yaml");
    }
  });

  test("Media of the tile", async function loadsTileMedia({
    page,
  }): Promise<void> {
    await serveLinkedTiles(page, [`image: "${LINKED_COVER_URL}"`]);
    const seenUrls = await routeImages(page, `${MEDIA_HOST}/**`);
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto(
      `${PROBE_LINK}&tile=${encodeURIComponent(LINKED_TILE_URL)}`,
    );
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);

    expect(await frame.evaluate(showImage, LINKED_COVER_URL)).toBe(true);
    expect(seenUrls).toEqual([LINKED_COVER_URL]);
    await expectNoIssues(page);
  });

  test("Shared tile link after a reload", async function opensSharedTileLink({
    page,
    context,
  }): Promise<void> {
    await serveTilesMod(page);
    await page.goto(`/${TILES_TILE_RUN_HASH}`);
    const frame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
    await expect(frame.getByRole("listitem")).toHaveText(["Second item"]);
    const sharedLink = page.url();

    const newPage = await context.newPage();
    await serveTilesMod(newPage);
    await newPage.goto(sharedLink);

    const newFrame = newPage.frameLocator(`iframe[title="${TILES_TITLE}"]`);
    await expect(newFrame.getByRole("listitem")).toHaveText(["Second item"]);
  });
});

test.describe("A link has a collection or a tile", function describeConflict(): void {
  test("Both in a link", async function refusesBoth({ page }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);
    await serveTilesMod(page);

    await page.goto(
      `/${TILES_COLLECTION_RUN_HASH}&tile=${SECOND_ITEM_REFERENCE}`,
    );

    await expect(page.getByRole("alert")).toContainText(
      "A link cannot have both a collection and a tile.",
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    for (const url of requestedUrls) {
      expect(url).not.toContain("item_collection.yaml");
      expect(url).not.toContain("second.md");
    }
  });
});

test.describe(
  "Several sandboxes, at most one visible",
  { tag: "@frames" },
  function describeSandboxes(): void {
    test("Second link hides the first mod", async function hidesFirstMod({
      page,
    }): Promise<void> {
      const firstFrame = await openProbe(page);
      await markFrame(firstFrame);

      await followLink(page, EXPLORER_LINK);
      await expect(stageBar(page)).toContainText("Mods");

      await expect(page.locator("[data-sandbox-id] iframe")).toHaveCount(2);
      expect(await readVisibleId(page)).toBe("sandbox-2");
      await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
      expect(await isFrameMarked(firstFrame)).toBe(true);
    });
  },
);

test.describe(
  "Back and forward keep the sandbox state",
  { tag: "@frames" },
  function describeHistory(): void {
    test("Back to the previous mod", async function goesBack({
      page,
    }): Promise<void> {
      const firstFrame = await openProbe(page);
      await firstFrame.evaluate(rememberValue);
      await markFrame(firstFrame);
      await followLink(page, EXPLORER_LINK);
      await expect(stageBar(page)).toContainText("Mods");

      await page.goBack();

      await expect(stageBar(page)).toContainText("probe");
      expect(await readVisibleId(page)).toBe("sandbox-1");
      expect(await isFrameMarked(firstFrame)).toBe(true);
      expect(await firstFrame.evaluate(readRememberedValue)).toBe(42);
    });

    test("Forward again", async function goesForward({ page }): Promise<void> {
      await openProbe(page);
      await followLink(page, EXPLORER_LINK);
      const secondFrame = await findSandboxFrame(page, "sandbox-2");
      await markFrame(secondFrame);
      await page.goBack();
      await expect(stageBar(page)).toContainText("probe");

      await page.goForward();

      await expect(stageBar(page)).toContainText("Mods");
      expect(await readVisibleId(page)).toBe("sandbox-2");
      expect(await isFrameMarked(secondFrame)).toBe(true);
    });

    test("Back after a page reload", async function reopensAfterReload({
      page,
    }): Promise<void> {
      await openProbe(page);
      await followLink(page, EXPLORER_LINK);
      await expect(stageBar(page)).toContainText("Mods");

      await page.reload();
      await expect(stageBar(page)).toContainText("Mods");
      await page.goBack();

      await expect(stageBar(page)).toContainText("probe");
      expect(await readVisibleId(page)).toBe("sandbox-2");
      await expect(
        page.locator('[data-sandbox-id="sandbox-2"] iframe[title="probe"]'),
      ).toBeAttached();
    });
  },
);

test.describe("Opening after going back drops the forward entries", function describeForwardEntries(): void {
  test("New link after going back", async function dropsForwardSandbox({
    page,
  }): Promise<void> {
    await openProbe(page);
    await followLink(page, VIEWER_LINK);
    await expect(stageBar(page)).toContainText("Mod Viewer");
    await page.goBack();
    await expect(stageBar(page)).toContainText("probe");

    await followLink(page, EXPLORER_LINK);
    await expect(stageBar(page)).toContainText("Mods");

    await expect(page.locator('[data-sandbox-id="sandbox-2"]')).toHaveCount(0);
    await expect(page.locator('iframe[title="Mod Viewer"]')).toHaveCount(0);
    await expect(page.locator("[data-sandbox-id] iframe")).toHaveCount(2);
  });
});

test.describe("Close a sandbox", function describeClose(): void {
  test("Close the viewer", async function closesViewer({
    page,
  }): Promise<void> {
    await serveExplorerOfTilesMod(page);
    await page.goto(`/${EXPLORER_LINK}`);
    const explorer = await findModFrame(page, "Mods");
    await markFrame(explorer);
    await explorer.getByRole("button", { name: /Tiles/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");

    await stageBar(page).getByRole("button", { name: "Close" }).click();

    await expect(page.locator('iframe[title="Mod Viewer"]')).toHaveCount(0);
    await expect(stageBar(page)).toContainText("Mods");
    expect(await isFrameMarked(explorer)).toBe(true);
    expect(new URL(page.url()).hash).toBe(EXPLORER_LINK);
  });
});

test.describe("Pages in the history", function describePagesInHistory(): void {
  test("A page hides the mods", async function hidesModsForPage({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await markFrame(frame);

    await openSection(page, "Settings");

    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(page.locator('iframe[title="probe"]')).toBeHidden();
    await expect(page.locator('iframe[title="probe"]')).toHaveCount(1);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Back from a page to a mod", async function goesBackToMod({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await frame.evaluate(rememberValue);
    await openSection(page, "Settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();

    await page.goBack();

    await expect(page.locator('iframe[title="probe"]')).toBeVisible();
    expect(await frame.evaluate(readRememberedValue)).toBe(42);
  });

  test("Forward to a page", async function goesForwardToPage({
    page,
  }): Promise<void> {
    await openProbe(page);
    await openSection(page, "Settings");
    await page.goBack();
    await expect(page.locator('iframe[title="probe"]')).toBeVisible();

    await page.goForward();

    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
  });

  test("Reload on a page", async function reloadsOnPage({
    page,
  }): Promise<void> {
    await openProbe(page);
    await openSection(page, "About");
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "About" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "About" }),
    ).toBeVisible();
    await page.goBack();

    await expect(stageBar(page)).toContainText("probe");
  });

  test("New section after going back", async function dropsForwardSandbox({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/");
    await followLink(page, PROBE_HASH);
    await expect(stageBar(page)).toContainText("probe");
    await openSection(page, "Settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await page.goBack();
    await expect(stageBar(page)).toContainText("probe");
    await page.goBack();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();

    await openModsSection(page);

    await expect(page.locator('iframe[title="probe"]')).toHaveCount(0);
  });
});

test.describe("Show the mod issues", function describeIssues(): void {
  test("Foreign mod permission issue is listed", async function listsForeignIssue({
    page,
  }): Promise<void> {
    await serveForeignMod(
      page,
      buildProbeFiles("probe", [
        "  permissions:",
        "    show:",
        `      - host: "${COVER_HOST}"`,
        '        reason: "Shows the book covers"',
      ]),
    );

    await page.goto(
      `/#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`,
    );
    await answerSiteConsent(page, "Show without them");

    await expectMessageCount(page, "Warnings", 1);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0].producer).toBe("App");
    expect(warnings[0].source).toBe(`${FOREIGN_HOST}/probe/mod_conf.yaml`);
    expect(warnings[0].text).toContain(`show content from ${COVER_HOST}`);
  });

  test("Blocked request is listed while the mod runs", async function listsBlock({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await expectNoIssues(page);

    await frame.evaluate(showImage, "https://images.example.net/cover.jpg");

    await expectMessages(
      page,
      "Warnings",
      "https://images.example.net",
      "permissions.show",
    );
  });

  test("Issues stay with their sandbox", async function keepsIssues({
    page,
  }): Promise<void> {
    await serveTwoProbes(page);
    await page.goto(PROBE_LINK);
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await frame.evaluate(showImage, "https://images.example.net/cover.jpg");
    await expectMessages(page, "Warnings", "https://images.example.net");

    await followLink(page, OTHER_PROBE_HASH);
    await expect(stageBar(page)).toContainText("other");
    await expectNoIssues(page);
    await page.goBack();

    await expect(stageBar(page)).toContainText("probe");
    await expectMessages(page, "Warnings", "https://images.example.net");
  });
});

test.describe("Show load failures", function describeLoadFailures(): void {
  test("Load failure in the errors popover", async function listsLoadFailure({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {});
    await page.goto(`/#/run?mod=${MISSING_TEST_MOD_REFERENCE}`);
    const missingSource = new URL(MISSING_TEST_MOD_FILE_PATH, page.url()).href;
    await expectMessageCount(page, "Errors", 1);

    const errors = await readMessages(page, "Errors");

    expect(errors).toHaveLength(1);
    expect(errors[0].producer).toBe("App");
    expect(errors[0].source).toBe(missingSource);
    expect(errors[0].text).toContain("404");
  });

  test("Missing tile", async function showsMissingTile({
    page,
  }): Promise<void> {
    await serveTilesMod(page);
    await page.goto(
      `/${TILES_RUN_HASH}&tile=./test-mods/tiles/items/missing.md`,
    );
    const missingSource = new URL(
      "/test-mods/tiles/items/missing.md",
      page.url(),
    ).href;

    await expect(page.getByRole("alert")).toContainText(missingSource);
    await expect(page.getByRole("alert")).toContainText("404");
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});

interface ChangedTilesGlobal {
  probe: {
    engine: { on: (event: string, handler: (params: unknown) => void) => void };
  };
  changedTitles?: string[][];
}

interface ChangedTiles {
  tiles: { metadata: { title?: string } }[];
}

/** Runs in a probe frame: records the tile titles of each `tiles.changed` on `globalThis.changedTitles`. */
function recordChangedTiles(): void {
  const probeGlobal = globalThis as unknown as ChangedTilesGlobal;
  probeGlobal.changedTitles = [];
  function recordTitles(params: unknown): void {
    const titles: string[] = [];
    for (const tile of (params as ChangedTiles).tiles) {
      titles.push(String(tile.metadata.title));
    }
    probeGlobal.changedTitles?.push(titles);
  }
  probeGlobal.probe.engine.on("tiles.changed", recordTitles);
}

/** Runs in a probe frame: the tile titles `recordChangedTiles` recorded. */
function readChangedTitles(): string[][] {
  return (globalThis as unknown as ChangedTilesGlobal).changedTitles ?? [];
}

test.describe("Reload the tiles", function describeReloadTiles(): void {
  test("Reload after the collection changed", async function reloadsTiles({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection([]);
    const frame = await openTypedProbe(page, files);
    await markFrame(frame);
    await frame.evaluate(recordChangedTiles);
    files["collection.yaml"] = buildNoteCollection(["./second.md"]);

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expect
      .poll(frame.evaluate.bind(frame, readChangedTitles))
      .toEqual([["First note", "Second note"]]);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Reload a tile", async function reloadsTile({ page }): Promise<void> {
    const files = buildTypedProbeFiles();
    await serveAppOriginMod(page, files);
    await page.goto(`${PROBE_LINK}&tile=./test-mods/first.md`);
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await markFrame(frame);
    await frame.evaluate(recordChangedTiles);
    files["first.md"] = buildNoteTile("Changed note");

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expect
      .poll(frame.evaluate.bind(frame, readChangedTitles))
      .toEqual([["Changed note"]]);
    expect(await isFrameMarked(frame)).toBe(true);
  });
});
