import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import { SMALL_PHONE_VIEWPORT } from "./layout_probes.ts";
import {
  buildProbeFiles,
  findModFrame,
  readProbeAnswers,
  requestFromProbe,
  serveAppOriginMod,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import type { ProbeAnswer } from "./mod_routes.ts";
import { MINIMUM_TEXT_CONTRAST, readContrastRatio } from "./theme_probes.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";

/** The folder name the folder imports use. */
const FOLDER_NAME = "my-mosaics";

/** The smallest size a touch target of the dialogs may have. */
const MINIMUM_TARGET_SIZE = 32;

interface CatalogMosaic {
  source: string;
  listedBy: string;
  place: string;
}

interface CatalogAnswer {
  mosaics: CatalogMosaic[];
}

/** A mosaic file of the probe mod, on the app's origin, so it opens without asking. */
function writeProbeMosaic(page: Page, title: string): string {
  const modAddress = new URL("/test-mods/probe/", page.url()).href;
  const text = [
    "mosaic:",
    `  title: "${title}"`,
    `  mod: "${modAddress}"`,
    "",
  ].join("\n");
  return text;
}

async function openProbe(page: Page): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe"));
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

/** Sends one request from the probe without waiting for its answer. */
async function ask(
  frame: Frame,
  method: string,
  params: object = {},
): Promise<void> {
  await frame.evaluate(startProbeRequests, [[method, params]]);
}

async function readAnswer(frame: Frame): Promise<ProbeAnswer> {
  const [answer] = await frame.evaluate(readProbeAnswers);
  return answer;
}

function catalogDialog(page: Page): Locator {
  return page.locator("dialog[open]");
}

async function listUserMosaics(frame: Frame): Promise<CatalogMosaic[]> {
  const answer = await frame.evaluate(requestFromProbe, ["catalog.list", {}]);
  const catalog = answer.result as CatalogAnswer;
  const userMosaics: CatalogMosaic[] = [];
  for (const mosaic of catalog.mosaics) {
    if (mosaic.listedBy === "user") {
      userMosaics.push(mosaic);
    }
  }
  return userMosaics;
}

/** Writes `files`, by path, into a new folder named `FOLDER_NAME`, and returns its path. */
async function writeFolder(files: Record<string, string>): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "opentesela-import-"));
  const folder = join(parent, FOLDER_NAME);
  for (const [path, text] of Object.entries(files)) {
    const filePath = join(folder, path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, text);
  }
  return folder;
}

/** Imports `folder` through the visible probe's `userCatalog.import`, checking every new and changed file. */
async function importFolder(
  page: Page,
  frame: Frame,
  folder: string,
): Promise<void> {
  await ask(frame, "userCatalog.import");
  const dialog = catalogDialog(page);
  await dialog.getByLabel("Mosaic folder").setInputFiles(folder);
  await expect(
    dialog.getByRole("list", { name: "Picked files" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await readAnswer(frame)).toEqual({ result: true });
}

function buildPickedPayloads(
  page: Page,
  count: number,
): { name: string; mimeType: string; buffer: Buffer }[] {
  const payloads: { name: string; mimeType: string; buffer: Buffer }[] = [];
  for (let index = 1; index <= count; index += 1) {
    payloads.push({
      name: `mosaic_with_a_rather_long_name_${index}.yaml`,
      mimeType: "application/yaml",
      buffer: Buffer.from(writeProbeMosaic(page, `Mosaic ${index}`)),
    });
  }
  return payloads;
}

interface DialogLayout {
  dialogWidth: number;
  scrollsSideways: boolean;
  listScrolls: boolean;
  smallestTarget: number;
}

/** Runs in the page: the open dialog's width, whether it or its list scrolls, and its smallest button or checkbox. */
function readDialogLayout(): DialogLayout {
  const dialog = document.querySelector("dialog[open]");
  const list = dialog?.querySelector("[data-review-list]");
  if (
    dialog === null ||
    dialog === undefined ||
    list === null ||
    list === undefined
  ) {
    throw new Error("Expected an open dialog with a review list");
  }
  let smallestTarget = Number.POSITIVE_INFINITY;
  for (const target of dialog.querySelectorAll("button")) {
    const box = target.getBoundingClientRect();
    smallestTarget = Math.min(smallestTarget, box.width, box.height);
  }
  const layout: DialogLayout = {
    dialogWidth: dialog.getBoundingClientRect().width,
    scrollsSideways: dialog.scrollWidth > dialog.clientWidth,
    listScrolls: list.scrollHeight > list.clientHeight,
    smallestTarget,
  };
  return layout;
}

interface BadgeColors {
  variant: string | null;
  color: string;
  fill: string;
}

/** Runs in the page: each status badge's variant, text color, and the dialog's fill behind it. */
function readBadgeColors(): Record<string, BadgeColors> {
  const dialog = document.querySelector("dialog[open]");
  if (dialog === null) {
    throw new Error("Expected an open dialog");
  }
  const fill = getComputedStyle(dialog).backgroundColor;
  const colors: Record<string, BadgeColors> = {};
  for (const badge of dialog.querySelectorAll(
    "[data-review-row] [data-slot=badge]",
  )) {
    colors[badge.textContent ?? ""] = {
      variant: badge.getAttribute("data-variant"),
      color: getComputedStyle(badge).color,
      fill,
    };
  }
  return colors;
}

const EXPECTED_VARIANTS: Record<string, string> = {
  New: "success",
  Changed: "warning",
  Unchanged: "outline",
  "Not a mosaic": "destructive",
  "Not in the folder": "outline",
};

/** The lowest contrast of the status badges' text with their fill. */
function readLowestContrast(colors: Record<string, BadgeColors>): number {
  let lowest = Number.POSITIVE_INFINITY;
  for (const badge of Object.values(colors)) {
    lowest = Math.min(lowest, readContrastRatio(badge.color, badge.fill));
  }
  return lowest;
}

async function readBadgeContrast(page: Page): Promise<number> {
  return readLowestContrast(await page.evaluate(readBadgeColors));
}

/**
 * Checks each status badge's variant, and that its text has a contrast of at
 * least 4.5:1 with its fill. Badges animate their color, so the contrast is
 * read until the colors of a color scheme change settle.
 */
async function expectBadgeColors(page: Page): Promise<void> {
  const colors = await page.evaluate(readBadgeColors);
  expect(Object.keys(colors).sort()).toEqual(
    Object.keys(EXPECTED_VARIANTS).sort(),
  );
  for (const [label, badge] of Object.entries(colors)) {
    expect(badge.variant).toBe(EXPECTED_VARIANTS[label]);
  }
  await expect
    .poll(readBadgeContrast.bind(undefined, page))
    .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
}

test.describe("User catalog dialogs on a phone", function describePhone(): void {
  test("Review on a phone", async function laysOutReview({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const frame = await openProbe(page);
    await ask(frame, "userCatalog.import");
    const dialog = catalogDialog(page);

    await dialog
      .getByLabel("Mosaic files")
      .setInputFiles(buildPickedPayloads(page, 12));

    const list = dialog.getByRole("list", { name: "Picked files" });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    const layout = await page.evaluate(readDialogLayout);
    expect(layout.dialogWidth).toBeLessThanOrEqual(SMALL_PHONE_VIEWPORT.width);
    expect(layout.scrollsSideways).toBe(false);
    expect(layout.listScrolls).toBe(true);
    expect(layout.smallestTarget).toBeGreaterThanOrEqual(MINIMUM_TARGET_SIZE);
    await expect(
      dialog.getByRole("button", { name: "Import" }),
    ).toBeInViewport();
    await expect(
      dialog.getByRole("button", { name: "Cancel" }),
    ).toBeInViewport();
    const checkbox = list.getByRole("checkbox").first();
    const checkboxBox = await checkbox.boundingBox();
    expect(checkboxBox?.width).toBeGreaterThanOrEqual(MINIMUM_TARGET_SIZE);
    expect(checkboxBox?.height).toBeGreaterThanOrEqual(MINIMUM_TARGET_SIZE);
  });

  test("Add dialog on a phone", async function laysOutAdd({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const frame = await openProbe(page);

    await ask(frame, "userCatalog.add", {
      mosaic: "https://mosaics.example.net/maps/a_long_path/to/laureates.yml",
    });

    const dialog = catalogDialog(page);
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(SMALL_PHONE_VIEWPORT.width);
    const addBox = await dialog
      .getByRole("button", { name: "Add" })
      .boundingBox();
    expect(addBox?.height).toBeGreaterThanOrEqual(MINIMUM_TARGET_SIZE);
  });
});

test.describe("User catalog dialog colors", function describeColors(): void {
  test("Statuses in both schemes", async function checksBadgeColors({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openProbe(page);
    await importFolder(
      page,
      frame,
      await writeFolder({
        "nobel_map.yaml": writeProbeMosaic(page, "Nobel map"),
        "same.yaml": writeProbeMosaic(page, "Same"),
        "old.yaml": writeProbeMosaic(page, "Old"),
      }),
    );
    await ask(frame, "userCatalog.import");
    const dialog = catalogDialog(page);

    await dialog.getByLabel("Mosaic folder").setInputFiles(
      await writeFolder({
        "nobel_map.yaml": writeProbeMosaic(page, "Nobel map 2"),
        "same.yaml": writeProbeMosaic(page, "Same"),
        "poets.yaml": writeProbeMosaic(page, "Poets"),
        "broken.yaml": "mosaic: {}\n",
      }),
    );
    await expect(
      dialog.getByRole("list", { name: "Picked files" }),
    ).toBeVisible();

    await expectBadgeColors(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-ot-color-scheme",
      "dark",
    );
    await expectBadgeColors(page);
  });
});

/** Runs in the page: makes `webkitGetAsEntry` give a dropped folder holding one mosaic file, as a real folder drop does. */
function stubFolderEntries(folder: {
  name: string;
  fileName: string;
  text: string;
}): void {
  const fileEntry = {
    isFile: true,
    isDirectory: false,
    name: folder.fileName,
    file(resolve: (file: File) => void): void {
      resolve(new File([folder.text], folder.fileName));
    },
  };
  const folderEntry = {
    isFile: false,
    isDirectory: true,
    name: folder.name,
    createReader(): {
      readEntries: (resolve: (entries: unknown[]) => void) => void;
    } {
      let isRead = false;
      return {
        readEntries(resolve: (entries: unknown[]) => void): void {
          resolve(isRead ? [] : [fileEntry]);
          isRead = true;
        },
      };
    },
  };
  DataTransferItem.prototype.webkitGetAsEntry =
    function giveFolder(): FileSystemEntry {
      return folderEntry as unknown as FileSystemEntry;
    };
}

/** Runs in the page: drops one placeholder file on the open dialog's drop zone. */
function dropOnDropZone(): void {
  const dropZone = document.querySelector("dialog[open] [data-drop-zone]");
  if (dropZone === null) {
    throw new Error("Expected the drop zone of an open dialog");
  }
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File(["placeholder"], "placeholder"));
  dropZone.dispatchEvent(
    new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
  );
}

/** Runs in the page before the app: IndexedDB refuses to open, as in some private windows. */
function refuseIndexedDb(): void {
  IDBFactory.prototype.open = function refuseOpening(): IDBOpenDBRequest {
    throw new DOMException("The database is refused.", "SecurityError");
  };
}

async function openStoredMosaic(page: Page, address: string): Promise<void> {
  await page.goto(`/#/run?mosaic=${encodeURIComponent(address)}`);
}

test.describe(
  "Stored mosaics",
  { tag: "@storage" },
  function describeStorage(): void {
    test("Kept after a reload", async function importsFolder({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);

      await importFolder(
        page,
        frame,
        await writeFolder({
          "maps/nobel_map.yaml": writeProbeMosaic(page, "Nobel map"),
        }),
      );

      const [stored] = await listUserMosaics(frame);
      expect(stored).toMatchObject({ listedBy: "user", place: "browser" });
      expect(stored.source).toMatch(
        /^opentesela-browser:\/\/\/[^/]+\/maps\/nobel_map\.yaml$/,
      );
      await openStoredMosaic(page, stored.source);
      const opened = await findModFrame(page, "probe");
      await waitForProbe(opened);
      await page.reload();
      const reloaded = await findModFrame(page, "probe");
      await waitForProbe(reloaded);
      // The app starts before the database opens, then lists its mosaics.
      await expect
        .poll(listUserMosaics.bind(undefined, reloaded))
        .toEqual([stored]);
    });

    test("Dropped folder", async function dropsFolder({ page }): Promise<void> {
      const frame = await openProbe(page);
      await ask(frame, "userCatalog.import");
      await page.evaluate(stubFolderEntries, {
        name: "dropped-mosaics",
        fileName: "nobel_map.yaml",
        text: writeProbeMosaic(page, "Nobel map"),
      });

      await page.evaluate(dropOnDropZone);

      const dialog = catalogDialog(page);
      const list = dialog.getByRole("list", { name: "Picked files" });
      await expect(list.getByRole("listitem")).toHaveCount(1);
      await expect(list).toContainText("nobel_map.yaml");
      await expect(list).toContainText("New");
      await dialog.getByRole("button", { name: "Import" }).click();
      expect(await readAnswer(frame)).toEqual({ result: true });
      expect(await listUserMosaics(frame)).toHaveLength(1);
    });

    test("Update, export and remove", async function updatesExportsRemoves({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await importFolder(
        page,
        frame,
        await writeFolder({
          "maps/nobel_map.yaml": writeProbeMosaic(page, "Nobel map"),
        }),
      );
      const [stored] = await listUserMosaics(frame);
      const dialog = catalogDialog(page);
      const changedText = writeProbeMosaic(page, "Nobel map 2");

      await ask(frame, "userCatalog.update", { mosaic: stored.source });
      await dialog.getByLabel("Mosaic file").setInputFiles({
        name: "nobel_map (2).yaml",
        mimeType: "application/yaml",
        buffer: Buffer.from(changedText),
      });
      await expect(dialog.getByText("Changed")).toBeVisible();
      await dialog.getByRole("button", { name: "Update" }).click();
      expect(await readAnswer(frame)).toEqual({ result: true });

      await ask(frame, "userCatalog.export", { mosaic: stored.source });
      const downloading = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Save" }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toBe("nobel_map.yaml");
      expect(await readFile(await download.path(), "utf8")).toBe(changedText);
      expect(await readAnswer(frame)).toEqual({ result: true });

      await ask(frame, "userCatalog.remove", { mosaic: stored.source });
      await expect(dialog).toContainText(
        'Remove "Nobel map 2" from your catalog?',
      );
      await dialog.getByRole("button", { name: "Remove" }).click();
      expect(await readAnswer(frame)).toEqual({ result: true });
      expect(await listUserMosaics(frame)).toEqual([]);

      await openStoredMosaic(page, stored.source);
      await expect(page.getByRole("alert")).toContainText(
        "not stored in this browser",
      );
    });

    test("Store refused", async function refusesStore({ page }): Promise<void> {
      await page.addInitScript(refuseIndexedDb);
      const frame = await openProbe(page);

      await ask(frame, "userCatalog.import");

      const dialog = catalogDialog(page);
      await expect(dialog.getByRole("alert")).toContainText(
        "This browser does not let the app store files",
      );
      await expect(
        dialog.getByRole("button", { name: "Choose files…" }),
      ).toBeDisabled();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      expect(await readAnswer(frame)).toEqual({ result: false });
      expect(await listUserMosaics(frame)).toEqual([]);
    });
  },
);
