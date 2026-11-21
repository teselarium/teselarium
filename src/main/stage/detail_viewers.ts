import type {
  ResolvedDefaultModSettings,
  RunLink,
} from "../../lib/core/engine/index.ts";
import { buildRunLink } from "../../lib/core/stage/index.ts";
import { buildRunLinkAddress } from "./run_link_copy.ts";

/** Where a detail's Open link goes, and the place its name says, such as "the mod viewer". */
export interface DetailOpen {
  address: string;
  place: string;
}

/** The kinds of detail that have a viewer. */
export type DetailKind = "mod" | "collection" | "tile" | "mosaic";

/** A kind's viewer: its default mod name, the place the link names, and the link parameter it reads. */
interface DetailViewer {
  name: string;
  place: string;
  parameter: "target" | "tile";
}

const DETAIL_VIEWERS: Readonly<Record<DetailKind, DetailViewer>> =
  Object.freeze({
    mod: { name: "mod_viewer", place: "the mod viewer", parameter: "target" },
    collection: {
      name: "collection_viewer",
      place: "the collection viewer",
      parameter: "target",
    },
    tile: { name: "tile_viewer", place: "the tile viewer", parameter: "tile" },
    mosaic: {
      name: "mosaic_viewer",
      place: "the mosaic viewer",
      parameter: "target",
    },
  });

function isSwitchedOff(
  name: string,
  defaults: ResolvedDefaultModSettings,
): boolean {
  for (const switchedOffMod of defaults.switchedOff) {
    if (switchedOffMod.name === name) {
      return true;
    }
  }
  return false;
}

/** The viewer's run link: `address` as its `target`, or as its `tile` for the tile viewer. */
function buildViewerLink(viewer: DetailViewer, address: string): RunLink {
  if (viewer.parameter === "tile") {
    const tileLink: RunLink = {
      mod: viewer.name,
      collection: null,
      tile: address,
      params: {},
    };
    return tileLink;
  }
  const targetLink: RunLink = {
    mod: viewer.name,
    collection: null,
    params: { target: address },
  };
  return targetLink;
}

/**
 * Where the Open link of a detail of `kind` goes: the app's full address
 * with its default viewer's run link, showing `address`. `null` when the
 * instance switches that viewer off, so no link leads to a refused mod.
 */
export function buildViewerOpen(
  kind: DetailKind,
  address: string,
  defaults: ResolvedDefaultModSettings,
): DetailOpen | null {
  const viewer = DETAIL_VIEWERS[kind];
  if (isSwitchedOff(viewer.name, defaults)) {
    return null;
  }
  const open: DetailOpen = {
    address: buildRunLinkAddress(
      buildRunLink(buildViewerLink(viewer, address)),
    ),
    place: viewer.place,
  };
  return open;
}
