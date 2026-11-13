import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import {
  currentItem,
  openSection,
  pageBody,
  sectionItem,
} from "./app_layout.ts";
import {
  answerSiteConsent,
  APP_MOD_API_VERSION,
  buildProbeFiles,
  clickCheckedTo,
  COVER_HOST,
  findModFrame,
  findVisibleFrame,
  followLink,
  FOREIGN_HOST,
  isFrameMarked,
  LINKED_APP_PROBE_LINK,
  LINKED_COVER_URL,
  markFrame,
  MEDIA_HOST,
  requestFromProbe,
  routeCovers,
  routeImages,
  serveAppOriginMod,
  serveForeignMod,
  serveLinkedTiles,
  showImage,
  siteConsentDialog,
  stageBar,
  visibleSandbox,
  waitForProbe,
} from "./mod_routes.ts";
import { openProbe } from "./test_mods.ts";
import {
  openBodyProbe,
  playerDialog,
  playerFrame,
  pressPlay,
  routePlayerSites,
  YOUTUBE_FRAME_HOST,
  YOUTUBE_PAGE,
} from "./tile_body_routes.ts";
import { themeControl } from "./theme_probes.ts";

const SECTION_SWITCHES_KEY = "opentesela.sidebar-sections";
const TILE_MEDIA_LABEL = "Load media linked by tiles";
const PROBE_HASH = `#/run?mod=${encodeURIComponent(`${FOREIGN_HOST}/probe/`)}`;
const COVERS_LINE = `show content from ${COVER_HOST}`;

/** The version of the app's `package.json`, which the vanilla build read when Playwright built it. */
const PACKAGE_VERSION = (
  JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

function versionsList(page: Page): Locator {
  return page.getByLabel("Versions");
}

function readSelectedText(): string {
  return getSelection()?.toString() ?? "";
}

function sectionSwitch(page: Page, name: string): Locator {
  return page.getByRole("switch", { name, exact: true });
}

function tileMediaSwitch(page: Page): Locator {
  return page.getByRole("switch", { name: TILE_MEDIA_LABEL });
}

/** Opens Settings and switches "Load media linked by tiles" off, as a user clicks it. */
async function switchTileMediaOff(page: Page): Promise<void> {
  if (!(await tileMediaSwitch(page).isVisible())) {
    await openSection(page, "Settings");
  }
  await tileMediaSwitch(page).click();
  await expect(tileMediaSwitch(page)).toHaveAttribute("aria-checked", "false");
}

/** Serves the probe and a tile linking `LINKED_COVER_URL`, whose requests the returned list records. */
async function serveLinkedProbe(page: Page): Promise<string[]> {
  await serveAppOriginMod(page, buildProbeFiles("probe"));
  await serveLinkedTiles(page, [`image: "${LINKED_COVER_URL}"`]);
  const seenUrls = await routeImages(page, `${MEDIA_HOST}/**`);
  return seenUrls;
}

/** Opens the probe with the linked collection, from the page already open. */
async function openLinkedProbe(page: Page): Promise<Frame> {
  await page.goto(LINKED_APP_PROBE_LINK);
  const frame = await findModFrame(page, "probe");
  await waitForProbe(frame);
  return frame;
}

function modPermissionsGroup(page: Page): Locator {
  return page
    .getByRole("main")
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Mod permissions" }) });
}

/**
 * Opens the foreign probe "Probe", which declares `show` for the covers,
 * answers with `answer` and Remember, Allow unless given, and returns its frame.
 */
async function openRememberedProbe(
  page: Page,
  answer: "Allow" | "Show without them" = "Allow",
): Promise<Frame> {
  await routeCovers(page);
  await serveForeignMod(
    page,
    buildProbeFiles("probe", [
      '  title: "Probe"',
      "  permissions:",
      "    show:",
      `      - host: "${COVER_HOST}"`,
      '        reason: "Shows the book covers"',
    ]),
  );
  await page.goto(`/${PROBE_HASH}`);
  await answerSiteConsent(page, answer, { remember: true });
  const frame = await findModFrame(page, "Probe");
  await waitForProbe(frame);
  return frame;
}

/** The expand button of the mod titled `title` in the Mod permissions group. */
function modGroupToggle(page: Page, title: string): Locator {
  return modPermissionsGroup(page).getByRole("button", {
    name: new RegExp(`^${title} `),
  });
}

/** Opens Settings and expands the group of the mod titled `title`, as a user clicks its header. */
async function expandModGroup(page: Page, title: string): Promise<void> {
  await openSection(page, "Settings");
  await modGroupToggle(page, title).click();
  await expect(modGroupToggle(page, title)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
}

/** Opens Settings and removes the remembered allow of the probe's covers, as a user clicks Remove. */
const PLAYER_SITE_LINE = `play media from ${YOUTUBE_FRAME_HOST}`;

/** Opens the probe with a tile that links a YouTube page, and plays it with Always play from checked. */
async function rememberPlayerSite(page: Page): Promise<Frame> {
  await routePlayerSites(page);
  const { frame } = await openBodyProbe(page, [
    {
      name: "bunny",
      metadataLines: [`video: "${YOUTUBE_PAGE}"`],
      body: "Big Buck Bunny.",
    },
  ]);
  await frame.evaluate(startPlayer);
  await playerDialog(page)
    .getByLabel(`Always play from ${YOUTUBE_FRAME_HOST}`)
    .check();
  await pressPlay(page);
  await playerDialog(page).getByRole("button", { name: "Close" }).click();
  await expect(playerDialog(page)).toBeHidden();
  return frame;
}

/** Runs in the probe's frame: asks for the player of the YouTube page its tile links. */
function startPlayer(): void {
  const probeGlobal = globalThis as unknown as {
    probe: { engine: { request: (method: string, params: object) => unknown } };
  };
  void probeGlobal.probe.engine.request("players.open", {
    url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  });
}

async function removeProbeDecision(page: Page): Promise<void> {
  await expandModGroup(page, "Probe");
  await expect(modPermissionsGroup(page)).toContainText("Allowed");
  await modPermissionsGroup(page)
    .getByRole("button", { name: `Remove Probe: ${COVERS_LINE}` })
    .click();
  await expect(modPermissionsGroup(page)).toContainText(
    "No remembered decisions.",
  );
}

/** Opens Settings and checks or unchecks the probe's covers decision, as a user clicks its checkbox. */
async function changeProbeDecision(
  page: Page,
  isAllowed: boolean,
): Promise<void> {
  await expandModGroup(page, "Probe");
  await clickCheckedTo(
    modPermissionsGroup(page).getByRole("checkbox", {
      name: `Allow Probe: ${COVERS_LINE}`,
    }),
    isAllowed,
  );
}

/** The group checkbox of the mod titled `title`. */
function modGroupCheckbox(page: Page, title: string): Locator {
  return modPermissionsGroup(page).getByRole("checkbox", {
    name: `Allow all decisions of ${title}`,
  });
}

/** Opens Settings and switches a section off or on, as a user clicks its switch. */
async function switchSectionTo(
  page: Page,
  name: string,
  isOn: boolean,
): Promise<void> {
  if (!(await themeControl(page).isVisible())) {
    await openSection(page, "Settings");
  }
  const toggle = sectionSwitch(page, name);
  if ((await toggle.getAttribute("aria-checked")) !== String(isOn)) {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-checked", String(isOn));
}

test.describe("Sites always played from in Settings", function describePlayerSites(): void {
  test("Asked again after removing", async function asksAgainForPlayer({
    page,
  }): Promise<void> {
    const frame = await rememberPlayerSite(page);
    await openSection(page, "Settings");

    await modPermissionsGroup(page)
      .getByRole("button", { name: `Remove: ${PLAYER_SITE_LINE}` })
      .click();
    await expect(modPermissionsGroup(page)).not.toContainText(PLAYER_SITE_LINE);
    await page.goBack();
    await expect(visibleSandbox(page)).toBeVisible();
    await frame.evaluate(startPlayer);

    await expect(
      playerDialog(page).getByRole("button", { name: "Play" }),
    ).toBeVisible();
    await expect(playerFrame(page)).toHaveCount(0);
  });
});

test.describe("Removing a remembered decision", function describeRemoving(): void {
  test("Asked again after removing", async function asksAgain({
    page,
  }): Promise<void> {
    await openRememberedProbe(page);

    await removeProbeDecision(page);
    await followLink(page, PROBE_HASH);

    await expect(
      siteConsentDialog(page).getByRole("checkbox", { name: COVERS_LINE }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("Running mod keeps its permission", async function keepsRunningPermission({
    page,
  }): Promise<void> {
    const frame = await openRememberedProbe(page);
    await markFrame(frame);

    await removeProbeDecision(page);
    await page.goBack();

    await expect(stageBar(page)).toContainText("Probe");
    expect(await frame.evaluate(showImage, `${COVER_HOST}/later.jpg`)).toBe(
      true,
    );
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Asked again after removing all", async function asksAgainAfterRemovingAll({
    page,
  }): Promise<void> {
    await openRememberedProbe(page);
    await openSection(page, "Settings");

    await modPermissionsGroup(page)
      .getByRole("button", { name: "Remove all decisions of Probe" })
      .click();
    await expect(modPermissionsGroup(page)).toContainText(
      "No remembered decisions.",
    );
    await followLink(page, PROBE_HASH);

    await expect(
      siteConsentDialog(page).getByRole("checkbox", { name: COVERS_LINE }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Changing a remembered decision", function describeChanging(): void {
  test("Allow a remembered refusal", async function allowsRememberedRefusal({
    page,
  }): Promise<void> {
    await openRememberedProbe(page, "Show without them");

    await changeProbeDecision(page, true);
    await followLink(page, PROBE_HASH);
    await expect(stageBar(page)).toContainText("Probe");
    const frame = await findVisibleFrame(page);
    await waitForProbe(frame);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await frame.evaluate(showImage, `${COVER_HOST}/cover.jpg`)).toBe(
      true,
    );
  });

  test("Running mod keeps its policy after a change", async function keepsRunningPolicyAfterChange({
    page,
  }): Promise<void> {
    const frame = await openRememberedProbe(page);
    await markFrame(frame);

    await changeProbeDecision(page, false);
    await page.goBack();

    await expect(stageBar(page)).toContainText("Probe");
    expect(await frame.evaluate(showImage, `${COVER_HOST}/later.jpg`)).toBe(
      true,
    );
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Changing every decision of a mod", function describeChangingAll(): void {
  test("Refuse all of a mod", async function refusesAllOfMod({
    page,
  }): Promise<void> {
    await openRememberedProbe(page);
    await openSection(page, "Settings");

    await clickCheckedTo(modGroupCheckbox(page, "Probe"), false);
    await expect(modGroupToggle(page, "Probe")).toContainText("1 refused");
    await followLink(page, PROBE_HASH);
    await expect(stageBar(page)).toContainText("Probe");
    const frame = await findVisibleFrame(page);
    await waitForProbe(frame);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await frame.evaluate(showImage, `${COVER_HOST}/cover.jpg`)).toBe(
      false,
    );
  });
});

test.describe("Load media linked by tiles", function describeTileMedia(): void {
  test("Switched off before opening a mod", async function blocksAfterSwitchOff({
    page,
  }): Promise<void> {
    const seenUrls = await serveLinkedProbe(page);
    await page.goto("/#/settings");

    await switchTileMediaOff(page);
    const frame = await openLinkedProbe(page);

    expect(await frame.evaluate(showImage, LINKED_COVER_URL)).toBe(false);
    expect(seenUrls).toEqual([]);
  });

  test("Running mod keeps its policy", async function keepsRunningPolicy({
    page,
  }): Promise<void> {
    const seenUrls = await serveLinkedProbe(page);
    const frame = await openLinkedProbe(page);
    await markFrame(frame);

    await switchTileMediaOff(page);
    await page.goBack();

    expect(await frame.evaluate(showImage, LINKED_COVER_URL)).toBe(true);
    expect(seenUrls).toEqual([LINKED_COVER_URL]);
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("The media switch is remembered", function describeTileMediaKept(): void {
  test("Kept after a reload", async function keepsSwitchOff({
    page,
  }): Promise<void> {
    const seenUrls = await serveLinkedProbe(page);
    await page.goto("/#/settings");
    await switchTileMediaOff(page);

    await page.reload();

    await expect(tileMediaSwitch(page)).not.toBeChecked();
    const frame = await openLinkedProbe(page);
    expect(await frame.evaluate(showImage, LINKED_COVER_URL)).toBe(false);
    expect(seenUrls).toEqual([]);
  });
});

test.describe("Versions on the Settings page", function describeVersions(): void {
  test("Copy the versions", async function copiesVersions({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");

    await versionsList(page).selectText();

    const selected = await page.evaluate(readSelectedText);
    expect(selected).toContain(PACKAGE_VERSION);
    expect(selected).toContain(APP_MOD_API_VERSION);
  });
});

test.describe("Switch a section off", function describeSwitchOff(): void {
  test("Hide Guides", async function hidesGuides({ page }): Promise<void> {
    const frame = await openProbe(page);
    await markFrame(frame);

    await switchSectionTo(page, "Guides", false);

    await expect(sectionItem(page, "Guides")).toHaveCount(0);
    expect(await isFrameMarked(frame)).toBe(true);
  });
});

test.describe("Hidden sections keep working", function describeHidden(): void {
  test("Explorer through a link while Mods is hidden", async function opensHiddenMods({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");
    await switchSectionTo(page, "Mods", false);

    await page.goto("/#/run?mod=mod_explorer");
    await page.reload();

    await expect(stageBar(page)).toContainText("Mods");
    await expect(page.locator('iframe[title="Mods"]')).toBeVisible();
    await expect(currentItem(page)).toHaveCount(0);
  });

  test("Guides page while Guides is hidden", async function opensHiddenGuides({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");
    await switchSectionTo(page, "Guides", false);

    await page.goto("/#/guides");
    await page.reload();

    await expect(
      pageBody(page).getByRole("heading", { level: 1, name: "Guides" }),
    ).toBeVisible();
  });

  test("Current again after switching on", async function marksAgain({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");
    await switchSectionTo(page, "Mods", false);
    await page.goto("/#/run?mod=mod_explorer");
    await page.reload();
    await expect(stageBar(page)).toContainText("Mods");
    await expect(currentItem(page)).toHaveCount(0);

    await switchSectionTo(page, "Mods", true);
    await page.goBack();

    await expect(page.locator('iframe[title="Mods"]')).toBeVisible();
    await expect(currentItem(page)).toHaveText("Mods");
  });
});

test.describe("Section switches are remembered", function describeRemembered(): void {
  test("Kept after a reload", async function keepsSwitch({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");
    await switchSectionTo(page, "Mosaics", false);

    await page.reload();

    await expect(sectionItem(page, /Mosaics/)).toHaveCount(0);
    await expect(sectionSwitch(page, "Mosaics")).not.toBeChecked();
  });

  test("Mods cannot reach the switches", async function hidesSwitches({
    page,
  }): Promise<void> {
    await serveAppOriginMod(page, buildProbeFiles("probe"));
    await page.goto("/#/settings");
    await switchSectionTo(page, "Guides", false);
    await page.goto("/#/run?mod=./test-mods/probe/");
    const frame = await findModFrame(page, "probe");
    await waitForProbe(frame);
    const keys = [
      SECTION_SWITCHES_KEY,
      "sidebar-sections",
      "sections",
      "opentesela.sections",
    ];

    const answers = [];
    for (const key of keys) {
      answers.push(
        await frame.evaluate(requestFromProbe, ["storage.get", { key }]),
      );
    }

    for (const answer of answers) {
      expect(answer).toEqual({ result: null });
    }
  });
});
