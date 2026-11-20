import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
  currentItem,
  hamburgerButton,
  openSection,
  sidebar,
  sidebarThemeButton,
} from "./app_layout.ts";
import {
  actionDialog,
  buildProbeFiles,
  findModFrame,
  isFrameMarked,
  markFrame,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import { openProbe } from "./test_mods.ts";
import {
  buildThemeProbeFiles,
  canFrameScroll,
  chooseTheme,
  DARK_COLORS,
  LIGHT_COLORS,
  readBodyColors,
  readBoxShadow,
  readColorSchemeAttribute,
  readPageOverflow,
  readVisibleFrameBox,
  TALL_PROBE_MOD_CODE,
  themeControl,
  waitForFrameColorScheme,
} from "./theme_probes.ts";

const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

/** The frame may sit this far from the viewport's edge: the shell's gap and the frame's border. */
const EDGE_TOLERANCE = 24;

function readStageBarColor(element: Element): string {
  return getComputedStyle(element).color;
}

function readBackgroundColor(element: Element): string {
  return getComputedStyle(element).backgroundColor;
}

function readDialogColors(element: Element): {
  background: string;
  color: string;
} {
  const style = getComputedStyle(element);
  const colors = { background: style.backgroundColor, color: style.color };
  return colors;
}

/** The edges of an element's box, in pixels. */
interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

async function readEdges(locator: Locator): Promise<Edges> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Expected the element to have a box");
  }
  const edges: Edges = {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
  };
  return edges;
}

function visibleFrame(page: Page): Locator {
  return page.locator("[data-sandbox-id]:not([hidden]) iframe");
}

function setPageMarker(): void {
  (globalThis as { testMarker?: boolean }).testMarker = true;
}

function readPageMarker(): boolean {
  return (globalThis as { testMarker?: boolean }).testMarker === true;
}

test.describe("Theme choice", function describeThemeChoice(): void {
  test("Choose Dark", async function choosesDark({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openProbe(page);
    await waitForFrameColorScheme(frame, "light");
    await markFrame(frame);

    await chooseTheme(page, "Dark");

    await expect(page.locator('iframe[title="probe"]')).toBeVisible();
    await waitForFrameColorScheme(frame, "dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
    expect(await frame.evaluate(readBodyColors)).toEqual({
      background: DARK_COLORS.background.computed,
      color: DARK_COLORS.foreground.computed,
    });
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Theme choice in the sidebar", function describeSidebarChoice(): void {
  test("Choose from the sidebar", async function choosesFromSidebar({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openProbe(page);
    await waitForFrameColorScheme(frame, "light");
    await markFrame(frame);

    // System, then Light, then Dark.
    await sidebarThemeButton(page).click();
    await expect(page.getByRole("tooltip")).toHaveText("Theme: Light");
    await sidebarThemeButton(page).click();
    await expect(page.getByRole("tooltip")).toHaveText("Theme: Dark");

    await waitForFrameColorScheme(frame, "dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
    expect(await isFrameMarked(frame)).toBe(true);
    await expect(sidebarThemeButton(page)).toHaveAccessibleName("Theme: Dark");
    await openSection(page, "Settings");
    await expect(themeControl(page)).toHaveValue("dark");
  });

  test("No Theme control in the header", async function hasNoHeaderControl({
    page,
  }): Promise<void> {
    await page.goto("/");

    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(sidebarThemeButton(page)).toHaveCount(1);
    await expect(themeControl(page)).toHaveCount(0);
    await openSection(page, "Settings");
    await expect(themeControl(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Theme: / })).toHaveCount(1);
  });
});

test.describe("App canvas and panels", function describeCanvas(): void {
  test("White canvas in light", async function drawsWhiteCanvas({
    page,
  }): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: "light" });

    await openProbe(page);

    expect((await page.evaluate(readBodyColors)).background).toBe(
      LIGHT_COLORS.card.computed,
    );
    const panels = [sidebar(page), stageBar(page), visibleFrame(page)];
    for (const panel of panels) {
      expect(await panel.evaluate(readBoxShadow)).not.toBe("none");
    }
    const sidebarEdges = await readEdges(sidebar(page));
    const barEdges = await readEdges(stageBar(page));
    const frameEdges = await readEdges(visibleFrame(page));
    expect(sidebarEdges.left).toBeGreaterThan(0);
    expect(sidebarEdges.top).toBeGreaterThan(0);
    expect(barEdges.left).toBeGreaterThan(sidebarEdges.right);
    expect(frameEdges.left).toBeGreaterThan(sidebarEdges.right);
    expect(frameEdges.top).toBeGreaterThan(barEdges.bottom);
  });

  test("Canvas in dark", async function drawsDarkCanvas({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });

    await page.goto("/");

    await expect(sidebar(page)).toBeVisible();
    expect((await page.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
  });
});

test.describe("Resolve the color scheme", function describeResolve(): void {
  test("follows the operating system while System is chosen", async function followsSystem({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openProbe(page);

    await page.emulateMedia({ colorScheme: "dark" });

    await waitForFrameColorScheme(frame, "dark");
    expect(await page.evaluate(readColorSchemeAttribute)).toBe("dark");
  });

  test("an explicit choice ignores the operating system", async function keepsChoice({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(EXPLORER_RUN_LINK);

    await chooseTheme(page, "Light");

    expect(await page.evaluate(readColorSchemeAttribute)).toBe("light");
  });
});

test.describe("The theme choice is remembered", function describeRemembered(): void {
  test("Choice kept after a reload", async function keepsChoice({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(EXPLORER_RUN_LINK);
    await chooseTheme(page, "Dark");

    await page.reload();
    await openSection(page, "Settings");

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
    await page.goto(EXPLORER_RUN_LINK);

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

  test("Dark sidebar", async function drawsDarkSidebar({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });

    await page.goto("/");

    expect(await sidebar(page).evaluate(readBackgroundColor)).toBe(
      DARK_COLORS.card.computed,
    );
    expect(await currentItem(page).evaluate(readStageBarColor)).toBe(
      DARK_COLORS.accentForeground.computed,
    );
  });

  test("Back to light", async function returnsToLight({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(EXPLORER_RUN_LINK);
    await chooseTheme(page, "Dark");
    await page.evaluate(setPageMarker);

    await chooseTheme(page, "Light");

    expect((await page.evaluate(readBodyColors)).background).toBe(
      LIGHT_COLORS.card.computed,
    );
    expect(await page.evaluate(readPageMarker)).toBe(true);
  });
});

test.describe(
  "The visible frame fills the stage area",
  { tag: "@frames" },
  function describeFrameSize(): void {
    test("Frame reaches the bottom of the viewport", async function fillsViewport({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1280, height: 800 });

      await openProbe(page);

      const frameBox = await readVisibleFrameBox(page);
      expect(800 - frameBox.bottom).toBeGreaterThanOrEqual(0);
      expect(800 - frameBox.bottom).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(await page.evaluate(readPageOverflow)).toBe(0);
    });

    test("Window resized", async function followsResize({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openProbe(page);

      await page.setViewportSize({ width: 1024, height: 600 });

      await expect
        .poll(async function readBottomGap(): Promise<number> {
          const frameBox = await readVisibleFrameBox(page);
          return 600 - frameBox.bottom;
        })
        .toBeLessThanOrEqual(EDGE_TOLERANCE);
      const frameBox = await readVisibleFrameBox(page);
      expect(600 - frameBox.bottom).toBeGreaterThanOrEqual(0);
    });

    test("Tall content scrolls inside the frame", async function scrollsInside({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openProbe(page);
      const shortBox = await readVisibleFrameBox(page);
      await serveAppOriginMod(
        page,
        buildThemeProbeFiles("tall", [], TALL_PROBE_MOD_CODE),
      );

      await page.goto("/#/run?mod=./test-mods/tall/");
      const frame = await findModFrame(page, "tall");
      await waitForProbe(frame);

      const tallBox = await readVisibleFrameBox(page);
      expect(tallBox.height).toBeCloseTo(shortBox.height, 0);
      expect(await frame.evaluate(canFrameScroll)).toBe(true);
      expect(await page.evaluate(readPageOverflow)).toBe(0);
    });

    test("Hidden sidebar widens the frame", async function widensFrame({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1280, height: 800 });
      const frame = await openProbe(page);
      await markFrame(frame);
      await sidebar(page)
        .getByRole("button", { name: "Collapse sidebar" })
        .click();
      await expect(sidebar(page)).toHaveAttribute("data-state", "collapsed");
      const before = await readEdges(visibleFrame(page));

      await hamburgerButton(page).click();

      await expect(sidebar(page)).toHaveAttribute("data-state", "hidden");
      const after = await readEdges(visibleFrame(page));
      expect(after.right - after.left).toBeGreaterThan(
        before.right - before.left,
      );
      expect(after.left).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(await isFrameMarked(frame)).toBe(true);
    });

    test("Small viewport", async function keepsMinimumHeight({
      page,
    }): Promise<void> {
      await page.setViewportSize({ width: 1280, height: 300 });

      await openProbe(page);

      const frameBox = await readVisibleFrameBox(page);
      expect(frameBox.height).toBe(256);
      expect(await page.evaluate(readPageOverflow)).toBeGreaterThan(0);
    });
  },
);
