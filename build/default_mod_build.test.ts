import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleDefaultMod, listDefaultModNames } from "./default_mod_build.ts";
import type { ServedModFile } from "./default_mod_build.ts";

const FIXTURE_MODS_FOLDER = join(
  import.meta.dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "default_mods",
);

/** The folder of a fixture mod, as `bundleDefaultMod` receives it. */
function fixtureModFolder(modName: string): string {
  const modFolder = join(FIXTURE_MODS_FOLDER, modName);
  return modFolder;
}

/** The folder of a fixture mod, as the bundle errors name it. */
function fixtureModLabel(modName: string): string {
  const modLabel = `src/test/fixtures/default_mods/${modName}/`;
  return modLabel;
}

function readServedPaths(servedFiles: ServedModFile[]): string[] {
  const servedPaths: string[] = [];
  for (const servedFile of servedFiles) {
    servedPaths.push(servedFile.path);
  }
  return servedPaths;
}

function findServedFile(
  servedFiles: ServedModFile[],
  path: string,
): ServedModFile {
  for (const servedFile of servedFiles) {
    if (servedFile.path === path) {
      return servedFile;
    }
  }
  throw new Error(
    `The served files have no ${path}: ${readServedPaths(servedFiles).join(", ")}.`,
  );
}

function readServedText(servedFiles: ServedModFile[], path: string): string {
  const servedText = new TextDecoder().decode(
    findServedFile(servedFiles, path).content,
  );
  return servedText;
}

function readFixtureBytes(modName: string, path: string): Uint8Array {
  const fixtureBytes = new Uint8Array(
    readFileSync(join(fixtureModFolder(modName), path)),
  );
  return fixtureBytes;
}

/** Matches an `import` statement or an `import(` call left in a bundle. */
const LEFT_IMPORT_PATTERN = /^\s*import[\s{*"']|\bimport\s*\(/m;

describe("bundleDefaultMod", function describeBundleDefaultMod(): void {
  it("serves a split mod as its copied files, main.js and test.js", async function servesSplitMod(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("split_mod"));

    expect(readServedPaths(servedFiles)).toEqual([
      "book_type.md",
      "data/items.json",
      "main.js",
      "mod_conf.yaml",
      "test.js",
    ]);
  });

  it("bundles src/main.ts and its imports into one main.js", async function bundlesMain(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("split_mod"));
    const mainText = readServedText(servedFiles, "main.js");

    expect(mainText).toContain("split_mod_cards:");
    expect(mainText).toContain("export { mount as default }");
    expect(mainText).not.toMatch(LEFT_IMPORT_PATTERN);
  });

  it("bundles a folder given by a relative path", async function bundlesRelativeFolder(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModLabel("split_mod"));

    expect(readServedText(servedFiles, "main.js")).toContain(
      "split_mod_cards:",
    );
  });

  it("inlines a dynamic import", async function inlinesDynamicImport(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("split_mod"));
    const mainText = readServedText(servedFiles, "main.js");

    expect(mainText).toContain("split_mod_lazy_cards");
    expect(mainText).not.toContain("import(");
  });

  it("bundles test/test.ts and its imports into one test.js", async function bundlesTest(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("split_mod"));
    const testText = readServedText(servedFiles, "test.js");

    expect(testText).toContain("split_mod_case");
    expect(testText).not.toMatch(LEFT_IMPORT_PATTERN);
  });

  it("does not ship src/, test/, README.md or tsconfig.json", async function leavesSourceOut(): Promise<void> {
    const servedPaths = readServedPaths(
      await bundleDefaultMod(fixtureModFolder("split_mod")),
    );

    for (const servedPath of servedPaths) {
      expect(servedPath).not.toMatch(/^(src|test)\//);
    }
    expect(servedPaths).not.toContain("README.md");
    expect(servedPaths).not.toContain("tsconfig.json");
  });

  it("copies the other files byte for byte", async function copiesFiles(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("split_mod"));

    for (const copiedPath of [
      "book_type.md",
      "data/items.json",
      "mod_conf.yaml",
    ]) {
      expect(findServedFile(servedFiles, copiedPath).content).toEqual(
        readFixtureBytes("split_mod", copiedPath),
      );
    }
  });

  it("copies a plain mod unchanged", async function copiesPlainMod(): Promise<void> {
    const servedFiles = await bundleDefaultMod(fixtureModFolder("plain_mod"));

    expect(readServedPaths(servedFiles)).toEqual(["main.js", "mod_conf.yaml"]);
    expect(findServedFile(servedFiles, "main.js").content).toEqual(
      readFixtureBytes("plain_mod", "main.js"),
    );
  });

  it("fails when main.js is next to src/main.ts", async function failsOnMainConflict(): Promise<void> {
    const bundling = bundleDefaultMod(fixtureModFolder("main_conflict"));

    await expect(bundling).rejects.toThrow(fixtureModLabel("main_conflict"));
    await expect(bundling).rejects.toThrow(/src\/main\.ts.*main\.js/);
  });

  it("fails when test.js is next to test/test.ts", async function failsOnTestConflict(): Promise<void> {
    const bundling = bundleDefaultMod(fixtureModFolder("test_conflict"));

    await expect(bundling).rejects.toThrow(fixtureModLabel("test_conflict"));
    await expect(bundling).rejects.toThrow(/test\/test\.ts.*test\.js/);
  });

  it("fails on a syntax error, naming the folder and the source", async function failsOnSyntaxError(): Promise<void> {
    const bundling = bundleDefaultMod(fixtureModFolder("syntax_error"));

    await expect(bundling).rejects.toThrow(fixtureModLabel("syntax_error"));
    await expect(bundling).rejects.toThrow("src/main.ts");
    await expect(bundling).rejects.toThrow("Unexpected token");
  });

  it("fails on a missing import", async function failsOnMissingImport(): Promise<void> {
    const bundling = bundleDefaultMod(fixtureModFolder("missing_import"));

    await expect(bundling).rejects.toThrow(fixtureModLabel("missing_import"));
    await expect(bundling).rejects.toThrow("./missing_module.ts");
  });

  it("fails on an import outside the mod folder", async function failsOnOutsideImport(): Promise<void> {
    const bundling = bundleDefaultMod(fixtureModFolder("outside_import"));

    await expect(bundling).rejects.toThrow(fixtureModLabel("outside_import"));
    await expect(bundling).rejects.toThrow("../outside_module.ts");
    await expect(bundling).rejects.toThrow("outside the mod folder");
  });
});

describe("listDefaultModNames", function describeListDefaultModNames(): void {
  it("lists the subfolders, not the root files", function listsSubfolders(): void {
    expect(listDefaultModNames(FIXTURE_MODS_FOLDER)).toEqual([
      "main_conflict",
      "missing_import",
      "outside_import",
      "plain_mod",
      "split_mod",
      "syntax_error",
      "test_conflict",
    ]);
  });

  it("lists nothing for a missing folder", function listsMissingFolder(): void {
    expect(listDefaultModNames(join(FIXTURE_MODS_FOLDER, "missing"))).toEqual(
      [],
    );
  });
});
