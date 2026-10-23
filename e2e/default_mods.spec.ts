import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Frame, FrameLocator, Locator, Page } from "@playwright/test";
import {
  findModFrame,
  readParentDocumentError,
  routeCovers,
  serveAppOriginMod,
  stageBar,
} from "./mod_routes.ts";
import { listOwnLookDeclarations, readTokenAs } from "./theme_probes.ts";
import { openModsSection, pageBody } from "./app_layout.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

const EXPLORER_CODE = readFileSync(
  new URL("../public/default_mods/mod_explorer/main.js", import.meta.url),
  "utf8",
);

function readSampleSource(page: Page): string {
  return new URL("/samples/mods/book_list/mod_conf.yaml", page.url()).href;
}

/** The explorer with `./samples/mods/missing` in its `mods` list, served on the app's origin. */
async function openBrokenExplorer(page: Page): Promise<Frame> {
  await serveAppOriginMod(page, {
    "explorer/mod_conf.yaml": [
      "mod:",
      '  name: "mod_explorer"',
      '  title: "Broken explorer"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      "  config:",
      '    viewer: "mod_viewer"',
      "    mods:",
      '      - "./samples/mods/missing"',
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

/** The row of the sample mod's `show` permission in the viewer's permission table. */
function coverPermissionRow(viewer: FrameLocator): Locator {
  return viewer
    .getByRole("row")
    .filter({ hasText: "https://upload.wikimedia.org" });
}

async function openViewerForSample(page: Page): Promise<void> {
  await page.goto("/#/run?mod=mod_viewer&target=./samples/mods/book_list");
  await expect(
    page
      .frameLocator('iframe[title="Mod Viewer"]')
      .getByText("Shows the book covers"),
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
      `#/run?mod=mod_viewer&target=${encodeURIComponent(readSampleSource(page))}`,
    );
  });

  test("Mod that cannot be inspected", async function listsFailure({
    page,
  }): Promise<void> {
    const explorer = await openBrokenExplorer(page);

    await expect(explorer.getByText("./samples/mods/missing")).toBeVisible();
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
    await page.goto("/#/run?mod=mod_viewer&target=./samples/mods/missing");

    await expect(
      page.frameLocator('iframe[title="Mod Viewer"]').getByRole("alert"),
    ).toContainText("404");
  });
});

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
    await serveAppOriginMod(page, {
      "two_books.yaml": [
        "collection:",
        '  name: "Two books"',
        "  tiles:",
        '    - path: "../samples/tiles/books/kallocain.md"',
        '    - path: "../samples/tiles/books/fictions.md"',
      ].join("\n"),
    });
    await openViewerForSample(page);
    const viewer = page.frameLocator('iframe[title="Mod Viewer"]');

    await viewer
      .getByRole("textbox", { name: "Collection address" })
      .fill(new URL("/test-mods/two_books.yaml", page.url()).href);
    await viewer
      .getByRole("button", { name: "Run with this collection" })
      .click();

    const sample = page.frameLocator('iframe[title="Book List"]');
    await expect(sample.getByRole("listitem")).toHaveCount(2);
    await expect(sample.getByText("The Library of Babel")).toBeVisible();
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
      `#/run?mod=${encodeURIComponent(readSampleSource(page))}`,
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
    await expect(alert).toContainText("./samples/mods/missing");
    await expect(alert).toContainText("404");
    expect(await alert.evaluate(readBorderColor)).toBe(
      await readTokenColor(explorer, "--ot-destructive"),
    );
  });
});
