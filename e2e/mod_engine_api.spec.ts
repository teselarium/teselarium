import { expect, test } from "@playwright/test";
import type { Frame, Page, Route } from "@playwright/test";
import { HOME_MOD_PREVIEW_URL } from "./app_servers.ts";
import {
  actionDialog,
  buildProbeFiles,
  findModFrame,
  postRequestToParent,
  readProbeCalls,
  readWindowMessages,
  registerTwoTileHandlers,
  PROBE_MOD_CODE,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  startProbeRequests,
  waitForProbe,
} from "./mod_routes.ts";
import {
  MISSING_TEST_MOD_REFERENCE,
  openTilesMod,
  readTilesModSource,
  serveTilesMod,
  TILES_MOD_REFERENCE,
  TILES_TITLE,
} from "./test_mods.ts";

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

    test("Several handlers for one event", async function callsHandlersInOrder({
      page,
    }): Promise<void> {
      const frame = await openTilesMod(page);
      await frame.evaluate(registerTwoTileHandlers);

      await stageBar(page)
        .getByRole("button", { name: "Reload tiles" })
        .click();

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

test.describe(
  "Storage slots are separate per mod source",
  { tag: "@frames" },
  function describeSlots(): void {
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
