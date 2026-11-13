import { expect, test } from "@playwright/test";
import type { Frame, Page, Request } from "@playwright/test";
import { isFrameMarked, markFrame } from "./mod_routes.ts";
import { openBodyProbe, showTileBodies } from "./tile_body_routes.ts";
import type { BodyTile } from "./tile_body_routes.ts";

/** The chunks of the build that hold the extras' libraries: Temml, the highlighter and the emoji names. */
const EXTRA_CHUNK_PATTERN =
  /\/assets\/(math_pass|highlight_pass|emoji_pass)-[^/]+\.js$/;

const MATH_TILE: BodyTile = {
  name: "math",
  body: [
    "Inline $\\frac{a}{b}$ in a sentence.",
    "$$\n\\sum_{i=0}^{n} i = \\frac{n(n+1)}{2}\n$$",
  ].join("\n\n"),
};

const CODE_TILE: BodyTile = {
  name: "code",
  body: ["```js\nconst answer = 42;\n```", "```\nconst plain = 1;\n```"].join(
    "\n\n",
  ),
};

const EXTRA_TILES = [MATH_TILE, CODE_TILE];

const MATH_INDEX = 0;
const CODE_INDEX = 1;

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

/** Runs in the probe's frame: the names of the computed font families of the first `<math>`, without quotes. */
function readMathFontFamilies(): string[] {
  const math = document.querySelector("ot-tile-body math") as Element;
  const families: string[] = [];
  for (const family of getComputedStyle(math).fontFamily.split(",")) {
    families.push(family.trim().replace(/^["']|["']$/g, ""));
  }
  return families;
}

test.describe(
  "Formulas use a math font the system has",
  { tag: "@frames" },
  function describeMathFont(): void {
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
  },
);

test.describe(
  "Highlighted code follows the theme",
  { tag: "@frames" },
  function describeCodeTheme(): void {
    test("Keyword color", async function colorsKeyword({
      page,
    }): Promise<void> {
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
  },
);

test.describe(
  "Extras load only when a body needs them",
  { tag: "@frames" },
  function describeExtraLoading(): void {
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
  },
);
