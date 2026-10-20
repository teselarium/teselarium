import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  findModFrame,
  readParentDocumentError,
  routeCovers,
  serveAppOriginMod,
  stageBar,
} from "./mod_routes.ts";

const EXPLORER_CODE = readFileSync(
  new URL("../public/default_mods/mod_explorer/main.js", import.meta.url),
  "utf8",
);

function readSampleSource(page: Page): string {
  return new URL("/samples/mods/book_list/mod_conf.yaml", page.url()).href;
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
    const explorer = await findModFrame(page, "Mods");

    await explorer.getByRole("button", { name: /Book List/ }).click();

    await expect(stageBar(page)).toContainText("Mod Viewer");
  });
});

test.describe("Default mods are ordinary mods", function describeOrdinary(): void {
  test("Explorer sandbox", async function sandboxesExplorer({
    page,
  }): Promise<void> {
    await page.goto("/");

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
    await page.goto("/");
    const explorer = page.frameLocator('iframe[title="Mods"]');

    await expect(
      explorer.getByRole("button", { name: /Book List/ }),
    ).toContainText("A very simple list of books with their covers.");
  });

  test("Select a mod", async function selectsMod({ page }): Promise<void> {
    await page.goto("/");
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

    const explorer = page.frameLocator('iframe[title="Broken explorer"]');
    await expect(explorer.getByText("./samples/mods/missing")).toBeVisible();
    await expect(explorer.locator(".mod-error").first()).toContainText("404");
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
    await expect(
      viewer.getByText(
        "show https://upload.wikimedia.org: Shows the book covers (granted)",
      ),
    ).toBeVisible();
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
