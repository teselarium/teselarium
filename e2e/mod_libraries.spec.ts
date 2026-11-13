import { expect, test } from "@playwright/test";
import type { Frame, Page, Request } from "@playwright/test";
import { PREVIEW_URL } from "./app_servers.ts";
import {
  APP_ORIGIN_MOD_PATH,
  buildModConf,
  buildProbeFiles,
  buildTestCode,
  buildTestModReference,
  checkFromChecker,
  findModFrame,
  followLink,
  openChecker,
  requestFromProbe,
  routeCovers,
  serveAppOriginMod,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles, ProbeAnswer } from "./mod_routes.ts";
import { SAMPLE_COLLECTION_RUN_HASH } from "./sample_mod.ts";

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
    test("Unknown library", async function rejectsUnknownLibrary({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);

      const answer = await frame.evaluate(requestFromProbe, [
        "libs.load",
        { name: "katex", version: "0" },
      ]);

      expect(answer.code).toBe(-32602);
      expect(answer.message).toContain("libs.load");
      expect(answer.message).toContain('the app has no library "katex"');
      expect(await frame.evaluate(readMermaidType)).toBe("undefined");
    });

    test("Other major version", async function rejectsOtherMajor({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);

      const answer = await frame.evaluate(requestFromProbe, [
        "libs.load",
        { name: "mermaid", version: "11" },
      ]);

      expect(answer.code).toBe(-32602);
      expect(answer.message).toContain("libs.load");
      expect(answer.message).toContain("the app has mermaid 12");
      expect(await frame.evaluate(readMermaidType)).toBe("undefined");
    });

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
      await routeCovers(page);

      await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

      await expect(
        page.frameLocator('iframe[title="Book List"]').getByText("Kallocain"),
      ).toBeVisible();
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
