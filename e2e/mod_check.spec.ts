import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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
  CHECKER_HASH,
  CHECKER_TITLE,
  findModFrame,
  issueList,
  readReportedValue,
  requestFromProbe,
  routeCovers,
  serveAppOriginMod,
  serveSelectionReportingSample,
  UNDECLARED_IMAGE_HOST,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles, ProbeAnswer } from "./mod_routes.ts";
import {
  readSampleModSource,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_ENTRYPOINT_GLOB,
  SAMPLE_MOD_REFERENCE,
} from "./sample_mod.ts";

interface CheckFinding {
  step: string;
  level: string;
  source: string;
  message: string;
}

interface CheckReport {
  source: string;
  status: string;
  mountChecked: boolean;
  findings: CheckFinding[];
}

/** Every frame of a running check: hidden frames outside the sandboxes. */
const CHECK_FRAME_SELECTOR = "iframe[data-check-id]";

/** Serves the checker and `files` on the app's origin, and opens the checker. Returns the URLs the route saw. */
async function openChecker(page: Page, files: ModFiles): Promise<string[]> {
  await routeCovers(page);
  const seenUrls = await serveAppOriginMod(page, {
    ...buildCheckerFiles(),
    ...files,
  });
  await page.goto(`/${CHECKER_HASH}`);
  await waitForProbe(await findModFrame(page, CHECKER_TITLE));
  return seenUrls;
}

/** Sends `mods.check` from the checker and returns the report. */
async function checkFromChecker(page: Page, mod: string): Promise<CheckReport> {
  const checkerFrame = await findModFrame(page, CHECKER_TITLE);
  const answer: ProbeAnswer = await checkerFrame.evaluate(requestFromProbe, [
    "mods.check",
    { mod },
  ]);
  if (answer.result === undefined) {
    throw new Error(
      `Expected a report for "${mod}", got error ${answer.code}: ${answer.message}`,
    );
  }
  return answer.result as CheckReport;
}

function readTestModSource(page: Page, folder: string): string {
  const source = new URL(`/test-mods/${folder}/mod_conf.yaml`, page.url()).href;
  return source;
}

test.describe("Check a mod", function describeCheckMod(): void {
  test("Check the sample mod", async function checksSampleMod({
    page,
  }): Promise<void> {
    await openChecker(page, {});

    const report = await checkFromChecker(page, SAMPLE_MOD_REFERENCE);

    expect(report).toEqual({
      source: readSampleModSource(page),
      status: "pass",
      mountChecked: true,
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
});

test.describe("Mount check", function describeMountCheck(): void {
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
});

test.describe("What the mount check records", function describeMountRecords(): void {
  test("Mount throws", async function recordsThrow({ page }): Promise<void> {
    await openChecker(page, buildThrowingFiles());

    const report = await checkFromChecker(
      page,
      buildTestModReference("throwing"),
    );

    expect(report.status).toBe("fail");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ step: "mount", level: "error" });
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
    expect(report.findings[0]).toMatchObject({ step: "mount", level: "error" });
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
    test.setTimeout(30000);
    await openChecker(page, buildNeverMountedFiles());
    const startedAt = Date.now();

    const report = await checkFromChecker(
      page,
      buildTestModReference("never_mounted"),
    );

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(10000);
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
});

test.describe("Requests that need the user", function describeUserRequests(): void {
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
});

test.describe("Throwaway storage slot", function describeThrowawaySlot(): void {
  test("Real slot untouched", async function keepsRealSlot({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);
    const kallocain = page
      .frameLocator('iframe[title="Book List"]')
      .getByRole("button", { name: /Kallocain/ });
    await kallocain.click();
    await expect(kallocain).toHaveAttribute("aria-pressed", "true");
    const seenUrls = await serveAppOriginMod(page, buildCheckerFiles());
    await serveSelectionReportingSample(page);
    await page.goto(`/${CHECKER_HASH}`);
    await waitForProbe(await findModFrame(page, CHECKER_TITLE));

    const report = await checkFromChecker(page, SAMPLE_MOD_REFERENCE);
    await page.unroute(SAMPLE_ENTRYPOINT_GLOB);
    // A new document, so the sandbox the selection was made in is gone.
    await page.goto("about:blank");
    await page.goto(`/${SAMPLE_COLLECTION_RUN_HASH}`);

    expect(report.status).toBe("pass");
    expect(readReportedValue(seenUrls, "selected")).toBeNull();
    await expect(
      page
        .frameLocator('iframe[title="Book List"]')
        .getByRole("button", { name: /Kallocain/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("A check leaves the stage unchanged", function describeStageUnchanged(): void {
  test("Viewer stays visible", async function keepsCheckerVisible({
    page,
  }): Promise<void> {
    await openChecker(page, buildThrowingFiles());
    const addressBefore = page.url();
    const issuesBefore = await issueList(page).allTextContents();

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
    expect(await issueList(page).allTextContents()).toEqual(issuesBefore);
  });
});
