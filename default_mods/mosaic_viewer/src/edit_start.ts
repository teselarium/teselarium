import type {
  ModEngine,
  MosaicDraftEdits,
  MosaicInspection,
  MosaicShowLine,
} from "../../mod_api.d.ts";
import { buildDraftKey } from "./draft_store.ts";
import type { DraftKind } from "./draft_store.ts";
import { showEditMode } from "./edit_page.ts";
import type { EditStart } from "./edit_view.ts";
import { describeError } from "./error_messages.ts";
import { buildErrorAlert, buildStatusMessage } from "./page_elements.ts";
import { renderMessage } from "./viewer_page.ts";
import type { ViewerView } from "./viewer_view.ts";

/** The scheme of the mosaics stored in this browser, the only ones edit mode saves over. */
const BROWSER_FILE_PROTOCOL = "opentesela-browser:";

/** The first text of a new mosaic, which `mosaics.edit` fills with the combination's mod, collection and sites. */
const NEW_DRAFT_TEXT = 'mosaic:\n  title: "Untitled mosaic"\n';

/** What the viewer says when `mode=edit` names a mosaic that is not stored in this browser. */
export const ONLY_STORED_MESSAGE =
  'Only mosaics stored in this browser can be edited. Use "Edit a copy" to save a copy of your own.';

/** Whether the viewed mosaic is stored in this browser: its address, and an inspection that succeeded. */
export function isStoredMosaic(inspection: MosaicInspection): boolean {
  return new URL(inspection.source).protocol === BROWSER_FILE_PROTOCOL;
}

/** A saved stored mosaic: inspected anew and shown in view mode. */
function showSavedMosaic(view: ViewerView): Promise<void> {
  return view.onUpdated();
}

/** A saved copy or new mosaic: the viewer replaces its own sandbox with the viewer of the saved mosaic. */
async function openSavedMosaic(
  engine: ModEngine,
  viewerSource: string,
  address: string,
): Promise<void> {
  try {
    await engine.request("mods.open", {
      mod: viewerSource,
      params: { target: address },
      replace: true,
    });
  } catch (error) {
    document.body.append(buildErrorAlert(describeError(error)));
  }
}

/** The copy's draft: the mosaic's text with its mod and collection made absolute, as the inspection resolved them. */
async function buildCopyContent(
  engine: ModEngine,
  inspection: MosaicInspection,
): Promise<string> {
  const result = await engine.request("mosaics.edit", {
    content: inspection.content,
    edits: { mod: inspection.mod, collection: inspection.collection },
  });
  return result.content;
}

/**
 * Edit mode for the viewed mosaic: `"edit"` saves over the stored mosaic,
 * `"copy"` saves a copy with absolute references. Leaving it shows the
 * mosaic in view mode again.
 */
export async function startViewerEditing(
  view: ViewerView,
  kind: Exclude<DraftKind, "new">,
): Promise<void> {
  const inspection = view.inspection;
  let content = inspection.content;
  if (kind === "copy") {
    try {
      content = await buildCopyContent(view.engine, inspection);
    } catch (error) {
      view.messages.replaceChildren(buildErrorAlert(describeError(error)));
      return;
    }
  }
  const start: EditStart = {
    kind,
    heading:
      kind === "edit"
        ? `Edit "${inspection.title}"`
        : `Copy of "${inspection.title}"`,
    content,
    address: kind === "edit" ? inspection.source : null,
    copiedFrom: kind === "copy" ? inspection.source : null,
    storageKey: buildDraftKey(kind, inspection.source),
    onLeave: view.onShow,
    onSaved:
      kind === "edit"
        ? showSavedMosaic.bind(undefined, view)
        : openSavedMosaic.bind(undefined, view.engine, view.viewerSource),
  };
  await showEditMode(view.engine, start);
}

/** The `show` lines of the mosaic a combination was opened with as `sites`, or none when it cannot be inspected. */
async function readSitesLines(
  engine: ModEngine,
  sites: string | undefined,
): Promise<MosaicShowLine[]> {
  const lines: MosaicShowLine[] = [];
  if (sites === undefined || sites === "") {
    return lines;
  }
  const inspection = await engine.request("mosaics.inspect", { mosaic: sites });
  for (const permission of [
    ...inspection.permissions.granted,
    ...inspection.permissions.denied,
  ]) {
    lines.push({ host: permission.host, reason: permission.reason });
  }
  return lines;
}

/** The parameters of `mode=new`: the combination's mod, collection and sites. */
export interface NewMosaicParams {
  mod: string;
  collection: string | undefined;
  sites: string | undefined;
}

function showNothingSaved(title: string): Promise<void> {
  renderMessage(title, buildStatusMessage("The new mosaic was not saved."));
  return Promise.resolve();
}

/**
 * Edit mode for a new mosaic from a combination (`mode=new`): "Untitled
 * mosaic" with the combination's mod, its collection or none, and the `show`
 * lines of its `sites` mosaic, if any.
 */
export async function startNewMosaic(
  engine: ModEngine,
  viewerSource: string,
  title: string,
  params: NewMosaicParams,
): Promise<void> {
  const edits: MosaicDraftEdits = { mod: params.mod };
  if (params.collection !== undefined && params.collection !== "") {
    edits.collection = params.collection;
  }
  let content: string;
  try {
    const show = await readSitesLines(engine, params.sites);
    if (show.length > 0) {
      edits.show = show;
    }
    const result = await engine.request("mosaics.edit", {
      content: NEW_DRAFT_TEXT,
      edits,
    });
    content = result.content;
  } catch (error) {
    renderMessage(title, buildErrorAlert(describeError(error)));
    return;
  }
  await showEditMode(engine, {
    kind: "new",
    heading: "New mosaic",
    content,
    address: null,
    copiedFrom: null,
    storageKey: buildDraftKey("new", params.mod, params.collection ?? null),
    onLeave: showNothingSaved.bind(undefined, title),
    onSaved: openSavedMosaic.bind(undefined, engine, viewerSource),
  });
}
