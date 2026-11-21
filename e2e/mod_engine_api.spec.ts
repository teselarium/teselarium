import { expect, test } from "@playwright/test";
import type { Frame, Page, Route } from "@playwright/test";
import { HOME_MOD_PREVIEW_URL } from "./app_servers.ts";
import {
  actionDialog,
  APP_ORIGIN_MOD_PATH,
  buildProbeFiles,
  findModFrame,
  OTHER_API_RANGE,
  postRequestToParent,
  PROBE_MOD_CODE,
  readProbeCalls,
  readProbeContext,
  readWindowMessages,
  registerTwoTileHandlers,
  reloadTiles,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import {
  buildLabelsMosaicFiles,
  buildNoteCollection,
  buildTilesModFiles,
  buildTypedProbeFiles,
  LABELS_COLLECTION_FILE,
  LABELS_MOSAIC_HASH,
  LABELS_MOSAIC_PATH,
  LABELS_MOSAIC_REFERENCE,
  LABELS_MOSAIC_TITLE,
  MISSING_TEST_MOD_REFERENCE,
  openTilesMod,
  readTilesModSource,
  serveTilesMod,
  TILES_COLLECTION_PATH,
  TILES_MOD_REFERENCE,
  TILES_RUN_HASH,
  TILES_TITLE,
  TYPED_PROBE_COLLECTION_REFERENCE,
} from "./test_mods.ts";

const PROBE_LINK = "/#/run?mod=./test-mods/probe/";

/** `./test-mods/tiles/items/first.md`: the first item of the tiles mod, as a run link names it. */
const TILES_FIRST_ITEM_REFERENCE = `.${APP_ORIGIN_MOD_PATH}tiles/items/first.md`;
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

test.describe(
  "Private channel per mod",
  { tag: "@frames" },
  function describeChannel(): void {
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
  },
);

test.describe(
  "Engine API object in the frame",
  { tag: "@frames" },
  function describeEngineApi(): void {
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

      const answer = await frame.evaluate(requestFromProbe, [
        "tiles.delete",
        {},
      ]);

      expect(answer.code).toBe(-32601);
      expect(answer.message).toContain("tiles.delete");
    });

    test("Missing mosaic", async function rejectsMissingMosaic({
      page,
    }): Promise<void> {
      const frame = await openProbe(page);

      const answer = await frame.evaluate(requestFromProbe, [
        "userCatalog.export",
        {},
      ]);

      expect(answer).toEqual({
        code: -32602,
        message: 'userCatalog.export: "mosaic" must be a non-empty string',
      });
      await expect(actionDialog(page)).toBeHidden();
    });

    test("Several handlers for one event", async function callsHandlersInOrder({
      page,
    }): Promise<void> {
      const frame = await openTilesMod(page);
      await frame.evaluate(registerTwoTileHandlers);

      await reloadTiles(page);

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
  },
);

function countItems(items: unknown[]): number {
  return items.length;
}

/** `./test-mods/other.yaml`: a second collection of the typed probe. */
const OTHER_PROBE_COLLECTION_REFERENCE = "./test-mods/other.yaml";

/** `./test-mods/notes_mosaic.yaml`: a mosaic of the typed probe with its first collection. */
const PROBE_MOSAIC_REFERENCE = "./test-mods/notes_mosaic.yaml";

/** The typed probe with two collections and a mosaic of the first one. */
function buildSlotContextFiles(): Record<string, string> {
  const files = {
    ...buildTypedProbeFiles(),
    "collection.yaml": buildNoteCollection([]),
    "other.yaml": buildNoteCollection(["./second.md"]),
    "notes_mosaic.yaml": [
      "mosaic:",
      '  title: "Probe notes"',
      '  mod: "./probe/"',
      '  collection: "./collection.yaml"',
      "",
    ].join("\n"),
  };
  return files;
}

/** Opens `link` as the only sandbox, the probe, and waits for its mount. */
async function openProbeOnly(page: Page, link: string): Promise<Frame> {
  await page.goto(link);
  await page.reload();
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

function readSelected(frame: Frame): Promise<unknown> {
  return frame.evaluate(requestFromProbe, ["storage.get", { key: "selected" }]);
}

test.describe(
  "Storage slots are separate per mod and context",
  { tag: "@frames" },
  function describeSlots(): void {
    test("Two collections and a mosaic", async function separatesContexts({
      page,
    }): Promise<void> {
      await serveAppOriginMod(page, buildSlotContextFiles());
      const collectionLink = `${PROBE_LINK}&collection=${TYPED_PROBE_COLLECTION_REFERENCE}`;
      const frame = await openProbeOnly(page, collectionLink);
      await frame.evaluate(requestFromProbe, [
        "storage.set",
        { key: "selected", value: "first" },
      ]);

      const otherFrame = await openProbeOnly(
        page,
        `${PROBE_LINK}&collection=${OTHER_PROBE_COLLECTION_REFERENCE}`,
      );
      expect(await readSelected(otherFrame)).toEqual({ result: null });

      const mosaicFrame = await openProbeOnly(
        page,
        `/#/run?mosaic=${PROBE_MOSAIC_REFERENCE}`,
      );
      expect(await readSelected(mosaicFrame)).toEqual({ result: null });

      const sameFrame = await openProbeOnly(page, collectionLink);
      expect(await readSelected(sameFrame)).toEqual({ result: "first" });
    });

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
  },
);

test.describe(
  "Open a mod in a new sandbox",
  { tag: "@frames" },
  function describeOpen(): void {
    test("Explorer opens the viewer", async function opensViewer({
      page,
    }): Promise<void> {
      const frame = await openProbe(page, OPEN_ANY_SITE_LINES);
      const target = readTilesModSource(page);

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
        { mod: MISSING_TEST_MOD_REFERENCE },
      ]);

      expect(answer).toEqual({ result: null });
      await expect(page.getByRole("alert")).toContainText("404");
      await expect(page.locator('[data-sandbox-id="sandbox-1"]')).toBeHidden();
    });
  },
);

/** Serves the probe and a second probe, `other`, both allowed to open any mod, and the tiles mod. */
async function serveOpeningProbes(page: Page): Promise<void> {
  await serveTilesMod(page, {
    ...buildProbeFiles("probe", OPEN_ANY_SITE_LINES),
    ...buildProbeFiles("other", OPEN_ANY_SITE_LINES),
  });
}

/** Opens the probe, then `other` from it with `mods.open`, and waits for `other`'s mount. */
async function openOtherFromProbe(
  page: Page,
): Promise<{ probeFrame: Frame; otherFrame: Frame }> {
  await serveOpeningProbes(page);
  await page.goto(PROBE_LINK);
  const probeFrame = await findModFrame(page, "probe");
  await waitForProbe(probeFrame);
  await probeFrame.evaluate(requestFromProbe, [
    "mods.open",
    { mod: "./test-mods/other/" },
  ]);
  await expect(page.locator('iframe[title="other"]')).toBeVisible();
  const otherFrame = await findModFrame(page, "other");
  await waitForProbe(otherFrame);
  const frames = { probeFrame, otherFrame };
  return frames;
}

/** The tiles mod opened with its first item as its tile, in place of the requester. */
const REPLACING_OPEN = {
  mod: TILES_MOD_REFERENCE,
  tile: "./test-mods/tiles/items/first.md",
  replace: true,
};

/** `**\/default_mods/mod_explorer/main.js`: the mod explorer's entrypoint, which the Home mod of `e2e-home-mod` runs. */
const EXPLORER_ENTRYPOINT_GLOB = "**/default_mods/mod_explorer/main.js";

async function answerProbeCode(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: PROBE_MOD_CODE,
  });
}

test.describe(
  "Open a mod in place of the requester",
  { tag: "@frames" },
  function describeReplace(): void {
    test("Viewer replaces itself", async function replacesItself({
      page,
    }): Promise<void> {
      const { otherFrame } = await openOtherFromProbe(page);

      await otherFrame.evaluate(startProbeRequests, [
        ["mods.open", REPLACING_OPEN],
      ]);

      const tilesFrame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
      await expect(tilesFrame.getByRole("listitem")).toHaveText(["First item"]);
      await expect(page.locator('iframe[title="other"]')).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(2);
      expect(new URL(page.url()).hash).toContain("tile=");

      await page.goBack();

      await expect(page.locator('iframe[title="probe"]')).toBeVisible();
      await expect(page.locator(`iframe[title="${TILES_TITLE}"]`)).toBeHidden();
    });

    test("Hidden mod cannot replace itself", async function refusesHidden({
      page,
    }): Promise<void> {
      const { probeFrame } = await openOtherFromProbe(page);

      const answer = await probeFrame.evaluate(requestFromProbe, [
        "mods.open",
        REPLACING_OPEN,
      ]);

      expect(answer.code).toBe(-32002);
      expect(answer.message).toBe(
        "mods.open: only the visible mod can open mods",
      );
      await expect(page.locator('iframe[title="other"]')).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(2);
    });

    test("Dialogs of the replaced mod", async function dropsDialogs({
      page,
    }): Promise<void> {
      const { otherFrame } = await openOtherFromProbe(page);
      await otherFrame.evaluate(startProbeRequests, [
        ["ui.confirm", { message: "Delete this list?" }],
      ]);
      await expect(actionDialog(page)).toContainText("Delete this list?");

      await otherFrame.evaluate(startProbeRequests, [
        ["mods.open", REPLACING_OPEN],
      ]);

      await expect(actionDialog(page)).toHaveCount(0);
      const tilesFrame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
      await expect(tilesFrame.getByRole("listitem")).toHaveText(["First item"]);
      await expect(page.locator('iframe[title="other"]')).toHaveCount(0);
    });

    test("Home mod cannot be replaced", async function refusesHomeMod({
      page,
    }): Promise<void> {
      await page.route(EXPLORER_ENTRYPOINT_GLOB, answerProbeCode);
      await page.goto(`${HOME_MOD_PREVIEW_URL}/`);
      const homeFrame = await findModFrame(page, "Mods");
      await waitForProbe(homeFrame);

      const answer = await homeFrame.evaluate(requestFromProbe, [
        "mods.open",
        { mod: "mod_viewer", replace: true },
      ]);

      expect(answer.code).toBe(-32002);
      expect(answer.message).toBe("mods.open: the home mod cannot be replaced");
      await expect(page.locator('iframe[title="Mods"]')).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(1);
      expect(new URL(page.url()).hash).toBe("#/");
    });
  },
);

test.describe("Collection of the mount context", function describeContextCollection(): void {
  test("Mod opened with a collection", async function givesContextCollection({
    page,
  }): Promise<void> {
    const frame = await openTilesMod(page);

    const context = await frame.evaluate(readProbeContext);

    expect(context.collection).toEqual({
      source: new URL(TILES_COLLECTION_PATH, page.url()).href,
      title: "Three items",
      description: "The collection of the tiles mod's default mosaic.",
    });
  });

  test("Mount context of a tile", async function givesTileNullCollection({
    page,
  }): Promise<void> {
    const frame = await openTilesMod(
      page,
      `${TILES_RUN_HASH}&tile=${TILES_FIRST_ITEM_REFERENCE}`,
    );

    const context = await frame.evaluate(readProbeContext);

    expect(context.tiles).toHaveLength(1);
    expect(context.collection).toBeNull();
  });

  test("Mod opened without a collection", async function givesNullCollection({
    page,
  }): Promise<void> {
    const frame = await openTilesMod(page, TILES_RUN_HASH);

    const context = await frame.evaluate(readProbeContext);

    expect(context.collection).toBeNull();
  });
});

test.describe("Mods opened from a mosaic", function describeMosaicLaunch(): void {
  test("Mosaic of the tiles mod", async function givesMosaicContext({
    page,
  }): Promise<void> {
    await serveTilesMod(page, buildLabelsMosaicFiles());
    await page.goto(`/${LABELS_MOSAIC_HASH}&from=x`);
    const frame = await findModFrame(page, TILES_TITLE);
    await waitForProbe(frame);

    const context = await frame.evaluate(readProbeContext);

    expect(context.mosaic).toEqual({
      source: new URL(LABELS_MOSAIC_PATH, page.url()).href,
      title: LABELS_MOSAIC_TITLE,
      description: "The tiles mod on labelled tiles.",
    });
    expect(context.collection).toEqual({
      source: new URL(
        `${APP_ORIGIN_MOD_PATH}${LABELS_COLLECTION_FILE}`,
        page.url(),
      ).href,
      title: "Labelled tiles",
      description: "",
    });
    expect(context.config).toEqual({
      show_images: false,
      empty_text: "There are no tiles to show.",
    });
    expect(context.params).toEqual({ from: "x" });
    const tiles = context.tiles as { metadata: Record<string, unknown> }[];
    expect(tiles).toHaveLength(1);
    expect(tiles[0].metadata).toEqual({ title: "First label" });
  });

  test("Missing collection of a mosaic", async function namesMissingCollection({
    page,
  }): Promise<void> {
    const files = buildLabelsMosaicFiles();
    delete files[LABELS_COLLECTION_FILE];
    await serveTilesMod(page, files);

    await page.goto(`/${LABELS_MOSAIC_HASH}`);

    const collectionSource = new URL(
      `/test-mods/${LABELS_COLLECTION_FILE}`,
      page.url(),
    ).href;
    await expect(page.getByRole("alert")).toContainText(collectionSource);
    await expect(page.getByRole("alert")).toContainText("404");
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("Mosaic of a mod for another API", async function asksApiQuestion({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      ...buildProbeFiles("later", [], OTHER_API_RANGE),
      "mosaics/later.yaml": [
        "mosaic:",
        '  title: "Later mosaic"',
        '  mod: "../later/"',
      ].join("\n"),
    });

    await page.goto("/#/run?mosaic=./test-mods/mosaics/later.yaml");

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(OTHER_API_RANGE);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});

test.describe("Inspecting and opening mosaics", function describeMosaicMethods(): void {
  test("Open the labels mosaic", async function opensMosaic({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, {
      ...buildProbeFiles("probe", OPEN_ANY_SITE_LINES),
      ...buildTilesModFiles(),
      ...buildLabelsMosaicFiles(),
    });
    await page.goto(PROBE_LINK);
    const probeFrame = await findModFrame(page, "probe");
    await waitForProbe(probeFrame);
    const mosaicSource = new URL(LABELS_MOSAIC_PATH, page.url()).href;

    const inspection = await probeFrame.evaluate(requestFromProbe, [
      "mosaics.inspect",
      { mosaic: LABELS_MOSAIC_REFERENCE },
    ]);
    await probeFrame.evaluate(startProbeRequests, [
      [
        "mosaics.open",
        { mosaic: LABELS_MOSAIC_REFERENCE, params: { from: "probe" } },
      ],
    ]);

    expect(inspection.result).toMatchObject({
      source: mosaicSource,
      title: LABELS_MOSAIC_TITLE,
      mod: new URL("/test-mods/tiles/mod_conf.yaml", page.url()).href,
      aliases: { title: ["label"] },
    });
    const tilesFrame = page.frameLocator(`iframe[title="${TILES_TITLE}"]`);
    await expect(tilesFrame.getByRole("listitem")).toHaveText(["First label"]);
    await expect(page.locator('iframe[title="probe"]')).toBeHidden();
    const hash = new URL(page.url()).hash;
    const query = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));
    expect(hash.startsWith("#/run?mosaic=")).toBe(true);
    expect(query.get("mosaic")).toBe(mosaicSource);
    expect(query.get("from")).toBe("probe");
    expect(query.has("mod")).toBe(false);
  });
});
