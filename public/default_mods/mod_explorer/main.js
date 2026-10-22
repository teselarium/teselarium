/** Default mod: lists the mods of its config and opens the viewer for the one the user picks. */

// Only the layout: the theme's base stylesheet gives the colors and fonts.
const EXPLORER_STYLE = `
  ul { list-style: none; padding: 0; display: grid; gap: var(--ot-space-2); }
  button { display: block; width: 100%; text-align: left; padding: var(--ot-space-2); }
  .mod-error { color: var(--ot-color-danger); }
`;

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function inspectReference(engine, reference) {
  try {
    const inspection = await engine.request("mods.inspect", { mod: reference });
    const entry = { reference, inspection, error: null };
    return entry;
  } catch (error) {
    const failedEntry = {
      reference,
      inspection: null,
      error: describeError(error),
    };
    return failedEntry;
  }
}

async function inspectMods(engine, references) {
  const entries = [];
  for (const reference of references) {
    entries.push(await inspectReference(engine, reference));
  }
  return entries;
}

function showOpenError(view, error) {
  view.status.textContent = describeError(error);
}

function openViewer(view, inspection) {
  view.status.textContent = "";
  const request = view.engine.request("mods.open", {
    mod: view.viewer,
    params: { target: inspection.source },
  });
  request.catch(showOpenError.bind(undefined, view));
}

function buildModButton(view, inspection) {
  const button = document.createElement("button");
  button.type = "button";
  const title = document.createElement("strong");
  title.textContent = inspection.title;
  const description = document.createElement("span");
  description.textContent = inspection.description;
  button.append(title, document.createElement("br"), description);
  button.addEventListener(
    "click",
    openViewer.bind(undefined, view, inspection),
  );
  return button;
}

function buildFailedEntry(entry) {
  const failure = document.createElement("p");
  const reference = document.createElement("code");
  reference.textContent = entry.reference;
  const message = document.createElement("span");
  message.className = "mod-error";
  message.textContent = entry.error;
  failure.append(reference, document.createElement("br"), message);
  return failure;
}

function buildModItem(view, entry) {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailedEntry(entry));
    return item;
  }
  item.append(buildModButton(view, entry.inspection));
  return item;
}

function renderModList(view, entries) {
  const list = document.createElement("ul");
  for (const entry of entries) {
    list.append(buildModItem(view, entry));
  }
  view.content.replaceChildren(list);
}

function readModReferences(config) {
  if (!Array.isArray(config.mods)) {
    return [];
  }
  const references = [];
  for (const reference of config.mods) {
    if (typeof reference === "string") {
      references.push(reference);
    }
  }
  return references;
}

function buildExplorerPage(view, title) {
  const style = document.createElement("style");
  style.textContent = EXPLORER_STYLE;
  document.head.append(style);
  const heading = document.createElement("h1");
  heading.textContent = title;
  view.content.textContent = "Loading mods…";
  document.body.replaceChildren(heading, view.content, view.status);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  const view = {
    engine,
    viewer: String(context.config.viewer ?? "mod_viewer"),
    content: document.createElement("div"),
    status: document.createElement("p"),
  };
  view.status.className = "mod-error";
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  const entries = await inspectMods(engine, readModReferences(context.config));
  renderModList(view, entries);
}
