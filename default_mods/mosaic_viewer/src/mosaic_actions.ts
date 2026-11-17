import type { ModCheckReport } from "../../mod_api.d.ts";
import { buildCheckReport } from "./check_report.ts";
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
 * "Open mosaic", the page's one primary action, a submit button, and
 * "Check mosaic", an outline button.
 */
export function buildMosaicActions(view: ViewerView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Mosaic");
  const openButton = document.createElement("button");
  openButton.type = "submit";
  openButton.textContent = "Open mosaic";
  openButton.addEventListener("click", openMosaic.bind(undefined, view));
  form.append(
    openButton,
    buildButton("Check mosaic", checkMosaic.bind(undefined, view)),
  );
  return form;
}
