import { expect, test } from "@playwright/test";
import type { Page, Request, Route } from "@playwright/test";
import {
  buildProbeFiles,
  COVER_HOST,
  findModFrame,
  findSandboxFrame,
  followLink,
  FOREIGN_HOST,
  isFrameMarked,
  issueList,
  markFrame,
  readLoadedCovers,
  routeCovers,
  serveAppOriginMod,
  serveForeignMod,
  showImage,
  stageBar,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import { openModsSection, openSection, pageBody } from "./app_layout.ts";
import { HOME_MOD_PREVIEW_URL } from "./app_servers.ts";

const SAMPLE_WITH_TILES =
  "#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml";
const SAMPLE_WITHOUT_TILES = "#/run?mod=./samples/mods/book_list";
const VIEWER_LINK = "#/run?mod=mod_viewer";
const EXPLORER_LINK = "#/run?mod=mod_explorer";
const SAMPLE_TITLES = ["Fahrenheit 451", "Kallocain", "The Library of Babel"];

function collectRequestedUrls(page: Page): string[] {
  const requestedUrls: string[] = [];
  page.on("request", recordRequestUrl.bind(undefined, requestedUrls));
  return requestedUrls;
}

function recordRequestUrl(requestedUrls: string[], request: Request): void {
  requestedUrls.push(request.url());
}

async function expectSampleBooks(page: Page, sandboxId: string): Promise<void> {
  const frame = page.frameLocator(`[data-sandbox-id="${sandboxId}"] iframe`);
  for (const title of SAMPLE_TITLES) {
    await expect(frame.getByText(title)).toBeVisible();
  }
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
    await routeCovers(page);

    await page.goto(`/${SAMPLE_WITH_TILES}`);

    await expect(stageBar(page)).toContainText("Book List");
    await expect(stageBar(page)).toContainText("1.0.0");
    await expectSampleBooks(page, "sandbox-1");
  });

  test("Link without a collection", async function opensWithoutCollection({
    page,
  }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);

    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);

    await expect(
      page
        .frameLocator('iframe[title="Book List"]')
        .getByText("There are no books to show."),
    ).toBeVisible();
    for (const url of requestedUrls) {
      expect(url).not.toContain("book_collection.yaml");
    }
  });

  test("Encoded values", async function opensEncodedLink({
    page,
  }): Promise<void> {
    await page.goto(`/${EXPLORER_LINK}`);
    const source = new URL("/samples/mods/book_list/mod_conf.yaml", page.url())
      .href;

    await followLink(page, `#/run?mod=${encodeURIComponent(source)}`);

    await expect(stageBar(page)).toContainText("Book List");
    await expect(stageBar(page)).toContainText(source);
  });
});

test.describe("Home", function describeHome(): void {
  test("No hash", async function opensHome({ page }): Promise<void> {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "OpenTesela" }),
    ).toBeVisible();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();
    await expect(visibleSandbox(page)).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/");
  });

  test("Unknown hash", async function opensHomeForUnknownHash({
    page,
  }): Promise<void> {
    await page.goto("/#/mods/view");

    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/");
  });

  test("Home as a mod", async function opensHomeMod({ page }): Promise<void> {
    await page.goto(`${HOME_MOD_PREVIEW_URL}/`);

    await expect(
      visibleSandbox(page).locator('iframe[title="Mods"]'),
    ).toBeVisible();
    await expect(pageBody(page)).toHaveCount(0);
  });
});

test.describe("Several sandboxes, at most one visible", function describeSandboxes(): void {
  test("Second link hides the first mod", async function hidesFirstMod({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    const firstFrame = await findSandboxFrame(page, "sandbox-1");
    await markFrame(firstFrame);

    await followLink(page, EXPLORER_LINK);
    await expect(stageBar(page)).toContainText("Mods");

    await expect(page.locator("[data-sandbox-id] iframe")).toHaveCount(2);
    expect(await readVisibleId(page)).toBe("sandbox-2");
    await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
    expect(await isFrameMarked(firstFrame)).toBe(true);
  });
});

test.describe("Back and forward keep the sandbox state", function describeHistory(): void {
  test("Back to the previous mod", async function goesBack({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    const firstFrame = await findSandboxFrame(page, "sandbox-1");
    await firstFrame.evaluate(rememberValue);
    await markFrame(firstFrame);
    await followLink(page, EXPLORER_LINK);
    await expect(stageBar(page)).toContainText("Mods");

    await page.goBack();

    await expect(stageBar(page)).toContainText("Book List");
    expect(await readVisibleId(page)).toBe("sandbox-1");
    expect(await isFrameMarked(firstFrame)).toBe(true);
    expect(await firstFrame.evaluate(readRememberedValue)).toBe(42);
  });

  test("Forward again", async function goesForward({ page }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await followLink(page, EXPLORER_LINK);
    const secondFrame = await findSandboxFrame(page, "sandbox-2");
    await markFrame(secondFrame);
    await page.goBack();
    await expect(stageBar(page)).toContainText("Book List");

    await page.goForward();

    await expect(stageBar(page)).toContainText("Mods");
    expect(await readVisibleId(page)).toBe("sandbox-2");
    expect(await isFrameMarked(secondFrame)).toBe(true);
  });

  test("Back after a page reload", async function reopensAfterReload({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await followLink(page, EXPLORER_LINK);
    await expect(stageBar(page)).toContainText("Mods");

    await page.reload();
    await expect(stageBar(page)).toContainText("Mods");
    await page.goBack();

    await expect(stageBar(page)).toContainText("Book List");
    expect(await readVisibleId(page)).toBe("sandbox-2");
    await expect(
      page.locator('[data-sandbox-id="sandbox-2"] iframe[title="Book List"]'),
    ).toBeAttached();
  });
});

test.describe("Opening after going back drops the forward entries", function describeForwardEntries(): void {
  test("New link after going back", async function dropsForwardSandbox({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await followLink(page, VIEWER_LINK);
    await expect(stageBar(page)).toContainText("Mod Viewer");
    await page.goBack();
    await expect(stageBar(page)).toContainText("Book List");

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
    await page.goto(`/${EXPLORER_LINK}`);
    const explorer = await findModFrame(page, "Mods");
    await markFrame(explorer);
    await explorer.getByRole("button", { name: /Book List/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");

    await stageBar(page).getByRole("button", { name: "Close" }).click();

    await expect(page.locator('iframe[title="Mod Viewer"]')).toHaveCount(0);
    await expect(stageBar(page)).toContainText("Mods");
    expect(await isFrameMarked(explorer)).toBe(true);
    expect(new URL(page.url()).hash).toBe(EXPLORER_LINK);
  });

  test("Close a mod opened from a link", async function closesLinkedMod({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await expect(stageBar(page)).toContainText("Book List");

    await stageBar(page).getByRole("button", { name: "Close" }).click();

    await expect(page.locator('iframe[title="Book List"]')).toHaveCount(0);
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/");
  });

  test("Home mod has no close button", async function hidesHomeClose({
    page,
  }): Promise<void> {
    await page.goto(`${HOME_MOD_PREVIEW_URL}/`);
    await expect(stageBar(page)).toContainText("Mods");

    await expect(
      stageBar(page).getByRole("button", { name: "Close" }),
    ).toHaveCount(0);
  });

  test("The explorer can be closed", async function closesExplorer({
    page,
  }): Promise<void> {
    await page.goto("/");
    await openModsSection(page);

    await stageBar(page).getByRole("button", { name: "Close" }).click();

    await expect(page.locator('iframe[title="Mods"]')).toHaveCount(0);
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();
  });
});

test.describe("Pages in the history", function describePagesInHistory(): void {
  test("A page hides the mods", async function hidesModsForPage({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    const frame = await findSandboxFrame(page, "sandbox-1");
    await markFrame(frame);

    await openSection(page, "Settings");

    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(page.locator('iframe[title="Book List"]')).toBeHidden();
    await expect(page.locator('iframe[title="Book List"]')).toHaveCount(1);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Back from a page to a mod", async function goesBackToMod({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    const frame = await findSandboxFrame(page, "sandbox-1");
    await frame.evaluate(rememberValue);
    await openSection(page, "Settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();

    await page.goBack();

    await expect(page.locator('iframe[title="Book List"]')).toBeVisible();
    expect(await frame.evaluate(readRememberedValue)).toBe(42);
  });

  test("Forward to a page", async function goesForwardToPage({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await expect(stageBar(page)).toContainText("Book List");
    await openSection(page, "Settings");
    await page.goBack();
    await expect(page.locator('iframe[title="Book List"]')).toBeVisible();

    await page.goForward();

    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
  });

  test("Reload on a page", async function reloadsOnPage({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await expect(stageBar(page)).toContainText("Book List");
    await openSection(page, "About");
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "About" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "About" }),
    ).toBeVisible();
    await page.goBack();

    await expect(stageBar(page)).toContainText("Book List");
  });

  test("New section after going back", async function dropsForwardSandbox({
    page,
  }): Promise<void> {
    await page.goto("/");
    await followLink(page, SAMPLE_WITHOUT_TILES);
    await expect(stageBar(page)).toContainText("Book List");
    await openSection(page, "Settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await page.goBack();
    await expect(stageBar(page)).toContainText("Book List");
    await page.goBack();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();

    await openModsSection(page);

    await expect(page.locator('iframe[title="Book List"]')).toHaveCount(0);
  });
});

test.describe("Show the mod issues", function describeIssues(): void {
  test("Sample mod has no issues", async function showsNoIssues({
    page,
  }): Promise<void> {
    await routeCovers(page);

    await page.goto(`/${SAMPLE_WITH_TILES}`);

    await expect(stageBar(page)).toContainText("Book List");
    await expect(stageBar(page)).toContainText("No issues.");
  });

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

    const issue = issueList(page).getByRole("listitem").first();
    await expect(issue).toContainText("warning");
    await expect(issue).toContainText(`${FOREIGN_HOST}/probe/mod_conf.yaml`);
    await expect(issue).toContainText(`show content from ${COVER_HOST}`);
  });

  test("Blocked request is listed while the mod runs", async function listsBlock({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await expect(stageBar(page)).toContainText("No issues.");

    await frame.evaluate(showImage, "https://images.example.net/cover.jpg");

    await expect(issueList(page)).toContainText("https://images.example.net");
    await expect(issueList(page)).toContainText("permissions.show");
  });

  test("Issues stay with their sandbox", async function keepsIssues({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await frame.evaluate(showImage, "https://images.example.net/cover.jpg");
    await expect(issueList(page)).toContainText("https://images.example.net");

    await followLink(page, SAMPLE_WITHOUT_TILES);
    await expect(stageBar(page)).toContainText("Book List");
    await expect(stageBar(page)).toContainText("No issues.");
    await page.goBack();

    await expect(stageBar(page)).toContainText("probe");
    await expect(issueList(page)).toContainText("https://images.example.net");
  });
});

test.describe("Show load failures", function describeLoadFailures(): void {
  test("Missing mod file", async function showsMissingMod({
    page,
  }): Promise<void> {
    await page.goto("/#/run?mod=./samples/mods/missing");
    const missingSource = new URL(
      "/samples/mods/missing/mod_conf.yaml",
      page.url(),
    ).href;

    await expect(page.getByRole("alert")).toContainText(missingSource);
    await expect(page.getByRole("alert")).toContainText("404");
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(
      stageBar(page).getByRole("button", { name: "Close" }),
    ).toBeVisible();
  });

  test("Missing collection", async function showsMissingCollection({
    page,
  }): Promise<void> {
    await page.goto(
      "/#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/missing.yaml",
    );
    const missingCollection = new URL(
      "/samples/mods/book_list/missing.yaml",
      page.url(),
    ).href;

    await expect(page.getByRole("alert")).toContainText(missingCollection);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});

/** Answers the sample collection with two books once `twoBooks.isOn` is set. */
async function answerCollection(
  twoBooks: { isOn: boolean },
  route: Route,
): Promise<void> {
  if (!twoBooks.isOn) {
    await route.fallback();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "text/yaml",
    body: [
      "collection:",
      '  name: "Two books"',
      "  tiles:",
      '    - path: "./books/kallocain.md"',
      '    - path: "./books/fictions.md"',
    ].join("\n"),
  });
}

test.describe("Reload the tiles", function describeReloadTiles(): void {
  test("Reload after the collection changed", async function reloadsTiles({
    page,
  }): Promise<void> {
    const twoBooks = { isOn: false };
    await routeCovers(page);
    await page.route(
      "**/samples/mods/book_list/book_collection.yaml",
      answerCollection.bind(undefined, twoBooks),
    );
    await page.goto(`/${SAMPLE_WITH_TILES}`);
    await expectSampleBooks(page, "sandbox-1");
    const frame = await findSandboxFrame(page, "sandbox-1");
    await markFrame(frame);
    twoBooks.isOn = true;

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    const frameLocator = page.frameLocator('iframe[title="Book List"]');
    await expect(frameLocator.getByRole("listitem")).toHaveCount(2);
    await expect(frameLocator.getByText("Fahrenheit 451")).toHaveCount(0);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("No collection, no reload", async function hidesReload({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_WITHOUT_TILES}`);
    await expect(stageBar(page)).toContainText("Book List");

    await expect(
      stageBar(page).getByRole("button", { name: "Reload tiles" }),
    ).toHaveCount(0);
  });
});

test.describe("Sample book list mod", function describeSampleMod(): void {
  test("Books with covers", async function showsCovers({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_WITH_TILES}`);
    const frameLocator = page.frameLocator('iframe[title="Book List"]');
    await expectSampleBooks(page, "sandbox-1");
    const frame = await findModFrame(page, "Book List");

    await expect(frameLocator.getByText("Karin Boye")).toBeVisible();
    await expect(frameLocator.getByText("Ray Bradbury")).toBeVisible();
    await expect
      .poll(function readCovers(): Promise<string[]> {
        return frame.evaluate(readLoadedCovers);
      })
      .toEqual([
        "Cover of Fahrenheit 451",
        "Cover of Kallocain",
        "Cover of The Library of Babel",
      ]);
  });

  test("Selection is remembered", async function remembersSelection({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_WITH_TILES}`);
    const frameLocator = page.frameLocator('iframe[title="Book List"]');
    const kallocain = frameLocator.getByRole("button", { name: /Kallocain/ });
    await kallocain.click();
    await expect(kallocain).toHaveAttribute("aria-pressed", "true");

    await page.reload();

    await expect(
      page
        .frameLocator('iframe[title="Book List"]')
        .getByRole("button", { name: /Kallocain/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .frameLocator('iframe[title="Book List"]')
        .getByRole("button", { name: /Fahrenheit 451/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
