import { describe, expect, it } from "vitest";
import { resolveInstanceCatalog } from "./instance_catalog.ts";
import type { InstanceCatalog } from "./instance_catalog.ts";
import { resolveDefaultModSettings } from "./default_mod_settings.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";

const APP_URL = "https://example.org/";

function buildDefaults(switchedOff: string[]): ResolvedDefaultModSettings {
  const defaults = resolveDefaultModSettings(
    { folder: "./default_mods/", switchedOff },
    APP_URL,
  );
  return defaults;
}

function buildInstanceCatalog(
  lists: Partial<InstanceCatalog>,
): InstanceCatalog {
  const catalog: InstanceCatalog = {
    mods: [],
    collections: [],
    mosaics: [],
    ...lists,
  };
  return catalog;
}

describe("resolveInstanceCatalog", function describeResolveInstanceCatalog(): void {
  it("Entries are resolved by kind", function resolvesByKind(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({
        mods: ["./samples/mods/book_list"],
        collections: ["./samples/tiles/literature_nobel_laureates"],
        mosaics: ["./samples/mosaics/nobel_books_list.yaml"],
      }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.errors).toEqual([]);
    expect(resolution.catalog).toEqual({
      mods: ["https://example.org/samples/mods/book_list/mod_conf.yaml"],
      collections: [
        "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml",
      ],
      mosaics: ["https://example.org/samples/mosaics/nobel_books_list.yaml"],
    });
  });

  it("Default mod name", function resolvesDefaultModName(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({ mods: ["tile_viewer"] }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.catalog.mods).toEqual([
      "https://example.org/default_mods/tile_viewer/mod_conf.yaml",
    ]);
  });

  it("Two references to one mod", function reportsRepeat(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({
        mods: [
          "./samples/mods/book_list",
          "./samples/mods/book_list/mod_conf.yaml",
        ],
      }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.errors).toEqual([
      'Instance catalog mods: "./samples/mods/book_list/mod_conf.yaml" repeats an earlier entry (https://example.org/samples/mods/book_list/mod_conf.yaml).',
    ]);
  });

  it("Empty entry", function reportsEmptyEntry(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({ collections: [""] }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.errors).toEqual([
      'Instance catalog collections: "" is empty: an entry must be a non-empty string.',
    ]);
  });

  it("reports an entry that cannot be resolved", function reportsUnresolved(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({ mosaics: ["https://[broken"] }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.errors).toHaveLength(1);
    expect(resolution.errors[0]).toMatch(
      /^Instance catalog mosaics: "https:\/\/\[broken" cannot be resolved: /,
    );
  });

  it("compares repeats within a list only", function keepsListsApart(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({
        mosaics: ["./samples/mods/book_list/mosaic.yaml"],
        collections: ["./samples/mods/book_list/mosaic.yaml"],
      }),
      APP_URL,
      buildDefaults([]),
    );

    expect(resolution.errors).toEqual([]);
  });

  it("Switched-off tile viewer", function leavesOutSwitchedOff(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({
        mods: ["tile_viewer", "./samples/mods/book_list"],
      }),
      APP_URL,
      buildDefaults(["tile_viewer"]),
    );

    expect(resolution.errors).toEqual([]);
    expect(resolution.catalog.mods).toEqual([
      "https://example.org/samples/mods/book_list/mod_conf.yaml",
    ]);
  });

  it("leaves out a switched-off mod whatever reference names it", function leavesOutByPath(): void {
    const resolution = resolveInstanceCatalog(
      buildInstanceCatalog({ mods: ["./default_mods/tile_viewer"] }),
      APP_URL,
      buildDefaults(["tile_viewer"]),
    );

    expect(resolution.catalog.mods).toEqual([]);
  });
});
