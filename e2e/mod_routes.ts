import { readFileSync } from "node:fs";
import type { Frame, Locator, Page, Route } from "@playwright/test";
import { SAMPLE_ENTRYPOINT_GLOB } from "./sample_mod.ts";

/** The code of the default mod explorer, to serve a copy with another config. */
export const EXPLORER_CODE = readFileSync(
  new URL("../public/default_mods/mod_explorer/main.js", import.meta.url),
  "utf8",
);

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
  if (path.endsWith(".svg")) {
    return "image/svg+xml";
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

/**
 * `^0.1.0`: the `api` range the test mods declare unless a test asks for
 * another one, so they match the mod API version and get no missing-range
 * warning. A breaking bump of the mod API updates it with the shipped mods.
 */
export const TEST_MOD_API_RANGE = "^0.1.0";

/** `0.1.0`: the app's mod API version, as mods read it in `context.api.version`. */
export const APP_MOD_API_VERSION = "0.1.0";

/** `^0.2.0`: an `api` range for a later mod API, which the app's version does not match. */
export const OTHER_API_RANGE = "^0.2.0";

/**
 * The text of a `mod_conf.yaml` with the given name and extra lines under
 * `mod`. Its first line under `mod` declares `apiRange`, unless it is `null`.
 */
export function buildModConf(
  name: string,
  extraLines: string[] = [],
  apiRange: string | null = TEST_MOD_API_RANGE,
): string {
  const lines = ["mod:"];
  if (apiRange !== null) {
    lines.push(`  api: "${apiRange}"`);
  }
  lines.push(
    `  name: "${name}"`,
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    ...extraLines,
  );
  const modConf = lines.join("\n");
  return modConf;
}

/**
 * The files of a probe mod named `name` in the folder `name/`, with the given
 * extra mod lines, declaring `apiRange` unless it is `null`.
 */
export function buildProbeFiles(
  name: string,
  extraLines: string[] = [],
  apiRange: string | null = TEST_MOD_API_RANGE,
): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, extraLines, apiRange),
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

/**
 * Runs in a mod frame: true when `window.open` was blocked. Chromium and
 * WebKit return `null`; Firefox throws in a sandboxed frame.
 */
export function isPopupBlocked(url: string): boolean {
  try {
    return window.open(url) === null;
  } catch {
    return true;
  }
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

/** The line that starts the sample mod's `mount`. */
const SAMPLE_MOUNT_LINE =
  "export default async function mount(engine, context) {";

async function answerExposedSample(route: Route): Promise<void> {
  const response = await route.fetch();
  const code = await response.text();
  if (!code.includes(SAMPLE_MOUNT_LINE)) {
    throw new Error("The sample mod's mount line changed");
  }
  await route.fulfill({
    response,
    body: code.replace(
      SAMPLE_MOUNT_LINE,
      `${SAMPLE_MOUNT_LINE}\n  globalThis.probe = { engine, context };`,
    ),
  });
}

/**
 * Serves the sample book list mod with one more line at the start of its
 * `mount`, which stores its engine API object on `globalThis.probe`, so a
 * test can send requests as the sample mod.
 */
export async function exposeSampleEngine(page: Page): Promise<void> {
  await page.route(SAMPLE_ENTRYPOINT_GLOB, answerExposedSample);
}

/** The app's action dialog, while it is open. */
export function actionDialog(page: Page): Locator {
  return page.getByRole("dialog");
}

/**
 * Runs in a probe frame: sends requests in order without waiting for their
 * answers, which `readProbeAnswers` waits for. For requests that wait for the
 * user.
 */
export function startProbeRequests(requests: (string | object)[][]): void {
  const probeGlobal = globalThis as unknown as ProbeGlobal & {
    answers?: Promise<ProbeAnswer>[];
  };
  function toResult(result: unknown): ProbeAnswer {
    return { result };
  }
  function toFailure(error: ProbeError): ProbeAnswer {
    return { code: error.code, message: error.message };
  }
  probeGlobal.answers = [];
  for (const request of requests) {
    const [method, params] = request as [string, object];
    probeGlobal.answers.push(
      probeGlobal.probe.engine
        .request(method, params)
        .then(toResult, toFailure),
    );
  }
}

/** Runs in a probe frame: the answers of the requests `startProbeRequests` sent, once all arrived. */
export function readProbeAnswers(): Promise<ProbeAnswer[]> {
  const probeGlobal = globalThis as unknown as {
    answers?: Promise<ProbeAnswer>[];
  };
  return Promise.all(probeGlobal.answers ?? []);
}

/** Runs in a probe frame: whether any request `startProbeRequests` sent got an answer. */
export async function hasProbeAnswer(): Promise<boolean> {
  const probeGlobal = globalThis as unknown as {
    answers?: Promise<ProbeAnswer>[];
  };
  const pending = Symbol("pending");
  for (const answer of probeGlobal.answers ?? []) {
    const settled = await Promise.race([answer, Promise.resolve(pending)]);
    if (settled !== pending) {
      return true;
    }
  }
  return false;
}

/**
 * Runs in a mod frame: adds a "Fullscreen" button whose click shows the
 * frame's `<body>` fullscreen, and keeps the outcome on `globalThis`.
 */
export function addFullscreenButton(): void {
  const probeGlobal = globalThis as { fullscreen?: Promise<string> };
  function describeFailure(error: unknown): string {
    return String(error);
  }
  function requestBodyFullscreen(): void {
    probeGlobal.fullscreen = document.body
      .requestFullscreen()
      .then(readFullscreenElement, describeFailure);
  }
  function readFullscreenElement(): string {
    return document.fullscreenElement?.tagName ?? "none";
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Fullscreen";
  button.addEventListener("click", requestBodyFullscreen);
  document.body.append(button);
}

/** Runs in a mod frame: the fullscreen element's tag once the request settled, or the error. */
export function readFullscreenOutcome(): Promise<string> {
  const probeGlobal = globalThis as { fullscreen?: Promise<string> };
  return probeGlobal.fullscreen ?? Promise.resolve("not requested");
}

/** Runs in the app page: whether an element of the page is fullscreen. */
export function isPageFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** A 1×1 SVG, served as an asset next to a test mod. */
export const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

/** What `showAssetNextToMod` found: the image's address, and whether it loaded. */
export interface ShownAsset {
  url: string;
  loaded: boolean;
}

/** Runs in a probe frame: shows the image at `path` resolved against `context.mod.source`. */
export async function showAssetNextToMod(path: string): Promise<ShownAsset> {
  const probe = (globalThis as unknown as ProbeGlobal).probe;
  const mod = probe.context.mod as { source: string };
  const url = new URL(path, mod.source).href;
  const image = document.createElement("img");
  image.src = url;
  document.body.append(image);
  try {
    await image.decode();
    return { url, loaded: true };
  } catch {
    return { url, loaded: false };
  }
}
