import { describe, expect, it } from "vitest";
import type { ResolvedDefaultModSettings } from "../../lib/core/engine/index.ts";
import { buildViewerOpen } from "./detail_viewers.ts";
import type { DetailOpen } from "./detail_viewers.ts";

const FOLDER = "https://example.org/default_mods/";

const DEFAULTS: ResolvedDefaultModSettings = Object.freeze({
  folder: FOLDER,
  switchedOff: [],
});

const MOSAIC_SOURCE = "https://example.org/samples/mosaics/map.yaml";

/** The app's full address with `hash`, as the test page is served. */
function buildAppAddress(hash: string): string {
  const { origin, pathname, search } = window.location;
  const address = `${origin}${pathname}${search}${hash}`;
  return address;
}

describe("buildViewerOpen", function describeBuildViewerOpen(): void {
  it("opens a mod, a collection and a mosaic in their viewers with the address as target", function opensWithTarget(): void {
    const opens = [
      buildViewerOpen("mod", "https://example.org/mods/map/mod.yaml", DEFAULTS),
      buildViewerOpen(
        "collection",
        "https://example.org/tiles/laureates/collection.yaml",
        DEFAULTS,
      ),
      buildViewerOpen("mosaic", MOSAIC_SOURCE, DEFAULTS),
    ];

    const expected: DetailOpen[] = [
      {
        address: buildAppAddress(
          "#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fmods%2Fmap%2Fmod.yaml",
        ),
        place: "the mod viewer",
      },
      {
        address: buildAppAddress(
          "#/run?mod=collection_viewer&target=https%3A%2F%2Fexample.org%2Ftiles%2Flaureates%2Fcollection.yaml",
        ),
        place: "the collection viewer",
      },
      {
        address: buildAppAddress(
          "#/run?mod=mosaic_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fmap.yaml",
        ),
        place: "the mosaic viewer",
      },
    ];
    expect(opens).toEqual(expected);
  });

  it("opens a tile in the tile viewer with the address as its tile", function opensTile(): void {
    const open = buildViewerOpen(
      "tile",
      "https://example.org/tiles/books/kallocain.md",
      DEFAULTS,
    );

    const expected: DetailOpen = {
      address: buildAppAddress(
        "#/run?mod=tile_viewer&tile=https%3A%2F%2Fexample.org%2Ftiles%2Fbooks%2Fkallocain.md",
      ),
      place: "the tile viewer",
    };
    expect(open).toEqual(expected);
  });

  it("opens nothing when the viewer is switched off", function leavesOutSwitchedOff(): void {
    const defaults: ResolvedDefaultModSettings = {
      folder: FOLDER,
      switchedOff: [
        {
          name: "mosaic_viewer",
          source: `${FOLDER}mosaic_viewer/mod_conf.yaml`,
        },
      ],
    };

    expect(buildViewerOpen("mosaic", MOSAIC_SOURCE, defaults)).toBeNull();
    expect(
      buildViewerOpen("mod", "https://example.org/mod.yaml", defaults),
    ).not.toBeNull();
  });
});
