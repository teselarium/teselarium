/** The color scheme the app and its mods are drawn in. */
export type ColorScheme = "light" | "dark";

/** One theme token: a CSS custom property with its light and dark values. */
export interface ThemeToken {
  name: string;
  light: string;
  dark: string;
}

/** Each token name mapped to its value for one color scheme. Plain data. */
export type ThemeTokens = Record<string, string>;

/** What mods receive as `context.theme` and with `theme.changed`. Plain data. */
export interface Theme {
  colorScheme: ColorScheme;
  tokens: ThemeTokens;
}

function defineColorToken(
  name: string,
  light: string,
  dark: string,
): Readonly<ThemeToken> {
  const token: ThemeToken = { name, light, dark };
  return Object.freeze(token);
}

function defineSharedToken(name: string, value: string): Readonly<ThemeToken> {
  const token: ThemeToken = { name, light: value, dark: value };
  return Object.freeze(token);
}

/**
 * The only source of the app's and the mods' colors, fonts and spacing. Every
 * text color has a contrast of at least 4.5:1 on the background and on the
 * surface of its color scheme, and so has the accent text on the accent.
 */
export const THEME_TOKENS: readonly Readonly<ThemeToken>[] = Object.freeze([
  defineColorToken("--ot-color-background", "#ffffff", "#18181b"),
  defineColorToken("--ot-color-surface", "#f4f4f5", "#27272a"),
  defineColorToken("--ot-color-text", "#18181b", "#fafafa"),
  defineColorToken("--ot-color-text-muted", "#52525b", "#a1a1aa"),
  defineColorToken("--ot-color-border", "#d4d4d8", "#3f3f46"),
  defineColorToken("--ot-color-accent", "#2563eb", "#60a5fa"),
  defineColorToken("--ot-color-accent-text", "#ffffff", "#18181b"),
  defineColorToken("--ot-color-focus", "#1d4ed8", "#93c5fd"),
  defineColorToken("--ot-color-danger", "#b91c1c", "#f87171"),
  defineColorToken("--ot-color-warning", "#854d0e", "#facc15"),
  defineColorToken("--ot-color-success", "#15803d", "#4ade80"),
  defineSharedToken(
    "--ot-font-body",
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ),
  defineSharedToken(
    "--ot-font-mono",
    'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  ),
  defineSharedToken("--ot-font-size", "1rem"),
  defineSharedToken("--ot-line-height", "1.5"),
  defineSharedToken("--ot-space-1", "0.25rem"),
  defineSharedToken("--ot-space-2", "0.5rem"),
  defineSharedToken("--ot-space-3", "0.75rem"),
  defineSharedToken("--ot-space-4", "1rem"),
  defineSharedToken("--ot-space-6", "1.5rem"),
  defineSharedToken("--ot-radius", "0.375rem"),
  defineSharedToken("--ot-shadow", "0 1px 3px rgb(0 0 0 / 0.25)"),
]);

/** The value of a token for a color scheme. */
export function readTokenValue(
  token: Readonly<ThemeToken>,
  colorScheme: ColorScheme,
): string {
  if (colorScheme === "dark") {
    return token.dark;
  }
  return token.light;
}

/** Resolves every token for a color scheme. */
export function buildTheme(colorScheme: ColorScheme): Theme {
  const tokens: ThemeTokens = {};
  for (const token of THEME_TOKENS) {
    tokens[token.name] = readTokenValue(token, colorScheme);
  }
  const theme: Theme = { colorScheme, tokens };
  return theme;
}
