import { describe, expect, it } from "vitest";
import type { LoadedMosaic } from "../mosaic/index.ts";
import { diffMosaics } from "./index.ts";

const MOD = "https://example.org/samples/mods/country_map/mod_conf.yaml";
const COLLECTION =
  "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml";
const PORTRAITS = {
  category: "show",
  host: "https://upload.wikimedia.org",
  reason: "Shows the portraits",
} as const;

function buildMosaic(overrides: Partial<LoadedMosaic>): LoadedMosaic {
  const mosaic: LoadedMosaic = {
    source: "teselarium-browser:///r1/nobel_map.yaml",
    title: "Nobel map",
    description: "",
    mod: MOD,
    collection: COLLECTION,
    config: {},
    aliases: {},
    permissions: [],
    ...overrides,
  };
  return mosaic;
}

describe("diffMosaics", function describeDiffMosaics(): void {
  it("lists nothing for the same mosaic", function listsNothing(): void {
    expect(diffMosaics(buildMosaic({}), buildMosaic({}))).toEqual([]);
  });

  it("New host", function listsAddedHost(): void {
    const changes = diffMosaics(
      buildMosaic({}),
      buildMosaic({ permissions: [PORTRAITS] }),
    );

    expect(changes).toEqual([
      {
        kind: "show",
        change: "added",
        host: PORTRAITS.host,
        reason: PORTRAITS.reason,
      },
    ]);
  });

  it("lists a removed line and a changed reason", function listsRemoved(): void {
    const changes = diffMosaics(
      buildMosaic({ permissions: [PORTRAITS] }),
      buildMosaic({ permissions: [{ ...PORTRAITS, reason: "Portraits" }] }),
    );

    expect(changes).toEqual([
      {
        kind: "show",
        change: "added",
        host: PORTRAITS.host,
        reason: "Portraits",
      },
      {
        kind: "show",
        change: "removed",
        host: PORTRAITS.host,
        reason: PORTRAITS.reason,
      },
    ]);
  });

  it("lists the fields, aliases by field and config by key", function listsFields(): void {
    const changes = diffMosaics(
      buildMosaic({
        aliases: { title: ["name"] },
        config: { map: { zoom: 2 }, labels: true },
      }),
      buildMosaic({
        title: "Laureates, my way",
        description: "Mine.",
        collection: null,
        aliases: { title: ["name"], country: ["birth_country"] },
        config: { map: { zoom: 3 }, labels: true },
      }),
    );

    expect(changes).toEqual([
      {
        kind: "field",
        field: "title",
        before: "Nobel map",
        after: "Laureates, my way",
      },
      { kind: "field", field: "description", before: null, after: "Mine." },
      { kind: "field", field: "collection", before: COLLECTION, after: null },
      {
        kind: "alias",
        field: "country",
        before: null,
        after: ["birth_country"],
      },
      { kind: "config", key: "map", before: { zoom: 2 }, after: { zoom: 3 } },
    ]);
  });

  it("lists the whole mosaic for a new one", function listsNewMosaic(): void {
    const changes = diffMosaics(
      null,
      buildMosaic({ aliases: { title: ["name"] }, permissions: [PORTRAITS] }),
    );

    expect(changes).toEqual([
      { kind: "field", field: "title", before: null, after: "Nobel map" },
      { kind: "field", field: "mod", before: null, after: MOD },
      { kind: "field", field: "collection", before: null, after: COLLECTION },
      { kind: "alias", field: "title", before: null, after: ["name"] },
      {
        kind: "show",
        change: "added",
        host: PORTRAITS.host,
        reason: PORTRAITS.reason,
      },
    ]);
  });
});
