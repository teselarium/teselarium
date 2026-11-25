import type {
  CaseContext,
  CaseRequest,
  CollectionInspection,
} from "../../mod_api.d.ts";

/**
 * The fixture collections the cases view, by their address in the default
 * mods folder: a case has no mod source to resolve against
 * (default_mods/README.md).
 */
export const FIXTURE_REFERENCES = {
  shownCollection:
    "./default_mods/collection_viewer/fixtures/shown_collection.yaml",
  issuesCollection:
    "./default_mods/collection_viewer/fixtures/issues_collection.yaml",
  noTilesList: "./default_mods/collection_viewer/fixtures/no_tiles_list.yaml",
  /** A fixture path with no file, which `collections.inspect` answers with an error. */
  missingCollection:
    "./default_mods/collection_viewer/fixtures/missing_collection.yaml",
};

/** Mounts the viewer with `target` as its target parameter. */
export function mountWithTarget(
  context: CaseContext,
  target: string,
): Promise<void> {
  const mounting = context.mount({ params: { target } });
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

/** The inspection the viewer got from its `collections.inspect`. */
export function readInspection(context: CaseContext): CollectionInspection {
  const [inspectRequest] = findRequests(context, "collections.inspect");
  const inspection = inspectRequest?.result as CollectionInspection | undefined;
  if (inspection === undefined) {
    throw new Error("The viewer's collections.inspect has no result.");
  }
  return inspection;
}

/** The rows of the tile table, shown or hidden. */
export function listTileItems(context: CaseContext): HTMLElement[] {
  const items: HTMLElement[] = [];
  const selector = 'section[aria-label="Tiles"] tbody tr';
  for (const item of context.root.querySelectorAll<HTMLElement>(selector)) {
    items.push(item);
  }
  return items;
}

/** The label of a tile row: the text of its first cell. */
export function readTileLabel(item: HTMLElement): string | null {
  return item.querySelector("td")?.textContent ?? null;
}

/** The line under the filter that says how many tiles are shown. */
export function findTileCount(context: CaseContext): HTMLElement {
  return findElement(context, 'section[aria-label="Tiles"] [aria-live]');
}

/**
 * The labels of the tile items the user sees. It reads the computed display,
 * not the `hidden` attribute, so a style that shows a hidden item fails it.
 */
export function listShownLabels(context: CaseContext): (string | null)[] {
  const labels: (string | null)[] = [];
  for (const item of listTileItems(context)) {
    if (getComputedStyle(item).display !== "none") {
      labels.push(readTileLabel(item));
    }
  }
  return labels;
}

/** Types `text` in the filter field, as the user does. */
export function typeInFilter(context: CaseContext, text: string): void {
  const filter = findElement(context, 'input[type="search"]');
  if (!(filter instanceof HTMLInputElement)) {
    throw new Error("The viewer's filter is not an input.");
  }
  filter.value = text;
  filter.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The role each part of a table must carry explicitly. */
const TABLE_PART_ROLES: Record<string, string> = {
  TABLE: "table",
  THEAD: "rowgroup",
  TBODY: "rowgroup",
  TR: "row",
  TH: "columnheader",
  TD: "cell",
};

/**
 * The parts of `table`, itself included, whose `role` attribute is not the
 * explicit table role of their element, as `tag: role`. Empty when every
 * part carries its role.
 */
export function listWrongTableRoles(table: Element): string[] {
  const wrong: string[] = [];
  const parts = [table, ...table.querySelectorAll("thead, tbody, tr, th, td")];
  for (const part of parts) {
    const role = part.getAttribute("role");
    if (role !== TABLE_PART_ROLES[part.tagName]) {
      wrong.push(`${part.tagName.toLowerCase()}: ${role}`);
    }
  }
  return wrong;
}
