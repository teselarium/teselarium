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
 * The only source of the app's and the mods' colors, fonts and spacing. The
 * color tokens are shadcn/ui's role names under `--tes-`, plus `highlight`
 * (the secondary badge's fill), `warning` and `success`. Gaudí's trencadís:
 * cobalt and turquoise glazes, saffron and leaf-green shards, on stone and
 * white ceramic by day and on night blue by night. Every text role has a
 * contrast of at least 4.5:1 on the background, the card and the muted
 * fill, and so has each `-foreground` on its role (the theme spec, "Token
 * contrast").
 */
export const THEME_TOKENS: readonly Readonly<ThemeToken>[] = Object.freeze([
  defineColorToken("--tes-background", "#f6f1e7", "#0f141d"),
  defineColorToken("--tes-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--tes-card", "#ffffff", "#18202c"),
  defineColorToken("--tes-card-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--tes-popover", "#ffffff", "#18202c"),
  defineColorToken("--tes-popover-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--tes-primary", "#1f4e9c", "#78a6f2"),
  defineColorToken("--tes-primary-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--tes-secondary", "#0b6f6c", "#4fc3bb"),
  defineColorToken("--tes-secondary-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--tes-muted", "#f9f5ee", "#141a25"),
  defineColorToken("--tes-muted-foreground", "#5b6170", "#a4abb9"),
  defineColorToken("--tes-accent", "#f2c14e", "#e9b949"),
  defineColorToken("--tes-accent-foreground", "#1d2433", "#0f141d"),
  defineColorToken("--tes-highlight", "#9cc46f", "#8fbb62"),
  defineColorToken("--tes-highlight-foreground", "#1d2433", "#0f141d"),
  defineColorToken("--tes-destructive", "#b3261e", "#f08a7a"),
  defineColorToken("--tes-destructive-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--tes-warning", "#8a5a00", "#f5b04a"),
  defineColorToken("--tes-success", "#3a6f22", "#8fd18a"),
  defineColorToken("--tes-border", "#e3d9c6", "#283245"),
  defineColorToken("--tes-input", "#cbbfa8", "#3a465c"),
  defineColorToken("--tes-ring", "#1f4e9c", "#78a6f2"),
  defineSharedToken(
    "--tes-font-sans",
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ),
  defineSharedToken(
    "--tes-font-mono",
    'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  ),
  defineSharedToken("--tes-font-size", "1rem"),
  defineSharedToken("--tes-line-height", "1.5"),
  defineSharedToken("--tes-space-1", "0.25rem"),
  defineSharedToken("--tes-space-2", "0.5rem"),
  defineSharedToken("--tes-space-3", "0.75rem"),
  defineSharedToken("--tes-space-4", "1rem"),
  defineSharedToken("--tes-space-6", "1.5rem"),
  defineSharedToken("--tes-radius", "0.625rem"),
  defineSharedToken(
    "--tes-shadow",
    "0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.12)",
  ),
  defineSharedToken("--tes-content-width", "65rem"),
  defineSharedToken("--tes-reading-width", "55rem"),
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
