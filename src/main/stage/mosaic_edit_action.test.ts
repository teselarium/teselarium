import { describe, expect, it } from "vitest";
import type { SandboxLink } from "../../lib/core/stage/index.ts";
import { readMosaicEditAction } from "./mosaic_edit_action.ts";
import type { MosaicEditAction } from "./mosaic_edit_action.ts";

const FLASHCARDS = "https://example.org/samples/mods/flashcards";
const LAUREATES = "https://example.org/samples/collections/laureates.yaml";
const MAP_MOSAIC = "https://example.org/samples/mosaics/nobel_map.yaml";
const BOOKS_MOSAIC = "https://example.org/samples/mosaics/nobel_books.yaml";
const STORED_MOSAIC = "teselarium-browser:///r1/nobel_map.yaml";
const TILE = "https://example.org/samples/tiles/laureate.yaml";

function buildLink(fields: Partial<SandboxLink>): SandboxLink {
  const link: SandboxLink = {
    mod: FLASHCARDS,
    collection: LAUREATES,
    tile: null,
    mosaic: null,
    sites: null,
    params: {},
    ...fields,
  };
  return link;
}

function buildViewerAction(
  label: string,
  params: Record<string, string>,
): MosaicEditAction {
  const action: MosaicEditAction = {
    label,
    link: { mod: "mosaic_viewer", collection: null, params },
  };
  return action;
}

describe("mosaic edit action of the stage bar", function describeEditAction(): void {
  it("Stored mosaic: Edit mosaic, in edit mode", function editsStored(): void {
    const action = readMosaicEditAction(buildLink({ mosaic: STORED_MOSAIC }));

    expect(action).toEqual(
      buildViewerAction("Edit mosaic", { target: STORED_MOSAIC, mode: "edit" }),
    );
  });

  it("Sample mosaic: Edit a copy, in copy mode", function editsCopy(): void {
    const action = readMosaicEditAction(buildLink({ mosaic: MAP_MOSAIC }));

    expect(action).toEqual(
      buildViewerAction("Edit a copy", { target: MAP_MOSAIC, mode: "copy" }),
    );
  });

  it("Unsaved combination: Edit as a new mosaic, with its mod and collection", function editsNew(): void {
    const action = readMosaicEditAction(buildLink({}));

    expect(action).toEqual(
      buildViewerAction("Edit as a new mosaic", {
        mode: "new",
        draft_mod: FLASHCARDS,
        draft_collection: LAUREATES,
      }),
    );
  });

  it("Unsaved combination with sites and None: passes the sites, no collection", function editsNewWithSites(): void {
    const action = readMosaicEditAction(
      buildLink({ collection: null, sites: BOOKS_MOSAIC }),
    );

    expect(action).toEqual(
      buildViewerAction("Edit as a new mosaic", {
        mode: "new",
        draft_mod: FLASHCARDS,
        draft_sites: BOOKS_MOSAIC,
      }),
    );
  });

  it("Tile link: no action", function hasNoTileAction(): void {
    const action = readMosaicEditAction(
      buildLink({ collection: null, tile: TILE }),
    );

    expect(action).toBeNull();
  });
});
