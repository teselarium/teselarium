import { describe, expect, it } from "vitest";
import { buildTheme, THEME_TOKENS } from "./index.ts";
import type { ColorScheme, ThemeTokens } from "./index.ts";

const TOKEN_NAMES = [
  "--ot-color-background",
  "--ot-color-surface",
  "--ot-color-text",
  "--ot-color-text-muted",
  "--ot-color-border",
  "--ot-color-accent",
  "--ot-color-accent-text",
  "--ot-color-focus",
  "--ot-color-danger",
  "--ot-color-warning",
  "--ot-color-success",
  "--ot-font-body",
  "--ot-font-mono",
  "--ot-font-size",
  "--ot-line-height",
  "--ot-space-1",
  "--ot-space-2",
  "--ot-space-3",
  "--ot-space-4",
  "--ot-space-6",
  "--ot-radius",
  "--ot-shadow",
];

/** Text colors that must read on the background and on the surface. */
const TEXT_COLOR_NAMES = [
  "--ot-color-text",
  "--ot-color-text-muted",
  "--ot-color-accent",
  "--ot-color-danger",
  "--ot-color-warning",
  "--ot-color-success",
];

const COLOR_SCHEMES: ColorScheme[] = ["light", "dark"];

/** WCAG's minimum contrast ratio for normal text. */
const MINIMUM_CONTRAST = 4.5;

function readTokenNames(): string[] {
  const tokenNames: string[] = [];
  for (const token of THEME_TOKENS) {
    tokenNames.push(token.name);
  }
  return tokenNames;
}

/** The linear value of one sRGB channel written as two hex digits. */
function readLinearChannel(hexColor: string, offset: number): number {
  const channel = parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
  if (channel <= 0.04045) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` color. */
function readRelativeLuminance(hexColor: string): number {
  const red = readLinearChannel(hexColor, 1);
  const green = readLinearChannel(hexColor, 3);
  const blue = readLinearChannel(hexColor, 5);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance;
}

function readContrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = readRelativeLuminance(firstColor);
  const secondLuminance = readRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  const contrastRatio = (lighter + 0.05) / (darker + 0.05);
  return contrastRatio;
}

/** Each text color against each of the given backgrounds, as `"text on background"` labels. */
function listLowContrasts(
  tokens: ThemeTokens,
  textNames: string[],
  backgroundNames: string[],
): string[] {
  const lowContrasts: string[] = [];
  for (const textName of textNames) {
    for (const backgroundName of backgroundNames) {
      const ratio = readContrastRatio(tokens[textName], tokens[backgroundName]);
      if (ratio < MINIMUM_CONTRAST) {
        lowContrasts.push(`${textName} on ${backgroundName}: ${ratio}`);
      }
    }
  }
  return lowContrasts;
}

describe("theme tokens", function describeThemeTokens(): void {
  it("Token names", function listsTokenNames(): void {
    expect(readTokenNames()).toEqual(TOKEN_NAMES);
  });

  it("Color tokens differ between color schemes", function comparesSchemes(): void {
    const light = buildTheme("light").tokens;
    const dark = buildTheme("dark").tokens;

    for (const tokenName of TOKEN_NAMES) {
      if (tokenName.startsWith("--ot-color-")) {
        expect(dark[tokenName]).not.toBe(light[tokenName]);
      } else {
        expect(dark[tokenName]).toBe(light[tokenName]);
      }
    }
  });

  it("Resolved tokens are plain data", function resolvesPlainData(): void {
    const theme = buildTheme("dark");

    expect(Object.keys(theme.tokens)).toEqual(TOKEN_NAMES);
    for (const tokenName of TOKEN_NAMES) {
      expect(typeof theme.tokens[tokenName]).toBe("string");
    }
    expect(structuredClone(theme.tokens)).toEqual(theme.tokens);
    expect(structuredClone(theme)).toEqual(theme);
  });

  it("keeps the color scheme it was built for", function keepsColorScheme(): void {
    expect(buildTheme("light").colorScheme).toBe("light");
    expect(buildTheme("dark").colorScheme).toBe("dark");
  });

  it("uses the light and dark values of the table", function readsTable(): void {
    expect(buildTheme("light").tokens["--ot-color-background"]).toBe("#ffffff");
    expect(buildTheme("dark").tokens["--ot-color-background"]).toBe("#18181b");
  });

  it("has a frozen table", function freezesTable(): void {
    expect(Object.isFrozen(THEME_TOKENS)).toBe(true);
    for (const token of THEME_TOKENS) {
      expect(Object.isFrozen(token)).toBe(true);
    }
  });

  it("has text colors with a contrast of at least 4.5", function checksContrast(): void {
    for (const colorScheme of COLOR_SCHEMES) {
      const tokens = buildTheme(colorScheme).tokens;

      const lowContrasts = [
        ...listLowContrasts(tokens, TEXT_COLOR_NAMES, [
          "--ot-color-background",
          "--ot-color-surface",
        ]),
        ...listLowContrasts(
          tokens,
          ["--ot-color-accent-text"],
          ["--ot-color-accent"],
        ),
      ];

      expect(lowContrasts).toEqual([]);
    }
  });
});
