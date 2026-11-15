import type { ModInspection } from "../../mod_api.d.ts";
import { openViewer } from "./explorer_view.ts";
import type { ExplorerView } from "./explorer_view.ts";
import type { ModEntry } from "./mod_entries.ts";

/** A mod as a card: an `<article>` with its title, description and a button. */
function buildModCard(
  view: ExplorerView,
  inspection: ModInspection,
): HTMLElement {
  const card = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = inspection.title;
  const description = document.createElement("p");
  description.textContent = inspection.description;
  const viewButton = document.createElement("button");
  viewButton.type = "button";
  // The card's heading names the mod, so the visible text does not repeat
  // it. The accessible name keeps it, for a screen reader moving between buttons.
  viewButton.textContent = "View";
  viewButton.ariaLabel = `View ${inspection.title}`;
  viewButton.addEventListener(
    "click",
    openViewer.bind(undefined, view, inspection),
  );
  card.append(title, description, viewButton);
  return card;
}

/** A mod that cannot be inspected: `role="alert"` gives it the app's destructive alert look. */
function buildFailureAlert(reference: string, error: string): HTMLElement {
  const failure = document.createElement("div");
  failure.setAttribute("role", "alert");
  const referenceCode = document.createElement("code");
  referenceCode.textContent = reference;
  const message = document.createElement("p");
  message.textContent = error;
  failure.append(referenceCode, message);
  return failure;
}

/** A list item of the explorer: the mod's card, or the alert of a mod that cannot be inspected. */
export function buildModItem(view: ExplorerView, entry: ModEntry): HTMLElement {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailureAlert(entry.reference, entry.error));
    return item;
  }
  item.append(buildModCard(view, entry.inspection));
  return item;
}
