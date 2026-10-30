import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Frame, Locator, Page } from "@playwright/test";
import {
  currentItem,
  openSection,
  pageBody,
  sectionItem,
  sectionsNav,
} from "./app_layout.ts";
import {
  APP_MOD_API_VERSION,
  buildProbeFiles,
  findModFrame,
  isFrameMarked,
  LINKED_APP_PROBE_LINK,
  LINKED_COVER_URL,
  markFrame,
  MEDIA_HOST,
  requestFromProbe,
  routeImages,
  serveAppOriginMod,
  serveLinkedTiles,
  showImage,
  stageBar,
  waitForProbe,
} from "./mod_routes.ts";
import { SAMPLE_RUN_HASH } from "./sample_mod.ts";
import { themeControl } from "./theme_probes.ts";

const SECTION_SWITCHES_KEY = "opentesela.sidebar-sections";
const TILE_MEDIA_LABEL = "Load media linked by tiles";

/** The version of the app's `package.json`, which the vanilla build read when Playwright built it. */
const PACKAGE_VERSION = (
  JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

function versionsList(page: Page): Locator {
  return page.getByLabel("Versions");
}

/** The `Versions` list as label-value pairs: each term with the definition after it. */
function readVersions(list: Element): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const term of list.querySelectorAll("dt")) {
    versions[term.textContent ?? ""] =
      term.nextElementSibling?.textContent ?? "";
  }
  return versions;
}

function readSelectedText(): string {
  return getSelection()?.toString() ?? "";
}

function sectionSwitch(page: Page, name: string): Locator {
  return page.getByRole("switch", { name, exact: true });
}

function sectionRow(page: Page, name: string): Locator {
  return page
    .getByRole("list", { name: "Sidebar sections" })
    .getByRole("listitem")
    .filter({ hasText: name });
}

function readItemNames(element: Element): string[] {
  const names: string[] = [];
  for (const link of element.querySelectorAll("a")) {
    names.push(link.textContent?.replace("Coming soon", "") ?? "");
  }
  return names;
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

test.describe("Settings page", function describeSettingsPage(): void {
  test("Vanilla settings page", async function showsSettings({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");

    await expect(themeControl(page)).toBeVisible();
    for (const name of ["Tiles", "Mods", "Mosaics", "Guides"]) {
      await expect(sectionSwitch(page, name)).toBeChecked();
    }
    for (const name of ["Home", "Settings", "About"]) {
      await expect(sectionRow(page, name)).toContainText("Always shown");
      await expect(sectionRow(page, name).getByRole("switch")).toHaveCount(0);
    }
    await expect(sectionRow(page, "Tiles")).toContainText("Coming soon");
    await expect(sectionRow(page, "Mosaics")).toContainText("Coming soon");
    await expect(tileMediaSwitch(page)).toBeChecked();
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
  test("Vanilla versions", async function showsVersions({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");

    await expect(versionsList(page)).toBeVisible();
    expect(await versionsList(page).evaluate(readVersions)).toEqual({
      OpenTesela: PACKAGE_VERSION,
      "Mod API": APP_MOD_API_VERSION,
    });
  });

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
    await page.goto(`/${SAMPLE_RUN_HASH}`);
    await expect(stageBar(page)).toContainText("Book List");
    const frame = await findModFrame(page, "Book List");
    await markFrame(frame);

    await switchSectionTo(page, "Guides", false);

    await expect(sectionItem(page, "Guides")).toHaveCount(0);
    expect(await isFrameMarked(frame)).toBe(true);
  });

  test("Hide a coming-soon section", async function hidesTiles({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");

    await switchSectionTo(page, "Tiles", false);

    await expect(sectionItem(page, /Tiles/)).toHaveCount(0);
  });

  test("Show it again", async function showsGuidesAgain({
    page,
  }): Promise<void> {
    await page.goto("/#/settings");
    await switchSectionTo(page, "Guides", false);

    await switchSectionTo(page, "Guides", true);

    expect(await sectionsNav(page).evaluate(readItemNames)).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
      "Settings",
      "About",
    ]);
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
