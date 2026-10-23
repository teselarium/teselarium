/**
 * Default mod: lists the mods of its config and opens the viewer for the one
 * the user picks.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (an
 * `<article>` is a card, `role="alert"` an alert, `aria-busy` a loading
 * state), and this mod's own CSS sets layout only. See "Write HTML, get the
 * app's look" in docs/modules/lib/core/theme/README.md.
 */

// Layout only: the colors, borders and fonts come from the theme.
const EXPLORER_STYLE = `
  ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: var(--ot-space-4); }
  li { display: grid; }
  li > * { margin: 0; }
  article { display: grid; grid-template-rows: auto 1fr auto; }
  article button { justify-self: start; }
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

/** A mod as a card: an `<article>` with its title, description and a button. */
function buildModCard(view, inspection) {
  const card = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = inspection.title;
  const description = document.createElement("p");
  description.textContent = inspection.description;
  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.textContent = `View ${inspection.title}`;
  viewButton.addEventListener(
    "click",
    openViewer.bind(undefined, view, inspection),
  );
  card.append(title, description, viewButton);
  return card;
}

/** A mod that cannot be inspected: `role="alert"` gives it the app's destructive alert look. */
function buildFailureAlert(entry) {
  const failure = document.createElement("div");
  failure.setAttribute("role", "alert");
  const reference = document.createElement("code");
  reference.textContent = entry.reference;
  const message = document.createElement("p");
  message.textContent = entry.error;
  failure.append(reference, message);
  return failure;
}

function buildModItem(view, entry) {
  const item = document.createElement("li");
  if (entry.inspection === null) {
    item.append(buildFailureAlert(entry));
    return item;
  }
  item.append(buildModCard(view, entry.inspection));
  return item;
}

function renderModList(view, entries) {
  const list = document.createElement("ul");
  for (const entry of entries) {
    list.append(buildModItem(view, entry));
  }
  view.content.replaceChildren(list);
  view.content.removeAttribute("aria-busy");
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

/** The page while the mods load: the region is busy, and the status region waits, empty. */
function buildExplorerPage(view, title) {
  const style = document.createElement("style");
  style.textContent = EXPLORER_STYLE;
  document.head.append(style);
  const heading = document.createElement("h1");
  heading.textContent = title;
  view.content.setAttribute("aria-busy", "true");
  view.content.textContent = "Loading mods…";
  document.body.replaceChildren(heading, view.content, view.status);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  const view = {
    engine,
    viewer: String(context.config.viewer ?? "mod_viewer"),
    content: document.createElement("section"),
    status: document.createElement("p"),
  };
  view.content.setAttribute("aria-label", "Mods");
  view.status.setAttribute("role", "status");
  buildExplorerPage(view, context.mod.title);
  const entries = await inspectMods(engine, readModReferences(context.config));
  renderModList(view, entries);
}
