import { buildHeader, buildMetadataCard } from "./metadata_card.ts";
import { buildCollectionForm, buildRunChoices } from "./run_choices.ts";
import type { ViewerView } from "./viewer_view.ts";

// Layout only: the colors, borders and fonts come from the theme.
const VIEWER_STYLE = `
  header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-bottom: var(--ot-space-4); }
  header h1 { margin: 0; }
  dd + dt { margin-top: var(--ot-space-2); }
  dd { overflow-wrap: anywhere; }
  pre { margin: 0; }
  td { overflow-wrap: anywhere; }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-top: var(--ot-space-4); }
  input[type="text"] { flex: 1; min-width: 16rem; }
`;

export function addViewerStyle(): void {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/** The viewed mod: its header, its metadata card, the run choices, the collection field and the messages. */
export function renderInspection(view: ViewerView): void {
  document.body.replaceChildren(
    buildHeader(view.inspection),
    buildMetadataCard(view.inspection, view.apiVersion),
    buildRunChoices(view),
    buildCollectionForm(view),
    view.messages,
  );
}

/** A page with only a title and a message, when there is no mod to show. */
export function renderMessage(title: string, message: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}
