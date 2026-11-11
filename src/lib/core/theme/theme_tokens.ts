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
 * color tokens are shadcn/ui's role names under `--ot-`, plus `highlight`
 * (the secondary badge's fill), `warning` and `success`. Gaudí's trencadís:
 * cobalt and turquoise glazes, saffron and leaf-green shards, on stone and
 * white ceramic by day and on night blue by night. Every text role has a
 * contrast of at least 4.5:1 on the background, the card and the muted
 * fill, and so has each `-foreground` on its role (the theme spec, "Token
 * contrast").
 */
export const THEME_TOKENS: readonly Readonly<ThemeToken>[] = Object.freeze([
  defineColorToken("--ot-background", "#f6f1e7", "#0f141d"),
  defineColorToken("--ot-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--ot-card", "#ffffff", "#18202c"),
  defineColorToken("--ot-card-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--ot-popover", "#ffffff", "#18202c"),
  defineColorToken("--ot-popover-foreground", "#1d2433", "#f2ede3"),
  defineColorToken("--ot-primary", "#1f4e9c", "#78a6f2"),
  defineColorToken("--ot-primary-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--ot-secondary", "#0b6f6c", "#4fc3bb"),
  defineColorToken("--ot-secondary-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--ot-muted", "#f9f5ee", "#141a25"),
  defineColorToken("--ot-muted-foreground", "#5b6170", "#a4abb9"),
  defineColorToken("--ot-accent", "#f2c14e", "#e9b949"),
  defineColorToken("--ot-accent-foreground", "#1d2433", "#0f141d"),
  defineColorToken("--ot-highlight", "#9cc46f", "#8fbb62"),
  defineColorToken("--ot-highlight-foreground", "#1d2433", "#0f141d"),
  defineColorToken("--ot-destructive", "#b3261e", "#f08a7a"),
  defineColorToken("--ot-destructive-foreground", "#ffffff", "#0f141d"),
  defineColorToken("--ot-warning", "#8a5a00", "#f5b04a"),
  defineColorToken("--ot-success", "#3a6f22", "#8fd18a"),
  defineColorToken("--ot-border", "#e3d9c6", "#283245"),
  defineColorToken("--ot-input", "#cbbfa8", "#3a465c"),
  defineColorToken("--ot-ring", "#1f4e9c", "#78a6f2"),
  defineSharedToken(
    "--ot-font-sans",
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
  defineSharedToken("--ot-radius", "0.625rem"),
  defineSharedToken(
    "--ot-shadow",
    "0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.12)",
  ),
  defineSharedToken("--ot-content-width", "65rem"),
  defineSharedToken("--ot-reading-width", "55rem"),
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
