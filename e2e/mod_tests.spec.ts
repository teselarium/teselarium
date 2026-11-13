import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  ANSWER_TEST_CODE,
  buildModConf,
  buildTestCode,
  PROBE_MOD_CODE,
  buildExpectedFailureCaseFiles,
  buildTestedProbeFiles,
  buildTestModReference,
  buildUndeclaredImageCaseFiles,
  buildUnknownMethodCaseFiles,
  CHECK_FRAME_SELECTOR,
  CHECK_LIMIT_MS,
  CHECKER_TITLE,
  checkFromChecker,
  checkPastLimit,
  ENDLESS_TEST_CODE,
  findModFrame,
  ISOLATION_TEST_CODE,
  KEYS_PROBE_TEST_CODE,
  ONE_FAILING_TEST_CODE,
  openChecker,
  readTestFileSource,
  requestFromProbe,
  SYNTAX_ERROR_TEST_CODE,
  UNDECLARED_IMAGE_HOST,
  waitForProbe,
  WRONG_ANSWER_TEST_CODE,
} from "./mod_routes.ts";
import {
  buildTilesCaseFiles,
  readTilesModSource,
  TILES_CONTEXT_TEST_CODE,
  TILES_MOD_REFERENCE,
  TILES_TEST_RESULTS,
  buildTilesModFiles,
} from "./test_mods.ts";
import type {
  CheckReport,
  CheckTestResult,
  ModFiles,
  ProbeAnswer,
} from "./mod_routes.ts";
import {
  BODIES_COLLECTION_URL,
  routePlayerSites,
  serveBodyTiles,
  YOUTUBE_PAGE,
} from "./tile_body_routes.ts";

/** Opens the checker with `files` served, checks the test mod in the folder `name/` and returns the report. */
async function checkTestMod(
  page: Page,
  files: ModFiles,
  name: string,
): Promise<CheckReport> {
  await openChecker(page, files);
  const report = await checkFromChecker(page, buildTestModReference(name));
  return report;
}

/** The result of the case named `name`. */
function findCase(report: CheckReport, name: string): CheckTestResult {
  for (const result of report.tests) {
    if (result.name === name) {
      return result;
    }
  }
  throw new Error(
    `Expected the case "${name}" in ${JSON.stringify(report.tests)}`,
  );
}

function listFindingMessages(report: CheckReport): string[] {
  const messages: string[] = [];
  for (const finding of report.findings) {
    messages.push(finding.message);
  }
  return messages;
}

/** A case that answers `players.open` for the YouTube page its sample tile links. */
const PLAYER_ANSWER_TEST_CODE = buildTestCode(
  [
    "async function playsAnswered(context) {",
    "  await context.mount();",
    '  context.answer("players.open", true);',
    `  const played = await globalThis.probe.engine.request("players.open", { url: "${YOUTUBE_PAGE}" });`,
    "  context.expect(played).toBe(true);",
    "}",
  ],
  [["plays the answered player", "playsAnswered"]],
);

/** A probe whose sample collection is the body tiles, with `PLAYER_ANSWER_TEST_CODE` as its tests. */
function buildPlayerAnswerFiles(): ModFiles {
  const files: ModFiles = {
    "player_answer/mod_conf.yaml": buildModConf("player_answer", [
      '  test_path: "./test.js"',
      `  sample_collection: "${BODIES_COLLECTION_URL}"`,
    ]),
    "player_answer/main.js": PROBE_MOD_CODE,
    "player_answer/test.js": PLAYER_ANSWER_TEST_CODE,
  };
  return files;
}

test.describe(
  "Tests run in the check",
  { tag: "@frames" },
  function describeTestsInCheck(): void {
    test("Sample mod tests pass", async function passesTests({
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
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });

    test("Opening does not fetch the tests", async function skipsTestFile({
      page,
    }): Promise<void> {
      const seenUrls = await openChecker(
        page,
        buildTestedProbeFiles("opened_tests", ONE_FAILING_TEST_CODE),
      );
      const testFileSource = readTestFileSource(page, "opened_tests");
      const checkerFrame = await findModFrame(page, CHECKER_TITLE);

      const inspection: ProbeAnswer = await checkerFrame.evaluate(
        requestFromProbe,
        ["mods.inspect", { mod: buildTestModReference("opened_tests") }],
      );
      await page.goto(`/#/run?mod=${buildTestModReference("opened_tests")}`);
      await waitForProbe(await findModFrame(page, "opened_tests"));

      expect(inspection.result).toMatchObject({ testSource: testFileSource });
      expect(seenUrls).toContain(
        new URL("/test-mods/opened_tests/main.js", page.url()).href,
      );
      expect(seenUrls).not.toContain(testFileSource);
    });
  },
);

test.describe(
  "Test file format",
  { tag: "@frames" },
  function describeTestFileFormat(): void {
    test("Syntax error", async function reportsSyntaxError({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("syntax_error", SYNTAX_ERROR_TEST_CODE),
        "syntax_error",
      );

      expect(report.status).toBe("fail");
      expect(report.mountChecked).toBe(true);
      expect(report.testsChecked).toBe(false);
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "test",
        level: "error",
        source: readTestFileSource(page, "syntax_error"),
      });
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });
  },
);

test.describe(
  "Each case in a fresh frame",
  { tag: "@frames" },
  function describeFreshFrames(): void {
    test("Cases do not share storage", async function isolatesStorage({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("isolation", ISOLATION_TEST_CODE),
        "isolation",
      );

      expect(findCase(report, "changes the storage and the page").status).toBe(
        "pass",
      );
      expect(findCase(report, "reads the storage")).toEqual({
        name: "reads the storage",
        status: "pass",
        message: null,
      });
    });

    test("Cases do not share the page", async function isolatesPage({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("isolation", ISOLATION_TEST_CODE),
        "isolation",
      );

      expect(findCase(report, "reads the page")).toEqual({
        name: "reads the page",
        status: "pass",
        message: null,
      });
    });
  },
);

test.describe(
  "Mounting from a case",
  { tag: "@frames" },
  function describeMountingFromCase(): void {
    test("Config override", async function overridesConfig({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTilesCaseFiles("tiles_context", TILES_CONTEXT_TEST_CODE),
        "tiles_context",
      );

      expect(findCase(report, "hides the images").status).toBe("pass");
      expect(findCase(report, "shows the images").status).toBe("pass");
    });

    test("Other tiles", async function mountsOtherTiles({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTilesCaseFiles("tiles_context", TILES_CONTEXT_TEST_CODE),
        "tiles_context",
      );

      expect(findCase(report, "shows no tiles")).toMatchObject({
        status: "pass",
      });
    });

    test("Mount twice", async function rejectsSecondMount({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTilesCaseFiles("tiles_context", TILES_CONTEXT_TEST_CODE),
        "tiles_context",
      );

      expect(findCase(report, "mounts twice")).toEqual({
        name: "mounts twice",
        status: "fail",
        message: "the mod is already mounted",
      });
    });
  },
);

test.describe(
  "Case context",
  { tag: "@frames" },
  function describeCaseContext(): void {
    test("Seeded storage", async function seedsStorage({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTilesCaseFiles("tiles_context", TILES_CONTEXT_TEST_CODE),
        "tiles_context",
      );

      expect(findCase(report, "reads the seeded starts")).toMatchObject({
        status: "pass",
        message: null,
      });
    });

    test("Requests are recorded", async function recordsRequests({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTilesCaseFiles("tiles_context", TILES_CONTEXT_TEST_CODE),
        "tiles_context",
      );

      expect(findCase(report, "records the requests")).toMatchObject({
        status: "pass",
        message: null,
      });
    });
  },
);

test.describe(
  "Scripted answers",
  { tag: "@frames" },
  function describeScriptedAnswers(): void {
    test("Confirm answered yes", async function answersConfirm({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("answers", ANSWER_TEST_CODE),
        "answers",
      );

      expect(findCase(report, "confirms yes").status).toBe("pass");
      expect(findCase(report, "confirms no without an answer").status).toBe(
        "pass",
      );
      expect(findCase(report, "opens nothing").status).toBe("pass");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[data-sandbox-id]")).toHaveCount(1);
      expect(report.findings).toEqual([]);
    });

    test("Player answered", async function answersPlayer({
      page,
    }): Promise<void> {
      const playerRequests = await routePlayerSites(page);
      await serveBodyTiles(page, [
        {
          name: "bunny",
          metadataLines: [`video: "${YOUTUBE_PAGE}"`],
          body: "Big Buck Bunny.",
        },
      ]);

      const report = await checkTestMod(
        page,
        buildPlayerAnswerFiles(),
        "player_answer",
      );

      expect(findCase(report, "plays the answered player")).toEqual({
        name: "plays the answered player",
        status: "pass",
        message: null,
      });
      expect(report.findings).toEqual([]);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(playerRequests).toEqual([]);
    });

    test("Wrong answer type", async function rejectsWrongAnswer({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("wrong_answer", WRONG_ANSWER_TEST_CODE),
        "wrong_answer",
      );

      expect(findCase(report, "answers with text")).toEqual({
        name: "answers with text",
        status: "fail",
        message: "the answer to ui.confirm must be a boolean",
      });
    });
  },
);

test.describe(
  "What a case records",
  { tag: "@frames" },
  function describeCaseRecords(): void {
    test("Unknown method in a case", async function recordsUnknownMethod({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildUnknownMethodCaseFiles(),
        "unknown_method_case",
      );

      expect(report.status).toBe("fail");
      expect(findCase(report, "deletes a book").status).toBe("pass");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "test",
        level: "error",
      });
      expect(report.findings[0].message).toContain("deletes a book");
      expect(report.findings[0].message).toContain("tiles.delete");
      expect(report.findings[0].message).toContain("Unknown method");
    });

    test("Blocked image in a case", async function recordsBlockedImage({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildUndeclaredImageCaseFiles(),
        "undeclared_image_case",
      );

      expect(report.status).toBe("warn");
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        step: "test",
        level: "warning",
      });
      expect(report.findings[0].message).toContain("shows covers");
      expect(report.findings[0].message).toContain(UNDECLARED_IMAGE_HOST);
      expect(report.findings[0].message).toContain("permissions.show");
    });

    test("Expected mount failure", async function ignoresExpectedFailure({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildExpectedFailureCaseFiles(),
        "expected_failure_case",
      );

      expect(findCase(report, "expects a mount failure")).toEqual({
        name: "expects a mount failure",
        status: "pass",
        message: null,
      });
      expect(report.status).toBe("pass");
      for (const message of listFindingMessages(report)) {
        expect(message).not.toContain("map failed");
      }
    });
  },
);

test.describe(
  "Case results",
  { tag: "@frames" },
  function describeCaseResults(): void {
    test("One case fails", async function runsEveryCase({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("one_failing", ONE_FAILING_TEST_CODE),
        "one_failing",
      );

      expect(report.tests).toHaveLength(3);
      expect(report.tests[0]).toEqual({
        name: "first",
        status: "pass",
        message: null,
      });
      expect(report.tests[1]).toMatchObject({ name: "second", status: "fail" });
      expect(report.tests[1].message).toContain("no books");
      expect(report.tests[2]).toEqual({
        name: "third",
        status: "pass",
        message: null,
      });
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });

    test("Case too long", async function failsLongCase({
      page,
    }): Promise<void> {
      await page.clock.install();
      const seenUrls = await openChecker(
        page,
        buildTestedProbeFiles("endless", ENDLESS_TEST_CODE),
      );

      const { report, elapsedMs } = await checkPastLimit(
        page,
        buildTestModReference("endless"),
        seenUrls,
      );

      expect(elapsedMs).toBeGreaterThanOrEqual(CHECK_LIMIT_MS);
      expect(report.tests).toEqual([
        {
          name: "waits forever",
          status: "fail",
          message: "The test did not finish within 10 seconds.",
        },
      ]);
      await expect(page.locator(CHECK_FRAME_SELECTOR)).toHaveCount(0);
    });
  },
);

test.describe(
  "Test API names",
  { tag: "@frames" },
  function describeTestApiNames(): void {
    test("pins the names of t, the case context and the matchers", async function pinsNames({
      page,
    }): Promise<void> {
      const report = await checkTestMod(
        page,
        buildTestedProbeFiles("keys_probe", KEYS_PROBE_TEST_CODE),
        "keys_probe",
      );

      const result = findCase(report, "reports the keys");
      expect(JSON.parse(result.message ?? "null")).toEqual({
        t: ["test"],
        context: [
          "answer",
          "expect",
          "mount",
          "requests",
          "root",
          "storage",
          "tiles",
          "waitFor",
        ],
        storage: ["get", "set"],
        expect: ["not", "toBe", "toBeTruthy", "toContain", "toEqual"],
        not: ["toBe", "toBeTruthy", "toContain", "toEqual"],
      });
    });
  },
);
