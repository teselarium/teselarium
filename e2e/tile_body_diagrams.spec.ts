import { expect, test } from "@playwright/test";
import type { Frame, Page, Request } from "@playwright/test";
import { isFrameMarked, markFrame } from "./mod_routes.ts";
import { openBodyProbe } from "./tile_body_routes.ts";
import type { BodyTile } from "./tile_body_routes.ts";

/** The mermaid chunk of the build: the page fetches it on the first `libs.load`. */
const MERMAID_CHUNK_PATTERN = /\/assets\/mermaid\.min-[^/]+\.js$/;

function buildFiller(): string {
  const paragraphs: string[] = [];
  for (let index = 1; index <= 40; index += 1) {
    paragraphs.push(`Filler paragraph ${index}.`);
  }
  return paragraphs.join("\n\n");
}

/** Paragraphs that push what follows them out of the frame's view. */
const FILLER = buildFiller();

function buildMermaidBlock(lines: string[]): string {
  return ["```mermaid", ...lines, "```"].join("\n");
}

const FLOWCHART_TILE: BodyTile = {
  name: "flowchart",
  body: [
    "Tiles open in mods.",
    buildMermaidBlock(["flowchart LR", "  Tile --> Mod"]),
  ].join("\n\n"),
};

const MARKUP_TILE: BodyTile = {
  name: "markup",
  body: buildMermaidBlock([
    "flowchart LR",
    '  A["<img src=x onerror=alert(1)>"] --> B',
  ]),
};

const BELOW_FOLD_TILE: BodyTile = {
  name: "below-fold",
  body: [FILLER, buildMermaidBlock(["flowchart LR", "  Tile --> Mod"])].join(
    "\n\n",
  ),
};

const SYNTAX_ERROR_TILE: BodyTile = {
  name: "syntax-error",
  body: [
    buildMermaidBlock(["flowchart LR", "  A -->"]),
    buildMermaidBlock(["flowchart LR", "  Tile --> Mod"]),
  ].join("\n\n"),
};

/** Two diagrams that turn HTML labels on in their own configuration. */
const HTML_LABELS_TILE: BodyTile = {
  name: "html-labels",
  body: [
    buildMermaidBlock([
      "---",
      "config:",
      "  htmlLabels: true",
      "  flowchart:",
      "    htmlLabels: true",
      "---",
      "flowchart LR",
      '  A["<img src=x>"] --> B',
    ]),
    buildMermaidBlock([
      '%%{init: {"htmlLabels": true, "flowchart": {"htmlLabels": true}}}%%',
      "flowchart LR",
      '  C["<img src=x>"] --> D',
    ]),
  ].join("\n\n"),
};

const PLAIN_TILE: BodyTile = {
  name: "plain",
  body: "A body with no diagram.",
};

/** The tiles, by index in the probe's mount context. */
const DIAGRAM_TILES = [
  FLOWCHART_TILE,
  MARKUP_TILE,
  BELOW_FOLD_TILE,
  SYNTAX_ERROR_TILE,
  PLAIN_TILE,
  HTML_LABELS_TILE,
];

const FLOWCHART_INDEX = 0;
const MARKUP_INDEX = 1;
const BELOW_FOLD_INDEX = 2;
const SYNTAX_ERROR_INDEX = 3;
const PLAIN_INDEX = 4;
const HTML_LABELS_INDEX = 5;

/** What the body held at one moment. */
interface BodySnapshot {
  event: string;
  paragraphs: number;
  codeBlocks: number;
  figures: number;
}

/**
 * A change of a mermaid block or a diagram figure: its `aria-busy` was set
 * or removed (`"busy"`), or it left or joined the body. `busy` is its
 * `aria-busy` attribute then.
 */
interface BusyChange {
  change: "busy" | "removed" | "added";
  tag: string;
  busy: string | null;
}

/** What `showDiagramBody` options the probe's frame gets. */
interface ShowOptions {
  index: number;
  diagrams?: string;
  /** Sets the element's `tile` to this tile as soon as the frame installs mermaid. */
  nextIndex?: number;
}

/** What the probe's frame keeps for these tests, on `globalThis`. */
interface DiagramGlobal {
  probe: { context: { tiles: unknown[] } };
  bodyLog: BodySnapshot[];
  busyLog: BusyChange[];
  diagramBody: HTMLElement & { tile: unknown; diagrams: string };
}

/**
 * Runs in the probe's frame: shows the tile at `index` in a new
 * `ot-tile-body`, and logs a snapshot of the body at each `ot-rendered` and
 * `ot-diagrams-drawn`, and one paint after the first `ot-rendered`, before
 * any diagram can be drawn. Logs every busy change of its mermaid blocks and
 * figures in `busyLog`. With `nextIndex`, sets that tile as soon as the
 * loader appends mermaid's script, while the block is being drawn. It runs
 * in the frame, so its helpers are inside it.
 */
function showDiagramBody(options: ShowOptions): void {
  const diagramGlobal = globalThis as unknown as DiagramGlobal;
  const body = document.createElement(
    "ot-tile-body",
  ) as DiagramGlobal["diagramBody"];
  diagramGlobal.bodyLog = [];
  diagramGlobal.busyLog = [];
  diagramGlobal.diagramBody = body;

  function logSnapshot(eventName: string): void {
    diagramGlobal.bodyLog.push({
      event: eventName,
      // A diagram's labels may hold paragraphs too.
      paragraphs: body.querySelectorAll("p:not(figure p)").length,
      codeBlocks: body.querySelectorAll("pre > code.language-mermaid").length,
      figures: body.querySelectorAll("figure[data-mermaid-source]").length,
    });
  }
  function isDiagramBlock(node: Node): node is Element {
    return (
      node instanceof Element &&
      (node.matches("pre:has(> code.language-mermaid)") ||
        node.matches("figure[data-mermaid-source]"))
    );
  }
  function logBusyChange(change: BusyChange["change"], node: Element): void {
    diagramGlobal.busyLog.push({
      change,
      tag: node.tagName.toLowerCase(),
      busy: node.getAttribute("aria-busy"),
    });
  }
  function logBusyChanges(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === "attributes" && isDiagramBlock(record.target)) {
        logBusyChange("busy", record.target);
      }
      for (const node of record.removedNodes) {
        if (isDiagramBlock(node)) {
          logBusyChange("removed", node);
        }
      }
      for (const node of record.addedNodes) {
        if (isDiagramBlock(node) && node.tagName === "FIGURE") {
          logBusyChange("added", node);
        }
      }
    }
  }
  function logEvent(event: Event): void {
    logSnapshot(event.type);
  }
  function logPaint(): void {
    logSnapshot("paint");
  }
  function requestPaintSnapshot(): void {
    requestAnimationFrame(logPaint);
  }
  function setNextTileOnInstall(
    records: MutationRecord[],
    observer: MutationObserver,
  ): void {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeName === "SCRIPT") {
          observer.disconnect();
          body.tile = diagramGlobal.probe.context.tiles[options.nextIndex ?? 0];
          return;
        }
      }
    }
  }

  if (options.diagrams !== undefined) {
    body.diagrams = options.diagrams;
  }
  body.addEventListener("ot-rendered", logEvent);
  body.addEventListener("ot-rendered", requestPaintSnapshot, { once: true });
  body.addEventListener("ot-diagrams-drawn", logEvent);
  new MutationObserver(logBusyChanges).observe(body, {
    subtree: true,
    childList: true,
    attributeFilter: ["aria-busy"],
  });
  if (options.nextIndex !== undefined) {
    new MutationObserver(setNextTileOnInstall).observe(document.head, {
      childList: true,
    });
  }
  document.body.append(body);
  body.tile = diagramGlobal.probe.context.tiles[options.index];
}

function readBusyLog(): BusyChange[] {
  return (globalThis as unknown as DiagramGlobal).busyLog;
}

function clearBusyLog(): void {
  (globalThis as unknown as DiagramGlobal).busyLog = [];
}

/** Runs in the probe's frame: the elements of the document with an `aria-busy` attribute. */
function countBusyElements(): number {
  return document.querySelectorAll("[aria-busy]").length;
}

function readBodyLog(): BodySnapshot[] {
  return (globalThis as unknown as DiagramGlobal).bodyLog;
}

function listLoggedEvents(): string[] {
  const events: string[] = [];
  for (const snapshot of (globalThis as unknown as DiagramGlobal).bodyLog) {
    events.push(snapshot.event);
  }
  return events;
}

function countDrawnEvents(): number {
  let count = 0;
  for (const snapshot of (globalThis as unknown as DiagramGlobal).bodyLog) {
    if (snapshot.event === "ot-diagrams-drawn") {
      count += 1;
    }
  }
  return count;
}

function readMermaidType(): string {
  return typeof (globalThis as { mermaid?: unknown }).mermaid;
}

/** What one diagram figure of the body holds. */
interface FigureContent {
  source: string;
  svgs: number;
  text: string;
  images: number;
  onerrors: number;
  foreignObjects: number;
}

/** Runs in the probe's frame: what the body's diagram figures hold. */
function readFigures(): FigureContent[] {
  const figures: FigureContent[] = [];
  const body = (globalThis as unknown as DiagramGlobal).diagramBody;
  for (const figure of body.querySelectorAll("figure[data-mermaid-source]")) {
    figures.push({
      source: (figure as HTMLElement).dataset.mermaidSource ?? "",
      svgs: figure.querySelectorAll("svg").length,
      text: figure.textContent ?? "",
      images: figure.querySelectorAll("img").length,
      onerrors: figure.querySelectorAll("[onerror]").length,
      foreignObjects: figure.querySelectorAll("foreignObject").length,
    });
  }
  return figures;
}

/** Runs in the probe's frame: the texts of the body's mermaid code blocks. */
function readCodeBlocks(): string[] {
  const texts: string[] = [];
  const body = (globalThis as unknown as DiagramGlobal).diagramBody;
  for (const code of body.querySelectorAll("pre > code.language-mermaid")) {
    texts.push(code.textContent ?? "");
  }
  return texts;
}

/** Runs in the probe's frame: the SVGs outside a diagram figure, such as mermaid's error drawings. */
function countStraySvgs(): number {
  return document.querySelectorAll("svg:not(figure[data-mermaid-source] svg)")
    .length;
}

/** Runs in the probe's frame: the fill of the diagram's first node shape. */
function readNodeFill(): string {
  const shape = (
    globalThis as unknown as DiagramGlobal
  ).diagramBody.querySelector(
    "figure .node rect, figure .node path, figure .node polygon",
  );
  if (shape === null) {
    return "";
  }
  return getComputedStyle(shape).fill;
}

function scrollToDiagramBlock(): void {
  (globalThis as unknown as DiagramGlobal).diagramBody
    .querySelector("pre > code.language-mermaid")
    ?.scrollIntoView();
}

/** Runs in the probe's frame: resolves after two paints and `delayMs`, so a queued diagram would have started. */
async function waitForQuietFrame(delayMs: number): Promise<void> {
  function waitForPaint(resolve: (time: number) => void): void {
    requestAnimationFrame(resolve);
  }
  function waitForDelay(resolve: (value: unknown) => void): void {
    setTimeout(resolve, delayMs);
  }
  for (let paint = 0; paint < 2; paint += 1) {
    await new Promise(waitForPaint);
  }
  await new Promise(waitForDelay);
}

function recordMermaidChunk(requestedUrls: string[], request: Request): void {
  if (MERMAID_CHUNK_PATTERN.test(new URL(request.url()).pathname)) {
    requestedUrls.push(request.url());
  }
}

/** The requests for the mermaid chunk the page sends from now on. */
function collectMermaidChunkRequests(page: Page): string[] {
  const requestedUrls: string[] = [];
  page.on("request", recordMermaidChunk.bind(undefined, requestedUrls));
  return requestedUrls;
}

async function openDiagramProbe(page: Page): Promise<Frame> {
  const bodyProbe = await openBodyProbe(page, DIAGRAM_TILES);
  return bodyProbe.frame;
}

async function waitForDrawnEvents(frame: Frame, count: number): Promise<void> {
  await expect
    .poll(function readDrawnCount(): Promise<number> {
      return frame.evaluate(countDrawnEvents);
    })
    .toBe(count);
}

test.describe("The tile body element draws diagrams", function describeDrawing(): void {
  test("Body with a diagram", async function drawsDiagram({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: FLOWCHART_INDEX });
    await waitForDrawnEvents(frame, 1);

    const log = await frame.evaluate(readBodyLog);
    expect(log[0]).toEqual({
      event: "ot-rendered",
      paragraphs: 1,
      codeBlocks: 1,
      figures: 0,
    });
    expect(log[1]).toEqual({
      event: "paint",
      paragraphs: 1,
      codeBlocks: 1,
      figures: 0,
    });
    const figures = await frame.evaluate(readFigures);
    expect(figures).toHaveLength(1);
    expect(figures[0].svgs).toBe(1);
    expect(figures[0].text).toContain("Tile");
    expect(figures[0].text).toContain("Mod");
    expect(figures[0].source).toBe("flowchart LR\n  Tile --> Mod\n");
    expect(await frame.evaluate(readCodeBlocks)).toEqual([]);
  });

  test("Markup in a label", async function keepsLabelsAsText({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: MARKUP_INDEX });
    await waitForDrawnEvents(frame, 1);

    const figures = await frame.evaluate(readFigures);
    expect(figures).toHaveLength(1);
    expect(figures[0].svgs).toBe(1);
    expect(figures[0].images).toBe(0);
    expect(figures[0].onerrors).toBe(0);
  });
});

test.describe("A diagram's own configuration", function describeOwnConfiguration(): void {
  test("HTML labels in the diagram's configuration", async function keepsHtmlLabelsOff({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: HTML_LABELS_INDEX });
    await waitForDrawnEvents(frame, 1);

    const figures = await frame.evaluate(readFigures);
    expect(figures).toHaveLength(2);
    for (const figure of figures) {
      expect(figure.svgs).toBe(1);
      expect(figure.images).toBe(0);
      expect(figure.foreignObjects).toBe(0);
    }
  });
});

test.describe("Diagrams are drawn when they come into view", function describeInView(): void {
  test("Block below the fold", async function waitsForView({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);
    const chunkRequests = collectMermaidChunkRequests(page);

    await frame.evaluate(showDiagramBody, { index: BELOW_FOLD_INDEX });
    await frame.evaluate(waitForQuietFrame, 500);

    expect(chunkRequests).toEqual([]);
    expect(await frame.evaluate(readMermaidType)).toBe("undefined");
    expect(await frame.evaluate(countDrawnEvents)).toBe(0);

    await frame.evaluate(scrollToDiagramBlock);
    await waitForDrawnEvents(frame, 1);

    expect(chunkRequests).toHaveLength(1);
    expect(await frame.evaluate(readFigures)).toHaveLength(1);
  });
});

test.describe("Blocks being drawn are marked busy", function describeBusy(): void {
  test("Busy while drawing", async function marksBusyBlock({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: FLOWCHART_INDEX });
    await waitForDrawnEvents(frame, 1);

    expect(await frame.evaluate(readBusyLog)).toEqual([
      { change: "busy", tag: "pre", busy: "true" },
      { change: "removed", tag: "pre", busy: "true" },
      { change: "added", tag: "figure", busy: null },
    ]);
    expect(await frame.evaluate(countBusyElements)).toBe(0);
  });

  test("Failed block is not busy", async function unmarksFailedBlock({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: SYNTAX_ERROR_INDEX });
    await waitForDrawnEvents(frame, 1);

    expect(await frame.evaluate(readCodeBlocks)).toEqual([
      "flowchart LR\n  A -->\n",
    ]);
    expect(await frame.evaluate(readBusyLog)).toContainEqual({
      change: "busy",
      tag: "pre",
      busy: null,
    });
    expect(await frame.evaluate(countBusyElements)).toBe(0);
  });

  test("Busy while redrawn", async function marksRedrawnFigure({
    page,
  }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openDiagramProbe(page);
    await frame.evaluate(showDiagramBody, { index: FLOWCHART_INDEX });
    await waitForDrawnEvents(frame, 1);
    await frame.evaluate(clearBusyLog);

    await page.emulateMedia({ colorScheme: "dark" });
    await waitForDrawnEvents(frame, 2);

    expect(await frame.evaluate(readBusyLog)).toEqual([
      { change: "busy", tag: "figure", busy: "true" },
      { change: "removed", tag: "figure", busy: "true" },
      { change: "added", tag: "figure", busy: null },
    ]);
    expect(await frame.evaluate(countBusyElements)).toBe(0);
  });

  test("Not busy out of view or as code", async function leavesOtherBlocks({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: BELOW_FOLD_INDEX });
    await frame.evaluate(waitForQuietFrame, 500);

    expect(await frame.evaluate(readCodeBlocks)).toHaveLength(1);
    expect(await frame.evaluate(readBusyLog)).toEqual([]);
    expect(await frame.evaluate(countBusyElements)).toBe(0);

    await frame.evaluate(showDiagramBody, {
      index: FLOWCHART_INDEX,
      diagrams: "source",
    });
    await frame.evaluate(waitForQuietFrame, 500);

    expect(await frame.evaluate(readCodeBlocks)).toHaveLength(1);
    expect(await frame.evaluate(readBusyLog)).toEqual([]);
    expect(await frame.evaluate(countBusyElements)).toBe(0);
  });
});

test.describe("A block that fails stays as code", function describeFailures(): void {
  test("Syntax error", async function keepsFailingBlock({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: SYNTAX_ERROR_INDEX });
    await waitForDrawnEvents(frame, 1);

    expect(await frame.evaluate(readCodeBlocks)).toEqual([
      "flowchart LR\n  A -->\n",
    ]);
    const figures = await frame.evaluate(readFigures);
    expect(figures).toHaveLength(1);
    expect(figures[0].text).toContain("Tile");
    expect(await frame.evaluate(countStraySvgs)).toBe(0);
  });
});

test.describe("Diagrams follow the color scheme", function describeColorScheme(): void {
  test("Switch to dark", async function redrawsInDark({ page }): Promise<void> {
    await page.emulateMedia({ colorScheme: "light" });
    const frame = await openDiagramProbe(page);
    await frame.evaluate(showDiagramBody, { index: FLOWCHART_INDEX });
    await waitForDrawnEvents(frame, 1);
    const lightFill = await frame.evaluate(readNodeFill);
    await markFrame(frame);

    await page.emulateMedia({ colorScheme: "dark" });
    await waitForDrawnEvents(frame, 2);

    // The card token of each scheme: #ffffff and #18202c.
    expect(lightFill).toBe("rgb(255, 255, 255)");
    expect(await frame.evaluate(readNodeFill)).toBe("rgb(24, 32, 44)");
    expect(await frame.evaluate(readFigures)).toHaveLength(1);
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Diagrams drawn event", function describeDrawnEvent(): void {
  test("Events in order", async function firesInOrder({ page }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, { index: FLOWCHART_INDEX });
    await waitForDrawnEvents(frame, 1);

    const log = await frame.evaluate(readBodyLog);
    expect(log).toEqual([
      { event: "ot-rendered", paragraphs: 1, codeBlocks: 1, figures: 0 },
      { event: "paint", paragraphs: 1, codeBlocks: 1, figures: 0 },
      {
        event: "ot-diagrams-drawn",
        paragraphs: 1,
        codeBlocks: 0,
        figures: 1,
      },
    ]);
  });

  test("New tile while drawing", async function dropsReplacedBody({
    page,
  }): Promise<void> {
    const frame = await openDiagramProbe(page);

    await frame.evaluate(showDiagramBody, {
      index: FLOWCHART_INDEX,
      nextIndex: PLAIN_INDEX,
    });
    await expect
      .poll(function readEvents(): Promise<string[]> {
        return frame.evaluate(listLoggedEvents);
      })
      .toEqual(["ot-rendered", "paint", "ot-rendered"]);
    await expect
      .poll(function readType(): Promise<string> {
        return frame.evaluate(readMermaidType);
      })
      .toBe("object");
    await frame.evaluate(waitForQuietFrame, 500);

    const log = await frame.evaluate(readBodyLog);
    expect(log[2]).toEqual({
      event: "ot-rendered",
      paragraphs: 1,
      codeBlocks: 0,
      figures: 0,
    });
    expect(await frame.evaluate(listLoggedEvents)).toEqual([
      "ot-rendered",
      "paint",
      "ot-rendered",
    ]);
    expect(await frame.evaluate(readFigures)).toEqual([]);
  });
});

test.describe("Keep diagrams as code", function describeSourceOnly(): void {
  test("Source only", async function keepsSource({ page }): Promise<void> {
    const frame = await openDiagramProbe(page);
    const chunkRequests = collectMermaidChunkRequests(page);

    await frame.evaluate(showDiagramBody, {
      index: FLOWCHART_INDEX,
      diagrams: "source",
    });
    await frame.evaluate(waitForQuietFrame, 500);

    expect(await frame.evaluate(readCodeBlocks)).toEqual([
      "flowchart LR\n  Tile --> Mod\n",
    ]);
    expect(await frame.evaluate(readFigures)).toEqual([]);
    expect(await frame.evaluate(countDrawnEvents)).toBe(0);
    expect(await frame.evaluate(readMermaidType)).toBe("undefined");
    expect(chunkRequests).toEqual([]);
  });
});
