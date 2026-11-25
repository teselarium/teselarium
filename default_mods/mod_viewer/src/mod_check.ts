import type { ModCheckParams, ModCheckReport } from "../../mod_api.d.ts";
import { buildCheckReport } from "./check_report.ts";
import { buildStatusMessage } from "./page_elements.ts";
import { readTypedCollection, showError } from "./viewer_view.ts";
import type { ViewerView } from "./viewer_view.ts";

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

/** Sends `mods.check` for the viewed mod. The button is disabled until the report arrives. */
export function checkMod(view: ViewerView, event: MouseEvent): void {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  view.messages.replaceChildren(
    buildStatusMessage(`Checking ${view.inspection.title}…`),
  );
  const params: ModCheckParams = { mod: view.inspection.source };
  const collection = readTypedCollection(view);
  if (collection !== null) {
    params.collection = collection;
  }
  view.engine
    .request("mods.check", params)
    .then(
      showCheckReport.bind(undefined, view, button),
      showCheckError.bind(undefined, view, button),
    );
}
