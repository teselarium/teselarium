import { describe, expect, it } from "vitest";
import {
  resolveDefaultModSettings,
  resolveInstanceCatalog,
} from "../lib/core/engine/index.ts";
import { loadModFile } from "../lib/mod/index.ts";
import { APP_BASE_URL, fetchAppFile } from "../test/sample_files.ts";
import { DEFAULT_MODS } from "./default_mods.ts";
import { INSTANCE_CATALOG } from "./instance_catalog.ts";
import { NPM_HOST } from "./library_host.ts";

const DEFAULTS = resolveDefaultModSettings(DEFAULT_MODS, APP_BASE_URL);

function listAllSources(lists: Record<string, string[]>): string[] {
  const sources: string[] = [];
  for (const list of Object.values(lists)) {
    sources.push(...list);
  }
  return sources;
}

/** The default mosaic of each catalog mod that declares one. */
async function listDefaultMosaics(modSources: string[]): Promise<string[]> {
  const defaultMosaics: string[] = [];
  for (const source of modSources) {
    const modFile = await loadModFile(source, {
      baseUrl: APP_BASE_URL,
      fetch: fetchAppFile,
      npmHost: NPM_HOST,
    });
    if (modFile.defaultMosaic !== null) {
      defaultMosaics.push(modFile.defaultMosaic);
    }
  }
  return defaultMosaics;
}

describe("INSTANCE_CATALOG", function describeInstanceCatalog(): void {
  const resolution = resolveInstanceCatalog(
    INSTANCE_CATALOG,
    APP_BASE_URL,
    DEFAULTS,
  );

  it("resolves with no errors", function resolvesCleanly(): void {
    expect(resolution.errors).toEqual([]);
  });

  it("Vanilla lists", function listsSamples(): void {
    expect(resolution.catalog).toEqual({
      mods: [
        "https://example.org/samples/mods/book_list/mod_conf.yaml",
        "https://example.org/samples/mods/flashcards/mod_conf.yaml",
        "https://example.org/samples/mods/country_map/mod_conf.yaml",
      ],
      collections: [
        "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml",
        "https://example.org/samples/tiles/literature_nobel_laureates_books/collection.yaml",
      ],
      mosaics: [
        "https://example.org/samples/mosaics/nobel_books_list.yaml",
        "https://example.org/samples/mosaics/nobel_laureates_map.yaml",
      ],
    });
  });

  it("holds no fixture and no default mod", function holdsNoFixture(): void {
    for (const source of listAllSources({ ...resolution.catalog })) {
      expect(source).not.toContain("/fixtures/");
      expect(source.startsWith(DEFAULTS.folder)).toBe(false);
    }
  });

  it("No default mosaic listed", async function holdsNoDefaultMosaic(): Promise<void> {
    const defaultMosaics = await listDefaultMosaics(resolution.catalog.mods);

    expect(defaultMosaics).toHaveLength(3);
    for (const defaultMosaic of defaultMosaics) {
      expect(resolution.catalog.mosaics).not.toContain(defaultMosaic);
    }
  });
});
