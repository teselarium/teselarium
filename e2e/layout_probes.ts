import { expect } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import { buildModConf, stageBar } from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";

/** Kept in step with `THEATER_MODE_KEY` in `src/main/stage/theater_setting.ts`. */
export const THEATER_MODE_KEY = "opentesela.theater-mode";

/** The viewport where the stage area is wider than `--ot-content-width`. */
export const WIDE_VIEWPORT = { width: 2560, height: 1080 };

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
  heading.textContent = "Probe " + context.mod.name;
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

/**
 * Runs in the app's page before it loads: writing the theater choice fails,
 * as with a full or blocked storage. Other keys are written as usual.
 */
export function refuseTheaterWrites(key: string): void {
  const writeItem = Storage.prototype.setItem;
  function refuseTheaterKey(
    this: Storage,
    itemKey: string,
    value: string,
  ): void {
    if (itemKey === key) {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError",
      );
    }
    writeItem.call(this, itemKey, value);
  }
  Storage.prototype.setItem = refuseTheaterKey;
}

/** Runs in the app's page before it loads: every request for a frame's fullscreen is refused. */
export function refuseFrameFullscreen(): void {
  function refuseFullscreen(): Promise<void> {
    return Promise.reject(new TypeError("Fullscreen is blocked by the test"));
  }
  HTMLIFrameElement.prototype.requestFullscreen = refuseFullscreen;
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
