import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Download, Frame, Page, Route } from "@playwright/test";
import {
  actionDialog,
  buildProbeFiles,
  findModFrame,
  findSandboxFrame,
  hasProbeAnswer,
  navigateFrame,
  readProbeAnswers,
  requestFromProbe,
  serveAppOriginMod,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import { openTilesMod, readTilesModSource, TILES_TITLE } from "./test_mods.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
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

/** Runs in a probe frame: adds a "Count" button that counts its clicks on `globalThis.clicks`. */
function addClickCounter(): void {
  const probeGlobal = globalThis as { clicks?: number };
  probeGlobal.clicks = 0;
  function countClick(): void {
    probeGlobal.clicks = (probeGlobal.clicks ?? 0) + 1;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Count";
  button.addEventListener("click", countClick);
  document.body.append(button);
}

/** Runs in a probe frame: the clicks the "Count" button of `addClickCounter` received. */
function readClickCount(): number {
  return (globalThis as { clicks?: number }).clicks ?? 0;
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

test.describe(
  "Open a link",
  { tag: "@frames" },
  function describeOpenLink(): void {
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
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
      await expect(actionDialog(page)).toBeHidden();
    });

    test("Link cancelled", async function cancelsLink({
      page,
      context,
    }): Promise<void> {
      const frame = await openProbe(page);
      await ask(frame, "links.open", { url: "https://example.org/" });

      await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: false },
      ]);
      expect(context.pages()).toHaveLength(1);
    });
  },
);

test.describe(
  "Save a file",
  { tag: "@frames" },
  function describeSaveFile(): void {
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
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
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

      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: false },
      ]);
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
  },
);

test.describe(
  "Ask for a confirmation",
  { tag: "@frames" },
  function describeConfirm(): void {
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

      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: true },
      ]);
    });

    test("Escape answers no", async function answersEscape({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await ask(frame, "ui.confirm", { message: "Delete this list?" });
      await expect(actionDialog(page)).toBeVisible();

      await page.keyboard.press("Escape");

      await expect(actionDialog(page)).toBeHidden();
      expect(await frame.evaluate(readProbeAnswers)).toEqual([
        { result: false },
      ]);
    });
  },
);

test.describe(
  "The action dialog names the mod",
  { tag: "@frames" },
  function describeNaming(): void {
    test("Sample mod asks", async function namesSampleMod({
      page,
    }): Promise<void> {
      const frame = await openTilesMod(page);
      const source = readTilesModSource(page);

      await ask(frame, "ui.confirm", { message: "Delete this list?" });

      const dialog = actionDialog(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading")).toHaveText(TILES_TITLE);
      await expect(dialog).toContainText(source);
      expect(await frame.locator("dialog[open]").count()).toBe(0);
      expect(await page.locator("dialog[open]").count()).toBe(1);
    });

    test("Frame cannot be used behind the dialog", async function blocksFrame({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(addClickCounter);
      const box = await frame
        .getByRole("button", { name: "Count" })
        .boundingBox();
      if (box === null) {
        throw new Error("Expected the Count button to be shown");
      }
      await ask(frame, "ui.confirm", { message: "Delete this list?" });
      await expect(actionDialog(page)).toBeVisible();

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await actionDialog(page).getByRole("button", { name: "Cancel" }).click();

      expect(await frame.evaluate(readClickCount)).toBe(0);
    });
  },
);

test.describe(
  "The action dialog is centered",
  { tag: "@frames" },
  function describeCentering(): void {
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
  },
);

test.describe(
  "One action dialog at a time",
  { tag: "@frames" },
  function describeQueue(): void {
    test("Two confirmations", async function showsInOrder({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(startProbeRequests, [
        ["ui.confirm", { message: "First" }],
        ["ui.confirm", { message: "Second" }],
      ]);

      await expect(actionDialog(page)).toContainText("First");
      await expect(page.locator("dialog[open]")).toHaveCount(1);
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
  },
);

test.describe(
  "Only the visible mod asks",
  { tag: "@frames" },
  function describeVisibleMod(): void {
    test("Hidden mod asks for an import", async function refusesHiddenImport({
      page,
    }): Promise<void> {
      const opener = await openProbe(page, OPEN_ANY_SITE_LINES);
      await ask(opener, "mods.open", { mod: "./test-mods/probe/" });
      const opened = await findSandboxFrame(page, "sandbox-2");
      await waitForProbe(opened);

      const answer = await opener.evaluate(requestFromProbe, [
        "userCatalog.import",
        {},
      ]);

      expect(answer.code).toBe(-32002);
      expect(answer.message).toBe(
        "userCatalog.import: only the visible mod can ask the user",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("Hidden mod asks to save", async function refusesHiddenSave({
      page,
    }): Promise<void> {
      const opener = await openProbe(page, OPEN_ANY_SITE_LINES);
      await ask(opener, "mods.open", { mod: "./test-mods/probe/" });
      const opened = await findSandboxFrame(page, "sandbox-2");
      await waitForProbe(opened);

      const answer = await opener.evaluate(requestFromProbe, [
        "userCatalog.save",
        { content: 'mosaic:\n  title: "Clock"\n  mod: "mod_viewer"\n' },
      ]);

      expect(answer.code).toBe(-32002);
      expect(answer.message).toBe(
        "userCatalog.save: only the visible mod can ask the user",
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const catalog = await opened.evaluate(requestFromProbe, [
        "catalog.list",
        {},
      ]);
      expect(JSON.stringify(catalog)).not.toContain("teselarium-browser:");
    });
  },
);

test.describe(
  "A mod that leaves gets no",
  { tag: "@frames" },
  function describeLeaving(): void {
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
  },
);

function ignoreError(): void {
  // The frame's document is replaced while the evaluation runs.
}
