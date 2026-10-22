/** Sample mod: lists the books it receives with their covers, and remembers the selected one. */

const SELECTED_KEY = "selected";

// Only the layout: the theme's base stylesheet gives the colors, fonts and the selected book's outline.
const BOOK_LIST_STYLE = `
  ul { list-style: none; padding: 0; display: grid; gap: var(--ot-space-2); }
  button { display: flex; gap: var(--ot-space-3); align-items: center; width: 100%; text-align: left; padding: var(--ot-space-2); }
  img { width: 48px; height: 72px; object-fit: cover; }
`;

function readBookTitle(tile) {
  const title = tile.metadata.title;
  if (typeof title !== "string") {
    return tile.source;
  }
  return title;
}

function readBookAuthors(tile) {
  const authors = tile.metadata.authors;
  if (!Array.isArray(authors)) {
    return "";
  }
  const authorText = authors.join(", ");
  return authorText;
}

function shouldShowCover(view, tile) {
  return (
    view.config.show_covers === true && typeof tile.metadata.image === "string"
  );
}

function buildCover(tile) {
  const cover = document.createElement("img");
  cover.src = tile.metadata.image;
  cover.alt = `Cover of ${readBookTitle(tile)}`;
  return cover;
}

function buildBookText(tile) {
  const bookText = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = readBookTitle(tile);
  const authors = document.createElement("span");
  authors.textContent = readBookAuthors(tile);
  bookText.append(title, document.createElement("br"), authors);
  return bookText;
}

async function selectBook(view, source) {
  view.selected = source;
  renderBookList(view);
  await view.engine.request("storage.set", {
    key: SELECTED_KEY,
    value: source,
  });
}

function buildBookButton(view, tile) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", String(tile.source === view.selected));
  if (shouldShowCover(view, tile)) {
    button.append(buildCover(tile));
  }
  button.append(buildBookText(tile));
  button.addEventListener(
    "click",
    selectBook.bind(undefined, view, tile.source),
  );
  return button;
}

function buildBookItems(view) {
  const bookItems = [];
  for (const tile of view.tiles) {
    const item = document.createElement("li");
    item.append(buildBookButton(view, tile));
    bookItems.push(item);
  }
  return bookItems;
}

function buildBookContent(view) {
  if (view.tiles.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "There are no books to show.";
    return emptyMessage;
  }
  const bookList = document.createElement("ul");
  bookList.append(...buildBookItems(view));
  return bookList;
}

function renderBookList(view) {
  const heading = document.createElement("h1");
  heading.textContent = view.title;
  view.root.replaceChildren(heading, buildBookContent(view));
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  renderBookList(view);
}

function addBookListStyle() {
  const style = document.createElement("style");
  style.textContent = BOOK_LIST_STYLE;
  document.head.append(style);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  const view = {
    engine,
    root: document.body,
    title: context.mod.title,
    config: context.config,
    tiles: context.tiles,
    selected: null,
  };
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addBookListStyle();
  const selected = await engine.request("storage.get", { key: SELECTED_KEY });
  view.selected = typeof selected === "string" ? selected : null;
  renderBookList(view);
}
