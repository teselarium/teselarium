import type { Frame, Locator, Page, Route } from "@playwright/test";
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
  background: { value: "#ffffff", computed: "rgb(255, 255, 255)" },
  text: { value: "#18181b", computed: "rgb(24, 24, 27)" },
  accent: { value: "#2563eb", computed: "rgb(37, 99, 235)" },
} as const satisfies Record<string, TokenColor>;

export const DARK_COLORS = {
  background: { value: "#18181b", computed: "rgb(24, 24, 27)" },
  text: { value: "#fafafa", computed: "rgb(250, 250, 250)" },
  accent: { value: "#60a5fa", computed: "rgb(96, 165, 250)" },
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
  heading.textContent = "Probe " + context.mod.name;
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

export function themeControl(page: Page): Locator {
  return page.getByLabel("Theme");
}

/** Picks System, Light or Dark in the Theme control, as a user would. */
export async function chooseTheme(page: Page, label: string): Promise<void> {
  await themeControl(page).selectOption({ label });
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

/**
 * Wraps a default mod's `mount` so it records each `theme.changed` like the
 * theme probe, then mounts the mod as usual.
 */
function wrapDefaultModCode(code: string): string {
  const renamedCode = code.replace(
    "export default async function mount(",
    "async function mountDefaultMod(",
  );
  const wrappedCode = `${renamedCode}
export default function mount(engine, context) {
  globalThis.probe = { context, themeEvents: [] };
  engine.on("theme.changed", function recordTheme(theme) {
    globalThis.probe.themeEvents.push({
      colorScheme: theme.colorScheme,
      attribute: document.documentElement.dataset.otColorScheme,
    });
  });
  return mountDefaultMod(engine, context);
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
