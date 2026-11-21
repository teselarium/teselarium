import { expect } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import { buildModConf, stageBar } from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";

/** Kept in step with `THEATER_MODE_KEY` in `src/main/stage/theater_setting.ts`. */
export const THEATER_MODE_KEY = "opentesela.theater-mode";

/** The viewport where the stage area is wider than `--ot-content-width`. */
export const WIDE_VIEWPORT = { width: 2560, height: 1080 };

/** A phone in portrait. */
export const PHONE_VIEWPORT = { width: 412, height: 915 };

/** A small phone in portrait. */
export const SMALL_PHONE_VIEWPORT = { width: 360, height: 740 };

/** A laptop screen. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

/**
 * A mod that keeps its engine API object and context on `globalThis.probe`,
 * the layout attribute it saw in `mount`, and each `layout.changed` it
 * received with the attribute its handler saw. It adds no styles.
 */
export const LAYOUT_PROBE_MOD_CODE = `export default function mount(engine, context) {
  globalThis.probe = {
    engine,
    context,
    attributeAtMount: document.documentElement.dataset.otLayout,
    layoutEvents: [],
  };
  engine.on("layout.changed", function recordLayout(params) {
    globalThis.probe.layoutEvents.push({
      layout: params.layout,
      attribute: document.documentElement.dataset.otLayout,
    });
  });
  const heading = document.createElement("h1");
  heading.textContent = "Probe " + context.mod.title;
  document.body.append(heading);
}
`;

/** The layout probe with 3000 pixels of content. */
export const TALL_LAYOUT_PROBE_MOD_CODE = `export default function mount(engine, context) {
  globalThis.probe = { engine, context, layoutEvents: [] };
  const content = document.createElement("div");
  content.style.height = "3000px";
  content.textContent = "Tall content";
  document.body.append(content);
}
`;

/** The files of a layout probe named `name` in the folder `name/`. */
export function buildLayoutProbeFiles(
  name: string,
  extraLines: string[] = [],
  code: string = LAYOUT_PROBE_MOD_CODE,
): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, extraLines),
    [`${name}/main.js`]: code,
  };
  return files;
}

export function theaterButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "Theater mode" });
}

export function fullscreenButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "Fullscreen" });
}

/** Presses the theater mode button and waits until it shows `isOn`. */
export async function pressTheaterMode(
  page: Page,
  isOn: boolean,
): Promise<void> {
  await theaterButton(page).click();
  await expect(theaterButton(page)).toHaveAttribute(
    "aria-pressed",
    String(isOn),
  );
}

function storeTheaterChoice(stored: { key: string; text: string }): void {
  localStorage.setItem(stored.key, stored.text);
}

/** Stores `text` as the theater choice before the app's page loads, as an earlier visit would. */
export async function storeTheaterBeforeLoad(
  page: Page,
  text: string,
): Promise<void> {
  await page.addInitScript(storeTheaterChoice, {
    key: THEATER_MODE_KEY,
    text,
  });
}

/** Runs in a page or a frame: the `data-ot-layout` of `<html>`. */
export function readLayoutAttribute(): string | undefined {
  return document.documentElement.dataset.otLayout;
}

/** Waits until a frame's layout attribute is `layout`. */
export async function waitForFrameLayout(
  frame: Frame,
  layout: string,
): Promise<void> {
  await expect
    .poll(frame.evaluate.bind(frame, readLayoutAttribute))
    .toBe(layout);
}

interface RecordedLayout {
  layout: string;
  attribute: string | undefined;
}

interface LayoutProbeGlobal {
  probe?: {
    attributeAtMount?: string;
    layoutEvents: RecordedLayout[];
    context: Record<string, unknown>;
  };
}

/** Runs in a layout probe frame: the attribute it saw in `mount`. */
export function readLayoutAtMount(): string | undefined {
  return (globalThis as LayoutProbeGlobal).probe?.attributeAtMount;
}

/** Runs in a layout probe frame: each `layout.changed` it received. */
export function readLayoutEvents(): RecordedLayout[] {
  return (globalThis as LayoutProbeGlobal).probe?.layoutEvents ?? [];
}

/** Runs in a probe frame: the `layout` of its mount context. */
export function readContextLayout(): unknown {
  return (globalThis as LayoutProbeGlobal).probe?.context.layout;
}

/** Runs in the app's page: the width of `--ot-content-width`, measured on a probe element. */
export function measureContentWidth(): number {
  const probe = document.createElement("div");
  probe.style.width = "var(--ot-content-width)";
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/** Where a frame's `<body>` sits in the frame, in pixels. */
export interface BodyBox {
  bodyWidth: number;
  /** The frame's inner width: its viewport without the scrollbar. */
  frameWidth: number;
  leftSpace: number;
  rightSpace: number;
}

/** Runs in a frame: where its `<body>` sits. */
export function readBodyBox(): BodyBox {
  const bodyBox = document.body.getBoundingClientRect();
  const frameWidth = document.documentElement.clientWidth;
  const box: BodyBox = {
    bodyWidth: bodyBox.width,
    frameWidth,
    leftSpace: bodyBox.left,
    rightSpace: frameWidth - bodyBox.right,
  };
  return box;
}

/** Runs in a frame: how far its document is scrolled down. */
export function readScrollTop(): number {
  return document.scrollingElement?.scrollTop ?? 0;
}

/** Runs in the app's page: whether `document.fullscreenElement` is the frame titled `title`. */
export function isFrameFullscreen(title: string): boolean {
  const frame = document.querySelector(`iframe[title="${title}"]`);
  return frame !== null && document.fullscreenElement === frame;
}

/** Runs in the app's page: whether an element of the page is fullscreen. */
export function readFullscreenElementTag(): string | null {
  return document.fullscreenElement?.tagName ?? null;
}

/** Runs on an element: its computed border width and corner radius. */
export function readFrameEdge(element: Element): {
  borderWidth: string;
  borderRadius: string;
} {
  const style = getComputedStyle(element);
  const edge = {
    borderWidth: style.borderTopWidth,
    borderRadius: style.borderTopLeftRadius,
  };
  return edge;
}

/** How many times `sizeModFrame` resizes the viewport before it gives up. */
const FRAME_SIZING_ATTEMPTS = 4;

/** Runs in the page: resolves after two animation frames, once a resize has been laid out. */
function waitForLayout(): Promise<void> {
  return new Promise<void>(function waitTwoFrames(resolve): void {
    requestAnimationFrame(function waitSecondFrame(): void {
      requestAnimationFrame(function resolveLaidOut(): void {
        resolve();
      });
    });
  });
}

/** The width of the mod frame titled `frameTitle`, in CSS pixels. */
async function readFrameWidth(page: Page, frameTitle: string): Promise<number> {
  const box = await page.locator(`iframe[title="${frameTitle}"]`).boundingBox();
  if (box === null) {
    throw new Error(`The mod frame "${frameTitle}" is not shown.`);
  }
  return box.width;
}

/**
 * Resizes the viewport until the mod frame titled `frameTitle` is `width`
 * pixels wide. The frame's inset is measured, never assumed, so the size
 * holds whatever the shell's sidebar, padding and gaps are. It retries
 * because the inset itself changes when a resize crosses a breakpoint, such
 * as the one that collapses the sidebar. Keeps the viewport's height.
 */
export async function sizeModFrame(
  page: Page,
  frameTitle: string,
  width: number,
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  let viewportWidth = viewport.width;
  let frameWidth = await readFrameWidth(page, frameTitle);
  for (let attempt = 0; attempt < FRAME_SIZING_ATTEMPTS; attempt++) {
    if (frameWidth === width) {
      return;
    }
    viewportWidth += width - frameWidth;
    await page.setViewportSize({
      width: viewportWidth,
      height: viewport.height,
    });
    await page.evaluate(waitForLayout);
    frameWidth = await readFrameWidth(page, frameTitle);
  }
  if (frameWidth !== width) {
    throw new Error(
      `The mod frame "${frameTitle}" is ${frameWidth}px wide, not ${width}px, after ${FRAME_SIZING_ATTEMPTS} resizes of the viewport (last ${viewportWidth}px).`,
    );
  }
}

/** Where an element sits in its document's viewport, in CSS pixels. */
export interface ElementBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** Runs on an element: where it sits in its document's viewport. */
export function readElementBox(element: Element): ElementBox {
  const rect = element.getBoundingClientRect();
  const box: ElementBox = {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
  return box;
}

/**
 * Runs on an element: how many lines its content takes, counted by the
 * distinct tops of the boxes its text is laid out in. Self-contained, since
 * it runs in a frame.
 */
export function countLines(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  const lineTops = new Set<number>();
  for (const rect of range.getClientRects()) {
    if (rect.width > 0) {
      lineTops.add(Math.round(rect.top));
    }
  }
  return lineTops.size;
}

/** Runs in a frame: the width of its document's viewport, without a scrollbar. */
export function readDocumentWidth(): number {
  return document.documentElement.clientWidth;
}

/**
 * Runs on an element: true when its content is fully shown, neither cut by
 * its own box nor past its document's viewport sideways.
 */
export function isFullyShown(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const fitsItself =
    element.scrollWidth <= element.clientWidth &&
    element.scrollHeight <= element.clientHeight;
  const fitsDocument =
    rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
  return fitsItself && fitsDocument;
}

/**
 * Runs on an element: how much wider it is than its text plus its own
 * horizontal padding and borders, in CSS pixels. About 0 for a box that is
 * as wide as its text. Self-contained, since it runs in a frame.
 */
export function readExtraWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  const style = getComputedStyle(element);
  const frameWidth =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth);
  const extra =
    element.getBoundingClientRect().width -
    range.getBoundingClientRect().width -
    frameWidth;
  return extra;
}
