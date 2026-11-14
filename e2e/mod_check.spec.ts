import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";
import {
  buildAnimationFrameFiles,
  buildCheckerFiles,
  buildConfirmingFiles,
  buildProbeFiles,
  buildSlotReporterFiles,
  buildNeverMountedFiles,
  buildTestModReference,
  buildThrowingFiles,
  buildUndeclaredImageFiles,
  buildUnknownMethodFiles,
  CHECK_FRAME_SELECTOR,
  CHECK_LIMIT_MS,
  CHECKER_HASH,
  CHECKER_TITLE,
  checkFromChecker,
  checkPastLimit,
  findModFrame,
  openChecker,
  readReportedValue,
  readTestModSource,
  requestFromProbe,
  serveAppOriginMod,
  SLOT_REPORTER_KEY,
  SLOT_REPORTER_NAME,
  UNDECLARED_IMAGE_HOST,
  waitForProbe,
} from "./mod_routes.ts";
import {
  buildTilesModFiles,
  readTilesModSource,
  TILES_MOD_REFERENCE,
  TILES_TEST_RESULTS,
} from "./test_mods.ts";

/** The run link of the slot reporter, opened so that it reports nothing. */
const QUIET_SLOT_REPORTER_LINK = `/#/run?mod=${buildTestModReference(SLOT_REPORTER_NAME)}&quiet=yes`;

test.describe(
  "Check a mod",
  { tag: "@frames" },
  function describeCheckMod(): void {
    test("Check the sample mod", async function checksPassingMod({
      page,
    }): Promise<void> {
      await openChecker(page, buildTilesModFiles());

      const report = await checkFromChecker(page, TILES_MOD_REFERENCE);

      expect(report).toEqual({
        source: readTilesModSource(page),
        status: "pass",
        mountChecked: true,
        testsChecked: true,
        tests: TILES_TEST_RESULTS,
        findings: [],
      });
    });

    test("Shipped mods pass", async function checksShippedMods({
      page,
    }): Promise<void> {
      await openChecker(page, {});

      for (const mod of ["mod_explorer", "mod_viewer"]) {
        const report = await checkFromChecker(page, mod);

        expect(report, `the check of ${mod}`).toMatchObject({
          status: "pass",
          mountChecked: true,
          findings: [],
        });
      }
    });
  },
);

/** The vanilla app's npm host, answered with a 404 so no test reaches the network. */
const NPM_HOST = "https://cdn.jsdelivr.net/npm/";
const MISSING_LIBRARY_FILE_URL = `${NPM_HOST}leaflet@1.9.4/dist/missing.js`;
/** jsDelivr's text for a file a published version does not have. */
const MISSING_LIBRARY_FILE_TEXT =
  "Couldn't find the requested file /dist/missing.js in leaflet.";

async function answerMissingNpmFile(route: Route): Promise<void> {
  await route.fulfill({
    status: 404,
    headers: { "Access-Control-Allow-Origin": "*" },
    contentType: "text/plain; charset=utf-8",
    body: MISSING_LIBRARY_FILE_TEXT,
  });
}

test.describe(
  "Bundle check",
  { tag: "@frames" },
  function describeBundleCheck(): void {
    test("Missing library file", async function reportsMissingLibraryFile({
      page,
    }): Promise<void> {
      await page.route(`${NPM_HOST}**`, answerMissingNpmFile);
      await openChecker(
        page,
        buildProbeFiles("missing_library", [
          "  libraries:",
          "    leaflet:",
          '      npm: "leaflet@1.9.4"',
          '      files: ["dist/missing.js"]',
        ]),
      );

      const report = await checkFromChecker(
        page,
        buildTestModReference("missing_library"),
      );

      expect(report).toMatchObject({
        source: readTestModSource(page, "missing_library"),
        status: "fail",
        mountChecked: false,
      });
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "bundle",
        level: "error",
        source: MISSING_LIBRARY_FILE_URL,
      });
      expect(report.findings[0].message).toContain('"leaflet"');
      expect(report.findings[0].message).toContain("404");
      expect(report.findings[0].message).toContain(MISSING_LIBRARY_FILE_TEXT);
    });
  },
);

test.describe(
  "Mount check",
  { tag: "@frames" },
  function describeMountCheck(): void {
    test("Frame removed after the check", async function removesFrame({
      page,
    }): Promise<void> {
      await openChecker(page, buildTilesModFiles());

      await checkFromChecker(page, TILES_MOD_REFERENCE);

      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });

    test("Mount awaiting an animation frame", async function passesAnimationFrame({
      page,
    }): Promise<void> {
      await openChecker(page, buildAnimationFrameFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("animation_frame"),
      );

      expect(report).toMatchObject({ status: "pass", findings: [] });
    });
  },
);

test.describe(
  "What the mount check records",
  { tag: "@frames" },
  function describeMountRecords(): void {
    test("Mount throws", async function recordsThrow({ page }): Promise<void> {
      await openChecker(page, buildThrowingFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("throwing"),
      );

      expect(report.status).toBe("fail");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "mount",
        level: "error",
      });
      expect(report.findings[0].message).toContain("map failed");
    });

    test("Unknown method", async function recordsUnknownMethod({
      page,
    }): Promise<void> {
      await openChecker(page, buildUnknownMethodFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("unknown_method"),
      );

      expect(report.status).toBe("fail");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "mount",
        level: "error",
      });
      expect(report.findings[0].message).toContain("tiles.delete");
      expect(report.findings[0].message).toContain("Unknown method");
    });

    test("Blocked image", async function recordsBlockedImage({
      page,
    }): Promise<void> {
      await openChecker(page, buildUndeclaredImageFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("undeclared_image"),
      );

      expect(report.status).toBe("warn");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "mount",
        level: "warning",
      });
      expect(report.findings[0].message).toContain(UNDECLARED_IMAGE_HOST);
      expect(report.findings[0].message).toContain("permissions.show");
    });

    test("Mount never finishes", async function failsSlowMount({
      page,
    }): Promise<void> {
      await page.clock.install();
      const seenUrls = await openChecker(page, buildNeverMountedFiles());

      const { report, elapsedMs } = await checkPastLimit(
        page,
        buildTestModReference("never_mounted"),
        seenUrls,
      );

      expect(elapsedMs).toBeGreaterThanOrEqual(CHECK_LIMIT_MS);
      expect(report.status).toBe("fail");
      expect(report.findings).toEqual([
        {
          step: "mount",
          level: "error",
          source: readTestModSource(page, "never_mounted"),
          message: "The mod's mount did not finish within 10 seconds.",
        },
      ]);
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });
  },
);

test.describe(
  "Requests that need the user",
  { tag: "@frames" },
  function describeUserRequests(): void {
    test("Mod asks for a confirmation while mounting", async function answersConfirm({
      page,
    }): Promise<void> {
      const seenUrls = await openChecker(page, buildConfirmingFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("confirming"),
      );

      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(readReportedValue(seenUrls, "confirmed")).toBe(false);
      expect(report.status).toBe("warn");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "mount",
        level: "warning",
      });
      expect(report.findings[0].message).toContain("ui.confirm");
    });
  },
);

test.describe(
  "Throwaway storage slot",
  { tag: "@frames" },
  function describeThrowawaySlot(): void {
    test("Real slot untouched", async function keepsRealSlot({
      page,
    }): Promise<void> {
      const seenUrls = await serveAppOriginMod(page, {
        ...buildCheckerFiles(),
        ...buildSlotReporterFiles(),
      });
      await page.goto(QUIET_SLOT_REPORTER_LINK);
      const runningFrame = await findModFrame(page, SLOT_REPORTER_NAME);
      await waitForProbe(runningFrame);
      await runningFrame.evaluate(requestFromProbe, [
        "storage.set",
        { key: SLOT_REPORTER_KEY, value: 7 },
      ]);
      await page.goto(`/${CHECKER_HASH}`);
      await waitForProbe(await findModFrame(page, CHECKER_TITLE));

      const report = await checkFromChecker(
        page,
        buildTestModReference(SLOT_REPORTER_NAME),
      );
      // A new document, so the sandbox the value was stored in is gone.
      await page.goto("about:blank");
      await page.goto(QUIET_SLOT_REPORTER_LINK);
      const reopenedFrame = await findModFrame(page, SLOT_REPORTER_NAME);
      await waitForProbe(reopenedFrame);

      expect(report.status).toBe("pass");
      expect(readReportedValue(seenUrls, "stored")).toBeNull();
      expect(
        await reopenedFrame.evaluate(requestFromProbe, [
          "storage.get",
          { key: SLOT_REPORTER_KEY },
        ]),
      ).toEqual({ result: 7 });
    });
  },
);
