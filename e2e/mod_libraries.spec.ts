import { expect, test } from "@playwright/test";
import type { Frame, Page, Request, Route } from "@playwright/test";
import { PREVIEW_URL } from "./app_servers.ts";
import {
  APP_ORIGIN_MOD_PATH,
  buildModConf,
  buildProbeFiles,
  buildTestCode,
  buildTestModReference,
  checkFromChecker,
  expectNoIssues,
  findModFrame,
  FOREIGN_HOST,
  followLink,
  openChecker,
  requestFromProbe,
  serveAppOriginMod,
  serveForeignMod,
  siteConsentDialog,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles, ProbeAnswer } from "./mod_routes.ts";
import { openTilesMod, TILES_ITEM_TITLES } from "./test_mods.ts";

const MERMAID_REQUEST = { name: "mermaid", version: "12" };

/** The mermaid chunk of the build, `assets/mermaid.min-<hash>.js`. */
const MERMAID_CHUNK_PATTERN = /\/assets\/mermaid\.min-[^/]+\.js$/;

function buildProbeLink(name: string): string {
  return `#/run?mod=.${APP_ORIGIN_MOD_PATH}${name}/`;
}

/** Serves the probes named `names` on the app's origin, opens the first and waits until it mounted. */
async function openProbes(page: Page, names: string[]): Promise<void> {
  let files: ModFiles = {};
  for (const name of names) {
    files = { ...files, ...buildProbeFiles(name) };
  }
  await serveAppOriginMod(page, files);
  await page.goto(`/${buildProbeLink(names[0])}`);
  await waitForProbe(await findModFrame(page, names[0]));
}

async function openProbe(page: Page): Promise<Frame> {
  await openProbes(page, ["probe"]);
  const frame = await findModFrame(page, "probe");
  return frame;
}

function loadMermaid(frame: Frame): Promise<ProbeAnswer> {
  return frame.evaluate(requestFromProbe, ["libs.load", MERMAID_REQUEST]);
}

/** Runs in a frame or the app's page: the type of `globalThis.mermaid`. */
function readMermaidType(): string {
  return typeof (globalThis as { mermaid?: unknown }).mermaid;
}

/** Runs in a frame: the type of `globalThis.mermaid.render`. */
function readRenderType(): string {
  const mermaid = (globalThis as { mermaid?: { render?: unknown } }).mermaid;
  return typeof mermaid?.render;
}

/** Runs in a frame: marks the installed mermaid object. */
function markMermaid(): void {
  (globalThis as unknown as { mermaid: { marker: number } }).mermaid.marker = 1;
}

/** Runs in a frame: the mark of the installed mermaid object. */
function readMermaidMarker(): unknown {
  return (globalThis as unknown as { mermaid: { marker?: number } }).mermaid
    .marker;
}

function recordRequestUrl(requestedUrls: string[], request: Request): void {
  requestedUrls.push(request.url());
}

function collectRequestedUrls(page: Page): string[] {
  const requestedUrls: string[] = [];
  page.on("request", recordRequestUrl.bind(undefined, requestedUrls));
  return requestedUrls;
}

function isMermaidChunk(url: string): boolean {
  return MERMAID_CHUNK_PATTERN.test(new URL(url).pathname);
}

/** The `http:` and `https:` addresses, so `blob:` and `data:` ones, which reach no host, are left out. */
function listNetworkUrls(urls: string[]): string[] {
  const networkUrls: string[] = [];
  for (const url of urls) {
    const protocol = new URL(url).protocol;
    if (protocol === "http:" || protocol === "https:") {
      networkUrls.push(url);
    }
  }
  return networkUrls;
}

function readOrigin(url: string): string {
  return new URL(url).origin;
}

/**
 * A mod that loads mermaid and draws a flowchart into its page as it
 * mounts, and a case that mounts it and checks the diagram and the
 * recorded `libs.load`.
 */
function buildDrawingCaseFiles(name: string): ModFiles {
  const modCode = [
    "export default async function mount(engine, context) {",
    '  await engine.request("libs.load", { name: "mermaid", version: "12" });',
    '  globalThis.mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });',
    '  const diagram = await globalThis.mermaid.render("case-diagram", "flowchart LR\\n  Tile --> Mod");',
    '  const figure = document.createElement("figure");',
    "  figure.innerHTML = diagram.svg;",
    "  document.body.append(figure);",
    "}",
    "",
  ].join("\n");
  const testCode = buildTestCode(
    [
      "async function drawsDiagram(context) {",
      "  await context.mount();",
      '  context.expect(document.querySelector("figure svg") !== null).toBe(true);',
      '  context.expect(document.querySelector("figure").textContent).toContain("Tile");',
      "  const loads = context.requests.filter(function isLoad(request) {",
      '    return request.method === "libs.load";',
      "  });",
      "  context.expect(loads.length).toBe(1);",
      "  context.expect(Object.keys(loads[0].result).sort()).toEqual([",
      '    "name",',
      '    "version",',
      "  ]);",
      '  context.expect(loads[0].result.version.startsWith("12.")).toBe(true);',
      "}",
    ],
    [["draws a diagram", "drawsDiagram"]],
  );
  const files: ModFiles = {
    [`${name}/mod_conf.yaml`]: buildModConf(name, ['  test_path: "./test.js"']),
    [`${name}/main.js`]: modCode,
    [`${name}/test.js`]: testCode,
  };
  return files;
}

test.describe(
  "Load a library",
  { tag: "@frames" },
  function describeLoadLibrary(): void {
    test("Load mermaid", async function loadsMermaid({ page }): Promise<void> {
      const frame = await openProbe(page);

      const answer = await loadMermaid(frame);

      const result = answer.result as Record<string, unknown>;
      expect(Object.keys(result).sort()).toEqual(["name", "version"]);
      expect(result.name).toBe("mermaid");
      expect(result.version).toMatch(/^12\.\d+\.\d+$/);
      expect(await frame.evaluate(readRenderType)).toBe("function");
    });
  },
);

test.describe(
  "Unknown libraries and versions",
  { tag: "@frames" },
  function describeUnknownLibraries(): void {
    test("rejects another major version after mermaid was loaded", async function rejectsAfterLoad({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      await loadMermaid(frame);

      const answer = await frame.evaluate(requestFromProbe, [
        "libs.load",
        { name: "mermaid", version: "11" },
      ]);

      expect(answer.code).toBe(-32602);
    });
  },
);

test.describe(
  "A frame receives a library once",
  { tag: "@frames" },
  function describeOnce(): void {
    test("Two requests", async function loadsOnce({ page }): Promise<void> {
      const frame = await openProbe(page);
      const first = await loadMermaid(frame);
      await frame.evaluate(markMermaid);

      const second = await loadMermaid(frame);

      expect(second.result).toEqual(first.result);
      expect(await frame.evaluate(readMermaidMarker)).toBe(1);
    });
  },
);

test.describe(
  "Libraries come from the app",
  { tag: "@frames" },
  function describeFromApp(): void {
    test("No third-party request", async function requestsOnlyApp({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);
      const requestedUrls = collectRequestedUrls(page);

      await loadMermaid(frame);

      const networkUrls = listNetworkUrls(requestedUrls);
      expect(networkUrls.filter(isMermaidChunk)).toHaveLength(1);
      expect(new Set(networkUrls.map(readOrigin))).toEqual(
        new Set([readOrigin(PREVIEW_URL)]),
      );
    });

    test("Not downloaded before a request", async function downloadsNothing({
      page,
    }): Promise<void> {
      const requestedUrls = collectRequestedUrls(page);

      const frame = await openTilesMod(page);

      await expect(frame.getByRole("listitem")).toHaveText(TILES_ITEM_TITLES);
      expect(requestedUrls.filter(isMermaidChunk)).toEqual([]);
    });
  },
);

test.describe(
  "Libraries run in the mod's frame",
  { tag: "@frames" },
  function describeInFrame(): void {
    test("Other frames", async function staysInFrame({ page }): Promise<void> {
      await openProbes(page, ["probe", "other"]);
      await followLink(page, buildProbeLink("other"));
      const otherFrame = await findModFrame(page, "other");
      await waitForProbe(otherFrame);
      const probeFrame = await findModFrame(page, "probe");

      await loadMermaid(otherFrame);

      expect(await otherFrame.evaluate(readMermaidType)).toBe("object");
      expect(await probeFrame.evaluate(readMermaidType)).toBe("undefined");
      expect(await page.evaluate(readMermaidType)).toBe("undefined");
    });

    test("In a test case", async function drawsInCase({ page }): Promise<void> {
      await openChecker(page, buildDrawingCaseFiles("drawing_case"));

      const report = await checkFromChecker(
        page,
        buildTestModReference("drawing_case"),
      );

      expect(report.tests).toEqual([
        { name: "draws a diagram", status: "pass", message: null },
      ]);
      expect(report.findings).toEqual([]);
      expect(report.status).toBe("pass");
    });
  },
);

/** The vanilla app's npm host, which every test answers with the fixtures below. */
const NPM_HOST = "https://cdn.jsdelivr.net/npm/";

const LEAFLET_SCRIPT_URL = `${NPM_HOST}leaflet@1.9.4/dist/leaflet.js`;
const LEAFLET_STYLE_URL = `${NPM_HOST}leaflet@1.9.4/dist/leaflet.css`;
const MISSING_VERSION_URL = `${NPM_HOST}leaflet@9.9.9/dist/leaflet.js`;
const MISSING_VERSION_TEXT =
  "Couldn't find the requested release version 9.9.9.";
const WORLD_ATLAS_TEXT = '{"type":"Topology","objects":{}}';

/** A file of the routed npm host. */
interface NpmFixture {
  contentType: string;
  body: string;
}

/** The files the routed npm host serves, by their path under it: small stand-ins, not the real packages. */
const NPM_FIXTURES: Record<string, NpmFixture> = {
  "leaflet@1.9.4/dist/leaflet.js": {
    contentType: "application/javascript; charset=utf-8",
    body: 'globalThis.L = { version: "1.9.4", map: function map() { return {}; } };\n',
  },
  "leaflet@1.9.4/dist/leaflet.css": {
    contentType: "text/css; charset=utf-8",
    body: ".leaflet-container { cursor: crosshair; }\n.probe { color: rgb(0, 0, 255); }\n",
  },
  "world-atlas@2.0.2/countries-110m.json": {
    contentType: "application/json; charset=utf-8",
    body: WORLD_ATLAS_TEXT,
  },
};

/** A request the routed npm host saw, and whether the app's page made it. */
interface NpmRequest {
  url: string;
  isFromPage: boolean;
}

/** The routed npm host: what it saw, and whether it fails the next request as an unreachable host. */
interface NpmHost {
  requests: NpmRequest[];
  failsNextRequest: boolean;
}

/** jsDelivr's one-line reason for a missing version or file. */
function describeMissingNpmPath(path: string): string {
  if (path.startsWith("leaflet@9.9.9/")) {
    return MISSING_VERSION_TEXT;
  }
  const fileStart = path.indexOf("/");
  const missingFile = `Couldn't find the requested file ${path.slice(fileStart)} in ${path.slice(0, path.indexOf("@"))}.`;
  return missingFile;
}

async function answerNpmFile(
  page: Page,
  npmHost: NpmHost,
  route: Route,
): Promise<void> {
  const request = route.request();
  npmHost.requests.push({
    url: request.url(),
    isFromPage: request.frame() === page.mainFrame(),
  });
  if (npmHost.failsNextRequest) {
    npmHost.failsNextRequest = false;
    await route.abort("internetdisconnected");
    return;
  }
  const path = new URL(request.url()).pathname.slice("/npm/".length);
  const headers = { "Access-Control-Allow-Origin": "*" };
  const fixture = Object.hasOwn(NPM_FIXTURES, path) ? NPM_FIXTURES[path] : null;
  if (fixture === null) {
    await route.fulfill({
      status: 404,
      headers,
      contentType: "text/plain; charset=utf-8",
      body: describeMissingNpmPath(path),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    headers,
    contentType: fixture.contentType,
    body: fixture.body,
  });
}

/** Answers the npm host with `NPM_FIXTURES`, so no test reaches the network. */
async function routeNpmHost(page: Page): Promise<NpmHost> {
  const npmHost: NpmHost = { requests: [], failsNextRequest: false };
  await page.route(
    `${NPM_HOST}**`,
    answerNpmFile.bind(undefined, page, npmHost),
  );
  return npmHost;
}

function listNpmUrls(npmHost: NpmHost): string[] {
  const urls: string[] = [];
  for (const request of npmHost.requests) {
    urls.push(request.url);
  }
  return urls;
}

/** The mod file lines that declare `libraries`, each `[name, npm or null, files]`. */
function buildLibraryLines(
  libraries: [string, string | null, string[]][],
): string[] {
  const lines = ["  libraries:"];
  for (const [name, npm, files] of libraries) {
    lines.push(`    ${name}:`);
    if (npm !== null) {
      lines.push(`      npm: "${npm}"`);
    }
    lines.push(`      files: ${JSON.stringify(files)}`);
  }
  return lines;
}

const LEAFLET_LINES = buildLibraryLines([
  ["leaflet", "leaflet@1.9.4", ["dist/leaflet.js", "dist/leaflet.css"]],
]);

/** Serves probes on the app's origin, each with its mod file lines and extra files, opens the first and waits until it mounted. */
async function openLibraryProbes(
  page: Page,
  probes: [string, string[]][],
  extraFiles: ModFiles = {},
): Promise<Frame> {
  let files: ModFiles = { ...extraFiles };
  for (const [name, lines] of probes) {
    files = { ...files, ...buildProbeFiles(name, lines) };
  }
  await serveAppOriginMod(page, files);
  await page.goto(`/${buildProbeLink(probes[0][0])}`);
  const frame = await findModFrame(page, probes[0][0]);
  await waitForProbe(frame);
  return frame;
}

function loadLibrary(frame: Frame, params: object): Promise<ProbeAnswer> {
  return frame.evaluate(requestFromProbe, ["libs.load", params]);
}

/** Runs in a frame: the type of `globalThis.L`. */
function readLeafletType(): string {
  return typeof (globalThis as { L?: unknown }).L;
}

/** Runs in a frame: the type of `globalThis.L.map`. */
function readLeafletMapType(): string {
  const leaflet = (globalThis as { L?: { map?: unknown } }).L;
  return typeof leaflet?.map;
}

/** Runs in a frame: marks the installed `L` object. */
function markLeaflet(): void {
  (globalThis as unknown as { L: { marker: number } }).L.marker = 1;
}

/** Runs in a frame: the mark of the installed `L` object. */
function readLeafletMarker(): unknown {
  return (globalThis as unknown as { L: { marker?: number } }).L.marker;
}

/** Runs in a frame: the cursor of a new `.leaflet-container` element. */
function readLeafletCursor(): string {
  const element = document.createElement("div");
  element.className = "leaflet-container";
  document.body.append(element);
  return getComputedStyle(element).cursor;
}

/** Runs in a frame: how many scripts and stylesheets the frame's head holds. */
function countHeadElements(): number {
  return document.head.querySelectorAll("script, style, link").length;
}

/** Runs in a frame: the global `b.js` of the ordered library sets. */
function readOrderedGlobal(): unknown {
  return (globalThis as { second?: unknown }).second;
}

/** Runs in a frame: the global the helper next to the mod sets. */
function readHelperGlobal(): unknown {
  return (globalThis as { helper?: unknown }).helper;
}

/** Runs in a frame: adds a style for `.probe`, as a mod does, and an element of that class. */
function addProbeStyle(): void {
  const style = document.createElement("style");
  style.textContent = ".probe { color: rgb(255, 0, 0); }";
  document.head.append(style);
  const paragraph = document.createElement("p");
  paragraph.className = "probe";
  paragraph.textContent = "Probe";
  document.body.append(paragraph);
}

/** Runs in a frame: the color of the `.probe` element. */
function readProbeColor(): string {
  const element = document.querySelector(".probe");
  if (element === null) {
    throw new Error("Expected an element of class probe");
  }
  return getComputedStyle(element).color;
}

test.describe(
  "Load a declared library",
  { tag: "@frames" },
  function describeLoadDeclared(): void {
    test("Load a declared npm library", async function loadsNpmLibrary({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);

      const answer = await loadLibrary(frame, { name: "leaflet" });

      expect(answer.result).toEqual({
        name: "leaflet",
        version: "1.9.4",
        files: {},
      });
      expect(await frame.evaluate(readLeafletMapType)).toBe("function");
      expect(await frame.evaluate(readLeafletCursor)).toBe("crosshair");
    });

    test("Data file", async function loadsDataFile({ page }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [
        [
          "probe",
          buildLibraryLines([
            ["world_atlas", "world-atlas@2.0.2", ["countries-110m.json"]],
          ]),
        ],
      ]);
      const headElements = await frame.evaluate(countHeadElements);

      const answer = await loadLibrary(frame, { name: "world_atlas" });

      expect(answer.result).toEqual({
        name: "world_atlas",
        version: "2.0.2",
        files: { "countries-110m.json": WORLD_ATLAS_TEXT },
      });
      expect(await frame.evaluate(countHeadElements)).toBe(headElements);
    });

    test("Files next to the mod", async function loadsLocalFiles({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);
      const frame = await openLibraryProbes(
        page,
        [
          [
            "probe",
            buildLibraryLines([["helper", null, ["./vendor/helper.js"]]]),
          ],
        ],
        { "probe/vendor/helper.js": "globalThis.helper = 'ready';\n" },
      );

      const answer = await loadLibrary(frame, { name: "helper" });

      expect(answer.result).toEqual({
        name: "helper",
        version: null,
        files: {},
      });
      expect(await frame.evaluate(readHelperGlobal)).toBe("ready");
      expect(npmHost.requests).toEqual([]);
    });

    test("Scripts run in order", async function runsInOrder({
      page,
    }): Promise<void> {
      const frame = await openLibraryProbes(
        page,
        [
          [
            "probe",
            buildLibraryLines([
              ["ordered", null, ["./vendor/a.js", "./vendor/b.js"]],
            ]),
          ],
        ],
        {
          "probe/vendor/a.js": "globalThis.first = 1;\n",
          "probe/vendor/b.js": "globalThis.second = globalThis.first + 1;\n",
        },
      );

      const answer = await loadLibrary(frame, { name: "ordered" });

      expect(answer.code).toBeUndefined();
      expect(await frame.evaluate(readOrderedGlobal)).toBe(2);
    });
  },
);

test.describe(
  "Version of a declared library",
  { tag: "@frames" },
  function describeDeclaredVersion(): void {
    test("Declared version", async function acceptsDeclaredVersion({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);
      const first = await loadLibrary(frame, { name: "leaflet" });
      await frame.evaluate(markLeaflet);

      const second = await loadLibrary(frame, {
        name: "leaflet",
        version: "1.9.4",
      });

      expect(second.result).toEqual(first.result);
      expect(await frame.evaluate(readLeafletMarker)).toBe(1);
    });

    test("Other version", async function rejectsOtherVersion({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);

      const answer = await loadLibrary(frame, {
        name: "leaflet",
        version: "1",
      });

      expect(answer.code).toBe(-32602);
      expect(answer.message).toContain("libs.load");
      expect(answer.message).toContain("leaflet");
      expect(answer.message).toContain("1.9.4");
      expect(npmHost.requests).toEqual([]);
      expect(await frame.evaluate(readLeafletType)).toBe("undefined");
    });
  },
);

test.describe(
  "Where declared library files come from",
  { tag: "@frames" },
  function describeWhereFrom(): void {
    test("npm file address", async function requestsFromPage({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);

      await loadLibrary(frame, { name: "leaflet" });

      expect(listNpmUrls(npmHost).sort()).toEqual(
        [LEAFLET_SCRIPT_URL, LEAFLET_STYLE_URL].sort(),
      );
      for (const request of npmHost.requests) {
        expect(request.isFromPage).toBe(true);
      }
    });
  },
);

test.describe(
  "Declared files are fetched once per page and only when needed",
  { tag: "@frames" },
  function describeFetchOnce(): void {
    test("Not downloaded before a request", async function downloadsNothing({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);

      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);

      expect(await frame.evaluate(readLeafletType)).toBe("undefined");
      expect(npmHost.requests).toEqual([]);
    });

    test("Two mods, one download", async function downloadsOnce({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);
      const probeFrame = await openLibraryProbes(page, [
        ["probe", LEAFLET_LINES],
        ["other", LEAFLET_LINES],
      ]);
      await loadLibrary(probeFrame, { name: "leaflet" });
      await followLink(page, buildProbeLink("other"));
      const otherFrame = await findModFrame(page, "other");
      await waitForProbe(otherFrame);

      const answer = await loadLibrary(otherFrame, { name: "leaflet" });

      expect(answer.result).toEqual({
        name: "leaflet",
        version: "1.9.4",
        files: {},
      });
      expect(listNpmUrls(npmHost).sort()).toEqual(
        [LEAFLET_SCRIPT_URL, LEAFLET_STYLE_URL].sort(),
      );
      expect(await probeFrame.evaluate(readLeafletMapType)).toBe("function");
      expect(await otherFrame.evaluate(readLeafletMapType)).toBe("function");
    });
  },
);

test.describe(
  "Declared files that cannot be fetched",
  { tag: "@frames" },
  function describeFetchFailures(): void {
    test("Version that does not exist", async function rejectsMissingVersion({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [
        [
          "probe",
          buildLibraryLines([
            ["leaflet", "leaflet@9.9.9", ["dist/leaflet.js"]],
          ]),
        ],
      ]);

      const answer = await loadLibrary(frame, { name: "leaflet" });

      expect(answer.code).toBe(-32001);
      expect(answer.message).toContain("libs.load");
      expect(answer.message).toContain('"leaflet"');
      expect(answer.message).toContain(MISSING_VERSION_URL);
      expect(answer.message).toContain("404");
      expect(answer.message).toContain(MISSING_VERSION_TEXT);
      expect(await frame.evaluate(readLeafletType)).toBe("undefined");
    });

    test("Later request after a failure", async function retriesAfterFailure({
      page,
    }): Promise<void> {
      const npmHost = await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [
        [
          "probe",
          buildLibraryLines([
            ["leaflet", "leaflet@1.9.4", ["dist/leaflet.js"]],
          ]),
        ],
      ]);
      npmHost.failsNextRequest = true;

      const failed = await loadLibrary(frame, { name: "leaflet" });
      const retried = await loadLibrary(frame, { name: "leaflet" });

      expect(failed.code).toBe(-32001);
      expect(failed.message).toContain(LEAFLET_SCRIPT_URL);
      expect(await frame.evaluate(readLeafletMapType)).toBe("function");
      expect(retried.result).toEqual({
        name: "leaflet",
        version: "1.9.4",
        files: {},
      });
      expect(listNpmUrls(npmHost)).toEqual([
        LEAFLET_SCRIPT_URL,
        LEAFLET_SCRIPT_URL,
      ]);
    });
  },
);

test.describe(
  "A mod's styles win over its libraries'",
  { tag: "@frames" },
  function describeStyleOrder(): void {
    test("Mod style added first", async function keepsModStyle({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [["probe", LEAFLET_LINES]]);
      await frame.evaluate(addProbeStyle);

      await loadLibrary(frame, { name: "leaflet" });

      expect(await frame.evaluate(readProbeColor)).toBe("rgb(255, 0, 0)");
      expect(await frame.evaluate(readLeafletCursor)).toBe("crosshair");
    });

    test("Mod style added first, without the theme", async function keepsModStyleWithoutTheme({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      const frame = await openLibraryProbes(page, [
        ["probe", ['  theme: "none"', ...LEAFLET_LINES]],
      ]);
      await frame.evaluate(addProbeStyle);

      await loadLibrary(frame, { name: "leaflet" });

      expect(await frame.evaluate(readProbeColor)).toBe("rgb(255, 0, 0)");
      expect(await frame.evaluate(readLeafletCursor)).toBe("crosshair");
    });
  },
);

test.describe(
  "Declared libraries need no permission",
  { tag: "@frames" },
  function describeNoPermission(): void {
    test("Foreign mod with an npm library", async function loadsInForeignMod({
      page,
    }): Promise<void> {
      await routeNpmHost(page);
      await serveForeignMod(page, buildProbeFiles("probe", LEAFLET_LINES));
      await page.goto(
        `/#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`,
      );
      const frame = await findModFrame(page, "probe");
      await waitForProbe(frame);

      const answer = await loadLibrary(frame, { name: "leaflet" });

      expect(answer.result).toEqual({
        name: "leaflet",
        version: "1.9.4",
        files: {},
      });
      expect(await frame.evaluate(readLeafletMapType)).toBe("function");
      await expect(siteConsentDialog(page)).toHaveCount(0);
      await expectNoIssues(page);
    });
  },
);
