import type {
  CaseContext,
  CaseRequest,
  ModContextCollection,
  ModTile,
  ModYamlMapping,
} from "../../mod_api.d.ts";

/**
 * The fixture collections the cases name as `from`, by their address in the
 * default mods folder: a case has no mod source to resolve against
 * (default_mods/README.md).
 */
export const FIXTURE_REFERENCES = {
  /** The collection of the viewer's default mosaic, whose tiles are the check's tiles. */
  tilesCollection: "./default_mods/tile_viewer/fixtures/tiles_collection.yaml",
  /** A fixture path with no file, which `collections.inspect` answers with an error. */
  missingCollection:
    "./default_mods/tile_viewer/fixtures/missing_collection.yaml",
  /** A collection that lists two of the fixture tiles in another order, named as a stale `from`. */
  staleCollection: "./default_mods/tile_viewer/fixtures/stale_collection.yaml",
};

/** The tiles collection as the viewer gets it when it is opened with it, as `context.collection`. */
export const FIXTURE_OPENING_COLLECTION: ModContextCollection = {
  source: FIXTURE_REFERENCES.tilesCollection,
  title: "Viewer tiles",
  description: "A fixture collection that the tile viewer's tests show.",
};

/** The fixture tiles of the check's tiles, by file name, in the collection's order. */
export const FIXTURE_TILE_NAMES = [
  "kallocain.md",
  "fahrenheit_451.md",
  "reading_list.md",
];

/** A tile of the check's collection, by its file name. */
export function readFixtureTile(
  context: CaseContext,
  fileName: string,
): ModTile {
  for (const tile of context.tiles) {
    if (tile.source.endsWith(`/fixtures/tiles/${fileName}`)) {
      return tile;
    }
  }
  throw new Error(`The check's tiles have no fixture tile ${fileName}.`);
}

/**
 * A tile the case builds, next to the fixture tiles, with an empty body:
 * `tiles.renderBody` renders only the check's tiles, and the viewer sends it
 * for no empty body.
 */
export function buildCaseTile(
  context: CaseContext,
  fileName: string,
  metadata: ModYamlMapping,
): ModTile {
  const fixtureSource = readFixtureTile(context, FIXTURE_TILE_NAMES[0]).source;
  const tile: ModTile = {
    source: new URL(`./${fileName}`, fixtureSource).href,
    metadata,
    body: "",
    types: [],
  };
  return tile;
}

/**
 * Mounts the viewer with one fixture tile, and the tiles collection as `from`
 * unless `from` is `null`. It mounts without an opening collection, so the
 * viewer's place comes from `from` alone.
 */
export function mountWithFixtureTile(
  context: CaseContext,
  fileName: string,
  from: string | null = FIXTURE_REFERENCES.tilesCollection,
): Promise<void> {
  const params: Record<string, string> = {};
  if (from !== null) {
    params.from = from;
  }
  const mounting = context.mount({
    tiles: [readFixtureTile(context, fileName)],
    params,
    collection: null,
  });
  return mounting;
}

/**
 * Mounts the viewer with one fixture tile, opened with the tiles collection
 * as `context.collection`, and `from` as the `from` parameter unless it is
 * `null`.
 */
export function mountWithOpeningCollection(
  context: CaseContext,
  fileName: string,
  from: string | null = null,
): Promise<void> {
  const params: Record<string, string> = {};
  if (from !== null) {
    params.from = from;
  }
  const mounting = context.mount({
    tiles: [readFixtureTile(context, fileName)],
    params,
    collection: FIXTURE_OPENING_COLLECTION,
  });
  return mounting;
}

export function findElement(
  context: CaseContext,
  selector: string,
): HTMLElement {
  const element = context.root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`The viewer draws no element matching "${selector}".`);
  }
  return element;
}

export function findButton(
  context: CaseContext,
  text: string,
): HTMLButtonElement {
  for (const button of context.root.querySelectorAll("button")) {
    if (button.textContent === text) {
      return button;
    }
  }
  throw new Error(`The viewer draws no button "${text}".`);
}

export function findRequests(
  context: CaseContext,
  method: string,
): CaseRequest[] {
  const requests: CaseRequest[] = [];
  for (const request of context.requests) {
    if (request.method === method) {
      requests.push(request);
    }
  }
  return requests;
}

/** The first settled `mods.open` the viewer sent, once there is one. */
function findSettledOpen(context: CaseContext): CaseRequest | null {
  for (const request of findRequests(context, "mods.open")) {
    if ("result" in request || "error" in request) {
      return request;
    }
  }
  return null;
}

/** Waits for the viewer's first `mods.open` to settle, and gives it. */
export function waitForOpen(context: CaseContext): Promise<CaseRequest> {
  return context.waitFor(findSettledOpen.bind(undefined, context));
}

/** A link of the rendered body whose address ends with `fileName`, once the body is rendered. */
function findBodyLink(
  context: CaseContext,
  fileName: string,
): HTMLAnchorElement | null {
  for (const link of context.root.querySelectorAll("tes-tile-body a")) {
    if (link instanceof HTMLAnchorElement && link.href.endsWith(fileName)) {
      return link;
    }
  }
  return null;
}

/** Waits for the rendered body to hold a link to `fileName`, and gives it. */
export function waitForBodyLink(
  context: CaseContext,
  fileName: string,
): Promise<HTMLAnchorElement> {
  return context.waitFor(findBodyLink.bind(undefined, context, fileName));
}

/** The description of a key of the top-level metadata list. */
export function findMetadataValue(
  context: CaseContext,
  key: string,
): HTMLElement {
  for (const term of context.root.querySelectorAll(
    'section[aria-label="Metadata"] > dl > div > dt',
  )) {
    const description = term.nextElementSibling;
    if (term.textContent === key && description instanceof HTMLElement) {
      return description;
    }
  }
  throw new Error(`The viewer's metadata has no key "${key}".`);
}
