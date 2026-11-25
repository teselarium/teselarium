import type { ModYamlMapping } from "../../mod_api.d.ts";
import { isPreviewCollapsed, planMetadataPreview } from "./metadata_lines.ts";
import type { FieldPreview } from "./metadata_lines.ts";
import { buildMetadataList } from "./metadata_list.ts";

/** The id of the metadata list, which the button controls. */
const METADATA_LIST_ID = "tile-metadata";

/** What the button switches: each field with its collapsed preview, and the `and <n> more` lines. */
interface MetadataPreview {
  fields: HTMLElement[];
  previews: FieldPreview[];
  moreLines: HTMLElement[];
  button: HTMLButtonElement;
}

function describeShowAll(fieldCount: number): string {
  const text =
    fieldCount === 1 ? "Show all 1 field" : `Show all ${fieldCount} fields`;
  return text;
}

/** The items of a field's list, when its value is a list. */
function listFieldItems(field: HTMLElement): HTMLElement[] {
  const items: HTMLElement[] = [];
  const list = field.querySelector(":scope > dd > ul");
  if (list === null) {
    return items;
  }
  for (const item of list.children) {
    items.push(item as HTMLElement);
  }
  return items;
}

/** Shows a field as its preview says, or whole when `isExpanded`. */
function showField(
  field: HTMLElement,
  preview: FieldPreview,
  isExpanded: boolean,
): void {
  field.hidden = !isExpanded && preview.kind === "hidden";
  const shownItems =
    !isExpanded && preview.kind === "cut" ? preview.shownItems : Infinity;
  for (const [index, item] of listFieldItems(field).entries()) {
    item.hidden = index >= shownItems;
  }
}

function showMetadata(preview: MetadataPreview, isExpanded: boolean): void {
  for (const [index, field] of preview.fields.entries()) {
    showField(field, preview.previews[index], isExpanded);
  }
  for (const moreLine of preview.moreLines) {
    moreLine.hidden = isExpanded;
  }
  preview.button.setAttribute("aria-expanded", String(isExpanded));
  preview.button.textContent = isExpanded
    ? "Show fewer fields"
    : describeShowAll(preview.fields.length);
}

function toggleMetadata(preview: MetadataPreview): void {
  showMetadata(
    preview,
    preview.button.getAttribute("aria-expanded") !== "true",
  );
}

/** Adds the muted `and <n> more` line after each cut list, and gives them. */
function addMoreLines(
  fields: HTMLElement[],
  previews: FieldPreview[],
): HTMLElement[] {
  const moreLines: HTMLElement[] = [];
  for (const [index, preview] of previews.entries()) {
    if (preview.kind === "cut") {
      const moreLine = document.createElement("small");
      moreLine.textContent = `and ${preview.moreItems} more`;
      fields[index].querySelector(":scope > dd")?.append(moreLine);
      moreLines.push(moreLine);
    }
  }
  return moreLines;
}

/**
 * The button that shows all the fields, then fewer again: the theme's
 * outline button, whose border shows it is a button without a pointer over
 * it.
 */
function buildToggleButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-controls", METADATA_LIST_ID);
  return button;
}

/**
 * Collapses metadata that takes more than the line budget, and gives the
 * button that switches it, or `null` when everything fits.
 */
function collapseMetadata(
  list: HTMLElement,
  metadata: ModYamlMapping,
): HTMLButtonElement | null {
  const previews = planMetadataPreview(metadata);
  if (!isPreviewCollapsed(previews)) {
    return null;
  }
  const fields: HTMLElement[] = [];
  for (const field of list.children) {
    fields.push(field as HTMLElement);
  }
  const preview: MetadataPreview = {
    fields,
    previews,
    moreLines: addMoreLines(fields, previews),
    button: buildToggleButton(),
  };
  preview.button.addEventListener(
    "click",
    toggleMetadata.bind(undefined, preview),
  );
  showMetadata(preview, false);
  return preview.button;
}

/** The section's header: a small "Metadata" heading, and the button when there is one. */
function buildHeader(button: HTMLButtonElement | null): HTMLElement {
  const header = document.createElement("header");
  const heading = document.createElement("h2");
  const headingText = document.createElement("small");
  headingText.textContent = "Metadata";
  heading.append(headingText);
  header.append(heading);
  if (button !== null) {
    header.append(button);
  }
  return header;
}

/**
 * The metadata section: a small "Metadata" heading, then the metadata list,
 * collapsed to its line budget with a button next to the heading when it
 * takes more, or a line saying that the file has no metadata. Its label
 * scopes the metadata's layout, so it never reaches the rendered body. Each
 * viewer starts collapsed: the state is not stored.
 */
export function buildMetadataSection(metadata: ModYamlMapping): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Metadata");
  if (Object.keys(metadata).length === 0) {
    const noMetadata = document.createElement("p");
    noMetadata.textContent = "This file has no metadata.";
    section.append(buildHeader(null), noMetadata);
    return section;
  }
  const list = buildMetadataList(metadata);
  list.id = METADATA_LIST_ID;
  section.append(buildHeader(collapseMetadata(list, metadata)), list);
  return section;
}
