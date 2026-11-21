import { expect } from "@playwright/test";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import { openSection } from "./app_layout.ts";
import { buildModConf } from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";

/** A token's value, as the token table writes it and as `getComputedStyle` gives a color. */
export interface TokenColor {
  value: string;
  computed: string;
}

/**
 * The token values the tests check, for each color scheme. Kept in step with
 * `THEME_TOKENS` in `src/lib/core/theme/`, which Playwright cannot import:
 * the module loads its stylesheet through Vite.
 */
export const LIGHT_COLORS = {
  background: { value: "#f6f1e7", computed: "rgb(246, 241, 231)" },
  foreground: { value: "#1d2433", computed: "rgb(29, 36, 51)" },
  primary: { value: "#1f4e9c", computed: "rgb(31, 78, 156)" },
  popover: { value: "#ffffff", computed: "rgb(255, 255, 255)" },
  popoverForeground: { value: "#1d2433", computed: "rgb(29, 36, 51)" },
  card: { value: "#ffffff", computed: "rgb(255, 255, 255)" },
  accentForeground: { value: "#1d2433", computed: "rgb(29, 36, 51)" },
  border: { value: "#e3d9c6", computed: "rgb(227, 217, 198)" },
} as const satisfies Record<string, TokenColor>;

export const DARK_COLORS = {
  background: { value: "#0f141d", computed: "rgb(15, 20, 29)" },
  foreground: { value: "#f2ede3", computed: "rgb(242, 237, 227)" },
  primary: { value: "#78a6f2", computed: "rgb(120, 166, 242)" },
  popover: { value: "#18202c", computed: "rgb(24, 32, 44)" },
  popoverForeground: { value: "#f2ede3", computed: "rgb(242, 237, 227)" },
  card: { value: "#18202c", computed: "rgb(24, 32, 44)" },
  accentForeground: { value: "#0f141d", computed: "rgb(15, 20, 29)" },
  border: { value: "#283245", computed: "rgb(40, 50, 69)" },
} as const satisfies Record<string, TokenColor>;

/**
 * A mod that keeps its engine API object and context on `globalThis.probe`,
 * the color scheme attribute it saw in `mount`, and each `theme.changed` it
 * received with the attribute its handler saw.
 */
export const THEME_PROBE_MOD_CODE = `export default function mount(engine, context) {
  globalThis.probe = {
    engine,
    context,
    attributeAtMount: document.documentElement.dataset.otColorScheme,
    themeEvents: [],
  };
  engine.on("theme.changed", function recordTheme(theme) {
    globalThis.probe.themeEvents.push({
      colorScheme: theme.colorScheme,
      attribute: document.documentElement.dataset.otColorScheme,
    });
  });
  const heading = document.createElement("h1");
  heading.textContent = "Probe " + context.mod.title;
  document.body.append(heading);
}
`;

/** The theme probe with 3000 pixels of content. */
export const TALL_PROBE_MOD_CODE = `export default function mount(engine, context) {
  globalThis.probe = { engine, context, themeEvents: [] };
  const content = document.createElement("div");
  content.style.height = "3000px";
  content.textContent = "Tall content";
  document.body.append(content);
}
`;

/** The files of a test mod named `name` in the folder `name/`. */
export function buildThemeProbeFiles(
  name: string,
  extraLines: string[] = [],
  code: string = THEME_PROBE_MOD_CODE,
): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, extraLines),
    [`${name}/main.js`]: code,
  };
  return files;
}

/** The Settings page's Theme control: a select. The sidebar's is a button. */
export function themeControl(page: Page): Locator {
  return page.getByRole("combobox", { name: "Theme" });
}

/**
 * Picks System, Light or Dark in the Theme control, as a user would: opens
 * Settings from the sidebar, chooses, and goes back to what was shown, unless
 * Settings was already shown.
 */
export async function chooseTheme(page: Page, label: string): Promise<void> {
  const wasOnSettings = await themeControl(page).isVisible();
  if (!wasOnSettings) {
    await openSection(page, "Settings");
  }
  await themeControl(page).selectOption({ label });
  if (!wasOnSettings) {
    await page.goBack();
    await expect(themeControl(page)).toHaveCount(0);
  }
}

/** Runs in a page or a frame: the `data-ot-color-scheme` of `<html>`. */
export function readColorSchemeAttribute(): string | null {
  return document.documentElement.getAttribute("data-ot-color-scheme");
}

export interface ElementColors {
  background: string;
  color: string;
}

/** Runs in a page or a frame: the computed colors of `<body>`. */
export function readBodyColors(): ElementColors {
  const style = getComputedStyle(document.body);
  const colors: ElementColors = {
    background: style.backgroundColor,
    color: style.color,
  };
  return colors;
}

/** Runs in a frame: the computed colors of the first element matching `selector`. */
export function readElementColors(selector: string): ElementColors {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`No element matches "${selector}"`);
  }
  const style = getComputedStyle(element);
  const colors: ElementColors = {
    background: style.backgroundColor,
    color: style.color,
  };
  return colors;
}

/** Runs in a frame: the computed outline color of the first element matching `selector`. */
export function readOutlineColor(selector: string): string {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`No element matches "${selector}"`);
  }
  return getComputedStyle(element).outlineColor;
}

/** Runs on an element: its computed `box-shadow`, `none` when it has none. */
export function readBoxShadow(element: Element): string {
  const boxShadow = getComputedStyle(element).boxShadow;
  return boxShadow;
}

/** Runs in a frame: appends an unlayered `<style>` to `<head>`, as a mod would. */
export function addModStyle(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}

/** Runs in a frame: appends HTML to `<body>`, as a mod would. */
export function addModHtml(html: string): void {
  document.body.insertAdjacentHTML("beforeend", html);
}

interface RecordedTheme {
  colorScheme: string;
  attribute: string | undefined;
}

interface ThemeProbeGlobal {
  probe?: {
    attributeAtMount?: string;
    themeEvents: RecordedTheme[];
    context: Record<string, unknown>;
  };
}

/** Runs in a theme probe frame: the attribute it saw in `mount`. */
export function readAttributeAtMount(): string | undefined {
  return (globalThis as ThemeProbeGlobal).probe?.attributeAtMount;
}

/** Runs in a theme probe or a recorded default mod: each `theme.changed` it received. */
export function readThemeEvents(): RecordedTheme[] {
  return (globalThis as ThemeProbeGlobal).probe?.themeEvents ?? [];
}

/** Runs in a probe frame: the `theme` of its mount context. */
export function readContextTheme(): unknown {
  return (globalThis as ThemeProbeGlobal).probe?.context.theme;
}

/** Runs in a probe frame: true once `theme.changed` arrived `count` times. */
export function hasThemeEvents(count: number): boolean {
  const events = (globalThis as ThemeProbeGlobal).probe?.themeEvents ?? [];
  return events.length >= count;
}

/** The default export of a bundled default mod (build/default_mod_build.ts), naming its `mount`. */
const BUNDLED_DEFAULT_EXPORT = /export \{ ([\w$]+) as default \};/;

/** A default mod's code without its default export, and the name of its `mount` in that code. */
interface UnexportedMod {
  code: string;
  mountName: string;
}

function removeDefaultExport(code: string): UnexportedMod {
  const bundledExport = BUNDLED_DEFAULT_EXPORT.exec(code);
  if (bundledExport !== null) {
    const bundledMod: UnexportedMod = {
      code: code.replace(bundledExport[0], ""),
      mountName: bundledExport[1],
    };
    return bundledMod;
  }
  throw new Error(
    "Cannot wrap the default mod's mount: its code has no default export of a bundle (build/default_mod_build.ts).",
  );
}

/**
 * Wraps a default mod's `mount` so it records each `theme.changed` like the
 * theme probe, then mounts the mod as usual.
 */
function wrapDefaultModCode(code: string): string {
  const unexportedMod = removeDefaultExport(code);
  const wrappedCode = `${unexportedMod.code}
export default function mountRecordingThemes(engine, context) {
  globalThis.probe = { context, themeEvents: [] };
  engine.on("theme.changed", function recordTheme(theme) {
    globalThis.probe.themeEvents.push({
      colorScheme: theme.colorScheme,
      attribute: document.documentElement.dataset.otColorScheme,
    });
  });
  return ${unexportedMod.mountName}(engine, context);
}
`;
  return wrappedCode;
}

async function answerWrappedDefaultMod(route: Route): Promise<void> {
  const response = await route.fetch();
  const code = await response.text();
  await route.fulfill({ response, body: wrapDefaultModCode(code) });
}

/** Serves the default mods with a `mount` that records `theme.changed`. */
export async function recordDefaultModThemes(page: Page): Promise<void> {
  await page.route("**/default_mods/*/main.js", answerWrappedDefaultMod);
}

/** Runs in the page: how far the page can scroll, 0 when it cannot. */
export function readPageOverflow(): number {
  const overflow =
    document.documentElement.scrollHeight -
    document.documentElement.clientHeight;
  return overflow;
}

/** Runs in a frame: true when the frame's document can scroll. */
export function canFrameScroll(): boolean {
  const root = document.documentElement;
  return root.scrollHeight > root.clientHeight;
}

/** Runs in a frame: true when the frame's document can scroll sideways. */
export function canFrameScrollSideways(): boolean {
  const root = document.documentElement;
  return root.scrollWidth > root.clientWidth;
}

/**
 * Runs in a frame: for each word of the first element matching `selector`,
 * how many lines it takes. A word split across two lines counts 2.
 * Self-contained, since it runs in the frame.
 */
export function countWordLines(selector: string): number[] {
  const element = document.querySelector(selector);
  if (element === null || element.firstChild === null) {
    throw new Error(`Expected text in an element matching "${selector}"`);
  }
  const text = element.firstChild;
  const content = text.textContent ?? "";
  const counts: number[] = [];
  for (const match of content.matchAll(/\S+/g)) {
    const range = document.createRange();
    range.setStart(text, match.index);
    range.setEnd(text, match.index + match[0].length);
    const lineTops = new Set<number>();
    for (const rect of range.getClientRects()) {
      lineTops.add(Math.round(rect.top));
    }
    counts.push(lineTops.size);
  }
  return counts;
}

/** The separators of one table row, as the user sees them. */
export interface RowSeparators {
  /** Whether the row is in the table's `<thead>`. */
  isHeader: boolean;
  /** Whether a line runs under the row: its own bottom border, or its last cell's. */
  hasLineUnder: boolean;
  /** How many of its cells but the last have a bottom border: lines between its values when they are stacked. */
  linesBetweenCells: number;
}

/**
 * Runs in a frame: the separators of each row of the first table, from the
 * computed bottom borders of the row and its cells. In a table with columns,
 * the cells' borders side by side make the line under the row, so only the
 * last cell counts for it. Self-contained, since it runs in the frame.
 */
export function readRowSeparators(): RowSeparators[] {
  const table = document.querySelector("table");
  if (table === null) {
    throw new Error("Expected a table in the frame");
  }
  const rows: RowSeparators[] = [];
  for (const row of table.querySelectorAll("tr")) {
    const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
    const cellBorders: number[] = [];
    for (const cell of cells) {
      cellBorders.push(parseFloat(getComputedStyle(cell).borderBottomWidth));
    }
    const rowBorder = parseFloat(getComputedStyle(row).borderBottomWidth);
    let linesBetweenCells = 0;
    for (const border of cellBorders.slice(0, -1)) {
      if (border > 0) {
        linesBetweenCells++;
      }
    }
    rows.push({
      isHeader: row.parentElement?.tagName === "THEAD",
      hasLineUnder: rowBorder > 0 || (cellBorders.at(-1) ?? 0) > 0,
      linesBetweenCells,
    });
  }
  return rows;
}

/** Runs in a frame: the computed `overflow-wrap` of `<body>`. */
export function readBodyOverflowWrap(): string {
  return getComputedStyle(document.body).overflowWrap;
}

/** The size of the visible sandbox's frame element in the page. */
export async function readVisibleFrameBox(
  page: Page,
): Promise<{ top: number; bottom: number; height: number }> {
  const box = await page
    .locator("[data-sandbox-id]:not([hidden]) iframe")
    .boundingBox();
  if (box === null) {
    throw new Error("Expected a visible frame");
  }
  const frameBox = {
    top: box.y,
    bottom: box.y + box.height,
    height: box.height,
  };
  return frameBox;
}

/** Waits until a frame's `<html>` has the color scheme attribute `colorScheme`. */
export async function waitForFrameColorScheme(
  frame: Frame,
  colorScheme: string,
): Promise<void> {
  await frame.waitForFunction(hasColorSchemeAttribute, colorScheme);
}

function hasColorSchemeAttribute(colorScheme: string): boolean {
  return (
    document.documentElement.getAttribute("data-ot-color-scheme") ===
    colorScheme
  );
}

/** Runs in a frame: the trimmed value of a token on `<html>`, as a mod reads it from JavaScript. */
export function readRootTokenValue(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Runs in a frame: the computed margin of `<body>`. */
export function readBodyMargin(): string {
  return getComputedStyle(document.body).margin;
}

interface PaintLog {
  /** In a mod frame: the times it rendered without a color scheme. */
  unthemedTimes: number[];
  /** In the page: the times it rendered with a mod frame visible. */
  visibleFrameTimes: number[];
}

/**
 * An init script for the page and every frame: on each rendering, the page
 * records whether a mod frame is visible, and a mod frame records whether its
 * `<html>` still lacks the color scheme attribute. Times are absolute, so the
 * page's and the frame's can be compared.
 */
export function recordPaints(): void {
  const paintLog: PaintLog = { unthemedTimes: [], visibleFrameTimes: [] };
  (globalThis as { paintLog?: PaintLog }).paintLog = paintLog;
  const isPage = window === window.top;
  let remainingFrames = 120;
  function recordPaint(time: number): void {
    const absoluteTime = performance.timeOrigin + time;
    if (isPage) {
      const frame = document.querySelector("iframe");
      if (frame !== null && getComputedStyle(frame).visibility === "visible") {
        paintLog.visibleFrameTimes.push(absoluteTime);
      }
    } else if (!document.documentElement.hasAttribute("data-ot-color-scheme")) {
      paintLog.unthemedTimes.push(absoluteTime);
    }
    remainingFrames -= 1;
    if (remainingFrames > 0) {
      requestAnimationFrame(recordPaint);
    }
  }
  requestAnimationFrame(recordPaint);
}

/** Runs in the page or a frame: what `recordPaints` recorded. */
export function readPaintLog(): PaintLog {
  const paintLog = (globalThis as { paintLog?: PaintLog }).paintLog;
  if (paintLog === undefined) {
    throw new Error("Expected recordPaints to run as an init script");
  }
  return paintLog;
}

/** The computed look of an element, as the semantic and variant checks compare it. */
export interface ElementLook {
  background: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  appearance: string;
}

/**
 * Runs in a frame: the computed look of the first element matching
 * `selector`. Borders are read on the top side, because Firefox gives no
 * computed value for the shorthands.
 */
export function readElementLook(selector: string): ElementLook {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`No element matches "${selector}"`);
  }
  const style = getComputedStyle(element);
  const look: ElementLook = {
    background: style.backgroundColor,
    color: style.color,
    borderColor: style.borderTopColor,
    borderWidth: style.borderTopWidth,
    borderRadius: style.borderTopLeftRadius,
    appearance: style.appearance,
  };
  return look;
}

/**
 * Runs in a frame: what `property: var(token)` computes to, read on a
 * temporary element. So a check compares with the token's value in the
 * frame's color scheme, in the form the browser computes it.
 */
export function readTokenAs(tokenAndProperty: string[]): string {
  const [token, property] = tokenAndProperty;
  const probe = document.createElement("div");
  probe.style.setProperty(property, `var(${token})`);
  if (property.startsWith("border")) {
    probe.style.borderStyle = "solid";
  }
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

/**
 * Runs in a frame: every declaration outside the `opentesela` layer that
 * sets a look property (a color, background, border, font or shadow), as
 * `selector { property }`. Corner radii and a `box-shadow` of exactly
 * `var(--ot-shadow)` are not counted: the sample mod sets them on its books
 * from the theme's `--ot-radius` and `--ot-shadow`. Empty when the frame's own
 * styles are layout, shape and the theme's shadow only. Self-contained, since
 * it runs in the frame.
 */
export function listOwnLookDeclarations(): string[] {
  const lookPattern = /^(background|border|font)|color$|shadow$/;
  const shapePattern = /-radius$/;
  const themeShadow = "var(--ot-shadow)";
  const found: string[] = [];
  const rules: CSSRule[] = [];
  for (const sheet of document.styleSheets) {
    rules.push(...sheet.cssRules);
  }
  while (rules.length > 0) {
    const rule = rules.shift() as CSSRule;
    if (rule instanceof CSSLayerBlockRule && rule.name === "opentesela") {
      continue;
    }
    if ("cssRules" in rule) {
      rules.push(...(rule.cssRules as CSSRuleList));
    }
    if (!(rule instanceof CSSStyleRule)) {
      continue;
    }
    for (const property of rule.style) {
      const isThemeShadow =
        property === "box-shadow" &&
        rule.style.getPropertyValue(property).trim() === themeShadow;
      if (
        lookPattern.test(property) &&
        !shapePattern.test(property) &&
        !isThemeShadow
      ) {
        found.push(`${rule.selectorText} { ${property} }`);
      }
    }
  }
  return found;
}

/** WCAG's minimum contrast ratio for normal text. */
export const MINIMUM_TEXT_CONTRAST = 4.5;

/** The channels of an opaque `rgb(r, g, b)` color, as `getComputedStyle` gives it. */
function readRgbChannels(color: string): number[] {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
  if (match === null) {
    throw new Error(
      `Expected an opaque rgb() color to measure its contrast, got "${color}"`,
    );
  }
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  return channels;
}

function linearizeChannel(channel: number): number {
  const value = channel / 255;
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque `rgb()` color. */
function readRelativeLuminance(color: string): number {
  const linear: number[] = [];
  for (const channel of readRgbChannels(color)) {
    linear.push(linearizeChannel(channel));
  }
  const [red, green, blue] = linear;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance;
}

/** WCAG contrast ratio of two opaque `rgb()` colors, from 1 to 21. */
export function readContrastRatio(first: string, second: string): number {
  const firstLuminance = readRelativeLuminance(first);
  const secondLuminance = readRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return ratio;
}
