import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  currentItem,
  hamburgerButton,
  openModsSection,
  openSection,
  pageBody,
  readSidebarWidth,
  resizeHandle,
  sectionItem,
  sectionsNav,
  sidebar,
} from "./app_layout.ts";
import {
  EXPLORER_OFF_PREVIEW_URL,
  HOME_MOD_PREVIEW_URL,
} from "./app_servers.ts";
import {
  buildProbeFiles,
  findModFrame,
  findVisibleFrame,
  isFrameMarked,
  markFrame,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  waitForProbe,
} from "./mod_routes.ts";
import { openProbe, serveExplorerOfTilesMod } from "./test_mods.ts";
import { DARK_COLORS, LIGHT_COLORS } from "./theme_probes.ts";

const SIDEBAR_LAYOUT_KEY = "opentesela.sidebar";

/** The bottom of the frame may sit this far from the viewport's edge: the stage's padding and border. */
const EDGE_TOLERANCE = 24;

async function readFrameBox(
  page: Page,
  title: string,
): Promise<{ x: number; width: number; right: number }> {
  const box = await page.locator(`iframe[title="${title}"]`).boundingBox();
  if (box === null) {
    throw new Error(`Expected a visible frame titled "${title}"`);
  }
  const frameBox = { x: box.x, width: box.width, right: box.x + box.width };
  return frameBox;
}

/** Presses the pointer on the resize handle's center, and gives that point. */
async function grabHandle(page: Page): Promise<{ x: number; y: number }> {
  const box = await resizeHandle(page).boundingBox();
  if (box === null) {
    throw new Error("Expected the resize handle");
  }
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

/** Drags the resize handle by `distance` pixels to the right, in steps, and releases it. */
async function dragHandleBy(page: Page, distance: number): Promise<void> {
  const start = await grabHandle(page);
  await page.mouse.move(start.x + distance, start.y, { steps: 10 });
  await page.mouse.up();
}

/** Drags the resize handle so the sidebar would be `width` pixels wide, and releases it. */
async function dragHandleToWidth(page: Page, width: number): Promise<void> {
  const currentWidth = await page.evaluate(readSidebarWidth);
  await dragHandleBy(page, width - currentWidth);
}

function readBackgroundColor(element: Element): string {
  return getComputedStyle(element).backgroundColor;
}

function readTextColor(element: Element): string {
  return getComputedStyle(element).color;
}

test.describe("Vanilla sections", function describeVanilla(): void {
  test("Tiles opens the collection explorer", async function opensTiles({
    page,
  }): Promise<void> {
    await page.goto("/");

    await openSection(page, "Tiles");

    await expect(stageBar(page)).toContainText("Tiles");
    await expect(page.locator('iframe[title="Tiles"]')).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/run?mod=collection_explorer");
    await expect(currentItem(page)).toHaveText("Tiles");
  });

  test("Mosaics opens the mosaic explorer", async function opensMosaics({
    page,
  }): Promise<void> {
    await page.goto("/");

    await openSection(page, "Mosaics");

    await expect(stageBar(page)).toContainText("Mosaics");
    await expect(page.locator('iframe[title="Mosaics"]')).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/run?mod=mosaic_explorer");
    await expect(currentItem(page)).toHaveText("Mosaics");
  });

  test("Tinted image follows the color scheme", async function tintsImage({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${HOME_MOD_PREVIEW_URL}/`);
    const icon = sectionItem(page, "Guides").locator(
      '[data-section-icon="tinted"]',
    );
    expect(await icon.evaluate(readBackgroundColor)).toBe(
      LIGHT_COLORS.foreground.computed,
    );

    await page.emulateMedia({ colorScheme: "dark" });

    await expect
      .poll(function readIconColor(): Promise<string> {
        return icon.evaluate(readBackgroundColor);
      })
      .toBe(DARK_COLORS.foreground.computed);
  });

  test("Explorer switched off", async function hidesMods({
    page,
  }): Promise<void> {
    await page.goto(`${EXPLORER_OFF_PREVIEW_URL}/`);
    await expect(sectionItem(page, "Home")).toBeVisible();

    await expect(sectionItem(page, "Mods")).toHaveCount(0);
    await openSection(page, "Settings");
    await expect(page.getByRole("switch", { name: "Guides" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Mods" })).toHaveCount(0);
  });
});

test.describe("Section navigation", function describeNavigation(): void {
  test("Back where you left off", async function showsLastView({
    page,
  }): Promise<void> {
    await serveExplorerOfTilesMod(page);
    await page.goto("/");
    await openModsSection(page);
    const explorer = await findModFrame(page, "Mods");
    await explorer.getByRole("button", { name: /Tiles/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");
    const viewer = await findModFrame(page, "Mod Viewer");
    await markFrame(viewer);
    await openSection(page, "Home");
    await expect(pageBody(page)).toBeVisible();

    await openSection(page, "Mods");

    await expect(stageBar(page)).toContainText("Mod Viewer");
    expect(await isFrameMarked(viewer)).toBe(true);
  });

  test("Activating the current section returns to its start", async function showsRoot({
    page,
  }): Promise<void> {
    await serveExplorerOfTilesMod(page);
    await page.goto("/");
    await openModsSection(page);
    const explorer = await findModFrame(page, "Mods");
    await markFrame(explorer);
    await explorer.getByRole("button", { name: /Tiles/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");

    await openSection(page, "Mods");

    await expect(page.locator('iframe[title="Mods"]')).toBeVisible();
    expect(await isFrameMarked(explorer)).toBe(true);
  });

  test("Back after switching sections", async function goesBackAcrossSections({
    page,
  }): Promise<void> {
    await page.goto("/");
    await openModsSection(page);
    await openSection(page, "Home");
    await openSection(page, "Mods");
    await expect(page.locator('iframe[title="Mods"]')).toBeVisible();

    await page.goBack();
    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Home" }),
    ).toBeVisible();
    await page.goBack();

    await expect(page.locator('iframe[title="Mods"]')).toBeVisible();
  });
});

test.describe("Active section", function describeActiveSection(): void {
  test("Kept after a reload", async function keepsAfterReload({
    page,
  }): Promise<void> {
    await serveExplorerOfTilesMod(page);
    await page.goto("/");
    await openModsSection(page);
    const explorer = await findModFrame(page, "Mods");
    await explorer.getByRole("button", { name: /Tiles/ }).click();
    await expect(stageBar(page)).toContainText("Mod Viewer");

    await page.reload();

    await expect(stageBar(page)).toContainText("Mod Viewer");
    await expect(currentItem(page)).toHaveText("Mods");
  });
});

test.describe("Sidebar states", function describeStates(): void {
  test("Hide and restore", async function hidesAndRestores({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openProbe(page);
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");

    await hamburgerButton(page).click();
    await expect(sectionsNav(page)).toBeHidden();
    await expect(hamburgerButton(page)).toBeVisible();
    await expect(hamburgerButton(page)).toHaveAccessibleName("Show sidebar");
    // The main area takes the whole width, and the mod keeps running.
    const hiddenBox = await readFrameBox(page, "probe");
    expect(hiddenBox.x).toBeLessThanOrEqual(EDGE_TOLERANCE);
    expect(1280 - hiddenBox.right).toBeLessThanOrEqual(EDGE_TOLERANCE);
    expect(await isFrameMarked(frame)).toBe(true);
    await hamburgerButton(page).click();

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await expect(sectionItem(page, "Guides")).toBeVisible();
  });

  test("Collapse keeps mods running", async function keepsModsRunning({
    page,
  }): Promise<void> {
    await openProbe(page);
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    const before = await readFrameBox(page, "probe");

    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();

    await expect
      .poll(async function readFrameWidth(): Promise<number> {
        return (await readFrameBox(page, "probe")).width;
      })
      .toBeGreaterThan(before.width);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Tooltip on hover", async function showsTooltip({
    page,
  }): Promise<void> {
    await page.goto("/");
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();

    await sectionItem(page, "Guides").hover();

    await expect(page.locator('[data-slot="tooltip-content"]')).toBeVisible();
    await expect(page.locator('[data-slot="tooltip-content"]')).toContainText(
      "Guides",
    );
  });
});

test.describe("Resize the sidebar", function describeResize(): void {
  test.beforeEach(async function useWideViewport({ page }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Drag wider", async function dragsWider({ page }): Promise<void> {
    await openProbe(page);
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    const before = await readFrameBox(page, "probe");
    expect(await page.evaluate(readSidebarWidth)).toBe(240);

    await dragHandleBy(page, 100);

    expect(await page.evaluate(readSidebarWidth)).toBe(340);
    const after = await readFrameBox(page, "probe");
    expect(before.width - after.width).toBeCloseTo(100, 0);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Width is clamped", async function clampsWidth({ page }): Promise<void> {
    await page.goto("/");

    await dragHandleToWidth(page, 600);

    expect(await page.evaluate(readSidebarWidth)).toBe(400);
  });

  test("Drag to collapse", async function collapsesWhileHeld({
    page,
  }): Promise<void> {
    await openProbe(page);
    const start = await grabHandle(page);

    await page.mouse.move(start.x - 120, start.y, { steps: 10 });

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await page.mouse.up();
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });

  test("Drag back before releasing", async function expandsAgainWhileHeld({
    page,
  }): Promise<void> {
    await openProbe(page);
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    const start = await grabHandle(page);
    await page.mouse.move(start.x - 120, start.y, { steps: 10 });
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");

    await page.mouse.move(start.x + 60, start.y, { steps: 10 });
    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    await page.mouse.up();

    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    expect(await page.evaluate(readSidebarWidth)).toBe(300);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Drag over a mod's frame", async function dragsOverFrame({
    page,
  }): Promise<void> {
    await openProbe(page);
    const start = await grabHandle(page);

    // Across the visible frame, which starts right of the sidebar.
    await page.mouse.move(start.x + 90, start.y, { steps: 10 });
    expect(await page.evaluate(readSidebarWidth)).toBe(330);
    await page.mouse.move(start.x + 140, start.y, { steps: 10 });
    expect(await page.evaluate(readSidebarWidth)).toBe(380);
    await page.mouse.up();

    expect(await page.evaluate(readSidebarWidth)).toBe(380);
  });

  test("Frame beside the sidebar", async function placesFrame({
    page,
  }): Promise<void> {
    await openProbe(page);

    const sidebarBox = await sidebar(page).boundingBox();
    const frameBox = await readFrameBox(page, "probe");

    expect(frameBox.x).toBeGreaterThan(
      (sidebarBox?.x ?? 0) + (sidebarBox?.width ?? 0),
    );
    expect(1280 - frameBox.right).toBeGreaterThanOrEqual(0);
    expect(1280 - frameBox.right).toBeLessThanOrEqual(EDGE_TOLERANCE);
  });
});

test.describe("Expand the rail by dragging", function describeExpandRail(): void {
  test.beforeEach(async function useCollapsedSidebar({ page }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openProbe(page);
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });

  test("Drag to expand", async function expandsByDragging({
    page,
  }): Promise<void> {
    const frame = await findVisibleFrame(page);
    await markFrame(frame);

    await dragHandleToWidth(page, 300);

    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    expect(await page.evaluate(readSidebarWidth)).toBe(300);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Short drag stays collapsed", async function staysCollapsed({
    page,
  }): Promise<void> {
    await dragHandleToWidth(page, 120);

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });
});

test.describe("Sidebar layout is remembered", function describeRemembered(): void {
  test("Collapsed after a reload", async function keepsCollapsed({
    page,
  }): Promise<void> {
    await page.goto("/");
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();

    await page.reload();

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });

  test("Width after a reload", async function keepsWidth({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await dragHandleToWidth(page, 320);

    await page.reload();

    await expect(resizeHandle(page)).toHaveAttribute("aria-valuenow", "320");
    expect(await page.evaluate(readSidebarWidth)).toBe(320);
  });

  test("Mods cannot reach the layout", async function hidesLayout({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();
    const keys = [SIDEBAR_LAYOUT_KEY, "sidebar", "layout", "opentesela.layout"];

    const answers = [];
    for (const key of keys) {
      answers.push(
        await frame.evaluate(requestFromProbe, ["storage.get", { key }]),
      );
    }

    for (const answer of answers) {
      expect(answer).toEqual({ result: null });
    }
  });
});

test.describe("Narrow viewports", function describeNarrow(): void {
  test.beforeEach(async function useNarrowViewport({ page }): Promise<void> {
    await page.setViewportSize({ width: 375, height: 700 });
  });

  test("Expand over the content", async function opensDrawer({
    page,
  }): Promise<void> {
    await openProbe(page);
    const before = await readFrameBox(page, "probe");

    await sidebar(page).getByRole("button", { name: "Expand sidebar" }).click();

    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: "Guides" })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Guides" })).toHaveText(
      "Guides",
    );
    expect((await readFrameBox(page, "probe")).width).toBe(before.width);
  });
});

test.describe("Sidebar colors", function describeColors(): void {
  test("follows the light color scheme", async function drawsLightSidebar({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/");

    expect(await sidebar(page).evaluate(readBackgroundColor)).toBe(
      LIGHT_COLORS.card.computed,
    );
    expect(await currentItem(page).evaluate(readTextColor)).toBe(
      LIGHT_COLORS.accentForeground.computed,
    );
  });
});
