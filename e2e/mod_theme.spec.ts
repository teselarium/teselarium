import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import {
  coverPermissionRow,
  findModFrame,
  findSandboxFrame,
  isFrameMarked,
  markFrame,
  routeCovers,
  serveAppOriginMod,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import { SAMPLE_COLLECTION_RUN_HASH } from "./sample_mod.ts";
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
  readElementLook,
  readOutlineColor,
  readPaintLog,
  readRootTokenValue,
  readThemeEvents,
  readTokenAs,
  recordDefaultModThemes,
  recordPaints,
  waitForFrameColorScheme,
} from "./theme_probes.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const EXPLORER_RUN_LINK = "/#/run?mod=mod_explorer";

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
      color: DARK_COLORS.foreground.computed,
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
    ).toBe(LIGHT_COLORS.primary.computed);
  });

  test("Tokens are readable as CSS variables", async function readsVariables({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");
    await frame.evaluate(
      addModHtml,
      '<p id="primary" style="color: var(--ot-primary)">Primary</p>',
    );
    const lightColor = (await frame.evaluate(readElementColors, "#primary"))
      .color;

    await chooseTheme(page, "Dark");
    await waitForFrameColorScheme(frame, "dark");

    expect(lightColor).toBe(LIGHT_COLORS.primary.computed);
    expect((await frame.evaluate(readElementColors, "#primary")).color).toBe(
      DARK_COLORS.primary.computed,
    );
  });

  test("Token values readable from JavaScript", async function readsTokenValues({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "dark");

    expect(await frame.evaluate(readRootTokenValue, "--ot-primary")).toBe(
      DARK_COLORS.primary.value,
    );
  });

  test("Old token names are not defined", async function dropsOldNames({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, "light");

    expect(await frame.evaluate(readRootTokenValue, "--ot-color-accent")).toBe(
      "",
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
      '<section data-ot-color-scheme="dark"><p style="color: var(--ot-foreground)">Dark</p></section>',
    );

    expect(
      (await frame.evaluate(readElementColors, "section")).background,
    ).toBe(DARK_COLORS.background.computed);
    expect((await frame.evaluate(readElementColors, "section p")).color).toBe(
      DARK_COLORS.foreground.computed,
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
      ":root { --ot-primary: rgb(255, 0, 0); }",
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

    expect(await frame.evaluate(readRootTokenValue, "--ot-primary")).toBe("");
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
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = await findModFrame(page, "Mods");
    await explorer.getByRole("button", { name: /Book List/ }).click();
    const viewer = await findModFrame(page, "Mod Viewer");
    await expect(coverPermissionRow(viewer)).toBeVisible();
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
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
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
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
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
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const frame = await findModFrame(page, "Book List");
    const kallocain = frame.getByRole("button", { name: /Kallocain/ });

    await kallocain.click();

    await expect(kallocain).toHaveAttribute("aria-pressed", "true");
    expect(
      await frame.evaluate(readOutlineColor, 'button[aria-pressed="true"]'),
    ).toBe(LIGHT_COLORS.primary.computed);
  });

  test("Dark default mods", async function drawsDarkDefaultMods({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(EXPLORER_RUN_LINK);
    const explorer = await findModFrame(page, "Mods");
    const explorerColors = await explorer.evaluate(readBodyColors);
    await explorer.getByRole("button", { name: /Book List/ }).click();
    const viewer = await findModFrame(page, "Mod Viewer");
    await expect(coverPermissionRow(viewer)).toBeVisible();

    expect(explorerColors.background).toBe(DARK_COLORS.background.computed);
    expect((await viewer.evaluate(readBodyColors)).background).toBe(
      DARK_COLORS.background.computed,
    );
  });
});

const COLOR_SCHEMES = ["light", "dark"] as const;

/** Opens the theme probe in `colorScheme` and shows `html` in its frame, as a mod that adds no styles would. */
async function showInProbe(
  page: Page,
  colorScheme: "light" | "dark",
  html: string,
): Promise<Frame> {
  const frame = await openThemeProbe(page, colorScheme);
  await frame.evaluate(addModHtml, html);
  return frame;
}

/** The value `property: var(token)` computes to in the frame. */
async function readToken(
  frame: Frame,
  token: string,
  property: string = "color",
): Promise<string> {
  return frame.evaluate(readTokenAs, [token, property]);
}

/** Expects a plain button's look: background, border and text from the page. */
async function expectPlainButton(
  frame: Frame,
  selector: string,
): Promise<void> {
  const look = await frame.evaluate(readElementLook, selector);
  expect(look.background).toBe(await readToken(frame, "--ot-background"));
  expect(look.borderColor).toBe(await readToken(frame, "--ot-border"));
  expect(look.color).toBe(await readToken(frame, "--ot-foreground"));
}

function describeSemanticHtml(colorScheme: "light" | "dark"): void {
  test("Buttons look like the app's buttons", async function drawsButtons({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="button">Cancel</button><button type="submit">Save</button>',
    );

    await expectPlainButton(frame, 'button[type="button"]');
    const submit = await frame.evaluate(
      readElementLook,
      'button[type="submit"]',
    );
    expect(submit.background).toBe(await readToken(frame, "--ot-primary"));
    expect(submit.color).toBe(
      await readToken(frame, "--ot-primary-foreground"),
    );
  });

  test("Article is a card", async function drawsCard({ page }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      "<article><h2>Book List</h2><p>Books.</p></article>",
    );

    const look = await frame.evaluate(readElementLook, "article");
    expect(look.background).toBe(await readToken(frame, "--ot-card"));
    expect(look.borderColor).toBe(await readToken(frame, "--ot-border"));
    expect(look.borderRadius).toBe(
      await readToken(frame, "--ot-radius", "border-top-left-radius"),
    );
  });

  test("Alerts", async function drawsAlerts({ page }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<div role="alert">Failed</div><div role="status">Saved</div>',
    );

    const destructive = await readToken(frame, "--ot-destructive");
    const alert = await frame.evaluate(readElementLook, '[role="alert"]');
    expect(alert.borderColor).toBe(destructive);
    expect(alert.color).toBe(destructive);
    const status = await frame.evaluate(readElementLook, '[role="status"]');
    expect(status.borderColor).toBe(await readToken(frame, "--ot-border"));
    expect(status.color).toBe(await readToken(frame, "--ot-foreground"));
  });

  test("Switch", async function drawsSwitch({ page }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<label><input type="checkbox" role="switch" checked> Covers</label>',
    );

    const look = await frame.evaluate(readElementLook, '[role="switch"]');
    expect(look.appearance).toBe("none");
    expect(look.background).toBe(await readToken(frame, "--ot-primary"));
  });

  test("Invalid field", async function drawsInvalidField({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<input aria-invalid="true" aria-label="Address">',
    );

    expect((await frame.evaluate(readElementLook, "input")).borderColor).toBe(
      await readToken(frame, "--ot-destructive"),
    );
  });

  test("A mod undoes a pattern", async function undoesPattern({
    page,
  }): Promise<void> {
    const frame = await openThemeProbe(page, colorScheme);

    await frame.evaluate(
      addModStyle,
      "article { background: none; border: none; }",
    );
    await frame.evaluate(addModHtml, "<article><p>Plain</p></article>");

    const look = await frame.evaluate(readElementLook, "article");
    expect(look.background).toBe("rgba(0, 0, 0, 0)");
    expect(look.borderWidth).toBe("0px");
  });
}

function describeVariantAttributes(colorScheme: "light" | "dark"): void {
  test("Destructive button", async function drawsDestructive({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="button" data-ot-variant="destructive">Delete</button>',
    );

    expect((await frame.evaluate(readElementLook, "button")).background).toBe(
      await readToken(frame, "--ot-destructive"),
    );
  });

  test("Primary button that does not submit", async function drawsPrimary({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="button" data-ot-variant="primary">Run</button>',
    );

    const look = await frame.evaluate(readElementLook, "button");
    expect(look.background).toBe(await readToken(frame, "--ot-primary"));
    expect(look.color).toBe(await readToken(frame, "--ot-primary-foreground"));
  });

  test("Outline submit button", async function drawsOutlineSubmit({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="submit" data-ot-variant="outline">Run</button>',
    );

    await expectPlainButton(frame, "button");
  });

  test("Success badge", async function drawsBadge({ page }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<span data-ot-variant="success">granted</span>',
    );

    const success = await readToken(frame, "--ot-success");
    const look = await frame.evaluate(readElementLook, "span");
    expect(look.color).toBe(success);
    expect(look.borderColor).toBe(success);
    expect(parseFloat(look.borderRadius)).toBeGreaterThan(0);
  });

  test("Unknown variant", async function keepsPlainLook({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="button" data-ot-variant="sparkly">Odd</button><span data-ot-variant="sparkly">odd</span>',
    );

    await expectPlainButton(frame, "button");
    const span = await frame.evaluate(readElementLook, "span");
    expect(span.borderWidth).toBe("0px");
    expect(span.background).toBe("rgba(0, 0, 0, 0)");
  });

  test("Unprefixed attribute is ignored", async function ignoresUnprefixed({
    page,
  }): Promise<void> {
    const frame = await showInProbe(
      page,
      colorScheme,
      '<button type="button" data-variant="destructive">Delete</button>',
    );

    await expectPlainButton(frame, "button");
  });
}

for (const colorScheme of COLOR_SCHEMES) {
  test.describe(
    `Semantic HTML looks like the app (${colorScheme})`,
    describeSemanticHtml.bind(undefined, colorScheme),
  );
  test.describe(
    `Variant attributes (${colorScheme})`,
    describeVariantAttributes.bind(undefined, colorScheme),
  );
}
