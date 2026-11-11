/**
 * Tests of the sample mod, which `mods.check` runs after mounting it. Each
 * case runs in a fresh hidden frame with a throwaway storage slot, and
 * mounts the mod itself through its context.
 */

/** A tile of the book type with only a title, and no image or body. */
const DRAFT_TILE = {
  source: "https://example.org/books/untitled_draft.md",
  metadata: { title: "Untitled draft" },
  body: "",
};

function findBookButton(context, title) {
  for (const button of context.root.querySelectorAll("li > button")) {
    if (button.getAttribute("aria-label").startsWith(title)) {
      return button;
    }
  }
  throw new Error(`No book button is named "${title}"`);
}

function readBooksPerRowChoice(context) {
  const select = context.root.querySelector("select");
  return select.value;
}

function readTexts(elements) {
  const texts = [];
  for (const element of elements) {
    texts.push(element.textContent);
  }
  return texts;
}

async function listsTheSampleBooks(context) {
  await context.mount();
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
}

async function showsAPlaceholderWithoutAnImage(context) {
  await context.mount({ tiles: [context.tiles[0], DRAFT_TILE] });
  const draft = findBookButton(context, "Untitled draft");
  context.expect(draft.querySelector("img")).toBe(null);
  context
    .expect(draft.querySelector("span").textContent)
    .toBe("Untitled draft");
}

async function showsPlaceholdersWhenCoversAreOff(context) {
  await context.mount({ config: { show_covers: false } });
  context.expect(context.root.querySelectorAll("img").length).toBe(0);
  context
    .expect(context.root.querySelectorAll("li > button > span").length)
    .toBe(3);
}

async function namesEachBookByTitleAndAuthors(context) {
  await context.mount();
  const names = [];
  for (const button of context.root.querySelectorAll("li > button")) {
    names.push(button.getAttribute("aria-label"));
  }
  context
    .expect(names)
    .toEqual([
      "Fahrenheit 451, Ray Bradbury",
      "Kallocain, Karin Boye",
      "The Library of Babel, Jorge Luis Borges",
    ]);
}

async function usesTheConfigsBooksPerRow(context) {
  await context.mount({ config: { columns: 8 } });
  context.expect(readBooksPerRowChoice(context)).toBe("8");
  context.expect(context.root.querySelector("ul").dataset.columns).toBe("8");
}

async function ignoresAnUnknownBooksPerRow(context) {
  await context.mount({ config: { columns: 5 } });
  context.expect(readBooksPerRowChoice(context)).toBe("6");
}

async function remembersTheBooksPerRow(context) {
  await context.storage.set("columns", 10);
  await context.mount({ config: { columns: 4 } });
  context.expect(readBooksPerRowChoice(context)).toBe("10");
}

async function ignoresAnUnknownStoredBooksPerRow(context) {
  await context.storage.set("columns", 7);
  await context.mount({ config: { columns: 6 } });
  context.expect(readBooksPerRowChoice(context)).toBe("6");
}

async function hasNoSelectWithoutBooks(context) {
  await context.mount({ tiles: [] });
  context.expect(context.root.querySelector("select")).toBe(null);
  context.expect(context.root.querySelector("ul")).toBe(null);
}

async function opensTheCardOfAClickedBook(context) {
  await context.mount();
  findBookButton(context, "Kallocain").click();
  const card = context.root.querySelector("dialog");
  context.expect(card.open).toBe(true);
  context.expect(card.querySelector("h2").textContent).toBe("Kallocain");
  context
    .expect(card.querySelector("header small").textContent)
    .toBe("Karin Boye");
  context
    .expect(readTexts(card.querySelectorAll("dd")))
    .toEqual(["1940-10-01", "Sweden", "Swedish", "220"]);
  context
    .expect(readTexts(card.querySelectorAll("span[data-ot-variant]")))
    .toEqual(["Dystopian", "Political", "Social science fiction"]);
}

async function leavesOutMissingMetadata(context) {
  await context.mount({ tiles: [DRAFT_TILE] });
  findBookButton(context, "Untitled draft").click();
  const card = context.root.querySelector("dialog");
  context.expect(card.querySelector("h2").textContent).toBe("Untitled draft");
  context.expect(card.querySelectorAll("dt, dd").length).toBe(0);
  context.expect(card.querySelectorAll("span[data-ot-variant]").length).toBe(0);
}

async function showsNoSmallBookWithoutACover(context) {
  await context.mount({ config: { show_covers: false } });
  findBookButton(context, "Kallocain").click();
  const card = context.root.querySelector("dialog");
  context.expect(card.querySelectorAll("figure, img").length).toBe(0);
  context.expect(card.querySelector("h2").textContent).toBe("Kallocain");
}

async function highlightsTheRememberedBook(context) {
  await context.storage.set("selected", context.tiles[1].source);
  await context.mount();
  const current = context.root.querySelectorAll('button[aria-current="true"]');
  context.expect(current.length).toBe(1);
  context.expect(current[0].getAttribute("aria-label")).toContain("Kallocain");
}

async function marksNoBookForAnUnknownRememberedSource(context) {
  await context.storage.set("selected", "https://example.org/books/gone.md");
  await context.mount();
  context
    .expect(context.root.querySelectorAll("[aria-current]").length)
    .toBe(0);
}

async function doesNotReopenTheRememberedBooksCard(context) {
  await context.storage.set("selected", context.tiles[1].source);
  await context.mount();
  context.expect(context.root.querySelector("dialog").open).toBe(false);
}

export default function registerBookListTests(t) {
  t.test("lists the sample books", listsTheSampleBooks);
  t.test(
    "shows a placeholder without an image",
    showsAPlaceholderWithoutAnImage,
  );
  t.test(
    "shows placeholders when covers are off",
    showsPlaceholdersWhenCoversAreOff,
  );
  t.test(
    "names each book by title and authors",
    namesEachBookByTitleAndAuthors,
  );
  t.test("uses the config's books per row", usesTheConfigsBooksPerRow);
  t.test("ignores an unknown books per row", ignoresAnUnknownBooksPerRow);
  t.test("remembers the books per row", remembersTheBooksPerRow);
  t.test(
    "ignores an unknown stored books per row",
    ignoresAnUnknownStoredBooksPerRow,
  );
  t.test("has no select without books", hasNoSelectWithoutBooks);
  t.test("opens the card of a clicked book", opensTheCardOfAClickedBook);
  t.test("leaves out missing metadata", leavesOutMissingMetadata);
  t.test("shows no small book without a cover", showsNoSmallBookWithoutACover);
  t.test("highlights the remembered book", highlightsTheRememberedBook);
  t.test(
    "marks no book for an unknown remembered source",
    marksNoBookForAnUnknownRememberedSource,
  );
  t.test(
    "does not reopen the remembered book's card",
    doesNotReopenTheRememberedBooksCard,
  );
}
