import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import {
  buildModConf,
  buildProbeFiles,
  findModFrame,
  ICON_SVG,
  postRequestToParent,
  readLoadedCovers,
  readProbeCalls,
  readProbeContext,
  readWindowMessages,
  registerTwoTileHandlers,
  requestFromProbe,
  serveAppOriginMod,
  serveForeignMod,
  stageBar,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  MISSING_MOD_REFERENCE,
  readSampleModSource,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_ENTRYPOINT_CODE,
  SAMPLE_MOD_FILE_PATH,
} from "./sample_mod.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";
const OPEN_ANY_SITE_LINES = [
  "  permissions:",
  "    open:",
  '      - host: "*"',
  '        reason: "Opens mods"',
];

async function openProbe(
  page: Page,
  extraLines: string[] = [],
  link: string = PROBE_LINK,
): Promise<Frame> {
  await serveAppOriginMod(page, buildProbeFiles("probe", extraLines));
  await page.goto(link);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

function waitBriefly(page: Page): Promise<void> {
  return page.waitForTimeout(300);
}

test.describe("Private channel per mod", function describeChannel(): void {
  test("Requests on the private channel are answered", async function answersRequest({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    const answer = await frame.evaluate(requestFromProbe, [
      "storage.get",
      { key: "selected" },
    ]);

    expect(answer).toEqual({ result: null });
  });

  test("Window messages are ignored", async function ignoresWindowMessages({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await frame.evaluate(postRequestToParent);
    await waitBriefly(page);

    expect(await frame.evaluate(readWindowMessages)).toEqual([]);
    expect(
      await frame.evaluate(requestFromProbe, [
        "storage.get",
        { key: "selected" },
      ]),
    ).toEqual({ result: null });
  });
});

test.describe("Engine API object in the frame", function describeEngineApi(): void {
  test("Request resolves with the result", async function resolvesResult({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    await frame.evaluate(requestFromProbe, [
      "storage.set",
      { key: "selected", value: "kallocain" },
    ]);
    const answer = await frame.evaluate(requestFromProbe, [
      "storage.get",
      { key: "selected" },
    ]);

    expect(answer).toEqual({ result: "kallocain" });
  });

  test("Request rejects with the error", async function rejectsError({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);

    const answer = await frame.evaluate(requestFromProbe, ["tiles.delete", {}]);

    expect(answer.code).toBe(-32601);
    expect(answer.message).toContain("tiles.delete");
  });

  test("Several handlers for one event", async function callsHandlersInOrder({
    page,
  }): Promise<void> {
    const frame = await openProbe(
      page,
      [],
      `${PROBE_LINK}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    await frame.evaluate(registerTwoTileHandlers);

    await stageBar(page).getByRole("button", { name: "Reload tiles" }).click();

    await expect
      .poll(function readCallCount(): Promise<number> {
        return frame.evaluate(readProbeCalls).then(countItems);
      })
      .toBe(4);
    const calls = await frame.evaluate(readProbeCalls);
    expect(calls[0]).toBe("first");
    expect(calls[2]).toBe("second");
    expect(calls[1]).toEqual(calls[3]);
    expect((calls[1] as { tiles: unknown[] }).tiles).toHaveLength(3);
  });
});

function countItems(items: unknown[]): number {
  return items.length;
}

test.describe("Mount context", function describeMountContext(): void {
  test("Link parameters", async function readsParams({ page }): Promise<void> {
    const target = `https://example.org${SAMPLE_MOD_FILE_PATH}`;
    const frame = await openProbe(
      page,
      [],
      `${PROBE_LINK}&target=${encodeURIComponent(target)}`,
    );

    const context = await frame.evaluate(readProbeContext);

    expect(context.params).toEqual({ target });
  });
});

/** `/test-mods/covers/books/cover.svg`: the image next to the tile of `buildRelativeCoverFiles`. */
const RELATIVE_COVER_PATH = "/test-mods/covers/books/cover.svg";

/**
 * The files of a mod running the sample entrypoint with `show_covers: true`
 * and no tile type, and of a collection whose one tile has
 * `image: "./cover.svg"`, served next to it.
 */
function buildRelativeCoverFiles(): ModFiles {
  const files: ModFiles = {
    "covers/mod_conf.yaml": buildModConf("covers", [
      '  title: "Covers"',
      "  config:",
      "    show_covers: true",
    ]),
    "covers/main.js": SAMPLE_ENTRYPOINT_CODE,
    "covers/tiles.yaml": [
      "collection:",
      '  name: "Covers"',
      "  tiles:",
      '    - path: "./books/kallocain.md"',
    ].join("\n"),
    "covers/books/kallocain.md":
      '---\ntitle: "Kallocain"\nimage: "./cover.svg"\n---\n\nA tile with a cover next to it.\n',
    "covers/books/cover.svg": ICON_SVG,
  };
  return files;
}

test.describe("Relative paths in tiles are resolved", function describeRelativeTilePaths(): void {
  test("Image next to the tile", async function showsCoverNextToTile({
    page,
  }): Promise<void> {
    const seenUrls = await serveAppOriginMod(page, buildRelativeCoverFiles());
    await page.goto(
      "/#/run?mod=./test-mods/covers/&collection=./test-mods/covers/tiles.yaml",
    );
    const frame = await findModFrame(page, "Covers");

    await expect
      .poll(function listCovers(): Promise<string[]> {
        return frame.evaluate(readLoadedCovers);
      })
      .toEqual(["Cover of Kallocain"]);
    expect(seenUrls).toContain(new URL(RELATIVE_COVER_PATH, page.url()).href);
  });
});

test.describe("Storage slots are separate per mod source", function describeSlots(): void {
  test("Value kept after a reload", async function keepsValue({
    page,
  }): Promise<void> {
    const frame = await openProbe(page);
    await frame.evaluate(requestFromProbe, [
      "storage.set",
      { key: "selected", value: { source: "kallocain" } },
    ]);

    await page.reload();
    const reloadedFrame = await findModFrame(page, "probe");
    await waitForProbe(reloadedFrame);

    expect(
      await reloadedFrame.evaluate(requestFromProbe, [
        "storage.get",
        { key: "selected" },
      ]),
    ).toEqual({ result: { source: "kallocain" } });
  });
});

test.describe("Open a mod in a new sandbox", function describeOpen(): void {
  test("Explorer opens the viewer", async function opensViewer({
    page,
  }): Promise<void> {
    const frame = await openProbe(page, OPEN_ANY_SITE_LINES);
    const target = readSampleModSource(page);

    const answer = await frame.evaluate(requestFromProbe, [
      "mods.open",
      { mod: "mod_viewer", params: { target } },
    ]);

    expect(answer).toEqual({ result: null });
    await expect(stageBar(page)).toContainText("Mod Viewer");
    await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
    expect(new URL(page.url()).hash).toBe(
      `#/run?mod=mod_viewer&target=${encodeURIComponent(target)}`,
    );
  });

  test("Opened mod is missing", async function opensMissingMod({
    page,
  }): Promise<void> {
    const frame = await openProbe(page, OPEN_ANY_SITE_LINES);

    const answer = await frame.evaluate(requestFromProbe, [
      "mods.open",
      { mod: MISSING_MOD_REFERENCE },
    ]);

    expect(answer).toEqual({ result: null });
    await expect(page.getByRole("alert")).toContainText("404");
    await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
  });

  test("Hidden mod tries to open a mod", async function refusesHiddenMod({
    page,
  }): Promise<void> {
    const frame = await openProbe(page, OPEN_ANY_SITE_LINES);
    await frame.evaluate(requestFromProbe, [
      "mods.open",
      { mod: "mod_viewer" },
    ]);
    await expect(stageBar(page)).toContainText("Mod Viewer");

    const answer = await frame.evaluate(requestFromProbe, [
      "mods.open",
      { mod: "mod_explorer" },
    ]);

    expect(answer.code).toBe(-32002);
    expect(answer.message).toContain("only the visible mod can open mods");
    await expect(stageBar(page)).toContainText("Mod Viewer");
  });
});

test.describe("Inspecting and opening need the open permission", function describeOpenPermission(): void {
  test("Mod without the open permission", async function refusesWithoutOpen({
    page,
  }): Promise<void> {
    const foreignUrls = await serveForeignMod(page, buildProbeFiles("clock"));
    const frame = await openProbe(page);

    const answer = await frame.evaluate(requestFromProbe, [
      "mods.inspect",
      { mod: "https://mods.example.net/clock/" },
    ]);

    expect(answer.code).toBe(-32002);
    expect(answer.message).toContain("https://mods.example.net");
    expect(answer.message).toContain("permissions.open");
    expect(foreignUrls).toEqual([]);
  });
});
