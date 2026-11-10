import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import {
  answerSiteConsent,
  buildProbeFiles,
  closeMessages,
  COVER_HOST,
  expectMessageCount,
  expectMessages,
  exposeSampleEngine,
  findModFrame,
  followLink,
  FOREIGN_HOST,
  messageButton,
  messageCapsule,
  messagePopover,
  openMessages,
  openShareMenu,
  readMessages,
  requestFromProbe,
  routeCovers,
  serveAppOriginMod,
  serveForeignMod,
  shareButton,
  shareMenu,
  showImage,
  siteConsentDialog,
  stageBar,
  unreadItems,
  waitForProbe,
} from "./mod_routes.ts";
import type { MessageLevelName, ModFiles, ProbeAnswer } from "./mod_routes.ts";
import {
  MISSING_MOD_FILE_PATH,
  MISSING_MOD_REFERENCE,
  SAMPLE_COLLECTION_GLOB,
  SAMPLE_COLLECTION_PATH,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_BOOKS_FOLDER_PATH,
  SAMPLE_RUN_HASH,
  SAMPLE_TYPE_PATH,
} from "./sample_mod.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";

/** The lines of a probe that shows the sample covers, so a foreign probe asks for consent. */
const SHOW_COVERS_LINES = [
  "  permissions:",
  "    show:",
  `      - host: "${COVER_HOST}"`,
  '        reason: "Shows the book covers"',
];

/** Opens the probe from the app's origin, with `extraLines` in its mod file, and waits for its mount. */
async function openProbe(
  page: Page,
  extraLines: string[] = [],
  title: string = "probe",
): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe", extraLines));
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, title);
  await waitForProbe(frame);
  return frame;
}

/** A probe whose tile type is the sample's `book`, so a collection can be opened with it. */
function buildTypedProbeFiles(): ModFiles {
  return buildProbeFiles("probe", [`  type_path: "../..${SAMPLE_TYPE_PATH}"`]);
}

/** A collection of the sample book Kallocain, followed by `extraPaths`, relative to `/test-mods/`. */
function buildCollection(extraPaths: string[]): string {
  const lines = [
    "collection:",
    '  name: "Probe books"',
    "  tiles:",
    `    - path: "..${SAMPLE_BOOKS_FOLDER_PATH}/kallocain.md"`,
  ];
  for (const path of extraPaths) {
    lines.push(`    - path: "${path}"`);
  }
  const collection = lines.join("\n");
  return collection;
}

/** A tile without `country`, so it is not a book: a collection warning. */
const NO_COUNTRY_TILE = [
  "---",
  'title: "No country"',
  'date: "2001-01-01"',
  "authors:",
  '  - "Anonymous"',
  "genres:",
  '  - "Mystery"',
  "---",
  "",
].join("\n");

/**
 * Serves `files`, which a test can change before a reload, and opens the
 * typed probe with `collection.yaml`. Waits for its mount.
 */
async function openTypedProbe(page: Page, files: ModFiles): Promise<Frame> {
  await serveAppOriginMod(page, files);
  await page.goto(`${PROBE_LINK}&collection=./test-mods/collection.yaml`);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

/** Opens the sample mod with its collection, with its engine on `globalThis.probe`. */
async function openSampleWithEngine(page: Page): Promise<Frame> {
  await routeCovers(page);
  await exposeSampleEngine(page);
  await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
  const frame = await findModFrame(page, "Book List");
  await waitForProbe(frame);
  return frame;
}

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

/** The boxes of every button of the stage bar, and of its separator. */
async function readBarBoxes(page: Page): Promise<Box[]> {
  const boxes: Box[] = [];
  for (const button of await stageBar(page).getByRole("button").all()) {
    boxes.push(await readBox(button));
  }
  boxes.push(await readBox(separator(page)));
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

/** Answers the sample collection with two books once `twoBooks.isOn` is set, or 404 once `isMissing` is. */
async function answerCollection(
  state: { twoBooks: boolean; isMissing: boolean },
  route: Route,
): Promise<void> {
  if (state.isMissing) {
    await route.fulfill({ status: 404, body: "Not Found" });
    return;
  }
  if (!state.twoBooks) {
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

/** Replaces `navigator.clipboard.writeText` with one that refuses every text. */
const CLIPBOARD_REFUSER = `
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText() {
      return Promise.reject(new DOMException("Refused", "NotAllowedError"));
    },
  },
});
`;

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

/** The texts of a popover's items marked unread. */
async function readUnreadTexts(popover: Locator): Promise<string[]> {
  const texts: string[] = [];
  for (const item of await unreadItems(popover).all()) {
    await expect(item).toContainText("Unread");
    texts.push((await item.locator("div > span").textContent()) ?? "");
  }
  return texts;
}

test.describe("One-row stage bar", function describeLayout(): void {
  test("Sample mod with its collection", async function ordersItems({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const bar = stageBar(page);
    await expect(bar).toContainText("Book List");

    const items = [
      bar.getByText("Book List", { exact: true }),
      bar.getByText("1.0.0", { exact: true }),
      bar.getByRole("button", { name: "Mod information" }),
      shareButton(page),
      bar.getByRole("button", { name: "Reload tiles" }),
      messageButton(page, "Errors"),
      messageButton(page, "Warnings"),
      messageButton(page, "Notifications"),
      separator(page),
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

  test("No collection", async function hidesReload({ page }): Promise<void> {
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");

    await expect(
      stageBar(page).getByRole("button", { name: "Reload tiles" }),
    ).toHaveCount(0);
    const names: string[] = [];
    for (const button of await stageBar(page).getByRole("button").all()) {
      names.push((await button.getAttribute("aria-label")) ?? "");
    }
    expect(names).toEqual([
      "Mod information",
      "Share",
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 0, 0 unread",
      "Close",
    ]);
  });

  test("Close button last", async function placesCloseLast({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");

    const closeBox = await readBox(closeButton(page));
    const separatorBox = await readBox(separator(page));
    const barBox = await readBox(stageBar(page));
    expect(separatorBox.x).toBeLessThan(closeBox.x);
    expect(
      barBox.x + barBox.width - (closeBox.x + closeBox.width),
    ).toBeLessThan(20);
  });
});

test.describe("Name while loading or after a failure", function describeName(): void {
  test("Missing mod file", async function showsModNotLoaded({
    page,
  }): Promise<void> {
    await page.goto(`/#/run?mod=${MISSING_MOD_REFERENCE}`);

    await expect(stageBar(page)).toContainText("Mod not loaded");
    await expect(stageBar(page)).not.toContainText("1.0.0");
  });

  test("Missing collection", async function keepsModName({
    page,
  }): Promise<void> {
    await page.route(SAMPLE_COLLECTION_GLOB, answerMissing);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

    await expect(page.getByRole("alert")).toContainText("404");
    await expect(stageBar(page)).toContainText("Book List");
    await expect(stageBar(page)).toContainText("1.0.0");
  });
});

async function answerMissing(route: Route): Promise<void> {
  await route.fulfill({ status: 404, body: "Not Found" });
}

test.describe("Each message names its producer", function describeProducers(): void {
  test("Message from the app and from the mod", async function labelsProducers({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe", [], null));
    await page.goto(PROBE_LINK);
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);

    expect(await notify(frame, { message: "Saved", level: "warning" })).toEqual(
      { result: null },
    );

    await expectMessageCount(page, "Warnings", 2);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0]).toEqual({
      producer: "Mod",
      source: new URL("/test-mods/probe/mod_conf.yaml", page.url()).href,
      text: "Saved",
    });
    expect(warnings[1].producer).toBe("App");
    expect(warnings[1].text).toContain('"api"');
  });

  test("Mod titled like the app", async function keepsModLabel({
    page,
  }): Promise<void> {
    const frame = await openProbe(page, ['  title: "App"'], "App");

    await notify(frame, { message: "Sign in again", source: "App" });

    await expectMessageCount(page, "Notifications", 1);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("Mod");
    expect(notifications[0].text).toBe("Sign in again");
  });

  test("Plain text", async function showsPlainText({ page }): Promise<void> {
    const frame = await openProbe(page);

    await notify(frame, { message: "<b>Saved</b>" });

    const popover = await openMessages(page, "Notifications");
    await expect(popover.getByRole("listitem")).toContainText("<b>Saved</b>");
    await expect(popover.locator("b")).toHaveCount(0);
  });
});

test.describe("Message buttons", function describeButtons(): void {
  test("Many warnings", async function showsNinetyNinePlus({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await notifyMany(frame, 120, "warning");

    await expectMessageCount(page, "Warnings", 100);
    await expect(messageCapsule(page, "Warnings")).toHaveText("99+");
    await expect(messageButton(page, "Warnings")).toHaveAccessibleName(
      "Warnings: 100, 100 unread",
    );
  });

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
    expect(overlaps(capsuleBox, await readBox(separator(page)))).toBe(false);
    expect(overlaps(capsuleBox, await readBox(closeButton(page)))).toBe(false);
  });

  test("Keyboard reaches an empty level", async function focusesEmptyLevel({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");
    await messageButton(page, "Errors").focus();

    await page.keyboard.press("Tab");

    await expect(messageButton(page, "Warnings")).toBeFocused();
    await expect(messageButton(page, "Warnings")).toHaveAttribute("data-empty");
  });
});

test.describe("Unread messages", function describeUnread(): void {
  test("Read after opening, filled again on a new message", async function marksRead({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "unread",
    );

    await expectMessages(page, "Warnings", "First");
    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "read",
    );
    await notify(frame, { message: "Second", level: "warning" });

    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "unread",
    );
  });
});

test.describe("Message popovers", function describePopoverOrder(): void {
  test("Errors popover", async function listsNewestErrorFirst({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildCollection(["./missing.md"]);
    const frame = await openTypedProbe(page, files);

    await notify(frame, { message: "Broken", level: "error" });

    await expectMessageCount(page, "Errors", 2);
    const errors = await readMessages(page, "Errors");
    expect(errors[0]).toMatchObject({ producer: "Mod", text: "Broken" });
    expect(errors[1].producer).toBe("App");
    expect(errors[1].source).toContain("/test-mods/missing.md");
    expect(await readMessages(page, "Warnings")).toEqual([]);
  });

  test("New message on top", async function listsArrivalFirst({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    const popover = await openMessages(page, "Warnings");

    await notify(frame, { message: "Second", level: "warning" });

    await expect(popover.getByRole("listitem")).toHaveCount(2);
    await expect(popover.getByRole("listitem").first()).toContainText("Second");
  });

  test("Reloaded issue on top", async function listsReloadedIssueFirst({
    page,
  }): Promise<void> {
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildCollection([]);
    files["no_country.md"] = NO_COUNTRY_TILE;
    const frame = await openTypedProbe(page, files);
    await notify(frame, { message: "Slow", level: "warning" });
    await expectMessageCount(page, "Warnings", 1);
    files["collection.yaml"] = buildCollection(["./no_country.md"]);

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expectMessageCount(page, "Warnings", 2);
    const warnings = await readMessages(page, "Warnings");
    expect(warnings[0].producer).toBe("App");
    expect(warnings[0].source).toContain("/test-mods/no_country.md");
    expect(warnings[1]).toMatchObject({ producer: "Mod", text: "Slow" });
  });
});

test.describe("Unread items stand out", function describeUnreadItems(): void {
  test("Unread items stand out", async function marksNewItem({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    await expectMessages(page, "Warnings", "First");
    await notify(frame, { message: "Second", level: "warning" });

    const popover = await openMessages(page, "Warnings");

    await expect(popover.getByRole("listitem")).toHaveCount(2);
    expect(await readUnreadTexts(popover)).toEqual(["Second"]);
    await expect(popover.getByRole("listitem").first()).toContainText("Second");
    await expect(popover.getByRole("listitem").last()).not.toContainText(
      "Unread",
    );
  });

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

  test("Items read on the last opening are plain", async function marksNothing({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    await expectMessages(page, "Warnings", "First");

    const popover = await openMessages(page, "Warnings");

    await expect(popover.getByRole("listitem")).toHaveCount(1);
    await expect(unreadItems(popover)).toHaveCount(0);
  });

  test("Message arriving while the popover is open", async function marksArrival({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "First", level: "warning" });
    await expectMessages(page, "Warnings", "First");
    const popover = await openMessages(page, "Warnings");

    await notify(frame, { message: "Second", level: "warning" });

    await expect(popover.getByRole("listitem")).toHaveCount(2);
    await expect(popover.getByRole("listitem").first()).toContainText("Second");
    expect(await readUnreadTexts(popover)).toEqual(["Second"]);
    await closeMessages(page);
    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "read",
    );
  });
});

test.describe("New messages draw attention", function describeAttention(): void {
  test("Blocked request flashes", async function flashes({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await frame.evaluate(showImage, "https://images.example.net/cover.jpg");

    await expectMessageCount(page, "Warnings", 1);
    expect(await readFlash(page, "Warnings")).toBe("stage-bar-flash");
    await expect(messageCapsule(page, "Warnings")).toHaveAttribute(
      "data-capsule",
      "unread",
    );
  });

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
  test("Dismiss one, then clear all", async function dismisses({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notifyMany(frame, 2, "info");
    const popover = await openMessages(page, "Notifications");

    await popover.getByRole("button", { name: "Dismiss: Note 1" }).click();

    await expectMessageCount(page, "Notifications", 1);
    await expect(popover.getByRole("listitem")).toHaveText([/Note 2/]);
    await closeMessages(page);
    await notifyMany(frame, 2, "info", "More");
    await openMessages(page, "Notifications");
    await popover.getByRole("button", { name: "Clear all" }).click();
    await expect(popover).toContainText("No notifications.");
    await expect(messageButton(page, "Notifications")).toHaveAttribute(
      "data-empty",
    );
  });

  test("Warnings stay", async function keepsWarnings({ page }): Promise<void> {
    const frame = await openProbe(page);
    await notifyMany(frame, 2, "warning");

    const popover = await openMessages(page, "Warnings");

    await expect(popover.getByRole("listitem")).toHaveCount(2);
    await expect(popover.getByRole("button", { name: /Dismiss/ })).toHaveCount(
      0,
    );
    await expect(
      popover.getByRole("button", { name: "Clear all" }),
    ).toHaveCount(0);
  });

  test("Popover over a running mod receives clicks", async function clicksOverFrame({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    await expectMessageCount(page, "Notifications", 1);
    const popover = await openMessages(page, "Notifications");
    const frameBox = await readBox(page.locator('iframe[title="Book List"]'));
    expect(overlaps(await readBox(popover), frameBox)).toBe(true);

    await popover.getByRole("button", { name: /^Dismiss: / }).click();

    await expect(popover).toContainText("No notifications.");
  });
});

test.describe("Messages from a mod are limited", function describeLimit(): void {
  test("Mod sends too many", async function dropsOldest({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await notifyMany(frame, 105, "info");

    await expectMessageCount(page, "Notifications", 100);
    const popover = await openMessages(page, "Notifications");
    await expect(popover.getByRole("listitem").first()).toContainText(
      "Note 105",
    );
    await expect(popover.getByRole("listitem").last()).toContainText("Note 6");
    await expect(popover.locator("p").last()).toHaveText(
      "5 older messages from the mod were dropped.",
    );
  });

  test("Notifications drop no error or warning", async function keepsIssues({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await notify(frame, { message: "Broken", level: "error" });
    await notify(frame, { message: "Slow", level: "warning" });

    await notifyMany(frame, 105, "info");

    await expectMessageCount(page, "Notifications", 100);
    const errors = await openMessages(page, "Errors");
    await expect(errors.getByRole("listitem")).toHaveText([/Broken/]);
    await expect(errors).not.toContainText("dropped");
    await closeMessages(page);
    const warnings = await openMessages(page, "Warnings");
    await expect(warnings.getByRole("listitem")).toHaveText([/Slow/]);
    await expect(warnings).not.toContainText("dropped");
  });
});

test.describe("Information popover", function describeInfo(): void {
  test("Sample mod with its collection", async function showsDetails({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

    await stageBar(page)
      .getByRole("button", { name: "Mod information" })
      .click();

    const popover = page.locator("[data-slot=popover-content]");
    await expect(popover).toContainText(
      new URL("/samples/mods/book_list/mod_conf.yaml", page.url()).href,
    );
    await expect(popover).toContainText(
      new URL(SAMPLE_COLLECTION_PATH, page.url()).href,
    );
    await expect(popover).toContainText(SAMPLE_COLLECTION_RUN_HASH);
    await expect(
      popover.getByRole("button", { name: "Copy link" }),
    ).toHaveCount(0);
  });

  test("Mod that did not load", async function showsModReference({
    page,
  }): Promise<void> {
    await page.goto(`/#/run?mod=${MISSING_MOD_REFERENCE}`);
    await expect(stageBar(page)).toContainText("Mod not loaded");

    await stageBar(page)
      .getByRole("button", { name: "Mod information" })
      .click();

    const popover = page.locator("[data-slot=popover-content]");
    await expect(popover).toContainText(
      new URL(MISSING_MOD_FILE_PATH, page.url()).href,
    );
    await expect(popover).toContainText(`#/run?mod=${MISSING_MOD_REFERENCE}`);
  });
});

test.describe("Share menu", function describeShare(): void {
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
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const menu = await openShareMenu(page);

    await menu.getByRole("menuitem", { name: "Copy link" }).click();

    await expect(shareMenu(page)).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toContainText("Link copied");
    await expect(shareButton(page)).toHaveAccessibleName("Share");
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

  test("Copy refused", async function showsRefusal({ page }): Promise<void> {
    await page.addInitScript({ content: CLIPBOARD_REFUSER });
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    const menu = await openShareMenu(page);

    await menu.getByRole("menuitem", { name: "Copy link" }).click();

    await expect(page.getByRole("tooltip")).toContainText(
      "Cannot copy the link",
    );
    await expect(stageBar(page).locator("[aria-live=polite]")).toContainText(
      "Cannot copy the link",
    );
  });

  test("Keyboard", async function opensWithKeyboard({ page }): Promise<void> {
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");
    await shareButton(page).focus();

    await page.keyboard.press("Enter");

    const menu = shareMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(1);
    await expect(
      menu.getByRole("menuitem", { name: "Copy link" }),
    ).toBeFocused();
  });
});

test.describe("Popovers and menus close on a click outside", function describeClickOutside(): void {
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

  test("Share menu", async function closesShareMenu({ page }): Promise<void> {
    const frame = await openProbe(page);
    await frame.evaluate(CLICK_RECORDER);
    await openShareMenu(page);

    await clickInFrame(page, "probe");

    await expect(shareMenu(page)).toHaveCount(0);
    await expect.poll(countFrameClicks.bind(undefined, frame)).toBe(1);
  });
});

test.describe("The app's notifications", function describeAppNotifications(): void {
  test("Sample collection", async function notifiesLoadedCollection({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

    await expectMessageCount(page, "Notifications", 1);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("App");
    expect(notifications[0].source).toBe(
      new URL(SAMPLE_COLLECTION_PATH, page.url()).href,
    );
    expect(notifications[0].text).toContain("3 tiles");
  });

  test("No collection", async function notifiesNothing({
    page,
  }): Promise<void> {
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");

    await expect(messageButton(page, "Notifications")).toHaveAttribute(
      "data-empty",
    );
  });

  test("Reload done, then reload failed", async function notifiesReload({
    page,
  }): Promise<void> {
    const state = { twoBooks: false, isMissing: false };
    await routeCovers(page);
    await page.route(
      SAMPLE_COLLECTION_GLOB,
      answerCollection.bind(undefined, state),
    );
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    await expectMessageCount(page, "Notifications", 1);
    state.twoBooks = true;

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expectMessageCount(page, "Notifications", 2);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("App");
    expect(notifications[0].text).toContain("2 tiles");
    expect(notifications[0].text).toContain("0 collection issues");
    state.isMissing = true;
    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();
    await expectMessageCount(page, "Errors", 1);
    await expectMessages(
      page,
      "Errors",
      new URL(SAMPLE_COLLECTION_PATH, page.url()).href,
    );
    await expectMessageCount(page, "Notifications", 2);
  });

  test("Allowed and remembered", async function notifiesConsent({
    page,
  }): Promise<void> {
    await serveForeignMod(page, buildProbeFiles("probe", SHOW_COVERS_LINES));
    await page.goto(
      `/#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`,
    );

    await answerSiteConsent(page, "Allow", { remember: true });

    await expectMessageCount(page, "Notifications", 1);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("App");
    expect(notifications[0].source).toBe(`${FOREIGN_HOST}/probe/mod_conf.yaml`);
    expect(notifications[0].text).toContain(
      `Allowed the mod to show content from ${COVER_HOST}`,
    );
    expect(notifications[0].text).toContain("The answer is remembered.");
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
  test("Default source", async function notifiesWithModSource({
    page,
  }): Promise<void> {
    const frame = await openSampleWithEngine(page);

    expect(await notify(frame, { message: "Saved" })).toEqual({ result: null });

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectMessageCount(page, "Notifications", 2);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0]).toEqual({
      producer: "Mod",
      source: new URL("/samples/mods/book_list/mod_conf.yaml", page.url()).href,
      text: "Saved",
    });
  });

  test("Hidden mod notifies", async function keepsHiddenMessage({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await followLink(page, SAMPLE_RUN_HASH);
    await expect(stageBar(page)).toContainText("Book List");

    expect(await notify(frame, { message: "Done" })).toEqual({ result: null });

    await expect(messageButton(page, "Notifications")).toHaveAttribute(
      "data-empty",
    );
    await page.goBack();
    await expect(stageBar(page)).toContainText("probe");
    await expectMessages(page, "Notifications", "Done");
    await expect(messagePopover(page, "Notifications")).toHaveCount(0);
  });
});
