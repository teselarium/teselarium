import { expect, test } from "@playwright/test";
import type { Frame, Page, Request } from "@playwright/test";
import { isFrameMarked, markFrame } from "./mod_routes.ts";
import { openBodyProbe, showTileBodies } from "./tile_body_routes.ts";
import type { BodyTile } from "./tile_body_routes.ts";

/** The chunks of the build that hold the extras' libraries: Temml, the highlighter and the emoji names. */
const EXTRA_CHUNK_PATTERN =
  /\/assets\/(math_pass|highlight_pass|emoji_pass)-[^/]+\.js$/;

const MATH_CHUNK_PATTERN = /\/assets\/math_pass-[^/]+\.js$/;

const MATH_TILE: BodyTile = {
  name: "math",
  body: [
    "Inline $\\frac{a}{b}$ in a sentence.",
    "$$\n\\sum_{i=0}^{n} i = \\frac{n(n+1)}{2}\n$$",
  ].join("\n\n"),
};

const FAILING_TILE: BodyTile = {
  name: "failing",
  body: "Before $\\frac{a}{$ after.",
};

const CODE_TILE: BodyTile = {
  name: "code",
  body: ["```js\nconst answer = 42;\n```", "```\nconst plain = 1;\n```"].join(
    "\n\n",
  ),
};

const EMOJI_TILE: BodyTile = {
  name: "emoji",
  body: "Done :tada:, :not_an_emoji: and `:tada:`.",
};

const EXTRA_TILES = [MATH_TILE, FAILING_TILE, CODE_TILE, EMOJI_TILE];

const MATH_INDEX = 0;
const FAILING_INDEX = 1;
const CODE_INDEX = 2;
const EMOJI_INDEX = 3;

/** Bodies without formulas, labeled code or shortcodes; one holds prices. */
const PLAIN_TILES: BodyTile[] = [
  { name: "prices", body: "It costs $5 and $10." },
  { name: "notes", body: "# Notes\n\nA *calm* body with `code`." },
];

function recordRequestUrl(requestedUrls: string[], request: Request): void {
  requestedUrls.push(request.url());
}

/** Records the address of every request the page sends from now on. */
function collectRequestedUrls(page: Page): string[] {
  const requestedUrls: string[] = [];
  page.on("request", recordRequestUrl.bind(undefined, requestedUrls));
  return requestedUrls;
}

function listMatchingUrls(urls: string[], pattern: RegExp): string[] {
  const matchingUrls: string[] = [];
  for (const url of urls) {
    if (pattern.test(new URL(url).pathname)) {
      matchingUrls.push(url);
    }
  }
  return matchingUrls;
}

/** Opens the probe with the tiles of the extras and shows the body at `index`. */
async function showExtrasBody(page: Page, index: number): Promise<Frame> {
  const { frame } = await openBodyProbe(page, EXTRA_TILES);
  await frame.evaluate(showTileBodies, [index]);
  return frame;
}

/** Runs in the probe's frame: the computed color of the first element matching `selector`. */
function readComputedColor(selector: string): string {
  const element = document.querySelector(selector) as Element;
  return getComputedStyle(element).color;
}

/** Runs in the probe's frame: the color `--ot-primary` computes to, as the browser writes colors. */
function readPrimaryColor(): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--ot-primary)";
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** Runs in the probe's frame: the text of the first `<annotation>` of the first `<math>` matching `selector`. */
function readAnnotation(selector: string): string {
  const math = document.querySelector(selector) as Element;
  return math.querySelector("annotation")?.textContent ?? "";
}

/** Runs in the probe's frame: the names of the computed font families of the first `<math>`, without quotes. */
function readMathFontFamilies(): string[] {
  const math = document.querySelector("ot-tile-body math") as Element;
  const families: string[] = [];
  for (const family of getComputedStyle(math).fontFamily.split(",")) {
    families.push(family.trim().replace(/^["']|["']$/g, ""));
  }
  return families;
}

test.describe("Math is rendered as MathML", function describeMath(): void {
  test("Fraction", async function showsFraction({ page }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);

    const frame = await showExtrasBody(page, MATH_INDEX);

    const fraction = frame.locator("ot-tile-body p math mfrac");
    await expect(fraction).toBeVisible();
    await expect(fraction).toHaveText("ab");
    expect(await frame.evaluate(readAnnotation, "ot-tile-body p math")).toBe(
      "\\frac{a}{b}",
    );
    await expect(
      frame.locator('ot-tile-body math[display="block"]'),
    ).toBeVisible();
    expect(listMatchingUrls(requestedUrls, MATH_CHUNK_PATTERN)).toHaveLength(1);
  });
});

test.describe("Formulas use a math font the system has", function describeMathFont(): void {
  test("Math font", async function namesMathFonts({ page }): Promise<void> {
    const frame = await showExtrasBody(page, MATH_INDEX);
    await expect(frame.locator("ot-tile-body math").first()).toBeVisible();

    expect(await frame.evaluate(readMathFontFamilies)).toEqual([
      "STIX Two Math",
      "STIX Math",
      "Cambria Math",
      "Latin Modern Math",
      "math",
    ]);
  });
});

test.describe("Formulas that fail stay as written", function describeFailingMath(): void {
  test("Unclosed brace", async function keepsUnclosedBrace({
    page,
  }): Promise<void> {
    const frame = await showExtrasBody(page, FAILING_INDEX);

    const paragraph = frame.locator("ot-tile-body p");
    await expect(paragraph).toHaveText("Before \\frac{a}{ after.");
    const code = paragraph.locator("code.language-math");
    await expect(code).toHaveText("\\frac{a}{");
    await expect(code).toHaveAttribute("data-ot-math-error", /\S/);
    await expect(frame.locator("ot-tile-body math")).toHaveCount(0);
  });
});

test.describe("Code blocks and emoji", function describeCodeAndEmoji(): void {
  test("Labeled JavaScript", async function highlightsJavaScript({
    page,
  }): Promise<void> {
    const frame = await showExtrasBody(page, CODE_INDEX);

    const code = frame.locator("ot-tile-body code.language-js");
    await expect(code.locator("span.hljs-keyword")).toHaveText("const");
    await expect(code.locator("span.hljs-number")).toHaveText("42");
    await expect(code).toHaveText("const answer = 42;");
    const plainCode = frame.locator("ot-tile-body pre").nth(1).locator("code");
    await expect(plainCode).toHaveText("const plain = 1;");
    await expect(plainCode.locator("span")).toHaveCount(0);
  });

  test("Shortcodes", async function replacesShortcodes({
    page,
  }): Promise<void> {
    const frame = await showExtrasBody(page, EMOJI_INDEX);

    const paragraph = frame.locator("ot-tile-body p");
    await expect(paragraph).toHaveText("Done 🎉, :not_an_emoji: and :tada:.");
    await expect(paragraph.locator("code")).toHaveText(":tada:");
  });
});

test.describe("Highlighted code follows the theme", function describeCodeTheme(): void {
  test("Keyword color", async function colorsKeyword({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "dark" });
    const frame = await showExtrasBody(page, CODE_INDEX);
    const keywordSelector = "ot-tile-body span.hljs-keyword";
    await expect(frame.locator(keywordSelector)).toBeVisible();
    const darkPrimary = await frame.evaluate(readPrimaryColor);
    await markFrame(frame);

    expect(await frame.evaluate(readComputedColor, keywordSelector)).toBe(
      darkPrimary,
    );

    await page.emulateMedia({ colorScheme: "light" });
    await expect
      .poll(function readLightPrimary(): Promise<string> {
        return frame.evaluate(readPrimaryColor);
      })
      .not.toBe(darkPrimary);
    const lightPrimary = await frame.evaluate(readPrimaryColor);
    expect(await frame.evaluate(readComputedColor, keywordSelector)).toBe(
      lightPrimary,
    );
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Extras load only when a body needs them", function describeExtraLoading(): void {
  test("Plain body", async function loadsNoExtras({ page }): Promise<void> {
    const requestedUrls = collectRequestedUrls(page);
    const { frame } = await openBodyProbe(page, PLAIN_TILES);

    await frame.evaluate(showTileBodies, [0, 1]);

    await expect(frame.locator("ot-tile-body").first()).toHaveText(
      "It costs $5 and $10.",
    );
    await expect(frame.locator("ot-tile-body em")).toHaveText("calm");
    expect(listMatchingUrls(requestedUrls, EXTRA_CHUNK_PATTERN)).toEqual([]);
  });
});
