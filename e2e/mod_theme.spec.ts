import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import {
  findModFrame,
  findSandboxFrame,
  isFrameMarked,
  markFrame,
  routeCovers,
  serveAppOriginMod,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import {
  addModHtml,
  addModStyle,
  buildThemeProbeFiles,
  chooseTheme,
  DARK_COLORS,
  hasThemeEvents,
  LIGHT_COLORS,
  readAttributeAtMount,
  readBodyColors,
  readBodyMargin,
  readColorSchemeAttribute,
  readElementColors,
  readOutlineColor,
  readPaintLog,
  readRootTokenValue,
  readThemeEvents,
  recordDefaultModThemes,
  recordPaints,
  waitForFrameColorScheme,
} from "./theme_probes.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const SAMPLE_RUN_LINK =
  "/#/run?mod=./samples/mods/book_list&collection=./samples/tiles/books_collection.yaml";

/** Opens the theme probe while the operating system prefers `colorScheme`, with the choice System. */
async function openThemeProbe(
  page: Page,
  colorScheme: "light" | "dark",
  extraLines: string[] = [],
): Promise<Frame> {
  await page.emulateMedia({ colorScheme });
  await serveAppOriginMod(page, buildThemeProbeFiles("probe", extraLines));
  await page.goto(PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

test.describe("Color scheme attribute", function describeAttribute(): void {
  test("Attribute at mount", async function setsAttributeBeforeMount({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    expect(await frame.evaluate(readAttributeAtMount)).toBe("dark");
  });

  test("Attribute before the handlers", async function setsAttributeBeforeHandlers({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    await chooseTheme(page, "Light");
    await frame.waitForFunction(hasThemeEvents, 1);

    expect(await frame.evaluate(readThemeEvents)).toEqual([
      { colorScheme: "light", attribute: "light" },
    ]);
  });
});

test.describe("Base stylesheet by default", function describeBaseStylesheet(): void {
  test("Page follows the color scheme", async function followsColorScheme({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    expect(await frame.evaluate(readBodyColors)).toEqual({
      background: DARK_COLORS.background.computed,
      color: DARK_COLORS.text.computed,
    });
  });

  test("Colors switch without a reload", async function switchesColors({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");
    await markFrame(frame);

    await chooseTheme(page, "Light");
    await waitForFrameColorScheme(frame, "light");

    expect((await frame.evaluate(readBodyColors)).background).toBe(
      LIGHT_COLORS.background.computed,
    );
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Pressed button", async function outlinesPressedButton({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");

    await frame.evaluate(
      addModHtml,
      '<button type="button" aria-pressed="true">Pressed</button>',
    );

    expect(
      await frame.evaluate(readOutlineColor, 'button[aria-pressed="true"]'),
    ).toBe(LIGHT_COLORS.accent.computed);
  });

  test("Tokens are readable as CSS variables", async function readsVariables({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");
    await frame.evaluate(
      addModHtml,
      '<p id="accent" style="color: var(--ot-color-accent)">Accent</p>',
    );
    const lightColor = (await frame.evaluate(readElementColors, "#accent"))
      .color;

    await chooseTheme(page, "Dark");
    await waitForFrameColorScheme(frame, "dark");

    expect(lightColor).toBe(LIGHT_COLORS.accent.computed);
    expect((await frame.evaluate(readElementColors, "#accent")).color).toBe(
      DARK_COLORS.accent.computed,
    );
  });

  test("Token values readable from JavaScript", async function readsTokenValues({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    expect(await frame.evaluate(readRootTokenValue, "--ot-color-accent")).toBe(
      DARK_COLORS.accent.value,
    );
  });
});

test.describe("Color scheme sections", function describeSections(): void {
  test("Dark section in a light frame", async function drawsDarkSection({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");

    await frame.evaluate(
      addModHtml,
      '<section data-ot-color-scheme="dark"><p style="color: var(--ot-color-text)">Dark</p></section>',
    );

    expect(
      (await frame.evaluate(readElementColors, "section")).background,
    ).toBe(DARK_COLORS.background.computed);
    expect((await frame.evaluate(readElementColors, "section p")).color).toBe(
      DARK_COLORS.text.computed,
    );
  });

  test("Section keeps its color scheme", async function keepsSection({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");
    await frame.evaluate(
      addModHtml,
      '<section data-ot-color-scheme="light"><p>Light</p></section>',
    );

    await chooseTheme(page, "Dark");
    await waitForFrameColorScheme(frame, "dark");

    expect(
      (await frame.evaluate(readElementColors, "section")).background,
    ).toBe(LIGHT_COLORS.background.computed);
    expect((await frame.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
  });
});

test.describe("Mod styles override the base stylesheet", function describeOverrides(): void {
  test("Mod rule wins", async function appliesModRule({ page }): Promise<void> {
    const frame = await openThemeProbe(page, "light");

    await frame.evaluate(addModStyle, "button { color: rgb(0, 0, 255); }");
    await frame.evaluate(addModHtml, '<button type="button">Blue</button>');

    expect((await frame.evaluate(readElementColors, "button")).color).toBe(
      "rgb(0, 0, 255)",
    );
  });

  test("Mod overrides a token", async function overridesToken({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");

    await frame.evaluate(
      addModStyle,
      ":root { --ot-color-accent: rgb(255, 0, 0); }",
    );
    await frame.evaluate(
      addModHtml,
      '<button type="button" aria-pressed="true">Red</button>',
    );

    expect(
      await frame.evaluate(readOutlineColor, 'button[aria-pressed="true"]'),
    ).toBe("rgb(255, 0, 0)");
  });
});

test.describe("Opt out of the theme styles", function describeOptOut(): void {
  test("Blank frame", async function keepsBrowserDefaults({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark", ['  theme: "none"']);

    expect(await frame.evaluate(readRootTokenValue, "--ot-color-accent")).toBe(
      "",
    );
    expect(await frame.evaluate(readBodyMargin)).toBe("8px");
  });

  test("Opted-out mod still gets the theme", async function sendsTheme({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light", ['  theme: "none"']);

    await chooseTheme(page, "Dark");
    await frame.waitForFunction(hasThemeEvents, 1);

    expect(await frame.evaluate(readThemeEvents)).toEqual([
      { colorScheme: "dark", attribute: "dark" },
    ]);
    expect(await frame.evaluate(readColorSchemeAttribute)).toBe("dark");
  });
});

test.describe("Theme changed event", function describeThemeChanged(): void {
  test("Visible and hidden mods are told", async function tellsEveryMod({
    page,
  }): Promise<void> {
    await recordDefaultModThemes(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const explorer = await findModFrame(page, "Mods");
    await explorer.getByRole("button", { name: /Book List/ }).click();
    const viewer = await findModFrame(page, "Mod Viewer");
    await expect(viewer.getByText("Shows the book covers")).toBeVisible();
    await expect(visibleSandbox(page)).toHaveAttribute(
      "data-sandbox-id",
      "sandbox-2",
    );
    const hiddenExplorer = await findSandboxFrame(page, "sandbox-1");

    await chooseTheme(page, "Dark");
    await hiddenExplorer.waitForFunction(hasThemeEvents, 1);
    await viewer.waitForFunction(hasThemeEvents, 1);

    const told = [{ colorScheme: "dark", attribute: "dark" }];
    expect(await hiddenExplorer.evaluate(readThemeEvents)).toEqual(told);
    expect(await viewer.evaluate(readThemeEvents)).toEqual(told);
  });

  test("Same color scheme, no event", async function sendsNothing({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    await chooseTheme(page, "Dark");
    await chooseTheme(page, "Light");
    await frame.waitForFunction(hasThemeEvents, 1);

    expect(await frame.evaluate(readThemeEvents)).toEqual([
      { colorScheme: "light", attribute: "light" },
    ]);
  });
});

test.describe("Frame before it connects", function describeFirstPaint(): void {
  test("a dark app never shows the frame without its color scheme", async function hidesUnthemedFrame({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(recordPaints);
    await page.goto(SAMPLE_RUN_LINK);
    const frame = await findModFrame(page, "Book List");
    await expect(
      frame.getByRole("button", { name: /Kallocain/ }),
    ).toBeVisible();
    await expect
      .poll(async function countVisiblePaints(): Promise<number> {
        return (await page.evaluate(readPaintLog)).visibleFrameTimes.length;
      })
      .toBeGreaterThan(0);

    const pagePaints = await page.evaluate(readPaintLog);
    const framePaints = await frame.evaluate(readPaintLog);

    const firstVisibleTime = Math.min(...pagePaints.visibleFrameTimes);
    const lastUnthemedTime = Math.max(-Infinity, ...framePaints.unthemedTimes);
    expect(lastUnthemedTime).toBeLessThan(firstVisibleTime);
  });
});

test.describe("Sample and default mods follow the theme", function describeShippedMods(): void {
  test("Dark sample mod", async function drawsDarkSample({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await routeCovers(page);
    await page.goto(SAMPLE_RUN_LINK);
    const frame = await findModFrame(page, "Book List");
    await expect(
      frame.getByRole("button", { name: /Kallocain/ }),
    ).toBeVisible();

    expect((await frame.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
  });

  test("Selection uses the accent", async function outlinesSelection({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    await routeCovers(page);
    await page.goto(SAMPLE_RUN_LINK);
    const frame = await findModFrame(page, "Book List");
    const kallocain = frame.getByRole("button", { name: /Kallocain/ });

    await kallocain.click();

    await expect(kallocain).toHaveAttribute("aria-pressed", "true");
    expect(
      await frame.evaluate(readOutlineColor, 'button[aria-pressed="true"]'),
    ).toBe(LIGHT_COLORS.accent.computed);
  });

  test("Dark default mods", async function drawsDarkDefaultMods({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const explorer = await findModFrame(page, "Mods");
    const explorerColors = await explorer.evaluate(readBodyColors);
    await explorer.getByRole("button", { name: /Book List/ }).click();
    const viewer = await findModFrame(page, "Mod Viewer");
    await expect(viewer.getByText("Shows the book covers")).toBeVisible();

    expect(explorerColors.background).toBe(DARK_COLORS.background.computed);
    expect((await viewer.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
  });
});
