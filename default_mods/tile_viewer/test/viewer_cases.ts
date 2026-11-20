import type { CaseContext } from "../../mod_api.d.ts";
import {
  buildCaseTile,
  findElement,
  findMetadataValue,
  findRequests,
  mountWithFixtureTile,
  readFixtureTile,
} from "./case_helpers.ts";

function readBodyText(context: CaseContext): string {
  const body = context.root.querySelector("ot-tile-body");
  return body?.textContent ?? "";
}

function hasBodyText(context: CaseContext, text: string): boolean {
  return readBodyText(context).includes(text);
}

function listTopLevelKeys(context: CaseContext): (string | null)[] {
  const keys: (string | null)[] = [];
  for (const term of context.root.querySelectorAll(
    'section[aria-label="Metadata"] > dl > div > dt',
  )) {
    keys.push(term.textContent);
  }
  return keys;
}

export async function showsTheTile(context: CaseContext): Promise<void> {
  await context.mount({ collection: null });

  const tile = readFixtureTile(context, "kallocain.md");
  context
    .expect(findElement(context, "article > h1").textContent)
    .toBe("Kallocain");
  context
    .expect(findElement(context, "article > small").textContent)
    .toBe(tile.source);
  await context.waitFor(
    hasBodyText.bind(
      undefined,
      context,
      "A fixture tile of the tile viewer's tests.",
    ),
  );
}

/** The tag names of the card's children, in order. */
function listCardChildren(context: CaseContext): string[] {
  const tagNames: string[] = [];
  for (const child of findElement(context, "article").children) {
    tagNames.push(child.tagName);
  }
  return tagNames;
}

export async function putsTheBodyInTheCard(
  context: CaseContext,
): Promise<void> {
  await context.mount({ collection: null });

  context
    .expect(listCardChildren(context))
    .toEqual(["H1", "SMALL", "HR", "SECTION", "HR", "OT-TILE-BODY"]);
  context
    .expect(
      findElement(context, "article > section").getAttribute("aria-label"),
    )
    .toBe("Metadata");
}

function readBox(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

export async function laysValuesBesideTheirKeys(
  context: CaseContext,
): Promise<void> {
  const tile = buildCaseTile(context, "layout.md", {
    pages: 156,
    genres: ["Dystopian", "Political"],
  });
  await context.mount({ tiles: [tile], collection: null });

  const pages = findMetadataValue(context, "pages");
  const pagesKey = pages.previousElementSibling as Element;
  context.expect(readBox(pages).top).toBe(readBox(pagesKey).top);
  context.expect(readBox(pages).left >= readBox(pagesKey).right).toBe(true);
  const genres = findMetadataValue(context, "genres");
  const items = genres.querySelectorAll("ul > li");
  context.expect(items.length).toBe(2);
  context.expect(readBox(items[1]).top >= readBox(items[0]).bottom).toBe(true);
  context.expect(readBox(items[0]).left).toBe(readBox(pages).left);
  context.expect(readBox(items[1]).left).toBe(readBox(pages).left);
  context.expect(getComputedStyle(items[0]).listStyleType).toBe("none");
}

export async function headsWithFileName(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "reading_list.md", null);

  context
    .expect(findElement(context, "article > h1").textContent)
    .toBe("reading_list.md");
}

export async function showsNestedMetadata(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md", null);

  context
    .expect(listTopLevelKeys(context))
    .toEqual([
      "title",
      "authors",
      "pages",
      "read",
      "edition",
      "source",
      "cover",
    ]);
  const authors = findMetadataValue(context, "authors");
  context
    .expect(authors.querySelector("ul > li")?.textContent)
    .toBe("Karin Boye");
  context.expect(findMetadataValue(context, "pages").textContent).toBe("156");
  context.expect(findMetadataValue(context, "read").textContent).toBe("true");
  const edition = findMetadataValue(context, "edition");
  context
    .expect(edition.querySelector("dl > div > dt")?.textContent)
    .toBe("year");
  context
    .expect(edition.querySelector("dl > div > dd")?.textContent)
    .toBe("1940");
}

export async function linksWebAddresses(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md", null);

  const link = findMetadataValue(context, "source").querySelector("a");
  context
    .expect(link?.getAttribute("href"))
    .toBe("https://example.org/books/kallocain");
  context.expect(link?.hasAttribute("data-ot-link")).toBe(true);
  context.expect(link?.textContent).toBe("https://example.org/books/kallocain");
  context.expect(link?.querySelector("img")).toBe(null);
  context
    .expect(findMetadataValue(context, "title").querySelector("a"))
    .toBe(null);
}

export async function showsImageThumbnails(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md", null);

  const cover = String(readFixtureTile(context, "kallocain.md").metadata.cover);
  const link = findMetadataValue(context, "cover").querySelector("a");
  const thumbnail = link?.querySelector("img");
  context.expect(link?.getAttribute("href")).toBe(cover);
  context.expect(link?.textContent).toBe(cover);
  context.expect(thumbnail?.getAttribute("src")).toBe(cover);
  context.expect(thumbnail?.getAttribute("loading")).toBe("lazy");
  context.expect(thumbnail?.getAttribute("alt")).toBe("");
}

function isHidden(element: HTMLElement): boolean {
  return element.hidden && getComputedStyle(element).display === "none";
}

export async function hidesFailedThumbnail(
  context: CaseContext,
): Promise<void> {
  const missingImage = buildCaseTile(context, "missing.png", {}).source;
  const tile = buildCaseTile(context, "broken_cover.md", {
    image: missingImage,
  });
  await context.mount({ tiles: [tile], collection: null });

  const link = findMetadataValue(context, "image").querySelector("a");
  const thumbnail = link?.querySelector("img");
  if (thumbnail === null || thumbnail === undefined) {
    throw new Error("The viewer draws no thumbnail for an image address.");
  }
  // The case's frame is hidden, where a lazy image may never load: load it now.
  thumbnail.loading = "eager";
  await context.waitFor(isHidden.bind(undefined, thumbnail));
  context.expect(link?.textContent).toBe(missingImage);
}

export async function saysNoMetadata(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "reading_list.md", null);

  context
    .expect(
      findElement(context, 'section[aria-label="Metadata"] > p').textContent,
    )
    .toBe("This file has no metadata.");
  context
    .expect(context.root.querySelector('section[aria-label="Metadata"] dl'))
    .toBe(null);
  await context.waitFor(
    hasBodyText.bind(undefined, context, "A fixture file without frontmatter"),
  );
}

export async function rendersNoEmptyBody(context: CaseContext): Promise<void> {
  await context.mount({
    tiles: [buildCaseTile(context, "empty.md", { title: "Empty" })],
    collection: null,
  });

  context.expect(context.root.querySelector("ot-tile-body")).toBe(null);
  context
    .expect(listCardChildren(context))
    .toEqual(["H1", "SMALL", "HR", "SECTION"]);
  context.expect(findRequests(context, "tiles.renderBody")).toEqual([]);
}

export async function saysNoTile(context: CaseContext): Promise<void> {
  await context.mount({ tiles: [], collection: null });

  context
    .expect(findElement(context, '[role="status"]').textContent)
    .toBe("No tile was given.");
  context.expect(context.root.querySelector("article")).toBe(null);
}
