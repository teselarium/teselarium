import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  actionDialog,
  buildProbeFiles,
  findModFrame,
  isFrameMarked,
  markFrame,
  requestFromProbe,
  routeCovers,
  serveAppOriginMod,
  stageBar,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import {
  buildThemeProbeFiles,
  canFrameScroll,
  chooseTheme,
  DARK_COLORS,
  LIGHT_COLORS,
  readBodyColors,
  readColorSchemeAttribute,
  readPageOverflow,
  readVisibleFrameBox,
  TALL_PROBE_MOD_CODE,
  themeControl,
  waitForFrameColorScheme,
} from "./theme_probes.ts";

const SAMPLE_RUN_LINK =
  "/#/run?mod=./samples/mods/book_list&collection=./samples/tiles/books_collection.yaml";

/** The bottom of the frame may sit this far above the viewport's bottom: the stage's padding and border. */
const BOTTOM_TOLERANCE = 24;

async function openSample(page: Page): Promise<void> {
  await routeCovers(page);
  await page.goto(SAMPLE_RUN_LINK);
  const frame = await findModFrame(page, "Book List");
  await expect(frame.getByRole("button", { name: /Kallocain/ })).toBeVisible();
}

function readStageBarColor(element: Element): string {
  return getComputedStyle(element).color;
}

function readDialogColors(element: Element): {
  background: string;
  color: string;
} {
  const style = getComputedStyle(element);
  const colors = { background: style.backgroundColor, color: style.color };
  return colors;
}

function setPageMarker(): void {
  (globalThis as { testMarker?: boolean }).testMarker = true;
}

function readPageMarker(): boolean {
  return (globalThis as { testMarker?: boolean }).testMarker === true;
}

test.describe("Theme choice", function describeThemeChoice(): void {
  test("Default choice", async function showsSystem({ page }): Promise<void> {
    await page.goto("/");

    await expect(themeControl(page)).toHaveValue("system");
    await expect(themeControl(page).locator("option:checked")).toHaveText(
      "System",
    );
  });

  test("Choose Dark", async function choosesDark({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await openSample(page);
    const frame = await findModFrame(page, "Book List");
    await waitForFrameColorScheme(frame, "light");
    await markFrame(frame);

    await chooseTheme(page, "Dark");

    await waitForFrameColorScheme(frame, "dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
    expect(await frame.evaluate(readBodyColors)).toEqual({
      background: DARK_COLORS.background.computed,
      color: DARK_COLORS.foreground.computed,
    });
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Resolve the color scheme", function describeResolve(): void {
  test("follows the operating system while System is chosen", async function followsSystem({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await openSample(page);
    const frame = await findModFrame(page, "Book List");

    await page.emulateMedia({ colorScheme: "dark" });

    await waitForFrameColorScheme(frame, "dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
  });

  test("an explicit choice ignores the operating system", async function keepsChoice({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await chooseTheme(page, "Light");

    expect(await page.evaluate(readColorSchemeAttribute)).toBe("light");
  });
});

test.describe("The theme choice is remembered", function describeRemembered(): void {
  test("Choice kept after a reload", async function keepsChoice({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await chooseTheme(page, "Dark");

    await page.reload();

    await expect(themeControl(page)).toHaveValue("dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
  });

  test("Mods cannot reach the choice", async function hidesChoice({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildThemeProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    await chooseTheme(page, "Dark");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    const keys = [
      "opentesela.theme-choice",
      "theme-choice",
      "theme",
      "opentesela.theme",
      "themeChoice",
    ];

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

test.describe("The app follows the color scheme", function describeApp(): void {
  test("Dark app", async function drawsDarkApp({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await chooseTheme(page, "Dark");

    expect((await page.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
    expect(await stageBar(page).evaluate(readStageBarColor)).toBe(
      DARK_COLORS.foreground.computed,
    );
  });

  test("Action dialog follows the color scheme", async function drawsDarkDialog({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);

    await frame.evaluate(startProbeRequests, [
      ["ui.confirm", { message: "Delete this list?" }],
    ]);
    await expect(actionDialog(page)).toBeVisible();

    expect(await actionDialog(page).evaluate(readDialogColors)).toEqual({
      background: DARK_COLORS.popover.computed,
      color: DARK_COLORS.popoverForeground.computed,
    });
  });

  test("Back to light", async function returnsToLight({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await chooseTheme(page, "Dark");
    await page.evaluate(setPageMarker);

    await chooseTheme(page, "Light");

    expect((await page.evaluate(readBodyColors)).background).toBe(
      LIGHT_COLORS.background.computed,
    );
    expect(await page.evaluate(readPageMarker)).toBe(true);
  });
});

test.describe("The visible frame fills the stage area", function describeFrameSize(): void {
  test("Frame reaches the bottom of the viewport", async function fillsViewport({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });

    await openSample(page);

    const frameBox = await readVisibleFrameBox(page);
    expect(800 - frameBox.bottom).toBeGreaterThanOrEqual(0);
    expect(800 - frameBox.bottom).toBeLessThanOrEqual(BOTTOM_TOLERANCE);
    expect(await page.evaluate(readPageOverflow)).toBe(0);
  });

  test("Window resized", async function followsResize({ page }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSample(page);

    await page.setViewportSize({ width: 1024, height: 600 });

    await expect
      .poll(async function readBottomGap(): Promise<number> {
        const frameBox = await readVisibleFrameBox(page);
        return 600 - frameBox.bottom;
      })
      .toBeLessThanOrEqual(BOTTOM_TOLERANCE);
    const frameBox = await readVisibleFrameBox(page);
    expect(600 - frameBox.bottom).toBeGreaterThanOrEqual(0);
  });

  test("Tall content scrolls inside the frame", async function scrollsInside({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSample(page);
    const sampleBox = await readVisibleFrameBox(page);
    await serveAppOriginMod(
      page,
      buildThemeProbeFiles("tall", [], TALL_PROBE_MOD_CODE),
    );

    await page.goto("/#/run?mod=./test-mods/tall/");
    const frame = await findModFrame(page, "tall");
    await waitForProbe(frame);

    const tallBox = await readVisibleFrameBox(page);
    expect(tallBox.height).toBeCloseTo(sampleBox.height, 0);
    expect(await frame.evaluate(canFrameScroll)).toBe(true);
    expect(await page.evaluate(readPageOverflow)).toBe(0);
  });

  test("Small viewport", async function keepsMinimumHeight({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 300 });

    await openSample(page);

    const frameBox = await readVisibleFrameBox(page);
    expect(frameBox.height).toBe(256);
    expect(await page.evaluate(readPageOverflow)).toBeGreaterThan(0);
  });
});
