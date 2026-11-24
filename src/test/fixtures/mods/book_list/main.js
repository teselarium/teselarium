/**
 * Sample mod: shows the books it receives as a grid of covers, with a
 * "Books per row" choice, and opens a card with each book's details and
 * body. It remembers the books per row.
 *
 * It is also an example of getting the app's look without classes: each book
 * is a plain button, `<small>` mutes the authors, `<dialog>` is the card,
 * `<dl>` holds the details, `<span data-tes-variant="secondary">` makes the
 * genre badges, `<tes-tile-body>` renders the body, and `role="status"` shows
 * the empty list as a notice. This mod's own CSS sets layout, and the books'
 * corner shape and shadow, from the theme's `--tes-radius` and `--tes-shadow`.
 * See "Write HTML, get the app's look" in
 * docs/modules/lib/core/theme/README.md.
 */

const COLUMNS_KEY = "columns";
const BOOKS_PER_ROW_CHOICES = [4, 6, 8, 10];
const DEFAULT_BOOKS_PER_ROW = 6;
const CARD_TITLE_ID = "book-card-title";

/** A year at the start of a date, as in `1940-10-01`. */
const LEADING_YEAR = /^\d{4}/;

/** The metadata the card shows as labeled values, in order, and how each is written. */
const CARD_DETAILS = [
  { key: "date", label: "Published", write: writePublishedYear },
  { key: "country", label: "Country", write: String },
  { key: "language", label: "Language", write: String },
  { key: "pages", label: "Pages", write: String },
];

// Layout, and the books' corner shape and shadow from the theme's tokens: the
// colors, borders and fonts come from the theme.
const BOOK_LIST_STYLE = `
  main > header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--tes-space-4);
    margin-bottom: var(--tes-space-4);
  }
  main > header > h1 { margin: 0; }
  main > header > label { display: flex; align-items: center; gap: var(--tes-space-2); }

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
          calc((100% - (var(--books-per-row) - 1) * var(--tes-space-4)) / var(--books-per-row) - 0.5px)
        ),
        1fr
      )
    );
    gap: var(--tes-space-6) var(--tes-space-4);
    padding: 0;
    list-style: none;
  }
  ul[data-columns="4"] { --books-per-row: 4; }
  ul[data-columns="6"] { --books-per-row: 6; }
  ul[data-columns="8"] { --books-per-row: 8; }
  ul[data-columns="10"] { --books-per-row: 10; }
  ul[data-columns] > li { display: grid; align-content: start; gap: var(--tes-space-2); min-width: 0; }

  /* The book: a 2:3 button whose left corners are square, like a book's spine. */
  li > button {
    width: 100%;
    min-height: 0;
    aspect-ratio: 2 / 3;
    padding: 0;
    overflow: hidden;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    transition: transform 150ms, box-shadow 150ms, color 150ms, background-color 150ms, border-color 150ms;
  }

  /* The raised book: under the pointer, with keyboard focus, or while its card is open. */
  li > button:hover,
  li > button:focus-visible,
  li > button[aria-expanded="true"] {
    transform: translateY(-2px);
    box-shadow: var(--tes-shadow);
  }
  li > button > img,
  dialog > header > figure > img { width: 100%; height: 100%; object-fit: cover; }

  /* The placeholder: the title written on the book. */
  li > button > span {
    display: -webkit-box;
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--tes-space-2);
    overflow: hidden;
    overflow-wrap: anywhere;
    text-align: center;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
  }

  /* The text under the cover: the title cut at two lines, then the authors. */
  li > p { display: grid; gap: var(--tes-space-1); margin: 0; overflow-wrap: anywhere; }
  li > p > strong { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  ul[data-columns="8"] > li > p > small,
  ul[data-columns="10"] > li > p > small { display: none; }

  /* The card: the close button in its corner, the small book, when it has a cover, next to the details. */
  dialog { box-sizing: border-box; width: min(40rem, 100%); }
  dialog > button[data-tes-variant="ghost"] { position: absolute; top: var(--tes-space-2); right: var(--tes-space-2); }
  dialog > button[data-tes-variant="ghost"] > svg { display: block; }
  dialog > header {
    display: flex;
    align-items: flex-start;
    gap: var(--tes-space-4);
    padding-right: var(--tes-space-6);
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
    border-top-right-radius: var(--tes-radius);
    border-bottom-right-radius: var(--tes-radius);
  }
  dialog dl { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--tes-space-4); }
  dialog dd { margin: 0; }
  dialog > header p:last-child { display: flex; flex-wrap: wrap; gap: var(--tes-space-1); margin: 0; }

  @media (prefers-reduced-motion: reduce) {
    li > button { transition: none; }
    li > button:hover,
    li > button:focus-visible,
    li > button[aria-expanded="true"] { transform: none; }
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

/** A book: a plain button showing the cover, expanded while its card is open. */
function buildBookButton(view, tile) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.source = tile.source;
  button.setAttribute("aria-label", readBookName(tile));
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(tile.source === view.openSource));
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

/** Only the year of a date that starts with one; any other date as written. */
function writePublishedYear(date) {
  if (typeof date !== "string") {
    return String(date);
  }
  const year = LEADING_YEAR.exec(date);
  if (year === null) {
    return date;
  }
  const yearText = year[0];
  return yearText;
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
    description.textContent = detail.write(value);
    details.append(term, description);
  }
  return details;
}

function buildGenreBadges(tile) {
  const badges = document.createElement("p");
  for (const genre of readBookGenres(tile)) {
    const badge = document.createElement("span");
    badge.dataset.tesVariant = "secondary";
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

/** A click with no pointer (`detail` 0) is Enter or Space on the close button. */
function closeBookCard(view, event) {
  view.closedByKeyboard = event.detail === 0;
  view.card.close();
}

function noteKeyboardClose(view) {
  view.closedByKeyboard = true;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** A 20 by 20 cross drawn in the button's color, so the theme colors it. */
function buildCloseIcon() {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("aria-hidden", "true");
  const cross = document.createElementNS(SVG_NAMESPACE, "path");
  cross.setAttribute("d", "M18 6 6 18M6 6l12 12");
  icon.append(cross);
  return icon;
}

function buildCloseButton(view) {
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.tesVariant = "ghost";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.append(buildCloseIcon());
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
    const body = document.createElement("tes-tile-body");
    body.tile = tile;
    view.card.append(document.createElement("hr"), body);
  }
}

function openBookCard(view, source) {
  const tile = findTile(view, source);
  if (tile === null || view.card.open) {
    return;
  }
  fillBookCard(view, tile);
  view.card.showModal();
  view.openSource = source;
  view.closedByKeyboard = false;
  const button = findBookButton(view, source);
  button.setAttribute("aria-expanded", "true");
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

/**
 * After the card closes: the book is no longer expanded, and gets the focus
 * back, with the focus ring only when the card was closed with the keyboard.
 * The browser may have given it the focus already, with its own choice of
 * ring, and `focus()` does nothing on a focused element: hence the `blur()`.
 */
function showClosedCard(view) {
  const button = findBookButton(view, view.openSource);
  view.openSource = null;
  if (button !== null) {
    button.setAttribute("aria-expanded", "false");
    button.blur();
    button.focus({ focusVisible: view.closedByKeyboard });
  }
}

function buildBookCard(view) {
  const card = document.createElement("dialog");
  card.setAttribute("aria-labelledby", CARD_TITLE_ID);
  card.addEventListener("click", closeOnBackdropClick.bind(undefined, view));
  card.addEventListener("cancel", noteKeyboardClose.bind(undefined, view));
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
    booksPerRow: DEFAULT_BOOKS_PER_ROW,
    openSource: null,
    closedByKeyboard: false,
  };
  view.card = buildBookCard(view);
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addBookListStyle();
  document.body.replaceChildren(view.main, view.card);
  const columns = await engine.request("storage.get", { key: COLUMNS_KEY });
  view.booksPerRow = readStartBooksPerRow(columns, context.config.columns);
  renderBookList(view);
}
