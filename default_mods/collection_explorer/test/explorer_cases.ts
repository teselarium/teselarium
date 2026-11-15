import type { CaseContext, CaseRequest } from "../../mod_api.d.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

/**
 * The fixture collection the cases list, by its address in the default mods
 * folder: a case has no mod source to resolve against (default_mods/README.md).
 */
const LISTED_COLLECTION_LOCATION =
  "./default_mods/collection_explorer/fixtures/listed_collection.yaml";

/** The end of the listed collection's source, whatever the app's address. */
const LISTED_COLLECTION_PATH =
  "/default_mods/collection_explorer/fixtures/listed_collection.yaml";

/** A fixture path with no file, which `collections.inspect` answers with an error. */
const MISSING_COLLECTION_LOCATION =
  "./default_mods/collection_explorer/fixtures/missing_collection.yaml";

/** The viewer of the explorer's own config. */
const CONFIG_VIEWER = "collection_viewer";

function mountWithCollections(
  context: CaseContext,
  collections: string[],
): Promise<void> {
  const mounting = context.mount({
    config: { viewer: CONFIG_VIEWER, collections },
  });
  return mounting;
}

function findElement(context: CaseContext, selector: string): HTMLElement {
  const element = context.root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`The explorer draws no element matching "${selector}".`);
  }
  return element;
}

function findRequest(
  context: CaseContext,
  method: string,
): CaseRequest | undefined {
  for (const request of context.requests) {
    if (request.method === method) {
      return request;
    }
  }
  return undefined;
}

/** The source the explorer got from `collections.inspect` for the listed collection. */
function readInspectedSource(context: CaseContext): string {
  const inspectRequest = findRequest(context, "collections.inspect");
  const result = inspectRequest?.result as { source?: unknown } | undefined;
  if (typeof result?.source !== "string") {
    throw new Error(
      "The explorer's collections.inspect has no source in its result.",
    );
  }
  return result.source;
}

export async function listsCollectionsAsCards(
  context: CaseContext,
): Promise<void> {
  await mountWithCollections(context, [LISTED_COLLECTION_LOCATION]);

  const card = findElement(context, "li > article");
  const paragraphs = card.querySelectorAll("p");
  context
    .expect(card.querySelector("h2")?.textContent)
    .toBe("Listed collection");
  context
    .expect(paragraphs[0]?.textContent)
    .toBe("A fixture collection that the explorer's tests list.");
  context.expect(paragraphs[1]?.textContent).toBe("3 tiles");
  const viewButton = card.querySelector("button");
  context.expect(viewButton?.textContent).toBe("View");
  context.expect(viewButton?.ariaLabel).toBe("View Listed collection");
  context
    .expect(findElement(context, 'section[aria-label="Collections"]').ariaBusy)
    .toBe(null);
}

export async function listsFailureAsAlert(context: CaseContext): Promise<void> {
  await mountWithCollections(context, [
    MISSING_COLLECTION_LOCATION,
    LISTED_COLLECTION_LOCATION,
  ]);

  const items = context.root.querySelectorAll("li");
  const alert = items[0]?.querySelector('[role="alert"]');
  context
    .expect(alert?.querySelector("code")?.textContent)
    .toBe(MISSING_COLLECTION_LOCATION);
  context.expect(alert?.textContent).toContain("404");
  context
    .expect(items[1]?.querySelector("article h2")?.textContent)
    .toBe("Listed collection");
}

function findOpenRequest(context: CaseContext): CaseRequest | undefined {
  const openRequest = findRequest(context, "mods.open");
  if (openRequest === undefined || !("result" in openRequest)) {
    return undefined;
  }
  return openRequest;
}

export async function opensViewerForSelectedCollection(
  context: CaseContext,
): Promise<void> {
  await mountWithCollections(context, [LISTED_COLLECTION_LOCATION]);
  context.answer("mods.open", null);

  findElement(context, "article button").click();

  const openRequest = await context.waitFor(
    findOpenRequest.bind(undefined, context),
  );
  const inspectedSource = readInspectedSource(context);
  context.expect(inspectedSource.endsWith(LISTED_COLLECTION_PATH)).toBe(true);
  context.expect(openRequest.params).toEqual({
    mod: CONFIG_VIEWER,
    params: { target: inspectedSource },
  });
  context.expect(findElement(context, '[role="status"]').textContent).toBe("");
}

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithCollections(context, [
    LISTED_COLLECTION_LOCATION,
    MISSING_COLLECTION_LOCATION,
  ]);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}

export async function drawsCardBackground(context: CaseContext): Promise<void> {
  await mountWithCollections(context, [LISTED_COLLECTION_LOCATION]);

  const card = findElement(context, "li > article");
  context
    .expect(getComputedStyle(card).backgroundColor)
    .toBe(readTokenAs("--ot-card", "color"));
}

export async function drawsFailureBorder(context: CaseContext): Promise<void> {
  await mountWithCollections(context, [MISSING_COLLECTION_LOCATION]);

  const alert = findElement(context, 'li > [role="alert"]');
  context
    .expect(getComputedStyle(alert).borderTopColor)
    .toBe(readTokenAs("--ot-destructive", "color"));
}
