import { expect, test } from "@playwright/test";
import type { Frame, Page } from "@playwright/test";
import {
  buildProbeFiles,
  findModFrame,
  postRequestToParent,
  readProbeCalls,
  readWindowMessages,
  registerTwoTileHandlers,
  requestFromProbe,
  serveAppOriginMod,
  stageBar,
  waitForProbe,
} from "./mod_routes.ts";
import {
  MISSING_TEST_MOD_REFERENCE,
  openTilesMod,
  readTilesModSource,
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
