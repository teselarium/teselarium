/** Default mod: shows the metadata of the mod named by the `target` parameter, and runs it. */

// Only the layout: the theme's base stylesheet gives the colors and fonts.
const VIEWER_STYLE = `
  dt { margin-top: var(--ot-space-2); }
  dd { margin-left: var(--ot-space-4); overflow-wrap: anywhere; }
  pre { margin: 0; }
  .collection-field, .run-choices { display: flex; flex-wrap: wrap; gap: var(--ot-space-2); margin-top: var(--ot-space-4); }
  input[type="url"] { flex: 1; min-width: 16rem; }
  .viewer-error { color: var(--ot-color-danger); }
`;

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildMessage(text, className) {
  const message = document.createElement("p");
  message.className = className;
  message.textContent = text;
  return message;
}

function showError(view, error) {
  view.status.replaceChildren(
    buildMessage(describeError(error), "viewer-error"),
  );
}

function openMod(view, collection) {
  const params = { mod: view.inspection.source };
  if (collection !== null) {
    params.collection = collection;
  }
  view.status.replaceChildren();
  const request = view.engine.request("mods.open", params);
  request.catch(showError.bind(undefined, view));
}

function runWithSampleTiles(view) {
  openMod(view, view.inspection.sampleCollection);
}

function runWithoutTiles(view) {
  openMod(view, null);
}

function runWithTypedCollection(view, input) {
  const collection = input.value.trim();
  if (collection === "") {
    return;
  }
  openMod(view, collection);
}

function runOnEnter(view, input, event) {
  if (event.key === "Enter") {
    runWithTypedCollection(view, input);
  }
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

function describePermission(permission, status) {
  const description = `${permission.category} ${permission.host}: ${permission.reason} (${status})`;
  return description;
}

function buildPermissionList(permissions) {
  const list = document.createElement("ul");
  for (const permission of permissions.granted) {
    const item = document.createElement("li");
    item.textContent = describePermission(permission, "granted");
    list.append(item);
  }
  for (const permission of permissions.denied) {
    const item = document.createElement("li");
    item.textContent = describePermission(permission, "not granted");
    list.append(item);
  }
  if (list.childElementCount === 0) {
    return document.createTextNode("(none)");
  }
  return list;
}

function addDefinition(list, term, description) {
  const termElement = document.createElement("dt");
  termElement.textContent = term;
  const descriptionElement = document.createElement("dd");
  descriptionElement.append(description);
  list.append(termElement, descriptionElement);
}

function buildMetadataList(inspection) {
  const list = document.createElement("dl");
  addDefinition(list, "Title", inspection.title);
  addDefinition(list, "Version", inspection.version);
  addDefinition(list, "Description", inspection.description);
  addDefinition(list, "Name", inspection.name);
  addDefinition(list, "Source", inspection.source);
  addDefinition(list, "Tile type", inspection.typeSource ?? "(none)");
  addDefinition(
    list,
    "Sample collection",
    inspection.sampleCollection ?? "(none)",
  );
  addDefinition(list, "Config", buildConfigText(inspection.config));
  addDefinition(
    list,
    "Permissions",
    buildPermissionList(inspection.permissions),
  );
  return list;
}

function buildButton(label, handleClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handleClick);
  return button;
}

/**
 * The collection address field. Not a `<form>`: the sandbox has no
 * `allow-forms`, so a form would never fire its `submit` event.
 */
function buildCollectionField(view) {
  const field = document.createElement("div");
  field.className = "collection-field";
  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://example.org/collection.yaml";
  input.setAttribute("aria-label", "Collection address");
  input.addEventListener("keydown", runOnEnter.bind(undefined, view, input));
  const runButton = document.createElement("button");
  runButton.type = "button";
  runButton.textContent = "Run with this collection";
  runButton.addEventListener(
    "click",
    runWithTypedCollection.bind(undefined, view, input),
  );
  field.append(input, runButton);
  return field;
}

function buildRunChoices(view) {
  const choices = document.createElement("div");
  choices.className = "run-choices";
  if (view.inspection.sampleCollection !== null) {
    choices.append(
      buildButton(
        "Run with sample tiles",
        runWithSampleTiles.bind(undefined, view),
      ),
    );
  }
  choices.append(
    buildButton("Run without tiles", runWithoutTiles.bind(undefined, view)),
  );
  return choices;
}

function renderInspection(view) {
  const heading = document.createElement("h1");
  heading.textContent = view.inspection.title;
  document.body.replaceChildren(
    heading,
    buildMetadataList(view.inspection),
    buildRunChoices(view),
    buildCollectionField(view),
    view.status,
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
    renderMessage(context.mod.title, buildMessage("No mod was given.", ""));
    return;
  }
  const view = {
    engine,
    inspection: null,
    status: document.createElement("div"),
  };
  view.status.setAttribute("role", "status");
  try {
    view.inspection = await engine.request("mods.inspect", { mod: target });
  } catch (error) {
    const message = buildMessage(describeError(error), "viewer-error");
    message.setAttribute("role", "alert");
    renderMessage(context.mod.title, message);
    return;
  }
  renderInspection(view);
}
