import type {
  CaseContext,
  CaseRequest,
  CatalogMosaicEntry,
} from "../../mod_api.d.ts";

/**
 * The fixture mosaics the cases list, by their address in the default mods
 * folder: a case has no mod source to resolve against (default_mods/README.md).
 */
export const LISTED_MOSAIC_LOCATION =
  "./default_mods/mosaic_explorer/fixtures/listed_mosaic.yaml";

export const OTHER_MOSAIC_LOCATION =
  "./default_mods/mosaic_explorer/fixtures/other_mosaic.yaml";

/** A fixture path with no file, which `mosaics.inspect` answers with an error. */
export const MISSING_MOSAIC_LOCATION =
  "./default_mods/mosaic_explorer/fixtures/missing_mosaic.yaml";

/** The end of the listed mosaic's source, whatever the app's address. */
const LISTED_MOSAIC_PATH =
  "/default_mods/mosaic_explorer/fixtures/listed_mosaic.yaml";

/** The viewer of the explorer's own config. */
const CONFIG_VIEWER = "mosaic_viewer";

/** The mod a fixture default mosaic is marked with. Only its title is drawn. */
const LISTED_MOD_MARK = {
  source: "./default_mods/mosaic_explorer/fixtures/fixture_mod/mod_conf.yaml",
  title: "Listed mod",
};

/** Answers `catalog.list` with `mosaics` as the catalog's mosaics, then mounts the explorer. */
function mountWithCatalogMosaics(
  context: CaseContext,
  mosaics: CatalogMosaicEntry[],
): Promise<void> {
  context.answer("catalog.list", { mosaics });
  const mounting = context.mount({ config: { viewer: CONFIG_VIEWER } });
  return mounting;
}

/** Answers `catalog.list` with `sources` as catalog mosaics that are no mod's default mosaic, then mounts the explorer. */
export function mountWithMosaics(
  context: CaseContext,
  sources: string[],
): Promise<void> {
  const mosaics: CatalogMosaicEntry[] = [];
  for (const source of sources) {
    mosaics.push({ source, defaultOf: null });
  }
  return mountWithCatalogMosaics(context, mosaics);
}

export function findElement(
  context: CaseContext,
  selector: string,
): HTMLElement {
  const element = context.root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`The explorer draws no element matching "${selector}".`);
  }
  return element;
}

/** The button whose accessible name is `name`. */
export function findButton(
  context: CaseContext,
  name: string,
): HTMLButtonElement {
  for (const button of context.root.querySelectorAll("button")) {
    if (button.ariaLabel === name) {
      return button;
    }
  }
  throw new Error(`The explorer draws no button named "${name}".`);
}

function findRequests(context: CaseContext, method: string): CaseRequest[] {
  const requests: CaseRequest[] = [];
  for (const request of context.requests) {
    if (request.method === method) {
      requests.push(request);
    }
  }
  return requests;
}

/** The first request for `method` once it settled, or `undefined`. */
function findSettledRequest(
  context: CaseContext,
  method: string,
): CaseRequest | undefined {
  const [request] = findRequests(context, method);
  if (request === undefined || !("result" in request || "error" in request)) {
    return undefined;
  }
  return request;
}

/** The source the explorer got from `mosaics.inspect` for the listed mosaic. */
function readInspectedSource(context: CaseContext): string {
  const [inspectRequest] = findRequests(context, "mosaics.inspect");
  const result = inspectRequest?.result as { source?: unknown } | undefined;
  if (typeof result?.source !== "string") {
    throw new Error(
      "The explorer's mosaics.inspect has no source in its result.",
    );
  }
  return result.source;
}

function listRequestMethods(context: CaseContext): string[] {
  const methods: string[] = [];
  for (const request of context.requests) {
    methods.push(request.method);
  }
  return methods;
}

export async function listsMosaicsAsCards(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [
    LISTED_MOSAIC_LOCATION,
    OTHER_MOSAIC_LOCATION,
  ]);

  const cards = context.root.querySelectorAll("li > article");
  context.expect(cards.length).toBe(2);
  context
    .expect(cards[0].querySelector("h2")?.textContent)
    .toBe("Listed mosaic");
  context
    .expect(cards[0].querySelector("p")?.textContent)
    .toBe("A fixture mosaic that the explorer's tests list.");
  context
    .expect(cards[1].querySelector("h2")?.textContent)
    .toBe("Other mosaic");
  const buttons = cards[0].querySelectorAll("button");
  context.expect(buttons[0]?.textContent).toBe("Open");
  context.expect(buttons[0]?.ariaLabel).toBe("Open Listed mosaic");
  context.expect(buttons[1]?.textContent).toBe("View");
  context.expect(buttons[1]?.ariaLabel).toBe("View Listed mosaic");
  context
    .expect(findElement(context, 'section[aria-label="Mosaics"]').ariaBusy)
    .toBe(null);
  context.expect(cards[0].querySelector("small")).toBe(null);
  context
    .expect(listRequestMethods(context))
    .toEqual(["catalog.list", "mosaics.inspect", "mosaics.inspect"]);
}

export async function marksDefaultMosaic(context: CaseContext): Promise<void> {
  await mountWithCatalogMosaics(context, [
    { source: OTHER_MOSAIC_LOCATION, defaultOf: null },
    { source: LISTED_MOSAIC_LOCATION, defaultOf: LISTED_MOD_MARK },
  ]);

  const cards = context.root.querySelectorAll("li > article");
  context.expect(cards[0].querySelector("small")).toBe(null);
  context
    .expect(cards[1].querySelector("h2 + small")?.textContent)
    .toBe("Default mosaic of Listed mod");
  context
    .expect(cards[1].querySelector("p")?.textContent)
    .toBe("A fixture mosaic that the explorer's tests list.");
}

export async function listsFailureAsAlert(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [
    MISSING_MOSAIC_LOCATION,
    LISTED_MOSAIC_LOCATION,
  ]);

  const items = context.root.querySelectorAll("li");
  const alert = items[0]?.querySelector('[role="alert"]');
  context
    .expect(alert?.querySelector("code")?.textContent)
    .toBe(MISSING_MOSAIC_LOCATION);
  context.expect(alert?.textContent).toContain("404");
  context
    .expect(items[1]?.querySelector("article h2")?.textContent)
    .toBe("Listed mosaic");
}

export async function opensSelectedMosaic(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [LISTED_MOSAIC_LOCATION]);
  context.answer("mosaics.open", null);

  findButton(context, "Open Listed mosaic").click();

  const openRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mosaics.open"),
  );
  const inspectedSource = readInspectedSource(context);
  context.expect(inspectedSource.endsWith(LISTED_MOSAIC_PATH)).toBe(true);
  context.expect(openRequest.params).toEqual({ mosaic: inspectedSource });
  context.expect(openRequest.result).toBe(null);
  context.expect(findRequests(context, "mods.open").length).toBe(0);
  context.expect(findElement(context, '[role="status"]').textContent).toBe("");
}

export async function opensViewerForSelectedMosaic(
  context: CaseContext,
): Promise<void> {
  await mountWithMosaics(context, [LISTED_MOSAIC_LOCATION]);
  context.answer("mods.open", null);

  findButton(context, "View Listed mosaic").click();

  const openRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mods.open"),
  );
  context.expect(openRequest.params).toEqual({
    mod: CONFIG_VIEWER,
    params: { target: readInspectedSource(context) },
  });
  context.expect(findRequests(context, "mosaics.open").length).toBe(0);
  context.expect(findElement(context, '[role="status"]').textContent).toBe("");
}

function readStatusText(context: CaseContext): string {
  const statusText = findElement(context, '[role="status"]').textContent ?? "";
  return statusText;
}

export async function showsRefusedOpen(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [LISTED_MOSAIC_LOCATION]);

  findButton(context, "View Listed mosaic").click();

  const statusText = await context.waitFor(
    readStatusText.bind(undefined, context),
  );
  context
    .expect(statusText)
    .toBe("mods.open: only the visible mod can open mods");
  context
    .expect(findElement(context, "li > article h2").textContent)
    .toBe("Listed mosaic");
}
