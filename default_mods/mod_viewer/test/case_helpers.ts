import type {
  CaseContext,
  CaseRequest,
  ModInspection,
} from "../../mod_api.d.ts";

/**
 * The fixture mods the cases view, by their address in the default mods
 * folder: a case has no mod source to resolve against (default_mods/README.md).
 */
export const FIXTURE_REFERENCES = {
  listedMod: "./default_mods/mod_viewer/fixtures/listed_mod",
  otherApi: "./default_mods/mod_viewer/fixtures/other_api",
  noRange: "./default_mods/mod_viewer/fixtures/no_range",
  badTheme: "./default_mods/mod_viewer/fixtures/bad_theme",
  /** A fixture path with no mod, which `mods.inspect` answers with an error. */
  missingMod: "./default_mods/mod_viewer/fixtures/missing_mod",
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

/** The first request for `method` once it settled, or `undefined`. */
export function findSettledRequest(
  context: CaseContext,
  method: string,
): CaseRequest | undefined {
  const [request] = findRequests(context, method);
  if (request === undefined || !("result" in request)) {
    return undefined;
  }
  return request;
}

/** The first `mods.open` once it settled, or `undefined`. */
export function findSettledOpen(context: CaseContext): CaseRequest | undefined {
  return findSettledRequest(context, "mods.open");
}

/** The inspection the viewer got from its `mods.inspect`. */
export function readInspection(context: CaseContext): ModInspection {
  const [inspectRequest] = findRequests(context, "mods.inspect");
  const inspection = inspectRequest?.result as ModInspection | undefined;
  if (inspection === undefined) {
    throw new Error("The viewer's mods.inspect has no result.");
  }
  return inspection;
}

/** The term of the viewer's metadata list whose text is `term`, or `null` without one. */
export function findTerm(
  context: CaseContext,
  term: string,
): HTMLElement | null {
  for (const termElement of context.root.querySelectorAll("dt")) {
    if (
      termElement.textContent === term &&
      termElement instanceof HTMLElement
    ) {
      return termElement;
    }
  }
  return null;
}

/** The description of a term of the viewer's metadata list. */
export function readDefinition(
  context: CaseContext,
  term: string,
): HTMLElement {
  for (const termElement of context.root.querySelectorAll("dt")) {
    const description = termElement.nextElementSibling;
    if (
      termElement.textContent === term &&
      description instanceof HTMLElement
    ) {
      return description;
    }
  }
  throw new Error(`The viewer's metadata has no "${term}".`);
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
    variant: badge.dataset.tesVariant,
  };
  return badgeLook;
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
