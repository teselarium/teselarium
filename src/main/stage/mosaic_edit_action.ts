import type { RunLink } from "../../lib/core/engine/index.ts";
import { isBrowserFileAddress } from "../../lib/files/index.ts";
import type { SandboxLink } from "../../lib/core/stage/index.ts";

/** The default mod that edits mosaics. */
const MOSAIC_VIEWER_NAME = "mosaic_viewer";

/** What the stage bar's edit button does: its accessible name and tooltip, and the mosaic viewer's link it opens. */
export interface MosaicEditAction {
  label: string;
  link: RunLink;
}

/** The viewer's parameters for an unsaved combination: its mod, its collection unless "None", and its `sites`. */
function readNewDraftParams(link: SandboxLink): Record<string, string> {
  const params: Record<string, string> = { mode: "new", draft_mod: link.mod };
  if (link.collection !== null) {
    params.draft_collection = link.collection;
  }
  if (link.sites !== null) {
    params.draft_sites = link.sites;
  }
  return params;
}

function buildViewerAction(
  label: string,
  params: Record<string, string>,
): MosaicEditAction {
  const action: MosaicEditAction = {
    label,
    link: { mod: MOSAIC_VIEWER_NAME, collection: null, params },
  };
  return action;
}

/**
 * The edit button's action for a combination sandbox's link (`stage-bar`,
 * "Edit button links"): "Edit mosaic" for a mosaic stored in this browser,
 * "Edit a copy" for any other mosaic, "Edit as a new mosaic" for a
 * combination with a collection or none, and `null` for a tile link. Every
 * address is the link's resolved one.
 */
export function readMosaicEditAction(
  link: SandboxLink,
): MosaicEditAction | null {
  if (link.mosaic !== null) {
    const isStored = isBrowserFileAddress(link.mosaic);
    return buildViewerAction(isStored ? "Edit mosaic" : "Edit a copy", {
      target: link.mosaic,
      mode: isStored ? "edit" : "copy",
    });
  }
  if (link.tile !== null) {
    return null;
  }
  return buildViewerAction("Edit as a new mosaic", readNewDraftParams(link));
}
