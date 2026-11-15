import type { CaseContext, ModYamlMapping } from "../../mod_api.d.ts";
import {
  buildCaseTile,
  findElement,
  findMetadataValue,
} from "./case_helpers.ts";
import { readTokenAs } from "./look_probes.ts";

/** The metadata of "Long metadata starts collapsed": 4 single lines, a list of 5, then an address. */
const LONG_METADATA: ModYamlMapping = {
  pages: 156,
  read: true,
  year: 1940,
  language: "Swedish",
  genres: ["Dystopian", "Political", "Science fiction", "Satire", "Novel"],
  source: "https://example.org/books/kallocain",
};

function mountWithMetadata(
  context: CaseContext,
  metadata: ModYamlMapping,
): Promise<void> {
  const mounting = context.mount({
    tiles: [buildCaseTile(context, "metadata.md", metadata)],
  });
  return mounting;
}

/** Whether the user sees the element: the computed display, not only `hidden`. */
function isShown(element: Element): boolean {
  return getComputedStyle(element).display !== "none";
}

/** The field of a key, its `<div>`. */
function findField(context: CaseContext, key: string): HTMLElement {
  return findMetadataValue(context, key).parentElement as HTMLElement;
}

function listShownKeys(context: CaseContext): (string | null)[] {
  const keys: (string | null)[] = [];
  const selector = 'section[aria-label="Metadata"] > dl > div';
  for (const field of context.root.querySelectorAll(selector)) {
    if (isShown(field)) {
      keys.push(field.querySelector("dt")?.textContent ?? null);
    }
  }
  return keys;
}

function listShownItems(context: CaseContext, key: string): (string | null)[] {
  const items: (string | null)[] = [];
  for (const item of findMetadataValue(context, key).querySelectorAll("li")) {
    if (isShown(item)) {
      items.push(item.textContent);
    }
  }
  return items;
}

function findMoreLine(context: CaseContext, key: string): HTMLElement {
  const moreLine = findMetadataValue(context, key).querySelector("dd > small");
  if (!(moreLine instanceof HTMLElement)) {
    throw new Error(`The field "${key}" has no "and <n> more" line.`);
  }
  return moreLine;
}

function findToggle(context: CaseContext): HTMLButtonElement | null {
  return context.root.querySelector(
    'section[aria-label="Metadata"] > header > button',
  );
}

export async function collapsesLongMetadata(
  context: CaseContext,
): Promise<void> {
  await mountWithMetadata(context, LONG_METADATA);

  context
    .expect(listShownKeys(context))
    .toEqual(["pages", "read", "year", "language", "genres"]);
  context.expect(listShownItems(context, "genres")).toEqual(["Dystopian"]);
  const moreLine = findMoreLine(context, "genres");
  context.expect(moreLine.textContent).toBe("and 4 more");
  context.expect(isShown(moreLine)).toBe(true);
  context.expect(findField(context, "source").hidden).toBe(true);
  const header = findElement(
    context,
    'section[aria-label="Metadata"] > header',
  );
  context.expect(header.querySelector("h2")?.textContent).toBe("Metadata");
  const toggle = findToggle(context);
  context.expect(toggle?.textContent).toBe("Show all 6 fields");
  context.expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  context
    .expect(toggle?.getAttribute("aria-controls"))
    .toBe(findElement(context, 'section[aria-label="Metadata"] > dl').id);
}

export async function showsAllFields(context: CaseContext): Promise<void> {
  await mountWithMetadata(context, LONG_METADATA);
  const toggle = findToggle(context);

  toggle?.click();

  context
    .expect(listShownKeys(context))
    .toEqual(["pages", "read", "year", "language", "genres", "source"]);
  context.expect(listShownItems(context, "genres").length).toBe(5);
  context.expect(isShown(findMoreLine(context, "genres"))).toBe(false);
  context.expect(toggle?.textContent).toBe("Show fewer fields");
  context.expect(toggle?.getAttribute("aria-expanded")).toBe("true");

  toggle?.click();

  context
    .expect(listShownKeys(context))
    .toEqual(["pages", "read", "year", "language", "genres"]);
  context.expect(listShownItems(context, "genres")).toEqual(["Dystopian"]);
  context.expect(toggle?.textContent).toBe("Show all 6 fields");
}

export async function keepsShortMetadataWhole(
  context: CaseContext,
): Promise<void> {
  await mountWithMetadata(context, {
    title: "Kallocain",
    pages: 156,
    read: true,
  });

  context.expect(listShownKeys(context)).toEqual(["title", "pages", "read"]);
  context.expect(findToggle(context)).toBe(null);
  context
    .expect(
      findElement(context, 'section[aria-label="Metadata"] > header > h2')
        .textContent,
    )
    .toBe("Metadata");
}

export async function cutsALongFirstList(context: CaseContext): Promise<void> {
  const names: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    names.push(`Name ${index}`);
  }
  await mountWithMetadata(context, { names, pages: 156 });

  context
    .expect(listShownItems(context, "names"))
    .toEqual(["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]);
  context
    .expect(findMoreLine(context, "names").textContent)
    .toBe("and 15 more");
  context.expect(listShownKeys(context)).toEqual(["names"]);
}

function isLoaded(image: HTMLImageElement): boolean {
  return image.complete && image.naturalHeight > 0;
}

export async function drawsTwoLineThumbnails(
  context: CaseContext,
): Promise<void> {
  const cover = buildCaseTile(context, "cover.svg", {}).source;
  await mountWithMetadata(context, { cover });
  const value = findMetadataValue(context, "cover");
  const thumbnail = value.querySelector("img");
  if (thumbnail === null) {
    throw new Error("The viewer draws no thumbnail for an image address.");
  }
  // A check's frame is transparent but laid out: load the image now.
  thumbnail.loading = "eager";
  await context.waitFor(isLoaded.bind(undefined, thumbnail));

  const lineHeight = parseFloat(getComputedStyle(value).lineHeight);
  const height = thumbnail.getBoundingClientRect().height;
  context.expect(Math.abs(height - 2 * lineHeight) < 1).toBe(true);
  // The image's row is two lines: the value is as high as its thumbnail.
  context
    .expect(Math.abs(value.getBoundingClientRect().height - height) < 2)
    .toBe(true);
}

export async function drawsTheButtonAsAButton(
  context: CaseContext,
): Promise<void> {
  await mountWithMetadata(context, LONG_METADATA);

  const toggle = findToggle(context);
  if (toggle === null) {
    throw new Error("The collapsed metadata has no button.");
  }
  const look = getComputedStyle(toggle);
  context.expect(look.borderTopStyle).toBe("solid");
  context.expect(parseFloat(look.borderTopWidth) > 0).toBe(true);
  context
    .expect(look.backgroundColor)
    .toBe(readTokenAs("--ot-background", "color"));
  const heading = findElement(
    context,
    'section[aria-label="Metadata"] > header > h2',
  );
  context
    .expect(
      toggle.getBoundingClientRect().height <=
        heading.getBoundingClientRect().height,
    )
    .toBe(true);
}
