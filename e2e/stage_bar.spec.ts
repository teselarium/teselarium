import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import {
  buildProbeFiles,
  COVER_HOST,
  expectMessageCount,
  expectMessages,
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
import type { MessageLevelName, ProbeAnswer } from "./mod_routes.ts";
import {
  buildNoteCollection,
  buildTypedProbeFiles,
  openProbe,
  openTypedProbe,
  PROBE_LINK,
} from "./test_mods.ts";
import { HOME_MOD_PREVIEW_URL } from "./app_servers.ts";

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
      bar.getByText("probe", { exact: true }),
      bar.getByText("0.1.0", { exact: true }),
      bar.getByRole("button", { name: "Mod information" }),
      shareButton(page),
      bar.getByRole("button", { name: "Reload tiles" }),
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
    const files = buildTypedProbeFiles();
    files["collection.yaml"] = buildNoteCollection([]);
    await openTypedProbe(page, files);
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

    test("Share menu", async function closesShareMenu({ page }): Promise<void> {
      const frame = await openProbe(page);
      await frame.evaluate(CLICK_RECORDER);
      await openShareMenu(page);

      await clickInFrame(page, "probe");

      await expect(shareMenu(page)).toHaveCount(0);
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

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expectMessageCount(page, "Notifications", 2);
    const notifications = await readMessages(page, "Notifications");
    expect(notifications[0].producer).toBe("App");
    expect(notifications[0].text).toContain("2 tiles");
    expect(notifications[0].text).toContain("0 collection issues");
    delete files["collection.yaml"];
    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();
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
