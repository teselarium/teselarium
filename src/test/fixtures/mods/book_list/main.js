/**
 * Sample mod: shows the books it receives as a grid of covers, with a
 * "Books per row" choice, and opens a card with each book's details and
 * body. It remembers the last opened book and the books per row.
 *
 * It is also an example of getting the app's look without classes: each book
 * is a plain button, `aria-current` marks the last opened one with the app's
 * primary outline, `<small>` mutes the authors, `<dialog>` is the card,
 * `<dl>` holds the details, `<span data-ot-variant="secondary">` makes the
 * genre badges, `<ot-tile-body>` renders the body, and `role="status"` shows
 * the empty list as a notice. This mod's own CSS sets layout and the books'
 * corner shape. See "Write HTML, get the app's look" in
 * docs/modules/lib/core/theme/README.md.
 */

const SELECTED_KEY = "selected";
const COLUMNS_KEY = "columns";
const BOOKS_PER_ROW_CHOICES = [4, 6, 8, 10];
const DEFAULT_BOOKS_PER_ROW = 6;
const CARD_TITLE_ID = "book-card-title";

/** The metadata the card shows as labeled values, in order. */
const CARD_DETAILS = [
  { key: "date", label: "Published" },
  { key: "country", label: "Country" },
  { key: "language", label: "Language" },
  { key: "pages", label: "Pages" },
];

// Layout and the books' corner shape only: the colors, borders, fonts and the
// last opened book's outline come from the theme.
const BOOK_LIST_STYLE = `
  main > header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ot-space-4);
    margin-bottom: var(--ot-space-4);
  }
  main > header > h1 { margin: 0; }
  main > header > label { display: flex; align-items: center; gap: var(--ot-space-2); }

  /*
   * N books per row: the minimum track is 1/N of the row, so auto-fill makes N
   * columns, unless that is narrower than --book-min, and then fewer fit. The
   * half pixel keeps rounding from dropping a column.
   */
  ul[data-columns] {
    --book-min: 4.5rem;
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(
        max(
          var(--book-min),
          calc((100% - (var(--books-per-row) - 1) * var(--ot-space-4)) / var(--books-per-row) - 0.5px)
        ),
        1fr
      )
    );
    gap: var(--ot-space-6) var(--ot-space-4);
    padding: 0;
    list-style: none;
  }
  ul[data-columns="4"] { --books-per-row: 4; }
  ul[data-columns="6"] { --books-per-row: 6; }
  ul[data-columns="8"] { --books-per-row: 8; }
  ul[data-columns="10"] { --books-per-row: 10; }
  ul[data-columns] > li { display: grid; align-content: start; gap: var(--ot-space-2); min-width: 0; }

  /* The book: a 2:3 button whose left corners are square, like a book's spine. */
  li > button {
    width: 100%;
    min-height: 0;
    aspect-ratio: 2 / 3;
    padding: 0;
    overflow: hidden;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    transition: transform 150ms, color 150ms, background-color 150ms, border-color 150ms, outline-color 150ms;
  }
  li > button:hover,
  li > button:focus-visible { transform: translateY(-2px); }
  li > button > img,
  dialog > header > figure > img { width: 100%; height: 100%; object-fit: cover; }

  /* The placeholder: the title written on the book. */
  li > button > span {
    display: -webkit-box;
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--ot-space-2);
    overflow: hidden;
    overflow-wrap: anywhere;
    text-align: center;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
  }

  /* The text under the cover: the title cut at two lines, then the authors. */
  li > p { display: grid; gap: var(--ot-space-1); margin: 0; overflow-wrap: anywhere; }
  li > p > strong { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  ul[data-columns="8"] > li > p > small,
  ul[data-columns="10"] > li > p > small { display: none; }

  /* The card: the close button in its corner, the small book, when it has a cover, next to the details. */
  dialog { box-sizing: border-box; width: min(40rem, 100%); }
  dialog > button[data-ot-variant="ghost"] { position: absolute; top: var(--ot-space-2); right: var(--ot-space-2); }
  dialog > header {
    display: flex;
    align-items: flex-start;
    gap: var(--ot-space-4);
    padding-right: var(--ot-space-6);
  }
  dialog > header > div { flex: 1; min-width: 0; }
  dialog > header > figure {
    flex: none;
    width: 6rem;
    aspect-ratio: 2 / 3;
    margin: 0;
    overflow: hidden;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-top-right-radius: var(--ot-radius);
    border-bottom-right-radius: var(--ot-radius);
  }
  dialog dl { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--ot-space-4); }
  dialog dd { margin: 0; }
  dialog > header p:last-child { display: flex; flex-wrap: wrap; gap: var(--ot-space-1); margin: 0; }

  @media (prefers-reduced-motion: reduce) {
    li > button { transition: none; }
    li > button:hover,
    li > button:focus-visible { transform: none; }
  }
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

function readBookGenres(tile) {
  const genres = tile.metadata.genres;
  const genreNames = [];
  if (!Array.isArray(genres)) {
    return genreNames;
  }
  for (const genre of genres) {
    if (typeof genre === "string") {
      genreNames.push(genre);
    }
  }
  return genreNames;
}

/** The accessible name of a book: its title and, when it has any, its authors. */
function readBookName(tile) {
  const authors = readBookAuthors(tile);
  if (authors === "") {
    return readBookTitle(tile);
  }
  const bookName = `${readBookTitle(tile)}, ${authors}`;
  return bookName;
}

function findTile(view, source) {
  for (const tile of view.tiles) {
    if (tile.source === source) {
      return tile;
    }
  }
  return null;
}

function isBooksPerRowChoice(value) {
  return BOOKS_PER_ROW_CHOICES.includes(value);
}

/** One of the books per row choices: `value` when it is one, 6 otherwise. */
function readBooksPerRow(value) {
  if (isBooksPerRowChoice(value)) {
    return value;
  }
  return DEFAULT_BOOKS_PER_ROW;
}

/** The books per row a start shows: the stored choice, then the config's `columns`, then 6. */
function readStartBooksPerRow(stored, configured) {
  if (isBooksPerRowChoice(stored)) {
    return stored;
  }
  const booksPerRow = readBooksPerRow(configured);
  return booksPerRow;
}

function shouldShowCover(view, tile) {
  return (
    view.config.show_covers === true && typeof tile.metadata.image === "string"
  );
}

/** The book's title written on the book, when it has no cover. */
function buildPlaceholder(tile) {
  const placeholder = document.createElement("span");
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.textContent = readBookTitle(tile);
  return placeholder;
}

function showPlaceholderInstead(tile, event) {
  event.currentTarget.replaceWith(buildPlaceholder(tile));
}

/** The cover image; `showFailure` handles its `error` event. */
function buildCover(tile, showFailure) {
  const cover = document.createElement("img");
  cover.alt = `Cover of ${readBookTitle(tile)}`;
  cover.addEventListener("error", showFailure);
  cover.src = tile.metadata.image;
  return cover;
}

/** What the book shows: its cover, or the placeholder when it has none or the cover fails to load. */
function buildBookFace(view, tile) {
  if (shouldShowCover(view, tile)) {
    const cover = buildCover(
      tile,
      showPlaceholderInstead.bind(undefined, tile),
    );
    return cover;
  }
  const placeholder = buildPlaceholder(tile);
  return placeholder;
}

/** A book: a plain button showing the cover, current when it is the last opened one. */
function buildBookButton(view, tile) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.source = tile.source;
  button.setAttribute("aria-label", readBookName(tile));
  if (tile.source === view.selected) {
    button.setAttribute("aria-current", "true");
  }
  button.append(buildBookFace(view, tile));
  button.addEventListener(
    "click",
    openBookCard.bind(undefined, view, tile.source),
  );
  return button;
}

/** The text under the cover: the title, and the authors in `<small>`, which the theme mutes. */
function buildBookCaption(tile) {
  const caption = document.createElement("p");
  const title = document.createElement("strong");
  title.textContent = readBookTitle(tile);
  const authors = document.createElement("small");
  authors.textContent = readBookAuthors(tile);
  caption.append(title, authors);
  return caption;
}

function buildBookItems(view) {
  const bookItems = [];
  for (const tile of view.tiles) {
    const item = document.createElement("li");
    item.append(buildBookButton(view, tile), buildBookCaption(tile));
    bookItems.push(item);
  }
  return bookItems;
}

function buildBookList(view) {
  const bookList = document.createElement("ul");
  bookList.dataset.columns = String(view.booksPerRow);
  bookList.append(...buildBookItems(view));
  return bookList;
}

async function chooseBooksPerRow(view, event) {
  view.booksPerRow = readBooksPerRow(Number(event.currentTarget.value));
  const bookList = view.main.querySelector("ul");
  bookList.dataset.columns = String(view.booksPerRow);
  await view.engine.request("storage.set", {
    key: COLUMNS_KEY,
    value: view.booksPerRow,
  });
}

/** The "Books per row" label, holding its select. */
function buildBooksPerRowControl(view) {
  const label = document.createElement("label");
  const select = document.createElement("select");
  for (const choice of BOOKS_PER_ROW_CHOICES) {
    const option = document.createElement("option");
    option.value = String(choice);
    option.textContent = String(choice);
    select.append(option);
  }
  select.value = String(view.booksPerRow);
  select.addEventListener("change", chooseBooksPerRow.bind(undefined, view));
  label.append("Books per row ", select);
  return label;
}

function buildBookListHeader(view) {
  const header = document.createElement("header");
  const heading = document.createElement("h1");
  heading.textContent = view.title;
  header.append(heading);
  if (view.tiles.length > 0) {
    header.append(buildBooksPerRowControl(view));
  }
  return header;
}

function buildBookContent(view) {
  if (view.tiles.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.setAttribute("role", "status");
    emptyMessage.textContent = "There are no books to show.";
    return emptyMessage;
  }
  const bookList = buildBookList(view);
  return bookList;
}

/** Draws the heading and the books in `<main>`. The card, outside it, is left as it is. */
function renderBookList(view) {
  view.main.replaceChildren(buildBookListHeader(view), buildBookContent(view));
}

function hasCardDetail(value) {
  return typeof value === "string" || typeof value === "number";
}

/** The labeled values of the card, leaving out each key the tile lacks or has with the wrong type. */
function buildCardDetails(tile) {
  const details = document.createElement("dl");
  for (const detail of CARD_DETAILS) {
    const value = tile.metadata[detail.key];
    if (!hasCardDetail(value)) {
      continue;
    }
    const term = document.createElement("dt");
    term.textContent = detail.label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    details.append(term, description);
  }
  return details;
}

function buildGenreBadges(tile) {
  const badges = document.createElement("p");
  for (const genre of readBookGenres(tile)) {
    const badge = document.createElement("span");
    badge.dataset.otVariant = "secondary";
    badge.textContent = genre;
    badges.append(badge);
  }
  return badges;
}

/** A card cover that fails to load leaves the card without its small book. */
function removeSmallBook(event) {
  event.currentTarget.parentElement.remove();
}

/** The small book of the card: the cover in a `<figure>`. */
function buildSmallBook(tile) {
  const smallBook = document.createElement("figure");
  smallBook.append(buildCover(tile, removeSmallBook));
  return smallBook;
}

/**
 * The top of the card: the small book when the book has a cover, then the
 * title, the authors, the details and the genres. Without a cover, the
 * heading already shows the title.
 */
function buildCardHeader(view, tile) {
  const header = document.createElement("header");
  if (shouldShowCover(view, tile)) {
    header.append(buildSmallBook(tile));
  }
  const about = document.createElement("div");
  const title = document.createElement("h2");
  title.id = CARD_TITLE_ID;
  title.textContent = readBookTitle(tile);
  const authors = document.createElement("p");
  const authorText = document.createElement("small");
  authorText.textContent = readBookAuthors(tile);
  authors.append(authorText);
  about.append(title, authors, buildCardDetails(tile), buildGenreBadges(tile));
  header.append(about);
  return header;
}

function closeBookCard(view) {
  view.card.close();
}

function buildCloseButton(view) {
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.otVariant = "ghost";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", closeBookCard.bind(undefined, view));
  return closeButton;
}

function hasBody(tile) {
  return typeof tile.body === "string" && tile.body.trim() !== "";
}

/** Fills the card from the tile: the close button, the header and, when the tile has one, the body. */
function fillBookCard(view, tile) {
  view.card.replaceChildren(
    buildCloseButton(view),
    buildCardHeader(view, tile),
  );
  if (hasBody(tile)) {
    const body = document.createElement("ot-tile-body");
    body.tile = tile;
    view.card.append(document.createElement("hr"), body);
  }
}

async function openBookCard(view, source) {
  const tile = findTile(view, source);
  if (tile === null || view.card.open) {
    return;
  }
  fillBookCard(view, tile);
  view.card.showModal();
  view.openSource = source;
  view.selected = source;
  await view.engine.request("storage.set", {
    key: SELECTED_KEY,
    value: source,
  });
}

function isOutsideCard(view, event) {
  const box = view.card.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/** A click on the backdrop targets the dialog itself, outside its box. */
function closeOnBackdropClick(view, event) {
  if (event.target === view.card && isOutsideCard(view, event)) {
    view.card.close();
  }
}

function findBookButton(view, source) {
  for (const button of view.main.querySelectorAll("button[data-source]")) {
    if (button.dataset.source === source) {
      return button;
    }
  }
  return null;
}

/** After the card closes: marks the opened book, and puts the focus back on it. */
function showClosedCard(view) {
  const source = view.openSource;
  view.openSource = null;
  renderBookList(view);
  const button = findBookButton(view, source);
  if (button !== null) {
    button.focus();
  }
}

function buildBookCard(view) {
  const card = document.createElement("dialog");
  card.setAttribute("aria-labelledby", CARD_TITLE_ID);
  card.addEventListener("click", closeOnBackdropClick.bind(undefined, view));
  card.addEventListener("close", showClosedCard.bind(undefined, view));
  return card;
}

/** The open card follows its book: rebuilt from the new tile, or closed when the book is gone. */
function updateOpenCard(view) {
  if (view.openSource === null) {
    return;
  }
  const tile = findTile(view, view.openSource);
  if (tile === null) {
    view.card.close();
    return;
  }
  fillBookCard(view, tile);
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  renderBookList(view);
  updateOpenCard(view);
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
    main: document.createElement("main"),
    card: null,
    title: context.mod.title,
    config: context.config,
    tiles: context.tiles,
    selected: null,
    booksPerRow: DEFAULT_BOOKS_PER_ROW,
    openSource: null,
  };
  view.card = buildBookCard(view);
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addBookListStyle();
  document.body.replaceChildren(view.main, view.card);
  const selected = await engine.request("storage.get", { key: SELECTED_KEY });
  view.selected = typeof selected === "string" ? selected : null;
  const columns = await engine.request("storage.get", { key: COLUMNS_KEY });
  view.booksPerRow = readStartBooksPerRow(columns, context.config.columns);
  renderBookList(view);
}
