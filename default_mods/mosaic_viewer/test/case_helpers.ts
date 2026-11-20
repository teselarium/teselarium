import type { CaseContext, CaseRequest } from "../../mod_api.d.ts";

/**
 * The fixture mosaics the cases view, by their address in the default mods
 * folder: a case has no mod source to resolve against (default_mods/README.md).
 */
export const FIXTURE_REFERENCES = {
  shownMosaic: "./default_mods/mosaic_viewer/fixtures/shown_mosaic.yaml",
  missingCollection:
    "./default_mods/mosaic_viewer/fixtures/missing_collection.yaml",
  noCollection: "./default_mods/mosaic_viewer/fixtures/no_collection.yaml",
  untitledMosaic: "./default_mods/mosaic_viewer/fixtures/untitled_mosaic.yaml",
  /** A fixture path with no mosaic, which `mosaics.inspect` answers with an error. */
  missingMosaic: "./default_mods/mosaic_viewer/fixtures/missing_mosaic.yaml",
};

/** The ends of the fixtures' addresses, whatever the app's address. */
export const FIXTURE_PATHS = {
  shownMosaic: "/default_mods/mosaic_viewer/fixtures/shown_mosaic.yaml",
  fixtureMod: "/default_mods/mosaic_viewer/fixtures/fixture_mod/mod_conf.yaml",
  fixtureCollection:
    "/default_mods/mosaic_viewer/fixtures/fixture_collection.yaml",
  missingCollection:
    "/default_mods/mosaic_viewer/fixtures/no_such_collection.yaml",
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

/** The button with exactly this text, or `null`. */
export function findButton(
  context: CaseContext,
  text: string,
): HTMLButtonElement | null {
  for (const button of context.root.querySelectorAll("button")) {
    if (button.textContent === text) {
      return button;
    }
  }
  return null;
}

export function clickButton(context: CaseContext, text: string): void {
  const button = findButton(context, text);
  if (button === null) {
    throw new Error(`The viewer draws no "${text}" button.`);
  }
  button.click();
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

/** The first request for `method` once it settled, with a result or an error, or `undefined`. */
export function findSettledRequest(
  context: CaseContext,
  method: string,
): CaseRequest | undefined {
  const [request] = findRequests(context, method);
  if (request === undefined || !("result" in request || "error" in request)) {
    return undefined;
  }
  return request;
}

/** The `source` of the first result of `method`. */
export function readResultSource(context: CaseContext, method: string): string {
  const [request] = findRequests(context, method);
  const result = request?.result as { source?: unknown } | undefined;
  if (typeof result?.source !== "string") {
    throw new Error(`The viewer's ${method} has no source in its result.`);
  }
  return result.source;
}

/** The `<section>` named `name`. */
export function findSection(context: CaseContext, name: string): HTMLElement {
  return findElement(context, `section[aria-label="${name}"]`);
}

/** The description of a term of a `<dl>` in `container`. */
export function readDefinition(
  container: HTMLElement,
  term: string,
): HTMLElement {
  for (const termElement of container.querySelectorAll("dt")) {
    const description = termElement.nextElementSibling;
    if (
      termElement.textContent === term &&
      description instanceof HTMLElement
    ) {
      return description;
    }
  }
  throw new Error(`The viewer shows no "${term}".`);
}

/** A badge's text and variant, as `expect` compares them. */
export interface BadgeLook {
  text: string | null;
  variant: string | undefined;
}

export function readBadge(badge: Element | null): BadgeLook | null {
  if (!(badge instanceof HTMLElement)) {
    return null;
  }
  const badgeLook: BadgeLook = {
    text: badge.textContent,
    variant: badge.dataset.otVariant,
  };
  return badgeLook;
}

export function listTexts(elements: Iterable<Element>): string[] {
  const texts: string[] = [];
  for (const element of elements) {
    texts.push(element.textContent ?? "");
  }
  return texts;
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
