import { afterEach, describe, expect, it } from "vitest";
import { resolveDefaultModSettings } from "../lib/core/engine/index.ts";
import { loadMod } from "../lib/mod/index.ts";
import { APP_BASE_URL, fetchAppFile } from "../test/sample_files.ts";
import { fetchTestFile, testTexts } from "../test/test_files.ts";
import { launchTestMod } from "../test/test_launches.ts";
import { DEFAULT_MODS } from "./default_mods.ts";

const DEFAULTS = resolveDefaultModSettings(DEFAULT_MODS, APP_BASE_URL);
const OPEN_ANY_SITE = { category: "open", host: "*" };

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

describe("default mods", function describeDefaultMods(): void {
  it("Vanilla settings", function readsVanillaSettings(): void {
    expect(DEFAULTS).toEqual({
      folder: "https://example.org/default_mods/",
      switchedOff: [],
    });
  });

  it("loads the mod explorer from default_mods/", async function loadsExplorer(): Promise<void> {
    const explorer = await loadMod("mod_explorer", {
      baseUrl: APP_BASE_URL,
      defaultModsFolder: DEFAULTS.folder,
      fetch: fetchAppFile,
    });

    expect(explorer).toMatchObject({
      source: "https://example.org/default_mods/mod_explorer/mod_conf.yaml",
      title: "Mods",
      typeSource: null,
      config: { viewer: "mod_viewer" },
    });
    expect(explorer.permissions).toEqual([
      expect.objectContaining(OPEN_ANY_SITE),
    ]);
    expect(explorer.code).toContain("async function mount(");
  });

  it("loads the mod viewer from default_mods/", async function loadsViewer(): Promise<void> {
    const viewer = await loadMod("mod_viewer", {
      baseUrl: APP_BASE_URL,
      defaultModsFolder: DEFAULTS.folder,
      fetch: fetchAppFile,
    });

    expect(viewer).toMatchObject({
      source: "https://example.org/default_mods/mod_viewer/mod_conf.yaml",
      typeSource: null,
      defaultMosaic: null,
    });
    expect(viewer).not.toHaveProperty("name");
    expect(viewer.permissions).toEqual([
      expect.objectContaining(OPEN_ANY_SITE),
    ]);
    expect(viewer.code).toContain("async function mount(");
  });

  it("Explorer from the default folder", async function launchesExplorer(): Promise<void> {
    const launch = await launchTestMod(
      { mod: "mod_explorer", collection: null, params: {} },
      {
        defaults: DEFAULTS,
        fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchAppFile },
      },
    );

    expect(launch.mod.source).toBe(
      "https://example.org/default_mods/mod_explorer/mod_conf.yaml",
    );
    expect(launch.context.permissions.granted).toEqual([
      expect.objectContaining(OPEN_ANY_SITE),
    ]);
    expect(launch.issues).toEqual([]);
  });

  it("Replaced viewer", async function opensReplacedViewer(): Promise<void> {
    testTexts.set(
      "https://example.org/default_mods/mod_viewer/mod_conf.yaml",
      'mod:\n  title: "Fancy Viewer"\n  version: "2.0.0"\n  entrypoint: "./main.js"',
    );

    const launch = await launchTestMod(
      { mod: "mod_viewer", collection: null, params: {} },
      {
        defaults: DEFAULTS,
        fetchOptions: { baseUrl: APP_BASE_URL, fetch: fetchTestFile },
      },
    );

    expect(launch.mod.title).toBe("Fancy Viewer");
    expect(launch.mod.source).toBe(
      "https://example.org/default_mods/mod_viewer/mod_conf.yaml",
    );
  });
});
