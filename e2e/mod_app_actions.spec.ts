import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Download, Frame, Page, Route } from "@playwright/test";
import {
  actionDialog,
  buildProbeFiles,
  exposeSampleEngine,
  findModFrame,
  findSandboxFrame,
  hasProbeAnswer,
  navigateFrame,
  readProbeAnswers,
  routeCovers,
  serveAppOriginMod,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const SAMPLE_RUN_LINK =
  "/#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml";
const OPEN_ANY_SITE_LINES = [
  "  permissions:",
  "    open:",
  '      - host: "*"',
  '        reason: "Opens mods"',
];

async function openProbe(
  page: Page,
  extraLines: string[] = [],
): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe", extraLines));
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

/** Sends one request from the probe without waiting for its answer. */
async function ask(
  frame: Frame,
  method: string,
  params: object,
): Promise<void> {
  await frame.evaluate(startProbeRequests, [[method, params]]);
}

async function answerBlankPage(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Elsewhere</title>",
  });
}

function readOpener(): boolean {
  return window.opener === null;
}

function recordDownloads(page: Page): Download[] {
  const downloads: Download[] = [];
  page.on("download", Array.prototype.push.bind(downloads));
  return downloads;
}

async function readDownload(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFile(path);
}

test.describe("Open a link", function describeOpenLink(): void {
  test("Link opened", async function opensLink({
    page,
    context,
  }): Promise<void> {
    await context.route("https://example.org/**", answerBlankPage);
    const frame = await openProbe(page);
    await ask(frame, "links.open", { url: "https://example.org/books?id=1" });
    await expect(actionDialog(page)).toContainText(
      "https://example.org/books?id=1",
    );

    const opening = context.waitForEvent("page");
    await actionDialog(page).getByRole("button", { name: "Open" }).click();
    const newPage = await opening;
    await newPage.waitForLoadState();

    expect(newPage.url()).toBe("https://example.org/books?id=1");
    expect(await newPage.evaluate(readOpener)).toBe(true);
    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: true }]);
    await expect(actionDialog(page)).toBeHidden();
  });

  test("Link cancelled", async function cancelsLink({
    page,
    context,
  }): Promise<void> {
    const frame = await openProbe(page);
    await ask(frame, "links.open", { url: "https://example.org/" });

    await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: false }]);
    expect(context.pages()).toHaveLength(1);
  });
});

test.describe("Save a file", function describeSaveFile(): void {
  test("Text file saved", async function savesText({ page }): Promise<void> {
    const frame = await openProbe(page);
    await ask(frame, "files.save", {
      name: "books.csv",
      content: "title\nKallocain\n",
      type: "text/csv",
    });

    const downloading = page.waitForEvent("download");
    await actionDialog(page).getByRole("button", { name: "Save" }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe("books.csv");
    expect((await readDownload(download)).toString("utf8")).toBe(
      "title\nKallocain\n",
    );
    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: true }]);
  });

  test("Binary file saved", async function savesBinary({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await ask(frame, "files.save", {
      name: "cover.png",
      content: "iVBORw0KGgo=",
      encoding: "base64",
      type: "image/png",
    });

    const downloading = page.waitForEvent("download");
    await actionDialog(page).getByRole("button", { name: "Save" }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe("cover.png");
    expect(await readDownload(download)).toEqual(
      Buffer.from("iVBORw0KGgo=", "base64"),
    );
  });

  test("Save cancelled", async function cancelsSave({ page }): Promise<void> {
    const downloads = recordDownloads(page);
    const frame = await openProbe(page);
    await ask(frame, "files.save", { name: "books.csv", content: "title\n" });

    await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: false }]);
    expect(downloads).toEqual([]);
  });

  test("Size shown", async function showsSize({ page }): Promise<void> {
    const frame = await openProbe(page);

    await ask(frame, "files.save", {
      name: "books.csv",
      content: "a".repeat(2048),
    });

    await expect(actionDialog(page)).toContainText("books.csv");
    await expect(actionDialog(page)).toContainText("2 KB");
  });
});

test.describe("Ask for a confirmation", function describeConfirm(): void {
  test("Confirmed with a custom label", async function confirms({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await ask(frame, "ui.confirm", {
      message: "Delete this list?",
      confirmLabel: "Delete",
    });

    await expect(actionDialog(page)).toContainText("Delete this list?");
    const buttons = actionDialog(page).getByRole("button");
    await expect(buttons).toHaveText(["Cancel", "Delete"]);
    await actionDialog(page).getByRole("button", { name: "Delete" }).click();

    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: true }]);
  });

  test("Escape answers no", async function answersEscape({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await ask(frame, "ui.confirm", { message: "Delete this list?" });
    await expect(actionDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(actionDialog(page)).toBeHidden();
    expect(await frame.evaluate(readProbeAnswers)).toEqual([{ result: false }]);
  });
});

test.describe("The action dialog names the mod", function describeNaming(): void {
  test("Sample mod asks", async function namesSampleMod({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await exposeSampleEngine(page);
    await page.goto(SAMPLE_RUN_LINK);
    const frame = await findModFrame(page, "Book List");
    await waitForProbe(frame);
    const source = new URL("/samples/mods/book_list/mod_conf.yaml", page.url())
      .href;

    await ask(frame, "ui.confirm", { message: "Delete this list?" });

    const dialog = actionDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toHaveText("Book List");
    await expect(dialog).toContainText(source);
    expect(await frame.locator("dialog").count()).toBe(0);
    expect(await page.locator("dialog[open]").count()).toBe(1);
  });

  test("Frame cannot be used behind the dialog", async function blocksFrame({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await exposeSampleEngine(page);
    await page.goto(SAMPLE_RUN_LINK);
    const frame = await findModFrame(page, "Book List");
    await waitForProbe(frame);
    const book = frame.getByRole("button", { name: /Kallocain/ });
    await expect(book).toHaveAttribute("aria-pressed", "false");
    const box = await book.boundingBox();
    if (box === null) {
      throw new Error("Expected the book button to be shown");
    }
    await ask(frame, "ui.confirm", { message: "Delete this list?" });
    await expect(actionDialog(page)).toBeVisible();

    await page.mouse.click(box.x + 4, box.y + box.height / 2);
    await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(book).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("The action dialog is centered", function describeCentering(): void {
  test("in the middle of the viewport", async function centersDialog({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    const frame = await openProbe(page);

    await ask(frame, "ui.confirm", { message: "Delete this list?" });
    await expect(actionDialog(page)).toBeVisible();

    const box = await actionDialog(page).boundingBox();
    if (box === null) {
      throw new Error("Expected the action dialog to have a box");
    }
    expect(box.x + box.width / 2).toBeCloseTo(640, 0);
    expect(box.y + box.height / 2).toBeCloseTo(400, 0);
    expect(box.width).toBeLessThanOrEqual(512);
  });
});

test.describe("One action dialog at a time", function describeQueue(): void {
  test("Two confirmations", async function showsInOrder({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await frame.evaluate(startProbeRequests, [
      ["ui.confirm", { message: "First" }],
      ["ui.confirm", { message: "Second" }],
    ]);

    await expect(actionDialog(page)).toContainText("First");
    await expect(page.locator("dialog")).toHaveCount(1);
    await expect(actionDialog(page)).not.toContainText("Second");
    await actionDialog(page).getByRole("button", { name: "OK" }).click();
    await expect(actionDialog(page)).toContainText("Second");
    await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

    expect(await frame.evaluate(readProbeAnswers)).toEqual([
      { result: true },
      { result: false },
    ]);
    await expect(actionDialog(page)).toBeHidden();
  });
});

test.describe("A mod that leaves gets no", function describeLeaving(): void {
  test("Back while a dialog is open", async function dropsOnBack({
    page,
  }): Promise<void> {
    const opener = await openProbe(page, OPEN_ANY_SITE_LINES);
    await ask(opener, "mods.open", {
      mod: "./test-mods/probe/",
      params: { from: "opener" },
    });
    const opened = await findSandboxFrame(page, "sandbox-2");
    await waitForProbe(opened);
    await ask(opened, "ui.confirm", { message: "Delete this list?" });
    await expect(actionDialog(page)).toBeVisible();

    await page.goBack();

    await expect(actionDialog(page)).toBeHidden();
    expect(await opened.evaluate(readProbeAnswers)).toEqual([
      { result: false },
    ]);
    await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeVisible();
  });

  test("Stopped while a dialog is open", async function dropsOnStop({
    page,
  }): Promise<void> {
    await page.route("https://example.org/**", answerBlankPage);
    const downloads = recordDownloads(page);
    const frame = await openProbe(page);
    await ask(frame, "files.save", { name: "books.csv", content: "title\n" });
    await expect(actionDialog(page)).toBeVisible();
    expect(await frame.evaluate(hasProbeAnswer)).toBe(false);

    await frame
      .evaluate(navigateFrame, "https://example.org/")
      .catch(ignoreError);

    await expect(actionDialog(page)).toBeHidden();
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(downloads).toEqual([]);
  });
});

function ignoreError(): void {
  // The frame's document is replaced while the evaluation runs.
}
