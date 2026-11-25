import type { ModCheckReport } from "../../mod_api.d.ts";
import { buildCheckReport } from "./check_report.ts";
import { isStoredMosaic, startViewerEditing } from "./edit_start.ts";
import { readMosaicFileName } from "./mosaic_file_name.ts";
import { buildButton, buildStatusMessage } from "./page_elements.ts";
import { showError } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

/** Opens the viewed mosaic: its mod with its collection, config, aliases and permissions. */
function openMosaic(view: ViewerView, event: MouseEvent): void {
  // The sandbox has no `allow-forms`: the form is never submitted, the click opens the mosaic.
  event.preventDefault();
  view.messages.replaceChildren();
  const request = view.engine.request("mosaics.open", {
    mosaic: view.inspection.source,
  });
  request.catch(showError.bind(undefined, view));
}

function showCheckReport(
  view: ViewerView,
  button: HTMLButtonElement,
  report: ModCheckReport,
): void {
  button.disabled = false;
  view.messages.replaceChildren(buildCheckReport(report));
}

function showCheckError(
  view: ViewerView,
  button: HTMLButtonElement,
  error: unknown,
): void {
  button.disabled = false;
  showError(view, error);
}

/** Sends `mosaics.check` for the viewed mosaic. The button is disabled until the report arrives. */
function checkMosaic(view: ViewerView, event: MouseEvent): void {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  view.messages.replaceChildren(
    buildStatusMessage(`Checking ${view.inspection.title}…`),
  );
  view.engine
    .request("mosaics.check", { mosaic: view.inspection.source })
    .then(
      showCheckReport.bind(undefined, view, button),
      showCheckError.bind(undefined, view, button),
    );
}

/**
 * "Download": the app's save confirmation for the mosaic's file, exactly the
 * text `mosaics.inspect` read. "Cancel" shows nothing, a refusal its alert.
 */
function downloadMosaic(view: ViewerView): void {
  view.messages.replaceChildren();
  view.engine
    .request("files.save", {
      name: readMosaicFileName(view.inspection.source),
      content: view.inspection.content,
      type: "application/yaml",
    })
    .catch(showError.bind(undefined, view));
}

function editMosaic(view: ViewerView, kind: "edit" | "copy"): void {
  view.messages.replaceChildren();
  void startViewerEditing(view, kind);
}

/**
 * "Open mosaic", the page's one primary action, a submit button, "Edit" for
 * a mosaic stored in this browser or "Edit a copy" for any other, "Check
 * mosaic", and "Download" for a mosaic that is not stored, outline buttons.
 * A stored mosaic is exported from "Where it comes from" instead.
 */
export function buildMosaicActions(view: ViewerView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Mosaic");
  const openButton = document.createElement("button");
  openButton.type = "submit";
  openButton.textContent = "Open mosaic";
  openButton.addEventListener("click", openMosaic.bind(undefined, view));
  const kind = isStoredMosaic(view.inspection) ? "edit" : "copy";
  const editButton = buildButton(
    kind === "edit" ? "Edit" : "Edit a copy",
    editMosaic.bind(undefined, view, kind),
  );
  form.append(
    openButton,
    editButton,
    buildButton("Check mosaic", checkMosaic.bind(undefined, view)),
  );
  if (kind === "copy") {
    form.append(buildButton("Download", downloadMosaic.bind(undefined, view)));
  }
  return form;
}
