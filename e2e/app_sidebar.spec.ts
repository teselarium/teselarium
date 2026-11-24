import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
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
  sidebarItems,
  sidebarThemeButton,
} from "./app_layout.ts";
import {
  DESKTOP_VIEWPORT,
  isFullyShown,
  readElementBox,
  SMALL_PHONE_VIEWPORT,
} from "./layout_probes.ts";
import {
  EXPLORER_OFF_PREVIEW_URL,
  HOME_MOD_PREVIEW_URL,
  TEST_CATALOG_PREVIEW_URL,
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

const SIDEBAR_LAYOUT_KEY = "teselarium.sidebar";

/** An element's box, as Playwright measures it. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The frame may sit this far from the viewport's edge: the shell's gap and the frame's border. */
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

async function readBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Expected the element to have a box");
  }
  return box;
}

/** The sidebar's toggle, whichever state it is in: Collapse or Expand. */
function sidebarToggle(page: Page): Locator {
  return sidebar(page).getByRole("button", {
    name: /^(Collapse|Expand) sidebar$/,
  });
}

/** The left edges of every button and icon that must keep its place across the sidebar's states. */
async function readAxisLefts(page: Page): Promise<number[]> {
  const lefts = [
    (await readBox(hamburgerButton(page))).x,
    (await readBox(sectionItem(page, "Mods").locator("svg"))).x,
    (await readBox(sidebarThemeButton(page))).x,
    (await readBox(sidebarToggle(page))).x,
  ];
  return lefts;
}

function readBackgroundColor(element: Element): string {
  return getComputedStyle(element).backgroundColor;
}

function readTextColor(element: Element): string {
  return getComputedStyle(element).color;
}

/**
 * Runs on a mosaic icon's first shape: the lightness of its fill, from 0 to
 * 255, read back from a canvas, whatever color syntax the fill computes to.
 */
function readShapeLightness(icon: Element): number {
  const shape = icon.querySelector(".mosaic-shape-1");
  if (shape === null) {
    throw new Error("Cannot read the mosaic icon's shape: it has none.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Cannot read the mosaic icon's shape: no 2D canvas.");
  }
  context.fillStyle = getComputedStyle(shape).fill;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  const lightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return lightness;
}

function mosaicsIcon(page: Page): Locator {
  return sectionItem(page, "Mosaics").locator("svg");
}

/** Runs on a lucide icon: the color its lines are drawn in. */
function readStrokeColor(element: Element): string {
  return getComputedStyle(element).stroke;
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

  test("Footer follows the main group", async function placesFooter({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 1200 });

    await page.goto("/");

    const guides = await readBox(sectionItem(page, "Guides"));
    const divider = await readBox(
      sectionsNav(page).locator('[data-slot="separator"]'),
    );
    const settings = await readBox(sectionItem(page, "Settings"));
    expect(divider.y).toBeGreaterThan(guides.y + guides.height);
    expect(settings.y).toBeGreaterThan(divider.y);
    expect(settings.y - (guides.y + guides.height)).toBeLessThan(
      2 * guides.height,
    );
  });

  test("Icons follow the text color", async function tintsCatalogIcon({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const item = sectionItem(page, "Mods");
    const lightColor = await item.evaluate(readTextColor);
    expect(await item.locator("svg").evaluate(readStrokeColor)).toBe(
      lightColor,
    );

    await page.emulateMedia({ colorScheme: "dark" });

    await expect
      .poll(function readItemColor(): Promise<string> {
        return item.evaluate(readTextColor);
      })
      .not.toBe(lightColor);
    expect(await item.locator("svg").evaluate(readStrokeColor)).toBe(
      await item.evaluate(readTextColor),
    );
  });

  test("Mosaic icon follows the color scheme", async function colorsMosaicIcon({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const lightLightness = await mosaicsIcon(page).evaluate(readShapeLightness);

    await page.emulateMedia({ colorScheme: "dark" });

    // The dark scheme's colors are pastels: lighter than the light scheme's.
    await expect
      .poll(function readDarkLightness(): Promise<number> {
        return mosaicsIcon(page).evaluate(readShapeLightness);
      })
      .toBeGreaterThan(lightLightness + 40);
  });

  test("Mosaic icon on the current item", async function darkensOnAccent({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const notCurrent = await mosaicsIcon(page).evaluate(readShapeLightness);

    await openSection(page, "Mosaics");

    await expect(currentItem(page)).toHaveText("Mosaics");
    expect(await mosaicsIcon(page).evaluate(readShapeLightness)).toBeLessThan(
      notCurrent - 40,
    );
  });

  test("Explorer switched off", async function hidesMods({
    page,
  }): Promise<void> {
    await page.goto(`${EXPLORER_OFF_PREVIEW_URL}/`);
    await expect(sectionItem(page, "Home")).toBeVisible();

    await expect(sectionItem(page, "Mods")).toHaveCount(0);
    await openSection(page, "Settings");
    await expect(page.getByRole("switch", { name: "Guides" })).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Mods", exact: true }),
    ).toHaveCount(0);
  });
});

test.describe("Section navigation", function describeNavigation(): void {
  test("Back where you left off", async function showsLastView({
    page,
  }): Promise<void> {
    await serveExplorerOfTilesMod(page);
    await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
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
    await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
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
      pageBody(page).getByRole("heading", { level: 1, name: "Teselarium" }),
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
    await page.goto(`${TEST_CATALOG_PREVIEW_URL}/`);
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
    // The main area takes the whole width, beside the chip, and the mod keeps running.
    const hiddenBox = await readFrameBox(page, "probe");
    const chipBox = await readBox(hamburgerButton(page));
    expect(hiddenBox.x).toBeLessThan(chipBox.x + chipBox.width);
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

  test("Collapse does not move the icons", async function keepsIconAxis({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const expandedLefts = await readAxisLefts(page);

    await sidebarToggle(page).click();

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    const collapsedLefts = await readAxisLefts(page);
    for (const [index, left] of collapsedLefts.entries()) {
      expect(Math.abs(left - expandedLefts[index])).toBeLessThanOrEqual(1);
    }
  });

  test("Hiding does not move the hamburger", async function keepsHamburger({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const before = await readBox(hamburgerButton(page));

    await hamburgerButton(page).click();

    await expect(sidebar(page)).toHaveAttribute("data-state", "hidden");
    const after = await readBox(hamburgerButton(page));
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
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
    const keys = [SIDEBAR_LAYOUT_KEY, "sidebar", "layout", "teselarium.layout"];

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

  test("Open sidebar keeps the first row", async function keepsFirstRow({
    page,
  }): Promise<void> {
    await page.goto("/");
    const railHamburger = await readBox(hamburgerButton(page));

    await sidebar(page).getByRole("button", { name: "Expand sidebar" }).click();

    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Teselarium", { exact: true })).toBeVisible();
    const drawerHamburger = drawer.getByRole("button", {
      name: "Hide sidebar",
    });
    await expect(drawerHamburger).toBeVisible();
    // The drawer slides in: its box is read once it settled.
    await expect
      .poll(async function readDrawerOffset(): Promise<number> {
        const box = await readBox(drawerHamburger);
        return Math.abs(box.x - railHamburger.x);
      })
      .toBeLessThanOrEqual(1);
    const box = await readBox(drawerHamburger);
    expect(Math.abs(box.y - railHamburger.y)).toBeLessThanOrEqual(1);
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

/** A phone held sideways: a compact viewport, where the sidebar starts as its rail, and short. */
const LANDSCAPE_PHONE_VIEWPORT = { width: 915, height: 412 };

/** Runs on an element: whether its content is taller than its box, so it can scroll. */
function canScrollVertically(element: Element): boolean {
  return element.scrollHeight > element.clientHeight;
}

/** Runs in the page: the viewport's height. */
function readViewportHeight(): number {
  return window.innerHeight;
}

/** Whether `locator` is fully inside the viewport, sideways and up and down. */
async function isInsideViewport(
  page: Page,
  locator: Locator,
): Promise<boolean> {
  const box = await locator.evaluate(readElementBox);
  const viewportHeight = await page.evaluate(readViewportHeight);
  const isShown = await locator.evaluate(isFullyShown);
  return isShown && box.top >= 0 && box.bottom <= viewportHeight;
}

test.describe("Sidebar fits short viewports", function describeShortViewports(): void {
  test("Landscape phone", async function scrollsItems({ page }): Promise<void> {
    await page.setViewportSize(LANDSCAPE_PHONE_VIEWPORT);
    await page.goto("/");
    await sidebar(page).getByRole("button", { name: "Expand sidebar" }).click();
    const collapseButton = sidebar(page).getByRole("button", {
      name: "Collapse sidebar",
    });
    await expect(collapseButton).toBeVisible();
    expect(await isInsideViewport(page, collapseButton)).toBe(true);
    expect(await isInsideViewport(page, hamburgerButton(page))).toBe(true);

    await sidebarThemeButton(page).scrollIntoViewIfNeeded();

    expect(await isInsideViewport(page, sidebarThemeButton(page))).toBe(true);
    const itemsBox = await sidebarItems(page).evaluate(readElementBox);
    const themeBox = await sidebarThemeButton(page).evaluate(readElementBox);
    expect(themeBox.bottom).toBeLessThanOrEqual(itemsBox.bottom);
    expect(await isInsideViewport(page, collapseButton)).toBe(true);
    await collapseButton.click();
    await expect(
      sidebar(page).getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();
    expect(
      await isInsideViewport(
        page,
        sidebar(page).getByRole("button", { name: "Expand sidebar" }),
      ),
    ).toBe(true);
  });

  test("Tall viewport does not scroll", async function keepsItemsStill({
    page,
  }): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/");
    await expect(sidebarThemeButton(page)).toBeVisible();

    expect(await sidebarItems(page).evaluate(canScrollVertically)).toBe(false);
  });
});

/** The tooltips shown on the page. */
function shownTooltips(page: Page): Locator {
  return page.locator('[data-slot="tooltip-content"]');
}

test.describe(
  "Phone: tooltips and the drawer",
  { tag: "@mobile" },
  function describePhone(): void {
    test("Tap a rail icon on a phone", async function tapsRailIcon({
      page,
    }): Promise<void> {
      await page.goto("/");
      await expect(
        sidebar(page).getByRole("button", { name: "Expand sidebar" }),
      ).toBeVisible();

      await sectionItem(page, "Mods").tap();

      await expect(currentItem(page)).toHaveAccessibleName("Mods");
      await expect(stageBar(page)).toContainText("Mods");
      await expect(shownTooltips(page)).toHaveCount(0);
    });

    test("Tap the theme control on a phone", async function tapsThemeControl({
      page,
    }): Promise<void> {
      await page.goto("/");

      await sidebarThemeButton(page).tap();

      await expect(sidebarThemeButton(page)).toHaveAccessibleName(
        "Theme: Light",
      );
      await expect(shownTooltips(page)).toHaveCount(0);
    });

    test("The hamburger button, the backdrop and Escape close the drawer", async function closesDrawer({
      page,
    }): Promise<void> {
      await page.goto("/");
      const drawer = page.getByRole("dialog");
      const expandButton = sidebar(page).getByRole("button", {
        name: "Expand sidebar",
      });

      await expandButton.tap();
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("button", { name: "Close" })).toHaveCount(
        0,
      );
      const viewport = page.viewportSize() ?? { width: 412, height: 915 };
      await page.touchscreen.tap(viewport.width - 20, viewport.height / 2);
      await expect(drawer).toHaveCount(0);

      await expandButton.tap();
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);

      // The drawer's hamburger button closes it too, and hides the sidebar (see "Sidebar states").
      await expandButton.tap();
      await expect(drawer).toBeVisible();
      await drawer.getByRole("button", { name: "Hide sidebar" }).tap();
      await expect(drawer).toHaveCount(0);
    });
  },
);

const NOBEL_MAP_MOSAIC_LINK =
  "/#/run?mosaic=./samples/mosaics/nobel_laureates_map.yaml";
const MAP_MOSAIC_TITLE = "Nobel laureates on the map";

/** The viewport's height in the compact viewports' scenarios. */
const COMPACT_HEIGHT = 800;

/** Resizes the window to `width` in steps of `step` pixels, as a user dragging its edge. */
async function resizeWindowTo(
  page: Page,
  width: number,
  step: number = 20,
): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("Expected the page to have a viewport size");
  }
  const signedStep = width < viewport.width ? -step : step;
  let current = viewport.width;
  while (Math.abs(width - current) > step) {
    current += signedStep;
    await page.setViewportSize({ width: current, height: COMPACT_HEIGHT });
  }
  await page.setViewportSize({ width, height: COMPACT_HEIGHT });
}

/** Opens the app on the Nobel map mosaic, and waits for its mosaic capsule. */
async function openNobelMap(page: Page): Promise<void> {
  await page.goto(NOBEL_MAP_MOSAIC_LINK);
  await expect(
    stageBar(page).getByRole("button", { name: `Mosaic: ${MAP_MOSAIC_TITLE}` }),
  ).toBeVisible();
}

/** The stage bar shows the mod, collection and mosaic capsules, not the folded one. */
async function expectThreeCapsules(page: Page): Promise<void> {
  await expect(stageBar(page)).not.toHaveAttribute("data-narrow");
  for (const name of [
    /^Mod: /,
    /^Collection: /,
    `Mosaic: ${MAP_MOSAIC_TITLE}`,
  ]) {
    await expect(stageBar(page).getByRole("button", { name })).toBeVisible();
  }
}

/** What the page records while a test watches the layout change. */
interface LayoutWatch {
  hasBarFolded: boolean;
  /** The narrowest viewport at which the sidebar was expanded, or `null`. */
  narrowestExpanded: number | null;
}

/**
 * Runs on the app's layout: records, from now on, whether the stage bar is
 * ever narrow (`data-narrow`, the folded capsule), and the narrowest
 * viewport at which the sidebar is expanded.
 */
function watchLayout(layout: Element): void {
  const watch = globalThis as unknown as LayoutWatch;
  watch.hasBarFolded = false;
  watch.narrowestExpanded = null;
  function recordLayout(): void {
    if (layout.querySelector("section.stage-bar[data-narrow]") !== null) {
      watch.hasBarFolded = true;
    }
    const isExpanded = layout.getAttribute("data-sidebar-state") === "expanded";
    if (isExpanded && (watch.narrowestExpanded ?? Infinity) > innerWidth) {
      watch.narrowestExpanded = innerWidth;
    }
  }
  recordLayout();
  new MutationObserver(recordLayout).observe(layout, {
    subtree: true,
    attributeFilter: ["data-narrow", "data-sidebar-state"],
  });
}

function readLayoutWatch(): LayoutWatch {
  const watch = globalThis as unknown as LayoutWatch;
  const copy: LayoutWatch = {
    hasBarFolded: watch.hasBarFolded,
    narrowestExpanded: watch.narrowestExpanded,
  };
  return copy;
}

async function startLayoutWatch(page: Page): Promise<void> {
  await page.locator(".app-layout").evaluate(watchLayout);
}

function blurActiveElement(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

test.describe("Compact viewports", function describeCompact(): void {
  test("Narrowing the window", async function showsRailOnNarrowing({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: COMPACT_HEIGHT });
    await openNobelMap(page);
    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    await startLayoutWatch(page);

    await resizeWindowTo(page, 860, 10);

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await expectThreeCapsules(page);
    expect(await isFrameMarked(frame)).toBe(true);
    expect((await page.evaluate(readLayoutWatch)).hasBarFolded).toBe(false);
  });

  test("Widening the window from a narrow viewport", async function expandsOnceWide({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 767, height: COMPACT_HEIGHT });
    await openNobelMap(page);
    await startLayoutWatch(page);

    await resizeWindowTo(page, 984, 1);

    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    expect(await page.evaluate(readSidebarWidth)).toBe(200);
    expect((await page.evaluate(readLayoutWatch)).narrowestExpanded).toBe(984);
    await resizeWindowTo(page, 1024, 1);
    await expect.poll(page.evaluate.bind(page, readSidebarWidth)).toBe(240);
  });

  test("Opening the app on a compact viewport", async function opensAsRail({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 860, height: COMPACT_HEIGHT });

    await openNobelMap(page);

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await expectThreeCapsules(page);
  });

  test("The user expands it", async function expandsInline({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 860, height: COMPACT_HEIGHT });
    await openNobelMap(page);
    const frame = await findVisibleFrame(page);
    await markFrame(frame);
    await page.evaluate(blurActiveElement);

    await page.keyboard.press("Control+b");

    await expect(sidebar(page)).toHaveAttribute("data-state", "expanded");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(readSidebarWidth)).toBe(200);
    expect(await isFrameMarked(frame)).toBe(true);
    await page.reload();
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });

  test("Collapsed or hidden sidebar", async function keepsCollapsed({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: COMPACT_HEIGHT });
    await page.goto("/");
    await sidebar(page)
      .getByRole("button", { name: "Collapse sidebar" })
      .click();

    await resizeWindowTo(page, 860);
    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await hamburgerButton(page).click();
    await resizeWindowTo(page, 1280);

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
  });

  test("Phone viewport", async function followsNarrowRules({
    page,
  }): Promise<void> {
    await page.setViewportSize(SMALL_PHONE_VIEWPORT);
    await page.goto("/");

    await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
    await expect(resizeHandle(page)).toHaveCount(0);
    await sidebar(page).getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("The main area keeps 784px", function describeMainArea(): void {
  test("The main area keeps 784px", async function clampsToMainArea({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: COMPACT_HEIGHT });
    await page.goto("/");
    await dragHandleToWidth(page, 400);
    await expect(resizeHandle(page)).toHaveAttribute("aria-valuenow", "400");

    await page.setViewportSize({ width: 1100, height: COMPACT_HEIGHT });
    await expect.poll(page.evaluate.bind(page, readSidebarWidth)).toBe(316);
    await page.setViewportSize({ width: 1280, height: COMPACT_HEIGHT });

    await expect.poll(page.evaluate.bind(page, readSidebarWidth)).toBe(400);
  });
});
