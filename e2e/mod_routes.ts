import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import type {
  Frame,
  FrameLocator,
  Locator,
  Page,
  Route,
} from "@playwright/test";
import {
  SAMPLE_COLLECTION_PATH,
  SAMPLE_ENTRYPOINT_CODE,
  SAMPLE_ENTRYPOINT_GLOB,
  SAMPLE_TYPE_PATH,
} from "./sample_mod.ts";

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

async function answerImage(seenUrls: string[], route: Route): Promise<void> {
  seenUrls.push(route.request().url());
  await route.fulfill({
    status: 200,
    contentType: "image/png",
    body: PIXEL_PNG,
  });
}

/** Answers every request under `pattern` with a 1×1 PNG. Returns the list of URLs the route saw. */
export async function routeImages(
  page: Page,
  pattern: string,
): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(pattern, answerImage.bind(undefined, seenUrls));
  return seenUrls;
}

/** Answers every cover request with a 1×1 PNG. Returns the list of URLs the route saw. */
export async function routeCovers(page: Page): Promise<string[]> {
  const seenUrls = await routeImages(page, `${COVER_HOST}/**`);
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
 * Serves inline mod files under `host`, `https://mods.example.net` unless
 * given, with CORS, like a foreign mod host. The files are read at each
 * request, so a test can change them. Returns the list of URLs the route saw.
 */
export async function serveForeignMod(
  page: Page,
  files: ModFiles,
  host: string = FOREIGN_HOST,
): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(
    `${host}/**`,
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

/** Records every URL a route under `pattern` sees, answering with a 1×1 response and CORS. */
export async function recordHost(
  page: Page,
  pattern: string,
): Promise<string[]> {
  const seenUrls: string[] = [];
  await page.route(pattern, answerRecorded.bind(undefined, seenUrls));
  return seenUrls;
}

async function answerRecorded(seenUrls: string[], route: Route): Promise<void> {
  seenUrls.push(route.request().url());
  await route.fulfill({
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: "{}",
  });
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

/** The host that serves the linked collection of `serveLinkedTiles`. */
export const TILES_HOST = "https://tiles.example.net";

/** The host of the media the linked tiles link. */
export const MEDIA_HOST = "https://media.example.net";

export const LINKED_COLLECTION_URL = `${TILES_HOST}/linked.yaml`;
export const LINKED_TILE_URL = `${TILES_HOST}/books/kallocain.md`;
export const LINKED_COVER_URL = `${MEDIA_HOST}/covers/kallocain.jpg`;

/** The `collection` parameter of a run link that opens the linked collection. */
export const LINKED_COLLECTION_PARAM = `&collection=${encodeURIComponent(LINKED_COLLECTION_URL)}`;

/** The run link of the probe on the app's origin, opened with the linked collection. */
export const LINKED_APP_PROBE_LINK = `/#/run?mod=.${APP_ORIGIN_MOD_PATH}probe/${LINKED_COLLECTION_PARAM}`;

/** The tile the linked collection serves. Tests change its metadata before "Reload tiles". */
export interface LinkedTile {
  metadataLines: string[];
}

async function answerLinkedTiles(
  linkedTile: LinkedTile,
  route: Route,
): Promise<void> {
  const url = route.request().url();
  const body =
    url === LINKED_COLLECTION_URL
      ? [
          "collection:",
          '  name: "Linked tiles"',
          "  tiles:",
          `    - url: "${LINKED_TILE_URL}"`,
        ].join("\n")
      : `---\ntitle: "Kallocain"\n${linkedTile.metadataLines.join("\n")}\n---\n\nA linked tile.\n`;
  await route.fulfill({
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body,
  });
}

/**
 * Serves a collection at `LINKED_COLLECTION_URL` whose one tile, at
 * `LINKED_TILE_URL`, has the given metadata lines. Returns the tile, whose
 * lines a test can change before "Reload tiles".
 */
export async function serveLinkedTiles(
  page: Page,
  metadataLines: string[],
): Promise<LinkedTile> {
  const linkedTile: LinkedTile = { metadataLines };
  await page.route(
    `${TILES_HOST}/**`,
    answerLinkedTiles.bind(undefined, linkedTile),
  );
  return linkedTile;
}

/**
 * `^0.1.0`: the `api` range the test mods declare unless a test asks for
 * another one, so they match the mod API version and get no missing-range
 * warning. A breaking bump of the mod API updates it with the shipped mods.
 */
export const TEST_MOD_API_RANGE = "^0.1.0";

/** `0.1.5`: the app's mod API version, as mods read it in `context.api.version`. */
export const APP_MOD_API_VERSION = "0.1.5";

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

/**
 * The row of the sample mod's `show` permission for `COVER_HOST` in the mod
 * viewer's permission table. The sample's `show` permissions share one reason,
 * so the row is found by its host.
 */
export function coverPermissionRow(viewer: Frame | FrameLocator): Locator {
  return viewer.getByRole("row").filter({ hasText: COVER_HOST });
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

/** The label of the site consent dialog's Remember checkbox. */
export const REMEMBER_LABEL = "Remember my answer for this mod";

/** The app's site consent dialog, while it is open. */
export function siteConsentDialog(page: Page): Locator {
  return page.getByRole("dialog");
}

/** What to change in the site consent dialog before answering. */
export interface SiteConsentChoice {
  /** The lines to uncheck, by their text, such as `exchange data with https://api.example.net`. */
  unchecked?: string[];
  remember?: boolean;
}

/**
 * Clicks a checkbox or a switch whose `aria-checked` is not yet `isChecked`,
 * mixed included, as a user does, and waits until it is.
 */
export async function clickCheckedTo(
  toggle: Locator,
  isChecked: boolean,
): Promise<void> {
  await expect(toggle).not.toHaveAttribute("aria-checked", String(isChecked));
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(isChecked));
}

/**
 * Answers the site consent dialog with `button`, after unchecking the lines
 * and checking Remember as `choice` says, as a user clicks them, and waits
 * until it closed.
 */
export async function answerSiteConsent(
  page: Page,
  button: "Allow" | "Show without them",
  choice: SiteConsentChoice = {},
): Promise<void> {
  const dialog = siteConsentDialog(page);
  for (const line of choice.unchecked ?? []) {
    await clickCheckedTo(dialog.getByRole("checkbox", { name: line }), false);
  }
  if (choice.remember === true) {
    await clickCheckedTo(
      dialog.getByRole("checkbox", { name: REMEMBER_LABEL }),
      true,
    );
  }
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toHaveCount(0);
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

/** `#/run?mod=./test-mods/checker/`: a probe mod on the app's origin with `open` for `"*"`, which checks mods. */
export const CHECKER_HASH = `#/run?mod=.${APP_ORIGIN_MOD_PATH}checker/`;
export const CHECKER_TITLE = "Checker";

/** The files of the checker probe mod. */
export function buildCheckerFiles(): ModFiles {
  return buildProbeFiles("checker", [
    `  title: "${CHECKER_TITLE}"`,
    "  permissions:",
    "    open:",
    '      - host: "*"',
    '        reason: "Checks the mods of the tests"',
  ]);
}

/** `beacon`: the path under `/test-mods/` where checked test mods report a value as the query of an image request. */
const CHECK_BEACON_NAME = "beacon";

/**
 * Mod code: shows an image whose address carries `name` and `value`, on the
 * app's origin, so a test reads what a checked mod saw from the URLs
 * `serveAppOriginMod` returns, even after the check frame was removed.
 */
const REPORT_TO_TEST_CODE = `function reportToTest(context, name, value) {
  const image = document.createElement("img");
  const query = name + "=" + encodeURIComponent(JSON.stringify(value));
  image.src = new URL("${APP_ORIGIN_MOD_PATH}${CHECK_BEACON_NAME}?" + query, context.mod.source).href;
  document.body.append(image);
}
`;

/** The code of a test mod whose `mount` runs `mountLines`, with `reportToTest` at hand. */
function buildMountCode(mountLines: string[]): string {
  const code = [
    REPORT_TO_TEST_CODE,
    "export default async function mount(engine, context) {",
    ...mountLines,
    "}",
    "",
  ].join("\n");
  return code;
}

/** The files of a test mod in the folder `name/`, whose `mount` runs `mountLines`. */
function buildCheckedModFiles(
  name: string,
  mountLines: string[],
  extraLines: string[] = [],
): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, extraLines),
    [`${name}/main.js`]: buildMountCode(mountLines),
  };
  return files;
}

/** The value a checked mod reported with `reportToTest(context, name, value)`, or `undefined` before it did. */
export function readReportedValue(seenUrls: string[], name: string): unknown {
  for (const seenUrl of seenUrls) {
    const url = new URL(seenUrl);
    const value = url.searchParams.get(name);
    if (url.pathname.endsWith(`/${CHECK_BEACON_NAME}`) && value !== null) {
      return JSON.parse(value);
    }
  }
  return undefined;
}

/** `./test-mods/<name>/`: a test mod served by `serveAppOriginMod`, as `mods.check` names it. */
export function buildTestModReference(name: string): string {
  return `.${APP_ORIGIN_MOD_PATH}${name}/`;
}

/** A mod whose entrypoint answers `404 Not Found`: its folder has no `main.js`. */
export function buildMissingEntrypointFiles(): ModFiles {
  const files: ModFiles = {
    "missing_code/mod_conf.yaml": buildModConf("missing_code"),
  };
  return files;
}

/** A mod whose tile type answers `404 Not Found`. Its code would report `"ran"`. */
export function buildMissingTypeFiles(): ModFiles {
  return buildCheckedModFiles(
    "missing_type",
    ['  reportToTest(context, "ran", true);'],
    ['  type_path: "./missing_type.md"'],
  );
}

/** A mod whose `mount` throws `new Error("map failed")`. */
export function buildThrowingFiles(): ModFiles {
  return buildCheckedModFiles("throwing", ['  throw new Error("map failed");']);
}

/** A mod whose `mount` reports `started`, then returns a promise that never settles. */
export function buildNeverMountedFiles(): ModFiles {
  return buildCheckedModFiles("never_mounted", [
    `  reportToTest(context, "${STARTED_REPORT_NAME}", true);`,
    "  return new Promise(function waitForever() {});",
  ]);
}

/** A mod whose `mount` sends `tiles.delete`, which the engine does not know. */
export function buildUnknownMethodFiles(): ModFiles {
  return buildCheckedModFiles("unknown_method", [
    '  await engine.request("tiles.delete").catch(function ignoreError() {});',
  ]);
}

/** A mod whose `mount` sends `ui.confirm` and reports the answer as `confirmed`. */
export function buildConfirmingFiles(): ModFiles {
  return buildCheckedModFiles("confirming", [
    '  const confirmed = await engine.request("ui.confirm", { message: "Delete this list?" });',
    '  reportToTest(context, "confirmed", confirmed);',
  ]);
}

/** The host a test mod requests an image from without declaring it. */
export const UNDECLARED_IMAGE_HOST = "https://images.example.net";

/** A mod whose `mount` shows an image from `UNDECLARED_IMAGE_HOST`, which its policy blocks. */
export function buildUndeclaredImageFiles(): ModFiles {
  return buildCheckedModFiles("undeclared_image", [
    '  const image = document.createElement("img");',
    `  image.src = "${UNDECLARED_IMAGE_HOST}/cover.png";`,
    "  document.body.append(image);",
    "  await image.decode().catch(function ignoreError() {});",
  ]);
}

/** A mod whose `mount` awaits an animation frame, as a mod that measures its layout does. */
export function buildAnimationFrameFiles(): ModFiles {
  return buildCheckedModFiles("animation_frame", [
    "  await new Promise(function waitForFrame(resolve) {",
    "    requestAnimationFrame(resolve);",
    "  });",
  ]);
}

/** How long the `mount` of `buildSlowMountFiles` takes. */
export const SLOW_MOUNT_MS = 3000;

/** A mod whose `mount` takes `SLOW_MOUNT_MS`. */
export function buildSlowMountFiles(): ModFiles {
  return buildCheckedModFiles("slow_mount", [
    "  await new Promise(function waitForTimer(resolve) {",
    `    setTimeout(resolve, ${SLOW_MOUNT_MS});`,
    "  });",
  ]);
}

async function answerSelectionReportingSample(route: Route): Promise<void> {
  const response = await route.fetch();
  const code = await response.text();
  if (!code.includes(SAMPLE_MOUNT_LINE)) {
    throw new Error("The sample mod's mount line changed");
  }
  const reportingLines = [
    SAMPLE_MOUNT_LINE,
    '  const checkedSelection = await engine.request("storage.get", { key: "selected" });',
    '  reportToTest(context, "selected", checkedSelection);',
  ].join("\n");
  await route.fulfill({
    response,
    body: `${REPORT_TO_TEST_CODE}\n${code.replace(SAMPLE_MOUNT_LINE, reportingLines)}`,
  });
}

/**
 * Serves the sample book list mod with a `mount` that first reads
 * `storage.get` for `selected` and reports it as `selected`. Until
 * `page.unroute(SAMPLE_ENTRYPOINT_GLOB)`.
 */
export async function serveSelectionReportingSample(page: Page): Promise<void> {
  await page.route(SAMPLE_ENTRYPOINT_GLOB, answerSelectionReportingSample);
}

export interface CheckFinding {
  step: string;
  level: string;
  source: string;
  message: string;
}

export interface CheckTestResult {
  name: string;
  status: string;
  message: string | null;
}

export interface CheckReport {
  source: string;
  status: string;
  mountChecked: boolean;
  testsChecked: boolean;
  tests: CheckTestResult[];
  findings: CheckFinding[];
}

/** Every frame of a running check: hidden frames outside the sandboxes. */
export const CHECK_FRAME_SELECTOR = "iframe[data-check-id]";

/** Serves the checker and `files` on the app's origin, and opens the checker. Returns the URLs the route saw. */
export async function openChecker(
  page: Page,
  files: ModFiles,
): Promise<string[]> {
  await routeCovers(page);
  const seenUrls = await serveAppOriginMod(page, {
    ...buildCheckerFiles(),
    ...files,
  });
  await page.goto(`/${CHECKER_HASH}`);
  await waitForProbe(await findModFrame(page, CHECKER_TITLE));
  return seenUrls;
}

/** Sends `mods.check` from the checker and returns the report. */
export async function checkFromChecker(
  page: Page,
  mod: string,
): Promise<CheckReport> {
  const checkerFrame = await findModFrame(page, CHECKER_TITLE);
  const answer: ProbeAnswer = await checkerFrame.evaluate(requestFromProbe, [
    "mods.check",
    { mod },
  ]);
  if (answer.result === undefined) {
    throw new Error(
      `Expected a report for "${mod}", got error ${answer.code}: ${answer.message}`,
    );
  }
  return answer.result as CheckReport;
}

/** The time limit of a check's mount and of each test case (`CHECK_MOUNT_LIMIT_MS`, `CHECK_CASE_LIMIT_MS`). */
export const CHECK_LIMIT_MS = 10000;

/** The name a checked mount or test case reports with `started` once it runs, which is after its limit timer started. */
export const STARTED_REPORT_NAME = "started";

/** A report of `checkPastLimit`, and how much time the page's clock saw pass. */
export interface CheckPastLimit {
  report: CheckReport;
  elapsedMs: number;
}

function readPageTime(): number {
  return Date.now();
}

/**
 * Sends `mods.check` like `checkFromChecker` for a mod that never finishes
 * its mount or a test case, waits until it reported `started`, then moves the
 * page's clock past the limit, so the test does not wait the real 10 seconds.
 * The page must have been opened after `page.clock.install()`. `seenUrls` are
 * the URLs `openChecker` returned.
 */
export async function checkPastLimit(
  page: Page,
  mod: string,
  seenUrls: string[],
): Promise<CheckPastLimit> {
  const startedAt = await page.evaluate(readPageTime);
  const reportPromise = checkFromChecker(page, mod);
  await expect
    .poll(readReportedValue.bind(undefined, seenUrls, STARTED_REPORT_NAME))
    .toBe(true);
  await page.clock.fastForward(CHECK_LIMIT_MS);
  const report = await reportPromise;
  const pastLimit: CheckPastLimit = {
    report,
    elapsedMs: (await page.evaluate(readPageTime)) - startedAt,
  };
  return pastLimit;
}

/** The source of the test mod in `folder/`,served by `serveAppOriginMod` on the page's origin. */
export function readTestModSource(page: Page, folder: string): string {
  const source = new URL(
    `${APP_ORIGIN_MOD_PATH}${folder}/mod_conf.yaml`,
    page.url(),
  ).href;
  return source;
}

/** The address of the test file of the test mod in `folder/`. */
export function readTestFileSource(page: Page, folder: string): string {
  const source = new URL(`${APP_ORIGIN_MOD_PATH}${folder}/test.js`, page.url())
    .href;
  return source;
}

/** The mod file line of a test mod with tests: its test file is `test.js`, next to it. */
const TEST_PATH_LINE = '  test_path: "./test.js"';

/** Adds `test.js` with `testCode` to a test mod's files, or leaves it out (`404 Not Found`) for `null`. */
function addTestFile(
  files: ModFiles,
  name: string,
  testCode: string | null,
): ModFiles {
  if (testCode === null) {
    return files;
  }
  const testedFiles: ModFiles = { ...files, [`${name}/test.js`]: testCode };
  return testedFiles;
}

/**
 * The files of a probe mod named `name` with `test_path`, whose test file is
 * `testCode`, or answers `404 Not Found` for `null`. In a case, the mounted
 * probe keeps the recording engine API object on `globalThis.probe`.
 */
export function buildTestedProbeFiles(
  name: string,
  testCode: string | null,
): ModFiles {
  return addTestFile(buildProbeFiles(name, [TEST_PATH_LINE]), name, testCode);
}

/**
 * The files of a mod named `name` that runs the sample mod's entrypoint on
 * the sample's tile type and collection, with its config and its covers
 * permission, and `testCode` as its test file.
 */
export function buildSampleCaseFiles(name: string, testCode: string): ModFiles {
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, [
      `  title: "Book List"`,
      `  type_path: "${SAMPLE_TYPE_PATH}"`,
      `  sample_collection: "${SAMPLE_COLLECTION_PATH}"`,
      TEST_PATH_LINE,
      "  config:",
      "    show_covers: true",
      "  permissions:",
      "    show:",
      `      - host: "${COVER_HOST}"`,
      '        reason: "Shows the book covers"',
    ]),
    [`${name}/main.js`]: SAMPLE_ENTRYPOINT_CODE,
    [`${name}/test.js`]: testCode,
  };
  return files;
}

/** The text of a test file whose default export registers `cases`: pairs of a case name and the name of a function of `functionLines`. */
export function buildTestCode(
  functionLines: string[],
  cases: [string, string][],
): string {
  const registrationLines: string[] = [];
  for (const [caseName, functionName] of cases) {
    registrationLines.push(
      `  t.test(${JSON.stringify(caseName)}, ${functionName});`,
    );
  }
  const testCode = [
    ...functionLines,
    "",
    "export default function registerTests(t) {",
    ...registrationLines,
    "}",
    "",
  ].join("\n");
  return testCode;
}

/** A test file with a syntax error. */
export const SYNTAX_ERROR_TEST_CODE =
  'export default function registerTests(t) {\n  t.test("lists books", function listsBooks() {}\n';

/** A test file that registers two cases named `lists books`. */
export const REPEATED_NAME_TEST_CODE = buildTestCode(
  ["function listsBooks() {}"],
  [
    ["lists books", "listsBooks"],
    ["lists books", "listsBooks"],
  ],
);

/** A test file whose default export registers no case. */
export const NO_CASE_TEST_CODE = "export default function registerTests() {}\n";

/** Three cases, where the second throws `new Error("no books")`. */
export const ONE_FAILING_TEST_CODE = buildTestCode(
  [
    "function passes() {}",
    "function throwsNoBooks() {",
    '  throw new Error("no books");',
    "}",
  ],
  [
    ["first", "passes"],
    ["second", "throwsNoBooks"],
    ["third", "passes"],
  ],
);

/** One case, `lists books`, that throws `new Error("no books")`. */
export const FAILING_CASE_TEST_CODE = buildTestCode(
  ["function listsBooks() {", '  throw new Error("no books");', "}"],
  [["lists books", "listsBooks"]],
);

/**
 * A case that reports `started`, then awaits a promise that never settles. A
 * case context has no mod source, so the beacon's address is relative: a
 * case frame resolves it against the app page.
 */
export const ENDLESS_TEST_CODE = buildTestCode(
  [
    "function waitForever() {",
    '  const image = document.createElement("img");',
    `  image.src = "${APP_ORIGIN_MOD_PATH}${CHECK_BEACON_NAME}?${STARTED_REPORT_NAME}=true";`,
    "  document.body.append(image);",
    "  return new Promise(function neverSettle() {});",
    "}",
  ],
  [["waits forever", "waitForever"]],
);

/** The case context on the sample mod: seeded storage, the request record, a config override, other tiles and mounting twice. */
export const SAMPLE_CONTEXT_TEST_CODE = buildTestCode(
  [
    "async function highlightsTheRememberedBook(context) {",
    '  await context.storage.set("selected", context.tiles[1].source);',
    "  await context.mount();",
    "  const pressed = context.root.querySelector('button[aria-pressed=\"true\"]');",
    '  context.expect(pressed.textContent).toContain("Kallocain");',
    "}",
    "",
    "function hasTwoSettledRequests(context) {",
    "  const requests = context.requests;",
    '  return requests.length === 2 && Object.hasOwn(requests[1], "result");',
    "}",
    "",
    "async function recordsTheRequests(context) {",
    "  await context.mount();",
    '  context.root.querySelector("button").click();',
    "  await context.waitFor(hasTwoSettledRequests.bind(undefined, context));",
    "  context.expect(context.requests).toEqual([",
    '    { method: "storage.get", params: { key: "selected" }, result: null },',
    "    {",
    '      method: "storage.set",',
    '      params: { key: "selected", value: context.tiles[0].source },',
    "      result: null,",
    "    },",
    "  ]);",
    "}",
    "",
    "async function hidesTheCovers(context) {",
    "  await context.mount({ config: { show_covers: false } });",
    '  context.expect(context.root.querySelectorAll("li").length).toBe(3);',
    '  context.expect(context.root.querySelectorAll("img").length).toBe(0);',
    "}",
    "",
    "async function showsTheCovers(context) {",
    "  await context.mount();",
    '  context.expect(context.root.querySelectorAll("img").length).toBe(3);',
    "}",
    "",
    "async function showsNoBooks(context) {",
    "  await context.mount({ tiles: [] });",
    "  const status = context.root.querySelector('[role=\"status\"]');",
    '  context.expect(status.textContent).toBe("There are no books to show.");',
    "}",
    "",
    "async function mountsTwice(context) {",
    "  await context.mount();",
    "  await context.mount();",
    "}",
  ],
  [
    ["highlights the remembered book", "highlightsTheRememberedBook"],
    ["records the requests", "recordsTheRequests"],
    ["hides the covers", "hidesTheCovers"],
    ["shows the covers", "showsTheCovers"],
    ["shows no books", "showsNoBooks"],
    ["mounts twice", "mountsTwice"],
  ],
);

/** The expectations and `waitFor` on the sample mod. */
export const EXPECTATION_TEST_CODE = buildTestCode(
  [
    "function expectsTwoToBeThree(context) {",
    "  context.expect(2).toBe(3);",
    "}",
    "",
    "function expectsNoThree(context) {",
    "  context.expect([1, 2]).not.toContain(3);",
    "}",
    "",
    "function hasThreeBooks(context) {",
    '  return context.root.querySelectorAll("li").length === 3;',
    "}",
    "",
    "async function waitsForTheList(context) {",
    "  await context.mount();",
    "  await context.waitFor(hasThreeBooks.bind(undefined, context));",
    "}",
    "",
    "function staysFalse() {",
    "  return false;",
    "}",
    "",
    "async function waitsTooLong(context) {",
    "  const startedAt = Date.now();",
    "  try {",
    "    await context.waitFor(staysFalse, 100);",
    "  } catch (error) {",
    "    throw new Error(`rejected after ${Date.now() - startedAt} ms: ${error.message}`);",
    "  }",
    "}",
  ],
  [
    ["fails equality", "expectsTwoToBeThree"],
    ["negates", "expectsNoThree"],
    ["waits for the list", "waitsForTheList"],
    ["waits too long", "waitsTooLong"],
  ],
);

/** Scripted answers through the probe, which keeps the recording engine API object. */
export const ANSWER_TEST_CODE = buildTestCode(
  [
    "function requestFromMod(method, params) {",
    "  return globalThis.probe.engine.request(method, params);",
    "}",
    "",
    "async function confirmsYes(context) {",
    "  await context.mount();",
    '  context.answer("ui.confirm", true);',
    '  const confirmed = await requestFromMod("ui.confirm", { message: "Delete this list?" });',
    "  context.expect(confirmed).toBe(true);",
    "}",
    "",
    "async function confirmsNoWithoutAnswer(context) {",
    "  await context.mount();",
    '  const confirmed = await requestFromMod("ui.confirm", { message: "Delete this list?" });',
    "  context.expect(confirmed).toBe(false);",
    "}",
    "",
    "async function opensNothing(context) {",
    "  await context.mount();",
    '  context.answer("links.open", true);',
    '  context.answer("files.save", false);',
    '  context.expect(await requestFromMod("links.open", { url: "https://example.org/" })).toBe(true);',
    '  context.expect(await requestFromMod("files.save", { name: "a.txt", content: "x" })).toBe(false);',
    "  context.expect(context.requests.length).toBe(2);",
    "}",
  ],
  [
    ["confirms yes", "confirmsYes"],
    ["confirms no without an answer", "confirmsNoWithoutAnswer"],
    ["opens nothing", "opensNothing"],
  ],
);

/** A case that scripts an answer of the wrong type. */
export const WRONG_ANSWER_TEST_CODE = buildTestCode(
  [
    "function answersWithText(context) {",
    '  context.answer("ui.confirm", "yes");',
    "}",
  ],
  [["answers with text", "answersWithText"]],
);

/** Two cases that change the storage and the page, and two that read them before mounting. */
export const ISOLATION_TEST_CODE = buildTestCode(
  [
    "async function changesStorageAndPage(context) {",
    "  await context.mount();",
    '  await context.storage.set("selected", "kallocain");',
    '  context.root.append(document.createElement("section"));',
    "}",
    "",
    "async function readsStorage(context) {",
    '  context.expect(await context.storage.get("selected")).toBe(null);',
    "}",
    "",
    "function readsPage(context) {",
    "  context.expect(context.root.children.length).toBe(0);",
    "}",
  ],
  [
    ["changes the storage and the page", "changesStorageAndPage"],
    ["reads the storage", "readsStorage"],
    ["reads the page", "readsPage"],
  ],
);

/**
 * The mount lines of a mod that runs `caseLines` only when a case mounts it
 * with `params.inCase` `"yes"`, so its mount check records nothing and its
 * tests run.
 */
function buildCaseOnlyLines(caseLines: string[]): string[] {
  const lines = [
    '  if (context.params.inCase !== "yes") {',
    "    return;",
    "  }",
    ...caseLines,
  ];
  return lines;
}

/** The lines of a case function named `functionName` that mounts the mod with `params.inCase` `"yes"`. */
function buildMountInCaseLines(functionName: string): string[] {
  const lines = [
    `async function ${functionName}(context) {`,
    '  await context.mount({ params: { inCase: "yes" } });',
    "}",
  ];
  return lines;
}

/** A case named `deletes a book` that mounts a mod sending `tiles.delete`. */
export function buildUnknownMethodCaseFiles(): ModFiles {
  return addTestFile(
    buildCheckedModFiles(
      "unknown_method_case",
      buildCaseOnlyLines([
        '  await engine.request("tiles.delete").catch(function ignoreError() {});',
      ]),
      [TEST_PATH_LINE],
    ),
    "unknown_method_case",
    buildTestCode(buildMountInCaseLines("deletesABook"), [
      ["deletes a book", "deletesABook"],
    ]),
  );
}

/** A case named `shows covers` that mounts a mod showing an image from `UNDECLARED_IMAGE_HOST`. */
export function buildUndeclaredImageCaseFiles(): ModFiles {
  return addTestFile(
    buildCheckedModFiles(
      "undeclared_image_case",
      buildCaseOnlyLines([
        '  const image = document.createElement("img");',
        `  image.src = "${UNDECLARED_IMAGE_HOST}/cover.png";`,
        "  document.body.append(image);",
        "  await image.decode().catch(function ignoreError() {});",
      ]),
      [TEST_PATH_LINE],
    ),
    "undeclared_image_case",
    buildTestCode(buildMountInCaseLines("showsCovers"), [
      ["shows covers", "showsCovers"],
    ]),
  );
}

/**
 * A case that expects `mount()` to reject, for a mod whose `mount` throws
 * `new Error("map failed")` when a case mounts it.
 */
export function buildExpectedFailureCaseFiles(): ModFiles {
  return addTestFile(
    buildCheckedModFiles(
      "expected_failure_case",
      buildCaseOnlyLines(['  throw new Error("map failed");']),
      [TEST_PATH_LINE],
    ),
    "expected_failure_case",
    buildTestCode(
      [
        "async function expectsMountFailure(context) {",
        "  try {",
        '    await context.mount({ params: { inCase: "yes" } });',
        "  } catch (error) {",
        '    context.expect(error.message).toBe("map failed");',
        "    return;",
        "  }",
        '  throw new Error("mount did not reject");',
        "}",
      ],
      [["expects a mount failure", "expectsMountFailure"]],
    ),
  );
}

/**
 * A probe test file whose case fails with the keys of `t`, of the case
 * context, of `expect(value)` and of `expect(value).not`, as JSON.
 */
export const KEYS_PROBE_TEST_CODE = [
  "let testKeys = [];",
  "",
  "function reportKeys(context) {",
  "  const expectation = context.expect(1);",
  "  const keys = {",
  "    t: testKeys,",
  "    context: Object.keys(context).sort(),",
  "    storage: Object.keys(context.storage).sort(),",
  "    expect: Object.keys(expectation).sort(),",
  "    not: Object.keys(expectation.not).sort(),",
  "  };",
  "  throw new Error(JSON.stringify(keys));",
  "}",
  "",
  "export default function registerTests(t) {",
  "  testKeys = Object.keys(t).sort();",
  '  t.test("reports the keys", reportKeys);',
  "}",
  "",
].join("\n");
