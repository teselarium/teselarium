import { expect, test } from "@playwright/test";
import type { Locator, Page, Route } from "@playwright/test";
import { openSection, pageBody, sectionItem, sidebar } from "./app_layout.ts";
import {
  buildProbeFiles,
  findModFrame,
  serveAppOriginMod,
  stageBar,
  waitForProbe,
} from "./mod_routes.ts";
import { storeTheaterBeforeLoad } from "./layout_probes.ts";
import { PROBE_LINK } from "./test_mods.ts";
import {
  addModHtml,
  buildThemeProbeFiles,
  DARK_COLORS,
  LIGHT_COLORS,
} from "./theme_probes.ts";

/** The computed look of a heading, as a mod and a page are compared. */
interface HeadingLook {
  fontSize: string;
  fontWeight: string;
  color: string;
}

/** The computed styles of the app's own interface that a page's styles must not change. */
interface InterfaceLook {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  color: string;
  background: string;
  borderCollapse: string;
  padding: string;
}

function readHeadingLook(element: Element): HeadingLook {
  const style = getComputedStyle(element);
  const look: HeadingLook = {
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
  };
  return look;
}

function readInterfaceLook(element: Element): InterfaceLook {
  const style = getComputedStyle(element);
  const look: InterfaceLook = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    color: style.color,
    background: style.backgroundColor,
    borderCollapse: style.borderCollapse,
    padding: style.padding,
  };
  return look;
}

function readCardColors(element: Element): {
  background: string;
  border: string;
} {
  const style = getComputedStyle(element);
  const colors = {
    background: style.backgroundColor,
    border: style.borderTopColor,
  };
  return colors;
}

/** Where a page's content sits in its page area, in pixels. */
interface PageContentBox {
  contentWidth: number;
  areaWidth: number;
  leftSpace: number;
  rightSpace: number;
  readingWidth: number;
}

/**
 * Runs in the page: the page's content, measured inside its page area (the
 * page's host), and the width of `--ot-reading-width`, measured on a probe.
 */
function readPageContentBox(pageContent: Element): PageContentBox {
  const root = pageContent.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    throw new Error(
      "Cannot measure the page content: it is not in a shadow root.",
    );
  }
  const areaBox = root.host.getBoundingClientRect();
  const contentBox = pageContent.getBoundingClientRect();
  const probe = document.createElement("div");
  probe.style.width = "var(--ot-reading-width)";
  document.body.append(probe);
  const readingWidth = probe.getBoundingClientRect().width;
  probe.remove();
  const box: PageContentBox = {
    contentWidth: contentBox.width,
    areaWidth: areaBox.width,
    leftSpace: contentBox.left - areaBox.left,
    rightSpace: areaBox.right - contentBox.right,
    readingWidth,
  };
  return box;
}

function readTextColor(element: Element): string {
  return getComputedStyle(element).color;
}

function setPageMarker(): void {
  (globalThis as { testMarker?: boolean }).testMarker = true;
}

function readPageMarker(): boolean {
  return (globalThis as { testMarker?: boolean }).testMarker === true;
}

async function answerMarkdown(markdown: string, route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/markdown",
    body: markdown,
  });
}

/** Serves `markdown` as the file of a page, e.g. `home/index` for `pages/home/index.md`. */
async function servePage(
  page: Page,
  pagePath: string,
  markdown: string,
): Promise<void> {
  await page.route(
    `**/pages/${pagePath}.md`,
    answerMarkdown.bind(undefined, markdown),
  );
}

function pageHeading(page: Page, name: string): Locator {
  return pageBody(page).getByRole("heading", { level: 1, name });
}

/** Interface elements whose look a page must not change: the header, the sidebar and an item. */
async function readInterfaceLooks(page: Page): Promise<InterfaceLook[]> {
  const looks = [
    await page.getByRole("banner").evaluate(readInterfaceLook),
    await sidebar(page).evaluate(readInterfaceLook),
    // Not the current item in either case, so only a leaking style could change it.
    await sectionItem(page, "Home").evaluate(readInterfaceLook),
  ];
  return looks;
}

test.describe("Page files", function describeFiles(): void {
  test("Replaced page", async function showsReplacedPage({
    page,
  }): Promise<void> {
    await servePage(page, "home/index", "# Welcome to the Library\n");

    await page.goto("/");

    await expect(pageHeading(page, "Welcome to the Library")).toBeVisible();
  });
});

test.describe("Pages look like mods", function describeLook(): void {
  test("Same heading as a mod", async function matchesModHeading({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await serveAppOriginMod(page, buildThemeProbeFiles("probe"));
    await servePage(page, "home/index", "# Heading\n");
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    await frame.evaluate(addModHtml, "<h1>Heading</h1>");
    // The probe has its own heading: the added one is last.
    const modLook = await frame.locator("h1").last().evaluate(readHeadingLook);

    await openSection(page, "Home");

    await expect(pageHeading(page, "Heading")).toBeVisible();
    expect(
      await pageHeading(page, "Heading").evaluate(readHeadingLook),
    ).toEqual(modLook);
  });

  test("Card in a page", async function drawsCard({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await servePage(page, "home/index", "<article>\n\nA card\n\n</article>\n");

    await page.goto("/");

    const card = pageBody(page).locator("article");
    await expect(card).toBeVisible();
    expect(await card.evaluate(readCardColors)).toEqual({
      background: LIGHT_COLORS.card.computed,
      border: LIGHT_COLORS.border.computed,
    });
  });

  test("Page styles stay inside", async function keepsStylesInside({
    page,
  }): Promise<void> {
    await servePage(
      page,
      "about/index",
      "# About\n\n| Name | Year |\n|---|---|\n| Kallocain | 1940 |\n",
    );
    await page.goto("/#/guides");
    await expect(pageHeading(page, "Guides")).toBeVisible();
    const withoutTable = await readInterfaceLooks(page);

    await openSection(page, "About");

    await expect(pageBody(page).locator("table")).toBeVisible();
    expect(await readInterfaceLooks(page)).toEqual(withoutTable);
  });

  test("Dark page", async function followsColorScheme({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(pageHeading(page, "Home")).toBeVisible();
    expect(await pageBody(page).evaluate(readTextColor)).toBe(
      LIGHT_COLORS.foreground.computed,
    );
    await page.evaluate(setPageMarker);

    await page.emulateMedia({ colorScheme: "dark" });

    await expect
      .poll(function readBodyColor(): Promise<string> {
        return pageBody(page).evaluate(readTextColor);
      })
      .toBe(DARK_COLORS.foreground.computed);
    expect(await page.evaluate(readPageMarker)).toBe(true);
  });
});

test.describe("Pages keep a reading width", function describeReadingWidth(): void {
  test("Wide page area", async function centersContent({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 2560, height: 1080 });

    await page.goto("/");

    await expect(pageHeading(page, "Home")).toBeVisible();
    const box = await pageBody(page).evaluate(readPageContentBox);
    expect(box.readingWidth).toBeGreaterThan(0);
    expect(box.areaWidth).toBeGreaterThan(box.readingWidth);
    expect(box.contentWidth).toBeCloseTo(box.readingWidth, 0);
    expect(Math.abs(box.leftSpace - box.rightSpace)).toBeLessThanOrEqual(1);
  });

  test("Narrow page area", async function fillsPageArea({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 600, height: 800 });

    await page.goto("/");

    await expect(pageHeading(page, "Home")).toBeVisible();
    const box = await pageBody(page).evaluate(readPageContentBox);
    expect(box.areaWidth).toBeLessThan(box.readingWidth);
    expect(box.contentWidth).toBeCloseTo(box.areaWidth, 0);
  });
  test("Theater mode does not widen pages", async function ignoresTheater({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 2560, height: 1080 });
    await storeTheaterBeforeLoad(page, "true");

    await page.goto("/");

    await expect(pageHeading(page, "Home")).toBeVisible();
    const box = await pageBody(page).evaluate(readPageContentBox);
    expect(box.contentWidth).toBeCloseTo(box.readingWidth, 0);
  });
});

test.describe("Links in pages", function describeLinks(): void {
  test("Sibling page", async function opensSibling({ page }): Promise<void> {
    await servePage(
      page,
      "guides/index",
      "# Guides\n\n[First steps](first_steps.md)\n",
    );
    await servePage(page, "guides/first_steps", "# First steps\n");
    await page.goto("/#/guides");

    await pageBody(page).getByRole("link", { name: "First steps" }).click();

    await expect(pageHeading(page, "First steps")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/guides/first_steps");
    await page.goBack();
    await expect(pageHeading(page, "Guides")).toBeVisible();
  });

  test("Run link", async function opensRunLink({ page }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await servePage(
      page,
      "home/index",
      `# Home\n\n[Probe](${PROBE_LINK.slice(1)})\n`,
    );
    await page.goto("/");

    await pageBody(page).getByRole("link", { name: "Probe" }).click();

    await expect(stageBar(page)).toContainText("probe");
    await waitForProbe(await findModFrame(page, "probe"));
  });
});

test.describe("Page load failures", function describeFailures(): void {
  test("Missing page", async function showsMissingPage({
    page,
  }): Promise<void> {
    await page.goto("/#/guides/missing");
    const missingUrl = new URL("/pages/guides/missing.md", page.url()).href;

    await expect(page.getByRole("alert")).toContainText(missingUrl);
    await expect(page.getByRole("alert")).toContainText("404");
    await openSection(page, "Home");

    await expect(pageHeading(page, "Home")).toBeVisible();
  });
});

test.describe("Vanilla pages", function describeVanillaPages(): void {
  test("Vanilla Home", async function showsVanillaHome({
    page,
  }): Promise<void> {
    await page.goto("/");

    await expect(pageHeading(page, "Home")).toBeVisible();
    await expect(pageBody(page).getByRole("status")).toContainText(
      "work in progress",
    );
  });

  test("ships a Guides and an About page", async function showsVanillaPages({
    page,
  }): Promise<void> {
    for (const [hash, name] of [
      ["#/guides", "Guides"],
      ["#/about", "About"],
    ]) {
      await page.goto(`/${hash}`);
      await expect(pageHeading(page, name)).toBeVisible();
      await expect(pageBody(page).getByRole("status")).toContainText(
        "work in progress",
      );
    }
  });
});
