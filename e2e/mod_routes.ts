import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import type {
  Frame,
  FrameLocator,
  Locator,
  Page,
  Route,
} from "@playwright/test";
import { bundleDefaultMod } from "../build/default_mod_build.ts";

/** The built code of the default mod explorer (build/default_mod_build.ts), to serve a copy with another config. */
export const EXPLORER_CODE = await readExplorerCode();

async function readExplorerCode(): Promise<string> {
  const explorerFiles = await bundleDefaultMod(
    fileURLToPath(new URL("../default_mods/mod_explorer/", import.meta.url)),
  );
  for (const explorerFile of explorerFiles) {
    if (explorerFile.path === "main.js") {
      const explorerCode = new TextDecoder().decode(explorerFile.content);
      return explorerCode;
    }
  }
  throw new Error("The build of default_mods/mod_explorer/ has no main.js.");
}

/** The host of the images the tests' mods show, such as the tiles mod's (e2e/test_mods.ts). Tests answer it locally, so no test needs the network. */
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
  heading.textContent = "Probe " + context.mod.title;
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
          '  title: "Linked tiles"',
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

/** `0.1.16`: the app's mod API version, as mods read it in `context.api.version`. */
export const APP_MOD_API_VERSION = "0.1.16";

/** `^0.2.0`: an `api` range for a later mod API, which the app's version does not match. */
export const OTHER_API_RANGE = "^0.2.0";

/** Whether the extra lines of a mod file give their own `title`. */
function hasTitleLine(extraLines: string[]): boolean {
  for (const line of extraLines) {
    if (line.startsWith("  title:")) {
      return true;
    }
  }
  return false;
}

/**
 * The text of a `mod_conf.yaml` with the given extra lines under `mod`, and
 * `name` as its `title` unless the extra lines give one. Its first line
 * under `mod` declares `apiRange`, unless it is `null`.
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
  if (!hasTitleLine(extraLines)) {
    lines.push(`  title: "${name}"`);
  }
  lines.push('  version: "0.1.0"', '  entrypoint: "./main.js"', ...extraLines);
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

/** A level of the stage bar's messages, by its button's and popover's name. */
export type MessageLevelName = "Errors" | "Warnings" | "Notifications";

/** One item of a level's popover. */
export interface StageMessage {
  /** `App` or `Mod`. */
  producer: string;
  source: string;
  text: string;
}

/** The stage bar's button of a level, whose accessible name starts with the level. */
export function messageButton(page: Page, level: MessageLevelName): Locator {
  return stageBar(page).getByRole("button", {
    name: new RegExp(`^${level}: `),
  });
}

/** A level's popover, while it is open. */
export function messagePopover(page: Page, level: MessageLevelName): Locator {
  return page
    .locator("[data-slot=popover-content]")
    .filter({ has: page.getByRole("heading", { name: level, exact: true }) });
}

/** Opens a level's popover, unless it is open, and returns it. */
export async function openMessages(
  page: Page,
  level: MessageLevelName,
): Promise<Locator> {
  const popover = messagePopover(page, level);
  if (!(await popover.isVisible())) {
    await messageButton(page, level).click();
  }
  await expect(popover).toBeVisible();
  return popover;
}

function blurActiveElement(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/**
 * Closes the open popover with Escape, and takes the focus off its button,
 * so the button's tooltip does not stay open.
 */
export async function closeMessages(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
  await page.evaluate(blurActiveElement);
}

/**
 * Waits until a level's popover lists each of `texts`, in any of its items,
 * then closes it. Opening the popover marks the level read.
 */
export async function expectMessages(
  page: Page,
  level: MessageLevelName,
  ...texts: (string | RegExp)[]
): Promise<void> {
  const list = (await openMessages(page, level)).getByRole("list");
  for (const text of texts) {
    await expect(list).toContainText(text);
  }
  await closeMessages(page);
}

/** Waits until a level's button counts `count` messages. */
export async function expectMessageCount(
  page: Page,
  level: MessageLevelName,
  count: number,
): Promise<void> {
  await expect(messageButton(page, level)).toHaveAccessibleName(
    new RegExp(`^${level}: ${count},`),
  );
}

/** The capsule of a level's button, with `data-capsule` `unread` or `read`. */
export function messageCapsule(page: Page, level: MessageLevelName): Locator {
  return messageButton(page, level).locator("[data-capsule]");
}

/** The stage bar shows no errors and no warnings. */
export async function expectNoIssues(page: Page): Promise<void> {
  await expectMessageCount(page, "Errors", 0);
  await expectMessageCount(page, "Warnings", 0);
}

/** The stage bar's "More actions" button. */
export function moreActionsButton(page: Page): Locator {
  return stageBar(page).getByRole("button", { name: "More actions" });
}

/** The "More actions" menu, while it is open. */
export function moreActionsMenu(page: Page): Locator {
  return page.getByRole("menu");
}

/** Opens the "More actions" menu with a click and returns it. */
export async function openMoreActions(page: Page): Promise<Locator> {
  await moreActionsButton(page).click();
  const menu = moreActionsMenu(page);
  await expect(menu).toBeVisible();
  return menu;
}

/** Presses "Reload tiles" in the "More actions" menu. */
export async function reloadTiles(page: Page): Promise<void> {
  const menu = await openMoreActions(page);
  await menu.getByRole("menuitem", { name: "Reload tiles" }).click();
}

/** The items of an open popover marked unread, each with a dot whose accessible text is "Unread". */
export function unreadItems(popover: Locator): Locator {
  return popover.locator("li[data-unread]");
}

async function readMessage(item: Locator): Promise<StageMessage> {
  const message: StageMessage = {
    producer: (await item.locator("[data-producer]").textContent()) ?? "",
    source: (await item.locator("code").textContent()) ?? "",
    text: (await item.locator("div > span").textContent()) ?? "",
  };
  return message;
}

/** Opens a level's popover, reads its items in order, and closes it. */
export async function readMessages(
  page: Page,
  level: MessageLevelName,
): Promise<StageMessage[]> {
  const popover = await openMessages(page, level);
  const messages: StageMessage[] = [];
  for (const item of await popover.getByRole("listitem").all()) {
    messages.push(await readMessage(item));
  }
  await closeMessages(page);
  return messages;
}

/**
 * The row of a mod's `show` permission for `COVER_HOST` in the mod viewer's
 * permission table, found by its host.
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

/** Runs in a mod frame: the alt text of each image that loaded. */
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

/** `slot_reporter`: the folder of `buildSlotReporterFiles`. */
export const SLOT_REPORTER_NAME = "slot_reporter";

/** `starts`: the storage key the slot reporter reads when it mounts. */
export const SLOT_REPORTER_KEY = "starts";

/**
 * A mod that keeps its engine API object on `globalThis.probe`, so a test can
 * write its storage, and whose `mount` reads `storage.get` for `starts` and
 * reports it as `stored`, unless it was opened with the parameter
 * `quiet=yes`.
 */
export function buildSlotReporterFiles(): ModFiles {
  return buildCheckedModFiles(SLOT_REPORTER_NAME, [
    "  globalThis.probe = { engine, context };",
    '  if (context.params.quiet === "yes") {',
    "    return;",
    "  }",
    `  const stored = await engine.request("storage.get", { key: "${SLOT_REPORTER_KEY}" });`,
    '  reportToTest(context, "stored", stored);',
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

/** The routed host the default mosaic of `buildMosaicBooksFiles` declares `show` for. */
export const MOSAIC_COVERS_HOST = "https://covers.example.net";

/** `mosaic_books`: the folder of `buildMosaicBooksFiles`. */
export const MOSAIC_BOOKS_NAME = "mosaic_books";

/** The lines of a mosaic of `mosaic_books`, after its `mod`: its three books, `columns: 4` and `show` for the covers host. */
function buildMosaicBooksLines(collection: string): string[] {
  const lines = [
    `  collection: "${collection}"`,
    "  config:",
    "    columns: 4",
    "  permissions:",
    "    show:",
    `      - host: "${MOSAIC_COVERS_HOST}"`,
    '        reason: "Shows the covers"',
  ];
  return lines;
}

/** A mosaic file of `mosaic_books` titled `title`, whose `mod` and `collection` are as given. */
export function buildMosaicBooksMosaic(
  title: string,
  mod: string,
  collection: string,
): string {
  const mosaic = [
    "mosaic:",
    `  title: "${title}"`,
    `  mod: "${mod}"`,
    ...buildMosaicBooksLines(collection),
    "",
  ].join("\n");
  return mosaic;
}

/** A note tile titled `title`, which an untyped mod receives as it is. */
function buildBookNote(title: string): string {
  const note = ["---", `title: "${title}"`, "---", "", "A book.", ""].join(
    "\n",
  );
  return note;
}

/**
 * A mod without a tile type whose config sets `columns: 6`, and whose default
 * mosaic gives it three books, `columns: 4` and `show` for
 * `MOSAIC_COVERS_HOST`. Its `mount` reports `columns`, the number of `tiles`
 * and whether a `cover` from the covers host loaded.
 */
export function buildMosaicBooksFiles(): ModFiles {
  const files = buildCheckedModFiles(
    MOSAIC_BOOKS_NAME,
    [
      '  reportToTest(context, "columns", context.config.columns);',
      '  reportToTest(context, "tiles", context.tiles.length);',
      '  const image = document.createElement("img");',
      `  image.src = "${MOSAIC_COVERS_HOST}/cover.png";`,
      "  document.body.append(image);",
      "  const loaded = await image.decode().then(",
      "    function reportLoaded() { return true; },",
      "    function reportBlocked() { return false; },",
      "  );",
      '  reportToTest(context, "cover", loaded);',
    ],
    ['  default_mosaic: "./mosaic.yaml"', "  config:", "    columns: 6"],
  );
  files[`${MOSAIC_BOOKS_NAME}/mosaic.yaml`] = buildMosaicBooksMosaic(
    "Books in a mosaic",
    "./",
    "./books.yaml",
  );
  files[`${MOSAIC_BOOKS_NAME}/books.yaml`] = [
    "collection:",
    '  title: "Three books"',
    "  tiles:",
    '    - path: "./books/first.md"',
    '    - path: "./books/second.md"',
    '    - path: "./books/third.md"',
    "",
  ].join("\n");
  files[`${MOSAIC_BOOKS_NAME}/books/first.md`] = buildBookNote("First book");
  files[`${MOSAIC_BOOKS_NAME}/books/second.md`] = buildBookNote("Second book");
  files[`${MOSAIC_BOOKS_NAME}/books/third.md`] = buildBookNote("Third book");
  return files;
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

/** The report's `tests` when each case of `names` passes. */
export function buildPassedResults(names: string[]): CheckTestResult[] {
  const results: CheckTestResult[] = [];
  for (const name of names) {
    results.push({ name, status: "pass", message: null });
  }
  return results;
}

export interface CheckReport {
  source: string | null;
  mosaic: string | null;
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

/** Sends a check request, `mods.check` or `mosaics.check`, from the checker and returns the report. */
async function requestCheckFromChecker(
  page: Page,
  method: string,
  params: Record<string, string>,
): Promise<CheckReport> {
  const checkerFrame = await findModFrame(page, CHECKER_TITLE);
  const answer: ProbeAnswer = await checkerFrame.evaluate(requestFromProbe, [
    method,
    params,
  ]);
  if (answer.result === undefined) {
    throw new Error(
      `Expected a report for ${method} ${JSON.stringify(params)}, got error ${answer.code}: ${answer.message}`,
    );
  }
  return answer.result as CheckReport;
}

/** Sends `mods.check` from the checker and returns the report. */
export function checkFromChecker(
  page: Page,
  mod: string,
): Promise<CheckReport> {
  return requestCheckFromChecker(page, "mods.check", { mod });
}

/** Sends `mosaics.check` from the checker and returns the report. */
export function checkMosaicFromChecker(
  page: Page,
  mosaic: string,
): Promise<CheckReport> {
  return requestCheckFromChecker(page, "mosaics.check", { mosaic });
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
