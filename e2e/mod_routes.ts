import type { Frame, Locator, Page, Route } from "@playwright/test";

/** The host of the sample book covers. Tests answer it locally, so no test needs the network. */
export const COVER_HOST = "https://upload.wikimedia.org";

/** A host that serves foreign mods: another origin than the app's. */
export const FOREIGN_HOST = "https://mods.example.net";

/** The folder under the preview origin where tests serve mods on the app's origin. */
export const APP_ORIGIN_MOD_PATH = "/test-mods/";

/** A 1×1 transparent PNG. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** A mod source that stores its engine API object and its context on `globalThis.probe`. */
export const PROBE_MOD_CODE = `export default function mount(engine, context) {
  globalThis.probe = { engine, context };
  const heading = document.createElement("h1");
  heading.textContent = "Probe " + context.mod.name;
  document.body.append(heading);
}
`;

/** Inline files of a test mod, keyed by their path under the mod host, e.g. `probe/mod_conf.yaml`. */
export type ModFiles = Record<string, string>;

function readContentType(path: string): string {
  if (path.endsWith(".js")) {
    return "text/javascript";
  }
  if (path.endsWith(".md")) {
    return "text/markdown";
  }
  return "text/yaml";
}

async function answerCover(seenUrls: string[], route: Route): Promise<void> {
  seenUrls.push(route.request().url());
  await route.fulfill({
    status: 200,
    contentType: "image/png",
    body: PIXEL_PNG,
  });
}

/** Answers every cover request with a 1×1 PNG. Returns the list of URLs the route saw. */
export async function routeCovers(page: Page): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(`${COVER_HOST}/**`, answerCover.bind(undefined, seenUrls));
  return seenUrls;
}

async function answerModFile(
  files: ModFiles,
  pathPrefix: string,
  headers: Record<string, string>,
  seenUrls: string[],
  route: Route,
): Promise<void> {
  const url = new URL(route.request().url());
  seenUrls.push(url.href);
  const path = url.pathname.slice(pathPrefix.length);
  if (!Object.hasOwn(files, path)) {
    await route.fulfill({ status: 404, headers, body: "Not Found" });
    return;
  }
  await route.fulfill({
    status: 200,
    headers: { ...headers, "Content-Type": readContentType(path) },
    body: files[path],
  });
}

/**
 * Serves inline mod files under `https://mods.example.net/` with CORS, like a
 * foreign mod host. Returns the list of URLs the route saw.
 */
export async function serveForeignMod(
  page: Page,
  files: ModFiles,
): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(
    `${FOREIGN_HOST}/**`,
    answerModFile.bind(
      undefined,
      files,
      "/",
      { "Access-Control-Allow-Origin": "*" },
      seenUrls,
    ),
  );
  return seenUrls;
}

/** Serves inline mod files under `/test-mods/` on the preview origin. Returns the URLs the route saw. */
export async function serveAppOriginMod(
  page: Page,
  files: ModFiles,
): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(
    `**${APP_ORIGIN_MOD_PATH}**`,
    answerModFile.bind(undefined, files, APP_ORIGIN_MOD_PATH, {}, seenUrls),
  );
  return seenUrls;
}

/** The text of a `mod_conf.yaml` with the given name and extra lines under `mod`. */
export function buildModConf(name: string, extraLines: string[] = []): string {
  const modConf = [
    "mod:",
    `  name: "${name}"`,
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    ...extraLines,
  ].join("\n");
  return modConf;
}

/** The files of a probe mod named `name` in the folder `name/`, with the given extra mod lines. */
export function buildProbeFiles(
  name: string,
  extraLines: string[] = [],
): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, extraLines),
    [`${name}/main.js`]: PROBE_MOD_CODE,
  };
  return files;
}

/** The frame of the mod whose iframe has this title (the mod's title). */
export async function findModFrame(page: Page, title: string): Promise<Frame> {
  const frameElement = await page
    .locator(`iframe[title="${title}"]`)
    .elementHandle();
  const frame = await frameElement?.contentFrame();
  if (frame === undefined || frame === null) {
    throw new Error(`Expected a mod frame titled "${title}"`);
  }
  return frame;
}

function setFrameMarker(): void {
  (globalThis as { testMarker?: boolean }).testMarker = true;
}

function readFrameMarker(): boolean {
  return (globalThis as { testMarker?: boolean }).testMarker === true;
}

/** Marks a frame's global object, so a test can tell later that it was not reloaded. */
export async function markFrame(frame: Frame): Promise<void> {
  await frame.evaluate(setFrameMarker);
}

export async function isFrameMarked(frame: Frame): Promise<boolean> {
  return frame.evaluate(readFrameMarker);
}

/** Waits until the probe of a frame has mounted. */
export async function waitForProbe(frame: Frame): Promise<void> {
  await frame.waitForFunction(isProbeMounted);
}

function isProbeMounted(): boolean {
  return (globalThis as { probe?: unknown }).probe !== undefined;
}

/** The wrapper of the visible sandbox. */
export function visibleSandbox(page: Page): Locator {
  return page.locator("[data-sandbox-id]:not([hidden])");
}

export function stageBar(page: Page): Locator {
  return page.getByRole("region", { name: "Stage bar" });
}

export function issueList(page: Page): Locator {
  return stageBar(page).getByRole("list", { name: "Issues" });
}

/** The frame of the sandbox with this id. */
export async function findSandboxFrame(
  page: Page,
  sandboxId: string,
): Promise<Frame> {
  const frameElement = await page
    .locator(`[data-sandbox-id="${sandboxId}"] iframe`)
    .elementHandle();
  const frame = await frameElement?.contentFrame();
  if (frame === undefined || frame === null) {
    throw new Error(`Expected a frame in sandbox "${sandboxId}"`);
  }
  return frame;
}

/** The frame of the visible sandbox. */
export async function findVisibleFrame(page: Page): Promise<Frame> {
  const frameElement = await visibleSandbox(page)
    .locator("iframe")
    .elementHandle();
  const frame = await frameElement?.contentFrame();
  if (frame === undefined || frame === null) {
    throw new Error("Expected a frame in the visible sandbox");
  }
  return frame;
}

/** Follows a link in the page, as a user would: a new history entry with no state. */
export async function followLink(page: Page, hash: string): Promise<void> {
  await page.evaluate(setLocationHash, hash);
}

function setLocationHash(hash: string): void {
  location.hash = hash;
}

/** What `probe.engine.request` gave: the result, or the error's code and message. */
export interface ProbeAnswer {
  result?: unknown;
  code?: number;
  message?: string;
}

interface ProbeError {
  code?: number;
  message: string;
}

interface ProbeGlobal {
  probe: {
    engine: {
      request: (method: string, params?: object) => Promise<unknown>;
      on: (event: string, handler: (params: unknown) => void) => void;
    };
    context: Record<string, unknown>;
  };
  calls?: unknown[];
  windowMessages?: unknown[];
}

/** Runs in a probe frame: sends a request through the engine API object. */
export async function requestFromProbe(
  request: (string | object)[],
): Promise<ProbeAnswer> {
  const [method, params] = request as [string, object];
  const probe = (globalThis as unknown as ProbeGlobal).probe;
  try {
    const result = await probe.engine.request(method, params);
    const answer: ProbeAnswer = { result };
    return answer;
  } catch (error) {
    const probeError = error as ProbeError;
    const failure: ProbeAnswer = {
      code: probeError.code,
      message: probeError.message,
    };
    return failure;
  }
}

/** Runs in a probe frame: the mount context. */
export function readProbeContext(): Record<string, unknown> {
  return (globalThis as unknown as ProbeGlobal).probe.context;
}

/** Runs in a probe frame: two handlers for `tiles.changed`, recording `"first"` and `"second"` with the params. */
export function registerTwoTileHandlers(): void {
  const probeGlobal = globalThis as unknown as ProbeGlobal;
  probeGlobal.calls = [];
  const calls = probeGlobal.calls;
  probeGlobal.probe.engine.on(
    "tiles.changed",
    Array.prototype.push.bind(calls, "first"),
  );
  probeGlobal.probe.engine.on(
    "tiles.changed",
    Array.prototype.push.bind(calls, "second"),
  );
}

/** Runs in a probe frame: what the handlers recorded. */
export function readProbeCalls(): unknown[] {
  return (globalThis as unknown as ProbeGlobal).calls ?? [];
}

/** Runs in a mod frame: posts a request to the app's window instead of the channel, and keeps any answer. */
export function postRequestToParent(): void {
  const probeGlobal = globalThis as unknown as ProbeGlobal;
  probeGlobal.windowMessages = [];
  window.addEventListener(
    "message",
    Array.prototype.push.bind(probeGlobal.windowMessages),
  );
  parent.postMessage(
    {
      jsonrpc: "2.0",
      id: 99,
      method: "storage.set",
      params: { key: "selected", value: "from the window" },
    },
    "*",
  );
}

export function readWindowMessages(): unknown[] {
  return (globalThis as unknown as ProbeGlobal).windowMessages ?? [];
}

/** Runs in a mod frame: shows an image and tells whether it loaded. */
export async function showImage(url: string): Promise<boolean> {
  const image = document.createElement("img");
  image.src = url;
  document.body.append(image);
  try {
    await image.decode();
    return true;
  } catch {
    return false;
  }
}

/** Runs in a mod frame: `"sent"` when `fetch` reached a server, or the error's message. */
export async function fetchFromFrame(url: string): Promise<string> {
  try {
    await fetch(url);
    return "sent";
  } catch (error) {
    return String(error);
  }
}

/** Runs in a mod frame: `"imported"`, or the error's message. */
export async function importFromFrame(url: string): Promise<string> {
  try {
    await import(url);
    return "imported";
  } catch (error) {
    return String(error);
  }
}

/** Runs in a mod frame: embeds an `<object>`. */
export function embedObject(url: string): void {
  const object = document.createElement("object");
  object.data = url;
  document.body.append(object);
}

/** Runs in a mod frame: the name of the error reading `localStorage` throws, or `"no error"`. */
export function readStorageError(): string {
  try {
    return `no error: ${localStorage.length} items`;
  } catch (error) {
    return (error as Error).name;
  }
}

/** Runs in a mod frame: the name of the error reading `parent.document` throws, or `"no error"`. */
export function readParentDocumentError(): string {
  try {
    return `no error: ${parent.document.title}`;
  } catch (error) {
    return (error as Error).name;
  }
}

/** Runs in a mod frame: the name of the error setting `top.location.href` throws, or `"no error"`. */
export function navigateTop(url: string): string {
  try {
    if (top !== null) {
      top.location.href = url;
    }
    return "no error";
  } catch (error) {
    return (error as Error).name;
  }
}

/** Runs in a mod frame: true when `window.open` gave `null`. */
export function isPopupBlocked(url: string): boolean {
  return window.open(url) === null;
}

export function readFrameOrigin(): string {
  return self.origin;
}

/** Runs in the sample mod's frame: the alt text of each cover that loaded. */
export function readLoadedCovers(): string[] {
  const covers: string[] = [];
  for (const image of document.querySelectorAll("img")) {
    if (image.complete && image.naturalWidth > 0) {
      covers.push(image.alt);
    }
  }
  return covers;
}

/** Runs in a mod frame: navigates the frame to another page. */
export function navigateFrame(url: string): void {
  location.href = url;
}
