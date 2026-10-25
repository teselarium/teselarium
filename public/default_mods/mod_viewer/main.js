/**
 * Default mod: shows the metadata of the mod named by the `target`
 * parameter, and runs it.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (a
 * submit button is the primary button, an `<article>` a card, `role="alert"`
 * an alert, `aria-invalid` an invalid field), `data-ot-variant` picks the
 * variants that have no semantic HTML (badges, an outline submit button), and
 * this mod's own CSS sets layout only. See "Write HTML, get the app's look"
 * in docs/modules/lib/core/theme/README.md.
 */

// Layout only: the colors, borders and fonts come from the theme.
const VIEWER_STYLE = `
  header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-bottom: var(--ot-space-4); }
  header h1 { margin: 0; }
  dd + dt { margin-top: var(--ot-space-2); }
  dd { overflow-wrap: anywhere; }
  pre { margin: 0; }
  td { overflow-wrap: anywhere; }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ot-space-2); margin-top: var(--ot-space-4); }
  input[type="url"] { flex: 1; min-width: 16rem; }
`;

const COLLECTION_FIELD_ID = "collection-address";

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** An error: `role="alert"` gives it the app's destructive alert look. */
function buildErrorAlert(text) {
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  alert.textContent = text;
  return alert;
}

/** A notice: `role="status"` gives it the app's default alert look. */
function buildStatusMessage(text) {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = text;
  return status;
}

function showError(view, error) {
  view.messages.replaceChildren(buildErrorAlert(describeError(error)));
}

function openMod(view, collection) {
  const params = { mod: view.inspection.source };
  if (collection !== null) {
    params.collection = collection;
  }
  view.messages.replaceChildren();
  const request = view.engine.request("mods.open", params);
  request.catch(showError.bind(undefined, view));
}

function runWithSampleTiles(view, event) {
  // The sandbox has no `allow-forms`: the form is never submitted, the click runs the mod.
  event.preventDefault();
  openMod(view, view.inspection.sampleCollection);
}

function runWithoutTiles(view) {
  openMod(view, null);
}

/** An address that is not a full URL marks the field invalid instead of running. */
function runWithTypedCollection(view, input, event) {
  event.preventDefault();
  const collection = input.value.trim();
  if (collection === "") {
    return;
  }
  if (!URL.canParse(collection)) {
    input.setAttribute("aria-invalid", "true");
    view.messages.replaceChildren(
      buildErrorAlert(`"${collection}" is not a full address.`),
    );
    return;
  }
  input.removeAttribute("aria-invalid");
  openMod(view, collection);
}

function clearInvalidField(input) {
  input.removeAttribute("aria-invalid");
}

function formatScalar(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function isMapping(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addEntryLines(lines, label, value, indent) {
  if (isMapping(value) || Array.isArray(value)) {
    lines.push(`${indent}${label}`);
    addConfigLines(lines, value, `${indent}  `);
    return;
  }
  lines.push(`${indent}${label} ${formatScalar(value)}`);
}

/** Adds the config as indented `key: value` lines, and `- value` lines for lists. */
function addConfigLines(lines, value, indent) {
  if (Array.isArray(value)) {
    for (const item of value) {
      addEntryLines(lines, "-", item, indent);
    }
    return;
  }
  for (const [key, entryValue] of Object.entries(value)) {
    addEntryLines(lines, `${key}:`, entryValue, indent);
  }
}

function buildConfigText(config) {
  const lines = [];
  addConfigLines(lines, config, "");
  const preformatted = document.createElement("pre");
  preformatted.textContent = lines.length === 0 ? "(none)" : lines.join("\n");
  return preformatted;
}

/** A badge: a `<span>` with `data-ot-variant`. */
function buildBadge(text, variant) {
  const badge = document.createElement("span");
  badge.dataset.otVariant = variant;
  badge.textContent = text;
  return badge;
}

function buildCell(tagName, content) {
  const cell = document.createElement(tagName);
  cell.append(content);
  return cell;
}

function buildPermissionRow(permission, isGranted) {
  const row = document.createElement("tr");
  const status = isGranted
    ? buildBadge("granted", "success")
    : buildBadge("not granted", "outline");
  row.append(
    buildCell("td", permission.category),
    buildCell("td", permission.host),
    buildCell("td", permission.reason),
    buildCell("td", status),
  );
  return row;
}

function buildPermissionTable(permissions) {
  const rows = [];
  for (const permission of permissions.granted) {
    rows.push(buildPermissionRow(permission, true));
  }
  for (const permission of permissions.denied) {
    rows.push(buildPermissionRow(permission, false));
  }
  if (rows.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(none)";
    return none;
  }
  const header = document.createElement("tr");
  for (const label of ["Category", "Host", "Reason", "Status"]) {
    header.append(buildCell("th", label));
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.append(header);
  const body = document.createElement("tbody");
  body.append(...rows);
  table.append(head, body);
  return table;
}

/**
 * The mod's `api` range with a badge telling whether it matches the app's mod
 * API version, which is shown too when it does not.
 */
function buildApiRangeDescription(inspection, apiVersion) {
  const description = document.createElement("span");
  if (inspection.api === null) {
    description.textContent = "The mod declares no API range.";
    return description;
  }
  const range = document.createElement("code");
  range.textContent = inspection.api;
  if (inspection.apiCompatible) {
    description.append(range, " ", buildBadge("matches", "success"));
    return description;
  }
  description.append(
    range,
    " ",
    buildBadge("does not match", "warning"),
    ` This app has mod API ${apiVersion}.`,
  );
  return description;
}

function addDefinition(list, term, description) {
  const termElement = document.createElement("dt");
  termElement.textContent = term;
  const descriptionElement = document.createElement("dd");
  descriptionElement.append(description);
  list.append(termElement, descriptionElement);
}

function buildMetadataList(inspection, apiVersion) {
  const list = document.createElement("dl");
  addDefinition(list, "Title", inspection.title);
  addDefinition(list, "Description", inspection.description);
  addDefinition(list, "Name", inspection.name);
  addDefinition(list, "Source", inspection.source);
  addDefinition(
    list,
    "API range",
    buildApiRangeDescription(inspection, apiVersion),
  );
  addDefinition(list, "Tile type", inspection.typeSource ?? "(none)");
  addDefinition(
    list,
    "Sample collection",
    inspection.sampleCollection ?? "(none)",
  );
  addDefinition(list, "Config", buildConfigText(inspection.config));
  return list;
}

/** The mod's metadata and permissions as a card: an `<article>`. */
function buildMetadataCard(inspection, apiVersion) {
  const card = document.createElement("article");
  const permissionsHeading = document.createElement("h2");
  permissionsHeading.textContent = "Permissions";
  card.append(
    buildMetadataList(inspection, apiVersion),
    permissionsHeading,
    buildPermissionTable(inspection.permissions),
  );
  return card;
}

/** The title with the version as a secondary badge. */
function buildHeader(inspection) {
  const header = document.createElement("header");
  const heading = document.createElement("h1");
  heading.textContent = inspection.title;
  header.append(heading, buildBadge(inspection.version, "secondary"));
  return header;
}

function buildButton(label, handleClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handleClick);
  return button;
}

/** The run choices: running with the sample tiles is the page's one primary action, a submit button. */
function buildRunChoices(view) {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Run");
  if (view.inspection.sampleCollection !== null) {
    const runButton = document.createElement("button");
    runButton.type = "submit";
    runButton.textContent = "Run with sample tiles";
    runButton.addEventListener(
      "click",
      runWithSampleTiles.bind(undefined, view),
    );
    form.append(runButton);
  }
  form.append(
    buildButton("Run without tiles", runWithoutTiles.bind(undefined, view)),
  );
  return form;
}

/**
 * The collection address. Its submit button is an outline button, so the
 * page keeps one primary action. Enter in the field clicks it, as in any
 * form.
 */
function buildCollectionForm(view) {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Run with a collection");
  const label = document.createElement("label");
  label.htmlFor = COLLECTION_FIELD_ID;
  label.textContent = "Collection address";
  const input = document.createElement("input");
  input.id = COLLECTION_FIELD_ID;
  input.type = "url";
  input.placeholder = "https://example.org/collection.yaml";
  input.addEventListener("input", clearInvalidField.bind(undefined, input));
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.dataset.otVariant = "outline";
  runButton.textContent = "Run with this collection";
  runButton.addEventListener(
    "click",
    runWithTypedCollection.bind(undefined, view, input),
  );
  form.append(label, input, runButton);
  return form;
}

function renderInspection(view) {
  document.body.replaceChildren(
    buildHeader(view.inspection),
    buildMetadataCard(view.inspection, view.apiVersion),
    buildRunChoices(view),
    buildCollectionForm(view),
    view.messages,
  );
}

function renderMessage(title, message) {
  const heading = document.createElement("h1");
  heading.textContent = title;
  document.body.replaceChildren(heading, message);
}

function addViewerStyle() {
  const style = document.createElement("style");
  style.textContent = VIEWER_STYLE;
  document.head.append(style);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  addViewerStyle();
  const target = context.params.target;
  if (typeof target !== "string" || target === "") {
    renderMessage(context.mod.title, buildStatusMessage("No mod was given."));
    return;
  }
  const view = {
    engine,
    apiVersion: context.api.version,
    inspection: null,
    messages: document.createElement("div"),
  };
  try {
    view.inspection = await engine.request("mods.inspect", { mod: target });
  } catch (error) {
    renderMessage(context.mod.title, buildErrorAlert(describeError(error)));
    return;
  }
  renderInspection(view);
}
