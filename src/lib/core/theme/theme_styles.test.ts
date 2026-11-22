import { describe, expect, it } from "vitest";
import BASE_STYLESHEET from "./base_stylesheet.css?raw";
import {
  buildThemeTokenStyles,
  THEME_FRAME_STYLES,
  THEME_TOKENS,
} from "./index.ts";

/** Colors written as values instead of tokens: hex, color functions and the usual names. */
const COLOR_LITERAL_PATTERN =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(|\b(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|transparent|currentcolor|canvas|canvastext|buttonface|buttontext)\b/i;

/** The `data-ot-variant` values of the mod-theme spec, "Variant attributes". */
const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
];
const BADGE_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "destructive",
  "success",
  "warning",
];

/** The variants of a `<textarea>`. */
const TEXTAREA_VARIANTS = ["code"];

const LIGHT_SELECTOR = ':root,\n  [data-ot-color-scheme="light"] {';
const DARK_SELECTOR = '[data-ot-color-scheme="dark"] {';

/** The text of the rule block that starts at `selector`, up to its closing brace. */
function readBlock(styles: string, selector: string): string {
  const start = styles.indexOf(selector);
  const end = styles.indexOf("}", start);
  return styles.slice(start, end);
}

function countOccurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe("buildThemeTokenStyles", function describeTokenStyles(): void {
  it("puts both blocks in the opentesela layer", function wrapsInLayer(): void {
    const styles = buildThemeTokenStyles();

    expect(styles.startsWith("@layer opentesela {")).toBe(true);
    expect(styles.trimEnd().endsWith("}")).toBe(true);
  });

  it("puts the dark block after the light one", function ordersBlocks(): void {
    const styles = buildThemeTokenStyles();

    const lightIndex = styles.indexOf(LIGHT_SELECTOR);
    const darkIndex = styles.indexOf(DARK_SELECTOR);
    expect(lightIndex).toBeGreaterThan(-1);
    expect(darkIndex).toBeGreaterThan(lightIndex);
  });

  it("sets each token once per block, with its value", function listsTokens(): void {
    const styles = buildThemeTokenStyles();
    const lightBlock = readBlock(styles, LIGHT_SELECTOR);
    const darkBlock = readBlock(styles, DARK_SELECTOR);

    for (const token of THEME_TOKENS) {
      expect(countOccurrences(lightBlock, `${token.name}:`)).toBe(1);
      expect(countOccurrences(darkBlock, `${token.name}:`)).toBe(1);
      expect(lightBlock).toContain(`${token.name}: ${token.light};`);
      expect(darkBlock).toContain(`${token.name}: ${token.dark};`);
    }
  });

  it("sets the color-scheme property in each block", function setsColorScheme(): void {
    const styles = buildThemeTokenStyles();

    expect(readBlock(styles, LIGHT_SELECTOR)).toContain("color-scheme: light;");
    expect(readBlock(styles, DARK_SELECTOR)).toContain("color-scheme: dark;");
  });

  it("has no closing style tag", function checksStyleTag(): void {
    expect(buildThemeTokenStyles().toLowerCase()).not.toContain("</style");
  });
});

function removeComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The selectors and at-rule preludes: the text before each `{`. */
function listPreludes(css: string): string[] {
  const preludes: string[] = [];
  for (const match of removeComments(css).matchAll(/([^{};]+)\{/g)) {
    preludes.push(match[1].trim());
  }
  return preludes;
}

/** The declaration values: the text after each `:` up to its `;`, inside a block. */
function listValues(css: string): string[] {
  const values: string[] = [];
  for (const match of removeComments(css).matchAll(
    /[\w-]+\s*:\s*([^;{}]+);/g,
  )) {
    values.push(match[1].trim());
  }
  return values;
}

/** True when the whole text is one block: the layer's brace closes at the very end. */
function isOneBlock(css: string): boolean {
  const text = removeComments(css).trim();
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") {
      depth += 1;
    }
    if (text[index] === "}") {
      depth -= 1;
    }
    if (depth === 0 && text[index] === "}" && index !== text.length - 1) {
      return false;
    }
  }
  return depth === 0;
}

describe("base stylesheet", function describeBaseStylesheet(): void {
  it("is entirely inside the opentesela layer", function wrapsInLayer(): void {
    const text = removeComments(BASE_STYLESHEET).trim();

    expect(text.startsWith("@layer opentesela {")).toBe(true);
    expect(isOneBlock(BASE_STYLESHEET)).toBe(true);
  });

  it("has no class or id selectors", function checksSelectors(): void {
    const preludes = listPreludes(BASE_STYLESHEET);

    expect(preludes.length).toBeGreaterThan(20);
    for (const prelude of preludes) {
      expect(prelude).not.toMatch(/[.#]/);
    }
  });

  it("has no color literals", function checksColors(): void {
    const values = listValues(BASE_STYLESHEET);

    expect(values.length).toBeGreaterThan(20);
    for (const value of values) {
      expect(value).not.toMatch(COLOR_LITERAL_PATTERN);
    }
  });

  it("uses only theme tokens as variables", function checksVariables(): void {
    for (const match of BASE_STYLESHEET.matchAll(/var\((--[\w-]+)\)/g)) {
      expect(match[1]).toMatch(/^--ot-/);
    }
  });

  it("has no !important", function checksImportant(): void {
    expect(BASE_STYLESHEET).not.toContain("!important");
  });

  it("has no closing style tag", function checksStyleTag(): void {
    expect(BASE_STYLESHEET.toLowerCase()).not.toContain("</style");
  });

  it("styles the elements the spec lists", function coversElements(): void {
    const selectors = listPreludes(BASE_STYLESHEET).join(",");

    const elements = [
      "html",
      "body",
      "h1",
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "ul",
      "table",
      "img",
      "code",
      "dialog",
      ":focus-visible",
      'button[aria-pressed="true"]',
      "[data-ot-color-scheme]",
      'button[type="submit"]',
      "@media (prefers-reduced-motion: reduce)",
    ];
    for (const element of elements) {
      expect(selectors).toContain(element);
    }
  });

  it("styles the semantic patterns the spec lists", function coversPatterns(): void {
    const selectors = listPreludes(BASE_STYLESHEET).join(",");

    const patterns = [
      "article",
      '[role="alert"]',
      '[role="status"]',
      'input[type="checkbox"][role="switch"]',
      '[aria-invalid="true"]',
      "details",
      "summary",
      '[aria-busy="true"]',
      '[role="tab"][aria-selected="true"]',
      'textarea[data-ot-variant="code"]',
      "button[data-ot-player]",
      'aside[data-ot-alert="note"]',
      'aside[data-ot-alert="tip"]',
      'aside[data-ot-alert="important"]',
      'aside[data-ot-alert="warning"]',
      'aside[data-ot-alert="caution"]',
      "figure[data-mermaid-source]",
      'math[display="block"]',
      'span[class~="hljs-keyword"]',
      'span[class~="hljs-string"]',
      'span[class~="hljs-number"]',
      'span[class~="hljs-title"]',
      'span[class~="hljs-comment"]',
      'span[class~="hljs-deletion"]',
    ];
    for (const pattern of patterns) {
      expect(selectors).toContain(pattern);
    }
  });

  it("gives formulas the common math fonts before the browser's", function setsMathFont(): void {
    const mathBlock = readBlock(BASE_STYLESHEET, "  math {");

    expect(mathBlock.replace(/\s+/g, " ")).toContain(
      'font-family: "STIX Two Math", "STIX Math", "Cambria Math", "Latin Modern Math", math;',
    );
  });

  it("styles every variant the spec lists", function coversVariants(): void {
    const selectors = listPreludes(BASE_STYLESHEET).join(",");

    for (const variant of BUTTON_VARIANTS) {
      expect(selectors).toContain(`button[data-ot-variant="${variant}"]`);
    }
    for (const variant of BADGE_VARIANTS) {
      expect(selectors).toContain(`span[data-ot-variant="${variant}"]`);
    }
  });

  it("names only the spec's variant values", function checksVariantValues(): void {
    const css = removeComments(BASE_STYLESHEET);
    const knownValues = new Set([
      ...BUTTON_VARIANTS,
      ...BADGE_VARIANTS,
      ...TEXTAREA_VARIANTS,
    ]);

    const attributes = [...css.matchAll(/\[data-ot-variant([^\]]*)\]/g)];
    expect(attributes.length).toBeGreaterThan(0);
    for (const attribute of attributes) {
      expect(attribute[0]).toMatch(/^\[data-ot-variant="[a-z-]+"\]$/);
      const value = /^="([a-z-]+)"$/.exec(attribute[1])?.[1] ?? "";
      expect(knownValues.has(value)).toBe(true);
    }
    expect(css).not.toMatch(/\[data-variant/);
  });

  it("keeps each variant on its element", function checksVariantElements(): void {
    const css = removeComments(BASE_STYLESHEET);

    for (const match of css.matchAll(/(\S*)\[data-ot-variant="([a-z-]+)"\]/g)) {
      const [, element, value] = match;
      if (element.endsWith("button")) {
        expect(BUTTON_VARIANTS).toContain(value);
      } else if (element.endsWith("textarea")) {
        expect(TEXTAREA_VARIANTS).toContain(value);
      } else {
        expect(element).toMatch(/span$/);
        expect(BADGE_VARIANTS).toContain(value);
      }
    }
  });
});

describe("THEME_FRAME_STYLES", function describeFrameStyles(): void {
  it("is the token styles followed by the base stylesheet", function joinsStyles(): void {
    const tokenIndex = THEME_FRAME_STYLES.indexOf(buildThemeTokenStyles());
    const baseIndex = THEME_FRAME_STYLES.indexOf(BASE_STYLESHEET);

    expect(tokenIndex).toBe(0);
    expect(baseIndex).toBeGreaterThan(tokenIndex);
  });

  it("has no closing style tag", function checksStyleTag(): void {
    expect(THEME_FRAME_STYLES.toLowerCase()).not.toContain("</style");
  });
});
