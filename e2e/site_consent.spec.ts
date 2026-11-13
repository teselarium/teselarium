import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import {
  answerSiteConsent,
  buildModConf,
  clickCheckedTo,
  buildProbeFiles,
  COVER_HOST,
  fetchFromFrame,
  findModFrame,
  followLink,
  FOREIGN_HOST,
  readLoadedCovers,
  readProbeContext,
  recordHost,
  REMEMBER_LABEL,
  requestFromProbe,
  routeCovers,
  serveAppOriginMod,
  serveForeignMod,
  showImage,
  siteConsentDialog,
  stageBar,
  TEST_MOD_API_RANGE,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import type { ModFiles } from "./mod_routes.ts";
import {
  serveTilesMod,
  TILES_COLLECTION_RUN_HASH,
  TILES_TITLE,
} from "./test_mods.ts";

const PROBE_TITLE = "Probe";
const PROBE_FOLDER = `${FOREIGN_HOST}/probe/`;
const PROBE_HASH = `#/run?mod=${encodeURIComponent(PROBE_FOLDER)}`;
const OTHER_PROBE_HASH = `#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/other/`)}`;
const API_HOST = "https://api.example.net";
const COVER_URL = `${COVER_HOST}/cover.jpg`;
const SHOW_LINE = `show content from ${COVER_HOST}`;
const CONNECT_LINE = `exchange data with ${API_HOST}`;
const SHOW_LINES = [
  "    show:",
  `      - host: "${COVER_HOST}"`,
  '        reason: "Shows the book covers"',
];
const CONNECT_LINES = [
  "    connect:",
  `      - host: "${API_HOST}"`,
  '        reason: "Reads the prices"',
];

/** The mod file lines of a probe titled `title` that declares the given permission lines. */
function buildProbeLines(title: string, permissionLines: string[]): string[] {
  const lines = [`  title: "${title}"`, "  permissions:", ...permissionLines];
  return lines;
}

/** The files of a foreign probe in `folder/`, titled `title`, declaring the given permission lines. */
function buildForeignProbeFiles(
  folder: string,
  title: string,
  permissionLines: string[],
  apiRange: string = TEST_MOD_API_RANGE,
): ModFiles {
  const files = buildProbeFiles(
    folder,
    buildProbeLines(title, permissionLines),
    apiRange,
  );
  return files;
}

/** Serves the foreign probe declaring `permissionLines`, opens its run link and returns its files, which a test may change. */
async function openForeignProbe(
  page: Page,
  permissionLines: string[] = SHOW_LINES,
): Promise<ModFiles> {
  await routeCovers(page);
  const files = buildForeignProbeFiles("probe", PROBE_TITLE, permissionLines);
  await serveForeignMod(page, files);
  await page.goto(`/${PROBE_HASH}`);
  return files;
}

/** The frame of the probe, once mounted. */
async function waitForProbeFrame(
  page: Page,
  title: string = PROBE_TITLE,
): Promise<Frame> {
  await expect(stageBar(page)).toContainText(title);
  const frame = await findModFrame(page, title);
  await waitForProbe(frame);
  return frame;
}

/** Closes the visible mod and follows the probe's link again, in a new sandbox. */
async function reopenProbe(page: Page): Promise<void> {
  await stageBar(page).getByRole("button", { name: "Close" }).click();
  await expect(page.locator(`iframe[title="${PROBE_TITLE}"]`)).toHaveCount(0);
  await followLink(page, PROBE_HASH);
}

function lineCheckbox(page: Page, line: string): Locator {
  return siteConsentDialog(page).getByRole("checkbox", { name: line });
}

async function expectAsking(page: Page): Promise<void> {
  await expect(siteConsentDialog(page)).toBeVisible();
  await expect(
    siteConsentDialog(page).getByRole("heading", { name: PROBE_TITLE }),
  ).toBeVisible();
  await expect(visibleSandbox(page)).toContainText("Waiting for your answer…");
  await expect(visibleSandbox(page).locator("iframe")).toHaveCount(0);
}

async function expectNoDialog(page: Page): Promise<void> {
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function countCovers(frame: Frame): Promise<number> {
  const covers = await frame.evaluate(readLoadedCovers);
  return covers.length;
}

test.describe("Ask before a mod from another origin starts", function describeAsk(): void {
  test("Mod from the app's origin", async function startsAppOriginMod({
    page,
  }): Promise<void> {
    await serveTilesMod(page);

    await page.goto(`/${TILES_COLLECTION_RUN_HASH}`);
    const frame = await findModFrame(page, TILES_TITLE);

    await expect
      .poll(countCovers.bind(undefined, frame), { timeout: 10000 })
      .toBe(3);
    await expectNoDialog(page);
  });
});

test.describe(
  "Allow grants the checked lines",
  { tag: "@frames" },
  function describeAllow(): void {
    test("One line unchecked", async function allowsCheckedLines({
      page,
    }): Promise<void> {
      const apiUrls = await recordHost(page, `${API_HOST}/**`);
      await openForeignProbe(page, [...SHOW_LINES, ...CONNECT_LINES]);

      await answerSiteConsent(page, "Allow", { unchecked: [CONNECT_LINE] });
      const frame = await waitForProbeFrame(page);

      expect(await frame.evaluate(showImage, COVER_URL)).toBe(true);
      expect(
        await frame.evaluate(fetchFromFrame, `${API_HOST}/prices`),
      ).not.toBe("sent");
      expect(apiUrls).toEqual([]);
      const context = await frame.evaluate(readProbeContext);
      expect(context.permissions).toEqual({
        granted: [
          {
            category: "show",
            host: COVER_HOST,
            reason: "Shows the book covers",
          },
        ],
        denied: [
          { category: "connect", host: API_HOST, reason: "Reads the prices" },
        ],
      });
    });
  },
);

test.describe(
  "Show without them refuses the listed lines",
  { tag: "@frames" },
  function describeShowWithout(): void {
    test("Escape", async function refusesOnEscape({ page }): Promise<void> {
      await openForeignProbe(page);
      await expectAsking(page);

      await clickCheckedTo(lineCheckbox(page, REMEMBER_LABEL), true);
      await page.keyboard.press("Escape");
      const frame = await waitForProbeFrame(page);

      expect(await frame.evaluate(showImage, COVER_URL)).toBe(false);
      await reopenProbe(page);
      await expectAsking(page);
    });
  },
);

test.describe("Remember keeps the answer for that mod", function describeRemember(): void {
  test("Remembered allow", async function remembersAllow({
    page,
  }): Promise<void> {
    await openForeignProbe(page);
    await answerSiteConsent(page, "Allow", { remember: true });
    await waitForProbeFrame(page);

    await reopenProbe(page);
    const frame = await waitForProbeFrame(page);

    await expectNoDialog(page);
    expect(await frame.evaluate(showImage, COVER_URL)).toBe(true);
  });

  test("Remembered refusal", async function remembersRefusal({
    page,
  }): Promise<void> {
    await openForeignProbe(page);
    await answerSiteConsent(page, "Show without them", { remember: true });
    await waitForProbeFrame(page);

    await reopenProbe(page);
    const frame = await waitForProbeFrame(page);

    await expectNoDialog(page);
    expect(await frame.evaluate(showImage, COVER_URL)).toBe(false);
  });

  test("Another mod declares the same site", async function asksOtherMod({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await serveForeignMod(page, {
      ...buildForeignProbeFiles("probe", PROBE_TITLE, SHOW_LINES),
      ...buildForeignProbeFiles("other", "Other probe", SHOW_LINES),
    });
    await page.goto(`/${PROBE_HASH}`);
    await answerSiteConsent(page, "Allow", { remember: true });
    await waitForProbeFrame(page);

    await followLink(page, OTHER_PROBE_HASH);

    await expect(
      siteConsentDialog(page).getByRole("heading", { name: "Other probe" }),
    ).toBeVisible();
    await expect(lineCheckbox(page, SHOW_LINE)).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("A new permission in a later version", async function asksNewLine({
    page,
  }): Promise<void> {
    const files = await openForeignProbe(page);
    await answerSiteConsent(page, "Allow", { remember: true });
    await waitForProbeFrame(page);
    files["probe/mod_conf.yaml"] = buildModConf(
      "probe",
      buildProbeLines(PROBE_TITLE, [...SHOW_LINES, ...CONNECT_LINES]),
    );

    await reopenProbe(page);

    await expect(lineCheckbox(page, CONNECT_LINE)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(lineCheckbox(page, SHOW_LINE)).toHaveCount(0);
    await answerSiteConsent(page, "Show without them");
    const frame = await waitForProbeFrame(page);
    expect(await frame.evaluate(showImage, COVER_URL)).toBe(true);
  });
});

test.describe("Remembered decisions are kept in the app's storage", function describeKept(): void {
  test("Kept after a reload", async function keepsAfterReload({
    page,
  }): Promise<void> {
    await openForeignProbe(page);
    await answerSiteConsent(page, "Allow", { remember: true });
    await waitForProbeFrame(page);

    await page.reload();
    const frame = await waitForProbeFrame(page);

    await expectNoDialog(page);
    expect(await frame.evaluate(showImage, COVER_URL)).toBe(true);
  });
});

test.describe("The dialog waits for its mod to be visible", function describeVisible(): void {
  test("Opened by another mod", async function asksForOpenedMod({
    page,
  }): Promise<void> {
    await routeCovers(page);
    await serveForeignMod(
      page,
      buildForeignProbeFiles("probe", PROBE_TITLE, SHOW_LINES),
    );
    await serveAppOriginMod(
      page,
      buildProbeFiles("opener", [
        '  title: "Opener"',
        "  permissions:",
        "    open:",
        '      - host: "*"',
        '        reason: "Opens mods"',
      ]),
    );
    await page.goto("/#/run?mod=./test-mods/opener/");
    const opener = await waitForProbeFrame(page, "Opener");

    await opener.evaluate(requestFromProbe, [
      "mods.open",
      { mod: PROBE_FOLDER },
    ]);

    await expect(stageBar(page)).toContainText(PROBE_TITLE);
    await expectAsking(page);
  });
});
