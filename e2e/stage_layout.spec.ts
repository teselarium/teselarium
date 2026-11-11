import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import {
  addFullscreenButton,
  expectMessages,
  exposeSampleEngine,
  findModFrame,
  isFrameMarked,
  markFrame,
  messageButton,
  readMessageCounts,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import {
  buildLayoutProbeFiles,
  fullscreenButton,
  isFrameFullscreen,
  measureContentWidth,
  pressTheaterMode,
  readBodyBox,
  readContextLayout,
  readFrameEdge,
  readFullscreenElementTag,
  readLayoutAtMount,
  readLayoutAttribute,
  readLayoutEvents,
  readScrollTop,
  refuseFrameFullscreen,
  refuseTheaterWrites,
  storeTheaterBeforeLoad,
  TALL_LAYOUT_PROBE_MOD_CODE,
  THEATER_MODE_KEY,
  theaterButton,
  waitForFrameLayout,
  WIDE_VIEWPORT,
} from "./layout_probes.ts";
import { SAMPLE_RUN_HASH } from "./sample_mod.ts";
import { addModStyle } from "./theme_probes.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const SAMPLE_TITLE = "Book List";

/** Opens the layout probe, with `extraLines` in its mod file, and waits for its mount. */
async function openLayoutProbe(
  page: Page,
  extraLines: string[] = [],
  code?: string,
): Promise<Frame> {
  await serveAppOriginMod(
    page,
    buildLayoutProbeFiles("probe", extraLines, code),
  );
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

/** Opens the sample book list mod and waits until its frame has its layout. */
async function openSample(page: Page): Promise<Frame> {
  await page.goto(`/${SAMPLE_RUN_HASH}`);
  return waitForSample(page);
}

/** Waits until the shown sample book list mod's frame has its layout. */
async function waitForSample(page: Page): Promise<Frame> {
  await expect(page.locator(`iframe[title="${SAMPLE_TITLE}"]`)).toBeVisible();
  const frame = await findModFrame(page, SAMPLE_TITLE);
  await expect
    .poll(frame.evaluate.bind(frame, readLayoutAttribute))
    .not.toBeUndefined();
  return frame;
}

function hasLayoutEvents(count: number): boolean {
  const probeGlobal = globalThis as {
    probe?: { layoutEvents: unknown[] };
  };
  return (probeGlobal.probe?.layoutEvents.length ?? 0) >= count;
}

interface SampleProbeGlobal {
  probe: {
    engine: { on: (event: string, handler: (params: unknown) => void) => void };
  };
  layoutEvents?: unknown[];
}

/** Runs in the exposed sample mod: records each `layout.changed` it receives on `globalThis.layoutEvents`. */
function recordSampleLayoutEvents(): void {
  const sampleGlobal = globalThis as unknown as SampleProbeGlobal;
  sampleGlobal.layoutEvents = [];
  function recordLayout(params: unknown): void {
    sampleGlobal.layoutEvents?.push(params);
  }
  sampleGlobal.probe.engine.on("layout.changed", recordLayout);
}

function readSampleLayoutEvents(): unknown[] {
  return (globalThis as unknown as SampleProbeGlobal).layoutEvents ?? [];
}

function readFrameBox(
  page: Page,
  title: string,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.locator(`iframe[title="${title}"]`).boundingBox();
}

function isSampleFullscreen(page: Page): Promise<boolean> {
  return page.evaluate(isFrameFullscreen, SAMPLE_TITLE);
}

function leaveDocumentFullscreen(): Promise<void> {
  return document.exitFullscreen();
}

/**
 * Presses Escape, as the user does to leave fullscreen, and waits until the
 * page left it. Firefox leaves on Playwright's Escape. Chromium and WebKit
 * leave fullscreen on Esc in the browser itself, which Playwright's key
 * events never reach, so there the test plays the browser's exit. The app
 * has no Escape handling of its own: either way it follows the same
 * `fullscreenchange` (design.md, D3).
 */
async function pressEscapeToLeave(
  page: Page,
  browserName: string,
): Promise<void> {
  await page.keyboard.press("Escape");
  if (browserName !== "firefox") {
    await page.evaluate(leaveDocumentFullscreen);
  }
  await expect
    .poll(page.evaluate.bind(page, readFullscreenElementTag))
    .toBeNull();
}

test.describe("Layout attribute", function describeAttribute(): void {
  test("Attribute at mount", async function setsAttributeAtMount({
    page,
  }): Promise<void> {
    await storeTheaterBeforeLoad(page, "true");

    const frame = await openLayoutProbe(page);

    expect(await frame.evaluate(readLayoutAtMount)).toBe("theater");
  });

  test("Attribute before the handlers", async function setsAttributeFirst({
    page,
  }): Promise<void> {
    const frame = await openLayoutProbe(page);
    await pressTheaterMode(page, true);
    await frame.waitForFunction(hasLayoutEvents, 1);

    await pressTheaterMode(page, false);
    await frame.waitForFunction(hasLayoutEvents, 2);

    expect(await frame.evaluate(readLayoutEvents)).toEqual([
      { layout: "theater", attribute: "theater" },
      { layout: "contained", attribute: "contained" },
    ]);
  });

  test("Opted-out mod gets the attribute", async function setsOptedOutAttribute({
    page,
  }): Promise<void> {
    await storeTheaterBeforeLoad(page, "true");

    const frame = await openLayoutProbe(page, ['  theme: "none"']);

    expect(await frame.evaluate(readLayoutAttribute)).toBe("theater");
  });
});

test.describe("Layout in the mount context", function describeContext(): void {
  test("Default mount context", async function mountsContained({
    page,
  }): Promise<void> {
    await exposeSampleEngine(page);
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    const frame = await findModFrame(page, SAMPLE_TITLE);
    await waitForProbe(frame);

    expect(await frame.evaluate(readContextLayout)).toBe("contained");
  });
});

test.describe("Content width in the contained layout", function describeWidth(): void {
  test("Wide stage area", async function limitsBody({ page }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);

    const frame = await openLayoutProbe(page);

    const contentWidth = await page.evaluate(measureContentWidth);
    const box = await frame.evaluate(readBodyBox);
    expect(box.frameWidth).toBeGreaterThan(contentWidth);
    expect(box.bodyWidth).toBeCloseTo(contentWidth, 0);
    expect(Math.abs(box.leftSpace - box.rightSpace)).toBeLessThanOrEqual(1);
  });

  test("Narrow stage area", async function fillsNarrowFrame({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1024, height: 768 });

    const frame = await openLayoutProbe(page);

    const box = await frame.evaluate(readBodyBox);
    expect(box.bodyWidth).toBeCloseTo(box.frameWidth, 0);
  });

  test("Theater fills the frame", async function fillsInTheater({
    page,
  }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);
    await storeTheaterBeforeLoad(page, "true");

    const frame = await openLayoutProbe(page);

    const box = await frame.evaluate(readBodyBox);
    expect(box.frameWidth).toBeGreaterThan(
      await page.evaluate(measureContentWidth),
    );
    expect(box.bodyWidth).toBeCloseTo(box.frameWidth, 0);
  });

  test("Mod keeps the full width", async function keepsFullWidth({
    page,
  }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);
    const frame = await openLayoutProbe(page);

    await frame.evaluate(addModStyle, "body { max-width: none; }");

    const box = await frame.evaluate(readBodyBox);
    expect(box.bodyWidth).toBeCloseTo(box.frameWidth, 0);
  });

  test("Opted-out mod has no limit", async function setsNoLimit({
    page,
  }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);

    const frame = await openLayoutProbe(page, ['  theme: "none"']);

    const contentWidth = await page.evaluate(measureContentWidth);
    expect(await frame.evaluate(readLayoutAttribute)).toBe("contained");
    expect((await frame.evaluate(readBodyBox)).bodyWidth).toBeGreaterThan(
      contentWidth,
    );
  });
});

test.describe("The frame keeps its size in every layout", function describeFrameSize(): void {
  test("Same frame in both layouts", async function keepsFrameBox({
    page,
  }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);
    const frame = await openSample(page);
    await markFrame(frame);
    const boxBefore = await readFrameBox(page, SAMPLE_TITLE);

    await pressTheaterMode(page, true);
    await waitForFrameLayout(frame, "theater");

    expect(await readFrameBox(page, SAMPLE_TITLE)).toEqual(boxBefore);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Wheel beside the content", async function scrollsBesideBody({
    page,
  }): Promise<void> {
    await page.setViewportSize(WIDE_VIEWPORT);
    const frame = await openLayoutProbe(page, [], TALL_LAYOUT_PROBE_MOD_CODE);
    const frameBox = await readFrameBox(page, "probe");
    if (frameBox === null) {
      throw new Error("Expected the probe's frame to have a box");
    }
    const bodyBox = await frame.evaluate(readBodyBox);
    expect(bodyBox.leftSpace).toBeGreaterThan(100);

    await page.mouse.move(
      frameBox.x + bodyBox.leftSpace / 2,
      frameBox.y + frameBox.height / 2,
    );
    await page.mouse.wheel(0, 600);

    await expect
      .poll(frame.evaluate.bind(frame, readScrollTop))
      .toBeGreaterThan(0);
  });
});

test.describe("Each mod frame has a layout", function describeLayouts(): void {
  test("Default layout", async function isContained({ page }): Promise<void> {
    const frame = await openSample(page);

    expect(await frame.evaluate(readLayoutAttribute)).toBe("contained");
  });

  test("Theater layout", async function isTheater({ page }): Promise<void> {
    const frame = await openSample(page);

    await pressTheaterMode(page, true);

    await waitForFrameLayout(frame, "theater");
  });

  test("Fullscreen from the stage bar", async function isFullscreen({
    page,
  }): Promise<void> {
    const frame = await openSample(page);

    await fullscreenButton(page).click();

    await waitForFrameLayout(frame, "fullscreen");
  });

  test("Fullscreen asked by the mod", async function followsModFullscreen({
    page,
  }): Promise<void> {
    const frame = await openLayoutProbe(page);
    await frame.evaluate(addFullscreenButton);

    await page
      .frameLocator('iframe[title="probe"]')
      .getByRole("button", { name: "Fullscreen" })
      .click();

    await waitForFrameLayout(frame, "fullscreen");
    expect(await frame.evaluate(readLayoutEvents)).toEqual([
      { layout: "fullscreen", attribute: "fullscreen" },
    ]);
  });

  test("Leaving fullscreen", async function returnsToTheater({
    page,
    browserName,
  }): Promise<void> {
    const frame = await openSample(page);
    await pressTheaterMode(page, true);
    await fullscreenButton(page).click();
    await waitForFrameLayout(frame, "fullscreen");

    await pressEscapeToLeave(page, browserName);

    await waitForFrameLayout(frame, "theater");
  });
});

test.describe("Theater mode is remembered", function describeRemembered(): void {
  test("Choice kept after a reload", async function keepsChoice({
    page,
  }): Promise<void> {
    await openSample(page);
    await pressTheaterMode(page, true);

    await page.reload();

    const frame = await waitForSample(page);
    await expect(theaterButton(page)).toHaveAttribute("aria-pressed", "true");
    expect(await frame.evaluate(readLayoutAttribute)).toBe("theater");
  });

  test("Unknown stored value", async function ignoresUnknown({
    page,
  }): Promise<void> {
    await storeTheaterBeforeLoad(page, '"maybe"');

    const frame = await openSample(page);

    await expect(theaterButton(page)).toHaveAttribute("aria-pressed", "false");
    expect(await frame.evaluate(readLayoutAttribute)).toBe("contained");
  });

  test("Storage cannot be written", async function appliesWithoutStorage({
    page,
  }): Promise<void> {
    await page.addInitScript(refuseTheaterWrites, THEATER_MODE_KEY);
    const frame = await openSample(page);

    await pressTheaterMode(page, true);

    await waitForFrameLayout(frame, "theater");
    expect(await readMessageCounts(page)).toEqual([
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 0, 0 unread",
    ]);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("Mods cannot reach the choice", async function hidesChoice({
    page,
  }): Promise<void> {
    await storeTheaterBeforeLoad(page, "true");
    const frame = await openLayoutProbe(page);
    await expect(theaterButton(page)).toHaveAttribute("aria-pressed", "true");

    const answers = [];
    for (const key of [
      THEATER_MODE_KEY,
      "theater-mode",
      "../opentesela.theater-mode",
    ]) {
      answers.push(
        await frame.evaluate(requestFromProbe, ["storage.get", { key }]),
      );
    }

    for (const answer of answers) {
      expect(answer.result).not.toBe(true);
      expect(answer.result).not.toBe("true");
    }
  });
});

test.describe("Layout changed event", function describeEvent(): void {
  test("Theater turned on", async function pushesOnce({ page }): Promise<void> {
    await exposeSampleEngine(page);
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    const frame = await findModFrame(page, SAMPLE_TITLE);
    await waitForProbe(frame);
    await frame.evaluate(recordSampleLayoutEvents);

    await pressTheaterMode(page, true);

    await expect
      .poll(frame.evaluate.bind(frame, readSampleLayoutEvents))
      .toEqual([{ layout: "theater" }]);
  });
});

test.describe("Fullscreen the visible mod", function describeFullscreen(): void {
  test("Frame fills the screen", async function fillsScreen({
    page,
  }): Promise<void> {
    const frame = await openSample(page);
    await markFrame(frame);

    await fullscreenButton(page).click();

    await expect.poll(isSampleFullscreen.bind(undefined, page)).toBe(true);
    expect(await isFrameMarked(frame)).toBe(true);
    expect(
      await page
        .locator(`iframe[title="${SAMPLE_TITLE}"]`)
        .evaluate(readFrameEdge),
    ).toEqual({ borderWidth: "0px", borderRadius: "0px" });
  });

  test("Escape leaves fullscreen", async function leavesWithEscape({
    page,
    browserName,
  }): Promise<void> {
    const frame = await openSample(page);
    await fullscreenButton(page).click();
    await waitForFrameLayout(frame, "fullscreen");

    await pressEscapeToLeave(page, browserName);

    await expect(stageBar(page)).toBeVisible();
    const barBox = await stageBar(page).boundingBox();
    const frameBox = await readFrameBox(page, SAMPLE_TITLE);
    expect(barBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeLessThanOrEqual(
      frameBox?.y ?? 0,
    );
    await expect(visibleSandbox(page).locator("iframe")).toBeVisible();
  });

  test("Fullscreen refused", async function warnsRefused({
    page,
  }): Promise<void> {
    await page.addInitScript(refuseFrameFullscreen);
    await openSample(page);

    await fullscreenButton(page).click();

    await expect(messageButton(page, "Warnings")).toHaveAccessibleName(
      /^Warnings: 1,/,
    );
    await expectMessages(
      page,
      "Warnings",
      "Fullscreen is not available: Fullscreen is blocked by the test",
    );
  });
});
