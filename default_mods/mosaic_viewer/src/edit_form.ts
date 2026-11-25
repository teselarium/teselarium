import type {
  MosaicDraftFields,
  MosaicDraftValidation,
} from "../../mod_api.d.ts";
import { buildConfigText } from "./config_text.ts";
import {
  buildAliasesEdit,
  buildShowEdit,
  readOptionalText,
} from "./draft_edits.ts";
import type { ShowRowValues } from "./draft_edits.ts";
import type { EditView } from "./edit_view.ts";
import { buildButton, buildTitledSection } from "./page_elements.ts";

/** The id of the list of the collection's field names, which the alias rows suggest. */
const COLLECTION_FIELDS_LIST_ID = "collection-fields";

/** A labelled field: its label above it, in one column. */
function buildField(
  labelText: string,
  control: HTMLInputElement | HTMLTextAreaElement,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "edit-field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function buildInput(name: string, value: string | null): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.value = value ?? "";
  input.autocomplete = "off";
  return input;
}

function sendTextEdit(
  view: EditView,
  key: "title" | "mod",
  event: Event,
): void {
  const input = event.currentTarget as HTMLInputElement;
  view.sendEdits({ [key]: input.value.trim() });
}

function sendOptionalTextEdit(
  view: EditView,
  key: "description" | "collection",
  event: Event,
): void {
  const input = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
  view.sendEdits({ [key]: readOptionalText(input.value) });
}

function buildMainFields(
  view: EditView,
  draft: MosaicDraftFields,
): HTMLElement[] {
  const title = buildInput("title", draft.title);
  title.addEventListener("change", sendTextEdit.bind(undefined, view, "title"));
  const description = document.createElement("textarea");
  description.name = "description";
  description.rows = 2;
  description.value = draft.description ?? "";
  description.addEventListener(
    "change",
    sendOptionalTextEdit.bind(undefined, view, "description"),
  );
  const mod = buildInput("mod", draft.mod);
  mod.addEventListener("change", sendTextEdit.bind(undefined, view, "mod"));
  const collection = buildInput("collection", draft.collection);
  collection.placeholder = "None";
  collection.addEventListener(
    "change",
    sendOptionalTextEdit.bind(undefined, view, "collection"),
  );
  const fields = [
    buildField("Title", title),
    buildField("Description", description),
    buildField("Mod address", mod),
    buildField("Collection address (empty for none)", collection),
  ];
  return fields;
}

/** The alias rows' fields: the tile type's, then those of the draft the type does not declare. */
function listAliasFields(
  draft: MosaicDraftFields,
  validation: MosaicDraftValidation,
): { name: string; label: string }[] {
  const fields: { name: string; label: string }[] = [];
  const names = new Set<string>();
  for (const field of validation.typeFields) {
    names.add(field.name);
    fields.push({
      name: field.name,
      label: field.required ? `${field.name} (required)` : field.name,
    });
  }
  for (const name of Object.keys(draft.aliases)) {
    if (!names.has(name)) {
      fields.push({ name, label: `${name} (not in the tile type)` });
    }
  }
  return fields;
}

function readAliasRows(panel: HTMLElement): [string, string][] {
  const rows: [string, string][] = [];
  for (const input of panel.querySelectorAll<HTMLInputElement>(
    "input[data-alias-field]",
  )) {
    rows.push([input.dataset.aliasField ?? "", input.value]);
  }
  return rows;
}

function sendAliasesEdit(view: EditView): void {
  view.sendEdits({
    aliases: buildAliasesEdit(readAliasRows(view.nodes.formPanel)),
  });
}

function buildCollectionFieldsList(fieldNames: string[]): HTMLElement {
  const list = document.createElement("datalist");
  list.id = COLLECTION_FIELDS_LIST_ID;
  for (const name of fieldNames) {
    const option = document.createElement("option");
    option.value = name;
    list.append(option);
  }
  return list;
}

function buildAliasesSection(
  view: EditView,
  draft: MosaicDraftFields,
  validation: MosaicDraftValidation,
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Aliases";
  const hint = document.createElement("p");
  hint.textContent =
    "For each field of the mod's tile type, the names the collection uses for it, separated by commas.";
  fieldset.append(
    legend,
    hint,
    buildCollectionFieldsList(validation.collectionFields),
  );
  for (const field of listAliasFields(draft, validation)) {
    const input = buildInput(
      `alias-${field.name}`,
      (draft.aliases[field.name] ?? []).join(", "),
    );
    input.dataset.aliasField = field.name;
    input.setAttribute("list", COLLECTION_FIELDS_LIST_ID);
    input.addEventListener("change", sendAliasesEdit.bind(undefined, view));
    fieldset.append(buildField(field.label, input));
  }
  if (
    validation.typeFields.length === 0 &&
    Object.keys(draft.aliases).length === 0
  ) {
    const none = document.createElement("p");
    none.textContent = "The mod's tile type declares no field to rename to.";
    fieldset.append(none);
  }
  return fieldset;
}

function readShowRows(panel: HTMLElement): ShowRowValues[] {
  const rows: ShowRowValues[] = [];
  for (const row of panel.querySelectorAll<HTMLElement>("[data-show-row]")) {
    const host = row.querySelector<HTMLInputElement>('input[name="host"]');
    const reason = row.querySelector<HTMLInputElement>('input[name="reason"]');
    rows.push({ host: host?.value ?? "", reason: reason?.value ?? "" });
  }
  return rows;
}

function sendShowEdit(view: EditView): void {
  view.sendEdits({ show: buildShowEdit(readShowRows(view.nodes.formPanel)) });
}

function removeShowRow(view: EditView, row: HTMLElement): void {
  row.remove();
  sendShowEdit(view);
}

function buildShowRow(
  view: EditView,
  values: ShowRowValues,
  position: number,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "edit-row";
  row.dataset.showRow = "";
  const host = buildInput("host", values.host);
  host.placeholder = "https://images.example.org";
  host.addEventListener("change", sendShowEdit.bind(undefined, view));
  const reason = buildInput("reason", values.reason);
  reason.addEventListener("change", sendShowEdit.bind(undefined, view));
  const removeButton = buildButton(
    "Remove",
    removeShowRow.bind(undefined, view, row),
  );
  removeButton.dataset.tesVariant = "outline";
  removeButton.setAttribute("aria-label", `Remove site ${position}`);
  row.append(
    buildField(`Host of site ${position}`, host),
    buildField(`Reason of site ${position}`, reason),
    removeButton,
  );
  return row;
}

function addShowRow(view: EditView, rows: HTMLElement): void {
  const position = rows.querySelectorAll("[data-show-row]").length + 1;
  const row = buildShowRow(view, { host: "", reason: "" }, position);
  rows.append(row);
  row.querySelector("input")?.focus();
}

function buildShowSection(
  view: EditView,
  draft: MosaicDraftFields,
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Sites";
  const hint = document.createElement("p");
  hint.textContent =
    "The sites the collection's images and media come from, each with the reason the mosaic needs it.";
  const rows = document.createElement("div");
  for (const [index, line] of draft.show.entries()) {
    rows.append(buildShowRow(view, line, index + 1));
  }
  const addButton = buildButton("Add", addShowRow.bind(undefined, view, rows));
  addButton.dataset.tesVariant = "outline";
  addButton.setAttribute("aria-label", "Add a site");
  fieldset.append(legend, hint, rows, addButton);
  return fieldset;
}

function buildDefaultConfig(view: EditView): HTMLElement {
  const defaults = view.defaultConfig;
  if (defaults === null || !defaults.isLoaded) {
    const loading = document.createElement("p");
    loading.textContent =
      defaults === null ? "No mod is named." : "Reading the mod…";
    return loading;
  }
  if (defaults.config === null) {
    const failed = document.createElement("p");
    failed.textContent = "The mod's config cannot be read.";
    return failed;
  }
  return buildConfigText(defaults.config);
}

function buildConfigSection(
  view: EditView,
  draft: MosaicDraftFields,
): HTMLElement {
  const section = buildTitledSection("Config");
  const note = document.createElement("p");
  note.textContent = "Config is edited in the YAML tab.";
  const own = document.createElement("div");
  const ownHeading = document.createElement("h3");
  ownHeading.textContent = "This mosaic";
  own.append(ownHeading, buildConfigText(draft.config));
  const defaults = document.createElement("div");
  const defaultsHeading = document.createElement("h3");
  defaultsHeading.textContent = "The mod's defaults";
  defaults.append(defaultsHeading, buildDefaultConfig(view));
  const columns = document.createElement("div");
  columns.className = "edit-columns";
  columns.append(own, defaults);
  section.append(note, columns);
  return section;
}

/** The "Form" tab's fields, from the draft's fields as the latest validation read them. */
export function renderForm(view: EditView): void {
  const validation = view.validation;
  if (validation === null || validation.draft === null) {
    return;
  }
  const draft = validation.draft;
  view.nodes.formPanel.replaceChildren(
    ...buildMainFields(view, draft),
    buildAliasesSection(view, draft, validation),
    buildShowSection(view, draft),
    buildConfigSection(view, draft),
  );
}
