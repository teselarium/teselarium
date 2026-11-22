import { expect, test } from "@playwright/test";
import type {
  Frame,
  FrameLocator,
  Locator,
  Page,
  Request,
} from "@playwright/test";
import {
  buildProbeFiles,
  COVER_HOST,
  expectMessageCount,
  expectMessages,
  findModFrame,
  followLink,
  FOREIGN_HOST,
  isFrameMarked,
  markFrame,
  messageButton,
  messageCapsule,
  messagePopover,
  moreActionsButton,
  moreActionsMenu,
  openMessages,
  openMoreActions,
  readMessages,
  reloadTiles,
  requestFromProbe,
  serveAppOriginMod,
  serveForeignMod,
  showImage,
  siteConsentDialog,
  stageBar,
  unreadItems,
  waitForProbe,
} from "./mod_routes.ts";
import type { MessageLevelName, ProbeAnswer } from "./mod_routes.ts";
import {
  buildLabelsCollection,
  buildLabelsMosaicFiles,
  buildNoteCollection,
  buildTypedProbeFiles,
  LABELS_COLLECTION_FILE,
  LABELS_MOSAIC_HASH,
  LABELS_MOSAIC_PATH,
  LABELS_MOSAIC_TITLE,
  openProbe,
  openTypedProbe,
  PROBE_LINK,
  serveTilesMod,
  TILES_COLLECTION_RUN_HASH,
  TILES_TITLE,
  TILES_VERSION,
} from "./test_mods.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  hamburgerButton,
  sectionItem,
  sidebarHeadingRow,
} from "./app_layout.ts";
import {
  HOME_MOD_PREVIEW_URL,
  TEST_CATALOG_PREVIEW_URL,
} from "./app_servers.ts";
import {
  MINIMUM_TEXT_CONTRAST,
  readContrastRatio,
  readTokenAs,
} from "./theme_probes.ts";
import {
  countLines,
  DESKTOP_VIEWPORT,
  isFullyShown,
  readElementBox,
  SMALL_PHONE_VIEWPORT,
  THEATER_MODE_KEY,
} from "./layout_probes.ts";

/** The lines of a probe that shows images from `COVER_HOST`, so a foreign probe asks for consent. */
const SHOW_COVERS_LINES = [
  "  permissions:",
  "    show:",
  `      - host: "${COVER_HOST}"`,
  '        reason: "Shows the book covers"',
];

async function notify(frame: Frame, params: object): Promise<ProbeAnswer> {
  return frame.evaluate(requestFromProbe, ["ui.notify", params]);
}

interface NotificationBatch {
  count: number;
  level: string;
  prefix: string;
}

interface NotifyingGlobal {
  probe: {
    engine: { request: (method: string, params: object) => Promise<unknown> };
  };
}

/** Runs in a probe frame: sends `ui.notify` `count` times, one after another. */
async function sendNotifications(batch: NotificationBatch): Promise<void> {
  const engine = (globalThis as unknown as NotifyingGlobal).probe.engine;
  for (let index = 1; index <= batch.count; index += 1) {
    await engine.request("ui.notify", {
      message: `${batch.prefix} ${index}`,
      level: batch.level,
    });
  }
}

async function notifyMany(
  frame: Frame,
  count: number,
  level: string,
  prefix: string = "Note",
): Promise<void> {
  await frame.evaluate(sendNotifications, { count, level, prefix });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function readBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Expected the element to have a box");
  }
  const roundedBox: Box = {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
  return roundedBox;
}

function separator(page: Page): Locator {
  return stageBar(page).locator("[data-slot=separator]");
}

function closeButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "Close" });
}

function theaterButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "Theater mode" });
}

function fullscreenButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "Fullscreen" });
}

/** The boxes of every button of the stage bar, and of its separators. */
async function readBarBoxes(page: Page): Promise<Box[]> {
  const boxes: Box[] = [];
  for (const button of await stageBar(page).getByRole("button").all()) {
    boxes.push(await readBox(button));
  }
  for (const barSeparator of await separator(page).all()) {
    boxes.push(await readBox(barSeparator));
  }
  return boxes;
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

function readAnimationName(element: Element): string {
  return getComputedStyle(element).animationName;
}

/** The animation of a level's icon: `stage-bar-flash` while it flashes. */
async function readFlash(page: Page, level: MessageLevelName): Promise<string> {
  return messageButton(page, level)
    .locator("[data-flash]")
    .evaluate(readAnimationName);
}

/** Replaces `navigator.clipboard.writeText` with one that records the text, where Playwright cannot grant the clipboard. */
const CLIPBOARD_RECORDER = `
globalThis.clipboardWrites = [];
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText(text) {
      globalThis.clipboardWrites.push(text);
      return Promise.resolve();
    },
  },
});
`;

function readRecordedClipboard(): string {
  const writes = (globalThis as { clipboardWrites?: string[] }).clipboardWrites;
  return writes?.at(-1) ?? "";
}

function readClipboard(): Promise<string> {
  return navigator.clipboard.readText();
}

/** Run in a mod's frame: counts the clicks its document receives in `globalThis.frameClicks`. */
const CLICK_RECORDER = `
globalThis.frameClicks = 0;
document.addEventListener("click", function countClick() {
  globalThis.frameClicks += 1;
});
`;

/** Run in a mod's frame: counts the keys its document receives in `globalThis.frameKeys`. */
const KEY_RECORDER = `
globalThis.frameKeys = 0;
document.addEventListener("keydown", function countKey() {
  globalThis.frameKeys += 1;
});
`;

function readFrameKeys(): number {
  return (globalThis as { frameKeys?: number }).frameKeys ?? -1;
}

async function countFrameKeys(frame: Frame): Promise<number> {
  return frame.evaluate(readFrameKeys);
}

function readActiveElementTag(): string {
  return document.activeElement?.tagName ?? "";
}

/** The tag of the element that has the focus in the app's page: `IFRAME` while a frame has it. */
async function readActiveTag(page: Page): Promise<string> {
  return page.evaluate(readActiveElementTag);
}

function readFrameClicks(): number {
  return (globalThis as { frameClicks?: number }).frameClicks ?? -1;
}

/** The clicks a mod's frame received since `CLICK_RECORDER` ran in it. */
async function countFrameClicks(frame: Frame): Promise<number> {
  return frame.evaluate(readFrameClicks);
}

/** Clicks near the bottom-left corner of a mod's frame, away from the stage bar's popovers and menus. */
async function clickInFrame(page: Page, title: string): Promise<void> {
  await page.evaluate(BLUR_RECORDER);
  const frameBox = await readBox(page.locator(`iframe[title="${title}"]`));
  await page.mouse.click(frameBox.x + 20, frameBox.y + frameBox.height - 20);
  await page.evaluate(fireMissingBlur);
}

/** Run in the app's page: records whether the window got a blur since, in `globalThis.windowBlurred`. */
const BLUR_RECORDER = `
globalThis.windowBlurred = false;
window.addEventListener("blur", function recordBlur() {
  globalThis.windowBlurred = true;
}, { once: true });
`;

/**
 * Run in the app's page after a click in a frame. Playwright's Firefox moves
 * the focus into the frame without the window's blur that Firefox fires
 * (checked by hand in desktop Firefox), so the blur is fired here when the
 * frame has the focus and none came. Chromium and WebKit fire their own.
 */
function fireMissingBlur(): void {
  const hasBlurred = (globalThis as { windowBlurred?: boolean }).windowBlurred;
  if (!hasBlurred && document.activeElement instanceof HTMLIFrameElement) {
    window.dispatchEvent(new Event("blur"));
  }
}

/** Run in the page: resolves once the element's animations, its opening zoom included, are over. */
async function finishAnimations(element: Element): Promise<void> {
  const endings: Promise<Animation>[] = [];
  for (const animation of element.getAnimations({ subtree: true })) {
    endings.push(animation.finished);
  }
  await Promise.all(endings);
}

/**
 * How far an item's producer label is from the item's left edge. Every item
 * keeps the place of the unread dot, so the offset is the same with or
 * without the mark.
 */
async function readLabelOffset(item: Locator): Promise<number> {
  const itemBox = await readBox(item);
  const labelBox = await readBox(item.locator("[data-producer]"));
  return labelBox.x - itemBox.x;
}

test.describe("One-row stage bar", function describeLayout(): void {
  test("Sample mod with its collection", async function ordersItems({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection([]);
    await openTypedProbe(page, files);
    const bar = stageBar(page);

    const items = [
      bar.getByRole("button", { name: "Mod: probe" }),
      bar.getByRole("button", { name: "Collection: Probe notes" }),
      bar.getByRole("button", { name: "Mosaic: Unsaved combination" }),
      moreActionsButton(page),
      messageButton(page, "Errors"),
      messageButton(page, "Warnings"),
      messageButton(page, "Notifications"),
      separator(page).first(),
      theaterButton(page),
      fullscreenButton(page),
      separator(page).last(),
      closeButton(page),
    ];
    const boxes: Box[] = [];
    for (const item of items) {
      boxes.push(await readBox(item));
    }
    const barBox = await readBox(bar);
    const barCenter = barBox.y + barBox.height / 2;
    for (const [index, box] of boxes.entries()) {
      if (index > 0) {
        expect(box.x).toBeGreaterThanOrEqual(boxes[index - 1].x);
      }
      expect(Math.abs(box.y + box.height / 2 - barCenter)).toBeLessThan(4);
    }
    const buttonHeight = boxes[2].height;
    expect(barBox.height).toBeLessThan(buttonHeight * 2);
    await expect(bar.getByRole("list")).toHaveCount(0);
  });

  test("Close button last", async function placesCloseLast({
    page,
  }): Promise<void> {
    await openProbe(page);

    await expect(separator(page)).toHaveCount(2);
    const closeBox = await readBox(closeButton(page));
    const separatorBox = await readBox(separator(page).last());
    const barBox = await readBox(stageBar(page));
    expect(separatorBox.x).toBeLessThan(closeBox.x);
    expect(
      barBox.x + barBox.width - (closeBox.x + closeBox.width),
    ).toBeLessThan(20);
  });
});

/** Opens the labels mosaic of the tiles mod, with `files` in place of its own, and waits for the mod's frame. */
async function openLabelsMosaic(
  page: Page,
  files = buildLabelsMosaicFiles(),
): Promise<void> {
  await serveTilesMod(page, files);
  await page.goto(`/${LABELS_MOSAIC_HASH}`);
}

test.describe("Combination capsules", function describeCapsules(): void {
  test("Labelled items on the tiles mod", async function showsCapsules({
    page,
  }): Promise<void> {
    await openLabelsMosaic(page);
    const bar = stageBar(page);
    await waitForProbe(await findModFrame(page, TILES_TITLE));

    const items = [
      bar.getByRole("button", { name: `Mod: ${TILES_TITLE}` }),
      bar.getByText("+", { exact: true }),
      bar.getByRole("button", { name: "Collection: Labelled tiles" }),
      bar.getByText("→", { exact: true }),
      bar.getByRole("button", { name: `Mosaic: ${LABELS_MOSAIC_TITLE}` }),
      moreActionsButton(page),
    ];
    const boxes: Box[] = [];
    for (const item of items) {
      boxes.push(await readBox(item));
    }
    for (const [index, box] of boxes.entries()) {
      if (index > 0) {
        expect(box.x).toBeGreaterThan(boxes[index - 1].x);
      }
    }
    await expect(items[1]).toHaveAttribute("aria-hidden", "true");
    await expect(items[3]).toHaveAttribute("aria-hidden", "true");
    const barBox = await readBox(bar);
    expect(barBox.height).toBeLessThan(boxes[0].height * 2);
  });

  test("Same icon in the sidebar and the stage bar", async function sharesIcons({
    page,
  }): Promise<void> {
    await openLabelsMosaic(page);
    const bar = stageBar(page);
    await waitForProbe(await findModFrame(page, TILES_TITLE));
    const pairs: [Locator, string][] = [
      [bar.getByRole("button", { name: /^Mod: / }), "Mods"],
      [bar.getByRole("button", { name: /^Collection: / }), "Tiles"],
      [bar.getByRole("button", { name: /^Mosaic: / }), "Mosaics"],
    ];

    for (const [capsuleButton, itemName] of pairs) {
      const capsuleDrawing = await capsuleButton
        .locator("svg")
        .first()
        .evaluate(readDrawing);
      const itemDrawing = await sectionItem(page, itemName)
        .locator("svg")
        .evaluate(readDrawing);
      expect(capsuleDrawing).toBe(itemDrawing);
    }
  });

  test("Unsaved combination", async function showsUnsaved({
    page,
  }): Promise<void> {
    await serveTilesMod(page, buildLabelsMosaicFiles());

    await page.goto(`/${TILES_COLLECTION_RUN_HASH}`);
    await waitForProbe(await findModFrame(page, TILES_TITLE));

    const mosaicCapsule = stageBar(page).getByRole("button", {
      name: "Mosaic: Unsaved combination",
    });
    await expect(mosaicCapsule).toBeVisible();
    await expect(mosaicCapsule).toHaveCSS("border-top-style", "dashed");
    await expect(stageBar(page)).not.toContainText(LABELS_MOSAIC_TITLE);
  });
});

test.describe("Mosaic name while loading or after a failure", function describeMosaicLoading(): void {
  test("Missing mosaic file", async function showsMosaicNotLoaded({
    page,
  }): Promise<void> {
    await openLabelsMosaic(page, {});

    await expect(stageBar(page)).toContainText("Mosaic not loaded");
    await expect(stageBar(page)).not.toContainText(TILES_VERSION);
  });

  test("Missing mod of a mosaic", async function showsModNotLoaded({
    page,
  }): Promise<void> {
    const files = buildLabelsMosaicFiles();
    files["mosaics/labels.yaml"] = [
      "mosaic:",
      `  title: "${LABELS_MOSAIC_TITLE}"`,
      '  mod: "../missing/"',
    ].join("\n");

    await openLabelsMosaic(page, files);

    await expect(stageBar(page)).toContainText(LABELS_MOSAIC_TITLE);
    await expect(stageBar(page)).toContainText("Mod not loaded");
  });
});

/** The open list's details page: its terms and their values. */
function detailsSection(page: Page): Locator {
  return page.locator("[data-slot=popover-content] dl[aria-label=Details]");
}

function detailsButton(page: Page): Locator {
  return page
    .locator("[data-slot=popover-content]")
    .getByRole("button", { name: "Details" });
}

/** Opens the labels mosaic's list and its details page. */
async function openMosaicDetails(page: Page): Promise<void> {
  await stageBar(page)
    .getByRole("button", { name: `Mosaic: ${LABELS_MOSAIC_TITLE}` })
    .click();
  await detailsButton(page).click();
  await expect(detailsSection(page)).toBeVisible();
}

/** Opens the labels mosaic's details page on a narrow bar, through the folded capsule's menu. */
async function openFoldedMosaicDetails(page: Page): Promise<void> {
  await stageBar(page)
    .getByRole("button", { name: `Combination: ${LABELS_MOSAIC_TITLE}` })
    .click();
  await page.getByRole("menuitem", { name: "Mosaic" }).click();
  await detailsButton(page).click();
  await expect(detailsSection(page)).toBeVisible();
}

/** Runs on an element: its background and text colors. */
function readButtonColors(element: Element): string[] {
  const style = getComputedStyle(element);
  const colors = [style.backgroundColor, style.color];
  return colors;
}

async function readLocatorColors(locator: Locator): Promise<string[]> {
  return locator.evaluate(readButtonColors);
}

/** Runs on an element: whether its content is wider than its box. */
function overflowsSideways(element: Element): boolean {
  return element.scrollWidth > element.clientWidth;
}

/** The pressed "Details" button has the accent background and foreground, readable together. */
async function expectPressedDetailsButton(page: Page): Promise<void> {
  await openLabelsMosaic(page);
  await waitForProbe(await findModFrame(page, TILES_TITLE));
  await openMosaicDetails(page);
  const button = detailsButton(page);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  // Away from the button, so its colors are the pressed ones, not the hover ones.
  await page.mouse.move(0, 0);
  const accent = await page.evaluate(readTokenAs, [
    "--ot-accent",
    "background-color",
  ]);
  const accentForeground = await page.evaluate(readTokenAs, [
    "--ot-accent-foreground",
    "color",
  ]);

  await expect
    .poll(readLocatorColors.bind(undefined, button))
    .toEqual([accent, accentForeground]);
  expect(readContrastRatio(accent, accentForeground)).toBeGreaterThanOrEqual(
    MINIMUM_TEXT_CONTRAST,
  );
}

test.describe("Details page", function describeDetails(): void {
  test("Mosaic details: copy and open the run link, then back", async function usesMosaicDetails({
    page,
    context,
    browserName,
  }): Promise<void> {
    const canGrantClipboard = browserName === "chromium";
    if (canGrantClipboard) {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } else {
      await page.addInitScript({ content: CLIPBOARD_RECORDER });
    }
    await openLabelsMosaic(page);
    await waitForProbe(await findModFrame(page, TILES_TITLE));
    const mosaicSource = new URL(LABELS_MOSAIC_PATH, page.url()).href;
    const runLink = new URL(LABELS_MOSAIC_HASH, page.url()).href;

    await openMosaicDetails(page);

    const details = detailsSection(page);
    expect(await details.locator("dd code").allTextContents()).toEqual([
      mosaicSource,
      runLink,
    ]);
    await details.getByRole("button", { name: "Copy run link" }).click();
    // The Details button's tooltip may still be fading out.
    await expect(page.getByRole("tooltip", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(
      canGrantClipboard ? readClipboard : readRecordedClipboard,
    );
    expect(copied).toBe(runLink);
    const open = details.getByRole("link", {
      name: "Open run link in a new tab",
    });
    await expect(open).toHaveAttribute("href", runLink);
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");

    await page
      .locator("[data-slot=popover-content]")
      .getByRole("option", { name: "Back" })
      .click();
    await expect(detailsSection(page)).toHaveCount(0);
    await expect(detailsButton(page)).toHaveAttribute("aria-pressed", "false");

    await detailsButton(page).click();
    await expect(detailsSection(page)).toBeVisible();
    await page.getByRole("combobox").press("Backspace");
    await expect(detailsSection(page)).toHaveCount(0);
  });

  test("Open the mosaic in its viewer", async function opensMosaicViewer({
    page,
    context,
  }): Promise<void> {
    await page.goto(NOBEL_MAP_MOSAIC_LINK);
    const mosaicSource = new URL(
      "./samples/mosaics/nobel_laureates_map.yaml",
      page.url(),
    ).href;
    const viewerLink = new URL(
      `#/run?mod=mosaic_viewer&target=${encodeURIComponent(mosaicSource)}`,
      page.url(),
    ).href;
    await stageBar(page)
      .getByRole("button", { name: `Mosaic: ${MAP_MOSAIC_TITLE}` })
      .click();
    await detailsButton(page).click();

    const open = detailsSection(page).getByRole("link", {
      name: "Open mosaic in the mosaic viewer",
    });
    await expect(open).toHaveAttribute("href", viewerLink);
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    const viewerPagePromise = context.waitForEvent("page");
    await open.click();
    const viewerPage = await viewerPagePromise;

    await expect(viewerPage).toHaveURL(viewerLink);
    await expect(
      viewerPage
        .frameLocator('iframe[title="Mosaic Viewer"]')
        .getByRole("heading", { name: MAP_MOSAIC_TITLE }),
    ).toBeVisible();
  });

  test("Details on a phone", async function fitsPhone({ page }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openLabelsMosaic(page);
    await waitForProbe(await findModFrame(page, TILES_TITLE));

    await openFoldedMosaicDetails(page);

    const list = page.locator("[data-slot=popover-content]");
    // The list zooms in as it opens, so its boxes are read once it settled.
    await list.evaluate(finishAnimations);
    const listBox = await list.evaluate(readElementBox);
    const toolbarItems = [
      page.getByRole("combobox"),
      list.getByRole("button", { name: "Sort" }),
      list.getByRole("button", { name: "Filter" }),
      detailsButton(page),
    ];
    const searchBox = await toolbarItems[0].evaluate(readElementBox);
    for (const item of toolbarItems) {
      const box = await item.evaluate(readElementBox);
      expect(box.left).toBeGreaterThanOrEqual(listBox.left);
      expect(box.right).toBeLessThanOrEqual(listBox.right);
      expect(
        Math.abs(
          box.top + box.height / 2 - (searchBox.top + searchBox.height / 2),
        ),
      ).toBeLessThan(4);
    }
    const runLink = detailsSection(page).locator("dd code").last();
    expect(await runLink.evaluate(countLines)).toBeGreaterThan(1);
    expect(await list.evaluate(overflowsSideways)).toBe(false);
    expect(await page.evaluate(canScrollSideways)).toBe(false);
    const controls = [
      detailsSection(page).getByRole("button", { name: "Copy run link" }),
      detailsSection(page).getByRole("link", {
        name: "Open run link in a new tab",
      }),
    ];
    for (const control of controls) {
      const box = await control.evaluate(readElementBox);
      expect(box.width).toBeGreaterThanOrEqual(32);
      expect(box.height).toBeGreaterThanOrEqual(32);
    }
  });

  test("Pressed Details button", async function pressesLight({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });

    await expectPressedDetailsButton(page);
  });

  test("Pressed Details button, dark color scheme", async function pressesDark({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });

    await expectPressedDetailsButton(page);
  });
});

test.describe("Stage bar beside the hamburger chip", function describeChip(): void {
  test.beforeEach(async function useWideViewport({ page }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Bar after the chip", async function startsAfterChip({
    page,
  }): Promise<void> {
    await openProbe(page);

    await hamburgerButton(page).click();

    await expect(hamburgerButton(page)).toHaveAccessibleName("Show sidebar");
    const chip = await readBox(hamburgerButton(page));
    const bar = await readBox(stageBar(page));
    const frame = await readBox(
      page.locator("[data-sandbox-id]:not([hidden]) iframe"),
    );
    expect(bar.x).toBeGreaterThan(chip.x + chip.width);
    expect(frame.x).toBeLessThan(chip.x + chip.width);
  });

  test("One row with the sidebar's heading row", async function sharesRow({
    page,
  }): Promise<void> {
    await openProbe(page);

    const row = await readBox(sidebarHeadingRow(page));
    const bar = await readBox(stageBar(page));

    expect(Math.abs(bar.y - row.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(bar.height - row.height)).toBeLessThanOrEqual(1);
  });
});

test.describe("One-row stage bar without a close button", function describeHomeLayout(): void {
  test("Home mod without a close button", async function placesFullscreenLast({
    page,
  }): Promise<void> {
    await page.goto(`${HOME_MOD_PREVIEW_URL}/`);
    await expect(fullscreenButton(page)).toBeVisible();

    await expect(closeButton(page)).toHaveCount(0);
    await expect(separator(page)).toHaveCount(1);
    const names: string[] = [];
    for (const button of await stageBar(page).getByRole("button").all()) {
      names.push((await button.getAttribute("aria-label")) ?? "");
    }
    expect(names.slice(-2)).toEqual(["Theater mode", "Fullscreen"]);
    const fullscreenBox = await readBox(fullscreenButton(page));
    const separatorBox = await readBox(separator(page));
    expect(separatorBox.x).toBeLessThan(fullscreenBox.x);
  });
});

test.describe("Theater mode button", function describeTheaterButton(): void {
  test("Turn theater mode on", async function turnsOn({ page }): Promise<void> {
    await openProbe(page);
    await expect(theaterButton(page)).toHaveAttribute("aria-pressed", "false");

    await theaterButton(page).click();

    await expect(theaterButton(page)).toHaveAttribute("aria-pressed", "true");
    // The click closed the tooltip: the pointer leaves and comes back. While
    // the closing tooltip is still mounted, leaving the button makes Radix
    // ignore the next pointer move, and Playwright's hover sends only one. So
    // the test waits until it is gone, and only a reopened tooltip can match.
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.mouse.move(0, 0);
    await theaterButton(page).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Theater mode");
  });
});

test.describe("Fullscreen button", function describeFullscreenButton(): void {
  test("Running mod", async function showsForRunning({ page }): Promise<void> {
    await openProbe(page);

    await expect(fullscreenButton(page)).toBeVisible();
    await fullscreenButton(page).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Fullscreen");
  });
});

test.describe("Each message names its producer", function describeProducers(): void {
  test("Message from the app", async function labelsAppMessage({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe", [], null));
    await page.goto(PROBE_LINK);
    await waitForProbe(await findModFrame(page, "probe"));

    await expectMessageCount(page, "Warnings", 1);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0].producer).toBe("App");
    expect(warnings[0].text).toContain('"api"');
  });

  test("Message from the mod", async function labelsModMessage({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    expect(await notify(frame, { message: "Saved", level: "warning" })).toEqual(
      { result: null },
    );

    await expectMessageCount(page, "Warnings", 1);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0]).toEqual({
      producer: "Mod",
      source: new URL("/test-mods/probe/mod_conf.yaml", page.url()).href,
      text: "Saved",
    });
  });
});

test.describe("Message buttons", function describeButtons(): void {
  test("Count grows", async function keepsSizes({ page }): Promise<void> {
    const frame = await openProbe(page);
    await expect(stageBar(page)).toContainText("probe");
    const boxesAtZero = await readBarBoxes(page);

    await notifyMany(frame, 7, "warning");
    await expect(messageCapsule(page, "Warnings")).toHaveText("7");
    const boxesAtSeven = await readBarBoxes(page);
    await notifyMany(frame, 100, "warning", "More");
    for (let index = 1; index <= 20; index += 1) {
      await frame.evaluate(
        showImage,
        `https://images${index}.example.net/cover.jpg`,
      );
    }
    await expectMessageCount(page, "Warnings", 120);
    await expect(messageCapsule(page, "Warnings")).toHaveText("99+");
    const boxesAtMany = await readBarBoxes(page);

    expect(boxesAtSeven).toEqual(boxesAtZero);
    expect(boxesAtMany).toEqual(boxesAtZero);
    const capsuleBox = await readBox(messageCapsule(page, "Warnings"));
    expect(
      overlaps(capsuleBox, await readBox(messageButton(page, "Notifications"))),
    ).toBe(false);
  });

  test("Capsule clear of the close button", async function keepsCapsuleClear({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await notifyMany(frame, 100, "info");

    await expect(messageCapsule(page, "Notifications")).toHaveText("99+");
    const capsuleBox = await readBox(messageCapsule(page, "Notifications"));
    expect(overlaps(capsuleBox, await readBox(separator(page).first()))).toBe(
      false,
    );
    expect(overlaps(capsuleBox, await readBox(closeButton(page)))).toBe(false);
  });

  test("Keyboard reaches an empty level", async function focusesEmptyLevel({
    page,
  }): Promise<void> {
    await openProbe(page);
    await messageButton(page, "Errors").focus();

    await page.keyboard.press("Tab");

    await expect(messageButton(page, "Warnings")).toBeFocused();
    await expect(messageButton(page, "Warnings")).toHaveAttribute("data-empty");
  });
});

test.describe("Message popovers", function describePopoverOrder(): void {
  test("Errors popover", async function listsNewestErrorFirst({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection(["./missing.md"]);
    const frame = await openTypedProbe(page, files);

    await notify(frame, { message: "Broken", level: "error" });

    await expectMessageCount(page, "Errors", 2);
    const errors = await readMessages(page, "Errors");
    expect(errors[0]).toMatchObject({ producer: "Mod", text: "Broken" });
    expect(errors[1].producer).toBe("App");
    expect(errors[1].source).toContain("/test-mods/missing.md");
    expect(await readMessages(page, "Warnings")).toEqual([]);
  });
});

test.describe("Unread items stand out", function describeUnreadItems(): void {
  test("Marks do not move items", async function keepsItemsInPlace({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    await expectMessages(page, "Warnings", "First");
    await notify(frame, { message: "Second", level: "warning" });

    const popover = await openMessages(page, "Warnings");

    await expect(unreadItems(popover)).toHaveCount(1);
    await popover.evaluate(finishAnimations);
    const items = popover.getByRole("listitem");
    expect(await readLabelOffset(items.nth(0))).toBe(
      await readLabelOffset(items.nth(1)),
    );
  });
});

test.describe("New messages draw attention", function describeAttention(): void {
  test(
    "Blocked request flashes",
    { tag: "@frames" },
    async function flashes({ page }): Promise<void> {
      const frame = await openProbe(page);

      await frame.evaluate(showImage, "https://images.example.net/cover.jpg");

      await expectMessageCount(page, "Warnings", 1);
      expect(await readFlash(page, "Warnings")).toBe("stage-bar-flash");
      await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
        "data-capsule",
        "unread",
      );
    },
  );

  test("Reduced motion", async function staysStill({ page }): Promise<void> {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const frame = await openProbe(page);

    await notify(frame, { message: "Slow", level: "warning" });

    await expectMessageCount(page, "Warnings", 1);
    expect(await readFlash(page, "Warnings")).toBe("none");
    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "unread",
    );
  });
});

test.describe("Dismiss notifications", function describeDismiss(): void {
  test("Popover over a running mod receives clicks", async function clicksOverFrame({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "Saved" });
    await expectMessageCount(page, "Notifications", 1);
    const popover = await openMessages(page, "Notifications");
    const frameBox = await readBox(page.locator('iframe[title="probe"]'));
    expect(overlaps(await readBox(popover), frameBox)).toBe(true);

    await popover.getByRole("button", { name: /^Dismiss: / }).click();

    await expect(popover).toContainText("No notifications.");
  });
});

test.describe("More actions menu", function describeMoreActions(): void {
  test("Copy the link", async function copiesLink({
    page,
    context,
    browserName,
  }): Promise<void> {
    const canGrantClipboard = browserName === "chromium";
    if (canGrantClipboard) {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } else {
      await page.addInitScript({ content: CLIPBOARD_RECORDER });
    }
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection([]);
    await openTypedProbe(page, files);
    const menu = await openMoreActions(page);

    await menu.getByRole("menuitem", { name: "Copy link" }).click();

    await expect(moreActionsMenu(page)).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toContainText("Link copied");
    await expect(moreActionsButton(page)).toHaveAccessibleName("More actions");
    await expect(stageBar(page).locator("[aria-live=polite]")).toContainText(
      "Link copied",
    );
    const copied = await page.evaluate(
      canGrantClipboard ? readClipboard : readRecordedClipboard,
    );
    const { origin, pathname, search } = new URL(page.url());
    expect(copied).toBe(
      `${origin}${pathname}${search}${new URL(page.url()).hash}`,
    );
    expect(copied).toContain("#/run?mod=");
  });
});

test.describe(
  "Popovers and menus close on a click outside",
  { tag: "@frames" },
  function describeClickOutside(): void {
    test("Click in the mod's frame", async function closesPopover({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(CLICK_RECORDER);
      await notify(frame, { message: "Saved" });
      await openMessages(page, "Notifications");

      await clickInFrame(page, "probe");

      await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
      await expect.poll(countFrameClicks.bind(undefined, frame)).toBe(1);
      await expect(messageCapsule(page, "Notifications")).toHaveAttribute(
        "data-capsule",
        "read",
      );
    });

    test("The mod keeps the keyboard", async function keepsFocusInFrame({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(KEY_RECORDER);
      await notify(frame, { message: "Saved" });
      await openMessages(page, "Notifications");

      await clickInFrame(page, "probe");
      await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
      await page.keyboard.press("a");

      await expect.poll(readActiveTag.bind(undefined, page)).toBe("IFRAME");
      await expect.poll(countFrameKeys.bind(undefined, frame)).toBe(1);
    });

    test("Share menu", async function closesMoreActions({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(CLICK_RECORDER);
      await openMoreActions(page);

      await clickInFrame(page, "probe");

      await expect(moreActionsMenu(page)).toHaveCount(0);
      await expect.poll(countFrameClicks.bind(undefined, frame)).toBe(1);
    });

    test("Mod list", async function closesModList({ page }): Promise<void> {
      const files = buildTypedProbeFiles();
      files["collection.yaml"] = buildNoteCollection([]);
      const frame = await openTypedProbe(page, files);
      await frame.evaluate(CLICK_RECORDER);
      await stageBar(page).getByRole("button", { name: "Mod: probe" }).click();
      await expect(page.getByRole("combobox")).toBeFocused();

      await clickInFrame(page, "probe");

      await expect(page.getByRole("combobox")).toHaveCount(0);
      await expect.poll(countFrameClicks.bind(undefined, frame)).toBe(1);
      await expect.poll(readActiveTag.bind(undefined, page)).toBe("IFRAME");
    });

    test("Sort menu of the mod list", async function closesSortMenu({
      page,
    }): Promise<void> {
      const files = buildTypedProbeFiles();
      files["collection.yaml"] = buildNoteCollection([]);
      const frame = await openTypedProbe(page, files);
      await frame.evaluate(CLICK_RECORDER);
      await stageBar(page).getByRole("button", { name: "Mod: probe" }).click();
      await page.getByRole("button", { name: "Sort" }).click();
      await expect(page.getByRole("menu")).toBeVisible();

      await clickInFrame(page, "probe");

      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(page.getByRole("combobox")).toHaveCount(0);
      await expect.poll(countFrameClicks.bind(undefined, frame)).toBe(1);
    });
  },
);

test.describe("The app's notifications", function describeAppNotifications(): void {
  test("Reload done, then reload failed", async function notifiesReload({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection([]);
    await openTypedProbe(page, files);
    await expectMessageCount(page, "Notifications", 1);
    files["collection.yaml"] = buildNoteCollection(["./second.md"]);

    await reloadTiles(page);

    await expectMessageCount(page, "Notifications", 2);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("App");
    expect(notifications[0].text).toContain("2 tiles");
    expect(notifications[0].text).toContain("0 collection issues");
    delete files["collection.yaml"];
    await reloadTiles(page);
    await expectMessageCount(page, "Errors", 1);
    await expectMessages(
      page,
      "Errors",
      new URL("/test-mods/collection.yaml", page.url()).href,
    );
    await expectMessageCount(page, "Notifications", 2);
  });

  test("Escape", async function notifiesEscape({ page }): Promise<void> {
    await serveForeignMod(page, buildProbeFiles("probe", SHOW_COVERS_LINES));
    await page.goto(
      `/#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`,
    );
    await expect(siteConsentDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expectMessageCount(page, "Notifications", 1);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].text).toContain(
      `Refused to let the mod show content from ${COVER_HOST}`,
    );
    expect(notifications[0].text).toContain("The answer is not remembered.");
  });
});

test.describe("Messages from the mod in the stage bar", function describeModMessages(): void {
  test(
    "Hidden mod notifies",
    { tag: "@frames" },
    async function keepsHiddenMessage({ page }): Promise<void> {
      await serveAppOriginMod(page, {
        ...buildProbeFiles("probe"),
        ...buildProbeFiles("other"),
      });
      await page.goto(PROBE_LINK);
      const frame = await findModFrame(page, "probe");
      await waitForProbe(frame);
      await followLink(page, "#/run?mod=./test-mods/other/");
      await expect(stageBar(page)).toContainText("other");

      expect(await notify(frame, { message: "Done" })).toEqual({
        result: null,
      });

      await expect(messageButton(page, "Notifications")).toHaveAttribute(
        "data-empty",
      );
      await page.goBack();
      await expect(stageBar(page)).toContainText("probe");
      await expectMessages(page, "Notifications", "Done");
      await expect(messagePopover(page, "Notifications")).toHaveCount(0);
    },
  );
});

/*
 * The swap flows and the width ladder run on the e2e build whose catalog
 * lists the tiles mod and the labels mosaic. The typed probe and its notes
 * are recently used, so the lists also offer them, marked with the ring.
 */

/** The typed probe's mod file and its notes collection, on the test catalog's origin. */
const PROBE_SOURCE = `${TEST_CATALOG_PREVIEW_URL}/test-mods/probe/mod_conf.yaml`;
const NOTES_SOURCE = `${TEST_CATALOG_PREVIEW_URL}/test-mods/collection.yaml`;
const LABELS_MOSAIC_SOURCE = `${TEST_CATALOG_PREVIEW_URL}${LABELS_MOSAIC_PATH}`;

/** Runs in the page before the app: the typed probe and its notes are recently used. */
function storeRecentProbe(sources: { mod: string; collection: string }): void {
  localStorage.setItem(
    "opentesela.recently-used",
    JSON.stringify({
      mods: [sources.mod],
      collections: [sources.collection],
      mosaics: [],
      combinations: [],
    }),
  );
}

/** The labels mosaic, the tiles mod and the typed probe with its notes, with the mosaic's `show` line. */
function buildSwapFiles(): ModFiles {
  const files: ModFiles = {
    ...buildLabelsMosaicFiles(),
    ...buildTypedProbeFiles(),
    "collection.yaml": buildNoteCollection([]),
  };
  files["mosaics/labels.yaml"] = [
    files["mosaics/labels.yaml"],
    "  permissions:",
    "    show:",
    `      - host: "${COVER_HOST}"`,
    '        reason: "Shows the labels\' images"',
  ].join("\n");
  return files;
}

/** Opens the labels mosaic on the test catalog's app, with the probe recently used, and waits for the tiles mod. */
async function openSwapMosaic(
  page: Page,
  files: ModFiles = buildSwapFiles(),
): Promise<void> {
  await page.addInitScript(storeRecentProbe, {
    mod: PROBE_SOURCE,
    collection: NOTES_SOURCE,
  });
  await serveTilesMod(page, files);
  await page.goto(`${TEST_CATALOG_PREVIEW_URL}/${LABELS_MOSAIC_HASH}`);
  await waitForProbe(await findModFrame(page, TILES_TITLE));
}

function capsule(page: Page, name: string | RegExp): Locator {
  return stageBar(page).getByRole("button", { name });
}

/** Opens the list of the capsule `name`, and chooses the entry that says `text`. */
async function chooseInList(
  page: Page,
  name: string,
  text: string,
): Promise<void> {
  await capsule(page, name).click();
  const list = page.locator("[data-slot=popover-content]");
  await list.getByRole("option").filter({ hasText: text }).click();
  await expect(list).toHaveCount(0);
}

function readRunParams(page: Page): URLSearchParams {
  const hash = new URL(page.url()).hash;
  const params = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));
  return params;
}

/** Chooses the probe in the mosaic's mod list and waits for its frame. */
async function swapToProbe(page: Page): Promise<void> {
  await chooseInList(page, `Mod: ${TILES_TITLE}`, "probe");
  await waitForProbe(await findModFrame(page, "probe"));
}

test.describe("Swapping combinations", function describeSwaps(): void {
  test("Book List on the laureates' map data", async function swapsMod({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);

    await swapToProbe(page);

    const params = readRunParams(page);
    expect(params.get("mod")).toBe(PROBE_SOURCE);
    expect(params.get("sites")).toBe(LABELS_MOSAIC_SOURCE);
    expect(params.get("mosaic")).toBeNull();
    await expect(capsule(page, "Collection: Labelled tiles")).toBeVisible();
    await expect(capsule(page, "Mosaic: Unsaved combination")).toBeVisible();
  });

  test("Kept covers, then Stop using them", async function keepsSites({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);
    await swapToProbe(page);

    const chip = capsule(page, `Sites from ${LABELS_MOSAIC_TITLE}`);
    await expect(chip).toHaveText("1");
    await chip.click();
    const popover = page.locator("[data-slot=popover-content]");
    await expect(popover).toContainText(COVER_HOST);
    await expect(popover).toContainText("Granted");
    await popover
      .getByRole("button", { name: "Stop using these sites" })
      .click();
    await waitForProbe(await findModFrame(page, "probe"));

    expect(readRunParams(page).get("sites")).toBeNull();
    expect(readRunParams(page).get("mod")).toBe(PROBE_SOURCE);
    await expect(
      stageBar(page).getByRole("button", { name: /^Sites from / }),
    ).toHaveCount(0);
  });

  test("Back to the previous combination", async function goesBack({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);
    await swapToProbe(page);

    await page.goBack();

    await expect(capsule(page, `Mosaic: ${LABELS_MOSAIC_TITLE}`)).toBeVisible();
    await waitForProbe(await findModFrame(page, TILES_TITLE));
    expect(readRunParams(page).get("mosaic")).not.toBeNull();
  });

  test("Other collection for the same mod, then None", async function swapsCollection({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);
    await swapToProbe(page);

    await chooseInList(page, "Collection: Labelled tiles", "Probe notes");
    await waitForProbe(await findModFrame(page, "probe"));

    expect(readRunParams(page).get("sites")).toBeNull();
    expect(readRunParams(page).get("collection")).toBe(NOTES_SOURCE);
    await expect(capsule(page, "Collection: Probe notes")).toBeVisible();

    await chooseInList(page, "Collection: Probe notes", "None");
    await waitForProbe(await findModFrame(page, "probe"));

    expect(readRunParams(page).get("collection")).toBeNull();
    await expect(capsule(page, "Collection: None")).toBeVisible();
  });

  test("Other combination", async function swapsMosaic({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);
    await swapToProbe(page);
    await chooseInList(page, "Collection: Labelled tiles", "Probe notes");
    await waitForProbe(await findModFrame(page, "probe"));

    await chooseInList(
      page,
      "Mosaic: Unsaved combination",
      LABELS_MOSAIC_TITLE,
    );
    await waitForProbe(await findModFrame(page, TILES_TITLE));

    await expect(capsule(page, `Mod: ${TILES_TITLE}`)).toBeVisible();
    await expect(capsule(page, "Collection: Labelled tiles")).toBeVisible();
    await expect(capsule(page, `Mosaic: ${LABELS_MOSAIC_TITLE}`)).toBeVisible();
  });
});

/** Gives the stage bar `width` pixels, as a window of that size would. */
async function setBarWidth(page: Page, width: number): Promise<void> {
  await stageBar(page).evaluate(applyBarWidth, width);
}

function applyBarWidth(bar: HTMLElement, width: number): void {
  bar.style.width = `${width}px`;
  bar.style.alignSelf = "flex-start";
}

/** Runs on an icon: its drawing, the markup inside its `<svg>`. */
function readDrawing(element: Element): string {
  return element.innerHTML;
}

/** Whether an element's text is cut: wider than its box. */
function isCut(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth;
}

/** The title of a capsule: its first text, after the icon. */
function capsuleTitle(page: Page, name: string): Locator {
  return capsule(page, name).locator("span").first();
}

/** How far the close button's right edge is from the bar's. */
async function readCloseOffset(page: Page): Promise<number> {
  const barBox = await readBox(stageBar(page));
  const closeBox = await readBox(closeButton(page));
  return barBox.x + barBox.width - (closeBox.x + closeBox.width);
}

const MOD_CAPSULE = `Mod: ${TILES_TITLE}`;
const MOSAIC_CAPSULE = `Mosaic: ${LABELS_MOSAIC_TITLE}`;
const COLLECTION_CAPSULE = "Collection: Labelled tiles";

test.describe("The bar folds as it narrows", function describeLadder(): void {
  test("Long collection title", async function cutsCollection({
    page,
  }): Promise<void> {
    const longTitle =
      "Labelled tiles of a collection whose title is much longer than a capsule";
    const files = buildSwapFiles();
    files[LABELS_COLLECTION_FILE] = buildLabelsCollection().replace(
      "Labelled tiles",
      longTitle,
    );
    await openSwapMosaic(page, files);
    await setBarWidth(page, 1100);
    const collectionName = `Collection: ${longTitle}`;

    const collectionTitle = capsuleTitle(page, collectionName);
    expect(await collectionTitle.evaluate(isCut)).toBe(true);
    expect(await capsuleTitle(page, MOD_CAPSULE).evaluate(isCut)).toBe(false);
    expect(await capsuleTitle(page, MOSAIC_CAPSULE).evaluate(isCut)).toBe(
      false,
    );
    expect(
      (await readBox(capsule(page, collectionName))).width,
    ).toBeLessThanOrEqual(256);
    await capsule(page, collectionName).hover();
    await expect(page.getByRole("tooltip")).toContainText(longTitle);
  });

  test("Each step of the ladder", async function foldsBar({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);

    await setBarWidth(page, 1100);
    await expect(capsuleTitle(page, MOD_CAPSULE)).toBeVisible();
    await expect(capsule(page, MOD_CAPSULE)).not.toContainText(TILES_VERSION);
    const wideOffset = await readCloseOffset(page);

    await setBarWidth(page, 800);
    await expect(capsuleTitle(page, MOD_CAPSULE)).toBeVisible();
    await expect(capsule(page, MOD_CAPSULE)).not.toContainText(TILES_VERSION);
    expect(await readCloseOffset(page)).toBe(wideOffset);

    await setBarWidth(page, 600);
    await expect(capsuleTitle(page, MOD_CAPSULE)).toBeHidden();
    await expect(capsuleTitle(page, COLLECTION_CAPSULE)).toBeHidden();
    await expect(capsule(page, MOD_CAPSULE)).toBeVisible();
    await expect(capsule(page, COLLECTION_CAPSULE)).toBeVisible();
    await expect(capsuleTitle(page, MOSAIC_CAPSULE)).toBeVisible();
    expect(await readCloseOffset(page)).toBe(wideOffset);

    await setBarWidth(page, 400);
    await expect(capsule(page, MOSAIC_CAPSULE)).toBeHidden();
    const folded = capsule(page, `Combination: ${LABELS_MOSAIC_TITLE}`);
    await expect(folded).toBeVisible();
    expect(await readCloseOffset(page)).toBe(wideOffset);
  });

  test("Folding follows the space left", async function foldsBesideChip({
    page,
  }): Promise<void> {
    // The chip and the gaps around it leave 600px to the bar.
    await page.setViewportSize({ width: 672, height: 800 });
    await openSwapMosaic(page);

    await hamburgerButton(page).click();

    await expect(hamburgerButton(page)).toHaveAccessibleName("Show sidebar");
    expect((await readBox(stageBar(page))).width).toBe(600);
    await expect(capsuleTitle(page, MOD_CAPSULE)).toBeHidden();
    await expect(capsuleTitle(page, COLLECTION_CAPSULE)).toBeHidden();
    await expect(capsule(page, MOD_CAPSULE)).toBeVisible();
    await expect(capsule(page, COLLECTION_CAPSULE)).toBeVisible();
  });

  test("Phone width", async function opensFoldedMenu({ page }): Promise<void> {
    await openSwapMosaic(page);
    await setBarWidth(page, 400);

    await capsule(page, `Combination: ${LABELS_MOSAIC_TITLE}`).click();
    await page.getByRole("menuitem", { name: "Collection" }).click();

    const list = page.locator("[data-slot=popover-content]");
    await expect(list.getByRole("option").first()).toHaveText("None");
    await expect(page.getByRole("combobox")).toBeFocused();
    await expectUnder(
      list,
      capsule(page, `Combination: ${LABELS_MOSAIC_TITLE}`),
    );
  });
});

/** Checks that `list` opens right under `trigger`, starting at its left edge. */
async function expectUnder(list: Locator, trigger: Locator): Promise<void> {
  await expect(list).toBeVisible();
  // The list zooms in as it opens, so its box is read once it settled.
  await list.evaluate(finishAnimations);
  const listBox = await readBox(list);
  const triggerBox = await readBox(trigger);
  expect(Math.abs(listBox.x - triggerBox.x)).toBeLessThan(4);
  expect(listBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
  expect(listBox.y).toBeLessThan(triggerBox.y + triggerBox.height + 16);
}

test.describe("Each capsule opens a list", function describeListPlace(): void {
  test("Each list opens under its capsule", async function opensUnder({
    page,
  }): Promise<void> {
    await openSwapMosaic(page);
    await setBarWidth(page, 1100);
    const list = page.locator("[data-slot=popover-content]");

    for (const name of [MOD_CAPSULE, COLLECTION_CAPSULE, MOSAIC_CAPSULE]) {
      await capsule(page, name).click();
      await expectUnder(list, capsule(page, name));
      await page.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }
  });
});

/** A Flashcards sandbox on the laureates, from a run link of the vanilla app's samples. */
const FLASHCARDS_LAUREATES_LINK =
  "/#/run?mod=./samples/mods/flashcards&collection=./samples/tiles/literature_nobel_laureates/collection.yaml";
const BOOKS_MOSAIC_LINK =
  "/#/run?mosaic=./samples/mosaics/nobel_books_list.yaml";
const LAUREATES_TITLE = "Nobel Prize in Literature laureates";
const MAP_MOSAIC_TITLE = "Nobel laureates on the map";

function openList(page: Page): Locator {
  return page.locator("[data-slot=popover-content]");
}

function listOption(page: Page, text: string): Locator {
  return openList(page).getByRole("option").filter({ hasText: text });
}

/** The titles of the open list's rows, in order. */
async function readOptionTitles(page: Page): Promise<string[]> {
  return openList(page)
    .locator("[cmdk-item] [data-column=title] > span:first-child")
    .allTextContents();
}

async function openSampleSandbox(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await expect(
    stageBar(page).getByRole("button", { name: /^Collection: / }),
  ).toBeVisible();
}

async function openModList(page: Page): Promise<void> {
  await stageBar(page)
    .getByRole("button", { name: /^Mod: / })
    .click();
  await expect(page.getByRole("combobox")).toBeFocused();
}

const NOBEL_MAP_MOSAIC_LINK =
  "/#/run?mosaic=./samples/mosaics/nobel_laureates_map.yaml";

/** The computed colors of a highlighted row's alias and background, and of `--ot-accent-foreground`. */
interface HighlightColors {
  aliasColor: string;
  rowBackground: string;
  accentForeground: string;
}

/** Runs on a row's alias: its color, its row's background and the accent's foreground. */
function readHighlightColors(alias: Element): HighlightColors {
  const row = alias.closest("[cmdk-item]");
  if (row === null) {
    throw new Error("Expected the alias to be inside a list row");
  }
  const probe = document.createElement("div");
  probe.style.color = "var(--ot-accent-foreground)";
  document.body.append(probe);
  const colors: HighlightColors = {
    aliasColor: getComputedStyle(alias).color,
    rowBackground: getComputedStyle(row).backgroundColor,
    accentForeground: getComputedStyle(probe).color,
  };
  probe.remove();
  return colors;
}

/** Whether the alias is drawn in `--ot-accent-foreground`, once the row's highlight settled. */
async function readAliasMatchesAccent(alias: Locator): Promise<boolean> {
  const colors = await alias.evaluate(readHighlightColors);
  return colors.aliasColor === colors.accentForeground;
}

/** The contrast of the alias with its row's background, or `0` while they cannot be read. */
async function readAliasContrast(alias: Locator): Promise<number> {
  const colors = await alias.evaluate(readHighlightColors);
  if (colors.aliasColor === "" || colors.rowBackground === "") {
    return 0;
  }
  return readContrastRatio(colors.aliasColor, colors.rowBackground);
}

/** Opens the Nobel map mosaic's list, with its own row highlighted, and checks its aliases' colors. */
async function expectReadableAliases(page: Page): Promise<void> {
  await page.goto(NOBEL_MAP_MOSAIC_LINK);
  await stageBar(page)
    .getByRole("button", { name: `Mosaic: ${MAP_MOSAIC_TITLE}` })
    .click();
  // The mosaic's own row is the current one: other rows can name it too.
  const row = openList(page).locator('[cmdk-item][aria-current="true"]');
  await expect(row).toContainText(MAP_MOSAIC_TITLE);
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(row.locator("[data-column=score]")).toHaveText("17/17");
  // The pointer highlights the row too, and stops the list's settling, so its rows stay.
  await row.hover();
  await expect(row).toHaveAttribute("aria-selected", "true");

  for (const aliasText of ["title <- name", "country <- birth_country"]) {
    const alias = row.getByText(aliasText, { exact: true });
    await expect.poll(readAliasMatchesAccent.bind(undefined, alias)).toBe(true);
    await expect
      .poll(readAliasContrast.bind(undefined, alias))
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  }
}

test.describe("Combination lists", function describeCombinationLists(): void {
  test("Aliases of a highlighted mosaic", async function readsHighlightedLight({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });

    await expectReadableAliases(page);
  });

  test("Aliases of a highlighted mosaic, dark color scheme", async function readsHighlightedDark({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });

    await expectReadableAliases(page);
  });

  test("Default order and columns", async function ordersEntries({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);

    await openModList(page);

    await expect
      .poll(readOptionTitles.bind(undefined, page))
      .toEqual(["Country Map", "Book List", "Flashcards"]);
    const flashcards = listOption(page, "Flashcards");
    await expect(
      flashcards.getByRole("img", { name: "Current" }),
    ).toBeVisible();
    await expect(flashcards).toHaveAttribute("aria-current", "true");
    await expect(flashcards).toHaveAttribute("aria-selected", "true");
    const countryMap = listOption(page, "Country Map");
    await expect(
      countryMap.getByRole("img", { name: "1 mosaic" }),
    ).toBeVisible();
    await expect(countryMap.locator("[data-column=score]")).toHaveText("17/17");
    const countryTitle = await readBox(
      countryMap.locator("[data-column=title]"),
    );
    const flashcardsTitle = await readBox(
      flashcards.locator("[data-column=title]"),
    );
    expect(countryTitle.x).toBe(flashcardsTitle.x);
    const countryScore = await readBox(
      countryMap.locator("[data-column=score]"),
    );
    const flashcardsScore = await readBox(
      flashcards.locator("[data-column=score]"),
    );
    expect(countryScore.x + countryScore.width).toBe(
      flashcardsScore.x + flashcardsScore.width,
    );
  });

  test("Country Map's page: its mosaic with aliases, then Without a mosaic", async function opensCountryMapPage({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await openModList(page);

    await listOption(page, "Country Map").click();

    await expect(
      openList(page).getByRole("option", { name: "Back to Country Map" }),
    ).toBeVisible();
    await expect(
      listOption(page, MAP_MOSAIC_TITLE).locator("[data-column=score]"),
    ).toHaveText("17/17");
    await expect(
      listOption(page, "Without a mosaic").locator("[data-column=score]"),
    ).toHaveText("0/17");

    await listOption(page, MAP_MOSAIC_TITLE).click();

    await expect(
      stageBar(page).getByRole("button", {
        name: `Mosaic: ${MAP_MOSAIC_TITLE}`,
      }),
    ).toBeVisible();
  });

  test("Without a mosaic: Country Map with the laureates, and no mosaic", async function choosesWithoutMosaic({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await openModList(page);
    await listOption(page, "Country Map").click();

    await listOption(page, "Without a mosaic").click();

    await expect(
      stageBar(page).getByRole("button", { name: /^Mod: Country Map/ }),
    ).toBeVisible();
    const params = readRunParams(page);
    expect(params.get("mosaic")).toBeNull();
    expect(params.get("collection")).toContain("literature_nobel_laureates");
  });

  test("Search through mosaics: laureates on", async function searchesMosaics({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await openModList(page);

    await page.keyboard.type("laureates on");

    await expect
      .poll(readOptionTitles.bind(undefined, page))
      .toEqual(["Country Map"]);
    const countryMap = listOption(page, "Country Map");
    await expect(countryMap).toContainText(MAP_MOSAIC_TITLE);
    await expect(
      countryMap.getByRole("img", { name: "1 of 1 mosaics match" }),
    ).toBeVisible();
    await countryMap.click();
    await expect(page.getByRole("combobox")).toHaveValue("laureates on");
    await expect(listOption(page, "Without a mosaic")).toHaveCount(0);
  });

  test("Sort by Name: kept for the next sandbox, reset by a reload", async function keepsSort({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await openModList(page);
    await page.getByRole("button", { name: "Sort" }).click();
    await page.getByRole("menuitemradio", { name: "Name" }).click();
    await expect
      .poll(readOptionTitles.bind(undefined, page))
      .toEqual(["Book List", "Country Map", "Flashcards"]);

    await listOption(page, "Book List").click();
    await expect(openList(page)).toHaveCount(0);
    await expect(
      stageBar(page).getByRole("button", { name: /^Mod: Book List/ }),
    ).toBeVisible();
    await openModList(page);
    await expect
      .poll(readOptionTitles.bind(undefined, page))
      .toEqual(["Book List", "Country Map", "Flashcards"]);

    await page.reload();
    await openModList(page);
    await expect
      .poll(readOptionTitles.bind(undefined, page))
      .toEqual(["Country Map", "Book List", "Flashcards"]);
  });

  test("Tried combination in the mosaic list after a reload", async function listsTriedCombination({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await expect.poll(readStoredCombinationCount.bind(undefined, page)).toBe(1);
    await page.goto(BOOKS_MOSAIC_LINK);
    await page.reload();
    await expect(
      stageBar(page).getByRole("button", {
        name: "Mosaic: Books by Nobel laureates",
      }),
    ).toBeVisible();

    await stageBar(page)
      .getByRole("button", { name: "Mosaic: Books by Nobel laureates" })
      .click();

    const tried = listOption(page, `Flashcards + ${LAUREATES_TITLE}`);
    await expect(tried).toContainText("Unsaved combination");
    await expect(
      tried.getByRole("img", { name: "Tried recently, not saved in the app" }),
    ).toBeVisible();
  });

  test("Hovering the mod capsule requests the tile type files", async function measuresOnHover({
    page,
  }): Promise<void> {
    const requested: string[] = [];
    page.on("request", recordRequest.bind(undefined, requested));
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await expect(
      stageBar(page).getByRole("button", { name: /^Mod: Flashcards/ }),
    ).toBeVisible();
    expect(hasCountryTypeFile(requested)).toBe(false);

    await stageBar(page)
      .getByRole("button", { name: /^Mod: / })
      .hover();

    await expect.poll(hasCountryTypeFile.bind(undefined, requested)).toBe(true);
    await expect(openList(page)).toHaveCount(0);
  });
});

function readCombinationCount(): number {
  const stored: unknown = JSON.parse(
    localStorage.getItem("opentesela.recently-used") ?? "{}",
  );
  const combinations = (stored as { combinations?: unknown[] }).combinations;
  return combinations?.length ?? 0;
}

/** How many tried combinations the app stored as recently used. */
function readStoredCombinationCount(page: Page): Promise<number> {
  return page.evaluate(readCombinationCount);
}

function recordRequest(requested: string[], request: Request): void {
  requested.push(request.url());
}

function isCountryTypeFile(url: string): boolean {
  return url.endsWith("/samples/mods/country_map/country_tile_type.md");
}

function hasCountryTypeFile(requested: readonly string[]): boolean {
  for (const url of requested) {
    if (isCountryTypeFile(url)) {
      return true;
    }
  }
  return false;
}

/** The messages button of a narrow bar, whose accessible name starts with `Messages: `. */
function messagesButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: /^Messages: / });
}

/** The open messages popover of a narrow bar. */
function messagesPopover(page: Page): Locator {
  return page.locator("[data-slot=popover-content]");
}

/** The texts of the headings of the open messages popover, in order. */
async function readGroupHeadings(page: Page): Promise<string[]> {
  return messagesPopover(page).getByRole("heading").allTextContents();
}

/** The texts of a group's items, newest first, as the popover lists them. */
async function readGroupTexts(page: Page, level: string): Promise<string[]> {
  return messagesPopover(page)
    .getByRole("list", { name: level })
    .locator("li div > span")
    .allTextContents();
}

/** Runs in the app's page: whether the page can scroll sideways. */
function canScrollSideways(): boolean {
  const root = document.documentElement;
  return root.scrollWidth > root.clientWidth;
}

/** Sets the bar's content box, which its container queries and its narrow form compare, to `width` pixels. */
async function setBarContentWidth(page: Page, width: number): Promise<void> {
  await stageBar(page).evaluate(applyBarContentWidth, width);
}

function applyBarContentWidth(bar: HTMLElement, width: number): void {
  bar.style.boxSizing = "content-box";
  bar.style.width = `${width}px`;
  bar.style.alignSelf = "flex-start";
}

/** The accessible names of the bar's buttons after "More actions": its right side. */
async function readRightSideNames(page: Page): Promise<string[]> {
  const names: string[] = [];
  let isRightSide = false;
  for (const button of await stageBar(page).getByRole("button").all()) {
    const name = (await button.getAttribute("aria-label")) ?? "";
    if (isRightSide) {
      names.push(name);
    }
    isRightSide ||= name === "More actions";
  }
  return names;
}

test.describe("Narrow stage bar", function describeNarrowBar(): void {
  test("Phone: the messages button, a separator and Close", async function foldsRightSide({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openProbe(page);

    await expect(messagesButton(page)).toBeVisible();
    expect(await readRightSideNames(page)).toEqual([
      "Messages: 0 errors, 0 warnings, 0 notifications, 0 unread",
      "Close",
    ]);
    const messagesBox = await messagesButton(page).evaluate(readElementBox);
    const separatorBox = await separator(page).last().evaluate(readElementBox);
    const closeBox = await closeButton(page).evaluate(readElementBox);
    expect(separatorBox.left).toBeGreaterThanOrEqual(messagesBox.right);
    expect(closeBox.left).toBeGreaterThanOrEqual(separatorBox.right);
    expect(await page.evaluate(canScrollSideways)).toBe(false);
    expect(await closeButton(page).evaluate(isFullyShown)).toBe(true);
  });

  test("The title is readable on a phone", async function showsTitle({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await page.goto(NOBEL_MAP_MOSAIC_LINK);
    const folded = capsule(page, `Combination: ${MAP_MOSAIC_TITLE}`);
    await expect(folded).toBeVisible();

    const box = await folded.evaluate(readElementBox);

    expect(box.width).toBeGreaterThanOrEqual(120);
    const title = folded.locator("span").first();
    await expect(title).toBeVisible();
    await expect(title).toHaveText(MAP_MOSAIC_TITLE);
    expect((await title.evaluate(readElementBox)).width).toBeGreaterThan(48);
  });

  test("Errors and notifications: one button, a grouped popover, then all read", async function groupsMessages({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const frame = await openProbe(page);
    await notify(frame, { message: "First note", level: "info" });
    await notify(frame, { message: "Broken", level: "error" });
    await notify(frame, { message: "Second note", level: "info" });

    const capsuleOf = messagesButton(page).locator("[data-capsule]");
    await expect(messagesButton(page)).toHaveAttribute("data-level", "error");
    await expect(capsuleOf).toHaveText("3");
    await expect(capsuleOf).toHaveAttribute("data-capsule", "unread");
    await expect(capsuleOf).toHaveClass(/bg-destructive/);
    await messagesButton(page).click();

    expect(await readGroupHeadings(page)).toEqual(["Errors", "Notifications"]);
    expect(await readGroupTexts(page, "Errors")).toEqual(["Broken"]);
    expect(await readGroupTexts(page, "Notifications")).toEqual([
      "Second note",
      "First note",
    ]);
    await expect(unreadItems(messagesPopover(page))).toHaveCount(3);

    await messagesButton(page).click();
    await expect(messagesPopover(page)).toHaveCount(0);
    await expect(capsuleOf).toHaveText("3");
    await expect(capsuleOf).toHaveAttribute("data-capsule", "read");
  });

  test("Dismiss from the grouped popover", async function dismissesGrouped({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const frame = await openProbe(page);
    await notify(frame, { message: "First note", level: "info" });
    await notify(frame, { message: "Second note", level: "info" });
    await messagesButton(page).click();

    await messagesPopover(page)
      .getByRole("button", { name: "Dismiss: Second note" })
      .click();

    expect(await readGroupTexts(page, "Notifications")).toEqual(["First note"]);
    await expect(messagesButton(page).locator("[data-capsule]")).toHaveText(
      "1",
    );
  });

  test("No messages: dimmed, and the popover says No messages.", async function showsEmpty({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openProbe(page);
    await expect(messagesButton(page)).toHaveAttribute("data-empty");
    await expect(messagesButton(page).locator("[data-capsule]")).toHaveCount(0);

    await messagesButton(page).click();

    await expect(messagesPopover(page)).toHaveText("No messages.");
  });

  test("Theater mode from the menu on a phone", async function togglesTheaterFromMenu({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    const frame = await openProbe(page);
    await markFrame(frame);
    await expect(theaterButton(page)).toHaveCount(0);
    const menu = await openMoreActions(page);
    const item = menu.getByRole("menuitemcheckbox", { name: "Theater mode" });
    await expect(item).toHaveAttribute("aria-checked", "false");

    await item.click();

    await expect(menu).toHaveCount(0);
    await expect
      .poll(readStoredTheaterChoice.bind(undefined, page))
      .toBe("true");
    const reopened = await openMoreActions(page);
    await expect(
      reopened.getByRole("menuitemcheckbox", { name: "Theater mode" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Fullscreen in the menu on a phone, and no button", async function offersFullscreenItem({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await openProbe(page);

    const menu = await openMoreActions(page);

    await expect(
      menu.getByRole("menuitem", { name: "Fullscreen" }),
    ).toBeVisible();
    await expect(fullscreenButton(page)).toHaveCount(0);
  });

  test("Wide bar keeps the menu short", async function keepsMenuShort({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openProbe(page);

    const menu = await openMoreActions(page);

    await expect(
      menu.getByRole("menuitem", { name: "Copy link" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitemcheckbox", { name: "Theater mode" }),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("menuitem", { name: "Fullscreen" }),
    ).toHaveCount(0);
  });

  test("Both sides switch at 480px", async function switchesAtThreshold({
    page,
  }): Promise<void> {
    // The probe's plain title always fits, so only the width folds its bar.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openProbe(page);

    await setBarContentWidth(page, 481);
    await expect(messageButton(page, "Errors")).toBeVisible();
    await expect(messagesButton(page)).toHaveCount(0);
    await expect(theaterButton(page)).toBeVisible();

    await setBarContentWidth(page, 479);
    await expect(messagesButton(page)).toBeVisible();
    await expect(messageButton(page, "Errors")).toHaveCount(0);
    await expect(theaterButton(page)).toHaveCount(0);
    const offsetAt479 = await readCloseOffset(page);
    const messagesAt479 = await readBox(messagesButton(page));

    await setBarContentWidth(page, 300);
    expect(await readCloseOffset(page)).toBe(offsetAt479);
    const messagesAt300 = await readBox(messagesButton(page));
    expect(messagesAt300.width).toBe(messagesAt479.width);
  });

  test("Capsules never break", async function keepsCapsulesWhole({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(NOBEL_MAP_MOSAIC_LINK);
    const mosaicCapsule = capsule(page, `Mosaic: ${MAP_MOSAIC_TITLE}`);
    await expect(mosaicCapsule).toBeVisible();

    // As on a landscape phone with the sidebar expanded: the capsules have to shrink, and still fit.
    await setBarContentWidth(page, 575);

    await expect(mosaicCapsule).toBeVisible();
    await expect(capsule(page, /^Collection: /)).toBeVisible();
    expect(await stageBar(page).evaluate(listBrokenBarItems)).toEqual([]);
  });

  test("Folds when the capsules do not fit", async function foldsOnFit({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(NOBEL_MAP_MOSAIC_LINK);
    const folded = capsule(page, `Combination: ${MAP_MOSAIC_TITLE}`);
    const mosaicCapsule = capsule(page, `Mosaic: ${MAP_MOSAIC_TITLE}`);
    await expect(mosaicCapsule).toBeVisible();

    await setBarContentWidth(page, 500);
    await expect(folded).toBeVisible();
    await expect(mosaicCapsule).toBeHidden();
    await expect(messagesButton(page)).toBeVisible();
    await expect(messageButton(page, "Errors")).toHaveCount(0);
    expect(await stageBar(page).evaluate(listBrokenBarItems)).toEqual([]);

    // Around where the capsules stop fitting, nothing overlaps, folded or not.
    for (const width of [540, 560, 580, 600, 620, 640]) {
      await setBarContentWidth(page, width);
      // The bar folds on its next frame: the check waits for it.
      await expect.poll(readBrokenBarItems.bind(undefined, page)).toEqual([]);
    }

    await setBarContentWidth(page, 900);
    await expect(mosaicCapsule).toBeVisible();
    await expect(capsule(page, /^Mod: /)).toBeVisible();
    await expect(capsule(page, /^Collection: /)).toBeVisible();
    await expect(folded).toBeHidden();
    await expect(messageButton(page, "Errors")).toBeVisible();
    await expect(messagesButton(page)).toHaveCount(0);
    expect(await stageBar(page).evaluate(listBrokenBarItems)).toEqual([]);
  });
});

function readBrokenBarItems(page: Page): Promise<string[]> {
  return stageBar(page).evaluate(listBrokenBarItems);
}

/**
 * Runs on the stage bar: each shown button or separator that sticks out of
 * the bar or overlaps the one before it, and each icon that sticks out of
 * its button, named. Empty when nothing is broken. Half a pixel of rounding
 * is allowed.
 */
function listBrokenBarItems(bar: Element): string[] {
  const tolerance = 0.5;
  const barBox = bar.getBoundingClientRect();
  const broken: string[] = [];
  let previous: { name: string; right: number } | null = null;
  for (const item of bar.querySelectorAll("button, [data-slot=separator]")) {
    const box = item.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) {
      continue;
    }
    const name = item.getAttribute("aria-label") ?? item.tagName;
    if (previous !== null && box.left < previous.right - tolerance) {
      broken.push(`${name} overlaps ${previous.name}`);
    }
    previous = { name, right: box.right };
    if (
      box.left < barBox.left - tolerance ||
      box.right > barBox.right + tolerance
    ) {
      broken.push(`${name} is outside the bar`);
    }
    for (const icon of item.querySelectorAll("svg")) {
      const iconBox = icon.getBoundingClientRect();
      if (
        iconBox.left < box.left - tolerance ||
        iconBox.right > box.right + tolerance
      ) {
        broken.push(`an icon sticks out of ${name}`);
      }
    }
  }
  return broken;
}

/** Runs in the app's page: the stored theater choice. */
function readTheaterChoice(key: string): string | null {
  return localStorage.getItem(key);
}

function readStoredTheaterChoice(page: Page): Promise<string | null> {
  return page.evaluate(readTheaterChoice, THEATER_MODE_KEY);
}

test.describe(
  "Stage bar tooltips on a phone",
  { tag: "@mobile" },
  function describePhoneTooltips(): void {
    test("Tap on a phone", async function tapsMessagesButton({
      page,
    }): Promise<void> {
      await openProbe(page);

      await messagesButton(page).tap();
      await expect(messagesPopover(page)).toBeVisible();
      await messagesButton(page).tap();

      await expect(messagesPopover(page)).toHaveCount(0);
      await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(
        0,
      );
    });
  },
);

/** The mosaic viewer's frame, wherever the stage shows it. */
function mosaicViewerFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Mosaic Viewer"]');
}

async function openMosaicList(page: Page): Promise<void> {
  await stageBar(page)
    .getByRole("button", { name: /^Mosaic: / })
    .click();
  await expect(page.getByRole("combobox")).toBeFocused();
}

test.describe("Edit row of the mosaic list", function describeEditRow(): void {
  test("Save the combination", async function savesCombination({
    page,
  }): Promise<void> {
    await openSampleSandbox(page, FLASHCARDS_LAUREATES_LINK);
    await openMosaicList(page);
    expect((await readOptionTitles(page)).slice(0, 2)).toEqual([
      "Save as mosaic",
      "Unsaved combination",
    ]);

    await listOption(page, "Save as mosaic").click();

    await expect(
      mosaicViewerFrame(page).getByRole("heading", { level: 1 }),
    ).toHaveText("New mosaic");
    const params = readRunParams(page);
    expect(params.get("mod")).toBe("mosaic_viewer");
    expect(params.get("mode")).toBe("new");
    expect(params.get("draft_mod")).toMatch(
      /\/samples\/mods\/flashcards\/mod_conf\.yaml$/,
    );
    expect(params.get("draft_collection")).toMatch(
      /\/samples\/tiles\/literature_nobel_laureates\/collection\.yaml$/,
    );
    await expect(
      mosaicViewerFrame(page).locator('textarea[name="content"]'),
    ).toHaveValue(/flashcards/);
    await page.goBack();
    await expect(
      stageBar(page).getByRole("button", { name: "Mod: Flashcards" }),
    ).toBeVisible();
  });

  test("Back to the mosaic", async function goesBackToMosaic({
    page,
  }): Promise<void> {
    await page.goto(NOBEL_MAP_MOSAIC_LINK);
    await openMosaicList(page);

    await listOption(page, "Edit a copy").click();

    await expect(
      mosaicViewerFrame(page).getByRole("heading", { level: 1 }),
    ).toHaveText(`Copy of "${MAP_MOSAIC_TITLE}"`);
    await page.goBack();
    await expect(
      stageBar(page).getByRole("button", {
        name: `Mosaic: ${MAP_MOSAIC_TITLE}`,
      }),
    ).toBeVisible();
  });

  test("Edit row on a phone", async function laysOutEditRow({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await page.goto(FLASHCARDS_LAUREATES_LINK);
    // On a phone the capsules fold into one, whose menu opens each list.
    await capsule(page, /^Combination: /).click();
    await page.getByRole("menuitem", { name: "Mosaic" }).click();
    await openList(page).evaluate(finishAnimations);

    const editRow = listOption(page, "Save as mosaic");
    const editBox = await readBox(editRow);
    const pairBox = await readBox(
      listOption(page, "Unsaved combination").first(),
    );
    expect(editBox.height).toBe(pairBox.height);
    expect(editBox.height).toBeGreaterThanOrEqual(32);
    expect(editBox.x + editBox.width).toBeLessThanOrEqual(
      SMALL_PHONE_VIEWPORT.width,
    );
    await expect(
      editRow.locator("[data-column=title] > span").first(),
    ).toHaveText("Save as mosaic");
    expect(
      await editRow
        .locator("[data-column=title] > span")
        .first()
        .evaluate(isCut),
    ).toBe(false);

    await editRow.click();

    await expect(
      mosaicViewerFrame(page).getByRole("heading", { level: 1 }),
    ).toHaveText("New mosaic");
  });
});
