import BASE_STYLESHEET from "./base_stylesheet.css?raw";
import { readTokenValue, THEME_TOKENS } from "./theme_tokens.ts";
import type { ColorScheme } from "./theme_tokens.ts";

function buildDeclarationLines(colorScheme: ColorScheme): string[] {
  const lines = [`    color-scheme: ${colorScheme};`];
  for (const token of THEME_TOKENS) {
    lines.push(`    ${token.name}: ${readTokenValue(token, colorScheme)};`);
  }
  return lines;
}

/**
 * The token values as CSS, in the cascade layer `teselarium`: the light
 * values on `:root` and on any element with `data-tes-color-scheme="light"`,
 * then the dark values on any element with `data-tes-color-scheme="dark"`.
 * The dark block comes last, so it wins on a dark `<html>`, which `:root`
 * matches too. The text never changes: switching only changes the attribute.
 */
export function buildThemeTokenStyles(): string {
  const tokenStyles = [
    "@layer teselarium {",
    "  :root,",
    '  [data-tes-color-scheme="light"] {',
    ...buildDeclarationLines("light"),
    "  }",
    '  [data-tes-color-scheme="dark"] {',
    ...buildDeclarationLines("dark"),
    "  }",
    "}",
    "",
  ].join("\n");
  return tokenStyles;
}

/**
 * What a mod frame gets unless the mod opts out: the token styles, then the
 * base stylesheet. Static text without a closing style tag.
 */
export const THEME_FRAME_STYLES = `${buildThemeTokenStyles()}\n${BASE_STYLESHEET}`;
