import { describe, expect, it } from "vitest";
import { buildTheme, THEME_TOKENS } from "./index.ts";
import type { ColorScheme, ThemeTokens } from "./index.ts";

/** The role colors: the only tokens with different light and dark values. */
const COLOR_TOKEN_NAMES = [
  "--ot-background",
  "--ot-foreground",
  "--ot-card",
  "--ot-card-foreground",
  "--ot-popover",
  "--ot-popover-foreground",
  "--ot-primary",
  "--ot-primary-foreground",
  "--ot-secondary",
  "--ot-secondary-foreground",
  "--ot-muted",
  "--ot-muted-foreground",
  "--ot-accent",
  "--ot-accent-foreground",
  "--ot-highlight",
  "--ot-highlight-foreground",
  "--ot-destructive",
  "--ot-destructive-foreground",
  "--ot-warning",
  "--ot-success",
  "--ot-border",
  "--ot-input",
  "--ot-ring",
];

const TOKEN_NAMES = [
  ...COLOR_TOKEN_NAMES,
  "--ot-font-sans",
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
  "--ot-content-width",
  "--ot-reading-width",
];

/** The tokens for widths, the same in each color scheme. */
const WIDTH_TOKEN_NAMES = ["--ot-content-width", "--ot-reading-width"];

/** The text roles, drawn on each of the surfaces. */
const TEXT_ROLE_NAMES = [
  "--ot-foreground",
  "--ot-muted-foreground",
  "--ot-primary",
  "--ot-secondary",
  "--ot-destructive",
  "--ot-warning",
  "--ot-success",
];

const SURFACE_NAMES = ["--ot-background", "--ot-card", "--ot-muted"];

/** Each `-foreground` token and the role it is drawn on. */
const FOREGROUND_PAIRS = [
  ["--ot-card-foreground", "--ot-card"],
  ["--ot-popover-foreground", "--ot-popover"],
  ["--ot-primary-foreground", "--ot-primary"],
  ["--ot-secondary-foreground", "--ot-secondary"],
  ["--ot-accent-foreground", "--ot-accent"],
  ["--ot-highlight-foreground", "--ot-highlight"],
  ["--ot-destructive-foreground", "--ot-destructive"],
  ["--ot-muted-foreground", "--ot-muted"],
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

function listLowForegroundContrasts(tokens: ThemeTokens): string[] {
  const lowContrasts: string[] = [];
  for (const [foregroundName, roleName] of FOREGROUND_PAIRS) {
    lowContrasts.push(
      ...listLowContrasts(tokens, [foregroundName], [roleName]),
    );
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

    expect(COLOR_TOKEN_NAMES).toHaveLength(23);
    for (const tokenName of TOKEN_NAMES) {
      if (COLOR_TOKEN_NAMES.includes(tokenName)) {
        expect(dark[tokenName]).not.toBe(light[tokenName]);
      } else {
        expect(dark[tokenName]).toBe(light[tokenName]);
      }
    }
  });

  it("keeps the width tokens the same in each color scheme", function comparesWidths(): void {
    const light = buildTheme("light").tokens;
    const dark = buildTheme("dark").tokens;

    for (const tokenName of WIDTH_TOKEN_NAMES) {
      expect(light[tokenName]).toMatch(/rem$/);
      expect(dark[tokenName]).toBe(light[tokenName]);
    }
  });

  it("Old token names are gone", function dropsOldNames(): void {
    const tokenNames = Object.keys(buildTheme("light").tokens);

    for (const tokenName of tokenNames) {
      expect(tokenName).not.toMatch(/^--ot-color-/);
    }
    expect(tokenNames).not.toContain("--ot-font-body");
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
    expect(buildTheme("light").tokens["--ot-background"]).toBe("#f6f1e7");
    expect(buildTheme("dark").tokens["--ot-background"]).toBe("#0f141d");
  });

  it("has a frozen table", function freezesTable(): void {
    expect(Object.isFrozen(THEME_TOKENS)).toBe(true);
    for (const token of THEME_TOKENS) {
      expect(Object.isFrozen(token)).toBe(true);
    }
  });

  it("Text roles on the surfaces", function checksTextRoles(): void {
    for (const colorScheme of COLOR_SCHEMES) {
      const tokens = buildTheme(colorScheme).tokens;

      expect(listLowContrasts(tokens, TEXT_ROLE_NAMES, SURFACE_NAMES)).toEqual(
        [],
      );
    }
  });

  it("Foreground on its role", function checksForegrounds(): void {
    for (const colorScheme of COLOR_SCHEMES) {
      const tokens = buildTheme(colorScheme).tokens;

      expect(listLowForegroundContrasts(tokens)).toEqual([]);
    }
  });
});
