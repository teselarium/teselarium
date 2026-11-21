import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../App.tsx";
import { COMING_SOON_SECTIONS } from "../../test/registries/coming_soon_sections.ts";
import { startTestApp } from "../../test/test_app.ts";
import type { AppFixture } from "../../test/test_app.ts";
import { MOD_API_VERSION } from "../../lib/core/engine/index.ts";
import {
  openStageSection,
  readStageSnapshot,
} from "../../lib/core/stage/index.ts";
import { settleStage } from "../../test/test_stages.ts";
import type { SiteDecision } from "../../lib/core/permissions/index.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  buildProbeDecision,
  PROBE_CONNECT_PERMISSION,
  PROBE_MOD_SOURCE,
  SAMPLE_COVERS_PERMISSION,
} from "../../test/sample_mods.ts";
import { PLAYER_SITES_KEY, readPlayerSitesSnapshot } from "./player_sites.ts";
import { recordRecentlyUsed } from "./recently_used.ts";
import { createMemoryBrowserDatabase } from "../../lib/core/storage/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import type { TestUserCatalogOptions } from "../../test/test_user_catalog.ts";
import { readUserCatalogSnapshot } from "../user_catalog/user_catalog_store.ts";
import { SITE_DECISIONS_KEY } from "./site_decisions.ts";
import { CATALOG_SETTING_KEY } from "./catalog_setting.ts";
import { TILE_MEDIA_SETTING_KEY } from "./tile_media_setting.ts";

const TILE_MEDIA_LABEL = "Load media linked by tiles";
const CATALOG_LABEL = "List the default mosaics of mods";

/** The version of the app's `package.json`, which the build gives to the app. */
const PACKAGE_VERSION = (
  JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../package.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

function renderApp(fixture: AppFixture): RenderResult {
  return render(
    <App
      stage={fixture.stage}
      combinations={fixture.combinations}
      listChoices={fixture.listChoices}
      recentlyUsed={fixture.recentlyUsed}
      userCatalog={fixture.userCatalog}
      appTheme={fixture.appTheme}
      sections={fixture.sections}
      switches={fixture.switches}
      tileMedia={fixture.tileMedia}
      catalogSetting={fixture.catalogSetting}
      theater={fixture.theater}
      siteDecisions={fixture.siteDecisions}
      playerSites={fixture.playerSites}
      layout={fixture.layout}
    />,
  );
}

function buildUserEntry(
  address: string,
  place: "browser" | "remote",
): UserCatalogEntry {
  const entry: UserCatalogEntry = {
    address,
    place,
    root: place === "browser" ? "r1" : null,
    provenance: {
      folder: null,
      path: place === "browser" ? "a.yaml" : null,
      addedAt: "2026-11-20T10:00:00.000Z",
      updatedAt: null,
    },
  };
  return entry;
}

/** Two stored mosaics and one added by URL, in a memory database, kept persistently when `isKept`. */
async function buildUserCatalogOptions(
  isKept: boolean,
): Promise<TestUserCatalogOptions> {
  const database = createMemoryBrowserDatabase<UserCatalogEntry>();
  await database.apply({
    putFiles: [
      { address: "opentesela-browser:///r1/a.yaml", text: "mosaic: {}\n" },
      { address: "opentesela-browser:///r1/b.yaml", text: "mosaic: {}\n" },
    ],
    putEntries: [
      buildUserEntry("opentesela-browser:///r1/a.yaml", "browser"),
      buildUserEntry("opentesela-browser:///r1/b.yaml", "browser"),
      buildUserEntry("https://mosaics.example.net/c.yaml", "remote"),
    ],
    deleteAddresses: [],
  });
  const options: TestUserCatalogOptions = {
    database,
    entries: await database.readEntries(),
    isKept,
  };
  return options;
}

/** Records two mods, one collection and one combination as recently used. */
function recordTriedCombinations(fixture: AppFixture): void {
  recordRecentlyUsed(fixture.recentlyUsed, {
    kind: "mod",
    source: "https://example.org/mods/atlas/mod_conf.yaml",
  });
  recordRecentlyUsed(fixture.recentlyUsed, {
    kind: "mod",
    source: "https://example.org/mods/globe/mod_conf.yaml",
  });
  recordRecentlyUsed(fixture.recentlyUsed, {
    kind: "collection",
    source: "https://example.org/tiles/laureates/collection.yaml",
  });
  recordRecentlyUsed(fixture.recentlyUsed, {
    kind: "combination",
    mod: "https://example.org/mods/atlas/mod_conf.yaml",
    collection: "https://example.org/tiles/laureates/collection.yaml",
  });
}

function sidebarSections(): HTMLElement {
  return screen.getByRole("navigation", { name: "Sections" });
}

function readSidebarNames(): string[] {
  const names: string[] = [];
  for (const item of within(sidebarSections()).getAllByRole("link")) {
    names.push(item.textContent?.replace("Coming soon", "") ?? "");
  }
  return names;
}

function sectionRows(): HTMLElement {
  return screen.getByRole("list", { name: "Sidebar sections" });
}

function findRow(name: string): HTMLElement {
  for (const row of within(sectionRows()).getAllByRole("listitem")) {
    if (row.textContent?.startsWith(name) === true) {
      return row;
    }
  }
  throw new Error(`Expected a row for ${name}`);
}

const COVERS_LINE = "show content from https://upload.wikimedia.org";
const COVERS_REMOVE_LABEL = `Remove Probe: ${COVERS_LINE}`;
const COVERS_CHECKBOX_LABEL = `Allow Probe: ${COVERS_LINE}`;
const ATLAS_SOURCE = "https://mods.example.net/atlas/mod_conf.yaml";

function buildAtlasDecision(): SiteDecision {
  const decision: SiteDecision = {
    ...buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    mod: ATLAS_SOURCE,
    title: "Atlas",
  };
  return decision;
}

function buildDecisionsStorage(decisions: SiteDecision[]): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(SITE_DECISIONS_KEY, JSON.stringify(decisions));
  return storage;
}

/** The groups of the Mod permissions list, without the decision rows inside them. */
function readModGroups(): HTMLElement[] {
  const list = screen.getByRole("list", { name: "Remembered mods" });
  const groups = [...list.querySelectorAll<HTMLElement>(":scope > li")];
  return groups;
}

/** The group of the mod titled `title`, found by its expand button. */
function readModGroup(title: string): HTMLElement {
  for (const group of readModGroups()) {
    if (group.textContent?.startsWith(title) === true) {
      return group;
    }
  }
  throw new Error(`Expected a group for the mod "${title}"`);
}

function readGroupToggle(title: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${title} `) });
}

/** The same decisions in any order: the order of the store is not part of what Settings shows. */
function expectSameDecisions(actual: unknown, expected: SiteDecision[]): void {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
}

function readGroupCheckbox(title: string): HTMLElement {
  return screen.getByRole("checkbox", {
    name: `Allow all decisions of ${title}`,
  });
}

function expandGroup(title: string): void {
  fireEvent.click(readGroupToggle(title));
}

function readStoredDecisions(storage: MemoryStorage): unknown {
  const stored: unknown = JSON.parse(
    storage.getItem(SITE_DECISIONS_KEY) ?? "null",
  );
  return stored;
}

function readGroupHeadings(): string[] {
  const headings: string[] = [];
  for (const heading of screen.getAllByRole("heading", { level: 2 })) {
    headings.push(heading.textContent ?? "");
  }
  return headings;
}

/** The `Versions` list as label-value pairs: each term with the definition after it. */
function readVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  const list = screen.getByLabelText("Versions");
  for (const term of within(list).getAllByRole("term")) {
    versions[term.textContent ?? ""] =
      term.nextElementSibling?.textContent ?? "";
  }
  return versions;
}

describe("SettingsPage", function describeSettingsPage(): void {
  it("Vanilla settings page", async function showsSettings(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    for (const name of ["Tiles", "Mods", "Mosaics", "Guides"]) {
      expect(screen.getByRole("switch", { name })).toBeChecked();
    }
    for (const name of ["Home", "Settings", "About"]) {
      expect(findRow(name)).toHaveTextContent("Always shown");
      expect(within(findRow(name)).queryByRole("switch")).toBeNull();
    }
    expect(sectionRows()).not.toHaveTextContent("Coming soon");
    expect(
      screen.getByRole("switch", { name: CATALOG_LABEL }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: TILE_MEDIA_LABEL }),
    ).toBeChecked();
    expect(screen.getByText("Nothing is recently used.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.getByText("You have added no mosaic.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove all" })).toBeNull();
    expect(screen.getByText("No remembered decisions.")).toBeInTheDocument();
  });

  it("Count after importing", async function countsUserMosaics(): Promise<void> {
    const fixture = await startTestApp("#/settings", {
      userCatalog: await buildUserCatalogOptions(true),
    });

    renderApp(fixture);

    expect(
      await screen.findByText(
        "You added 3 mosaics, 2 of them stored in this browser. This browser keeps them.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove all" }),
    ).toBeInTheDocument();
  });

  it("Not kept persistently", async function warnsNotKept(): Promise<void> {
    const fixture = await startTestApp("#/settings", {
      userCatalog: await buildUserCatalogOptions(false),
    });

    renderApp(fixture);

    expect(
      await screen.findByText(
        "You added 3 mosaics, 2 of them stored in this browser. This browser may clear the stored mosaics when space runs low: export them to keep a copy.",
      ),
    ).toBeInTheDocument();
  });

  it("Remove all", async function removesAllUserMosaics(): Promise<void> {
    const options = await buildUserCatalogOptions(true);
    const fixture = await startTestApp("#/settings", { userCatalog: options });
    renderApp(fixture);
    const sandboxesBefore = readStageSnapshot(fixture.stage).sandboxes;

    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));
    expect(
      screen.getByText(
        "Remove all 3 mosaics from your catalog? The 2 stored in this browser are deleted.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove 3 mosaics" }));

    expect(
      await screen.findByText("You have added no mosaic."),
    ).toBeInTheDocument();
    expect(fixture.stage.userCatalog).toEqual([]);
    expect(await options.database?.readEntries()).toEqual([]);
    expect(readStageSnapshot(fixture.stage).sandboxes).toBe(sandboxesBefore);
  });

  it("keeps the mosaics when Remove all is cancelled", async function keepsOnCancel(): Promise<void> {
    const fixture = await startTestApp("#/settings", {
      userCatalog: await buildUserCatalogOptions(true),
    });
    renderApp(fixture);

    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Remove all" }),
    ).toBeInTheDocument();
    expect(readUserCatalogSnapshot(fixture.userCatalog).entries).toHaveLength(
      3,
    );
  });

  it("Count after trying combinations", async function countsRecentlyUsed(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    recordTriedCombinations(fixture);

    renderApp(fixture);

    expect(
      screen.getByText(
        "2 mods, 1 collection, 0 mosaics and 1 combination are recently used, kept only on this device.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("Clear", async function clearsRecentlyUsed(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    recordTriedCombinations(fixture);
    renderApp(fixture);
    const sandboxesBefore = readStageSnapshot(fixture.stage).sandboxes;

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByText("Nothing is recently used.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(readStageSnapshot(fixture.stage).sandboxes).toBe(sandboxesBefore);
  });

  it("One remembered allow", async function listsRememberedAllow(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    const group = readModGroup("Probe");
    expect(group).toHaveTextContent(PROBE_MOD_SOURCE);
    expect(readGroupToggle("Probe")).toHaveAccessibleName("Probe 1 allowed");
    expect(readGroupToggle("Probe")).toHaveAttribute("aria-expanded", "false");
    expect(readGroupCheckbox("Probe")).toHaveAttribute("aria-checked", "true");
    expect(
      within(group).getByRole("button", {
        name: "Remove all decisions of Probe",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: COVERS_CHECKBOX_LABEL }),
    ).toBeNull();

    expandGroup("Probe");

    expect(readGroupToggle("Probe")).toHaveAttribute("aria-expanded", "true");
    expect(group).toHaveTextContent(COVERS_LINE);
    expect(group).toHaveTextContent("Allowed");
    expect(
      screen.getByRole("checkbox", { name: COVERS_CHECKBOX_LABEL }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(group).getByRole("button", { name: COVERS_REMOVE_LABEL }),
    ).toBeInTheDocument();
  });

  it("A remembered refusal", async function listsRememberedRefusal(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, false),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    expect(readGroupToggle("Probe")).toHaveAccessibleName("Probe 1 refused");
    expect(readGroupCheckbox("Probe")).toHaveAttribute("aria-checked", "false");
    expandGroup("Probe");

    expect(readModGroup("Probe")).toHaveTextContent("Refused");
    expect(
      screen.getByRole("checkbox", { name: COVERS_CHECKBOX_LABEL }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("Decisions of two mods", async function groupsByMod(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildAtlasDecision(),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    const groups = readModGroups();
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent(/^Atlas/);
    expect(groups[1]).toHaveTextContent(/^Probe/);
    expect(readGroupToggle("Probe")).toHaveAccessibleName(
      "Probe 1 allowed, 1 refused",
    );
    expect(readGroupToggle("Atlas")).toHaveAttribute("aria-expanded", "false");
    expect(readGroupToggle("Probe")).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryAllByRole("checkbox", { name: /^Allow [^:]+: / }),
    ).toEqual([]);
  });

  it("lists a mod's decisions by category and host once expanded", async function sortsDecisions(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    expandGroup("Probe");

    const checkboxes = screen.getAllByRole("checkbox", {
      name: /^Allow Probe: /,
    });
    expect(checkboxes[0]).toHaveAccessibleName(
      "Allow Probe: exchange data with https://api.example.net",
    );
    expect(checkboxes[1]).toHaveAccessibleName(COVERS_CHECKBOX_LABEL);
  });

  it("The cost is stated", async function statesCost(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(
      screen.getByText(
        /Each site a mod is allowed to use can see that you used that mod\./,
      ),
    ).toBeInTheDocument();
  });

  it("Allow a remembered refusal", async function allowsRememberedRefusal(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, false),
    ]);
    const fixture = await startTestApp("#/settings", { storage });
    renderApp(fixture);
    expandGroup("Probe");

    fireEvent.click(
      screen.getByRole("checkbox", { name: COVERS_CHECKBOX_LABEL }),
    );

    expect(
      screen.getByRole("checkbox", { name: COVERS_CHECKBOX_LABEL }),
    ).toHaveAttribute("aria-checked", "true");
    expect(readModGroup("Probe")).toHaveTextContent("Allowed");
    expect(readGroupToggle("Probe")).toHaveAccessibleName("Probe 1 allowed");
    expect(readStoredDecisions(storage)).toEqual([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
    expect(fixture.stage.readSiteDecisions()).toEqual([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
  });

  it("Some allowed, some refused", async function showsMixedGroup(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    expect(readGroupCheckbox("Probe")).toHaveAttribute("aria-checked", "mixed");
    expect(readGroupToggle("Probe")).toHaveAccessibleName(
      "Probe 1 allowed, 1 refused",
    );
  });

  it("Allow all of a mod", async function allowsAllOfMod(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ]);
    const fixture = await startTestApp("#/settings", { storage });
    renderApp(fixture);

    fireEvent.click(readGroupCheckbox("Probe"));

    const allowedDecisions = [
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, true),
    ];
    expect(readGroupCheckbox("Probe")).toHaveAttribute("aria-checked", "true");
    expect(readGroupToggle("Probe")).toHaveAccessibleName("Probe 2 allowed");
    expect(readGroupToggle("Probe")).toHaveAttribute("aria-expanded", "false");
    expectSameDecisions(readStoredDecisions(storage), allowedDecisions);
    expectSameDecisions(fixture.stage.readSiteDecisions(), allowedDecisions);
  });

  it("Refuse all of a mod", async function refusesAllOfMod(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, true),
    ]);
    const fixture = await startTestApp("#/settings", { storage });
    renderApp(fixture);

    fireEvent.click(readGroupCheckbox("Probe"));

    const refusedDecisions = [
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, false),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
    ];
    expect(readGroupCheckbox("Probe")).toHaveAttribute("aria-checked", "false");
    expect(readGroupToggle("Probe")).toHaveAccessibleName("Probe 2 refused");
    expectSameDecisions(readStoredDecisions(storage), refusedDecisions);
    expectSameDecisions(fixture.stage.readSiteDecisions(), refusedDecisions);
  });

  it("Other mods unchanged", async function keepsOtherMods(): Promise<void> {
    const atlasRefusal: SiteDecision = {
      ...buildAtlasDecision(),
      allowed: false,
    };
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, false),
      atlasRefusal,
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    fireEvent.click(readGroupCheckbox("Probe"));

    expect(readGroupCheckbox("Atlas")).toHaveAttribute("aria-checked", "false");
    expect(readStoredDecisions(storage)).toContainEqual(atlasRefusal);
  });

  it("Remove all of a mod", async function removesAllOfMod(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      buildProbeDecision(PROBE_CONNECT_PERMISSION, false),
      buildAtlasDecision(),
    ]);
    renderApp(await startTestApp("#/settings", { storage }));

    fireEvent.click(
      screen.getByRole("button", { name: "Remove all decisions of Probe" }),
    );

    expect(readModGroups()).toHaveLength(1);
    expect(readModGroups()[0]).toHaveTextContent(/^Atlas/);
    expect(readStoredDecisions(storage)).toEqual([buildAtlasDecision()]);
  });

  it("Remove", async function removesDecision(): Promise<void> {
    const storage = buildDecisionsStorage([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
    const fixture = await startTestApp("#/settings", { storage });
    renderApp(fixture);
    expandGroup("Probe");

    fireEvent.click(screen.getByRole("button", { name: COVERS_REMOVE_LABEL }));

    expect(screen.getByText("No remembered decisions.")).toBeInTheDocument();
    expect(storage.getItem(SITE_DECISIONS_KEY)).toBe("[]");
    expect(fixture.stage.readSiteDecisions()).toEqual([]);
  });

  it("Remembered player site", async function listsPlayerSite(): Promise<void> {
    const storage = createMemoryStorage();
    storage.setItem(PLAYER_SITES_KEY, '["www.youtube-nocookie.com"]');

    renderApp(await startTestApp("#/settings", { storage }));

    const list = screen.getByRole("list", { name: "Sites always played from" });
    expect(list).toHaveTextContent("play media from www.youtube-nocookie.com");
    expect(list).toHaveTextContent("Every mod");
    expect(
      within(list).getByRole("button", {
        name: "Remove: play media from www.youtube-nocookie.com",
      }),
    ).toBeInTheDocument();
  });

  it("removes a player site", async function removesPlayerSite(): Promise<void> {
    const storage = createMemoryStorage();
    storage.setItem(
      PLAYER_SITES_KEY,
      '["www.youtube-nocookie.com","player.vimeo.com"]',
    );
    const fixture = await startTestApp("#/settings", { storage });
    renderApp(fixture);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove: play media from www.youtube-nocookie.com",
      }),
    );

    expect(readPlayerSitesSnapshot(fixture.playerSites)).toEqual([
      "player.vimeo.com",
    ]);
    expect(storage.getItem(PLAYER_SITES_KEY)).toBe('["player.vimeo.com"]');
    expect(
      screen.queryByText("play media from www.youtube-nocookie.com"),
    ).toBeNull();
  });

  it("lists no player site when none is remembered", async function listsNoPlayerSite(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(
      screen.queryByRole("list", { name: "Sites always played from" }),
    ).toBeNull();
  });

  it("says what the Privacy switch shows the linked sites", async function describesPrivacy(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(
      screen.getByText(
        "Mods can show the images, audio and video their tiles link to. The linked sites can see that you viewed the tile. Applies to mods opened after the change.",
      ),
    ).toBeInTheDocument();
  });

  it("Switched off before opening a mod", async function switchesTileMediaOff(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderApp(fixture);

    fireEvent.click(screen.getByRole("switch", { name: TILE_MEDIA_LABEL }));

    expect(
      screen.getByRole("switch", { name: TILE_MEDIA_LABEL }),
    ).not.toBeChecked();
    expect(fixture.stage.loadsTileLinkedMedia).toBe(false);
    expect(fixture.storage.getItem(TILE_MEDIA_SETTING_KEY)).toBe("false");
  });

  it("switches the media setting on again", async function switchesTileMediaOn(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderApp(fixture);

    fireEvent.click(screen.getByRole("switch", { name: TILE_MEDIA_LABEL }));
    fireEvent.click(screen.getByRole("switch", { name: TILE_MEDIA_LABEL }));

    expect(
      screen.getByRole("switch", { name: TILE_MEDIA_LABEL }),
    ).toBeChecked();
    expect(fixture.stage.loadsTileLinkedMedia).toBe(true);
  });

  it("says the catalog switch helps when writing a mod", async function describesCatalogSwitch(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(screen.getByText(/helps when writing a mod/)).toBeInTheDocument();
  });

  it("switches the default mosaics of mods on", async function switchesCatalogOn(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderApp(fixture);

    fireEvent.click(screen.getByRole("switch", { name: CATALOG_LABEL }));

    expect(screen.getByRole("switch", { name: CATALOG_LABEL })).toBeChecked();
    expect(fixture.stage.catalogDefaultMosaics).toBe(true);
    expect(fixture.storage.getItem(CATALOG_SETTING_KEY)).toBe("true");
  });

  it("Vanilla versions", async function showsVersions(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(readGroupHeadings()).toEqual([
      "Appearance",
      "Sidebar",
      "Catalog",
      "Privacy",
      "Mod permissions",
      "Version",
    ]);
    expect(readVersions()).toEqual({
      OpenTesela: PACKAGE_VERSION,
      "Mod API": MOD_API_VERSION,
    });
  });

  it("Version follows the build: shows the version of package.json", async function followsBuild(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    expect(readVersions().OpenTesela).toBe(PACKAGE_VERSION);
  });

  it("lists the sections in the sidebar's order", async function listsInOrder(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    const names: string[] = [];
    for (const row of within(sectionRows()).getAllByRole("listitem")) {
      names.push(row.textContent?.split(/Always|Coming/)[0] ?? "");
    }

    expect(names).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
      "Settings",
      "About",
    ]);
  });

  it("Hide Guides", async function hidesGuides(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));

    expect(screen.getByRole("switch", { name: "Guides" })).not.toBeChecked();
    expect(readSidebarNames()).not.toContain("Guides");
  });

  it("Coming-soon section of an instantiation", async function showsComingSoon(): Promise<void> {
    renderApp(
      await startTestApp("#/settings", { sections: COMING_SOON_SECTIONS }),
    );

    expect(
      screen.getByRole("switch", { name: "Example Section" }),
    ).toBeChecked();
    expect(findRow("Example Section")).toHaveTextContent("Coming soon");
    expect(findRow("Mosaics")).not.toHaveTextContent("Coming soon");
  });

  it("Hide a coming-soon section", async function hidesComingSoon(): Promise<void> {
    renderApp(
      await startTestApp("#/settings", { sections: COMING_SOON_SECTIONS }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Example Section" }));

    expect(readSidebarNames()).not.toContain("Example Section");
  });

  it("Hide Tiles", async function hidesTiles(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Tiles" }));

    expect(screen.getByRole("switch", { name: "Tiles" })).not.toBeChecked();
    expect(readSidebarNames()).not.toContain("Tiles");
  });

  it("Show it again", async function showsGuidesAgain(): Promise<void> {
    renderApp(await startTestApp("#/settings"));

    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));
    fireEvent.click(screen.getByRole("switch", { name: "Guides" }));

    expect(readSidebarNames()).toEqual([
      "Home",
      "Tiles",
      "Mods",
      "Mosaics",
      "Guides",
      "Settings",
      "About",
    ]);
  });

  it("makes no item current while its section is hidden, and again once shown", async function followsSwitches(): Promise<void> {
    const fixture = await startTestApp("#/settings");
    renderApp(fixture);
    fireEvent.click(screen.getByRole("switch", { name: "Mods" }));

    await act(async function openMods(): Promise<void> {
      openStageSection(fixture.stage, "mods");
      await settleStage(fixture.stage);
    });
    expect(
      within(sidebarSections()).queryByRole("link", { current: "page" }),
    ).toBeNull();
    await act(async function showMods(): Promise<void> {
      openStageSection(fixture.stage, "settings");
      await settleStage(fixture.stage);
    });
    fireEvent.click(screen.getByRole("switch", { name: "Mods" }));
    await act(async function backToMods(): Promise<void> {
      openStageSection(fixture.stage, "mods");
      await settleStage(fixture.stage);
    });

    expect(
      within(sidebarSections()).getByRole("link", { current: "page" }),
    ).toHaveAccessibleName("Mods");
  });
});
