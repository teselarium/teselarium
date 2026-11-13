import { expect, test } from "@playwright/test";
import {
  buildAnimationFrameFiles,
  buildCheckerFiles,
  buildConfirmingFiles,
  buildMissingTypeFiles,
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
  readMessageCounts,
  readReportedValue,
  readTestModSource,
  routeCovers,
  SAMPLE_TEST_RESULTS,
  serveAppOriginMod,
  serveColumnsReportingSample,
  UNDECLARED_IMAGE_HOST,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import {
  readSampleModSource,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_ENTRYPOINT_GLOB,
  SAMPLE_MOD_REFERENCE,
} from "./sample_mod.ts";

test.describe(
  "Check a mod",
  { tag: "@frames" },
  function describeCheckMod(): void {
    test("Check the sample mod", async function checksSampleMod({
      page,
    }): Promise<void> {
      await openChecker(page, {});

      const report = await checkFromChecker(page, SAMPLE_MOD_REFERENCE);

      expect(report).toEqual({
        source: readSampleModSource(page),
        status: "pass",
        mountChecked: true,
        testsChecked: true,
        tests: SAMPLE_TEST_RESULTS,
        findings: [],
      });
    });

    test("Shipped mods pass", async function checksShippedMods({
      page,
    }): Promise<void> {
      await openChecker(page, {});

      for (const mod of [SAMPLE_MOD_REFERENCE, "mod_explorer", "mod_viewer"]) {
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

test.describe(
  "Mount check",
  { tag: "@frames" },
  function describeMountCheck(): void {
    test("Bundle error skips the mount", async function skipsMount({
      page,
    }): Promise<void> {
      const seenUrls = await openChecker(page, buildMissingTypeFiles());

      const report = await checkFromChecker(
        page,
        buildTestModReference("missing_type"),
      );

      expect(report.status).toBe("fail");
      expect(report.mountChecked).toBe(false);
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "bundle",
        level: "error",
        source: new URL("/test-mods/missing_type/missing_type.md", page.url())
          .href,
      });
      expect(readReportedValue(seenUrls, "ran")).toBeUndefined();
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });

    test("Frame removed after the check", async function removesFrame({
      page,
    }): Promise<void> {
      await openChecker(page, {});

      await checkFromChecker(page, SAMPLE_MOD_REFERENCE);

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
      await routeCovers(page);
      await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
      await page
        .frameLocator('iframe[title="Book List"]')
        .getByLabel("Books per row")
        .selectOption("10");
      await expect(
        page
          .frameLocator('iframe[title="Book List"]')
          .locator('ul[data-columns="10"]'),
      ).toHaveCount(1);
      const seenUrls = await serveAppOriginMod(page, buildCheckerFiles());
      await serveColumnsReportingSample(page);
      await page.goto(`/${CHECKER_HASH}`);
      await waitForProbe(await findModFrame(page, CHECKER_TITLE));

      const report = await checkFromChecker(page, SAMPLE_MOD_REFERENCE);
      await page.unroute(SAMPLE_ENTRYPOINT_GLOB);
      // A new document, so the sandbox the choice was made in is gone.
      await page.goto("about:blank");
      await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

      expect(report.status).toBe("pass");
      expect(readReportedValue(seenUrls, "columns")).toBeNull();
      await expect(
        page
          .frameLocator('iframe[title="Book List"]')
          .getByLabel("Books per row"),
      ).toHaveValue("10");
    });
  },
);

test.describe(
  "A check leaves the stage unchanged",
  { tag: "@frames" },
  function describeStageUnchanged(): void {
    test("Viewer stays visible", async function keepsCheckerVisible({
      page,
    }): Promise<void> {
      await openChecker(page, buildThrowingFiles());
      const addressBefore = page.url();
      const countsBefore = await readMessageCounts(page);

      const report = await checkFromChecker(
        page,
        buildTestModReference("throwing"),
      );

      expect(report.status).toBe("fail");
      expect(page.url()).toBe(addressBefore);
      await expect(
        visibleSandbox(page).locator(`iframe[title="${CHECKER_TITLE}"]`),
      ).toBeVisible();
      await expect(page.locator("[data-sandbox-id]")).toHaveCount(1);
      expect(await readMessageCounts(page)).toEqual(countsBefore);
    });
  },
);
